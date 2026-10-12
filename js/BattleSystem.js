/**
 * 战斗系统类
 * 支持多种战斗模式：
 * 1. 即时战斗模式（ACTIVE）- 玩家直接操控角色移动、攻击
 * 2. 回合制战斗模式（TURN_BASED）- 类似宝可梦的点击式战斗
 * 3. 自动战斗模式（AUTO）- 自动结算
 * 
 * 全局变量记录当前采用的战斗系统类型
 */
class BattleSystem {
    /**
     * @param {Object} config - 战斗系统配置
     */
    constructor(config = {}) {
        // ========== 全局战斗类型 ==========
        this.battleType = config.battleType || BattleSystem.BattleType.ACTIVE;
        
        // ========== 战斗状态 ==========
        this.isInBattle = false;
        this.battleState = 'idle'; // idle, start, running, paused, ended
        
        // ========== 战斗参与者 ==========
        this.player = null;        // 玩家实例
        this.enemies = [];         // 敌人列表
        this.allies = [];          // 友方列表
        
        // ========== 战斗计时 ==========
        // 数值唯一来源：GameConfig.combat.turnBased（改一处即全局生效）
        const timing = GameConfig.getInstance().getBattleTiming();
        this.battleTimer = 0;
        this.turnTimer = 0;
        this.turnAdvanceTimer = 0;   // 敌人行动后延迟推进的倒计时（秒，由主循环 update 按 deltaTime 驱动）
        this.turnDuration = config.turnDuration || timing.turnDuration;      // 回合时间限制（秒）
        this.enemyTurnDelay = config.enemyTurnDelay || timing.enemyTurnDelay; // 敌人行动后停顿（秒）
        
        // ========== 回合制相关 ==========
        this.currentTurn = 'player'; // 'player' 或 'enemy'
        this.turnOrder = [];       // 行动顺序
        this.currentActionIndex = 0;
        
        // ========== 伤害计算 ==========
        this.damageMultiplier = 1.0;
        this.criticalChance = 0.1;   // 暴击率
        this.criticalMultiplier = 1.5; // 暴击倍率
        
        // ========== 回调 ==========
        this.onBattleStart = null;
        this.onBattleEnd = null;
        this.onTurnChange = null;
        this.onEnemyDefeated = null;
        this.onPlayerDefeated = null;
        this.onDamageDealt = null;
        this.onHealingDone = null;
        
        // ========== 战斗日志 ==========
        this.battleLog = [];
        this.maxLogEntries = 50;
        
        // ========== 初始化 ==========
        this.initBattleTypeHandlers();
    }

    /**
     * 初始化战斗类型处理器
     */
    initBattleTypeHandlers() {
        this.battleTypeHandlers = {
            [BattleSystem.BattleType.ACTIVE]: {
                update: this.updateActiveBattle.bind(this),
                start: this.startActiveBattle.bind(this),
                end: this.endActiveBattle.bind(this),
            },
            [BattleSystem.BattleType.TURN_BASED]: {
                update: this.updateTurnBasedBattle.bind(this),
                start: this.startTurnBasedBattle.bind(this),
                end: this.endTurnBasedBattle.bind(this),
            },
            [BattleSystem.BattleType.AUTO]: {
                update: this.updateAutoBattle.bind(this),
                start: this.startAutoBattle.bind(this),
                end: this.endAutoBattle.bind(this),
            },
        };
    }

    // ==================== 战斗类型枚举 ====================

    /**
     * 获取战斗类型
     */
    static get BattleType() {
        return {
            ACTIVE: 'active',           // 即时战斗
            TURN_BASED: 'turn_based',   // 回合制战斗
            AUTO: 'auto',               // 自动战斗
        };
    }

    // ==================== 战斗管理 ====================

    /**
     * 开始战斗
     * @param {Object} config - 战斗配置
     * @param {Player} config.player - 玩家实例
     * @param {Array} config.enemies - 敌人列表
     * @param {Array} config.allies - 友方列表（可选）
     * @param {string} config.battleType - 战斗类型（可选，覆盖默认）
     */
    startBattle(config = {}) {
        if (this.isInBattle) {
            console.warn('已经在战斗中');
            return false;
        }
        
        this.player = config.player || this.player;
        this.enemies = config.enemies || [];
        this.allies = config.allies || [];
        
        if (config.battleType) {
            this.battleType = config.battleType;
        }
        
        if (!this.player) {
            console.error('战斗系统需要玩家实例');
            return false;
        }
        
        if (this.enemies.length === 0) {
            console.error('战斗系统需要至少一个敌人');
            return false;
        }
        
        // 设置战斗状态
        this.isInBattle = true;
        this.battleState = 'start';
        this.battleTimer = 0;
        this.turnAdvanceTimer = 0;
        this.battleLog = [];
        
        // 设置玩家战斗状态
        this.player.isInBattle = true;
        
        // 设置敌人战斗状态
        this.enemies.forEach(enemy => {
            enemy.isInBattle = true;
            if (enemy.setTarget) {
                enemy.setTarget(this.player);
            }
        });
        
        // 根据战斗类型执行开始逻辑
        const handler = this.battleTypeHandlers[this.battleType];
        if (handler && handler.start) {
            handler.start();
        }
        
        // 添加日志
        this.addLog('战斗开始！');
        this.enemies.forEach(enemy => {
            this.addLog(`${enemy.name || enemy.monsterId} 出现了！`);
        });
        
        // 触发回调
        if (this.onBattleStart) {
            this.onBattleStart({
                player: this.player,
                enemies: this.enemies,
                allies: this.allies,
                battleType: this.battleType,
            });
        }
        
        return true;
    }

    /**
     * 结束战斗
     * @param {string} result - 结果：'victory' 或 'defeat'
     */
    endBattle(result) {
        if (!this.isInBattle) return;
        
        this.battleState = 'ended';
        
        // 执行结束逻辑
        const handler = this.battleTypeHandlers[this.battleType];
        if (handler && handler.end) {
            handler.end(result);
        }
        
        // 恢复玩家状态
        if (this.player) {
            this.player.isInBattle = false;
        }
        
        // 恢复敌人状态
        this.enemies.forEach(enemy => {
            enemy.isInBattle = false;
        });
        
        // 添加日志
        this.addLog(result === 'victory' ? '战斗胜利！' : '战斗失败...');
        
        // 触发回调
        if (this.onBattleEnd) {
            this.onBattleEnd({
                result: result,
                player: this.player,
                enemies: this.enemies,
                battleLog: this.battleLog,
            });
        }
        
        // 清空战斗状态
        this.isInBattle = false;
        this.battleState = 'idle';
        this.turnAdvanceTimer = 0;
        this.enemies = [];
        this.allies = [];
    }

    /**
     * 更新战斗
     * @param {number} deltaTime - 时间增量（秒）
     */
    update(deltaTime) {
        if (!this.isInBattle) return;
        
        this.battleTimer += deltaTime;
        
        const handler = this.battleTypeHandlers[this.battleType];
        if (handler && handler.update) {
            handler.update(deltaTime);
        }
        
        // 检查战斗结束条件
        this.checkBattleEndConditions();
    }

    /**
     * 检查战斗结束条件
     */
    checkBattleEndConditions() {
        if (this.battleState === 'ended') return;
        
        // 检查玩家是否死亡
        if (this.player && !this.player.isAlive) {
            this.endBattle('defeat');
            
            if (this.onPlayerDefeated) {
                this.onPlayerDefeated(this.player);
            }
            return;
        }
        
        // 检查是否所有敌人被击败
        const allEnemiesDefeated = this.enemies.every(enemy => !enemy.isAlive);
        
        if (allEnemiesDefeated && this.enemies.length > 0) {
            this.endBattle('victory');
            return;
        }
    }

    // ==================== 即时战斗模式（ACTIVE） ====================

    /**
     * 开始即时战斗
     */
    startActiveBattle() {
        this.battleState = 'running';
        this.addLog('进入即时战斗模式');
    }

    /**
     * 更新即时战斗
     */
    updateActiveBattle(deltaTime) {
        if (this.battleState !== 'running') return;
        
        // 即时战斗中，实体更新由GameLoop统一处理
        // 战斗系统只负责伤害判定和状态管理
        
        // 检查玩家攻击
        this.checkPlayerAttacks();
        
        // 检查敌人攻击
        this.checkEnemyAttacks();
    }

    /**
     * 检查玩家攻击
     */
    checkPlayerAttacks() {
        if (!this.player || !this.player.isAttacking) return;
        
        const attackRect = this.player.getAttackRect(this.player.professionSystem.getAttackRange());
        
        this.enemies.forEach(enemy => {
            if (!enemy.isAlive) return;
            
            const enemyRect = {
                x: enemy.position.x - enemy.width / 2,
                y: enemy.position.y - enemy.height / 2,
                width: enemy.width,
                height: enemy.height,
            };
            
            if (CollisionDetector.aabb(attackRect, enemyRect)) {
                const damage = this.calculatePlayerDamage(this.player, enemy);
                this.dealDamageToEnemy(enemy, damage, this.player);
            }
        });
    }

    /**
     * 检查敌人攻击
     */
    checkEnemyAttacks() {
        this.enemies.forEach(enemy => {
            if (!enemy.isAlive || !this.player || !this.player.isAlive) return;
            
            // 检查敌人是否在攻击状态（Boss类有攻击状态）
            if (enemy.currentState === 'attack') {
                const distance = enemy.getDistanceTo(this.player.position);
                if (distance <= enemy.attackRange) {
                    const damage = this.calculateEnemyDamage(enemy, this.player);
                    this.dealDamageToPlayer(damage, enemy);
                }
            }
        });
    }

    /**
     * 结束即时战斗
     */
    endActiveBattle(result) {
        // 即时战斗结束时的清理工作
    }

    // ==================== 回合制战斗模式（TURN_BASED） ====================

    /**
     * 开始回合制战斗
     */
    startTurnBasedBattle() {
        this.battleState = 'running';
        this.currentTurn = 'player';
        this.turnTimer = this.turnDuration;
        this.turnAdvanceTimer = 0;
        
        // 初始化行动顺序
        this.initTurnOrder();
        
        this.addLog('进入回合制战斗模式');
        this.addLog('玩家回合');
    }

    /**
     * 初始化行动顺序
     */
    initTurnOrder() {
        this.turnOrder = [];
        
        // 添加玩家
        if (this.player) {
            this.turnOrder.push({
                type: 'player',
                entity: this.player,
                speed: this.player.moveSpeed,
            });
        }
        
        // 添加友方
        this.allies.forEach(ally => {
            this.turnOrder.push({
                type: 'ally',
                entity: ally,
                speed: ally.moveSpeed || 100,
            });
        });
        
        // 添加敌人
        this.enemies.forEach(enemy => {
            this.turnOrder.push({
                type: 'enemy',
                entity: enemy,
                speed: enemy.moveSpeed || 80,
            });
        });
        
        // 按速度排序
        this.turnOrder.sort((a, b) => b.speed - a.speed);
        this.currentActionIndex = 0;
    }

    /**
     * 更新回合制战斗
     */
    updateTurnBasedBattle(deltaTime) {
        if (this.battleState !== 'running') return;

        // 敌人行动后的延迟推进（替代原 setTimeout）：倒计时随主循环 deltaTime 走，
        // 游戏暂停 / 低帧时节奏都不会漂移。待推进期间不计入回合计时。
        if (this.turnAdvanceTimer > 0) {
            this.turnAdvanceTimer -= deltaTime;
            if (this.turnAdvanceTimer <= 0) {
                this.turnAdvanceTimer = 0;
                this.advanceTurn();
            }
            return;
        }

        // 更新回合计时
        this.turnTimer -= deltaTime;
        
        if (this.turnTimer <= 0) {
            // 超时，自动结束当前回合
            this.advanceTurn();
        }
    }

    /**
     * 执行玩家行动
     * @param {string} action - 行动类型：'attack', 'skill', 'item', 'defend', 'flee'
     * @param {Object} params - 行动参数
     */
    executePlayerAction(action, params = {}) {
        if (!this.isInBattle || this.currentTurn !== 'player') {
            return false;
        }
        
        switch (action) {
            case 'attack':
                this.performPlayerTurnAttack(params.targetIndex || 0);
                break;
            case 'skill':
                this.performPlayerTurnSkill(params.skillId, params.targetIndex || 0);
                break;
            case 'item':
                this.performPlayerTurnItem(params.itemId);
                break;
            case 'defend':
                this.performPlayerTurnDefend();
                break;
            case 'flee':
                this.performPlayerTurnFlee();
                break;
            default:
                return false;
        }
        
        // 推进到下一个回合
        this.advanceTurn();
        
        return true;
    }

    /**
     * 执行玩家回合攻击
     */
    performPlayerTurnAttack(targetIndex) {
        const target = this.enemies[targetIndex];
        if (!target || !target.isAlive) return;
        
        const damage = this.calculatePlayerDamage(this.player, target);
        this.dealDamageToEnemy(target, damage, this.player);
    }

    /**
     * 执行玩家回合技能
     */
    performPlayerTurnSkill(skillId, targetIndex) {
        const target = this.enemies[targetIndex];
        if (!target || !target.isAlive) return;
        
        const gameConfig = GameConfig.getInstance();
        const skillConfig = gameConfig.getSkill(skillId);
        
        if (!skillConfig) return;
        
        const skillLevel = this.player.professionSystem.getSkillLevel(skillId);
        const baseDamage = skillConfig.damage || 10;
        const damageMultiplier = 1 + (skillLevel - 1) * 0.1;
        const damage = Math.floor(baseDamage * damageMultiplier);
        
        this.dealDamageToEnemy(target, damage, this.player, skillConfig.name);
    }

    /**
     * 执行玩家回合使用物品
     */
    performPlayerTurnItem(itemId) {
        if (!this.player) return;
        
        this.player.useItem(itemId);
    }

    /**
     * 执行玩家回合防御
     */
    performPlayerTurnDefend() {
        // 防御状态：减少下次受到的伤害
        this.player.isDefending = true;
        this.addLog(`${this.player.name || '玩家'} 进入防御状态`);
    }

    /**
     * 执行玩家回合逃跑
     */
    performPlayerTurnFlee() {
        const fleeChance = 0.5; // 50%逃跑成功率
        
        if (Math.random() < fleeChance) {
            this.addLog('逃跑成功！');
            this.endBattle('defeat');
        } else {
            this.addLog('逃跑失败！');
        }
    }

    /**
     * 推进回合
     */
    advanceTurn() {
        // 重置回合计时
        this.turnTimer = this.turnDuration;
        // 清掉可能残留的待推进倒计时（玩家行动 / 超时推进时都要清）
        this.turnAdvanceTimer = 0;
        
        // 切换到下一个行动者
        this.currentActionIndex++;
        
        if (this.currentActionIndex >= this.turnOrder.length) {
            this.currentActionIndex = 0;
        }
        
        const currentAction = this.turnOrder[this.currentActionIndex];
        
        if (currentAction.type === 'player') {
            this.currentTurn = 'player';
            this.addLog('玩家回合');
            
            if (this.onTurnChange) {
                this.onTurnChange('player');
            }
        } else {
            this.currentTurn = 'enemy';
            this.addLog('敌人回合');
            
            if (this.onTurnChange) {
                this.onTurnChange('enemy');
            }
            
            // 自动执行敌人行动
            this.executeEnemyTurn(currentAction);
            
            // 敌人行动后延迟推进到下一回合：交给主循环 update(deltaTime) 计时，
            // 不再用 setTimeout —— 定时器与游戏暂停 / 帧率脱钩的问题已修复。
            this.turnAdvanceTimer = this.enemyTurnDelay;
        }
    }

    /**
     * 执行敌人回合
     */
    executeEnemyTurn(enemyAction) {
        if (!enemyAction || !enemyAction.entity || !enemyAction.entity.isAlive) return;
        
        const enemy = enemyAction.entity;
        
        // 随机选择行动
        const actionRoll = Math.random();
        
        if (actionRoll < 0.7) {
            // 普通攻击
            const damage = this.calculateEnemyDamage(enemy, this.player);
            this.dealDamageToPlayer(damage, enemy);
        } else if (actionRoll < 0.9 && enemy.castSkill) {
            // 使用技能
            if (enemy.skills && enemy.skills.length > 0) {
                const skillName = enemy.skills[Math.floor(Math.random() * enemy.skills.length)];
                enemy.castSkill(skillName);
                const skillDamage = Math.floor(enemy.damage * 1.5);
                this.dealDamageToPlayer(skillDamage, enemy, skillName);
            }
        } else {
            // 防御
            enemy.isDefending = true;
            this.addLog(`${enemy.name || enemy.monsterId} 进入防御状态`);
        }
    }

    /**
     * 结束回合制战斗
     */
    endTurnBasedBattle(result) {
        // 回合制战斗结束时的清理工作
        this.turnOrder = [];
        this.currentActionIndex = 0;
    }

    // ==================== 自动战斗模式（AUTO） ====================

    /**
     * 开始自动战斗
     */
    startAutoBattle() {
        this.battleState = 'running';
        this.addLog('进入自动战斗模式');
    }

    /**
     * 更新自动战斗
     */
    updateAutoBattle(deltaTime) {
        if (this.battleState !== 'running') return;
        
        // 自动战斗：简单循环攻击
        if (this.player && this.player.isAlive) {
            // 找到第一个存活的敌人
            const target = this.enemies.find(enemy => enemy.isAlive);
            
            if (target) {
                const damage = this.calculatePlayerDamage(this.player, target);
                this.dealDamageToEnemy(target, damage, this.player);
            }
        }
        
        // 敌人反击
        this.enemies.forEach(enemy => {
            if (enemy.isAlive && this.player && this.player.isAlive) {
                const damage = this.calculateEnemyDamage(enemy, this.player);
                this.dealDamageToPlayer(damage, enemy);
            }
        });
    }

    /**
     * 结束自动战斗
     */
    endAutoBattle(result) {
        // 自动战斗结束时的清理工作
    }

    // ==================== 伤害计算 ====================

    /**
     * 计算玩家对敌人造成的伤害
     * @param {Player} player - 玩家实例
     * @param {Object} enemy - 敌人实例
     * @returns {number} 伤害值
     */
    calculatePlayerDamage(player, enemy) {
        if (!player || !enemy) return 0;
        
        // 基础伤害
        const baseDamage = player.professionSystem.getAttackDamage();
        
        // 暴击判定
        const isCritical = Math.random() < this.criticalChance;
        
        // 最终伤害
        let damage = baseDamage;
        if (isCritical) {
            damage = Math.floor(damage * this.criticalMultiplier);
            this.addLog('暴击！');
        }
        
        // 应用伤害倍率
        damage = Math.floor(damage * this.damageMultiplier);
        
        // 确保最小伤害
        damage = Math.max(1, damage);
        
        return damage;
    }

    /**
     * 计算敌人对玩家造成的伤害
     * @param {Object} enemy - 敌人实例
     * @param {Player} player - 玩家实例
     * @returns {number} 伤害值
     */
    calculateEnemyDamage(enemy, player) {
        if (!enemy || !player) return 0;
        
        // 基础伤害
        const baseDamage = enemy.damage || 10;
        
        // 检查玩家是否在防御
        let damageMultiplier = this.damageMultiplier;
        if (player.isDefending) {
            damageMultiplier *= 0.5; // 防御减伤50%
            player.isDefending = false;
            this.addLog('防御减少了伤害');
        }
        
        // 最终伤害
        let damage = Math.floor(baseDamage * damageMultiplier);
        
        // 确保最小伤害
        damage = Math.max(1, damage);
        
        return damage;
    }

    // ==================== 伤害处理 ====================

    /**
     * 对敌人造成伤害
     * @param {Object} enemy - 敌人实例
     * @param {number} damage - 伤害值
     * @param {Object} source - 伤害来源
     * @param {string} skillName - 技能名称（可选）
     */
    dealDamageToEnemy(enemy, damage, source, skillName = null) {
        if (!enemy || !enemy.isAlive) return;
        
        const actualDamage = enemy.takeDamage(damage);
        
        if (actualDamage > 0 || actualDamage === true) {
            const finalDamage = typeof actualDamage === 'number' ? actualDamage : damage;
            
            this.addLog(
                `${source.name || '玩家'}${skillName ? `使用${skillName}` : ''}对${enemy.name || enemy.monsterId}造成${finalDamage}点伤害`
            );
            
            if (this.onDamageDealt) {
                this.onDamageDealt({
                    target: enemy,
                    damage: finalDamage,
                    source: source,
                    skillName: skillName,
                });
            }
            
            // 检查敌人是否被击败
            if (!enemy.isAlive) {
                this.handleEnemyDefeated(enemy, source);
            }
        }
    }

    /**
     * 对玩家造成伤害
     * @param {number} damage - 伤害值
     * @param {Object} source - 伤害来源
     * @param {string} skillName - 技能名称（可选）
     */
    dealDamageToPlayer(damage, source, skillName = null) {
        if (!this.player || !this.player.isAlive) return;
        
        const actualDamage = this.player.takeDamage(damage);
        
        if (actualDamage) {
            this.addLog(
                `${source.name || source.monsterId || '敌人'}${skillName ? `使用${skillName}` : ''}对玩家造成${damage}点伤害`
            );
            
            if (this.onDamageDealt) {
                this.onDamageDealt({
                    target: this.player,
                    damage: damage,
                    source: source,
                    skillName: skillName,
                });
            }
            
            if (!this.player.isAlive) {
                this.handlePlayerDefeated();
            }
        }
    }

    /**
     * 处理敌人被击败
     */
    handleEnemyDefeated(enemy, source) {
        this.addLog(`${enemy.name || enemy.monsterId} 被击败了！`);
        
        // 给予奖励
        if (this.player && enemy.getRewards) {
            const rewards = enemy.getRewards();
            
            if (rewards.exp) {
                this.player.gainExperience(rewards.exp);
                this.addLog(`获得${rewards.exp}点经验`);
            }
            
            if (rewards.lingShi) {
                this.player.playerData.gainLingShi(rewards.lingShi);
                this.addLog(`获得${rewards.lingShi}灵石`);
            }
            
            if (rewards.drops && rewards.drops.length > 0) {
                rewards.drops.forEach(drop => {
                    if (Math.random() < drop.chance) {
                        this.player.inventory.addItem(drop.itemId, drop.count);
                        const gameConfig = GameConfig.getInstance();
                        const itemConfig = gameConfig.getItem(drop.itemId);
                        this.addLog(`获得${itemConfig ? itemConfig.name : drop.itemId} x${drop.count}`);
                    }
                });
            }
        }
        
        if (this.onEnemyDefeated) {
            this.onEnemyDefeated({
                enemy: enemy,
                source: source,
            });
        }
    }

    /**
     * 处理玩家被击败
     */
    handlePlayerDefeated() {
        this.addLog('玩家被击败了...');
        
        if (this.onPlayerDefeated) {
            this.onPlayerDefeated(this.player);
        }
    }

    // ==================== 治疗处理 ====================

    /**
     * 治疗玩家
     * @param {number} amount - 治疗量
     * @param {Object} source - 治疗来源
     */
    healPlayer(amount, source = null) {
        if (!this.player || !this.player.isAlive) return;
        
        const healAmount = this.player.heal(amount);
        
        if (healAmount > 0) {
            this.addLog(`${source ? source.name + '治疗' : '玩家恢复'}了${healAmount}点生命`);
            
            if (this.onHealingDone) {
                this.onHealingDone({
                    target: this.player,
                    amount: healAmount,
                    source: source,
                });
            }
        }
    }

    // ==================== 日志管理 ====================

    /**
     * 添加战斗日志
     * @param {string} message - 日志消息
     */
    addLog(message) {
        this.battleLog.push({
            time: this.battleTimer,
            message: message,
        });
        
        // 限制日志长度
        if (this.battleLog.length > this.maxLogEntries) {
            this.battleLog.shift();
        }
    }

    /**
     * 获取战斗日志
     * @returns {Array} 战斗日志
     */
    getBattleLog() {
        return this.battleLog;
    }

    /**
     * 清空战斗日志
     */
    clearBattleLog() {
        this.battleLog = [];
    }

    // ==================== 状态查询 ====================

    /**
     * 检查是否在战斗中
     */
    getIsInBattle() {
        return this.isInBattle;
    }

    /**
     * 获取当前战斗类型
     */
    getBattleType() {
        return this.battleType;
    }

    /**
     * 设置战斗类型
     * @param {string} battleType - 战斗类型
     */
    setBattleType(battleType) {
        this.battleType = battleType;
    }

    /**
     * 获取存活敌人数量
     */
    getAliveEnemyCount() {
        return this.enemies.filter(enemy => enemy.isAlive).length;
    }

    /**
     * 获取存活敌人列表
     */
    getAliveEnemies() {
        return this.enemies.filter(enemy => enemy.isAlive);
    }

    // ==================== 序列化 ====================

    /**
     * 序列化战斗系统状态（用于存档）
     */
    serialize() {
        return {
            battleType: this.battleType,
            isInBattle: this.isInBattle,
            battleState: this.battleState,
            battleTimer: this.battleTimer,
            turnTimer: this.turnTimer,
            currentTurn: this.currentTurn,
            battleLog: [...this.battleLog],
        };
    }

    /**
     * 反序列化战斗系统状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.battleType = data.battleType || this.battleType;
        this.isInBattle = data.isInBattle || false;
        this.battleState = data.battleState || 'idle';
        this.battleTimer = data.battleTimer || 0;
        this.turnTimer = data.turnTimer || 0;
        this.turnAdvanceTimer = 0;   // 瞬时计时器不存档，读档后从零开始
        this.currentTurn = data.currentTurn || 'player';
        this.battleLog = data.battleLog || [];
    }
}