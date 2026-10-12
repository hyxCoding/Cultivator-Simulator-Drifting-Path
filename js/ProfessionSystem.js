/**
 * 职业系统类
 * 管理玩家职业选择、技能配置、攻击计算等
 */
class ProfessionSystem {
    /**
     * @param {Object} config - 初始配置
     */
    constructor(config = {}) {
        const gameConfig = GameConfig.getInstance();
        
        this.currentProfessionId = config.professionId || 'sanxiu';
        this.professionConfig = gameConfig.getProfession(this.currentProfessionId);

        // 玩家数据引用（唯一境界来源）：由 Player 在构造时注入。
        // 未注入时 getCurrentRealm 回落到默认境界，而不是旧代码写死的 'zhuji'。
        this.playerData = config.playerData || null;
        
        // 技能配置
        this.basicSkills = new Map();      // 基础技能 {skillId: level}
        this.professionSkills = new Map(); // 职业技能 {skillId: level}
        this.activeSkillSlots = [];        // 主动技能槽位
        
        // 流派选择（结丹后开放）
        this.currentSchool = config.school || null; // 当前流派
        
        // 技能点：唯一存储位置是 PlayerData（见 js/PlayerData.js）。
        // 下面两个字段只在「没有注入 playerData」时作为兜底；对外仍通过
        // basicSkillPoints / professionSkillPoints 访问器读写（见下方 getter/setter），
        // 有 playerData 时一律落到 playerData 上 —— 外部代码无需改动，
        // 也不再有「两处各存一份、改一处不生效」的问题。
        this._basicSkillPoints = config.basicSkillPoints || 0;
        this._professionSkillPoints = config.professionSkillPoints || 0;
        
        // 默认配置
        this.defaultBasicSkills = ['lingxidan', 'hutishu'];
        this.maxBasicSkillSlots = 2;
        this.maxProfessionSkillSlots = 3;
        
        // 初始化默认技能
        this.initDefaultSkills();
    }

    // ==================== 技能点访问器（唯一存储 = PlayerData）====================
    // 说明：注入 playerData 后，读写都代理到 playerData，保证「改一处即全局生效」；
    //       未注入时退回本对象的兜底字段（兼容单独实例化的场景 / 测试）。

    get basicSkillPoints() {
        if (this.playerData) return this.playerData.basicSkillPoints || 0;
        return this._basicSkillPoints || 0;
    }
    set basicSkillPoints(value) {
        if (this.playerData) { this.playerData.basicSkillPoints = value; return; }
        this._basicSkillPoints = value;
    }

    get professionSkillPoints() {
        if (this.playerData) return this.playerData.professionSkillPoints || 0;
        return this._professionSkillPoints || 0;
    }
    set professionSkillPoints(value) {
        if (this.playerData) { this.playerData.professionSkillPoints = value; return; }
        this._professionSkillPoints = value;
    }

    /**
     * 初始化默认技能
     */
    initDefaultSkills() {
        const gameConfig = GameConfig.getInstance();
        
        // 初始化基础技能
        this.defaultBasicSkills.forEach(skillId => {
            const skillConfig = gameConfig.getSkill(skillId);
            if (skillConfig) {
                this.basicSkills.set(skillId, 1); // 初始等级1
            }
        });
    }

    /**
     * 切换职业
     * @param {string} professionId - 目标职业ID
     * @returns {boolean} 是否切换成功
     */
    switchProfession(professionId) {
        const gameConfig = GameConfig.getInstance();
        const professionConfig = gameConfig.getProfession(professionId);
        
        if (!professionConfig) {
            console.warn(`职业不存在: ${professionId}`);
            return false;
        }
        
        // 保存旧职业的技能配置
        const oldProfessionSkills = new Map(this.professionSkills);
        
        // 切换职业
        this.currentProfessionId = professionId;
        this.professionConfig = professionConfig;
        
        // 清空职业技能
        this.professionSkills.clear();
        
        // 初始化新职业的基础技能
        if (professionConfig.skills) {
            const unlockStage = professionConfig.unlockedAt;
            const currentStage = this.getCurrentRealmStage();
            
            // 根据当前境界解锁技能
            professionConfig.skills.forEach(skillId => {
                const skillConfig = gameConfig.getSkill(skillId);
                if (skillConfig && this.isRealmReached(skillConfig.unlockStage)) {
                    this.professionSkills.set(skillId, 1);
                }
            });
        }
        
        // 切换流派
        this.currentSchool = null;
        
        return true;
    }

    /**
     * 判断当前境界是否已达到某个「解锁境界」门槛。
     *
     * 说明（命名澄清）：本方法只做**境界门槛比较**，与「某个技能是否解锁」是两回事 ——
     * 后者（技能能否出现在技能栏）由玩家状态机 `PlayerStateMachine.isSkillUnlocked(skillId)` 统一负责。
     * 旧名 `isSkillUnlocked(unlockStage)` 语义有歧义，已改名 `isRealmReached`。
     * @param {string} unlockStage - 解锁境界
     * @returns {boolean} 是否已达到
     */
    isRealmReached(unlockStage) {
        // 境界顺序取自唯一常量源（GameConfig.realmOrder）
        const realmOrder = GameConfig.getInstance().getRealmOrder();
        const currentRealmIndex = realmOrder.indexOf(this.getCurrentRealm());
        const unlockRealmIndex = realmOrder.indexOf(unlockStage);
        
        return currentRealmIndex >= unlockRealmIndex;
    }

    /** @deprecated 旧名，语义易混淆；请改用 isRealmReached(unlockStage) */
    isSkillUnlocked(unlockStage) { return this.isRealmReached(unlockStage); }

    /**
     * 获取当前境界
     * 修正（重构）：旧实现永远返回 'zhuji'（注释「暂时返回默认」），导致练气期就解锁筑基技能。
     * 现在实时读取注入的 playerData；无引用时回落到 GameConfig 的默认境界。
     */
    getCurrentRealm() {
        if (this.playerData && this.playerData.realm) return this.playerData.realm;
        return GameConfig.getInstance().getDefaultRealmId();
    }

    /**
     * 获取当前境界阶段
     */
    getCurrentRealmStage() {
        if (this.playerData && this.playerData.stage) return this.playerData.stage;
        return '初期';
    }

    /**
     * 绑定 / 替换玩家数据引用（读档重建角色时使用）
     * @param {PlayerData} playerData
     */
    setPlayerData(playerData) {
        // 从「无 playerData」切到「有」时，把兜底字段里可能残留的值并入唯一存储
        // （仅当对方为空时），避免历史数据丢失。
        if (playerData && !this.playerData) {
            if (!playerData.basicSkillPoints && this._basicSkillPoints) {
                playerData.basicSkillPoints = this._basicSkillPoints;
            }
            if (!playerData.professionSkillPoints && this._professionSkillPoints) {
                playerData.professionSkillPoints = this._professionSkillPoints;
            }
        }
        this.playerData = playerData || null;
    }

    /**
     * 升级技能
     * @param {string} skillId - 技能ID
     * @param {string} type - 技能类型：'basic' 或 'profession'
     * @returns {boolean} 是否升级成功
     */
    upgradeSkill(skillId, type) {
        const gameConfig = GameConfig.getInstance();
        const skillConfig = gameConfig.getSkill(skillId);
        
        if (!skillConfig) return false;
        
        const skillMap = type === 'basic' ? this.basicSkills : this.professionSkills;
        const currentLevel = skillMap.get(skillId) || 0;
        
        // 检查是否已满级
        if (currentLevel >= skillConfig.maxLevel) {
            return false;
        }
        
        // 计算所需技能点
        const requiredPoints = skillConfig.upgradeCost[currentLevel - 1] || 0;
        
        // 检查技能点是否足够
        if (type === 'basic') {
            if (this.basicSkillPoints < requiredPoints) return false;
            this.basicSkillPoints -= requiredPoints;
        } else {
            if (this.professionSkillPoints < requiredPoints) return false;
            this.professionSkillPoints -= requiredPoints;
        }
        
        // 升级技能
        skillMap.set(skillId, currentLevel + 1);
        
        return true;
    }

    /**
     * 获取技能等级
     * @param {string} skillId - 技能ID
     * @returns {number} 技能等级
     */
    getSkillLevel(skillId) {
        if (this.basicSkills.has(skillId)) {
            return this.basicSkills.get(skillId);
        }
        if (this.professionSkills.has(skillId)) {
            return this.professionSkills.get(skillId);
        }
        return 0;
    }

    /**
     * 获取攻击伤害
     */
    getAttackDamage() {
        const baseDamage = GameConfig.getInstance().getPlayerCombatBase().attackDamage;
        
        // 根据职业调整伤害
        const damageBonus = this.professionConfig.damageBonus || 0;
        
        return baseDamage + damageBonus;
    }

    /**
     * 获取攻击范围
     */
    getAttackRange() {
        const baseRange = GameConfig.getInstance().getPlayerCombatBase().attackRange;
        
        // 根据职业调整范围
        const rangeBonus = this.professionConfig.rangeBonus || 0;
        
        return baseRange + rangeBonus;
    }

    /**
     * 获取攻击冷却时间
     */
    getAttackCooldown() {
        const baseCooldown = GameConfig.getInstance().getPlayerCombatBase().attackCooldown;
        
        // 根据职业调整冷却
        const cooldownReduction = this.professionConfig.cooldownReduction || 0;
        
        return Math.max(0.1, baseCooldown - cooldownReduction);
    }

    /**
     * 计算实际受到的伤害
     * @param {number} incomingDamage - 受到的伤害
     */
    calculateDamageTaken(incomingDamage) {
        const defenseBonus = this.professionConfig.defenseBonus || 0;
        const damageReduction = defenseBonus / (defenseBonus + 100);
        
        return Math.max(1, Math.floor(incomingDamage * (1 - damageReduction)));
    }

    /**
     * 获取职业技能列表
     */
    getProfessionSkills() {
        return this.professionSkills;
    }

    /**
     * 获取基础技能列表
     */
    getBasicSkills() {
        return this.basicSkills;
    }

    /**
     * 序列化职业系统（用于存档）
     * 注：basicSkillPoints / professionSkillPoints 是访问器，输出的是 PlayerData 里的值
     * （保留在结构里仅为兼容旧存档格式与外部读取）。
     * @returns {Object} 序列化数据
     */
    serialize() {
        return {
            currentProfessionId: this.currentProfessionId,
            basicSkills: Array.from(this.basicSkills.entries()),
            professionSkills: Array.from(this.professionSkills.entries()),
            currentSchool: this.currentSchool,
            basicSkillPoints: this.basicSkillPoints,
            professionSkillPoints: this.professionSkillPoints,
        };
    }

    /**
     * 反序列化职业系统（用于读档）
     * 注：技能点的唯一存储在 PlayerData（Player.deserialize 已先还原 playerData）。
     * 这里只在「没有 playerData」时用存档里的旧值兜底，绝不覆盖唯一数据源。
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        this.currentProfessionId = data.currentProfessionId || this.currentProfessionId;
        this.professionConfig = GameConfig.getInstance().getProfession(this.currentProfessionId);
        this.basicSkills = new Map(data.basicSkills || []);
        this.professionSkills = new Map(data.professionSkills || []);
        this.currentSchool = data.currentSchool || null;
        if (!this.playerData) {
            this._basicSkillPoints = data.basicSkillPoints || 0;
            this._professionSkillPoints = data.professionSkillPoints || 0;
        }
    }
}