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
        
        // 初始化游戏数据管理器
        this.initGameDataManager();
        
        // 初始化场景
        this.initScenes();
        
        // 绑定输入
        this.bindInputEvents();
        
        // 创建玩家
        this.createPlayer();
        
        // 加载初始地图（也加 try-catch）
        try {
            await this.loadInitialMap();
        } catch (error) {
            console.warn('[游戏] 初始地图加载失败:', error);
            // 地图加载失败也继续，只是没有地图
        }
        
        // 设置游戏循环回调
        this.setupGameLoop();
        
        this.isInitialized = true;
        
        console.log('[游戏] 初始化完成（部分资源可能缺失）');
        
        return true;
    }

    /**
     * 初始化核心系统
     */
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
        
        switch (key) {
            case 'escape':
                // 关闭弹窗
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
        
        // 尝试与NPC交互
        if (this.player.nearbyNPC) {
            this.startNPCInteraction(this.player.nearbyNPC);
            return;
        }
        
        // 尝试与怪物交互（触发战斗）
        if (this.player.nearbyMonster) {
            this.startMonsterBattle(this.player.nearbyMonster);
            return;
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
        
        // 开始对话
        npc.startDialogue(this.player);
        
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

        // 设置 NPC 的商店回调
        npc.onOpenShop = () => {
            if (this.shop) {
                this.shop.open(npc, this.player);
                this.dialogBox.hide();
            }
        };
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
                'npc.qibo_idle',
                'npc.qibo_walk',
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
            position: { x: 320, y: 320 },
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
            
            // 点击推进对话
            if (input.mouseClicked) {
                this.dialogBox.advance();
            }
        }
        
        // 更新战斗系统
        if (this.battleSystem.isInBattle) {
            this.battleSystem.update(deltaTime);
        }
        
        // 检查交互键
        if (input.pressedKeys['e'] && !this.dialogBox.isVisible && !this.mapTeleport.isVisible) {
            this.handleInteraction();
        }
        
        // 检查攻击键
        if (input.pressedKeys['j'] || input.pressedKeys[' ']) {
            if (this.player && !this.player.isInBattle) {
                this.player.performAttack();
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
        
        // 渲染任务UI
        if (this.questUI.isVisible) {
            this.questUI.render(ctx);
        }
        
        // 渲染地图传送
        if (this.mapTeleport.isVisible) {
            this.mapTeleport.render(ctx);
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