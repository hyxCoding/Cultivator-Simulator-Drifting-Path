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

        // 渡厄使「控制」禁键（见 startArenaControlLock / updateBossArenaControlLock）
        this.arenaControlLockActive = false;
        this.arenaControlLockTimer = 0;

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
        this.chapter2JiangpoIdleTimer = null;   // 江婆「获救后」立绘的延迟重试计时器（动画异步加载）
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
                console.log('[游戏] 第一章剧情配置加载完成');
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
                console.log('[游戏] 第二章剧情配置加载完成');
            } else {
                console.warn('[游戏] ChapterLoader或Chapter2Config未加载，跳过第二章配置注册');
            }
        } catch (error) {
            console.warn('[游戏] 第二章章节配置加载失败:', error);
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

        // ====== 任务完成时（ACTIVE → COMPLETED）：发奖 + NPC搬迁 + 治疗 + 道具清除 ======
        qs.onQuestComplete = (questId, rewards) => {
            console.log(`[Main] 任务完成: ${questId}`, rewards);
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
                    console.log(`[Main] 移除已完成任务的道具: ${id}`);
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

        // 音频管理器（背景音乐循环 / 音效单次；缺失音频文件时静默跳过）
        this.audioManager = AudioManager.getInstance();
    }

    // ==================== 音频调度（背景音乐 / 音效）====================

    /**
     * 当前主图应播的背景音乐键
     * Boss 战场 / 未知地图没有主图 BGM → null
     * @returns {string|null}
     */
    getCurrentMapBgmKey() {
        if (!this.currentMap || !this.currentMap.mapId) return null;
        return AudioManager.getMapBgmKey(this.currentMap.mapId);
    }

    /**
     * 进入大地图场景（GameWorldScene.enter → 本方法）
     * · 首次（从开始界面点「开始游戏」进来）：主图 BGM 立刻起播；
     * · 之后（小游戏退出 / Boss 关退出 / 完结界面返回 / 从世界地图传送落地）：
     *   立刻停掉其它音乐，等 10 秒再播当前主图的 BGM（频繁切换则重新计时）。
     */
    onGameWorldSceneEnter() {
        const firstEntry = !this.hasEnteredGameWorld;
        this.hasEnteredGameWorld = true;

        if (firstEntry) {
            this.playCurrentMapBgm();
        } else {
            this.scheduleMainMapBgm();
        }
    }

    /**
     * 离开大地图场景（GameWorldScene.exit → 本方法）
     * 进小游戏 / 进战斗场景 / 进完结界面：主图 BGM 立即停（结束界面 / 小游戏会自行起播各自的 BGM）
     */
    onGameWorldSceneExit() {
        this.stopMainMapBgm();
    }

    /**
     * 立即起播当前主图的背景音乐（没有对应 BGM 的图则不停不播）
     * @returns {boolean}
     */
    playCurrentMapBgm() {
        if (!this.audioManager) return false;
        const key = this.getCurrentMapBgmKey();
        return key ? this.audioManager.playBgm(key) : false;
    }

    /**
     * 回主图：立刻停掉当前音乐，登记「10 秒后再播本图 BGM」
     * @param {number} [delay] - 等待秒数（缺省 10 秒；测试可传小值）
     * @returns {boolean}
     */
    scheduleMainMapBgm(delay) {
        if (!this.audioManager) return false;
        // 重复调度 = 重新计时（需求：频繁传送时 10 秒倒计时每次重新开始）
        this.audioManager.stopBgm(this._mainMapBgmKeys());
        const key = this.getCurrentMapBgmKey();
        if (!key) return false;
        const seconds = (typeof delay === 'number') ? delay : AudioManager.MAP_BGM_RETURN_DELAY;
        return this.audioManager.scheduleBgm(key, seconds);
    }

    /**
     * 停掉主图背景音乐（正在播的 + 10 秒倒计时中的），不动小游戏 / 完结界面 / 开始界面的 BGM
     * @returns {boolean}
     */
    stopMainMapBgm() {
        if (!this.audioManager) return false;
        return this.audioManager.stopBgm(this._mainMapBgmKeys());
    }

    /** 全部主图 BGM 键（AudioManager.MAP_BGM 的值列表） */
    _mainMapBgmKeys() {
        return Object.keys(AudioManager.MAP_BGM).map(mapId => AudioManager.MAP_BGM[mapId]);
    }

    /**
     * 提早尝试起播开始界面背景音乐（bgm.main_menu）—— Main.init 加载阶段调用
     * · 正常情况（玩家此前已与页面交互过）：加载界面就开始循环播放；
     * · 被浏览器自动播放策略拦下：AudioManager 记下这次尝试，玩家的第一次点击 / 按键
     *   （**包括在加载界面上发生的那一次**）会立刻补播 —— 不必在开始界面再点一次；
     * · 正式开始界面（MainMenuScene.enter）还会再调一次 playBgm：同一首已在播时不会重头播。
     * @returns {boolean} 是否成功发起播放（被拦下时返回 true，由 AudioManager 负责补播）
     */
    startMenuBgmEarly() {
        return gameAudio.playBgm('bgm.main_menu');
    }

    /**
     * 地图切换（Main.switchToMap 调用）后的背景音乐处理：
     * · 落到 Boss 战场 → 主图 BGM 立即停（战场没有背景音乐）；
     * · 落到主图（另一张图 / 从战场返回）→ 10 秒后再播该图 BGM。
     * @param {string} fromMapId - 切换前的地图 ID
     * @param {string} toMapId - 切换后的地图 ID
     */
    onMapSwitched(fromMapId, toMapId) {
        if (!this.audioManager) return;

        // 只是同一张地图内的重新落点（例如同图传送）→ 不动音乐
        if (fromMapId && toMapId && fromMapId === toMapId) return;

        if (this.isArenaMap(toMapId)) {
            // 进 Boss 关：立即停止主图背景音乐（战场本身没有 BGM）
            this.stopMainMapBgm();
            return;
        }

        if (AudioManager.getMapBgmKey(toMapId)) {
            this.scheduleMainMapBgm();
        } else {
            // 未知地图（没有配 BGM）→ 别留上一张图的音乐
            this.stopMainMapBgm();
        }
    }

    /**
     * 播放一次音效（缺失音频文件时静默跳过）
     * @param {string} key - 音频键，如 'sfx.victory'
     * @returns {boolean}
     */
    playSfx(key) {
        return this.audioManager ? this.audioManager.playSfx(key) : false;
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
            console.log(`[Main] ${this.trainingManager.currentLabel || '基础训练'} 全部完成！`);
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
            console.log(`[Main] 拾取物品: ${pickupItem.name}`);
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

            // 调查点附带发放的剧情物品（如万灯台台后的转运账册 / 太玄增供命令）
            if (Array.isArray(windPile.grantItems) && windPile.grantItems.length > 0) {
                windPile.grantItems.forEach(itemId => this.grantQuestItem(itemId, 1, true));
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
            console.log(`[传送] 进入 ${teleportArray.targetMapId}`);
            await this.switchToMap(teleportArray.targetMapId, teleportArray.targetPosition);
        } finally {
            this.player.isInteracting = false;
            this.inputManager.setMovementBlocked(false);
        }
    }

    /**
     * 进入战场（第一章《山口不止风》摄风山魈 / 第二章《万灯渡口》渡厄使共用本流程）
     * - 记录法阵位置作为返回点（战败后落回法阵旁；胜利后由战场内归途法阵回到这里）
     * - 玩家数据（气血、灵力、速度、伤害、技能等）随同一个 Player 实例进入战场，不做重置
     * - Boss 只生成一次：已被击败过（剧情标记）则不再生成，并保证地图正中心的归途法阵存在
     * - 战场参数（击败标记 / 胜利推进的目标 / 资源分组 / 返回地图）来自传送法阵配置，
     *   缺省时回落到第一章的默认值
     * @param {TeleportArray} teleportArray - 战场入口法阵
     */
    async enterBossArena(teleportArray) {
        if (!this.player || !teleportArray) return;

        // 进场即清掉上一次「打赢 Boss 的胜利音效」待播标记：
        // 只有这一次真的打赢 Boss 并从归途法阵回原位置时才补播（见 triggerTeleport）
        this.pendingBossVictorySound = false;

        const arenaMapId = teleportArray.targetMapId || this.bossArenaMapId;
        const dropPoint = this.getBossArenaReturnPoint(teleportArray);
        this.bossArenaReturn = dropPoint;
        this.activeArena = {
            mapId: arenaMapId,
            defeatFlag: teleportArray.arenaDefeatFlag || this.bossArenaDefeatedFlag,
            victory: teleportArray.arenaVictory || {
                questId: 'chapter1_main_4', type: 'defeat_boss', target: 'boss_shanxiao',
            },
            resourceGroup: teleportArray.arenaResourceGroup || 'bossArena',
            returnMapId: teleportArray.arenaReturnMapId || 'qinglan_fuye',
            // 战败成长参数（来自战场传送法阵配置）：每次战败提升的上限与次数上限
            defeatBonus: teleportArray.arenaDefeatBonus || null,
            returnPoint: dropPoint,
        };

        this.player.isInteracting = true;
        this.inputManager.setMovementBlocked(true);

        try {
            const arenaMap = await this.switchToMap(arenaMapId, teleportArray.targetPosition);
            if (!arenaMap) return;

            // 预加载 Boss 精灵图（上次战斗结束时已释放，避免第二次进场出现空帧）
            await this.preloadBossArenaImages(this.activeArena.resourceGroup);

            // Boss 就位：只在"尚未被击败"时生成（击败过则整场不再出现）
            // 击败判据见 isArenaBossAlreadyDefeated：战场击败标记已写入，
            // 或该战场的「击败 Boss」目标已经完成 —— 两条都算赢过；因此不论隔多久
            // 再进场（换了入口、读档重进也一样），渡厄使都不会重新生成。
            const defeated = this.isArenaBossAlreadyDefeated(this.activeArena);
            if (arenaMap.setArenaBossDefeated) {
                arenaMap.setArenaBossDefeated(defeated);
            }
            if (defeated) {
                // 永久归途法阵：地图正中心，落点＝进场时的"原来位置"
                this.ensureBossArenaExitArray(arenaMap);
            } else {
                // 第二章：先播战前对白（B01），对白读完再开战（此时才生成 Boss）
                if (this.isChapter2Map(arenaMapId) && !this.hasStoryFlag('chapter2_b01_seen')) {
                    this.setStoryFlag('chapter2_b01_seen');
                    // 对白期间渡厄使不上场：地图载入时已随 bossPosition 生成的实体先撤下，
                    // 同时给地图挂上入场冻结（双保险）—— 保证读对白时它不移动、不出手，
                    // 因为此时玩家被锁输入，无法走位躲避。对白读完 startArenaFight 再生成并解冻。
                    if (typeof arenaMap.setArenaIntroLock === 'function') {
                        arenaMap.setArenaIntroLock(true);
                    }
                    if (typeof arenaMap.detachArenaBoss === 'function') {
                        arenaMap.detachArenaBoss();
                    }
                    this.playStoryDialogue('b01_encounter', '渡厄使: ', () => this.startArenaFight(arenaMap));
                } else {
                    this.startArenaFight(arenaMap);
                }
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
     * 正式开战：解除入场冻结、生成战场 Boss、设置目标与招式回调
     * （第二章渡厄使另有召唤小兵 / 控制命中 / 低气血短字幕回调）
     * @param {GameMap} arenaMap - 战场地图实例
     */
    startArenaFight(arenaMap) {
        const map = arenaMap || this.currentMap;
        if (!map || !map.ensureArenaBoss) return null;

        // 战前对白已经读完：先解除入场冻结，再生成 / 接管渡厄使（对白期间它被撤下或冻结）
        if (typeof map.setArenaIntroLock === 'function') {
            map.setArenaIntroLock(false);
        }

        const boss = map.ensureArenaBoss();
        if (!boss) return null;

        // 通用 Boss（含渡厄使）需要手动设置目标与攻击手势回调
        if (typeof boss.setTarget === 'function' && this.player) {
            boss.setTarget(this.player);
        }
        boss.map = map;

        // 第二章：渡厄使招式回调（召唤小兵 / 控制命中 → 短字幕 + 禁键）
        if (typeof boss.startFight === 'function') {
            boss.onSummon = (dueBoss, minion) => {
                this.showSubtitle(this.getChapter2StoryText('subtitle_summon'), 5);
            };
            boss.onControl = (dueBoss, lockDuration) => {
                this.showSubtitle(this.getChapter2StoryText('subtitle_control'), 3.5);
                this.startArenaControlLock(lockDuration);
            };
            boss.onLowHealth = () => {
                this.showSubtitle(this.getChapter2StoryText('subtitle_low_hp'), 6);
            };
            if (!boss.fightStarted) {
                this.showSubtitle(this.getChapter2StoryText('subtitle_retry'), 3.5);
            }
            boss.startFight();
        }

        return boss;
    }

    /**
     * 渡厄使「控制」命中：玩家头顶出现锁链图 + 禁止一切按键输入
     * - 锁链图由 PlayerCombat.attachControlChain 绘制（32×32，跟随玩家头顶）
     * - 输入封锁用 inputManager.setInputBlocked(true)，到时由
     *   updateBossArenaControlLock 解除（战场内死亡 / 离开战场也会兜底解除）
     * @param {number} [duration=3] - 禁键时长（秒）
     */
    startArenaControlLock(duration = 3) {
        const seconds = Math.max(0, duration || 0);
        this.arenaControlLockTimer = seconds;
        this.arenaControlLockActive = seconds > 0;

        if (seconds <= 0) return;

        if (this.inputManager) {
            this.inputManager.setInputBlocked(true);
            this.inputManager.setMovementBlocked(true);
        }
        if (this.playerCombat && typeof this.playerCombat.attachControlChain === 'function') {
            this.playerCombat.attachControlChain(seconds);
        }

        console.log(`[Boss战场] 渡厄使控制命中：禁止按键 ${seconds} 秒`);
    }

    /**
     * 推进「控制」禁键计时（每帧由 updateGameWorld 调用；到时自动解除）
     * @param {number} deltaTime
     */
    updateBossArenaControlLock(deltaTime) {
        if (!this.arenaControlLockActive) return;

        this.arenaControlLockTimer -= deltaTime;
        if (this.arenaControlLockTimer > 0) return;

        this.releaseArenaControlLock();
    }

    /** 解除「控制」禁键（到时 / 玩家阵亡 / 离场时调用） */
    releaseArenaControlLock() {
        if (!this.arenaControlLockActive) return;

        this.arenaControlLockActive = false;
        this.arenaControlLockTimer = 0;

        if (this.inputManager) {
            this.inputManager.setInputBlocked(false);

            // 若此刻正在播剧情对白（例如击杀瞬间的 B04），移动继续保持封住，
            // 交给对白结束流程解锁；否则直接解锁移动
            const dialogueOpen = !!(this.dialogBox && this.dialogBox.isVisible);
            this.inputManager.setMovementBlocked(dialogueOpen);
        }
        if (this.playerCombat && typeof this.playerCombat.stopControlChain === 'function') {
            this.playerCombat.stopControlChain();
        }

        console.log('[Boss战场] 渡厄使控制结束，恢复按键输入');
    }

    /**
     * 预加载战场 Boss 相关精灵图（进场时调用）
     * 资源键统一维护在 ResourceManager.resourceGroups.<分组名>（单一数据源）：
     *   第一章 'bossArena'（摄风山魈）/ 第二章 'bossArenaCh2'（渡厄使）
     * Boss.destroy() 会释放这些图片缓存，因此再次进场需要重新加载
     * @param {string} [resourceGroup='bossArena'] - 资源分组名
     */
    async preloadBossArenaImages(resourceGroup = 'bossArena') {
        if (!this.resourceManager) return;

        // 优先走资源分组：键列表只在 ResourceManager 里维护一份
        if (typeof this.resourceManager.preloadResourceGroup === 'function') {
            await this.resourceManager.preloadResourceGroup(resourceGroup);
            return;
        }

        // 兜底：不支持资源分组的旧版 ResourceManager（仅第一章 Boss）
        if (!this.resourceManager.loadImages) return;
        await this.resourceManager.loadImages([
            'monsters.boss_shanxiao_idle',
            'monsters.boss_shanxiao_walk',
            'monsters.boss_shanxiao_attack',
            'monsters.boss_shanxiao_skill1',
            'monsters.boss_shanxiao_skill2',
            'monsters.boss_shanxiao_hurt',
            'monsters.boss_shanxiao_dead',
            'monsters.boss_due_idle',
            'monsters.boss_due_move',
            'monsters.boss_due_dash',
            'monsters.boss_due_summon',
            'monsters.boss_due_control',
            'monsters.boss_due_hurt',
            'monsters.boss_due_dead',
            'monsters.boss_due_minion_idle',
            'monsters.boss_due_minion_move',
            'monsters.boss_due_minion_attack',
            'effects.boss_due_chain',
            'effects.boss_pounce_dust',
            'effects.boss_charge_wind',
        ]);
    }

    /**
     * 清理战场：删除 Boss 实体并释放其资源（战败离场时调用）
     * @returns {boolean} 是否执行了清理
     */
    clearBossArenaResources() {
        const arenaMapId = (this.activeArena && this.activeArena.mapId) || this.bossArenaMapId;
        const arenaMap = this.mapManager && this.mapManager.getMap
            ? this.mapManager.getMap(arenaMapId)
            : null;

        if (!arenaMap || !arenaMap.clearArenaBoss) {
            return false;
        }

        return arenaMap.clearArenaBoss();
    }

    /**
     * Boss 战败成长：每个战场每次战败都会提升气血 / 灵息上限
     * - 参数来源：战场传送法阵配置 arenaDefeatBonus { id, maxHealth, maxMana, maxFailures }
     *     第一章摄风山魈：气血上限 +20 / 灵息上限 +10，最多结算 5 次
     *     第二章渡厄使  ：气血上限 +35 / 灵息上限 +20，最多结算 5 次
     * - 战败次数（PlayerData.bossFailures）与累计加成（maxHealthBonus / maxManaBonus）随存档保存；
     *   境界切换时由 Main.applyPermanentStatBonus 把累计加成叠加在境界基准值之上；
     * - 达到 maxFailures 后不再提升（只写 console 日志，不再发通知）。
     * @param {Object} [arena] - 战场参数（缺省用 this.activeArena）
     * @returns {boolean} 本次是否实际提升了上限
     */
    applyBossFailureBonus(arena) {
        const info = arena || this.activeArena;
        if (!this.player || !this.player.playerData || !info) return false;

        const bonus = info.defeatBonus;
        if (!bonus) return false;

        const bonusHealth = bonus.maxHealth || 0;
        const bonusMana = bonus.maxMana || 0;
        if (bonusHealth <= 0 && bonusMana <= 0) return false;

        const maxFailures = bonus.maxFailures > 0 ? bonus.maxFailures : 5;
        const key = bonus.id || info.defeatFlag || info.mapId || 'boss';

        const data = this.player.playerData;
        if (!data.bossFailures) data.bossFailures = {};

        const times = data.bossFailures[key] || 0;
        if (times >= maxFailures) {
            console.log(`[Boss战场] ${key} 战败成长已达上限（${maxFailures} 次），本次不再提升上限`);
            return false;
        }

        data.bossFailures[key] = times + 1;
        data.maxHealthBonus = (data.maxHealthBonus || 0) + bonusHealth;
        data.maxManaBonus = (data.maxManaBonus || 0) + bonusMana;
        data.maxHealth += bonusHealth;
        data.maxMana += bonusMana;
        data.health = Math.min(data.maxHealth, data.health + bonusHealth);
        data.mana = Math.min(data.maxMana, data.mana + bonusMana);

        console.log(`[Boss战场] 第 ${times + 1}/${maxFailures} 次战败：气血上限 +${bonusHealth}、灵息上限 +${bonusMana}`);
        this.addGameNotification(`屡败屡进：气血上限 +${bonusHealth}，灵息上限 +${bonusMana}（${times + 1}/${maxFailures}）`);
        return true;
    }

    /**
     * 战败后回到法阵旁
     * - 复活并落回法阵旁，不发放战利品
     * - 战败成长：先按战场配置提升上限（见 applyBossFailureBonus），再由 revive 按新上限回满
     * - 战败清场：清掉自身的技能效果（闪避加速 / 护身术减伤）与全部技能冷却
     *   （PlayerCombatSystem.resetOnDeath，第十三次改动）
     * - 胜利不再走这里：Boss 伏诛后由 handleBossArenaVictory 在战场正中心开启永久归途法阵，
     *   玩家自行按 E 返回原来位置（回归后的 switchToMap 会依任务目标补生成战利品）
     * @returns {Promise<boolean>} 是否成功返回
     */
    async returnFromBossArena() {
        if (!this.player || this.isReturningFromBossArena) return false;

        // 被 Boss 打败（战场内阵亡）→ 播一次失败音效；同时清掉可能残留的胜利待播标记
        this.pendingBossVictorySound = false;
        this.playSfx('sfx.defeat');

        // 战败清场（第十三次改动，2026-09-13）：清掉自身的技能效果（闪避的加速、护身术的减伤）
        // 并把所有技能冷却清 0 —— 复活后是干净的上场状态，不会带着上一轮的增益 / 冷却重打。
        // 见 PlayerCombatSystem.resetOnDeath（顺带清受伤僵直与施法残留）。
        if (this.playerCombat && typeof this.playerCombat.resetOnDeath === 'function') {
            this.playerCombat.resetOnDeath();
        }

        // 离开战场：兜底解除「控制」禁键（正常情况计时已到）
        this.releaseArenaControlLock();

        const dropPoint = this.bossArenaReturn || this.getBossArenaReturnPoint();
        const mapId = dropPoint.mapId || 'qinglan_fuye';

        this.isReturningFromBossArena = true;
        try {
            const backMap = await this.switchToMap(mapId, { x: dropPoint.x, y: dropPoint.y });
            if (!backMap) return false;

            // 清理战场：删除战场 Boss 并释放其资源（再次进场会重新生成，直到它被击败）
            this.clearBossArenaResources();

            // 战败成长：先提升上限（前 5 次），再由 revive 按新上限回满
            this.applyBossFailureBonus();

            // 落回法阵旁后复活（气血/灵力恢复，短暂无敌）
            if (!this.player.isAlive && this.player.revive) {
                this.player.revive({ x: dropPoint.x, y: dropPoint.y });
            }

            console.log('[Boss战场] 玩家战败，已回到法阵旁');
            this.addGameNotification('被击退，回到法阵旁');
            // 第二章：按 JSON B05 给出战败提示（可调整后重新挑战）
            if (this.isChapter2Map(mapId)) {
                this.showSubtitle(this.getChapter2StoryText('subtitle_death'), 5);
            }

            return true;
        } finally {
            this.isReturningFromBossArena = false;
        }
    }

    /**
     * 战场 Boss 是否已被击败（按剧情标记判断；击败后战场不再生成 Boss）
     * @param {string} [flag] - 剧情标记名（缺省用第一章摄风山魈的标记）
     * @returns {boolean}
     */
    hasBossDefeated(flag) {
        const questSystem = this.player && this.player.questSystem;
        if (!questSystem || typeof questSystem.hasStoryFlag !== 'function') return false;
        return questSystem.hasStoryFlag(flag || this.bossArenaDefeatedFlag || 'boss_shanxiao_defeated');
    }

    /**
     * 兼容旧调用名：摄风山魈是否已被击败
     * @returns {boolean}
     */
    hasBossShanxiaoDefeated() {
        return this.hasBossDefeated(this.bossArenaDefeatedFlag || 'boss_shanxiao_defeated');
    }

    /**
     * 这场战斗的 Boss 是否已经打赢过（决定进场时还要不要生成）
     *
     * 判据（任一成立即算赢过 → 进场不再生成 Boss）：
     *   1) 战场击败标记已写入（handleBossArenaVictory → setStoryFlag(arena.defeatFlag)）；
     *   2) 该战场的「击败 Boss」任务目标已完成 —— 兼容「打赢了但标记没落盘」的情况
     *      （旧存档 / 曾经的调试通道击杀）。只凭标记判断时，这两种情况都会让
     *      Boss 在下次进场时复活 —— 现在只要赢过一次就不会再刷。
     * 命中第 2 条时顺手把标记补上（幂等），之后直接走第 1 条。
     *
     * 注意：战败退回不算赢过 → 两条都不成立，玩家可以再进战场重试。
     *
     * @param {Object} [arena] - 战场参数 { defeatFlag, victory }（缺省用 this.activeArena）
     * @returns {boolean}
     */
    isArenaBossAlreadyDefeated(arena) {
        const info = arena || this.activeArena;
        if (!info) return false;

        if (this.hasBossDefeated(info.defeatFlag)) return true;

        const questSystem = this.player && this.player.questSystem;
        const victory = info.victory;
        if (questSystem && victory && typeof questSystem.isObjectiveCompleted === 'function'
            && questSystem.isObjectiveCompleted(victory.questId, victory.type, victory.target)) {
            // 目标已完成 = 确实赢过 → 补记击败标记，此后进场直接走第 1 条
            this.setStoryFlag(info.defeatFlag);
            return true;
        }

        return false;
    }

    /**
     * 在战场地图正中心生成 / 刷新永久归途法阵
     * 目标落点＝进场时记录的"原来位置"（山口法阵旁）
     * @param {GameMap} [arenaMap] - 战场地图实例（缺省时从 MapManager 取）
     * @returns {TeleportArray|null}
     */
    /**
     * 该传送法阵是否是战场「归途法阵」（打赢 Boss 后回原位置的出口）
     * @param {TeleportArray} teleportArray
     * @returns {boolean}
     */
    isBossArenaExitArray(teleportArray) {
        return !!(teleportArray && teleportArray.id === 'teleport_boss_exit');
    }

    ensureBossArenaExitArray(arenaMap) {
        const arenaMapId = (this.activeArena && this.activeArena.mapId) || this.bossArenaMapId;
        const map = arenaMap || (this.mapManager && this.mapManager.getMap
            ? this.mapManager.getMap(arenaMapId)
            : null);

        if (!map || typeof map.createArenaExitArray !== 'function') return null;

        const dropPoint = this.bossArenaReturn || this.getBossArenaReturnPoint();
        const targetMapId = dropPoint.mapId || 'qinglan_fuye';
        return map.createArenaExitArray({
            targetMapId: targetMapId,
            targetPosition: { x: dropPoint.x, y: dropPoint.y },
            promptText: this.isChapter2Map(targetMapId)
                ? this.getChapter2ArenaConfig().exitPrompt
                : '按 E 返回青岚浮野',
        });
    }

    /**
     * 战场 Boss 伏诛结算（战败动画播完后由 updateBossArenaBattle 调用，只执行一次）
     * 1) 记录剧情标记（第一章 boss_shanxiao_defeated / 第二章 due_boss_defeated）→ 之后进场不再生成 Boss
     * 2) 推进对应的「击败 Boss」任务目标
     * 3) 清理 Boss 实体（释放精灵图缓存）
     * 4) 在战场地图正中心开启永久归途法阵（按 E 回到原来位置）
     * 战利品在玩家用法阵回到主图时按任务目标补生成。
     * @param {GameMap} [arenaMap] - 战场地图实例
     */
    handleBossArenaVictory(arenaMap) {
        if (this.bossArenaVictoryHandled) return;

        const arena = this.activeArena || {
            mapId: this.bossArenaMapId,
            defeatFlag: this.bossArenaDefeatedFlag || 'boss_shanxiao_defeated',
            victory: { questId: 'chapter1_main_4', type: 'defeat_boss', target: 'boss_shanxiao' },
            returnMapId: 'qinglan_fuye',
        };

        const map = arenaMap || this.currentMap;
        if (!map || map.mapId !== arena.mapId) return;

        this.bossArenaVictoryHandled = true;

        // 胜利音效不在这里播：需求是「打赢 Boss 并通过传送门回到原来位置」才播，
        // 所以这里只挂起标记，等玩家走归途法阵回原位置时由 triggerTeleport 补播
        // （打赢后再进战场不会再生成 Boss，因此后续进场不会误播）
        this.pendingBossVictorySound = true;

        // 1) 剧情标记（读档 / 再次进场时据此不再生成 Boss）
        this.setStoryFlag(arena.defeatFlag);

        // 2) 推进主线「击败 Boss」目标
        if (this.player && this.player.questSystem && arena.victory) {
            this.player.questSystem.updateQuestProgress(
                arena.victory.questId, arena.victory.type, arena.victory.target, 1
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

        const bossName = this.isChapter2Map(arena.mapId) ? '渡厄使' : '摄风山魈';
        console.log(`[Boss战场] ${bossName}已伏诛，战场中央已开启归途法阵`);
        this.addGameNotification(`${bossName}已伏诛，战场中央已开启归途法阵`);

        // 第二章：胜利演出（B04）+ 把救助院的 NPC 安排到战后状态
        if (this.isChapter2Map(arena.mapId)) {
            this.playStoryDialogue('b04_boss_win', '旁白: ');
            this.repositionChapter2AfterBoss();
        }
    }

    /**
     * 计算“法阵旁”的落点（世界坐标，像素）
     * 优先使用进场时记录的入口法阵位置；读档直接进入战场时回落到配置中的战场法阵。
     * @param {TeleportArray} [teleportArray] - 可选：直接指定法阵
     * @returns {{mapId: string, x: number, y: number}}
     */
    getBossArenaReturnPoint(teleportArray) {
        const OFFSET_Y = 88;    // 落在法阵下缘外侧，避免正好站在法阵中心

        // 返回地图：优先取法阵配置，其次取进场前所在的主图
        const returnMapId = (teleportArray && teleportArray.arenaReturnMapId)
            || (this.activeArena && this.activeArena.returnMapId)
            || (this.currentMap && this.currentMap.mapId && !this.isArenaMap(this.currentMap.mapId)
                ? this.currentMap.mapId
                : 'qinglan_fuye');

        const arrayPosition = teleportArray && teleportArray.position
            ? teleportArray.position
            : this.findBossArenaTeleportPosition(returnMapId);

        if (arrayPosition) {
            return {
                mapId: returnMapId,
                x: arrayPosition.x,
                y: arrayPosition.y + OFFSET_Y,
            };
        }

        // 兜底一：第二章云渡泽石台法阵（Chapter2Config）
        if (this.isChapter2Map(returnMapId) && window.Chapter2Config) {
            const wandengtai = Chapter2Config.getMapConfigs().yunduze.teleporters.wandengtai;
            return {
                mapId: returnMapId,
                x: wandengtai.worldPosition.x,
                y: wandengtai.worldPosition.y + OFFSET_Y,
            };
        }

        // 兜底二：与 Chapter1Config 中主线四法阵的世界坐标保持一致（2946, 231）
        return { mapId: returnMapId, x: 2946, y: 231 + OFFSET_Y };
    }

    /**
     * 在已加载的地图中查找战场入口法阵的位置（世界坐标）
     * @param {string} [mapId='qinglan_fuye'] - 入口法阵所在的地图
     * @returns {Object|null}
     */
    findBossArenaTeleportPosition(mapId = 'qinglan_fuye') {
        if (!this.mapManager || !this.mapManager.getMap) return null;
        const sourceMap = this.mapManager.getMap(mapId);
        if (!sourceMap || !sourceMap.teleporters) return null;
        for (const [, teleport] of sourceMap.teleporters) {
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
     * 接取任务（带玩家可见的失败提示）—— 第一章 / 第二章共用的唯一接取入口
     *
     * 背景：QuestSystem.acceptQuest 只返回布尔值，前置未满足时仅打印 console 警告。
     * 玩家在对话里点了「接取」却什么都没发生（任务面板仍是「暂无任务」），
     * 只看得到“接了任务但面板没显示”。这里统一为：
     *   先问 QuestSystem.getAcceptStatus 拿原因 → 成功才接取 → 失败给屏幕通知。
     *
     * @param {string} questId - 任务ID
     * @returns {boolean} 是否接取成功
     */
    tryAcceptQuest(questId) {
        if (!questId) return false;
        const questSystem = this.player && this.player.questSystem;
        if (!questSystem) return false;

        if (typeof questSystem.getAcceptStatus === 'function') {
            const status = questSystem.getAcceptStatus(questId);
            if (!status.ok) {
                console.warn(`[Main] 任务 ${questId} 接受失败：${status.reason}`);
                this.addGameNotification(`无法接取任务：${status.reason}`);
                return false;
            }
        }

        const success = questSystem.acceptQuest(questId);
        if (!success) {
            // 兜底（理论上 getAcceptStatus 已覆盖）：保持显式提示，不要再静默失败
            console.warn(`[Main] 任务 ${questId} 接受失败（前置条件未满足或已接受）`);
            this.addGameNotification('无法接取任务：条件未满足');
        }
        return success;
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

        // 设置 NPC 的任务发布回调（失败时会给出玩家可见提示，见 tryAcceptQuest）
        npc.onAssignQuest = (questId) => {
            this.tryAcceptQuest(questId);
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

        // ===== 第二章：剑修连招试炼（陆舟，动作 start_sword_training） =====
        npc.onSwordTraining = () => {
            this.startSwordTraining(npc);
        };

        // ===== 第二章：逆流送灯（陆舟，动作 start_river_escort） =====
        npc.onRiverEscort = () => {
            this.startRiverEscort(npc);
        };

        // ===== 第二章：结丹调息（阿禾，动作 start_core_formation_trial） =====
        npc.onCoreTrial = () => {
            this.startCoreFormationTrial(npc);
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
     *
     * 章节判定：按当前地图决定先问哪一章的选择器
     *   - 云渡泽 / 万灯台（第二章地图）→ 先问 Chapter2Config，未命中再回退第一章
     *   - 其余地图（青岚浮野等）      → 先问 Chapter1Config，未命中再回退第二章
     * 这样阿禾（两章同名同一人）在两章地图上各自走本章对白。
     * @param {NPC} npc
     * @returns {string|null}
     */
    getDialogueForNPC(npc) {
        const questSystem = this.player && this.player.questSystem;
        const questItemSystem = this.player && this.player.questItemSystem;
        if (!questSystem) return null;

        const inChapter2 = window.Chapter2Config
            && Chapter2Config.isChapter2Map(this.currentMap ? this.currentMap.mapId : null);

        const providers = inChapter2
            ? [window.Chapter2Config, window.Chapter1Config]
            : [window.Chapter1Config, window.Chapter2Config];

        for (const provider of providers) {
            if (!provider || typeof provider.getDialogueForNPC !== 'function') continue;
            try {
                const dialogueId = provider.getDialogueForNPC(npc.id, questSystem, questItemSystem);
                if (dialogueId) {
                    console.log(`[Main] NPC ${npc.id} → 对话: ${dialogueId}（${provider === window.Chapter2Config ? '第二章' : '第一章'}）`);
                    return dialogueId;
                }
            } catch (e) {
                console.warn('[Main] getDialogueForNPC 错误:', e);
            }
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
                    // 世界地图上的「云渡泽」按钮同步开放
                    this.updateWorldMapUnlocks();
                    break;

                // ===== 第二章（云渡泽）=====
                case 'obtain_yunduze_registry':
                    // X01：许录交出登记摘页（剧情物品，重复对话不会重复发放）
                    this.grantQuestItem('dengji_zhaie', 1, true);
                    this.addGameNotification('取得登记摘页');
                    break;

                case 'obtain_jiangwan_letter':
                    // J01：江婆借出江晚家书
                    this.grantQuestItem('jiangwan_jiashu', 1, true);
                    break;

                case 'obtain_hundeng_pair':
                    // X03：许录打开核验栏 → 两盏待认领魂灯
                    this.grantQuestItem('hundeng_jiangwan', 1, true);
                    this.grantQuestItem('hundeng_chenli', 1, true);
                    this.addGameNotification('取得两盏待认领魂灯（渡四二 / 青十七）');
                    break;

                case 'obtain_tongxing_token':
                    // X05：通行凭证
                    this.grantQuestItem('tongxing_pingzheng', 1, true);
                    this.addGameNotification('取得万灯台通行凭证');
                    break;

                case 'start_core_formation_trial':
                    // A08：接取《灯定丹成》后播放结丹调息序列
                    this.startCoreFormationTrial(this.player ? this.player.nearbyNPC : null);
                    break;

                case 'record_boat_repaired':
                    this.setStoryFlag('chapter2_boat_repaired');
                    this.addGameNotification('行舟已修好，可以出发了');
                    break;

                case 'unlock_travel_boat':
                case 'unlock_zhaochen':
                    // 行舟落脚点 / 照尘仙城航线解锁
                    this.setStoryFlag('chapter2_travel_boat_unlocked');
                    this.updateWorldMapUnlocks();
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
                            this.tryAcceptQuest(questId);
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
     * - 数值按筑基境界写满：气血上限 400 / 灵息上限 250（另加累积的 Boss 战败成长），两项当前值同时回满（见 applyFoundationRealmStats）
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
        // （气血上限 400 / 灵息上限 250 并回满），避免练气未到圆满时数值不生效。
        this.applyFoundationRealmStats();

        if (this.player && this.player.questSystem) {
            this.player.questSystem.updateQuestProgress('chapter1_ending_1', 'complete_foundation_trial', 'foundation', 1);
        }
    }

    /**
     * 筑基数值：按 GameConfig 的 ZHUJI 境界配置写满玩家数据
     * - 境界 / 小阶段 → 筑基·初期；气血上限 400、灵息上限 250（唯一基准数据源：GameConfig.realms.ZHUJI，
     *   其上再叠加累积的 Boss 战败成长 maxHealthBonus / maxManaBonus）；
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

        // Boss 战败成长的累计加成叠加在筑基基准值之上（没有战败成长时数值不变）
        this.applyPermanentStatBonus(data);

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

    // ==================== 第二章（云渡泽）公共工具 ====================

    /**
     * 当前地图是否属于第二章（云渡泽 / 万灯台）
     * @param {string} [mapId] - 缺省取当前地图
     * @returns {boolean}
     */
    isChapter2Map(mapId) {
        const id = mapId || (this.currentMap ? this.currentMap.mapId : null);
        if (!id) return false;
        if (window.Chapter2Config && typeof Chapter2Config.isChapter2Map === 'function') {
            return Chapter2Config.isChapter2Map(id);
        }
        return id === 'yunduze' || id === 'boss_arena_ch2';
    }

    /**
     * 是否为第一章的舞台地图（青岚浮野）
     * 判据：地图配置里的 chapter === 1，且不是战场地图
     * （boss_arena_ch1 的舞台由战场流程自己恢复，不归章节舞台管）。
     *
     * 参数可传 mapId（string）或地图实例（GameMap / 测试桩对象）：
     * Main.applyChapterEndStage 要在“刚切好图”的时机判断章节，此时优先读地图自己的
     * mapConfig.chapter，避免 mapId 还没登记时判错章节。
     *
     * @param {string|Object} [map] - 缺省取当前地图
     * @returns {boolean}
     */
    isChapter1Map(map) {
        const target = map || this.currentMap;
        if (!target) return false;

        const mapId = typeof target === 'string' ? target : (target.mapId || null);
        if (this.isArenaMap(mapId)) return false;

        const ownConfig = typeof target === 'string' ? null : (target.mapConfig || null);
        const config = ownConfig
            || ((mapId && this.gameConfig && typeof this.gameConfig.getMap === 'function')
                ? this.gameConfig.getMap(mapId)
                : null);
        return !!config && config.chapter === 1;
    }

    /**
     * 是否为战场地图（第一章摄风山魈战场 / 第二章万灯台）
     * @param {string} [mapId]
     * @returns {boolean}
     */
    isArenaMap(mapId) {
        const id = mapId || (this.currentMap ? this.currentMap.mapId : null);
        if (!id) return false;
        if (id === this.bossArenaMapId) return true;
        const chapter2Arena = window.Chapter2Config
            ? Chapter2Config.getArenaConfig().mapId
            : 'boss_arena_ch2';
        return id === chapter2Arena;
    }

    /**
     * 第二章战场（万灯台）参数
     * @returns {Object}
     */
    getChapter2ArenaConfig() {
        if (window.Chapter2Config) return Chapter2Config.getArenaConfig();
        return { mapId: 'boss_arena_ch2', exitPrompt: '按 E 返回云渡泽', deathSubtitle: '' };
    }

    /**
     * 取第二章剧情对白的文本（无 NPC 承载的旁白 / 系统提示）
     * @param {string} dialogueId
     * @returns {string}
     */
    getChapter2StoryText(dialogueId) {
        if (!window.Chapter2Config || typeof Chapter2Config.getStoryDialogue !== 'function') return '';
        const dialogue = Chapter2Config.getStoryDialogue(dialogueId);
        return dialogue ? dialogue.text : '';
    }

    /**
     * 播放无 NPC 承载的剧情对白（旁白 / 系统 / 战后演出）
     * - 播放期间锁定移动与交互，读完最后一行按 J / 点击推进结束
     * - 结束时可执行回调（如进入战场、开始小游戏）
     * @param {string} dialogueId - Chapter2Config.getStoryDialogues() 中的 ID
     * @param {string} [speakerName] - 无冒号行使用的话者名（默认 '旁白'）
     * @param {Function} [onDone] - 读完后的回调
     * @returns {boolean} 是否成功播放
     */
    playStoryDialogue(dialogueId, speakerName = '旁白', onDone = null) {
        const text = this.getChapter2StoryText(dialogueId);
        if (!text) {
            console.warn(`[Main] 剧情对白不存在: ${dialogueId}`);
            if (onDone) onDone();
            return false;
        }
        return this.playDialogueText(text, speakerName, onDone);
    }

    /**
     * 播放一段（无 NPC 承载的）对话文本，读完按 J / 点击推进结束
     * @param {string} text - 文本（用 \n 分行，行首可带“说话人: ”）
     * @param {string} [speakerName='旁白'] - 无冒号行使用的话者名
     * @param {Function} [onDone] - 读完后的回调
     * @returns {boolean}
     */
    playDialogueText(text, speakerName = '旁白', onDone = null) {
        if (!text) {
            if (onDone) onDone();
            return false;
        }

        this.storyDialogueActive = true;
        if (this.player) this.player.isInteracting = true;
        this.inputManager.setMovementBlocked(true);

        // 清空上一段对话残留
        this.dialogBox.dialogueLines = [];
        this.dialogBox.currentText = '';
        this.dialogBox.displayedText = '';
        this.dialogBox.currentSpeakerName = '';
        this.dialogBox.isTyping = false;
        this.dialogBox.currentLineIndex = 0;
        this.dialogBox.clearOptionButtons();

        this.dialogBox.show();
        this.dialogBox.setText(text, speakerName);
        this.dialogBox.onAdvance = () => {
            this.finishStoryDialogue();
            if (onDone) onDone();
        };

        return true;
    }

    /**
     * 结束当前剧情对白并解锁操作（playDialogueText / playStoryDialogue 内部使用）
     */
    finishStoryDialogue() {
        this.dialogBox.dialogueLines = [];
        this.dialogBox.currentText = '';
        this.dialogBox.displayedText = '';
        this.dialogBox.currentSpeakerName = '';
        this.dialogBox.isTyping = false;
        this.dialogBox.currentLineIndex = 0;
        this.dialogBox.onAdvance = null;
        this.dialogBox.hide();

        this.storyDialogueActive = false;
        if (this.player) this.player.isInteracting = false;
        this.inputManager.setMovementBlocked(false);
    }

    /**
     * 屏幕中下方的短字幕（不暂停操作，用于战斗中的台词）
     * @param {string} text
     * @param {number} [duration=4] - 显示秒数
     */
    showSubtitle(text, duration = 4) {
        if (!text) return;
        this.subtitle.text = text;
        this.subtitle.timer = duration;
        console.log(`[字幕] ${text}`);
    }

    /**
     * 发放剧情 / 任务物品
     * @param {string} itemId
     * @param {number} [count=1]
     * @param {boolean} [once=false] - true 时已持有则跳过（对话可重复触发时用）
     * @returns {boolean} 是否实际发放
     */
    grantQuestItem(itemId, count = 1, once = false) {
        const questItemSystem = this.player && this.player.questItemSystem;
        if (!questItemSystem) return false;
        if (once && questItemSystem.hasItem(itemId, 1)) return false;

        questItemSystem.addItem(itemId, count);
        const gameConfig = GameConfig.getInstance();
        const itemConfig = gameConfig.getItem(itemId);
        this.addGameNotification(`获得${itemConfig ? itemConfig.name : itemId}`);
        return true;
    }

    /**
     * 学习职业 / 基础技能（等级 1，已学则不重复）
     * @param {string} skillId
     * @returns {boolean}
     */
    learnProfessionSkill(skillId) {
        const player = this.player;
        if (!player || !player.professionSystem) return false;

        const gameConfig = GameConfig.getInstance();
        const skillConfig = gameConfig.getSkill(skillId);
        if (!skillConfig) {
            console.warn(`[Main] 技能不存在: ${skillId}`);
            return false;
        }

        const system = player.professionSystem;
        if (system.getSkillLevel(skillId) > 0) return false;

        if (skillConfig.type === 'basic') {
            system.basicSkills.set(skillId, 1);
        } else {
            system.professionSkills.set(skillId, 1);
        }
        console.log(`[Main] 习得技能: ${skillConfig.name}（${skillId}）`);
        this.addGameNotification(`习得${skillConfig.name}`);
        return true;
    }

    /**
     * 任务完成时自动发奖（第一章 + 第二章通用）
     *
     * 支持的奖励字段（都是可选的）：
     *   exp                  —— 修为（经验）
     *   lingShi              —— 灵石
     *   basicSkillPoints     —— 基础修习点
     *   professionSkillPoints—— 职业悟道点
     *   items: []            —— 物品 ID 数组（进背包，可堆叠的按堆叠处理）
     *   storyItems: []       —— 剧情物品 ID 数组（进任务物品栏）
     *   maxHealth / maxMana  —— 气血 / 灵息上限的小幅提升（当前值同步补足同等量）
     *   realm                —— 直接提升到的境界（按 GameConfig.realms 写满上限并回满）
     *   skills: []           —— 习得的技能（等级 1）
     *   unlockMap            —— 解锁的世界地图区域（写入 map_unlocked_<区域> 剧情标记，
     *                          并调用 updateWorldMapUnlocks 重算按钮状态；地图删减为前两章后，
     *                          数据里的照尘仙城不再有对应按钮，标记仅作存档 / 后续章节预留）
     * @param {string} questId
     * @param {Object} rewards
     */
    applyQuestRewards(questId, rewards) {
        if (!this.player || !rewards) return;

        const player = this.player;
        const data = player.playerData;
        const notes = [];

        // ---- 修为 / 灵石 / 技能点 ----
        if (rewards.exp) {
            player.gainExperience(rewards.exp);
            notes.push(`修为+${rewards.exp}`);
        }
        if (rewards.lingShi) {
            data.gainLingShi(rewards.lingShi);
            notes.push(`灵石+${rewards.lingShi}`);
        }
        if (rewards.basicSkillPoints) {
            data.basicSkillPoints += rewards.basicSkillPoints;
            if (player.professionSystem) {
                player.professionSystem.basicSkillPoints += rewards.basicSkillPoints;
            }
            notes.push(`基础修习点+${rewards.basicSkillPoints}`);
        }
        if (rewards.professionSkillPoints) {
            data.professionSkillPoints += rewards.professionSkillPoints;
            if (player.professionSystem) {
                player.professionSystem.professionSkillPoints += rewards.professionSkillPoints;
            }
            notes.push(`职业悟道点+${rewards.professionSkillPoints}`);
        }

        // ---- 气血 / 灵息上限小幅提升（当前值同步补足，避免刚提升就显示残血）----
        if (rewards.maxHealth) {
            data.maxHealth += rewards.maxHealth;
            data.health = Math.min(data.maxHealth, data.health + rewards.maxHealth);
            notes.push(`气血上限+${rewards.maxHealth}`);
        }
        if (rewards.maxMana) {
            data.maxMana += rewards.maxMana;
            data.mana = Math.min(data.maxMana, data.mana + rewards.maxMana);
            notes.push(`灵息上限+${rewards.maxMana}`);
        }

        // ---- 物品 / 剧情物品 ----
        if (Array.isArray(rewards.items)) {
            rewards.items.forEach(itemId => {
                if (player.inventory && player.inventory.addItem(itemId, 1)) {
                    const itemConfig = GameConfig.getInstance().getItem(itemId);
                    notes.push(`${itemConfig ? itemConfig.name : itemId}×1`);
                }
            });
        }
        if (Array.isArray(rewards.storyItems)) {
            rewards.storyItems.forEach(itemId => this.grantQuestItem(itemId, 1, true));
        }

        // ---- 技能 ----
        if (Array.isArray(rewards.skills)) {
            rewards.skills.forEach(skillId => this.learnProfessionSkill(skillId));
        }

        // ---- 境界（按 GameConfig.realms 写满并回满）----
        if (rewards.realm) {
            this.applyRealmStats(rewards.realm);
        }

        // ---- 解锁世界地图区域 ----
        if (rewards.unlockMap) {
            this.setStoryFlag(`map_unlocked_${rewards.unlockMap}`);
            this.updateWorldMapUnlocks();
            notes.push(`解锁${rewards.unlockMap}`);
        }

        if (notes.length > 0) {
            console.log(`[奖励] ${questId} → ${notes.join('，')}`);
            this.addGameNotification(`任务奖励：${notes.join('，')}`);
        }
    }

    /**
     * 把累积的 Boss 战败成长叠加到气血 / 灵息上限之上（境界数值写入之后调用）
     * - 数值来源：PlayerData.maxHealthBonus / maxManaBonus（每次 Boss 战败累加，
     *   见 Main.applyBossFailureBonus）；
     * - 两个加成都是 0 时不做任何改动（旧存档 / 没战败过的角色数值不变）；
     * - 叠加后按新上限回满（境界切换 / 调息结算本身即巅峰状态）。
     * @param {Object} [data] - 玩家数据（缺省用 this.player.playerData）
     * @returns {boolean} 是否叠加了加成
     */
    applyPermanentStatBonus(data) {
        const target = data || (this.player && this.player.playerData);
        if (!target) return false;

        const bonusHealth = target.maxHealthBonus || 0;
        const bonusMana = target.maxManaBonus || 0;
        if (bonusHealth === 0 && bonusMana === 0) return false;

        target.maxHealth += bonusHealth;
        target.maxMana += bonusMana;
        target.health = target.maxHealth;
        target.mana = target.maxMana;

        console.log(`[Main] Boss 战败成长已叠加：气血上限 ${target.maxHealth}（含 +${bonusHealth}）、灵息上限 ${target.maxMana}（含 +${bonusMana}）`);
        return true;
    }

    /**
     * 按 GameConfig 的境界配置写满玩家数值（气血 / 灵息上限并回满）
     * 写入后叠加累积的 Boss 战败成长（见 applyPermanentStatBonus）并按上限回满
     * @param {string} realmId - 'lianqi' | 'zhuji' | 'jiedan' | ...
     * @returns {boolean}
     */
    applyRealmStats(realmId) {
        if (!this.player || !this.player.playerData) return false;

        const realmConfig = GameConfig.getInstance().getRealm(realmId);
        if (!realmConfig) {
            console.warn(`[Main] 缺少境界配置（${realmId}），无法写入境界数值`);
            return false;
        }

        const data = this.player.playerData;
        data.realm = realmConfig.id || realmId;
        data.stage = realmConfig.stages ? realmConfig.stages[0] : data.stage;
        data.maxHealth = realmConfig.maxHealth;
        data.maxMana = realmConfig.maxMana;
        data.health = realmConfig.maxHealth;
        data.mana = realmConfig.maxMana;

        if (typeof this.player.getCurrentMoveSpeed === 'function') {
            this.player.moveSpeed = this.player.getCurrentMoveSpeed();
        }

        // Boss 战败成长的累计加成叠加在境界基准值之上（没有战败成长时数值不变）
        this.applyPermanentStatBonus(data);

        console.log(`[Main] 境界数值已生效：${realmConfig.name}，气血 ${data.health}/${data.maxHealth}，灵息 ${data.mana}/${data.maxMana}`);
        return true;
    }

    /**
     * 确保筑基修为圆满（第二章主线四的门槛）
     * 主线三交付后调用：若当前仍在筑基，则把阶段推到「圆满」并清零溢出经验，
     * 让「M03 完成且筑基圆满」的条件真正成立（与第一章筑基数值兜底同一思路）。
     * @returns {boolean} 是否做了调整
     */
    ensureFoundationPerfect() {
        if (!this.player || !this.player.playerData) return false;
        const data = this.player.playerData;
        if (data.realm !== 'zhuji') return false;
        if (data.stage === '圆满') return false;

        data.stage = '圆满';
        data.experience = 0;
        console.log('[Main] 历练已足：筑基修为推至圆满');
        this.addGameNotification('修为已至筑基圆满，可以准备万灯台一战');
        return true;
    }

    // ==================== 第二章：任务完成后的舞台推进 ====================

    /**
     * 第二章各主线完成时的舞台推进（NPC 搬迁 / 状态推进 / 门槛兜底）
     * @param {string} questId
     * @param {GameMap} [map] - 完成时的当前地图
     */
    handleChapter2QuestComplete(questId, map) {
        switch (questId) {
            case 'chapter2_main_1':
                // 主线一交付：名册与摘页留存在阿禾处，站位不变
                break;

            case 'chapter2_main_2':
                // 主线二交付：两盏灯的身份已确认（归魂要等主线三护送完成）
                this.setStoryFlag('chapter2_lamps_identified');
                break;

            case 'chapter2_main_3':
                // 主线三交付：历练已足 → 筑基圆满（主线四的门槛要求）
                this.ensureFoundationPerfect();
                // 归魂完成后阿禾移到右侧救助院
                this.moveChapter2NPC('ahe', { x: 2500, y: 980 });
                this.moveChapter2NPC('jiangpo', { x: 2338, y: 989 });
                break;

            case 'chapter2_main_4':
                // 主线四交付：许录把原册搬到救助院登记点
                this.repositionChapter2AfterBoss();
                break;

            case 'chapter2_ending_1':
                // 结丹完成：阿禾与陆舟移到中央泊位，准备登船
                this.moveChapter2NPC('ahe', { x: 555, y: 1400 });
                this.moveChapter2NPC('luzhou', { x: 700, y: 1320 });
                this.moveChapter2NPC('xulu', { x: 2671, y: 1126 });
                break;

            case 'chapter2_ending_2':
                // 第二章完成：陈栎随返乡船回青岚（云渡泽不再留重复实体）
                this.setStoryFlag('chapter2_complete');
                this.removeChapter2NPC('chenli');
                break;
            default:
                break;
        }
    }

    /**
     * 云渡泽地图实例（未加载时返回 null）
     * @returns {GameMap|null}
     */
    getChapter2Map() {
        if (!this.mapManager || !this.mapManager.getMap) return null;
        return this.mapManager.getMap('yunduze');
    }

    /**
     * 搬迁云渡泽上的 NPC（世界坐标，像素）
     * @param {string} npcId
     * @param {Object} worldPosition - {x, y}
     * @returns {boolean}
     */
    moveChapter2NPC(npcId, worldPosition) {
        const map = this.getChapter2Map();
        if (!map || !map.npcs || !worldPosition) return false;
        const npc = map.npcs.get(npcId);
        if (!npc || typeof npc.repositionWorld !== 'function') return false;

        npc.repositionWorld(worldPosition.x, worldPosition.y, map);
        return true;
    }

    /**
     * 从云渡泽移除一个 NPC（如陈栎随返乡船回青岚）
     * @param {string} npcId
     * @returns {boolean}
     */
    removeChapter2NPC(npcId) {
        const map = this.getChapter2Map();
        if (!map || !map.npcs || !map.npcs.has(npcId)) return false;
        map.removeNPC(npcId);
        console.log(`[Main] ${npcId} 已离开云渡泽`);
        return true;
    }

    /**
     * 江婆 idle 立绘切换：女儿江晚获救前 / 后各一张单帧 32×64（Chapter2Config.npc.jiangpo）
     * - 获救前：baseAnimations.idle（资源 npc.jiangpo_idle）
     * - 获救后：extraAnimations.idle_after（资源 npc.jiangpo_idle_after）
     *
     * 判据只有一个 —— 主线三「完成逆流行舟护送」目标（complete_minigame / boat_navigation）是否完成；
     * 演出结束（completeSoulReturn）与读档重进地图（applyChapter2Stage）都走这里，
     * 保证存档前后立绘一致。切到 idle_after 后锁 animationOverridden，
     * 否则 NPC.updateAnimation 每帧都会把动画切回普通 idle。
     * @param {boolean} reunited - true = 女儿已获救
     * @param {number} [attempt] - 内部用：资源异步加载时的重试次数
     * @returns {boolean} 是否成功应用
     */
    setJiangpoReunitedIdle(reunited, attempt = 0) {
        const map = this.getChapter2Map();
        const jiangpo = (map && map.npcs) ? map.npcs.get('jiangpo') : null;
        if (!jiangpo || !jiangpo.animationManager || typeof jiangpo.setAnimation !== 'function') return false;

        if (reunited) {
            // 动画资源是异步加载的（NPC.loadAnimations）：刚进地图时 idle_after 可能还没就绪
            if (!jiangpo.animationManager.hasAnimation('idle_after')) {
                if (attempt < 20 && !this.chapter2JiangpoIdleTimer) {
                    this.chapter2JiangpoIdleTimer = setTimeout(() => {
                        this.chapter2JiangpoIdleTimer = null;
                        this.setJiangpoReunitedIdle(true, attempt + 1);
                    }, 100);
                }
                return false;
            }
            if (jiangpo.animationManager.currentAnimationName === 'idle_after') return true;   // 已就位
            jiangpo.animationOverridden = true;      // 锁定：不让 updateAnimation 覆盖
            jiangpo.setAnimation('idle_after', { loop: true });
            jiangpo.setNpcState('daughter_rescued', true);
            return true;
        }

        jiangpo.animationOverridden = false;
        if (typeof jiangpo.setIdleAnimation === 'function') jiangpo.setIdleAnimation();
        jiangpo.setNpcState('daughter_rescued', false);
        return true;
    }

    /**
     * Boss 战后的云渡泽站位：
     *   许录 → 救助院登记点；江婆 / 江晚 → 救助院；阿禾 → 救助院
     * （JSON npc_persistence：Boss 胜利后可移至右院登记点）
     */
    repositionChapter2AfterBoss() {
        this.moveChapter2NPC('xulu', { x: 2671, y: 1126 });
        this.moveChapter2NPC('jiangpo', { x: 2338, y: 989 });
        this.moveChapter2NPC('ahe', { x: 2500, y: 980 });
    }

    // ==================== 第二章：进场舞台恢复 / 世界地图 ====================

    /**
     * 进入第二章地图时恢复舞台状态（读档 / 反复进出图保持一致）
     * - 首次进入云渡泽：播 S01 开场旁白，并记录已播放
     * - 归魂演出之前：江晚 / 陈栎不出现在救助院（从地图中摘除，触发时再放回）
     * - 按任务进度恢复 NPC 站位
     * - 同步世界地图各区域的解锁状态
     * @param {GameMap} gameMap
     */
    applyChapter2Stage(gameMap) {
        const map = gameMap || this.currentMap;
        if (!map) return;
        this.updateWorldMapUnlocks();
        if (!this.isChapter2Map(map.mapId)) return;
        if (!this.player || !this.player.questSystem) return;

        const qs = this.player.questSystem;

        // ---- 逆流行舟护送完成（归魂）之前：江晚 / 陈栎不在场上 ----
        if (map.mapId === 'yunduze' && map.npcs) {
            const released = typeof qs.isObjectiveCompleted === 'function'
                && qs.isObjectiveCompleted('chapter2_main_3', 'complete_minigame', 'boat_navigation');
            ['jiangwan', 'chenli'].forEach(npcId => {
                if (!released) {
                    const npc = map.npcs.get(npcId);
                    if (npc) {
                        // 暂存引用，归魂演出时再放回地图
                        this.chapter2DormantNPCs[npcId] = npc;
                        map.removeNPC(npcId);
                    }
                } else if (!map.npcs.has(npcId) && this.chapter2DormantNPCs[npcId]) {
                    map.addNPC(npcId, this.chapter2DormantNPCs[npcId]);
                }
            });

            // 江婆立绘：与上面同一个判据 —— 女儿归魂前 / 后各一张 32×64 单帧图
            // （逆流行舟护送成功 → complete_minigame boat_navigation 完成 → 切 idle_after）
            this.setJiangpoReunitedIdle(released);
        }

        // ---- 第二章完成后：陈栎已随返乡船回青岚 ----
        if (map.mapId === 'yunduze' && qs.hasStoryFlag && qs.hasStoryFlag('chapter2_complete')) {
            this.removeChapter2NPC('chenli');
        }

        // ---- 按任务进度恢复站位 ----
        if (map.mapId === 'yunduze') {
            if (qs.isQuestCompleted && qs.isQuestCompleted('chapter2_main_3')) {
                this.moveChapter2NPC('ahe', { x: 2500, y: 980 });
                this.moveChapter2NPC('jiangpo', { x: 2338, y: 989 });
            }
            if (qs.hasStoryFlag && qs.hasStoryFlag('due_boss_defeated')) {
                this.repositionChapter2AfterBoss();
            }
            if (qs.isQuestCompleted && qs.isQuestCompleted('chapter2_ending_1')) {
                this.moveChapter2NPC('ahe', { x: 555, y: 1400 });
                this.moveChapter2NPC('luzhou', { x: 700, y: 1320 });
            }
        }

        // ---- 首次进入云渡泽：开场旁白（S01）----
        if (map.mapId === 'yunduze'
            && qs.hasStoryFlag && !qs.hasStoryFlag('chapter2_intro_done')
            && qs.isQuestCompleted && qs.isQuestCompleted('chapter1_ending_3')) {
            this.setStoryFlag('chapter2_intro_done');
            this.playStoryDialogue('s01_opening', '旁白: ');
        }
    }

    /**
     * 同步世界地图区域按钮的解锁状态
     * - 青岚浮野（第一章）：常开
     * - 云渡泽（第二章）：调试期常开（debugUnlockAllWorldMapButtons === true）；
     *   置 false 即恢复原逻辑 —— 需剧情标记 yunduze_unlocked / chapter1_farewell_done
     *   （第一章筑基结束后写入）
     */
    updateWorldMapUnlocks() {
        if (!this.mapTeleport || typeof this.mapTeleport.setButtonEnabled !== 'function') return;

        // 第一章：世界地图上的起点，始终可点
        this.mapTeleport.setButtonEnabled('btn_qinglan', true);

        const forceUnlock = this.debugUnlockAllWorldMapButtons !== false;
        const qs = this.player ? this.player.questSystem : null;
        const hasFlag = (flag) => !!(qs && typeof qs.hasStoryFlag === 'function' && qs.hasStoryFlag(flag));
        const yunduzeUnlocked = forceUnlock
            || hasFlag('yunduze_unlocked') || hasFlag('chapter1_farewell_done');
        this.mapTeleport.setButtonEnabled('btn_yunduze', yunduzeUnlocked);
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
     * 路标 → 小游戏（统一入口）
     * - 路标带 roleplayDialogue 时先播引导对白，读完再开小游戏（如「认灯台」「旧水道」）
     * - 不同小游戏的结算回调在此分流：乘风采药（第一章）/ 认灯归魂 / 逆流送灯（第二章）
     * @param {Signpost} signpost
     */
    startMiniGameFromSignpost(signpost) {
        if (!signpost || !signpost.gameId) return;
        const gameId = signpost.gameId;

        const launch = () => {
            this.startMiniGame(gameId, (result) => {
                // 认灯归魂：成功推进目标 + 播 T03（主角自言自语）；3 次机会用尽 → 播 T02 后回大地图
                if (gameId === 'lantern_identify') {
                    this.finishLanternIdentify(result);
                    return;
                }
                // 逆流行舟：成功播 T05 归魂演出；失败播 T04（可重试，不丢魂灯）
                if (gameId === 'boat_navigation') {
                    this.finishRiverEscort(result);
                    return;
                }
                if (!result || !result.success) {
                    console.log(`[路标] ${signpost.name} 未完成：${result ? result.rating : 'unknown'}`);
                    return;
                }
                console.log(`[路标] ${signpost.name} 完成！`);

                if (gameId === 'herb_collect') {
                    // 第一章：乘风采药成功 → 推进主线二「一盏安身灯」采药目标
                    if (this.player && this.player.questSystem) {
                        this.player.questSystem.updateQuestProgress('chapter1_main_2', 'collect_item', 'lingcao', 3);
                    }
                    // 需求：成功退出小游戏后补一句收尾对白（文本见路标 successDialogue，缺省用内置台词）
                    this.playHerbCollectSuccessDialogue(signpost);
                    return;
                }
            });
        };

        if (signpost.roleplayDialogue) {
            this.playDialogueText(signpost.roleplayDialogue, signpost.name + ': ', launch);
        } else {
            launch();
        }
    }

    /**
     * 乘风采药「成功退出」后的收尾对白（主角自言自语）
     *
     * 需求：小游戏成功 → 退出后加个对话（说明采药成功）。
     * 文本优先取路标配置（Chapter1Config 采药点路标的 successDialogue / successSpeaker，
     * 见 Signpost.js），没配就用 Main 顶部的内置台词 —— 保证成功之后一定有句话。
     * 走的是和其余剧情对白同一条链路（playDialogueText：锁移动 / 按 J 或点击推进），
     * 所以玩家刚回到主图时不会误操作。
     * @param {Signpost} [signpost] - 触发本局小游戏的路标（可空）
     * @returns {boolean} 是否播出了对白
     */
    playHerbCollectSuccessDialogue(signpost) {
        const text = (signpost && signpost.successDialogue) || HERB_COLLECT_SUCCESS_DIALOGUE;
        const speaker = (signpost && signpost.successSpeaker) || HERB_COLLECT_SUCCESS_SPEAKER;
        return this.playDialogueText(text, speaker);
    }

    /**
     * 第二章：认灯归魂（灯序）结算
     * 成功 → 推进主线二「在认灯台完成身份核对」目标，并播 T03（主角自言自语 + 灯中回应）
     * 失败（3 次机会用尽）→ 播 T02；认灯台路标仍在，可再进小游戏重新抽灯序
     * @param {Object} result - 小游戏结果
     */
    finishLanternIdentify(result) {
        if (!result || !result.success) {
            this.playStoryDialogue('t02_identify_fail', '系统: ');
            return;
        }
        if (this.player && this.player.questSystem) {
            this.player.questSystem.updateQuestProgress('chapter2_main_2', 'complete_minigame', 'lantern_identify', 1);
        }
        this.setStoryFlag('chapter2_identify_done');
        // 对白跳出：主角自言自语游戏胜利（T03 首行），随后灯中回应
        this.playStoryDialogue('t03_identify_success', '旁白: ');
    }

    /**
     * 第二章：逆流送灯（横版行舟护送，见 js/BoatNavigationMiniGame.js）
     * 成功 → 推进主线三「完成逆流行舟护送」目标 → 播放 T05 归魂演出 → 江晚 / 陈栎出现在救助院
     *        （主线三此后只剩问江晚 / 陈栎证词与向陆舟交付三步）
     * 失败 → 播放 T04（可重试，不丢魂灯、不清认灯记录）
     * @param {Object} result
     */
    finishRiverEscort(result) {
        const questSystem = this.player ? this.player.questSystem : null;

        if (!result || !result.success) {
            this.playStoryDialogue('t04_escort_fail', '陆舟: ');
            return;
        }

        if (questSystem) {
            questSystem.updateQuestProgress('chapter2_main_3', 'complete_minigame', 'boat_navigation', 1);
        }
        this.setStoryFlag('chapter2_escort_done');

        // 归魂演出（T05）→ 演出结束后江晚、陈栎归位
        this.playStoryDialogue('t05_soul_return', '旁白: ', () => this.completeSoulReturn());
    }

    /**
     * 归魂演出结算：江晚 / 陈栎出现在右侧救助院，阿禾与江婆移到救助院，
     * 两盏任务魂灯转为空灯（移除任务物品）。
     * 注：主线三已不再有独立的「归魂演出」目标 —— 演出由逆流行舟成功这一目标自动带出，
     *     演出一结束玩家就能去问江晚 / 陈栎证词（主线三第 3、4 步）。
     */
    completeSoulReturn() {
        const map = this.getChapter2Map();

        // 1) 江晚 / 陈栎登台（此前被 applyChapter2Stage 摘除，这里放回）
        if (map && map.npcs) {
            ['jiangwan', 'chenli'].forEach(npcId => {
                if (!map.npcs.has(npcId) && this.chapter2DormantNPCs[npcId]) {
                    map.addNPC(npcId, this.chapter2DormantNPCs[npcId]);
                }
            });
        }

        // 2) 阿禾 / 江婆移到救助院
        this.moveChapter2NPC('ahe', { x: 2500, y: 980 });
        this.moveChapter2NPC('jiangpo', { x: 2338, y: 989 });

        // 2b) 江婆换上「女儿获救后」的 idle（idle_after，单帧 32×64）
        this.setJiangpoReunitedIdle(true);

        // 3) 两盏魂灯已归体 → 转为空灯（从任务物品栏移除）
        if (this.player && this.player.questItemSystem) {
            this.player.questItemSystem.removeItem('hundeng_jiangwan', 1);
            this.player.questItemSystem.removeItem('hundeng_chenli', 1);
        }

        this.setStoryFlag('chapter2_soul_returned');
        this.addGameNotification('江晚与陈栎已归魂，去问问他们在灯里看到的事');
    }

    /**
     * 第二章：剑修连招试炼（陆舟）
     * 复用第一章的基础操作教学框架（TrainingManager），教学圈放在云渡泽码头栈道北侧的小路；
     * 本次试炼只有一个剑影连斩圈：站进圈内按 O → 完成教学圈 → onAllCompleted 传授剑影连斩。
     * @param {NPC} [npc] - 陆舟（可省略）
     */
    startSwordTraining(npc) {
        if (!this.trainingManager) return;
        if (this.trainingManager.isActive) {
            this.addGameNotification('试炼圈已经放好了，去码头北侧的小路练招');
            return;
        }

        // 任务门控：只在《渡口无归客》推进到第 3 步（complete_training / sword）时才放教学圈。
        // 否则刚进章节跟陆舟闲聊就能把试炼做完 —— 任务系统会拒收那一步的进度
        // （第 1、2 步还没完成），但教学圈与技能发放会被提前消耗掉，主线一从此卡死。
        const questSystem = this.player && this.player.questSystem;
        if (questSystem && typeof questSystem.isObjectiveCurrent === 'function'
            && !questSystem.isObjectiveCurrent('chapter2_main_1', 'complete_training', 'sword')) {
            this.addGameNotification('先把渡口的事理清：找许录拿登记摘页，再与陆舟核对旧航线');
            console.log('[Main] 剑修连招试炼未到任务步骤，暂不放置教学圈');
            return;
        }

        const layout = window.Chapter2Config && Chapter2Config.getSwordTrainingLayout
            ? Chapter2Config.getSwordTrainingLayout()
            : null;

        this.trainingManager.startBasicTraining(null, {
            layout: layout,
            target: 'sword',
            label: '剑修基础连招试炼',
        });
        this.addGameNotification('前往码头栈道北侧完成剑修连招试炼（靠近教学圈按 O 施展剑影连斩）');
    }

    /**
     * 第二章：逆流送灯（从陆舟对话选项进入）
     * 与「旧水道」路标等价的入口：直接开启逆流行舟小游戏。
     */
    startRiverEscort(npc) {
        this.startMiniGame('boat_navigation', (result) => this.finishRiverEscort(result));
    }

    /**
     * 第二章章末：结丹调息（复用第一章「定息」规则）
     * 流程：禁键盘输入 → 主角朝下静立 → 背后播放筑基/结丹气场 5 秒 → 续接 T07（结丹成功演出）
     * @param {NPC} [npc] - 阿禾（可省略）
     */
    startCoreFormationTrial(npc) {
        setTimeout(() => {
            if (!this.player || this.isCoreTrialPlaying) return;

            const questSystem = this.player.questSystem;
            if (!questSystem || typeof questSystem.isQuestActive !== 'function'
                || !questSystem.isQuestActive('chapter2_ending_1')) {
                console.warn('[Main] 结丹调息需要在《灯定丹成》任务进行中触发');
                return;
            }

            this.coreTrialNPC = npc || this.player.nearbyNPC || null;
            this.isCoreTrialPlaying = true;
            this.player.isInteracting = true;
            this.inputManager.setMovementBlocked(true);
            this.inputManager.setInputBlocked(true);

            // 主角朝下静立（movementBlocked 时不会改写朝向）
            this.player.facing = 'down';
            this.player.animationManager.setDirection('down');
            if (this.player.playIdleAnimation) this.player.playIdleAnimation();

            // 复用筑基气场表现（时长取自 PlayerCombatSystem CONFIG.foundationAura.duration）
            const auraConfig = this.playerCombat && this.playerCombat.config
                ? this.playerCombat.config.foundationAura : null;
            const duration = auraConfig ? auraConfig.duration : 5;
            this.coreTrialTimer = duration;
            if (this.playerCombat && this.playerCombat.playFoundationAura) {
                this.playerCombat.playFoundationAura(duration);
            }

            this.addGameNotification('结丹调息……');
        }, 0);
    }

    /**
     * 推进结丹调息计时（updateGameWorld 每帧调用）
     * @param {number} deltaTime
     */
    updateCoreFormationTrial(deltaTime) {
        this.coreTrialTimer -= deltaTime;
        if (this.coreTrialTimer > 0) return;
        this.finishCoreFormationTrial(true);
    }

    /**
     * 结束结丹调息
     * @param {boolean} [success=true] - 成功 → T07（结丹演出）；失败 → T06（可再试）
     */
    finishCoreFormationTrial(success = true) {
        this.coreTrialTimer = 0;
        this.isCoreTrialPlaying = false;

        if (this.playerCombat && this.playerCombat.stopFoundationAura) {
            this.playerCombat.stopFoundationAura();
        }
        this.inputManager.setInputBlocked(false);
        this.inputManager.setMovementBlocked(false);

        const npc = this.coreTrialNPC || (this.player ? this.player.nearbyNPC : null);
        this.coreTrialNPC = null;

        if (!success) {
            this.playStoryDialogue('t06_core_fail', '阿禾: ');
            if (npc) this.showDialogueNode(npc, 'c2_a08_core_ready');
            return;
        }

        this.playStoryDialogue('t07_core_success', '旁白: ', () => this.completeCoreFormationTrial());
    }

    /**
     * 结丹结算：推进《灯定丹成》的唯一目标（结丹调息）
     * 境界与气血 / 灵息上限的实际写入由这里的 applyRealmStats('jiedan') 完成
     * （本任务不再配置奖励，境界推进不依赖 rewards.realm），
     * 这里先按配置写满结丹数值，保证即使玩家修为未到圆满也能正常进入结丹。
     * 注：剑影连斩已在第二章主线一《渡口无归客》的剑修基础连招试炼中传授，此处不再重复发放。
     */
    completeCoreFormationTrial() {
        if (!this.player) return;
        const questSystem = this.player.questSystem;

        if (typeof this.player.breakthrough === 'function') {
            const advanced = this.player.breakthrough();
            if (!advanced) {
                console.warn('[Main] 境界自动提升未生效（小阶段未满），按配置直接写入结丹数值');
            }
        }
        this.applyRealmStats('jiedan');
        this.setStoryFlag('chapter2_core_trial_done');

        if (questSystem) {
            questSystem.updateQuestProgress('chapter2_ending_1', 'complete_core_trial', 'jiedan', 1);
        }
    }

    // ==================== 第二章章末：中央泊位登船 ====================

    /**
     * 确保章末「登船」路标存在（主线《行舟有归处》进行中且已与阿禾交接后可见）
     * 数据源：Chapter2Config → maps.yunduze.chapterEnd.departSignpost（世界坐标 587,1327）
     * @returns {Signpost|null}
     */
    ensureChapter2BoatSignpost() {
        const map = this.getChapter2Map();
        if (!map || !map.signposts || typeof Signpost !== 'function') return null;

        const chapterEnd = (map.mapConfig && map.mapConfig.chapterEnd) || {};
        const config = chapterEnd.departSignpost || {};
        const id = config.id || 'signpost_zhaochen_boat';

        const existed = map.signposts.get(id);
        if (existed) return existed;

        const signpost = new Signpost({
            id: id,
            name: config.name || '登船',
            position: config.position || { x: 587, y: 1327 },
            radius: config.radius || 56,
            promptText: config.promptText || '登船前往照尘仙城',
            image: config.image || null,
            imageWidth: config.imageWidth || null,
            imageHeight: config.imageHeight || null,
            questRequired: config.questRequired || 'chapter2_ending_2',
            requireObjective: config.requireObjective || { type: 'talk_to', target: 'ahe' },
            oneShot: false,
            onActivate: () => this.boardZhaochenBoat(),
        });

        map.signposts.set(signpost.id, signpost);
        if (this.player && this.player.questSystem) {
            signpost.updateQuestGate(this.player.questSystem);
        }
        console.log(`[Main] 中央泊位登船路标已生成 (${signpost.position.x}, ${signpost.position.y})`);
        return signpost;
    }

    /**
     * 泊位登船（中央泊位 · 章末二）
     * - 首次：播放 S02 确认 → 结算《行舟有归处》 →（第三章未开放）播放 S03 → 进入游戏完结界面
     * - 已经看过完结界面：不再重播对白与字幕，直接打开世界地图界面
     */
    boardZhaochenBoat() {
        if (this.chapter2Boarding) return;

        // 已播放过完结字幕 → 直接显示世界地图界面（泊位可重复乘船，不丢进度）
        if (this.hasStoryFlag(this.gameEndingSeenFlag)) {
            this.openWorldMapFromBerth();
            return;
        }

        this.chapter2Boarding = true;
        this.addGameNotification('船已备好');
        this.playDialogueText(this.getChapter2StoryText('s02_berth'), '陆舟: ', () => this.sailToZhaochen());
    }

    /**
     * 完结之后再登船：直接打开世界地图界面（九州总图）
     */
    openWorldMapFromBerth() {
        console.log('[Main] 完结后续登船：直接打开世界地图');
        this.addGameNotification('航路已开 —— 九州总图');
        if (this.mapTeleport && !this.mapTeleport.isVisible) {
            this.mapTeleport.show();
        }
    }

    /**
     * 进入游戏完结界面（滚动字幕，js/EndingScene.js）
     * 由 sailToZhaochen 在结算完《行舟有归处》后调用；玩家在完结界面按任意键退出
     * 时才写入 game_ending_seen 标记并回到世界地图（见 finishGameEnding）
     * @returns {boolean} 是否成功切到完结界面
     */
    startGameEnding() {
        if (!this.sceneManager || typeof this.sceneManager.switchScene !== 'function') return false;
        console.log('[Main] 登船后进入游戏完结界面（滚动字幕）');
        this.sceneManager.switchScene('ending');
        return true;
    }

    /**
     * 退出游戏完结界面：记标记 + 打开世界地图 + 切回游戏世界场景
     * （EndingScene 在玩家于提示后按任意键 / 鼠标任意键时调用）
     */
    finishGameEnding() {
        this.setStoryFlag(this.gameEndingSeenFlag);
        this.chapter2Boarding = false;
        console.log('[Main] 完结界面结束，返回世界地图');
        if (this.mapTeleport && !this.mapTeleport.isVisible) {
            this.mapTeleport.show();
        }
        if (this.sceneManager && typeof this.sceneManager.switchScene === 'function') {
            this.sceneManager.switchScene('gameWorld');
        }
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
     *
     * ⚠ 只作用于**第一章舞台图（青岚浮野）**：这里恢复的是第一章章末 ——
     *   阿禾站位取自第一章的 chapterEnd.aheQuayTile（81,44），路标也要用第一章的
     *   chapterEnd.departSignpost（2566,1419）与 boardShipAndOpenWorldMap 回调。
     *   本方法由 switchToMap / loadInitialMap 对**每一张地图**调用，
     *   对其它章节地图直接执行会产生两个真机 bug（加这道判断就是为了修它们）：
     *     ① 阿禾被挪到第一章码头瓦片 —— 刚进云渡泽她还站在第一章的位置；
     *     ② 用该图的 chapterEnd.departSignpost 生成一个**无任务门控**的第一章登船路标 ——
     *        进入云渡泽就冒出「登船前往照尘仙城」，且按 E 走的是第一章的登船逻辑。
     *   第二章泊位的「登船」路标一律由 Main.ensureChapter2BoatSignpost 在
     *   《行舟有归处》任务门控下生成。
     *
     * @param {GameMap} gameMap - 地图实例
     */
    applyChapterEndStage(gameMap) {
        const map = gameMap || this.currentMap;
        if (!map || !this.player || !this.player.questSystem) return;
        if (!this.isChapter1Map(map)) return;
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
     * 读取剧情标记（QuestSystem.storyFlags；无 QuestSystem / 旧接口时视为未设置）
     *
     * ⚠ 补漏记录（2026-09-12）：Main 之前只有 setStoryFlag，没有读取端，
     *   而 enterBossArena 里写着 `!this.hasStoryFlag('chapter2_b01_seen')` ——
     *   于是进第二章战场（万灯台）时会抛 TypeError，B01 战前对白根本播不到、
     *   渡厄使也不会生成（玩家进去只见空场）。补上本方法即修复；
     *   tools/smoke_chapter2.js 第 7 节「首次进场先播 B01、对白结束才生成渡厄使」为回归断言。
     * @param {string} flag - 标记名
     * @returns {boolean}
     */
    hasStoryFlag(flag) {
        const questSystem = this.player && this.player.questSystem;
        if (!questSystem || typeof questSystem.hasStoryFlag !== 'function') return false;
        return questSystem.hasStoryFlag(flag);
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
        if (this.battleSystem.isInBattle) {
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
        const arenaMapId = (this.activeArena && this.activeArena.mapId) || this.bossArenaMapId;

        if (!map || map.mapId !== arenaMapId) {
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
     * 当前是否处于「小游戏」中（含结算完成、场景还没切回主图的那一帧）
     *
     * 为什么不能只看 MiniGameManager.isPlaying：
     *   · 结算完成那一刻 isPlaying 就变 false 了，但 MiniGameScene 还要到下一帧才 exit、
     *     主图才 enter —— 这一帧里事件驱动的按键 / 交互仍然可能进来（见 Main.handleKeyDown 规则0）；
     *   · 用「场景 or 正在玩」两个条件一起判，才能把这段窗口彻底关掉。
     * @returns {boolean}
     */
    isMiniGameActive() {
        const scene = this.sceneManager ? this.sceneManager.getCurrentScene() : null;
        if (scene && scene.sceneId === 'miniGame') return true;
        return !!(this.miniGameManager && this.miniGameManager.isPlaying);
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

            case 'ending':
                this.renderEnding(ctx);
                break;
        }
    }

    /**
     * 渲染主菜单（游戏开始界面）
     * 画面全部来自美术图片，由 MainMenuScene 负责：
     *   assets/images/ui/start_screen.png 1280×720 整屏背景
     *   assets/images/ui/start_button.png 400×112  居中开始按钮
     * 这里不再用代码绘制任何标题 / 提示文字（「按任意键开始游戏」已随该版本取消）。
     */
    renderMainMenu(ctx) {
        const mainMenuScene = (this.scenes && this.scenes.mainMenu)
            || (this.sceneManager && this.sceneManager.getScene
                ? this.sceneManager.getScene('mainMenu')
                : null);
        if (mainMenuScene && typeof mainMenuScene.render === 'function') {
            mainMenuScene.render(ctx);
        }
    }

    /**
     * 渲染游戏完结界面（滚动字幕）
     * 画面全部由 EndingScene 负责：深墨背景 + 逐行居中的滚动文字 + 「按任意键返回游戏」提示
     * （数据源 js/EndingText.js，见 js/EndingScene.js 类头说明）
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    renderEnding(ctx) {
        const endingScene = (this.scenes && this.scenes.ending)
            || (this.sceneManager && this.sceneManager.getScene
                ? this.sceneManager.getScene('ending')
                : null);
        if (endingScene && typeof endingScene.render === 'function') {
            endingScene.render(ctx);
        }
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

        // 渲染战斗短字幕（第二章 Boss 战中不暂停操作的台词）
        this.renderSubtitle(ctx);

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
     * 渲染屏幕中下方的战斗短字幕（不暂停操作）
     * @param {CanvasRenderingContext2D} ctx
     */
    renderSubtitle(ctx) {
        if (!this.subtitle || this.subtitle.timer <= 0 || !this.subtitle.text) return;

        const canvasWidth = this.canvas ? this.canvas.width : 1280;
        const canvasHeight = this.canvas ? this.canvas.height : 720;

        ctx.save();
        ctx.font = 'bold 17px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textWidth = ctx.measureText(this.subtitle.text).width;
        const boxWidth = Math.min(canvasWidth - 80, textWidth + 48);
        const boxX = (canvasWidth - boxWidth) / 2;
        const boxY = canvasHeight - 168;

        ctx.fillStyle = 'rgba(8, 14, 22, 0.78)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, 40, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(220, 196, 140, 0.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxWidth, 40);

        ctx.fillStyle = '#f2e2b8';
        ctx.fillText(this.subtitle.text, canvasWidth / 2, boxY + 21);
        ctx.restore();
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
        // 已经在小游戏里（含结算完成、场景还没切回主图的那一帧）→ 拒绝重复启动。
        // 旧行为：结算那一帧按住 E（浏览器连发 keydown）会被世界里的路标再次触发到这里 ——
        // 既重开了一局小游戏，又把下面 switchScene('miniGame') 写进 nextSceneId，覆盖掉
        // handleMiniGameEnd 刚登记的 'gameWorld' → 玩家以为退出了，其实还在小游戏里。
        if (this.isMiniGameActive()) {
            console.warn(`[小游戏] 已在小游戏中，忽略重复启动: ${gameId}`);
            return false;
        }

        // 保存进入小游戏时的玩家大地图坐标（结束时恢复）
        this._savedPlayerX = this.player.position.x;
        this._savedPlayerY = this.player.position.y;

        // 输入隔离：放掉主图残留的「按住」按键（含刚按下但还没消费的瞬时键）
        // 玩家按着 WASD 时按 E 进小游戏，那份按住状态会被小游戏读走 —— 角色一进局就被主图
        // 的操作推着走：乘风采药里会直接飘到虚空瓦片上，风一停就坠落判失败。听感即
        // 「刚听到胜利音效，紧接着又响失败音效」（玩家反馈，2026-09-13）。
        this._resetInputForMiniGame();
        
        // 保存回调
        this.miniGameCallback = callback || null;

        // ===== 背景音乐：进小游戏 → 主图 BGM 立即停 =====
        // · 逆流送灯：开局立刻循环播放小游戏 BGM（结束由 handleMiniGameEnd 立刻停）；
        // · 乘风采药：不在这里起播 —— 只有起风时才循环播放（见 HerbCollectMiniGame._updateWind）；
        // · 认灯归魂等其余小游戏：没有背景音乐，保持静音。
        this.stopMainMapBgm();
        const minigameBgm = AudioManager.getMinigameBgmKey(gameId);
        if (this.audioManager && minigameBgm && gameId === 'boat_navigation') {
            this.audioManager.playBgm(minigameBgm);
        }

        // 切换到小游戏场景
        this.sceneManager.switchScene('miniGame', {
            gameId: gameId,
        });
        
        // 启动小游戏
        this.miniGameManager.startMiniGame(gameId);
    }
    
    /**
     * 进小游戏前的输入隔离（见 Main.startMiniGame）
     * - 清掉本帧瞬时键（刚按下还没消费的 E / WASD 不带进小游戏）
     * - 清掉「按住不放」的键（大地图按着的方向键不带进小游戏；必须重新按才生效）
     * 环境没提供对应方法时静默跳过（测试桩可能只有部分接口）。
     * @returns {number} 被放掉的「按住」键数量（便于调试 / 断言）
     */
    _resetInputForMiniGame() {
        if (!this.inputManager) return 0;
        if (typeof this.inputManager.clearFrameState === 'function') {
            this.inputManager.clearFrameState();
        }
        if (typeof this.inputManager.clearHeldKeys === 'function') {
            return this.inputManager.clearHeldKeys();
        }
        return 0;
    }

    /**
     * 小游戏结束处理
     * @param {Object} result - 小游戏结果
     */
    handleMiniGameEnd(result) {
        // ===== 背景音乐：小游戏结束 → 立刻停掉小游戏 BGM =====
        // （乘风采药：起风时播的那首同样在这里收尾；回到大地图后主图 BGM 走 10 秒延迟）
        if (this.audioManager) {
            this.audioManager.stopBgm(this._minigameBgmKeys());
        }

        // ===== E 键保护期：刚结算回主图的这 0.5 秒不响应世界交互 =====
        // 玩家结算那一刻通常还按着 E（采药 / 确认），浏览器会连发 keydown；若这一路
        // keydown 落到脚下的「采药点」路标上，就会立刻又开一局（见 MINI_GAME_EXIT_GUARD_SECONDS）。
        this._miniGameExitGuard = MINI_GAME_EXIT_GUARD_SECONDS;

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

    /** 全部小游戏 BGM 键（用于「只停小游戏音乐」） */
    _minigameBgmKeys() {
        return Object.keys(AudioManager.MINIGAME_BGM).map(gameId => AudioManager.MINIGAME_BGM[gameId]);
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