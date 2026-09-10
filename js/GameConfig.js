/**
 * 游戏配置数据管理类
 * 集中管理所有游戏静态数据：技能、NPC、任务、怪物、物品等
 * 所有数据均可序列化，方便后续存档
 */
class GameConfig {
    static getInstance() {
        if (!GameConfig.instance) {
            GameConfig.instance = new GameConfig();
        }
        return GameConfig.instance;
    }

    constructor() {
        if (GameConfig.instance) {
            return GameConfig.instance;
        }
        GameConfig.instance = this;
        
        this.initConfig();
    }

    /**
     * 初始化所有游戏配置数据
     */
    initConfig() {
        // ========== 境界配置 ==========
        this.realms = {
            LIANQI: {
                id: 'lianqi',
                name: '练气',
                stages: ['初期', '中期', '后期', '圆满'],
                maxExp: 100, // 每个小阶段所需经验
                moveSpeed: 200, // 基础移动速度
                maxHealth: 100,
                maxMana: 50,
            },
            ZHUJI: {
                id: 'zhuji',
                name: '筑基',
                stages: ['初期', '中期', '后期', '圆满'],
                maxExp: 200,
                moveSpeed: 220,
                maxHealth: 150,
                maxMana: 75,
            },
            JIEDAN: {
                id: 'jiedan',
                name: '结丹',
                stages: ['初期', '中期', '后期', '圆满'],
                maxExp: 400,
                moveSpeed: 240,
                maxHealth: 220,
                maxMana: 100,
            },
            YUANYING: {
                id: 'yuanying',
                name: '元婴',
                stages: ['初期', '中期', '后期', '圆满'],
                maxExp: 800,
                moveSpeed: 260,
                maxHealth: 300,
                maxMana: 150,
            },
            HUASHEN: {
                id: 'huashen',
                name: '化神',
                stages: ['初期'],
                maxExp: 0, // 化神后不再升级
                moveSpeed: 300,
                maxHealth: 500,
                maxMana: 250,
            },
        };

        // ========== 职业配置 ==========
        this.professions = {
            SANXIU: {
                id: 'sanxiu',
                name: '散修',
                description: '尚未选择职业，使用基础灵力攻击',
                attackType: 'basic',
                unlocked: true,
            },
            JIANXIU: {
                id: 'jianxiu',
                name: '剑修',
                description: '灵力凝剑，近中距离机动连击',
                attackType: 'melee',
                moveSpeedBonus: 30,
                skills: ['tangfeng', 'guiyi', 'jianying', 'wanjian'],
                passive: 'jianyi',
                unlockedAt: 'zhuji',
                respecCost: {
                    zhuji: 600,
                    jiedan: 1200,
                    yuanying: 2400,
                },
                schools: ['zhufeng', 'liuying'], // 结丹流派
            },
            FAXIU: {
                id: 'faxiu',
                name: '法修',
                description: '灵力法器，中远距离术法爆发',
                attackType: 'ranged',
                rangeBonus: 100,
                skills: ['yanling', 'hanchao', 'tianlei', 'sanxiang'],
                passive: 'lingfa',
                unlockedAt: 'zhuji',
                respecCost: {
                    zhuji: 600,
                    jiedan: 1200,
                    yuanying: 2400,
                },
                schools: ['jizhou', 'ningfa'],
            },
            TIXIU: {
                id: 'tixiu',
                name: '体修',
                description: '拳影，近距离防护反击',
                attackType: 'melee',
                defenseBonus: 20,
                skills: ['bengshan', 'jingang', 'zhenyue', 'faxiang'],
                passive: 'xujin',
                unlockedAt: 'zhuji',
                respecCost: {
                    zhuji: 600,
                    jiedan: 1200,
                    yuanying: 2400,
                },
                schools: ['budong', 'pojun'],
            },
            FUXIU: {
                id: 'fuxiu',
                name: '符修',
                description: '符箓，中距离布置与引爆',
                attackType: 'ranged',
                skills: ['zhuihun', 'fuling', 'baofu', 'qianfu'],
                passive: 'yumo',
                unlockedAt: 'zhuji',
                respecCost: {
                    zhuji: 600,
                    jiedan: 1200,
                    yuanying: 2400,
                },
                schools: ['xumo', 'zhusha'],
            },
        };

        // ========== 技能配置 ==========
        this.skills = {
            // === 基础技能 ===
            basic: {
                lingxidan: {
                    id: 'lingxidan',
                    name: '灵息弹',
                    type: 'basic',
                    description: '发射单体灵力攻击',
                    manaCost: 10,
                    cooldown: 2,
                    damage: 15,
                    range: 300,
                    projectileSpeed: 400,
                    maxLevel: 3,
                    upgradeCost: [1, 2], // 升到2级、3级所需点数
                },
                hutishu: {
                    id: 'hutishu',
                    name: '护体术',
                    type: 'basic',
                    description: '获得短时护盾，减轻伤害及风力推移',
                    manaCost: 15,
                    cooldown: 8,
                    duration: 3,
                    shieldPercent: 30,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                huixishu: {
                    id: 'huixishu',
                    name: '回息术',
                    type: 'basic',
                    description: '短暂原地调息，恢复部分灵息',
                    manaCost: 0,
                    cooldown: 12,
                    manaRestorePercent: 30,
                    channelTime: 1.5,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
            },
            
            // === 剑修技能 ===
            jianxiu: {
                tangfeng: {
                    id: 'tangfeng',
                    name: '踏风斩',
                    type: 'active',
                    profession: 'jianxiu',
                    unlockStage: 'zhuji',
                    description: '朝指定方向短距突进并斩击',
                    manaCost: 20,
                    cooldown: 5,
                    damage: 25,
                    dashDistance: 150,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                guiyi: {
                    id: 'guiyi',
                    name: '归刃',
                    type: 'active',
                    profession: 'jianxiu',
                    unlockStage: 'zhuji',
                    description: '掷出灵剑再回收，往返命中可造成两段伤害',
                    manaCost: 25,
                    cooldown: 6,
                    damage: 30,
                    range: 250,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                jianying: {
                    id: 'jianying',
                    name: '剑影连斩',
                    type: 'active',
                    profession: 'jianxiu',
                    unlockStage: 'jiedan',
                    description: '对前方连续斩击',
                    manaCost: 40,
                    cooldown: 10,
                    damage: 60,
                    range: 120,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                wanjian: {
                    id: 'wanjian',
                    name: '万剑归宗',
                    type: 'ultimate',
                    profession: 'jianxiu',
                    unlockStage: 'yuanying',
                    description: '在选定区域落下剑雨',
                    manaCost: 80,
                    cooldown: 30,
                    damage: 150,
                    range: 300,
                    areaRadius: 100,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
            },
            
            // === 法修技能 ===
            faxiu: {
                yanling: {
                    id: 'yanling',
                    name: '炎灵术',
                    type: 'active',
                    profession: 'faxiu',
                    unlockStage: 'zhuji',
                    description: '发射火焰，对命中点周围造成伤害',
                    manaCost: 25,
                    cooldown: 4,
                    damage: 28,
                    range: 350,
                    areaRadius: 50,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                hanchao: {
                    id: 'hanchao',
                    name: '寒潮术',
                    type: 'active',
                    profession: 'faxiu',
                    unlockStage: 'zhuji',
                    description: '向前释放寒潮并施加减速',
                    manaCost: 30,
                    cooldown: 6,
                    damage: 22,
                    range: 300,
                    slowPercent: 30,
                    slowDuration: 2,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                tianlei: {
                    id: 'tianlei',
                    name: '天雷引',
                    type: 'active',
                    profession: 'faxiu',
                    unlockStage: 'jiedan',
                    description: '在指定区域预示雷击',
                    manaCost: 45,
                    cooldown: 12,
                    damage: 70,
                    range: 400,
                    areaRadius: 60,
                    delayTime: 1,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                sanxiang: {
                    id: 'sanxiang',
                    name: '三象天劫',
                    type: 'ultimate',
                    profession: 'faxiu',
                    unlockStage: 'yuanying',
                    description: '在选定范围依次触发火、冰、雷攻击',
                    manaCost: 90,
                    cooldown: 35,
                    damage: 180,
                    range: 350,
                    areaRadius: 120,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
            },
            
            // === 体修技能 ===
            tixiu: {
                bengshan: {
                    id: 'bengshan',
                    name: '崩山拳',
                    type: 'active',
                    profession: 'tixiu',
                    unlockStage: 'zhuji',
                    description: '向前踏步出拳，造成较高韧性伤害',
                    manaCost: 20,
                    cooldown: 4,
                    damage: 25,
                    toughnessDamage: 40,
                    range: 100,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                jingang: {
                    id: 'jingang',
                    name: '金刚护体',
                    type: 'active',
                    profession: 'tixiu',
                    unlockStage: 'zhuji',
                    description: '短时减伤并提升抗打断',
                    manaCost: 30,
                    cooldown: 10,
                    duration: 4,
                    damageReduction: 30,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                zhenyue: {
                    id: 'zhenyue',
                    name: '震岳踏',
                    type: 'active',
                    profession: 'tixiu',
                    unlockStage: 'jiedan',
                    description: '踏地造成周身范围伤害和韧性伤害',
                    manaCost: 40,
                    cooldown: 12,
                    damage: 55,
                    toughnessDamage: 50,
                    areaRadius: 80,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                faxiang: {
                    id: 'faxiang',
                    name: '法相镇岳',
                    type: 'ultimate',
                    profession: 'tixiu',
                    unlockStage: 'yuanying',
                    description: '短时显化法相，提升减伤与普通攻击的韧性伤害',
                    manaCost: 70,
                    cooldown: 30,
                    duration: 8,
                    damageReduction: 40,
                    toughnessBonus: 30,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
            },
            
            // === 符修技能 ===
            fuxiu: {
                zhuihun: {
                    id: 'zhuihun',
                    name: '追魂符',
                    type: 'active',
                    profession: 'fuxiu',
                    unlockStage: 'zhuji',
                    description: '发射轻度追踪灵符，留下符印',
                    manaCost: 20,
                    cooldown: 3,
                    damage: 18,
                    range: 350,
                    markDuration: 5,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                fuling: {
                    id: 'fuling',
                    name: '缚灵阵',
                    type: 'active',
                    profession: 'fuxiu',
                    unlockStage: 'zhuji',
                    description: '放置小型符阵，持续造成伤害并减速',
                    manaCost: 35,
                    cooldown: 8,
                    damage: 8, // 每秒伤害
                    duration: 6,
                    areaRadius: 70,
                    slowPercent: 25,
                    maxCount: 2,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                baofu: {
                    id: 'baofu',
                    name: '爆符诀',
                    type: 'active',
                    profession: 'fuxiu',
                    unlockStage: 'jiedan',
                    description: '引爆目标身上的符印',
                    manaCost: 30,
                    cooldown: 6,
                    baseDamage: 35,
                    markBonusDamage: 50, // 每层符印附加伤害
                    range: 400,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
                qianfu: {
                    id: 'qianfu',
                    name: '千符归一',
                    type: 'ultimate',
                    profession: 'fuxiu',
                    unlockStage: 'yuanying',
                    description: '在所选区域展开符雨并集中爆破',
                    manaCost: 85,
                    cooldown: 32,
                    damage: 160,
                    range: 350,
                    areaRadius: 100,
                    maxLevel: 3,
                    upgradeCost: [1, 2],
                },
            },
        };

        // ========== 职业被动配置 ==========
        this.passives = {
            jianyi: {
                id: 'jianyi',
                name: '剑意',
                profession: 'jianxiu',
                description: '普通攻击命中积累剑意，消耗剑意提升技能伤害',
                maxStacks: 3,
                damageBonusPerStack: 15,
            },
            lingfa: {
                id: 'lingfa',
                name: '灵法相生',
                profession: 'faxiu',
                description: '交替使用不同技能命中，后一个技能伤害提高',
                damageBonus: 15,
            },
            xujin: {
                id: 'xujin',
                name: '蓄劲',
                profession: 'tixiu',
                description: '闪避或金刚护体受击后，下次攻击附加韧性伤害',
                toughnessBonus: 25,
            },
            yumo: {
                id: 'yumo',
                name: '余墨',
                profession: 'fuxiu',
                description: '追魂符命中后附加持续伤害',
                dotDamage: 5, // 每秒
                dotDuration: 4,
            },
        };

        // ========== 物品配置 ==========
        this.items = {
            huiyuan_dan: {
                id: 'huiyuan_dan',
                name: '回元丹',
                type: 'consumable',
                description: '恢复最大气血的35%',
                effect: 'restore_health_percent',
                value: 35,
                stackable: true,
                maxStack: 99,
                sellPrice: 20,
                buyPrice: 50,
            },
            huiling_dan: {
                id: 'huiling_dan',
                name: '回灵丹',
                type: 'consumable',
                description: '恢复最大灵息的40%',
                effect: 'restore_mana_percent',
                value: 40,
                stackable: true,
                maxStack: 99,
                sellPrice: 25,
                buyPrice: 60,
            },
            lingcao: {
                id: 'lingcao',
                name: '灵草',
                type: 'material',
                description: '用于炼制回元丹的基础材料',
                stackable: true,
                maxStack: 99,
                sellPrice: 5,
                buyPrice: 15,
            },
            ninglu: {
                id: 'ninglu',
                name: '凝露',
                type: 'material',
                description: '用于炼制回灵丹的基础材料',
                stackable: true,
                maxStack: 99,
                sellPrice: 8,
                buyPrice: 20,
            },
            guixiang_pai: {
                id: 'guixiang_pai',
                name: '归乡牌',
                type: 'quest',
                description: '刻有"青岚村"的牌子，是故乡的凭证',
                stackable: false,
            },
            hundeng: {
                id: 'hundeng',
                name: '魂灯',
                type: 'quest',
                description: '引渡司用来装载魂魄的灯',
                stackable: false,
            },
            yisha: {
                id: 'yisha',
                name: '忆砂',
                type: 'quest',
                description: '从魂魄中炼化出的记忆结晶',
                stackable: false,
            },
        };

        // ========== 任务配置 ==========
        this.quests = {
            chapter1: {
                main_1: {
                    id: 'chapter1_main_1',
                    title: '醒在风里',
                    description: '从风灾中醒来，学习基本操作',
                    type: 'main',
                    chapter: 1,
                    objectives: [
                        { type: 'learn_move', target: null, count: 1, description: '学习移动操作' },
                        { type: 'learn_dialog', target: null, count: 1, description: '学习对话操作' },
                        { type: 'find_item', target: 'guixiang_pai', count: 1, description: '找回归乡牌' },
                    ],
                    rewards: {
                        exp: 20,
                        lingShi: 0,
                        items: [],
                    },
                    nextQuest: 'chapter1_main_2',
                },
                main_2: {
                    id: 'chapter1_main_2',
                    title: '一盏安身灯',
                    description: '帮助阿禾采药并救治伤员',
                    type: 'main',
                    chapter: 1,
                    objectives: [
                        { type: 'collect_item', target: 'lingcao', count: 3, description: '采集灵草（3株）' },
                        { type: 'complete_minigame', target: 'dingxi_yinqi', count: 1, description: '完成定息引气' },
                    ],
                    rewards: {
                        exp: 50,
                        lingShi: 100,
                        items: ['huiyuan_dan'],
                    },
                    nextQuest: 'chapter1_main_3',
                },
                // 后续任务...
            },
            // 后续章节...
        };

/**
 * NPC完整配置
 * 包含基本信息、对话、任务、巡逻点
 */
        this.npcConfigs = {
            // ========== 第一章 NPC ==========
            ahe: {
                id: 'ahe',
                name: '阿禾',
                moveSpeed: 80,
                isStatic: false,
                position: { x: 20, y: 25 },   // 瓦片坐标（在青岚浮野地图上）
                patrolPoints: [],              // 不巡逻，固定位置
                
                // 对话配置
                dialogues: {
                    first_meet: {
                        id: 'first_meet',
                        text: '你醒了...青岚村已经被风撕成了碎片。还好你没事。',
                        options: [
                            { text: '我没事。其他人呢？', next: 'search_survivors' },
                            { text: '我的归乡牌...', next: 'find_guixiangpai' },
                        ],
                    },
                    search_survivors: {
                        id: 'search_survivors',
                        text: '祁伯他们应该还在附近。我们要尽快找到他们。',
                        options: [
                            { text: '我这就去找', next: null, action: 'start_quest_chapter1_main_2' },
                            { text: '先休息一下', next: null },
                        ],
                    },
                    find_guixiangpai: {
                        id: 'find_guixiangpai',
                        text: '你的归乡牌...我记得你一直带在身上的。可能掉在风灾发生的地方了。',
                        options: [
                            { text: '我去找找', next: null },
                        ],
                    },
                    after_quest_main_2: {
                        id: 'after_quest_main_2',
                        text: '你找到药草了？太好了，伤员们有救了。',
                        options: [
                            { text: '开始治疗吧', next: null, action: 'complete_quest_chapter1_main_2' },
                        ],
                    },
                    idle_talk: {
                        id: 'idle_talk',
                        text: '风还在吹...不知道其他村民怎么样了。',
                        options: [
                            { text: '我想买点东西', next: null, action: 'open_shop' },
                            { text: '我会找到他们的', next: null },
                        ],
                    },
                },
                
                // 商店物品
                shopItems: [
                    { itemId: 'lingcao', price: 10, stock: 20 },
                    { itemId: 'ninglu', price: 15, stock: 10 },
                    { itemId: 'huiyuan_dan', price: 50, stock: 5 },
                ],
                
                // 可发布的任务
                assignedQuests: ['chapter1_main_2', 'chapter1_main_3'],
            },
            
            qibo: {
                id: 'qibo',
                name: '祁伯',
                moveSpeed: 60,
                isStatic: true,
                position: { x: 25, y: 20 },
                patrolPoints: [],
                
                dialogues: {
                    first_meet: {
                        id: 'first_meet',
                        text: '年轻人...你活下来了。青岚村...唉。',
                        options: [
                            { text: '村子为什么会飘走？', next: 'about_disaster' },
                            { text: '阿禾让我来找你', next: 'about_ahe' },
                        ],
                    },
                    about_disaster: {
                        id: 'about_disaster',
                        text: '灵潮发生前，太玄道君的赈灾队来装过镇风桩。我留了一张旧地脉图，你去看看那些桩子...',
                        options: [
                            { text: '带我去看', next: null, action: 'start_quest_chapter1_main_3' },
                        ],
                    },
                    about_ahe: {
                        id: 'about_ahe',
                        text: '阿禾那丫头...总是先顾着别人。你也要多帮她。',
                        options: [
                            { text: '我会的', next: null },
                        ],
                    },
                    idle_talk: {
                        id: 'idle_talk',
                        text: '这些浮岛，不知道还能撑多久...',
                        options: [
                            { text: '我会找出真相的', next: null },
                        ],
                    },
                },
                
                assignedQuests: ['chapter1_main_3', 'chapter1_main_4'],
            },
            
            // ========== 第二章 NPC ==========
            luzhou: {
                id: 'luzhou',
                name: '陆舟',
                moveSpeed: 70,
                isStatic: false,
                position: { x: 30, y: 30 },   // 云渡泽地图上
                patrolPoints: [
                    { x: 900, y: 900 },
                    { x: 1000, y: 950 },
                ],
                
                dialogues: {
                    first_meet: {
                        id: 'first_meet',
                        text: '你是从青岚来的？渡口现在乱得很，魂灯丢了魂的人越来越多...',
                        options: [
                            { text: '我来找失散的村民', next: 'about_villagers' },
                            { text: '这里发生了什么？', next: 'about_yunduze' },
                        ],
                    },
                    about_villagers: {
                        id: 'about_villagers',
                        text: '引渡司把魂魄都收进了灯里，说能送回家。可我在这河上跑了一辈子，那些灯...不是往家送的。',
                        options: [
                            { text: '灯运往哪里？', next: 'about_lights' },
                        ],
                    },
                    about_lights: {
                        id: 'about_lights',
                        text: '上游。照尘仙城的方向。你要找的村民，可能也在那些灯里。',
                        options: [
                            { text: '带我去看看', next: null, action: 'start_quest_chapter2_main_1' },
                        ],
                    },
                    about_yunduze: {
                        id: 'about_yunduze',
                        text: '这条河本来是地脉水路，灵潮后飘到了天上。引渡司说能渡魂回家，可我看...他们是在收魂。',
                        options: [
                            { text: '收魂做什么？', next: 'about_lights' },
                        ],
                    },
                    idle_talk: {
                        id: 'idle_talk',
                        text: '要去河上摆渡吗？还是想看看我的货？',
                        options: [
                            { text: '看看你卖什么', next: null, action: 'open_shop' },
                            { text: '下次再聊', next: null },
                        ],
                    },
                },
                
                // 商店物品
                shopItems: [
                    { itemId: 'huiyuan_dan', price: 55, stock: 10 },
                    { itemId: 'huiling_dan', price: 65, stock: 10 },
                    { itemId: 'lingcao', price: 12, stock: 30 },
                    { itemId: 'ninglu', price: 18, stock: 15 },
                ],
                
                assignedQuests: ['chapter2_main_1', 'chapter2_main_2'],
            },
            
            jiangpo: {
                id: 'jiangpo',
                name: '江婆',
                moveSpeed: 50,
                isStatic: true,
                position: { x: 28, y: 32 },
                patrolPoints: [],
                
                dialogues: {
                    first_meet: {
                        id: 'first_meet',
                        text: '我的女儿...她说去渡口领归乡灯，就再也没回来。你见过她吗？',
                        options: [
                            { text: '我帮你找找', next: null, action: 'start_quest_chapter2_side_1' },
                            { text: '她长什么样？', next: 'about_daughter' },
                        ],
                    },
                    about_daughter: {
                        id: 'about_daughter',
                        text: '她总穿一件青色衣裳，手腕上系着红绳。求求你，帮帮我这个老婆子...',
                        options: [
                            { text: '我一定找到她', next: null, action: 'start_quest_chapter2_side_1' },
                        ],
                    },
                    after_quest: {
                        id: 'after_quest',
                        text: '谢谢...谢谢...我终于能安心了。',
                        options: [
                            { text: '好好休息吧', next: null },
                        ],
                    },
                },
                
                assignedQuests: ['chapter2_side_1'],
            },
            
            // ========== 第三章 NPC ==========
            wensheng: {
                id: 'wensheng',
                name: '闻笙',
                moveSpeed: 70,
                isStatic: false,
                position: { x: 35, y: 25 },   // 照尘仙城地图上
                patrolPoints: [],
                
                dialogues: {
                    first_meet: {
                        id: 'first_meet',
                        text: '你是新来的？我看你还没服用忘尘丹。趁还记得自己是谁，快离开这里。',
                        options: [
                            { text: '忘尘丹是什么？', next: 'about_wangchen' },
                            { text: '我来追查魂灯的下落', next: 'about_hundeng' },
                        ],
                    },
                    about_wangchen: {
                        id: 'about_wangchen',
                        text: '能快速提升修为的丹药，代价是失去记忆。这座城里的人，都在慢慢忘记自己。',
                        options: [
                            { text: '你也在服用吗？', next: 'about_wensheng' },
                        ],
                    },
                    about_wensheng: {
                        id: 'about_wensheng',
                        text: '我没有。我在收集大家写下的记忆笔记，等他们忘记时...至少还留着这些纸。',
                        options: [
                            { text: '让我帮你', next: null, action: 'start_quest_chapter3_main_1' },
                        ],
                    },
                    about_hundeng: {
                        id: 'about_hundeng',
                        text: '魂灯被运进了丹坊。忆砂就是从灯里的魂魄炼出来的...你追的没错。',
                        options: [
                            { text: '带我去丹坊', next: null, action: 'start_quest_chapter3_main_3' },
                        ],
                    },
                },
                
                assignedQuests: ['chapter3_main_1', 'chapter3_main_3'],
            },
            
            // ========== 第四章 NPC ==========
            zhiwei: {
                id: 'zhiwei',
                name: '知微',
                moveSpeed: 60,
                isStatic: true,
                position: { x: 40, y: 30 },   // 无乡天阙地图上
                patrolPoints: [],
                
                dialogues: {
                    first_meet: {
                        id: 'first_meet',
                        text: '你是从下界来的？这里的人都没有名字，只有代号。我是档案官知微...这是我自己留下的名字。',
                        options: [
                            { text: '你还记得自己的名字？', next: 'about_name' },
                            { text: '太玄道君在哪里？', next: 'about_taixuan' },
                        ],
                    },
                    about_name: {
                        id: 'about_name',
                        text: '因为我偷偷保存了档案。每个人来之前都有名字、有故乡。断缘台把这一切都抹掉了。',
                        options: [
                            { text: '断缘台是什么？', next: 'about_duanyuan' },
                        ],
                    },
                    about_duanyuan: {
                        id: 'about_duanyuan',
                        text: '无乡天阵的最后一道程序。切断人与过去的所有联系。无相真君就是第一个试验品。',
                        options: [
                            { text: '带我去看看', next: null, action: 'start_quest_chapter4_main_1' },
                        ],
                    },
                    about_taixuan: {
                        id: 'about_taixuan',
                        text: '天心台。他要借大阵的力量强行突破化神。你若想阻止他，必须先过无相真君那一关。',
                        options: [
                            { text: '我准备好了', next: null, action: 'start_quest_chapter4_main_4' },
                        ],
                    },
                },
                
                assignedQuests: ['chapter4_main_1', 'chapter4_main_4'],
            },
        };

        // ========== 怪物配置 ==========
        this.monsters = {
            // 普通怪物
            fenglang: {
                id: 'fenglang',
                name: '风狼',
                realm: 'lianqi',
                health: 50,
                damage: 10,
                defense: 2,
                expReward: 15,
                lingShiReward: 10,
                drops: [
                    { itemId: 'lingcao', chance: 0.5, count: 1 },
                ],
                attackRange: 50,
                detectRange: 200,
            },
            // Boss - 摄风山魈
            boss_shanxiao: {
                id: 'boss_shanxiao',
                name: '摄风山魈',
                type: 'boss',
                realm: 'lianqi',
                health: 300,
                damage: 20,
                defense: 5,
                expReward: 100,
                lingShiReward: 200,
                toughness: 100,
                skills: ['wind_slash', 'pounce', 'sweep'],
                phases: {
                    phase1: { healthPercent: 100, skillChance: [0.4, 0.3, 0.3] },
                    phase2: { healthPercent: 50, skillChance: [0.3, 0.35, 0.35] },
                },
            },
            // Boss - 渡厄使
            boss_due: {
                id: 'boss_due',
                name: '渡厄使',
                type: 'boss',
                realm: 'zhuji',
                health: 600,
                damage: 30,
                defense: 8,
                expReward: 300,
                lingShiReward: 500,
                toughness: 150,
                skills: ['soul_chain', 'charge', 'tracking_lamp'],
                phases: {
                    phase1: { healthPercent: 100, skillChance: [0.3, 0.4, 0.3] },
                    phase2: { healthPercent: 60, skillChance: [0.25, 0.35, 0.4] },
                },
            },
            // 后续Boss...
        };

        // ========== 地图配置 ==========
        this.maps = {
            worldMap: {
                id: 'worldMap',
                name: '九州总图',
                type: 'worldMap',
                buttons: [
                    { id: 'btn_qinglan', x: 150, y: 180, width: 80, height: 80, targetMap: 'qinglan_fuye', unlocked: true },
                    { id: 'btn_yunduze', x: 380, y: 150, width: 80, height: 80, targetMap: 'yunduze', unlocked: false },
                    { id: 'btn_zhaochen', x: 600, y: 220, width: 80, height: 80, targetMap: 'zhaochen_xiancheng', unlocked: false },
                    { id: 'btn_wuxiang', x: 450, y: 350, width: 80, height: 80, targetMap: 'wuxiang_tianque', unlocked: false },
                ],
            },
            qinglan_fuye: {
                id: 'qinglan_fuye',
                name: '青岚浮野',
                chapter: 1,
                tileSize: 32,
                mapWidth: 105, // 瓦片数量
                mapHeight: 59,
                collisionData: null, // 实际数据由地图类生成
                npcPositions: {
                    ahe: { x: 20, y: 25 },
                    qibo: { x: 24, y: 24 },
                },
                monsterPositions: {
                    fenglang_1: { x: 30, y: 15, monsterId: 'fenglang' },
                    fenglang_2: { x: 32, y: 18, monsterId: 'fenglang' },
                },
                bossPosition: {
                    boss_shanxiao: { x: 45, y: 35, monsterId: 'boss_shanxiao' },
                },
                teleporters: {
                    qinglan_boss_gate: {
                        id: 'qinglan_boss_gate',
                        name: '摄风山魈法阵',
                        position: { x: 48, y: 32 },
                        radius: 70,
                        targetMapId: 'boss_arena',
                        targetPosition: { x: 8, y: 8 },
                        promptText: '按 E 进入Boss法阵',
                    },
                },
                entryPoint: { x: 10, y: 10 },
            },
            boss_arena: {
                id: 'boss_arena',
                name: '摄风山魈战场',
                chapter: 1,
                tileSize: 32,
                mapWidth: 45,
                mapHeight: 30,
                collisionData: null,
                bossPosition: {
                    boss_shanxiao: { x: 20, y: 12, monsterId: 'boss_shanxiao' },
                },
                teleporters: {
                    exit_boss_arena: {
                        id: 'exit_boss_arena',
                        name: '退出法阵',
                        position: { x: 4, y: 14 },
                        radius: 70,
                        targetMapId: 'qinglan_fuye',
                        targetPosition: { x: 50, y: 33 },
                        promptText: '按 E 返回青岚浮野',
                    },
                },
                entryPoint: { x: 5, y: 15 },
            },
            // 后续地图...
        };

        // ========== 炼丹配方 ==========
        this.recipes = {
            huiyuan_dan: {
                result: 'huiyuan_dan',
                materials: [
                    { itemId: 'lingcao', count: 2 },
                ],
                minigame: 'konghuo_liandan',
            },
            huiling_dan: {
                result: 'huiling_dan',
                materials: [
                    { itemId: 'lingcao', count: 1 },
                    { itemId: 'ninglu', count: 1 },
                ],
                minigame: 'konghuo_liandan',
            },
        };

        // ========== 转职费用 ==========
        this.respecCost = {
            zhuji: 600,
            jiedan: 1200,
            yuanying: 2400,
        };

        // ========== 可重复委托奖励 ==========
        this.repeatableQuestRewards = {
            lianqi: 50,
            zhuji: 200,
            jiedan: 400,
            yuanying: 800,
        };
    }

    /**
     * 获取配置数据
     * @param {string} path - 点号分隔的路径
     * @returns {*} 配置数据
     */
    get(path) {
        const keys = path.split('.');
        let current = this;
        for (const key of keys) {
            if (current[key] === undefined) {
                console.error(`配置数据不存在: ${path}`);
                return null;
            }
            current = current[key];
        }
        return current;
    }

    /**
     * 获取境界配置
     * @param {string} realmId - 境界ID
     */
    getRealm(realmId) {
        return this.realms[realmId.toUpperCase()] || null;
    }

    /**
     * 获取职业配置
     * @param {string} professionId - 职业ID
     */
    getProfession(professionId) {
        return this.professions[professionId.toUpperCase()] || null;
    }

    /**
     * 获取技能配置
     * @param {string} skillId - 技能ID
     */
    getSkill(skillId) {
        // 在所有技能类型中查找
        for (const category in this.skills) {
            for (const profession in this.skills[category]) {
                if (this.skills[category][profession].id === skillId) {
                    return this.skills[category][profession];
                }
            }
        }
        return null;
    }

    /**
     * 获取物品配置
     * @param {string} itemId - 物品ID
     */
    getItem(itemId) {
        return this.items[itemId] || null;
    }

    /**
     * 获取任务配置
     * @param {string} questId - 任务ID
     */
    getQuest(questId) {
        for (const chapter in this.quests) {
            for (const questType in this.quests[chapter]) {
                if (this.quests[chapter][questType].id === questId) {
                    return this.quests[chapter][questType];
                }
            }
        }
        return null;
    }

    /**
     * 获取地图配置
     * @param {string} mapId - 地图ID
     */
    getMap(mapId) {
        return this.maps[mapId] || null;
    }

    /**
     * 获取怪物配置
     * @param {string} monsterId - 怪物ID
     */
    getMonster(monsterId) {
        return this.monsters[monsterId] || null;
    }

    /**
     * 序列化所有配置数据（用于存档）
     * @returns {Object} 配置数据的深拷贝
     */
    serialize() {
        return JSON.parse(JSON.stringify({
            realms: this.realms,
            professions: this.professions,
            skills: this.skills,
            passives: this.passives,
            items: this.items,
            quests: this.quests,
            monsters: this.monsters,
            maps: this.maps,
            recipes: this.recipes,
            respecCost: this.respecCost,
            repeatableQuestRewards: this.repeatableQuestRewards,
        }));
    }

    /**
     * 反序列化配置数据（用于读档）
     * @param {Object} data - 配置数据对象
     */
    deserialize(data) {
        if (!data) return;
        
        if (data.realms) this.realms = data.realms;
        if (data.professions) this.professions = data.professions;
        if (data.skills) this.skills = data.skills;
        if (data.passives) this.passives = data.passives;
        if (data.items) this.items = data.items;
        if (data.quests) this.quests = data.quests;
        if (data.monsters) this.monsters = data.monsters;
        if (data.maps) this.maps = data.maps;
        if (data.recipes) this.recipes = data.recipes;
        if (data.respecCost) this.respecCost = data.respecCost;
        if (data.repeatableQuestRewards) this.repeatableQuestRewards = data.repeatableQuestRewards;
    }
}