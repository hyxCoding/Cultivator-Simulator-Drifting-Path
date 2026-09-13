/*
 * 第二章（云渡泽）冒烟测试的“场景脚本”（由 tools/smoke_chapter2.js 读取后
 * 用 vm.runInContext 在与游戏脚本相同的全局词法环境中执行）。
 * 返回 JSON 字符串：断言在 smoke_chapter2.js 中。
 */
(async function () {
    const R = {};
    // 音频节流时钟：AudioManager 现在对「同一种音效」设了最小间隔（SFX_MIN_INTERVAL = 0.2 秒，
    // 防同一帧被播两次 / 连点重复出声）。冒烟测试里所有帧、所有点击都在同一瞬间跑完，
    // 若用真实时钟，第二次起的同类音效都会被节流掉，既有断言（例如音效池上限）就测不到了 ——
    // 这里注入一个「每次取时间 +1 秒」的时钟，让重复播放永远被时间隔开；
    // 节流规则本身在 14.2 用固定时钟单独验证（见 R.audio.play.throttle*）。
    let audioClockMs = 0;
    AudioManager.prototype._now = function () { audioClockMs += 1000; return audioClockMs; };

    const gameConfig = GameConfig.getInstance();
    chapterLoader.registerChapter(Chapter1Config.getAll());
    chapterLoader.registerChapter(Chapter2Config.getAll());

    const C2 = Chapter2Config.getQuestConfigs();
    const C2_NPC = Chapter2Config.getNPCConfigs();
    const C2_MAP = Chapter2Config.getMapConfigs();
    const CHAIN = ['chapter2_main_1', 'chapter2_main_2', 'chapter2_main_3',
        'chapter2_main_4', 'chapter2_ending_1', 'chapter2_ending_2'];

    const qs = new QuestSystem();
    qs.registerAllQuests();
    R.chain = {
        ids: CHAIN.map(id => (qs.quests.has(id) ? id : null)),
        titles: CHAIN.map(id => (gameConfig.getQuest(id) || {}).title || null),
        prereq: CHAIN.map(id => (gameConfig.getQuest(id) || {}).prerequisites),
        next: CHAIN.map(id => (gameConfig.getQuest(id) || {}).nextQuest),
        orders: CHAIN.map(id => (gameConfig.getQuest(id) || {}).order),
        objectives: CHAIN.map(id => (gameConfig.getQuest(id) || {}).objectives || []),
        // 新平衡：任务不再发奖 → 每条任务的 rewards 字段应已移除（rewardKeys 全为 0）
        rewardKeys: CHAIN.map(id => {
            const quest = gameConfig.getQuest(id) || {};
            return quest.rewards ? Object.keys(quest.rewards).length : 0;
        }),
    };

    // ---- 严格顺序：前置未完成不能接取；目标不能跳步 ----
    function finish(system, questId) {
        const state = system.getQuestState(questId);
        // 任务可能已经处于 active（测试里先接取再推进目标）→ 不重复接取
        if (!state || state.state === 'locked') {
            if (!system.acceptQuest(questId)) return false;
        } else if (state.state !== 'active') {
            return state.state === 'completed';
        }
        let guard = 0;
        while (system.isQuestActive(questId) && guard++ < 40) {
            const obj = system.getCurrentObjective(questId);
            if (!obj) break;
            system.updateQuestProgress(questId, obj.type, obj.target, obj.count || 1);
        }
        return system.isQuestCompleted(questId);
    }
    function chapter1Done() {
        const system = new QuestSystem();
        system.registerAllQuests();
        ['chapter1_main_1', 'chapter1_main_2', 'chapter1_main_3', 'chapter1_main_4',
            'chapter1_ending_1', 'chapter1_ending_2', 'chapter1_ending_3']
            .forEach(id => finish(system, id));
        return system;
    }

    R.order = {};
    const s0 = new QuestSystem();
    s0.registerAllQuests();
    R.order.acceptBeforeChapter1 = s0.acceptQuest('chapter2_main_1');   // 应为 true：章首无跨章前置（策划案 M01=初到云渡泽）
    R.order.acceptAhead = s0.acceptQuest('chapter2_main_3');           // 应为 false
    const s1 = chapter1Done();
    R.order.acceptMain1 = s1.acceptQuest('chapter2_main_1');
    s1.updateQuestProgress('chapter2_main_1', 'complete_training', 'sword', 1);  // 跳步应无效
    const cur = s1.getCurrentObjective('chapter2_main_1') || {};
    R.order.afterSkip = { type: cur.type, target: cur.target, progress: cur.progress };
    R.order.acceptMain2Early = s1.acceptQuest('chapter2_main_2');       // 应为 false
    R.order.fullChain = CHAIN.map(id => [id, finish(s1, id)]);

    // ---- NPC：跨章深合并 + 对白完整性 ----
    const ahe = gameConfig.getNPCConfig('ahe') || {};
    R.npc = {
        ahe: {
            ch1Dialogue: !!(ahe.dialogues && ahe.dialogues.first_meet),
            ch2Dialogue: !!(ahe.dialogues && ahe.dialogues.c2_a01_arrive),
            idleFrameWidth: ahe.baseAnimations && ahe.baseAnimations.idle ? ahe.baseAnimations.idle.frameWidth : null,
            shopItems: (ahe.shopItems || []).length,
            extraAnimations: (ahe.extraAnimations || []).map(a => a.name),
            movePositionKeys: Object.keys(ahe.movePositions || {}).sort(),
        },
        // [id, 名字, 单帧宽, 单帧高, 对白数, 排列模式, 各方向列/行下标, 各方向帧数, 额外动画名, displayScale]
        // 排列模式：'column' = 4 列（下/左/右/上，每列 1 帧）；'row' = 单帧（四方向共用第 0 行）
        newNpcs: ['luzhou', 'jiangpo', 'jiangwan', 'chenli', 'xulu'].map(id => {
            const cfg = gameConfig.getNPCConfig(id) || {};
            const idle = (cfg.baseAnimations && cfg.baseAnimations.idle) || {};
            const facings = ['down', 'left', 'right', 'up'];
            const sliceOf = (dir) => {
                const d = (idle.directions && idle.directions[dir]) || {};
                if (d.col !== undefined) return d.col;
                if (d.row !== undefined) return d.row;
                return -1;
            };
            return [id, cfg.name || null, idle.frameWidth || null, idle.frameHeight || null,
                Object.keys(cfg.dialogues || {}).length,
                idle.directionMode || null,
                facings.map(sliceOf).join(','),
                facings.map(dir => {
                    const d = (idle.directions && idle.directions[dir]) || {};
                    return d.frames || 0;
                }).join(','),
                (cfg.extraAnimations || []).map(a => a.name).join(','),
                cfg.displayScale === undefined ? null : cfg.displayScale];
        }),
        missingText: [],
        badId: [],
        dialogueIds: {},
        // 江婆「女儿获救后」的 idle 动画完整配置（用于冒烟断言单帧 32×64 / 资源键 / 四方向）
        jiangpoIdleAfter: (() => {
            const cfg = gameConfig.getNPCConfig('jiangpo') || {};
            return (cfg.extraAnimations || []).find(a => a.name === 'idle_after') || null;
        })(),
    };
    for (const npcId in C2_NPC) {
        const dialogues = C2_NPC[npcId].dialogues || {};
        R.npc.dialogueIds[npcId] = Object.keys(dialogues);
        for (const dlgId in dialogues) {
            if (!dialogues[dlgId].text) R.npc.missingText.push(`${npcId}.${dlgId}`);
            if (dialogues[dlgId].id !== dlgId) R.npc.badId.push(`${npcId}.${dlgId}`);
        }
    }
    // 阿禾阶段闲聊节点（主线二完成 ~ 主线四收尾的空档兜底）：有文本 + 结束选项（商店入口已下线）
    {
        const shedIdle = ((C2_NPC.ahe || {}).dialogues || {}).c2_ahe_idle_shed || {};
        R.npc.aheShedIdle = {
            hasText: !!shedIdle.text,
            text: shedIdle.text || null,
            options: (shedIdle.options || []).map(o => `${o.action || '-'}|${o.text}`),
        };
    }

    // ---- 对话选择器：按状态回放 ----
    function dlg(npcId, system) {
        const items = new QuestItemSystem();
        return Chapter2Config.getDialogueForNPC(npcId, system, items);
    }
    R.sel = {};
    const sA = chapter1Done();
    R.sel.A = [dlg('ahe', sA), dlg('luzhou', sA), dlg('xulu', sA), dlg('jiangpo', sA)];

    const sB = chapter1Done();
    sB.acceptQuest('chapter2_main_1');
    R.sel.B = [dlg('ahe', sB), dlg('xulu', sB), dlg('luzhou', sB)];
    sB.updateQuestProgress('chapter2_main_1', 'talk_to', 'xulu', 1);
    R.sel.B2 = [dlg('luzhou', sB)];
    sB.updateQuestProgress('chapter2_main_1', 'talk_to', 'luzhou', 1);
    R.sel.B3 = [dlg('luzhou', sB)];

    const sC = chapter1Done();
    finish(sC, 'chapter2_main_1');
    R.sel.C = [dlg('ahe', sC), dlg('jiangpo', sC), dlg('xulu', sC)];

    // C0：主线一目标全齐、只差向阿禾交付 → 应播交付对话 A03
    // （旧行为：交付时错误地念 A02「先找许录要登记…」，A03 成为死节点）
    const sC0 = chapter1Done();
    sC0.acceptQuest('chapter2_main_1');
    sC0.updateQuestProgress('chapter2_main_1', 'talk_to', 'xulu', 1);
    sC0.updateQuestProgress('chapter2_main_1', 'talk_to', 'luzhou', 1);
    sC0.updateQuestProgress('chapter2_main_1', 'complete_training', 'sword', 1);
    R.sel.C0 = [dlg('ahe', sC0)];

    const sD = chapter1Done();
    finish(sD, 'chapter2_main_1');
    sD.acceptQuest('chapter2_main_2');
    R.sel.D = [dlg('ahe', sD), dlg('xulu', sD), dlg('jiangpo', sD)];
    sD.updateQuestProgress('chapter2_main_2', 'talk_to', 'xulu', 1);
    R.sel.D2 = [dlg('xulu', sD)];

    // D3：主线二目标全齐、只差向江婆交付（身份核对已完成）→ 应播交付对话 J03
    // （旧行为：被「talk_to jiangpo 未完成」的 J02 抢先，交付时念的是「她过河怕…」的线索，J03 成为死节点）
    sD.updateQuestProgress('chapter2_main_2', 'investigate', 'lantern_clue', 1);
    sD.updateQuestProgress('chapter2_main_2', 'talk_to', 'ahe', 1);
    // D4：主线二进行中、陈栎线索已问出（认灯台那一步还没做）→ 阿禾改为阶段闲聊
    // （旧行为：回落到 A02「先找许录要登记，再请陆舟看看船走的路线」——这一步早做完了）
    R.sel.D4 = [dlg('ahe', sD)];
    sD.updateQuestProgress('chapter2_main_2', 'complete_minigame', 'lantern_identify', 1);
    R.sel.D3 = [dlg('jiangpo', sD)];

    const sE = chapter1Done();
    finish(sE, 'chapter2_main_1');
    finish(sE, 'chapter2_main_2');
    R.sel.E = [dlg('luzhou', sE), dlg('xulu', sE), dlg('ahe', sE), dlg('jiangpo', sE)];

    const sF = chapter1Done();
    finish(sF, 'chapter2_main_1');
    finish(sF, 'chapter2_main_2');
    sF.acceptQuest('chapter2_main_3');
    R.sel.F = [dlg('ahe', sF), dlg('luzhou', sF), dlg('jiangpo', sF), dlg('jiangwan', sF), dlg('chenli', sF)];
    sF.updateQuestProgress('chapter2_main_3', 'talk_to', 'ahe', 1);
    sF.updateQuestProgress('chapter2_main_3', 'complete_minigame', 'boat_navigation', 1);     // 横版行舟：60 个障碍全部漂出视野（送达）= 目标完成（旧版还有 soul_return 目标，已删除）
    R.sel.F2 = [dlg('ahe', sF), dlg('jiangpo', sF)];
    sF.updateQuestProgress('chapter2_main_3', 'talk_to', 'jiangwan', 1);
    sF.updateQuestProgress('chapter2_main_3', 'talk_to', 'chenli', 1);
    R.sel.F3 = [dlg('luzhou', sF)];

    const sG = chapter1Done();
    finish(sG, 'chapter2_main_1');
    finish(sG, 'chapter2_main_2');
    finish(sG, 'chapter2_main_3');
    R.sel.G = [dlg('luzhou', sG), dlg('ahe', sG)];
    // G2：主线三已完成、主线四未接取（Boss 未胜）→ 江婆陪女儿（J04）/ 江晚 W02 / 陈栎 C02
    // （旧行为：江婆回落到 M01 的 J01，主界面会跳出「我帮您认灯」的过期接取选项）
    R.sel.G2 = [dlg('jiangpo', sG), dlg('jiangwan', sG), dlg('chenli', sG)];

    const sH = chapter1Done();
    finish(sH, 'chapter2_main_1');
    finish(sH, 'chapter2_main_2');
    finish(sH, 'chapter2_main_3');
    sH.acceptQuest('chapter2_main_4');
    R.sel.H = [dlg('xulu', sH), dlg('ahe', sH), dlg('luzhou', sH)];
    sH.updateQuestProgress('chapter2_main_4', 'talk_to', 'xulu', 1);
    sH.updateQuestProgress('chapter2_main_4', 'defeat_boss', 'boss_due', 1);
    // H0：Boss 已胜、台后账册/命令还没查 → 阿禾不再念战前叮嘱「你一定回来」（阶段闲聊）
    R.sel.H0 = [dlg('ahe', sH)];
    sH.updateQuestProgress('chapter2_main_4', 'investigate', 'zhuanyun_zhangce', 1);
    sH.updateQuestProgress('chapter2_main_4', 'investigate', 'taixuan_mingling', 1);
    sH.setStoryFlag('due_boss_defeated');
    // H1：账册与命令都查到、只差向阿禾交付 → 交付对话 A07
    // （旧行为：只差交付时仍念战前叮嘱，A07 从来没有规则指向，是死节点）
    R.sel.H1 = [dlg('ahe', sH)];
    R.sel.H2 = [dlg('xulu', sH), dlg('jiangpo', sH), dlg('jiangwan', sH), dlg('chenli', sH), dlg('luzhou', sH)];

    const sI = chapter1Done();
    finish(sI, 'chapter2_main_1');
    finish(sI, 'chapter2_main_2');
    finish(sI, 'chapter2_main_3');
    finish(sI, 'chapter2_main_4');
    R.sel.I = [dlg('ahe', sI), dlg('luzhou', sI)];
    sI.acceptQuest('chapter2_ending_1');
    R.sel.I2 = [dlg('ahe', sI)];
    finish(sI, 'chapter2_ending_1');
    R.sel.I3 = [dlg('luzhou', sI), dlg('ahe', sI)];
    sI.acceptQuest('chapter2_ending_2');
    R.sel.I4 = [dlg('ahe', sI)];
    finish(sI, 'chapter2_ending_2');
    R.sel.I5 = [dlg('ahe', sI), dlg('luzhou', sI)];

    // 第一章地图回归：阿禾 / 祁伯在第一章配置下依旧有对白
    R.sel.chapter1 = [
        Chapter1Config.getDialogueForNPC('ahe', chapter1Done(), null),
        Chapter1Config.getDialogueForNPC('qibo', chapter1Done(), null),
    ];

    // ---- 全阶段审计：过期接取选项 + 死节点 ----
    // 用「按顺序重放的操作」重建第二章每一个任务阶段（与上面 R.sel 的状态链一一对应），
    // 检查两类只有跑遍全流程才看得出来、写规则时极易漏掉的问题：
    //   1) 过期接取选项：某段对白此时把「接取任务」的选项摆在玩家面前，而那个任务其实已经完成
    //      —— 点下去只会弹「无法接取任务：已完成」（江婆 J01 的「我帮您认灯」就是这么漏出来的）；
    //   2) 死节点：某个对白节点在任何阶段都取不到 —— 交付对话 A03 / A07 / J03 都曾属于这一类。
    // 操作：{ a: 接取 } / { f: 跑到完成 } / { p: [任务, 目标类型, 目标] 推进一次 } / { g: 剧情标记 }
    const STAGE_DEFS = [
        ['S0 初到云渡泽（M1 未接取）', []],
        ['S1 M1 进行中·未推进', [{ a: 'chapter2_main_1' }]],
        ['S2 M1 摘页已取得', [{ a: 'chapter2_main_1' }, { p: ['chapter2_main_1', 'talk_to', 'xulu'] }]],
        ['S3 M1 航线已核对', [{ a: 'chapter2_main_1' }, { p: ['chapter2_main_1', 'talk_to', 'xulu'] }, { p: ['chapter2_main_1', 'talk_to', 'luzhou'] }]],
        ['S4 M1 目标全齐·未交付', [{ a: 'chapter2_main_1' }, { p: ['chapter2_main_1', 'talk_to', 'xulu'] }, { p: ['chapter2_main_1', 'talk_to', 'luzhou'] }, { p: ['chapter2_main_1', 'complete_training', 'sword'] }]],
        ['S5 M1 已完成（M2 未接取）', [{ f: 'chapter2_main_1' }]],
        ['S6 M2 进行中·未推进', [{ f: 'chapter2_main_1' }, { a: 'chapter2_main_2' }]],
        ['S7 M2 魂灯已取得', [{ f: 'chapter2_main_1' }, { a: 'chapter2_main_2' }, { p: ['chapter2_main_2', 'talk_to', 'xulu'] }]],
        ['S8 M2 核验栏已读', [{ f: 'chapter2_main_1' }, { a: 'chapter2_main_2' }, { p: ['chapter2_main_2', 'talk_to', 'xulu'] }, { p: ['chapter2_main_2', 'investigate', 'lantern_clue'] }]],
        ['S9 M2 阿禾线索已问', [{ f: 'chapter2_main_1' }, { a: 'chapter2_main_2' }, { p: ['chapter2_main_2', 'talk_to', 'xulu'] }, { p: ['chapter2_main_2', 'investigate', 'lantern_clue'] }, { p: ['chapter2_main_2', 'talk_to', 'ahe'] }]],
        ['S10 M2 认灯完成·未交付', [{ f: 'chapter2_main_1' }, { a: 'chapter2_main_2' }, { p: ['chapter2_main_2', 'talk_to', 'xulu'] }, { p: ['chapter2_main_2', 'investigate', 'lantern_clue'] }, { p: ['chapter2_main_2', 'talk_to', 'ahe'] }, { p: ['chapter2_main_2', 'complete_minigame', 'lantern_identify'] }]],
        ['S11 M2 已完成（M3 未接取）', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }]],
        ['S12 M3 进行中·未推进', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { a: 'chapter2_main_3' }]],
        ['S13 M3 归魂点已确认', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { a: 'chapter2_main_3' }, { p: ['chapter2_main_3', 'talk_to', 'ahe'] }]],
        ['S14 M3 归魂完成·证词未取', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { a: 'chapter2_main_3' }, { p: ['chapter2_main_3', 'talk_to', 'ahe'] }, { p: ['chapter2_main_3', 'complete_minigame', 'boat_navigation'] }]],
        ['S15 M3 江晚证词已取', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { a: 'chapter2_main_3' }, { p: ['chapter2_main_3', 'talk_to', 'ahe'] }, { p: ['chapter2_main_3', 'complete_minigame', 'boat_navigation'] }, { p: ['chapter2_main_3', 'talk_to', 'jiangwan'] }]],
        ['S16 M3 陈栎证词已取·未交付', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { a: 'chapter2_main_3' }, { p: ['chapter2_main_3', 'talk_to', 'ahe'] }, { p: ['chapter2_main_3', 'complete_minigame', 'boat_navigation'] }, { p: ['chapter2_main_3', 'talk_to', 'jiangwan'] }, { p: ['chapter2_main_3', 'talk_to', 'chenli'] }]],
        ['S17 M3 已完成（M4 未接取）', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }]],
        ['S18 M4 进行中·未推进', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { a: 'chapter2_main_4' }]],
        ['S19 M4 凭证已取得', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { a: 'chapter2_main_4' }, { p: ['chapter2_main_4', 'talk_to', 'xulu'] }]],
        ['S20 M4 Boss 已胜·未调查', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { a: 'chapter2_main_4' }, { p: ['chapter2_main_4', 'talk_to', 'xulu'] }, { p: ['chapter2_main_4', 'defeat_boss', 'boss_due'] }]],
        ['S20b M4 Boss 已胜 + 剧情标记', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { a: 'chapter2_main_4' }, { p: ['chapter2_main_4', 'talk_to', 'xulu'] }, { p: ['chapter2_main_4', 'defeat_boss', 'boss_due'] }, { g: 'due_boss_defeated' }]],
        ['S21 M4 账册已查', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { a: 'chapter2_main_4' }, { p: ['chapter2_main_4', 'talk_to', 'xulu'] }, { p: ['chapter2_main_4', 'defeat_boss', 'boss_due'] }, { g: 'due_boss_defeated' }, { p: ['chapter2_main_4', 'investigate', 'zhuanyun_zhangce'] }]],
        ['S22 M4 目标全齐·未交付', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { a: 'chapter2_main_4' }, { p: ['chapter2_main_4', 'talk_to', 'xulu'] }, { p: ['chapter2_main_4', 'defeat_boss', 'boss_due'] }, { g: 'due_boss_defeated' }, { p: ['chapter2_main_4', 'investigate', 'zhuanyun_zhangce'] }, { p: ['chapter2_main_4', 'investigate', 'taixuan_mingling'] }]],
        ['S23 M4 已完成（E1 未接取）', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { f: 'chapter2_main_4' }, { g: 'due_boss_defeated' }]],
        ['S24 E1 进行中', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { f: 'chapter2_main_4' }, { g: 'due_boss_defeated' }, { a: 'chapter2_ending_1' }]],
        ['S25 E1 已完成（E2 未接取）', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { f: 'chapter2_main_4' }, { g: 'due_boss_defeated' }, { f: 'chapter2_ending_1' }]],
        ['S26 E2 进行中', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { f: 'chapter2_main_4' }, { g: 'due_boss_defeated' }, { f: 'chapter2_ending_1' }, { a: 'chapter2_ending_2' }]],
        ['S27 章末全完成', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { f: 'chapter2_main_4' }, { g: 'due_boss_defeated' }, { f: 'chapter2_ending_1' }, { f: 'chapter2_ending_2' }]],
        // 旧存档 / 标记丢失：账册已查但 due_boss_defeated 没落盘 —— 对白要认「已经打赢过」，
        // 不能因为少了标记就把玩家当成「还没打 Boss」（进场也不再生成渡厄使，
        // 见 Main.isArenaBossAlreadyDefeated 的第 2 条判据）。
        ['S28 M4 账册已查但击败标记缺失（旧存档）', [{ f: 'chapter2_main_1' }, { f: 'chapter2_main_2' }, { f: 'chapter2_main_3' }, { a: 'chapter2_main_4' }, { p: ['chapter2_main_4', 'talk_to', 'xulu'] }, { p: ['chapter2_main_4', 'defeat_boss', 'boss_due'] }, { p: ['chapter2_main_4', 'investigate', 'zhuanyun_zhangce'] }]],
    ];
    const NPC_IDS = ['ahe', 'luzhou', 'jiangpo', 'xulu', 'jiangwan', 'chenli'];
    const auditStages = STAGE_DEFS.map(([label, ops]) => {
        const s = chapter1Done();
        for (const op of ops) {
            if (op.a) s.acceptQuest(op.a);
            else if (op.f) finish(s, op.f);
            else if (op.p) s.updateQuestProgress(op.p[0], op.p[1], op.p[2], 1);
            else if (op.g) s.setStoryFlag(op.g);
        }
        const items = new QuestItemSystem();
        const dlgIds = {};
        NPC_IDS.forEach(id => { dlgIds[id] = Chapter2Config.getDialogueForNPC(id, s, items) || null; });
        return { label, dlgIds, system: s };
    });
    const usedIds = {};
    NPC_IDS.forEach(id => { usedIds[id] = []; });
    auditStages.forEach(stage => NPC_IDS.forEach(id => {
        const d = stage.dlgIds[id];
        if (d && usedIds[id].indexOf(d) === -1) usedIds[id].push(d);
    }));
    R.audit = {
        stageCount: auditStages.length,
        stages: auditStages.map(s => [s.label, s.dlgIds]),
        expiredAccepts: [],
        deadNodes: [],
        usedIds,
    };
    auditStages.forEach(stage => NPC_IDS.forEach(id => {
        const dlgId = stage.dlgIds[id];
        const cfg = (C2_NPC[id] && C2_NPC[id].dialogues) ? C2_NPC[id].dialogues[dlgId] : null;
        ((cfg && cfg.options) || []).forEach(opt => {
            const m = /^(?:accept|start)_quest_(.+)$/.exec(opt.action || '');
            if (m && stage.system.isQuestCompleted(m[1])) {
                R.audit.expiredAccepts.push(`${stage.label} → ${id}.${dlgId}「${opt.text}」(${m[1]} 已完成)`);
            }
        });
    }));
    NPC_IDS.forEach(id => {
        const dialogues = (C2_NPC[id] && C2_NPC[id].dialogues) || {};
        Object.keys(dialogues).forEach(dlgId => {
            if (usedIds[id].indexOf(dlgId) === -1) R.audit.deadNodes.push(`${id}.${dlgId}`);
        });
    });

    // ---- 地图数据 / 碰撞 / 交互点可达性 ----
    function isWalkable(rows, tx, ty) {
        if (ty < 0 || ty >= rows.length) return false;
        if (tx < 0 || tx >= rows[0].length) return false;
        return rows[ty][tx] === '.';
    }
    function reachableSet(rows, start) {
        const seen = new Set();
        const key = (x, y) => `${x},${y}`;
        if (!isWalkable(rows, start.x, start.y)) return seen;
        const queue = [start];
        seen.add(key(start.x, start.y));
        while (queue.length > 0) {
            const c = queue.shift();
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                const nx = c.x + dx;
                const ny = c.y + dy;
                if (isWalkable(rows, nx, ny) && !seen.has(key(nx, ny))) {
                    seen.add(key(nx, ny));
                    queue.push({ x: nx, y: ny });
                }
            });
        }
        return seen;
    }

    const yun = C2_MAP.yunduze;
    const arena = C2_MAP.boss_arena_ch2;
    R.map = {
        yun: {
            tileSize: yun.tileSize, mapWidth: yun.mapWidth, mapHeight: yun.mapHeight,
            // 美术必须覆盖的网格尺寸（bg.png / collision.png 不得小于它，否则超出的瓦片没有像素可采样）
            gridWidth: yun.mapWidth * yun.tileSize,
            gridHeight: yun.mapHeight * yun.tileSize,
            rows: yun.collisionData.length,
            uniformCols: yun.collisionData.every(r => r.length === yun.mapWidth),
            chars: Array.from(new Set(yun.collisionData.join(''))).join(''),
        },
        arena: {
            tileSize: arena.tileSize, mapWidth: arena.mapWidth, mapHeight: arena.mapHeight,
            rows: arena.collisionData.length,
            uniformCols: arena.collisionData.every(r => r.length === arena.mapWidth),
            chars: Array.from(new Set(arena.collisionData.join(''))).join(''),
        },
    };

    const t = yun.tileSize;
    const yunPoints = [['entry', yun.entryPoint.x, yun.entryPoint.y]];
    for (const npcId in yun.npcPositions) {
        const p = yun.npcPositions[npcId];
        yunPoints.push([`npc:${npcId}`, p.x, p.y]);
        const w = yun.npcWorldPositions[npcId];
        if (w) yunPoints.push([`npcWorld:${npcId}`, Math.floor(w.x / t), Math.floor(w.y / t)]);
    }
    for (const k in yun.windPiles) {
        const p = yun.windPiles[k].position;
        yunPoints.push([`windPile:${k}`, Math.floor(p.x / t), Math.floor(p.y / t)]);
    }
    for (const k in yun.signposts) {
        const p = yun.signposts[k].position;
        yunPoints.push([`signpost:${k}`, Math.floor(p.x / t), Math.floor(p.y / t)]);
    }
    for (const k in yun.teleporters) {
        const p = yun.teleporters[k].worldPosition;
        yunPoints.push([`teleporter:${k}`, Math.floor(p.x / t), Math.floor(p.y / t)]);
    }
    const berth = yun.chapterEnd.departSignpost.position;
    yunPoints.push(['berthSignpost', Math.floor(berth.x / t), Math.floor(berth.y / t)]);
    Chapter2Config.getSwordTrainingLayout().forEach(z => {
        yunPoints.push([`training:${z.id}`, Math.floor(z.position.x / t), Math.floor(z.position.y / t)]);
    });
    const reachedYun = reachableSet(yun.collisionData, yun.entryPoint);
    R.map.yunUnreachable = yunPoints
        .filter(([name, x, y]) => !isWalkable(yun.collisionData, x, y) || !reachedYun.has(`${x},${y}`))
        .map(([name, x, y]) => `${name}(${x},${y})`);
    R.map.yunWalkable = (function () {
        let n = 0;
        yun.collisionData.forEach(r => { n += (r.match(/\./g) || []).length; });
        return { walkable: n, total: yun.mapWidth * yun.mapHeight, reached: reachedYun.size };
    })();
    R.map.yunBorderBlocked = yun.collisionData[0].indexOf('.') === -1
        && yun.collisionData[yun.mapHeight - 1].indexOf('.') === -1;

    const at = arena.tileSize;
    const arenaPoints = [['entry', arena.entryPoint.x, arena.entryPoint.y]];
    for (const k in arena.windPiles) {
        const p = arena.windPiles[k].position;
        arenaPoints.push([`windPile:${k}`, Math.floor(p.x / at), Math.floor(p.y / at)]);
    }
    const bossCfg = arena.bossPosition.boss_due;
    // 出生位优先取世界坐标 worldPosition（= GameMap.spawnArenaBoss 的实际取值口径），
    // 没有该字段时退回 x/y 瓦片坐标（第一章战场配置的老写法）
    arenaPoints.push(['boss',
        bossCfg.worldPosition ? Math.floor(bossCfg.worldPosition.x / at) : bossCfg.x,
        bossCfg.worldPosition ? Math.floor(bossCfg.worldPosition.y / at) : bossCfg.y,
    ]);
    const reachedArena = reachableSet(arena.collisionData, arena.entryPoint);
    R.map.arenaUnreachable = arenaPoints
        .filter(([name, x, y]) => !isWalkable(arena.collisionData, x, y) || !reachedArena.has(`${x},${y}`))
        .map(([name, x, y]) => `${name}(${x},${y})`);
    R.map.arenaCenterWalkable = isWalkable(arena.collisionData,
        Math.floor(arena.mapWidth / 2), Math.floor(arena.mapHeight / 2));
    R.map.arenaTeleportTargetMatchesEntry = (function () {
        const target = yun.teleporters.wandengtai.targetPosition;
        return Math.floor(target.x / at) === arena.entryPoint.x
            && Math.floor(target.y / at) === arena.entryPoint.y;
    })();

    // ---- 地图实例（碰撞图置空 → 走 collisionData，避免测试环境等待图片加载）----
    const yunMap = new GameMap('yunduze', C2_MAP.yunduze, { backgroundImage: null, collisionImage: null });
    yunMap.init();
    const arenaMap = new GameMap('boss_arena_ch2', C2_MAP.boss_arena_ch2, { backgroundImage: null, collisionImage: null });
    arenaMap.init();

    // ---- Main 实例（只用到奖励 / 结算 / 路标生成，不启动主循环）----
    const main = new Main();
    main.player = new Player({
        position: { x: 400, y: 1520 },
        playerData: { realm: 'zhuji', stage: '圆满', health: 200, maxHealth: 200, mana: 100, maxMana: 100, lingShi: 0 },
        profession: { professionId: 'sanxiu' },
    });
    main.inputManager = new InputManager(window, null);
    main.dialogBox = new DialogBox();
    main.camera = new Camera({ width: 1280, height: 720 });
    main.mapManager = { getMap: (id) => (id === 'yunduze' ? yunMap : (id === 'boss_arena_ch2' ? arenaMap : null)) };
    main.gameConfig = gameConfig;
    main.currentMap = yunMap;
    main.resourceManager = ResourceManager.getInstance();

    // ---- 门控：万灯台调查点必须按顺序（击败 Boss → 账册 → 命令）----
    const gateSystem = chapter1Done();
    finish(gateSystem, 'chapter2_main_1');
    finish(gateSystem, 'chapter2_main_2');
    finish(gateSystem, 'chapter2_main_3');
    gateSystem.acceptQuest('chapter2_main_4');

    R.gates = {};
    const zhangce = arenaMap.windPiles.get('wind_pile_zhangce');
    const mingling = arenaMap.windPiles.get('wind_pile_mingling');
    zhangce.updateQuestGate(gateSystem);
    R.gates.zhangceBeforeBoss = zhangce.canInvestigate;
    gateSystem.updateQuestProgress('chapter2_main_4', 'talk_to', 'xulu', 1);
    gateSystem.updateQuestProgress('chapter2_main_4', 'defeat_boss', 'boss_due', 1);
    zhangce.updateQuestGate(gateSystem);
    mingling.updateQuestGate(gateSystem);
    R.gates.zhangceAfterBoss = zhangce.canInvestigate;
    R.gates.minglingBeforeZhangce = mingling.canInvestigate;
    gateSystem.updateQuestProgress('chapter2_main_4', 'investigate', 'zhuanyun_zhangce', 1);
    mingling.updateQuestGate(gateSystem);
    R.gates.minglingAfterZhangce = mingling.canInvestigate;
    R.gates.zhangceGrant = zhangce.grantItems.slice();
    R.gates.minglingGrant = mingling.grantItems.slice();

    // ---- 门控：云渡泽路标 / 传送法阵 ----
    const gate2 = chapter1Done();
    finish(gate2, 'chapter2_main_1');
    gate2.acceptQuest('chapter2_main_2');
    const lanternSign = yunMap.signposts.get('signpost_lantern_stand');
    const escortSign = yunMap.signposts.get('signpost_river_escort');
    const wandengtai = yunMap.teleporters.get('teleport_wandengtai');
    lanternSign.updateQuestGate(gate2);
    escortSign.updateQuestGate(gate2);
    wandengtai.updateQuestGate(gate2);
    R.gates.lanternSignBeforeClue = lanternSign.isActive;
    R.gates.escortSignBeforeM3 = escortSign.isActive;
    R.gates.wandengtaiBeforeM4 = wandengtai.isActive;
    R.gates.wandengtaiArena = {
        bossArena: wandengtai.bossArena,
        flag: wandengtai.arenaDefeatFlag,
        group: wandengtai.arenaResourceGroup,
        victory: wandengtai.arenaVictory,
        returnMapId: wandengtai.arenaReturnMapId,
        questRequired: wandengtai.questRequired,
        requireObjective: wandengtai.requireObjective,
    };
    gate2.updateQuestProgress('chapter2_main_2', 'talk_to', 'xulu', 1);
    gate2.updateQuestProgress('chapter2_main_2', 'investigate', 'lantern_clue', 1);
    lanternSign.updateQuestGate(gate2);
    R.gates.lanternSignAfterClue = lanternSign.isActive;
    finish(gate2, 'chapter2_main_2');
    finish(gate2, 'chapter2_main_3');
    escortSign.updateQuestGate(gate2);
    R.gates.escortSignAfterM3 = escortSign.isActive;
    // 万灯台法阵：接取主线四还不够 —— 必须先完成第 1 步「向许录取得万灯台通行凭证」
    // （对话 X05 触发 talk_to: xulu 目标完成；目标门控 requireObjective，与路标同一套语义）
    gate2.acceptQuest('chapter2_main_4');
    wandengtai.updateQuestGate(gate2);
    R.gates.wandengtaiAfterM4 = wandengtai.isActive;             // 还没拿凭证 → 不生成
    gate2.updateQuestProgress('chapter2_main_4', 'talk_to', 'xulu', 1);
    wandengtai.updateQuestGate(gate2);
    R.gates.wandengtaiAfterToken = wandengtai.isActive;          // 拿到通行凭证 → 生成

    // ---- 调试通道已下线：云渡泽只剩正式入口 wandengtai ----
    const debugPortal = yunMap.teleporters.get('teleport_boss_due_debug');
    R.gates.debugPortalGone = {
        mapHasArray: !!debugPortal,
        teleporterKeys: Array.from(yunMap.teleporters.keys()).sort(),
        configHasToggle: typeof Chapter2Config.isDebugBossPortalEnabled === 'function',
        configHasGetter: typeof Chapter2Config.getDebugBossPortalTeleporter === 'function',
        arrayHasDebugField: !!debugPortal && debugPortal.debugPortal === true,
        mainHasResetMethod: typeof main.resetDebugPortalDefeatFlag === 'function',
    };

    // ---- 击败判据（打赢过就再也不生成 Boss；只有战败才允许再挑战）----
    //   ① 击败标记已写入 → 已击败
    //   ② 标记丢了（旧存档 / 曾经的调试通道击杀）但「击败 Boss」目标已完成 → 仍算已击败，并补记标记
    //   ③ 两条都不成立（战败退回）→ 未击败，可再进战场重试
    const arenaParams = {
        defeatFlag: wandengtai.arenaDefeatFlag,
        victory: wandengtai.arenaVictory,
    };
    const savedGuardSystem = main.player.questSystem;

    const guardSystemFlag = new QuestSystem();
    guardSystemFlag.setStoryFlag('due_boss_defeated', true);
    main.player.questSystem = guardSystemFlag;
    const guardWithFlag = main.isArenaBossAlreadyDefeated(arenaParams);

    const guardSystemObjective = chapter1Done();
    finish(guardSystemObjective, 'chapter2_main_1');
    finish(guardSystemObjective, 'chapter2_main_2');
    finish(guardSystemObjective, 'chapter2_main_3');
    guardSystemObjective.acceptQuest('chapter2_main_4');
    guardSystemObjective.updateQuestProgress('chapter2_main_4', 'talk_to', 'xulu', 1);
    guardSystemObjective.updateQuestProgress('chapter2_main_4', 'defeat_boss', 'boss_due', 1);
    main.player.questSystem = guardSystemObjective;
    const guardObjectiveOnly = main.isArenaBossAlreadyDefeated(arenaParams);
    const guardFlagBackfilled = guardSystemObjective.hasStoryFlag('due_boss_defeated');

    main.player.questSystem = new QuestSystem();                   // 全新存档：没赢过
    const guardNoWin = main.isArenaBossAlreadyDefeated(arenaParams);

    main.player.questSystem = savedGuardSystem;
    R.gates.bossRespawnGuard = {
        withFlag: guardWithFlag,
        objectiveOnly: guardObjectiveOnly,
        flagBackfilled: guardFlagBackfilled,
        noWin: guardNoWin,
    };

    // ---- 回归：第一章章末舞台恢复（applyChapterEndStage）不得作用于云渡泽 ----
    //   同一个根因下的两个真机 bug（本用例守住它们不再复发）：
    //     ① 进云渡泽时照样跑第一章章末恢复 → 阿禾被 reposition 到**第一章码头瓦片 (81,44)**
    //        （云渡泽里 = 世界 2592,1408），玩家看到的就是“阿禾还停在第一章”；
    //     ② 同一次调用里 createDepartSignpost 用云渡泽的 chapterEnd.departSignpost 生成了
    //        一个**无任务门控**的第一章登船路标 → 刚打完第一章进图，泊位就冒出
    //        「登船前往照尘仙城」，且按 E 走的是第一章的 boardShipAndOpenWorldMap。
    //   这里用“刚打完第一章、带着 farewell 标记”的真实存档状态跑真实代码路径。
    const chapterEndStageSavedSystem = main.player.questSystem;
    const chapterEndStageSystem = chapter1Done();
    chapterEndStageSystem.setStoryFlag('chapter1_farewell_done', true);
    main.player.questSystem = chapterEndStageSystem;
    const aheInYunduze = yunMap.npcs.get('ahe');
    const aheBeforeStage = aheInYunduze ? { x: aheInYunduze.position.x, y: aheInYunduze.position.y } : null;
    const signpostCountBeforeStage = yunMap.signposts.size;
    main.applyChapterEndStage(yunMap);                       // 真实代码路径：切图 / 读档后的舞台恢复
    R.gates.chapterEndStageGuard = {
        mapId: yunMap.mapId,
        mapChapter: yunMap.mapConfig.chapter,
        hasIsChapter1Map: typeof main.isChapter1Map === 'function',
        isChapter1Map: main.isChapter1Map(yunMap),           // 云渡泽 → 应为 false
        isChapter2Map: main.isChapter2Map(yunMap.mapId),
        farewellFlag: chapterEndStageSystem.hasStoryFlag('chapter1_farewell_done'),
        // 第一章码头告别位（瓦片 81,44）：若被误用到云渡泽，阿禾会跑到世界 (2592,1408)
        ch1QuayTile: (Chapter1Config.getMapConfigs().qinglan_fuye.chapterEnd || {}).aheQuayTile || null,
        aheBefore: aheBeforeStage,
        aheAfter: aheInYunduze ? { x: aheInYunduze.position.x, y: aheInYunduze.position.y } : null,
        aheMoved: !!(aheBeforeStage && aheInYunduze
            && (aheInYunduze.position.x !== aheBeforeStage.x || aheInYunduze.position.y !== aheBeforeStage.y)),
        signpostsBefore: signpostCountBeforeStage,
        signpostsAfter: yunMap.signposts.size,
        boatSignpostOnMap: yunMap.signposts.has('signpost_zhaochen_boat'),
    };
    // 反向再确认：防呆判断也让 createDepartSignpost 在云渡泽直接返回 null（不建路标）
    R.gates.chapterEndStageGuard.createDepartSignpostReturnedNull = main.createDepartSignpost(yunMap) === null;
    R.gates.chapterEndStageGuard.signpostsAfterGuardCall = yunMap.signposts.size;
    main.player.questSystem = chapterEndStageSavedSystem;

    // ---- 门控：泊位登船路标（代码动态生成 + 目标门控）----
    main.player.questSystem = gate2;
    const boatSign = main.ensureChapter2BoatSignpost();
    boatSign.updateQuestGate(gate2);
    R.gates.boatSignAtM4 = boatSign ? boatSign.isActive : null;

    const e2System = chapter1Done();
    ['chapter2_main_1', 'chapter2_main_2', 'chapter2_main_3', 'chapter2_main_4', 'chapter2_ending_1']
        .forEach(id => { e2System.quests.set(id, { questId: id, state: 'completed', objectives: [], acceptedTime: 1, completedTime: 2 }); });
    e2System.acceptQuest('chapter2_ending_2');
    boatSign.updateQuestGate(e2System);
    R.gates.boatSignAfterAccept = boatSign.isActive;
    e2System.updateQuestProgress('chapter2_ending_2', 'talk_to', 'ahe', 1);
    boatSign.updateQuestGate(e2System);
    R.gates.boatSignAfterTalkToAhe = boatSign.isActive;
    R.gates.boatSignPosition = { x: boatSign.position.x, y: boatSign.position.y };

    // ---- 小游戏：认灯归魂（4 盏魂灯 / 灯序全排列 / 3 次机会 / 「几盏位置对」反馈）----
    const lanternGame = new LanternIdentifyMiniGame();
    let lanternResult = null;
    lanternGame.onComplete = (res) => { lanternResult = res; };
    lanternGame.start();
    const lanternGeometry = lanternGame.lanterns.map(l => ({ n: l.number, x: l.x, y: l.y, lit: l.lit }));
    // 真实流程：走到灯前按 E（update 读 input.pressedKeys.e）
    // 真实节奏：一次「按 E」= 先有一帧没按 E（帧末会清 pressedKeys，也用于重新武装）+ 再按下的一帧
    const pressEAt = (game, number) => {
        const lantern = game.lanterns.find(item => item.number === number);
        game.player.x = lantern.x;
        game.player.y = lantern.y;
        game.update(0.016, { keys: {}, pressedKeys: {} });                     // 松手帧
        game.update(0.016, { keys: { e: true }, pressedKeys: { e: true } });   // 按下帧
    };
    const lightSequence = (game, order) => order.forEach(number => pressEAt(game, number));

    // ① 故意把目标灯序前两位对调 → 一定「2 盏位置对」：扣一次机会 + 熄灭全部 + 重来
    const targetBeforeWrong = lanternGame.targetOrder.join('');
    const wrongOrder = lanternGame.targetOrder.slice();
    const swap = wrongOrder[0];
    wrongOrder[0] = wrongOrder[1];
    wrongOrder[1] = swap;
    lightSequence(lanternGame, wrongOrder);
    // 失败提示常驻：给足 4 秒（远超原先 2.6s 的计时）也不该被收走
    const hintTextAfterWrong = lanternGame.feedback;
    const lanternNoInput = { keys: {}, pressedKeys: {} };
    for (let i = 0; i < 4; i++) lanternGame.update(1, lanternNoInput);
    const hintTextAfter4s = lanternGame.feedback;
    const afterWrong = {
        correct: lanternGame.lastCorrectCount,
        attemptsLeft: lanternGame.attemptsLeft,
        round: lanternGame.round,
        litAfterReset: lanternGame.lanterns.filter(l => l.lit).length,
        litOrderAfterReset: lanternGame.litOrder.slice(),
        feedback: lanternGame.feedback,
        feedbackTimer: lanternGame.feedbackTimer,
        feedbackPersistent: lanternGame.feedbackPersistent,
        hintTextAfterWrong: hintTextAfterWrong,
        hintTextAfter4s: hintTextAfter4s,
        hintSurvivedTimer: hintTextAfterWrong !== '' && hintTextAfter4s === hintTextAfterWrong,
        completed: lanternGame.isCompleted,
        targetBeforeWrong: targetBeforeWrong,
        targetAfterWrong: lanternGame.targetOrder.join(''),
    };

    // ② 再按目标灯序点亮 → 完成，返回 success（用了 2 次机会）
    lightSequence(lanternGame, lanternGame.targetOrder);
    R.lanternIdentify = {
        lanternCount: lanternGame.lanterns.length,
        numbers: lanternGeometry.map(item => item.n),
        offsets: lanternGeometry.map(item => [item.x - lanternGame.center.x, item.y - lanternGame.center.y]),
        litAtStart: lanternGeometry.every(item => item.lit === false),
        offset: lanternGame.lanternOffset,
        art: { w: lanternGame.lanternWidth, h: lanternGame.lanternHeight },
        maxAttempts: lanternGame.maxAttempts,
        litStaysLit: lanternGame.lanterns.every(item => item.lit === true),
        timeLimit: lanternGame.timeLimit,
        targetOrderIsPermutation: lanternGame.targetOrder.slice().sort().join('') === '1234',
        afterWrong: afterWrong,
        completed: lanternGame.isCompleted,
        resultSuccess: lanternResult ? lanternResult.success : null,
        resultAttemptsUsed: lanternResult ? lanternResult.attemptsUsed : null,
        resultLitOrder: lanternResult ? lanternResult.litOrder : null,
    };

    // ③ 三次机会用尽 → fail 退出（固定目标 1-2-3-4，每次连点 4-3-2-1 → 0 盏位置对）
    const failGame = new LanternIdentifyMiniGame();
    let failResult = null;
    failGame.onFail = (res) => { failResult = res; };
    failGame.start();
    failGame.targetOrder = [1, 2, 3, 4];
    const failRounds = [];
    for (let i = 0; i < 3; i++) {
        lightSequence(failGame, [4, 3, 2, 1]);
        failRounds.push({
            correct: failGame.lastCorrectCount,
            attemptsLeft: failGame.attemptsLeft,
            round: failGame.round,
            feedback: failGame.feedback,
            feedbackPersistent: failGame.feedbackPersistent,
            feedbackTimer: failGame.feedbackTimer,
        });
    }
    // 点亮后不可熄灭、不可重复点亮：对准同一盏灯连按两次 E
    const replayGame = new LanternIdentifyMiniGame();
    replayGame.start();
    pressEAt(replayGame, 1);
    const firstLitOrder = replayGame.litOrder.join('');
    pressEAt(replayGame, 1);
    R.lanternIdentifyFail = {
        attemptsLeft: failGame.attemptsLeft,
        rounds: failRounds,
        failed: failGame.isFailed,
        resultSuccess: failResult ? failResult.success : null,
        resultAttemptsUsed: failResult ? failResult.attemptsUsed : null,
        replay: {
            afterFirst: firstLitOrder,
            lit: replayGame.lanterns[0].lit,
            litOrderLength: replayGame.litOrder.length,
        },
    };

    // ④ 按住 E 不放的回归（曾经：灯序点错 → 全部熄灭后，第 4 盏立刻被 keydown 连发重新点亮）
    //   模拟真实输入：站在第 4 盏灯旁按住 E，浏览器持续重复 keydown（keys.e + pressedKeys.e 都在）
    const holdGame = new LanternIdentifyMiniGame();
    holdGame.start();
    const holdWrong = holdGame.targetOrder.slice();
    const holdSwap = holdWrong[0];
    holdWrong[0] = holdWrong[1];
    holdWrong[1] = holdSwap;
    holdWrong.slice(0, 3).forEach(number => pressEAt(holdGame, number));   // 前三盏：单帧按 E（等价松手再按）
    const fourthLantern = holdGame.lanterns.find(item => item.number === holdWrong[3]);
    holdGame.player.x = fourthLantern.x;
    holdGame.player.y = fourthLantern.y;
    holdGame.update(1 / 60, { keys: {}, pressedKeys: {} });   // 松手帧：准备按下第 4 盏（真实节奏）
    for (let i = 0; i < 30; i++) {
        holdGame.update(1 / 60, { keys: { e: true }, pressedKeys: { e: true } });
    }
    const eHoldAfterReset = {
        litCount: holdGame.lanterns.filter(item => item.lit).length,
        litOrder: holdGame.litOrder.slice(),
        attemptsLeft: holdGame.attemptsLeft,
        eHeld: holdGame.eHeld === true,
    };
    // 松开 E → 再按一次 → 可以正常重新点灯（只是不再被 keydown 连发二次触发）
    holdGame.update(1 / 60, { keys: {}, pressedKeys: {} });
    pressEAt(holdGame, fourthLantern.number);
    const eHoldAfterReleasePress = holdGame.lanterns.filter(item => item.lit).length;
    R.lanternIdentify.eHold = {
        afterHold: eHoldAfterReset,
        afterReleasePress: eHoldAfterReleasePress,
    };

    // ⑤ 同一份 pressedKeys 连喂两帧的防御性回归（历史上小游戏曾被 MiniGameScene.update 与
    //    Main.updateMiniGame 各驱动一次，pressedKeys 到帧末才清）→ 第 4 盏灯不能被二次点亮。
    //    注：第十三次改动已让 Main.update 不再重复驱动小游戏（每帧只更新一次），
    //    这里保留「被重复驱动也不出错」的行为守卫。
    const sameFrameGame = new LanternIdentifyMiniGame();
    sameFrameGame.start();
    const sameFrameWrong = sameFrameGame.targetOrder.slice();
    const sfSwap = sameFrameWrong[0];
    sameFrameWrong[0] = sameFrameWrong[1];
    sameFrameWrong[1] = sfSwap;
    sameFrameWrong.slice(0, 3).forEach(number => pressEAt(sameFrameGame, number));
    const sfLantern = sameFrameGame.lanterns.find(item => item.number === sameFrameWrong[3]);
    sameFrameGame.player.x = sfLantern.x;
    sameFrameGame.player.y = sfLantern.y;
    const sameFrameInput = { keys: { e: true }, pressedKeys: { e: true } };
    sameFrameGame.update(1 / 60, { keys: {}, pressedKeys: {} });   // 松手帧：准备按下第 4 盏
    sameFrameGame.update(1 / 60, sameFrameInput);   // 本帧第 1 次更新：点亮第 4 盏 → 结算 → 全部熄灭
    sameFrameGame.update(1 / 60, sameFrameInput);   // 本帧第 2 次更新：同一份 pressedKeys 必须无效
    R.lanternIdentify.eSameFrame = {
        litCount: sameFrameGame.lanterns.filter(item => item.lit).length,
        litOrder: sameFrameGame.litOrder.slice(),
        attemptsLeft: sameFrameGame.attemptsLeft,
        armed: sameFrameGame.eArmed === true,
    };

    // ---- 认灯归魂：认灯台碰撞图 → 32×18 瓦片表（可走格 / 四向撞墙即停 / 自检 / F2 覆盖层）----
    const collisionGame = new LanternIdentifyMiniGame();
    collisionGame.start();
    // 冒烟环境没有真实图片像素 → 显式走「兜底表」通路，让判定可复现
    // （规则与运行时一致：一个 40px 瓦片里黑像素占比 ≥ 50% 即阻挡，白 = 可走，见 js/TileSystem.js）
    collisionGame.collisionImage = null;
    collisionGame.collisionImageUnreadable = true;
    collisionGame.collisionSource = 'none';
    collisionGame.walkableTiles = null;
    collisionGame._initCollision();
    const collisionGrid = collisionGame.walkableTiles || [];
    const collisionWalkable = collisionGrid.reduce(
        (sum, row) => sum + row.filter(Boolean).length, 0);
    const spawnPoint = { x: collisionGame.player.x, y: collisionGame.player.y };
    // 按住一个方向键走满 4 秒（200px/s，1/60s 一步，先横后纵分轴移动）→ 看被哪面墙挡下
    const walkUntilWall = (key) => {
        collisionGame.player.x = spawnPoint.x;
        collisionGame.player.y = spawnPoint.y;
        collisionGame.keys = {};
        collisionGame.keys[key] = true;
        for (let i = 0; i < 240; i++) collisionGame._updatePlayerMovement(1 / 60);
        const stopped = { x: collisionGame.player.x, y: collisionGame.player.y };
        collisionGame.keys = {};
        return stopped;
    };
    const stopRight = walkUntilWall('d');
    const stopLeft = walkUntilWall('a');
    const stopUp = walkUntilWall('w');
    const stopDown = walkUntilWall('s');
    // 四盏魂灯是否都落在「可走格中心」的 interactRadius 内（碰撞自检用的是同一套判定）
    const reachableCenters = collisionGame._reachableTileCenters(
        collisionGame.center.x, collisionGame.center.y);
    const lanternDistances = collisionGame.lanterns.map(lantern => reachableCenters.reduce(
        (min, point) => Math.min(min, Math.hypot(point.x - lantern.x, point.y - lantern.y)), Infinity));
    const collisionDebugBefore = collisionGame.debugCollision;
    const collisionDebugOn = collisionGame.toggleCollisionDebug();
    const collisionDebugOff = collisionGame.setCollisionDebug(false);
    R.lanternCollision = {
        tileSize: collisionGame.tileSize,
        mapCols: collisionGame.mapCols,
        mapRows: collisionGame.mapRows,
        walkableCount: collisionWalkable,
        source: collisionGame.collisionSource,
        enabled: collisionGame.collisionEnabled,
        spawnWalkable: collisionGame._canStandAt(spawnPoint.x, spawnPoint.y),
        cornerBlocked: !collisionGame._canStandAt(40, 360) && !collisionGame._canStandAt(640, 40),
        stopRight: stopRight.x,
        stopLeft: stopLeft.x,
        stopUp: stopUp.y,
        stopDown: stopDown.y,
        bounds: {
            left: collisionGame.bounds.left, right: collisionGame.bounds.right,
            top: collisionGame.bounds.top, bottom: collisionGame.bounds.bottom,
        },
        interactRadius: collisionGame.interactRadius,
        reachableCenterCount: reachableCenters.length,
        maxLanternDistance: Math.max.apply(null, lanternDistances),
        debug: { before: collisionDebugBefore, on: collisionDebugOn, off: collisionDebugOff },
    };

    // ---- 小游戏：逆流送灯（横版行舟：小船横置只上下动 / 障碍自右向左 / 清完全部 60 个障碍即送达 / 撞上即失败）----
    const boatGame = new BoatNavigationMiniGame();
    boatGame.start();
    boatGame.obstacleSpawnEnabled = false;      // 先关掉障碍，只验证横版几何 + 上下移动

    // 按住 ↑ 0.5s 顶到上沿；再按住 ↓ 1.0s 反向拉到底沿（X 全程不变）
    const boatStartY = boatGame.boat.y;
    for (let i = 0; i < 30; i++) boatGame.update(1 / 60, { keys: { w: true }, pressedKeys: {} });
    const afterUp = { x: boatGame.boat.x, y: boatGame.boat.y };
    for (let i = 0; i < 60; i++) boatGame.update(1 / 60, { keys: { arrowdown: true }, pressedKeys: {} });
    const afterDown = { x: boatGame.boat.x, y: boatGame.boat.y };

    // 剩余障碍物计数（左上角白色计数，取代倒计时）：开局 = 总数 60；每有一个障碍物漂出视野 -1
    const counterGame = new BoatNavigationMiniGame();
    counterGame.start();
    counterGame.obstacleSpawnEnabled = false;
    const counterAtStart = counterGame.getRemainingObstaclesText();
    const remainingAtStart = counterGame.getRemainingObstacles();
    const counterProbe = counterGame.spawnObstacle(300, 'rock');
    counterProbe.x = -counterProbe.width / 2 - 1;               // 直接摆到左屏外 → 本帧就「超出视野」
    counterGame.updateObstacles(0);
    const counterAfterOneGone = counterGame.getRemainingObstacles();
    const counterTextAfterOneGone = counterGame.getRemainingObstaclesText();

    R.boat = {
        // 美术 / 判定规格
        frameWidth: boatGame.boatFrameWidth,
        frameHeight: boatGame.boatFrameHeight,
        frameCount: boatGame.boatFrameCount,
        obstacleSize: boatGame.obstacleSize,
        boatX: boatGame.boatX,
        // 河道：默认 270~500（无碰撞图时）；有碰撞图则按图里的白色水域反推
        minY: boatGame.minY,
        maxY: boatGame.maxY,
        defaultRiverBand: boatGame.defaultRiverBand,
        riverBand: boatGame.riverBand,
        startY: boatStartY,
        afterUp: afterUp,
        afterDown: afterDown,
        // 剩余障碍物计数（取代倒计时）
        totalObstacles: boatGame.totalObstacles,
        timeLimit: boatGame.timeLimit,
        counterAtStart: counterAtStart,
        remainingAtStart: remainingAtStart,
        counterAfterOneGone: counterAfterOneGone,
        counterTextAfterOneGone: counterTextAfterOneGone,
        spawnedAfterOneGone: counterGame.spawnedObstacles,
        clearedAfterOneGone: counterGame.clearedObstacles,
    };

    // 障碍物：右侧进场 → 左移 → 出屏回收；两类（礁石 / 浮木）各一次；随机生成必落在河道内
    const flowGame = new BoatNavigationMiniGame();
    flowGame.start();
    const rockProbe = flowGame.spawnObstacle(300, 'rock');
    const spawnX = rockProbe.x;
    flowGame.updateObstacles(1 / 60);
    const movedX = rockProbe.x;
    const spawnedTypes = [flowGame.spawnObstacle(400, 'rock').type, flowGame.spawnObstacle(400, 'wood').type];
    const offscreenProbe = flowGame.spawnObstacle(400, 'rock');
    offscreenProbe.x = -offscreenProbe.width / 2 - 1;       // 完全移出左屏
    flowGame.updateObstacles(0);
    const recycled = flowGame.obstacles.indexOf(offscreenProbe) === -1;

    const randomGame = new BoatNavigationMiniGame();
    // 生成间隔爬坡改由「已生成个数 / 总数」驱动：开局（一个都还没生成）取起始间隔
    const intervalStartProbe = randomGame.getSpawnInterval();
    const randomYs = [];
    const randomTypes = [];
    for (let i = 0; i < 40; i++) {
        const obstacle = randomGame.spawnObstacle();
        randomYs.push(obstacle.y);
        randomTypes.push(obstacle.type);
    }
    R.boatFlow = {
        spawnX: spawnX,
        movedX: Math.round(movedX),
        leftShift: spawnX - movedX > 0,
        types: spawnedTypes.join(','),
        recycled: recycled,
        remaining: flowGame.obstacles.length,
        randomYInBand: randomYs.every(y => y >= randomGame.minY && y <= randomGame.maxY),
        randomYMin: Math.round(Math.min.apply(null, randomYs)),
        randomYMax: Math.round(Math.max.apply(null, randomYs)),
        randomTypes: Array.from(new Set(randomTypes)).sort().join(','),
        // 难度：生成间隔 1.6s → 1.3s（爬坡按「已生成个数 / 总数」驱动）
        intervalStart: intervalStartProbe,
        intervalEnd: (() => { randomGame.spawnedObstacles = randomGame.totalObstacles; return randomGame.getSpawnInterval(); })(),
    };

    // 碰撞：同一个 X、纵向叠上 → 立即 fail；纵向错开 → 擦不到
    const crashGame = new BoatNavigationMiniGame();
    crashGame.start();
    crashGame.obstacleSpawnEnabled = false;
    let crashResult = null;
    crashGame.onFail = (res) => { crashResult = res; };
    const crashObstacle = crashGame.spawnObstacle(crashGame.boat.y + 6, 'rock');
    crashObstacle.x = crashGame.boat.x + 40;                 // 压在船头判定框里
    const crashed = crashGame.checkCollisions();
    R.boatCrash = {
        collided: crashed,
        failed: crashGame.isFailed,
        completed: crashGame.isCompleted,
        resultSuccess: crashResult ? crashResult.success : null,
        obstacleType: crashObstacle.type,
    };

    const missGame = new BoatNavigationMiniGame();
    missGame.start();
    missGame.obstacleSpawnEnabled = false;
    missGame.boat.y = missGame.minY;
    const missObstacle = missGame.spawnObstacle(missGame.maxY, 'wood');
    missObstacle.x = missGame.boat.x;                        // 同一个 X，一上一下
    R.boatMiss = {
        collided: missGame.checkCollisions(),
        failed: missGame.isFailed,
        gap: missGame.maxY - missGame.minY,
    };

    // 可通关性：开着障碍，模拟一个「选更安全的一条边道」的玩家 —— 必须把 60 个障碍全部躲完
    // （单个障碍只占 96px 高，河道 230px 高，最短间隔 1.3s × 300px/s = 390px 间距 → 一定躲得开）
    // 随机数用固定序列，保证这条用例可复现（只影响本次小游戏实例）
    const realRandom = Math.random;
    let aiSeed = 20260912;
    Math.random = () => {
        aiSeed = (aiSeed * 1103515245 + 12345) % 2147483648;
        return aiSeed / 2147483648;
    };
    const aiGame = new BoatNavigationMiniGame();
    aiGame.start();
    let aiFrames = 0;
    let aiMaxObstacles = 0;
    let aiSpawned = 0;
    while (!aiGame.isCompleted && !aiGame.isFailed && aiFrames < 60 * 120) {
        // 像人一样：等「上一个障碍完全越过船身」（判定框不再重叠，dx < -90）再管下一个，
        // 取最近的那个、躲到离它最远的边道；它在 480px 反应窗外时保持当前纵向位置
        const pending = aiGame.obstacles
            .filter(o => (o.x - aiGame.boat.x) > -90)
            .sort((a, b) => a.x - b.x)[0];
        const reacting = !!(pending && (pending.x - aiGame.boat.x) < 480);
        const targetY = reacting
            ? ((pending.y - aiGame.minY) >= (aiGame.maxY - pending.y) ? aiGame.minY : aiGame.maxY)
            : aiGame.boat.y;
        const keys = {};
        if (aiGame.boat.y > targetY + 4) keys.w = true;
        else if (aiGame.boat.y < targetY - 4) keys.s = true;
        const before = aiGame.obstacles.length;
        aiGame.update(1 / 60, { keys: keys, pressedKeys: {} });
        if (aiGame.obstacles.length > before) aiSpawned++;
        aiMaxObstacles = Math.max(aiMaxObstacles, aiGame.obstacles.length);
        aiFrames++;
    }
    Math.random = realRandom;
    R.boatPassable = {
        completed: aiGame.isCompleted,
        failed: aiGame.isFailed,
        timeUsed: Math.round(aiGame.gameTimer * 10) / 10,
        maxOnScreen: aiMaxObstacles,
        spawnCycles: aiSpawned,
        totalObstacles: aiGame.totalObstacles,
        spawned: aiGame.spawnedObstacles,
        cleared: aiGame.clearedObstacles,
        remaining: aiGame.getRemainingObstacles(),
        leftOnScreen: aiGame.obstacles.length,
        spawnStopped: aiGame.obstacleSpawnEnabled === false,
        score: Math.round(aiGame.score),
    };

    // ---- Boss：渡厄使（动画规格 / 召唤小兵 / 小兵 AI）----
    main.currentMap = arenaMap;
    main.playerCombat = new PlayerCombatSystem({ main: main });
    main.player.position = { x: 640, y: 440 };

    const dueBoss = arenaMap.spawnArenaBoss('boss_due', arenaMap.mapConfig.bossPosition.boss_due);
    dueBoss.map = arenaMap;
    dueBoss.setTarget(main.player);
    dueBoss.startFight();
    dueBoss.position = { x: 640, y: 300 };

    const bossIdleAnim = dueBoss.animationManager.getAnimation('idle');
    const bossMoveAnim = dueBoss.animationManager.getAnimation('move');
    const bossDeadAnim = dueBoss.animationManager.getAnimation('dead');
    const facings = ['down', 'left', 'right', 'up'];

    R.boss = {
        animations: dueBoss.animationSpecs.map(spec => spec.name),
        frameSize: DueBoss.FRAME_SIZE,
        action: dueBoss.action,
        // 待机：列排列（4 列 = 下/左/右/上，每列 1 帧）
        idleDirectionMode: bossIdleAnim.directionMode,
        idleFrames: facings.map(dir => bossIdleAnim.directions[dir].frames),
        idleColumns: facings.map(dir => bossIdleAnim.directions[dir].col),
        // 其余动作：行排列 4 行（下/左/右/上）× 6 帧；dead 单行 6 帧
        moveRows: facings.map(dir => bossMoveAnim.directions[dir].row),
        moveFrames: bossMoveAnim.directions.down.frames,
        deadDirections: Object.keys(bossDeadAnim.directions),
        deadFrames: bossDeadAnim.directions.down.frames,
        cooldowns: { ...dueBoss.cooldowns },
    };

    // 召唤：冷却清零 → 动画播完生成 1 个小兵（上限 2）
    dueBoss.cooldowns.summon = 0;
    dueBoss.startSummon();
    const summonAction = dueBoss.action;
    for (let i = 0; i < 40; i++) dueBoss.update(0.05, arenaMap);
    const firstMinion = dueBoss.minions[0] || null;
    R.boss.summon = {
        action: summonAction,
        alive: dueBoss.aliveMinionCount(),
        inMap: Array.from(arenaMap.monsters.values()).filter(m => m instanceof DueMinion).length,
        minionAnimations: firstMinion ? firstMinion.animationSpecs.map(spec => spec.name) : [],
        minionFrameWidth: firstMinion ? DueMinion.FRAME_WIDTH : null,
        minionFrameHeight: firstMinion ? DueMinion.FRAME_HEIGHT : null,
        minionRows: firstMinion
            ? ['down', 'left', 'right', 'up'].map(dir => firstMinion.animationManager.getAnimation('move').directions[dir].row)
            : [],
        minionFrames: firstMinion
            ? {
                idle: firstMinion.animationManager.getAnimation('idle').directions.down.frames,
                move: firstMinion.animationManager.getAnimation('move').directions.down.frames,
                attack: firstMinion.animationManager.getAnimation('attack').directions.down.frames,
            }
            : null,
    };

    // 上限：再召一次仍是 2，第三个被拦下
    dueBoss.cooldowns.summon = 0;
    dueBoss.startSummon();
    for (let i = 0; i < 40; i++) dueBoss.update(0.05, arenaMap);
    const thirdSummon = dueBoss.spawnMinion();
    R.boss.summonCap = {
        alive: dueBoss.aliveMinionCount(),
        max: dueBoss.tuning.summonMaxMinions,
        thirdBlocked: thirdSummon === null,
    };

    // 「原地生成」：spawnMinion 把小兵放在 Boss 当前位置
    dueBoss.clearMinions();
    const minionsCleared = Array.from(arenaMap.monsters.values()).filter(m => m instanceof DueMinion).length;
    dueBoss.position = { x: 640, y: 300 };
    const minionAtBoss = dueBoss.spawnMinion();
    R.boss.summonSpawnPoint = {
        clearedFromMap: minionsCleared === 0,
        sameAsBoss: !!minionAtBoss
            && minionAtBoss.spawnPosition.x === 640 && minionAtBoss.spawnPosition.y === 300,
    };
    // 小兵行为树：自动追击（只走上下左右 + A* 寻路）→ 进入攻击范围出手
    const probeMinion = dueBoss.minions[0];
    probeMinion.position = { x: 640, y: 300 };
    probeMinion.target = main.player;
    main.player.position = { x: 640, y: 480 };
    main.player.playerData.health = main.player.playerData.maxHealth;
    main.player.isInvincible = false;
    main.player.invincibleTimer = 0;

    const minionStart = { x: probeMinion.position.x, y: probeMinion.position.y };
    let minionDiagonal = false;
    let minionSawAttack = false;
    let minionAttackLanded = false;
    probeMinion.onAttackLand = (minion, hit) => { if (hit) minionAttackLanded = true; };

    for (let i = 0; i < 80; i++) {
        const before = { x: probeMinion.position.x, y: probeMinion.position.y };
        probeMinion.update(0.05, arenaMap);
        if (Math.abs(probeMinion.position.x - before.x) > 0.001
            && Math.abs(probeMinion.position.y - before.y) > 0.001) minionDiagonal = true;
        if (probeMinion.action === 'attack') minionSawAttack = true;
    }

    R.boss.minion = {
        moved: probeMinion.position.x !== minionStart.x || probeMinion.position.y !== minionStart.y,
        diagonal: minionDiagonal,
        sawAttack: minionSawAttack,
        attackLanded: minionAttackLanded,
        distance: Math.round(probeMinion.getTargetDistance()),
        attackRange: probeMinion.tuning.attackRange,
        inMap: Array.from(arenaMap.monsters.values()).filter(m => m instanceof DueMinion).length,
    };

    // 普攻转发：战场内普攻只发给 Boss → Boss 一并转发给场上小兵（保证小兵能被普攻打死）
    const minionHealthBefore = probeMinion.health;
    probeMinion.position = { x: 640, y: 300 };
    dueBoss.handlePlayerAttack({
        rect: { x: 640 - 12, y: 300 - 12, width: 24, height: 24 },
        damage: 30,
        source: main.player,
    });
    R.boss.attackForward = {
        minionDamaged: probeMinion.health < minionHealthBefore,
        minionHealthBefore: minionHealthBefore,
        minionHealthAfter: probeMinion.health,
    };

    // 冲刺：不可打断（照常掉血、不改动作）+ 锁定轴高速位移 + 动画结束圆形判定
    dueBoss.clearMinions();
    dueBoss.health = dueBoss.maxHealth;
    dueBoss.cooldowns = { dash: 0, control: 999, summon: 999 };
    dueBoss.position = { x: 640, y: 300 };
    main.player.position = { x: 640, y: 440 };
    main.player.playerData.health = main.player.playerData.maxHealth;
    main.player.isInvincible = false;
    main.player.invincibleTimer = 0;

    dueBoss.startDash();
    const dashAction = dueBoss.action;
    const dashStartY = dueBoss.position.y;
    const dashDamageApplied = dueBoss.takeDamage(20, main.player);
    const dashStillDash = dueBoss.action === 'dash';
    const playerHpBeforeDash = main.player.playerData.health;

    // 只在冲刺进行中采样：验证只沿一个轴位移、且方向朝玩家（向下）
    let dashSameAxis = true;
    let dashMovedDown = false;
    for (let i = 0; i < 30; i++) {
        const wasDash = dueBoss.action === 'dash';
        const before = { x: dueBoss.position.x, y: dueBoss.position.y };
        dueBoss.update(0.05, arenaMap);
        if (!wasDash) continue;
        if (Math.abs(dueBoss.position.x - before.x) > 0.001) dashSameAxis = false;
        if (dueBoss.position.y - before.y > 0.001) dashMovedDown = true;
    }

    R.boss.dash = {
        action: dashAction,
        damageApplied: dashDamageApplied === true && dueBoss.health < dueBoss.maxHealth,
        uninterruptible: dashStillDash && dueBoss.action !== 'hurt',
        movedDown: dashMovedDown && dueBoss.position.y > dashStartY,
        sameAxis: dashSameAxis,
        playerDamaged: main.player.playerData.health < playerHpBeforeDash,
        actionAfter: dueBoss.action,
    };

    // 受击：打断可打断动作；受击动画播放中再次受伤不重播（本次播完即回到决策）
    dueBoss.health = dueBoss.maxHealth;
    dueBoss.cooldowns = { dash: 999, control: 999, summon: 999 };
    dueBoss.startIdle(0.2);
    const actionBeforeHurt = dueBoss.action;
    dueBoss.takeDamage(10, main.player);
    dueBoss.update(0.05, arenaMap);
    const actionAfterHurt = dueBoss.action;

    const hurtAnim = dueBoss.animationManager.getAnimation('hurt');
    const hurtFrameBeforeSecondHit = hurtAnim.currentFrame;
    dueBoss.takeDamage(10, main.player);        // 受击动画播放中再次受伤 → 不重播
    const hurtIgnoredDuringHurt = dueBoss.hurtQueued === false && dueBoss.action === 'hurt';

    let hurtRestarted = false;
    let hurtLeftAt = null;
    for (let i = 0; i < 30; i++) {
        dueBoss.update(0.05, arenaMap);
        if (dueBoss.action === 'hurt' && hurtAnim.currentFrame < hurtFrameBeforeSecondHit) {
            hurtRestarted = true;
        }
        if (dueBoss.action !== 'hurt') {
            hurtLeftAt = Math.round((i + 1) * 0.05 * 100) / 100;
            break;
        }
    }

    R.boss.hurt = {
        actionBefore: actionBeforeHurt,
        interrupted: actionAfterHurt === 'hurt',
        ignoredDuringHurt: hurtIgnoredDuringHurt,
        restarted: hurtRestarted,
        leftAt: hurtLeftAt,
    };

    // 移动：A* 轴对齐追击；进入攻击范围 / 超过最长移动时间即停（不斜走）
    //   站位说明：起点必须让渡厄使的脚下碰撞盒完全落在可通行瓦片上 —— 万灯台碰撞图
    //   底部两行（瓦片行 15-17）是黑的，把 Boss 停在 640,560 时它的脚下盒子会压进墙里，
    //   任何一步 tryMove 都会被判失败（游戏里不会出现：出生位与移动都保证盒子合法）。
    dueBoss.health = dueBoss.maxHealth;
    dueBoss.cooldowns = { dash: 999, control: 999, summon: 999 };
    dueBoss.position = { x: 640, y: 500 };
    main.player.position = { x: 640, y: 200 };
    dueBoss.startIdle(0.05);

    const moveStart = { x: dueBoss.position.x, y: dueBoss.position.y };
    let moveDiagonal = false;
    let sawMove = false;
    for (let i = 0; i < 60; i++) {
        const before = { x: dueBoss.position.x, y: dueBoss.position.y };
        dueBoss.update(0.05, arenaMap);
        if (dueBoss.action === 'move') sawMove = true;
        if (Math.abs(dueBoss.position.x - before.x) > 0.001
            && Math.abs(dueBoss.position.y - before.y) > 0.001) moveDiagonal = true;
    }

    R.boss.move = {
        sawMove: sawMove,
        diagonal: moveDiagonal,
        moved: dueBoss.position.y !== moveStart.y,
        distance: Math.round(dueBoss.getTargetDistance()),
        attackStopRange: dueBoss.tuning.attackStopRange,
        withinRange: dueBoss.getTargetDistance() <= dueBoss.tuning.attackStopRange + 1,
    };

    // 入场对白冻结：introLock 期间只站桩 —— 不移动、不使用任何招式、玩家零伤害
    //   （Main 在播 B01 战前对白前会打开该开关；此时玩家被锁输入，必须保证 Boss 不出手）
    dueBoss.health = dueBoss.maxHealth;
    dueBoss.cooldowns = { dash: 0, control: 0, summon: 0 };     // 全招式就绪，仍不应出手
    dueBoss.position = { x: 640, y: 380 };
    main.player.position = { x: 640, y: 460 };                  // 贴脸：未冻结时必定出手
    dueBoss.setIntroLock(true);
    const introLockStart = { x: dueBoss.position.x, y: dueBoss.position.y };
    const introLockHpBefore = main.player.playerData.health;
    const introLockActions = new Set();
    for (let i = 0; i < 40; i++) {
        dueBoss.update(0.05, arenaMap);
        introLockActions.add(dueBoss.action);
    }
    R.boss.introLock = {
        locked: dueBoss.introLock === true,
        actions: Array.from(introLockActions).join(','),
        stayed: dueBoss.position.x === introLockStart.x && dueBoss.position.y === introLockStart.y,
        playerUnhurt: main.player.playerData.health === introLockHpBefore,
    };
    dueBoss.setIntroLock(false);

    // 控制：动画播完 → 玩家头顶锁链 + 禁止一切按键 3 秒（由 Main 接管）；到时自动恢复
    dueBoss.clearMinions();
    dueBoss.health = dueBoss.maxHealth;
    dueBoss.cooldowns = { dash: 999, control: 0, summon: 999 };
    dueBoss.position = { x: 640, y: 380 };
    main.player.position = { x: 640, y: 480 };

    dueBoss.onControl = (boss, lockDuration) => main.startArenaControlLock(lockDuration);
    dueBoss.startControl();
    const controlAction = dueBoss.action;
    for (let i = 0; i < 40; i++) dueBoss.update(0.05, arenaMap);

    R.boss.control = {
        action: controlAction,
        lockDuration: dueBoss.tuning.controlLockDuration,
        inputBlocked: main.inputManager.inputBlocked === true,
        movementBlocked: main.inputManager.getInputState().movementBlocked === true,
        chainActive: main.playerCombat.isControlChainActive() === true,
        cooldown: Math.round(dueBoss.cooldowns.control),
    };

    // 禁键期间「键盘 / 技能零反应」：音效（sfx.ui_quest_panel / 各技能音效）不能离开行为单独出现。
    //   走真实入口：InputManager.handleKeyDown →（Main.bindInputEvents 挂的 onKeyDown）→ Main.handleKeyDown；
    //   技能侧再把同一份 getInputState() 喂给 PlayerCombatSystem.update（技能音效就在 try* 内部、校验之后）。
    //   下面「解锁对照」用同一套按键再跑一遍 —— 确认 ① 不是「本来就不会响」的空转。
    const lockProbeSaved = {
        sceneManager: main.sceneManager,
        questUI: main.questUI,
        mapTeleport: main.mapTeleport,
        unlocked: main.playerCombat.isUnlocked(),
        onKeyDown: main.inputManager.onKeyDown,
        playSfx: gameAudio.playSfx,
    };
    const lockProbeSfx = [];
    gameAudio.playSfx = function (key) { lockProbeSfx.push(key); return false; };

    const lockProbeSkills = [];
    ['tryAttack', 'tryCastLingxidan', 'tryHutishu', 'tryDodge', 'tryCastJianying'].forEach(fn => {
        const orig = main.playerCombat[fn].bind(main.playerCombat);
        // 记录「这个技能键有没有被捕获 / 施展成功」：只在真的走到 try* 里才会出现（音效就在里面）
        main.playerCombat[fn] = function () {
            const ok = orig();
            lockProbeSkills.push(fn + '=' + (ok === false ? 'false' : 'true'));
            return ok;
        };
    });

    const probeKeys = ['q', 'j', 'u', 'i', 'o', 'l'];
    function probePressKeys() {
        const rows = [];
        probeKeys.forEach(key => {
            // 每个键都从「任务栏关着 + 灵息/冷却就绪」开始，按键之间互不干扰
            main.questUI.isVisible = false;
            main.playerCombat.hurtLock = 0;
            main.playerCombat.casting = null;
            Object.keys(main.playerCombat.cooldowns).forEach(k => { main.playerCombat.cooldowns[k] = 0; });
            main.player.playerData.mana = main.player.playerData.maxMana || 100;
            lockProbeSfx.length = 0;
            lockProbeSkills.length = 0;

            main.inputManager.handleKeyDown({ key: key, repeat: false, preventDefault() {} });
            main.playerCombat.update(1 / 60, main.inputManager.getInputState());
            main.inputManager.clearFrameState();
            main.inputManager.handleKeyUp({ key: key, preventDefault() {} });
            main.inputManager.clearFrameState();

            rows.push({
                key: key,
                sfx: lockProbeSfx.slice(),
                skills: lockProbeSkills.slice(),
                questUIVisible: main.questUI.isVisible === true,
            });
        });
        return rows;
    }

    main.sceneManager = { getCurrentScene: () => ({ sceneId: 'gameWorld' }) };
    main.inputManager.onKeyDown = (key, event) => main.handleKeyDown(key, event);
    main.playerCombat.setUnlocked(true);
    main.player.isAlive = true;
    main.player.isInteracting = false;
    main.storyDialogueActive = false;
    main.isFoundationTrialPlaying = false;
    main.isCoreTrialPlaying = false;
    main.dialogBox.isVisible = false;
    main.questUI = { isVisible: false, update() {} };
    main.questUI.show = function () { QuestUI.prototype.show.call(this); };
    main.questUI.hide = function () { QuestUI.prototype.hide.call(this); };
    main.questUI.toggle = function () { QuestUI.prototype.toggle.call(this); };
    main.mapTeleport = { isVisible: false, update() {}, show() {}, hide() {} };

    // ① 锁定中（与渡厄使「控制」同一状态）
    const lockedRows = probePressKeys();
    const lockedCanCapture = main.playerCombat._canCaptureInput(main.inputManager.getInputState());
    const lockedStillBlocked = main.inputManager.isInputBlocked() === true;

    // ② 对照：解除封锁（其它状态一字不改）→ 同样的按键就该开任务栏 / 出招 / 响音效
    main.inputManager.setInputBlocked(false);
    const unlockedRows = probePressKeys();
    const unlockedCanCapture = main.playerCombat._canCaptureInput(main.inputManager.getInputState());

    R.boss.control.keyProbe = {
        keys: probeKeys.join(','),
        locked: { blocked: lockedStillBlocked, canCapture: lockedCanCapture, rows: lockedRows },
        unlocked: { canCapture: unlockedCanCapture, rows: unlockedRows },
    };

    // 还原现场：后续断言继续用真实的 questUI / sceneManager / 音效入口
    main.inputManager.setInputBlocked(true);
    if (lockProbeSaved.questUI) lockProbeSaved.questUI.isVisible = false;
    main.questUI = lockProbeSaved.questUI;
    main.sceneManager = lockProbeSaved.sceneManager;
    main.mapTeleport = lockProbeSaved.mapTeleport;
    main.playerCombat.setUnlocked(lockProbeSaved.unlocked);
    main.inputManager.onKeyDown = lockProbeSaved.onKeyDown;
    gameAudio.playSfx = lockProbeSaved.playSfx;

    for (let i = 0; i < 80; i++) main.updateBossArenaControlLock(0.05);
    R.boss.control.released = main.inputManager.inputBlocked === false
        && main.playerCombat.isControlChainActive() === false;

    // 战败：dead 播完停帧（最后一帧）+ 删除场上所有小兵
    dueBoss.spawnMinion();
    const minionsBeforeDeath = dueBoss.minions.length;
    dueBoss.health = 10;
    dueBoss.takeDamage(500, main.player);
    const deadAction = dueBoss.action;
    for (let i = 0; i < 40; i++) dueBoss.update(0.05, arenaMap);

    R.boss.dead = {
        action: deadAction,
        isAlive: dueBoss.isAlive,
        defeatSequenceFinished: dueBoss.isDefeatSequenceFinished(),
        finalFrame: dueBoss.animationManager.getAnimation('dead').currentFrame,
        minionsBefore: minionsBeforeDeath,
        minionsAfter: dueBoss.minions.length,
        minionsInMap: Array.from(arenaMap.monsters.values()).filter(m => m instanceof DueMinion).length,
    };

    // ---- 奖励 / 战败成长结算 ----
    // 新平衡：任务不再发奖（rewards 字段已全部移除），角色成长只来自两处：
    //   ① 境界基准（GameConfig.realms）：练气 150/70 → 筑基 400/250 → 结丹 1000/500
    //   ② Boss 战败成长（arenaDefeatBonus）：摄风山魈 +20/+10、渡厄使 +35/+20，各上限 5 次
    const questIds = ['chapter2_main_1', 'chapter2_main_2', 'chapter2_main_3',
        'chapter2_main_4', 'chapter2_ending_1', 'chapter2_ending_2'];
    const before = {
        lingShi: main.player.playerData.lingShi,
        maxHealth: main.player.playerData.maxHealth,
        maxMana: main.player.playerData.maxMana,
        health: main.player.playerData.health,
        professionSkillPoints: main.player.playerData.professionSkillPoints,
        huiyuanDan: main.player.inventory.getItemCount('huiyuan_dan'),
        huilingDan: main.player.inventory.getItemCount('huiling_dan'),
    };
    // 空 rewards 发奖：数值完全不变（applyQuestRewards 直接返回）
    const main2Quest = gameConfig.getQuest('chapter2_main_2') || {};
    main.applyQuestRewards('chapter2_main_2', main2Quest.rewards);
    R.rewards = {
        questRewardKeys: questIds.map(id => {
            const quest = gameConfig.getQuest(id) || {};
            return quest.rewards ? Object.keys(quest.rewards).length : 0;
        }),
        before: before,
        after: {
            lingShi: main.player.playerData.lingShi,
            maxHealth: main.player.playerData.maxHealth,
            maxMana: main.player.playerData.maxMana,
            health: main.player.playerData.health,
            professionSkillPoints: main.player.playerData.professionSkillPoints,
        },
        huiyuanDan: main.player.inventory.getItemCount('huiyuan_dan'),
        huilingDan: main.player.inventory.getItemCount('huiling_dan'),
    };

    // 结丹境界基准（尚无战败成长）：气血 1000 / 灵息 500 并回满（Main.applyRealmStats）
    main.applyRealmStats('jiedan');
    R.rewards.realm = main.player.playerData.realm;
    R.rewards.maxHealth = main.player.playerData.maxHealth;
    R.rewards.maxMana = main.player.playerData.maxMana;
    R.rewards.health = main.player.playerData.health;
    R.rewards.mana = main.player.playerData.mana;
    // 章末一不再发放技能 / 不再解锁照尘仙城（剑影连斩改由主线一试炼传授）
    R.rewards.jianying = main.player.professionSystem.getSkillLevel('jianying');
    R.rewards.zhaochenFlag = main.player.questSystem.hasStoryFlag('map_unlocked_zhaochen_xiancheng');

    // 渡厄使战败成长：以筑基基准 400/250 起算，每次 +35 气血 / +20 灵息上限，最多 5 次
    main.applyRealmStats('zhuji');
    const dueFailures = [];
    for (let i = 1; i <= 6; i++) {
        const applied = main.applyBossFailureBonus({
            mapId: 'boss_arena_ch2',
            defeatFlag: 'due_boss_defeated',
            defeatBonus: { id: 'boss_due', maxHealth: 35, maxMana: 20, maxFailures: 5 },
        });
        dueFailures.push({
            applied: applied,
            times: (main.player.playerData.bossFailures || {}).boss_due || 0,
            maxHealth: main.player.playerData.maxHealth,
            maxMana: main.player.playerData.maxMana,
        });
    }
    R.rewards.dueFailures = dueFailures;
    R.rewards.dueBonus = {
        maxHealthBonus: main.player.playerData.maxHealthBonus,
        maxManaBonus: main.player.playerData.maxManaBonus,
    };
    // 晋级结丹后累计加成继续生效：1000 + 175 / 500 + 100
    main.applyRealmStats('jiedan');
    R.rewards.realmWithBonus = {
        maxHealth: main.player.playerData.maxHealth,
        maxMana: main.player.playerData.maxMana,
        health: main.player.playerData.health,
        mana: main.player.playerData.mana,
    };
    // 摄风山魈战败成长（第一章 +20/+10）：同一套结算，独立计数
    main.applyRealmStats('lianqi');
    const shanxiaoApplied = main.applyBossFailureBonus({
        mapId: 'boss_arena_ch1',
        defeatFlag: 'boss_shanxiao_defeated',
        defeatBonus: { id: 'boss_shanxiao', maxHealth: 20, maxMana: 10, maxFailures: 5 },
    });
    R.rewards.shanxiao = {
        applied: shanxiaoApplied,
        maxHealth: main.player.playerData.maxHealth,
        maxMana: main.player.playerData.maxMana,
    };

    // 探针结束：清空战败成长状态（真实存档里这些值随存档保留），避免影响后续小节
    main.player.playerData.bossFailures = {};
    main.player.playerData.maxHealthBonus = 0;
    main.player.playerData.maxManaBonus = 0;

    main.player.playerData.realm = 'zhuji';
    main.player.playerData.stage = '初期';
    main.ensureFoundationPerfect();
    R.rewards.foundationStage = main.player.playerData.stage;

    main.player.questItemSystem = new QuestItemSystem();
    R.rewards.firstGrant = main.grantQuestItem('dengji_zhaie', 1, true);
    main.grantQuestItem('dengji_zhaie', 1, true);
    R.rewards.registryCount = main.player.questItemSystem.getItemCount('dengji_zhaie');

    // ---- 剑影连斩：第二章主线一「剑修基础连招试炼」传授（O 键 / 冷却 15s / 四向剑气）----
    const jyState = { learned: 0 };
    const jyEnemy = {
        position: { x: 800, y: 660 },       // 主角上方 140px
        isAlive: true, width: 32, height: 32, hp: 200,
        takeDamage(amount) { this.hp -= amount; return true; },
        getHitRect() {
            return { x: this.position.x - 16, y: this.position.y - 16, width: 32, height: 32 };
        },
    };
    const jyMap = {
        monsters: new Map([['jy_enemy', jyEnemy]]),
        isRectWalkable: () => true,         // 不作墙体拦截，只验证距离 / 命中逻辑
    };
    const jyPlayer = {
        position: { x: 800, y: 800 },
        facing: 'down',
        isAlive: true,
        isInBattle: false,
        isInteracting: false,
        moveSpeed: 200,
        playerData: { health: 200, maxHealth: 200, mana: 200, maxMana: 200 },
        professionSystem: {
            getAttackDamage: () => 10,
            getSkillLevel: (id) => (id === 'jianying' ? jyState.learned : 0),
        },
        animationManager: { hasAnimation: () => false },
        restoreMana() {},
        playIdleAnimation() {},
    };
    const jyMain = {
        player: jyPlayer,
        currentMap: jyMap,
        battleSystem: null,
        canvas: { width: 1280, height: 720 },
        sceneManager: { getCurrentScene: () => ({ sceneId: 'gameWorld' }) },
        questUI: { isVisible: false },
        dialogBox: { isVisible: false },
        mapTeleport: { isVisible: false },
        shop: { isOpen: false },
    };
    const jyCombat = new PlayerCombatSystem({ main: jyMain });
    jyCombat.setUnlocked(true);

    const jyCfg = jyCombat.config.jianying;
    R.jianying = {
        id: jyCfg.id, name: jyCfg.name, key: jyCfg.key,
        cooldown: jyCfg.cooldown, manaCost: jyCfg.manaCost,
        damage: jyCfg.damage, maxDistance: jyCfg.maxDistance, speed: jyCfg.projectileSpeed,
        frames: jyCfg.projectileFrames,
        frameSize: [jyCfg.projectileFrameWidth, jyCfg.projectileFrameHeight],
        rows: jyCfg.projectileRows,
        hitShape: jyCfg.hitShape,
        hitFrames: jyCfg.hitFrames,
        hitFrameSize: [jyCfg.hitFrameWidth, jyCfg.hitFrameHeight],
        castAnimation: jyCfg.castAnimation,
        inSkillBar: jyCombat.config.hud.skillBar.order.indexOf('jianying'),
        inSkillOrder: PlayerCombatSystem.SKILL_ORDER.indexOf('jianying'),
        directions: PlayerCombatSystem.JIANYING_DIRECTIONS.slice(),
    };

    // 未习得：按 O 完全无响应（技能栏也不出格）
    jyCombat.update(1 / 60, { pressedKeys: { o: true } });
    R.jianying.beforeLearn = {
        unlocked: jyCombat.isSkillUnlocked('jianying'),
        projectiles: jyCombat.projectiles.length,
        mana: jyPlayer.playerData.mana,
    };

    // 习得后：按 O → 四向剑气（上 / 下 / 左 / 右）+ 扣灵息 + 进入 15 秒冷却
    jyState.learned = 1;
    R.jianying.unlockedAfterLearn = jyCombat.isSkillUnlocked('jianying');
    jyCombat.update(1 / 60, { pressedKeys: { o: true } });
    const jySpawned = jyCombat.projectiles.slice();
    R.jianying.cast = {
        count: jySpawned.length,
        directions: jySpawned.map(p => p.direction).join(','),
        manaSpent: 200 - jyPlayer.playerData.mana,
        cooldown: jyCombat.cooldowns.jianying,
        label: jySpawned[0] ? jySpawned[0].label : null,
        hitShape: jySpawned[0] && jySpawned[0].hitEffect ? jySpawned[0].hitEffect.shape : null,
        hitFrames: jySpawned[0] && jySpawned[0].hitEffect ? jySpawned[0].hitEffect.frameCount : null,
    };

    // 冷却中再按 O：不施展（提示"冷却中"）
    jyCombat.toast.text = '';
    jyCombat.update(1 / 60, { pressedKeys: { o: true } });
    R.jianying.cooldownBlock = { toast: jyCombat.toast.text, projectiles: jyCombat.projectiles.length };

    // 飞行：朝上那道剑气命中敌人 → 敌人掉血、剑气消失、命中点生成"透明渐变扩大的圆"特效
    for (let i = 0; i < 30; i++) jyCombat.update(1 / 60, { pressedKeys: {} });
    R.jianying.hit = {
        enemyHp: jyEnemy.hp,
        damage: 200 - jyEnemy.hp,
        projectilesLeft: jyCombat.projectiles.length,
        hitEffects: jyCombat.effects.filter(e => e.shape === 'ring_expand').length,
    };

    // 其余三道剑气飞满最大距离后自行消失（超出 maxDistance 即回收）
    for (let i = 0; i < 80; i++) jyCombat.update(1 / 60, { pressedKeys: {} });
    R.jianying.expired = {
        projectiles: jyCombat.projectiles.length,
        effectsLeft: jyCombat.effects.length,
    };

    // 受伤不打断：剑气已在飞行途中受伤，弹体照旧存在并继续推进
    jyCombat.cooldowns.jianying = 0;
    jyCombat.hurtLock = 0;
    jyCombat.update(1 / 60, { pressedKeys: { o: true } });
    const jyBeforeHurt = jyCombat.projectiles.length;
    const jyHurt = jyCombat.onPlayerHurt();
    const jyMovedBefore = jyCombat.projectiles.length > 0 ? { ...jyCombat.projectiles[0].position } : null;
    for (let i = 0; i < 5; i++) jyCombat.update(1 / 60, { pressedKeys: {} });
    const jyMovedAfter = jyCombat.projectiles.length > 0 ? { ...jyCombat.projectiles[0].position } : null;
    R.jianying.hurtNotInterrupt = {
        before: jyBeforeHurt,
        after: jyCombat.projectiles.length,
        hurtAnimation: jyHurt.playHurtAnimation,
        flew: !!jyMovedBefore && !!jyMovedAfter
            && (jyMovedAfter.x !== jyMovedBefore.x || jyMovedAfter.y !== jyMovedBefore.y),
    };

    // 程序化表现自检（美术尚未到位时也要能画）：剑气 sword_qi + 命中 ring_expand 渲染不抛异常
    const jyCtx = document.getElementById('gameCanvas').getContext('2d');
    const jyCamera = { getRenderPosition: () => ({ x: 0, y: 0 }) };
    let jyRenderError = null;
    let jyRingRenders = 0;
    try {
        jyCombat.renderOverLayer(jyCtx, jyCamera);          // 四道程序化剑气（无精灵图）
        const jyRing = new CombatEffect({
            name: 'jy_hit_probe', shape: 'ring_expand',
            frameWidth: 96, frameHeight: 96, frameCount: 6, loop: false,
            color: '#bfe9ff', position: { x: 320, y: 220 },
        });
        for (let i = 0; i < 6; i++) {
            jyRing.render(jyCtx, jyCamera);
            jyRing.update(1 / 14);
            jyRingRenders++;
        }
    } catch (error) {
        jyRenderError = String((error && error.message) || error);
    }
    R.jianying.procedural = {
        error: jyRenderError,
        ringRenders: jyRingRenders,
        projectilesRendered: jyCombat.projectiles.length,
    };

    // ---- 教学圈门控：第二章试炼只有一个剑影连斩圈（737,1079），未习得时也必须能站在圈内按 O ----
    //   圈的 actionType 必须等于 CONFIG.jianying.trainingAction，否则 canUseAction 恒为 false，
    //   教学圈永远完不成 → 主线一第 3 步（complete_training/sword）会卡死。
    const jyTrainingAction = jyCfg.trainingAction;
    const jyLayout = Chapter2Config.getSwordTrainingLayout();
    const jyTraining = new TrainingManager();
    jyTraining.startBasicTraining(null, { layout: jyLayout, target: 'sword', label: '剑修连招试炼' });
    jyMain.trainingManager = jyTraining;
    jyState.learned = 0;                        // 未习得
    jyCombat.projectiles.length = 0;
    jyCombat.cooldowns.jianying = 0;
    jyCombat.toast.text = '';
    jyCombat.toast.timer = 0;
    jyCombat.hurtLock = 0;                      // 清掉上一步受伤测试留下的僵直（否则按键被吞）
    jyCombat.casting = null;
    jyPlayer.playerData.mana = 200;

    // 1) 圈内：按 O 可施展（4 道剑气）并完成教学圈 → 全部完成（onAllCompleted 会传授技能）
    jyPlayer.position = { x: 737, y: 1079 };
    jyTraining.update(0, jyPlayer);
    const jyInZoneUsable = jyCombat.canUseAction('jianying');
    jyCombat.update(1 / 60, { pressedKeys: { o: true } });
    const jyInsideProjectiles = jyCombat.projectiles.length;
    const jyCompletedInZone = jyTraining.completedCount === jyTraining.zones.length;

    // 2) 圈外（码头栈道入口）：仍未习得 → O 不施展，只提示先走到教学圈内
    const jyTraining2 = new TrainingManager();
    jyTraining2.startBasicTraining(null, { layout: jyLayout, target: 'sword', label: '剑修连招试炼' });
    jyMain.trainingManager = jyTraining2;
    jyCombat.projectiles.length = 0;
    jyCombat.cooldowns.jianying = 0;
    jyCombat.toast.text = '';
    jyCombat.toast.timer = 0;
    jyCombat.hurtLock = 0;
    jyCombat.casting = null;
    jyPlayer.position = { x: 528, y: 1392 };
    jyTraining2.update(0, jyPlayer);
    jyCombat.update(1 / 60, { pressedKeys: { o: true } });

    R.training = {
        layoutCount: jyLayout.length,
        layoutId: jyLayout[0] ? jyLayout[0].id : null,
        layoutAction: jyLayout[0] ? jyLayout[0].actionType : null,
        layoutKey: jyLayout[0] ? jyLayout[0].actionKey : null,
        layoutPosition: jyLayout[0] ? jyLayout[0].position : null,
        jianyingTrainingAction: jyTrainingAction,
        actionMatchesConfig: jyLayout.every(z => z.actionType === jyTrainingAction),
        inZoneUsable: jyInZoneUsable,
        insideProjectiles: jyInsideProjectiles,
        completedInZone: jyCompletedInZone,
        allCompleted: jyTraining.isActive === false,
        currentTarget: jyTraining.currentTarget,
        currentLabel: jyTraining.currentLabel,
        outsideProjectiles: jyCombat.projectiles.length,
        outsideToast: jyCombat.toast.text,
    };

    // ---- 任务门控：主线一没推进到第 3 步（complete_training/sword）时不得放教学圈 ----
    //   否则刚进章节跟陆舟闲聊就能开练：任务系统会拒收那一步的进度（前两步还没做），
    //   但试炼圈与技能发放已被提前消耗 → 主线一从此卡死。
    const gateSavedTraining = main.trainingManager;
    const gateSavedQuestSystem = main.player.questSystem;
    const gateSavedNotify = main.addGameNotification;
    const gateSystem2 = new QuestSystem();
    gateSystem2.registerAllQuests();
    gateSystem2.acceptQuest('chapter2_main_1');
    main.player.questSystem = gateSystem2;
    main.trainingManager = new TrainingManager();
    main.addGameNotification = () => {};

    main.startSwordTraining(null);                                    // 第 1 步（找许录）：不该放圈
    const gateBlockedAtStep1 = main.trainingManager.isActive === false;

    gateSystem2.updateQuestProgress('chapter2_main_1', 'talk_to', 'xulu', 1);
    main.startSwordTraining(null);                                    // 第 2 步（核对旧航线）：仍不该放圈
    const gateBlockedAtStep2 = main.trainingManager.isActive === false;

    gateSystem2.updateQuestProgress('chapter2_main_1', 'talk_to', 'luzhou', 1);
    main.startSwordTraining(null);                                    // 第 3 步：正常放圈
    const gateOpenedAtStep3 = main.trainingManager.isActive === true;

    main.trainingManager = gateSavedTraining;
    main.player.questSystem = gateSavedQuestSystem;
    main.addGameNotification = gateSavedNotify;

    // 闲聊对白不再能启动试炼（这条一旦回归，就是“刚进章节即可执行 complete_training”）
    const luzhouIdleNode = Chapter2Config.getNPCConfigs().luzhou.dialogues.c2_luzhou_idle;
    R.training.idleChatStartsTrial = (luzhouIdleNode.options || [])
        .some(option => option.action === 'start_sword_training');
    R.training.gateBlockedAtStep1 = gateBlockedAtStep1;
    R.training.gateBlockedAtStep2 = gateBlockedAtStep2;
    R.training.gateOpenedAtStep3 = gateOpenedAtStep3;
    jyMain.trainingManager = null;

    // 传授路径：主线一试炼完成 → Main.onAllCompleted(sword) → learnProfessionSkill('jianying')
    // （Runner 不跑完整 initGameSystems，这里调用同一方法；Main.js 的 sword 分支接线由
    //   smoke_chapter2.js 静态检查 learnProfessionSkill('jianying')）
    const jyNotifications = [];
    main.addGameNotification = (message) => jyNotifications.push(message);
    const jyLearned = main.learnProfessionSkill('jianying');
    R.jianying.learn = {
        learned: jyLearned,
        level: main.player.professionSystem.getSkillLevel('jianying'),
        notifications: jyNotifications.slice(),
        repeat: main.learnProfessionSkill('jianying'),
        levelAfterRepeat: main.player.professionSystem.getSkillLevel('jianying'),
    };

    // ---- 正式入口：真实走一次 Main.enterBossArena（诊断“按 E 到底能不能开打”）----
    //   只打桩 switchToMap / 资源预加载：验证 进场 → 打赢过的判定 → 渡厄使不再生成 → 记录返回点。
    const entryArena = new GameMap('boss_arena_ch2', C2_MAP.boss_arena_ch2,
        { backgroundImage: null, collisionImage: null });
    entryArena.init();
    entryArena.setArenaBossDefeated(true);                          // 模拟“上一次已经打赢”
    const entryBossBefore = !!entryArena.ensureArenaBoss();          // 应为 false（本图不再生成）

    const entrySystem = new QuestSystem();
    entrySystem.setStoryFlag('chapter2_b01_seen');                   // 跳过 B01 对白（对白另有断言）
    entrySystem.setStoryFlag('due_boss_defeated', true);             // 上一轮打赢留下的击败标记

    const savedEntry = {
        currentMap: main.currentMap,
        activeArena: main.activeArena,
        questSystem: main.player.questSystem,
        switchToMap: main.switchToMap,
        preload: main.preloadBossArenaImages,
        victoryHandled: main.bossArenaVictoryHandled,
    };
    main.currentMap = yunMap;
    main.player.questSystem = entrySystem;
    main.switchToMap = async () => { main.currentMap = entryArena; return entryArena; };
    main.preloadBossArenaImages = async () => {};
    main.bossArenaVictoryHandled = true;                             // 上一场的结算标记（进场应重置）
    await main.enterBossArena(wandengtai);                           // 正式入口：万灯台石台
    const entryBoss = entryArena.arenaBoss;
    const entryExitArray = entryArena.teleporters.get('teleport_boss_exit');
    R.gates.arenaEntry = {
        bossBeforeEnter: entryBossBefore,
        bossAfterEnter: !!entryBoss,                                 // 应为 false：打赢过就不再生成
        bossAlive: entryArena.hasArenaBoss(),
        defeatFlagAfterEnter: entrySystem.hasStoryFlag('due_boss_defeated'),
        arenaFlag: main.activeArena ? main.activeArena.defeatFlag : null,
        arenaGroup: main.activeArena ? main.activeArena.resourceGroup : null,
        victoryHandled: main.bossArenaVictoryHandled,
        exitArrayCreated: !!entryExitArray,
        exitPromptText: entryExitArray ? entryExitArray.promptText : null,
        returnPoint: main.bossArenaReturn
            ? { mapId: main.bossArenaReturn.mapId, x: main.bossArenaReturn.x, y: main.bossArenaReturn.y }
            : null,
        interacting: main.player.isInteracting,
    };
    main.currentMap = savedEntry.currentMap;
    main.activeArena = savedEntry.activeArena;
    main.player.questSystem = savedEntry.questSystem;
    main.switchToMap = savedEntry.switchToMap;
    main.bossArenaVictoryHandled = savedEntry.victoryHandled;

    // ---- 首次进场（正式入口）：应先播 B01 战前对白，对白读完才生成渡厄使 ----
    //   （回归：Main 曾经只有 setStoryFlag、没有 hasStoryFlag → 进第二章战场直接抛 TypeError）
    const firstArena = new GameMap('boss_arena_ch2', C2_MAP.boss_arena_ch2,
        { backgroundImage: null, collisionImage: null });
    firstArena.init();
    firstArena.setArenaBossDefeated(true);
    const firstSystem = new QuestSystem();                          // 全新存档：没有任何剧情标记
    const firstDialogues = [];
    const savedPlayDialogue = main.playStoryDialogue;
    main.currentMap = yunMap;
    main.player.questSystem = firstSystem;
    main.switchToMap = async () => { main.currentMap = firstArena; return firstArena; };
    main.preloadBossArenaImages = async () => {};                   // 同上：不打桩会等真实图片加载而挂住
    main.playStoryDialogue = (id, prefix, onDone) => { firstDialogues.push({ id, prefix, onDone }); };
    await main.enterBossArena(wandengtai);                          // 正式入口：万灯台石台
    const firstBossDuringDialogue = !!firstArena.arenaBoss;
    const firstIntroLockDuringDialogue = firstArena.arenaIntroLock === true;
    const firstB01Flag = firstSystem.hasStoryFlag('chapter2_b01_seen');
    if (firstDialogues[0] && typeof firstDialogues[0].onDone === 'function') {
        firstDialogues[0].onDone();                                 // 对白读完 → 回调开战
    }
    const firstBossAfterDialogue = !!firstArena.arenaBoss;
    const firstIntroLockAfterDialogue = firstArena.arenaIntroLock === false;
    R.gates.firstEntry = {
        dialogueId: firstDialogues.length ? firstDialogues[0].id : null,
        dialoguePrefix: firstDialogues.length ? firstDialogues[0].prefix : null,
        hasCallback: firstDialogues.length ? typeof firstDialogues[0].onDone === 'function' : false,
        bossDuringDialogue: firstBossDuringDialogue,
        introLockDuringDialogue: firstIntroLockDuringDialogue,
        introLockAfterDialogue: firstIntroLockAfterDialogue,
        b01FlagSet: firstB01Flag,
        bossAfterDialogue: firstBossAfterDialogue,
    };
    main.playStoryDialogue = savedPlayDialogue;
    main.preloadBossArenaImages = savedEntry.preload;
    main.switchToMap = savedEntry.switchToMap;
    main.currentMap = savedEntry.currentMap;
    main.player.questSystem = savedEntry.questSystem;

    // ---- 资源登记 / 剧情对白 ----
    const rm = ResourceManager.getInstance();
    const keys = [
        'mapBackgrounds.yunduze', 'mapCollisions.yunduze',
        'mapBackgrounds.boss_arena_ch2', 'mapCollisions.boss_arena_ch2',
        'npc.luzhou_idle', 'npc.jiangpo_idle', 'npc.jiangpo_idle_after',
        'npc.jiangwan_idle', 'npc.chenli_idle', 'npc.xulu_idle',
        'signposts.lantern_identify', 'signposts.river_escort', 'teleportArrays.wandengtai',
        'windPiles.verify_rack', 'windPiles.zhangce_stand', 'windPiles.mingling_stand',
        'monsters.boss_due_idle', 'monsters.boss_due_move', 'monsters.boss_due_dash',
        'monsters.boss_due_summon', 'monsters.boss_due_control', 'monsters.boss_due_hurt',
        'monsters.boss_due_dead', 'monsters.boss_due_minion_idle', 'monsters.boss_due_minion_move',
        'monsters.boss_due_minion_attack', 'effects.boss_due_chain',
        'questItems.dengji_zhaie', 'questItems.jiangwan_jiashu', 'questItems.hundeng_jiangwan',
        'questItems.hundeng_chenli', 'questItems.tongxing_pingzheng',
        'questItems.zhuanyun_zhangce', 'questItems.taixuan_mingling',
        'miniGame.rendeng_bg',
        'miniGame.rendeng_deng_off', 'miniGame.rendeng_deng_on',
        // 认灯台碰撞图（1280×720，白 = 可走 / 黑 = 阻挡 → 折成 32×18 瓦片表）
        'miniGame.rendeng_collision',
        // 第二章小游戏：逆流送灯（横版行舟：小船单行 4 帧 128×104 / 礁石 · 浮木 96×96 /
        // 河道背景 + 河道碰撞图 1280×720）
        'miniGame.xingzhou_bg', 'miniGame.xingzhou_boat', 'miniGame.xingzhou_rock',
        'miniGame.xingzhou_wood', 'miniGame.xingzhou_collision',
        // 剑影连斩（第二章主线一试炼传授）的剑气 / 命中特效 / 技能栏图标
        'effects.player_jianying', 'effects.player_jianying_hit', 'ui.skill_jianying',
    ];
    R.resources = {
        missing: keys.filter(k => !rm.getImagePath(k)),
        bossArenaCh2: rm.getResourceGroup('bossArenaCh2').images.length,
    };

    // ---- 飘落物（落叶 / 落花）：只在前两章主图 + 开始界面 / 完结界面显示 ----
    //      数量上限可调（maxCount）、轨迹不是直线、12 帧循环、飘出边界即回收
    R.foliage = (() => {
        const ch1Maps = Chapter1Config.getMapConfigs();
        const built = {
            qinglan_fuye: new GameMap('qinglan_fuye', ch1Maps.qinglan_fuye,
                { backgroundImage: null, collisionImage: null }),
            yunduze: new GameMap('yunduze', C2_MAP.yunduze,
                { backgroundImage: null, collisionImage: null }),
            boss_arena_ch1: new GameMap('boss_arena_ch1', ch1Maps.boss_arena_ch1,
                { backgroundImage: null, collisionImage: null }),
            boss_arena_ch2: new GameMap('boss_arena_ch2', C2_MAP.boss_arena_ch2,
                { backgroundImage: null, collisionImage: null }),
        };
        Object.keys(built).forEach(id => built[id].init());

        const enabled = {};
        const maxCount = {};
        const hasInstance = {};
        Object.keys(built).forEach(id => {
            const map = built[id];
            hasInstance[id] = !!map.foliage;
            enabled[id] = !!(map.foliage && map.foliage.isEnabled());
            maxCount[id] = map.ambientConfig.fallingFoliage.maxCount;
        });

        // 活动范围 = 摄像机视口（有摄像机）/ 整张地图（无摄像机）
        const yun = built.yunduze;
        const fakeCamera = { width: 1280, height: 720, getRenderPosition: () => ({ x: 300, y: 200 }) };
        const areaWithCamera = yun.getFoliageArea(fakeCamera);
        const areaWithoutCamera = yun.getFoliageArea(null);

        // 数量上限：maxCount 调成 3 → 连跑 10 秒峰值也不超过 3
        const probe = yun.foliage;
        probe.setArea({ x: 0, y: 0, width: 1280, height: 720 });
        probe.applyConfig({ enabled: true, maxCount: 3, spawnRate: 60 });
        probe.reset();
        let peak = 0;
        for (let i = 0; i < 600; i++) {
            probe.update(1 / 60);
            peak = Math.max(peak, probe.getCount());
        }
        const cappedConfig = probe.config.maxCount;

        // 轨迹：固定参数后横向必须左右往复（不是直线），竖向一直在下落
        const solo = new FallingFoliage({ area: { x: 0, y: 0, width: 1000, height: 1000 }, maxCount: 0 });
        const p = solo.spawn();
        p.drift = 0; p.swaySpeed = 40; p.swayFrequency = 0.5; p.swayPhase = 0;
        p.vy = 30; p.gravity = 0; p.spinAmplitude = 0; p.spinFrequency = 0; p.spinPhase = 0;
        p.baseAlpha = 1; p.age = 0; p.frameTimer = 0; p.frameIndex = 0;
        solo.particles = [p];
        const xs = [];
        const frameSeen = {};
        let descending = true;
        let lastY = p.y;
        // 跑 2 秒（120 帧）：摆动频率 0.5Hz → 正弦在 [0,2s] 内正负交替（能看出左右往复）
        for (let i = 0; i < 120; i++) {
            solo.update(1 / 60);
            xs.push(p.x);
            if (p.y <= lastY) descending = false;
            lastY = p.y;
            frameSeen[p.frameIndex] = true;
        }
        const dx = xs.slice(1).map((x, idx) => x - xs[idx]);
        const trail = {
            wentLeft: dx.filter(d => d < -1e-9).length,
            wentRight: dx.filter(d => d > 1e-9).length,
            xMonotonic: dx.every(d => d >= -1e-9) || dx.every(d => d <= 1e-9),
            descending: descending,
            frameCount: Object.keys(frameSeen).length,
            frameIndexAfter2s: p.frameIndex,
        };

        // 回收：沉到下边界之外即被移除
        p.y = 100000;
        solo.update(1 / 60);
        const recycled = solo.getCount() === 0;

        // 关闭开关：enabled = false → 清空且不再生成
        probe.applyConfig({ enabled: false, maxCount: 10, spawnRate: 60 });
        probe.update(1 / 60);
        const disabledCount = probe.getCount();
        probe.setEnabled(true);

        return {
            spriteKeys: FallingFoliage.SPRITE_SPECS.map(s => s.key),
            mapWhitelist: FallingFoliage.FOLIAGE_MAP_IDS.join(','),
            frameSpec: {
                frameWidth: FallingFoliage.DEFAULT_CONFIG.frameWidth,
                frameHeight: FallingFoliage.DEFAULT_CONFIG.frameHeight,
                frameCount: FallingFoliage.DEFAULT_CONFIG.frameCount,
                fps: FallingFoliage.DEFAULT_CONFIG.fps,
            },
            resourcePaths: {
                leaf: rm.getImagePath('foliage.falling_leaf'),
                flower: rm.getImagePath('foliage.falling_flower'),
                group: rm.getResourceGroupImagePaths('foliage'),
            },
            mapChecks: { enabled: enabled, hasInstance: hasInstance, maxCount: maxCount },
            areaWithCamera: areaWithCamera,
            areaWithoutCamera: areaWithoutCamera,
            cappedPeak: peak,
            cappedConfig: cappedConfig,
            trail: trail,
            recycled: recycled,
            disabledCount: disabledCount,
        };
    })();
    // ---- 14) 音频：背景音乐（循环）+ 音效（单次）----
    //     资源登记 / 播放行为 / 回主图 10 秒倒计时（重复调度重新计时）/ 进小游戏·Boss 关立即停 /
    //     受伤音效不叠加 / 缺失音频文件不报错（见 tools/音频资源清单.txt）
    R.audio = {};
    {
        const rm = ResourceManager.getInstance();

        // 14.1 资源登记：键 → 文件路径 + 资源分组
        const bgmKeys = ['bgm.main_menu', 'bgm.qinglan', 'bgm.yunduze',
            'bgm.minigame_boat', 'bgm.minigame_herb', 'bgm.ending'];
        const sfxKeys = [
            'sfx.player_attack', 'sfx.player_lingxidan', 'sfx.player_hutishu',
            'sfx.player_dodge', 'sfx.player_jianying', 'sfx.player_hurt', 'sfx.pickup',
            'sfx.boss_shanxiao_charge', 'sfx.boss_shanxiao_sweep', 'sfx.boss_shanxiao_pounce',
            'sfx.boss_shanxiao_slam', 'sfx.boss_shanxiao_hurt', 'sfx.boss_shanxiao_defeat',
            'sfx.boss_due_summon', 'sfx.boss_due_dash', 'sfx.boss_due_control',
            'sfx.boss_due_hurt', 'sfx.boss_due_defeat',
            'sfx.ui_hover', 'sfx.ui_click', 'sfx.ui_quest_panel',
            'sfx.minigame_lantern_light', 'sfx.minigame_lantern_extinguish',
            'sfx.victory', 'sfx.defeat',
        ];
        const paths = {};
        bgmKeys.concat(sfxKeys).forEach(key => { paths[key] = rm.getAudioPath(key); });
        R.audio.keys = { bgmCount: bgmKeys.length, sfxCount: sfxKeys.length, paths: paths };
        R.audio.groups = {
            mainMenu: rm.getResourceGroup('mainMenu').audio.join(','),
            ending: rm.getResourceGroup('ending').audio.join(','),
            playerCombat: rm.getResourceGroup('playerCombat').audio.join(','),
            bossArena: rm.getResourceGroup('bossArena').audio.join(','),
            bossArenaCh2: rm.getResourceGroup('bossArenaCh2').audio.join(','),
        };
        R.audio.statics = {
            mapBgm: AudioManager.MAP_BGM,
            minigameBgm: AudioManager.MINIGAME_BGM,
            returnDelay: AudioManager.MAP_BGM_RETURN_DELAY,
            poolSize: AudioManager.SFX_POOL_SIZE,
            sfxMinInterval: AudioManager.SFX_MIN_INTERVAL,
            mapBgmQinglan: AudioManager.getMapBgmKey('qinglan_fuye'),
            mapBgmYunduze: AudioManager.getMapBgmKey('yunduze'),
            mapBgmArena: AudioManager.getMapBgmKey('boss_arena_ch1'),
            boatBgm: AudioManager.getMinigameBgmKey('boat_navigation'),
            herbBgm: AudioManager.getMinigameBgmKey('herb_collect'),
            lanternBgm: AudioManager.getMinigameBgmKey('lantern_identify'),
            isMapBgm: AudioManager.isMapBgm('bgm.qinglan'),
            isMapBgmEnding: AudioManager.isMapBgm('bgm.ending'),
        };
    }

    // 14.2 播放行为：用可观测的 Audio 桩替换环境里的桩（play / pause 会记录状态）
    {
        const manager = AudioManager.getInstance();
        const originalAudio = globalThis.Audio;
        const created = [];
        globalThis.Audio = class {
            constructor() {
                this.loop = false;
                this.volume = 1;
                this.currentTime = 0;
                this.src = '';
                this._playing = false;
                created.push(this);
            }
            get paused() { return !this._playing; }
            play() { this._playing = true; return Promise.resolve(); }
            pause() { this._playing = false; }
            addEventListener() {}
        };

        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        // 音效：单次播放（不循环）、可叠加（池上限 4）、受伤音效互斥
        const sfxStarted = manager.playSfx('sfx.player_attack');
        const sfxAudio = created[created.length - 1];
        const sfxLoop = sfxAudio.loop;
        const sfxPlaying = manager.isSfxPlaying('sfx.player_attack');
        const exclusiveWhilePlaying = manager.playSfxExclusive('sfx.player_attack');
        sfxAudio.pause();
        const exclusiveAfterStop = manager.playSfxExclusive('sfx.player_attack');

        // 同种音效节流（需求：同一音效 0.2 秒内不重复播放）——用固定时钟精确验证边界
        const throttleClock = { t: 0 };
        manager._now = () => throttleClock.t;
        const throttleFirst = manager.playSfx('sfx.ui_click');            // true：首次
        const throttleRepeat = manager.playSfx('sfx.ui_click');           // false：同一瞬间重复
        throttleClock.t += 199;
        const throttleBeforeWindow = manager.playSfx('sfx.ui_click');     // false：0.199 秒 < 0.2
        throttleClock.t += 2;
        const throttleAfterWindow = manager.playSfx('sfx.ui_click');      // true：0.201 秒 ≥ 0.2
        const throttleOtherKey = manager.playSfx('sfx.ui_hover');         // true：别的键不受影响
        // 换回「每次 +1 秒」的时钟：后面重复播放不再被节流（用来验证池上限）
        manager._now = function () { audioClockMs += 1000; return audioClockMs; };

        for (let i = 0; i < 6; i++) manager.playSfx('sfx.ui_click');
        const uiEntry = manager._sfxCache.get('sfx.ui_click');

        // 背景音乐：循环（loop = true）、同一首不重头播
        const bgmStarted = manager.playBgm('bgm.qinglan');
        const bgmAudio = created[created.length - 1];
        const bgmLoop = bgmAudio.loop;
        const bgmKeyAfterPlay = manager.currentBgmKey;
        const bgmPlaying = manager.isBgmPlaying();
        manager.playBgm('bgm.qinglan');
        const bgmElementKept = manager.bgmElement === bgmAudio && manager._bgmCache.size === 1;

        // 换图：立即停当前 + 10 秒倒计时；重复调度重新计时
        const scheduled = manager.scheduleBgm('bgm.yunduze');
        const afterSchedule = {
            current: manager.currentBgmKey,
            scheduled: manager.getScheduledBgmKey(),
            timer: manager.getScheduledBgmRemaining(),
        };
        manager.update(9);
        const timerAfter9 = manager.getScheduledBgmRemaining();
        manager.scheduleBgm('bgm.yunduze');
        const timerAfterReschedule = manager.getScheduledBgmRemaining();
        manager.update(10.2);
        const playedAfterDelay = manager.currentBgmKey;

        // 只停指定键：含当前键 → 停；不含当前键 → 原样保留（回主图延迟 / 小游戏收尾用）
        manager.playBgm('bgm.ending');
        const stopOtherKeys = manager.stopBgm(['bgm.qinglan', 'bgm.yunduze']);
        const endingKept = manager.currentBgmKey;
        manager.playBgm('bgm.qinglan');
        const stopMapKeys = manager.stopBgm(['bgm.qinglan', 'bgm.yunduze']);
        const mapStopped = manager.currentBgmKey;

        // 缺文件 / 解码失败：标记不可用、之后不再尝试，且不抛错
        const rejectStub = {
            currentTime: 0, volume: 1, paused: true, src: '',
            play() { return Promise.reject(Object.assign(new Error('decode'), { name: 'NotSupportedError' })); },
            pause() {},
        };
        manager._pathCache.set('sfx.__decode_fail__', 'assets/audio/sfx/__decode_fail__.mp3');
        manager._sfxCache.set('sfx.__decode_fail__', {
            audios: [rejectStub], next: 0, failed: false, path: 'assets/audio/sfx/__decode_fail__.mp3',
        });
        const failStarted = manager.playSfx('sfx.__decode_fail__');
        for (let i = 0; i < 3; i++) await Promise.resolve();
        const failMarked = manager._sfxCache.get('sfx.__decode_fail__').failed === true;
        const failRetry = manager.playSfx('sfx.__decode_fail__');
        const unknownSfxKey = manager.playSfx('sfx.__not_registered__');
        const unknownBgmKey = manager.playBgm('bgm.__not_registered__');

        manager._sfxCache.delete('sfx.__decode_fail__');
        manager._pathCache.delete('sfx.__decode_fail__');
        globalThis.Audio = originalAudio;
        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        R.audio.play = {
            sfxStarted, sfxLoop, sfxPlaying, exclusiveWhilePlaying, exclusiveAfterStop,
            throttleFirst, throttleRepeat, throttleBeforeWindow, throttleAfterWindow, throttleOtherKey,
            uiPoolSize: uiEntry.audios.length, uiLoop: uiEntry.audios[0].loop,
            bgmStarted, bgmLoop, bgmKeyAfterPlay, bgmPlaying, bgmElementKept,
            scheduled, afterSchedule, timerAfter9, timerAfterReschedule, playedAfterDelay,
            stopOtherKeys, endingKept, stopMapKeys, mapStopped,
            failStarted, failMarked, failRetry, unknownSfxKey, unknownBgmKey,
        };
    }

    // 14.3 Main 侧背景音乐调度：首次进入立即播 / 离开立即停 / 回主图 10 秒 / 进战场立即停
    {
        const manager = AudioManager.getInstance();
        main.audioManager = manager;
        main.currentMap = { mapId: 'qinglan_fuye' };
        main.hasEnteredGameWorld = false;
        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        main.onGameWorldSceneEnter();                       // 首次（从开始界面进来）→ 立即播
        const firstEntryKey = manager.currentBgmKey;
        const firstEntryScheduled = manager.getScheduledBgmKey();

        main.onGameWorldSceneExit();                        // 离开大地图 → 主图 BGM 立即停
        const afterExitKey = manager.currentBgmKey;

        main.onGameWorldSceneEnter();                       // 再进入 → 10 秒倒计时
        const secondEntry = {
            key: manager.currentBgmKey,
            scheduled: manager.getScheduledBgmKey(),
            timer: manager.getScheduledBgmRemaining(),
        };

        main.currentMap = { mapId: 'yunduze' };
        main.scheduleMainMapBgm();                          // 另一张主图 → 重新计时
        const rescheduled = {
            scheduled: manager.getScheduledBgmKey(),
            timer: manager.getScheduledBgmRemaining(),
        };

        main.onMapSwitched('qinglan_fuye', 'boss_arena_ch2');   // 进 Boss 关 → 立即停（含取消倒计时）
        const inArena = { key: manager.currentBgmKey, scheduled: manager.getScheduledBgmKey() };

        main.onMapSwitched('boss_arena_ch2', 'yunduze');        // 从 Boss 关回主图 → 10 秒倒计时
        const backFromArena = {
            scheduled: manager.getScheduledBgmKey(),
            timer: manager.getScheduledBgmRemaining(),
        };

        main.onMapSwitched('yunduze', 'yunduze');               // 同图重新落点 → 不动音乐
        const sameMapScheduled = manager.getScheduledBgmKey();

        R.audio.mainFlow = {
            firstEntryKey, firstEntryScheduled, afterExitKey, secondEntry,
            rescheduled, inArena, backFromArena, sameMapScheduled,
        };

        manager.stopAll();
        main.audioManager = null;
        main.hasEnteredGameWorld = false;
    }

    // 14.4 对话选项按钮的悬停音效：鼠标停在按钮上只响一次（不得每帧重播）
    //      背景（2026-09-13 修）：DialogBox.update 以前每帧用 (0,0) 空鼠标把选项按钮刷成
    //      「未悬停」，Main 紧接着再用真实坐标 update 一次 → 每帧都被判成「刚放上去」，
    //      滑过音效听感上就是一直响；开始界面 / 世界地图按钮只被真实鼠标 update 一次，所以没这毛病。
    {
        const manager = AudioManager.getInstance();
        const originalAudio = globalThis.Audio;
        globalThis.Audio = class {
            constructor() {
                this.loop = false;
                this.volume = 1;
                this.currentTime = 0;
                this.src = '';
                this._playing = false;
            }
            get paused() { return !this._playing; }
            play() { this._playing = true; return Promise.resolve(); }
            pause() { this._playing = false; }
            addEventListener() {}
        };

        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        // 只统计「播放入口被调用」的次数（与音频文件是否存在无关）
        const originalPlaySfx = manager.playSfx;
        const plays = { 'sfx.ui_hover': 0, 'sfx.ui_click': 0 };
        manager.playSfx = function (key) {
            if (plays[key] !== undefined) plays[key]++;
            return originalPlaySfx.call(this, key);
        };

        // 真实代码路径：DialogBox + UIButton（与 Main.renderDialogueOptions 造出的选项按钮一致）
        const box = new DialogBox({ x: 98, y: 480, width: 1085, height: 220 });
        box.show();
        const option = new UIButton({ x: 400, y: 500, width: 400, height: 78, text: '选项 1' });
        box.addOptionButton(option);

        // 复刻 Main.updateGameWorld 的每帧顺序：先 DialogBox.update(deltaTime)，
        // 再用本帧真实鼠标坐标更新每个选项按钮
        const frame = (mx, my, clicked = false) => {
            box.update(0.016);
            box.buttons.forEach(b => b.update(mx, my, false, clicked, 0.016));
        };

        for (let i = 0; i < 10; i++) frame(600, 530);        // 鼠标停在按钮上 10 帧
        const hoverHoldPlays = plays['sfx.ui_hover'];
        const hoverOffset = Math.round(option.currentOffsetY * 100) / 100;   // 悬停上移量

        frame(10, 10);                                       // 移出按钮 → 不该出声
        const hoverLeavePlays = plays['sfx.ui_hover'] - hoverHoldPlays;

        frame(600, 530);                                     // 再放回去 → 再响一次
        for (let i = 0; i < 4; i++) frame(600, 530);
        const hoverReenterPlays = plays['sfx.ui_hover'] - hoverHoldPlays - hoverLeavePlays;

        frame(600, 530, true);                               // 点一下 → 点击音效一次
        const clickPlays = plays['sfx.ui_click'];

        manager.playSfx = originalPlaySfx;
        box.hide();
        globalThis.Audio = originalAudio;
        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        R.audio.dialogHover = {
            hoverHoldPlays, hoverLeavePlays, hoverReenterPlays, clickPlays, hoverOffset,
        };
    }

    // 14.5 自动播放解锁：加载阶段（loadingOverlay）上的那一次点击同样算数，并被用来立刻补播音乐
    //      背景（2026-09-13 修）：旧写法只在「播放真的被拦下」时才去绑交互监听，于是加载界面上
    //      玩家的那次点击被白白浪费 —— 玩家得在开始界面**再点一次**才听得到声音，
    //      现象就是「打开游戏后加载界面没声音，点一下游戏界面才开始播」。
    //      现在：交互监听在 AudioManager 构造时就绑上（本次交互记进 hasUserGesture），
    //      第一次点击 / 按键立刻补播被拦下的 BGM（handleUserGesture），并触发 onUnlock 回调
    //      （加载界面据此收起「点一下开启声音」提示，见 game.html 的 #soundHint）。
    {
        const manager = AudioManager.getInstance();
        const originalAudio = globalThis.Audio;

        // 桩：解锁前 play() 以 NotAllowedError 拒绝（模拟浏览器自动播放策略），解锁后正常播放
        let unlocked = false;
        globalThis.Audio = class {
            constructor() {
                this.loop = false; this.volume = 1; this.currentTime = 0; this.src = '';
                this._playing = false;
            }
            get paused() { return !this._playing; }
            play() {
                if (!unlocked) {
                    return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
                }
                this._playing = true;
                return Promise.resolve();
            }
            pause() { this._playing = false; }
            addEventListener() {}
        };

        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        const gestureBeforePlay = manager.hasUserGesture();        // 还没交互过 → false
        const startedBlocked = manager.playBgm('bgm.main_menu');   // 发起播放（会被拦下）
        for (let i = 0; i < 3; i++) await Promise.resolve();       // 让 play() 的 Promise 走完
        const pendingAfterBlock = {
            pending: manager.isBgmPending(), key: manager._pendingBgmKey,
            playing: manager.isBgmPlaying(), gesture: manager.hasUserGesture(),
        };

        // onUnlock：第一次交互时通知外部（加载界面据此收起「点一下开启声音」提示）
        let unlockCallbacks = 0;
        manager.onUnlock = () => { unlockCallbacks++; };

        unlocked = true;                                           // 玩家点了那一下 → 浏览器放行
        const retried = manager.handleUserGesture();
        const afterGesture = {
            retried, gesture: manager.hasUserGesture(), pending: manager.isBgmPending(),
            current: manager.currentBgmKey, playing: manager.isBgmPlaying(), unlockCallbacks,
        };

        const secondGesture = manager.handleUserGesture();         // 重复交互无害：不补播、不重复回调
        const afterSecondGesture = {
            secondGesture, unlockCallbacks, current: manager.currentBgmKey,
        };

        // 加载阶段「先交互、后试播」：这次交互被记下来，音乐起播时不会再被拦
        manager.stopAll();
        manager._bgmCache.clear();
        manager._pathCache.clear();
        const gestureFirst = manager.hasUserGesture();             // 已经交互过 → true
        const playAfterGesture = manager.playBgm('bgm.main_menu');
        const afterEarlyGesture = {
            gestureFirst, playAfterGesture,
            current: manager.currentBgmKey, playing: manager.isBgmPlaying(),
        };

        manager.onUnlock = null;
        globalThis.Audio = originalAudio;
        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        R.audio.unlock = {
            gestureBeforePlay, startedBlocked, pendingAfterBlock,
            afterGesture, afterSecondGesture, afterEarlyGesture,
        };
    }

    // 14.6 小游戏结算互斥：成功 / 失败绝不会同时结算
    //      背景（2026-09-13 修）：乘风采药 update 旧顺序是「先 _checkVoidFall() 坠落判定，
    //      再判草药是否采齐」；而地图上多株草药长在虚空瓦片上（右侧 1050,300 / 1110,344 两株就在
    //      虚空里，只有起风时飞过去才采得到）→ 采到最后一株、同帧风又停了，就会先 fail()
    //      （失败音效 + 失败结算）再 complete()（胜利音效 + 成功结算）：听感上是「成功和失败音效
    //      同时播放」，结算界面也会连开两次。偶发，取决于风停与采集是否落在同一帧。
    //      现在：采齐即本局结束（成功优先，本帧不再判坠落）＋ MiniGame.complete/fail 同一局只结算一次。
    {
        const manager = AudioManager.getInstance();
        const originalAudio = globalThis.Audio;
        globalThis.Audio = class {
            constructor() { this.loop = false; this.volume = 1; this.currentTime = 0; this.src = ''; }
            play() { return Promise.resolve(); }
            pause() {}
            addEventListener() {}
        };

        // 记录 MiniGameManager 让小游戏播出的音效键（成功 / 失败结算音效都从这里出）
        const played = [];
        const originalGamePlaySfx = gameAudio.playSfx;
        gameAudio.playSfx = function (key) { played.push(key); return false; };

        // ① 基类闸门：同一局只结算一次（重复 complete / 失败后再 complete 都不再触发）
        const base = new MiniGame({ id: 'test_base', name: '测试' });
        let baseCompletes = 0;
        base.onComplete = () => { baseCompletes++; };
        base.start();
        const baseFirst = base.complete();
        const baseSecond = base.complete();

        const reversed = new MiniGame({ id: 'test_reversed', name: '测试' });
        let reversedCompletes = 0;
        reversed.onComplete = () => { reversedCompletes++; };
        reversed.start();
        const reversedFail = reversed.fail();
        const reversedThenComplete = reversed.complete();

        // ② 乘风采药：最后一株草药长在虚空上、同帧风停 → 只结算成功
        const herb = new HerbCollectMiniGame();
        const miniGameManager = new MiniGameManager();
        miniGameManager.registerMiniGame('herb_collect', herb);
        const events = [];
        miniGameManager.onGameComplete = () => events.push('complete');
        miniGameManager.onGameFail = () => events.push('fail');
        const herbStarted = miniGameManager.startMiniGame('herb_collect');

        herb.gamePhase = 'playing';
        herb.herbs = herb._generateHerbs();
        herb.requiredHerbs = herb.herbs.length;
        const lastHerb = herb.herbs[herb.herbs.length - 1];
        herb.herbs.forEach(h => { h.collected = h !== lastHerb; });      // 只剩最后一株
        herb.collectedHerbs = herb.requiredHerbs - 1;
        herb.player.x = lastHerb.x;
        herb.player.y = lastHerb.y;
        herb.wind.active = false;                                        // 风刚停
        herb.wind.cooldown = 1;                                          // 本帧不会重新起风
        const lastHerbOnVoid = herb._isVoidTile(
            Math.floor(lastHerb.y / herb.tileSize), Math.floor(lastHerb.x / herb.tileSize));
        played.length = 0;
        miniGameManager.update(1 / 60, { keys: {}, pressedKeys: { e: true } });   // 按 E 采最后一株
        const herbWin = {
            voidTile: lastHerbOnVoid,
            collected: herb.collectedHerbs,
            required: herb.requiredHerbs,
            isCompleted: herb.isCompleted, isFailed: herb.isFailed, isRunning: herb.isRunning,
            resultSuccess: herb.result ? herb.result.success : null,
            events: events.slice(), played: played.slice(),
        };

        // ③ 没采齐时坠落照样判失败（修完失败路径仍然有效）
        const herb2 = new HerbCollectMiniGame();
        const events2 = [];
        miniGameManager.registerMiniGame('herb_collect_fall_case', herb2);
        miniGameManager.onGameComplete = () => events2.push('complete');
        miniGameManager.onGameFail = () => events2.push('fail');
        const herb2Started = miniGameManager.startMiniGame('herb_collect_fall_case');

        herb2.gamePhase = 'playing';
        herb2.herbs = herb2._generateHerbs();
        herb2.requiredHerbs = herb2.herbs.length;
        herb2.herbs.forEach((h, i) => { h.collected = i !== 0; });        // 还差第 1 株（没采齐）
        herb2.collectedHerbs = 1;
        const voidSpot = herb2.herbs[herb2.herbs.length - 1];             // 站在虚空瓦片上（不采集）
        herb2.player.x = voidSpot.x;
        herb2.player.y = voidSpot.y;
        herb2.wind.active = false;
        herb2.wind.cooldown = 1;
        played.length = 0;
        miniGameManager.update(1 / 60, { keys: {}, pressedKeys: {} });
        const herbFall = {
            isCompleted: herb2.isCompleted, isFailed: herb2.isFailed, isRunning: herb2.isRunning,
            events: events2.slice(), played: played.slice(),
        };

        gameAudio.playSfx = originalGamePlaySfx;
        globalThis.Audio = originalAudio;
        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        R.audio.miniResult = {
            baseFirst, baseSecond, baseCompletes,
            reversedFail, reversedThenComplete, reversedCompletes,
            herbStarted, herbWin,
            herb2Started, herbFall,
        };
    }
    // 14.7 乘风采药：结算回主图后「按住 E」不会再开一局 + 起风 BGM 由小游戏自己收尾
    //      背景（2026-09-13 复现并修复）：结算就发生在「按 E 那一刻」（采到最后一株草药 / 坠落），
    //      玩家此时通常还按着 E，浏览器会连发 keydown。旧代码 Main.handleKeyDown 的
    //      「小游戏中忽略按键」只看 MiniGameManager.isPlaying —— 而结算那一刻它已经变成 false，
    //      于是这一路 keydown 直接走到 handleInteraction → 脚下的「采药点」路标 → 又开一局，
    //      而且 Main.startMiniGame 里的 switchScene('miniGame') 会把 handleMiniGameEnd 刚登记的
    //      gameWorld 覆盖掉：玩家以为已经退出，实际小游戏还在跑 —— 重开 0.5~2 秒后起风（起风 BGM
    //      又响），风停时若角色正好停在虚空瓦片上（玩家在主图按的 WASD 会被小游戏读走）就再判一次
    //      fail()（失败音效）。听感即「胜利音效 → 起风 BGM → BGM 停 → 失败音效」。
    //      现在：① 小游戏在 complete / fail / exit 里自己停起风 BGM；
    //            ② 结算当帧到切场景之间（场景仍是 miniGame）所有按键一律忽略；
    //            ③ Main.startMiniGame / handleInteraction 都过 isMiniGameActive() 门禁；
    //            ④ MiniGameScene.exit 清掉 MiniGameManager 的当前小游戏状态；
    //            ⑤ 回主图后有 0.5 秒 E 键保护期，保护期过了仍可正常重试。
    {
        const manager = AudioManager.getInstance();
        const originalAudio = globalThis.Audio;
        const played = [];
        const bgmStopCalls = [];
        const originalGamePlaySfx = gameAudio.playSfx;
        const originalStopBgm = manager.stopBgm.bind(manager);
        gameAudio.playSfx = function (key) { played.push(key); return false; };
        manager.stopBgm = function (key) {
            bgmStopCalls.push(Array.isArray(key) ? key.slice() : key);
            return originalStopBgm(key);
        };
        globalThis.Audio = class {
            constructor() {
                this.loop = false; this.volume = 1; this.currentTime = 0; this.src = '';
                this._playing = false;
            }
            get paused() { return !this._playing; }
            play() { this._playing = true; return Promise.resolve(); }
            pause() { this._playing = false; }
            addEventListener() {}
        };

        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        const main = new Main();
        main.audioManager = manager;
        main.player = new Player({
            position: { x: 843, y: 368 },
            playerData: { realm: 'zhuji', stage: '圆满', health: 200, maxHealth: 200, mana: 100, maxMana: 100, lingShi: 0 },
            profession: { professionId: 'sanxiu' },
        });
        let input = { keys: {}, pressedKeys: {} };
        main.inputManager = { getInputState: () => input, clearFrameState: () => {}, setMovementBlocked() {} };
        main.questUI = { isVisible: false, hide() {} };
        // 对话桩：与 DialogBox 的接口保持一致（playDialogueText 会写这些字段并调 show / setText /
        // clearOptionButtons）——乘风采药成功退出后会走这条路播收尾对白
        main.dialogBox = {
            isVisible: false, dialogueLines: [], currentText: '', displayedText: '',
            currentSpeakerName: '', isTyping: false, currentLineIndex: 0, onAdvance: null,
            clearOptionButtons() {},
            show() { this.isVisible = true; },
            hide() { this.isVisible = false; },
            setText(text, speaker) { this.currentText = text; this.currentSpeakerName = speaker; },
            advance() {},
        };
        main.mapTeleport = { isVisible: false };
        main.miniGameManager = new MiniGameManager();
        const herb = new HerbCollectMiniGame();
        main.miniGameManager.registerMiniGame('herb_collect', herb);
        main.sceneManager = new SceneManager();
        const worldScene = {
            sceneId: 'gameWorld', isInitialized: true,
            enter() { main.onGameWorldSceneEnter(); },
            exit() { main.onGameWorldSceneExit(); },
            update() {}, render() {},
        };
        main.sceneManager.registerScene('gameWorld', worldScene);
        main.sceneManager.registerScene('miniGame', new MiniGameScene(main));
        main.sceneManager.currentScene = worldScene;
        main.sceneManager.currentSceneId = 'gameWorld';
        main.currentMap = { mapId: 'qinglan_fuye', name: '青岚浮野' };
        main.hasEnteredGameWorld = true;
        main.saveManager = null;
        main.updateGameWorld = () => {};     // 世界更新与本次断言无关（只看按键 / 音频 / 小游戏状态）
        main.player.nearbySignpost = {
            id: 'signpost_herb_collect', name: '采药点', gameId: 'herb_collect',
            activate() {}, roleplayDialogue: null,
        };
        const sceneIdOf = () => (main.sceneManager.getCurrentScene() || {}).sceneId || null;
        const step = () => {
            main.sceneManager.update(1 / 60, input);
            main.update(1 / 60, input);
            input = { keys: {}, pressedKeys: {} };
        };

        // 进小游戏 → 起风 → 采齐全（和玩家真实操作同一条链路：由 MiniGameScene.update 驱动）
        main.startMiniGame('herb_collect', () => {});
        herb.gamePhase = 'playing';
        herb.wind.cooldown = 0;
        step();
        const bgmAtWindStart = manager.currentBgmKey;
        herb.wind.duration = 9999;
        step();
        const playedBeforeWin = played.length;
        const stopCallsBeforeWin = bgmStopCalls.length;
        for (let i = 0; i < herb.herbs.length; i++) {
            const h = herb.herbs[i];
            herb.player.x = h.x; herb.player.y = h.y;
            input = { keys: {}, pressedKeys: { e: true } };
            step();
        }
        const afterWin = {
            completed: herb.isCompleted, failed: herb.isFailed, running: herb.isRunning,
            mgrPlaying: main.miniGameManager.isPlaying, scene: sceneIdOf(),
            bgmKey: manager.currentBgmKey, bgmPlaying: manager.isBgmPlaying(),
            played: played.slice(playedBeforeWin),
            bgmStopCalls: bgmStopCalls.slice(stopCallsBeforeWin),
        };

        // 结算后的连发 E（落在切场景之前）→ 旧代码会在这里重开一局
        main.handleKeyDown('e');
        const heldEBeforeSwitch = {
            mgrPlaying: main.miniGameManager.isPlaying, herbRunning: herb.isRunning,
            scene: sceneIdOf(),
            herbPos: { x: Math.round(herb.player.x), y: Math.round(herb.player.y) },
        };

        step();                              // 下一帧：真正切回主图（MiniGameScene.exit 会清状态）
        const backToWorld = {
            scene: sceneIdOf(),
            mgrPlaying: main.miniGameManager.isPlaying,
            mgrFinished: main.miniGameManager.isFinished,
            currentGame: main.miniGameManager.currentMiniGame ? main.miniGameManager.currentMiniGame.id : null,
            guard: Number(main._miniGameExitGuard.toFixed(3)),
        };

        // 主图里继续按 E（保护期内）→ 不该重开
        main.handleKeyDown('e');
        const heldEInWorld = { mgrPlaying: main.miniGameManager.isPlaying, herbRunning: herb.isRunning };

        // 保护期内按 WASD 走动 1 秒：旧代码里小游戏还在跑，会被主图的同一份输入带着乱走
        for (let i = 0; i < 60; i++) { input = { keys: { d: true }, pressedKeys: {} }; step(); }
        const afterWalking = {
            mgrPlaying: main.miniGameManager.isPlaying, herbRunning: herb.isRunning,
            scene: sceneIdOf(),
            windBgmPlaying: manager.currentBgmKey === 'bgm.minigame_herb' || manager.isBgmPlaying(),
            playedAfterWin: played.slice(playedBeforeWin),
            guard: Number(main._miniGameExitGuard.toFixed(3)),
        };

        // 保护期过后玩家主动按 E → 仍要能正常开一局（失败重试流程不能被堵死）
        main.handleKeyDown('e');
        const retryAfterGuard = {
            mgrPlaying: main.miniGameManager.isPlaying, herbRunning: herb.isRunning,
            guard: Number(main._miniGameExitGuard.toFixed(3)),
        };

        gameAudio.playSfx = originalGamePlaySfx;
        manager.stopBgm = originalStopBgm;
        globalThis.Audio = originalAudio;
        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        R.audio.herbExit = {
            bgmAtWindStart, afterWin, heldEBeforeSwitch, backToWorld,
            heldEInWorld, afterWalking, retryAfterGuard,
        };
    }




    // ---- 14.8 乘风采药：胜利锁定 / 成功退出后的收尾对白 / 进小游戏输入隔离 ----
    //      对应玩家反馈：「乘风采药胜利后会同时播放胜利和失败的音效」。
    //      复现结论（2026-09-13）：赢下小游戏后玩家再按一次 E（保护期已过）会开出新一局，
    //      而主图里一直按着的方向键会被这一局读走（角色一进局就被推着往虚空走），风一停
    //      坠落判失败 → 胜利音效还没放完又响一遍失败音效。三条加固后此路不通：
    //      ① 采齐即置 isWinLocked：同一局里任何失败判定（坠落 / 到点 / 重复结算）一律忽略，
    //         MiniGameManager 再按「一局只结算一次」把结算音效锁死（先到的那条路径生效）；
    //      ② 成功退出后播一句收尾对白（路标 successDialogue，缺省用 Main 内置台词）；
    //      ③ 进小游戏时放掉主图按住的方向键（必须重新按才生效），不再被主图操作推着走。
    {
        const manager = AudioManager.getInstance();
        const originalAudio = globalThis.Audio;
        const played = [];
        const originalGamePlaySfx = gameAudio.playSfx;
        gameAudio.playSfx = function (key) { played.push(key); return false; };
        globalThis.Audio = class {
            constructor() {
                this.loop = false; this.volume = 1; this.currentTime = 0; this.src = '';
                this._playing = false;
            }
            get paused() { return !this._playing; }
            play() { this._playing = true; return Promise.resolve(); }
            pause() { this._playing = false; }
            addEventListener() {}
        };
        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        const main = new Main();
        main.audioManager = manager;
        main.player = new Player({
            position: { x: 843, y: 368 },
            playerData: { realm: 'zhuji', stage: '圆满', health: 200, maxHealth: 200, mana: 100, maxMana: 100, lingShi: 0 },
            profession: { professionId: 'sanxiu' },
        });
        main.player.questSystem = null;      // 本段只验证小游戏 / 对白 / 输入，跳过任务推进

        // 输入桩：与真实 InputManager 同语义 —— 按住键在 keys（不带 keyup 不会自己掉），
        // 本帧刚按下的在 pressedKeys（每帧末 clearFrameState 清空）
        const heldKeys = {};
        let pressedKeys = {};
        let heldClears = 0;
        main.inputManager = {
            getInputState: () => ({ keys: heldKeys, pressedKeys: pressedKeys }),
            clearFrameState: () => { pressedKeys = {}; },
            clearHeldKeys() {
                let n = 0;
                for (const k of Object.keys(heldKeys)) {
                    if (heldKeys[k]) { heldKeys[k] = false; n++; }
                }
                heldClears++;
                return n;
            },
            setMovementBlocked() {},
        };

        const dialogLog = [];
        main.dialogBox = {
            isVisible: false, dialogueLines: [], currentText: '', displayedText: '',
            currentSpeakerName: '', isTyping: false, currentLineIndex: 0, onAdvance: null,
            clearOptionButtons() {},
            show() { this.isVisible = true; },
            hide() { this.isVisible = false; },
            setText(text, speaker) {
                this.currentText = text;
                this.currentSpeakerName = speaker;
                dialogLog.push({ text: text, speaker: speaker });
            },
            advance() {},
        };
        main.questUI = { isVisible: false, hide() {} };
        main.mapTeleport = { isVisible: false };
        main.miniGameManager = new MiniGameManager();
        const herb = new HerbCollectMiniGame();
        main.miniGameManager.registerMiniGame('herb_collect', herb);
        main.sceneManager = new SceneManager();
        const worldScene = {
            sceneId: 'gameWorld', isInitialized: true,
            enter() {}, exit() {}, update() {}, render() {},
        };
        main.sceneManager.registerScene('gameWorld', worldScene);
        main.sceneManager.registerScene('miniGame', new MiniGameScene(main));
        main.sceneManager.currentScene = worldScene;
        main.sceneManager.currentSceneId = 'gameWorld';
        main.currentMap = { mapId: 'qinglan_fuye', name: '青岚浮野' };
        main.hasEnteredGameWorld = true;
        main.saveManager = null;
        main.updateGameWorld = () => {};

        // 采药点路标（含成功后的收尾对白；字段与 Signpost 一致，见 js/Signpost.js）
        main.player.nearbySignpost = {
            id: 'signpost_herb_collect', name: '采药点', gameId: 'herb_collect', oneShot: false,
            activate() {}, roleplayDialogue: null,
            successDialogue: '止风草齐了三份，趁着露水还重，赶紧给阿禾送去。',
            successSpeaker: '主角: ',
        };

        const sceneIdOf = () => (main.sceneManager.getCurrentScene() || {}).sceneId || null;
        const step = (pressed) => {
            pressedKeys = pressed || {};
            const cur = { keys: heldKeys, pressedKeys: pressedKeys };
            main.sceneManager.update(1 / 60, cur);
            main.update(1 / 60, cur);
        };
        // ① 玩家按着 D（往右走）时按 E 进小游戏 → 主图那份「按住」必须被放掉
        heldKeys['d'] = true;
        main.startMiniGameFromSignpost(main.player.nearbySignpost);
        const inputIsolation = { cleared: heldClears, heldDAfterStart: !!heldKeys['d'] };

        // 采齐全部草药（真实链路：MiniGameScene.update 驱动，一次按 E 采一株）
        herb.gamePhase = 'playing';
        herb.isFirstPlay = false;
        herb.wind.active = true; herb.wind.duration = 9999; herb.wind.cooldown = 0;
        step();
        for (let i = 0; i < herb.herbs.length; i++) {
            const h = herb.herbs[i];
            herb.player.x = h.x; herb.player.y = h.y;
            step({ e: true });
        }
        // ② 赢完再强行跑一遍失败逻辑（站在虚空瓦片上坠落 + 直接 fail）→ 必须被胜利锁定拦住
        herb.wind.active = false;
        herb.wind.cooldown = 99;
        herb.player.x = 1110; herb.player.y = 344;
        herb.gamePhase = 'playing';
        const forcedFail = herb.fail();
        herb._checkVoidFall();
        const winLock = {
            completed: herb.isCompleted, failed: herb.isFailed, winLocked: herb.isWinLocked,
            forcedFailResult: forcedFail,
            victoryPlays: played.filter(k => k === 'sfx.victory').length,
            defeatPlays: played.filter(k => k === 'sfx.defeat').length,
        };

        // ③ 回主图那一帧 → 播成功收尾对白；按 J / 点击读完即关闭
        step();
        const dialog = {
            log: dialogLog.slice(), visible: main.dialogBox.isVisible,
            storyActive: main.storyDialogueActive,
        };
        main.dialogBox.onAdvance();
        dialog.closedVisible = main.dialogBox.isVisible;
        dialog.closedStory = main.storyDialogueActive;

        // ④ 保护期过后玩家再按 E「再采一次」：此时玩家在主图仍按着 D（右侧就是虚空）
        for (let i = 0; i < 40; i++) step();
        const guardAfterWalk = Number(main._miniGameExitGuard.toFixed(3));
        heldKeys['d'] = true;
        main.handleKeyDown('e');
        const reentry = {
            mgrPlaying: main.miniGameManager.isPlaying, herbRunning: herb.isRunning,
            scene: sceneIdOf(), heldDAfterReentryStart: !!heldKeys['d'], cleared: heldClears,
            pos: { x: Math.round(herb.player.x), y: Math.round(herb.player.y) },
        };
        const playedBeforeIdle = played.length;
        for (let i = 0; i < 900; i++) step();     // 15 秒：主图的 D 要是带进小游戏，早就飘进虚空摔死了
        const afterReentry = {
            failed: herb.isFailed, running: herb.isRunning,
            pos: { x: Math.round(herb.player.x), y: Math.round(herb.player.y) },
            played: played.slice(playedBeforeIdle),
        };

        // ⑤ 重新按下 D → 小游戏里照常能走（输入隔离不会把操作堵死）
        heldKeys['d'] = true;
        const moveBefore = Math.round(herb.player.x);
        for (let i = 0; i < 60; i++) {
            step();
            if (!herb.isRunning) break;
        }
        const freshPressMoves = { before: moveBefore, after: Math.round(herb.player.x) };

        gameAudio.playSfx = originalGamePlaySfx;
        globalThis.Audio = originalAudio;
        manager.stopAll();
        manager._bgmCache.clear();
        manager._sfxCache.clear();
        manager._pathCache.clear();

        R.audio.herbWinLock = {
            inputIsolation, winLock, dialog, guardAfterWalk, reentry, afterReentry, freshPressMoves,
        };
    }

    // ---- 14.9 乘风采药：风是固定节奏（起风 3 秒 / 间隔 5 秒）+ 起风 BGM 与风同步 ----
    //      对应本次需求（第十三次改动）：
    //        ① 无风时玩家不能离开陆地；② 有风时可离开陆地（虚空可走 / 可站）；
    //        ③ 风停时玩家还在虚空 → 小游戏失败；
    //        ⑤ 每次风固定 3 秒左右、起风间隔固定 5 秒（不再随机）；
    //        ⑥ 起风时才循环播放 BGM，风停立即停（结算 / 退出另见 14.7 / 14.8）。
    //      全部走真实 update 链路（每帧 1/60 秒），按真实帧数统计起风 / 静风窗口。
    {
        const manager = AudioManager.getInstance();
        const originalAudio = globalThis.Audio;
        const bgmCalls = [];
        const originalPlayBgm = manager.playBgm;
        const originalStopBgm = manager.stopBgm;
        let clock = 0;
        manager.playBgm = function (key) {
            bgmCalls.push({ call: 'play', key: key, at: Number(clock.toFixed(2)) });
            return true;
        };
        manager.stopBgm = function (key) {
            bgmCalls.push({
                call: 'stop',
                key: Array.isArray(key) ? key.join('|') : key,
                at: Number(clock.toFixed(2)),
            });
            return true;
        };
        globalThis.Audio = class {
            constructor() {
                this.loop = false; this.volume = 1; this.currentTime = 0; this.src = '';
                this._playing = false;
            }
            get paused() { return !this._playing; }
            play() { this._playing = true; return Promise.resolve(); }
            pause() { this._playing = false; }
            addEventListener() {}
        };

        // ① 时间线：16.5 秒逐帧推进（静风 5s → 起风 3s → 静风 5s → 起风 3s …），记录每帧 wind.active
        const timelineGame = new HerbCollectMiniGame();
        timelineGame.start();
        timelineGame.gamePhase = 'playing';
        const frames = Math.round(16.5 * 60);
        const flags = [];
        for (let i = 0; i < frames; i++) {
            clock = (i + 1) / 60;
            timelineGame.update(1 / 60, { keys: {}, pressedKeys: {} });
            flags.push(timelineGame.wind.active ? 1 : 0);
        }
        // 起风窗口（连续段）：[start, end) 帧号
        const gusts = [];
        let runStart = -1;
        for (let i = 0; i <= flags.length; i++) {
            const on = i < flags.length && flags[i] === 1;
            if (on && runStart === -1) runStart = i;
            if (!on && runStart !== -1) { gusts.push([runStart, i]); runStart = -1; }
        }
        const gustSeconds = gusts.map(g => Number(((g[1] - g[0]) / 60).toFixed(2)));
        const gustStarts = gusts.map(g => Number((g[0] / 60).toFixed(2)));
        const calmBetweenGusts = gusts.length >= 2
            ? Number(((gusts[1][0] - gusts[0][1]) / 60).toFixed(2))
            : null;
        // 时间线里的 BGM 调用（剔除 start() 开局那一次 stop：那是「新一局先把 BGM 收干净」，
        // 时钟还是 0，与起风 / 风停的节奏无关）；后面的探针不再记账。
        const timelineBgmCalls = bgmCalls.filter(c => c.at > 1);
        bgmCalls.length = 0;

        // ② 无风时踩在虚空上 → 一帧就判失败（风停还在虚空 = 失败）
        const fallGame = new HerbCollectMiniGame();
        const fallEvents = [];
        fallGame.onFail = () => fallEvents.push('fail');
        fallGame.start();
        fallGame.gamePhase = 'playing';
        fallGame.wind.active = false;
        fallGame.wind.cooldown = 99;                                  // 本局内不会起风
        fallGame.player.x = 1110; fallGame.player.y = 344;            // 虚空瓦片（右侧草药位）
        const fallFootprintOnLand = fallGame._isFootprintAllOnLand();
        fallGame.update(1 / 60, { keys: {}, pressedKeys: {} });

        // ③ 有风时同一片虚空可以自由走（走位不被拦、也不会判坠落）
        const flyGame = new HerbCollectMiniGame();
        flyGame.start();
        flyGame.gamePhase = 'playing';
        flyGame.wind.active = true; flyGame.wind.duration = 99;
        flyGame.player.x = 1010; flyGame.player.y = 340;              // 虚空瓦片
        const flyFrom = flyGame.player.x;
        for (let i = 0; i < 60; i++) {
            flyGame.update(1 / 60, { keys: { d: true }, pressedKeys: {} });
        }
        const flyMoved = Number((flyGame.player.x - flyFrom).toFixed(1));

        // ④ 无风时站在陆地边缘往虚空走 → 被拦（不能离开陆地）
        const lockGame = new HerbCollectMiniGame();
        lockGame.start();
        lockGame.gamePhase = 'playing';
        lockGame.wind.active = false;
        lockGame.wind.cooldown = 99;
        lockGame.player.x = 460; lockGame.player.y = 550;             // 陆地最右缘（右邻虚空）
        const lockFrom = lockGame.player.x;
        for (let i = 0; i < 30; i++) {
            lockGame.update(1 / 60, { keys: { d: true }, pressedKeys: {} });
        }
        const lockMoved = Number((lockGame.player.x - lockFrom).toFixed(1));

        manager.playBgm = originalPlayBgm;
        manager.stopBgm = originalStopBgm;
        globalThis.Audio = originalAudio;

        R.audio.herbWind = {
            gusts: gusts,
            gustSeconds: gustSeconds,
            gustStarts: gustStarts,
            calmBetweenGusts: calmBetweenGusts,
            windFramesTotal: flags.reduce((a, b) => a + b, 0),
            timelineFailed: timelineGame.isFailed,
            bgmCalls: timelineBgmCalls,
            // 时间线之后另外开了 3 局探针（坠落 / 飞行 / 陆地拦截）→ 每局 start() 都会先收掉起风 BGM
            newGameStartStops: bgmCalls.length,
            fall: {
                footprintOnLand: fallFootprintOnLand,
                failed: fallGame.isFailed,
                events: fallEvents.slice(),
            },
            fly: { moved: flyMoved, failed: flyGame.isFailed },
            landLock: { moved: lockMoved, failed: lockGame.isFailed },
        };
    }

    const story = Chapter2Config.getStoryDialogues();
    R.story = {
        ids: Object.keys(story),
        missingText: Object.keys(story).filter(id => !story[id].text),
    };

    return JSON.stringify(R);
})();
