/**
 * 玩家数据类
 * 记录玩家境界、血量、灵息、经验等属性数据
 */
class PlayerData {
    /**
     * @param {Object} config - 初始配置
     */
    constructor(config = {}) {
        const gameConfig = GameConfig.getInstance();
        const defaultRealm = gameConfig.getRealm('lianqi');
        
        this.realm = config.realm || 'lianqi';           // 当前境界
        this.stage = config.stage || '初期';              // 当前小阶段
        this.experience = config.experience || 0;        // 当前经验值
        this.health = config.health || defaultRealm.maxHealth;
        this.maxHealth = config.maxHealth || defaultRealm.maxHealth;
        this.mana = config.mana || defaultRealm.maxMana;
        this.maxMana = config.maxMana || defaultRealm.maxMana;
        this.lingShi = config.lingShi || 0;              // 灵石
        this.basicSkillPoints = config.basicSkillPoints || 0;   // 基础修习点
        this.professionSkillPoints = config.professionSkillPoints || 0; // 职业悟道点
        
        // 修炼相关
        this.cultivationProgress = config.cultivationProgress || 0; // 修炼进度
        this.totalExperienceGained = config.totalExperienceGained || 0; // 累计获得经验
        
        // 统计信息
        this.statistics = {
            totalKills: config.statistics?.totalKills || 0,        // 总击杀数
            totalDeaths: config.statistics?.totalDeaths || 0,      // 总死亡数
            totalQuestsCompleted: config.statistics?.totalQuestsCompleted || 0, // 总完成任务数
            totalItemsUsed: config.statistics?.totalItemsUsed || 0, // 总使用物品数
            playTime: config.statistics?.playTime || 0,             // 游戏时间（秒）
        };
    }

    /**
     * 获取当前境界配置
     */
    getRealmConfig() {
        const gameConfig = GameConfig.getInstance();
        return gameConfig.getRealm(this.realm);
    }

    /**
     * 获取经验值
     * @param {number} amount - 经验值
     */
    gainExperience(amount) {
        this.experience += amount;
        this.totalExperienceGained += amount;
        
        // 检查升级
        this.checkStageUp();
    }

    /**
     * 检查小阶段提升
     */
    checkStageUp() {
        const realmConfig = this.getRealmConfig();
        if (!realmConfig || realmConfig.maxExp <= 0) return;
        
        while (this.experience >= realmConfig.maxExp) {
            this.experience -= realmConfig.maxExp;
            
            // 提升小阶段
            const stageIndex = realmConfig.stages.indexOf(this.stage);
            if (stageIndex < realmConfig.stages.length - 1) {
                this.stage = realmConfig.stages[stageIndex + 1];
            } else {
                // 已到圆满，经验暂存
                break;
            }
        }
    }

    /**
     * 使用灵石
     * @param {number} amount - 灵石数量
     * @returns {boolean} 是否使用成功
     */
    spendLingShi(amount) {
        if (this.lingShi < amount) {
            return false;
        }
        this.lingShi -= amount;
        return true;
    }

    /**
     * 获得灵石
     * @param {number} amount - 灵石数量
     */
    gainLingShi(amount) {
        this.lingShi += amount;
    }

    /**
     * 更新时间统计
     * @param {number} deltaTime - 时间增量（秒）
     */
    updatePlayTime(deltaTime) {
        this.statistics.playTime += deltaTime;
    }

    /**
     * 序列化玩家数据（用于存档）
     * @returns {Object} 序列化数据
     */
    serialize() {
        return JSON.parse(JSON.stringify({
            realm: this.realm,
            stage: this.stage,
            experience: this.experience,
            health: this.health,
            maxHealth: this.maxHealth,
            mana: this.mana,
            maxMana: this.maxMana,
            lingShi: this.lingShi,
            basicSkillPoints: this.basicSkillPoints,
            professionSkillPoints: this.professionSkillPoints,
            cultivationProgress: this.cultivationProgress,
            totalExperienceGained: this.totalExperienceGained,
            statistics: this.statistics,
        }));
    }

    /**
     * 反序列化玩家数据（用于读档）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        this.realm = data.realm || this.realm;
        this.stage = data.stage || this.stage;
        this.experience = data.experience || 0;
        this.health = data.health || this.health;
        this.maxHealth = data.maxHealth || this.maxHealth;
        this.mana = data.mana || this.mana;
        this.maxMana = data.maxMana || this.maxMana;
        this.lingShi = data.lingShi || 0;
        this.basicSkillPoints = data.basicSkillPoints || 0;
        this.professionSkillPoints = data.professionSkillPoints || 0;
        this.cultivationProgress = data.cultivationProgress || 0;
        this.totalExperienceGained = data.totalExperienceGained || 0;
        this.statistics = data.statistics || this.statistics;
    }
}