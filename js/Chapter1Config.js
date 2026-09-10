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
                assignedQuests: ['chapter1_main_1','chapter1_main_2','chapter1_repeatable_1'],
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
                        on_complete: ['record_farewell_done'],
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
                        options: [
                            { text: '我想买点东西', next: null, action: 'open_shop' },
                            { text: '我会找到他们的', next: null },
                        ],
                    },
                },
            },

            // ===== 祁伯 =====
            qibo: {
                id: 'qibo', name: '祁伯', moveSpeed: 60, isStatic: true,
                position: { x: 58, y: 31 }, patrolPoints: [],
                assignedQuests: ['chapter1_main_3','chapter1_main_4','chapter1_ending_1','chapter1_ending_2'],
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
                        options: [], on_complete: ['complete_quest_chapter1_main_3'],
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
                        text: '阵核上的印，您认识吗？\n祁伯: 太玄法印。与赈灾告示上的一样。\n主角: 所以这一切都是他做的？\n现在还不能这么断言。但这件阵器，确实顶着他的名号送到了这里。\n主角: 名册里有村里人的名字，后面记着魂灯编号。\n还有云渡泽的交接处。把它带好，先去查灯，也查那些人究竟到了哪里。',
                        options: [], on_complete: ['complete_quest_chapter1_main_4','unlock_foundation_breakthrough'],
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
                        text: '旁白: 风穿过衣袖，主角的身形却不再随之摇晃。\n主角: 还是这阵风……感觉不一样了。\n是你不一样了。筑基已成，接下来该选一门道法。\n主角: 村里还有传承？\n四脉的入门法都留着。你先试，再决定。',
                        options: [], on_complete: ['complete_foundation_trial','unlock_yunduze','open_profession_selection'],
                    },
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
                position: { x: 75, y: 28 }, patrolPoints: [], assignedQuests: [],
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
                    ask_zhoushu: { id: 'ask_zhoushu', text: '他爹出事前去了北边，说要把田里的工具收回来。\n主角: 走的哪条路？\n过村北木桥，沿着老树旁边那条道。风起后我听见他喊过，后来就听不清了。\n主角: 我沿那边找。\n找到他就叫他空手回来。什么农具、粮袋，都别拿了。', options: [], on_complete: ['record_zhoushu_route','mark_north_rescue_point'] },
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
                position: { x: 53, y: 15 }, patrolPoints: [], assignedQuests: [],
                // 搬迁位置：救援完成后迁回村落
                movePositions: {
                    rescued: { x: 70, y: 35 },
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
                    rescue_start: { id: 'rescue_start', text: '别踩外边那块板！下面已经空了！\n主角: 柳婶让我来找您。能走吗？\n腿能动，就是风一来，站都站不稳。\n主角: 我先过去，把这段路稳住。您跟着我的停步走。', options: [{ text: '开始救援', next: null, action: 'start_wind_bridge_rescue' }, { text: '我先看看路线', next: null }] },
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
            main_1: { id: 'chapter1_main_1', title: '醒在风里', description: '从风灾中醒来，学习基本操作。', type: 'main', chapter: 1, order: 1, prerequisites: [], giver: 'ahe', receiver: 'qibo', objectives: [{ type: 'find_item', target: 'guixiang_pai', count: 1, description: '找回归乡牌' }, { type: 'talk_to', target: 'qibo', count: 1, description: '向祁伯学习基础功法' }, { type: 'complete_training', target: 'basic', count: 1, description: '完成基础操作教学' }, { type: 'talk_to', target: 'qibo', count: 1, description: '向祁伯汇报进度' }], rewards: { exp: 30, lingShi: 50, basicSkillPoints: 1, items: [], skills: ['lingxidan','hutishu'] }, nextQuest: 'chapter1_main_2' },
            main_2: { id: 'chapter1_main_2', title: '一盏安身灯', description: '帮助阿禾采药并救治伤员。', type: 'main', chapter: 1, order: 2, prerequisites: ['chapter1_main_1'], giver: 'ahe', receiver: 'ahe', objectives: [{ type: 'collect_item', target: 'lingcao', count: 3, description: '乘风采药取得止风草三份' }, { type: 'complete_minigame', target: 'breath_control', count: 1, description: '完成定息引气' }, { type: 'talk_to', target: 'ahe', count: 1, description: '返回阿禾交付' }], rewards: { exp: 30, lingShi: 100, basicSkillPoints: 1, items: ['huiyuan_dan','huiyuan_dan','huiyuan_dan','huiling_dan','huiling_dan'], skills: ['huixishu'], recipes: ['huiyuan_dan','huiling_dan'] }, consumes: { lingcao: 3 }, nextQuest: 'chapter1_main_3' },
            main_3: { id: 'chapter1_main_3', title: '散落的炊烟', description: '调查风灾的真相。', type: 'main', chapter: 1, order: 3, prerequisites: ['chapter1_main_2'], giver: 'qibo', receiver: 'qibo', objectives: [{ type: 'talk_to', target: 'ayan', count: 1, description: '询问阿砚目击证词' }, { type: 'talk_to', target: 'liushen', count: 1, description: '询问柳婶周叔去向' }, { type: 'rescue', target: 'zhoushu', count: 1, description: '救回周叔' }, { type: 'investigate', target: 'zhenfeng_pile_1', count: 1, description: '调查第一根镇风桩' }, { type: 'investigate', target: 'zhenfeng_pile_2', count: 1, description: '调查第二根镇风桩' }, { type: 'investigate', target: 'zhenfeng_pile_3', count: 1, description: '调查第三根镇风桩' }, { type: 'find_item', target: 'hundeng', count: 1, description: '调查破箱取得空魂灯' }, { type: 'find_item', target: 'yunye_canye', count: 1, description: '取得运灯残页' }], rewards: { exp: 40, lingShi: 150, basicSkillPoints: 1, items: [] }, nextQuest: 'chapter1_main_4' },
            main_4: { id: 'chapter1_main_4', title: '山口不止风', description: '击败被阵核控制的摄风山魈。', type: 'main', chapter: 1, order: 4, prerequisites: ['chapter1_main_3'], giver: 'qibo', receiver: 'qibo', objectives: [{ type: 'defeat_boss', target: 'boss_shanxiao', count: 1, description: '击败摄风山魈' }, { type: 'investigate', target: 'boss_array_core', count: 1, description: '调查阵核' }, { type: 'find_item', target: 'mingce', count: 1, description: '取得名册' }, { type: 'talk_to', target: 'qibo', count: 1, description: '向祁伯交付' }], rewards: { exp: 0, lingShi: 0, items: ['mingce'], storyItems: ['yunduze_route'] }, nextQuest: 'chapter1_ending_1' },
        };
    }

    static getMonsterConfigs() {
        return {
            fenglang: { id: 'fenglang', name: '风狼', realm: 'lianqi', health: 50, damage: 10, defense: 2, expReward: 15, lingShiReward: 10, drops: [{ itemId: 'lingcao', chance: 0.5, count: 1 }], attackRange: 50, detectRange: 200 },
            boss_shanxiao: { id: 'boss_shanxiao', name: '摄风山魈', type: 'boss', realm: 'lianqi', health: 300, damage: 20, defense: 5, expReward: 100, lingShiReward: 200, toughness: 100, skills: ['wind_slash','pounce','sweep'], phases: { phase1: { healthPercent: 100, skillChance: [0.4,0.3,0.3] }, phase2: { healthPercent: 50, skillChance: [0.3,0.35,0.35] } } },
        };
    }

    static getMapConfigs() {
        return {
            qinglan_fuye: {
                id: 'qinglan_fuye', name: '青岚浮野', chapter: 1,
                tileSize: 32, mapWidth: 105, mapHeight: 59,
                // === NPC 初始位置（瓦片坐标） ===
                // 阿禾初始在牌坊附近开场；完成任务后迁至救助点/码头
                npcPositions: {
                    ahe: { x: 16, y: 40 },
                    qibo: { x: 58, y: 31 },
                    liushen: { x: 75, y: 28 },
                    ayan: { x: 57, y: 41 },
                    zhoushu: { x: 53, y: 15 },
                },
                // === 可拾取任务物品 ===
                pickupItems: {
                    guixiang_pai: {
                        id: 'pickup_guixiang_pai', itemId: 'guixiang_pai', name: '归乡牌',
                        position: { x: 350, y: 1200 }, count: 1, questId: 'chapter1_main_1',
                        objectiveType: 'find_item', promptText: '按 E 拾取归乡牌',
                    },
                    hundeng: {
                        id: 'pickup_hundeng', itemId: 'hundeng', name: '空魂灯',
                        position: { x: 70, y: 27 }, count: 1, questId: 'chapter1_main_3',
                        objectiveType: 'find_item', promptText: '按 E 拾取空魂灯',
                    },
                    yunye_canye: {
                        id: 'pickup_yunye_canye', itemId: 'yunye_canye', name: '运灯残页',
                        position: { x: 71, y: 28 }, count: 1, questId: 'chapter1_main_3',
                        objectiveType: 'find_item', promptText: '按 E 拾取运灯残页',
                    },
                    zhenfeng_heipian_1: {
                        id: 'pickup_heipian_1', itemId: 'zhenfeng_heipian', name: '黑铁片',
                        position: { x: 40, y: 25 }, count: 1, questId: 'chapter1_main_3',
                        objectiveType: 'investigate', promptText: '按 E 从桩中取出黑铁片',
                    },
                    zhenfeng_heipian_2: {
                        id: 'pickup_heipian_2', itemId: 'zhenfeng_heipian', name: '黑铁片',
                        position: { x: 60, y: 20 }, count: 1, questId: 'chapter1_main_3',
                        objectiveType: 'investigate', promptText: '按 E 从桩中取出黑铁片',
                    },
                    zhenfeng_heipian_3: {
                        id: 'pickup_heipian_3', itemId: 'zhenfeng_heipian', name: '黑铁片',
                        position: { x: 75, y: 15 }, count: 1, questId: 'chapter1_main_3',
                        objectiveType: 'investigate', promptText: '按 E 从桩中取出黑铁片',
                    },
                },
                // === 路标 ===
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
                    },
                },
                // === 入口点（左下牌坊附近） ===
                entryPoint: { x: 16, y: 43 },
                ambientConfig: {
                    fallingLeaves: { enabled: true, spawnRate: 0.8, maxCount: 40 },
                    fog: { enabled: false },
                },
            },
            boss_arena_ch1: {
                id: 'boss_arena_ch1', name: '摄风山魈战场', chapter: 1,
                tileSize: 32, mapWidth: 45, mapHeight: 30,
                collisionData: null,
                npcPositions: {},
                entryPoint: { x: 5, y: 15 },
                pickupItems: {
                    mingce: {
                        id: 'pickup_mingce', itemId: 'mingce', name: '运灯名册',
                        position: { x: 20, y: 14 }, count: 1, questId: 'chapter1_main_4',
                        objectiveType: 'find_item', promptText: '按 E 拾取运灯名册',
                    },
                },
            },
        };
    }

    static getItemConfigs() {
        return {
            yunye_canye: { id: 'yunye_canye', name: '运灯残页', type: 'quest', description: '魂灯运送单据的残页', stackable: false },
            mingce: { id: 'mingce', name: '运灯名册', type: 'quest', description: '记载着被运走村民的名字与魂灯编号的册子', stackable: false },
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
                // 第一章完成 → 告别
                { whenComplete: 'chapter1_ending_1', dialogueId: 'farewell' },
                // main_4 完成 → 战后
                { whenComplete: 'chapter1_main_4', dialogueId: 'after_boss' },
                // main_2 完成 → 准备阶段
                { whenComplete: 'chapter1_main_2', dialogueId: 'quest_m02_ready' },
                // main_2 进行中且采药已完成 → 引导定息引气
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
                // ending 完成 → 筑基成功
                { whenComplete: 'chapter1_ending_1', dialogueId: 'breakthrough_success' },
                // main_4 完成 → 准备筑基
                { whenComplete: 'chapter1_main_4', dialogueId: 'quest_m04_complete' },
                // main_4 进行中 → boss 准备
                { whenActive: 'chapter1_main_4', dialogueId: 'quest_m04_ready' },
                // main_3 完成 → 接受 main_4
                { whenComplete: 'chapter1_main_3', dialogueId: 'quest_m03_done' },
                // main_3 进行中 → 调查指引
                { whenActive: 'chapter1_main_3', dialogueId: 'quest_m03_progress' },
                // 持有运灯残页 → 反应
                { whenHasItem: 'yunye_canye', dialogueId: 'has_yunye_canye' },
                // main_2 完成 → 接受 main_3
                { whenComplete: 'chapter1_main_2', dialogueId: 'quest_m02_complete' },
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
                // main_2 完成 → 目击证词
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
                // main_3 进行中 → 救援周叔
                { whenActive: 'chapter1_main_3', dialogueId: 'rescue_start' },
                // 默认
                { dialogueId: 'idle_talk' },
            ],
            // ===== 周叔 =====
            zhoushu: [
                // main_4 完成 → 战后种田
                { whenComplete: 'chapter1_main_4', dialogueId: 'after_boss' },
                // main_3 完成 → 调查线索
                { whenComplete: 'chapter1_main_3', dialogueId: 'after_rescue' },
                // main_3 进行中 → 救援
                { whenActive: 'chapter1_main_3', dialogueId: 'rescue_start' },
                // 默认
                { dialogueId: 'idle_talk' },
            ],
        };
        const npcRules = rules[npcId];
        if (!npcRules) return null;

        for (const rule of npcRules) {
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

















