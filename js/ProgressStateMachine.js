/**
 * ProgressStateMachine.js —— 剧情进度状态机
 *
 * 职责：记录「游戏进度」中所有**剧情事实类布尔状态**（原 `QuestSystem.storyFlags` 通用袋）。
 * 这些标记回答的是「这件事有没有发生过」——章节是否完结、Boss 是否击败过、
 * 某项能力 / 地图是否解锁、结局是否看过等。
 *
 * 严格规则：
 *   - 所有进度标记一律 **单调（monotonic）**：只置真、不可逆（本项目从无 `setStoryFlag(x,false)` 的用法）；
 *   - 未登记的标记：允许「动态前缀」（如 `map_unlocked_<mapId>`）自动登记；
 *     其余未登记标记会**告警并自动登记**（不静默丢弃，但会留下痕迹便于补齐登记表）；
 *   - 非布尔值一律拒绝。
 *
 * 对外方法：
 *   mark(flag, value=true)   更新（严格）
 *   has(flag)                是否已发生
 *   getFlag(flag)            读取原始值（未登记返回 undefined）
 *   markMany(list)           批量标记
 *   getAll()                 全部标记快照
 *   isKnown(flag)            是否在登记表 / 动态前缀内
 *
 * 依赖：StateMachine（基类）。
 */
class ProgressStateMachine extends StateMachine {
    /**
     * 已登记的进度标记表：flag → 说明。
     * 新增剧情进度标记时**只需在这里补一行**（唯一登记处）。
     */
    static get FLAGS() {
        return {
            // ===== 第一章：青岚浮野 =====
            foundation_unlocked: '筑基已解锁（可突破）',
            foundation_trial_done: '筑基试炼已完成',
            profession_chosen: '已选择职业',
            boss_shanxiao_defeated: '摄风山魈已击败（第一章战场）',
            chapter1_farewell_done: '码头告别已完成',
            chapter1_complete: '第一章主线完结（码头登船）',

            // ===== 第二章：云渡泽 =====
            yunduze_unlocked: '云渡泽已解锁（世界地图可去）',
            chapter2_intro_done: '第二章开场剧情已播',
            chapter2_b01_seen: '第二章 B01 字幕已看',
            chapter2_sword_training_done: '剑影连斩试炼已完成',
            chapter2_boat_repaired: '渡船已修好',
            chapter2_travel_boat_unlocked: '行舟已解锁',
            chapter2_identify_done: '认灯归魂已完成',
            chapter2_escort_done: '逆流送灯已完成',
            chapter2_soul_returned: '魂灯已归位',
            chapter2_lamps_identified: '万灯已辨认',
            chapter2_core_trial_done: '阵核试炼已完成',
            due_boss_defeated: '渡厄使已击败（第二章战场）',
            due_boss_debug_defeated: '渡厄使已击败（调试入口，与正式标记分离）',
            chapter2_boarding_done: '第二章登船已完成',
            chapter2_complete: '第二章主线完结',

            // ===== 全局 =====
            game_ending_seen: '已看过游戏完结字幕',
        };
    }

    /** 允许自动登记的动态前缀（值形如 `map_unlocked_yunduze`） */
    static get DYNAMIC_PREFIXES() { return ['map_unlocked_']; }

    constructor() {
        super('ProgressStateMachine');

        // 登记全部已知标记：布尔 + 单调（只置真、不可逆）
        const flags = ProgressStateMachine.FLAGS;
        for (const key in flags) {
            this.define(key, { values: [false, true], initial: false, monotonic: true, describe: flags[key] });
        }
        /** 运行期自动登记（动态前缀 / 未知）的标记集合 */
        this._autoRegistered = new Set();
    }

    /**
     * 该标记是否已被承认（登记表内，或命中动态前缀）
     * @param {string} flag
     */
    isKnown(flag) {
        if (!flag) return false;
        if (this.isDefined(flag)) return true;
        return ProgressStateMachine.DYNAMIC_PREFIXES.some(p => flag.indexOf(p) === 0);
    }

    /**
     * 登记一个动态标记（仅动态前缀允许；其余告警但仍登记，避免静默丢进度）
     * @param {string} flag
     * @private
     */
    _ensureDefined(flag) {
        if (this.isDefined(flag)) return true;
        const isDynamic = ProgressStateMachine.DYNAMIC_PREFIXES.some(p => flag.indexOf(p) === 0);
        if (!isDynamic) {
            this._warn(`进度标记 "${flag}" 未登记在 ProgressStateMachine.FLAGS —— 已自动登记为单调标记，`
                + '建议补进登记表（唯一登记处）');
        }
        this.define(flag, {
            values: [false, true], initial: false, monotonic: true,
            describe: isDynamic ? '动态进度标记' : '（未登记的）进度标记',
        });
        this._autoRegistered.add(flag);
        return true;
    }

    /**
     * 标记某个剧情进度「已发生」
     * @param {string} flag
     * @param {boolean} [value=true]
     * @returns {boolean} 是否更新成功（已为真时幂等返回 true）
     */
    mark(flag, value = true) {
        if (!flag || typeof flag !== 'string') {
            this._warn(`mark 需要非空字符串标记名（收到 ${JSON.stringify(flag)}）`);
            return false;
        }
        this._ensureDefined(flag);
        if (typeof value !== 'boolean') {
            return this._reject(flag, this.get(flag), value, '进度标记只接受布尔值');
        }
        return this.set(flag, value);
    }

    /**
     * 批量标记
     * @param {string[]|Object} flags - 字符串数组，或 { flag: bool }
     * @returns {string[]} 被拒绝的标记列表
     */
    markMany(flags) {
        const rejected = [];
        if (Array.isArray(flags)) {
            for (const f of flags) if (!this.mark(f)) rejected.push(f);
        } else if (flags && typeof flags === 'object') {
            for (const f in flags) if (!this.mark(f, flags[f])) rejected.push(f);
        }
        return rejected;
    }

    /**
     * 该进度是否已发生
     * @param {string} flag
     * @returns {boolean}
     */
    has(flag) {
        if (!flag || !this.isDefined(flag)) return false;
        return this.get(flag) === true;
    }

    /**
     * 读取原始值（未登记返回 undefined）
     * @param {string} flag
     */
    getFlag(flag) {
        return this.isDefined(flag) ? this.get(flag) : undefined;
    }

    /**
     * 全部「已发生」的标记快照（只含已置真为 true 的；等价于旧的 `storyFlags` 袋）。
     * 未发生的登记标记（值为 false）不在此列出 —— 与旧实现「只存已设置的标记」语义一致，
     * 也让存档的 storyFlags 字段保持旧格式（只写 true 项）。
     * @returns {Object<string, boolean>}
     */
    getAll() {
        const out = {};
        for (const key of this.keys()) if (this.get(key) === true) out[key] = true;
        return out;
    }

    /** 已登记但从未置真的标记（调试：看看还差哪些进度） */
    getPending() {
        const out = [];
        for (const key of this.keys()) if (this.get(key) !== true) out.push(key);
        return out;
    }

    /** 自动登记的标记（非登记表内的） */
    getAutoRegistered() { return Array.from(this._autoRegistered); }

    /**
     * 反序列化（快照恢复）
     * 先按动态前缀 / 未知标记补登记，再交给基类写值 ——
     * 否则 `map_unlocked_*` 这类运行期动态标记会在读档时被判为「未登记」而被忽略（进度丢失）。
     * @param {Object} data - { flag: bool }
     */
    deserialize(data) {
        if (!data || typeof data !== 'object') return;
        for (const flag in data) this._ensureDefined(flag);
        super.deserialize(data);
    }
}
