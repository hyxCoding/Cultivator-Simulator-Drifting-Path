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
        this.width = 24;   // 精灵绘制尺寸（宽）：render 按 width*2 × height*2 画
        this.height = 32;  // 精灵绘制尺寸（高）
        // 移动碰撞盒（浮点像素，以 position 为中心）——与上面的绘制尺寸解耦：
        // 必须小于瓦片边长（qinglan_fuye / boss_arena_ch1 的 tileSize = 32）。
        // 原因：碰撞盒若正好 32 高，站在瓦片中心时上下两条边都落在瓦片边界上，
        // GameMap.isRectWalkable 的四角取样会同时落到相邻两行瓦片 → 等于要求
        // 连续两行都可通行；单瓦片宽的桥（进村木桥 / 码头长桥 / Boss 战场入口桥）
        // 与窄道会整条走不过去（实测从出生点只能走到全图 23.8% 的可站立区域）。
        // 24 < 32 时碰撞盒能落在同一行瓦片内，实测可达 99.5%，所有任务点都能走到。
        this.collisionWidth = 24;
        this.collisionHeight = 24;
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

        // ========== 闪避相关 ==========
        this.isDodging = false;
        this.dodgeCooldown = 0;
        this.dodgeDuration = 0.25;
        this.dodgeTimer = 0;
        this.dodgeSpeed = this.moveSpeed * 3;
        // ========== 灵息自然恢复（每 CONFIG.combat.manaRegen 间隔恢复 amount 点） ==========
        this.manaRegenTimer = 0;     // 自然恢复计时（满灵息时清零，不累积）

        // ========== 战斗系统联动（由 Main 注入 PlayerCombatSystem，见 js/PlayerCombat.js） ==========
        this.combatSystem = null;     // 玩家战斗系统实例
        this.isCastingSkill = false;  // 施法中（灵息弹攻击动画由战斗系统控制，不被 idle/walk 覆盖）
        this.isHurtLocked = false;    // 受伤动画播放中：禁止一切玩家行为输入
        this.hurtTimer = 0;           // 受伤僵直剩余时间（秒）
        this.hurtFlashTimer = 0;      // 无受伤图集时的程序化闪红计时

        // ========== 交互相关 ==========
        this.nearbyNPC = null;
        this.nearbySignpost = null;
        this.nearbyWindPile = null;
        this.nearbyMonster = null;
        this.nearbyTeleportArray = null;
        this.nearbyPickupItem = null;
        this.interactionRadius = 50;
        
        // ========== 任务系统 ==========
        this.questSystem = new QuestSystem();
        this.questItemSystem = new QuestItemSystem();
        
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
                    down:  { row: 0, frames: 1 },
                    left:  { row: 1, frames: 1 },
                    right: { row: 2, frames: 1 },
                    up:    { row: 3, frames: 1 },
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
                // 美术规格：4 行（下/左/右/上）× 4 帧，单帧 32×32，非循环
                directions: {
                    down:  { row: 0, frames: 4 },
                    left:  { row: 1, frames: 4 },
                    right: { row: 2, frames: 4 },
                    up:    { row: 3, frames: 4 },
                },
                fps: 8,
                loop: false,
            },
            {
                // 灵息弹施法动画：4 行（下/左/右/上）× 4 帧，单帧 32×32，非循环
                // （由 PlayerCombatSystem 在灵息弹施法期间播放）
                name: 'skill_lingxidan',
                resourcePath: `${professionPrefix}_skill`,
                frameWidth: 32,
                frameHeight: 32,
                directionMode: 'row',
                directions: {
                    down:  { row: 0, frames: 4 },
                    left:  { row: 1, frames: 4 },
                    right: { row: 2, frames: 4 },
                    up:    { row: 3, frames: 4 },
                },
                fps: 10,
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
     * 推断动画精灵图"实际可用的单帧尺寸"
     *
     * 背景：
     * 1) 资源缺失时 ResourceManager 会返回 32×32 占位图；若不校验，
     *    占位图会被当作帧序列绘制（例如受伤时角色变成占位方块），故尺寸明显不足时判废。
     * 2) 部分图集画布宽/高不是声明帧宽/高的整数倍（实测 sanxiu_hurt.png / sanxiu_skill.png
     *    为 125×128，而声明规格是 4 列 × 32px = 128px）。旧实现要求"必须整除"导致整张
     *    图集被丢弃 → 受伤 / 施法退化为程序化占位表现。此处按列数 / 行数均分取整
     *    （125 ÷ 4 = 31.25 → 每帧 31px），既让图集可用，也避免最后一帧源矩形越出画布
     *    被浏览器按比例裁掉（表现为最后一帧角色变窄）。
     *
     * @param {Image} sheet - 精灵图
     * @param {Object} config - 动画配置
     * @returns {{frameWidth: number, frameHeight: number}|null} 可用时返回实际单帧尺寸，否则 null
     */
    static resolveFrameSpec(sheet, config) {
        if (!sheet) return null;

        const width = sheet.naturalWidth || sheet.width || 0;
        const height = sheet.naturalHeight || sheet.height || 0;
        const declaredWidth = config.frameWidth || 32;
        const declaredHeight = config.frameHeight || 32;

        const directions = config.directions || {};
        let columns = 1;
        let rows = 1;
        for (const key in directions) {
            const direction = directions[key];
            columns = Math.max(columns, direction.frames || 1);
            const index = direction.row !== undefined ? direction.row : (direction.col || 0);
            rows = Math.max(rows, index + 1);
        }

        // 尺寸校验：允许每列 / 每行各 1 像素的画布取整误差
        if (width < declaredWidth * columns - columns || height < declaredHeight * rows - rows) {
            return null;
        }

        // 切帧尺寸：画布正好是声明规格的整数倍时沿用声明值（idle / walk / dead 等都走这一支）；
        //           否则按列数 / 行数均分取整（如 125 ÷ 4 → 31）
        const frameWidth = width % declaredWidth === 0 ? declaredWidth : Math.round(width / columns);
        const frameHeight = height % declaredHeight === 0 ? declaredHeight : Math.round(height / rows);

        if (frameWidth < 1 || frameHeight < 1) return null;
        return { frameWidth, frameHeight };
    }

    /**
     * 异步加载动画
     */
    async loadAnimations(animationConfigs) {
        const resourceManager = ResourceManager.getInstance();
        
        for (const config of animationConfigs) {
            try {
                const spriteSheet = await resourceManager.loadImage(config.resourcePath);

                // 精灵图规格校验：缺图 / 尺寸不符时跳过（相关表现由程序化替代）；
                // 尺寸达标但非整数倍时按均分尺寸切帧（见 resolveFrameSpec）
                const frameSpec = Player.resolveFrameSpec(spriteSheet, config);
                if (!frameSpec) {
                    console.warn(`[Player] 动画精灵图缺失或尺寸不符，已跳过: ${config.name}`
                        + `（缺图时该动作使用程序化表现）`);
                    continue;
                }
                if (frameSpec.frameWidth !== config.frameWidth || frameSpec.frameHeight !== config.frameHeight) {
                    console.info(`[Player] 动画 ${config.name} 图集非整数倍切帧：`
                        + `${frameSpec.frameWidth}×${frameSpec.frameHeight}（声明 ${config.frameWidth}×${config.frameHeight}）`);
                }

                const animation = new Animation({
                    name: config.name,
                    spriteSheet: spriteSheet,
                    frameWidth: frameSpec.frameWidth,
                    frameHeight: frameSpec.frameHeight,
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
        // 灵息自然恢复（默认每秒 2 点；数值见 GameConfig.combat.manaRegen）
        this.updateManaRegen(deltaTime);

        // 更新攻击状态
        this.updateAttack(deltaTime);

        // 更新受伤僵直 / 闪红（受伤动画期间禁止一切玩家行为输入）
        this.updateHurtState(deltaTime);
        
        // 处理移动（闪避时由 performDodge 控制冲刺，不响应常规移动输入；受伤僵直期间禁止移动）
        if (!this.isAttacking && !this.isInteracting && !this.isInBattle && !this.isDodging
            && !this.isHurtLocked) {
            this.updateMovement(deltaTime, input, map);
        } else if (this.isDodging) {
            // 闪避中保持velocity方向，应用碰撞
            const newX = this.position.x + this.velocity.x * deltaTime;
            const newY = this.position.y + this.velocity.y * deltaTime;
            this.moveWithCollision(newX, newY, map);
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

        // 更新闪避
        if (this.isDodging) {
            this.dodgeTimer -= deltaTime;
            if (this.dodgeTimer <= 0) {
                this.isDodging = false;
                this.isInvincible = false;
                this.invincibleTimer = 0;
            }
        }
        if (this.dodgeCooldown > 0) {
            this.dodgeCooldown -= deltaTime;
        }

        // 更新任务系统
        this.questSystem.update(deltaTime);
        
        // 更新游戏时间统计
        this.playerData.updatePlayTime(deltaTime);
    }
    /**
     * 灵息自然恢复：按当前境界分档，每 interval 秒恢复 amount 点
     *   练气 每 1 秒 2 点 → 筑基 每 1 秒 4 点 → 结丹（及以后）每 1 秒 10 点
     * - 不看移动 / 普攻 / 闪避，也不受教学或战斗状态影响，只要活着就恢复；
     * - 灵息已满时把累计计时清零（不做溢出储存），避免满值后白攒出一发；
     * - 数值来源：GameConfig.combat.manaRegen.byRealm[当前境界]（缺档时回落到顶层 1 秒 2 点）；
     * - 气血不自然恢复（只有丹药 / 剧情回复，见 Player.heal）。
     * @param {number} deltaTime - 时间增量（秒）
     */
    updateManaRegen(deltaTime) {
        if (!this.isAlive || !this.playerData) return;

        const gameConfig = GameConfig.getInstance();
        const regen = (typeof gameConfig.get === 'function' && gameConfig.get('combat.manaRegen')) || {};
        // 按境界取档（练气 1 秒 2 点 / 筑基 1 秒 4 点 / 结丹 1 秒 10 点），缺档回落顶层兜底值
        const realmId = (this.playerData && this.playerData.realm) || 'lianqi';
        const entry = (regen.byRealm && regen.byRealm[realmId]) || regen;
        const interval = entry.interval > 0 ? entry.interval : 1;
        const amount = entry.amount > 0 ? entry.amount : 2;

        const data = this.playerData;
        if (data.mana >= data.maxMana) {
            this.manaRegenTimer = 0;
            return;
        }

        this.manaRegenTimer = (this.manaRegenTimer || 0) + deltaTime;
        while (this.manaRegenTimer >= interval) {
            this.manaRegenTimer -= interval;
            data.mana = Math.min(data.maxMana, data.mana + amount);
            if (data.mana >= data.maxMana) {
                this.manaRegenTimer = 0;
                break;
            }
        }
    }

    /**
     * 更新移动
     */
    updateMovement(deltaTime, input, map) {
        // 当 movementBlocked 被设置时(如任务栏打开)，不响应移动输入
        if (input.movementBlocked) {
            this.isMoving = false;
            this.velocity.x = 0;
            this.velocity.y = 0;
            return;
        }

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
     * 分轴推进：先用“新的 x + 当前 y”试走 X 轴，再用“更新后的 x + 新的 y”试走 Y 轴，
     * 任一轴被挡只停下该轴（贴墙滑动）。
     * 碰撞盒取自 getCollisionRect（collisionWidth × collisionHeight，见构造函数说明）。
     */
    moveWithCollision(newX, newY, map) {
        if (!map) {
            this.position.x = newX;
            this.position.y = newY;
            return;
        }
        
        // X 轴
        if (!this.checkCollision(this.getCollisionRect(newX, this.position.y), map)) {
            this.position.x = newX;
        }
        
        // Y 轴
        if (!this.checkCollision(this.getCollisionRect(this.position.x, newY), map)) {
            this.position.y = newY;
        }
    }

    /**
     * 生成移动碰撞盒（以给定位置为中心）
     * 玩家 position 是精灵中心，故碰撞盒也以它为中心；尺寸取 collisionWidth / collisionHeight
     * （故意小于瓦片边长，理由见构造函数里的注释）。
     * @param {number} [x] - 碰撞盒中心的 x（省略时用当前位置）
     * @param {number} [y] - 碰撞盒中心的 y（省略时用当前位置）
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getCollisionRect(x, y) {
        const centerX = (x === undefined) ? this.position.x : x;
        const centerY = (y === undefined) ? this.position.y : y;
        return {
            x: centerX - this.collisionWidth / 2,
            y: centerY - this.collisionHeight / 2,
            width: this.collisionWidth,
            height: this.collisionHeight,
        };
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
     * 更新受伤僵直与闪红
     * 受伤动画播放期间禁止一切和玩家行为有关的按键输入（移动 / 攻击 / 技能）
     * @param {number} deltaTime
     */
    updateHurtState(deltaTime) {
        if (this.hurtTimer > 0) {
            this.hurtTimer = Math.max(0, this.hurtTimer - deltaTime);
            if (this.hurtTimer === 0 && this.isHurtLocked) {
                this.isHurtLocked = false;
                if (this.isAlive && !this.isCastingSkill) {
                    this.playIdleAnimation();
                }
            }
        }

        if (this.hurtFlashTimer > 0) {
            this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - deltaTime);
        }
    }

    /**
     * 播放受伤表现
     * - 有受伤图集（4 行 下/左/右/上 × 4 帧）：播放受伤动画并进入僵直
     * - 缺图时：仅闪红 + 僵直（避免把占位图当角色绘制）
     * @param {number} duration - 僵直时长（秒）
     */
    playHurtAnimation(duration) {
        const lockDuration = duration > 0 ? duration : 0.5;

        this.isHurtLocked = true;
        this.hurtTimer = Math.max(this.hurtTimer, lockDuration);
        this.isMoving = false;
        this.velocity = { x: 0, y: 0 };

        if (this.animationManager.hasAnimation('hurt')) {
            // 有受伤图集：播放受伤动画（不再叠加程序化闪红，避免红圈盖住动画）
            this.animationManager.play('hurt', {
                reset: true,
                loop: false,
                direction: this.facing,
            });
        } else {
            // 缺图时的程序化替代表现：闪红（由 render 绘制）
            this.hurtFlashTimer = Math.max(this.hurtFlashTimer, Math.min(0.35, lockDuration));
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
        
        const nearbySignposts = map.getSignpostsNearby ? map.getSignpostsNearby(this.position, this.interactionRadius) : [];
        this.nearbySignpost = nearbySignposts.length > 0 ? nearbySignposts[0] : null;

        // 调查点（镇风桩 / 破损运灯箱等；仅当当前任务步骤要求调查该对象时才会被检出）
        const nearbyWindPiles = map.getWindPilesNearby ? map.getWindPilesNearby(this.position, this.interactionRadius) : [];
        this.nearbyWindPile = nearbyWindPiles.length > 0 ? nearbyWindPiles[0] : null;

        const nearbyMonsters = map.getMonstersNearby(this.position, this.interactionRadius);
        this.nearbyMonster = nearbyMonsters.length > 0 ? nearbyMonsters[0] : null;

        const nearbyTeleporters = map.getTeleportersNearby ? map.getTeleportersNearby(this.position, this.interactionRadius) : [];
        this.nearbyTeleportArray = nearbyTeleporters.length > 0 ? nearbyTeleporters[0] : null;

        const nearbyPickups = map.getPickupItemsNearby ? map.getPickupItemsNearby(this.position, this.interactionRadius) : [];
        this.nearbyPickupItem = nearbyPickups.length > 0 ? nearbyPickups[0] : null;
    }

    /**
     * 更新动画
     * 通过 setDirection 切换方向
     */
    updateAnimation(deltaTime) {
        if (this.isAttacking) {
            // 攻击动画由 performAttack 控制
        } else if (this.isCastingSkill) {
            // 施法动画（灵息弹）由 PlayerCombatSystem 控制
        } else if (!this.isAlive) {
            if (this.animationManager.hasAnimation('dead')) {
                this.animationManager.play('dead', { reset: false, loop: false });
            }
        } else if (this.isHurtLocked) {
            // 受伤僵直：动画由 playHurtAnimation 播放，这里不覆盖（不切换动作）
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
        
        // 播放攻击动画（缺图时跳过，依靠 attackTimer 结束攻击状态）
        if (this.animationManager.hasAnimation('attack')) {
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
        }
        
        this.executeAttack();
        return true;
    }

    /**
     * 执行闪避
     * 向当前移动方向快速冲刺，期间无敌
     */
    performDodge() {
        if (this.isDodging || this.dodgeCooldown > 0 || !this.isAlive || this.isInteracting) {
            return false;
        }

        this.isDodging = true;
        this.dodgeTimer = this.dodgeDuration;
        this.dodgeCooldown = 1.0; // 1秒冷却

        // 向当前方向冲刺
        const dirX = this.moveDirection.x || 0;
        const dirY = this.moveDirection.y || 0;

        // 如果没有移动方向，默认为朝向方向
        const dodgeVecX = dirX !== 0 ? dirX : (this.facing === 'right' ? 1 : this.facing === 'left' ? -1 : 0);
        const dodgeVecY = dirY !== 0 ? dirY : (this.facing === 'down' ? 1 : this.facing === 'up' ? -1 : 0);

        // 归一化
        const len = Math.sqrt(dodgeVecX * dodgeVecX + dodgeVecY * dodgeVecY);
        if (len > 0) {
            this.velocity.x = (dodgeVecX / len) * this.dodgeSpeed;
            this.velocity.y = (dodgeVecY / len) * this.dodgeSpeed;
        }

        // 闪避时无敌
        this.isInvincible = true;
        this.invincibleTimer = this.dodgeDuration;

        // 播放闪避动画（尝试播放skill动画作为闪避效果）
        this.animationManager.play('skill', { reset: true, loop: false, direction: this.facing });

        console.log('[Player] 闪避');
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
        
        const combatSystem = this.combatSystem;

        // 护体术减伤（先按增益折算，再走职业/防御结算）
        const incomingMultiplier = combatSystem && typeof combatSystem.getIncomingDamageMultiplier === 'function'
            ? combatSystem.getIncomingDamageMultiplier()
            : 1;
        const actualDamage = this.professionSystem.calculateDamageTaken(damage * incomingMultiplier);
        this.playerData.health -= actualDamage;

        // 受伤音效：每次受伤都播一次；若受伤音效正在播放，则这一次不播（不叠加）
        // （音频键与文件路径见 ResourceManager → assets/audio/sfx/player_hurt.mp3；
        //   文件缺失时 AudioManager 静默跳过）
        gameAudio.playSfxExclusive('sfx.player_hurt');

        // 受伤表现：护体术 / 闪避期间不播放受伤动画（也不进入受伤僵直）；
        // 施法（灵息弹攻击动画）中受伤 → 终止施法、冷却重置、不消耗灵息
        if (combatSystem && typeof combatSystem.onPlayerHurt === 'function') {
            const result = combatSystem.onPlayerHurt();
            if (result.playHurtAnimation) {
                this.playHurtAnimation(result.lockDuration);
            } else {
                this.hurtFlashTimer = Math.max(this.hurtFlashTimer, 0.18);
            }
        } else {
            this.playHurtAnimation(0.5);
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
            // Boss 战败成长：累计加成叠加在境界基准值之上（无战败成长时等于基准值），
            // 并按新上限回满气血 / 灵息（与境界突破同一语义）
            this.playerData.maxHealth += this.playerData.maxHealthBonus || 0;
            this.playerData.maxMana += this.playerData.maxManaBonus || 0;
            this.playerData.health = this.playerData.maxHealth;
            this.playerData.mana = this.playerData.maxMana;
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

        // 受伤闪红（无受伤图集时的主要表现；护体术 / 闪避期间受伤也短暂闪红但不僵直）
        // 有受伤动画时不叠加闪红，避免红色椭圆盖住受伤动画
        const hurtAnimationPlaying = this.isHurtLocked
            && this.animationManager.hasAnimation('hurt')
            && this.animationManager.currentAnimationName === 'hurt';
        if (this.hurtFlashTimer > 0 && !hurtAnimationPlaying) {
            ctx.save();
            ctx.globalAlpha = Math.min(0.5, this.hurtFlashTimer * 1.6);
            ctx.fillStyle = '#ff3b3b';
            ctx.beginPath();
            ctx.ellipse(
                screenX + this.width,
                screenY + this.height,
                this.width,
                this.height,
                0, 0, Math.PI * 2
            );
            ctx.fill();
            ctx.restore();
        }
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