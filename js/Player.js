/**
 * 玩家类（完整修正版）
 * 包含背包系统、职业系统、玩家数据系统、移动碰撞检测
 * 动画系统：每个动作一个 Animation 实例，内部包含四方向帧序列
 */
class Player {
    /**
     * @param {Object} config - 玩家配置
     * @param {Object} config.position - 初始位置 {x, y}
     * @param {Object} config.animationManager - 动画管理器实例（可选）
     * @param {Object} config.playerData - 玩家数据配置（可选）
     * @param {Object} config.inventory - 背包配置（可选）
     * @param {Object} config.profession - 职业配置（可选）
     */
    constructor(config = {}) {
        // ========== 基本物理数据 ==========
        this.position = config.position || { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0 };
        this.width = 24;   // 碰撞盒宽度
        this.height = 32;  // 碰撞盒高度
        this.facing = 'down'; // 朝向：up/down/left/right
        
        // ========== 玩家数据系统 ==========
        this.playerData = new PlayerData(config.playerData);
        
        // ========== 背包系统 ==========
        this.inventory = new Inventory(config.inventory);
        
        // ========== 职业系统 ==========
        this.professionSystem = new ProfessionSystem(config.profession);
        
        // ========== 动画系统 ==========
        this.animationManager = config.animationManager || new AnimationManager();
        
        // ========== 移动相关 ==========
        this.moveSpeed = this.getCurrentMoveSpeed();
        this.isMoving = false;
        this.moveDirection = { x: 0, y: 0 };
        
        // ========== 状态 ==========
        this.isAlive = true;
        this.isInteracting = false;  // 是否正在交互（对话、商店等）
        this.isInBattle = false;     // 是否在战斗中
        this.isInvincible = false;   // 是否无敌
        this.invincibleTimer = 0;
        
        // ========== 战斗相关 ==========
        this.attackCooldown = 0;
        this.attackDuration = 0.3;
        this.isAttacking = false;
        this.attackTimer = 0;
        
        // ========== 交互相关 ==========
        this.nearbyNPC = null;
        this.nearbyMonster = null;
        this.nearbyTeleportArray = null;
        this.interactionRadius = 50;
        
        // ========== 任务系统 ==========
        this.questSystem = new QuestSystem();
        
        // ========== 回调 ==========
        this.onAttack = null;   // 攻击回调
        this.onDeath = null;    // 死亡回调
        this.onInteract = null; // 交互回调
        
        // ========== 初始化 ==========
        this.initAnimations();
    }

    // ==================== 动画初始化 ====================

    /**
     * 初始化玩家动画
     * 每个动作一个 Animation 实例，内部包含四方向帧序列
     */
    initAnimations() {
        const professionId = this.professionSystem.currentProfessionId;
        const professionPrefix = this.getProfessionAnimationPrefix(professionId);
        
        const animationConfigs = [
            {
                name: 'idle',
                resourcePath: `${professionPrefix}_idle`,
                frameWidth: 32,
                frameHeight: 32,
                directionMode: 'row',
                directions: {
                    down:  { row: 0, frames: 4 },
                    up:    { row: 3, frames: 4 },
                    left:  { row: 1, frames: 4 },
                    right: { row: 2, frames: 4 },
                },
                fps: 8,
                loop: true,
            },
            {
                name: 'walk',
                resourcePath: `${professionPrefix}_walk`,
                frameWidth: 32,
                frameHeight: 32,
                directionMode: 'row',
                directions: {
                    down:  { row: 0, frames: 4 },
                    up:    { row: 3, frames: 4 },
                    left:  { row: 1, frames: 4 },
                    right: { row: 2, frames: 4 },
                    
                },
                fps: 10,
                loop: true,
            },
            {
                name: 'attack',
                resourcePath: `${professionPrefix}_attack`,
                frameWidth: 32,
                frameHeight: 32,
                directionMode: 'row',
                directions: {
                    down:  { row: 0, frames: 5 },
                    up:    { row: 1, frames: 5 },
                    left:  { row: 2, frames: 5 },
                    right: { row: 3, frames: 5 },
                },
                fps: 12,
                loop: false,
            },
            {
                name: 'hurt',
                resourcePath: `${professionPrefix}_hurt`,
                frameWidth: 32,
                frameHeight: 32,
                directionMode: 'row',
                directions: {
                    down:  { row: 0, frames: 3 },
                    up:    { row: 1, frames: 3 },
                    left:  { row: 2, frames: 3 },
                    right: { row: 3, frames: 3 },
                },
                fps: 8,
                loop: false,
            },
            {
                name: 'dead',
                resourcePath: `${professionPrefix}_dead`,
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
     * 获取职业对应的动画资源前缀
     */
    getProfessionAnimationPrefix(professionId) {
        const prefixMap = {
            'sanxiu': 'player.sanxiu',
            'jianxiu': 'player.jianxiu',
            'faxiu': 'player.faxiu',
            'tixiu': 'player.tixiu',
            'fuxiu': 'player.fuxiu',
        };
        return prefixMap[professionId] || 'player.sanxiu';
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
                console.warn(`加载动画失败: ${config.name}`, error);
            }
        }
        
        // 播放默认动画
        this.animationManager.play('idle');
        this.animationManager.setDirection('down');
    }

    // ==================== 更新逻辑 ====================

    /**
     * 更新玩家
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态
     * @param {GameMap} map - 当前地图
     */
    update(deltaTime, input, map) {
        if (!this.isAlive) {
            this.updateAnimation(deltaTime);
            return;
        }
        
        // 更新无敌状态
        this.updateInvincibility(deltaTime);
        
        // 更新攻击状态
        this.updateAttack(deltaTime);
        
        // 处理移动
        if (!this.isAttacking && !this.isInteracting && !this.isInBattle) {
            this.updateMovement(deltaTime, input, map);
        }
        
        // 更新交互检测
        if (map) {
            this.updateInteractionDetection(map);
        }
        
        // 更新动画
        this.updateAnimation(deltaTime);
        
        // 更新攻击冷却
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        
        // 更新任务系统
        this.questSystem.update(deltaTime);
        
        // 更新游戏时间统计
        this.playerData.updatePlayTime(deltaTime);
    }

    /**
     * 更新移动
     */
    updateMovement(deltaTime, input, map) {
        let moveX = 0;
        let moveY = 0;
        
        if (input.keys) {
            if (input.keys['w'] || input.keys['arrowup']) {
                moveY = -1;
                this.facing = 'up';
            }
            if (input.keys['s'] || input.keys['arrowdown']) {
                moveY = 1;
                this.facing = 'down';
            }
            if (input.keys['a'] || input.keys['arrowleft']) {
                moveX = -1;
                this.facing = 'left';
            }
            if (input.keys['d'] || input.keys['arrowright']) {
                moveX = 1;
                this.facing = 'right';
            }
        }
        
        // 归一化
        if (moveX !== 0 && moveY !== 0) {
            const length = Math.sqrt(moveX * moveX + moveY * moveY);
            moveX /= length;
            moveY /= length;
        }
        
        this.velocity.x = moveX * this.moveSpeed;
        this.velocity.y = moveY * this.moveSpeed;
        
        this.isMoving = (moveX !== 0 || moveY !== 0);
        this.moveDirection = { x: moveX, y: moveY };
        
        const newX = this.position.x + this.velocity.x * deltaTime;
        const newY = this.position.y + this.velocity.y * deltaTime;
        
        this.moveWithCollision(newX, newY, map);
    }

    /**
     * 带碰撞检测的移动
     */
    moveWithCollision(newX, newY, map) {
        if (!map) {
            this.position.x = newX;
            this.position.y = newY;
            return;
        }
        
        // X轴
        const xRect = {
            x: newX - this.width / 2,
            y: this.position.y - this.height / 2,
            width: this.width,
            height: this.height,
        };
        
        if (!this.checkCollision(xRect, map)) {
            this.position.x = newX;
        }
        
        // Y轴
        const yRect = {
            x: this.position.x - this.width / 2,
            y: newY - this.height / 2,
            width: this.width,
            height: this.height,
        };
        
        if (!this.checkCollision(yRect, map)) {
            this.position.y = newY;
        }
    }

    /**
     * 检查碰撞
     */
    checkCollision(rect, map) {
        if (!map) return false;
        
        const mapBounds = {
            x: 0,
            y: 0,
            width: map.mapWidth * map.tileSize,
            height: map.mapHeight * map.tileSize,
        };
        
        if (rect.x < mapBounds.x ||
            rect.y < mapBounds.y ||
            rect.x + rect.width > mapBounds.x + mapBounds.width ||
            rect.y + rect.height > mapBounds.y + mapBounds.height) {
            return true;
        }
        
        return !map.isRectWalkable(rect);
    }

    /**
     * 更新攻击状态
     */
    updateAttack(deltaTime) {
        if (this.isAttacking) {
            this.attackTimer -= deltaTime;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
                this.attackTimer = 0;
            }
        }
    }

    /**
     * 更新无敌状态
     */
    updateInvincibility(deltaTime) {
        if (this.isInvincible) {
            this.invincibleTimer -= deltaTime;
            if (this.invincibleTimer <= 0) {
                this.isInvincible = false;
                this.invincibleTimer = 0;
            }
        }
    }

    /**
     * 更新交互检测
     */
    updateInteractionDetection(map) {
        const nearbyNPCs = map.getNPCsNearby(this.position, this.interactionRadius);
        this.nearbyNPC = nearbyNPCs.length > 0 ? nearbyNPCs[0] : null;
        
        const nearbyMonsters = map.getMonstersNearby(this.position, this.interactionRadius);
        this.nearbyMonster = nearbyMonsters.length > 0 ? nearbyMonsters[0] : null;

        const nearbyTeleporters = map.getTeleportersNearby ? map.getTeleportersNearby(this.position, this.interactionRadius) : [];
        this.nearbyTeleportArray = nearbyTeleporters.length > 0 ? nearbyTeleporters[0] : null;
    }

    /**
     * 更新动画
     * 通过 setDirection 切换方向
     */
    updateAnimation(deltaTime) {
        if (this.isAttacking) {
            // 攻击动画由 performAttack 控制
        } else if (!this.isAlive) {
            this.animationManager.play('dead', { reset: false, loop: false });
        } else if (this.isMoving) {
            this.animationManager.play('walk', { reset: false, loop: true });
            this.animationManager.setDirection(this.facing);
        } else {
            this.animationManager.play('idle', { reset: false, loop: true });
            this.animationManager.setDirection(this.facing);
        }
        
        this.animationManager.update(deltaTime);
    }

    /**
     * 播放空闲动画
     */
    playIdleAnimation() {
        this.animationManager.play('idle', { reset: false, loop: true });
        this.animationManager.setDirection(this.facing);
    }

    // ==================== 战斗相关 ====================

    /**
     * 执行攻击
     */
    performAttack() {
        if (this.isAttacking || this.attackCooldown > 0 || !this.isAlive) {
            return false;
        }
        
        this.isAttacking = true;
        this.attackTimer = this.attackDuration;
        this.attackCooldown = this.professionSystem.getAttackCooldown();
        
        // 播放攻击动画
        const attackAnimation = this.animationManager.play('attack', {
            reset: true,
            loop: false,
            direction: this.facing,
        });
        
        if (attackAnimation) {
            attackAnimation.onComplete = () => {
                this.isAttacking = false;
                this.playIdleAnimation();
            };
        }
        
        this.executeAttack();
        return true;
    }

    /**
     * 执行攻击判定
     */
    executeAttack() {
        const attackRange = this.professionSystem.getAttackRange();
        const attackDamage = this.professionSystem.getAttackDamage();
        const attackRect = this.getAttackRect(attackRange);
        
        if (this.onAttack) {
            this.onAttack({
                rect: attackRect,
                damage: attackDamage,
                source: this,
            });
        }
    }

    /**
     * 获取攻击判定矩形
     */
    getAttackRect(range) {
        let rect;
        
        switch (this.facing) {
            case 'up':
                rect = {
                    x: this.position.x - this.width / 2,
                    y: this.position.y - this.height / 2 - range,
                    width: this.width,
                    height: range,
                };
                break;
            case 'down':
                rect = {
                    x: this.position.x - this.width / 2,
                    y: this.position.y + this.height / 2,
                    width: this.width,
                    height: range,
                };
                break;
            case 'left':
                rect = {
                    x: this.position.x - this.width / 2 - range,
                    y: this.position.y - this.height / 2,
                    width: range,
                    height: this.height,
                };
                break;
            case 'right':
                rect = {
                    x: this.position.x + this.width / 2,
                    y: this.position.y - this.height / 2,
                    width: range,
                    height: this.height,
                };
                break;
            default:
                rect = {
                    x: this.position.x - range,
                    y: this.position.y - range,
                    width: range * 2,
                    height: range * 2,
                };
        }
        
        return rect;
    }

    /**
     * 受到伤害
     */
    takeDamage(damage) {
        if (this.isInvincible || !this.isAlive) {
            return false;
        }
        
        const actualDamage = this.professionSystem.calculateDamageTaken(damage);
        this.playerData.health -= actualDamage;
        
        // 播放受伤动画
        const hurtAnimation = this.animationManager.play('hurt', {
            reset: true,
            loop: false,
            direction: this.facing,
        });
        
        if (hurtAnimation) {
            hurtAnimation.onComplete = () => {
                this.playIdleAnimation();
            };
        }
        
        this.isInvincible = true;
        this.invincibleTimer = 0.5;
        
        if (this.playerData.health <= 0) {
            this.playerData.health = 0;
            this.die();
        }
        
        return true;
    }

    /**
     * 恢复生命值
     */
    heal(amount) {
        if (!this.isAlive) return;
        this.playerData.health = Math.min(
            this.playerData.health + amount,
            this.playerData.maxHealth
        );
    }

    /**
     * 恢复灵息
     */
    restoreMana(amount) {
        if (!this.isAlive) return;
        this.playerData.mana = Math.min(
            this.playerData.mana + amount,
            this.playerData.maxMana
        );
    }

    /**
     * 死亡处理
     */
    die() {
        this.isAlive = false;
        this.isMoving = false;
        this.velocity = { x: 0, y: 0 };
        
        this.animationManager.play('dead', { reset: true, loop: false });
        
        this.playerData.statistics.totalDeaths++;
        
        if (this.onDeath) {
            this.onDeath(this);
        }
    }

    /**
     * 复活
     */
    revive(position) {
        this.isAlive = true;
        this.position = position || this.position;
        this.playerData.health = this.playerData.maxHealth;
        this.playerData.mana = this.playerData.maxMana;
        this.isInvincible = true;
        this.invincibleTimer = 2;
        
        this.playIdleAnimation();
    }

    // ==================== 物品相关 ====================

    /**
     * 使用物品
     */
    useItem(itemId) {
        if (!this.isAlive) return false;
        
        const gameConfig = GameConfig.getInstance();
        const itemConfig = gameConfig.getItem(itemId);
        if (!itemConfig) return false;
        
        if (!this.inventory.hasItem(itemId)) return false;
        
        switch (itemConfig.effect) {
            case 'restore_health_percent':
                const healAmount = this.playerData.maxHealth * (itemConfig.value / 100);
                this.heal(healAmount);
                break;
            case 'restore_mana_percent':
                const manaAmount = this.playerData.maxMana * (itemConfig.value / 100);
                this.restoreMana(manaAmount);
                break;
            default:
                return false;
        }
        
        this.inventory.removeItem(itemId, 1);
        this.playerData.statistics.totalItemsUsed++;
        
        return true;
    }

    // ==================== 成长相关 ====================

    /**
     * 获取经验
     */
    gainExperience(amount) {
        this.playerData.gainExperience(amount);
    }

    /**
     * 突破境界
     */
    breakthrough() {
        const gameConfig = GameConfig.getInstance();
        const realmOrder = ['lianqi', 'zhuji', 'jiedan', 'yuanying', 'huashen'];
        const currentIndex = realmOrder.indexOf(this.playerData.realm);
        
        if (currentIndex < realmOrder.length - 1 && this.playerData.stage === '圆满') {
            const newRealm = realmOrder[currentIndex + 1];
            const realmConfig = gameConfig.getRealm(newRealm);
            
            this.playerData.realm = newRealm;
            this.playerData.stage = realmConfig.stages[0];
            this.playerData.maxHealth = realmConfig.maxHealth;
            this.playerData.maxMana = realmConfig.maxMana;
            this.playerData.health = realmConfig.maxHealth;
            this.playerData.mana = realmConfig.maxMana;
            this.moveSpeed = this.getCurrentMoveSpeed();
            
            return true;
        }
        
        return false;
    }

    /**
     * 获取当前移动速度
     */
    getCurrentMoveSpeed() {
        const gameConfig = GameConfig.getInstance();
        const realmConfig = gameConfig.getRealm(this.playerData.realm);
        const baseSpeed = realmConfig ? realmConfig.moveSpeed : 200;
        
        const speedBonus = this.professionSystem.professionConfig.moveSpeedBonus || 0;
        
        return baseSpeed + speedBonus;
    }

    // ==================== 交互相关 ====================

    /**
     * 尝试与附近NPC交互
     */
    interactWithNPC() {
        if (this.nearbyNPC && this.isAlive) {
            this.isInteracting = true;
            
            if (this.onInteract) {
                this.onInteract(this.nearbyNPC);
            }
            
            return true;
        }
        return false;
    }

    /**
     * 结束交互
     */
    endInteraction() {
        this.isInteracting = false;
    }

    // ==================== 渲染 ====================

    /**
     * 渲染玩家
     */
    render(ctx, camera) {
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x - this.width / 2;
        const screenY = this.position.y - renderPos.y - this.height / 2;
        
        const renderOptions = {};
        if (this.isInvincible) {
            if (Math.floor(this.invincibleTimer * 10) % 2 === 0) {
                renderOptions.alpha = 0.5;
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
     * 序列化玩家状态（用于存档）
     */
    serialize() {
        return {
            position: { ...this.position },
            facing: this.facing,
            isAlive: this.isAlive,
            isInteracting: this.isInteracting,
            isInBattle: this.isInBattle,
            playerData: this.playerData.serialize(),
            inventory: this.inventory.serialize(),
            professionSystem: this.professionSystem.serialize(),
            questSystem: this.questSystem.serialize(),
            animationManager: this.animationManager.serialize(),
        };
    }

    /**
     * 反序列化玩家状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.position = data.position || this.position;
        this.facing = data.facing || this.facing;
        this.isAlive = data.isAlive !== undefined ? data.isAlive : this.isAlive;
        this.isInteracting = data.isInteracting || false;
        this.isInBattle = data.isInBattle || false;
        
        if (data.playerData) this.playerData.deserialize(data.playerData);
        if (data.inventory) this.inventory.deserialize(data.inventory);
        if (data.professionSystem) this.professionSystem.deserialize(data.professionSystem);
        if (data.questSystem) this.questSystem.deserialize(data.questSystem);
        if (data.animationManager) this.animationManager.deserialize(data.animationManager);
    }
}