/**
 * 第一章：青岚浮野——剧情配置文件
 * 数据源：第一章-青岚浮野-主线与NPC对话-v1.0.json
 */
class Chapter1Config {
    static getChapterMeta() {
        return {
            id: 'chapter1', name: '青岚浮野——被风推走的人',
            realm: 'lianqi', nextChapter: 'chapter2', nextMapId: 'yunduze',
        };
    }

    static getNPCConfigs() {
        return {
            // ===== 阿禾 =====
            ahe: {
                id: 'ahe', name: '阿禾', moveSpeed: 80, isStatic: false,
                position: { x: 16, y: 40 }, patrolPoints: [],
                // 搬迁位置：任务阶段变化时将阿禾移动到不同位置
                movePositions: {
                    rescue_point: { x: 58, y: 41 },  // main_1 完成后迁移到救助点
                    quay: { x: 81, y: 44 },           // 章末迁移到码头告别
                },
                // 基础动画配置（idle / walk 的帧尺寸、排列方式）
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
                // 额外动画：治疗动作（行排列，方向下左右上，宽31高32，4帧）
                extraAnimations: [
                    {
                        name: 'heal',
                        resourcePath: 'npc.ahe_heal',
                        frameWidth: 31,
                        frameHeight: 32,
                        directionMode: 'row',
                        directions: {
                            down:  { row: 0, frames: 4 },
                            left:  { row: 1, frames: 4 },
                            right: { row: 2, frames: 4 },
                            up:    { row: 3, frames: 4 },
                        },
                        fps: 8,
                        loop: false,
                    },
                ],
                shopItems: [
                    { itemId: 'lingcao', price: 10, stock: 20 },
                    { itemId: 'ninglu', price: 15, stock: 10 },
                    { itemId: 'huiyuan_dan', price: 50, stock: 5 },
                ],
                assignedQuests: ['chapter1_main_1','chapter1_main_2','chapter1_repeatable_1','chapter1_ending_2','chapter1_ending_3'],
                dialogues: {
                    first_meet: {
                        id: 'first_meet',
                        text: '醒了？先别急着站，抓住旁边的石头。\n旁白: ……\n主角: 这地方……怎么在动？\n山门和村子都被风托起来了。现在只有这些路还连着。\n主角: 其他人呢？\n能找到的都安顿在村中，还有人没回来。\n主角: 我跟你一起找。\n先稳住自己。你的归乡牌掉在门边，捡上它，再去井边找祁伯。',
                        options: [
                            { text: '我这就去。', next: null, action: 'accept_quest_chapter1_main_1' },
                            { text: '你有没有受伤？', next: 'ahe_concern' },
                            { text: '让我缓一会儿。', next: null },
                        ],
                    },
                    ahe_concern: {
                        id: 'ahe_concern',
                        text: '手上擦破一点，不碍事。\n主角: 你的手还在抖。\n刚才还顾不上。看见你醒了，才知道自己也怕。\n好了，别都站在风口。我们先进村。',
                        options: [
                            { text: '好，先进村。', next: null, action: 'accept_quest_chapter1_main_1' },
                            { text: '我稍后跟上。', next: null },
                        ],
                    },
                    has_guixiang_pai: {
                        id: 'has_guixiang_pai',
                        text: '你捡到归乡牌了。上面刻着青岚村的名字，是这里身份的凭证。\n主角: 祁伯在哪儿？\n水井边。他一直走不远，你沿着石路往村中走就能见到他。',
                        options: [
                            { text: '我这就去找祁伯。', next: null, action: 'accept_quest_chapter1_main_1' },
                            { text: '村子里现在怎么样？', next: null },
                        ],
                    },
                    quest_m01_progress: {
                        id: 'quest_m01_progress',
                        text: '祁伯就在村中水井旁。你的归乡牌也别落下。\n主角: 路边发白的地方是云，不是地面，沿着石路走。',
                        options: [],
                    },
                    quest_m01_done: {
                        id: 'quest_m01_done',
                        text: '阿砚醒过一次，气息又乱了。我需要西边梯田的止风草。\n主角: 带多少回来？\n三份。普通灵草不能替代。\n田边的风是一阵一阵的。看清草叶的方向，等风缓下来再走。\n主角: 带回来就能救他？\n还要请你帮我稳住药气。你刚学会调息，正好能帮上忙。',
                        options: [
                            { text: '我去采药。', next: null, action: 'accept_quest_chapter1_main_2' },
                            { text: '我先准备一下。', next: null },
                        ],
                    },
                    quest_m02_progress_herb: {
                        id: 'quest_m02_progress_herb',
                        text: '还差些止风草。到西边梯田找，采齐三份再回来。\n阿砚这里有我，你走稳些。',
                        options: [],
                    },
                    quest_m02_progress_breath: {
                        id: 'quest_m02_progress_breath',
                        text: '止风草到了。趁药性还鲜活，我现在帮你引气定息。\n主角: 要怎么做？\n闭眼坐定。我把药力化开，你顺着我的气息走。气稳了，阿砚才能用得上这份药。',
                        options: [
                            { text: '定息引气。', next: null, action: 'start_breath_heal_sequence' },
                            { text: '稍后再说。', next: null },
                        ],
                    },
                    breath_fail: {
                        id: 'breath_fail',
                        text: '只是气息散了，别急。等你准备好了，我们再试。',
                        options: [],
                    },
                    quest_m02_ready: {
                        id: 'quest_m02_ready',
                        text: '稳住……好了，慢慢收气。\n旁白: ……\n阿砚: 娘？你别一直喊，我听见了。\n阿禾: 那你倒是早些应我一声。\n主角: 他没事了？\n最险的时候过去了，接下来得养着。\n棚子这边也能安顿下来。这些丹药你带上，回息的法子我再教你一遍。',
                        options: [],
                        on_complete: ['complete_quest_chapter1_main_2'],
                    },
                    after_m02_before_boss: {
                        id: 'after_m02_before_boss',
                        text: '阿砚记得风起前的一些事，你可以问问他。\n主角: 要出村就先找祁伯商量。\n我把伤员照顾好，你把外面的人带回来。',
                        options: [],
                    },
                    after_boss: {
                        id: 'after_boss',
                        text: '你回来前，棚子上的灯先不晃了。\n主角: 山口的阵器停了。可失踪的人，还没都找到。\n那就继续找。至少今晚，留下的人能睡稳一些。',
                        options: [],
                    },
                    farewell: {
                        id: 'farewell',
                        text: '我把还没回来的名字又核了一遍，和那张运灯名册对得上。\n主角: 我先去云渡泽看看。\n我把这里的伤员交接好，就跟后面的船过去。到了那边，先找个能落脚的地方。\n主角: 村子怎么办？\n柳婶他们会守着。你看，今天已经有人生火做饭了。',
                        options: [],
                        // 告别结束 → 记录标记、在码头生成本章登船路标（Main.createDepartSignpost），
                        // 并接取登船任务《登船辞行》（chapter1_ending_3）
                        on_complete: ['record_farewell_done', 'create_depart_signpost', 'accept_quest_chapter1_ending_3'],
                    },
                    after_farewell: {
                        id: 'after_farewell',
                        text: '名册我留了一份给你，上船前再看一眼。\n主角: 我会一个个找回来。\n船就在码头尽头，路上当心。',
                        options: [],
                    },
                    chapter_done_return: {
                        id: 'chapter_done_return',
                        text: '回来了？先坐下，喝口热水。\n主角: 路上的事慢慢说，伤口先让我看看。',
                        options: [],
                        on_complete: ['open_rest_service'],
                    },
                    idle_talk: {
                        id: 'idle_talk',
                        text: '风还在吹……不知道其他村民怎么样了。',
                        // 原「我想买点东西（open_shop）」商店入口已按需求移除：
                        // 阿禾的闲聊不再挂商店入口（shopItems 数据与 Shop 系统本身保留）。
                        options: [
                            { text: '我会找到他们的', next: null },
                        ],
                    },
                },
            },

            // ===== 祁伯 =====
            qibo: {
                id: 'qibo', name: '祁伯', moveSpeed: 60, isStatic: true,
                position: { x: 58, y: 31 }, patrolPoints: [],
                assignedQuests: ['chapter1_main_3','chapter1_main_4','chapter1_ending_1'],
                // idle: 列排列，方向下左右上，宽24高32，每方向1帧
                baseAnimations: {
                    idle: {
                        frameWidth: 24, frameHeight: 32, directionMode: 'column',
                        directions: {
                            down:  { col: 0, frames: 1 },
                            left:  { col: 1, frames: 1 },
                            right: { col: 2, frames: 1 },
                            up:    { col: 3, frames: 1 },
                        },
                        fps: 8, loop: true,
                    },
                },
                dialogues: {
                    teaching_basic: {
                        id: 'teaching_basic',
                        text: '牌子找回来了？\n主角: 上面还刻着青岚两个字。\n嗯。先收好。你气息散得厉害，站稳了，我教你怎么把它收回来。\n主角: 我现在这点修为，能帮上忙吗？\n能。先学会护住自己，再把灵息送出去。别一口气全用完。',
                        options: [], on_complete: ['teach_basic_skills'],
                    },
                    no_tag_yet: {
                        id: 'no_tag_yet', text: '阿禾说你的木牌落在山门边。先拿回来，我在这里等你。', options: [],
                    },
                    practice_time: {
                        id: 'practice_time',
                        text: '去旁边空地试试。普通攻击、灵息弹、护体术，还有闪避，都走一遍。\n要紧的是知道何时停手，不是把地上的石头打得多碎。',
                        options: [
                            { text: '开始练习。', next: null, action: 'start_basic_training' },
                            { text: '稍后再练。', next: null },
                        ],
                    },
                    quest_m01_complete: {
                        id: 'quest_m01_complete',
                        text: '气息不再乱跑了。记着这个感觉。\n主角: 脚下还在晃，但我能站稳些了。\n够用了。阿禾那边缺人手，你去看看。',
                        options: [], on_complete: ['complete_quest_chapter1_main_1'],
                    },
                    after_m01: {
                        id: 'after_m01', text: '救人要紧。阿禾懂药，你按她说的做。\n风口过不去就退回来，别拿命试第二次。', options: [],
                    },
                    quest_m03_ready: {
                        id: 'quest_m03_ready',
                        text: '阿砚能开口了？正好，有些事得问清。\n主角: 您找到风灾的缘由了？\n还没有。这张旧地脉图上，村北的气路原本很稳。\n前些日子赈灾队来装镇风桩，说是镇住灵潮。如今最先断开的，偏偏是那一带。\n主角: 您怀疑那些桩？\n先查。问问阿砚看见了什么，再找柳婶问周叔的去向。救人和查桩，可以顺着一条路做。',
                        options: [
                            { text: '我去问清楚。', next: null, action: 'accept_quest_chapter1_main_3' },
                            { text: '赈灾队是谁派来的？', next: 'qibo_about_taixuan' },
                            { text: '我稍后动身。', next: null },
                        ],
                    },
                    qibo_about_taixuan: {
                        id: 'qibo_about_taixuan',
                        text: '告示写着太玄道君的名号。车上的人也这么说。\n主角: 那镇风桩出了事……\n名号说明不了全部。是器物出了错，还是有人动手脚，得看证据。',
                        options: [
                            { text: '我先去调查。', next: null, action: 'accept_quest_chapter1_main_3' },
                            { text: '让我再想想。', next: null },
                        ],
                    },
                    quest_m03_progress: {
                        id: 'quest_m03_progress',
                        text: '人带回来，桩上的异样也记清楚。\n三根都要看。只看一根，分不清是偶然损坏，还是有人一起改过。',
                        options: [],
                    },
                    quest_m03_complete: {
                        id: 'quest_m03_complete',
                        text: '周叔救回来了。三根桩都有新凿的槽，里面嵌着一样的黑铁片。\n主角: 最后一根旁边还有空灯和运送残页，写着云渡泽。\n旧图上没有这些引流槽。它们把散开的灵气引向山口，方向反了。\n主角: 风最猛的时候，山口那东西也在叫。叫一声，地就颤一下。\n看来还得去山口看看。你先把这一路的修炼所得理顺，别带着一身乱气上去。',
                        // 结算由目标推进完成：对话开始推进 main_3 的 talk_to qibo →
                        // 对话结束即主线三完结，此处不解锁任何任务（主线四需再与祁伯对话接取）
                        options: [],
                    },
                    quest_m04_ready: {
                        id: 'quest_m04_ready',
                        text: '山口原有一头山魈，往常不下田，也不追人。\n主角: 这次的风是它引来的？\n它身上有阵器的光，恐怕也受了制。你去时先看清，别贸然贴近。\n它扑过来就让开，强风过后再出手。护体术能挡一时，挡不了每一下。',
                        options: [
                            { text: '我去山口。', next: null, action: 'accept_quest_chapter1_main_4' },
                            { text: '我先休整。', next: null },
                        ],
                    },
                    quest_m04_progress: {
                        id: 'quest_m04_progress',
                        text: '你能用的基础功法已经齐了，按顺手的配好。\n一回不成就回来调整，别觉得退一步丢人。',
                        options: [], on_complete: ['open_skill_config'],
                    },
                    quest_m04_complete: {
                        id: 'quest_m04_complete',
                        text: '阵核上的印，您认识吗？\n祁伯: 太玄法印。与赈灾告示上的一样。\n主角: 所以这一切都是他做的？\n现在还不能这么断言。但这件阵器，确实顶着他的名号送到了这里。\n主角: 名册匣里记着村里人的名字，后面还记着魂灯编号。\n还有云渡泽的交接路线。把它带好，先去查灯，也查那些人究竟到了哪里。',
                        options: [], on_complete: ['complete_quest_chapter1_main_4','unlock_foundation_breakthrough','accept_quest_chapter1_ending_1'],
                    },
                    breakthrough_ready: {
                        id: 'breakthrough_ready',
                        text: '山口的引流停了，你体内的气息也能真正落稳了。\n主角: 现在能筑基？\n修为和历练都够了。坐下，把散在经脉里的灵气收拢，不用急着往上冲。',
                        options: [
                            { text: '开始筑基。', next: null, action: 'start_foundation_trial' },
                            { text: '我稍后再来。', next: null },
                        ],
                    },
                    breakthrough_fail: {
                        id: 'breakthrough_fail', text: '这次散开了，停一停再试。根基要稳，不争这一口快气。', options: [],
                    },
                    breakthrough_success: {
                        id: 'breakthrough_success',
                        text: '旁白: 风穿过衣袖，主角的身形却不再随之摇晃。\n主角: 还是这阵风……感觉不一样了。\n是你不一样了。筑基已成。先去长桥码头一趟，阿禾等你许久。',
                        // 筑基完成 → 结算筑基 / 解锁云渡泽航线 / 自动接取《桥边寻阿禾》（chapter1_ending_2）
                        // 注：择道（open_profession_selection）暂不接入章末流程，详见下方择道节点说明。
                        options: [], on_complete: ['complete_foundation_trial','unlock_yunduze','accept_quest_chapter1_ending_2'],
                    },
                    // 筑基之后与祁伯交谈 → 只闲聊（本版本不做职业选择）
                    after_foundation_chat: {
                        id: 'after_foundation_chat',
                        text: '气沉下来了，站姿也稳当，这才像筑基的样子。\n主角: 这身力气，还不太敢用。\n用着才熟。眼下先去长桥码头，阿禾在那边等你。\n主角: 我这就过去。\n路上走稳些，别又站到风口里去。',
                        options: [],
                    },
                    // ===== 择道节点（暂不接入流程：本版本不做职业选择）=====
                    // 以下 choose_profession / *_intro / confirm_* / profession_chosen_done / respec_* 节点
                    // 仅作为配置保留，当前章节流程不会进入；后续版本若要启用择道，
                    // 只需在 breakthrough_success 的 on_complete 里加回 'open_profession_selection'
                    // 并把下方对话规则改回 choose_profession / respec_profession 即可。
                    choose_profession: {
                        id: 'choose_profession', text: '剑、法、体、符，各有用处。选你愿意练、用得顺的一门。',
                        options: [
                            { text: '剑修', next: 'sword_intro' }, { text: '法修', next: 'mage_intro' },
                            { text: '体修', next: 'body_intro' }, { text: '符修', next: 'talisman_intro' },
                        ],
                    },
                    sword_intro: { id: 'sword_intro', text: '踏风斩便于进退，归刃能往返伤敌。普攻积起剑意，再接招式。', options: [{ text: '免费试用', next: null, action: 'trial_profession_sword' }, { text: '选择这一脉', next: 'confirm_sword' }, { text: '看看其他传承', next: 'choose_profession' }] },
                    mage_intro: { id: 'mage_intro', text: '炎灵术攻远，寒潮术缓敌。术法交替着用，留意施法时的空当。', options: [{ text: '免费试用', next: null, action: 'trial_profession_mage' }, { text: '选择这一脉', next: 'confirm_mage' }, { text: '看看其他传承', next: 'choose_profession' }] },
                    body_intro: { id: 'body_intro', text: '崩山拳破势，金刚护体承击。能扛住一些，也得躲开重招。', options: [{ text: '免费试用', next: null, action: 'trial_profession_body' }, { text: '选择这一脉', next: 'confirm_body' }, { text: '看看其他传承', next: 'choose_profession' }] },
                    talisman_intro: { id: 'talisman_intro', text: '追魂符留印，缚灵阵困敌。看好对手的来路，阵才不会落空。', options: [{ text: '免费试用', next: null, action: 'trial_profession_talisman' }, { text: '选择这一脉', next: 'confirm_talisman' }, { text: '看看其他传承', next: 'choose_profession' }] },
                    confirm_sword: { id: 'confirm_sword', text: '决定修习剑修了？\n首次选择免费。获得该职业筑基阶段的两个主动技能及一个被动。', options: [{ text: '确认选择', next: 'profession_chosen_done', action: 'set_profession_sword' }, { text: '再考虑一下', next: 'choose_profession' }] },
                    confirm_mage: { id: 'confirm_mage', text: '决定修习法修了？\n首次选择免费。获得该职业筑基阶段的两个主动技能及一个被动。', options: [{ text: '确认选择', next: 'profession_chosen_done', action: 'set_profession_mage' }, { text: '再考虑一下', next: 'choose_profession' }] },
                    confirm_body: { id: 'confirm_body', text: '决定修习体修了？\n首次选择免费。获得该职业筑基阶段的两个主动技能及一个被动。', options: [{ text: '确认选择', next: 'profession_chosen_done', action: 'set_profession_body' }, { text: '再考虑一下', next: 'choose_profession' }] },
                    confirm_talisman: { id: 'confirm_talisman', text: '决定修习符修了？\n首次选择免费。获得该职业筑基阶段的两个主动技能及一个被动。', options: [{ text: '确认选择', next: 'profession_chosen_done', action: 'set_profession_talisman' }, { text: '再考虑一下', next: 'choose_profession' }] },
                    profession_chosen_done: { id: 'profession_chosen_done', text: '法门给你了，怎么走，还要靠你自己。\n准备好了就去码头，阿禾会把名册再与你核一遍。', options: [], on_complete: ['complete_profession_selection'] },
                    respec_profession: { id: 'respec_profession', text: '要换传承，得重新理顺气路。你现在是筑基，需六百灵石，静修一日。\n境界和基础功法都保留，职业悟道点会返还，重新分配。', options: [{ text: '查看职业并试用', next: null, action: 'open_free_trial' }, { text: '查看重塑费用', next: null, action: 'open_respec_confirm' }, { text: '只调整当前技能', next: null, action: 'open_skill_config' }, { text: '暂时不换', next: null }] },
                    respec_poor: { id: 'respec_poor', text: '灵石还不够，不必急。先用熟手里的法门，再攒也来得及。', options: [] },
                    after_all_main: { id: 'after_all_main', text: '村北的桩已经停了，我会盯着地脉。\n你去查云渡泽。有了实情，再回来告诉我们。', options: [] },
                    idle_talk: { id: 'idle_talk', text: '这些浮岛，不知道还能撑多久……', options: [{ text: '我会找出真相的', next: null }] },
                },
            },

            // ===== 柳婶 =====
            liushen: {
                id: 'liushen', name: '柳婶', moveSpeed: 60, isStatic: true,
                position: { x: 75, y: 28 }, patrolPoints: [], assignedQuests: [], // 瓦片近似值；精确站立点见 maps.qinglan_fuye.npcWorldPositions.liushen (2400,915)
                // idle: 单图宽14高32，共用同一帧
                baseAnimations: {
                    idle: {
                        frameWidth: 14, frameHeight: 32, directionMode: 'row',
                        directions: {
                            down:  { row: 0, frames: 1 },
                            up:    { row: 0, frames: 1 },
                            left:  { row: 0, frames: 1 },
                            right: { row: 0, frames: 1 },
                        },
                        fps: 8, loop: true,
                    },
                },
                dialogues: {
                    pre_heal: { id: 'pre_heal', text: '你也醒了？好，好……又回来一个。\n主角: 阿砚怎么样？\n阿禾在救。他爹到现在也没消息，我不敢走开。\n主角: 我先帮阿禾取药。\n路上当心。我还能烧水、看火，这里不用你操心。', options: [] },
                    ask_zhoushu: { id: 'ask_zhoushu', text: '他爹出事前去了北边，说要把田里的工具收回来。\n主角: 走的哪条路？\n过村北木桥，沿着老树旁边那条道。风起后我听见他喊过，后来就听不清了。\n主角: 我沿那边找。\n找到他就叫他空手回来。什么农具、粮袋，都别拿了。\n风大的地方别硬闯，先站稳了再过去。', options: [], on_complete: ['record_zhoushu_route','mark_north_rescue_point'] },
                    waiting_rescue: { id: 'waiting_rescue', text: '主角: 北桥那边有消息了吗？\n没找到就慢慢找，别让你也困在外头。', options: [] },
                    reunion: { id: 'reunion', text: '人总算回来了……你还背着那破筐做什么！\n周叔: 里面是些种子，没多少重量。\n你……先把手伸过来，我看看伤。\n多谢你。锅里还有热的，饿了就来盛。', options: [], on_complete: ['record_reunion_dialogue'] },
                    after_boss: { id: 'after_boss', text: '今天锅里的水没往外洒，终于能正经煮顿饭。\n主角: 田还能种吗？\n能种多少算多少。周叔已经去看了，总得把日子接起来。', options: [] },
                    idle_talk: { id: 'idle_talk', text: '锅里有热水，先坐下暖暖身子。', options: [] },
                },
            },

            // ===== 阿砚 =====
            ayan: {
                id: 'ayan', name: '阿砚', moveSpeed: 60, isStatic: true,
                position: { x: 57, y: 41 }, patrolPoints: [], assignedQuests: [],
                // 初始状态：受伤（坐地），治愈后切换为站立
                initialNpcState: { injured: true, healed: false },
                // idle: 单图宽18高25，共用同一帧（坐地受伤状态）
                baseAnimations: {
                    idle: {
                        frameWidth: 18, frameHeight: 25, directionMode: 'row',
                        directions: {
                            down:  { row: 0, frames: 1 },
                            up:    { row: 0, frames: 1 },
                            left:  { row: 0, frames: 1 },
                            right: { row: 0, frames: 1 },
                        },
                        fps: 8, loop: true,
                    },
                },
                // 额外动画：站立 idle（受伤时使用默认 idle = 坐地动画）
                extraAnimations: [
                    {
                        name: 'stand_idle',
                        resourcePath: 'npc.ayan_stand_idle',
                        frameWidth: 14,
                        frameHeight: 32,
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
                dialogues: {
                    unconscious: { id: 'unconscious', text: '桥……别过去……\n（阿禾：先别问他了，他现在分不清人。等药回来再说。）', options: [] },
                    first_testimony: { id: 'first_testimony', text: '我看见有人动过镇风桩。\n主角: 装桩的人？\n衣服差不多，我分不清。他们又往桩里打了黑铁片，还不许我们靠近。\n主角: 之后就起风了？\n先是地底有声响，然后山口那东西叫了。再后来，田埂整个翻起来……\n主角: 够了，先歇着。我去看那些桩。', options: [], on_complete: ['record_pile_testimony'] },
                    testimony_done: { id: 'testimony_done', text: '我爹是不是还在北桥？\n主角: 我会去找。\n他腰不好，搬不动大石头。要是路被挡了，你先喊他一声，他肯定应你。', options: [] },
                    father_saved: { id: 'father_saved', text: '他一回来就说自己没事，手上的血都没擦干净。\n主角: 你刚醒时也想下地。\n……行，我不动了。你去山口的时候，也别硬撑。', options: [] },
                    after_boss: { id: 'after_boss', text: '我能站起来了。阿禾只许我在棚子边走。\n主角: 那就先在这里走。\n听说你要去云渡泽？见到村里人，就说我们还在青岚等着。\n可别让他们以为，村子飘走了就没人了。', options: [], on_complete: ['switch_ayan_standing_sprite'] },
                    idle_talk: { id: 'idle_talk', text: '风小了些……能听见远处鸟叫了。', options: [] },
                },
            },

            // ===== 周叔 =====
            zhoushu: {
                id: 'zhoushu', name: '周叔', moveSpeed: 60, isStatic: true,
                position: { x: 49, y: 3 }, patrolPoints: [], assignedQuests: [], // 被困点瓦片近似值；精确位置见 maps.qinglan_fuye.npcWorldPositions.zhoushu (1572,119)
                // 搬迁位置：救援完成后迁往获救点（瓦片，兜底用）
                movePositions: {
                    rescued: { x: 71, y: 36 },
                },
                // 搬迁位置的精确世界坐标（像素，优先于 movePositions）
                moveWorldPositions: {
                    rescued: { x: 2300, y: 1160 },
                },
                // idle: 单图宽16高32，共用同一帧
                baseAnimations: {
                    idle: {
                        frameWidth: 16, frameHeight: 32, directionMode: 'row',
                        directions: {
                            down:  { row: 0, frames: 1 },
                            up:    { row: 0, frames: 1 },
                            left:  { row: 0, frames: 1 },
                            right: { row: 0, frames: 1 },
                        },
                        fps: 8, loop: true,
                    },
                },
                dialogues: {
                    rescue_start: { id: 'rescue_start', text: '别踩外边那块板！下面已经空了！\n主角: 柳婶让我来找您。能走吗？\n腿能动，可这里风太大，这段桥我一个人过不去。\n主角: 我先过去，把这段路稳住。您跟着我的停步走。', options: [{ text: '护送周叔过桥', next: 'rescue_success', action: 'start_wind_bridge_rescue' }, { text: '我先看看路线', next: null }] },
                    trapped_idle: { id: 'trapped_idle', text: '别过来！这边的桥面窄，风一冒起来，人就站不住脚。\n主角: 您先别动。\n我就在这边等风缓下来，再想办法过去。', options: [] },
                    rescue_fail: { id: 'rescue_fail', text: '退回来就好，人没掉下去。等风缓一阵，再走。', options: [] },
                    rescue_success: { id: 'rescue_success', text: '脚下这块地……总算不晃得那么厉害了。\n主角: 先回村，柳婶和阿砚都在。\n阿砚也在？好，好，我这就走。', options: [], on_complete: ['record_zhoushu_rescued','move_zhoushu_to_village'] },
                    after_rescue: { id: 'after_rescue', text: '你要查镇风桩？我记得它刚装好时，槽口不是朝山口的。\n主角: 后来被改过？\n我不懂阵法，只认得方向。那几道新凿口，前一天还没有。\n第三根边上还落着运东西的箱子，你去看看。', options: [], on_complete: ['hint_investigation_point'] },
                    after_boss: { id: 'after_boss', text: '我去田边看过了，土还在，种子也没全吹走。\n主角: 您准备重新种？\n总不能看着它空着。等找回来的人多了，也得有饭吃。', options: [] },
                    farewell: { id: 'farewell', text: '路上若遇见村里人，就说西边那几块田还留着。\n主角: 愿意回来的，总有地方落脚。', options: [] },
                },
            },
        };
    }

    static getQuestConfigs() {
        return {
            main_1: { id: 'chapter1_main_1', title: '醒在风里', description: '从风灾中醒来，学习基本操作。', type: 'main', chapter: 1, order: 1, prerequisites: [], giver: 'ahe', receiver: 'qibo', objectives: [{ type: 'find_item', target: 'guixiang_pai', count: 1, description: '找回归乡牌' }, { type: 'talk_to', target: 'qibo', count: 1, description: '向祁伯学习基础功法' }, { type: 'complete_training', target: 'basic', count: 1, description: '完成基础操作教学' }, { type: 'talk_to', target: 'qibo', count: 1, description: '向祁伯汇报进度' }], nextQuest: 'chapter1_main_2' },
            main_2: { id: 'chapter1_main_2', title: '一盏安身灯', description: '帮助阿禾采药并救治伤员。', type: 'main', chapter: 1, order: 2, prerequisites: ['chapter1_main_1'], giver: 'ahe', receiver: 'ahe', objectives: [{ type: 'collect_item', target: 'lingcao', count: 3, description: '乘风采药取得止风草三份' }, { type: 'complete_minigame', target: 'breath_control', count: 1, description: '完成定息引气' }, { type: 'talk_to', target: 'ahe', count: 1, description: '返回阿禾交付' }], consumes: { lingcao: 3 }, nextQuest: 'chapter1_main_3' },
            main_3: { id: 'chapter1_main_3', title: '散落的炊烟', description: '调查风灾的真相。', type: 'main', chapter: 1, order: 3, prerequisites: ['chapter1_main_2'], giver: 'qibo', receiver: 'qibo', objectives: [{ type: 'talk_to', target: 'ayan', count: 1, description: '询问阿砚目击证词' }, { type: 'talk_to', target: 'liushen', count: 1, description: '询问柳婶周叔去向' }, { type: 'rescue', target: 'zhoushu', count: 1, description: '救回周叔' }, { type: 'talk_to', target: 'zhoushu', count: 1, description: '与获救后的周叔交谈（问出镇风桩的异样）' }, { type: 'investigate', target: 'zhenfeng_pile_1', count: 1, description: '调查第一根镇风桩' }, { type: 'investigate', target: 'zhenfeng_pile_2', count: 1, description: '调查第二根镇风桩' }, { type: 'investigate', target: 'zhenfeng_pile_3', count: 1, description: '调查第三根镇风桩' }, { type: 'investigate', target: 'broken_lantern_box', count: 1, description: '调查桩旁的破损运灯箱' }, { type: 'find_item', target: 'hundeng', count: 1, description: '拾取箱前的空魂灯' }, { type: 'talk_to', target: 'qibo', count: 1, description: '回祁伯处交付（桩上异样与残页线索）' }], nextQuest: 'chapter1_main_4' },
            main_4: { id: 'chapter1_main_4', title: '山口不止风', description: '击败被阵核控制的摄风山魈。', type: 'main', chapter: 1, order: 4, prerequisites: ['chapter1_main_3'], giver: 'qibo', receiver: 'qibo', objectives: [{ type: 'defeat_boss', target: 'boss_shanxiao', count: 1, description: '进入法阵，击败摄风山魈' }, { type: 'find_item', target: 'zhenhe', count: 1, description: '拾取法阵旁的阵核' }, { type: 'find_item', target: 'mingce', count: 1, description: '拾取法阵旁的名册匣' }, { type: 'talk_to', target: 'qibo', count: 1, description: '向祁伯交付' }], nextQuest: 'chapter1_ending_1' },
            // ===== 章末（六、章末：筑基 → 桥边寻阿禾 → 登船）=====
            // ending_1：与祁伯对话选择“开始筑基”→ Main.startFoundationTrial 播放筑基调息（禁键 / 主角朝下 / 背后气场 5 秒）
            //            → 续接 breakthrough_success → on_complete 里的 complete_foundation_trial 推进本任务的
            //            complete_foundation_trial 目标（目标完成后 Main.onQuestComplete 会把阿禾迁到码头）。
            ending_1: { id: 'chapter1_ending_1', title: '筑基调息', description: '在祁伯的护持下收拢灵气，完成筑基。', type: 'main', chapter: 1, order: 5, prerequisites: ['chapter1_main_4'], giver: 'qibo', receiver: 'qibo', objectives: [{ type: 'complete_foundation_trial', target: 'foundation', count: 1, description: '在祁伯旁完成筑基调息' }], nextQuest: 'chapter1_ending_2' },
            // ending_2：筑基调息结束后由 breakthrough_success 的 on_complete: accept_quest_chapter1_ending_2 生成，
            //            提示玩家去长桥码头找阿禾（阿禾在 ending_1 完成时已迁到码头告别位 81,44）。
            //            与阿禾对话（talk_to ahe）即完结本任务。
            ending_2: { id: 'chapter1_ending_2', title: '桥边寻阿禾', description: '阿禾已带着名册去了长桥码头，去那里找她。', type: 'main', chapter: 1, order: 6, prerequisites: ['chapter1_ending_1'], giver: 'ahe', receiver: 'ahe', objectives: [{ type: 'talk_to', target: 'ahe', count: 1, description: '到长桥码头找阿禾' }], nextQuest: 'chapter1_ending_3' },
            // ending_3：阿禾 farewell 对话结束（on_complete: create_depart_signpost / accept_quest_chapter1_ending_3）后生成登船路标，
            //            按 E 登船（board_boat）即完结本任务并切到世界地图（第一章结束）。
            ending_3: { id: 'chapter1_ending_3', title: '登船辞行', description: '与码头边的阿禾核对名册，登船前往云渡泽。', type: 'main', chapter: 1, order: 7, prerequisites: ['chapter1_ending_2'], giver: 'ahe', receiver: 'ahe', objectives: [{ type: 'board_boat', target: 'depart_boat', count: 1, description: '在长码头登船离开青岚浮野' }], nextQuest: null },
        };
    }

    static getMonsterConfigs() {
        return {
            fenglang: { id: 'fenglang', name: '风狼', realm: 'lianqi', health: 50, damage: 10, defense: 2, expReward: 15, lingShiReward: 10, drops: [{ itemId: 'lingcao', chance: 0.5, count: 1 }], attackRange: 50, detectRange: 200 },
            // 摄风山魈（主线四 Boss）：气血 300（可被打死的正式数值）
            boss_shanxiao: { id: 'boss_shanxiao', name: '摄风山魈', type: 'boss', realm: 'lianqi', health: 300, damage: 20, defense: 5, expReward: 100, lingShiReward: 200, toughness: 100, skills: ['wind_slash','pounce','sweep'], phases: { phase1: { healthPercent: 100, skillChance: [0.4,0.3,0.3] }, phase2: { healthPercent: 50, skillChance: [0.3,0.35,0.35] } } },
        };
    }

    static getMapConfigs() {
        return {
            qinglan_fuye: {
                id: 'qinglan_fuye', name: '青岚浮野', chapter: 1,
                tileSize: 32, mapWidth: 105, mapHeight: 59,
                // === 瓦片碰撞地图（collisionData）===
                // 与 boss_arena_ch1 同一套机制：TileSystem 优先按 collision.png 逐瓦片统计
                // 黑像素占比生成碰撞表；但以 file:// 直接双击打开 game.html 时，浏览器禁止读
                // 本地图片像素（canvas.getImageData 抛 SecurityError），此时只能靠下面这份
                // 由同一张 collision.png 预生成的表兜底 —— 没有它，整张青岚浮野会被判成
                // “全部可通行”，碰撞完全失效（可以走进房屋 / 树冠 / 云海）。
                //   '.' = 白色（可通行：地面 / 桥面 / 栈道）    '#' = 黑色（不可通行）
                // 碰撞图 assets/images/maps/qinglan_fuye/collision.png 为 3344×1882
                // （不是 tileSize 的整数倍，最后一行 / 列取样不足；该处本身是云海，无影响）。
                // 表中每一行依次对应图片自上而下 32px 高的瓦片行（行 0 = 图片顶部）。
                // 改过碰撞图后重新生成 / 校验：py -3 tools/generate_collision_data.py --check
                collisionData: [
                    '################...######################################################################......##########',
                    '################...#####################.......##########################################.......#########',
                    '#################.######################.........########################################........########',
                    '################...#####################..........########################################.......########',
                    '###############....###########################.......############################......###.......########',
                    '########..#####......###########################......#####.....#################.................#######',
                    '#######..######........###########################.....#####....#################......................##',
                    '#######.#######..........##########################......####...############...........................##',
                    '######.#############......##########################.....####..........................................##',
                    '#####.###############.....###########################.................................................###',
                    '#####.#######.............############################................................................###',
                    '###########...............#############################........##############..###...................####',
                    '##########...#######.......############################.......####################...................####',
                    '#########...#########.#.....##########################........#####################.................#####',
                    '########....############.....########################....#....######################..............#######',
                    '#######...##############.......#####################....###...#######################...........#########',
                    '#######...################......#############..........###...###########################.......##########',
                    '#######..##################.....##############...............############################.....###########',
                    '#######..####################...################..............############################....###########',
                    '########.####################....################.....####################################....###########',
                    '#######..####################..............########...####################################....###########',
                    '####......###################...............#######...####################################....###########',
                    '#######...###################................######...####################################....###########',
                    '#######..............#######...#########......#####...####################################....###########',
                    '########...............##......############.......................#######..###############.....##########',
                    '#########.....................#############.......................########.###############......#########',
                    '#########...##########........##############.......#.............########..################......########',
                    '########...############.....################.....#######.........#######....################.....########',
                    '#######.....#.#####.###....##################...#########.......########......###############....########',
                    '######.........#######.....#################....#########......#########........##############...########',
                    '#########.........#........#################....######........#######...........##############...########',
                    '#########...................#################...######........#######........#################...########',
                    '##########.#..................###############................########....####################.....#######',
                    '###############........##......##############............##..########...#####################.....#######',
                    '##########...........######........##########................########...#################################',
                    '#########...........########..........########.................#####.....################################',
                    '##########..........#########..........#######....#......................################################',
                    '####.##.............#############.......#####....####.......................#############################',
                    '###.................###############.....#####....########....................############################',
                    '####.................###############.....##........###########.................##########################',
                    '#####................################.................########........##.........########################',
                    '#####................################..........##....................#####........#######################',
                    '########..............################.......######..................#######.......######################',
                    '#########.......#........################...#########..........###....##.####........####################',
                    '#########......###..........##############..#######################......#####.........##################',
                    '#########......###...........#############..#######################......######.........#################',
                    '########......#####...........###########...#######################.....########..........###############',
                    '#######.......##########........########......######################.....########.........###############',
                    '#########.....############.......########....########################.....#########......################',
                    '##########...#############.......#########..###########################....#########....#################',
                    '###########..#############........#######...############################...##############################',
                    '###########..#############..##...########...#############################.###############################',
                    '#########.....###########################...#############################################################',
                    '###########....##########################################################################################',
                    '###########..############################################################################################',
                    '###########..############################################################################################',
                    '#########################################################################################################',
                    '#########################################################################################################',
                    '#########################################################################################################',
                ],
                // === NPC 初始位置（瓦片坐标） ===
                // 阿禾初始在牌坊附近开场；完成任务后迁至救助点/码头
                npcPositions: {
                    ahe: { x: 16, y: 40 },
                    qibo: { x: 58, y: 31 },
                    liushen: { x: 75, y: 28 }, // 近似瓦片：精确站立点见下方 npcWorldPositions
                    ayan: { x: 57, y: 41 },
                    zhoushu: { x: 49, y: 3 }, // 被困点近似瓦片：精确位置见下方 npcWorldPositions
                },
                // === NPC 精确世界坐标（像素，优先级高于 npcPositions 的瓦片坐标） ===
                npcWorldPositions: {
                    liushen: { x: 2400, y: 915 },
                    zhoushu: { x: 1572, y: 119 },
                },
                // === 可拾取任务物品 ===
                pickupItems: {
                    guixiang_pai: {
                        id: 'pickup_guixiang_pai', itemId: 'guixiang_pai', name: '归乡牌',
                        position: { x: 350, y: 1200 }, count: 1, questId: 'chapter1_main_1',
                        objectiveType: 'find_item', promptText: '按 E 拾取归乡牌',
                    },
                    // 空魂灯藏在桩旁的破损运灯箱里（见下方 lanternBoxes）。
                    // requireObjective：只有先完成“调查桩旁的破损运灯箱”，
                    // 这只灯才会出现在箱前（由 Main.createPickupItemsFromConfig 在目标完成时生成）。
                    // 注：运灯残页不再作为可拾取道具生成，其内容直接在破箱的调查对话中念出。
                    hundeng: {
                        id: 'pickup_hundeng', itemId: 'hundeng', name: '空魂灯',
                        position: { x: 2890, y: 104 }, radius: 48, count: 1, questId: 'chapter1_main_3',
                        objectiveType: 'find_item', promptText: '按 E 拾取空魂灯',
                        requireObjective: { type: 'investigate', target: 'broken_lantern_box' },
                    },
                    // === 主线四《山口不止风》战利品 ===
                    // 击败摄风山魈（从战场回到法阵旁）后，这两件道具才会出现在法阵两侧：
                    // requireObjective 由 Main.createPickupItemsFromConfig 在目标完成时校验，
                    // 胜利返回的那一刻由 onQuestProgress 触发生成。
                    zhenhe: {
                        id: 'pickup_zhenhe', itemId: 'zhenhe', name: '阵核',
                        position: { x: 2866, y: 286 }, radius: 44, count: 1, questId: 'chapter1_main_4',
                        objectiveType: 'find_item', promptText: '按 E 拾取阵核',
                        requireObjective: { type: 'defeat_boss', target: 'boss_shanxiao' },
                    },
                    mingce: {
                        id: 'pickup_mingce', itemId: 'mingce', name: '名册匣',
                        position: { x: 3026, y: 286 }, radius: 44, count: 1, questId: 'chapter1_main_4',
                        objectiveType: 'find_item', promptText: '按 E 拾取名册匣',
                        requireObjective: { type: 'defeat_boss', target: 'boss_shanxiao' },
                    },
                // 注：原“黑铁片”拾取点已并入镇风桩的调查对话（见下方 windPiles）
                },
                // === 镇风桩（世界坐标，像素；position 指桩基底部中心） ===
                // 三根桩常驻显示在地图上；仅当主线《散落的炊烟》中对应的
                // investigate 目标为“当前待完成目标”时，靠近才会出现“按 E 调查”提示，
                // 调查一次后不可重复调查（提示同时隐藏），对话结束即推进到下一步任务。
                windPiles: {
                    zhenfeng_pile_1: {
                        id: 'wind_pile_1', name: '镇风桩一',
                        position: { x: 2005, y: 190 }, radius: 56,
                        promptText: '调查第一根镇风桩',
                        image: 'windPiles.zhenfeng_pile_1',
                        imageWidth: 58, imageHeight: 128,
                        questId: 'chapter1_main_3',
                        objectiveType: 'investigate', objectiveTarget: 'zhenfeng_pile_1',
                        dialogue: {
                            // 线索：新凿的引流槽
                            text: '桩身靠山口的一侧，多了几道新凿的引流槽。\n主角: 槽口边缘还带着新茬，石粉也没被风吹干净。\n主角: 装桩的时候不会有这种东西——是后来有人动的手。\n槽口斜斜朝着山口，像是要把散开的气都引过去。',
                        },
                    },
                    zhenfeng_pile_2: {
                        id: 'wind_pile_2', name: '镇风桩二',
                        position: { x: 2644, y: 163 }, radius: 56,
                        promptText: '调查第二根镇风桩',
                        image: 'windPiles.zhenfeng_pile_2',
                        imageWidth: 58, imageHeight: 128,
                        questId: 'chapter1_main_3',
                        objectiveType: 'investigate', objectiveTarget: 'zhenfeng_pile_2',
                        dialogue: {
                            // 线索：嵌入的黑铁片
                            text: '桩心的裂缝里嵌着一片黑铁。\n主角: 铁片卡得很深，是硬敲进去的。\n主角: 阿砚说得没错，真有人往桩里打黑铁片。\n黑铁不吃灵气，却把桩里原本的路数拧了个方向。',
                        },
                    },
                    zhenfeng_pile_3: {
                        id: 'wind_pile_3', name: '镇风桩三',
                        position: { x: 3014, y: 150 }, radius: 56,
                        promptText: '调查第三根镇风桩',
                        image: 'windPiles.zhenfeng_pile_3',
                        imageWidth: 58, imageHeight: 128,
                        questId: 'chapter1_main_3',
                        objectiveType: 'investigate', objectiveTarget: 'zhenfeng_pile_3',
                        dialogue: {
                            // 线索：三桩引流方向一致（并引出旁边的破箱）
                            text: '第三根桩的槽口，和前两根朝着同一个方向。\n主角: 三根桩的引流方向完全一致。\n主角: 散开的气不再回地脉，全被送往山口——这不是镇风，是引风。\n主角: 桩边还落着一只破箱子，我过去看看。',
                        },
                    },
                },
                // === 破损运灯箱（世界坐标，像素；position 指箱体图片中心，图片 64×64） ===
                // 与镇风桩同属“任务门控调查点”（共用同一套逻辑，见 WindPile / LanternBox）：
                // 仅在主线《散落的炊烟》推进到“调查桩旁的破损运灯箱”时，
                // 靠近才会出现“按 E 调查”提示；调查一次后不可重复调查，
                // 对话结束即推进到下一步目标“调查破箱取得空魂灯”。
                lanternBoxes: {
                    broken_lantern_box: {
                        id: 'lantern_box_1', name: '破损运灯箱',
                        position: { x: 2890, y: 35 }, radius: 64,
                        promptText: '调查破损运灯箱',
                        image: 'lanternBoxes.broken_lantern_box',
                        // 贴图原始像素尺寸 64×58（assets/images/lantern_box/broken_lantern_box.png）
                        // drawImage 会按此尺寸缩放，取原图尺寸可 1:1 显示、不变形
                        imageWidth: 64, imageHeight: 58,
                        anchor: 'center',               // 箱体中心对齐坐标，避免贴图顶部超出地图上边缘
                        questId: 'chapter1_main_3',
                        objectiveType: 'investigate', objectiveTarget: 'broken_lantern_box',
                        dialogue: {
                            // 线索：空魂灯 + 云渡泽运送残页（对应剧情 I05“桩旁破箱”）
                            text: '木箱半陷在土里，箱盖被从外面撬开，绳结还留着赈灾队的打法。\n主角: 锁扣不是锈断的，是被人撬开的。\n箱里垫着一排灯架，格子空了大半，只剩一盏没点亮过的空魂灯。\n主角: 空魂灯……灯芯是新的，灯身却有反复搬运的磨痕。它没装过魂，是备着来装的。\n箱底压着半张被风撕开的运送残页，字迹还看得清。\n主角（念）: “青岚浮野镇风桩三根，引气归口；随行空魂灯三十盏，赴云渡泽交接。”\n主角: 落款处盖着一枚小印，日期就在风灾前三天。\n主角: 三根桩把散气引向山口，这些空灯却要往云渡泽运——两头都有人接。\n主角: 灯我收下，残页上的字记在心里，回头一并说给祁伯。',
                        },
                    },
                },
                // === 路标 ===
                // image 指向 ResourceManager 的 signposts.* 资源键；
                // 例：signposts.herb_collect → assets/images/signposts/herb_collect.png（60×60 显示）
                signposts: {
                    herb_collect: {
                        id: 'signpost_herb_collect',
                        name: '采药点',
                        position: { x: 843, y: 368 },
                        promptText: '开始乘风采药',
                        image: 'signposts.herb_collect',
                        imageWidth: 60,                        // 【可选】显示宽度(px)，不填则取原图宽
                        imageHeight: 60,
                        questRequired: 'chapter1_main_2',       // 接取 M02 任务后路标才可见
                        gameId: 'herb_collect',
                        oneShot: false,
                        // 小游戏「成功退出」后的收尾对白（乘风采药采齐草药 → 回主图说一句）
                        // 行首带「说话人: 」的行按该说话人显示；文本里的换行按转义分行，读完按 J / 点击推进
                        successDialogue: '止风草齐了三份，趁着露水还重，赶紧给阿禾送去。\n风里走这一趟不算白——好歹没让这些药草空长一场。',
                        successSpeaker: '主角: ',
                    },
                },
                // === 章末（筑基调息 → 阿禾移至码头送别 → 登船） ===
                // departSignpost：阿禾告别对话结束（on_complete: create_depart_signpost）后
                // 由 Main.createDepartSignpost 按这份数据生成世界坐标 (2566, 1419) 的永久路标，
                // 玩家靠近后显示“按 E 键乘船离开”，按 E → 开启世界地图（第一章结束）。
                // oneShot=false 且无 questRequired → 生成后永久保留（重新进图由 Main.applyChapterEndStage 恢复）。
                // 美术：image 指向 ResourceManager 的 signposts.depart_boat
                //       → assets/images/signposts/depart_boat.png（建议 60×60 PNG，缺图则回退程序化木牌）
                //       anchor 可选：'center'（默认，图片以坐标为中心）/ 'bottom'（图片底边贴坐标，
                //       适合带杆的木牌美术，画面上牌子会立在路标点上）
                chapterEnd: {
                    departSignpost: {
                        id: 'signpost_depart_boat',
                        name: '登船',
                        position: { x: 2566, y: 1419 },
                        radius: 56,
                        promptText: '乘船离开',
                        image: 'signposts.depart_boat',
                        imageWidth: 60,                        // 【可选】显示宽度(px)，不填则取原图宽
                        imageHeight: 60,
                        oneShot: false,
                    },
                    // 阿禾告别站位（瓦片坐标，与 npc.ahe.movePositions.quay 同源）
                    aheQuayTile: { x: 81, y: 44 },
                },
                // === 传送法阵（世界坐标，像素；position 指法阵中心） ===
                // 主线四《山口不止风》：接取 chapter1_main_4 后，右上石台（2946, 231）
                // 才出现这座法阵（questRequired 门控，Main 在任务接取/完成/进度变化时刷新）。
                // 靠近后按 E → 传送到摄风山魈战场（boss_arena_ch1）；
                // 战败 → 由 Main.returnFromBossArena 落回法阵旁（法阵中心下方 88px）；
                // 胜利 → 战场正中心出现永久归途法阵，玩家按 E 回到同一落点。
                // Boss 只生成一次：击败后（剧情标记 boss_shanxiao_defeated）再进场不会生成 Boss。
                teleporters: {
                    boss_enter: {
                        id: 'teleport_boss_enter',
                        name: '传送法阵',
                        worldPosition: { x: 2959, y: 270 },   // 世界坐标（像素）
                        radius: 76,
                        promptText: '按 E 进入boss战斗',
                        targetMapId: 'boss_arena_ch1',
                        // 战场落点（世界坐标，像素）：平台左下侧白区瓦片 (14,14) 的中心
                        // ⚠ 必须落在可通行瓦片上，否则进入战场后会被碰撞判定卡在黑区里
                        targetPosition: { x: 580, y: 580 },
                        image: 'teleportArrays.boss_enter',   // 静态图片 96×96
                        imageWidth: 96, imageHeight: 96,
                        anchor: 'center',
                        questRequired: 'chapter1_main_4',     // 接取主线四后才生成/可见
                        bossArena: true,                      // 走战场流程（记录返回点）
                        // === 战败成长（Boss 失败补偿）===
                        // 每次在摄风山魈战场战败 → 气血上限 +20 / 灵息上限 +10，
                        // 最多结算 5 次（第 6 次起不再提升）；累计值随存档保存。
                        // 由 Main.returnFromBossArena → Main.applyBossFailureBonus 结算。
                        arenaDefeatBonus: { id: 'boss_shanxiao', maxHealth: 20, maxMana: 10, maxFailures: 5 },
                    },
                },
                // === 入口点（左下牌坊附近） ===
                entryPoint: { x: 16, y: 43 },
                ambientConfig: {
                    // 飘落物（落叶 / 落花）：青岚浮野是本章主图 → 开启（只有前两章主图会显示，
                    // 战场 / 小游戏 / 世界地图都不会，见 js/FallingFoliage.js 的 isFoliageMap）
                    // maxCount = 界面中同时存在的最大飘落物数量（调它控疏密）
                    fallingFoliage: {
                        enabled: true,
                        maxCount: 22,
                        spawnRate: 1.2,
                        leafWeight: 0.7,   // 青岚浮野：落叶为主
                        flowerWeight: 0.3,
                    },
                    fog: { enabled: false },
                },
            },
            // ===== 摄风山魈战场（主线四专用地图） =====
            // 图片资源：assets/images/maps/boss_arena_ch1/bg.png 与 collision.png
            // 两张图均为 1280×720（与画布同尺寸 → 战场一屏到底，摄像机不滚动）；
            // 碰撞图约定：白色可通行，黑色不可通行。
            // 尺寸换算：tileSize 40 × 32 列 = 1280，40 × 18 行 = 720（必须整除，
            // 否则最后一列/行会因 TileSystem 取样不足而被判为可通行）。
            //
            // === 瓦片碰撞地图（collisionData）===
            // TileSystem 在加载 collision.png 时就把整张图转成 32×18 的瓦片碰撞表
            // （每格统计瓦片内黑像素占比，≥ 50% 判为不可通行），此后移动/寻路只查表。
            // 但以 file:// 直接双击打开 game.html 时，浏览器禁止读取本地图片像素
            // （canvas.getImageData 抛 SecurityError），无法从图片生成碰撞表 → 用下面这份
            // 由同一张 collision.png 预生成的表兜底，保证战场碰撞在任何打开方式下都生效。
            //   '.' = 白色（可通行，即平台地面）    '#' = 黑色（不可通行，即悬崖/云雾）
            // 需要重新生成时（改过 collision.png 之后）：用 http 方式打开游戏（或给浏览器
            // 加 --allow-file-access-from-files），在控制台执行下面这行，再把输出同步到本表：
            //   Logger.log(mapManager.getMap('boss_arena_ch1').getWalkableGrid()
            //       .map(r => r.map(v => v ? '.' : '#').join('')).join('\n'))
            // 表中的每一行依次对应图片自上而下 40px 高的瓦片行（行 0 = 图片顶部）。
            boss_arena_ch1: {
                id: 'boss_arena_ch1', name: '摄风山魈战场', chapter: 1,
                tileSize: 40, mapWidth: 32, mapHeight: 18,
                collisionData: [
                    '################################',
                    '###################.############',
                    '#########...#####......#########',
                    '########...............#########',
                    '########..................######',
                    '######.....................#####',
                    '####.......................#####',
                    '####.......................#####',
                    '######......................####',
                    '######.........................#',
                    '######........................##',
                    '######....................##.###',
                    '######...................#######',
                    '########...............#########',
                    '#############.........##########',
                    '##############......############',
                    '#############.......############',
                    '##############....##############',
                ],
                npcPositions: {},
                // 玩家从山口法阵进入后的落点（瓦片坐标，平台左下侧白区瓦片 (14,14)）
                // ⚠ 必须落在可通行瓦片上：黑区（悬崖外）站不住，落进去会被碰撞判定卡住
                entryPoint: { x: 14, y: 14 },
                pickupItems: {},
                // === 战场传送法阵：配置留空，由代码动态生成 ===
                //   战败 → Main 检测 player.isAlive === false 后自动送回山口法阵旁；
                //   胜利 → Main.handleBossArenaVictory 在地图正中心 (640, 360) 生成永久归途法阵
                //          （GameMap.createArenaExitArray），玩家按 E 回到进场时的原来位置；
                //          不再有"等 10 秒自动回去"的倒计时。
                teleporters: {},
                // === 摄风山魈（主线四 Boss） ===
                // 由 GameMap.spawnArenaBoss 读取本配置创建 ShanxiaoBoss：
                //   x / y       —— 瓦片坐标（tileToWorld 换算为世界坐标，作为精灵图中心）
                //   monsterId   —— GameConfig.monsters 中的键（气血/伤害/防御等基础属性）
                //   ai          —— 'shanxiao' 时启用专属 AI（行为树 + 轴对齐 A* 寻路）
                //   tuning      —— 可选：只写需要覆盖 ShanxiaoBoss.DEFAULT_TUNING 的字段
                //                  （速度/判定半径/冷却等）。本 Boss 全部使用类内默认值，
                //                  故此处留空——唯一来源见 js/ShanxiaoBoss.js 的 DEFAULT_TUNING。
                //                  如需按章节单独调平衡，在此补 { 字段: 值 } 即可（其余自动继承）。
                bossPosition: {
                    boss_shanxiao: {
                        x: 24, y: 6,
                        monsterId: 'boss_shanxiao',
                        ai: 'shanxiao',
                    },
                },
            },
        };
    }

    static getItemConfigs() {
        return {
            // 注：运灯残页（yunye_canye）已取消作为道具生成，内容并入破损运灯箱的调查对话
            mingce: { id: 'mingce', name: '名册匣', type: 'quest', description: '装着运灯名册的匣子：册上记着村民姓名与魂灯编号，并标出云渡泽的交接路线', stackable: false },
            zhenhe: { id: 'zhenhe', name: '阵核', type: 'quest', description: '摄风山魈身上取下的阵器核心，印有太玄法印', stackable: false },
            zhenfeng_heipian: { id: 'zhenfeng_heipian', name: '黑铁片', type: 'quest', description: '从镇风桩中取出的黑色铁片', stackable: true, maxStack: 3 },
        };
    }

    /**
     * 获取 NPC 对话选择器
     * 根据玩家任务进度，返回 NPC 当前应显示的对话 ID
     * @param {string} npcId - NPC ID
     * @param {Object} questSystem - 玩家任务系统实例
     * @returns {string|null} 对话 ID，无匹配返回 null
     */
    static getDialogueForNPC(npcId, questSystem, questItemSystem) {
        if (!questSystem) return null;
        const qs = questSystem;
        if (questItemSystem) qs.questItemSystem = questItemSystem;
        const rules = {
            // ===== 阿禾（主线对话最多，严格按任务进度） =====
            ahe: [
                // 码头告别已发生（ending_3 进行中）→ 登船前交代
                { whenStoryFlag: 'chapter1_farewell_done', dialogueId: 'after_farewell' },
                // 筑基完成（ending_2《桥边寻阿禾》进行中）→ 码头告别对白
                // （talk_to ahe 由 Main 在对话开始时推进 → ending_2 完结；对话结束接取 ending_3）
                { whenComplete: 'chapter1_ending_1', dialogueId: 'farewell' },
                // main_4 完成 → 战后
                { whenComplete: 'chapter1_main_4', dialogueId: 'after_boss' },
                // main_2 完成 → 准备阶段
                { whenComplete: 'chapter1_main_2', dialogueId: 'quest_m02_ready' },
                // main_2 进行中且定息引气已完成 → 交付对话（阿砚苏醒，交付并结算任务）
                { whenActiveAndObjectiveCompleted: { questId: 'chapter1_main_2', type: 'complete_minigame', target: 'breath_control' }, dialogueId: 'quest_m02_ready' },
                // main_2 进行中且采药已完成、定息引气未完成 → 引导定息引气
                { whenActiveAndObjectiveCompleted: { questId: 'chapter1_main_2', type: 'collect_item', target: 'lingcao' }, dialogueId: 'quest_m02_progress_breath' },
                // main_2 进行中且采药未完成 → 引导采药
                { whenActiveAndObjectiveNotComplete: { questId: 'chapter1_main_2', type: 'collect_item', target: 'lingcao' }, dialogueId: 'quest_m02_progress_herb' },
                // main_1 完成 → 接受 main_2
                { whenComplete: 'chapter1_main_1', dialogueId: 'quest_m01_done' },
                // main_1 进行中 → 提醒进度
                { whenActive: 'chapter1_main_1', dialogueId: 'quest_m01_progress' },
                // 持有归乡牌 → 阿禾确认
                { whenHasItem: 'guixiang_pai', dialogueId: 'has_guixiang_pai' },
                // 默认 → 开场（无任务状态）
                { dialogueId: 'first_meet' },
            ],
            // ===== 祁伯（功法教学 + 主线索） =====
            qibo: [
                // 章末闭环（登船离村）→ 闲聊
                { whenStoryFlag: 'chapter1_complete', dialogueId: 'idle_talk' },
                // 旧存档残留的择道标记 → 同样只闲聊（本版本不做职业选择）
                { whenStoryFlag: 'profession_chosen', dialogueId: 'after_foundation_chat' },
                // 筑基已成 → 闲聊并指引去长桥码头找阿禾（不再进入择道）
                { whenStoryFlag: 'foundation_trial_done', dialogueId: 'after_foundation_chat' },
                // 已解锁筑基（主线四交付完成）→ 开始筑基调息
                { whenStoryFlag: 'foundation_unlocked', dialogueId: 'breakthrough_ready' },
                // ending 完成 → 筑基成功（兜底：未经过 start_foundation_trial 时）
                { whenComplete: 'chapter1_ending_1', dialogueId: 'breakthrough_success' },
                // main_4 完成 → 交付对白（确认太玄法印 / 魂灯编号 / 云渡泽交接路线）
                { whenComplete: 'chapter1_main_4', dialogueId: 'quest_m04_complete' },
                // main_4 进行中且阵核与名册匣均已取得 → 交付对白
                // （talk_to qibo 目标由 Main 在对话开始时推进，对话结束即主线四完结）
                { whenActiveAndObjectiveCompleted: { questId: 'chapter1_main_4', type: 'find_item', target: 'mingce' }, dialogueId: 'quest_m04_complete' },
                // main_4 进行中（尚未取得战利品）→ 山口战前提示（含“我去山口”接取选项）
                { whenActive: 'chapter1_main_4', dialogueId: 'quest_m04_ready' },
                // main_3 完成、main_4 未接取 → 接取主线四（法阵在接取后才出现在山口石台）
                { whenComplete: 'chapter1_main_3', dialogueId: 'quest_m04_ready' },
                // main_3 进行中且空魂灯已到手 → M03 交付对白
                // （对话开始推进 talk_to qibo，对话结束主线三完结，不额外解锁任务）
                { whenActiveAndObjectiveCompleted: { questId: 'chapter1_main_3', type: 'find_item', target: 'hundeng' }, dialogueId: 'quest_m03_complete' },
                // main_3 进行中 → 调查指引
                { whenActive: 'chapter1_main_3', dialogueId: 'quest_m03_progress' },
                // main_2 完成 → 接受 main_3
                { whenComplete: 'chapter1_main_2', dialogueId: 'quest_m03_ready' },
                // main_1 进行中且 talk_to 未完成 → 初次教学（talk_to 在 getDialogueForNPC 之后推进，故首次对话仍匹配）
                { whenActiveAndObjectiveNotComplete: { questId: 'chapter1_main_1', type: 'talk_to', target: 'qibo' }, dialogueId: 'teaching_basic' },
                // main_1 进行中且 talk_to 已完成但训练未完成 → 练习引导
                { whenActiveAndObjectiveNotComplete: { questId: 'chapter1_main_1', type: 'complete_training', target: 'basic' }, dialogueId: 'practice_time' },
                // main_1 进行中且训练已完成 → 交付对话
                { whenActiveAndObjectiveCompleted: { questId: 'chapter1_main_1', type: 'complete_training', target: 'basic' }, dialogueId: 'quest_m01_complete' },
                // main_1 完成 → 交付
                { whenComplete: 'chapter1_main_1', dialogueId: 'quest_m01_complete' },
                // 默认 → 闲聊
                { dialogueId: 'idle_talk' },
            ],
            // ===== 阿砚 =====
            ayan: [
                // main_4 完成 → 战后康复
                { whenComplete: 'chapter1_main_4', dialogueId: 'after_boss' },
                // main_3 完成 → 父亲已救
                { whenComplete: 'chapter1_main_3', dialogueId: 'father_saved' },
                // main_3 进行中且已取得证词 → 等待寻父
                { whenActiveAndObjectiveCompleted: { questId: 'chapter1_main_3', type: 'talk_to', target: 'ayan' }, dialogueId: 'testimony_done' },
                // main_3 进行中且尚未询问 → 目击证词（黑铁片；对话结束后推进 talk_to ayan 目标）
                { whenActiveAndObjectiveNotComplete: { questId: 'chapter1_main_3', type: 'talk_to', target: 'ayan' }, dialogueId: 'first_testimony' },
                // main_2 完成、main_3 未接取 → 可提前取得证词（线索保留到 main_3）
                { whenComplete: 'chapter1_main_2', dialogueId: 'first_testimony' },
                // main_2 进行中 → 昏迷
                { whenActive: 'chapter1_main_2', dialogueId: 'unconscious' },
                // 默认 → 康复闲聊
                { dialogueId: 'idle_talk' },
            ],
            // ===== 柳婶 =====
            liushen: [
                // main_4 完成 → 战后安心
                { whenComplete: 'chapter1_main_4', dialogueId: 'after_boss' },
                // main_3 完成 或 周叔已获救 → 团聚对白
                { whenComplete: 'chapter1_main_3', dialogueId: 'reunion' },
                { whenActiveAndObjectiveCompleted: { questId: 'chapter1_main_3', type: 'rescue', target: 'zhoushu' }, dialogueId: 'reunion' },
                // main_3 进行中且已告知周叔路线 → 等待救援结果
                { whenActiveAndObjectiveCompleted: { questId: 'chapter1_main_3', type: 'talk_to', target: 'liushen' }, dialogueId: 'waiting_rescue' },
                // main_3 进行中且尚未询问 → 提供周叔前往北侧山路的线索
                { whenActiveAndObjectiveNotComplete: { questId: 'chapter1_main_3', type: 'talk_to', target: 'liushen' }, dialogueId: 'ask_zhoushu' },
                // main_3 进行中（兜底）→ 等待救援
                { whenActive: 'chapter1_main_3', dialogueId: 'waiting_rescue' },
                // 阿砚尚未治愈（main_2 进行中及之前）→ 安抚
                { whenActiveAndObjectiveNotComplete: { questId: 'chapter1_main_2', type: 'complete_minigame', target: 'breath_control' }, dialogueId: 'pre_heal' },
                { whenActive: 'chapter1_main_1', dialogueId: 'pre_heal' },
                // 默认
                { dialogueId: 'idle_talk' },
            ],
            // ===== 周叔 =====
            // 救助（风桥护送）门控：必须先向柳婶问出周叔去向 —— main_3 的 talk_to liushen 目标完成
            // （目标严格按顺序推进：阿砚 → 柳婶 → 救回周叔，此时 rescue 才是“当前待完成目标”）。
            // 未询问柳婶前，周叔只会说自己被困，不出现“护送周叔过桥”选项，也就无法被救助。
            zhoushu: [
                // main_4 完成 → 战后种田
                { whenComplete: 'chapter1_main_4', dialogueId: 'after_boss' },
                // main_3 完成 或 已护送过桥 → 调查线索提示
                { whenComplete: 'chapter1_main_3', dialogueId: 'after_rescue' },
                { whenActiveAndObjectiveCompleted: { questId: 'chapter1_main_3', type: 'rescue', target: 'zhoushu' }, dialogueId: 'after_rescue' },
                // main_3 进行中且已从柳婶处问出周叔去向（talk_to liushen 完成）→ 风桥护送对话（含“护送周叔过桥”选项）
                { whenActiveAndObjectiveCompleted: { questId: 'chapter1_main_3', type: 'talk_to', target: 'liushen' }, dialogueId: 'rescue_start' },
                // main_3 进行中但尚未询问柳婶 → 北桥被困（玩家还不知道去向，不能护送）
                { whenActive: 'chapter1_main_3', dialogueId: 'trapped_idle' },
                // main_3 未接取 → 北桥被困（风太大，无法安全通过）
                { dialogueId: 'trapped_idle' },
            ],
        };
        const npcRules = rules[npcId];
        if (!npcRules) return null;

        for (const rule of npcRules) {
            if (rule.whenStoryFlag) {
                // 剧情标记规则（QuestSystem.storyFlags，由对话 on_complete / 对话动作写入）
                if (qs && typeof qs.hasStoryFlag === 'function' && qs.hasStoryFlag(rule.whenStoryFlag)) {
                    return rule.dialogueId;
                }
                continue;
            }
            if (rule.whenHasItem) {
                // 规则要求持有某任务物品
                if (qs.questItemSystem && qs.questItemSystem.hasItem(rule.whenHasItem)) {
                    return rule.dialogueId;
                }
                continue;
            }
            if (rule.whenActiveAndObjectiveNotComplete) {
                // 任务进行中且指定目标未完成
                const obj = rule.whenActiveAndObjectiveNotComplete;
                if (qs.isQuestActive && qs.isQuestActive(obj.questId)) {
                    if (!qs.isObjectiveCompleted(obj.questId, obj.type, obj.target)) {
                        return rule.dialogueId;
                    }
                }
                continue;
            }
            if (rule.whenActiveAndObjectiveCompleted) {
                // 任务进行中且指定目标已完成
                const obj = rule.whenActiveAndObjectiveCompleted;
                if (qs.isQuestActive && qs.isQuestActive(obj.questId)) {
                    if (qs.isObjectiveCompleted(obj.questId, obj.type, obj.target)) {
                        return rule.dialogueId;
                    }
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

    static getAll() {
        return { meta: this.getChapterMeta(), npcs: this.getNPCConfigs(), quests: this.getQuestConfigs(), monsters: this.getMonsterConfigs(), maps: this.getMapConfigs(), items: this.getItemConfigs() };
    }
}
if (typeof window !== 'undefined') window.Chapter1Config = Chapter1Config;

















