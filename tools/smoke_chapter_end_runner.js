/*
 * 章末流程冒烟测试的“场景脚本”（由 tools/smoke_chapter_end.js 读取后
 * 用 vm.runInContext 在与游戏脚本相同的全局词法环境中执行）。
 * 返回值：断言所需的原始数据（断言本身在 smoke_chapter_end.js 中）。
 */
(async function () {
    const results = {};

    // ============ 章节注册 + 任务链 ============
    const gameConfig = GameConfig.getInstance();
    chapterLoader.registerChapter(Chapter1Config.getAll());
    const qs = new QuestSystem();
    qs.registerAllQuests();
    results.questCount = qs.quests.size;
    results.hasEnding1 = qs.quests.has('chapter1_ending_1');
    results.hasEnding2 = qs.quests.has('chapter1_ending_2');
    results.hasEnding3 = qs.quests.has('chapter1_ending_3');
    results.main4Config = gameConfig.getQuest('chapter1_main_4');
    results.ending1Config = gameConfig.getQuest('chapter1_ending_1');
    results.ending2Config = gameConfig.getQuest('chapter1_ending_2');
    results.ending3Config = gameConfig.getQuest('chapter1_ending_3');

    // 按目标顺序逐条推进，直到任务完成
    function finishQuest(questId) {
        if (!qs.acceptQuest(questId)) return false;
        let guard = 0;
        while (qs.isQuestActive(questId) && guard++ < 40) {
            const obj = qs.getCurrentObjective(questId);
            if (!obj) break;
            qs.updateQuestProgress(questId, obj.type, obj.target, obj.count || 1);
        }
        return qs.isQuestCompleted(questId);
    }

    results.chain = [];
    for (const id of ['chapter1_main_1', 'chapter1_main_2', 'chapter1_main_3', 'chapter1_main_4']) {
        results.chain.push([id, finishQuest(id)]);
    }
    results.ending1Accepted = qs.acceptQuest('chapter1_ending_1');
    qs.updateQuestProgress('chapter1_ending_1', 'complete_foundation_trial', 'foundation', 1);
    results.ending1Completed = qs.isQuestCompleted('chapter1_ending_1');
    // ending_2《桥边寻阿禾》：与阿禾对话（talk_to ahe）即完结
    results.ending2Accepted = qs.acceptQuest('chapter1_ending_2');
    results.ending2Title = results.ending2Config ? results.ending2Config.title : null;
    qs.updateQuestProgress('chapter1_ending_2', 'talk_to', 'ahe', 1);
    results.ending2Completed = qs.isQuestCompleted('chapter1_ending_2');
    // ending_3《登船辞行》：ending_2 完结后可接取，登船（board_boat）即完结
    results.ending3Accepted = qs.acceptQuest('chapter1_ending_3');
    qs.updateQuestProgress('chapter1_ending_3', 'board_boat', 'depart_boat', 1);
    results.ending3Completed = qs.isQuestCompleted('chapter1_ending_3');

    // ============ 剧情标记 + 对话选择规则 ============
    results.flagsEmptyBefore = Object.keys(qs.storyFlags).length === 0;
    qs.setStoryFlag('foundation_unlocked');
    results.flagSet = qs.hasStoryFlag('foundation_unlocked');
    const serialized = qs.serialize();
    const qs2 = new QuestSystem();
    qs2.deserialize(serialized);
    results.flagsSerialize = qs2.hasStoryFlag('foundation_unlocked')
        && qs2.isQuestCompleted('chapter1_ending_1');

    // 对话规则单独用一套任务状态复现真实推进顺序：
    // 主线一~四完成（ending_1 尚未接取）→ 之后逐步写入剧情标记
    const qsDlg = new QuestSystem();
    qsDlg.registerAllQuests();
    function finishQuestOn(system, questId) {
        if (!system.acceptQuest(questId)) return false;
        let guard = 0;
        while (system.isQuestActive(questId) && guard++ < 40) {
            const obj = system.getCurrentObjective(questId);
            if (!obj) break;
            system.updateQuestProgress(questId, obj.type, obj.target, obj.count || 1);
        }
        return system.isQuestCompleted(questId);
    }
    for (const id of ['chapter1_main_1', 'chapter1_main_2', 'chapter1_main_3', 'chapter1_main_4']) {
        finishQuestOn(qsDlg, id);
    }

    function dlgFor(npcId, system) {
        return Chapter1Config.getDialogueForNPC(npcId, system || qsDlg, null);
    }
    results.dlg = {};
    // 主线四交付完成、筑基调息尚未解锁 → 交付对白
    results.dlg.qibo_m04done = dlgFor('qibo');
    // 交付对话结束（unlock_foundation_breakthrough）→ 开始筑基
    qsDlg.setStoryFlag('foundation_unlocked');
    results.dlg.qibo_breakthroughReady = dlgFor('qibo');
    // 筑基完成 → 祁伯只闲聊（不再进入择道）；阿禾在码头等待 → 告别对白
    finishQuestOn(qsDlg, 'chapter1_ending_1');
    qsDlg.setStoryFlag('foundation_trial_done');
    results.dlg.qibo_afterFoundation = dlgFor('qibo');
    results.dlg.ahe_farewell = dlgFor('ahe');
    // 旧存档可能残留 profession_chosen 标记 → 仍应是闲聊（不出现择道 / 换传承）
    qsDlg.setStoryFlag('profession_chosen');
    results.dlg.qibo_legacyProfessionChosen = dlgFor('qibo');
    // 阿禾告别完成 → 登船前交代；第一章完成 → 祁伯闲聊
    qsDlg.setStoryFlag('chapter1_farewell_done');
    results.dlg.ahe_afterFarewell = dlgFor('ahe');
    qsDlg.setStoryFlag('chapter1_complete');
    results.dlg.qibo_chapterComplete = dlgFor('qibo');

    // ============ 主线三《散落的炊烟》：救助周叔必须先询问柳婶 ============
    // 全新任务状态复现真实顺序：主线一、二完成 → 接取主线三（当前目标 = 询问阿砚）
    const qsRescue = new QuestSystem();
    qsRescue.registerAllQuests();
    finishQuestOn(qsRescue, 'chapter1_main_1');
    finishQuestOn(qsRescue, 'chapter1_main_2');
    qsRescue.acceptQuest('chapter1_main_3');
    const zhoushuDialogues = Chapter1Config.getNPCConfigs().zhoushu.dialogues;
    const rescueStartOptions = (zhoushuDialogues.rescue_start && zhoushuDialogues.rescue_start.options) || [];
    const trappedIdleOptions = (zhoushuDialogues.trapped_idle && zhoushuDialogues.trapped_idle.options) || [];
    const rescueFirstObjective = qsRescue.getCurrentObjective('chapter1_main_3') || {};
    results.rescueGate = {
        main3Active: qsRescue.isQuestActive('chapter1_main_3'),
        objectiveAtAccept: { type: rescueFirstObjective.type, target: rescueFirstObjective.target },
        dialogueAtAccept: dlgFor('zhoushu', qsRescue),
        // 对照：柳婶自己的规则不受影响（未问 → 给线索；问完 → 等消息）
        liushenDialogueBeforeAsking: dlgFor('liushen', qsRescue),
        liushenDialogueAfterAsking: null,
        dialogueAfterAyan: null,
        rescueCurrentAfterAyan: false,
        dialogueAfterLiushen: null,
        rescueCurrentAfterLiushen: false,
        rescueStartOptionTexts: rescueStartOptions.map(o => o.text),
        rescueStartActions: rescueStartOptions.map(o => o.action),
        trappedIdleOptionCount: trappedIdleOptions.length,
    };
    // 只问过阿砚（还没问柳婶）→ 仍然不能救助
    qsRescue.updateQuestProgress('chapter1_main_3', 'talk_to', 'ayan', 1);
    results.rescueGate.dialogueAfterAyan = dlgFor('zhoushu', qsRescue);
    results.rescueGate.rescueCurrentAfterAyan = qsRescue.isObjectiveCurrent('chapter1_main_3', 'rescue', 'zhoushu');
    // 询问柳婶后 → rescue 成为当前待完成目标，周叔给出“护送周叔过桥”
    qsRescue.updateQuestProgress('chapter1_main_3', 'talk_to', 'liushen', 1);
    results.rescueGate.dialogueAfterLiushen = dlgFor('zhoushu', qsRescue);
    results.rescueGate.rescueCurrentAfterLiushen = qsRescue.isObjectiveCurrent('chapter1_main_3', 'rescue', 'zhoushu');
    results.rescueGate.liushenDialogueAfterAsking = dlgFor('liushen', qsRescue);

    // ============ Main 章末流程（真实 Main + 关键系统，其余为桩） ============
    // 章末流程专用任务系统：状态与真实流程一致（主线一~四已完成、ending_1 进行中待筑基调息）
    const qsMain = new QuestSystem();
    qsMain.registerAllQuests();
    for (const id of ['chapter1_main_1', 'chapter1_main_2', 'chapter1_main_3', 'chapter1_main_4']) {
        finishQuestOn(qsMain, id);
    }
    qsMain.acceptQuest('chapter1_ending_1');
    results.qsMainEnding1Active = qsMain.isQuestActive('chapter1_ending_1');

    const qiboConfig = Chapter1Config.getNPCConfigs().qibo;
    const aheConfig = Chapter1Config.getNPCConfigs().ahe;

    function makeNpc(id, name, dialogues) {
        const npc = {
            id: id, name: name, position: { x: 1000, y: 600 }, facing: 'down',
            dialogueSystem: new DialogueSystem(null, dialogues || {}),
            startedWith: [],
            repositionCalls: [],
            reposition(tx, ty, map) { this.repositionCalls.push([tx, ty, !!map]); },
            faceTarget() {},
            changeState() {},
            endDialogue() { this.dialogueSystem.endDialogue(); },
            startDialogue(player, dialogueId) {
                this.startedWith.push(dialogueId);
                this.dialogueSystem.startDialogue(dialogueId);
            },
        };
        npc.dialogueSystem.npc = npc;
        return npc;
    }

    const qibo = makeNpc('qibo', '祁伯', qiboConfig.dialogues);
    const ahe = makeNpc('ahe', '阿禾', aheConfig.dialogues);

    const main = new Main();
    const auraConfig = PlayerCombatSystem.CONFIG.foundationAura;

    // 场景管理器桩（handleKeyDown 会读取当前场景）
    main.sceneManager = { getCurrentScene: () => ({ sceneId: 'gameWorld' }) };

    main.player = {
        position: { x: 1000, y: 600 },
        facing: 'left',
        isInteracting: false,
        isAlive: true,
        width: 24, height: 32,
        playerData: { realm: 'lianqi', stage: '圆满', maxHealth: 200, mana: 200, health: 200 },
        animationManager: { setDirection() {}, play() {}, hasAnimation: () => false },
        questSystem: qsMain,
        playIdleAnimation() {},
        breakthrough() { this.playerData.realm = 'zhuji'; return true; },
    };
    main.inputManager = new InputManager(window, document.getElementById('gameCanvas'));

    const dialogCalls = [];
    main.dialogBox = {
        isVisible: false,
        show() { this.isVisible = true; dialogCalls.push('show'); },
        hide() { this.isVisible = false; dialogCalls.push('hide'); },
        setText(text, speaker) { dialogCalls.push('text:' + (speaker || '') + '|' + text); },
        clearOptionButtons() {},
        addOptionButton() {},
        advance() {},
        update() {},
        buttons: [],
    };
    const mapTeleportCalls = [];
    // 世界地图按钮解锁状态单独记录：不能混进 mapTeleportCalls，
    // 否则会干扰“调息序列中键盘锁定（mapTeleportCalls 为空）”的断言
    const worldMapUnlockCalls = [];
    main.mapTeleport = {
        isVisible: false,
        show() { this.isVisible = true; mapTeleportCalls.push('show'); },
        hide() { this.isVisible = false; mapTeleportCalls.push('hide'); },
        // M 键 → toggle：与真实 MapTeleport 一致，开关同时切换 isVisible
        toggle() { mapTeleportCalls.push('toggle'); this.isVisible = !this.isVisible; },
        // 真实 MapTeleport 的按钮接口（Main.updateWorldMapUnlocks 会调用）
        setButtonEnabled(id, enabled) { worldMapUnlockCalls.push(id + '=' + enabled); },
    };
    const questUICalls = [];
    main.questUI = {
        isVisible: false,
        toggle() { questUICalls.push('toggle'); this.isVisible = !this.isVisible; },
        hide() { questUICalls.push('hide'); this.isVisible = false; },
        update() {},
        setQuestSystem() {},
    };
    // 真实的玩家战斗系统：用于校验气场（under 层 / 跟随玩家 / 5 秒计时）
    main.playerCombat = new PlayerCombatSystem({ main: main });

    const mapStub = {
        mapConfig: Chapter1Config.getMapConfigs().qinglan_fuye,
        signposts: new Map(),
        npcs: new Map([['ahe', ahe], ['qibo', qibo]]),
        tileToWorld(tx, ty) { return { x: tx * 32 + 16, y: ty * 32 + 16 }; },
    };
    results.departSignpostData = mapStub.mapConfig.chapterEnd.departSignpost;
    // 让 Main 的 currentMap 指向桩地图，走真实的“对话 on_complete → createDepartSignpost”代码路径
    main.currentMap = mapStub;

    // ---- 触发筑基调息（模拟玩家在 breakthrough_ready 里选“开始筑基”） ----
    main.startFoundationTrial(qibo);
    await new Promise(r => setTimeout(r, 20));   // 等 setTimeout(0) 内的锁定生效
    // 让气场走一帧（真实游戏里 GameLoop 每帧都会 update），以校验跟随定位
    main.playerCombat.update(0.016, { pressedKeys: {} });

    const locked = main.inputManager.getInputState();
    results.trial = {
        playing: main.isFoundationTrialPlaying === true,
        movementBlocked: locked.movementBlocked === true,
        inputBlocked: main.inputManager.inputBlocked === true,
        playerFacing: main.player.facing,
        auraPlaying: main.playerCombat.isFoundationAuraPlaying(),
        auraDuration: main.playerCombat.foundationAuraTimer,
        auraLayer: main.playerCombat.foundationAura ? main.playerCombat.foundationAura.layer : null,
        auraFollows: main.playerCombat.foundationAura
            ? (main.playerCombat.foundationAura.position.x === main.player.position.x + auraConfig.offsetX
               && main.playerCombat.foundationAura.position.y === main.player.position.y + auraConfig.offsetY)
            : false,
        isInteracting: main.player.isInteracting === true,
    };

    // 键盘锁定：Q（任务栏）/ M（世界地图）/ E（交互）均无响应
    main.handleKeyDown('q', {});
    main.handleKeyDown('m', {});
    main.handleKeyDown('e', {});
    results.trial.keyboardLocked = questUICalls.length === 0 && mapTeleportCalls.length === 0;

    // ---- 气场播放 5 秒后自动续接对话 ----
    const fakeInput = { pressedKeys: {}, keys: {}, mouseX: 0, mouseY: 0, mouseClicked: false };
    let elapsed = 0;
    while (main.isFoundationTrialPlaying && elapsed < 10) {
        main.updateGameWorld(0.1, fakeInput);
        elapsed += 0.1;
    }
    results.trial.elapsed = Number(elapsed.toFixed(1));
    results.afterTrial = {
        auraPlaying: main.playerCombat.isFoundationAuraPlaying(),
        inputBlocked: main.inputManager.inputBlocked,
        // 续接对话进行中 → 移动仍被禁止（与其它对话一致）
        movementBlocked: main.inputManager.getInputState().movementBlocked,
        qiboDialogues: qibo.startedWith.slice(),
        dialogBoxVisible: main.dialogBox.isVisible,
        lastText: dialogCalls.filter(c => c.indexOf('text:') === 0).pop(),
    };

    // 续接对话结束后应彻底解锁（临时摘掉 onDialogueEnd，避免提前触发 on_complete）
    const savedOnDialogueEnd = qibo.dialogueSystem.onDialogueEnd;
    qibo.dialogueSystem.onDialogueEnd = null;
    main.endNPCInteraction(qibo);
    qibo.dialogueSystem.onDialogueEnd = savedOnDialogueEnd;
    results.afterTrial.movementBlockedAfterDialogue = main.inputManager.getInputState().movementBlocked;
    results.afterTrial.dialogBoxVisibleAfterDialogue = main.dialogBox.isVisible;

    // ---- breakthrough_success 的 on_complete（筑基结算 / 解锁云渡泽 / 接取《桥边寻阿禾》） ----
    const breakthroughNode = qibo.dialogueSystem.getDialogue('breakthrough_success');
    results.breakthroughOnComplete = breakthroughNode ? breakthroughNode.on_complete : null;
    qibo.dialogueSystem.currentDialogue = breakthroughNode;
    main.handleDialogueComplete(qibo);
    const endingConfigs = Chapter1Config.getQuestConfigs();
    results.afterBreakthrough = {
        flagFoundationTrialDone: qsMain.hasStoryFlag('foundation_trial_done'),
        flagYunduze: qsMain.hasStoryFlag('yunduze_unlocked'),
        ending1Completed: qsMain.isQuestCompleted('chapter1_ending_1'),
        ending2Active: qsMain.isQuestActive('chapter1_ending_2'),
        ending2Title: endingConfigs.ending_2 ? endingConfigs.ending_2.title : null,
        realm: main.player.playerData.realm,
        // 筑基结算后的玩家数值（Main.completeFoundationTrial → applyFoundationRealmStats）：
        // 气血上限 400 且回满、灵息上限 250 且回满
        playerStats: {
            realm: main.player.playerData.realm,
            stage: main.player.playerData.stage,
            health: main.player.playerData.health,
            maxHealth: main.player.playerData.maxHealth,
            mana: main.player.playerData.mana,
            maxMana: main.player.playerData.maxMana,
        },
        continuedDialog: qibo.dialogueSystem.currentDialogueId,
        lastText: dialogCalls.filter(c => c.indexOf('text:') === 0).pop(),
    };

    // ---- 择道不再接入章末流程：筑基后不启动 choose_profession / respec_profession ----
    results.professionFlow = {
        started: qibo.startedWith.slice(),
        hasChooseProfession: qibo.startedWith.indexOf('choose_profession') !== -1,
        hasRespec: qibo.startedWith.indexOf('respec_profession') !== -1,
    };

    // ---- 到桥边码头找阿禾：走真实交互路径 ----
    // startNPCInteraction → getDialogueForNPC(ahe) 取 farewell → 推进 talk_to ahe（ending_2《桥边寻阿禾》完结）
    // → 对话结束 on_complete：record_farewell_done + create_depart_signpost + accept_quest_chapter1_ending_3
    // 注：阿禾迁往码头由任务钩子（Main.onQuestComplete: chapter1_ending_1 → ahe.reposition(81,44)）
    // 与重新进图的 Main.applyChapterEndStage 共同保证，两者都在本测试末尾的真实代码路径中校验。
    main.startNPCInteraction(ahe);
    results.aheInteraction = {
        startedWith: ahe.startedWith.slice(),
        ending2Completed: qsMain.isQuestCompleted('chapter1_ending_2'),
        dialogText: dialogCalls.filter(c => c.indexOf('text:') === 0).pop(),
    };

    const farewellNode = ahe.dialogueSystem.currentDialogue;
    results.farewellOnComplete = farewellNode ? farewellNode.on_complete : null;
    main.handleDialogueComplete(ahe);   // record_farewell_done + create_depart_signpost + accept_quest_chapter1_ending_3
    results.ending3AfterFarewell = qsMain.isQuestActive('chapter1_ending_3');

    const signpost = mapStub.signposts.get('signpost_depart_boat');
    results.signpost = signpost ? {
        position: { x: signpost.position.x, y: signpost.position.y },
        promptText: signpost.promptText,
        oneShot: signpost.oneShot,
        isActive: signpost.isActive,
        marker: signpost.name,
    } : null;

    // ---- 路标自定义美术：Chapter1Config → Signpost 实例 → ResourceManager 资源键 ----
    const signpostArtRm = ResourceManager.getInstance();
    const herbSignpostConfig = (mapStub.mapConfig.signposts || {}).herb_collect || null;
    results.signpostArt = {
        // 章末登船路标：数据里的图片键 / 显示尺寸，以及 Main.createDepartSignpost 透传后的实例字段
        departBoatConfig: {
            image: mapStub.mapConfig.chapterEnd.departSignpost.image,
            imageWidth: mapStub.mapConfig.chapterEnd.departSignpost.imageWidth,
            imageHeight: mapStub.mapConfig.chapterEnd.departSignpost.imageHeight,
        },
        departBoatInstance: signpost ? {
            imageKey: signpost.imageKey,
            imageWidth: signpost.imageWidth,
            imageHeight: signpost.imageHeight,
        } : null,
        herbCollectConfig: herbSignpostConfig ? {
            image: herbSignpostConfig.image,
            imageWidth: herbSignpostConfig.imageWidth,
            imageHeight: herbSignpostConfig.imageHeight,
        } : null,
        // 资源键 → 文件路径（两处路标都必须已登记，否则 loadImage 会走占位图分支）
        resourcePaths: {
            departBoat: signpostArtRm.getImagePath('signposts.depart_boat'),
            herbCollect: signpostArtRm.getImagePath('signposts.herb_collect'),
        },
        // 缺图时 ResourceManager 返回 dataURL 占位图，Signpost 会据此回退木牌
        placeholderIsDataUrl: (() => {
            const ph = signpostArtRm.createPlaceholderImage();
            return typeof ph.src === 'string' && ph.src.startsWith('data:');
        })(),
    };

    // 缺图行为探针：故意用一个未登记的资源键 → ResourceManager 返回 dataURL 占位图
    // → Signpost 必须保持 image = null（回退程序化木牌），而不是把品红占位块画到地图上
    const silencedConsoleError = console.error;
    console.error = () => {};   // 屏蔽“图片资源路径不存在”的探针噪音
    const missingArtSignpost = new Signpost({
        id: 'signpost_missing_art_probe',
        name: '缺图探针',
        position: { x: 0, y: 0 },
        image: 'signposts.__missing_art_probe__',
        imageWidth: 60,
        imageHeight: 60,
    });
    await new Promise(r => setTimeout(r, 0));   // 等 loadImage 的 Promise 链跑完
    console.error = silencedConsoleError;
    results.signpostArt.missingArtFallsBack = missingArtSignpost.image === null;
    results.signpostArt.missingArtKeepsKey = missingArtSignpost.imageKey === 'signposts.__missing_art_probe__';

    // 图片对位（anchor）：center 默认以坐标为中心；bottom 时图片底边落在坐标上
    const anchorCtx = document.getElementById('gameCanvas').getContext('2d');
    const fakeSignImage = { width: 60, height: 60 };
    const probeSignpost = (anchor) => {
        const sp = new Signpost({ id: `probe_${anchor}`, position: { x: 1000, y: 500 }, anchor: anchor });
        sp.image = fakeSignImage;                       // 绕过异步加载，直接验证绘制对位
        anchorCtx.drawnImages.length = 0;
        sp.render(anchorCtx, null);
        const args = anchorCtx.drawnImages[0] || [];
        return { anchor: sp.anchor, x: args[1], y: args[2], w: args[3], h: args[4] };
    };
    results.signpostArt.anchor = {
        defaultsToCenter: new Signpost({ id: 'probe_no_anchor' }).anchor,
        center: probeSignpost(undefined),
        bottom: probeSignpost('bottom'),
    };

    // 幂等：重复生成不会新增
    main.createDepartSignpost(mapStub);
    results.signpostCountAfterSecondCall = mapStub.signposts.size;

    // 提示文案：按 E 键乘船离开
    const ctx = document.getElementById('gameCanvas').getContext('2d');
    ctx.drawnTexts.length = 0;
    signpost.renderPrompt(ctx, null);
    results.promptDrawn = ctx.drawnTexts.slice();

    // 按 E 登船 → 开启世界地图
    const mapTeleportBefore = mapTeleportCalls.length;
    signpost.activate();
    results.boardResult = {
        mapTeleportOpened: mapTeleportCalls.slice(mapTeleportBefore),
        flagChapterComplete: qsMain.hasStoryFlag('chapter1_complete'),
        ending2Completed: qsMain.isQuestCompleted('chapter1_ending_2'),
        ending3Completed: qsMain.isQuestCompleted('chapter1_ending_3'),
    };

    // ---- applyChapterEndStage：重新进图 / 读档后的恢复 ----
    ahe.repositionCalls.length = 0;
    const mapStub2 = {
        mapConfig: mapStub.mapConfig,
        signposts: new Map(),
        npcs: new Map([['ahe', ahe]]),
        tileToWorld(tx, ty) { return { x: tx * 32 + 16, y: ty * 32 + 16 }; },
    };
    main.applyChapterEndStage(mapStub2);   // 真实代码路径：按剧情标记恢复章末舞台
    results.restage = {
        aheReposition: ahe.repositionCalls.slice(),
        signpostRecreated: mapStub2.signposts.has('signpost_depart_boat'),
    };

    // 反向校验：章末未发生（无标记 / ending_1 未完成）时不应迁移阿禾、也不应生成路标
    const playerQuestSystem = main.player.questSystem;
    main.player.questSystem = new QuestSystem();
    const mapStub3 = {
        mapConfig: mapStub.mapConfig,
        signposts: new Map(),
        npcs: new Map([['ahe', ahe]]),
        tileToWorld(tx, ty) { return { x: tx * 32 + 16, y: ty * 32 + 16 }; },
    };
    ahe.repositionCalls.length = 0;
    main.applyChapterEndStage(mapStub3);
    results.gatedOff = {
        aheReposition: ahe.repositionCalls.slice(),
        signpostCount: mapStub3.signposts.size,
    };
    main.player.questSystem = playerQuestSystem;

    // ---- M 键已按需求移除（第十三次改动）：按 M 不再打开 / 关闭世界地图 ----
    // 前置状态清零：若无对话 / 剧情对白 / 任务栏打开，handleKeyDown 会按规则 1/1b/2 提前返回
    mapTeleportCalls.length = 0;
    main.isFoundationTrialPlaying = false;
    main.isCoreTrialPlaying = false;
    main.storyDialogueActive = false;
    main.dialogBox.isVisible = false;
    main.questUI.isVisible = false;
    main.mapTeleport.isVisible = false;
    main.handleKeyDown('m', {});
    main.handleKeyDown('m', {});
    results.mKey = {
        calls: mapTeleportCalls.slice(),          // 期望空数组：一开一关都该「什么都不发生」
        blocked: mapTeleportCalls.length === 0,
        visibleAfter: main.mapTeleport.isVisible === true,
    };
    results.worldMapUnlockCalls = worldMapUnlockCalls.slice();

    // ---- 战场内按 M 同样毫无反应（M 已不再有任何开图能力，也就不会让战场流程停摆） ----
    const savedMapForArenaCheck = main.currentMap;
    main.currentMap = {
        mapId: main.bossArenaMapId, mapConfig: {}, npcs: new Map(), signposts: new Map(),
    };
    mapTeleportCalls.length = 0;
    main.handleKeyDown('m', {});
    results.mKeyBlockedInArena = {
        calls: mapTeleportCalls.slice(),
        opened: main.mapTeleport.isVisible === true,
    };
    main.currentMap = savedMapForArenaCheck;

    // ---- 世界地图的剧情入口仍在：章末登船 / 完结后续登船（openWorldMapFromBerth → MapTeleport.show）----
    // 说明：M 键移除只是取消「键盘调试入口」，世界地图本身与它的剧情打开方式都保留。
    mapTeleportCalls.length = 0;
    main.mapTeleport.isVisible = false;
    main.openWorldMapFromBerth();
    results.worldMapStoryEntry = {
        calls: mapTeleportCalls.slice(),
        visible: main.mapTeleport.isVisible === true,
    };
    main.mapTeleport.isVisible = false;

    // ---- 世界地图打开时：画面只保留世界地图本身（交互提示 / HUD / 任务栏都不渲染） ----
    const overlaySignpost = mapStub.signposts.get('signpost_depart_boat');
    const overlayCtx = document.getElementById('gameCanvas').getContext('2d');
    let overlayMapRendered = 0;
    let overlayInteractions = 0;
    const savedMapRender = main.mapTeleport.render;
    const savedSignpostActivate = overlaySignpost.activate;
    const questUICallsBeforeOverlay = questUICalls.length;
    main.mapTeleport.render = function () { overlayMapRendered++; };
    overlaySignpost.activate = function () { overlayInteractions++; };
    main.mapTeleport.isVisible = true;
    main.mapTeleport.isActive = true;
    main.player.nearbySignpost = overlaySignpost;   // 玩家正站在登船路标旁（最容易穿帮的场景）
    main.player.isInteracting = false;
    main.dialogBox.isVisible = false;

    // 地图关闭时的对照组：路标提示应正常绘制
    overlayCtx.drawnTexts.length = 0;
    main.mapTeleport.isVisible = false;
    main.renderGameWorld(overlayCtx);
    const textsWhenMapClosed = overlayCtx.drawnTexts.slice();

    // 地图打开时：只渲染世界地图，且不再绘制任何提示文本
    overlayCtx.drawnTexts.length = 0;
    main.mapTeleport.isVisible = true;
    main.renderGameWorld(overlayCtx);
    const textsWhenMapOpen = overlayCtx.drawnTexts.slice();

    // 地图打开时按 Q / E：不打开任务栏、不触发交互
    main.handleKeyDown('q', {});
    main.handleInteraction();

    results.overlay = {
        mapRenderedWhenOpen: overlayMapRendered,
        textsWhenMapClosed: textsWhenMapClosed,
        textsWhenMapOpen: textsWhenMapOpen,
        questUIOpenedByQ: questUICalls.length !== questUICallsBeforeOverlay || main.questUI.isVisible === true,
        interactionTriggered: overlayInteractions,
    };

    // 还原桩状态，避免影响后续断言
    main.mapTeleport.isVisible = false;
    main.mapTeleport.isActive = false;
    main.mapTeleport.render = savedMapRender;
    overlaySignpost.activate = savedSignpostActivate;
    main.player.nearbySignpost = null;

    // ---- 主线三门控：未询问柳婶时 Main.startWindBridgeRescue 不得搬迁 / 推进目标 ----
    const rescueGateSystem = new QuestSystem();
    rescueGateSystem.registerAllQuests();
    finishQuestOn(rescueGateSystem, 'chapter1_main_1');
    finishQuestOn(rescueGateSystem, 'chapter1_main_2');
    rescueGateSystem.acceptQuest('chapter1_main_3');
    const zhoushuStub = {
        id: 'zhoushu', name: '周叔',
        repositionWorldCalls: [],
        repositionWorld(x, y, map) { this.repositionWorldCalls.push([x, y, !!map]); },
    };
    mapStub.npcs.set('zhoushu', zhoushuStub);
    const savedRescuePlayerQuestSystem = main.player.questSystem;
    main.player.questSystem = rescueGateSystem;
    // 1) 只接完祁伯的任务（当前目标仍是“询问阿砚”）→ 必须被拦住
    main.startWindBridgeRescue(zhoushuStub);
    const blockedRepositionCalls = zhoushuStub.repositionWorldCalls.length;
    const blockedRescueObjective = rescueGateSystem.isObjectiveCompleted('chapter1_main_3', 'rescue', 'zhoushu');
    // 2) 询问阿砚 + 柳婶后（rescue 成为当前目标）→ 正常护送并推进目标
    rescueGateSystem.updateQuestProgress('chapter1_main_3', 'talk_to', 'ayan', 1);
    rescueGateSystem.updateQuestProgress('chapter1_main_3', 'talk_to', 'liushen', 1);
    main.startWindBridgeRescue(zhoushuStub);
    results.rescueGuard = {
        blockedRepositionCalls: blockedRepositionCalls,
        blockedRescueObjective: blockedRescueObjective,
        allowedRepositionCalls: zhoushuStub.repositionWorldCalls.length,
        allowedRescueObjective: rescueGateSystem.isObjectiveCompleted('chapter1_main_3', 'rescue', 'zhoushu'),
        movedTo: zhoushuStub.repositionWorldCalls[zhoushuStub.repositionWorldCalls.length - 1] || null,
    };
    main.player.questSystem = savedRescuePlayerQuestSystem;
    mapStub.npcs.delete('zhoushu');

    // ---- 对话框必须画在左下角按键提示 UI（技能栏 / 气血灵息条）之上 ----
    const layerCtx = document.getElementById('gameCanvas').getContext('2d');
    const savedPlayerCombatForLayer = main.playerCombat;
    const savedDialogBoxForLayer = main.dialogBox;
    main.playerCombat = { renderHud(ctx) { ctx.fillText('__BOTTOM_LEFT_KEY_PROMPT__', 10, 700); } };
    main.dialogBox = { isVisible: true, render(ctx) { ctx.fillText('__DIALOG_BOX__', 100, 500); } };
    layerCtx.drawnTexts.length = 0;
    main.renderGameWorld(layerCtx);
    const layerTexts = layerCtx.drawnTexts.slice();
    results.layering = {
        texts: layerTexts,
        hudPromptIndex: layerTexts.indexOf('__BOTTOM_LEFT_KEY_PROMPT__'),
        dialogBoxIndex: layerTexts.indexOf('__DIALOG_BOX__'),
    };
    main.playerCombat = savedPlayerCombatForLayer;
    main.dialogBox = savedDialogBoxForLayer;

    // ---- 调试代码清理 + 数值核对（Boss 传送法阵任务门控 / 玩家血量 / Boss 血量）----
    // 传送法阵：山口法阵必须仍由 chapter1_main_4 任务门控（不可再被调试开关强开）
    const teleportConfig = Chapter1Config.getMapConfigs().qinglan_fuye.teleporters.boss_enter;
    const probeTeleport = new TeleportArray({
        id: teleportConfig.id,
        name: teleportConfig.name,
        position: { x: 0, y: 0 },
        questRequired: teleportConfig.questRequired,
    });
    const gateStub = (state) => ({ getQuestState: () => ({ state: state }) });
    probeTeleport.updateQuestGate(gateStub('locked'));
    const teleportHiddenWhenLocked = probeTeleport.isActive;
    probeTeleport.updateQuestGate(null);
    const teleportHiddenWithoutQuestSystem = probeTeleport.isActive;
    probeTeleport.updateQuestGate(gateStub('active'));
    const teleportVisibleWhenAccepted = probeTeleport.isActive;
    probeTeleport.updateQuestGate(gateStub('completed'));
    const teleportVisibleWhenCompleted = probeTeleport.isActive;

    // 玩家血量 / 灵息：练气初始值（GameConfig 境界表 + PlayerData 默认值 = 气血 150/150、灵息 70/70）
    const lianqiRealm = GameConfig.getInstance().getRealm('lianqi');
    const zhujiRealm = GameConfig.getInstance().getRealm('zhuji');
    const freshPlayerData = new PlayerData({ realm: 'lianqi', stage: '初期' });

    // 灵息自然恢复：真实 Player.updateManaRegen（练气 每 1 秒 2 点，回满后不溢出）
    const regenPlayer = Object.create(Player.prototype);
    regenPlayer.isAlive = true;
    regenPlayer.playerData = new PlayerData({ realm: 'lianqi', stage: '初期' });
    regenPlayer.manaRegenTimer = 0;
    regenPlayer.playerData.mana = 0;
    regenPlayer.updateManaRegen(0.9);
    const regenAt0p9 = regenPlayer.playerData.mana;
    regenPlayer.updateManaRegen(0.1);
    const regenAt1 = regenPlayer.playerData.mana;
    regenPlayer.updateManaRegen(4);
    const regenAt5 = regenPlayer.playerData.mana;
    regenPlayer.updateManaRegen(600);            // 长时间挂机：封顶在 maxMana
    const regenCapped = regenPlayer.playerData.mana;
    const regenTimerAtCap = regenPlayer.manaRegenTimer;

    // 灵息自然恢复按境界分档（byRealm）：筑基 每 1 秒 4 点 / 结丹 每 1 秒 10 点
    const probeRegen = (realmId, steps) => {
        const probe = Object.create(Player.prototype);
        probe.isAlive = true;
        probe.playerData = new PlayerData({ realm: realmId, stage: '初期' });
        probe.manaRegenTimer = 0;
        probe.playerData.mana = 0;
        steps.forEach(step => probe.updateManaRegen(step));
        return probe.playerData.mana;
    };
    const zhujiRegenAt0p9 = probeRegen('zhuji', [0.9]);
    const zhujiRegenAt1 = probeRegen('zhuji', [1]);
    const zhujiRegenAt3 = probeRegen('zhuji', [3]);
    const jiedanRegenAt1 = probeRegen('jiedan', [1]);
    const jiedanRegenAt2p5 = probeRegen('jiedan', [2.5]);

    // 筑基突破：真实 Player.breakthrough（练气圆满 → 筑基：上限 400/250 并即时回满）
    const breakthroughPlayer = Object.create(Player.prototype);
    breakthroughPlayer.isAlive = true;
    breakthroughPlayer.playerData = new PlayerData({ realm: 'lianqi', stage: '圆满' });
    breakthroughPlayer.playerData.health = 12;    // 突破前故意留残血 / 残灵息
    breakthroughPlayer.playerData.mana = 3;
    breakthroughPlayer.professionSystem = { professionConfig: {} };
    const breakthroughAdvanced = breakthroughPlayer.breakthrough();

    // Boss 血量：配置值 + 真实 ShanxiaoBoss 实例（GameMap.spawnArenaBoss 的创建参数）
    const bossMonsterConfig = Chapter1Config.getMonsterConfigs().boss_shanxiao;
    let spawnedBossHp = null;
    let spawnedBossError = null;
    try {
        const probeBoss = new ShanxiaoBoss({ id: 'probe_boss', position: { x: 0, y: 0 } });
        spawnedBossHp = probeBoss.maxHealth;
        if (probeBoss.destroy) probeBoss.destroy();
    } catch (error) {
        spawnedBossError = error && error.message ? error.message : String(error);
    }

    results.numeric = {
        debugCheatsGlobal: typeof window.DebugCheats !== 'undefined',
        teleportQuestRequired: teleportConfig.questRequired,
        teleportBossArena: teleportConfig.bossArena === true,
        teleportHiddenWhenLocked: teleportHiddenWhenLocked,
        teleportHiddenWithoutQuestSystem: teleportHiddenWithoutQuestSystem,
        teleportVisibleWhenAccepted: teleportVisibleWhenAccepted,
        teleportVisibleWhenCompleted: teleportVisibleWhenCompleted,
        realmMaxHealth: lianqiRealm && lianqiRealm.maxHealth,
        realmMaxMana: lianqiRealm && lianqiRealm.maxMana,
        zhujiMaxHealth: zhujiRealm && zhujiRealm.maxHealth,
        zhujiMaxMana: zhujiRealm && zhujiRealm.maxMana,
        freshPlayerHealth: freshPlayerData.health,
        freshPlayerMaxHealth: freshPlayerData.maxHealth,
        freshPlayerMana: freshPlayerData.mana,
        freshPlayerMaxMana: freshPlayerData.maxMana,
        manaRegenConfig: GameConfig.getInstance().get('combat.manaRegen'),
        manaRegenByRealm: (GameConfig.getInstance().get('combat.manaRegen') || {}).byRealm,
        zhujiRegenAt0p9: zhujiRegenAt0p9,
        zhujiRegenAt1: zhujiRegenAt1,
        zhujiRegenAt3: zhujiRegenAt3,
        jiedanRegenAt1: jiedanRegenAt1,
        jiedanRegenAt2p5: jiedanRegenAt2p5,
        regenAt0p9: regenAt0p9,
        regenAt1: regenAt1,
        regenAt5: regenAt5,
        regenCapped: regenCapped,
        regenTimerAtCap: regenTimerAtCap,
        breakthroughAdvanced: breakthroughAdvanced,
        breakthroughRealm: breakthroughPlayer.playerData.realm,
        breakthroughMaxHealth: breakthroughPlayer.playerData.maxHealth,
        breakthroughMaxMana: breakthroughPlayer.playerData.maxMana,
        breakthroughHealth: breakthroughPlayer.playerData.health,
        breakthroughMana: breakthroughPlayer.playerData.mana,
        bossConfigHealth: bossMonsterConfig.health,
        spawnedBossHp: spawnedBossHp,
        spawnedBossError: spawnedBossError,
    };

    // ---- 基础操作教学：按键门控（只在教学圈内可用）+ 左下角技能栏逐格解锁 ----
    const trainingProbe = new TrainingManager();
    trainingProbe.startBasicTraining();

    // 站在"普通攻击"教学圈上（坐标取自 TrainingManager.BASIC_TRAINING_LAYOUT，
    // 布局调整后这里自动跟随，避免测试里硬编码旧坐标造成假失败）
    const trainingLayout = TrainingManager.BASIC_TRAINING_LAYOUT;
    const trainingZonePos = (actionType) => {
        const zone = trainingLayout.find(z => z.actionType === actionType) || trainingLayout[0];
        return { x: zone.position.x, y: zone.position.y };
    };
    const trainingPlayer = {
        position: trainingZonePos('attack'),
        isAlive: true,
        playerData: { health: 100, maxHealth: 100, mana: 50, maxMana: 100 },
        professionSystem: { getAttackDamage: () => 10 },
        restoreMana(amount) {
            this.playerData.mana = Math.min(this.playerData.maxMana, this.playerData.mana + amount);
        },
    };
    const trainingMain = {
        trainingManager: trainingProbe,
        player: trainingPlayer,
        currentMap: null,
        battleSystem: null,
        canvas: { width: 1280, height: 720 },
        sceneManager: { getCurrentScene: () => ({ sceneId: 'gameWorld' }) },
        questUI: { isVisible: false },
        dialogBox: { isVisible: false },
        mapTeleport: { isVisible: false },
        shop: { isOpen: false },
    };
    const trainingCombat = new PlayerCombatSystem({ main: trainingMain });
    const trainingSkillOrder = PlayerCombatSystem.SKILL_ORDER.slice();

    const trainingHudCtx = document.getElementById('gameCanvas').getContext('2d');
    const renderTrainingHudTexts = () => {
        trainingHudCtx.drawnTexts.length = 0;
        trainingCombat.renderHud(trainingHudCtx);
        return trainingHudCtx.drawnTexts.slice();
    };

    results.training = {
        order: trainingSkillOrder,
        unlockedAtStart: trainingSkillOrder.filter(id => trainingCombat.isSkillUnlocked(id)),
        hudTextsAtStart: renderTrainingHudTexts(),
    };

    // 站在教学圈内：只有对应的那个键可用
    trainingProbe.update(0.016, trainingPlayer);
    results.training.nearbyZoneOnCircle = trainingProbe.nearbyZone ? trainingProbe.nearbyZone.id : null;
    results.training.canUseAttackOnCircle = trainingCombat.canUseAction('attack');
    results.training.canUseOthersOnCircle = ['lingxidan', 'hutishu', 'dodge']
        .filter(id => trainingCombat.canUseAction(id));

    // 离开所有教学圈：四个按键都不可用（只提示、不施展）
    trainingPlayer.position = { x: 2200, y: 1800 };
    trainingProbe.update(0.016, trainingPlayer);
    results.training.canUseAnyOffCircle = trainingSkillOrder.filter(id => trainingCombat.canUseAction(id));

    let trainingAttackCalls = 0;
    const savedTryAttack = trainingCombat.tryAttack.bind(trainingCombat);
    trainingCombat.tryAttack = function () { trainingAttackCalls++; return savedTryAttack(); };
    trainingCombat.update(0.016, { pressedKeys: { j: true } });
    results.training.attackCallsOffCircle = trainingAttackCalls;
    results.training.toastOffCircle = trainingCombat.toast.text;

    // 教学期按 O（剑影连斩）：本次试炼没有这个动作 → 完全静默（不弹"先走到教学圈"提示）
    trainingCombat.toast.text = '';
    trainingCombat.toast.timer = 0;
    trainingCombat.update(0.016, { pressedKeys: { o: true } });
    results.training.jianyingToastDuringTraining = trainingCombat.toast.text;

    // 回到教学圈内按 J：施展成功 → 完成该步骤 → 左下角出现 J 格（含冷却提示）
    trainingPlayer.position = trainingZonePos('attack');
    trainingProbe.update(0.016, trainingPlayer);
    trainingCombat.update(0.016, { pressedKeys: { j: true } });
    results.training.attackCallsOnCircle = trainingAttackCalls;
    results.training.completedAfterAttack = trainingProbe.isTrainingActionCompleted('attack');
    results.training.unlockedAfterAttack = trainingSkillOrder.filter(id => trainingCombat.isSkillUnlocked(id));
    // 清掉上一步“不在教学圈”的屏幕提示，本次渲染只记录 HUD 本身（技能栏）
    trainingCombat.toast.text = '';
    trainingCombat.toast.timer = 0;
    results.training.hudTextsAfterAttack = renderTrainingHudTexts();

    // 教学圈完成后消失：站回原处再按 J 不再可用（只提示）
    trainingCombat.update(0.016, { pressedKeys: { j: true } });
    results.training.canUseAttackAfterCompleted = trainingCombat.canUseAction('attack');

    // 依次完成其余三步 → 技能栏逐格补全（U / I / L）
    const trainingRestSteps = [
        { action: 'skill_lingxidan', position: trainingZonePos('skill_lingxidan') },
        { action: 'skill_hutishu', position: trainingZonePos('skill_hutishu') },
        { action: 'dodge', position: trainingZonePos('dodge') },
    ];
    results.training.unlockAfterEachStep = [];
    for (const step of trainingRestSteps) {
        trainingPlayer.position = { x: step.position.x, y: step.position.y };
        trainingProbe.update(0.016, trainingPlayer);
        trainingProbe.notifyAction(step.action, trainingPlayer);
        results.training.unlockAfterEachStep.push(
            trainingSkillOrder.filter(id => trainingCombat.isSkillUnlocked(id))
        );
    }
    results.training.completedCount = trainingProbe.completedCount;
    results.training.isActiveAfterAll = trainingProbe.isActive;
    trainingCombat.toast.text = '';     // 同上：只记录技能栏本身的绘制
    trainingCombat.toast.timer = 0;
    results.training.hudTextsAfterAll = renderTrainingHudTexts();

    // 教学全部完成（Main.onAllCompleted → setUnlocked(true)）→ 任何位置都能施展
    trainingCombat.setUnlocked(true);
    trainingPlayer.position = { x: 2200, y: 1800 };
    results.training.canUseAnyAfterTraining = trainingSkillOrder.filter(id => trainingCombat.canUseAction(id));

    // ---- 自定义气血条 / 灵息条（纯图片绘制：两图左上角对齐，先内条后外框） ----
    const barImages = {
        healthFrame: { width: 500, height: 64, tag: 'healthFrame' },
        healthFill: { width: 454, height: 64, tag: 'healthFill' },
        manaFrame: { width: 500, height: 64, tag: 'manaFrame' },
        manaFill: { width: 454, height: 64, tag: 'manaFill' },
        // 尺寸不符的图（例如 ResourceManager 加载失败的 32×32 占位图）
        brokenFrame: { width: 32, height: 32, tag: 'brokenFrame' },
    };
    const describeDraw = (args) => {
        // 9 参形式 = 带源矩形（内条裁切）；5 参形式 = 整图（外框）
        const spriteForm = args.length === 9;
        return {
            tag: args[0] && args[0].tag ? args[0].tag : null,
            source: spriteForm
                ? { x: args[1], y: args[2], w: args[3], h: args[4] }
                : null,
            dest: spriteForm
                ? { x: args[5], y: args[6], w: args[7], h: args[8] }
                : { x: args[1], y: args[2], w: args[3], h: args[4] },
        };
    };

    const barCtx = document.getElementById('gameCanvas').getContext('2d');
    const renderBars = (health, maxHealth, mana, maxMana, overrides) => {
        trainingPlayer.playerData.health = health;
        trainingPlayer.playerData.maxHealth = maxHealth;
        trainingPlayer.playerData.mana = mana;
        trainingPlayer.playerData.maxMana = maxMana;

        const sprites = trainingCombat.sprites;
        const pick = (key) => (
            overrides && Object.prototype.hasOwnProperty.call(overrides, key)
                ? overrides[key]
                : barImages[key]
        );
        sprites.hudHealthFrame = pick('healthFrame');
        sprites.hudHealthFill = pick('healthFill');
        sprites.hudManaFrame = pick('manaFrame');
        sprites.hudManaFill = pick('manaFill');

        barCtx.drawnImages.length = 0;
        barCtx.drawnTexts.length = 0;
        trainingCombat.renderHud(barCtx);
        return {
            draws: barCtx.drawnImages.map(describeDraw),
            texts: barCtx.drawnTexts.slice(),
        };
    };

    const resourceManager = ResourceManager.getInstance();
    const barHud = trainingCombat.config.hud;
    results.bars = {
        spec: {
            frameWidth: barHud.frameWidth, frameHeight: barHud.frameHeight,
            fillWidth: barHud.fillWidth, fillHeight: barHud.fillHeight,
            fillStartX: barHud.fillStartX,
            origin: { x: barHud.origin.x, y: barHud.origin.y },
            lineGap: barHud.lineGap,
            healthKeys: barHud.healthBar,
            manaKeys: barHud.manaBar,
        },
        resourcePaths: {
            healthFrame: resourceManager.getImagePath(barHud.healthBar.frameKey),
            healthFill: resourceManager.getImagePath(barHud.healthBar.fillKey),
            manaFrame: resourceManager.getImagePath(barHud.manaBar.frameKey),
            manaFill: resourceManager.getImagePath(barHud.manaBar.fillKey),
        },
        pathsInPreloadGroup: resourceManager.getResourceGroupImagePaths
            ? resourceManager.getResourceGroupImagePaths('playerCombat')
            : [],
        legacyCodeBarHelperGone: typeof trainingCombat._drawBar !== 'function',
        half: renderBars(50, 100, 25, 100, null),
        zero: renderBars(0, 100, 0, 100, null),
        full: renderBars(100, 100, 100, 100, null),
        over: renderBars(160, 100, 160, 100, null),
        // 任意比例（验证公式线性）：气血 75/100 → 78 + 0.75 × 376 = 360
        seventyFive: renderBars(75, 100, 50, 100, null),
        missingHealthFill: renderBars(50, 100, 50, 100, { healthFill: null }),
        brokenHealthFrame: renderBars(50, 100, 50, 100, { healthFrame: barImages.brokenFrame }),
        // 图片完全没有就绪时（真实运行环境里图片还没加载完）整条不绘制
        noImages: renderBars(50, 100, 50, 100, {
            healthFrame: null, healthFill: null, manaFrame: null, manaFill: null,
        }),
    };

    // ---- 左下角技能栏：U/I/L 各自的 100×100 图片 + 中央按键 / 冷却倒计时，普攻不占格 ----
    const skillBarCfg = trainingCombat.config.hud.skillBar;
    const skillBarOrder = skillBarCfg.order.slice();
    const skillIconImages = {
        lingxidan: { width: 100, height: 100, tag: 'icon_lingxidan' },
        hutishu: { width: 100, height: 100, tag: 'icon_hutishu' },
        dodge: { width: 100, height: 100, tag: 'icon_dodge' },
        jianying: { width: 100, height: 100, tag: 'icon_jianying' },
        wrongSize: { width: 64, height: 64, tag: 'icon_wrong_size' },
    };
    const setSkillIcons = (overrides) => {
        skillBarOrder.forEach(id => {
            trainingCombat.sprites['skillIcon_' + id] = (overrides && Object.prototype.hasOwnProperty.call(overrides, id))
                ? overrides[id]
                : skillIconImages[id];
        });
    };
    // 技能栏探针：渲染只读 cooldowns / sprites，故这里直接替换这两处状态后再调 renderHud
    const renderSkillBarProbe = (cooldowns, overrides) => {
        setSkillIcons(overrides);
        skillBarOrder.forEach(id => { trainingCombat.cooldowns[id] = cooldowns[id] || 0; });
        // 隔离：只让技能栏出图出字（气血 / 灵息条图与屏幕提示不参与本次记录）
        trainingCombat.sprites.hudHealthFrame = null;
        trainingCombat.sprites.hudHealthFill = null;
        trainingCombat.sprites.hudManaFrame = null;
        trainingCombat.sprites.hudManaFill = null;
        trainingCombat.toast.text = '';
        trainingCombat.toast.timer = 0;
        trainingHudCtx.drawnTexts.length = 0;
        trainingHudCtx.drawnImages.length = 0;
        trainingHudCtx.drawnRects.length = 0;
        trainingCombat.renderHud(trainingHudCtx);
        return {
            draws: trainingHudCtx.drawnImages.map(describeDraw),
            texts: trainingHudCtx.drawnTexts.slice(),
            rects: trainingHudCtx.drawnRects.slice(),
        };
    };

    // 普攻教学仍在（只是左下角不再显示 J 格）：教学圈提示依旧指向 J 键
    const attackTrainingZone = (trainingProbe.zones || []).find(z => z && z.actionType === 'attack');

    results.skillBar = {
        spec: {
            order: skillBarOrder,
            iconSize: skillBarCfg.iconSize,
            scale: skillBarCfg.scale,
            gap: skillBarCfg.gap,
            startX: skillBarCfg.startX,
            bottomMargin: skillBarCfg.bottomMargin,
            canvasWidth: 1280,
            canvasHeight: 720,
        },
        colors: skillBarOrder.map(id => trainingCombat.config[id].key),
        // 技能格上的文字开关：默认全关（按键字母 / 技能名 / 冷却倒计时都由美术图承担）
        textToggles: {
            showKey: skillBarCfg.showKey,
            showCooldownText: skillBarCfg.showCooldownText,
            showName: skillBarCfg.showName,
        },
        cooldowns: skillBarOrder.map(id => trainingCombat.config[id].cooldown),
        hudIcons: skillBarOrder.map(id => trainingCombat.config[id].hudIcon),
        attackHasIcon: !!trainingCombat.config.attack.hudIcon,
        attackSilentCooldown: trainingCombat.config.attack.silentCooldown === true,
        resourcePaths: {
            lingxidan: resourceManager.getImagePath(trainingCombat.config.lingxidan.hudIcon),
            hutishu: resourceManager.getImagePath(trainingCombat.config.hutishu.hudIcon),
            dodge: resourceManager.getImagePath(trainingCombat.config.dodge.hudIcon),
            jianying: resourceManager.getImagePath(trainingCombat.config.jianying.hudIcon),
        },
        pathsInPreloadGroup: resourceManager.getResourceGroupImagePaths
            ? resourceManager.getResourceGroupImagePaths('playerCombat')
            : [],
        ready: renderSkillBarProbe({}, null),
        cooling: renderSkillBarProbe({ lingxidan: 1.5, hutishu: 12, dodge: 0 }, null),
        missingIcons: renderSkillBarProbe({}, { lingxidan: null, hutishu: null, dodge: null }),
        wrongSizeIcons: renderSkillBarProbe({}, {
            lingxidan: skillIconImages.wrongSize,
            hutishu: skillIconImages.wrongSize,
            dodge: skillIconImages.wrongSize,
        }),
        attackTrainingZone: attackTrainingZone ? {
            actionKey: attackTrainingZone.actionKey,
            promptText: attackTrainingZone.promptText,
            isCompleted: attackTrainingZone.isCompleted,
        } : null,
    };

    // 普攻冷却不再弹屏幕中下方提示（silentCooldown）；其它技能冷却仍有提示（对照组）
    trainingCombat.cooldowns.attack = 0.4;
    trainingCombat.toast.text = '';
    trainingCombat.toast.timer = 0;
    results.skillBar.attackCooldownToast = {
        blocked: trainingCombat.tryAttack() === false,
        toastText: trainingCombat.toast.text,
        toastTimer: trainingCombat.toast.timer,
    };

    trainingCombat.cooldowns.lingxidan = 2;
    trainingCombat.toast.text = '';
    trainingCombat.toast.timer = 0;
    results.skillBar.lingxidanCooldownToast = {
        blocked: trainingCombat.tryCastLingxidan() === false,
        toastText: trainingCombat.toast.text,
    };

    // 剑影连斩（O）：未习得时技能栏完全不画这一格；习得（职业系统等级 1）后补出第 4 格 100×100
    results.skillBar.jianyingSlot = {
        orderIndex: skillBarOrder.indexOf('jianying'),
        // 未习得：上面的 ready / cooling / missingIcons 探针里都没有第 4 格
        hiddenDrawCount: results.skillBar.ready.draws.length,
        learned: (function () {
            trainingPlayer.professionSystem.getSkillLevel = (id) => (id === 'jianying' ? 1 : 0);
            const probe = renderSkillBarProbe({ jianying: 0 }, null);
            delete trainingPlayer.professionSystem.getSkillLevel;
            return probe;
        })(),
    };

    // ---- Boss 战场：首次生成 / 击败后不再生成 + 正中心永久归途法阵 + 无 10 秒自动回城 ----
    const arenaProbeConfig = Chapter1Config.getMapConfigs().boss_arena_ch1;
    const arenaProbeMap = new GameMap('boss_arena_ch1', arenaProbeConfig, {
        backgroundImage: null,
        collisionImage: null,
    });
    arenaProbeMap.init();

    const arenaReturnCalls = [];
    const savedReturnFromBossArena = main.returnFromBossArena;
    main.returnFromBossArena = (result) => {
        arenaReturnCalls.push(result === undefined ? 'death' : result);
        return Promise.resolve(true);
    };

    // 进场时 Main 记录的“原来位置”（山口法阵旁）
    main.bossArenaReturn = { mapId: 'qinglan_fuye', x: 2959, y: 358 };
    main.currentMap = arenaProbeMap;

    const arenaBossProbe = arenaProbeMap.arenaBoss;
    const arenaFirstEntrySpawned = !!arenaBossProbe;

    // 模拟“Boss 已被击败且倒地演出播完”
    if (arenaBossProbe) {
        arenaBossProbe.isAlive = false;
        arenaBossProbe.deathAnimationFinished = true;
    }

    // 推进 20 秒：旧逻辑会在 10 秒后自动传回，新逻辑不应有任何自动返回
    for (let frame = 0; frame < 200; frame++) {
        main.updateBossArenaBattle(0.1);
        if (arenaReturnCalls.length > 0) break;
    }

    const arenaExitArray = arenaProbeMap.teleporters.get('teleport_boss_exit');
    results.arena = {
        firstEntrySpawned: arenaFirstEntrySpawned,
        center: arenaProbeMap.getCenterWorldPosition(),
        victoryHandled: main.bossArenaVictoryHandled === true,
        storyFlag: qsMain.hasStoryFlag('boss_shanxiao_defeated'),
        bossCleared: arenaProbeMap.arenaBoss === null,
        autoReturnCalls: arenaReturnCalls.slice(),
        victoryTimerFieldGone: !('bossArenaVictoryDelay' in main) && !('bossArenaVictoryTimer' in main),
        exitArray: arenaExitArray ? {
            id: arenaExitArray.id,
            position: { x: arenaExitArray.position.x, y: arenaExitArray.position.y },
            targetMapId: arenaExitArray.targetMapId,
            targetPosition: { x: arenaExitArray.targetPosition.x, y: arenaExitArray.targetPosition.y },
            promptText: arenaExitArray.promptText,
            bossArena: arenaExitArray.bossArena,
            isActive: arenaExitArray.isActive,
        } : null,
    };

    // 再次进场：不再生成 Boss，归途法阵永久存在（幂等）
    arenaProbeMap.setArenaBossDefeated(true);
    const arenaRespawn = arenaProbeMap.ensureArenaBoss();
    main.ensureBossArenaExitArray(arenaProbeMap);
    const arenaExitArrayAgain = arenaProbeMap.teleporters.get('teleport_boss_exit');
    results.arena.secondEntry = {
        spawnBlocked: arenaRespawn === null && arenaProbeMap.arenaBoss === null,
        exitArrayCount: arenaProbeMap.teleporters.size,
        stillActive: !!arenaExitArrayAgain && arenaExitArrayAgain.isActive === true,
        targetPosition: arenaExitArrayAgain
            ? { x: arenaExitArrayAgain.targetPosition.x, y: arenaExitArrayAgain.targetPosition.y }
            : null,
    };

    main.returnFromBossArena = savedReturnFromBossArena;

    // ============ 战败清场（第十三次改动）：被 Boss 打死 → 清技能效果 + 技能冷却清 0 ============
    // 走真实 Main.returnFromBossArena 链路（前面的竞技场断言把它桩掉了，这里恢复真身）。
    // 需求：「玩家与 boss 战斗中死亡后，清除自身的技能效果，如闪避技能的加速、护身术的伤害减免，
    //       同时将所有技能的冷却时长清 0」。
    {
        const savedPlayerForDeathProbe = main.player;
        // 用真实 Player 顶替主线里那个精简桩（清场要读 / 写 moveSpeed、revive 等真实接口）
        main.player = new Player({
            position: { x: 1000, y: 600 },
            playerData: {
                realm: 'lianqi', stage: '圆满', health: 150, maxHealth: 150,
                mana: 70, maxMana: 70, lingShi: 0,
            },
            profession: { professionId: 'sanxiu' },
        });
        const combat = main.playerCombat;              // 真实 PlayerCombatSystem（构造时绑定同一个 Main）
        const getCurrentMoveSpeed = typeof main.player.getCurrentMoveSpeed === 'function';

        // 1) 造出「带增益 + 带冷却 + 受伤僵直 + 施法中」的死亡现场
        main.player.moveSpeed = main.player.getCurrentMoveSpeed() * 1.25;   // 闪避加速生效中
        combat.buffs.hutishu = 8;                     // 护身术剩 8 秒 → 减伤生效
        combat.buffs.dodge = 9;                       // 闪避剩 9 秒 → 移速 +25% 生效
        combat.cooldowns.hutishu = 22;
        combat.cooldowns.dodge = 51;
        combat.cooldowns.lingxidan = 2.5;
        combat.cooldowns.attack = 0.3;
        combat.hurtLock = 0.4;
        combat.casting = { timer: 0.2 };
        combat.hutishuAura = combat._spawnEffect('hutishu_aura', { follow: main.player, layer: 'under' });
        combat.dodgeAura = combat._spawnEffect('dodge_aura', { follow: main.player, layer: 'under' });
        main.player.isHurtLocked = true;
        main.player.isCastingSkill = true;

        const beforeDeathReset = {
            speed: main.player.moveSpeed,
            reduction: combat.getIncomingDamageMultiplier(),
            cooldowns: Object.assign({}, combat.cooldowns),
        };

        // 2) 战场内阵亡 → Main.updateGameWorld 会命中死亡分支并调用 returnFromBossArena
        main.player.isAlive = false;
        main.bossArenaReturn = { mapId: 'qinglan_fuye', x: 2959, y: 358 };

        // 3) 桩掉「回主图」的副作用（本节只看清场结果），其余全部走真实代码
        const savedSwitchToMap = main.switchToMap;
        const savedClearArenaResources = main.clearBossArenaResources;
        const savedApplyBossFailureBonus = main.applyBossFailureBonus;
        const savedAddGameNotification = main.addGameNotification;
        const savedPlaySfx = main.playSfx;
        const savedIsReturningFromBossArena = main.isReturningFromBossArena;
        main.switchToMap = async () => ({ mapId: 'qinglan_fuye' });
        main.clearBossArenaResources = () => true;
        main.applyBossFailureBonus = () => false;
        main.addGameNotification = () => {};
        main.playSfx = () => false;
        main.isReturningFromBossArena = false;

        const deathReturn = await main.returnFromBossArena();

        results.deathReset = {
            returned: deathReturn === true,
            hasMoveSpeedApi: getCurrentMoveSpeed,
            before: beforeDeathReset,
            after: {
                damageMultiplier: combat.getIncomingDamageMultiplier(),
                buffs: { hutishu: combat.buffs.hutishu, dodge: combat.buffs.dodge },
                cooldowns: Object.assign({}, combat.cooldowns),
                allCooldownsZero: Object.values(combat.cooldowns).every(v => v === 0),
                speed: main.player.moveSpeed,
                baseSpeed: main.player.getCurrentMoveSpeed(),
                hurtLock: combat.hurtLock,
                casting: combat.casting,
                playerHurtLocked: main.player.isHurtLocked,
                playerCasting: main.player.isCastingSkill,
                hutishuAura: combat.hutishuAura,
                dodgeAura: combat.dodgeAura,
                alive: main.player.isAlive,
            },
        };

        // 4) 还原探针改动（后续段落还要用原来的桩 player / 真实方法）
        main.switchToMap = savedSwitchToMap;
        main.clearBossArenaResources = savedClearArenaResources;
        main.applyBossFailureBonus = savedApplyBossFailureBonus;
        main.addGameNotification = savedAddGameNotification;
        main.playSfx = savedPlaySfx;
        main.isReturningFromBossArena = savedIsReturningFromBossArena;
        main.player = savedPlayerForDeathProbe;
    }

    // ============ 青岚浮野地图碰撞（collisionData 兜底 + 玩家碰撞盒 + 可达性） ============
    // 场景：以 file:// 直接双击打开 game.html 时读不到碰撞图像素（canvas.getImageData
    // 抛 SecurityError），TileSystem 只能回退到地图配置里的 collisionData。下面用
    // “碰撞图 = null”复刻该场景，全程走真实代码路径（TileSystem / GameMap / Player）。
    const qinglanCfg = Chapter1Config.getMapConfigs().qinglan_fuye;
    const qinglanTable = qinglanCfg.collisionData || null;
    const qinglanMap = new GameMap('qinglan_fuye', qinglanCfg, {
        backgroundImage: null,
        collisionImage: null,
    });
    const qinglanPlayer = new Player({ position: { x: 448, y: 1376 } });
    const boxNew = { width: qinglanPlayer.collisionWidth, height: qinglanPlayer.collisionHeight };
    const boxLegacy = { width: 24, height: 32 };   // 修复前的碰撞盒（正好等于瓦片边长）

    // 以 step 采样像素点 → 用真实 GameMap.isRectWalkable 判定能否站住 → 从出生点 4 邻域洪泛
    function scanArea(box, startX, startY, step) {
        const cols = Math.ceil((qinglanCfg.mapWidth * qinglanCfg.tileSize) / step);
        const rows = Math.ceil((qinglanCfg.mapHeight * qinglanCfg.tileSize) / step);
        const stand = new Uint8Array(cols * rows);
        const rect = { x: 0, y: 0, width: box.width, height: box.height };
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                rect.x = i * step - box.width / 2;
                rect.y = j * step - box.height / 2;
                if (qinglanMap.isRectWalkable(rect)) stand[j * cols + i] = 1;
            }
        }
        const seen = new Uint8Array(cols * rows);
        const start = Math.round(startY / step) * cols + Math.round(startX / step);
        const queue = [start];
        seen[start] = 1;
        let reachable = stand[start] ? 1 : 0;
        for (let head = 0; head < queue.length; head++) {
            const cur = queue[head];
            const ci = cur % cols;
            const cj = (cur - ci) / cols;
            const nbs = [ci > 0 ? cur - 1 : -1, ci < cols - 1 ? cur + 1 : -1,
                cj > 0 ? cur - cols : -1, cj < rows - 1 ? cur + cols : -1];
            for (const nb of nbs) {
                if (nb >= 0 && stand[nb] && !seen[nb]) { seen[nb] = 1; reachable++; queue.push(nb); }
            }
        }
        let standable = 0;
        for (let i = 0; i < stand.length; i++) standable += stand[i];
        return { cols, rows, step, standable, reachable, seen, stand };
    }

    // 交互点是否“站得住 + 走得到”：在各自交互半径内找是否有出生点可达的站立位置
    function probePoints(areaInfo, points) {
        const { cols, rows, step, stand, seen } = areaInfo;
        return points.map(([name, px, py, radius]) => {
            const r = Math.max(radius + 40, 80);
            let nearest = null;
            let reachable = false;
            for (let j = Math.max(0, Math.floor((py - r) / step)); j <= Math.min(rows - 1, Math.ceil((py + r) / step)); j++) {
                for (let i = Math.max(0, Math.floor((px - r) / step)); i <= Math.min(cols - 1, Math.ceil((px + r) / step)); i++) {
                    const idx = j * cols + i;
                    if (!stand[idx]) continue;
                    const d = Math.sqrt(Math.pow(i * step - px, 2) + Math.pow(j * step - py, 2));
                    if (nearest === null || d < nearest) nearest = d;
                    if (d <= radius && seen[idx]) reachable = true;
                }
            }
            return { name, radius, nearest: nearest === null ? null : Math.round(nearest), reachable };
        });
    }

    const qinglanPoints = [
        ['玩家出生点', 448, 1376, 0],
        ['NPC 祁伯', 1872, 1008, 60], ['NPC 柳婶', 2400, 915, 60], ['NPC 阿砚', 1840, 1328, 60],
        ['NPC 周叔（被困）', 1572, 119, 60], ['阿禾救助点', 1872, 1328, 60],
        ['阿禾码头', 2608, 1424, 60], ['周叔获救点', 2300, 1160, 60],
        ['镇风桩一', 2005, 190, 56], ['镇风桩二', 2644, 163, 56], ['镇风桩三', 3014, 150, 56],
        ['破损运灯箱', 2890, 35, 64], ['归乡牌', 350, 1200, 40], ['空魂灯', 2890, 104, 48],
        ['阵核', 2866, 286, 44], ['名册匣', 3026, 286, 44], ['采药路标', 843, 368, 60],
        ['登船路标', 2566, 1419, 56], ['山口法阵', 2959, 270, 76],
    ];
    // 教学四标记取自单一数据源（TrainingManager.BASIC_TRAINING_LAYOUT），检测半径见构造处 40
    for (const zone of TrainingManager.BASIC_TRAINING_LAYOUT) {
        qinglanPoints.push(['教学·' + zone.name, zone.position.x, zone.position.y, 40]);
    }

    const areaNew = scanArea(boxNew, 448, 1376, 4);
    const areaLegacy = scanArea(boxLegacy, 448, 1376, 4);
    const flatTable = qinglanTable ? qinglanTable.join('') : '';
    results.qinglanCollision = {
        map: { tileSize: qinglanCfg.tileSize, mapWidth: qinglanCfg.mapWidth, mapHeight: qinglanCfg.mapHeight },
        table: qinglanTable ? {
            rows: qinglanTable.length,
            cols: qinglanTable.map(row => row.length),
            chars: Array.from(new Set(flatTable.split(''))).sort(),
            walkable: flatTable.split('').filter(c => c === '.').length,
            blocked: flatTable.split('').filter(c => c === '#').length,
            spawnTileWalkable: qinglanTable[43][14] === '.',
            // 房屋墙体采样：祁伯住处（瓦片 48..53 × 28..31）整块必须是阻挡。
            // 2026-09-12 重绘 collision.png 后，原先采样的单点 (52,33) 已改成通行（屋前空地被让开），
            // 单点采样过脆 → 改为“整块墙体”判定，同时保留该点的实际取值便于排查
            houseWallBlocked: (function () {
                for (let y = 28; y <= 31; y++) {
                    for (let x = 48; x <= 53; x++) {
                        if (qinglanTable[y][x] !== '#') return false;
                    }
                }
                return true;
            })(),
            houseFrontTileWalkable: qinglanTable[33][52] === '.',
            qiboTileWalkable: qinglanTable[31][58] === '.',
            outerFrameBlocked: qinglanTable[58].indexOf('.') === -1
                && qinglanTable.every(row => row[0] === '#' && row[104] === '#'),
        } : null,
        // 真实 TileSystem / GameMap：碰撞图缺失时按 collisionData 建表
        viaRealCode: {
            spawnWalkable: qinglanMap.isPositionWalkable(448, 1376),
            // 房屋墙体瓦片 (52,30) → 世界坐标 (52×32+16, 30×32+16)
            houseBlocked: qinglanMap.isPositionWalkable(52 * 32 + 16, 30 * 32 + 16) === false,
            rectAtSpawnWalkable: qinglanMap.isRectWalkable(qinglanPlayer.getCollisionRect(448, 1376)),
            gridShape: (function () {
                const g = qinglanMap.tileSystem.getWalkableGrid();
                let walkable = 0;
                for (const row of g) for (const v of row) if (v) walkable++;
                return { rows: g.length, cols: g[0] ? g[0].length : 0, walkable };
            })(),
        },
        playerBox: {
            collisionWidth: qinglanPlayer.collisionWidth,
            collisionHeight: qinglanPlayer.collisionHeight,
            drawWidth: qinglanPlayer.width,
            drawHeight: qinglanPlayer.height,
            rect: qinglanPlayer.getCollisionRect(448, 1376),
            rectDefault: qinglanPlayer.getCollisionRect(),
        },
        reach: {
            box: boxNew,
            step: areaNew.step,
            standable: areaNew.standable,
            reachable: areaNew.reachable,
            fraction: areaNew.reachable / Math.max(1, areaNew.standable),
            points: probePoints(areaNew, qinglanPoints),
        },
        reachLegacy: {
            box: boxLegacy,
            standable: areaLegacy.standable,
            reachable: areaLegacy.reachable,
            fraction: areaLegacy.reachable / Math.max(1, areaLegacy.standable),
            unreachable: probePoints(areaLegacy, qinglanPoints)
                .filter(p => !p.reachable).map(p => p.name),
        },
    };

    // ============ 世界地图（M 键 + 前两章传送按钮 + 频繁传送） ============
    // ---- 1) 世界地图配置：只保留前两章的传送按钮，且两个按钮都已解锁 ----
    const worldMapConfig = gameConfig.getMap('worldMap');
    const wmButtons = (worldMapConfig && worldMapConfig.buttons) || [];
    results.worldMap = {
        ids: wmButtons.map(b => b.id),
        targets: wmButtons.map(b => b.targetMap),
        unlocked: wmButtons.map(b => b.unlocked !== false),
        zhaochenRegistered: !!gameConfig.getMap('zhaochen_xiancheng'),
        wuxiangRegistered: !!gameConfig.getMap('wuxiang_tianque'),
    };

    // ---- 2) 频繁传送：另一张地图静默（不更新 / 不渲染），但实例与资源不释放 ----
    chapterLoader.registerChapter(Chapter2Config.getAll());   // 云渡泽（本章测试用到的第二张地图）
    const rm = ResourceManager.getInstance();
    const savedLoadImage = rm.loadImage;
    // 碰撞图返回 null → TileSystem 走地图配置里的 collisionData（测试环境不读像素）
    rm.loadImage = async (key) => (String(key).indexOf('mapCollisions.') === 0 ? null : { width: 1, height: 1 });

    const mm = new MapManager();
    const qinglanFirst = await mm.switchMap('qinglan_fuye');
    const qinglanActiveWhileCurrent = qinglanFirst ? qinglanFirst.isActive === true : null;
    const yunduzeFirst = await mm.switchMap('yunduze');
    const yunduzeActiveWhileCurrent = yunduzeFirst ? yunduzeFirst.isActive === true : null;
    const qinglanSilentWhenOther = qinglanFirst ? qinglanFirst.isActive === false : null;

    // 静默校验：非活动地图的 render 必须一个绘制调用都不产生
    // （用 Proxy 代理 ctx —— 只要代码碰了 ctx 任何属性就会被计数）
    let silentMapDraws = 0;
    const silentCtxProbe = new Proxy({}, { get: () => (() => { silentMapDraws++; }) });
    if (qinglanFirst) {
        qinglanFirst.render(silentCtxProbe, { x: 0, y: 0, width: 1280, height: 720 });
    }

    const qinglanAgain = await mm.switchMap('qinglan_fuye');
    results.fastTravel = {
        instanceCount: mm.maps.size,
        qinglanActiveWhileCurrent: qinglanActiveWhileCurrent,
        yunduzeActiveWhileCurrent: yunduzeActiveWhileCurrent,
        qinglanSilentWhenOther: qinglanSilentWhenOther,
        yunduzeSilentAfterLeaving: yunduzeFirst ? yunduzeFirst.isActive === false : null,
        silentMapDraws: silentMapDraws,
        sameInstanceReused: qinglanAgain === qinglanFirst && mm.getMap('yunduze') === yunduzeFirst,
        currentMapId: mm.currentMap ? mm.currentMap.mapId : null,
    };
    // ---- 3) 世界地图传送落点：固定坐标必须可站（真实 GameMap + Player 24×24 碰撞盒） ----
    const spawnTable = main.worldMapSpawnPoints || {};
    const spawnProbePlayer = new Player({ position: { x: 0, y: 0 } });
    results.worldMapSpawn = {};
    for (const mapId of ['qinglan_fuye', 'yunduze']) {
        const mapInst = mm.getMap(mapId);
        const sp = spawnTable[mapId] || null;
        results.worldMapSpawn[mapId] = {
            spawn: sp,
            hasMap: !!mapInst,
            tile: mapInst && sp ? mapInst.worldToTile(sp.x, sp.y) : null,
            // 四角判定与 Player.checkCollision 完全一致
            standable: !!(mapInst && sp
                && mapInst.isRectWalkable(spawnProbePlayer.getCollisionRect(sp.x, sp.y))),
            insideBounds: !!(mapInst && sp
                && sp.x > 0 && sp.y > 0
                && sp.x < mapInst.mapWidth * mapInst.tileSize
                && sp.y < mapInst.mapHeight * mapInst.tileSize),
        };
    }

    // ---- 4) 任务栏（QuestUI）排版：标题在 padding.top 基础上再下移 20px + 每行最多 280px 自动换行 ----
    results.questUILayout = (() => {
        const CHAR_PX = 20;      // 桩字体：每字 20px（280px → 14 字/行），便于精确断言换行位置
        const drawn = [];
        const ctx = {
            fillText(text, x, y) {
                drawn.push({ text: String(text), x: x, y: y, width: String(text).length * CHAR_PX });
            },
            strokeText(text, x, y) {
                drawn.push({ text: String(text), x: x, y: y, width: String(text).length * CHAR_PX });
            },
            measureText: t => ({ width: String(t).length * CHAR_PX }),
            save() {}, restore() {}, fillRect() {}, strokeRect() {}, drawImage() {},
            createLinearGradient: () => ({ addColorStop() {} }),
            createRadialGradient: () => ({ addColorStop() {} }),
        };
        // 超长标题 / 超长描述 / 超长目标：三者都必须按 280px 换行
        const longQuest = {
            type: 'side',
            order: 1,
            title: '主线标题很长很长很长很长很长很长很长很长很长',
            description: '这是一段很长的任务描述文字用来验证每行最多四百像素之后会自动换行',
        };
        const savedGetInstance = GameConfig.getInstance;
        GameConfig.getInstance = () => ({ getQuest: id => (id === 'smoke_quest_ui' ? longQuest : null) });
        const ui = new QuestUI({ x: 400, y: 120, width: 480, height: 480 });
        ui.setQuestSystem({
            getCompletedQuests: () => new Map([['smoke_quest_ui', {
                objectives: [{ description: longQuest.description, progress: 1, count: 1, completed: true }],
            }]]),
            getActiveQuests: () => new Map(),
        });
        ui.show();
        ui.render(ctx);
        GameConfig.getInstance = savedGetInstance;

        const titleLine = drawn.find(item => item.text === '任  务  记  录') || null;
        const leftX = ui.x + ui.padding.left + 90;
        // 「按 Q 或 ESC 关闭」是面板右下角右对齐的关闭提示（x = 面板右内边距），
        // 不属于 280px 的文字块，比较右边界时排除它
        const CLOSE_HINT = '按 Q 或 ESC 关闭';
        return {
            maxLineWidth: ui.maxLineWidth,
            titleOffsetY: ui.titleOffsetY,
            continuationIndent: ui.continuationIndent,
            title: titleLine,
            leftX: leftX,
            lineHeight: ui.lineHeight,
            lineCount: drawn.length,
            maxWidth: drawn.reduce((m, item) => Math.max(m, item.width), 0),
            overLimit: drawn.filter(item => item.width > ui.maxLineWidth).map(item => item.text),
            overflowRight: drawn
                .filter(item => item.text !== CLOSE_HINT && item.x > leftX + ui.maxLineWidth + 0.01)
                .map(item => item.text),
            indentedContinuations: drawn.filter(item => item.x === leftX + ui.continuationIndent).length,
            closeHint: drawn.find(item => item.text === CLOSE_HINT) || null,
            lines: drawn.map(item => ({ text: item.text, x: item.x, y: item.y })),
        };
    })();

    // ---- 5) 开始界面：取消全部程序化绘制，改为整屏背景图 + 居中开始按钮图 ----
    //       js/MainMenuScene.js 只贴两张图：ui.start_screen（1280×720）与 ui.start_button（400×112，居中）
    results.startScreen = (() => {
        const makeRecorder = () => {
            const rec = { images: [], texts: [], rects: [] };
            rec.ctx = {
                drawImage: (...a) => rec.images.push(a),
                fillText: t => rec.texts.push(t),
                strokeText: t => rec.texts.push(t),
                fillRect: (...a) => rec.rects.push(a),
                strokeRect: (...a) => rec.rects.push(a),
                measureText: t => ({ width: String(t).length * 8 }),
                save() {}, restore() {}, beginPath() {}, stroke() {}, fill() {},
                createLinearGradient: () => ({ addColorStop() {} }),
                createRadialGradient: () => ({ addColorStop() {} }),
            };
            return rec;
        };

        // 真实美术（文件路径 + 规定尺寸）与 ResourceManager 缺图占位图（dataURL 32×32）
        const screenImage = { src: 'assets/images/ui/start_screen.png', width: 1280, height: 720 };
        const buttonImage = { src: 'assets/images/ui/start_button.png', width: 400, height: 112 };
        const placeholder = { src: 'data:image/png;base64,iVBORw0KGgo=', width: 32, height: 32 };

        const makeMain = (cache) => {
            const switches = [];
            const mainStub = {
                canvas: { width: 1280, height: 720, style: {} },
                resourceManager: { getCachedImage: key => cache[key] || null },
                sceneManager: { switchScene: id => switches.push(id) },
            };
            return { mainStub: mainStub, switches: switches };
        };

        const withArtSet = makeMain({ 'ui.start_screen': screenImage, 'ui.start_button': buttonImage });
        const scene = new MainMenuScene(withArtSet.mainStub);
        scene.enter();
        const artRec = makeRecorder();
        scene.render(artRec.ctx);

        // 悬停按钮 → 手型光标（只切 DOM 光标，不绘制任何图形）
        scene.update(0.016, { mouseX: 640, mouseY: 360, mouseClicked: false, pressedKeys: {} });
        const cursorWhenHover = withArtSet.mainStub.canvas.style.cursor;
        scene.update(0.016, { mouseX: 10, mouseY: 10, mouseClicked: false, pressedKeys: {} });
        const cursorAfterLeave = withArtSet.mainStub.canvas.style.cursor;

        // 点击按钮正中 → 开始游戏
        scene.update(0.016, { mouseX: 640, mouseY: 360, mouseClicked: true, pressedKeys: { j: true } });
        const startedByInsideClick = withArtSet.switches.slice();
        scene.update(0.016, { mouseX: 640, mouseY: 360, mouseClicked: true, pressedKeys: {} });
        const switchesAfterRepeatClick = withArtSet.switches.slice();

        // 按钮外点击 / 只按键盘 → 都不开始（旧版是“键盘任意键 + 画面任意处点击”）
        const outsideSet = makeMain({ 'ui.start_screen': screenImage, 'ui.start_button': buttonImage });
        const sceneOutside = new MainMenuScene(outsideSet.mainStub);
        sceneOutside.enter();
        sceneOutside.update(0.016, { mouseX: 100, mouseY: 100, mouseClicked: true, pressedKeys: {} });
        sceneOutside.update(0.016, { mouseX: 640, mouseY: 360, mouseClicked: false, pressedKeys: { j: true } });
        sceneOutside.update(0.016, { mouseX: 0, mouseY: 0, mouseClicked: false, pressedKeys: { enter: true } });
        const ignoredOutside = outsideSet.switches.slice();

        // 缺图（dataURL 占位图）→ 只铺底色，不画品红占位块、不写字
        const noArtSet = makeMain({ 'ui.start_screen': placeholder, 'ui.start_button': placeholder });
        const sceneNoArt = new MainMenuScene(noArtSet.mainStub);
        sceneNoArt.enter();
        const noArtRec = makeRecorder();
        sceneNoArt.render(noArtRec.ctx);

        // 资源登记 / 预加载分组
        const rm = ResourceManager.getInstance();

        return {
            keys: { background: scene.backgroundKey, button: scene.buttonKey },
            resourcePaths: {
                background: rm.getImagePath('ui.start_screen'),
                button: rm.getImagePath('ui.start_button'),
            },
            pathsInPreloadGroup: rm.getResourceGroupImagePaths
                ? rm.getResourceGroupImagePaths('mainMenu')
                : [],
            hasImages: !!scene.backgroundImage && !!scene.buttonImage,
            buttonRect: {
                x: scene.buttonX, y: scene.buttonY,
                width: scene.buttonWidth, height: scene.buttonHeight,
            },
            insideRect: scene.containsButtonPoint(640, 360)
                && scene.containsButtonPoint(440, 304)
                && scene.containsButtonPoint(840, 416),
            outsideRect: !scene.containsButtonPoint(439, 303) && !scene.containsButtonPoint(841, 417),
            artRender: {
                imageCount: artRec.images.length,
                backgroundTargetIsScreenImage: !!artRec.images[0] && artRec.images[0][0] === screenImage,
                backgroundRect: artRec.images[0] ? artRec.images[0].slice(1) : null,
                buttonTargetIsButtonImage: !!artRec.images[1] && artRec.images[1][0] === buttonImage,
                buttonRect: artRec.images[1] ? artRec.images[1].slice(1) : null,
                textCount: artRec.texts.length,
                rectCount: artRec.rects.length,
            },
            noArtRender: {
                imageCount: noArtRec.images.length,
                rectCount: noArtRec.rects.length,
                textCount: noArtRec.texts.length,
            },
            startedByInsideClick: startedByInsideClick,
            switchesAfterRepeatClick: switchesAfterRepeatClick,
            ignoredOutside: ignoredOutside,
            cursorWhenHover: cursorWhenHover,
            cursorAfterLeave: cursorAfterLeave,
            placeholderIsDataUrl: String(placeholder.src).startsWith('data:'),
            sceneNoArtImages: { background: sceneNoArt.backgroundImage, button: sceneNoArt.buttonImage },
        };
    })();

    rm.loadImage = savedLoadImage;

    // ---- 6) 游戏完结界面（章末二登船后的滚动字幕）----
    //      js/EndingText.js（字幕文案，由 tools/generate_ending_text.py 生成）
    //      js/EndingScene.js（从屏幕底部逐行上滚 / 每行居中 / 末行滚出后提示 / 任意键返回世界地图）
    results.gameEnding = (() => {
        const lines = EndingText.getLines();
        const limit = EndingText.getLineLimit();

        // 录制画布：记录落到画布上的每一段文字，用于校验「水平居中 / 提示出现在屏幕正中」
        const makeRecordingCtx = () => {
            const rec = { texts: [] };
            rec.ctx = new Proxy({
                canvas: { width: 1280, height: 720 },
                measureText: (t) => ({ width: String(t).length * 8 }),
                fillText: (t, x, y) => rec.texts.push({ text: t, x: x, y: y }),
                createLinearGradient: () => ({ addColorStop() {} }),
                createRadialGradient: () => ({ addColorStop() {} }),
            }, {
                get: (target, prop) => (prop in target ? target[prop] : () => {}),
                set: (target, prop, value) => { target[prop] = value; return true; },
            });
            return rec;
        };
        const emptyInput = { pressedKeys: {}, keys: {}, mouseX: 0, mouseY: 0, mouseClicked: false };

        // ---- 6.1 完结界面的键盘屏蔽（Main.handleKeyDown 对 'ending' 场景直接 return）----
        const switches = [];
        main.sceneManager = {
            getCurrentScene: () => ({ sceneId: 'ending' }),
            switchScene: (id) => switches.push(id),
        };
        main.mapTeleport.isVisible = false;
        const questCallsBefore = questUICalls.length;
        const mapCallsBefore = mapTeleportCalls.length;
        main.handleKeyDown('q', {});
        main.handleKeyDown('m', {});
        main.handleKeyDown('escape', {});
        main.handleKeyDown('f2', {});
        const keyboardSwallowed = questUICalls.length === questCallsBefore
            && mapTeleportCalls.length === mapCallsBefore;

        // ---- 6.2 滚动：整段从屏幕底部进入 → 逐行上滚 ----
        const scene = new EndingScene(main);
        scene.enter({ speed: 20000 });   // 回归速度：整段 ≈ 0.83 秒
        const enterState = {
            offset: scene.scrollOffset,
            finished: scene.isFinished === true,
            movementBlocked: main.inputManager.getInputState().movementBlocked === true,
            inputBlocked: main.inputManager.inputBlocked === true,
        };
        const beforeFinishRec = makeRecordingCtx();
        scene.render(beforeFinishRec.ctx);
        const promptBeforeFinish = beforeFinishRec.texts.filter(t => t.text === scene.promptText).length;

        // 播放中按任意键 / 点鼠标都不退出（不能跳过字幕）
        scene.update(0.02, { pressedKeys: { j: true }, keys: { j: true }, mouseClicked: true });
        const switchesWhileScrolling = switches.slice();

        // 行距恒定（空行同样占位）+ 同一行随时间上移
        const firstLineYBefore = scene.getLineY(0);
        const linePitch = [scene.getLineY(1) - scene.getLineY(0), scene.getLineY(2) - scene.getLineY(1)];
        scene.update(0.05, emptyInput);
        const firstLineDelta = firstLineYBefore - scene.getLineY(0);

        // 屏幕中段的字幕：录制每行的绘制 x，校验「每行水平居中」
        // （逐字绘制 → 先按 y 分组成整行；行宽 = 字数 × 8 + 6px 字距 × (字数 - 1)，
        //   居中后首字 x = (1280 - 行宽) / 2）
        const groupByLine = (list) => {
            const map = {};
            for (const item of list) {
                const key = String(item.y);
                if (!map[key]) map[key] = [];
                map[key].push(item);
            }
            return Object.keys(map).map(k => ({ y: Number(k), chars: map[k] }));
        };
        const midRec = makeRecordingCtx();
        scene.render(midRec.ctx);
        const midGroups = groupByLine(midRec.texts.filter(t => t.text !== scene.promptText));
        const midCenteredCount = midGroups.filter(g => {
            const lineText = g.chars.map(t => t.text).join('');
            const width = lineText.length * 8 + 6 * Math.max(0, lineText.length - 1);
            return Math.abs(g.chars[0].x - (1280 - width) / 2) < 0.001;
        }).length;

        // 一直播到整段滚完（最后一行完全滚出屏幕上方）
        let guard = 0;
        let elapsed = 0;
        while (!scene.isFinished && guard++ < 400) {
            scene.update(0.05, emptyInput);
            elapsed += 0.05;
        }
        const finishedState = {
            finished: scene.isFinished === true,
            elapsed: Number(elapsed.toFixed(2)),
            lastLineY: Number(scene.getLineY(lines.length - 1).toFixed(2)),
            noSwitchYet: switches.length === switchesWhileScrolling.length,
        };

        // ---- 6.3 提示：屏幕正中「按任意键返回游戏」；最后一行已滚出屏幕 ----
        scene.update(0.5, emptyInput);   // 提示淡入
        const promptRec = makeRecordingCtx();
        scene.render(promptRec.ctx);
        const promptDraws = promptRec.texts.filter(t => t.text === scene.promptText);
        const drawnLines = promptRec.texts.filter(t => t.text !== scene.promptText);

        // ---- 6.4 任意键退出：记标记 + 打开世界地图 + 切回 gameWorld ----
        const mapCallsBeforeExit = mapTeleportCalls.length;
        scene.update(0.016, { pressedKeys: { escape: true }, keys: {}, mouseClicked: false });
        const keyExit = {
            dismissed: scene.isDismissed === true,
            switches: switches.slice(),
            flag: qsMain.hasStoryFlag('game_ending_seen'),
            mapShown: mapTeleportCalls.slice(mapCallsBeforeExit).join(','),
            mapVisible: main.mapTeleport.isVisible === true,
        };
        scene.exit();
        const afterExit = {
            movementBlocked: main.inputManager.getInputState().movementBlocked === true,
            inputBlocked: main.inputManager.inputBlocked === true,
            interacting: main.player.isInteracting === true,
        };

        // ---- 6.5 鼠标任意键同样可退出（新开一个场景从头播到提示）----
        switches.length = 0;
        const sceneMouse = new EndingScene(main);
        sceneMouse.enter({ speed: 20000 });
        let mouseGuard = 0;
        while (!sceneMouse.isFinished && mouseGuard++ < 400) sceneMouse.update(0.05, emptyInput);
        sceneMouse.update(0.5, emptyInput);
        const switchesBeforeMouse = switches.length;
        sceneMouse.update(0.016, { pressedKeys: {}, keys: {}, mouseClicked: true });
        const mouseExit = {
            switchesBefore: switchesBeforeMouse,
            switches: switches.slice(),
            dismissed: sceneMouse.isDismissed === true,
        };
        sceneMouse.exit();

        // ---- 6.7 背景底图（可选美术 ui.ending_bg）：有图 → 整屏贴图铺底；
        //      缺图 / 空图 / ResourceManager 的 dataURL 品红占位图 → 一张图都不画，
        //      改回程序化「深墨渐变 + 渡口暖光晕」兜底（约定与 MainMenuScene / Signpost 一致）。
        //      两种情况下浮尘与暗角都照常叠加，故「缺图」比「有图」正好多画 2 个垫底矩形。
        const makeBackdropRecorder = () => {
            const rec = { images: [], rects: [] };
            rec.ctx = {
                drawImage: (...a) => rec.images.push(a),
                fillRect: (...a) => rec.rects.push(a),
                strokeRect: (...a) => rec.rects.push(a),
                fillText() {}, strokeText() {},
                measureText: t => ({ width: String(t).length * 8 }),
                save() {}, restore() {}, beginPath() {}, stroke() {}, fill() {},
                createLinearGradient: () => ({ addColorStop() {} }),
                createRadialGradient: () => ({ addColorStop() {} }),
            };
            return rec;
        };
        const endingBgImage = { src: 'assets/images/ui/ending_bg.png', width: 1280, height: 720 };
        const endingBgPlaceholder = { src: 'data:image/png;base64,iVBORw0KGgo=', width: 32, height: 32 };
        const backdropRm = ResourceManager.getInstance();
        const savedResourceManager = main.resourceManager;
        const renderBackdrop = (image) => {
            main.resourceManager = { getCachedImage: key => (key === 'ui.ending_bg' ? image : null) };
            const probe = new EndingScene(main);
            probe.enter({ speed: 20000 });
            const rec = makeBackdropRecorder();
            probe.render(rec.ctx);
            probe.exit();
            return { probe: probe, rec: rec };
        };
        const artBackdrop = renderBackdrop(endingBgImage);
        const placeholderBackdrop = renderBackdrop(endingBgPlaceholder);
        const missingBackdrop = renderBackdrop(null);
        main.resourceManager = savedResourceManager;
        const backdrop = {
            key: artBackdrop.probe.backgroundKey,
            resourcePath: backdropRm.getImagePath('ui.ending_bg'),
            groupPaths: typeof backdropRm.getResourceGroupImagePaths === 'function'
                ? backdropRm.getResourceGroupImagePaths('ending')
                : [],
            loadedWithArt: !!artBackdrop.probe.backgroundImage,
            artImageCount: artBackdrop.rec.images.length,
            artDraw: artBackdrop.rec.images.length ? artBackdrop.rec.images[0].slice(1) : null,
            artRectCount: artBackdrop.rec.rects.length,
            loadedWithPlaceholder: !!placeholderBackdrop.probe.backgroundImage,
            placeholderImageCount: placeholderBackdrop.rec.images.length,
            placeholderRectCount: placeholderBackdrop.rec.rects.length,
            loadedWithNothing: !!missingBackdrop.probe.backgroundImage,
            missingImageCount: missingBackdrop.rec.images.length,
            missingRectCount: missingBackdrop.rec.rects.length,
        };

        // ---- 6.6 登船接入：首次 → 完结界面；完结之后再登船 → 直接世界地图 ----
        // 任务系统换成记录桩：只关心「哪些目标被推进 / 写了哪些剧情标记」，不依赖第二章任务是否注册
        const savedQuestSystem = main.player.questSystem;
        const flags = {};
        const progressCalls = [];
        main.player.questSystem = {
            hasStoryFlag: (f) => !!flags[f],
            setStoryFlag: (f, v) => { flags[f] = (v === undefined ? true : v); },
            updateQuestProgress: (q, t, tg, c) => { progressCalls.push([q, t, tg, c].join('|')); },
        };
        const savedPlayDialogueText = main.playDialogueText;
        const savedPlayStoryDialogue = main.playStoryDialogue;
        // sailToZhaochen 会读 this.gameConfig.getMap('zhaochen_xiancheng') 判定第三图是否开放
        main.gameConfig = main.gameConfig || GameConfig.getInstance();
        const storyCalls = [];
        // 对白桩：立刻回调，等同玩家读完（S02 → sailToZhaochen → S03 → 结算 → 完结界面）
        // 回调可能返回 Promise（sailToZhaochen 是 async），失败时记进 storyCalls 便于定位
        const runCallback = (onDone, tag) => {
            if (!onDone) return;
            try {
                const p = onDone();
                if (p && typeof p.catch === 'function') p.catch(e => storyCalls.push('ERROR:' + e.message));
            } catch (e) {
                storyCalls.push('ERROR:' + e.message);
            }
        };
        main.playDialogueText = (text, speaker, onDone) => {
            storyCalls.push('s02_berth');
            runCallback(onDone);
            return true;
        };
        main.playStoryDialogue = (id, speaker, onDone) => {
            storyCalls.push(id);
            runCallback(onDone);
            return true;
        };

        switches.length = 0;
        main.mapTeleport.isVisible = false;
        main.chapter2Boarding = false;
        main.boardZhaochenBoat();          // 首次登船
        const firstBoard = {
            storyCalls: storyCalls.slice(),
            switches: switches.slice(),
            progressCalls: progressCalls.slice(),
            boardingDone: !!flags['chapter2_boarding_done'],
            endingSeen: !!flags['game_ending_seen'],
            mapVisible: main.mapTeleport.isVisible === true,
        };

        // 玩家在完结界面按任意键（= Main.finishGameEnding）之后再登船：
        // 不再重播章末对白与完结字幕，直接打开世界地图
        main.finishGameEnding();
        storyCalls.length = 0;
        switches.length = 0;
        const mapCallsBeforeReboard = mapTeleportCalls.length;
        main.mapTeleport.isVisible = false;
        main.boardZhaochenBoat();          // 再次登船
        const reboard = {
            storyCalls: storyCalls.slice(),
            switches: switches.slice(),
            mapShown: mapTeleportCalls.slice(mapCallsBeforeReboard).join(','),
            mapVisible: main.mapTeleport.isVisible === true,
        };

        main.playDialogueText = savedPlayDialogueText;
        main.playStoryDialogue = savedPlayStoryDialogue;
        main.player.questSystem = savedQuestSystem;

        const blankLineIndices = lines.map((l, i) => (l.trim() ? -1 : i)).filter(i => i >= 0);

        return {
            keyboardSwallowed: keyboardSwallowed, enterState: enterState,
            promptBeforeFinish: promptBeforeFinish, switchesWhileScrolling: switchesWhileScrolling,
            linePitch: linePitch, firstLineDelta: firstLineDelta, finishedState: finishedState,
            promptDraws: promptDraws, drawnLineCount: drawnLines.length,
            blankLineDrawn: promptRec.texts.some(t => t.text === ''),
            keyExit: keyExit, afterExit: afterExit, mouseExit: mouseExit,
            midLineCount: midGroups.length,
            midCenteredCount: midCenteredCount,
            durationAtDefaultSpeed: Number(((scene.canvasHeight + scene.getTotalHeight() + scene.lineHeight)
                / scene.defaultScrollSpeed).toFixed(2)),
            sourceFile: EndingText.getSourceFile(),
            lineLimit: limit,
            lineCount: lines.length,
            blankLineCount: blankLineIndices.length,
            maxLineLength: Math.max.apply(null, lines.map(l => l.length)),
            overLimit: lines.filter(l => l.length > limit),
            firstLine: lines[0],
            lastLine: lines[lines.length - 1],
            firstBlankIndex: blankLineIndices.length ? blankLineIndices[0] : -1,
            canvas: { width: scene.canvasWidth, height: scene.canvasHeight },
            lineHeight: scene.lineHeight,
            fontSize: scene.fontSize,
            letterSpacing: scene.letterSpacing,
            textFont: scene.textFont,
            totalHeight: scene.getTotalHeight(),
            defaultSpeed: scene.defaultScrollSpeed,
            promptText: scene.promptText,
            firstBoard: firstBoard,
            reboard: reboard,
            backdrop: backdrop };
    })();

    return results;
})();


