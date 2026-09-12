/**
 * Boss类
 * 继承自Monster，增加状态机、移动、技能等
 * 有自己的状态（移动、攻击、休息等）及对应更新函数
 */
class Boss extends Monster {
    /**
     * @param {Object} config - Boss配置
     * @param {string} config.id - Boss唯一ID
     * @param {string} config.monsterId - Boss配置ID
     * @param {Object} config.position - 初始位置 {x, y}
     * @param {Object} config.animationManager - 动画管理器实例（可选）
     */
    constructor(config = {}) {
        super(config);
        
        // ========== Boss特有属性 ==========
        this.toughness = this.monsterConfig.toughness || 100;  // 韧性值
        this.maxToughness = this.toughness;
        this.isStaggered = false;       // 是否破势（韧性归零）
        this.staggerTimer = 0;          // 破势计时器
        this.staggerDuration = 3;       // 破势持续时间（秒）
        
        // ========== 移动相关 ==========
        this.moveSpeed = config.moveSpeed || 60; // Boss移动速度
        this.isMoving = false;
        this.moveTarget = null;
        this.aggroRange = 300;           // 仇恨范围
        this.attackRange = 80;           // 攻击范围
        
        // ========== 状态机 ==========
        this.currentState = 'idle';      // idle, chase, attack, rest, staggered, dead
        this.stateTimer = 0;
        this.attackCooldown = 2;         // 攻击冷却（秒）
        this.attackCooldownTimer = 0;
        this.restDuration = 3;           // 休息持续时间（秒）
        this.restTimer = 0;
        
        // ========== 技能系统 ==========
        this.skills = this.monsterConfig.skills || [];
        this.currentSkillIndex = 0;
        this.skillCooldown = 5;          // 技能冷却（秒）
        this.skillCooldownTimer = 0;
        
        // ========== 阶段系统 ==========
        this.phases = this.monsterConfig.phases || {};
        this.currentPhase = 'phase1';
        
        // ========== 目标相关 ==========
        this.target = null;              // 当前目标（通常是玩家）

        // ========== 战败演出 ==========
        // 战败动画播放完毕的标记（战场流程用它判断“可以结算胜利了”，见 Main.updateBossArenaBattle）
        this.defeatSequenceDone = false;
        
        // ========== 回调 ==========
        this.onPhaseChange = null;       // 阶段切换回调 (boss, phase) => void
        this.onStagger = null;           // 破势回调 (boss) => void
        this.onSkillCast = null;         // 技能释放回调 (boss, skillName) => void
    }

    // ==================== 动画初始化 ====================

    /**
     * 初始化Boss动画（Boss有更多动画）
     */
    initAnimations() {
        const resourceManager = ResourceManager.getInstance();
        const resourcePrefix = `monsters.${this.monsterId}`;
        
        const animationConfigs = [
            {
                name: 'idle',
                resourcePath: `${resourcePrefix}_idle`,
                frameWidth: 64,
                frameHeight: 64,
                directionMode: 'row',
                directions: {
                    down: { row: 0, frames: 6 },
                    up: { row: 1, frames: 6 },
                    left: { row: 2, frames: 6 },
                    right: { row: 3, frames: 6 },
                },
                fps: 8,
                loop: true,
            },
            {
                name: 'walk',
                resourcePath: `${resourcePrefix}_walk`,
                frameWidth: 64,
                frameHeight: 64,
                directionMode: 'row',
                directions: {
                    down: { row: 0, frames: 8 },
                    up: { row: 1, frames: 8 },
                    left: { row: 2, frames: 8 },
                    right: { row: 3, frames: 8 },
                },
                fps: 10,
                loop: true,
            },
            {
                name: 'attack',
                resourcePath: `${resourcePrefix}_attack`,
                frameWidth: 64,
                frameHeight: 64,
                directionMode: 'row',
                directions: {
                    down: { row: 0, frames: 6 },
                    up: { row: 1, frames: 6 },
                    left: { row: 2, frames: 6 },
                    right: { row: 3, frames: 6 },
                },
                fps: 12,
                loop: false,
            },
            {
                name: 'skill1',
                resourcePath: `${resourcePrefix}_skill1`,
                frameWidth: 64,
                frameHeight: 64,
                directionMode: 'row',
                directions: {
                    down: { row: 0, frames: 8 },
                    up: { row: 1, frames: 8 },
                    left: { row: 2, frames: 8 },
                    right: { row: 3, frames: 8 },
                },
                fps: 12,
                loop: false,
            },
            {
                name: 'skill2',
                resourcePath: `${resourcePrefix}_skill2`,
                frameWidth: 64,
                frameHeight: 64,
                directionMode: 'row',
                directions: {
                    down: { row: 0, frames: 8 },
                    up: { row: 1, frames: 8 },
                    left: { row: 2, frames: 8 },
                    right: { row: 3, frames: 8 },
                },
                fps: 12,
                loop: false,
            },
            {
                name: 'hurt',
                resourcePath: `${resourcePrefix}_hurt`,
                frameWidth: 64,
                frameHeight: 64,
                directionMode: 'row',
                directions: {
                    down: { row: 0, frames: 4 },
                    up: { row: 1, frames: 4 },
                    left: { row: 2, frames: 4 },
                    right: { row: 3, frames: 4 },
                },
                fps: 8,
                loop: false,
            },
            {
                name: 'dead',
                resourcePath: `${resourcePrefix}_dead`,
                frameWidth: 64,
                frameHeight: 64,
                directionMode: 'row',
                directions: {
                    down: { row: 0, frames: 8 },
                },
                fps: 6,
                loop: false,
            },
        ];
        
        this.loadAnimations(animationConfigs);
    }

    // ==================== 更新逻辑 ====================

    /**
     * 更新Boss
     * @param {number} deltaTime - 时间增量（秒）
     * @param {GameMap} map - 当前地图
     */
    update(deltaTime, map) {
        if (!this.isAlive) {
            this.updateAnimation(deltaTime);
            return;
        }
        
        // 更新冷却
        this.updateCooldowns(deltaTime);
        
        // 更新破势状态
        this.updateStagger(deltaTime);
        
        // 更新阶段
        this.updatePhase();
        
        // 根据状态执行行为
        this.updateState(deltaTime, map);
        
        // 更新动画
        this.updateAnimation(deltaTime);
    }

    /**
     * 更新冷却
     */
    updateCooldowns(deltaTime) {
        if (this.attackCooldownTimer > 0) {
            this.attackCooldownTimer -= deltaTime;
        }
        if (this.skillCooldownTimer > 0) {
            this.skillCooldownTimer -= deltaTime;
        }
    }

    /**
     * 更新破势状态
     */
    updateStagger(deltaTime) {
        if (this.isStaggered) {
            this.staggerTimer -= deltaTime;
            if (this.staggerTimer <= 0) {
                this.isStaggered = false;
                this.staggerTimer = 0;
                this.toughness = this.maxToughness; // 韧性恢复
            }
        }
    }

    /**
     * 更新阶段
     */
    updatePhase() {
        const healthPercent = this.health / this.maxHealth;
        
        let newPhase = 'phase1';
        for (const phaseName in this.phases) {
            const phaseConfig = this.phases[phaseName];
            if (healthPercent <= phaseConfig.healthPercent) {
                newPhase = phaseName;
            }
        }
        
        if (newPhase !== this.currentPhase) {
            const oldPhase = this.currentPhase;
            this.currentPhase = newPhase;
            
            if (this.onPhaseChange) {
                this.onPhaseChange(this, newPhase, oldPhase);
            }
        }
    }

    /**
     * 更新状态行为
     */
    updateState(deltaTime, map) {
        switch (this.currentState) {
            case 'idle':
                this.updateIdleState(deltaTime, map);
                break;
            case 'chase':
                this.updateChaseState(deltaTime, map);
                break;
            case 'attack':
                this.updateAttackState(deltaTime, map);
                break;
            case 'rest':
                this.updateRestState(deltaTime);
                break;
            case 'staggered':
                this.updateStaggeredState(deltaTime);
                break;
        }
    }

    /**
     * 更新待机状态
     */
    updateIdleState(deltaTime, map) {
        this.isMoving = false;
        
        // 检查是否有目标在仇恨范围内
        if (this.target && this.getDistanceTo(this.target.position) <= this.aggroRange) {
            this.changeState('chase');
        }
    }

    /**
     * 更新追击状态
     */
    updateChaseState(deltaTime, map) {
        if (!this.target) {
            this.changeState('idle');
            return;
        }
        
        const distance = this.getDistanceTo(this.target.position);
        
        // 在攻击范围内，切换到攻击状态
        if (distance <= this.attackRange) {
            if (this.attackCooldownTimer <= 0) {
                this.changeState('attack');
            }
            return;
        }
        
        // 超出仇恨范围，回到待机
        if (distance > this.aggroRange) {
            this.target = null;
            this.changeState('idle');
            return;
        }

        // 保持适当距离，避免贴脸卡死
        const desiredDistance = this.attackRange * 0.8;
        if (distance < desiredDistance) {
            const dx = this.position.x - this.target.position.x;
            const dy = this.position.y - this.target.position.y;
            const length = Math.sqrt(dx * dx + dy * dy) || 1;
            const step = this.moveSpeed * 0.9 * deltaTime;
            const retreatX = this.position.x + (dx / length) * step;
            const retreatY = this.position.y + (dy / length) * step;
            this.isMoving = true;
            this.moveWithCollision(retreatX, retreatY, map);
            this.faceTarget(this.target.position);
            return;
        }
        
        // 移动向目标
        this.isMoving = true;
        this.moveTowards(this.target.position, deltaTime, map);
    }

    /**
     * 更新攻击状态
     */
    updateAttackState(deltaTime, map) {
        this.isMoving = false;
        
        // 面向目标
        if (this.target) {
            this.faceTarget(this.target.position);
        }
        
        // 状态计时
        this.stateTimer -= deltaTime;
        
        if (this.stateTimer <= 0) {
            // 攻击结束，根据情况切换状态
            this.attackCooldownTimer = this.attackCooldown;
            
            // 随机决定是继续攻击还是休息
            if (Math.random() < 0.3) {
                this.changeState('rest');
            } else {
                this.changeState('chase');
            }
        }
    }

    /**
     * 更新休息状态
     */
    updateRestState(deltaTime) {
        this.isMoving = false;
        
        this.restTimer -= deltaTime;
        if (this.restTimer <= 0) {
            this.changeState('chase');
        }
    }

    /**
     * 更新破势状态
     */
    updateStaggeredState(deltaTime) {
        this.isMoving = false;
        
        // 破势状态由updateStagger自动恢复
        if (!this.isStaggered) {
            this.changeState('chase');
        }
    }

    /**
     * 切换状态
     */
    changeState(newState) {
        if (this.currentState === newState) return;
        
        // 退出旧状态
        this.exitState(this.currentState);
        
        // 切换状态
        this.currentState = newState;
        
        // 进入新状态
        this.enterState(newState);
    }

    /**
     * 进入状态
     */
    enterState(stateName) {
        switch (stateName) {
            case 'attack':
                this.stateTimer = 0.8; // 攻击动画持续时间
                this.performAttack();
                break;
            case 'rest':
                this.restTimer = this.restDuration;
                break;
            case 'staggered':
                this.staggerTimer = this.staggerDuration;
                break;
        }
    }

    /**
     * 退出状态
     */
    exitState(stateName) {
        switch (stateName) {
            case 'attack':
                // 攻击结束
                break;
            case 'chase':
                this.isMoving = false;
                break;
        }
    }

    // ==================== 移动相关 ====================

    /**
     * 向目标移动
     */
    moveTowards(target, deltaTime, map) {
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        const moveX = dx / distance;
        const moveY = dy / distance;
        
        this.updateFacing(moveX, moveY);
        
        const step = this.moveSpeed * deltaTime;
        const newX = this.position.x + moveX * step;
        const newY = this.position.y + moveY * step;
        
        this.moveWithCollision(newX, newY, map);
    }

    /**
     * 更新朝向
     */
    updateFacing(moveX, moveY) {
        if (Math.abs(moveX) > Math.abs(moveY)) {
            this.facing = moveX > 0 ? 'right' : 'left';
        } else {
            this.facing = moveY > 0 ? 'down' : 'up';
        }
        this.animationManager.setDirection(this.facing);
    }

    // ==================== 战斗相关 ====================

    /**
     * 执行普通攻击
     */
    performAttack() {
        const canUseSkill = Array.isArray(this.skills) && this.skills.length > 0 && this.skillCooldownTimer <= 0;
        const shouldUseSkill = canUseSkill && Math.random() < (this.currentPhase === 'phase2' ? 0.45 : 0.25);

        if (shouldUseSkill) {
            const skillName = this.skills[Math.floor(Math.random() * this.skills.length)];
            this.castSkill(skillName);
            if (this.onSkillCast) {
                this.onSkillCast(this, skillName);
            }
            return;
        }

        const attackAnimation = this.animationManager.play('attack', {
            reset: true,
            loop: false,
            direction: this.facing,
        });
        
        if (attackAnimation) {
            attackAnimation.onComplete = () => {
                // 攻击动画完成
            };
        }
        
        // 对目标造成伤害（由战斗系统处理）
        if (this.target && this.onAttack) {
            this.onAttack(this, this.target, this.damage);
        }
    }

    /**
     * 释放技能
     * @param {string} skillName - 技能名称
     */
    castSkill(skillName) {
        if (this.skillCooldownTimer > 0) return false;
        
        const skillAnimation = this.animationManager.play(skillName, {
            reset: true,
            loop: false,
            direction: this.facing,
        });
        
        if (skillAnimation) {
            skillAnimation.onComplete = () => {
                // 技能动画完成
            };
        }
        
        this.skillCooldownTimer = this.skillCooldown;
        
        if (this.onSkillCast) {
            this.onSkillCast(this, skillName);
        }
        
        return true;
    }

    /**
     * 受到伤害（重写Monster的takeDamage）
     */
    takeDamage(damage) {
        if (!this.isAlive) {
            return false;
        }
        
        const actualDamage = Math.max(1, damage - this.defense);
        this.health -= actualDamage;
        
        // 减少韧性
        this.reduceToughness(actualDamage);
        
        // 受击表现
        this.isHit = true;
        this.hitTimer = this.hitDuration;
        
        if (this.onDamageTaken) {
            this.onDamageTaken(this, actualDamage);
        }
        
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
        
        return true;
    }

    /**
     * 减少韧性
     * @param {number} amount - 减少量
     */
    reduceToughness(amount) {
        if (this.isStaggered) return;
        
        this.toughness -= amount;
        
        if (this.toughness <= 0) {
            this.toughness = 0;
            this.enterStaggeredState();
        }
    }

    /**
     * 进入破势状态
     */
    enterStaggeredState() {
        this.isStaggered = true;
        this.staggerTimer = this.staggerDuration;
        this.changeState('staggered');
        
        if (this.onStagger) {
            this.onStagger(this);
        }
    }

    /**
     * 死亡处理（重写）
     */
    die() {
        this.isAlive = false;
        this.changeState('dead');
        
        this.animationManager.play('dead', { reset: true, loop: false });
        
        const deadAnimation = this.animationManager.getAnimation('dead');
        if (deadAnimation) {
            deadAnimation.onComplete = () => {
                this.defeatSequenceDone = true;
                if (this.onDeath) {
                    this.onDeath(this);
                }
            };
        } else {
            this.defeatSequenceDone = true;
            if (this.onDeath) {
                this.onDeath(this);
            }
        }
    }

    /**
     * 战败演出是否已播完（战场流程据此结算胜利）
     * @returns {boolean}
     */
    isDefeatSequenceFinished() {
        return !this.isAlive && this.defeatSequenceDone === true;
    }

    /**
     * 受击判定盒（供玩家攻击 / 灵息弹命中检测）
     * 尺寸取 GameConfig 怪物配置里的 hitBoxSize（缺省 72）
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getHitRect() {
        const size = this.monsterConfig && this.monsterConfig.hitBoxSize
            ? this.monsterConfig.hitBoxSize
            : 72;
        return {
            x: this.position.x - size / 2,
            y: this.position.y - size / 2,
            width: size,
            height: size,
        };
    }

    /**
     * 处理玩家普通攻击 / 技能命中（战场即时战斗用）
     * @param {Object} attackData - { rect: {x,y,width,height}, damage: number, source: Object }
     * @returns {boolean} 是否命中
     */
    handlePlayerAttack(attackData) {
        if (!this.isAlive || !attackData || !attackData.rect) {
            return false;
        }
        if (!Boss.rectsIntersect(attackData.rect, this.getHitRect())) {
            return false;
        }
        return this.takeDamage(attackData.damage || 0, attackData.source);
    }

    /**
     * 矩形相交判定
     */
    static rectsIntersect(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x
            && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    /**
     * 更新动画（重写）
     */
    updateAnimation(deltaTime) {
        if (!this.isAlive) {
            this.animationManager.play('dead', { reset: false, loop: false });
        } else if (this.isStaggered) {
            this.animationManager.play('hurt', { reset: false, loop: true, direction: this.facing });
        } else if (this.currentState === 'attack') {
            // 攻击动画由performAttack控制
        } else if (this.isMoving) {
            this.animationManager.play('walk', { reset: false, loop: true });
            this.animationManager.setDirection(this.facing);
        } else if (this.isHit) {
            this.animationManager.play('hurt', { reset: false, loop: false, direction: this.facing });
        } else {
            this.animationManager.play('idle', { reset: false, loop: true });
            this.animationManager.setDirection(this.facing);
        }
        
        this.animationManager.update(deltaTime);
    }

    // ==================== 目标管理 ====================

    /**
     * 设置目标
     * @param {Object} target - 目标实例（通常是玩家）
     */
    setTarget(target) {
        this.target = target;
        if (target) {
            this.changeState('chase');
        }
    }

    /**
     * 清除目标
     */
    clearTarget() {
        this.target = null;
        this.changeState('idle');
    }

    // ==================== 序列化 ====================

    /**
     * 序列化Boss状态（用于存档）
     */
    serialize() {
        const baseData = super.serialize();
        
        return {
            ...baseData,
            toughness: this.toughness,
            maxToughness: this.maxToughness,
            isStaggered: this.isStaggered,
            currentState: this.currentState,
            currentPhase: this.currentPhase,
            attackCooldownTimer: this.attackCooldownTimer,
            skillCooldownTimer: this.skillCooldownTimer,
        };
    }

    /**
     * 反序列化Boss状态（用于读档）
     */
    deserialize(data) {
        super.deserialize(data);
        
        if (!data) return;
        
        this.toughness = data.toughness !== undefined ? data.toughness : this.toughness;
        this.maxToughness = data.maxToughness || this.maxToughness;
        this.isStaggered = data.isStaggered || false;
        this.currentState = data.currentState || this.currentState;
        this.currentPhase = data.currentPhase || this.currentPhase;
        this.attackCooldownTimer = data.attackCooldownTimer || 0;
        this.skillCooldownTimer = data.skillCooldownTimer || 0;
    }
}