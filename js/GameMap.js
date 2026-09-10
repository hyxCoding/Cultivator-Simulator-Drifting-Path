

/**
 * 地图类（完整修正版）
 * 只负责背景渲染、场景动画和碰撞数据查询
 * 不负责实体（玩家、NPC、怪物）的更新和渲染
 * 实体更新由 GameLoop 统一调度
 */
class GameMap {
    /**
     * @param {string} mapId - 地图ID
     * @param {Object} mapConfig - 地图配置数据
     * @param {Object} mapResources - 地图资源 {backgroundImage, collisionImage}
     */
    constructor(mapId, mapConfig, mapResources) {
        this.mapId = mapId;
        this.mapConfig = mapConfig;
        this.name = mapConfig.name || mapId;
        
        // 地图资源
        this.backgroundImage = mapResources.backgroundImage || null;
        this.collisionImage = mapResources.collisionImage || null;
        
        // 瓦片系统
        this.tileSize = mapConfig.tileSize || 32;
        this.mapWidth = mapConfig.mapWidth || 50;
        this.mapHeight = mapConfig.mapHeight || 40;
        this.tileSystem = new TileSystem(
            this.tileSize,
            this.mapWidth,
            this.mapHeight,
            this.collisionImage
        );
        
        // 实体容器（由 GameLoop 遍历更新，地图只负责存储）
        this.player = null;       // 玩家引用
        this.npcs = new Map();    // NPC实例 {id: npcInstance}
        this.monsters = new Map(); // 怪物实例 {id: monsterInstance}
        this.teleporters = new Map(); // 传送法阵实例 {id: TeleportArray}
        this.pickupItems = new Map(); // 可拾取物品 {id: PickupItem}
        this.signposts = new Map();   // 路标 {id: Signpost}
        
        // 地图入口点
        this.entryPoint = mapConfig.entryPoint || { x: 0, y: 0 };
        
        // 地图状态
        this.isActive = false;       // 是否为当前活动地图
        this.isInitialized = false;  // 是否已初始化
        
        // === 场景动画相关 ===
        this.sceneAnimations = [];  // 场景动画实例列表
        this.sceneParticles = [];   // 场景粒子列表（落叶、飘絮等）
        this.ambientEffects = [];   // 环境特效列表（雾气、光晕等）
        
        // === 场景动画配置 ===
        this.ambientConfig = {
            // 粒子系统配置
            fallingLeaves: {
                enabled: true,
                spawnRate: 0.5,      // 每秒生成数量
                maxCount: 30,        // 最大粒子数
                spawnArea: { x: 0, y: 0, width: 0, height: 0 }, // 生成区域（默认整个地图）
            },
            // 雾气效果
            fog: {
                enabled: false,
                opacity: 0.3,
                color: 'rgba(255, 255, 255, 0.3)',
                speed: 0.02,
            },
        };
    }

    /**
     * 初始化地图
     * 创建NPC和怪物实例的占位数据
     * 实际NPC和怪物实例由外部创建后通过 addNPC / addMonster 添加
     */
    init() {
        if (this.isInitialized) return;
        
        // 初始化场景动画系统
        this.initSceneAnimations();
        
        // 初始化NPC（从 GameConfig 创建完整实例）
        if (this.mapConfig.npcPositions) {
            for (const npcId in this.mapConfig.npcPositions) {
                const npcPosition = this.mapConfig.npcPositions[npcId];
                const worldPosition = this.tileToWorld(npcPosition.x, npcPosition.y);
                
                // 从 GameConfig 获取 NPC 完整配置（通过 ChapterLoader 注册的数据）
                const gameConfig = GameConfig.getInstance();
                const npcConfig = gameConfig.getNPCConfig ? gameConfig.getNPCConfig(npcId) : null;
                
                if (npcConfig) {
                    // 创建完整 NPC 实例
                    const npc = new NPC({
                        id: npcId,
                        name: npcConfig.name || npcId,
                        position: worldPosition,
                        moveSpeed: npcConfig.moveSpeed || 80,
                        isStatic: npcConfig.isStatic || false,
                        dialogues: npcConfig.dialogues || {},
                        assignedQuests: npcConfig.assignedQuests || [],
                        patrolPoints: npcConfig.patrolPoints || [],
                        shopItems: npcConfig.shopItems || [],
                        extraAnimations: npcConfig.extraAnimations || [],
                        initialNpcState: npcConfig.initialNpcState || {},
                        baseAnimations: npcConfig.baseAnimations || {},
                    });
                    
                    this.npcs.set(npcId, npc);
                } else {
                    // 配置不存在时，保留占位数据（防止报错）
                    console.warn(`NPC配置不存在: ${npcId}，使用占位数据`);
                    this.npcs.set(npcId, {
                        id: npcId,
                        position: worldPosition,
                        tilePosition: { x: npcPosition.x, y: npcPosition.y },
                    });
                }
            }
        }
        
        // 初始化普通怪物实例
        if (this.mapConfig.monsterPositions) {
            for (const monsterKey in this.mapConfig.monsterPositions) {
                const monsterPosition = this.mapConfig.monsterPositions[monsterKey];
                const worldPosition = this.tileToWorld(monsterPosition.x, monsterPosition.y);

                const monster = new Monster({
                    id: monsterKey,
                    monsterId: monsterPosition.monsterId,
                    position: worldPosition,
                });

                monster.tilePosition = { x: monsterPosition.x, y: monsterPosition.y };
                monster.isBoss = false;
                this.monsters.set(monsterKey, monster);
            }
        }
        
        // 初始化Boss实例
        if (this.mapConfig.bossPosition) {
            for (const bossKey in this.mapConfig.bossPosition) {
                const bossPosition = this.mapConfig.bossPosition[bossKey];
                const worldPosition = this.tileToWorld(bossPosition.x, bossPosition.y);

                const boss = new Boss({
                    id: bossKey,
                    monsterId: bossPosition.monsterId,
                    position: worldPosition,
                });

                boss.tilePosition = { x: bossPosition.x, y: bossPosition.y };
                boss.isBoss = true;
                this.monsters.set(bossKey, boss);
            }
        }

        // 初始化传送法阵
        if (this.mapConfig.teleporters) {
            for (const teleportKey in this.mapConfig.teleporters) {
                const teleportConfig = this.mapConfig.teleporters[teleportKey];
                const worldPosition = this.tileToWorld(teleportConfig.position.x, teleportConfig.position.y);

                const teleport = new TeleportArray({
                    id: teleportConfig.id || teleportKey,
                    name: teleportConfig.name || '传送法阵',
                    position: worldPosition,
                    radius: teleportConfig.radius || 60,
                    targetMapId: teleportConfig.targetMapId,
                    targetPosition: teleportConfig.targetPosition || this.getEntryWorldPosition(),
                    promptText: teleportConfig.promptText || '按 E 传送',
                    color: teleportConfig.color || 'rgba(120, 200, 255, 0.9)',
                    glowColor: teleportConfig.glowColor || 'rgba(120, 200, 255, 0.4)',
                });

                this.teleporters.set(teleport.id, teleport);
            }
        }

        // 初始化路标（使用世界坐标，无需 tileToWorld 转换）
        if (this.mapConfig.signposts) {
            for (const signpostKey in this.mapConfig.signposts) {
                const signpostConfig = this.mapConfig.signposts[signpostKey];

                const signpost = new Signpost({
                    id: signpostConfig.id || signpostKey,
                    name: signpostConfig.name || '路标',
                    position: signpostConfig.position || { x: 0, y: 0 },
                    radius: signpostConfig.radius || 40,
                    promptText: signpostConfig.promptText || '开始交互',
                    image: signpostConfig.image || null,
                    imageWidth: signpostConfig.imageWidth || null,
                    imageHeight: signpostConfig.imageHeight || null,
                    questRequired: signpostConfig.questRequired || null,
                    gameId: signpostConfig.gameId || null,
                    oneShot: signpostConfig.oneShot ?? false,
                });

                this.signposts.set(signpost.id, signpost);
            }
        }

        this.isInitialized = true;
    }

    /**
     * 初始化场景动画系统
     */
    initSceneAnimations() {
        // 根据地图类型初始化不同的场景动画
        const mapName = this.mapConfig.name || '';
        
        // 青岚浮野：落叶效果
        if (mapName.includes('青岚') || this.mapId === 'qinglan_fuye') {
            this.ambientConfig.fallingLeaves.enabled = true;
            this.ambientConfig.fallingLeaves.spawnRate = 0.8;
            this.ambientConfig.fallingLeaves.maxCount = 40;
        }
        
        // 云渡泽：雾气效果
        if (mapName.includes('云渡') || this.mapId === 'yunduze') {
            this.ambientConfig.fog.enabled = true;
            this.ambientConfig.fog.opacity = 0.4;
        }
        
        // 设置粒子生成区域
        if (this.backgroundImage) {
            this.ambientConfig.fallingLeaves.spawnArea = {
                x: 0,
                y: 0,
                width: this.backgroundImage.width,
                height: this.backgroundImage.height,
            };
        } else {
            this.ambientConfig.fallingLeaves.spawnArea = {
                x: 0,
                y: 0,
                width: this.mapWidth * this.tileSize,
                height: this.mapHeight * this.tileSize,
            };
        }
    }

    /**
     * 设置玩家引用
     * @param {Object} player - 玩家实例
     */
    setPlayer(player) {
        this.player = player;
        if (player && !player.position) {
            player.position = this.getEntryWorldPosition();
        }
        
        // ====== 任务完成回调已迁移至 Main.setupQuestCallbacks() ======
        // 原因：Main 统一管理避免多地图重复注册
    }

    /**
     * 添加NPC实例
     * @param {string} npcId - NPC ID
     * @param {Object} npcInstance - NPC实例
     */
    addNPC(npcId, npcInstance) {
        this.npcs.set(npcId, npcInstance);
    }

    /**
     * 移除NPC
     * @param {string} npcId - NPC ID
     */
    removeNPC(npcId) {
        this.npcs.delete(npcId);
    }

    /**
     * 添加怪物实例
     * @param {string} monsterKey - 怪物键值
     * @param {Object} monsterInstance - 怪物实例
     */
    addMonster(monsterKey, monsterInstance) {
        this.monsters.set(monsterKey, monsterInstance);
    }

    /**
     * 添加传送法阵实例
     * @param {string} teleportKey - 法阵键值
     * @param {TeleportArray} teleportInstance - 法阵实例
     */
    addTeleport(teleportKey, teleportInstance) {
        this.teleporters.set(teleportKey, teleportInstance);
    }

    /**
     * 添加可拾取物品
     * @param {PickupItem} pickupItem
     */
    addPickupItem(pickupItem) {
        this.pickupItems.set(pickupItem.id, pickupItem);
    }

    /**
     * 移除可拾取物品
     * @param {string} pickupId
     */
    removePickupItem(pickupId) {
        this.pickupItems.delete(pickupId);
    }

    /**
     * 获取附近的可拾取物品
     * @param {Object} position - {x, y}
     * @param {number} radius - 检测半径
     * @returns {PickupItem[]}
     */
    getPickupItemsNearby(position, radius) {
        const nearby = [];
        for (const [, item] of this.pickupItems) {
            if (item.isPlayerInRange(position)) {
                nearby.push(item);
            }
        }
        return nearby;
    }

    /**
     * 移除怪物（死亡后）
     * @param {string} monsterKey - 怪物键值
     */
    removeMonster(monsterKey) {
        this.monsters.delete(monsterKey);
    }

    /**
     * 更新场景动画
     * 只处理地图本身的环境动画，如落叶、水流、飘动的旗帜等
     * @param {number} deltaTime - 时间增量（秒）
     */
    updateSceneAnimations(deltaTime) {
        if (!this.isActive) return;
        
        // 更新粒子生成
        this.updateParticleSpawning(deltaTime);
        
        // 更新场景粒子
        this.sceneParticles.forEach(particle => {
            if (particle.update) {
                particle.update(deltaTime);
            }
        });
        
        // 更新环境特效
        this.ambientEffects.forEach(effect => {
            if (effect.update) {
                effect.update(deltaTime);
            }
        });
        
        // 更新场景动画实例
        this.sceneAnimations.forEach(animation => {
            if (animation.update) {
                animation.update(deltaTime);
            }
        });
        
        // 清理失效的粒子
        this.cleanupParticles();
    }

    /**
     * 更新粒子生成
     * @param {number} deltaTime - 时间增量（秒）
     */
    updateParticleSpawning(deltaTime) {
        const config = this.ambientConfig.fallingLeaves;
        if (!config.enabled) return;
        
        // 检查粒子数量
        if (this.sceneParticles.length >= config.maxCount) return;
        
        // 根据生成率生成新粒子
        const spawnCount = config.spawnRate * deltaTime;
        let actualSpawn = Math.floor(spawnCount);
        
        // 处理小数部分（概率生成）
        if (Math.random() < spawnCount - actualSpawn) {
            actualSpawn++;
        }
        
        for (let i = 0; i < actualSpawn; i++) {
            if (this.sceneParticles.length >= config.maxCount) break;
            this.spawnFallingLeaf();
        }
    }

    /**
     * 生成一片落叶粒子
     */
    spawnFallingLeaf() {
        const spawnArea = this.ambientConfig.fallingLeaves.spawnArea;
        
        const particle = {
            x: spawnArea.x + Math.random() * spawnArea.width,
            y: spawnArea.y - 20, // 从顶部生成
            velocityX: -20 + Math.random() * 40, // 水平飘动速度
            velocityY: 30 + Math.random() * 50,   // 下落速度
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: -1 + Math.random() * 2,
            size: 4 + Math.random() * 6,
            alpha: 0.6 + Math.random() * 0.4,
            color: `rgba(180, 200, 160, ${0.6 + Math.random() * 0.4})`,
            isAlive: true,
            
            update: function(deltaTime) {
                this.x += this.velocityX * deltaTime;
                this.y += this.velocityY * deltaTime;
                this.rotation += this.rotationSpeed * deltaTime;
                
                // 飘动效果
                this.x += Math.sin(this.y * 0.01) * 20 * deltaTime;
                
                // 超出地图范围则标记为死亡
                if (this.y > spawnArea.y + spawnArea.height + 50) {
                    this.isAlive = false;
                }
            },
            
            render: function(ctx, renderPos) {
                ctx.save();
                ctx.globalAlpha = this.alpha;
                ctx.fillStyle = this.color;
                ctx.translate(this.x - renderPos.x, this.y - renderPos.y);
                ctx.rotate(this.rotation);
                ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
                ctx.restore();
            },
        };
        
        this.sceneParticles.push(particle);
    }

    /**
     * 清理失效的粒子
     */
    cleanupParticles() {
        this.sceneParticles = this.sceneParticles.filter(particle => {
            return particle.isAlive !== false;
        });
    }

    /**
     * 添加场景粒子
     * @param {Object} particle - 粒子实例
     */
    addSceneParticle(particle) {
        this.sceneParticles.push(particle);
    }

    /**
     * 添加环境特效
     * @param {Object} effect - 特效实例
     */
    addAmbientEffect(effect) {
        this.ambientEffects.push(effect);
    }

    /**
     * 添加场景动画
     * @param {Object} animation - 动画实例
     */
    addSceneAnimation(animation) {
        this.sceneAnimations.push(animation);
    }

    /**
     * 渲染地图
     * 只渲染背景、场景动画和环境特效，不渲染实体
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {Object} camera - 摄像机实例
     */
    render(ctx, camera) {
        if (!this.isActive) return;
        
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        
        // 1. 渲染背景图
        if (this.backgroundImage) {
            ctx.drawImage(
                this.backgroundImage,
                renderPos.x,
                renderPos.y,
                camera ? camera.width : this.backgroundImage.width,
                camera ? camera.height : this.backgroundImage.height,
                0,
                0,
                camera ? camera.width : this.backgroundImage.width,
                camera ? camera.height : this.backgroundImage.height
            );
        }
        
        // 2. 渲染环境特效（在粒子下方）
        this.renderAmbientEffects(ctx, renderPos);
        
        // 3. 渲染场景粒子
        this.sceneParticles.forEach(particle => {
            if (particle.render) {
                particle.render(ctx, renderPos);
            }
        });
        
        // 4. 渲染场景动画
        this.sceneAnimations.forEach(animation => {
            if (animation.render) {
                animation.render(ctx, renderPos);
            }
        });

        // 5. 渲染地图中的法阵（地图本身不做实体渲染，但法阵属于环境交互对象）
        if (this.teleporters) {
            this.teleporters.forEach(teleport => {
                if (teleport && teleport.render) {
                    teleport.render(ctx, camera);
                }
            });
        }

        // 6. 渲染可拾取物品（环境交互对象）
        if (this.pickupItems) {
            this.pickupItems.forEach(pickup => {
                if (pickup && pickup.render) {
                    pickup.render(ctx, camera);
                }
            });
        }

        // 7. 渲染路标（环境交互对象）
        if (this.signposts) {
            this.signposts.forEach(signpost => {
                if (signpost && signpost.render) {
                    signpost.render(ctx, camera);
                }
            });
        }

        // 注意：不渲染NPC、怪物、玩家
        // 这些由 GameLoop 统一调度渲染
    }

    /**
     * 渲染环境特效
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {Object} renderPos - 渲染位置
     */
    renderAmbientEffects(ctx, renderPos) {
        // 渲染雾气效果
        if (this.ambientConfig.fog.enabled) {
            const fog = this.ambientConfig.fog;
            ctx.save();
            ctx.fillStyle = fog.color;
            ctx.globalAlpha = fog.opacity;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
        
        // 渲染其他环境特效
        this.ambientEffects.forEach(effect => {
            if (effect.render) {
                effect.render(ctx, renderPos);
            }
        });
    }

    /**
     * 激活地图
     */
    activate() {
        this.isActive = true;
    }

    /**
     * 停用地图
     */
    deactivate() {
        this.isActive = false;
    }

    /**
     * 瓦片坐标转世界坐标
     * @param {number} tileX - 瓦片x索引
     * @param {number} tileY - 瓦片y索引
     * @returns {Object} 世界坐标 {x, y}
     */
    tileToWorld(tileX, tileY) {
        return {
            x: tileX * this.tileSize + this.tileSize / 2,
            y: tileY * this.tileSize + this.tileSize / 2,
        };
    }

    /**
     * 世界坐标转瓦片坐标
     * @param {number} worldX - 世界x坐标
     * @param {number} worldY - 世界y坐标
     * @returns {Object} 瓦片坐标 {x, y}
     */
    worldToTile(worldX, worldY) {
        return {
            x: Math.floor(worldX / this.tileSize),
            y: Math.floor(worldY / this.tileSize),
        };
    }

    /**
     * 获取入口世界坐标
     * @returns {Object} 世界坐标 {x, y}
     */
    getEntryWorldPosition() {
        return this.tileToWorld(this.entryPoint.x, this.entryPoint.y);
    }

    /**
     * 检查指定像素位置是否可达
     * @param {number} pixelX - 像素x坐标
     * @param {number} pixelY - 像素y坐标
     * @returns {boolean} 是否可达
     */
    isPositionWalkable(pixelX, pixelY) {
        const tileIndex = this.tileSystem.getTileIndexFromPixel(pixelX, pixelY);
        return this.tileSystem.isTileWalkable(tileIndex.x, tileIndex.y);
    }

    /**
     * 检查矩形区域是否可达
     * @param {Object} rect - 矩形 {x, y, width, height}
     * @returns {boolean} 是否可达
     */
    isRectWalkable(rect) {
        // 检查矩形的四个角
        const corners = [
            { x: rect.x, y: rect.y },
            { x: rect.x + rect.width, y: rect.y },
            { x: rect.x, y: rect.y + rect.height },
            { x: rect.x + rect.width, y: rect.y + rect.height }
        ];
        
        for (const corner of corners) {
            if (!this.isPositionWalkable(corner.x, corner.y)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * 获取NPC列表
     * @returns {Map} NPC实例Map
     */
    getNPCs() {
        return this.npcs;
    }

    /**
     * 获取指定NPC
     * @param {string} npcId - NPC ID
     * @returns {Object|null} NPC实例
     */
    getNPC(npcId) {
        return this.npcs.get(npcId) || null;
    }

    /**
     * 获取怪物列表
     * @returns {Map} 怪物实例Map
     */
    getMonsters() {
        return this.monsters;
    }

    /**
     * 获取指定怪物
     * @param {string} monsterKey - 怪物键值
     * @returns {Object|null} 怪物实例
     */
    getMonster(monsterKey) {
        return this.monsters.get(monsterKey) || null;
    }

    /**
     * 获取地图的瓦片系统
     * @returns {TileSystem} 瓦片系统实例
     */
    getTileSystem() {
        return this.tileSystem;
    }

    /**
     * 获取地图数据（用于A*寻路）
     * @returns {Array} 二维数组，true=可达，false=不可达
     */
    getWalkableGrid() {
        return this.tileSystem.getWalkableGrid();
    }

    /**
     * 获取玩家附近的NPC
     * @param {Object} position - 玩家位置 {x, y}
     * @param {number} radius - 搜索半径（像素）
     * @returns {Array} NPC列表
     */
    getNPCsNearby(position, radius) {
        const nearbyNPCs = [];
        
        this.npcs.forEach(npc => {
            if (!npc.position) return;
            const distance = Math.sqrt(
                Math.pow(npc.position.x - position.x, 2) +
                Math.pow(npc.position.y - position.y, 2)
            );
            if (distance <= radius) {
                nearbyNPCs.push(npc);
            }
        });
        
        return nearbyNPCs;
    }

    /**
     * 获取玩家附近的怪物
     * @param {Object} position - 玩家位置 {x, y}
     * @param {number} radius - 搜索半径（像素）
     * @returns {Array} 怪物列表
     */
    getMonstersNearby(position, radius) {
        const nearbyMonsters = [];
        
        this.monsters.forEach(monster => {
            if (!monster.position) return;
            const distance = Math.sqrt(
                Math.pow(monster.position.x - position.x, 2) +
                Math.pow(monster.position.y - position.y, 2)
            );
            if (distance <= radius) {
                nearbyMonsters.push(monster);
            }
        });
        
        return nearbyMonsters;
    }

    /**
     * 获取玩家附近的传送法阵
     * @param {Object} position - 玩家位置 {x, y}
     * @param {number} radius - 搜索半径（像素）
     * @returns {Array} 传送法阵列表
     */
    getTeleportersNearby(position, radius) {
        const nearbyTeleporters = [];

        this.teleporters.forEach(teleport => {
            if (!teleport || !teleport.position) return;
            const distance = Math.sqrt(
                Math.pow(teleport.position.x - position.x, 2) +
                Math.pow(teleport.position.y - position.y, 2)
            );
            if (distance <= radius) {
                nearbyTeleporters.push(teleport);
            }
        });

        return nearbyTeleporters;
    }

    /**
     * 获取玩家附近的路标
     * @param {Object} position - {x, y}
     * @param {number} radius - 搜索半径
     * @returns {Array} 路标列表
     */
    getSignpostsNearby(position, radius) {
        const nearby = [];
        this.signposts.forEach(signpost => {
            if (signpost && signpost.isActive && signpost.isPlayerInRange(position)) {
                nearby.push(signpost);
            }
        });
        return nearby;
    }

    /**
     * 序列化地图状态（用于存档）
     * @returns {Object} 序列化数据
     */
    serialize() {
        return {
            mapId: this.mapId,
            isActive: this.isActive,
            isInitialized: this.isInitialized,
            tileSystem: this.tileSystem.serialize(),
            
            // 场景动画状态
            ambientConfig: JSON.parse(JSON.stringify(this.ambientConfig)),
            sceneParticles: this.sceneParticles.map(p => ({
                x: p.x,
                y: p.y,
                isAlive: p.isAlive,
            })),
            
            // 实体状态（由各自的类负责序列化）
            playerState: this.player && this.player.serialize ? this.player.serialize() : null,
            
            npcStates: Array.from(this.npcs.entries()).map(([id, npc]) => ({
                id: id,
                state: npc.serialize ? npc.serialize() : null,
            })),
            
            monsterStates: Array.from(this.monsters.entries()).map(([id, monster]) => ({
                id: id,
                state: monster.serialize ? monster.serialize() : null,
            })),
        };
    }

    /**
     * 反序列化地图状态（用于读档）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        this.isActive = data.isActive || false;
        this.isInitialized = data.isInitialized || false;
        
        if (data.tileSystem) {
            this.tileSystem.deserialize(data.tileSystem);
        }
        
        if (data.ambientConfig) {
            this.ambientConfig = data.ambientConfig;
        }
        
        // 恢复玩家状态
        if (data.playerState && this.player && this.player.deserialize) {
            this.player.deserialize(data.playerState);
        }
        
        // 恢复NPC状态
        if (data.npcStates) {
            data.npcStates.forEach(npcState => {
                const npc = this.npcs.get(npcState.id);
                if (npc && npc.deserialize) {
                    npc.deserialize(npcState.state);
                }
            });
        }
        
        // 恢复怪物状态
        if (data.monsterStates) {
            data.monsterStates.forEach(monsterState => {
                const monster = this.monsters.get(monsterState.id);
                if (monster && monster.deserialize) {
                    monster.deserialize(monsterState.state);
                }
            });
        }
    }
}