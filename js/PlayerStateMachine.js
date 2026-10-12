/**
 * PlayerStateMachine.js —— 玩家状态机
 *
 * 职责：集中记录「玩家维度」的全部进度型布尔状态与技能可用性状态，是这些状态的**唯一权威**：
 *
 *   一、布尔状态（存进基类的状态表，严格校验）
 *     - alive                        玩家存亡（唯一权威；气血写入路径负责同步）
 *     - combatUnlocked               战斗按键是否已解锁（原 PlayerCombat.unlockedOnce）
 *     - skillUnlocked:<skillId>      技能是否已解锁（能否出现在技能栏）
 *     - skillLearned:<skillId>       技能是否已习得（剧情 / 任务传授）
 *
 *   二、技能可用性（数值型计时器，配严格更新方法）
 *     - skillCooldowns:<skillId>     技能冷却剩余秒数（从 PlayerCombat 迁入，唯一权威）
 *     - skillLocks:<skillId>         技能互斥禁用剩余秒数（新增能力：技能 A 用了，一段时间内禁用技能 B）
 *
 * 两个核心查询（对外统一入口）：
 *     isSkillUnlocked(id)   是否解锁（静态：境界 / 职业 / 教学 / 已习得是否达标）
 *     canUseSkill(id, mana) 当前能否施放（动态：已解锁 + 冷却就绪 + 未被互斥禁用 [+ 灵息足够]）
 *
 * 依赖：GameConfig（读取技能消耗）、StateMachine（基类）。
 */
class PlayerStateMachine extends StateMachine {
    /** 技能布尔状态的前缀 */
    static SKILL_UNLOCKED_PREFIX = 'skillUnlocked:';
    static SKILL_LEARNED_PREFIX = 'skillLearned:';

    constructor() {
        super('PlayerStateMachine');

        // ===== 一、布尔状态 =====
        // 存亡：活 / 死 可双向转移（死亡 → 复活），但**只能由严格方法驱动**
        this.define('alive', {
            values: [false, true], initial: true,
            transitions: { false: [true], true: [false] },
            describe: '玩家是否存活',
        });
        // 战斗按键解锁：单调（解锁后不再锁回去）
        this.define('combatUnlocked', {
            values: [false, true], initial: false, monotonic: true,
            describe: '战斗按键是否已解锁（教学开始 / 完成）',
        });

        // ===== 二、技能可用性 =====
        /** @type {Object<string, number>} 技能 / 战斗行为冷却剩余秒数（唯一权威；PlayerCombat 直接引用本对象） */
        this.skillCooldowns = {};
        /** @type {Object<string, number>} 技能互斥禁用剩余秒数 */
        this.skillLocks = {};

        // 便捷钩子：冷却 / 禁用开始时可通知外部（可选）
        this.onCooldownStart = null;   // (id, seconds) => void
        this.onSkillLocked = null;     // (id, seconds, reason) => void
    }

    // ==================== 一、存亡 ====================

    /**
     * 设置存亡状态（严格：只接受布尔）
     * @param {boolean} value
     * @returns {boolean}
     */
    setAlive(value) {
        if (typeof value !== 'boolean') {
            return this._reject('alive', this.get('alive'), value, '存亡状态只接受布尔值');
        }
        return this.set('alive', value);
    }

    /** 玩家是否存活 */
    isAlive() { return this.get('alive') === true; }

    /** 标记死亡（存活时才生效） */
    markDead() { return this.setAlive(false); }

    /** 复活（死亡时才生效） */
    revive() { return this.setAlive(true); }

    // ==================== 二、战斗按键解锁 ====================

    /**
     * 标记战斗按键已解锁（单调）
     * @param {boolean} [value=true]
     */
    setCombatUnlocked(value = true) { return this.set('combatUnlocked', value === true); }

    /** 战斗按键是否已解锁 */
    isCombatUnlocked() { return this.get('combatUnlocked') === true; }

    // ==================== 三、技能：解锁 / 习得 ====================

    /**
     * 确保某个技能的两个布尔状态已登记
     * @param {string} skillId
     * @private
     */
    _ensureSkill(skillId) {
        const unlockedKey = PlayerStateMachine.SKILL_UNLOCKED_PREFIX + skillId;
        const learnedKey = PlayerStateMachine.SKILL_LEARNED_PREFIX + skillId;
        if (!this.isDefined(unlockedKey)) {
            this.define(unlockedKey, {
                values: [false, true], initial: false, monotonic: true,
                describe: `技能 ${skillId} 是否解锁`,
            });
        }
        if (!this.isDefined(learnedKey)) {
            this.define(learnedKey, {
                values: [false, true], initial: false, monotonic: true,
                describe: `技能 ${skillId} 是否已习得`,
            });
        }
        return { unlockedKey, learnedKey };
    }

    /**
     * 解锁技能（严格：单调，解锁后不可再锁回；如需转职重置请用 relockSkill）
     * @param {string} skillId
     * @returns {boolean}
     */
    unlockSkill(skillId) {
        if (!skillId) return false;
        const { unlockedKey } = this._ensureSkill(skillId);
        return this.set(unlockedKey, true);
    }

    /**
     * 显式设置解锁状态（供「协调器」按上下文同步；false 仅在单调规则允许时生效，
     * 常规流程请优先用 unlockSkill / relockSkill）
     * @param {string} skillId
     * @param {boolean} value
     */
    setSkillUnlocked(skillId, value) {
        if (!skillId) return false;
        const { unlockedKey } = this._ensureSkill(skillId);
        if (value === true) return this.set(unlockedKey, true);
        // 锁回 false：绕过单调限制的显式操作（仅转职 / 重置场景使用）
        return this._forceSet(unlockedKey, false);
    }

    /** 技能是否已解锁 */
    isSkillUnlocked(skillId) {
        if (!skillId) return false;
        const key = PlayerStateMachine.SKILL_UNLOCKED_PREFIX + skillId;
        return this.isDefined(key) && this.get(key) === true;
    }

    /**
     * 转职 / 重置时锁回若干技能（显式、受控的「解锁不可逆」例外）
     * @param {string[]} skillIds
     */
    relockSkills(skillIds) {
        if (!Array.isArray(skillIds)) return 0;
        let n = 0;
        for (const id of skillIds) {
            const key = PlayerStateMachine.SKILL_UNLOCKED_PREFIX + id;
            if (this.isDefined(key) && this.get(key) === true) {
                this._forceSet(key, false);
                n++;
            }
        }
        return n;
    }

    /**
     * 标记技能已习得（剧情 / 任务传授；单调）
     * @param {string} skillId
     */
    learnSkill(skillId) {
        if (!skillId) return false;
        const { learnedKey } = this._ensureSkill(skillId);
        return this.set(learnedKey, true);
    }

    /** 技能是否已习得 */
    isSkillLearned(skillId) {
        if (!skillId) return false;
        const key = PlayerStateMachine.SKILL_LEARNED_PREFIX + skillId;
        return this.isDefined(key) && this.get(key) === true;
    }

    /**
     * 显式写入（绕过单调限制，仅用于「读档快照 / 转职重置」等受控场景）
     * @private
     */
    _forceSet(key, value) {
        if (!this.isDefined(key)) return this._reject(key, undefined, value, '状态未登记');
        const from = this.get(key);
        if (from === value) return true;
        this._values.set(key, value);
        if (this.onTransition) this.onTransition(this, key, from, value);
        return true;
    }

    // ==================== 四、技能：冷却 / 互斥禁用 ====================

    /**
     * 开始一个技能 / 战斗行为的冷却
     * @param {string} id
     * @param {number} seconds
     */
    startCooldown(id, seconds) {
        if (!id || !(seconds > 0)) return false;
        this.skillCooldowns[id] = seconds;
        if (this.onCooldownStart) this.onCooldownStart(id, seconds);
        return true;
    }

    /** 冷却剩余秒数（无冷却返回 0） */
    getCooldown(id) { return this.skillCooldowns[id] || 0; }

    /** 是否在冷却中 */
    isOnCooldown(id) { return (this.skillCooldowns[id] || 0) > 0; }

    /** 清空全部冷却（复活 / 结算时用） */
    clearCooldowns() {
        for (const key in this.skillCooldowns) this.skillCooldowns[key] = 0;
    }

    /**
     * 禁用某个技能一段时间（技能互斥：如技能 A 施展后，B 在 seconds 秒内不可用）
     * @param {string} id - 被禁用的技能
     * @param {number} seconds
     * @param {string} [reason] - 禁用来源（调试用）
     */
    lockSkill(id, seconds, reason) {
        if (!id || !(seconds > 0)) return false;
        this.skillLocks[id] = Math.max(this.skillLocks[id] || 0, seconds);
        if (this.onSkillLocked) this.onSkillLocked(id, seconds, reason || '');
        return true;
    }

    /** 批量禁用（一次禁用多个技能） */
    lockSkills(ids, seconds, reason) {
        if (!Array.isArray(ids)) return 0;
        let n = 0;
        for (const id of ids) if (this.lockSkill(id, seconds, reason)) n++;
        return n;
    }

    /** 手动解除禁用 */
    unlockSkillLock(id) {
        if (!this.skillLocks[id]) return false;
        this.skillLocks[id] = 0;
        return true;
    }

    /** 是否被互斥禁用 */
    isSkillLocked(id) { return (this.skillLocks[id] || 0) > 0; }

    /** 禁用剩余秒数 */
    getSkillLock(id) { return this.skillLocks[id] || 0; }

    /**
     * 每帧推进冷却与禁用计时（由主循环 / 战斗系统调用一次）
     * @param {number} deltaTime - 秒
     */
    tick(deltaTime) {
        if (!(deltaTime > 0)) return;
        for (const key in this.skillCooldowns) {
            if (this.skillCooldowns[key] > 0) {
                this.skillCooldowns[key] = Math.max(0, this.skillCooldowns[key] - deltaTime);
            }
        }
        for (const key in this.skillLocks) {
            if (this.skillLocks[key] > 0) {
                this.skillLocks[key] = Math.max(0, this.skillLocks[key] - deltaTime);
            }
        }
    }

    // ==================== 五、统一门控查询 ====================

    /**
     * 当前能否施放该技能（严格门控，唯一入口）
     *   条件：已解锁 + 冷却就绪 + 未被互斥禁用（+ 传入 mana 时校验灵息足够）
     * @param {string} id - 技能 / 战斗行为 id
     * @param {number} [mana] - 当前灵息（可选；传入则一并校验消耗）
     * @returns {{ ok: boolean, reason: string|null }}
     */
    checkCanUseSkill(id, mana) {
        if (!id) return { ok: false, reason: '未知技能' };
        if (!this.isSkillUnlocked(id)) return { ok: false, reason: 'locked' };
        if (this.isSkillLocked(id)) return { ok: false, reason: 'lockedBySkill' };
        if (this.isOnCooldown(id)) return { ok: false, reason: 'cooldown' };
        if (typeof mana === 'number') {
            const cost = this._skillManaCost(id);
            if (mana < cost) return { ok: false, reason: 'mana' };
        }
        return { ok: true, reason: null };
    }

    /**
     * 当前能否施放该技能（布尔便捷版）
     * @param {string} id
     * @param {number} [mana]
     */
    canUseSkill(id, mana) { return this.checkCanUseSkill(id, mana).ok; }

    /**
     * 从 GameConfig.skills 读取技能灵息消耗（读不到按 0 处理）
     * @param {string} id
     * @private
     */
    _skillManaCost(id) {
        if (typeof GameConfig === 'undefined' || !GameConfig.getInstance) return 0;
        const cfg = GameConfig.getInstance().getSkill(id);
        return cfg && typeof cfg.manaCost === 'number' ? cfg.manaCost : 0;
    }

    // ==================== 六、序列化 ====================

    /**
     * 序列化（冷却 / 禁用为瞬时状态，不存档）
     */
    serialize() {
        const skills = {};
        const uPrefix = PlayerStateMachine.SKILL_UNLOCKED_PREFIX;
        const lPrefix = PlayerStateMachine.SKILL_LEARNED_PREFIX;
        for (const key of this.keys()) {
            if (key.indexOf(uPrefix) === 0) {
                const id = key.slice(uPrefix.length);
                (skills[id] = skills[id] || {}).unlocked = this.get(key);
            } else if (key.indexOf(lPrefix) === 0) {
                const id = key.slice(lPrefix.length);
                (skills[id] = skills[id] || {}).learned = this.get(key);
            }
        }
        return {
            alive: this.get('alive'),
            combatUnlocked: this.get('combatUnlocked'),
            skills,
        };
    }

    /**
     * 反序列化（快照恢复；技能布尔直接写值）
     * @param {Object} data
     */
    deserialize(data) {
        if (!data) return;
        if (data.alive !== undefined) this._values.set('alive', data.alive === true);
        if (data.combatUnlocked !== undefined) this._values.set('combatUnlocked', data.combatUnlocked === true);
        if (data.skills && typeof data.skills === 'object') {
            for (const id in data.skills) {
                const s = data.skills[id] || {};
                const { unlockedKey, learnedKey } = this._ensureSkill(id);
                this._values.set(unlockedKey, s.unlocked === true);
                this._values.set(learnedKey, s.learned === true);
            }
        }
        // 瞬时状态一律归零
        this.clearCooldowns();
        for (const key in this.skillLocks) this.skillLocks[key] = 0;
    }

    /** 复位（冷却 / 禁用清空，布尔回初始值） */
    reset() {
        super.reset();
        this.clearCooldowns();
        for (const key in this.skillLocks) this.skillLocks[key] = 0;
    }
}
