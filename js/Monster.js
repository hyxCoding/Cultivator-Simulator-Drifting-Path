/**
 * 普通怪物类
 * 静止不动，有基础属性，死亡后触发回调
 * 动画更新在内部update方法中处理
 */
class Monster {
    /**
     * @param {Object} config - 怪物配置
     * @param {string} config.id - 怪物唯一ID
     * @param {string} config.monsterId - 怪物配置ID（对应GameConfig中的monsters配置）
     * @param {Object} config.position - 初始位置 {x, y}（世界坐标，像素）
     * @param {Object} config.animationManager - 动画管理器实例（可选）
     */
    constructor(config = {}) {
        // ========== 基本信息 ==========
        this.id = config.id || `monster_${Date.now()}`;
        this.monsterId = config.monsterId || 'unknown';
        
        // ========== 加载怪物配置 ==========
        const gameConfig = GameConfig.getInstance();
        this.monsterConfig = gameConfig.getMonster(this.monsterId) || {};
        
        // ========== 基本属性 ==========
        this.realm = this.monsterConfig.realm || 'lianqi';
        this.maxHealth = config.maxHealth || this.monsterConfig.health || 50;
        this.health = this.maxHealth;
        this.damage = config.damage || this.monsterConfig.damage || 10;
        this.defense = config.defense || this.monsterConfig.defense || 0;
        this.expReward = this.monsterConfig.expReward || 10;
        this.lingShiReward = this.monsterConfig.lingShiReward || 5;
        this.drops = this.monsterConfig.drops || [];
        
        // ========== 基本物理数据 ==========
        this.position = config.position || { x: 0, y: 0 };
        this.width = 24;
        this.height = 32;
        this.facing = 'down';
        
        // ========== 动画系统 ==========
        this.animationManager = config.animationManager || new AnimationManager();
        
        // ========== 状态 ==========
        this.isAlive = true;
        this.isInBattle = false;
        this.isHit = false;          // 是否被击中
        this.hitTimer = 0;           // 受击动画计时器
        this.hitDuration = 0.3;      // 受击动画持续时间
        
        // ========== 回调 ==========
        this.onDeath = null;         // 死亡回调 (monster) => void
        this.onDamageTaken = null;   // 受到伤害回调 (monster, damage) => void
        
        // ========== 初始化 ==========
        this.initAnimations();
    }

    // ==================== 动画初始化 ====================

    /**
     * 初始化怪物动画
     */
    initAnimations() {
        const resourceManager = ResourceManager.getInstance();
        const resourcePrefix = `monsters.${this.monsterId}`;
        
        const animationConfigs = [
            {
                name: 'idle',
                resourcePath: `${resourcePrefix}_idle`,
                frameWidth: 32,
                frameHeight: 32,
                directionMode: 'row',
                directions: {
                    down: { row: 0, frames: 4 },
                    up: { row: 1, frames: 4 },
                    left: { row: 2, frames: 4 },
                    right: { row: 3, frames: 4 },
                },
                fps: 8,
                loop: true,
            },
            {
                name: 'attack',
                resourcePath: `${resourcePrefix}_attack`,
                frameWidth: 32,
                frameHeight: 32,
                directionMode: 'row',
                directions: {
                    down: { row: 0, frames: 5 },
                    up: { row: 1, frames: 5 },
                    left: { row: 2, frames: 5 },
                    right: { row: 3, frames: 5 },
                },
                fps: 10,
                loop: false,
            },
            {
                name: 'hurt',
                resourcePath: `${resourcePrefix}_hurt`,
                frameWidth: 32,
                frameHeight: 32,
                directionMode: 'row',
                directions: {
                    down: { row: 0, frames: 3 },
                    up: { row: 1, frames: 3 },
                    left: { row: 2, frames: 3 },
                    right: { row: 3, frames: 3 },
                },
                fps: 8,
                loop: false,
            },
            {
                name: 'dead',
                resourcePath: `${resourcePrefix}_dead`,
                frameWidth: 32,
                frameHeight: 32,
                directionMode: 'row',
                directions: {
                    down: { row: 0, frames: 4 },
                },
                fps: 6,
                loop: false,
            },
        ];
        
        this.loadAnimations(animationConfigs);
    }

    /**
     * 异步加载动画
     */
    async loadAnimations(animationConfigs) {
        const resourceManager = ResourceManager.getInstance();
        
        for (const config of animationConfigs) {
            try {
                const spriteSheet = await resourceManager.loadImage(config.resourcePath);
                
                const animation = new Animation({
                    name: config.name,
                    spriteSheet: spriteSheet,
                    frameWidth: config.frameWidth,
                    frameHeight: config.frameHeight,
                    directionMode: config.directionMode,
                    directions: config.directions,
                    fps: config.fps,
                    loop: config.loop,
                    scale: 1.5,
                    defaultDirection: 'down',
                });
                
                this.animationManager.addAnimation(config.name, animation);
            } catch (error) {
                console.warn(`怪物 ${this.id} 加载动画失败: ${config.name}`, error);
            }
        }
        
        this.animationManager.play('idle');
        this.animationManager.setDirection('down');
    }

    // ==================== 更新逻辑 ====================

    /**
     * 更新怪物
     * 普通怪物不会移动，只处理动画状态
     * @param {number} deltaTime - 时间增量（秒）
     * @param {GameMap} map - 当前地图
     */
    update(deltaTime, map) {
        if (!this.isAlive) {
            // 死亡动画播放完后不再更新
            this.updateAnimation(deltaTime);
            return;
        }
        
        // 更新受击状态
        if (this.isHit) {
            this.hitTimer -= deltaTime;
            if (this.hitTimer <= 0) {
                this.isHit = false;
                this.hitTimer = 0;
            }
        }
        
        // 更新动画
        this.updateAnimation(deltaTime);
    }

    /**
     * 更新动画
     */
    updateAnimation(deltaTime) {
        if (!this.isAlive) {
            // 死亡动画
            this.animationManager.play('dead', { reset: false, loop: false });
        } else if (this.isHit) {
            // 受击动画
            this.animationManager.play('hurt', { reset: false, loop: false, direction: this.facing });
        } else {
            // 待机动画
            this.animationManager.play('idle', { reset: false, loop: true });
            this.animationManager.setDirection(this.facing);
        }
        
        this.animationManager.update(deltaTime);
    }

    // ==================== 战斗相关 ====================

    /**
     * 受到伤害
     * @param {number} damage - 伤害值
     * @returns {boolean} 是否成功造成伤害
     */
    takeDamage(damage) {
        if (!this.isAlive) {
            return false;
        }
        
        // 计算实际伤害
        const actualDamage = Math.max(1, damage - this.defense);
        this.health -= actualDamage;
        
        // 设置受击状态
        this.isHit = true;
        this.hitTimer = this.hitDuration;
        
        // 触发受击回调
        if (this.onDamageTaken) {
            this.onDamageTaken(this, actualDamage);
        }
        
        // 检查死亡
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
        
        return true;
    }

    /**
     * 死亡处理
     */
    die() {
        this.isAlive = false;
        
        // 播放死亡动画
        this.animationManager.play('dead', { reset: true, loop: false });
        
        const deadAnimation = this.animationManager.getAnimation('dead');
        if (deadAnimation) {
            deadAnimation.onComplete = () => {
                // 触发死亡回调（死亡动画播放完后）
                if (this.onDeath) {
                    this.onDeath(this);
                }
            };
        } else {
            // 无死亡动画，直接触发回调
            if (this.onDeath) {
                this.onDeath(this);
            }
        }
    }

    /**
     * 获取死亡奖励
     * @returns {Object} 奖励 {exp, lingShi, drops}
     */
    getRewards() {
        return {
            exp: this.expReward,
            lingShi: this.lingShiReward,
            drops: this.drops,
        };
    }

    // ==================== 工具方法 ====================

    /**
     * 获取到目标位置的距离
     */
    getDistanceTo(target) {
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 面向目标
     * @param {Object} targetPosition - 目标位置
     */
    faceTarget(targetPosition) {
        const dx = targetPosition.x - this.position.x;
        const dy = targetPosition.y - this.position.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            this.facing = dx > 0 ? 'right' : 'left';
        } else {
            this.facing = dy > 0 ? 'down' : 'up';
        }
        
        this.animationManager.setDirection(this.facing);
    }

    // ==================== 渲染 ====================

    /**
     * 渲染怪物
     */
    render(ctx, camera) {
        if (!this.isAlive) {
            // 检查死亡动画是否播放完毕
            const deadAnimation = this.animationManager.getCurrentAnimation();
            if (deadAnimation && deadAnimation.name === 'dead' && deadAnimation.isFinished) {
                // 死亡动画播放完毕，不再渲染
                return;
            }
        }
        
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x - this.width / 2;
        const screenY = this.position.y - renderPos.y - this.height / 2;
        
        // 受击闪烁效果
        const renderOptions = {};
        if (this.isHit) {
            if (Math.floor(this.hitTimer * 10) % 2 === 0) {
                renderOptions.alpha = 0.7;
            }
        }
        
        this.animationManager.render(
            ctx,
            screenX,
            screenY,
            this.width * 2,
            this.height * 2,
            renderOptions
        );
    }

    // ==================== 序列化 ====================

    /**
     * 序列化怪物状态（用于存档）
     */
    serialize() {
        return {
            id: this.id,
            monsterId: this.monsterId,
            position: { ...this.position },
            health: this.health,
            maxHealth: this.maxHealth,
            isAlive: this.isAlive,
            facing: this.facing,
            animationManager: this.animationManager.serialize(),
        };
    }

    /**
     * 反序列化怪物状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.id = data.id || this.id;
        this.monsterId = data.monsterId || this.monsterId;
        this.position = data.position || this.position;
        this.health = data.health !== undefined ? data.health : this.health;
        this.maxHealth = data.maxHealth || this.maxHealth;
        this.isAlive = data.isAlive !== undefined ? data.isAlive : this.isAlive;
        this.facing = data.facing || this.facing;
        
        if (data.animationManager) {
            this.animationManager.deserialize(data.animationManager);
        }
    }
}