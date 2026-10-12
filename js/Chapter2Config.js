/**
 * 第二章：云渡泽——有人抵达，有人永远在途中
 * 数据源：第二章-云渡泽-主线与NPC对话-v1.0.json
 *
 * 与第一章的关系
 * - 阿禾在第一章已出现（同名即同一人）：图片资源复用 npc.ahe_*，但第二章依旧完整配置她的
 *   站位、对话与任务；ChapterLoader 会把两章的 NPC 配置做「深合并」（见 js/ChapterLoader.js），
 *   因此阿禾在青岚浮野用第一章的对白、在云渡泽用第二章的对白（由当前地图决定用哪一章的选择器）。
 * - 本章沿用第一章的引擎机制：任务状态机（LOCKED→ACTIVE→COMPLETED，只能推进第一个未完成目标）、
 *   任务门控路标 / 调查点 / 传送法阵、小游戏、战场 Boss 流程。
 *
 * 本版按需求忽略“职业选择 / 职业转换”相关内容（不出现择道、换传承、转职收费），
 * 并由陆舟传授剑修基础连招（复用第一章的基础操作教学框架）替代 M01 的“剑修基础连招试炼”。
 *
 * 主线结构（环环相扣，前置未完成无法接取，目标必须按顺序推进）：
 *   ch1 ending_3《登船辞行》
 *     → chapter2_main_1《渡口无归客》  阿禾 → 试炼传授剑影连斩（无任务奖励）
 *     → chapter2_main_2《一封到不了的家书》 江婆 → 认灯与身份核验
 *     → chapter2_main_3《逆流送灯》    陆舟 → 逆流护送 + 归魂取词
 *     → chapter2_main_4《万灯渡口》    陆舟 → 击败渡厄使 + 查账册 / 命令
 *     → chapter2_ending_1《灯定丹成》  阿禾 → 结丹调息（境界→结丹：气血 1000 / 灵息 500 并回满）
 *     → chapter2_ending_2《行舟有归处》陆舟 → 章末登船
 *
 * 本版平衡：第一章 / 第二章的所有任务都不再配置奖励（rewards 字段已全部移除）。
 * 角色成长只来自两处：
 *   1) 境界基准（GameConfig.realms）：练气 150/70 → 筑基 400/250 → 结丹 1000/500（晋级即回满）；
 *   2) Boss 战败成长（战场配置 arenaDefeatBonus）：摄风山魈 +20/+10、渡厄使 +35/+20，各自上限 5 次。
 *   灵息自然恢复按境界分档：练气 1 秒 2 点 / 筑基 1 秒 4 点 / 结丹及以后 1 秒 10 点。
 */
class Chapter2Config {
    static getChapterMeta() {
        return {
            id: 'chapter2', name: '云渡泽——有人抵达，有人永远在途中',
            realm: 'zhuji', previousChapter: 'chapter1', previousMapId: 'qinglan_fuye',
            nextChapter: 'chapter3', nextMapId: 'zhaochen_xiancheng',
        };
    }

    /**
     * 本章使用的地图 ID（用于 Main 判断“当前在第几章”，决定用哪一章的对话选择器）
     */
    static getMapIds() {
        return ['yunduze', 'boss_arena_ch2'];
    }

    /**
     * 万灯台战场（渡厄使）的战场流程参数：
     * Main.enterBossArena 会从传送法阵配置里读取，这里只做集中登记，便于检索。
     */
    static getArenaConfig() {
        return {
            mapId: 'boss_arena_ch2',
            name: '万灯台',
            defeatFlag: 'due_boss_defeated',
            victory: { questId: 'chapter2_main_4', type: 'defeat_boss', target: 'boss_due' },
            resourceGroup: 'bossArenaCh2',
            returnMapId: 'yunduze',
            entryTeleportId: 'teleport_wandengtai',
            exitPrompt: '按 E 返回云渡泽',
            deathSubtitle: '已返回石台外，战内丹药已恢复。可调整技能后重新挑战。',
            retrySubtitle: '这次先看清锁链和冲刺的方向。',
        };
    }

    /**
     * 调试通道（云渡泽出生点旁「渡厄使试炼法阵」）已下线
     * ------------------------------------------------------------------
     * 它曾用来跳过主线一~三（认灯归魂 / 逆流送灯两个小游戏）直接进 boss_arena_ch2
     * 反复练招 —— 靠 debugPortal: true 在进场时清掉自己那份击败标记
     * （due_boss_debug_defeated，与正式标记 due_boss_defeated 分离）。
     *
     * 现已按需求删除，第二章战场只保留正式入口：
     *   接取 chapter2_main_4 → 云渡泽石台法阵 wandengtai → 渡厄使战场。
     * 因此本文件不再有 isDebugBossPortalEnabled / getDebugBossPortalTeleporter，
     * js/TeleportArray.js 不再有 debugPortal 字段；打赢过的 Boss 也不会因为
     * 「换个入口再进」而重新生成（见 Main.isArenaBossAlreadyDefeated）。
     */

    /**
     * 剑修连招试炼（主线一）：复用第一章的基础操作教学框架（TrainingManager），
     * 教学圈放在云渡泽码头栈道北侧的小路（世界坐标 737,1079 —— 陆舟站位以北约 160px；
     * 坐标来源见 tools/generate_chapter2_assets.py 的 YUNDUZE_POINTS）。
     *
     * 本版试炼只教一招：剑影连斩（O）。在圈内按 O 即完成教学圈 → TrainingManager.onAllCompleted
     * → Main 的 sword 分支调用 learnProfessionSkill('jianying')（弹「习得剑影连斩」+ 技能栏补第 4 格）。
     * actionType 必须与 PlayerCombatSystem.CONFIG.jianying.trainingAction 一致，否则未习得的技能
     * 在教学圈里也按不出来，教学圈会永远完不成；
     * 判定半径 40 / 绘制半径 52 由 TrainingManager.startBasicTraining 统一给定。
     */
    static getSwordTrainingLayout() {
        return [
            {
                id: 'c2_training_jianying',
                name: '剑影连斩',
                position: { x: 737, y: 1079 },
                actionType: 'skill_jianying',
                actionKey: 'o',
                promptText: '靠近并按 O 施展剑影连斩',
            },
        ];
    }

    // ==================== NPC 配置 ====================

    /**
     * 第二章 NPC
     * - ahe：与第一章同一人。图片资源复用 npc.ahe_idle / ahe_walk / ahe_heal（32×32 四方向 idle、
     *   29×32 四方向 walk、31×32 四方向 heal），但是本章仍完整配置站位、搬迁点、任务与对白；
     *   ChapterLoader 对同名 NPC 做深合并，因此她在青岚浮野走第一章对白、在云渡泽走第二章对白。
     * - luzhou（陆舟）/ jiangpo（江婆）/ jiangwan（江晚）/ chenli（陈栎）/ xulu（许录）：本章新增，
     *   均为静止 NPC（isStatic），规格见各自 baseAnimations（★ = 与美术交付规格一一对应）：
     *   ★ luzhou  单帧 32×64，四方向共用第一帧（idle.png 32×64）
     *   ★ jiangpo 两张单帧 32×64：idle.png = 女儿获救前（含泪苦等）/ idle_after.png = 获救后（安心）
     *             —— extraAnimations.idle_after，归魂演出后由 Main.setJiangpoReunitedIdle(true) 切换
     *   ★ jiangwan 单帧 32×64，四方向共用第一帧（idle.png 32×64）
     *   ★ chenli  列排列 4 列（下/左/右/上，每列 1 帧），单帧 58×64（idle.png 232×64）
     *   ★ xulu    列排列 4 列（下/左/右/上，每列 1 帧），单帧 48×64（idle.png 192×64）
     *   这 5 位的美术是 2 倍像素密度（帧画布更大），因此 displayScale 全部设 1，
     *   显示尺寸与第一章 NPC（阿禾等，帧 32×32 / displayScale 2）一致；
     *   改回 displayScale 2 即按 2 倍大小显示。
     */
    static getNPCConfigs() {
        return {
            // ===== 阿禾（第一章已出现，资源复用）=====
            ahe: {
                id: 'ahe', name: '阿禾', moveSpeed: 80, isStatic: false,
                // 初始站位：渡口集市的救助棚（瓦片 59,37 → 世界 1914,1205）
                position: { x: 59, y: 37 }, patrolPoints: [],
                // 第二章的搬迁点（世界坐标为精确像素，优先于瓦片坐标）
                movePositions: {
                    court: { x: 78, y: 30 },   // 归魂成功后迁往右侧救助院
                    berth: { x: 17, y: 43 },   // 行舟解锁后迁往中央泊位
                },
                moveWorldPositions: {
                    court: { x: 2500, y: 980 },
                    berth: { x: 555, y: 1400 },
                },
                baseAnimations: {
                    idle: {
                        frameWidth: 32, frameHeight: 32, directionMode: 'row',
                        directions: {
                            down:  { row: 0, frames: 1 },
                            left:  { row: 1, frames: 1 },
                            right: { row: 2, frames: 1 },
                            up:    { row: 3, frames: 1 },
                        },
                        fps: 8, loop: true,
                    },
                    walk: {
                        frameWidth: 29, frameHeight: 32, directionMode: 'row',
                        directions: {
                            down:  { row: 0, frames: 4 },
                            left:  { row: 1, frames: 4 },
                            right: { row: 2, frames: 4 },
                            up:    { row: 3, frames: 4 },
                        },
                        fps: 10, loop: true,
                    },
                },
                shopItems: [
                    { itemId: 'lingcao', price: 10, stock: 20 },
                    { itemId: 'ninglu', price: 15, stock: 10 },
                    { itemId: 'huiyuan_dan', price: 50, stock: 5 },
                    { itemId: 'huiling_dan', price: 60, stock: 5 },
                ],
                assignedQuests: [
                    'chapter2_main_1', 'chapter2_main_2', 'chapter2_main_3',
                    'chapter2_ending_1', 'chapter2_ending_2',
                ],
                dialogues: {
                    // JSON: A01 / 初到云渡泽，M01 未接取
                    c2_a01_arrive: {
                        id: 'c2_a01_arrive',
                        text: '你到了。我跟救助船先走一步，在这里腾了几张床。\n主角: 找到村里人了吗？\n找到了几个人的身体，一直不醒。引渡司说魂息已经收进灯里，要等统一归还。\n主角: 名册上有他们吗？\n有陈栎，还有几户人家。但这里的登记只写灯号，没有写什么时候能回来。\n你去问问管登记的许录，再找码头的陆舟核对航线。',
                        options: [
                            { text: '我去查登记。', next: null, action: 'accept_quest_chapter2_main_1' },
                            { text: '你先照顾他们，我稍后去。', next: null },
                        ],
                    },
                    // JSON: A02 / M01 进行中，目标未齐
                    c2_a02_progress: {
                        id: 'c2_a02_progress',
                        text: '先找许录要登记，再请陆舟看看船走的路线。\n你刚接上传承，出水道前把招式练熟。这里桥窄，别把突进当成走路。',
                        options: [],
                    },
                    // JSON: A03 / M01 目标全部完成，尚未交付
                    // 注：交付由“对话开始时推进 talk_to ahe”完成（见 Main.startNPCInteraction），
                    //     对话结束即主线一发奖，此处不再重复解锁任何任务。
                    c2_a03_report: {
                        id: 'c2_a03_report',
                        text: '主角: 有些灯还在渡口，有些已经被运往上游。所谓归还，没有日期。\n我这边也是同样的答复。人躺得越久，身体就越虚。\n主角: 得先认出留下的灯，把能救的人救回来。\n井边的江婆一直在找女儿，她手里还有家书。你去问问，或许能从那里入手。',
                        options: [],
                    },
                    // 主线一交付后、主线二未接取：指向井边的江婆
                    c2_a03_next: {
                        id: 'c2_a03_next',
                        text: '登记摘页我收着了，和村里的名册一起放。\n井边的江婆一直在等她女儿，你替她去看看灯。认出来一盏，就少一个人空等。',
                        options: [],
                    },
                    // JSON: A04 / M02 进行中，询问陈栎，尚未取得补充线索
                    c2_a04_chenli_clue: {
                        id: 'c2_a04_chenli_clue',
                        text: '陈栎做活总先敲三下木头，再下凿。村里的孩子都学他。\n主角: 他的木尺还在，写着西桥重修。\n那是他怕自己忘了工期刻的。他认得这些，你试着唤他。',
                        options: [], on_complete: ['record_chenli_clue'],
                    },
                    // JSON: A05 / M03 进行中，归魂点尚未准备确认
                    c2_a05_court_ready: {
                        id: 'c2_a05_court_ready',
                        text: '江晚和陈栎都安顿好了。江婆帮我守着，岸边也点了接应灯。\n主角: 船一到就能归魂？\n可以。身份已经核准，接下来我引魂归体。你只管把灯稳稳送来。',
                        options: [], on_complete: ['record_soul_site_ready'],
                    },
                    // 归魂演出之后（主线三进行中，还差证词）
                    c2_a05b_after_soul_return: {
                        id: 'c2_a05b_after_soul_return',
                        text: '两边都醒着，只是还没力气。先别让他们起身。\n主角: 我去问问他们记得什么。\n慢慢问。灯里听见的东西，总要有人替他们说出来。',
                        options: [],
                    },
                    // JSON: A06 / M04 进行中，Boss 未胜
                    c2_a06_pre_boss: {
                        id: 'c2_a06_pre_boss',
                        text: '这里的人我守着。你先检查丹药，灵息不够时找安全空当再回息。\n江婆刚替江晚重新编好头发。还有人等着这样的日子，你一定回来。',
                        options: [],
                    },
                    // JSON: A07 / M04 目标全部完成，尚未交付
                    c2_a07_deliver: {
                        id: 'c2_a07_deliver',
                        text: '主角: 找到命令了。太玄要求增加魂力供给，渡厄使按令把灯送往照尘仙城。\n所谓引渡，一开始就不是送人回家。\n主角: 陈栎同船的几个人已经到了丹坊。账册写得很清楚。\n这里能归还的，我和大家继续核对。已经送走的，还得追。\n主角: 这次至少知道该找哪条船、哪一盏灯了。',
                        options: [],
                    },
                    // JSON: A08 / M04 完成，尚未结丹（E01 结丹调息入口）
                    c2_a08_core_ready: {
                        id: 'c2_a08_core_ready',
                        text: '这几日你一直奔走，灵气已经凝实，再强压着也不妥。\n主角: 我想先把突破稳下来。\n我替你护着。照祁伯教的法子，先收息，再凝神。',
                        options: [
                            {
                                text: '开始结丹调息。', next: null,
                                action: 'accept_quest_chapter2_ending_1',
                            },
                            { text: '稍后再来。', next: null },
                        ],
                        // 接取《灯定丹成》后，再由 Main 播放结丹调息序列（复用定息规则）
                        on_complete: ['start_core_formation_trial'],
                    },
                    // JSON: A09 / 行舟已解锁，出发交接未确认
                    c2_a09_depart_plan: {
                        id: 'c2_a09_depart_plan',
                        text: '江婆、江晚和许录留在救助院，接着核对魂灯。陈栎随返乡船回青岚。\n主角: 你跟我们走？\n嗯。已运走的人也需要医治。这边交接好了，我们去照尘仙城。',
                        options: [], on_complete: ['record_depart_plan'],
                    },
                    // 阶段闲聊：主线二问完陈栎线索之后、主线二完成之后、主线四 Boss 已胜但
                    // 台后账册 / 命令还没查完 —— 这几段空档都走这里。
                    // JSON 在这几段没有阿禾专属节点（A03 后 → A05，A06 → A07），
                    // runtime_rules.routing 要求「无阶段专属对白时显示闲聊，不回放已失效的接取对白」，
                    // 因此这里兜底为救助棚 / 救助院的闲聊，不再掉到更早阶段的任务提示
                    // （旧行为：主线二完成时回落到 A03 后的「去找江婆认灯」，会把玩家指回已经做完的一步）。
                    c2_ahe_idle_shed: {
                        id: 'c2_ahe_idle_shed',
                        text: '这里的灯我按灯号排过了，谁来认都翻得着。\n主角: 还有多少人在等？\n册子上记着十几个。灯回来一盏，我就划掉一个。',
                        // 原「我想买点东西（open_shop）」商店入口已按需求移除：
                        // 阿禾的闲聊不再挂商店，只保留结束项。
                        options: [
                            { text: '我先去忙别的', next: null },
                        ],
                    },
                    // 第二章完成后的闲聊（此时阿禾在行舟上）
                    c2_ahe_idle: {
                        id: 'c2_ahe_idle',
                        text: '灯架我重新捆过一遍，路上不会再晃。\n主角: 船上还缺什么？\n缺的都记在册子上了。到了照尘仙城，先找一个能落脚的院子。',
                        // 同上：阿禾闲聊不再有商店入口
                        options: [
                            { text: '路上再核一遍名单', next: null },
                        ],
                    },
                },
            },

            // ===== 陆舟（新角色：退休舟师，本章引路人）=====
            luzhou: {
                id: 'luzhou', name: '陆舟', moveSpeed: 60, isStatic: true,
                position: { x: 22, y: 38 }, patrolPoints: [],
                // 行舟解锁后由帆船码头移到中央泊位（世界坐标 700,1320）
                movePositions: { berth: { x: 21, y: 41 } },
                moveWorldPositions: { berth: { x: 700, y: 1320 } },
                // displayScale：本章新美术为 2 倍像素密度（单帧 32×64），1× 显示才与第一章 NPC 同尺寸
                displayScale: 1,
                // idle：单帧 32×64（npc/luzhou/idle.png，四个方向共用第一帧）
                baseAnimations: {
                    idle: {
                        frameWidth: 32, frameHeight: 64, directionMode: 'row',
                        directions: {
                            down:  { row: 0, frames: 1 },
                            up:    { row: 0, frames: 1 },
                            left:  { row: 0, frames: 1 },
                            right: { row: 0, frames: 1 },
                        },
                        fps: 8, loop: true,
                    },
                },
                assignedQuests: [
                    'chapter2_main_2', 'chapter2_main_3', 'chapter2_main_4', 'chapter2_ending_2',
                ],
                dialogues: {
                    // JSON: L01 / M01 进行中，已取得登记摘页，旧航线未核对
                    c2_l01_route: {
                        id: 'c2_l01_route',
                        text: '这不是归乡的航线。这些船出了北汊，就往上游走了。\n主角: 上游通哪里？\n照尘仙城。但灯到了哪一站，我现在不能替你断言。\n主角: 您能带我追上去吗？\n新水道有人守，旧水道也不好走。先把这里的灯查清，别空着手追。\n岸边空地能练招。让我看看，你能不能在收剑的时候留出退路。',
                        options: [
                            { text: '练一遍剑招。', next: null, action: 'start_sword_training' },
                            { text: '我稍后练。', next: null },
                        ],
                        on_complete: ['record_route_checked'],
                    },
                    // JSON: L02 / M01 进行中，旧航线已核对，剑修教学未完成
                    c2_l02_sword_hint: {
                        id: 'c2_l02_sword_hint',
                        text: '先以普攻积剑意，再接踏风斩或归刃。归刃出去以后，挪开危险位置，别站着等剑回来。\n踏风斩不是闪避，冲进攻击里一样会受伤。',
                        options: [
                            { text: '开始练习。', next: null, action: 'start_sword_training' },
                            { text: '稍后再来。', next: null },
                        ],
                    },
                    // JSON: L03 / M02 完成，M03 未接取
                    c2_l03_old_route: {
                        id: 'c2_l03_old_route',
                        text: '新水道不放行，旧水道还能走。逆着主流绕一段，就能到右边救助院。\n主角: 魂灯能受得住？\n把灯架固定好，避开急流和旋涡就行。到了宽水面再转向。\n先问阿禾是否准备齐。船到岸，灯就要有人接。',
                        options: [
                            { text: '我们走旧水道。', next: null, action: 'accept_quest_chapter2_main_3' },
                            { text: '我先做准备。', next: null },
                        ],
                    },
                    // JSON: L04 / M03 进行中，归魂点准备完成，护送未成功
                    // 同时作为“水道入口”路标的开船前对白（路标 roleplayDialogue 字段）
                    c2_l04_escort_ready: {
                        id: 'c2_l04_escort_ready',
                        text: '把灯放稳。记住，风大就等，水急就绕，不抢那一点路。',
                        options: [
                            { text: '开始逆流送灯。', next: null, action: 'start_river_escort' },
                            { text: '暂不出发。', next: null },
                        ],
                    },
                    // 主线三进行中、护送已过但证词未取完：回到水道 / 码头的提示
                    c2_l03b_progress: {
                        id: 'c2_l03b_progress',
                        text: '灯送到院里，剩下的就是听他们说话。\n主角: 他们会说吗？\n会的。在灯里闷了那么久，总有想讲的。',
                        options: [],
                    },
                    // JSON: L05 / M03 目标全部完成，尚未交付
                    c2_l05_deliver: {
                        id: 'c2_l05_deliver',
                        text: '主角: 灯里的两个人都回来了。所谓不能归还，根本说不通。\n渡厄使已经封了水道，说我们私夺魂灯。\n主角: 那些本来就是人。\n我知道。旧路只能救这一船，要接回更多人，就得把万灯台的封锁拆掉。',
                        options: [],
                    },
                    // JSON: L06 / M03 完成且筑基圆满，M04 未接取
                    c2_l06_wandengtai: {
                        id: 'c2_l06_wandengtai',
                        text: '去找许录。他手里有去万灯台的通行凭证，省得你在桥头就被拦住。\n主角: 他会给？\n让他自己看看救回来的人。账本之外的事，他也该认一认。\n渡厄使会借灯护身。那些连着锁链的拘魂灯是阵器，用普攻和剑招都能打碎；百姓的魂灯装在岸边封存箱里，不是攻击目标。',
                        options: [
                            { text: '我去万灯台。', next: null, action: 'accept_quest_chapter2_main_4' },
                            { text: '先休整。', next: null },
                        ],
                    },
                    // JSON: L07 / M04 进行中，目标未齐
                    c2_l07_progress: {
                        id: 'c2_l07_progress',
                        text: '台后的账册和命令都要查。只打散看守，找不到已经走远的船。',
                        options: [],
                    },
                    // 主线四：账册与命令都已查到 → 回去向阿禾说明
                    c2_l07b_investigated: {
                        id: 'c2_l07b_investigated',
                        text: '账册和命令都到手了？那就回去找阿禾，把话摊开说。\n主角: 这边还留着什么？\n石台我盯着。灯散了，封锁也就散了。',
                        options: [],
                    },
                    // JSON: L08 / E01 完成，行舟尚未解锁 → 接取 E02
                    c2_l08_boat_ready: {
                        id: 'c2_l08_boat_ready',
                        text: '船修好了。陈栎换的底板，我重新接的灵路，能走更远些。\n主角: 您也一起去？\n旧路还认得，总不能让你拿着半张图瞎闯。\n船上能休息、炼丹、整理功法。往后救回来的人，也能先有个落脚处。',
                        options: [],
                        on_complete: ['record_boat_repaired', 'accept_quest_chapter2_ending_2'],
                    },
                    c2_luzhou_idle: {
                        id: 'c2_luzhou_idle',
                        text: '水面上看着静，底下的暗流比谁都急。\n主角: 我会小心的。\n记住就好。旧路难走，别把船当成能硬闯的东西。',
                        // 闲聊节点不再提供「练一遍剑招」：剑修连招试炼（complete_training/sword）
                        // 只能按任务顺序推进 —— 先找许录拿登记摘页（L01 核对旧航线）、
                        // 再到 L02「开始练习」启动试炼，避免刚进章节就把第 3 步做掉。
                        options: [
                            { text: '先不打搅您', next: null },
                        ],
                    },
                },
            },

            // ===== 江婆（新角色：寻女，与认灯主线绑定）=====
            jiangpo: {
                id: 'jiangpo', name: '江婆', moveSpeed: 60, isStatic: true,
                position: { x: 51, y: 38 }, patrolPoints: [],
                // 归魂之后由集市井边移到右侧救助院陪江晚（世界坐标 2338,989）
                movePositions: { court: { x: 73, y: 30 } },
                moveWorldPositions: { court: { x: 2338, y: 989 } },
                // displayScale：同陆舟 —— 本章新美术为 2 倍像素密度，1× 显示与第一章 NPC 同尺寸
                displayScale: 1,
                // idle：两张单帧 32×64 —— idle.png = 女儿获救前（含泪苦等）/ idle_after.png = 获救后（安心）
                // 逆流行舟护送成功（主线三 complete_minigame / boat_navigation 目标完成，随后播 T05 归魂演出）后，
                // 由 Main.setJiangpoReunitedIdle(true) 切到 idle_after，
                // 读档/重进地图时由 Main.applyChapter2Stage 按同一判据恢复，避免存档前后立绘不一致。
                baseAnimations: {
                    idle: {
                        frameWidth: 32, frameHeight: 64, directionMode: 'row',
                        directions: {
                            down:  { row: 0, frames: 1 },
                            up:    { row: 0, frames: 1 },
                            left:  { row: 0, frames: 1 },
                            right: { row: 0, frames: 1 },
                        },
                        fps: 8, loop: true,
                    },
                },
                // 额外动画：女儿获救后的 idle（单帧 32×64，四方向共用第一帧）
                extraAnimations: [
                    {
                        name: 'idle_after',
                        resourcePath: 'npc.jiangpo_idle_after',
                        frameWidth: 32,
                        frameHeight: 64,
                        directionMode: 'row',
                        directions: {
                            down:  { row: 0, frames: 1 },
                            up:    { row: 0, frames: 1 },
                            left:  { row: 0, frames: 1 },
                            right: { row: 0, frames: 1 },
                        },
                        fps: 8,
                        loop: true,
                    },
                ],
                assignedQuests: ['chapter2_main_2'],
                dialogues: {
                    // JSON: J01 / M01 完成，M02 未接取
                    c2_j01_ask: {
                        id: 'c2_j01_ask',
                        text: '你是青岚来的？你们也在找人？\n主角: 您要找谁？\n我女儿江晚。她托人带了封信，说过了这道渡口就回来。\n信到了，人没到。后来他们领我看灯，我看不出哪一盏是她。\n主角: 信能借我看看吗？\n拿去吧。她总爱把竹叶画在落款边上，说比写名字好认。',
                        options: [
                            { text: '我帮您认灯。', next: null, action: 'accept_quest_chapter2_main_2' },
                            { text: '您收好，我稍后回来。', next: null },
                        ],
                        on_complete: ['obtain_jiangwan_letter'],
                    },
                    // JSON: J02 / M02 进行中，身份核对未完成
                    c2_j02_progress: {
                        id: 'c2_j02_progress',
                        text: '她小时候一过河就怕，把我袖子攥得紧紧的。\n后来出门了，还在信里说，让我过桥时靠里边走。你看到那句话，就知道是她。',
                        options: [],
                    },
                    // JSON: J03 / M02 目标全部完成，尚未交付
                    c2_j03_deliver: {
                        id: 'c2_j03_deliver',
                        text: '主角: 找到江晚了。她还记得让您走桥里面。\n是她。总嫌我走得急，嘴上念个不停。\n主角: 她还没回到身体，我们得把灯送到救助院。\n我跟你们去。需要水、需要布，我都能准备。\n阿禾: 丹药已经备好了。你们走水路时带上，我先去院里接应。',
                        options: [],
                    },
                    // JSON: J04 / 江晚已归魂，Boss 尚未胜
                    c2_j04_wait: {
                        id: 'c2_j04_wait',
                        text: '她睡着了，手还攥着我的袖子。\n小时候过河就是这样。我不走，等她自己松开。',
                        options: [],
                    },
                    // JSON: J05 / Boss 已胜
                    c2_j05_after_boss: {
                        id: 'c2_j05_after_boss',
                        text: '我想先留下，帮阿禾照看几天。那些守着床的人，总该有人陪着说句话。\n主角: 您不急着回家了？\n她回来了，晚几天走也不怕。',
                        options: [],
                    },
                    c2_jiangpo_idle: {
                        id: 'c2_jiangpo_idle',
                        text: '灯亮着，人就有个念想。\n主角: 这里的灯很多。\n多，可不是每一盏都有人来认。',
                        options: [],
                    },
                },
            },

            // ===== 许录（新角色：引渡司登记员）=====
            xulu: {
                id: 'xulu', name: '许录', moveSpeed: 60, isStatic: true,
                position: { x: 50, y: 33 }, patrolPoints: [],
                // Boss 战后把原册搬到救助院登记点（世界坐标 2671,1126）
                movePositions: { court: { x: 83, y: 35 } },
                moveWorldPositions: { court: { x: 2671, y: 1126 } },
                displayScale: 1,   // 同陆舟：本章新美术为 2 倍像素密度
                // idle：列排列 4 列（下/左/右/上，每列 1 帧），单帧 48×64（npc/xulu/idle.png = 192×64）
                baseAnimations: {
                    idle: {
                        frameWidth: 48, frameHeight: 64, directionMode: 'column',
                        directions: {
                            down:  { col: 0, frames: 1 },
                            left:  { col: 1, frames: 1 },
                            right: { col: 2, frames: 1 },
                            up:    { col: 3, frames: 1 },
                        },
                        fps: 8, loop: true,
                    },
                },
                assignedQuests: ['chapter2_main_1', 'chapter2_main_2', 'chapter2_main_4'],
                dialogues: {
                    // JSON: X01 / M01 进行中，登记摘页未取得
                    c2_x01_registry: {
                        id: 'c2_x01_registry',
                        text: '姓名、来处、要查的人。一个一个说。\n主角: 青岚村。这是我们带来的名册。\n陈栎……灯号青十七，待转。其余几盏已经出库。\n主角: 人还没醒，为什么把灯送走？\n按令集中安置。我们这里只管登记。\n主角: 给我一份记录。我得知道该去哪里找。\n摘页可以拿，原册不能带走。',
                        options: [],
                        on_complete: ['obtain_yunduze_registry'],
                    },
                    // JSON: X02 / M01 登记已取得，M02 未接取
                    c2_x02_after_registry: {
                        id: 'c2_x02_after_registry',
                        text: '纸上是现在能查到的。没有归还日期，我也写不出来。',
                        options: [],
                    },
                    // JSON: X03 / M02 进行中，已取得家书，待认灯未登记
                    c2_x03_lamps: {
                        id: 'c2_x03_lamps',
                        text: '主角: 我们要认领魂灯。家书、名册都在这里。\n认了也未必能领。上头要统一转运。\n主角: 你先让我知道，灯里是谁。\n……江晚，渡四二；陈栎，青十七。这两盏还没出库。我把核验栏打开，别碰其他的。',
                        options: [],
                        on_complete: ['obtain_hundeng_pair'],
                    },
                    // JSON: X04 / M02 完成，M03 未完成
                    c2_x04_refused: {
                        id: 'c2_x04_refused',
                        text: '核验通过了，可领灯的文书被退回来了。\n主角: 理由呢？\n只有四个字：照常上运。\n主角: 身份知道，身体也在，为什么不能归还？\n……我没有能回答你的那一栏。',
                        options: [],
                    },
                    // JSON: X05 / M04 进行中，凭证未取得
                    c2_x05_token: {
                        id: 'c2_x05_token',
                        text: '江晚和陈栎……真的醒了？\n主角: 就在救助院，你可以自己去看。\n我写了那么多“待转”，一直以为转走以后，总有人管。\n主角: 现在还有人在等。\n拿我的通行凭证去。原始账册在台后的匣子里，每一船都有去处。别只拿走一张告示。',
                        options: [],
                        on_complete: ['obtain_tongxing_token'],
                    },
                    // JSON: X06 / Boss 已胜
                    c2_x06_after_boss: {
                        id: 'c2_x06_after_boss',
                        text: '我把原册搬到救助院了。谁领回了人，谁还在找，都当面记。\n主角: 别再只写灯号。\n写名字，也写来处。',
                        options: [],
                    },
                    c2_xulu_idle: {
                        id: 'c2_xulu_idle',
                        text: '登记要按顺序，插不得队。\n主角: 那等着的人怎么办？\n……所以我最近开始把来处也写上去。',
                        options: [],
                    },
                },
            },

            // ===== 江晚（新角色：江婆之女；归魂后才出现实体）=====
            jiangwan: {
                id: 'jiangwan', name: '江晚', moveSpeed: 60, isStatic: true,
                position: { x: 75, y: 27 }, patrolPoints: [],
                displayScale: 1,   // 同陆舟：本章新美术为 2 倍像素密度
                // idle：单帧 32×64（npc/jiangwan/idle.png，四个方向共用第一帧）
                baseAnimations: {
                    idle: {
                        frameWidth: 32, frameHeight: 64, directionMode: 'row',
                        directions: {
                            down:  { row: 0, frames: 1 },
                            up:    { row: 0, frames: 1 },
                            left:  { row: 0, frames: 1 },
                            right: { row: 0, frames: 1 },
                        },
                        fps: 8, loop: true,
                    },
                },
                assignedQuests: ['chapter2_main_3'],
                dialogues: {
                    // JSON: W01 / 已归魂，M03 证词未取得
                    c2_w01_testimony: {
                        id: 'c2_w01_testimony',
                        text: '我在灯里听得见。有个人一直数灯，少一盏就让他们重查。\n主角: 谁在管？\n他们叫他渡厄使。靠近北边石台时，所有船都得停下给他验灯。\n主角: 他知道灯里的人能回来吗？\n有人问过。他说，回来也还会散，不如留在灯里。',
                        options: [], on_complete: ['record_jiangwan_testimony'],
                    },
                    // JSON: W02 / W01 已播放，Boss 尚未胜
                    c2_w02_wait: {
                        id: 'c2_w02_wait',
                        text: '我记得娘叫我的声音，可在灯里，怎么应都应不出来。\n别让其他人也一直这样等着。',
                        options: [],
                    },
                    // JSON: W03 / Boss 已胜
                    c2_w03_after_boss: {
                        id: 'c2_w03_after_boss',
                        text: '娘说要帮忙，我也想留下。先把认灯的线索誊清，至少字我还能写。\n主角: 累了就停。\n嗯。也替别人把名字写明白些。',
                        options: [],
                    },
                    c2_jiangwan_idle: {
                        id: 'c2_jiangwan_idle',
                        text: '我在灯里数过很多次水声。\n主角: 数清了？\n数不清。可我知道船是往上游走的。',
                        options: [],
                    },
                },
            },

            // ===== 陈栎（新角色：青岚村木匠，第一章名册中的失踪者）=====
            chenli: {
                id: 'chenli', name: '陈栎', moveSpeed: 60, isStatic: true,
                position: { x: 78, y: 27 }, patrolPoints: [],
                displayScale: 1,   // 同陆舟：本章新美术为 2 倍像素密度
                // idle：列排列 4 列（下/左/右/上，每列 1 帧），单帧 58×64（npc/chenli/idle.png = 232×64）
                baseAnimations: {
                    idle: {
                        frameWidth: 58, frameHeight: 64, directionMode: 'column',
                        directions: {
                            down:  { col: 0, frames: 1 },
                            left:  { col: 1, frames: 1 },
                            right: { col: 2, frames: 1 },
                            up:    { col: 3, frames: 1 },
                        },
                        fps: 8, loop: true,
                    },
                },
                assignedQuests: ['chapter2_main_3'],
                dialogues: {
                    // JSON: C01 / 已归魂，M03 证词未取得
                    c2_c01_testimony: {
                        id: 'c2_c01_testimony',
                        text: '我认得你……青岚的，归乡牌还挂着呢。\n主角: 村里暂时稳住了。我们来接大家。\n还有几盏先走了，没和我放一处。我听见照尘仙城的名字。\n主角: 我们会沿着记录追。\n那边的木箱都烙着同一个印。你去万灯台看看，账册总不会跟人一样认不出名字。',
                        options: [], on_complete: ['record_chenli_testimony'],
                    },
                    // JSON: C02 / C01 已播放，Boss 尚未胜
                    c2_c02_wait: {
                        id: 'c2_c02_wait',
                        text: '我还使不上力，只能先坐着。等手稳了，给你们修码头。',
                        options: [],
                    },
                    // JSON: C03 / Boss 已胜
                    c2_c03_after_boss: {
                        id: 'c2_c03_after_boss',
                        text: '陆舟那条船，几块板子该换了。我能给他搭把手。\n主角: 等船修好，您回青岚？\n回。西桥还欠一段栏杆呢。你们往前走，我回去告诉大家，找到人了。',
                        options: [],
                    },
                    c2_chenli_idle: {
                        id: 'c2_chenli_idle',
                        text: '手还是有点抖，握不住凿子。\n主角: 那就先记着尺寸。\n尺寸我记得牢。西桥那截栏杆，断口在左，别弄反了。',
                        options: [],
                    },
                },
            },
        };
    }

    // ==================== 任务配置 ====================

    /**
     * 第二章任务链（全部为主线；章内严格环环相扣，章首不设跨章硬前置）
     *
     * 任务状态机只允许推进“第一个未完成目标”（QuestSystem.updateQuestProgress），
     * 且接取前会校验 prerequisites 是否全部 COMPLETED，因此章内无法跳步：
     *   main_1 → main_2 → main_3 → main_4 → ending_1 → ending_2
     *
     * 章首《渡口无归客》不设跨章前置（策划案 M01「prerequisite: 初到云渡泽」、
     * 对白 A01 触发条件「初到云渡泽，M01 未接取」）。原因：云渡泽在世界地图上常开
     * （Main.debugUnlockAllWorldMapButtons），玩家可能在第一章未收尾时就进图；
     * 若把 chapter1_ending_3 写成硬前置，阿禾的「我去查登记。」会接取失败且只有
     * console 警告，任务面板就一直停在「暂无任务」。第一章首条主线 chapter1_main_1
     * 同样为 prerequisites: []，两章章首保持一致。
     * 第一章 → 第二章的剧情衔接仍由第一章《登船辞行》与云渡泽开场旁白（S01）负责。
     *
     * 本版平衡：本章所有任务都不再配置奖励（rewards 字段已全部移除），
     * Main.applyQuestRewards 对空 rewards 直接返回。角色成长改由两处提供：
     *   境界基准（GameConfig.realms：练气 150/70 → 筑基 400/250 → 结丹 1000/500，晋级即回满）；
     *   Boss 战败成长（本章渡厄使：气血上限 +35 / 灵息上限 +20，最多 5 次）。
     *   灵息自然恢复按境界分档：练气 1 秒 2 点 / 筑基 1 秒 4 点 / 结丹 1 秒 10 点。
     */
    static getQuestConfigs() {
        return {
            // ---- 主线一：接洽渡口，核对名册与航线，练熟连招（试炼传授剑影连斩）----
            c2_main_1: {
                id: 'chapter2_main_1', title: '渡口无归客',
                description: '找到先行抵达的阿禾，核对青岚名册、登记摘页与旧航线，并把招式练熟。',
                type: 'main', chapter: 2, order: 1,
                // 章首不设跨章前置（策划案 M01 =「初到云渡泽」）；第一章是否收尾由登船 / 开场旁白把关
                prerequisites: [],
                giver: 'ahe', receiver: 'ahe',
                objectives: [
                    { type: 'talk_to', target: 'xulu', count: 1, description: '向许录取得登记摘页' },
                    { type: 'talk_to', target: 'luzhou', count: 1, description: '与陆舟核对旧航线' },
                    { type: 'complete_training', target: 'sword', count: 1, description: '完成剑修基础连招试炼' },
                    { type: 'talk_to', target: 'ahe', count: 1, description: '向阿禾交付' },
                ],
                // 无任务奖励（新平衡：章内任务全部取消奖励）。
                // 剑影连斩仍由主线一的剑修连招试炼传授（Main.onAllCompleted 的 sword 分支 →
                // learnProfessionSkill('jianying')），不依赖奖励字段。
                nextQuest: 'chapter2_main_2',
            },

            // ---- 主线二：认灯归魂（不发魂，只认身份）----
            c2_main_2: {
                id: 'chapter2_main_2', title: '一封到不了的家书',
                description: '替江婆认领女儿江晚的魂灯，并在核验栏完成江晚与陈栎的身份核对。',
                type: 'main', chapter: 2, order: 2,
                prerequisites: ['chapter2_main_1'],
                giver: 'jiangpo', receiver: 'jiangpo',
                objectives: [
                    { type: 'talk_to', target: 'xulu', count: 1, description: '从许录处取得两盏待认领魂灯及登记线索' },
                    { type: 'investigate', target: 'lantern_clue', count: 1, description: '在引渡司核验栏读清家书与登记线索' },
                    { type: 'talk_to', target: 'ahe', count: 1, description: '向阿禾问出陈栎的补充线索' },
                    { type: 'complete_minigame', target: 'lantern_identify', count: 1, description: '在认灯台完成身份核对' },
                    { type: 'talk_to', target: 'jiangpo', count: 1, description: '向江婆交付' },
                ],
                // 无任务奖励（新平衡：章内任务全部取消奖励）
                nextQuest: 'chapter2_main_3',
            },

            // ---- 主线三：逆流送灯，归魂取词 ----
            c2_main_3: {
                id: 'chapter2_main_3', title: '逆流送灯',
                description: '用旧水道把两盏已识别的魂灯逆流送到右侧救助院，完成归魂并取得获救者证词。',
                type: 'main', chapter: 2, order: 3,
                prerequisites: ['chapter2_main_2'],
                giver: 'luzhou', receiver: 'luzhou',
                objectives: [
                    { type: 'talk_to', target: 'ahe', count: 1, description: '向阿禾确认右侧归魂点已准备完毕' },
                    { type: 'complete_minigame', target: 'boat_navigation', count: 1, description: '完成逆流行舟护送' },
                    { type: 'talk_to', target: 'jiangwan', count: 1, description: '与江晚交谈（听她说灯里的事）' },
                    { type: 'talk_to', target: 'chenli', count: 1, description: '与陈栎交谈（问出转运线索）' },
                    { type: 'talk_to', target: 'luzhou', count: 1, description: '向陆舟交付' },
                ],
                // 无任务奖励（新平衡：章内任务全部取消奖励）
                // 通关后由 Main.ensureFoundationPerfect 把境界推至筑基圆满（主线四的门槛要求）
                nextQuest: 'chapter2_main_4',
            },

            // ---- 主线四：万灯台，击败渡厄使并查台后账册 / 命令 ----
            c2_main_4: {
                id: 'chapter2_main_4', title: '万灯渡口',
                description: '取得通行凭证登上右上石台，击败渡厄使，并调查台后的转运账册与太玄增供命令。',
                type: 'main', chapter: 2, order: 4,
                prerequisites: ['chapter2_main_3'],
                giver: 'luzhou', receiver: 'ahe',
                objectives: [
                    { type: 'talk_to', target: 'xulu', count: 1, description: '向许录取得万灯台通行凭证' },
                    { type: 'defeat_boss', target: 'boss_due', count: 1, description: '进入万灯台，击败渡厄使' },
                    { type: 'investigate', target: 'zhuanyun_zhangce', count: 1, description: '调查转运账册' },
                    { type: 'investigate', target: 'taixuan_mingling', count: 1, description: '调查太玄增供命令' },
                    { type: 'talk_to', target: 'ahe', count: 1, description: '向阿禾交付' },
                ],
                // 无任务奖励（新平衡：章内任务全部取消奖励）
                // 账册 / 命令由万灯台台后的两个调查点 grantItems 发放（剧情物品，不可出售 / 丢弃）
                nextQuest: 'chapter2_ending_1',
            },

            // ---- 章末一：结丹调息（复用第一章定息规则，不插进 Boss 战）----
            c2_ending_1: {
                id: 'chapter2_ending_1', title: '灯定丹成',
                description: '在阿禾护持下收息凝神，完成结丹调息。',
                type: 'main', chapter: 2, order: 5,
                prerequisites: ['chapter2_main_4'],
                giver: 'ahe', receiver: 'ahe',
                objectives: [
                    { type: 'complete_core_trial', target: 'jiedan', count: 1, description: '完成结丹调息' },
                ],
                // 无任务奖励（新平衡：章内任务全部取消奖励）。
                // 境界 → 结丹（气血 1000 / 灵息 500 并回满）由结丹调息结算写入：
                // Main.completeCoreFormationTrial → Main.applyRealmStats('jiedan')
                // （GameConfig.realms.JIEDAN 为唯一数据源），不依赖奖励字段。
                nextQuest: 'chapter2_ending_2',
            },

            // ---- 章末二：行舟有归处（安置交接 → 登船）----
            c2_ending_2: {
                id: 'chapter2_ending_2', title: '行舟有归处',
                description: '确认行舟已修好、交接安置，然后从中央泊位登船前往照尘仙城。',
                type: 'main', chapter: 2, order: 6,
                prerequisites: ['chapter2_ending_1'],
                giver: 'luzhou', receiver: 'luzhou',
                objectives: [
                    { type: 'talk_to', target: 'ahe', count: 1, description: '与阿禾确认安置与出发计划' },
                    { type: 'board_boat', target: 'zhaochen_boat', count: 1, description: '在中央泊位登船，前往照尘仙城' },
                ],
                // c2_ending_2：不再发奖（新平衡：章内任务全部取消奖励）
                nextQuest: null,
            },
        };
    }

    // ==================== 怪物配置 ====================

    /**
     * 本章野外不放普通怪物（云渡泽是渡口集市），只登记万灯台 Boss「渡厄使」与其召唤的小兵。
     * 渡厄使由 js/DueBoss.js 实现（与第一章 js/ShanxiaoBoss.js 同构的独立类，不继承通用 Boss）：
     *   - 7 套动作图：单帧 96×96。idle 为**列排列**（4 列 = 下/左/右/上，每列 1 帧 → 384×96）；
     *     summon / dash / control / hurt / move 为行排列 4 行（下/左/右/上）× 6 帧 → 576×384；
     *     dead 为单行 6 帧 → 576×96。占位图：tools/generate_chapter2_assets.py --due-only。
     *   - 招式：冲刺（5s 冷却，不可打断，动画结束以本体为圆心判定伤害）、
     *     控制（40s，可打断，动画播完锁玩家按键 3 秒）、
     *     召唤（60s，可打断，生成小兵，场上最多 2 个）。
     *   - 小兵（boss_due_minion）：3 套动作（idle 6 帧 / move 8 帧 / attack 7 帧，单帧 96×32），
     *     只走上下左右、A* 寻路、自动攻击玩家；标记 isArenaBoss → 不给经验 / 灵石。
     */
    static getMonsterConfigs() {
        return {
            boss_due: {
                id: 'boss_due', name: '渡厄使', type: 'boss', realm: 'zhuji',
                health: 500, damage: 26, defense: 8,
                expReward: 150, lingShiReward: 400,
                toughness: 120,
                hitBoxSize: 80,
                dropItems: [],
            },
            // 渡厄使召唤的小兵（守台傀儡）：血量 / 攻击都低，靠数量压制
            boss_due_minion: {
                id: 'boss_due_minion', name: '守台傀儡', type: 'minion', realm: 'lianqi',
                health: 60, damage: 8, defense: 2,
                expReward: 0, lingShiReward: 0,
                dropItems: [],
            },
        };
    }

    // ==================== 物品配置 ====================

    /**
     * 本章新增的剧情 / 任务物品（均不可出售、不可丢弃）。
     * 图片：assets/images/quest_items/<id>.png（缺图时拾取物走程序化金色菱形兜底）
     */
    static getItemConfigs() {
        return {
            dengji_zhaie: {
                id: 'dengji_zhaie', name: '登记摘页', type: 'quest',
                description: '引渡司许录抄给的登记摘页：青岚村的灯号与去向都在上面',
                stackable: false,
            },
            jiangwan_jiashu: {
                id: 'jiangwan_jiashu', name: '江晚家书', type: 'quest',
                description: '江晚写给江婆的信，落款边画着两片竹叶',
                stackable: false,
            },
            hundeng_jiangwan: {
                id: 'hundeng_jiangwan', name: '魂灯·渡四二', type: 'quest',
                description: '待认领的魂灯，登记为江晚（渡四二）',
                stackable: false,
            },
            hundeng_chenli: {
                id: 'hundeng_chenli', name: '魂灯·青十七', type: 'quest',
                description: '待认领的魂灯，登记为陈栎（青十七）',
                stackable: false,
            },
            tongxing_pingzheng: {
                id: 'tongxing_pingzheng', name: '万灯台通行凭证', type: 'quest',
                description: '许录交出的通行凭证，可过桥登上万灯台',
                stackable: false,
            },
            zhuanyun_zhangce: {
                id: 'zhuanyun_zhangce', name: '照尘仙城转运账册', type: 'quest',
                description: '逐项记着魂灯编号、原籍与转运船次；数盏青岚魂灯的终点写着照尘仙城丹坊',
                stackable: false,
            },
            taixuan_mingling: {
                id: 'taixuan_mingling', name: '太玄增供命令', type: 'story',
                description: '要求加紧汇集魂力、增加上运灯数的令文，署名太玄道君，附与青岚阵核相同的法印',
                stackable: false,
            },
        };
    }

    // ==================== 地图配置 ====================

    /**
     * 云渡泽（主图）+ 万灯台（Boss 战场）两张地图
     *
     * 碰撞表（collisionData）由 tools/generate_chapter2_assets.py 从同一份 layout 生成，
     * 与 assets/images/maps/yunduze/collision.png（及 boss_arena_ch2 同名图）完全一致；以 file:// 打开游戏读不到图片像素时，
     * TileSystem 会回退到这张表（否则整图会被判成“全部可通行”）。
     * 重新生成 / 校验：py -3 tools/generate_chapter2_assets.py --check
     */
    static getMapConfigs() {
        return {
            // ===== 云渡泽：渡口集市 / 救助院 / 中北水道 / 万灯台石台 / 中央泊位 =====
            yunduze: {
                id: 'yunduze', name: '云渡泽', chapter: 2,
                tileSize: 32, mapWidth: 100, mapHeight: 56,   // 3200 × 1792 px
                collisionData: [
                    '####################################################################################################',
                    '#########...########################################..##############################################',
                    '#########...########################################...#############################################',
                    '#########...#################################...........############################################',
                    '#########...#################################...........##############################.#......######',
                    '##########..#################################...........#############################............###',
                    '##########...##############################...#####.#...#############################............###',
                    '##########.......##########################...########..###########################..............###',
                    '##########........#########################...########..#########################................###',
                    '#########.....#....###################################...........................................###',
                    '########....#####..###################################...........................................###',
                    '#######....######..####################################...........................#.##.........#####',
                    '#######...##############################################...##################....#######......######',
                    '#######...#################...##########################..###############################....#######',
                    '#######....################.....########......##########..###############################....#######',
                    '#######....###################....#####.......##########..###############################....#######',
                    '#######....####################.........#################################################....#######',
                    '#######....#####################.......##################################################....#######',
                    '#######....#########################....#################################################...########',
                    '#######.......#######################....################################################...########',
                    '########........#######################...###############################################...########',
                    '##########......########################..###############################################...########',
                    '##############..########################..###########....################################...########',
                    '##############...#######################..###########....################################....#######',
                    '##############...#######################..###########....#################################....######',
                    '##############...#######################..############...#################.###############....######',
                    '##############.....#####################..############...############..##......############...######',
                    '#############.......####################..############...############..##......############...######',
                    '#############.........#################....###########...###...........##......###########....######',
                    '################.......###############....############...###...........##......###########....######',
                    '################..#......###########.......##########.........###########.......#########....#######',
                    '####################...................##..########...........###########.......########....########',
                    '#####################.................####..#####.....#.....###############.....########...#########',
                    '######################...###########..####..........####....###############......######....#########',
                    '######################...###########...####.........####....###########....................#########',
                    '######################...############..#####.......######......########...................##########',
                    '######################...#############..####....##..#####.......######......#...........############',
                    '######################...#############...##.....##...###..........##.....#.####.#.......############',
                    '###################........###########......................###........###############..############',
                    '##################.........###########.....................####.......################...###########',
                    '################..........#############......###...#......#####......##################.......######',
                    '###############..........#############......##########................#################........#####',
                    '#############........#################......##########.................######################..#####',
                    '#############.......##################...##...#######....####...###.....#####################..#####',
                    '###############...#####################..###.....#####...####..#####.....####################...####',
                    '###############...######################..#####..#####...############......##################..#####',
                    '###############...#############################..#####...#############.....##################..#####',
                    '###############....############################..#####...##############....##################...####',
                    '################...############################..#####...###############...##################..#####',
                    '#################...###########################..#####...###############...#################...#####',
                    '#################...##################################...###################################...#####',
                    '################.....#################################...###################################...#####',
                    '################......################################.....#################################...#####',
                    '##################.....#################################...##############################.......####',
                    '##################.....##################################...############################.......#####',
                    '##################....###################################...##########################....##########',
                ],
                // === NPC 站位（瓦片坐标；下面 npcWorldPositions 为精确像素，优先） ===
                npcPositions: {
                    ahe:      { x: 59, y: 37 },   // 渡口集市·救助棚
                    luzhou:   { x: 22, y: 38 },   // 帆船码头
                    jiangpo:  { x: 51, y: 38 },   // 集市·井边
                    xulu:     { x: 50, y: 33 },   // 集市·引渡司办事摊位
                    jiangwan: { x: 75, y: 27 },   // 右侧救助院（归魂后才加入地图）
                    chenli:   { x: 78, y: 27 },   // 右侧救助院（归魂后才加入地图）
                },
                npcWorldPositions: {
                    ahe:      { x: 1914, y: 1205 },
                    luzhou:   { x: 718,  y: 1241 },
                    jiangpo:  { x: 1646, y: 1223 },
                    xulu:     { x: 1615, y: 1056 },
                    jiangwan: { x: 2414, y: 886 },
                    chenli:   { x: 2514, y: 889 },
                },
                // === 任务道具：本章物品都由对话 / 调查点发放，地图上不生成拾取物 ===
                pickupItems: {},
                // === 调查点：引渡司核验栏（读清两盏魂灯的线索）===
                // 仅当主线二推进到“在核验栏读清线索”时，靠近才出现“按 E 调查”
                windPiles: {
                    verify_rack: {
                        id: 'wind_pile_verify_rack', name: '引渡司核验栏',
                        position: { x: 1760, y: 152 }, radius: 64,
                        promptText: '查看两盏待认魂灯',
                        image: 'windPiles.verify_rack',
                        imageWidth: 64, imageHeight: 96, anchor: 'bottom',
                        // 不绘制程序化占位桩体（美术缺图时的那根程序化石桩）：交互与提示照旧，
                        // 补上 windPiles.verify_rack.png（64×96）后即恢复显示立绘
                        showPlaceholderBody: false,
                        questId: 'chapter2_main_2',
                        objectiveType: 'investigate', objectiveTarget: 'lantern_clue',
                        dialogue: {
                            // JSON: I01「阅读江晚家书」 + I02「阅读青岚登记附件」 + I03 前置
                            text: '核验栏上并排立着两盏没出库的灯：渡四二、青十七。\n主角: 先把能认的线索看清楚。\n旁白: 信尾画着两片竹叶：娘，桥上风大，记得靠里边走。等水退了，我带桂花糕回来。\n主角: 竹叶、过桥、桂花糕……这些可以慢慢问，不必只认一张脸。\n旁白: 青十七：陈栎，青岚村木匠。送入时携木尺，尺背刻有“西桥重修”。\n主角: 西桥的栏杆就是他修的。阿禾应当也记得。\n线索够了。先去问阿禾一句，再回来核对。',
                        },
                    },
                },
                // === 路标 ===
                // 认灯台：接取主线二且已在核验栏读清线索后出现，按 E 进入「认灯归魂」身份核对
                signposts: {
                    lantern_stand: {
                        id: 'signpost_lantern_stand', name: '认灯台',
                        position: { x: 2905, y: 160 }, radius: 48,
                        promptText: '开始认灯归魂',
                        image: 'signposts.lantern_identify',
                        imageWidth: 60, imageHeight: 60,
                        questRequired: 'chapter2_main_2',
                        requireObjective: { type: 'investigate', target: 'lantern_clue' },
                        gameId: 'lantern_identify',
                        roleplayDialogue: '两盏灯都在这里了。把名字和记得的事对上，就可以引魂归体。',
                        oneShot: false,
                    },
                    // 水道入口：接取主线三并向阿禾确认归魂点后出现，按 E 进入「逆流行舟」护送
                    river_escort: {
                        id: 'signpost_river_escort', name: '旧水道',
                        position: { x: 1831, y: 468 }, radius: 48,
                        promptText: '逆流送灯',
                        image: 'signposts.river_escort',
                        imageWidth: 60, imageHeight: 60,
                        questRequired: 'chapter2_main_3',
                        requireObjective: { type: 'talk_to', target: 'ahe' },
                        gameId: 'boat_navigation',
                        roleplayDialogue: '把灯放稳。记住，风大就等，水急就绕，不抢那一点路。',
                        oneShot: false,
                    },
                },
                // === 传送法阵 ===
                //   wandengtai —— 万灯台石台（正式入口：接取主线四 + 向许录取得万灯台通行凭证后出现）
                //   注：出生点旁的「渡厄使试炼法阵（调试通道）」已按需求下线，
                //       本表只剩这一个入口（打赢过 Boss 后不会重新生成，见 Main.enterBossArena）
                teleporters: {
                    wandengtai: {
                        id: 'teleport_wandengtai', name: '万灯台石台',
                        worldPosition: { x: 2900, y: 270 }, radius: 76,
                        promptText: '按 E 登上万灯台',
                        targetMapId: 'boss_arena_ch2',
                        // 玩家入场位（世界坐标 320,540；瓦片 8,13 = 地图配置 entryPoint，
                        // ⚠ 改坐标时两处必须一起改，冒烟测试会校验「法阵落点＝入场点」）
                        targetPosition: { x: 320, y: 540 },
                        image: 'teleportArrays.wandengtai',
                        imageWidth: 96, imageHeight: 96, anchor: 'center',
                        questRequired: 'chapter2_main_4',
                        // 目标门控：接取主线四还不够 —— 必须先完成第 1 步「向许录取得万灯台通行凭证」
                        // （对话 X05 → obtain_tongxing_token，即 talk_to: xulu 目标完成）法阵才生成。
                        // 否则玩家能跳过那一步直接登台打 Boss，许录手里的凭证就没意义了
                        // （目标完成的那一刻由 Main.onQuestProgress → updateTeleportQuestGates 刷出来）。
                        requireObjective: { type: 'talk_to', target: 'xulu' },
                        bossArena: true,
                        arenaDefeatFlag: 'due_boss_defeated',
                        arenaVictory: { questId: 'chapter2_main_4', type: 'defeat_boss', target: 'boss_due' },
                        arenaResourceGroup: 'bossArenaCh2',
                        // === 战败成长（Boss 失败补偿）===
                        // 每次在渡厄使战场战败 → 气血上限 +35 / 灵息上限 +20，
                        // 最多结算 5 次（第 6 次起不再提升）；累计值随存档保存。
                        // 由 Main.returnFromBossArena → Main.applyBossFailureBonus 结算。
                        arenaDefeatBonus: { id: 'boss_due', maxHealth: 35, maxMana: 20, maxFailures: 5 },
                        arenaReturnMapId: 'yunduze',
                    },
                },
                // === 章末：中央泊位登船（E02 进行中且已与阿禾交接后出现） ===
                chapterEnd: {
                    departSignpost: {
                        id: 'signpost_zhaochen_boat', name: '登船',
                        position: { x: 587, y: 1327 }, radius: 56,
                        promptText: '登船前往照尘仙城',
                        image: 'signposts.depart_boat',
                        imageWidth: 60, imageHeight: 60,
                        questRequired: 'chapter2_ending_2',
                        requireObjective: { type: 'talk_to', target: 'ahe' },
                        oneShot: false,
                    },
                    // 阿禾 / 陆舟在行舟解锁后的站位（世界坐标）
                    aheBerthWorldPosition: { x: 555, y: 1400 },
                    luzhouBerthWorldPosition: { x: 700, y: 1320 },
                },
                // === 入口点：码头栈道（从青岚浮野登船抵达处；世界 528,1392） ===
                entryPoint: { x: 16, y: 43 },
                ambientConfig: {
                    // 飘落物（落叶 / 落花）：云渡泽是第二章主图 → 开启（水泽花多，比例略偏落花）
                    // maxCount = 界面中同时存在的最大飘落物数量（调它控疏密）
                    fallingFoliage: {
                        enabled: true,
                        maxCount: 18,
                        spawnRate: 1.0,
                        leafWeight: 0.45,
                        flowerWeight: 0.55,
                    },
                    fog: { enabled: true, opacity: 0.28 },
                },
            },

            // ===== 万灯台（渡厄使战场，主线四专用地图）=====
            // 图片：assets/images/maps/boss_arena_ch2/bg.png 与 collision.png，均为 1280×720；
            // 尺寸换算：tileSize 40 × 32 列 = 1280，40 × 18 行 = 720（必须整除）。
            boss_arena_ch2: {
                id: 'boss_arena_ch2', name: '万灯台', chapter: 2,
                tileSize: 40, mapWidth: 32, mapHeight: 18,
                collisionData: [
                    '################################',
                    '######...................#######',
                    '#####.....................######',
                    '####..........................##',
                    '###...........................##',
                    '##............................##',
                    '###...........................##',
                    '###...........................##',
                    '####..........................##',
                    '#####.........................##',
                    '######........................##',
                    '######........................##',
                    '#####....#..................####',
                    '######...##.................####',
                    '#############...............####',
                    '##############..........########',
                    '################################',
                    '################################',
                ],
                npcPositions: {},
                // 玩家从云渡泽石台传入后的落点（瓦片坐标 8,13 → 世界 340,540）；
                // 精确入场位是世界坐标 (320,540)（由传送法阵 targetPosition 给出，两者同格）
                // ⚠ 必须落在可通行瓦片上，否则进入战场后会被碰撞判定卡住
                entryPoint: { x: 8, y: 13 },
                pickupItems: {},
                // === 台后两个调查点：击败渡厄使后依次可调查（账册 → 命令） ===
                windPiles: {
                    zhangce_stand: {
                        id: 'wind_pile_zhangce', name: '台后石案·转运账册',
                        position: { x: 540, y: 380 }, radius: 56,
                        promptText: '调查转运账册',
                        image: 'windPiles.zhangce_stand',
                        imageWidth: 64, imageHeight: 96, anchor: 'bottom',
                        // 不绘制程序化占位桩体（美术缺图时也不画那根程序化石桩）：
                        // 交互仍在 —— 靠近半径内且轮到该目标时照常出现「按 E 调查转运账册」，
                        // 补上 windPiles.zhangce_stand.png（64×96）后即恢复显示立绘
                        showPlaceholderBody: false,
                        questId: 'chapter2_main_4',
                        objectiveType: 'investigate', objectiveTarget: 'zhuanyun_zhangce',
                        grantItems: ['zhuanyun_zhangce'],
                        dialogue: {
                            // JSON: I04
                            text: '旁白: 账册逐项列着魂灯编号、原籍与转运船次。数盏青岚魂灯的终点写着：照尘仙城，丹坊接收。\n主角: 不是归还，是继续转运。名字和船次都有了。',
                        },
                    },
                    mingling_stand: {
                        id: 'wind_pile_mingling', name: '台后石案·增供命令',
                        position: { x: 860, y: 380 }, radius: 56,
                        promptText: '调查增供命令',
                        image: 'windPiles.mingling_stand',
                        imageWidth: 64, imageHeight: 96, anchor: 'bottom',
                        // 同上：不画程序化占位桩体，只保留交互与提示
                        showPlaceholderBody: false,
                        questId: 'chapter2_main_4',
                        objectiveType: 'investigate', objectiveTarget: 'taixuan_mingling',
                        grantItems: ['taixuan_mingling'],
                        dialogue: {
                            // JSON: I05
                            text: '旁白: 令文要求加紧汇集魂力、增加上运灯数，署名太玄道君，并附与青岚阵核相同的法印。\n主角: 青岚的阵器，这里的魂灯……这次不只是一个印记了。',
                        },
                    },
                },
                signposts: {},
                lanternBoxes: {},
                // === 战场传送法阵：配置留空，由代码动态生成 ===
                //   战败 → Main 送回云渡泽石台旁；胜利 → 地图正中心生成永久归途法阵（按 E 回去）
                teleporters: {},
                // === 渡厄使：由 GameMap 读取本配置创建 js/DueBoss.js 的 DueBoss ===
                // 出生位＝世界坐标 worldPosition (960,180)（万灯台圆台右上侧；x/y 是它所在的瓦片，
                // 供寻路/可达性校验用）。GameMap.spawnArenaBoss 优先用 worldPosition，
                // 没有该字段时按 x/y 的瓦片中心（tileToWorld）换算，向后兼容第一章战场配置。
                bossPosition: {
                    boss_due: {
                        x: 24, y: 4,
                        worldPosition: { x: 960, y: 180 },
                        monsterId: 'boss_due',
                        ai: 'due',
                        // tuning —— 可选：只写需要覆盖 DueBoss.DEFAULT_TUNING 的字段
                        //   （追击/冲刺/控制/召唤/小兵等数值）。本 Boss 全部使用类内默认值，
                        //   故此处留空——唯一来源见 js/DueBoss.js 的 DueBoss.DEFAULT_TUNING
                        //   与 DueMinion.DEFAULT_TUNING。
                        //   如需按章节单独调平衡，在此补 { 字段: 值 }（含 minion: {...} 子对象）即可。
                    },
                },
                ambientConfig: {
                    // 飘落物：万灯台是 Boss 战场 → 不显示（白名单之外的图一律关，见 js/FallingFoliage.js）
                    fallingFoliage: { enabled: false },
                    fog: { enabled: true, opacity: 0.22 },
                },
            },
        };
    }

    // ==================== 旁白 / 剧情对白（无 NPC 承载，由 Main.playStoryDialogue 播放） ====================

    /**
     * 这些对白由剧本触发（进入地图 / 小游戏结算 / 战斗结果），不属于任何 NPC。
     * JSON 编号对应：S01 / T01~T07 / B01 / B04 / B05 / S02~S04；
     * subtitle_* 是战斗中的短字幕（不暂停操作）。
     */
    static getStoryDialogues() {
        return {
            // JSON: S01 / 首次载入云渡泽
            s01_opening: {
                id: 's01_opening',
                text: '旁白: 船驶入芦苇间。岸上挂着许多灯，渡口却听不见迎人的声音。\n主角: 这么多船，都在等什么？\n陆舟: 有人等过河，有人等家里人。从前到这里是为了走，如今倒都留下了。\n陆舟: 青岚来的？你们那位医者已经到了，在集市救助棚。',
            },
            // JSON: T01 / 剑修教学成功
            t01_sword_done: {
                id: 't01_sword_done',
                text: '主角: 收招后留一步，果然来得及退。\n陆舟: 记住这个节奏。水道里没有这么宽的地方让你乱闯。',
            },
            // JSON: T02 / 认灯灯序三次没对上（退出小游戏；魂灯无损，可回认灯台重来）
            t02_identify_fail: {
                id: 't02_identify_fail',
                text: '系统: 三次灯序都没对上。魂灯没有受损，可回核验栏重看线索，再到认灯台试一次。',
            },
            // JSON: T03 / 认灯灯序对上 → 主角自言自语 + 灯中回应
            t03_identify_success: {
                id: 't03_identify_success',
                text: '主角: 都对上了，一盏不差……\n旁白: 两盏灯同时亮了一下，光里透出很远的声音。\n江晚: 桥边……娘，往里走……\n陈栎: 西桥……还差一段栏杆……\n主角: 听见了。我们知道你们是谁，不会把灯弄错。',
            },
            // JSON: T04 / 护送失败（可重试，不丢魂灯）
            t04_escort_fail: {
                id: 't04_escort_fail',
                text: '陆舟: 灯都拢住了，我们退回了缓水区。先把船摆正，再来。',
            },
            // JSON: T05 / 护送成功 → 归魂演出
            t05_soul_return: {
                id: 't05_soul_return',
                text: '陆舟: 靠岸了！阿禾，接灯！\n阿禾: 名字对上了。江婆，叫她一声。\n江婆: 晚儿，回家吃饭了。\n旁白: 灯火沿着细细的光线落下。江晚睁开眼，陈栎的手指也轻轻动了。\n江晚: 娘……我怎么让你等了这么久。\n阿禾: 先别起身。慢慢呼吸，你们已经回来了。',
            },
            // JSON: T06 / 结丹试炼失败
            t06_core_fail: {
                id: 't06_core_fail',
                text: '阿禾: 气息散了，先休息。这里没人催你，把下一口气放稳就好。',
            },
            // JSON: T07 / 结丹试炼成功
            t07_core_success: {
                id: 't07_core_success',
                text: '旁白: 周身流转的灵息向内收拢，丹田中一点金光渐渐稳定。\n主角: 凝住了。\n阿禾: 你方才握得那么紧，现在终于松开了。\n旁白: 岸上练熟的剑影连斩随丹息沉定，锋芒不再外散。',
            },
            // JSON: B01 / 渡厄使战前对话
            b01_encounter: {
                id: 'b01_encounter',
                text: '渡厄使: 是你把两盏魂灯带出了水道？\n主角: 江晚，陈栎。他们有名字。\n渡厄使: 如今活着，下一场灵潮呢？留在灯中，他们至少不会再散。\n主角: 你没有问过他们愿不愿意。\n渡厄使: 我奉令保全魂息，无须每个人都懂。\n主角: 那就把路让开，让他们自己选。',
            },
            // JSON: B04 / Boss 气血归零（胜利演出）
            b04_boss_win: {
                id: 'b04_boss_win',
                text: '旁白: 锁链坠在石台上，拘魂阵灯接连熄灭。\n渡厄使: 上游还在等灯……这边断了，他们不会罢休。\n主角: 谁在等？\n渡厄使: 命令就在后面。你自己看。\n旁白: 渡厄使再无力维持阵法，桥头的封锁随之消散。',
            },
            // JSON: B05 / Boss 失败或主动放弃
            b05_boss_fail: {
                id: 'b05_boss_fail',
                text: '系统: 已返回石台外，战内丹药已恢复。可调整技能后重新挑战。',
            },
            // JSON: S02 / 中央泊位准备出发
            s02_berth: {
                id: 's02_berth',
                text: '陆舟: 去照尘仙城的水路已经记下。准备开船吗？',
            },
            // JSON: S03 / 照尘仙城实际载入成功
            s03_arrive_zhaochen: {
                id: 's03_arrive_zhaochen',
                text: '旁白: 岸上的人举灯送行。这一次，灯照着归路，里面没有囚住谁。\n主角: 还有几个人。\n阿禾: 名字带着，我们接着找。',
            },
            // JSON: S04 / 尚未准备出发时交互航点
            s04_not_ready: {
                id: 's04_not_ready',
                text: '系统: 尚未准备出发，请查看任务簿中的主线或行舟交接目标。',
            },
            // 战斗中短字幕（不暂停操作，由 Main.showSubtitle 播放）
            // B02：渡厄使召唤小兵（原「护盾召出」随阵灯机制一起移除）
            subtitle_summon: {
                id: 'subtitle_summon',
                text: '渡厄使: 一个人的路太慢……渡口不缺人。 ｜ 主角: 他唤起了守台的傀儡，先清掉它们！',
            },
            // B03：控制命中（锁链缚住玩家）
            subtitle_control: {
                id: 'subtitle_control',
                text: '渡厄使: 锁链缚住你，便由不得你走。 ｜ 主角: 动不了……只看他链上的动静！',
            },
            subtitle_low_hp: {
                id: 'subtitle_low_hp',
                text: '渡厄使: 你带得走两个人，带得走这满河的魂吗？ ｜ 主角: 先从你拦着的这些人开始。',
            },
            subtitle_retry: {
                id: 'subtitle_retry',
                text: '主角: 这次先看清锁链和冲刺的方向。',
            },
            subtitle_death: {
                id: 'subtitle_death',
                text: '系统: 已返回石台外，战内丹药已恢复。可调整技能后重新挑战。',
            },
        };
    }

    // ==================== 对话选择器 ====================

    /**
     * 当前地图是否属于第二章（Main 用它决定优先使用哪一章的对话选择器）
     * @param {string} mapId
     * @returns {boolean}
     */
    static isChapter2Map(mapId) {
        return Chapter2Config.getMapIds().indexOf(mapId) !== -1;
    }

    /**
     * 根据玩家任务进度，返回 NPC 当前应显示的第二章对话 ID
     *
     * 规则自上而下匹配，命中即返回；都不命中时返回 null，
     * 由 Main 回退到 Chapter1Config（同一 NPC 在第一章地图上仍走第一章对白）。
     *
     * @param {string} npcId - NPC ID
     * @param {Object} questSystem - 玩家任务系统实例
     * @param {Object} [questItemSystem] - 任务物品系统实例（whenHasItem 用）
     * @returns {string|null} 对话 ID
     */
    static getDialogueForNPC(npcId, questSystem, questItemSystem) {
        if (!questSystem) return null;
        const qs = questSystem;
        if (questItemSystem) qs.questItemSystem = questItemSystem;

        const M1 = 'chapter2_main_1';
        const M2 = 'chapter2_main_2';
        const M3 = 'chapter2_main_3';
        const M4 = 'chapter2_main_4';
        const E1 = 'chapter2_ending_1';
        const E2 = 'chapter2_ending_2';

        const rules = {
            // ===== 阿禾：本章主线的主要交接人 =====
            ahe: [
                // 第二章完成 → 行舟上的闲聊
                { whenComplete: E2, dialogueId: 'c2_ahe_idle' },
                // 行舟已解锁，出发交接未确认
                { whenActive: E2, dialogueId: 'c2_a09_depart_plan' },
                // 结丹已成、行舟尚未解锁 → 过渡闲聊
                { whenComplete: E1, dialogueId: 'c2_ahe_idle' },
                // 结丹入口（M04 交付完成 / E01 进行中）
                { whenActive: E1, dialogueId: 'c2_a08_core_ready' },
                { whenComplete: M4, dialogueId: 'c2_a08_core_ready' },
                // M04 目标齐（账册 + 增供命令都查到）→ 交付对话 A07（放在 whenActive M4 之前，
                // 否则「向阿禾交付」这一步永远只会播战前叮嘱 —— A07 原先没有任何规则指向，是死节点）
                {
                    whenActiveAndObjectiveCompleted: { questId: M4, type: 'investigate', target: 'taixuan_mingling' },
                    dialogueId: 'c2_a07_deliver',
                },
                // M04 进行中：Boss 已胜但两处调查还没查完 → 阶段闲聊
                // （JSON A06 的条件是「M04进行中，Boss未胜」，打赢之后不能再念「你一定回来」）
                {
                    whenActiveAndObjectiveCompleted: { questId: M4, type: 'defeat_boss', target: 'boss_due' },
                    dialogueId: 'c2_ahe_idle_shed',
                },
                // M04 进行中（Boss 未胜）→ 战前叮嘱
                { whenActive: M4, dialogueId: 'c2_a06_pre_boss' },
                // M03 完成、M04 未接取 → 同样给战前叮嘱
                { whenComplete: M3, dialogueId: 'c2_a06_pre_boss' },
                // M03 进行中：归魂之后 → 提示问证词；归魂之前 → 确认归魂点
                {
                    whenActiveAndObjectiveCompleted: { questId: M3, type: 'complete_minigame', target: 'boat_navigation' },
                    dialogueId: 'c2_a05b_after_soul_return',
                },
                { whenActive: M3, dialogueId: 'c2_a05_court_ready' },
                // M02 完成、M03 未接取（等陆舟开船）→ 阶段闲聊
                // （旧行为：回落到 A03 后的「井边的江婆一直在等她女儿，你替她去看看灯」，是把玩家指回已经做完的主线二）
                { whenComplete: M2, dialogueId: 'c2_ahe_idle_shed' },
                // M02 进行中：询问陈栎补充线索 → 线索问出后转为阶段闲聊
                // （A02 的内容是主线一的步骤「先找许录要登记，再请陆舟看看船走的路线」，
                //   到这一步早就做完了；JSON 在 A04 与 A05 之间没有阿禾节点 → 按
                //   runtime_rules.routing 兜底为阶段闲聊）
                {
                    whenActiveAndObjectiveNotComplete: { questId: M2, type: 'talk_to', target: 'ahe' },
                    dialogueId: 'c2_a04_chenli_clue',
                },
                { whenActive: M2, dialogueId: 'c2_ahe_idle_shed' },
                // M01 目标齐（摘页 / 旧航线 / 连招试炼都做完）→ 交付对话 A03
                // （A03 原先没有任何规则指向，是死节点：交付时会错误地念 A02「先找许录要登记…」）
                {
                    whenActiveAndObjectiveCompleted: { questId: M1, type: 'complete_training', target: 'sword' },
                    dialogueId: 'c2_a03_report',
                },
                // M02 未接取（M01 已完成）→ 指向江婆
                { whenComplete: M1, dialogueId: 'c2_a03_next' },
                // M01 进行中 → 提醒进度
                { whenActive: M1, dialogueId: 'c2_a02_progress' },
                // 初见（第一章尚未完成时会话不会到达这里，由第一章选择器接管）
                { dialogueId: 'c2_a01_arrive' },
            ],

            // ===== 陆舟：引路人 / 旧航线 / 行舟 =====
            luzhou: [
                { whenComplete: E2, dialogueId: 'c2_luzhou_idle' },
                { whenActive: E2, dialogueId: 'c2_luzhou_idle' },
                // 结丹已成 → 行舟修好，接取《行舟有归处》
                { whenComplete: E1, dialogueId: 'c2_l08_boat_ready' },
                { whenActive: E1, dialogueId: 'c2_luzhou_idle' },
                // M04：账册与命令都查到 → 提示回去交付；仅完成 Boss → 进度提示
                {
                    whenActiveAndObjectiveCompleted: { questId: M4, type: 'investigate', target: 'taixuan_mingling' },
                    dialogueId: 'c2_l07b_investigated',
                },
                {
                    whenActiveAndObjectiveCompleted: { questId: M4, type: 'talk_to', target: 'ahe' },
                    dialogueId: 'c2_l05_deliver',
                },
                { whenActive: M4, dialogueId: 'c2_l07_progress' },
                // M04 已完成、结丹（E01）尚未开始 → 闲聊
                // （旧行为：回落到 L06「去找许录拿通行凭证」，万灯台都打完了还在催凭证）
                { whenComplete: M4, dialogueId: 'c2_luzhou_idle' },
                // M04 接取（M03 完成）
                { whenComplete: M3, dialogueId: 'c2_l06_wandengtai' },
                // M03：证词齐 → 交付；尚未确认归魂点 → 开船叮嘱；其余 → 进度
                {
                    whenActiveAndObjectiveCompleted: { questId: M3, type: 'talk_to', target: 'chenli' },
                    dialogueId: 'c2_l05_deliver',
                },
                {
                    whenActiveAndObjectiveNotComplete: { questId: M3, type: 'talk_to', target: 'ahe' },
                    dialogueId: 'c2_l04_escort_ready',
                },
                { whenActive: M3, dialogueId: 'c2_l03b_progress' },
                // M03 接取（M02 完成）
                { whenComplete: M2, dialogueId: 'c2_l03_old_route' },
                // M01：先要登记摘页 → 核对旧航线 → 练招
                {
                    whenActiveAndObjectiveCompleted: { questId: M1, type: 'talk_to', target: 'luzhou' },
                    dialogueId: 'c2_l02_sword_hint',
                },
                {
                    whenActiveAndObjectiveCompleted: { questId: M1, type: 'talk_to', target: 'xulu' },
                    dialogueId: 'c2_l01_route',
                },
                { dialogueId: 'c2_luzhou_idle' },
            ],

            // ===== 江婆：寻女 → 认灯 → 认领 ----
            jiangpo: [
                // Boss 已胜 → 留在救助院帮忙
                { whenStoryFlag: 'due_boss_defeated', dialogueId: 'c2_j05_after_boss' },
                // M03 进行中：已归魂 → 陪女儿；未归魂 → 说线索
                {
                    whenActiveAndObjectiveCompleted: { questId: M3, type: 'complete_minigame', target: 'boat_navigation' },
                    dialogueId: 'c2_j04_wait',
                },
                { whenActive: M3, dialogueId: 'c2_j02_progress' },
                // M03 已完成、Boss 尚未胜（M04 未接取 / 进行中）→ 守在床边
                // （JSON J04「江晚已归魂，Boss尚未胜」；旧行为：回落到 M01 的 J01，
                //   会跳出「我帮您认灯」的过期接取选项 —— 点下去只会提示无法接取）
                { whenComplete: M3, dialogueId: 'c2_j04_wait' },
                // M02 完成、M03 未接取 → 闲聊（不再回放到期的 J01 认灯接取）
                { whenComplete: M2, dialogueId: 'c2_jiangpo_idle' },
                // M02 目标齐（身份核对完成，只差这一趟交付）→ 交付对话 J03
                // （原先没有这条规则，被下面的 J02 抢先，J03 是死节点：交付时念的是「她过河怕…」的线索）
                {
                    whenActiveAndObjectiveCompleted: { questId: M2, type: 'complete_minigame', target: 'lantern_identify' },
                    dialogueId: 'c2_j03_deliver',
                },
                // M02 进行中、目标未齐 → 线索
                {
                    whenActiveAndObjectiveNotComplete: { questId: M2, type: 'talk_to', target: 'jiangpo' },
                    dialogueId: 'c2_j02_progress',
                },
                { whenActive: M2, dialogueId: 'c2_j03_deliver' },
                // M01 完成 → 接取《一封到不了的家书》
                { whenComplete: M1, dialogueId: 'c2_j01_ask' },
                { dialogueId: 'c2_jiangpo_idle' },
            ],

            // ===== 许录：登记 → 认灯核验 → 通行凭证 =====
            xulu: [
                { whenStoryFlag: 'due_boss_defeated', dialogueId: 'c2_x06_after_boss' },
                { whenActive: M4, dialogueId: 'c2_x05_token' },
                { whenComplete: M2, dialogueId: 'c2_x04_refused' },
                { whenActive: M2, dialogueId: 'c2_x03_lamps' },
                { whenActive: M1, dialogueId: 'c2_x01_registry' },
                { whenComplete: M1, dialogueId: 'c2_x02_after_registry' },
                { dialogueId: 'c2_xulu_idle' },
            ],

            // ===== 江晚（归魂后才出现实体）=====
            jiangwan: [
                { whenStoryFlag: 'due_boss_defeated', dialogueId: 'c2_w03_after_boss' },
                {
                    whenActiveAndObjectiveNotComplete: { questId: M3, type: 'talk_to', target: 'jiangwan' },
                    dialogueId: 'c2_w01_testimony',
                },
                { whenActive: M3, dialogueId: 'c2_w02_wait' },
                // M03 已完成、Boss 尚未胜 → 仍是 W02（JSON W02 条件「W01 已播放，Boss 尚未胜」；
                // 旧行为：交付陆舟之后直接掉到闲聊，江晚的「灯里的事」就断在半句话上）
                { whenComplete: M3, dialogueId: 'c2_w02_wait' },
                { dialogueId: 'c2_jiangwan_idle' },
            ],

            // ===== 陈栎（归魂后才出现实体）=====
            chenli: [
                { whenStoryFlag: 'due_boss_defeated', dialogueId: 'c2_c03_after_boss' },
                {
                    whenActiveAndObjectiveNotComplete: { questId: M3, type: 'talk_to', target: 'chenli' },
                    dialogueId: 'c2_c01_testimony',
                },
                { whenActive: M3, dialogueId: 'c2_c02_wait' },
                // M03 已完成、Boss 尚未胜 → 仍是 C02（JSON C02 条件「C01 已播放，Boss 尚未胜」）
                { whenComplete: M3, dialogueId: 'c2_c02_wait' },
                { dialogueId: 'c2_chenli_idle' },
            ],
        };
        return Chapter2Config._matchDialogueRules(rules[npcId], qs);
    }

    /**
     * 规则匹配内核（语义与 Chapter1Config.getDialogueForNPC 完全一致，
     * 两章各自维护规则表，共用同一套判定）
     * @param {Array|null} npcRules - 规则数组
     * @param {Object} qs - QuestSystem 实例
     * @returns {string|null} 对话 ID
     */
    static _matchDialogueRules(npcRules, qs) {
        if (!npcRules) return null;

        for (const rule of npcRules) {
            if (rule.whenStoryFlag) {
                if (qs && typeof qs.hasStoryFlag === 'function' && qs.hasStoryFlag(rule.whenStoryFlag)) {
                    return rule.dialogueId;
                }
                continue;
            }
            if (rule.whenHasItem) {
                if (qs.questItemSystem && qs.questItemSystem.hasItem(rule.whenHasItem)) {
                    return rule.dialogueId;
                }
                continue;
            }
            if (rule.whenActiveAndObjectiveNotComplete) {
                const obj = rule.whenActiveAndObjectiveNotComplete;
                if (qs.isQuestActive && qs.isQuestActive(obj.questId)
                    && !qs.isObjectiveCompleted(obj.questId, obj.type, obj.target)) {
                    return rule.dialogueId;
                }
                continue;
            }
            if (rule.whenActiveAndObjectiveCompleted) {
                const obj = rule.whenActiveAndObjectiveCompleted;
                if (qs.isQuestActive && qs.isQuestActive(obj.questId)
                    && qs.isObjectiveCompleted(obj.questId, obj.type, obj.target)) {
                    return rule.dialogueId;
                }
                continue;
            }
            if (rule.whenActive) {
                if (qs.isQuestActive && qs.isQuestActive(rule.whenActive)) {
                    return rule.dialogueId;
                }
            } else if (rule.whenComplete) {
                if (qs.isQuestCompleted && qs.isQuestCompleted(rule.whenComplete)) {
                    return rule.dialogueId;
                }
            } else {
                // 默认对话（无条件）
                return rule.dialogueId;
            }
        }
        return null;
    }

    /**
     * 取某个剧情对白的文本（Main.playStoryDialogue 用）
     * @param {string} dialogueId
     * @returns {Object|null} { id, text }
     */
    static getStoryDialogue(dialogueId) {
        const all = Chapter2Config.getStoryDialogues();
        return all[dialogueId] || null;
    }

    static getAll() {
        return {
            meta: this.getChapterMeta(),
            npcs: this.getNPCConfigs(),
            quests: this.getQuestConfigs(),
            monsters: this.getMonsterConfigs(),
            maps: this.getMapConfigs(),
            items: this.getItemConfigs(),
        };
    }
}

if (typeof window !== 'undefined') window.Chapter2Config = Chapter2Config;
