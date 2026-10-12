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

        // ★ 玩家状态机（唯一事实源）：存亡 / 战斗按键解锁 / 技能解锁·习得·冷却·互斥。
        //   本对象的 isAlive() 与技能相关方法全部委托给它，禁止在别处再存一份布尔。
        this.stateMachine = new PlayerStateMachine();

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

        // ========== Boss 战败成长（每个战场各自计数，最多 5 次）==========
        // bossFailures        ：{ 战场 id: 已战败次数 } —— 上限判定用
        // maxHealthBonus      ：累计的永久气血上限加成（境界基准值之外的部分）
        // maxManaBonus        ：累计的永久灵息上限加成
        // 三者都随存档保存（见 serialize / deserialize）；境界切换时由
        // Main.applyPermanentStatBonus 叠加在 GameConfig.realms 的基准值之上。
        this.bossFailures = Object.assign({}, config.bossFailures || {});
        this.maxHealthBonus = config.maxHealthBonus || 0;
        this.maxManaBonus = config.maxManaBonus || 0;
        
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

        // 存亡状态与气血保持一致（构造后同步一次）
        this._syncAlive();
    }

    /**
     * 把「气血 > 0」同步进玩家状态机（存亡的唯一权威）。
     * 所有改动气血的路径（setHealth / refill / applyRealmStats / 读档）都必须调用它。
     * @private
     */
    _syncAlive() {
        if (this.stateMachine) this.stateMachine.setAlive(this.health > 0);
    }

    /**
     * 玩家状态机（存亡 / 技能解锁·习得·冷却·互斥 的唯一入口）
     * @returns {PlayerStateMachine}
     */
    getStateMachine() { return this.stateMachine; }

    /**
     * 获取当前境界配置
     */
    getRealmConfig() {
        const gameConfig = GameConfig.getInstance();
        return gameConfig.getRealm(this.realm);
    }

    // ==================== 属性读写方法（全项目统一入口）====================
    // 约定：气血 / 灵息的「当前值」只存在于本对象，任何模块读数值都走这些方法，
    //       写数值也走这些方法（内部统一做上下限裁剪），禁止外部直接改 this.health 等字段。

    /** 当前气血 */
    getHealth() { return this.health; }

    /** 气血上限（境界基准值 + 永久加成） */
    getMaxHealth() { return this.maxHealth; }

    /** 当前灵息 */
    getMana() { return this.mana; }

    /** 灵息上限 */
    getMaxMana() { return this.maxMana; }

    /** 气血比例（0~1，上限为 0 时返回 0） */
    getHealthRatio() { return this.maxHealth > 0 ? Math.max(0, Math.min(1, this.health / this.maxHealth)) : 0; }

    /** 灵息比例（0~1） */
    getManaRatio() { return this.maxMana > 0 ? Math.max(0, Math.min(1, this.mana / this.maxMana)) : 0; }

    /** 是否存活（唯一权威 = 玩家状态机；由气血写入路径同步） */
    isAlive() { return this.stateMachine.isAlive(); }

    /** 设置当前气血（自动裁剪到 [0, maxHealth]），并同步存亡状态 */
    setHealth(value) { this.health = Math.max(0, Math.min(this.maxHealth, value)); this._syncAlive(); return this.health; }

    /** 设置当前灵息（自动裁剪到 [0, maxMana]） */
    setMana(value) { this.mana = Math.max(0, Math.min(this.maxMana, value)); return this.mana; }

    /** 增减气血（正数治疗、负数受伤），返回实际变化量 */
    changeHealth(delta) { const before = this.health; this.setHealth(this.health + delta); return this.health - before; }

    /** 增减灵息，返回实际变化量 */
    changeMana(delta) { const before = this.mana; this.setMana(this.mana + delta); return this.mana - before; }

    /** 提升气血上限（可同时补足当前值），返回新的上限 */
    addMaxHealth(amount, refill = false) {
        this.maxHealth = Math.max(1, this.maxHealth + amount);
        if (refill) this.health = this.maxHealth; else this.setHealth(this.health);
        this._syncAlive();
        return this.maxHealth;
    }

    /** 提升灵息上限（可同时补足当前值），返回新的上限 */
    addMaxMana(amount, refill = false) {
        this.maxMana = Math.max(0, this.maxMana + amount);
        if (refill) this.mana = this.maxMana; else this.setMana(this.mana);
        return this.maxMana;
    }

    /** 回满气血 / 灵息（并同步存亡状态） */
    refill() { this.health = this.maxHealth; this.mana = this.maxMana; this._syncAlive(); }

    /**
     * 按境界配置写入上限与阶段，并叠加「Boss 战败成长」永久加成后回满。
     * 境界突破 / 章末调息 / 读档统一走这里，避免各处再手写 maxHealth = realmConfig.maxHealth。
     * @param {Object|string} realmOrId 境界配置对象或境界 ID
     * @param {boolean} [keepStage] true = 保留当前小阶段，false = 重置为该境界第一阶段
     * @returns {boolean} 是否成功应用
     */
    applyRealmStats(realmOrId, keepStage) {
        const gameConfig = GameConfig.getInstance();
        const realmConfig = typeof realmOrId === 'string' ? gameConfig.getRealm(realmOrId) : realmOrId;
        if (!realmConfig) return false;

        this.realm = realmConfig.id || this.realm;
        if (!keepStage) this.stage = realmConfig.stages ? realmConfig.stages[0] : this.stage;
        // 上限 = 境界基准值 + 永久加成（bonus 为 0 时等于基准值）
        this.maxHealth = realmConfig.maxHealth + (this.maxHealthBonus || 0);
        this.maxMana = realmConfig.maxMana + (this.maxManaBonus || 0);
        this.refill();   // 内部会同步存亡状态
        return true;
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
     * 修正（重构）：旧实现在「已到圆满」时仍然先扣一个 maxExp 再 break，导致溢出的经验被白白吞掉。
     * 现在只有「确实推进了一个小阶段」才扣经验；已到圆满则原样保留（暂存）。
     */
    checkStageUp() {
        const realmConfig = this.getRealmConfig();
        if (!realmConfig || realmConfig.maxExp <= 0) return;
        
        while (this.experience >= realmConfig.maxExp) {
            const stageIndex = realmConfig.stages.indexOf(this.stage);
            // 已到圆满：不再消耗经验，直接停止（溢出经验暂存）
            if (stageIndex < 0 || stageIndex >= realmConfig.stages.length - 1) break;
            this.experience -= realmConfig.maxExp;
            this.stage = realmConfig.stages[stageIndex + 1];
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
            bossFailures: this.bossFailures,
            maxHealthBonus: this.maxHealthBonus,
            maxManaBonus: this.maxManaBonus,
            cultivationProgress: this.cultivationProgress,
            totalExperienceGained: this.totalExperienceGained,
            statistics: this.statistics,
            // 玩家状态机（存亡 / 战斗解锁 / 技能解锁·习得）
            stateMachine: this.stateMachine.serialize(),
        }));
    }

    /**
     * 反序列化玩家数据（用于读档）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        // 修正（重构）：旧写法用 `data.x || 默认值`，会把合法的 0（如 health=0 的死亡态、
        // lingShi=0、experience=0）误判为「缺字段」而覆盖回默认值。改为仅在字段确实为
        // undefined / null 时才兜底。
        const pick = (v, fallback) => (v === undefined || v === null) ? fallback : v;

        this.realm = pick(data.realm, this.realm);
        this.stage = pick(data.stage, this.stage);
        this.experience = pick(data.experience, 0);
        this.health = pick(data.health, this.health);
        this.maxHealth = pick(data.maxHealth, this.maxHealth);
        this.mana = pick(data.mana, this.mana);
        this.maxMana = pick(data.maxMana, this.maxMana);
        this.lingShi = pick(data.lingShi, 0);
        this.basicSkillPoints = pick(data.basicSkillPoints, 0);
        this.professionSkillPoints = pick(data.professionSkillPoints, 0);
        // Boss 战败成长（旧存档无这些字段 → 0 次 / 无加成）
        this.bossFailures = Object.assign({}, data.bossFailures || {});
        this.maxHealthBonus = pick(data.maxHealthBonus, 0);
        this.maxManaBonus = pick(data.maxManaBonus, 0);
        this.cultivationProgress = pick(data.cultivationProgress, 0);
        this.totalExperienceGained = pick(data.totalExperienceGained, 0);
        // 统计信息逐字段兜底，避免旧存档缺子字段时整块被替换掉
        if (data.statistics) {
            const s = data.statistics;
            this.statistics = {
                totalKills: pick(s.totalKills, this.statistics.totalKills),
                totalDeaths: pick(s.totalDeaths, this.statistics.totalDeaths),
                totalQuestsCompleted: pick(s.totalQuestsCompleted, this.statistics.totalQuestsCompleted),
                totalItemsUsed: pick(s.totalItemsUsed, this.statistics.totalItemsUsed),
                playTime: pick(s.playTime, this.statistics.playTime),
            };
        }

        // 玩家状态机（旧存档无此字段 → 保持初始值）
        if (data.stateMachine) this.stateMachine.deserialize(data.stateMachine);
        // 存亡以「读档后的气血」为准（状态机只作权威载体，事实来源仍是 health）
        this._syncAlive();
    }
}