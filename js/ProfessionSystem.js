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
        
        // 技能配置
        this.basicSkills = new Map();      // 基础技能 {skillId: level}
        this.professionSkills = new Map(); // 职业技能 {skillId: level}
        this.activeSkillSlots = [];        // 主动技能槽位
        
        // 流派选择（结丹后开放）
        this.currentSchool = config.school || null; // 当前流派
        
        // 技能点
        this.basicSkillPoints = config.basicSkillPoints || 0;
        this.professionSkillPoints = config.professionSkillPoints || 0;
        
        // 默认配置
        this.defaultBasicSkills = ['lingxidan', 'hutishu'];
        this.maxBasicSkillSlots = 2;
        this.maxProfessionSkillSlots = 3;
        
        // 初始化默认技能
        this.initDefaultSkills();
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
                if (skillConfig && this.isSkillUnlocked(skillConfig.unlockStage)) {
                    this.professionSkills.set(skillId, 1);
                }
            });
        }
        
        // 切换流派
        this.currentSchool = null;
        
        return true;
    }

    /**
     * 检查技能是否已解锁
     * @param {string} unlockStage - 解锁境界
     * @returns {boolean} 是否解锁
     */
    isSkillUnlocked(unlockStage) {
        const realmOrder = ['lianqi', 'zhuji', 'jiedan', 'yuanying', 'huashen'];
        const currentRealmIndex = realmOrder.indexOf(this.getCurrentRealm());
        const unlockRealmIndex = realmOrder.indexOf(unlockStage);
        
        return currentRealmIndex >= unlockRealmIndex;
    }

    /**
     * 获取当前境界
     */
    getCurrentRealm() {
        // 这里需要从玩家数据获取，暂时返回默认
        return 'zhuji'; // 实际使用时应该从PlayerData获取
    }

    /**
     * 获取当前境界阶段
     */
    getCurrentRealmStage() {
        // 这里需要从玩家数据获取，暂时返回默认
        return '初期';
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
        const gameConfig = GameConfig.getInstance();
        const baseDamage = 10; // 基础普通攻击伤害
        
        // 根据职业调整伤害
        const damageBonus = this.professionConfig.damageBonus || 0;
        
        return baseDamage + damageBonus;
    }

    /**
     * 获取攻击范围
     */
    getAttackRange() {
        const baseRange = 50; // 基础攻击范围
        
        // 根据职业调整范围
        const rangeBonus = this.professionConfig.rangeBonus || 0;
        
        return baseRange + rangeBonus;
    }

    /**
     * 获取攻击冷却时间
     */
    getAttackCooldown() {
        const baseCooldown = 0.5; // 基础攻击冷却
        
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
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        this.currentProfessionId = data.currentProfessionId || this.currentProfessionId;
        this.professionConfig = GameConfig.getInstance().getProfession(this.currentProfessionId);
        this.basicSkills = new Map(data.basicSkills || []);
        this.professionSkills = new Map(data.professionSkills || []);
        this.currentSchool = data.currentSchool || null;
        this.basicSkillPoints = data.basicSkillPoints || 0;
        this.professionSkillPoints = data.professionSkillPoints || 0;
    }
}