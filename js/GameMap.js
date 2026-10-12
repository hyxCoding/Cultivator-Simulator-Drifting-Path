

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
        // 瓦片碰撞表：加载时从碰撞图生成（白色可通行 / 黑色不可通行）；
        // mapConfig.collisionData 是同一张碰撞图的预生成结果，仅在读不到像素时兜底
        // （见 TileSystem 说明）
        this.tileSystem = new TileSystem(
            this.tileSize,
            this.mapWidth,
            this.mapHeight,
            this.collisionImage,
            mapConfig.collisionData
        );
        
        // 实体容器（由 GameLoop 遍历更新，地图只负责存储）
        this.player = null;       // 玩家引用
        this.npcs = new Map();    // NPC实例 {id: npcInstance}
        this.monsters = new Map(); // 怪物实例 {id: monsterInstance}
        this.arenaBoss = null;     // 战场 Boss 引用（摄风山魈，主线四）
        this.arenaBossDefeated = false; // 战场 Boss 是否已被击败（击败后本图不再生成 Boss）
        this.arenaIntroLock = false;    // 战前对白期间是否冻结战场 Boss（只站桩：不移动 / 不出手）
        this.teleporters = new Map(); // 传送法阵实例 {id: TeleportArray}
        this.pickupItems = new Map(); // 可拾取物品 {id: PickupItem}
        this.signposts = new Map();   // 路标 {id: Signpost}
        this.windPiles = new Map();   // 任务门控调查点 {id: WindPile|LanternBox}（命名沿用最早的镇风桩实现）
        
        // 地图入口点
        this.entryPoint = mapConfig.entryPoint || { x: 0, y: 0 };
        
        // 地图状态
        this.isActive = false;       // 是否为当前活动地图
        this.isInitialized = false;  // 是否已初始化
        
        // === 场景动画相关 ===
        this.sceneAnimations = [];  // 场景动画实例列表
        this.sceneParticles = [];   // 通用场景粒子列表（扩展用；飘落物走 this.foliage，见 js/FallingFoliage.js）
        this.ambientEffects = [];   // 环境特效列表（雾气、光晕等）
        
        // === 场景动画配置 ===
        this.ambientConfig = {
            // 飘落物（落叶 / 落花）：图片帧动画 + 飘落轨迹，见 js/FallingFoliage.js
            // enabled 由 initSceneAnimations 按地图判定（只在前两章主图开启），
            // 地图配置 ambientConfig.fallingFoliage 可覆盖下面的参数（但不能把非主图打开）。
            // maxCount = 界面中同时存在的最大飘落物数量（调节疏密就调它）
            fallingFoliage: {
                enabled: false,
                maxCount: 18,
                spawnRate: 1.1,
                scale: 1,            // 单帧 16×16 → 显示 32×32
                leafWeight: 0.6,     // 落叶 : 落花 = 6 : 4
                flowerWeight: 0.4,
            },
            // 雾气效果
            fog: {
                enabled: false,
                opacity: 0.3,
                color: 'rgba(255, 255, 255, 0.3)',
                speed: 0.02,
            },
        };

        // 飘落物实例（落叶 / 落花；见 js/FallingFoliage.js）
        // 在 initSceneAnimations 里按地图创建并判定是否开启（只有第一 / 第二章主图）
        this.foliage = null;
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
                // 优先使用 npcWorldPositions 中声明的精确世界坐标（像素）；
                // 未声明时按 npcPositions 的瓦片坐标换算
                const exactPosition = this.mapConfig.npcWorldPositions
                    ? this.mapConfig.npcWorldPositions[npcId]
                    : null;
                const worldPosition = exactPosition
                    ? { x: exactPosition.x, y: exactPosition.y }
                    : this.tileToWorld(npcPosition.x, npcPosition.y);
                
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
                        // 显示缩放（缺省 2；第二章新美术为 2 倍像素密度，配置里写 1）
                        displayScale: npcConfig.displayScale,
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

                // 摄风山魈（主线四战场）：使用专属 AI（行为树 + 轴对齐寻路 + 打断规则）
                if (bossPosition.monsterId === 'boss_shanxiao' || bossPosition.ai === 'shanxiao') {
                    this.spawnArenaBoss(bossKey, bossPosition);
                    continue;
                }

                // 渡厄使（第二章万灯台战场）：召唤小兵 + 冲刺 + 控制（见 js/DueBoss.js）
                if (bossPosition.monsterId === 'boss_due' || bossPosition.ai === 'due') {
                    this.spawnArenaBoss(bossKey, bossPosition);
                    continue;
                }

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
        // 坐标：position 为瓦片坐标（默认，按 tileToWorld 换算）；
        //       worldPosition 为世界坐标（像素，优先，与 npcWorldPositions 约定一致）
        if (this.mapConfig.teleporters) {
            for (const teleportKey in this.mapConfig.teleporters) {
                const teleportConfig = this.mapConfig.teleporters[teleportKey];
                const worldPosition = teleportConfig.worldPosition
                    ? { x: teleportConfig.worldPosition.x, y: teleportConfig.worldPosition.y }
                    : this.tileToWorld(teleportConfig.position.x, teleportConfig.position.y);

                const teleport = new TeleportArray({
                    id: teleportConfig.id || teleportKey,
                    name: teleportConfig.name || '传送法阵',
                    position: worldPosition,
                    radius: teleportConfig.radius || 60,
                    targetMapId: teleportConfig.targetMapId,
                    targetPosition: teleportConfig.targetPosition || this.getEntryWorldPosition(),
                    promptText: teleportConfig.promptText || '按 E 进入法阵',
                    color: teleportConfig.color || 'rgba(120, 200, 255, 0.9)',
                    glowColor: teleportConfig.glowColor || 'rgba(120, 200, 255, 0.4)',
                    // 静态图片（默认 96×96）
                    image: teleportConfig.image || null,
                    imageWidth: teleportConfig.imageWidth || 96,
                    imageHeight: teleportConfig.imageHeight || 96,
                    anchor: teleportConfig.anchor || 'center',
                    // 任务门控：任务未接取时法阵不显示（由 updateQuestGate 刷新）
                    questRequired: teleportConfig.questRequired || null,
                    // 目标门控（可选）：任务接取 + 指定目标已完成，法阵才可见
                    // （例：万灯台石台法阵要先向许录取得通行凭证 —— talk_to:xulu）
                    requireObjective: teleportConfig.requireObjective || null,
                    // 战场入口（主线四：死亡/胜利后回到法阵旁）
                    bossArena: teleportConfig.bossArena === true,
                    // 战场流程参数（第二章渡厄使战场复用同一套流程；缺省回落到第一章默认值）
                    arenaDefeatFlag: teleportConfig.arenaDefeatFlag || null,
                    arenaVictory: teleportConfig.arenaVictory || null,
                    arenaResourceGroup: teleportConfig.arenaResourceGroup || null,
                    arenaReturnMapId: teleportConfig.arenaReturnMapId || null,
                    isActive: teleportConfig.isActive !== false,
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
                    // 目标门控（可选）：任务接取 + 指定目标已完成，路标才可见
                    requireObjective: signpostConfig.requireObjective || null,
                    // 开小游戏前的引导对白（可选，见 Main.handleInteraction）
                    roleplayDialogue: signpostConfig.roleplayDialogue || null,
                    gameId: signpostConfig.gameId || null,
                    oneShot: signpostConfig.oneShot ?? false,
                });

                this.signposts.set(signpost.id, signpost);
            }
        }

        // 初始化任务门控调查点（镇风桩 / 破损运灯箱等，使用世界坐标，无需 tileToWorld 转换）
        // 说明：所有调查点存进同一个注册表 this.windPiles（命名沿用最早的镇风桩实现），
        //       常驻显示，是否可调查由 Main.updateWindPileQuestGates 按任务进度刷新
        if (this.mapConfig.windPiles) {
            for (const pileKey in this.mapConfig.windPiles) {
                const pileConfig = this.mapConfig.windPiles[pileKey];

                const windPile = new WindPile({
                    id: pileConfig.id || pileKey,
                    name: pileConfig.name || '镇风桩',
                    position: pileConfig.position || { x: 0, y: 0 },
                    radius: pileConfig.radius || 56,
                    promptText: pileConfig.promptText || '调查镇风桩',
                    image: pileConfig.image || null,
                    imageWidth: pileConfig.imageWidth || 58,
                    imageHeight: pileConfig.imageHeight || 128,
                    anchor: pileConfig.anchor || 'bottom',
                    // 缺图时是否画程序化占位桩体（false → 不画“代码画的柱子”，交互照旧）
                    showPlaceholderBody: pileConfig.showPlaceholderBody,
                    questId: pileConfig.questId || null,
                    objectiveType: pileConfig.objectiveType || 'investigate',
                    objectiveTarget: pileConfig.objectiveTarget || null,
                    dialogue: pileConfig.dialogue || null,
                    // 调查完成后一并发放的剧情物品（如万灯台台后的账册 / 命令）
                    grantItems: pileConfig.grantItems || [],
                });

                this.windPiles.set(windPile.id, windPile);
            }
        }

        // 初始化破损运灯箱（LanternBox：与镇风桩共用同一套调查点逻辑与注册表）
        if (this.mapConfig.lanternBoxes) {
            for (const boxKey in this.mapConfig.lanternBoxes) {
                const boxConfig = this.mapConfig.lanternBoxes[boxKey];

                const lanternBox = new LanternBox({
                    id: boxConfig.id || boxKey,
                    name: boxConfig.name || '破损运灯箱',
                    position: boxConfig.position || { x: 0, y: 0 },
                    radius: boxConfig.radius || 60,
                    promptText: boxConfig.promptText || '调查破损运灯箱',
                    image: boxConfig.image || null,
                    imageWidth: boxConfig.imageWidth || 64,
                    imageHeight: boxConfig.imageHeight || 64,
                    anchor: boxConfig.anchor || 'center',
                    questId: boxConfig.questId || null,
                    objectiveType: boxConfig.objectiveType || 'investigate',
                    objectiveTarget: boxConfig.objectiveTarget || null,
                    dialogue: boxConfig.dialogue || null,
                });

                this.windPiles.set(lanternBox.id, lanternBox);
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
        
        // 地图配置里的 ambientConfig = 「这张图想要的环境效果」（缺省不改动默认值）
        const mapAmbient = this.mapConfig.ambientConfig || {};

        // 云渡泽：雾气效果
        if (mapName.includes('云渡') || this.mapId === 'yunduze') {
            this.ambientConfig.fog.enabled = true;
            this.ambientConfig.fog.opacity = 0.4;
        }
        if (mapAmbient.fog) {
            Object.assign(this.ambientConfig.fog, mapAmbient.fog);
        }

        // 飘落物（落叶 / 落花）：**只在前两章主图显示**（第一章青岚浮野 / 第二章云渡泽）。
        // 判定用严格白名单 FallingFoliage.isFoliageMap()，不做地图名字模糊匹配 ——
        // 小游戏、Boss 战场（boss_arena_ch1 / boss_arena_ch2）、世界地图以及以后新增的地图
        // 一律默认不显示（历史上「名字里带青岚就飘叶子」的写法就是bug来源）。
        // 地图配置可以调数量 / 速率 / 比例，但不能把非主图打开（enabled 以白名单为准）。
        const foliageConfig = this.ambientConfig.fallingFoliage;
        if (mapAmbient.fallingFoliage) {
            Object.assign(foliageConfig, mapAmbient.fallingFoliage);
        }
        foliageConfig.enabled = (typeof FallingFoliage !== 'undefined')
            && FallingFoliage.isFoliageMap(this.mapId)
            && foliageConfig.enabled !== false;

        // 创建 / 同步飘落物实例（贴图从 ResourceManager 取；缺图 → 程序化叶片 / 花瓣兜底）
        if (typeof FallingFoliage !== 'undefined') {
            if (this.foliage) {
                this.foliage.applyConfig(foliageConfig);
            } else {
                this.foliage = new FallingFoliage(Object.assign({ name: `${this.mapId} 飘落物` }, foliageConfig));
            }
            this.foliage.loadImages();
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

    // ==================== 战场 Boss（摄风山魈） ====================

    /**
     * 生成战场 Boss
     * 与普通怪物并列存放在 monsters 中，便于 GameLoop 统一 update / render；
     * 额外用 this.arenaBoss 记录引用，供战斗结算与战后清理使用。
     *
     * 按 bossConfig.ai / monsterId 选择实现类：
     *   'shanxiao' / boss_shanxiao → 摄风山魈（第一章，js/ShanxiaoBoss.js）
     *   'due'      / boss_due      → 渡厄使（第二章，js/DueBoss.js）
     * @param {string} bossKey - 地图配置中的键
     * @param {Object} bossConfig - 配置：瓦片坐标 {x, y} + monsterId + tuning
     * @returns {Object|null}
     */
    spawnArenaBoss(bossKey = 'boss_shanxiao', bossConfig = {}) {
        const isDue = bossConfig.ai === 'due' || bossConfig.monsterId === 'boss_due';
        const BossClass = isDue
            ? (typeof DueBoss === 'function' ? DueBoss : null)
            : (typeof ShanxiaoBoss === 'function' ? ShanxiaoBoss : null);

        if (!BossClass) {
            console.warn(`[GameMap] 未找到战场 Boss 类（${isDue ? 'DueBoss' : 'ShanxiaoBoss'}），跳过生成`);
            return null;
        }

        // 已被击败过 → 本图不再生成 Boss（由 Main 在进场时按剧情标记设置）
        // 说明：战败未击败的情况不在此列，玩家可再次进场重试。
        if (this.arenaBossDefeated) {
            Logger.log(`[GameMap] 战场 Boss 已被击败，本次进场不再生成`);
            return null;
        }

        // 避免重复生成（例如重复进场）
        if (this.arenaBoss) {
            this.clearArenaBoss();
        }

        const worldPosition = bossConfig.worldPosition
            ? { x: bossConfig.worldPosition.x, y: bossConfig.worldPosition.y }
            : this.tileToWorld(bossConfig.x, bossConfig.y);

        const boss = new BossClass({
            id: bossKey,
            monsterId: bossConfig.monsterId || (isDue ? 'boss_due' : 'boss_shanxiao'),
            position: worldPosition,
            tuning: Object.assign({}, bossConfig.tuning || {}),
            isArenaBoss: true,
        });

        boss.tilePosition = { x: bossConfig.x, y: bossConfig.y };
        boss.isBoss = true;
        boss.map = this;

        // 战前对白期间生成（或重新生成）的 Boss 直接进入冻结状态（见 setArenaIntroLock）
        if (this.arenaIntroLock && typeof boss.setIntroLock === 'function') {
            boss.setIntroLock(true);
        }

        this.monsters.set(bossKey, boss);
        this.arenaBoss = boss;

        Logger.log(`[GameMap] 战场 Boss ${boss.name || bossKey} 已生成 `
            + `(${Math.round(worldPosition.x)}, ${Math.round(worldPosition.y)})`);
        return boss;
    }

    /**
     * 清理战场 Boss（战斗结束 / 离开战场时调用）
     * 从 monsters 中删除实例并释放其资源（精灵图缓存等）
     * @returns {boolean} 是否清理了 Boss
     */
    clearArenaBoss() {
        if (!this.arenaBoss) return false;

        const boss = this.arenaBoss;
        this.arenaBoss = null;
        this.monsters.delete(boss.id);

        if (typeof boss.destroy === 'function') {
            boss.destroy();
        }

        return true;
    }

    /**
     * 是否存在可战斗的战场 Boss
     * @returns {boolean}
     */
    hasArenaBoss() {
        return !!(this.arenaBoss && this.arenaBoss.isAlive);
    }

    /**
     * 战前对白期间冻结 / 解冻战场 Boss
     *
     * 背景：第二章进万灯台时 Boss 会随地图载入立即生成，而进场要先把 B01 战前对白读完
     * （此时玩家被锁输入）。若不冻结，Boss 会在对白里追上来出手，玩家只能挨打。
     * 冻结状态由本方法传导到 Boss 自身的 introLock（见 DueBoss.setIntroLock）：
     * 只站在原地、不移动也不造成任何伤害；对白读完 Main.startArenaFight 会置 false 解冻。
     * @param {boolean} [locked=true] - true=冻结（对白期间）/ false=解冻（正式开战）
     */
    setArenaIntroLock(locked = true) {
        this.arenaIntroLock = !!locked;

        if (this.arenaBoss && typeof this.arenaBoss.setIntroLock === 'function') {
            this.arenaBoss.setIntroLock(this.arenaIntroLock);
        }

        Logger.log(`[GameMap] 战场 Boss ${this.arenaIntroLock ? '已冻结（战前对白）' : '已解冻'}`);
    }

    /**
     * 把战场 Boss 从场上摘下（保留资源缓存，不调用 destroy）
     *
     * 用途：第二章进场要「读完 B01 对白才开战」，而 Boss 是随地图载入生成的 ——
     * 对白开始前先用本方法把 Boss 撤下，对白读完 ensureArenaBoss 再生成，
     * 画面与战斗节奏都与设计一致。
     * 与 clearArenaBoss 的差别：不释放精灵图缓存，因此重新生成时不会出现空帧
     * （进场前已由 Main.preloadBossArenaImages 预加载过）。
     * @returns {boolean} 是否撤下了 Boss
     */
    detachArenaBoss() {
        if (!this.arenaBoss) return false;

        const boss = this.arenaBoss;
        this.arenaBoss = null;
        this.monsters.delete(boss.id);

        if (typeof boss.clearTarget === 'function') {
            boss.clearTarget();
        }
        if (typeof boss.setIntroLock === 'function') {
            boss.setIntroLock(true);    // 万一被重新挂回场上也保持冻结，直到 startFight
        }
        Logger.log('[GameMap] 战场 Boss 已撤下（战前对白期间不上场）');
        return true;
    }

    /**
     * 确保战场 Boss 存在（玩家进场时调用）
     * Boss 在战斗结束 / 离开战场时已被清理，这里按地图配置重新生成
     * @returns {Object|null}
     */
    ensureArenaBoss() {
        // 已被击败过（剧情标记 / 任务目标已完成）→ 本图不再生成 Boss
        if (this.arenaBossDefeated) {
            return null;
        }

        if (this.arenaBoss && !this.arenaBoss.isDestroyed) {
            return this.arenaBoss;
        }

        const bossConfigs = this.mapConfig && this.mapConfig.bossPosition;
        if (!bossConfigs) {
            return null;
        }

        // 地图上只登记一个战场 Boss，这里取第一个（键名不再写死，兼容两张战场地图）
        for (const key in bossConfigs) {
            return this.spawnArenaBoss(key, bossConfigs[key]);
        }
        return null;
    }

    /**
     * 设置战场 Boss 的"已被击败"状态（由 Main 按剧情标记 / 战斗结算设置）
     * 标记为已击败时会立即清理场上的 Boss 实体
     * @param {boolean} [defeated=true]
     */
    setArenaBossDefeated(defeated = true) {
        this.arenaBossDefeated = !!defeated;
        if (this.arenaBossDefeated) {
            this.clearArenaBoss();
        }
    }

    /**
     * 战场 Boss 是否已被击败
     * @returns {boolean}
     */
    isArenaBossDefeated() {
        return this.arenaBossDefeated === true;
    }

    /**
     * 地图正中心的世界坐标（像素）
     * @returns {{x: number, y: number}}
     */
    getCenterWorldPosition() {
        return {
            x: this.mapWidth * this.tileSize / 2,
            y: this.mapHeight * this.tileSize / 2,
        };
    }

    /**
     * 在战场地图正中心生成"归途"传送法阵（击败 Boss 后永久存在）
     * - 与普通法阵一样由 Player 的交互检测（按 E）触发，targetMapId / targetPosition
     *   由 Main 按进场时记录的"原来位置"注入
     * - 幂等：重复调用只刷新落点与提示，不会产生第二座法阵
     * @param {Object} config
     * @param {string} [config.id] - 法阵 ID（默认 teleport_boss_exit）
     * @param {string} [config.name] - 法阵名称
     * @param {string} [config.targetMapId] - 目标地图 ID
     * @param {Object} [config.targetPosition] - 目标落点（世界坐标，像素）
     * @param {string} [config.promptText] - 交互提示
     * @param {string} [config.image] - ResourceManager 图片键（默认沿用战场入口法阵图）
     * @returns {TeleportArray|null}
     */
    createArenaExitArray(config = {}) {
        if (typeof TeleportArray !== 'function') {
            console.warn('[GameMap] 未找到 TeleportArray 类，跳过战场归途法阵生成');
            return null;
        }

        const id = config.id || 'teleport_boss_exit';
        const existed = this.teleporters.get(id);
        if (existed) {
            // 已存在（永久法阵）：只刷新本次进场对应的返回点
            if (config.targetMapId) existed.targetMapId = config.targetMapId;
            if (config.targetPosition) existed.targetPosition = { ...config.targetPosition };
            if (config.promptText) existed.promptText = config.promptText;
            existed.isActive = true;
            return existed;
        }

        const center = this.getCenterWorldPosition();
        const teleport = new TeleportArray({
            id: id,
            name: config.name || '传送法阵',
            position: center,
            radius: config.radius || 76,
            targetMapId: config.targetMapId || null,
            targetPosition: config.targetPosition || this.getEntryWorldPosition(),
            promptText: config.promptText || '按 E 离开战场',
            image: config.image || 'teleportArrays.boss_enter',
            imageWidth: 96,
            imageHeight: 96,
            anchor: 'center',
            bossArena: false,      // 出口法阵走普通换图流程（不记录返回点）
            isActive: true,
        });

        this.teleporters.set(teleport.id, teleport);
        Logger.log(`[GameMap] 战场归途法阵已生成于地图正中心 (${center.x}, ${center.y})`);
        return teleport;
    }

    /**
     * 更新场景动画
     * 只处理地图本身的环境动画，如飘落物（落叶 / 落花）、水流、飘动的旗帜等
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} [camera] - 摄像机（GameLoop 传入；飘落物按视口生成，使同屏数量稳定）
     */
    updateSceneAnimations(deltaTime, camera) {
        if (!this.isActive) return;

        // 1. 飘落物（落叶 / 落花）：只在前两章主图开启（见 initSceneAnimations）
        //    范围取摄像机视口 → config.maxCount 就是「界面中同时存在的最大飘落物数量」
        if (this.foliage) {
            this.foliage.setArea(this.getFoliageArea(camera));
            this.foliage.update(deltaTime);
        }

        // 2. 更新通用场景粒子（容器保留，供扩展使用）
        this.sceneParticles.forEach(particle => {
            if (particle.update) {
                particle.update(deltaTime);
            }
        });
        
        // 3. 更新环境特效
        this.ambientEffects.forEach(effect => {
            if (effect.update) {
                effect.update(deltaTime);
            }
        });
        
        // 4. 更新场景动画实例
        this.sceneAnimations.forEach(animation => {
            if (animation.update) {
                animation.update(deltaTime);
            }
        });
        
        // 5. 清理失效的粒子
        this.cleanupParticles();
    }

    /**
     * 飘落物的活动范围（世界坐标）
     * 有摄像机 → 取当前视口：飘落物只出现在屏幕附近，密度与地图大小无关
     *            （青岚浮野 3344×1882 / 云渡泽 3200×1792，若按整图铺，
     *              40 片撒在整张图上几乎看不见 —— 所以按视口来）
     * 无摄像机（无头测试 / 一屏到底的战场）→ 退回整张地图范围
     * @param {Object} [camera] - 摄像机实例
     * @returns {Object} {x, y, width, height}
     */
    getFoliageArea(camera) {
        const cam = camera || null;
        const width = cam ? (cam.width || 0) : 0;
        const height = cam ? (cam.height || 0) : 0;
        if (width > 0 && height > 0) {
            const pos = (typeof cam.getRenderPosition === 'function')
                ? cam.getRenderPosition()
                : { x: cam.x || 0, y: cam.y || 0 };
            return { x: pos.x, y: pos.y, width: width, height: height };
        }
        return {
            x: 0,
            y: 0,
            width: this.mapWidth * this.tileSize,
            height: this.mapHeight * this.tileSize,
        };
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

        // 3. 渲染飘落物（落叶 / 落花；环境装饰，画在交互物与实体之下）
        //    renderPos 是摄像机视口左上角的世界坐标 → 飘落物按世界坐标存，这里转屏幕坐标
        if (this.foliage) {
            this.foliage.render(ctx, renderPos.x, renderPos.y);
        }

        // 4. 渲染场景粒子
        this.sceneParticles.forEach(particle => {
            if (particle.render) {
                particle.render(ctx, renderPos);
            }
        });
        
        // 5. 渲染场景动画
        this.sceneAnimations.forEach(animation => {
            if (animation.render) {
                animation.render(ctx, renderPos);
            }
        });

        // 6. 渲染地图中的法阵（地图本身不做实体渲染，但法阵属于环境交互对象）
        if (this.teleporters) {
            this.teleporters.forEach(teleport => {
                if (teleport && teleport.render) {
                    teleport.render(ctx, camera);
                }
            });
        }

        // 7. 渲染可拾取物品（环境交互对象）
        if (this.pickupItems) {
            this.pickupItems.forEach(pickup => {
                if (pickup && pickup.render) {
                    pickup.render(ctx, camera);
                }
            });
        }

        // 8. 渲染路标（环境交互对象）
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
     * 世界地图传送回来时复用同一实例（NPC / 法阵 / 调查点状态都还在），资源不重新加载
     */
    activate() {
        this.isActive = true;
    }

    /**
     * 停用地图（静默）
     * 只把地图设为非活动：不再更新（updateSceneAnimations）也不再渲染，也不参与交互检测；
     * 实例与已加载资源全部保留，便于频繁切回（见 MapManager.switchMap）
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
            // 战场 Boss（摄风山魈）由战场流程单独处理，不进入野外切磋交互
            if (monster.isArenaBoss) return;
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
            // 任务门控：未接取对应任务的法阵不可见、也不参与交互检测
            if (!teleport.isActive) return;
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
     * 添加调查点实例（镇风桩 / 破损运灯箱等）
     * @param {WindPile} windPile
     */
    addWindPile(windPile) {
        if (!windPile) return;
        this.windPiles.set(windPile.id, windPile);
    }

    /**
     * 获取玩家附近“可调查”的调查点（镇风桩、破损运灯箱等）
     * 只有当前任务步骤要求调查、且尚未调查的调查点才会被返回
     * @param {Object} position - {x, y}
     * @param {number} radius - 搜索半径
     * @returns {Array} 调查点列表
     */
    getWindPilesNearby(position, radius) {
        const nearby = [];
        this.windPiles.forEach(windPile => {
            if (windPile && windPile.isPlayerInRange(position)) {
                nearby.push(windPile);
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
            // 逐层合并，而不是整块替换：
            // 旧存档里只有旧的落叶字段 / fog，新字段 fallingFoliage 必须保留下来，
            // 否则读档后 ambientConfig.fallingFoliage 变成 undefined → 飘落物配置丢失。
            Object.keys(data.ambientConfig).forEach(key => {
                const saved = data.ambientConfig[key];
                if (saved && typeof saved === 'object' && this.ambientConfig[key]) {
                    Object.assign(this.ambientConfig[key], saved);
                } else {
                    this.ambientConfig[key] = saved;
                }
            });
            // 读档后重新按地图判定（非主图一定不飘）并把参数同步给飘落物实例
            this.initSceneAnimations();
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