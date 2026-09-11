/**
 * 修仙者模拟器：飘途 - 主程序
 * 整合所有系统，初始化游戏，启动主循环
 */
class Main {
    constructor() {
        // ========== Canvas ==========
        this.canvas = null;
        this.ctx = null;
        
        // ========== 核心系统 ==========
        this.gameDataManager = null;
        this.gameLoop = null;
        this.sceneManager = null;
        this.mapManager = null;
        this.camera = null;
        this.inputManager = null;
        
        // ========== UI系统 ==========
        this.mapTeleport = null;
        this.questUI = null;
        this.dialogBox = null;
        this.uiManager = null;
        
        // ========== 游戏系统 ==========
        this.battleSystem = null;
        this.miniGameManager = null;
        this.shop = null;   // 商店系统
        this.trainingManager = null;
        this.playerCombat = null;   // 玩家战斗系统（js/PlayerCombat.js）
        
        // ========== 实体 ==========
        this.player = null;
        this.currentMap = null;

        // ========== Boss 战场（主线四《山口不止风》） ==========
        // 摄风山魈战场是独立地图（bg + collision，1280×720），
        // 玩家数据（气血/灵力/速度/伤害/技能）由同一个 Player 实例带入，无需迁移。
        this.bossArenaMapId = 'boss_arena_ch1';
        this.bossArenaReturn = null;        // 进场时记录的法阵落点 {mapId, x, y}
        this.isReturningFromBossArena = false; // 防止死亡钩子在切图过程中重复触发
        // 胜利结算只执行一次：Boss 伏诛演出播完 → 记剧情标记 + 在战场正中心开启永久归途法阵；
        // 不再倒计时自动离场，玩家自行走到法阵按 E 回到原来位置。
        this.bossArenaVictoryHandled = false;
        this.bossArenaDefeatedFlag = 'boss_shanxiao_defeated';  // 剧情标记名（写入 QuestSystem.storyFlags）

        // ========== 章末流程（筑基调息 → 码头送别 → 登船） ==========
        this.isFoundationTrialPlaying = false;  // 筑基调息播放中（锁定键盘/移动/战斗输入）
        this.foundationTrialTimer = 0;          // 筑基调息剩余秒数
        this.foundationTrialNPC = null;         // 触发筑基调息的 NPC（祁伯，用于续接对话）
        
        // ========== 资源 ==========
        this.resourceManager = null;
        this.gameConfig = null;
        
        // ========== 存档 ==========
        this.saveManager = null;
        
        // ========== 游戏状态 ==========
        this.isInitialized = false;
        this.isPaused = false;
        this.currentSceneId = null;
        
        // ========== 场景定义 ==========
        this.scenes = {};
    }

    /**
     * 初始化游戏
     * @param {string} canvasId - Canvas元素ID
     */
    async init(canvasId) {
        // 获取Canvas
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas元素不存在: ${canvasId}`);
            return false;
        }
        this.ctx = this.canvas.getContext('2d');
        
        // 设置Canvas尺寸
        this.canvas.width = 1280;
        this.canvas.height = 720;
        
        // 初始化资源管理器和游戏配置
        this.resourceManager = ResourceManager.getInstance();
        this.gameConfig = GameConfig.getInstance();
        
        // 预加载初始资源（不阻塞启动）
        // 用 try-catch 包裹，失败也不影响
        try {
            await this.preloadInitialResources();
        } catch (error) {
            console.warn('[游戏] 资源预加载失败，继续启动:', error);
        }
    
        // 初始化核心系统
        this.initCoreSystems();

        // 初始化UI系统
        this.initUISystems();
        
        // 初始化游戏系统
        this.initGameSystems();
        
        // 加载第一章剧情配置
        try {
            if (window.Chapter1Config && window.chapterLoader) {
                const chapter1Data = Chapter1Config.getAll();
                window.chapterLoader.registerChapter(chapter1Data);
                console.log('[游戏] 第一章剧情配置加载完成');
            } else {
                console.warn('[游戏] ChapterLoader或Chapter1Config未加载，跳过章节配置注册');
            }
        } catch (error) {
            console.warn('[游戏] 章节配置加载失败:', error);
        }
        
        // 初始化游戏数据管理器
        this.initGameDataManager();
        
        // 初始化场景
        this.initScenes();
        
        // 绑定输入
        this.bindInputEvents();
        
        // 创建玩家
        this.createPlayer();

        // 注册所有任务到状态机（必须在创建玩家之后，因为 player.questSystem 需先存在）
        if (this.player && this.player.questSystem) {
            this.player.questSystem.registerAllQuests();
            console.log(`[游戏] 已注册 ${this.player.questSystem.quests.size} 个任务`);
        }

        // 暂存 quest pickup 配置，等任务激活时再创建（questId → [{config, mapId}]）
        this.pendingQuestPickups = {};
        
        // 加载初始地图（也加 try-catch）
        try {
            await this.loadInitialMap();
        } catch (error) {
            console.warn('[游戏] 初始地图加载失败:', error);
            // 地图加载失败也继续，只是没有地图
        }
        
        // 设置任务系统回调
        this.setupQuestCallbacks();

        // 设置游戏循环回调
        this.setupGameLoop();
        
        this.isInitialized = true;
        
        console.log('[游戏] 初始化完成（部分资源可能缺失）');
        
        return true;
    }

    /**
     * 初始化核心系统
     */
    setupQuestCallbacks() {
        if (!this.player || !this.player.questSystem) return;
        const qs = this.player.questSystem;

        // ====== 任务接受/解锁时（LOCKED → ACTIVE） ======
        qs.onQuestAccept = (questId) => {
            console.log(`[Main] 任务解锁: ${questId}`);
            this.addGameNotification(`新任务已解锁！`);

            // ====== 创建该任务对应的暂存任务道具 ======
            // 统一交回 createPickupItemsFromConfig 创建（而非就地 new PickupItem），
            // 这样才能复用其 requireObjective 门控：
            // 例如空魂灯必须等到“调查破损运灯箱”完成后才会出现在箱前。
            if (this.pendingQuestPickups[questId]) {
                const mapsToRefresh = new Map();
                for (const { config, mapId } of this.pendingQuestPickups[questId]) {
                    // 优先在当前地图创建；否则从 MapManager 获取目标地图
                    let targetMap = this.currentMap;
                    if (targetMap && mapId && targetMap.mapId !== mapId) {
                        targetMap = this.mapManager.getMap(mapId);
                    }
                    if (!targetMap) {
                        console.warn(`[Main] 无法找到目标地图 ${mapId}，暂存拾取物 ${config.name} 未创建`);
                        continue;
                    }
                    mapsToRefresh.set(targetMap.mapId || mapId, targetMap);
                }
                delete this.pendingQuestPickups[questId];
                for (const targetMap of mapsToRefresh.values()) {
                    this.createPickupItemsFromConfig(targetMap);
                }
            }

            // ====== 任务解锁后刷新路标可见性 ======
            // 原因：signpost 初始化时通过 updateQuestGate 将 isActive 设为 false（任务 locked），
            // 接取后需要重新计算，否则依赖该任务的路标不会显示
            if (this.currentMap) {
                this.updateSignpostQuestGates(this.currentMap);
                this.updateWindPileQuestGates(this.currentMap);
                // 传送法阵同理：主线四接取后，山口石台上的法阵才会出现
                this.updateTeleportQuestGates(this.currentMap);
            }

            const map = this.currentMap;
            if (!map || !map.npcs) return;
        };

        // ====== 任务完成时（ACTIVE → COMPLETED）：NPC搬迁 + 治疗 + 道具清除 ======
        qs.onQuestComplete = (questId, rewards) => {
            console.log(`[Main] 任务完成: ${questId}`, rewards);
            const map = this.currentMap;

            // ====== 移除已完成任务对应的任务道具 ======
            if (map && map.pickupItems) {
                const toRemove = [];
                for (const [id, item] of map.pickupItems) {
                    if (item.questId === questId) {
                        toRemove.push(id);
                    }
                }
                for (const id of toRemove) {
                    map.removePickupItem(id);
                    console.log(`[Main] 移除已完成任务的道具: ${id}`);
                }
            }

            if (!map || !map.npcs) return;

            // main_1 完成 → 阿禾迁到救助点
            if (questId === 'chapter1_main_1') {
                const ahe = map.npcs.get('ahe');
                if (ahe && ahe.reposition) {
                    ahe.reposition(58, 41, map);
                }
            }
            // main_2 完成 → 阿禾治疗阿砚
            if (questId === 'chapter1_main_2') {
                const ahe = map.npcs.get('ahe');
                const ayan = map.npcs.get('ayan');
                if (ahe && ayan && ahe.performHeal) {
                    ahe.performHeal(ayan);
                }
            }
            // main_3 完成 → 周叔迁往获救点
            if (questId === 'chapter1_main_3') {
                const zhoushu = map.npcs.get('zhoushu');
                if (zhoushu && zhoushu.repositionWorld) {
                    const rescued = this.getZhoushuRescuedWorldPosition(map);
                    zhoushu.repositionWorld(rescued.x, rescued.y, map);
                }
            }
            // ending_1 完成 → 阿禾迁到码头
            if (questId === 'chapter1_ending_1') {
                const ahe = map.npcs.get('ahe');
                if (ahe && ahe.reposition) {
                    ahe.reposition(81, 44, map);
                }
            }
            // 奖励通知
            if (rewards && rewards.exp) console.log(`[奖励] 经验: ${rewards.exp}`);
            if (rewards && rewards.lingShi) console.log(`[奖励] 灵石: ${rewards.lingShi}`);

            // 任务完成 → 如果路标依赖该任务，保持其可见（completed 状态匹配可见条件）
            if (this.currentMap) {
                this.updateSignpostQuestGates(this.currentMap);
                this.updateWindPileQuestGates(this.currentMap);
                this.updateTeleportQuestGates(this.currentMap);
            }
        };

        // ====== 任务进度更新 ======
        qs.onQuestProgress = (questId, questState) => {
            // 任务被接取（从 locked 变为 active）→ 更新路标可见性
            if (this.currentMap) {
                this.updateSignpostQuestGates(this.currentMap);
                this.updateWindPileQuestGates(this.currentMap);
                this.updateTeleportQuestGates(this.currentMap);
                // 目标推进后重算拾取物：带 requireObjective 的物品（如空魂灯、阵核/名册匣）
                // 会在其前置目标完成的那一刻出现在地图上
                this.createPickupItemsFromConfig(this.currentMap);
            }
        };
    }

    initCoreSystems() {
        this.gameLoop = new GameLoop({
            fps: 60,
            canvas: this.canvas,
        });
        
        this.sceneManager = new SceneManager();
        
        this.mapManager = new MapManager();
        
        this.camera = new Camera({
            width: this.canvas.width,
            height: this.canvas.height,
        });
        
        this.inputManager = new InputManager(window,this.canvas);
    }

    /**
     * 初始化UI系统
     */
    initUISystems() {

        // 获取已加载的背景图
        const worldMapBg = this.resourceManager.getCachedImage('worldMap.background');
        this.mapTeleport = new MapTeleport({
            canvas: { width: this.canvas.width, height: this.canvas.height },
            backgroundImage: worldMapBg,  // ← 传入背景图
            // ========== 添加区域按钮 ==========
            areaButtons: [
                {
                    id: 'btn_qinglan',
                    x: 250,           // 按钮x坐标
                    y: 350,           // 按钮y坐标
                    width: 140,        // 按钮宽度
                    height: 100,       // 按钮高度
                    image: this.resourceManager.getCachedImage('worldMap.button_qinglan'),
                    areaName: '青岚浮野',
                    targetMapId: 'qinglan_fuye',
                    enabled: true,    // 可点击
                    callback: (btn) => {
                        console.log(`传送到: ${btn.areaName}`);
                        this.mapManager.switchMap(btn.targetMapId, this.player);
                    },
                },
                {
                    id: 'btn_yunduze',
                    x: 500,
                    y: 100,
                    width: 140,
                    height: 100,
                    image: this.resourceManager.getCachedImage('worldMap.button_yunduze'),
                    areaName: '云渡泽',
                    targetMapId: 'yunduze',
                    enabled: false,   // 未解锁，不可点击
                },
                {
                    id: 'btn_zhaochen',
                    x: 1100,
                    y: 250,
                    width: 140,
                    height: 100,
                    image: this.resourceManager.getCachedImage('worldMap.button_zhaochen'),
                    areaName: '照尘仙城',
                    targetMapId: 'zhaochen_xiancheng',
                    enabled: false,
                },
                {
                    id: 'btn_wuxiang',
                    x: 800,
                    y: 550,
                    width: 140,
                    height: 100,
                    image: this.resourceManager.getCachedImage('worldMap.button_wuxiang'),
                    areaName: '无乡天阙',
                    targetMapId: 'wuxiang_tianque',
                    enabled: false,
                },
            ],
        });
        
        const taskPanelBg = this.resourceManager.getCachedImage('ui.task_panel');
        this.questUI = new QuestUI({
            x: 400,
            y: 120,
            width: 480,
            height: 480,
            backgroundImage: taskPanelBg,
        });
        
        const dialogBoxBg = this.resourceManager.getCachedImage('ui.dialog_box');
        this.dialogBox = new DialogBox({
            x: 98,
            y: 480,
            width: 1085,
            height: 220,
            backgroundImage: dialogBoxBg, 
            typewriterEnabled: true,
            typewriterSpeed: 35,
            showSpeaker: true,
        });
    }

    /**
     * 初始化游戏系统
     */
    initGameSystems() {
        this.battleSystem = new BattleSystem({
            battleType: BattleSystem.BattleType.ACTIVE,
        });
        
        this.miniGameManager = new MiniGameManager();
        
        // 注册小游戏
        this.miniGameManager.registerMiniGames({
            herb_collect: new HerbCollectMiniGame(),
            breath_control: new BreathControlMiniGame(),
            boat_navigation: new BoatNavigationMiniGame(),
            memory_sort: new MemorySortMiniGame(),
        });
        
        // 创建商店系统
        this.shop = new Shop({ main: this });

        // 创建训练管理器
        this.trainingManager = new TrainingManager();
        this.trainingManager.onAllCompleted = () => {
            console.log('[Main] 基础训练全部完成！');
            // 战斗按键永久解锁
            if (this.playerCombat) {
                this.playerCombat.setUnlocked(true);
            }
            // 推进任务进度
            if (this.player && this.player.questSystem) {
                for (const [questId] of this.player.questSystem.getActiveQuests()) {
                    this.player.questSystem.updateQuestProgress(questId, 'complete_training', 'basic');
                }
            }
            // 显示通知
            this.addGameNotification('基础训练完成！返回向祁伯汇报');
        };

        // 创建玩家战斗系统（大地图内 J=普通攻击 / U=灵息弹 / I=护体术 / L=闪避）
        this.playerCombat = new PlayerCombatSystem({ main: this });
    }

    /**
     * 初始化游戏数据管理器
     */
    initGameDataManager() {
        this.gameDataManager = new GameDataManager();
        
        this.gameDataManager.gameLoop = this.gameLoop;
        this.gameDataManager.sceneManager = this.sceneManager;
        this.gameDataManager.mapManager = this.mapManager;
        this.gameDataManager.camera = this.camera;
        this.gameDataManager.inputManager = this.inputManager;
        this.gameDataManager.mapTeleport = this.mapTeleport;
        this.gameDataManager.questUI = this.questUI;
        this.gameDataManager.dialogBox = this.dialogBox;
        this.gameDataManager.battleSystem = this.battleSystem;
        this.gameDataManager.miniGameManager = this.miniGameManager;
        this.gameDataManager.shop = this.shop;
        
        // 创建存档管理器
        this.saveManager = new SaveManager();
        this.saveManager.registerSystems({
            gameLoop: this.gameLoop,
            sceneManager: this.sceneManager,
            mapManager: this.mapManager,
            camera: this.camera,
            inputManager: this.inputManager,
            mapTeleport: this.mapTeleport,
            questUI: this.questUI,
            dialogBox: this.dialogBox,
            battleSystem: this.battleSystem,
            miniGameManager: this.miniGameManager,
        });
        
        this.gameDataManager.saveManager = this.saveManager;
    }

    /**
     * 初始化场景
     */
    initScenes() {
        // 主菜单场景
        this.scenes.mainMenu = new MainMenuScene(this);
        
        // 游戏场景（世界地图 + 实际地图）
        this.scenes.gameWorld = new GameWorldScene(this);
        
        // 战斗场景
        this.scenes.battle = new BattleScene(this);
        
        // 小游戏场景
        this.scenes.miniGame = new MiniGameScene(this);
        
        // 注册到场景管理器
        this.sceneManager.registerScenes(this.scenes);
        
        // 切换到主菜单
        this.sceneManager.switchScene('mainMenu');
    }

    /**
     * 绑定输入事件
     */
    bindInputEvents() {
        // 键盘事件
        this.inputManager.onKeyDown = (key, event) => {
            this.handleKeyDown(key, event);
        };
        
        // ESC关闭弹窗
        this.inputManager.onKeyUp = (key) => {
            // 筑基调息播放中：忽略一切键盘（含 ESC）
            if (this.isFoundationTrialPlaying) {
                return;
            }
            if (key === 'escape') {
                this.handleEscapeKey();
            }
        };
    }

    /**
     * 处理键盘按下
     */
    handleKeyDown(key, event) {
        const currentScene = this.sceneManager.getCurrentScene();

        // ===== 规则-1：筑基调息播放中 → 键盘输入全部忽略（序列结束后续接对话） =====
        if (this.isFoundationTrialPlaying) {
            return;
        }

        // ===== 规则0：小游戏中时，所有外部按键一律忽略 =====
        if (currentScene && currentScene.sceneId === 'miniGame' && this.miniGameManager && this.miniGameManager.isPlaying) {
            return;
        }

        // ===== 规则1：任务栏打开时，只允许 Q / ESC 操作 =====
        if (this.questUI.isVisible) {
            if (key === 'escape') {
                this.questUI.hide();
            } else if (key === 'q') {
                this.questUI.hide();
            }
            // 其他按键全部忽略
            return;
        }

        // ===== 规则2：对话中时，只允许 ESC / J 操作 =====
        if (this.dialogBox.isVisible) {
            if (key === 'escape') {
                this.handleEscapeKey();
            } else if (key === 'j') {
                // J 键推进对话（同时防止被外部捕获）
                this.dialogBox.advance();
            }
            return;
        }
        
        switch (key) {
            case 'escape':
                // 关闭弹窗
                this.handleEscapeKey();
                break;
            case 'q':
                // 打开/关闭任务UI（世界地图打开时不响应：地图上只保留地图本身与其按钮）
                if (currentScene && currentScene.sceneId === 'gameWorld'
                    && !(this.mapTeleport && this.mapTeleport.isVisible)) {
                    this.questUI.toggle();
                }
                break;
            // 注：原 M 键“打开/关闭世界地图（MapTeleport）”已按章末流程需求移除，
            // 世界地图只由剧情节点开启（码头登船：Main.boardShipAndOpenWorldMap → mapTeleport.show()）。
            // 世界地图界面内仍可点击区域按钮切换地图，按 ESC 关闭。
            case 'e':
                // 交互键
                this.handleInteraction();
                break;
            case 'i':
                // I 键：护体术（由 PlayerCombatSystem 统一捕获，这里不处理）
                break;
            case 'l':
                // L 键已改为"闪避"（见 js/PlayerCombat.js）。
                // 原 L 键启动的"逆流行舟"小游戏入口按需求禁用：
                // 如需恢复请改用其它未被占用的按键，并在此调用 startMiniGame('boat_navigation', ...)。
                break;
        }
    }

    /**
     * 处理ESC键
     */
    handleEscapeKey() {
        // 关闭商店
        if (this.shop && this.shop.isOpen) {
            this.shop.close();
            return;
        }
        
        // 关闭任务UI
        if (this.questUI.isVisible) {
            this.questUI.hide();
            return;
        }
        
        // 关闭地图传送
        if (this.mapTeleport.isVisible) {
            this.mapTeleport.hide();
            return;
        }
        
        // 关闭对话框
        if (this.dialogBox.isVisible) {
            this.dialogBox.hide();
            return;
        }
    }

    /**
     * 处理交互
     */
    handleInteraction() {
        if (!this.player || !this.player.isAlive) return;

        // 世界地图打开时：画面与操作都只保留世界地图本身（避免地图上的 E 键盘误触发交互）
        if (this.mapTeleport && this.mapTeleport.isVisible) return;
        
        // 如果玩家在战斗中，不处理交互
        if (this.player.isInBattle) return;

        // 筑基调息播放中：不接受任何交互（updateGameWorld 已整体短路，此处为兜底）
        if (this.isFoundationTrialPlaying) return;

        // 优先处理传送法阵（兼容既有逻辑，不影响 NPC/战斗）
        if (this.player.nearbyTeleportArray) {
            this.triggerTeleport(this.player.nearbyTeleportArray);
            return;
        }
        
        // 靠近路标 → 触发路标回调（如开启小游戏）
        if (this.player.nearbySignpost) {
            const signpost = this.player.nearbySignpost;
            signpost.activate();
            // 如果路标关联了小游戏 ID，自动启动
            if (signpost.gameId) {
                this.startMiniGame(signpost.gameId, (result) => {
                    if (result && result.success) {
                        console.log(`[路标] ${signpost.name} 完成！`);
                        // 乘风采药成功 → 推进主线任务"一盏安身灯"采药目标
                        if (signpost.gameId === 'herb_collect' && this.player && this.player.questSystem) {
                            this.player.questSystem.updateQuestProgress('chapter1_main_2', 'collect_item', 'lingcao', 3);
                        }
                    }
                });
            }
            return;
        }

        // 尝试与NPC交互
        if (this.player.nearbyNPC) {
            this.startNPCInteraction(this.player.nearbyNPC);
            return;
        }

        // 靠近调查点（镇风桩 / 破损运灯箱，且当前任务步骤正好要求调查它）→ 触发调查对话
        if (this.player.nearbyWindPile) {
            this.startWindPileInteraction(this.player.nearbyWindPile);
            return;
        }

        // 靠近可拾取物品 → 拾取
        if (this.player.nearbyPickupItem && !this.player.nearbyPickupItem.isPickedUp) {
            this.handlePickupItem(this.player.nearbyPickupItem);
            return;
        }
        
        // 尝试与怪物交互（触发战斗）
        if (this.player.nearbyMonster) {
            this.startMonsterBattle(this.player.nearbyMonster);
            return;
        }
    }
/**
     * 处理拾取物品
     * @param {PickupItem} pickupItem - 拾取物实例
     */
    handlePickupItem(pickupItem) {
        if (!pickupItem || pickupItem.isPickedUp) return;
        
        const success = pickupItem.pickup(
            this.player.questItemSystem,
            this.player.questSystem
        );
        
        if (success) {
            console.log(`[Main] 拾取物品: ${pickupItem.name}`);
            // 从地图中移除已拾取的物品
            if (this.currentMap && this.currentMap.removePickupItem) {
                this.currentMap.removePickupItem(pickupItem.id);
            }
        }
    }

    /**
     * 刷新当前地图所有调查点（镇风桩 / 破损运灯箱等）的可调查状态
     * @param {GameMap} gameMap - 地图实例
     */
    updateWindPileQuestGates(gameMap) {
        const map = gameMap || this.currentMap;
        if (!map || !map.windPiles || !this.player || !this.player.questSystem) return;
        for (const [, windPile] of map.windPiles) {
            if (windPile && windPile.updateQuestGate) {
                windPile.updateQuestGate(this.player.questSystem);
            }
        }
    }

    /**
     * 开始调查点调查（弹出调查发现对话框）
     * @param {WindPile} windPile - 调查点实例（镇风桩 / 破损运灯箱等）
     */
    startWindPileInteraction(windPile) {
        if (!windPile || !windPile.canInvestigate || windPile.isInvestigated) return;

        const dialogue = windPile.getDialogue ? windPile.getDialogue() : null;
        if (!dialogue || !dialogue.text) {
            console.warn(`[Main] 调查点 ${windPile.id} 未配置调查对话`);
            return;
        }

        // 设置玩家交互状态
        this.player.isInteracting = true;
        this.inputManager.setMovementBlocked(true);

        // 清空上一对话缓存，防止残留文字
        this.dialogBox.dialogueLines = [];
        this.dialogBox.currentText = '';
        this.dialogBox.displayedText = '';
        this.dialogBox.currentSpeakerName = '';
        this.dialogBox.isTyping = false;
        this.dialogBox.currentLineIndex = 0;
        this.dialogBox.clearOptionButtons();

        // 显示调查内容（对话框按行推进，读完最后一行再按一次即结束）
        this.dialogBox.show();
        this.dialogBox.setText(dialogue.text, windPile.name);
        this.dialogBox.onAdvance = () => {
            this.finishWindPileInvestigation(windPile);
        };

        console.log(`[Main] 开始调查 ${windPile.name} (${windPile.objectiveTarget})`);
    }

    /**
     * 结束调查点调查：标记已调查、推进任务目标（进入下一步任务）
     * @param {WindPile} windPile - 调查点实例（镇风桩 / 破损运灯箱等）
     */
    finishWindPileInvestigation(windPile) {
        // 清理对话框
        this.dialogBox.dialogueLines = [];
        this.dialogBox.currentText = '';
        this.dialogBox.displayedText = '';
        this.dialogBox.currentSpeakerName = '';
        this.dialogBox.isTyping = false;
        this.dialogBox.currentLineIndex = 0;
        this.dialogBox.onAdvance = null;
        this.dialogBox.hide();

        if (windPile) {
            // 已调查：不可重复调查，提示同时隐藏
            if (windPile.markInvestigated) windPile.markInvestigated();

            // 推进对应 investigate 目标 → 任务进入下一步
            if (this.player && this.player.questSystem) {
                this.player.questSystem.updateQuestProgress(
                    windPile.questId,
                    windPile.objectiveType,
                    windPile.objectiveTarget,
                    1
                );
            }

            console.log(`[Main] 调查完毕: ${windPile.name}`);
        }

        // 刷新所有调查点的可调查状态（下一处调查点变为可调查）
        this.updateWindPileQuestGates(this.currentMap);

        this.player.isInteracting = false;
        this.inputManager.setMovementBlocked(false);
    }

    /**
     * 切换当前地图（统一的落点/摄像机/任务门控/地图道具刷新入口）
     * @param {string} mapId - 目标地图 ID
     * @param {Object} [worldPosition] - 落点（世界坐标，像素）；不传则用地图入口点
     * @returns {Promise<GameMap|null>} 切换后的地图实例
     */
    async switchToMap(mapId, worldPosition) {
        if (!this.player) return null;

        const targetMap = await this.mapManager.switchMap(mapId, this.player);
        if (!targetMap) {
            console.warn(`[地图] 目标地图不存在或加载失败: ${mapId}`);
            return null;
        }

        const targetPosition = worldPosition || targetMap.getEntryWorldPosition();
        this.player.position = { ...targetPosition };
        // 清空上一张地图残留的交互目标，避免跨地图误触发
        this.player.nearbyTeleportArray = null;
        this.player.nearbyNPC = null;
        this.player.nearbySignpost = null;
        this.player.nearbyWindPile = null;
        this.player.nearbyPickupItem = null;
        this.player.nearbyMonster = null;

        this.currentMap = targetMap;
        this.gameLoop.setCurrentMap(targetMap);

        const mapBounds = {
            minX: 0,
            minY: 0,
            maxX: targetMap.mapWidth * targetMap.tileSize - this.camera.width,
            maxY: targetMap.mapHeight * targetMap.tileSize - this.camera.height,
        };
        this.camera.setBounds(mapBounds.minX, mapBounds.minY, mapBounds.maxX, mapBounds.maxY);
        this.camera.setTarget(this.player);

        // 新地图的交互对象按当前任务进度刷新
        this.updateSignpostQuestGates(targetMap);
        this.updateWindPileQuestGates(targetMap);
        this.updateTeleportQuestGates(targetMap);
        this.createPickupItemsFromConfig(targetMap);
        // 章末舞台状态（阿禾码头站位 / 登船路标）随剧情标记恢复
        this.applyChapterEndStage(targetMap);

        return targetMap;
    }

    /**
     * 触发传送法阵
     * @param {TeleportArray} teleportArray - 法阵实例
     */
    async triggerTeleport(teleportArray) {
        if (!teleportArray || !teleportArray.isActive || !teleportArray.targetMapId) {
            return;
        }

        if (!this.player) return;

        // 战场入口（主线四）：走 Boss 战场流程（记录返回点，便于死亡/胜利后回到法阵旁）
        if (teleportArray.bossArena) {
            return this.enterBossArena(teleportArray);
        }

        this.player.isInteracting = true;
        this.inputManager.setMovementBlocked(true);

        try {
            console.log(`[传送] 进入 ${teleportArray.targetMapId}`);
            await this.switchToMap(teleportArray.targetMapId, teleportArray.targetPosition);
        } finally {
            this.player.isInteracting = false;
            this.inputManager.setMovementBlocked(false);
        }
    }

    /**
     * 进入摄风山魈战场（主线四《山口不止风》）
     * - 记录法阵位置作为返回点（战败后落回法阵旁；胜利后由战场内归途法阵回到这里）
     * - 玩家数据（气血、灵力、速度、伤害、技能等）随同一个 Player 实例进入战场，不做重置
     * - Boss 只生成一次：已被击败过（剧情标记）则不再生成，并保证地图正中心的归途法阵存在
     * @param {TeleportArray} teleportArray - 战场入口法阵
     */
    async enterBossArena(teleportArray) {
        if (!this.player || !teleportArray) return;

        const arenaMapId = teleportArray.targetMapId || this.bossArenaMapId;
        const dropPoint = this.getBossArenaReturnPoint(teleportArray);
        this.bossArenaReturn = dropPoint;

        this.player.isInteracting = true;
        this.inputManager.setMovementBlocked(true);

        try {
            const arenaMap = await this.switchToMap(arenaMapId, teleportArray.targetPosition);
            if (!arenaMap) return;

            // 预加载 Boss 精灵图（上次战斗结束时已释放，避免第二次进场出现空帧）
            await this.preloadBossArenaImages();

            // Boss 就位：只在"尚未被击败"时生成（击败过则整场不再出现）
            const defeated = this.hasBossShanxiaoDefeated();
            if (arenaMap.setArenaBossDefeated) {
                arenaMap.setArenaBossDefeated(defeated);
            }
            if (defeated) {
                // 永久归途法阵：地图正中心，落点＝进场时的"原来位置"
                this.ensureBossArenaExitArray(arenaMap);
            } else if (arenaMap.ensureArenaBoss) {
                arenaMap.ensureArenaBoss();
            }

            // 新一场战斗：允许本次胜利结算（记标记 / 开法阵）
            this.bossArenaVictoryHandled = false;

            console.log(`[Boss战场] 进入 ${arenaMap.name}（返回点 ${Math.round(dropPoint.x)}, ${Math.round(dropPoint.y)}）`);
            this.addGameNotification(`进入${arenaMap.name}`);
        } finally {
            this.player.isInteracting = false;
            this.inputManager.setMovementBlocked(false);
        }
    }

    /**
     * 预加载战场 Boss 相关精灵图（进场时调用）
     * 资源键统一维护在 ResourceManager.resourceGroups.bossArena（单一数据源）
     * ShanxiaoBoss.destroy() 会释放这些图片缓存，因此再次进场需要重新加载
     */
    async preloadBossArenaImages() {
        if (!this.resourceManager) return;

        // 优先走资源分组：键列表只在 ResourceManager 里维护一份
        if (typeof this.resourceManager.preloadResourceGroup === 'function') {
            await this.resourceManager.preloadResourceGroup('bossArena');
            return;
        }

        // 兜底：不支持资源分组的旧版 ResourceManager
        if (!this.resourceManager.loadImages) return;
        await this.resourceManager.loadImages([
            'monsters.boss_shanxiao_idle',
            'monsters.boss_shanxiao_walk',
            'monsters.boss_shanxiao_attack',
            'monsters.boss_shanxiao_skill1',
            'monsters.boss_shanxiao_skill2',
            'monsters.boss_shanxiao_hurt',
            'monsters.boss_shanxiao_dead',
            'effects.boss_pounce_dust',
            'effects.boss_charge_wind',
        ]);
    }

    /**
     * 清理战场：删除 Boss 实体并释放其资源（战败离场时调用）
     * @returns {boolean} 是否执行了清理
     */
    clearBossArenaResources() {
        const arenaMap = this.mapManager && this.mapManager.getMap
            ? this.mapManager.getMap(this.bossArenaMapId)
            : null;

        if (!arenaMap || !arenaMap.clearArenaBoss) {
            return false;
        }

        return arenaMap.clearArenaBoss();
    }

    /**
     * 战败后回到法阵旁（主线四）
     * - 复活并落回法阵旁，不发放战利品
     * - 胜利不再走这里：Boss 伏诛后由 handleBossArenaVictory 在战场正中心开启永久归途法阵，
     *   玩家自行按 E 返回原来位置（回归后的 switchToMap 会依任务目标补生成阵核 / 名册匣）
     * @returns {Promise<boolean>} 是否成功返回
     */
    async returnFromBossArena() {
        if (!this.player || this.isReturningFromBossArena) return false;

        const dropPoint = this.bossArenaReturn || this.getBossArenaReturnPoint();
        const mapId = dropPoint.mapId || 'qinglan_fuye';

        this.isReturningFromBossArena = true;
        try {
            const backMap = await this.switchToMap(mapId, { x: dropPoint.x, y: dropPoint.y });
            if (!backMap) return false;

            // 清理战场：删除摄风山魈并释放其资源（再次进场会重新生成，直到它被击败）
            this.clearBossArenaResources();

            // 落回法阵旁后复活（气血/灵力恢复，短暂无敌）
            if (!this.player.isAlive && this.player.revive) {
                this.player.revive({ x: dropPoint.x, y: dropPoint.y });
            }

            console.log('[Boss战场] 玩家战败，已回到法阵旁');
            this.addGameNotification('被山魈击退，回到法阵旁');

            return true;
        } finally {
            this.isReturningFromBossArena = false;
        }
    }

    /**
     * 摄风山魈是否已被击败（剧情标记；击败后战场不再生成 Boss）
     * @returns {boolean}
     */
    hasBossShanxiaoDefeated() {
        const questSystem = this.player && this.player.questSystem;
        if (!questSystem || typeof questSystem.hasStoryFlag !== 'function') return false;
        return questSystem.hasStoryFlag(this.bossArenaDefeatedFlag || 'boss_shanxiao_defeated');
    }

    /**
     * 在战场地图正中心生成 / 刷新永久归途法阵
     * 目标落点＝进场时记录的"原来位置"（山口法阵旁）
     * @param {GameMap} [arenaMap] - 战场地图实例（缺省时从 MapManager 取）
     * @returns {TeleportArray|null}
     */
    ensureBossArenaExitArray(arenaMap) {
        const map = arenaMap || (this.mapManager && this.mapManager.getMap
            ? this.mapManager.getMap(this.bossArenaMapId)
            : null);

        if (!map || typeof map.createArenaExitArray !== 'function') return null;

        const dropPoint = this.bossArenaReturn || this.getBossArenaReturnPoint();
        return map.createArenaExitArray({
            targetMapId: dropPoint.mapId || 'qinglan_fuye',
            targetPosition: { x: dropPoint.x, y: dropPoint.y },
            promptText: '按 E 返回青岚浮野',
        });
    }

    /**
     * 摄风山魈伏诛结算（战败动画播完后由 updateBossArenaBattle 调用，只执行一次）
     * 1) 记录剧情标记 boss_shanxiao_defeated → 之后进场不再生成 Boss
     * 2) 推进主线四"击败摄风山魈"目标
     * 3) 清理 Boss 实体（释放精灵图缓存）
     * 4) 在战场地图正中心开启永久归途法阵（按 E 回到原来位置）
     * 战利品（阵核 / 名册匣）在玩家用法阵回到青岚浮野时按任务目标补生成。
     * @param {GameMap} [arenaMap] - 战场地图实例
     */
    handleBossArenaVictory(arenaMap) {
        if (this.bossArenaVictoryHandled) return;

        const map = arenaMap || this.currentMap;
        if (!map || map.mapId !== this.bossArenaMapId) return;

        this.bossArenaVictoryHandled = true;

        // 1) 剧情标记（读档 / 再次进场时据此不再生成 Boss）
        this.setStoryFlag(this.bossArenaDefeatedFlag || 'boss_shanxiao_defeated');

        // 2) 推进主线四"击败摄风山魈"目标
        if (this.player && this.player.questSystem) {
            this.player.questSystem.updateQuestProgress(
                'chapter1_main_4', 'defeat_boss', 'boss_shanxiao', 1
            );
        }

        // 3) 清理 Boss 实体（地图记住"已被击败"，之后 ensureArenaBoss 不再生成）
        if (typeof map.setArenaBossDefeated === 'function') {
            map.setArenaBossDefeated(true);
        } else {
            this.clearBossArenaResources();
        }

        // 4) 地图正中心开启永久归途法阵
        this.ensureBossArenaExitArray(map);

        console.log('[Boss战场] 摄风山魈已伏诛，战场中央已开启归途法阵');
        this.addGameNotification('摄风山魈已伏诛，战场中央已开启归途法阵');
    }

    /**
     * 计算“法阵旁”的落点（世界坐标，像素）
     * 优先使用进场时记录的法阵位置；读档直接进入战场时回落到配置中的战场法阵。
     * @param {TeleportArray} [teleportArray] - 可选：直接指定法阵
     * @returns {{mapId: string, x: number, y: number}}
     */
    getBossArenaReturnPoint(teleportArray) {
        const OFFSET_Y = 88;    // 落在法阵下缘外侧，避免正好站在法阵中心

        const arrayPosition = teleportArray && teleportArray.position
            ? teleportArray.position
            : this.findBossArenaTeleportPosition();

        if (arrayPosition) {
            return {
                mapId: 'qinglan_fuye',
                x: arrayPosition.x,
                y: arrayPosition.y + OFFSET_Y,
            };
        }

        // 兜底：与 Chapter1Config 中主线四法阵的世界坐标保持一致（2946, 231）
        return { mapId: 'qinglan_fuye', x: 2946, y: 231 + OFFSET_Y };
    }

    /**
     * 在已加载的地图中查找战场入口法阵的位置（世界坐标）
     * @returns {Object|null}
     */
    findBossArenaTeleportPosition() {
        if (!this.mapManager || !this.mapManager.getMap) return null;
        const qinglan = this.mapManager.getMap('qinglan_fuye');
        if (!qinglan || !qinglan.teleporters) return null;
        for (const [, teleport] of qinglan.teleporters) {
            if (teleport && teleport.bossArena && teleport.position) {
                return teleport.position;
            }
        }
        return null;
    }

    /**
     * 遍历当前地图的所有传送法阵，根据任务状态控制可见性
     * （主线四的山口法阵在接取 chapter1_main_4 后才出现）
     * @param {GameMap} gameMap - 地图实例
     */
    updateTeleportQuestGates(gameMap) {
        const map = gameMap || this.currentMap;
        if (!map || !map.teleporters || !this.player || !this.player.questSystem) return;
        for (const [, teleport] of map.teleporters) {
            if (teleport && teleport.updateQuestGate) {
                teleport.updateQuestGate(this.player.questSystem);
            }
        }
    }

    /**
     * 开始NPC交互
     * @param {NPC} npc - NPC实例
     */
    startNPCInteraction(npc) {
        // 设置玩家交互状态
        this.player.isInteracting = true;
        this.inputManager.setMovementBlocked(true);
        
        // 面向NPC
        npc.faceTarget(this.player.position);
        
        // ===== 清空上一对话缓存，防止跨NPC消息残留 =====
        this.dialogBox.dialogueLines = [];
        this.dialogBox.currentText = '';
        this.dialogBox.displayedText = '';
        this.dialogBox.currentSpeakerName = '';
        this.dialogBox.isTyping = false;
        this.dialogBox.currentLineIndex = 0;
        
        // 根据任务进度选择对话ID
        const dialogueId = this.getDialogueForNPC(npc);

        // ===== 推进 talk_to 任务目标（在 getDialogueForNPC 之后执行） =====
        // 与 NPC 对话时，自动推进所有 active 任务中 type='talk_to' 且 target=该NPC 的目标
        // 必须在 getDialogueForNPC 之后执行，以免影响当前对话选择（如 talk_to 未完成时显示初次教学）
        if (this.player && this.player.questSystem) {
            for (const [questId] of this.player.questSystem.getActiveQuests()) {
                this.player.questSystem.updateQuestProgress(questId, 'talk_to', npc.id);
            }
        }

        // 开始对话
        npc.startDialogue(this.player, dialogueId);
        
        // 设置对话框
        this.dialogBox.show();
        
        const currentDialogue = npc.dialogueSystem.currentDialogue;
        if (currentDialogue) {
            this.dialogBox.setText(
                currentDialogue.text,
                npc.name
            );
        }
        
        // 绑定对话推进
        this.dialogBox.onAdvance = () => {
            this.advanceDialogue(npc);
        };

        // 设置 NPC 的任务发布回调
        npc.onAssignQuest = (questId) => {
            const success = this.player.questSystem.acceptQuest(questId);
            if (!success) {
                console.warn(`[Main] 任务 ${questId} 接受失败（前置条件未满足或已接受）`);
            }
        };

        // 设置 NPC 的商店回调
        npc.onOpenShop = () => {
            if (this.shop) {
                this.shop.open(npc, this.player);
                this.dialogBox.hide();
            }
        };

        // ===== 设置对话结束回调：处理 on_complete =====
        npc.dialogueSystem.onDialogueEnd = () => {
            this.handleDialogueComplete(npc);
        };

        // ===== 设置训练回调：处理 start_basic_training 动作 =====
        npc.onStartTraining = () => {
            this.handleStartTraining(npc);
        };

        // ===== 设置定息引气回调：处理 start_breath_heal_sequence 动作 =====
        npc.onBreathHeal = () => {
            this.startBreathHealSequence(npc);
        };

        // ===== 设置风桥护送回调：处理 start_wind_bridge_rescue 动作（周叔过桥） =====
        npc.onWindBridgeRescue = () => {
            this.startWindBridgeRescue(npc);
        };

        // ===== 设置筑基调息回调：处理 start_foundation_trial 动作（章末：祁伯） =====
        npc.onFoundationTrial = () => {
            this.startFoundationTrial(npc);
        };

        // ===== 对话选项动作（set_profession_* / trial_profession_* 等） =====
        npc.dialogueSystem.onOptionSelected = (option) => {
            if (option && option.action) {
                this.handleDialogueOptionAction(option.action);
            }
        };
    }

    /**
     * 根据玩家任务进度获取 NPC 当前应显示的对话 ID
     * @param {NPC} npc
     * @returns {string|null}
     */
    getDialogueForNPC(npc) {
        try {
            if (window.Chapter1Config && this.player && this.player.questSystem) {
                const dialogueId = Chapter1Config.getDialogueForNPC(npc.id, this.player.questSystem, this.player.questItemSystem);
                if (dialogueId) {
                    console.log(`[Main] NPC ${npc.id} → 对话: ${dialogueId}`);
                    return dialogueId;
                }
            }
        } catch (e) {
            console.warn('[Main] getDialogueForNPC 错误:', e);
        }
        return null;
    }

    /**
     * 处理对话结束时的 on_complete 回调
     * @param {NPC} npc
     */
    handleDialogueComplete(npc) {
        const onCompleteList = npc.dialogueSystem.getCurrentOnComplete();
        if (!onCompleteList || onCompleteList.length === 0) return;
        
        console.log(`[Main] 对话结束，处理 on_complete:`, onCompleteList);
        
        for (const action of onCompleteList) {
            switch (action) {
                case 'teach_basic_skills':
                    // 教学基本技能 + 启动训练场景（在中央广场放置训练目标）
                    console.log('[Main] 传授基础技能: 灵息弹、护体术，启动训练');
                    if (this.trainingManager && !this.trainingManager.isActive) {
                        this.trainingManager.startBasicTraining();
                        this.addGameNotification('前往中央广场完成基础训练！');
                    }
                    break;
                    
                case 'complete_quest_chapter1_main_1':
                    // 任务完成时的交付对话，任务已完成，无需额外操作
                    console.log('[Main] 主线一交付对话结束');
                    break;

                // ===== 章末：筑基 → 桥边寻阿禾 → 登船 =====
                case 'unlock_foundation_breakthrough':
                    // 主线四交付完成 → 解锁筑基调息（祁伯对话规则 whenStoryFlag: foundation_unlocked）
                    this.setStoryFlag('foundation_unlocked');
                    this.addGameNotification('可以去找祁伯完成筑基调息了');
                    break;

                case 'complete_foundation_trial':
                    // 筑基结算：境界提升 + 推进 chapter1_ending_1（完成后阿禾迁往码头）
                    this.completeFoundationTrial();
                    break;

                case 'unlock_yunduze':
                    this.setStoryFlag('yunduze_unlocked');
                    this.addGameNotification('云渡泽航线已解锁');
                    break;

                // 注：原 'open_profession_selection'（筑基后续接择道）已随“本版本不做职业选择”移除；
                // 择道节点仍保留在 Chapter1Config 中，后续版本恢复时把该分支加回即可。

                case 'set_profession_sword':
                case 'set_profession_mage':
                case 'set_profession_body':
                case 'set_profession_talisman':
                    this.applyProfessionAction(action);
                    break;

                case 'complete_profession_selection':
                    // 择道完成 → 祁伯对话规则切换为“换传承说明”
                    this.setStoryFlag('profession_chosen');
                    break;

                case 'record_farewell_done':
                    // 码头告别（阿禾 farewell）已完成 → 读档/重新进图时补生成登船路标
                    this.setStoryFlag('chapter1_farewell_done');
                    break;

                case 'create_depart_signpost':
                    // 告别对话结束 → 在码头 (2566, 1419) 生成永久登船路标
                    this.createDepartSignpost(this.currentMap);
                    break;

                case 'trial_profession_sword':
                case 'trial_profession_mage':
                case 'trial_profession_body':
                case 'trial_profession_talisman':
                case 'open_free_trial':
                case 'open_respec_confirm':
                case 'open_skill_config':
                    // 职业试用 / 重塑 / 技能配置界面尚未实现 → 仅提示，避免出现“未处理动作”警告
                    this.addGameNotification('该功能将在后续版本开放');
                    break;

                default:
                    // 支持 on_complete 中写 accept_quest_xxx / start_quest_xxx
                    if (action.startsWith('accept_quest_') || action.startsWith('start_quest_')) {
                        const questId = action.replace(/^(accept_quest_|start_quest_)/, '');
                        if (this.player && this.player.questSystem) {
                            this.player.questSystem.acceptQuest(questId);
                        }
                    } else if (action.startsWith('complete_quest_')) {
                        // 主线结算由 updateQuestProgress / completeQuest 完成，此处仅记录
                        const questId = action.replace(/^complete_quest_/, '');
                        console.log(`[Main] 主线交付对话结束: ${questId}`);
                    } else if (action === 'move_zhoushu_to_village') {
                        // 周叔迁往获救点（与风桥护送的落点共用同一数据源）
                        const map = this.currentMap;
                        const zhoushu = map && map.npcs ? map.npcs.get('zhoushu') : null;
                        if (zhoushu && zhoushu.repositionWorld) {
                            const rescued = this.getZhoushuRescuedWorldPosition(map);
                            zhoushu.repositionWorld(rescued.x, rescued.y, map);
                        }
                    } else if (action.startsWith('record_') || action.startsWith('mark_')
                        || action.startsWith('hint_') || action.startsWith('switch_')) {
                        // 剧情标记类动作：只做记录，无额外运行时逻辑
                        console.log(`[Main] 剧情记录: ${action}`);
                    } else {
                        console.warn(`[Main] 未处理的 on_complete 动作: ${action}`);
                    }
                    break;
            }
        }
    }

    /**
     * 周叔获救后的落点（世界坐标，像素）
     * 单一数据源：Chapter1Config 中 zhoushu.moveWorldPositions.rescued（像素，优先）
     * 未配置时回落到 zhoushu.movePositions.rescued（瓦片）再换算
     * @param {GameMap} map - 当前地图实例（瓦片换算/兜底用，可省略）
     * @returns {Object} 世界坐标 {x, y}（像素）
     */
    getZhoushuRescuedWorldPosition(map) {
        const fallbackTile = { x: 71, y: 36 };
        const zhoushuConfig = (window.Chapter1Config && Chapter1Config.getNPCConfigs)
            ? (Chapter1Config.getNPCConfigs().zhoushu || {})
            : {};

        // 1）精确世界坐标（像素）
        const worldPos = zhoushuConfig.moveWorldPositions && zhoushuConfig.moveWorldPositions.rescued;
        if (worldPos) {
            return { x: worldPos.x, y: worldPos.y };
        }

        // 2）瓦片坐标 → 世界坐标
        const tilePos = (zhoushuConfig.movePositions && zhoushuConfig.movePositions.rescued) || fallbackTile;
        const currentMap = map || this.currentMap;
        if (currentMap && currentMap.tileToWorld) {
            return currentMap.tileToWorld(tilePos.x, tilePos.y);
        }
        return { x: tilePos.x * 32, y: tilePos.y * 32 };
    }

    /**
     * 处理基础训练开始
     * @param {NPC} npc - 训练导师 NPC
     */
    handleStartTraining(npc) {
        console.log('[Main] 开始基础训练');
        
        // 启动训练场景（在中央广场放置训练目标）
        if (this.trainingManager && !this.trainingManager.isActive) {
            this.trainingManager.startBasicTraining();
            this.addGameNotification('前往中央广场完成基础训练！');
        } else if (this.trainingManager && this.trainingManager.isActive) {
            this.addGameNotification('训练目标已放置，前往中央广场完成！');
        }
        // 注意：不在此处 endNPCInteraction，由 DialogueSystem.selectOption 中的对话结束逻辑自动处理
    }

    /**
     * 风桥护送：周叔过桥（主线三《散落的炊烟》）
     * - 玩家在周叔对话中选择"护送周叔过桥"后触发
     * - 前置门控：必须先询问柳婶（chapter1_main_3 的 talk_to liushen 完成 → rescue 成为当前待完成目标），
     *   否则不护送、不搬迁、不推进任务（防止“找祁伯接完任务就直接救回周叔”）
     * - 直接将周叔迁往获救后的地点（Chapter1Config: zhoushu.moveWorldPositions.rescued，世界坐标 2300,1160）
     * - 推进 chapter1_main_3 的 rescue/zhoushu 目标
     * @param {NPC} npc - 周叔 NPC（当前交互对象）
     */
    startWindBridgeRescue(npc) {
        const map = this.currentMap;
        if (!map || !map.npcs) return;

        const zhoushu = map.npcs.get('zhoushu') || npc;
        if (!zhoushu) return;

        // ===== 门控：必须先询问柳婶（main_3 的 talk_to liushen 完成 → rescue 才成为当前待完成目标）=====
        // 未满足时不护送、不搬迁、不推进任务，避免接完祁伯的任务就能跳过柳婶直接救人。
        const questSystem = this.player ? this.player.questSystem : null;
        if (questSystem && typeof questSystem.isObjectiveCurrent === 'function'
            && !questSystem.isObjectiveCurrent('chapter1_main_3', 'rescue', 'zhoushu')) {
            console.warn('[Main] 尚未询问柳婶周叔的去向，无法开始风桥护送');
            this.addGameNotification('先去问柳婶，才知道周叔的去向');
            return;
        }

        // 获救地点取自章节配置（与 Main.onQuestComplete(main_3) / move_zhoushu_to_village 共用同一数据源）
        const rescued = this.getZhoushuRescuedWorldPosition(map);

        if (zhoushu.repositionWorld) {
            zhoushu.repositionWorld(rescued.x, rescued.y, map);
            console.log(`[Main] 风桥护送完成，${zhoushu.name} 已迁往获救地点 (${Math.round(rescued.x)}, ${Math.round(rescued.y)})`);
        }

        // 推进"救回周叔"目标（门控保证此刻它正是 main_3 的当前待完成目标）
        if (this.player && this.player.questSystem) {
            this.player.questSystem.updateQuestProgress('chapter1_main_3', 'rescue', 'zhoushu', 1);
        }

        this.addGameNotification('周叔已安全过桥');
    }

    /**
     * 定息引气：阿禾为阿砚疗伤的动画序列
     * - 对话结束后播放，通过 setTimeout(0) 让 endNPCInteraction 先执行完毕再重新锁定输入
     * - 阿禾向左转，循环播放 heal 动画5秒
     * - 5秒后阿禾恢复朝下 idle
     * - 再过2秒（共7秒）阿砚切换为站立 idle
     * - 期间玩家操作被禁止
     * @param {NPC} npc - 阿禾 NPC
     */
    startBreathHealSequence(npc) {
        console.log('[Main] 开始定息引气序列');

        // 让当前对话结束流程（endNPCInteraction）先执行完毕，再重新锁定输入
        setTimeout(() => {
            // 锁定玩家操作
            this.player.isInteracting = true;
            this.inputManager.setMovementBlocked(true);

            const map = this.currentMap;
            if (!map) return;

            const ahe = map.npcs.get('ahe');
            const ayan = map.npcs.get('ayan');
            if (!ahe || !ayan) return;

            // 1. 锁定阿禾动画（阻止 updateAnimation 覆盖），向左转，播放 heal 循环5秒
            ahe.animationOverridden = true;
            ahe.facing = 'left';
            ahe.animationManager.setDirection('left');
            if (ahe.animationManager.hasAnimation('heal')) {
                ahe.setAnimation('heal', { loop: true });
                console.log('[Main] 阿禾开始治疗动画（5秒）');
            } else {
                console.warn('[Main] Ahe 没有 heal 动画');
            }

            // 2. 5秒后：阿禾恢复朝下 idle，解锁动画
            setTimeout(() => {
                ahe.animationOverridden = false;
                ahe.facing = 'down';
                ahe.setIdleAnimation();
                console.log('[Main] 阿禾治疗动画结束');

                // 3. 再过2秒后（总共7秒）：锁定阿砚动画，切换为站立 idle（持续保持，不被 updateAnimation 覆盖）
                setTimeout(() => {
                    ayan.animationOverridden = true;
                    if (ayan.animationManager.hasAnimation('stand_idle')) {
                        ayan.setAnimation('stand_idle', { loop: true });
                        ayan.setNpcState('healed', true);
                        console.log('[Main] 阿砚被治愈，切换为站立动画');
                    }

                    // 4. 推进定息引气任务目标（complete_minigame）
                    if (this.player && this.player.questSystem) {
                        this.player.questSystem.updateQuestProgress('chapter1_main_2', 'complete_minigame', 'breath_control', 1);
                        console.log('[Main] 定息引气任务目标已完成');
                    }

                    // 5. 解除玩家操作锁定
                    this.player.isInteracting = false;
                    this.inputManager.setMovementBlocked(false);
                    console.log('[Main] 定息引气序列完成，恢复玩家操作');
                }, 2000);
            }, 5000);
        }, 0);
    }

    // ==================== 章末：筑基调息 → 桥边寻阿禾 → 登船 ====================

    /**
     * 开始“筑基调息”（章末剧情，由祁伯对话选项 action: start_foundation_trial 触发）
     * 流程：禁键盘输入 → 主角朝下静立 → 背后播放筑基气场 5 秒 → 续接 breakthrough_success 对话
     * @param {NPC} npc - 当前交互的 NPC（祁伯）
     */
    startFoundationTrial(npc) {
        console.log('[Main] 开始筑基调息');

        // 让当前对话的结束流程（endNPCInteraction 会解除输入锁）先执行完，再重新锁定
        setTimeout(() => {
            if (!this.player) return;

            // 1. 锁定一切输入（移动 / 战斗 / 交互 / 键盘）
            this.foundationTrialNPC = npc || null;
            this.isFoundationTrialPlaying = true;
            this.player.isInteracting = true;
            this.inputManager.setMovementBlocked(true);
            this.inputManager.setInputBlocked(true);

            // 2. 主角朝下静立（movementBlocked 时 Player.updateMovement 不会改写朝向）
            this.player.facing = 'down';
            this.player.animationManager.setDirection('down');
            if (this.player.playIdleAnimation) this.player.playIdleAnimation();

            // 3. 背后播放筑基气场（时长取自 PlayerCombatSystem.CONFIG.foundationAura.duration，默认 5 秒）
            const auraConfig = this.playerCombat && this.playerCombat.config
                ? this.playerCombat.config.foundationAura : null;
            const duration = auraConfig ? auraConfig.duration : 5;
            this.foundationTrialTimer = duration;
            if (this.playerCombat && this.playerCombat.playFoundationAura) {
                this.playerCombat.playFoundationAura(duration);
            }

            this.addGameNotification('筑基调息……');
        }, 0);
    }

    /**
     * 推进筑基调息计时（updateGameWorld 中每帧调用，到时结束序列）
     * @param {number} deltaTime - 时间增量（秒）
     */
    updateFoundationTrial(deltaTime) {
        this.foundationTrialTimer -= deltaTime;
        if (this.foundationTrialTimer > 0) return;
        this.finishFoundationTrial();
    }

    /**
     * 结束筑基调息：停止气场、解锁输入并续接“筑基成功”对话
     */
    finishFoundationTrial() {
        this.foundationTrialTimer = 0;
        this.isFoundationTrialPlaying = false;

        if (this.playerCombat && this.playerCombat.stopFoundationAura) {
            this.playerCombat.stopFoundationAura();
        }

        this.inputManager.setInputBlocked(false);
        this.inputManager.setMovementBlocked(false);

        // 续接对话：breakthrough_success（其 on_complete 负责筑基结算 / 解锁云渡泽 / 接取《桥边寻阿禾》）
        const npc = this.foundationTrialNPC || (this.player ? this.player.nearbyNPC : null);
        this.foundationTrialNPC = null;

        if (npc && this.showDialogueNode(npc, 'breakthrough_success')) {
            console.log('[Main] 筑基调息结束，续接 breakthrough_success 对话');
            return;
        }

        if (this.player) this.player.isInteracting = false;
        console.warn('[Main] 筑基调息结束，但未找到 breakthrough_success 对话节点');
    }

    /**
     * 直接展示某个对话节点（用于剧情序列结束后续接对话，如筑基成功）
     * @param {NPC} npc - 对话对象
     * @param {string} dialogueId - 对话节点 ID
     * @returns {boolean} 是否成功展示
     */
    showDialogueNode(npc, dialogueId) {
        if (!npc || !npc.dialogueSystem || !npc.dialogueSystem.getDialogue) return false;

        const dialogue = npc.dialogueSystem.getDialogue(dialogueId);
        if (!dialogue) {
            console.warn(`[Main] 对话节点不存在: ${dialogueId}`);
            return false;
        }

        this.player.isInteracting = true;
        this.inputManager.setMovementBlocked(true);

        // 清空上一段对话残留（与 startNPCInteraction 保持一致）
        this.dialogBox.dialogueLines = [];
        this.dialogBox.currentText = '';
        this.dialogBox.displayedText = '';
        this.dialogBox.currentSpeakerName = '';
        this.dialogBox.isTyping = false;
        this.dialogBox.currentLineIndex = 0;

        npc.startDialogue(this.player, dialogueId);
        this.dialogBox.show();
        this.dialogBox.setText(dialogue.text, npc.name);

        this.dialogBox.onAdvance = () => {
            this.advanceDialogue(npc);
        };
        npc.dialogueSystem.onDialogueEnd = () => {
            this.handleDialogueComplete(npc);
        };

        return true;
    }

    /**
     * 筑基结算（对话 on_complete: complete_foundation_trial）
     * - 记录剧情标记 → 境界提升（练气圆满 → 筑基）→ 推进 chapter1_ending_1 的 complete_foundation_trial 目标
     *   （目标完成 → onQuestComplete 把阿禾迁到码头送别位）
     * - 数值按筑基境界写满：气血上限 200 / 灵息上限 100，两项当前值同时回满（见 applyFoundationRealmStats）
     */
    completeFoundationTrial() {
        this.setStoryFlag('foundation_trial_done');

        if (this.player && typeof this.player.breakthrough === 'function') {
            const advanced = this.player.breakthrough();
            if (advanced) {
                this.addGameNotification(`筑基已成（${this.player.playerData.realm}）`);
            } else {
                console.warn('[Main] 境界提升未生效：需练气圆满（剧情流程继续）');
            }
        }

        // 数值兜底：不论上面是否走到境界提升，筑基调息结束都必须拿到筑基数值
        // （气血上限 200 / 灵息上限 100 并回满），避免练气未到圆满时数值不生效。
        this.applyFoundationRealmStats();

        if (this.player && this.player.questSystem) {
            this.player.questSystem.updateQuestProgress('chapter1_ending_1', 'complete_foundation_trial', 'foundation', 1);
        }
    }

    /**
     * 筑基数值：按 GameConfig 的 ZHUJI 境界配置写满玩家数据
     * - 境界 / 小阶段 → 筑基·初期；气血上限 200、灵息上限 100（唯一数据源：GameConfig.realms.ZHUJI）；
     * - 当前气血 / 灵息一并回满（调息成功即巅峰状态）；
     * - 重复调用幂等（数值相同，不会叠加）。
     * @returns {boolean} 是否成功写入（缺少玩家或境界配置时返回 false）
     */
    applyFoundationRealmStats() {
        if (!this.player || !this.player.playerData) return false;

        const realmConfig = GameConfig.getInstance().getRealm('zhuji');
        if (!realmConfig) {
            console.warn('[Main] 缺少筑基境界配置（GameConfig.realms.ZHUJI），无法写入筑基数值');
            return false;
        }

        const data = this.player.playerData;
        data.realm = realmConfig.id || 'zhuji';
        data.stage = realmConfig.stages[0];
        data.maxHealth = realmConfig.maxHealth;
        data.maxMana = realmConfig.maxMana;
        data.health = realmConfig.maxHealth;
        data.mana = realmConfig.maxMana;

        // 移速等派生数值跟着当前境界重算（Player.getCurrentMoveSpeed）
        if (typeof this.player.getCurrentMoveSpeed === 'function') {
            this.player.moveSpeed = this.player.getCurrentMoveSpeed();
        }

        console.log(`[Main] 筑基数值已生效：气血 ${data.health}/${data.maxHealth}，灵息 ${data.mana}/${data.maxMana}`);
        return true;
    }

    /**
     * 处理对话选项动作（set_profession_* / trial_profession_* 等由 Chapter1Config 配置）
     * @param {string} action - 选项动作名
     */
    handleDialogueOptionAction(action) {
        if (!action) return;
        if (action.startsWith('set_profession_')) {
            this.applyProfessionAction(action);
        } else if (action.startsWith('trial_profession_')) {
            this.addGameNotification('职业试用将在后续版本开放');
        }
    }

    /**
     * 切换职业（set_profession_sword / mage / body / talisman）
     * @param {string} action - 选项动作名
     */
    applyProfessionAction(action) {
        const professionId = action.replace(/^set_profession_/, '');
        const player = this.player;
        if (!player || !player.professionSystem || typeof player.professionSystem.switchProfession !== 'function') {
            return;
        }

        if (player.professionSystem.switchProfession(professionId)) {
            console.log(`[Main] 已选择修行传承: ${professionId}`);
            this.addGameNotification('已选定修行传承');
        } else {
            console.warn(`[Main] 职业切换失败: ${professionId}`);
        }
    }

    /**
     * 生成“登船”路标（永久）
     * 数据源：Chapter1Config → maps.qinglan_fuye.chapterEnd.departSignpost（世界坐标 2566,1419）
     * 已存在同名路标时不重复生成；按 E → boardShipAndOpenWorldMap()
     * 美术：image / imageWidth / imageHeight 原样透传给 Signpost
     *      （当前为 'signposts.depart_boat' → assets/images/signposts/depart_boat.png，缺图回退程序化木牌）
     * @param {GameMap} gameMap - 地图实例
     * @returns {Signpost|null}
     */
    createDepartSignpost(gameMap) {
        const map = gameMap || this.currentMap;
        if (!map || !map.signposts || typeof Signpost !== 'function') return null;

        const chapterEnd = (map.mapConfig && map.mapConfig.chapterEnd) || {};
        const config = chapterEnd.departSignpost || {};
        const id = config.id || 'signpost_depart_boat';

        const existed = map.signposts.get(id);
        if (existed) return existed;   // 永久路标：已存在则不再生成

        const signpost = new Signpost({
            id: id,
            name: config.name || '登船',
            position: config.position || { x: 2566, y: 1419 },
            radius: config.radius || 56,
            promptText: config.promptText || '乘船离开',
            image: config.image || null,
            imageWidth: config.imageWidth || null,
            imageHeight: config.imageHeight || null,
            anchor: config.anchor || 'center',   // 图片对位：center 居中 / bottom 底边贴坐标
            oneShot: false,
            onActivate: () => this.boardShipAndOpenWorldMap(),
        });

        map.signposts.set(signpost.id, signpost);
        console.log(`[Main] 码头登船路标已生成 (${signpost.position.x}, ${signpost.position.y})`);
        this.addGameNotification('船已备好，按 E 键乘船离开');
        return signpost;
    }

    /**
     * 登船：结算章末任务并开启世界地图（第一章结束）
     */
    boardShipAndOpenWorldMap() {
        console.log('[Main] 登船离开青岚浮野');

        if (this.player && this.player.questSystem) {
            // 推进“登船离开”目标（完成后 chapter1_ending_3《登船辞行》完结）
            this.player.questSystem.updateQuestProgress('chapter1_ending_3', 'board_boat', 'depart_boat', 1);
        }
        this.setStoryFlag('chapter1_complete');
        this.addGameNotification('第一章 完 —— 云渡泽');

        // 切到世界地图（原 M 键打开世界地图的逻辑已移除，只在此剧情节点开启）
        if (this.mapTeleport && !this.mapTeleport.isVisible) {
            this.mapTeleport.show();
        }
    }

    /**
     * 按剧情标记恢复章末的舞台状态（重新进图 / 读档后保持一致）
     * - chapter1_ending_1 完成 → 阿禾迁到码头告别位
     * - chapter1_farewell_done 已记录 → 补生成永久登船路标
     * @param {GameMap} gameMap - 地图实例
     */
    applyChapterEndStage(gameMap) {
        const map = gameMap || this.currentMap;
        if (!map || !this.player || !this.player.questSystem) return;
        const qs = this.player.questSystem;

        if (typeof qs.isQuestCompleted === 'function' && qs.isQuestCompleted('chapter1_ending_1')) {
            const ahe = map.npcs ? map.npcs.get('ahe') : null;
            const chapterEnd = (map.mapConfig && map.mapConfig.chapterEnd) || {};
            const quayTile = chapterEnd.aheQuayTile || { x: 81, y: 44 };
            if (ahe && ahe.reposition) {
                ahe.reposition(quayTile.x, quayTile.y, map);
            }
        }

        if (typeof qs.hasStoryFlag === 'function' && qs.hasStoryFlag('chapter1_farewell_done')) {
            this.createDepartSignpost(map);
        }
    }

    /**
     * 设置剧情标记（QuestSystem.storyFlags；无 QuestSystem 时静默忽略）
     * @param {string} flag - 标记名
     * @param {*} [value=true] - 标记值
     */
    setStoryFlag(flag, value = true) {
        if (this.player && this.player.questSystem && this.player.questSystem.setStoryFlag) {
            this.player.questSystem.setStoryFlag(flag, value);
        }
    }

    /**
     * 显示游戏内通知
     * @param {string} message - 通知文本
     */
    addGameNotification(message) {
        console.log(`[通知] ${message}`);
        // 后续可扩展为屏幕上方淡入淡出的通知 UI
        // 目前先打印日志，如果有 notificationManager 则使用
        if (this.notificationManager && typeof this.notificationManager.addNotification === 'function') {
            this.notificationManager.addNotification(message);
        }
    }

    /**
     * 推进对话
     * @param {NPC} npc - NPC实例
     */
    advanceDialogue(npc) {
        const dialogueSystem = npc.dialogueSystem;
        const currentDialogue = dialogueSystem.currentDialogue;
        
        if (!currentDialogue) {
            this.endNPCInteraction(npc);
            return;
        }
        
        // 检查是否有选项
        const options = dialogueSystem.getCurrentOptions();
        
        if (options && options.length > 0) {
            // 渲染对话选项按钮
            this.renderDialogueOptions(options, npc);
        } else if (currentDialogue.next) {
            // 跳转到下一个对话
            const nextDialogue = dialogueSystem.getDialogue(currentDialogue.next);
            if (nextDialogue) {
                dialogueSystem.currentDialogue = nextDialogue;
                this.dialogBox.setText(nextDialogue.text, npc.name);
            } else {
                this.endNPCInteraction(npc);
            }
        } else {
            this.endNPCInteraction(npc);
        }
    }

    /**
     * 渲染对话选项
     */
    renderDialogueOptions(options, npc) {
        this.dialogBox.clearOptionButtons();
        
        const buttonWidth = 400;
        const buttonHeight = 78;
        const buttonGap = 15;
        
        // 计算按钮组的总高度
        const totalHeight = options.length * buttonHeight + (options.length - 1) * buttonGap;
        
        // 计算起始Y坐标，使按钮组在对话框内垂直居中
        const dialogCenterY = 720 - this.dialogBox.height;
        const startY = dialogCenterY / 2 - totalHeight / 2;
        
        // 按钮水平居中
        const startX = this.dialogBox.x + (this.dialogBox.width - buttonWidth) / 2;
        
        options.forEach((option, index) => {
            const button = new UIButton({
                x: startX,
                y: startY + index * (buttonHeight + buttonGap),
                width: buttonWidth,
                height: buttonHeight,
                
                // ========== 在这里设置按钮图片 ==========
                backgroundImage: this.resourceManager.getCachedImage('ui.button_normal'),
                hoverImage: this.resourceManager.getCachedImage('ui.button_hover'),
                pressedImage: this.resourceManager.getCachedImage('ui.button_pressed'),
                
                text: option.text || `选项 ${index + 1}`,
                callback: () => {
                    this.selectDialogueOption(npc, option, index);
                },
            });
            
            this.dialogBox.addOptionButton(button);
        });

    }

    /**
     * 选择对话选项
     */
    selectDialogueOption(npc, option, optionIndex) {
        const result = npc.dialogueSystem.selectOption(optionIndex);
        
        // 清除选项按钮
        this.dialogBox.clearOptionButtons();
        
        // 如果打开了商店，不要结束交互（商店自行管理输入阻塞）
        if (this.shop && this.shop.isOpen) {
            return;
        }
        
        if (npc.dialogueSystem.isActive) {
            const currentDialogue = npc.dialogueSystem.currentDialogue;
            if (currentDialogue) {
                this.dialogBox.setText(currentDialogue.text, npc.name);
            }
        } else {
            this.endNPCInteraction(npc);
        }
    }

    /**
     * 结束NPC交互
     */
    endNPCInteraction(npc) {
        // ===== 清除对话框残留文字，防止下一NPC对话闪烁 =====
        this.dialogBox.dialogueLines = [];
        this.dialogBox.currentText = '';
        this.dialogBox.displayedText = '';
        this.dialogBox.currentSpeakerName = '';
        this.dialogBox.isTyping = false;
        this.dialogBox.currentLineIndex = 0;
        this.dialogBox.onAdvance = null; // 清除回调引用
        this.dialogBox.hide();
        this.player.isInteracting = false;
        this.inputManager.setMovementBlocked(false);
        npc.endDialogue();
    }

    /**
     * 开始怪物战斗
     * @param {Object} monster - 怪物实例
     */
    startMonsterBattle(monster) {
        if (!monster || !monster.isAlive) return;
        
        // 设置战斗类型
        const isBoss = monster instanceof Boss;
        const battleType = isBoss ? 
            BattleSystem.BattleType.ACTIVE : 
            BattleSystem.BattleType.ACTIVE;
        
        // 开始战斗
        this.battleSystem.startBattle({
            player: this.player,
            enemies: [monster],
            battleType: battleType,
        });
        
        // 切换到战斗场景
        this.sceneManager.switchScene('battle', {
            player: this.player,
            enemies: [monster],
            battleSystem: this.battleSystem,
        });
    }

    /**
     * 预加载初始资源
     */
    async preloadInitialResources() {
        console.log('开始预加载资源...');
        
        const resourceGroups = {
            images: [
                'worldMap.background',
                'worldMap.button_qinglan',
                'worldMap.button_yunduze',
                'worldMap.button_zhaochen',
                'worldMap.button_wuxiang',
                'mapBackgrounds.qinglan_fuye',
                'mapCollisions.qinglan_fuye',
                'player.sanxiu_idle',
                'player.sanxiu_walk',
                'player.sanxiu_skill',
                'player.sanxiu_attack',
                'player.sanxiu_hurt',
                'player.sanxiu_dead',
                'npc.ahe_idle',
                'npc.ahe_walk',
                'npc.ahe_heal',
                'npc.qibo_idle',
                'npc.qibo_walk',
                'npc.liushen_idle',
                'npc.liushen_walk',
                'npc.ayan_idle',
                'npc.ayan_stand_idle',
                'npc.ayan_walk',
                'npc.zhoushu_idle',
                'npc.zhoushu_walk',
                'monsters.fenglang_idle',
                'monsters.fenglang_attack',
                'monsters.fenglang_hurt',
                'monsters.fenglang_dead',
                'monsters.boss_shanxiao_idle',
                'monsters.boss_shanxiao_walk',
                'monsters.boss_shanxiao_attack',
                'monsters.boss_shanxiao_skill1',
                'monsters.boss_shanxiao_skill2',
                'monsters.boss_shanxiao_hurt',
                'monsters.boss_shanxiao_dead',
                // 战斗特效（摄风山魈：扑击扬尘 / 蓄力风旋）
                'effects.boss_pounce_dust',
                'effects.boss_charge_wind',
                // 战斗特效（主角：剑气 / 灵息弹 / 命中 / 护体术气场 / 闪避气场）
                'effects.player_sword_aura',
                'effects.player_lingxidan',
                'effects.player_lingxidan_hit',
                'effects.player_hutishu_aura',
                'effects.player_dodge_aura',
                'ui.dialog_box',
                'ui.task_panel',
                'ui.button_normal',
                // 自定义气血条 / 灵息条（HUD：外框 + 内条，规格见 js/PlayerCombat.js CONFIG.hud）
                'ui.health_bar_bg',
                'ui.health_bar_fill',
                'ui.mana_bar_bg',
                'ui.mana_bar_fill',
                // 左下角技能栏图标（U 灵息弹 / I 护体术 / L 闪避，规格 100×100；
                // 普通攻击 J 不占技能栏；缺图 / 尺寸不符时技能栏该格回退程序化方框）
                'ui.skill_lingxidan',
                'ui.skill_hutishu',
                'ui.skill_dodge',
                // 路标图标（采药点 / 章末长桥码头登船点；缺图时路标回退程序化木牌）
                'signposts.herb_collect',
                'signposts.depart_boat',
                // 任务物品图标
                'questItems.guixiang_pai',
                'questItems.hundeng',
                'questItems.yisha',
                'questItems.mingce',
                'questItems.zhenhe',
                'questItems.zhenfeng_heipian',
                'questItems.lingcao',
                // 主线四：山口传送法阵 + 摄风山魈战场地图
                'teleportArrays.boss_enter',
                'mapBackgrounds.boss_arena_ch1',
                'mapCollisions.boss_arena_ch1',
                // 小游戏资源（全部预加载，确保小游戏实例化时数据立即可用）
                'miniGame.caoyao_collision',
                'miniGame.caoyao_bg',
                'miniGame.caoyao_wind',
                'miniGame.caoyao_herb',
                'player.sanxiu_fly',
            ],
            audio: [
                'bgm.main_menu',
                'bgm.qinglan',
                'sfx.ui_click',
                'sfx.battle_attack',
                'sfx.battle_hit',
                'sfx.battle_skill',
                'sfx.battle_hurt',
                'sfx.battle_dead',
            ],
        };
        
        for (const imagePath of resourceGroups.images) {
            try {
                await this.resourceManager.loadImage(imagePath);
            } catch (error) {
                console.warn(`预加载图片失败: ${imagePath}`, error);
            }
        }
        
        for (const audioPath of resourceGroups.audio) {
            try {
                await this.resourceManager.loadAudio(audioPath);
            } catch (error) {
                console.warn(`预加载音频失败: ${audioPath}`, error);
            }
        }
        
        console.log('预加载资源完成');
    }

    /**
     * 创建玩家
     */
    createPlayer() {
        this.player = new Player({
            position: { x: 448, y: 1376 },
            playerData: {
                realm: 'lianqi',
                stage: '初期',
                health: 100,
                maxHealth: 100,
                mana: 50,
                maxMana: 50,
                lingShi: 0,
            },
            profession: {
                professionId: 'sanxiu',
            },
        });
        
        // 注入玩家战斗系统（受伤减伤 / 受伤僵直 / 施法打断等联动）
        if (this.playerCombat) {
            this.player.combatSystem = this.playerCombat;
        }

        // 绑定玩家回调
        this.player.onDeath = (player) => {
            console.log('玩家死亡');
            // 处理玩家死亡逻辑
        };
        
        this.player.onAttack = (attackData) => {
            // 战场内：普通攻击直接命中摄风山魈（不走野外战斗系统）
            if (this.currentMap && this.currentMap.mapId === this.bossArenaMapId
                && this.currentMap.arenaBoss) {
                this.currentMap.arenaBoss.handlePlayerAttack(attackData);
                return;
            }

            // 处理玩家攻击
            this.battleSystem.checkPlayerAttacks();
        };
        
        // 任务物品系统回调：当任务物品变更时更新任务进度
        this.player.questItemSystem.onItemChanged = (itemId, count) => {
            console.log(`[任务物品] ${itemId} 数量变更为 ${count}`);
        };
        
        // 设置任务系统引用
        this.questUI.setQuestSystem(this.player.questSystem);
        
        // 设置到游戏循环
        this.gameLoop.setPlayer(this.player);
        if (this.gameLoop.setPlayerCombat) {
            this.gameLoop.setPlayerCombat(this.playerCombat);
        }
        
        console.log('玩家创建完成');
    }

    /**
     * 加载初始地图
     */
    async loadInitialMap() {
        const mapId = 'qinglan_fuye';
        
        const gameMap = await this.mapManager.loadMap(mapId);
        
        if (!gameMap) {
            console.error(`初始地图加载失败: ${mapId}`);
            return;
        }
        
        // 设置当前地图
        this.currentMap = gameMap;
        gameMap.setPlayer(this.player);
        gameMap.activate();

        // 从地图配置创建可拾取物品
        this.createPickupItemsFromConfig(gameMap);

        // 根据任务状态控制路标可见性
        this.updateSignpostQuestGates(gameMap);

        // 根据任务状态刷新镇风桩可调查状态
        this.updateWindPileQuestGates(gameMap);

        // 根据任务状态刷新传送法阵可见性（主线四山口法阵）
        this.updateTeleportQuestGates(gameMap);

        // 按剧情标记恢复章末舞台状态（阿禾码头站位 / 登船路标）
        this.applyChapterEndStage(gameMap);

        // 设置摄像机边界
        const mapBounds = {
            minX: 0,
            minY: 0,
            maxX: gameMap.mapWidth * gameMap.tileSize - this.camera.width,
            maxY: gameMap.mapHeight * gameMap.tileSize - this.camera.height,
        };
        this.camera.setBounds(mapBounds.minX, mapBounds.minY, mapBounds.maxX, mapBounds.maxY);
        this.camera.setTarget(this.player);
        
        // 设置到游戏循环
        this.gameLoop.setCurrentMap(gameMap);
        this.gameLoop.setCamera(this.camera);
        
        console.log(`初始地图加载完成: ${gameMap.name}`);
    }

    /**
     * 遍历当前地图的所有路标，根据任务状态控制可见性
     * @param {GameMap} gameMap - 地图实例
     */
    updateSignpostQuestGates(gameMap) {
        if (!gameMap || !gameMap.signposts || !this.player || !this.player.questSystem) return;
        for (const [, signpost] of gameMap.signposts) {
            signpost.updateQuestGate(this.player.questSystem);
        }
    }

    /**
     * 从地图配置创建可拾取物品实例
     * @param {GameMap} gameMap - 地图实例
     */
    createPickupItemsFromConfig(gameMap) {
        const mapConfig = gameMap.mapConfig;
        if (!mapConfig || !mapConfig.pickupItems) return;

        const mapId = gameMap.mapId || (gameMap.mapConfig && gameMap.mapConfig.id);

        for (const key in mapConfig.pickupItems) {
            const config = mapConfig.pickupItems[key];

            // ===== 已经存在于地图上（或旧实例）→ 跳过 =====
            // 本方法会在任务目标推进（onQuestProgress）时被重复调用，需保持幂等
            if (gameMap.pickupItems && gameMap.pickupItems.has(config.id)) continue;
            
            // ===== 仅当任务需要时创建可拾取物品 =====
            // 条件：任务尚未完成，且关联的 find_item 目标尚未达成
            // 这样在任务未接取时物品可见，任务完成后自动消失
            if (config.questId && this.player && this.player.questSystem) {
                const qs = this.player.questSystem;
                // 任务已完成 → 不创建
                if (qs.isQuestCompleted(config.questId)) {
                    console.log(`[Main] 跳过拾取物 ${config.name}：任务 ${config.questId} 已完成`);
                    continue;
                }
                // 任务未接取（LOCKED）→ 暂存，等任务激活时再创建
                const questState = qs.getQuestState(config.questId);
                if (!questState || questState.state === 'locked') {
                    const pendingList = this.pendingQuestPickups[config.questId]
                        || (this.pendingQuestPickups[config.questId] = []);
                    // 去重：本方法会随任务进度反复调用，避免同一道具被反复暂存
                    if (!pendingList.some(p => p.config.id === config.id && p.mapId === mapId)) {
                        pendingList.push({ config, mapId });
                        console.log(`[Main] 暂存拾取物 ${config.name}：等待任务 ${config.questId} 激活`);
                    }
                    continue;
                }
                // ===== 需先完成前置目标才会出现（如空魂灯：调查破损运灯箱之后） =====
                // 未满足时不生成，等该目标完成时由 onQuestProgress 再次调用本方法生成
                if (config.requireObjective) {
                    const req = config.requireObjective;
                    const reqDone = qs.isObjectiveCompleted
                        ? qs.isObjectiveCompleted(config.questId, req.type, req.target)
                        : false;
                    if (!reqDone) {
                        console.log(`[Main] 拾取物 ${config.name} 尚未出现：需先完成 ${req.type}:${req.target}`);
                        continue;
                    }
                }

                // 任务进行中，但目标已达成 → 不创建
                if (questState.state === 'active') {
                    const findObj = (questState.objectives || []).find(obj => 
                        obj.type === config.objectiveType && obj.target === config.itemId);
                    if (findObj && findObj.completed) {
                        console.log(`[Main] 跳过拾取物 ${config.name}：目标已完成`);
                        continue;
                    }
                }
            }
            
            // 获取物品图片（可选）
            const image = this.resourceManager.getCachedImage(`questItems.${config.itemId}`);

            const pickupItem = new PickupItem({
                id: config.id,
                itemId: config.itemId,
                name: config.name,
                position: { ...config.position },
                count: config.count || 1,
                questId: config.questId || null,
                objectiveType: config.objectiveType || 'find_item',
                promptText: config.promptText || '按 E 拾取',
                image: image,
                radius: config.radius || 40,
            });

            gameMap.addPickupItem(pickupItem);
            console.log(`[Main] 创建拾取物: ${config.name} (${config.itemId}) 于 (${config.position.x}, ${config.position.y})`);
        }
    }

    /**
     * 设置游戏循环
     */
    setupGameLoop() {
        this.gameLoop.setPlayer(this.player);
        this.gameLoop.setCurrentMap(this.currentMap);
        this.gameLoop.setCamera(this.camera);
        this.gameLoop.setInputManager(this.inputManager);
        this.gameLoop.setSceneManager(this.sceneManager);
        
        // 添加更新回调
        this.gameLoop.addUpdateCallback((deltaTime, input) => {
            this.update(deltaTime, input);
        });
        
        // 添加渲染回调
        this.gameLoop.addRenderCallback((ctx, interpolation) => {
            this.render(ctx);
        });
    }

    /**
     * 更新游戏
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态
     */
    update(deltaTime, input) {
        const currentScene = this.sceneManager.getCurrentScene();
        
        if (!currentScene) return;
        
        switch (currentScene.sceneId) {
            case 'mainMenu':
                // 主菜单更新
                break;
                
            case 'gameWorld':
                this.updateGameWorld(deltaTime, input);
                break;
                
            case 'battle':
                this.updateBattle(deltaTime, input);
                break;
                
            case 'miniGame':
                this.updateMiniGame(deltaTime, input);
                break;
        }
        
        // 更新存档管理器（自动保存）
        if (this.saveManager) {
            this.saveManager.update(deltaTime);
        }
        
        // 清除输入帧状态
        this.inputManager.clearFrameState();
    }

    /**
     * 更新游戏世界
     */
    updateGameWorld(deltaTime, input) {
        // ===== 筑基调息（章末剧情）：封锁键盘 / 移动 / 战斗输入，只推进序列与气场特效 =====
        if (this.isFoundationTrialPlaying) {
            this.inputManager.setMovementBlocked(true);
            this.inputManager.setInputBlocked(true);
            if (this.playerCombat) {
                // 传空输入：仅让气场特效及其计时继续推进，不捕获任何战斗按键
                this.playerCombat.update(deltaTime, { pressedKeys: {} });
            }
            this.updateFoundationTrial(deltaTime);
            return;
        }

        // 更新商店界面（优先级最高）
        if (this.shop && this.shop.isOpen) {
            this.shop.update(deltaTime, input);
            this.inputManager.setMovementBlocked(true);
            return; // 商店打开时不再处理其他 UI 输入
        }
        
        // 更新地图传送界面（世界地图打开时：只处理地图本身，其它世界/UI输入一律不处理）
        if (this.mapTeleport.isVisible) {
            this.mapTeleport.update(deltaTime, input);
            this.inputManager.setMovementBlocked(true);
            return;
        } else {
            this.inputManager.setMovementBlocked(false);
        }
        
        // 更新任务UI
        if (this.questUI.isVisible) {
            this.questUI.update(deltaTime, input);
            this.inputManager.setMovementBlocked(true);
        }
        
        // 更新对话框
        if (this.dialogBox.isVisible) {
            this.dialogBox.update(deltaTime);
            
            // 更新对话选项按钮
            this.dialogBox.buttons.forEach(button => {
                button.update(
                    input.mouseX,
                    input.mouseY,
                    input.mousePressed,
                    input.mouseClicked,
                    deltaTime
                );
            });
            
            // 点击或按 J 键推进对话
            if (input.mouseClicked || input.pressedKeys['j']) {
                this.dialogBox.advance();
            }
        }
        
        // 更新战斗系统
        if (this.battleSystem.isInBattle) {
            this.battleSystem.update(deltaTime);
        }
        
        // 刷新镇风桩可调查状态（随任务进度实时变化）
        this.updateWindPileQuestGates(this.currentMap);

        // ====== 战场战斗流程（主线四） ======
        // 胜利：战败动画播完 → 一次性结算（记剧情标记 + 战场正中心开启永久归途法阵），不自动离场
        this.updateBossArenaBattle();

        // ====== 战场内死亡 → 回到法阵旁（主线四） ======
        // Boss 把玩家打至 isAlive=false 即会命中此分支；
        // 胜利离场改由战场内地图正中心的归途法阵（按 E）触发，不再有倒计时自动传送。
        if (!this.isReturningFromBossArena && this.player && this.player.isAlive === false
            && this.currentMap && this.currentMap.mapId === this.bossArenaMapId) {
            this.returnFromBossArena();
        }

        // 任务栏打开 → 忽略所有游戏操作
        if (!this.questUI.isVisible && !this.dialogBox.isVisible) {
            // 检查交互键
            if (input.pressedKeys['e'] && !this.mapTeleport.isVisible) {
                this.handleInteraction();
            }
            
            // 更新训练管理器（附近目标提示 / 圆球动画）
            if (this.trainingManager && this.trainingManager.isActive) {
                this.trainingManager.update(deltaTime, this.player);
            }

            // 玩家战斗系统（大地图内 J/U/I/L：普通攻击 / 灵息弹 / 护体术 / 闪避）
            // 未开始"基础操作教学"前不捕获任何战斗按键（见 PlayerCombatSystem.update）
            if (this.playerCombat) {
                this.playerCombat.update(deltaTime, input);
            }
        }
    }

    /**
     * 更新战斗
     */
    updateBattle(deltaTime, input) {
        if (this.battleSystem.isInBattle) {
            this.battleSystem.update(deltaTime);

            if (this.battleSystem.enemies && this.battleSystem.enemies.length > 0) {
                this.battleSystem.enemies.forEach(enemy => {
                    if (enemy && enemy.update) {
                        enemy.update(deltaTime, null);
                    }
                });
            }

            if (this.player && this.player.isAlive && this.player.isInBattle && input && input.pressedKeys && (input.pressedKeys['j'] || input.pressedKeys[' '])) {
                this.player.performAttack();
            }
            
            // 战斗结束时切换场景
            if (!this.battleSystem.isInBattle) {
                this.sceneManager.switchScene('gameWorld');
            }
        }
    }

    /**
     * 战场战斗流程（主线四《山口不止风》）
     * - Boss 伏诛（战败动画播完）→ 一次性结算：记剧情标记、推进任务目标、
     *   在战场正中心开启永久归途法阵（见 handleBossArenaVictory）
     * - 不再倒计时自动离场：玩家自行走到法阵按 E 返回原来位置
     * - 玩家阵亡由 updateGameWorld 末尾的死亡分支处理（立即送回）
     */
    updateBossArenaBattle() {
        const map = this.currentMap;

        if (!map || map.mapId !== this.bossArenaMapId) {
            return;
        }

        const boss = map.arenaBoss;
        if (!boss) return;

        // Boss 仍存活 → 无需处理
        if (boss.isAlive) return;

        // 等战败动画播完再结算（让玩家看完倒地演出）
        if (boss.isDefeatSequenceFinished && !boss.isDefeatSequenceFinished()) {
            return;
        }

        this.handleBossArenaVictory(map);
    }

    /**
     * 更新小游戏
     */
    updateMiniGame(deltaTime, input) {
        if (this.miniGameManager.isPlaying) {
            this.miniGameManager.update(deltaTime, input);
        }
    }

    /**
     * 渲染游戏
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        const currentScene = this.sceneManager.getCurrentScene();
        
        if (!currentScene) return;
        
        switch (currentScene.sceneId) {
            case 'mainMenu':
                this.renderMainMenu(ctx);
                break;
                
            case 'gameWorld':
                this.renderGameWorld(ctx);
                break;
                
            case 'battle':
                this.renderBattle(ctx);
                break;
                
            case 'miniGame':
                this.renderMiniGame(ctx);
                break;
        }
    }

    /**
     * 渲染主菜单
     */
    renderMainMenu(ctx) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText('修仙者模拟器：飘途', this.canvas.width / 2, 200);
        
        ctx.font = '24px Microsoft YaHei';
        ctx.fillText('按任意键开始游戏', this.canvas.width / 2, 350);
    }

    /**
     * 渲染游戏世界
     */
    renderGameWorld(ctx) {
        // 地图渲染由GameLoop处理
        // 这里渲染UI层

        // ===== 规则：世界地图（MapTeleport）打开时，画面只保留世界地图及其上的区域按钮 =====
        // 地图背景为不透明全屏绘制，若继续绘制其它 UI（交互提示 / HUD / 任务栏 / 对话框），
        // 就会出现“按 E 键乘船离开”等提示叠在世界地图上的穿帮（按 E 登船之后尤为明显）。
        if (this.mapTeleport && this.mapTeleport.isVisible) {
            this.mapTeleport.render(ctx);
            return;
        }

        // 渲染商店（最上层，叠在所有 UI 之上）
        if (this.shop && this.shop.isOpen) {
            this.shop.render(ctx);
            return;
        }
        
        // 注：对话框不在此处绘制 —— 必须画在左下角按键提示 UI（技能栏 / 气血灵息条）之上，
        //     故统一放到下方 renderHud 之后再绘制（见本方法末尾），避免技能格盖住对话框左下角。
        
        // 渲染拾取物提示（玩家附近有可拾取物品时显示）
        if (this.player && this.player.nearbyPickupItem && !this.player.nearbyPickupItem.isPickedUp) {
            this.player.nearbyPickupItem.renderPrompt(ctx, this.camera);
        }

        // 渲染 NPC 交互提示（靠近 NPC 时显示"按 E 对话"）
        // 对话中或正在交互时不再显示提示
        if (this.player && this.player.nearbyNPC && this.player.nearbyNPC.canInteract
            && !this.dialogBox.isVisible && !this.player.isInteracting) {
            this.player.nearbyNPC.renderPrompt(ctx, this.camera);
        }

        // 渲染路标提示（靠近路标时显示"按 E 键…"）
        if (this.player && this.player.nearbySignpost && this.player.nearbySignpost.isActive
            && !this.dialogBox.isVisible && !this.player.isInteracting) {
            this.player.nearbySignpost.renderPrompt(ctx, this.camera);
        }

        // 渲染调查点提示（仅当前待调查且未调查的调查点会显示）
        if (this.player && this.player.nearbyWindPile
            && !this.dialogBox.isVisible && !this.player.isInteracting) {
            this.player.nearbyWindPile.renderPrompt(ctx, this.camera);
        }

        // 渲染传送法阵提示（靠近法阵时显示“按 E 进入boss战斗”等）
        if (this.player && this.player.nearbyTeleportArray && this.player.nearbyTeleportArray.isActive
            && !this.dialogBox.isVisible && !this.player.isInteracting) {
            this.player.nearbyTeleportArray.renderPrompt(ctx, this.camera);
        }

        // 渲染训练目标（地面标记 + 提示）
        if (this.trainingManager && this.trainingManager.isActive) {
            this.trainingManager.render(ctx, this.camera);
            this.trainingManager.renderPrompt(ctx, this.camera);
        }

        // 渲染玩家战斗 HUD（气血 / 灵息 / 技能冷却 / 灵息不足提示）
        if (this.playerCombat) {
            this.playerCombat.renderHud(ctx);
        }

        // 渲染对话框（画在左下角按键提示 UI 之上：技能栏 / 气血灵息条先绘制，
        // 否则技能格会盖住对话框左下角的正文与选项按钮）
        if (this.dialogBox.isVisible) {
            this.dialogBox.render(ctx);
        }

        // 任务UI渲染在最后（最顶层，不被其他UI覆盖）
        if (this.questUI.isVisible) {
            this.questUI.render(ctx);
        }
    }

    /**
     * 渲染战斗
     */
    renderBattle(ctx) {
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 画布背景装饰
        ctx.fillStyle = 'rgba(96, 165, 250, 0.15)';
        ctx.fillRect(0, 0, this.canvas.width, 120);
        ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
        ctx.fillRect(0, 120, this.canvas.width, this.canvas.height - 120);

        const player = this.player;
        const enemies = this.battleSystem && this.battleSystem.enemies ? this.battleSystem.enemies.filter(enemy => enemy && enemy.isAlive) : [];
        const boss = enemies[0] || null;

        // 顶部：Boss血条
        if (boss) {
            const bossBarWidth = 500;
            const bossBarX = (this.canvas.width - bossBarWidth) / 2;
            const bossBarY = 30;
            const bossPercent = Math.max(0, Math.min(1, boss.health / (boss.maxHealth || 1)));

            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.fillRect(bossBarX, bossBarY, bossBarWidth, 22);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(bossBarX, bossBarY, bossBarWidth * bossPercent, 22);

            ctx.strokeStyle = '#f8fafc';
            ctx.strokeRect(bossBarX, bossBarY, bossBarWidth, 22);

            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 18px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText(`${boss.name || 'Boss'}  ${Math.max(0, Math.ceil(boss.health))}/${boss.maxHealth || 1}`, this.canvas.width / 2, bossBarY + 16);
        }

        // 中央：Boss立绘/模型
        if (boss && boss.animationManager) {
            const bossX = this.canvas.width / 2 - 80;
            const bossY = 130;
            boss.animationManager.render(ctx, bossX, bossY, 160, 160, { alpha: 1 });
        } else {
            ctx.fillStyle = '#f8fafc';
            ctx.font = '30px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText('战斗中', this.canvas.width / 2, 260);
        }

        // 下方：玩家状态栏
        if (player) {
            const playerHp = player.playerData ? player.playerData.health : 0;
            const playerMaxHp = player.playerData ? player.playerData.maxHealth : 1;
            const playerMana = player.playerData ? player.playerData.mana : 0;
            const playerMaxMana = player.playerData ? player.playerData.maxMana : 1;
            const panelX = 60;
            const panelY = this.canvas.height - 130;
            const panelW = 420;
            const panelH = 80;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.fillRect(panelX, panelY, panelW, panelH);

            ctx.fillStyle = '#f8fafc';
            ctx.font = '20px Microsoft YaHei';
            ctx.textAlign = 'left';
            ctx.fillText(player.playerData && player.playerData.name ? player.playerData.name : '修仙者', panelX + 20, panelY + 25);

            const hpRatio = Math.max(0, Math.min(1, playerHp / playerMaxHp));
            ctx.fillStyle = '#374151';
            ctx.fillRect(panelX + 120, panelY + 16, 260, 16);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(panelX + 120, panelY + 16, 260 * hpRatio, 16);
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(`HP ${Math.ceil(playerHp)}/${playerMaxHp}`, panelX + 120, panelY + 52);

            const manaRatio = Math.max(0, Math.min(1, playerMana / playerMaxMana));
            ctx.fillStyle = '#374151';
            ctx.fillRect(panelX + 120, panelY + 58, 260, 10);
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(panelX + 120, panelY + 58, 260 * manaRatio, 10);
        }

        // 战斗日志
        if (this.battleSystem) {
            const log = this.battleSystem.getBattleLog();
            const recentLog = log.slice(-4);
            ctx.font = '14px Microsoft YaHei';
            ctx.textAlign = 'left';
            recentLog.forEach((entry, index) => {
                ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
                ctx.fillRect(780, 520 + index * 28, 420, 22);
                ctx.fillStyle = '#f8fafc';
                ctx.fillText(entry.message, 790, 536 + index * 28);
            });
        }
    }

    /**
     * 渲染小游戏
     */
    renderMiniGame(ctx) {
        if (this.miniGameManager.currentMiniGame) {
            this.miniGameManager.render(ctx);
        }
    }

    /**
     * 启动游戏
     */
    start() {
        if (!this.isInitialized) {
            console.error('游戏未初始化');
            return;
        }
        
        this.gameLoop.start();
        console.log('游戏启动');
    }

    /**
     * 暂停游戏
     */
    pause() {
        this.gameLoop.pause();
        console.log('游戏暂停');
    }

    /**
     * 恢复游戏
     */
    resume() {
        this.gameLoop.resume();
        console.log('游戏恢复');
    }

    /**
     * 保存游戏
     */
    save() {
        if (this.saveManager) {
            this.saveManager.save();
        }
    }

    /**
     * 读取游戏
     */
    load() {
        if (this.saveManager) {
            const saveData = this.saveManager.load();
            
            if (saveData) {
                // 恢复玩家引用
                if (saveData.mapManager) {
                    const currentMapId = saveData.mapManager.currentMapId;
                    if (currentMapId) {
                        this.currentMap = this.mapManager.getMap(currentMapId);
                    }
                }
            }
            
            return saveData;
        }
        return null;
    }

    /**
     * 启动小游戏（隔离运行）
     * @param {string} gameId - 小游戏ID
     * @param {Function} callback - 结束回调 (result) => void
     */
    startMiniGame(gameId, callback) {
        // 保存进入小游戏时的玩家大地图坐标（结束时恢复）
        this._savedPlayerX = this.player.position.x;
        this._savedPlayerY = this.player.position.y;
        
        // 保存回调
        this.miniGameCallback = callback || null;
        
        // 切换到小游戏场景
        this.sceneManager.switchScene('miniGame', {
            gameId: gameId,
        });
        
        // 启动小游戏
        this.miniGameManager.startMiniGame(gameId);
    }
    
    /**
     * 小游戏结束处理
     * @param {Object} result - 小游戏结果
     */
    handleMiniGameEnd(result) {
        // 切换回之前的场景
        this.sceneManager.switchScene('gameWorld');
        
        // 恢复进入小游戏前的玩家大地图坐标
        if (this._savedPlayerX !== undefined) {
            this.player.position.x = this._savedPlayerX;
            this.player.position.y = this._savedPlayerY;
        }
        
        // 执行回调
        if (this.miniGameCallback) {
            this.miniGameCallback(result);
            this.miniGameCallback = null;
        }
    }
}

// 游戏启动入口函数
async function startGame() {
    const main = new Main();
    const success = await main.init('gameCanvas');
    
    if (success) {
        if (main.saveManager && main.saveManager.hasSave()) {
            main.load();
        }
        main.start();
    }
}

// 页面加载完成后启动游戏
window.addEventListener('DOMContentLoaded', () => {
    startGame().catch(error => {
        console.error('游戏启动失败:', error);
    });
});