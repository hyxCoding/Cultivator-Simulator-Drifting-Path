/**
 * 修仙者模拟器：飘途 - 主程序
 * 整合所有系统，初始化游戏，启动主循环
 */
// 小游戏结算回到主图后，忽略 E 键的秒数。
// 原因：浏览器对按住的键会连发 keydown，而结算发生在「按下 E 的那一刻」（采到最后一株草药 /
// 坠落结算），若这一路 keydown 直接落到主图的「采药点」路标上，就会把刚结束的小游戏又开一局
// —— 玩家以为已经退出，实际小游戏还在跑（起风 BGM 又响、风停时虚空坠落再判一次失败音效）。
const MINI_GAME_EXIT_GUARD_SECONDS = 0.5;

// 乘风采药「成功退出」后的兜底收尾对白
// 正常走 Chapter1Config 里采药点路标的 successDialogue / successSpeaker（见 Signpost.js）；
// 路标没配时用这一句，保证「赢了之后一定有一句话」（需求：成功退出小游戏后加个对话）。
const HERB_COLLECT_SUCCESS_DIALOGUE = '止风草齐了三份，趁着露水还重，赶紧给阿禾送去。\n风里走这一趟不算白——好歹没让这些药草空长一场。';
const HERB_COLLECT_SUCCESS_SPEAKER = '主角: ';

class Main {

    constructor() {
        // ========== Canvas ==========
        this.canvas = null;
        this.ctx = null;
        
        // ========== 核心系统 ==========
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

        // 渡厄使「控制」禁键（见 startArenaControlLock / updateBossArenaControlLock）
        this.arenaControlLockActive = false;
        this.arenaControlLockTimer = 0;

        // ========== 剧情时间轴（替代嵌套 setTimeout） ==========
        this.storyTimeline = null;              // { steps, elapsed, nextIndex }；见 startStoryTimeline
        this._breathHealActors = null;          // 定息引气序列的 NPC 引用（跨步骤共享）

        // ========== 章末流程（筑基调息 → 码头送别 → 登船） ==========
        this.isFoundationTrialPlaying = false;  // 筑基调息播放中（锁定键盘/移动/战斗输入）
        this.foundationTrialTimer = 0;          // 筑基调息剩余秒数
        this.foundationTrialNPC = null;         // 触发筑基调息的 NPC（祁伯，用于续接对话）

        // ========== 第二章（云渡泽）流程状态 ==========
        this.activeArena = null;                // 当前战场参数 { mapId, defeatFlag, victory, resourceGroup, returnMapId, returnPoint }
        this.isCoreTrialPlaying = false;        // 结丹调息播放中（锁定键盘/移动/战斗输入）
        this.coreTrialTimer = 0;                // 结丹调息剩余秒数
        this.coreTrialNPC = null;               // 触发结丹调息的 NPC（阿禾）
        this.chapter2DormantNPCs = {};          // 归魂前暂不出现的 NPC { id: npc }（江晚 / 陈栎）
        this.chapter2JiangpoIdleTimer = null;   // 江婆「获救后」立绘的延迟重试 { timer, attempt }（动画异步加载；deltaTime 驱动）
        this.subtitle = { text: '', timer: 0 }; // 战斗中的短字幕（不暂停操作）
        this.storyDialogueActive = false;       // 正在播放无 NPC 的剧情对白
        this.chapter2Boarding = false;          // 防止登船结算重复触发
        // 游戏完结界面（滚动字幕）是否已播放过：播放完毕玩家按任意键退出时写入；
        // 之后再在中央泊位登船不再重播字幕，直接打开世界地图（见 boardZhaochenBoat）
        this.gameEndingSeenFlag = 'game_ending_seen';

        // ========== 世界地图 ==========
        // 地图已删减为前两章（青岚浮野 / 云渡泽），世界地图只保留这两章的传送按钮。
        // 调试期：两章按钮全部常开（打开世界地图只能走剧情节点：码头登船 / 章末登船）。
        // 置为 false 即恢复“云渡泽按剧情解锁”的原逻辑（见 updateWorldMapUnlocks）。
        this.debugUnlockAllWorldMapButtons = true;

        // 世界地图传送落点（世界坐标，像素；玩家 position 即碰撞盒中心）
        // - 只对世界地图按钮生效：其它入口（法阵 / 战场返回 / 章节流程）仍用各自的落点
        // - 未列出的地图回落到该地图入口点（GameMap.getEntryWorldPosition）
        // - 两点均已核对：24×24 碰撞盒四角都落在可通行瓦片上，且与地图出生点连通
        //     青岚浮野 (2718, 1500) → 瓦片 (84, 46) —— 祁伯住处东南的开阔空地
        //     云渡泽   (541, 1385) → 瓦片 (16, 43) —— 本章西部栈道旁的空地
        this.worldMapSpawnPoints = {
            qinglan_fuye: { x: 2718, y: 1500 },
            yunduze: { x: 541, y: 1385 },
        };
        
        // ========== 音频（背景音乐 / 音效；见 js/AudioManager.js）==========
        // 背景音乐规则（需求）：
        //   · 主图（青岚浮野 / 云渡泽）循环播放本图 BGM；进小游戏 / 进 Boss 关 / 传送到另一张地图立即停；
        //   · 回到主图（小游戏退出 / Boss 关退出 / 从另一张地图传送回来）→ 等 10 秒再起播，
        //     频繁传送则每次重新计时（AudioManager.scheduleBgm 内部重新计时）；
        //   · 打开世界地图时不停（当前地图的 BGM 继续播）；
        //   · 开始界面 BGM（bgm.main_menu）在 init 加载阶段就先试播一次（startMenuBgmEarly）：
        //     被浏览器自动播放策略拦下时由 AudioManager 等第一次点击 / 按键补播
        //     （加载界面上的那一次点击也算数，见加载提示 #soundHint）。
        this.audioManager = null;                  // 音频管理器（initCoreSystems 里创建）
        this.hasEnteredGameWorld = false;          // 是否进入过大地图（首次 = 从开始界面点开始 → 主图 BGM 立即播）
        this.pendingBossVictorySound = false;      // Boss 已伏诛、等玩家走「归途法阵」回原位置时补播胜利音效

        // ========== 小游戏（见 js/MiniGameManager.js / js/MiniGameScene.js）==========
        // 刚从小游戏结算回主图的「E 键保护期」剩余秒数：见 MINI_GAME_EXIT_GUARD_SECONDS。
        // 每帧在主 update 里递减，handleInteraction 会读它。
        this._miniGameExitGuard = 0;

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

        // 开始界面背景音乐：加载阶段就试播一次（越早越好，加载界面也能听到）
        // 浏览器自动播放策略会拦下「玩家还没交互」的播放：AudioManager 会把这次尝试记下来，
        // 等玩家的第一次点击 / 按键（包括在加载界面上发生的那一次）立刻补播
        // —— 见 AudioManager.handleUserGesture 与 game.html 的 #soundHint 提示。
        this.startMenuBgmEarly();

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
                Logger.log('[游戏] 第一章剧情配置加载完成');
            } else {
                console.warn('[游戏] ChapterLoader或Chapter1Config未加载，跳过章节配置注册');
            }
        } catch (error) {
            console.warn('[游戏] 章节配置加载失败:', error);
        }

        // 加载第二章剧情配置（云渡泽）
        // 注：阿禾同时出现在两章，ChapterLoader 会对同名 NPC 做深合并，
        //     因此她的美术 / 商店配置沿用第一章，只并入第二章的对白与任务。
        try {
            if (window.Chapter2Config && window.chapterLoader) {
                const chapter2Data = Chapter2Config.getAll();
                window.chapterLoader.registerChapter(chapter2Data);
                Logger.log('[游戏] 第二章剧情配置加载完成');
            } else {
                console.warn('[游戏] ChapterLoader或Chapter2Config未加载，跳过第二章配置注册');
            }
        } catch (error) {
            console.warn('[游戏] 第二章章节配置加载失败:', error);
        }
        
        // 初始化存档管理器
        this.initSaveManager();
        
        // 初始化场景
        this.initScenes();
        
        // 绑定输入
        this.bindInputEvents();
        
        // 创建玩家
        this.createPlayer();

        // 注册所有任务到状态机（必须在创建玩家之后，因为 player.questSystem 需先存在）
        if (this.player && this.player.questSystem) {
            this.player.questSystem.registerAllQuests();
            Logger.log(`[游戏] 已注册 ${this.player.questSystem.questState.size} 个任务`);
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
        
        Logger.log('[游戏] 初始化完成（部分资源可能缺失）');
        
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
            Logger.log(`[Main] 任务解锁: ${questId}`);
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

        // ====== 任务完成时（ACTIVE → COMPLETED）：发奖 + NPC搬迁 + 治疗 + 道具清除 ======
        qs.onQuestComplete = (questId, rewards) => {
            Logger.log(`[Main] 任务完成: ${questId}`, rewards);
            const map = this.currentMap;

            // ====== 1) 自动发奖（第一章 + 第二章通用）======
            // 支持字段：修为 / 灵石 / 技能点 / 丹药 / 气血·灵息上限小增 / 境界 / 技能 / 解锁地图。
            // 注：本版平衡下第一章与第二章的任务都不再配置 rewards（空对象直接返回）——
            //     角色成长改由境界基准（GameConfig.realms）与 Boss 战败成长（arenaDefeatBonus）提供。
            this.applyQuestRewards(questId, rewards);

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
                    Logger.log(`[Main] 移除已完成任务的道具: ${id}`);
                }
            }

            // ====== 2) 第二章的舞台推进（NPC 搬迁 / 状态推进）======
            this.handleChapter2QuestComplete(questId, map);

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
            if (rewards && rewards.exp) Logger.log(`[奖励] 经验: ${rewards.exp}`);
            if (rewards && rewards.lingShi) Logger.log(`[奖励] 灵石: ${rewards.lingShi}`);

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

        // 音频管理器（背景音乐循环 / 音效单次；缺失音频文件时静默跳过）
        this.audioManager = AudioManager.getInstance();
    }

    // ==================== 音频调度（背景音乐 / 音效）====================

    /**
     * 初始化UI系统
     */

    initUISystems() {

        // 获取已加载的背景图
        const worldMapBg = this.resourceManager.getCachedImage('worldMap.background');
        this.mapTeleport = new MapTeleport({
            canvas: { width: this.canvas.width, height: this.canvas.height },
            backgroundImage: worldMapBg,  // ← 传入背景图
            // ========== 区域按钮：地图已删减为前两章（青岚浮野 / 云渡泽）==========
            // 调试期：两个按钮都解锁，点击即传送到对应地图；
            // 位置按世界地图美术（world_map_bg）上的两块地标对位，坐标为中心点（见 MapAreaButton）。
            areaButtons: [
                {
                    id: 'btn_qinglan',
                    x: 450,           // 按钮中心x坐标（青岚浮野：左下「练气」区域）
                    y: 550,           // 按钮中心y坐标
                    width: 140,        // 按钮宽度
                    height: 100,       // 按钮高度
                    image: this.resourceManager.getCachedImage('worldMap.button_qinglan'),
                    areaName: '青岚浮野',
                    targetMapId: 'qinglan_fuye',
                    enabled: true,    // 第一章：常开
                    callback: (btn) => {
                        // 统一走 enterMapFromWorldMap：隐藏世界地图 → switchToMap
                        // （落点 / 摄像机 / 任务门控 / 地图道具 / 章末舞台恢复）→ 通知
                        this.enterMapFromWorldMap(btn.targetMapId);
                    },
                },
                {
                    id: 'btn_yunduze',
                    x: 1000,
                    y: 400,
                    width: 140,
                    height: 100,
                    image: this.resourceManager.getCachedImage('worldMap.button_yunduze'),
                    areaName: '云渡泽',
                    targetMapId: 'yunduze',
                    // 调试期常开（原为「第一章筑基后按剧情标记解锁」，
                    // 由 updateWorldMapUnlocks 同步状态）
                    enabled: true,
                    callback: (btn) => {
                        // 落地后触发第二章的舞台恢复与开场旁白（见 applyChapter2Stage）
                        this.enterMapFromWorldMap(btn.targetMapId);
                    },
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
            // 第二章：认灯归魂（身份核对）
            lantern_identify: new LanternIdentifyMiniGame(),
        });
        
        // 创建商店系统
        this.shop = new Shop({ main: this });

        // 创建训练管理器
        this.trainingManager = new TrainingManager();
        this.trainingManager.onAllCompleted = () => {
            // 本次训练要推进的目标（第一章基础训练 = 'basic'，第二章剑修连招试炼 = 'sword'）
            const trainingTarget = this.trainingManager.currentTarget || 'basic';
            Logger.log(`[Main] ${this.trainingManager.currentLabel || '基础训练'} 全部完成！`);
            // 战斗按键永久解锁
            if (this.playerCombat) {
                this.playerCombat.setUnlocked(true);
            }
            // 推进任务进度（只推进当前未完成且 type/target 匹配的目标）
            // 同时记下这次是否**真的**推进了 —— 任务系统会拒收“还没轮到”的进度，
            // 该情况下不能发技能 / 写剧情标记，否则与任务状态脱节（主线一第 3 步会卡住）。
            let progressed = false;
            if (this.player && this.player.questSystem) {
                const questSystem = this.player.questSystem;
                const questIds = Array.from(questSystem.getActiveQuests().keys());
                const wasCompleted = new Map(questIds.map(questId => [
                    questId,
                    typeof questSystem.isObjectiveCompleted === 'function'
                        && questSystem.isObjectiveCompleted(questId, 'complete_training', trainingTarget),
                ]));

                for (const questId of questIds) {
                    questSystem.updateQuestProgress(questId, 'complete_training', trainingTarget);
                }

                progressed = questIds.some(questId => !wasCompleted.get(questId)
                    && typeof questSystem.isObjectiveCompleted === 'function'
                    && questSystem.isObjectiveCompleted(questId, 'complete_training', trainingTarget));
            }
            // 显示通知
            if (trainingTarget === 'sword') {
                if (!progressed) {
                    // 这一步还没轮到（例如刚进章节就从闲聊对白提前开了试炼）或已经结算过（重玩）：
                    // 不发剑影连斩、不写 chapter2_sword_training_done，避免主线一第 3 步被提前做掉
                    this.addGameNotification('剑修连招试炼完成（本次不计入任务进度）');
                    return;
                }
                this.addGameNotification('剑修连招试炼完成！');
                // 试炼传授的唯一技能：剑影连斩（快捷键 O）——与第一章"任务 / 教学学会技能"同一套逻辑：
                // Main.learnProfessionSkill 写入职业技能（等级 1）→ 弹出"习得…"提示框 → 左下角技能栏补出该格
                if (this.learnProfessionSkill('jianying')) {
                    this.addGameNotification('剑影连斩已加入技能栏（快捷键 O）');
                }
                // 剧情续接：T01（收招后留一步）
                this.playStoryDialogue('t01_sword_done', '陆舟: ');
                this.setStoryFlag('chapter2_sword_training_done');
            } else {
                this.addGameNotification('基础训练完成！返回向祁伯汇报');
            }
        };

        // 创建玩家战斗系统（大地图内 J=普通攻击 / U=灵息弹 / I=护体术 / L=闪避）
        this.playerCombat = new PlayerCombatSystem({ main: this });
    }

    /**
     * 初始化存档管理器
     * 说明（第十四次改动）：原 `initGameDataManager` 额外创建了一个 `GameDataManager`
     * 并逐字段接线，但它**从未被调用过 save/load/serialize/deserialize**（Main 自己直接用
     * saveManager）→ 属于冗余的并行注册表，已删除。存档的唯一入口就是下面的 saveManager。
     */

    initSaveManager() {
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

        // 游戏完结场景（章末二登船后播放的滚动字幕，见 js/EndingScene.js）
        this.scenes.ending = new EndingScene(this);
        
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
            // 游戏完结界面（滚动字幕）：键盘一律由 EndingScene 处理，ESC 松手也不走关闭弹窗逻辑
            const currentScene = this.sceneManager ? this.sceneManager.getCurrentScene() : null;
            if (currentScene && currentScene.sceneId === 'ending') {
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

        // ===== 规则-00：游戏完结界面（滚动字幕）→ 键盘一律交给该场景 =====
        // 字幕播放中任何键都不生效（不能跳过）；最后一行滚出后由
        // EndingScene.update 读取 pressedKeys 处理「按任意键返回游戏」。
        // 这里直接返回，避免 Q / M / E / ESC（以及 F2 调试叠层）在完结画面上误触发。
        if (currentScene && currentScene.sceneId === 'ending') {
            return;
        }

        // ===== 规则-0：F2 切换碰撞网格调试覆盖层（改 collision.png 后用来核对，不占用游戏按键） =====
        if (key === 'f2') {
            this.toggleCollisionDebug();
            return;
        }

        // ===== 规则-1：筑基调息 / 结丹调息播放中 → 键盘输入全部忽略（序列结束后续接对话） =====
        if (this.isFoundationTrialPlaying || this.isCoreTrialPlaying) {
            return;
        }

        // ===== 规则-1b：剧情对白（无 NPC 承载）播放中 → 只允许 J 推进，ESC 不生效（防止锁死） =====
        if (this.storyDialogueActive) {
            if (key === 'j') {
                this.dialogBox.advance();
            }
            return;
        }

        // ===== 规则0：小游戏中时，所有外部按键一律忽略 =====
        // 注意：这里判的是「当前场景是不是小游戏」，**不能只看 isPlaying** ——
        // 结算完成（isPlaying=false）到场景真正切回主图之间还有 1 帧，本地图与浏览器连发的
        // keydown（玩家长按 E 采药）正好可能落在这一帧：那时若放行，E 会走到下面的
        // handleInteraction → 采药点路标 → 又开一局小游戏，而且 Main.startMiniGame 里的
        // switchScene('miniGame') 会把待切换的 gameWorld 覆盖掉 → 玩家被留在小游戏里，
        // 起风 BGM 过一会儿又响、风停时虚空坠落再判一次失败音效。
        if (currentScene && currentScene.sceneId === 'miniGame') {
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
        
        // ===== 规则2b：输入被「完全封锁」→ 键盘一律无响应（F2 调试叠层除外，见规则-0） =====
        // 设置方：渡厄使「控制」禁键（Main.startArenaControlLock，需求是「禁止一切按键输入」）、
        // 筑基 / 结丹调息、完结字幕。上面「调息 / 剧情对白 / 小游戏 / 任务栏 / 对话框」这些
        // 需要例外放行的状态已经各自 return 过（对白推进不会被锁死），走到这里的是「战场上
        // 被锁住」这类纯粹不让操作的帧。
        //   · 旧写法这里没有任何拦截：被锁住时按 Q 仍会走 case 'q' → questUI.toggle()，
        //     任务栏真的开了、还播了 sfx.ui_quest_panel —— 而该状态下按需求「禁止一切按键输入」，
        //     玩家长按 Q 只听到音效、行为与预期对不上（音效判定与行为判定不是同一条）。
        //   · 统一 return 后 Q / E / ESC 与 J/U/I/L/O（技能另在 PlayerCombatSystem._canCaptureInput
        //     拦截）一起失效，音效不再离开行为单独出现。
        if (this.inputManager && typeof this.inputManager.isInputBlocked === 'function'
            && this.inputManager.isInputBlocked()) {
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
            // 注：M 键「打开 / 关闭世界地图（九州总图）」入口已按需求移除（第十三次改动，2026-09-13）——
            // 世界地图只在剧情节点开启：第一章码头登船（Main.boardShipAndOpenWorldMap）、
            // 章末登船（Main.openWorldMapFromBerth）；键盘上不再有开关，
            // 关闭仍走 ESC（见 handleEscapeKey → mapTeleport.hide）。
            // 这里整段删除而不是留一个空 case：空 case 容易被后续维护当成「还留着调试入口」。
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

        // 小游戏进行中 / 仍在小游戏场景 / 刚结算回来的保护期内：不接受任何世界交互。
        // handleKeyDown 是事件驱动的（不走场景 update），所以这里必须再兜一层，
        // 否则冒出来的 E 会经路标把刚结束的小游戏又开一局（见 MINI_GAME_EXIT_GUARD_SECONDS）。
        if (this.isMiniGameActive() || this._miniGameExitGuard > 0) return;
        
        // 如果玩家在战斗中，不处理交互
        if (this.player.isInBattle) return;

        // 筑基调息 / 结丹调息 / 剧情对白播放中：不接受任何交互
        if (this.isFoundationTrialPlaying || this.isCoreTrialPlaying || this.storyDialogueActive) return;

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
                this.startMiniGameFromSignpost(signpost);
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
            Logger.log(`[Main] 拾取物品: ${pickupItem.name}`);
            // 拾取音效（任务道具；乘风采药采到草药也走同一个音效）
            this.playSfx('sfx.pickup');
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

        Logger.log(`[Main] 开始调查 ${windPile.name} (${windPile.objectiveTarget})`);
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

            // 调查点附带发放的剧情物品（如万灯台台后的转运账册 / 太玄增供命令）
            if (Array.isArray(windPile.grantItems) && windPile.grantItems.length > 0) {
                windPile.grantItems.forEach(itemId => this.grantQuestItem(itemId, 1, true));
            }

            Logger.log(`[Main] 调查完毕: ${windPile.name}`);
        }

        // 刷新所有调查点的可调查状态（下一处调查点变为可调查）
        this.updateWindPileQuestGates(this.currentMap);

        this.player.isInteracting = false;
        this.inputManager.setMovementBlocked(false);
    }

    /**
     * 切换当前地图（统一的落点/摄像机/任务门控/地图道具刷新入口）
     * 说明：离开的地图不会被销毁 —— MapManager 只把它置为非活动（完全静默：不更新、
     * 不渲染、不参与交互），实例与已加载资源都保留，因此世界地图可以反复传送；
     * 落点缺省取目标地图的入口点；世界地图传送会显式传入 worldMapSpawnPoints 里的固定落点。
     * @param {string} mapId - 目标地图 ID
     * @param {Object} [worldPosition] - 落点（世界坐标，像素）；不传则用地图入口点
     * @returns {Promise<GameMap|null>} 切换后的地图实例
     */

    async switchToMap(mapId, worldPosition) {
        if (!this.player) return null;

        // 背景音乐：先记下切换前的地图（用于 onMapSwitched 判断是否需要重新计时）
        const previousMapId = (this.currentMap && this.currentMap.mapId) || null;

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
        // 第二章舞台状态（开局旁白 / 江晚陈栎的出现时机 / NPC 站位 / 世界地图解锁）
        this.applyChapter2Stage(targetMap);

        // 背景音乐：进 Boss 战场立即停主图 BGM；落到主图 = 10 秒后再起播（见 onMapSwitched）
        this.onMapSwitched(previousMapId, targetMap.mapId);

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

        // 战场「归途法阵」（id = teleport_boss_exit，见 GameMap.createArenaExitArray）：
        // 打赢 Boss 后玩家就是从这里回到原来位置 —— 这一刻才播胜利音效
        // （需求：只有打败 Boss 且通过传送门回到原位置才播；再次进场不会再生成 Boss，故不会误播）
        if (this.pendingBossVictorySound && this.isBossArenaExitArray(teleportArray)) {
            this.pendingBossVictorySound = false;
            this.playSfx('sfx.victory');
        }

        this.player.isInteracting = true;
        this.inputManager.setMovementBlocked(true);

        try {
            Logger.log(`[传送] 进入 ${teleportArray.targetMapId}`);
            await this.switchToMap(teleportArray.targetMapId, teleportArray.targetPosition);
        } finally {
            this.player.isInteracting = false;
            this.inputManager.setMovementBlocked(false);
        }
    }

    /**
     * 从世界地图进入目标地图（隐藏世界地图 → 统一走 switchToMap）
     * 落点取 worldMapSpawnPoints 里为该地图配置的固定落点（未配置才回落到地图入口点）；
     * 第二章开场旁白 / 舞台恢复由 applyChapter2Stage 负责。
     * @param {string} mapId
     * @param {Object} [worldPosition] - 临时指定落点（世界坐标，像素）；不传则用 worldMapSpawnPoints
     * @returns {Promise<GameMap|null>}
     */

    async enterMapFromWorldMap(mapId, worldPosition) {
        if (!mapId) return null;

        // 目标地图配置不存在（例如第三章尚未开放）→ 只提示，留在原地
        const mapConfig = this.gameConfig.getMap(mapId);
        if (!mapConfig) {
            console.warn(`[世界地图] 目标地图尚未开放: ${mapId}`);
            this.addGameNotification('该区域尚未开放');
            return null;
        }

        if (this.mapTeleport && this.mapTeleport.isVisible) {
            this.mapTeleport.hide();
        }

        const spawn = worldPosition || (this.worldMapSpawnPoints ? this.worldMapSpawnPoints[mapId] : null);
        const targetMap = await this.switchToMap(mapId, spawn || undefined);
        if (targetMap) {
            this.addGameNotification(`进入${targetMap.name}`);
        }
        return targetMap;
    }

    // ==================== 第二章：小游戏 / 演出流程 ====================

    /**
     * 第二章：逆流送灯（从陆舟对话选项进入）
     * 与「旧水道」路标等价的入口：直接开启逆流行舟小游戏。
     */

    startRiverEscort(npc) {
        this.startMiniGame('boat_navigation', (result) => this.finishRiverEscort(result));
    }

    /**
     * 开船前往照尘仙城
     * - 第三章地图（zhaochen_xiancheng）已注册且能载入 → 直接切换过去并结算
     * - 尚未提供第三章地图时 → 按本章收尾结算（保留泊位路标可重复乘船，不丢进度）
     * 两条分支在结算完《行舟有归处》后都会进入**游戏完结界面**（滚动字幕）：
     * 本作到章末二登船为止，玩家在完结界面按任意键 → 世界地图（见 startGameEnding / finishGameEnding）
     */

    async sailToZhaochen() {
        const questSystem = this.player ? this.player.questSystem : null;
        const zhaochenConfig = this.gameConfig.getMap('zhaochen_xiancheng');

        const settle = () => {
            if (questSystem) {
                questSystem.updateQuestProgress('chapter2_ending_2', 'board_boat', 'zhaochen_boat', 1);
            }
            this.setStoryFlag('chapter2_boarding_done');
            this.chapter2Boarding = false;
        };

        if (zhaochenConfig) {
            const loaded = await this.switchToMap('zhaochen_xiancheng');
            if (loaded) {
                this.playStoryDialogue('s03_arrive_zhaochen', '旁白: ', () => {
                    settle();
                    this.startGameEnding();
                });
                return;
            }
            console.warn('[Main] 照尘仙城地图载入失败，留在码头重试');
            this.addGameNotification('航路未通，暂时留在码头');
            this.chapter2Boarding = false;
            return;
        }

        // 第三章尚未开放：仍按本章收尾（S03）→ 游戏完结界面；泊位可重复乘船
        this.playStoryDialogue('s03_arrive_zhaochen', '旁白: ', () => {
            settle();
            this.addGameNotification('第二章 完 —— 照尘仙城（第三图尚未开放）');
            this.startGameEnding();
        });
    }

    /**
     * 生成“登船”路标（第一章 · 永久）
     * 数据源：Chapter1Config → maps.qinglan_fuye.chapterEnd.departSignpost（世界坐标 2566,1419）
     * 已存在同名路标时不重复生成；按 E → boardShipAndOpenWorldMap()
     * 美术：image / imageWidth / imageHeight 原样透传给 Signpost
     *      （当前为 'signposts.depart_boat' → assets/images/signposts/depart_boat.png，缺图回退程序化木牌）
     *
     * ⚠ 仅限第一章舞台图：本方法生成的是**第一章**的登船路标（第一章的回调 + 无任务门控），
     *   在第二章云渡泽调用会用该图 chapterEnd.departSignpost 冒出一个无门控的「登船」路标，
     *   因此这里加了章节防呆判断。第二章泊位路标见 Main.ensureChapter2BoatSignpost。
     *
     * @param {GameMap} gameMap - 地图实例
     * @returns {Signpost|null}
     */

    createDepartSignpost(gameMap) {
        const map = gameMap || this.currentMap;
        if (!map || !map.signposts || typeof Signpost !== 'function') return null;
        if (!this.isChapter1Map(map)) {
            console.warn(`[Main] 忽略非第一章地图的登船路标生成请求: ${map.mapId || '(未登记 mapId)'}`);
            return null;
        }

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
        Logger.log(`[Main] 码头登船路标已生成 (${signpost.position.x}, ${signpost.position.y})`);
        this.addGameNotification('船已备好，按 E 键乘船离开');
        return signpost;
    }

    /**
     * 切换碰撞网格调试覆盖层（F2）
     * 绿 = 可通行、红 = 阻挡；数据源是当前地图实际使用的碰撞表，
     * 改完 collision.png / collisionData 后进游戏按一下就能核对。
     * @returns {boolean} 切换后的状态
     */

    toggleCollisionDebug() {
        const on = this.gameLoop && this.gameLoop.toggleCollisionDebug
            ? this.gameLoop.toggleCollisionDebug()
            : false;
        // 小游戏内也生效：转发给当前小游戏（自带碰撞表的小游戏，如认灯归魂）
        const miniGame = this.miniGameManager && this.miniGameManager.currentMiniGame;
        if (miniGame && typeof miniGame.setCollisionDebug === 'function') {
            miniGame.setCollisionDebug(on);
        }
        this.addGameNotification(on
            ? '碰撞调试：开（绿=可通行 红=阻挡，按 F2 关闭）'
            : '碰撞调试：关');
        return on;
    }

    /**
     * 预加载初始资源
     */

    async preloadInitialResources() {
        Logger.log('开始预加载资源...');
        
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
                // 战斗特效（主角：剑气 / 灵息弹 / 命中 / 剑影连斩剑气与命中 / 护体术气场 / 闪避气场）
                'effects.player_sword_aura',
                'effects.player_lingxidan',
                'effects.player_lingxidan_hit',
                'effects.player_jianying',
                'effects.player_jianying_hit',
                'effects.player_hutishu_aura',
                'effects.player_dodge_aura',
                'ui.dialog_box',
                'ui.task_panel',
                'ui.button_normal',
                // 游戏开始界面（整屏背景 1280×720 + 居中开始按钮 400×112；见 js/MainMenuScene.js。
                // 缺图 / 占位图时开始界面只铺底色、仍然可点按钮开始）
                'ui.start_screen',
                'ui.start_button',
                // 游戏完结界面（章末二登船后的滚动字幕）：可选整屏背景 1280×720（见 js/EndingScene.js）
                // 缺图 / 占位图时改用程序化「深墨渐变 + 渡口暖光晕」兜底，界面照常播放
                'ui.ending_bg',
                // 自定义气血条 / 灵息条（HUD：外框 + 内条，规格见 js/PlayerCombat.js CONFIG.hud）
                'ui.health_bar_bg',
                'ui.health_bar_fill',
                'ui.mana_bar_bg',
                'ui.mana_bar_fill',
                // 左下角技能栏图标（U 灵息弹 / I 护体术 / L 闪避 / O 剑影连斩，规格 100×100；
                // 普通攻击 J 不占技能栏；O 学会后才补出第 4 格；
                // 缺图 / 尺寸不符时技能栏该格回退程序化方框）
                'ui.skill_lingxidan',
                'ui.skill_hutishu',
                'ui.skill_dodge',
                'ui.skill_jianying',
                // 飘落物（落叶 / 落花）：1 行 12 帧、单帧 16×16（整图 192×16），
                // 前两章主图 / 开始界面 / 游戏完结界面共用（见 js/FallingFoliage.js）
                'foliage.falling_leaf',
                'foliage.falling_flower',
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
                // ===== 第二章：云渡泽地图 + 万灯台战场 + 本章 NPC / 路标 / 法阵 =====
                'mapBackgrounds.yunduze',
                'mapCollisions.yunduze',
                'mapBackgrounds.boss_arena_ch2',
                'mapCollisions.boss_arena_ch2',
                'npc.luzhou_idle',
                'npc.jiangpo_idle',
                'npc.jiangpo_idle_after',
                'npc.jiangwan_idle',
                'npc.chenli_idle',
                'npc.xulu_idle',
                'signposts.lantern_identify',
                'signposts.river_escort',
                'teleportArrays.wandengtai',
                // 第二章小游戏：认灯归魂（背景 + 暗/亮两张魂灯 48×64 + 认灯台碰撞图 1280×720；
                // 缺图回退程序化绘制 / 读不到像素回退内置兜底碰撞表）
                'miniGame.rendeng_bg',
                'miniGame.rendeng_deng_off',
                'miniGame.rendeng_deng_on',
                'miniGame.rendeng_collision',
                // 第二章小游戏：逆流送灯（横版行舟；小船单行 4 帧 128×104 / 礁石 · 浮木 96×96 /
                // 河道背景 + 河道碰撞图 1280×720；缺图回退程序化绘制）
                'miniGame.xingzhou_bg',
                'miniGame.xingzhou_boat',
                'miniGame.xingzhou_rock',
                'miniGame.xingzhou_wood',
                'miniGame.xingzhou_collision',
            ],
            audio: [
                // ===== 背景音乐（循环播放；见 js/AudioManager.js）=====
                'bgm.main_menu',       // 开始游戏界面（加载完即播 / 点开始即停）
                'bgm.qinglan',         // 第一章主图 青岚浮野（回主图 10 秒后起播）
                'bgm.yunduze',         // 第二章主图 云渡泽（同上）
                'bgm.minigame_boat',   // 逆流送灯（开局即播 / 结束即停）
                'bgm.minigame_herb',   // 乘风采药（只在起风期间循环）
                'bgm.ending',          // 游戏结束滚动字幕（退出界面才停）
                // ===== 玩家音效（技能 / 攻击真的发动才播）=====
                'sfx.player_attack',
                'sfx.player_lingxidan',
                'sfx.player_hutishu',
                'sfx.player_dodge',
                'sfx.player_jianying',
                'sfx.player_hurt',     // 受伤（正在播时不重播）
                'sfx.pickup',          // 拾取任务道具 / 采药
                // ===== 摄风山魈（第一章 Boss）=====
                'sfx.boss_shanxiao_charge',
                'sfx.boss_shanxiao_sweep',
                'sfx.boss_shanxiao_pounce',
                'sfx.boss_shanxiao_slam',
                'sfx.boss_shanxiao_hurt',
                'sfx.boss_shanxiao_defeat',
                // ===== 渡厄使（第二章 Boss）=====
                'sfx.boss_due_summon',
                'sfx.boss_due_dash',
                'sfx.boss_due_control',
                'sfx.boss_due_hurt',
                'sfx.boss_due_defeat',
                // ===== UI =====
                'sfx.ui_hover',
                'sfx.ui_click',
                'sfx.ui_quest_panel',
                // ===== 小游戏（认灯归魂）=====
                'sfx.minigame_lantern_light',
                'sfx.minigame_lantern_extinguish',
                // ===== 胜负 =====
                'sfx.victory',
                'sfx.defeat',
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
        
        Logger.log('预加载资源完成');
    }

    /**
     * 创建玩家
     */

    createPlayer() {
        // 唯一数据源：坐标与初始境界取自 GameConfig.playerDefaults，
        // 气血 / 灵息上限一律由 GameConfig.realms[境界] 派生（见 PlayerData 构造函数）。
        // 旧代码在这里硬编码 health:100 / mana:50，会把 GameConfig 的练气 150/70 覆盖掉 ——
        // 「改配置不生效」的典型来源，已删除。
        const defaults = GameConfig.getInstance().getPlayerDefaults();
        this.player = new Player({
            position: { x: defaults.spawn.x, y: defaults.spawn.y },
            playerData: {
                realm: defaults.realm,
                stage: defaults.stage,
                lingShi: defaults.lingShi,
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
            Logger.log('玩家死亡');
            // 处理玩家死亡逻辑
        };
        
        this.player.onAttack = (attackData) => {
            // 战场内：普通攻击直接命中战场 Boss（第一章摄风山魈 / 第二章渡厄使），不走野外战斗系统
            if (this.currentMap && this.isArenaMap(this.currentMap.mapId)
                && this.currentMap.arenaBoss) {
                this.currentMap.arenaBoss.handlePlayerAttack(attackData);
                return;
            }

            // 处理玩家攻击
            this.battleSystem.checkPlayerAttacks();
        };
        
        // 任务物品系统回调：当任务物品变更时更新任务进度
        this.player.questItemSystem.onItemChanged = (itemId, count) => {
            Logger.log(`[任务物品] ${itemId} 数量变更为 ${count}`);
        };
        
        // 设置任务系统引用
        this.questUI.setQuestSystem(this.player.questSystem);
        
        // 设置到游戏循环
        this.gameLoop.setPlayer(this.player);
        if (this.gameLoop.setPlayerCombat) {
            this.gameLoop.setPlayerCombat(this.playerCombat);
        }

        // 注册玩家到存档管理器（玩家在 initSaveManager 之后才创建，故在此补注册）。
        // 修复：此前存档完全没有玩家数据，读档后角色属性 / 背包 / 任务 / 职业会丢失。
        if (this.saveManager) {
            this.saveManager.registerSystems({ player: this.player });
        }

        Logger.log('玩家创建完成');
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

        // 第二章舞台状态（世界地图解锁 / 云渡泽 NPC 站位；本图不是云渡泽时只同步地图解锁）
        this.applyChapter2Stage(gameMap);

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
        
        Logger.log(`初始地图加载完成: ${gameMap.name}`);
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

        // 第二章：章末「登船」路标由代码动态生成
        // （与第一章 createDepartSignpost 同一思路：路标要挂在回调上，不能只靠地图配置）
        const boatQuest = this.player.questSystem.getQuestState
            ? this.player.questSystem.getQuestState('chapter2_ending_2')
            : null;
        if (boatQuest && boatQuest.state !== 'locked') {
            this.ensureChapter2BoatSignpost();
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
                    Logger.log(`[Main] 跳过拾取物 ${config.name}：任务 ${config.questId} 已完成`);
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
                        Logger.log(`[Main] 暂存拾取物 ${config.name}：等待任务 ${config.questId} 激活`);
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
                        Logger.log(`[Main] 拾取物 ${config.name} 尚未出现：需先完成 ${req.type}:${req.target}`);
                        continue;
                    }
                }

                // 任务进行中，但目标已达成 → 不创建
                if (questState.state === 'active') {
                    const findObj = (questState.objectives || []).find(obj => 
                        obj.type === config.objectiveType && obj.target === config.itemId);
                    if (findObj && findObj.completed) {
                        Logger.log(`[Main] 跳过拾取物 ${config.name}：目标已完成`);
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
            Logger.log(`[Main] 创建拾取物: ${config.name} (${config.itemId}) 于 (${config.position.x}, ${config.position.y})`);
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
                // 战斗只由 BattleScene.update（SceneManager 每帧调一次）驱动。
                // 这里不再重复驱动（第十四次改动）：旧写法 BattleScene.update 与 Main.updateBattle
                // 各调一次 battleSystem.update → 同一帧推进两遍，回合倒计时 / 敌人行动延迟全部按 2× 速度走。
                // 与 'miniGame' 同一条规则：场景自持的场景，Main 只做分派，不重复推进。
                break;
                
            case 'miniGame':
                // 小游戏只由 MiniGameScene.update（SceneManager 每帧调一次）驱动。
                // 这里不再重复驱动（第十三次改动）：旧写法 MiniGameScene.update 与
                // Main.updateMiniGame 各更新一次 → 同一帧 dt 翻倍（乘风采药固定 3 秒的风
                // 会变成「实际 1.5 秒」）、同一份 pressedKeys 也会被读两遍。
                break;

            case 'ending':
                // 游戏完结界面：由 EndingScene.update（SceneManager 已调用）自行推进滚动与按键处理，
                // 此处不更新世界（地图 / NPC / 战斗 / UI 全部停摆）
                break;
        }
        
        // 更新音频：推进「回主图 10 秒后再播背景音乐」的倒计时（见 AudioManager.scheduleBgm）
        if (this.audioManager) {
            this.audioManager.update(deltaTime);
        }

        // 小游戏结算回主图的「E 键保护期」倒计时（见 MINI_GAME_EXIT_GUARD_SECONDS）
        if (this._miniGameExitGuard > 0) {
            this._miniGameExitGuard = Math.max(0, this._miniGameExitGuard - deltaTime);
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

        // ===== 结丹调息（第二章章末）：同样封锁输入，只推进序列与气场特效 =====
        if (this.isCoreTrialPlaying) {
            this.inputManager.setMovementBlocked(true);
            this.inputManager.setInputBlocked(true);
            if (this.playerCombat) {
                this.playerCombat.update(deltaTime, { pressedKeys: {} });
            }
            this.updateCoreFormationTrial(deltaTime);
            return;
        }

        // ===== 剧情时间轴（替代嵌套 setTimeout；见 startStoryTimeline）=====
        // 放在两个调息早退分支之后、对话处理之前：
        //   · 调息期间由各自的计时器驱动，不需要时间轴；
        //   · 在对话处理之前推进 → `at: 0` 的步骤天然延迟一帧执行（等效原 setTimeout(0)）。
        this.updateStoryTimeline(deltaTime);

        // 江婆「获救后」立绘的异步加载重试（0.1 秒一次，最多 20 次）
        this.updateChapter2IdleRetry(deltaTime);

        // 战斗短字幕计时（不阻塞操作）
        if (this.subtitle.timer > 0) {
            this.subtitle.timer = Math.max(0, this.subtitle.timer - deltaTime);
            if (this.subtitle.timer === 0) this.subtitle.text = '';
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
            
            // 更新对话选项按钮（唯一更新点：喂本帧真实鼠标坐标；
            // DialogBox.update 已不再用 (0,0) 空鼠标刷它们，否则悬停音效会每帧重播）
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
        // 更新战斗系统（判空：测试 / 极早期可能尚未创建 battleSystem）
        if (this.battleSystem && this.battleSystem.isInBattle) {
            this.battleSystem.update(deltaTime);
        }
        
        // 刷新镇风桩可调查状态（随任务进度实时变化）
        this.updateWindPileQuestGates(this.currentMap);

        // ====== 战场战斗流程（主线四） ======
        // 胜利：战败动画播完 → 一次性结算（记剧情标记 + 战场正中心开启永久归途法阵），不自动离场
        this.updateBossArenaBattle();

        // 渡厄使「控制」禁键计时（到时自动恢复按键输入）
        this.updateBossArenaControlLock(deltaTime);

        // ====== 战场内死亡 → 回到法阵旁（第一章山口 / 第二章万灯台）======
        // Boss 把玩家打至 isAlive=false 即会命中此分支；
        // 胜利离场改由战场内地图正中心的归途法阵（按 E）触发，不再有倒计时自动传送。
        if (!this.isReturningFromBossArena && this.player && this.player.isAlive === false
            && this.currentMap && this.isArenaMap(this.currentMap.mapId)) {
            this.releaseArenaControlLock();
            this.returnFromBossArena();
        }

        // 任务栏打开 → 忽略所有游戏操作
        if (!this.questUI.isVisible && !this.dialogBox.isVisible) {
            // 检查交互键（输入被完全封锁时交互同样无响应 —— 如渡厄使「控制」禁键，
            // 旧写法只看「任务栏 / 对话框」，被锁住时按 E 还能开对话 / 进战场）
            if (input.pressedKeys['e'] && !this.mapTeleport.isVisible
                && !(this.inputManager && typeof this.inputManager.isInputBlocked === 'function'
                    && this.inputManager.isInputBlocked())) {
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
     * 启动游戏
     */

    start() {
        if (!this.isInitialized) {
            console.error('游戏未初始化');
            return;
        }
        
        this.gameLoop.start();
        Logger.log('游戏启动');
    }

    /**
     * 暂停游戏
     */

    pause() {
        this.gameLoop.pause();
        Logger.log('游戏暂停');
    }

    /**
     * 恢复游戏
     */

    resume() {
        this.gameLoop.resume();
        Logger.log('游戏恢复');
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