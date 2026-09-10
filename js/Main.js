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
        
        // ========== 实体 ==========
        this.player = null;
        this.currentMap = null;
        
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
            if (this.pendingQuestPickups[questId]) {
                for (const { config, mapId } of this.pendingQuestPickups[questId]) {
                    // 优先在当前地图创建；否则从 MapManager 获取目标地图
                    let targetMap = this.currentMap;
                    if (targetMap && mapId && targetMap.mapId !== mapId) {
                        targetMap = this.mapManager.getMap(mapId);
                    }
                    if (targetMap) {
                        const image = this.resourceManager.getCachedImage(`questItems.${config.itemId}`);
                        const pickupItem = new PickupItem({
                            id: config.id,
                            itemId: config.itemId,
                            name: config.name,
                            position: { ...config.position },
                            count: config.count || 1,
                            questId: config.questId,
                            objectiveType: config.objectiveType || 'find_item',
                            promptText: config.promptText || '按 E 拾取',
                            image: image,
                            radius: config.radius || 40,
                        });
                        targetMap.addPickupItem(pickupItem);
                        console.log(`[Main] 创建暂存拾取物: ${config.name} (${config.itemId}) 于地图 ${mapId}`);
                    } else {
                        console.warn(`[Main] 无法找到目标地图 ${mapId}，暂存拾取物 ${config.name} 未创建`);
                    }
                }
                delete this.pendingQuestPickups[questId];
            }

            // ====== 任务解锁后刷新路标可见性 ======
            // 原因：signpost 初始化时通过 updateQuestGate 将 isActive 设为 false（任务 locked），
            // 接取后需要重新计算，否则依赖该任务的路标不会显示
            if (this.currentMap) {
                this.updateSignpostQuestGates(this.currentMap);
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
            // main_3 完成 → 周叔迁回村落
            if (questId === 'chapter1_main_3') {
                const zhoushu = map.npcs.get('zhoushu');
                if (zhoushu && zhoushu.reposition) {
                    zhoushu.reposition(65, 41, map);
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
            }
        };

        // ====== 任务进度更新 ======
        qs.onQuestProgress = (questId, questState) => {
            // 任务被接取（从 locked 变为 active）→ 更新路标可见性
            if (this.currentMap) {
                this.updateSignpostQuestGates(this.currentMap);
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
            // 推进任务进度
            if (this.player && this.player.questSystem) {
                for (const [questId] of this.player.questSystem.getActiveQuests()) {
                    this.player.questSystem.updateQuestProgress(questId, 'complete_training', 'basic');
                }
            }
            // 显示通知
            this.addGameNotification('基础训练完成！返回向祁伯汇报');
        };
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
                // 打开/关闭任务UI
                if (currentScene && currentScene.sceneId === 'gameWorld') {
                    this.questUI.toggle();
                }
                break;
            case 'm':
                // 打开/关闭地图传送
                if (currentScene && currentScene.sceneId === 'gameWorld') {
                    this.mapTeleport.toggle();
                }
                break;
            case 'e':
                // 交互键
                this.handleInteraction();
                break;
            case 'i':
                // 打开背包（预留）
                break;
            case 'l':
            // 按 L 键启动定息引气小游戏
            if (currentScene && currentScene.sceneId === 'gameWorld') {
                this.startMiniGame('boat_navigation', (result) => {
                    if (result.success) {
                        console.log('定息引气成功！');
                        this.player.gainExperience(50);
                    } else {
                        console.log('定息引气失败');
                    }
                });
            }
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
        
        // 如果玩家在战斗中，不处理交互
        if (this.player.isInBattle) return;

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
     * 触发传送法阵
     * @param {TeleportArray} teleportArray - 法阵实例
     */
    async triggerTeleport(teleportArray) {
        if (!teleportArray || !teleportArray.isActive || !teleportArray.targetMapId) {
            return;
        }

        if (!this.player) return;

        this.player.isInteracting = true;
        this.inputManager.setMovementBlocked(true);

        try {
            console.log(`[传送] 进入 ${teleportArray.targetMapId}`);
            const targetMap = await this.mapManager.switchMap(teleportArray.targetMapId, this.player);
            if (!targetMap) {
                console.warn('[传送] 目标地图不存在或加载失败');
                return;
            }

            const targetPosition = teleportArray.targetPosition || targetMap.getEntryWorldPosition();
            this.player.position = { ...targetPosition };
            this.player.nearbyTeleportArray = null;
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

            // 创建新地图的任务道具（暂存的任务道具在对应任务激活时创建）
            this.createPickupItemsFromConfig(targetMap);
        } finally {
            this.player.isInteracting = false;
            this.inputManager.setMovementBlocked(false);
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
                    
                default:
                    // 支持 on_complete 中写 accept_quest_xxx / start_quest_xxx
                    if (action.startsWith('accept_quest_') || action.startsWith('start_quest_')) {
                        const questId = action.replace(/^(accept_quest_|start_quest_)/, '');
                        if (this.player && this.player.questSystem) {
                            this.player.questSystem.acceptQuest(questId);
                        }
                    } else {
                        console.warn(`[Main] 未处理的 on_complete 动作: ${action}`);
                    }
                    break;
            }
        }
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
        console.log('[调试] renderDialogueOptions 被调用');
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
        console.log('[调试] endNPCInteraction 被调用');
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
                'monsters.boss_shanxiao_attack',
                'monsters.boss_shanxiao_skill1',
                'monsters.boss_shanxiao_skill2',
                'monsters.boss_shanxiao_hurt',
                'monsters.boss_shanxiao_dead',
                'ui.dialog_box',
                'ui.task_panel',
                'ui.button_normal',
                // 任务物品图标
                'questItems.guixiang_pai',
                'questItems.hundeng',
                'questItems.yisha',
                'questItems.yunye_canye',
                'questItems.mingce',
                'questItems.zhenfeng_heipian',
                'questItems.lingcao',
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
        
        // 绑定玩家回调
        this.player.onDeath = (player) => {
            console.log('玩家死亡');
            // 处理玩家死亡逻辑
        };
        
        this.player.onAttack = (attackData) => {
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
                    if (!this.pendingQuestPickups[config.questId]) {
                        this.pendingQuestPickups[config.questId] = [];
                    }
                    this.pendingQuestPickups[config.questId].push({ config, mapId });
                    console.log(`[Main] 暂存拾取物 ${config.name}：等待任务 ${config.questId} 激活`);
                    continue;
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
        // 更新商店界面（优先级最高）
        if (this.shop && this.shop.isOpen) {
            this.shop.update(deltaTime, input);
            this.inputManager.setMovementBlocked(true);
            return; // 商店打开时不再处理其他 UI 输入
        }
        
        // 更新地图传送界面
        if (this.mapTeleport.isVisible) {
            this.mapTeleport.update(deltaTime, input);
            this.inputManager.setMovementBlocked(true);
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
        
        // 任务栏打开 → 忽略所有游戏操作
        if (!this.questUI.isVisible && !this.dialogBox.isVisible) {
            // 检查交互键
            if (input.pressedKeys['e'] && !this.mapTeleport.isVisible) {
                this.handleInteraction();
            }
            
            // 更新训练管理器（放置训练目标时处理玩家动作检测）
            if (this.trainingManager && this.trainingManager.isActive) {
                this.trainingManager.update(deltaTime, this.player, input);
            }

            // 检查技能键（K=灵息弹, L=护体术, Shift=闪避）
            if (!this.player.isInBattle) {
                if (input.pressedKeys['k']) {
                    console.log('[Main] 按 K - 尝试使用灵息弹');
                }
                if (input.pressedKeys['l']) {
                    console.log('[Main] 按 L - 尝试使用护体术');
                }
                if (input.pressedKeys['Shift']) {
                    if (!this.player.isDodging && this.player.performDodge) {
                        this.player.performDodge();
                    }
                }
            }

            // 检查攻击键
            if (input.pressedKeys['j'] || input.pressedKeys[' ']) {
                if (this.player && !this.player.isInBattle) {
                    this.player.performAttack();
                }
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
        
        // 渲染商店（最上层，叠在所有 UI 之上）
        if (this.shop && this.shop.isOpen) {
            this.shop.render(ctx);
            return;
        }
        
        // 渲染对话框
        if (this.dialogBox.isVisible) {
            this.dialogBox.render(ctx);
        }
        
        // 渲染地图传送
        if (this.mapTeleport.isVisible) {
            this.mapTeleport.render(ctx);
        }

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

        // 渲染训练目标（地面标记 + 提示）
        if (this.trainingManager && this.trainingManager.isActive) {
            this.trainingManager.render(ctx, this.camera);
            this.trainingManager.renderPrompt(ctx, this.camera);
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