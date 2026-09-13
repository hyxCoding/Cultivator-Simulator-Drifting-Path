/**
 * 资源管理类（单例）
 * 统一管理游戏中所有图片、音频资源的路径和加载状态
 * 所有外部加载资源时，必须通过此类访问资源路径
 */
class ResourceManager {
    /**
     * 获取资源管理器的单例实例
     */
    static getInstance() {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager();
        }
        return ResourceManager.instance;
    }

    constructor() {
        if (ResourceManager.instance) {
            return ResourceManager.instance;
        }
        ResourceManager.instance = this;
        
        // 资源路径配置表
        this.resources = {
            images: {
                // === UI相关 ===
                ui: {
                    button_normal: 'assets/images/ui/button_normal.png',
                    button_hover: 'assets/images/ui/button_hover.png',
                    button_pressed: 'assets/images/ui/button_pressed.png',
                    dialog_box: 'assets/images/ui/dialog_box.png',
                    task_panel: 'assets/images/ui/task_panel.png',
                    skill_panel: 'assets/images/ui/skill_panel.png',
                    inventory_panel: 'assets/images/ui/inventory_panel.png',
                    // 气血条 / 灵息条（HUD 自定义图片，见 js/PlayerCombat.js CONFIG.hud）
                    //   *_bar_bg   —— 外框，500×64
                    //   *_bar_fill —— 内条（血量/灵息），454×64；源图 X∈[0,78) 为左侧固定装饰，
                    //                  X∈[78,454) 才是真正的血量/灵息像素（按当前值比例裁切显示）
                    // 两图左上角对齐绘制：先画内条，再画外框
                    health_bar_bg: 'assets/images/ui/health_bar_bg.png',
                    health_bar_fill: 'assets/images/ui/health_bar_fill.png',
                    mana_bar_bg: 'assets/images/ui/mana_bar_bg.png',
                    mana_bar_fill: 'assets/images/ui/mana_bar_fill.png',
                    // 左下角技能栏图标（规格 100×100；见 js/PlayerCombat.js CONFIG.hud.skillBar）
                    //   skill_lingxidan —— U 灵息弹
                    //   skill_hutishu   —— I 护体术
                    //   skill_dodge     —— L 闪避
                    //   skill_jianying  —— O 剑影连斩（第二章主线一「剑修基础连招试炼」传授，学会后才占格）
                    // 普通攻击（J）不占左下角技能栏，故没有对应图片；
                    // 缺图 / 尺寸不符时技能栏该格回退程序化方框（按键与倒计时照常绘制）
                    skill_lingxidan: 'assets/images/ui/skill_lingxidan.png',
                    skill_hutishu: 'assets/images/ui/skill_hutishu.png',
                    skill_dodge: 'assets/images/ui/skill_dodge.png',
                    skill_jianying: 'assets/images/ui/skill_jianying.png',
                    // 游戏开始界面（主菜单）：**没有任何程序化绘制**，整屏只有这两张贴图（见 js/MainMenuScene.js）
                    //   start_screen —— 1280×720 整屏背景（开始界面整幅画面）
                    //   start_button —— 400×112  开始按钮（画布正中显示，点击即开始游戏）
                    // 生成 / 覆盖占位图：py -3 tools/generate_start_screen_assets.py
                    // （默认不覆盖已存在的文件；正式美术按同尺寸替换即自动生效）
                    start_screen: 'assets/images/ui/start_screen.png',
                    start_button: 'assets/images/ui/start_button.png',
                    // 游戏完结界面（章末二登船后的滚动字幕，见 js/EndingScene.js）：
                    //   ending_bg —— 1280×720 整屏底图（画面中部请留白给滚动字幕）
                    // 缺图 / 空图 / ResourceManager 品红占位图 → 该图不绘制，
                    // 改回程序化「深墨渐变 + 渡口暖光晕」兜底，
                    // 浮尘与四周暗角照常叠加（两种情况下字幕都保持可读）；
                    // 生成 / 覆盖占位图：py -3 tools/generate_ending_assets.py
                    ending_bg: 'assets/images/ui/ending_bg.png',
                },
                
                // === 地图传送界面 ===
                worldMap: {
                    background: 'assets/images/worldmap/world_map_bg.png',
                    // 四个区域的按钮图片
                    button_qinglan: 'assets/images/worldmap/btn_qinglan.png',
                    button_yunduze: 'assets/images/worldmap/btn_yunduze.png',
                    button_zhaochen: 'assets/images/worldmap/btn_zhaochen.png',
                    button_wuxiang: 'assets/images/worldmap/btn_wuxiang.png',
                    button_tianxin: 'assets/images/worldmap/btn_tianxin.png',
                },
                
                // === 地图瓦片 ===
                tiles: {
                    // 青岚浮野
                    qinglan_grass: 'assets/images/tiles/qinglan/grass.png',
                    qinglan_road: 'assets/images/tiles/qinglan/road.png',
                    qinglan_water: 'assets/images/tiles/qinglan/water.png',
                    qinglan_rock: 'assets/images/tiles/qinglan/rock.png',
                    // 云渡泽
                    yunduze_water: 'assets/images/tiles/yunduze/water.png',
                    yunduze_boat: 'assets/images/tiles/yunduze/boat.png',
                    // 后续地图瓦片可继续添加...
                },

                // 在 resources.images 中添加以下内容
                mapBackgrounds: {
                    qinglan_fuye: 'assets/images/maps/qinglan_fuye/bg.png',
                    yunduze: 'assets/images/maps/yunduze/bg.png',
                    zhaochen_xiancheng: 'assets/images/maps/zhaochen_xiancheng/bg.png',
                    wuxiang_tianque: 'assets/images/maps/wuxiang_tianque/bg.png',
                    boss_arena: 'assets/images/maps/boss_arena/bg.png',
                    // 主线四：摄风山魈战场（1280×720，与画布同尺寸）
                    boss_arena_ch1: 'assets/images/maps/boss_arena_ch1/bg.png',
                    // 第二章：万灯台战场（1280×720）
                    boss_arena_ch2: 'assets/images/maps/boss_arena_ch2/bg.png',
                },

                mapCollisions: {
                    qinglan_fuye: 'assets/images/maps/qinglan_fuye/collision.png',
                    yunduze: 'assets/images/maps/yunduze/collision.png',
                    zhaochen_xiancheng: 'assets/images/maps/zhaochen_xiancheng/collision.png',
                    wuxiang_tianque: 'assets/images/maps/wuxiang_tianque/collision.png',
                    boss_arena: 'assets/images/maps/boss_arena/collision.png',
                    // 主线四战场碰撞图：白色可通行 / 黑色不可通行，1280×720
                    boss_arena_ch1: 'assets/images/maps/boss_arena_ch1/collision.png',
                    // 第二章万灯台战场碰撞图：同上约定
                    boss_arena_ch2: 'assets/images/maps/boss_arena_ch2/collision.png',
                },

                // === 主角动画精灵图 ===
                player: {
                    // 散修（练气期，未选职业）
                    sanxiu_idle: 'assets/images/player/sanxiu/idle.png',
                    sanxiu_walk: 'assets/images/player/sanxiu/walk.png',
                    sanxiu_fly: 'assets/images/player/sanxiu/fly.png',
                    sanxiu_attack: 'assets/images/player/sanxiu/attack.png',
                    sanxiu_skill: 'assets/images/player/sanxiu/skill.png',
                    sanxiu_hurt: 'assets/images/player/sanxiu/hurt.png',
                    sanxiu_dead: 'assets/images/player/sanxiu/dead.png',
                    
                    // 剑修
                    jianxiu_idle: 'assets/images/player/jianxiu/idle.png',
                    jianxiu_walk: 'assets/images/player/jianxiu/walk.png',
                    jianxiu_attack: 'assets/images/player/jianxiu/attack.png',
                    jianxiu_skill1: 'assets/images/player/jianxiu/skill1.png',
                    jianxiu_skill2: 'assets/images/player/jianxiu/skill2.png',
                    jianxiu_skill3: 'assets/images/player/jianxiu/skill3.png',
                    jianxiu_ultimate: 'assets/images/player/jianxiu/ultimate.png',
                    jianxiu_hurt: 'assets/images/player/jianxiu/hurt.png',
                    jianxiu_dead: 'assets/images/player/jianxiu/dead.png',
                    
                    // 法修
                    faxiu_idle: 'assets/images/player/faxiu/idle.png',
                    faxiu_walk: 'assets/images/player/faxiu/walk.png',
                    faxiu_attack: 'assets/images/player/faxiu/attack.png',
                    faxiu_skill1: 'assets/images/player/faxiu/skill1.png',
                    faxiu_skill2: 'assets/images/player/faxiu/skill2.png',
                    faxiu_skill3: 'assets/images/player/faxiu/skill3.png',
                    faxiu_ultimate: 'assets/images/player/faxiu/ultimate.png',
                    faxiu_hurt: 'assets/images/player/faxiu/hurt.png',
                    faxiu_dead: 'assets/images/player/faxiu/dead.png',
                    
                    // 体修
                    tixiu_idle: 'assets/images/player/tixiu/idle.png',
                    tixiu_walk: 'assets/images/player/tixiu/walk.png',
                    tixiu_attack: 'assets/images/player/tixiu/attack.png',
                    tixiu_skill1: 'assets/images/player/tixiu/skill1.png',
                    tixiu_skill2: 'assets/images/player/tixiu/skill2.png',
                    tixiu_skill3: 'assets/images/player/tixiu/skill3.png',
                    tixiu_ultimate: 'assets/images/player/tixiu/ultimate.png',
                    tixiu_hurt: 'assets/images/player/tixiu/hurt.png',
                    tixiu_dead: 'assets/images/player/tixiu/dead.png',
                    
                    // 符修
                    fuxiu_idle: 'assets/images/player/fuxiu/idle.png',
                    fuxiu_walk: 'assets/images/player/fuxiu/walk.png',
                    fuxiu_attack: 'assets/images/player/fuxiu/attack.png',
                    fuxiu_skill1: 'assets/images/player/fuxiu/skill1.png',
                    fuxiu_skill2: 'assets/images/player/fuxiu/skill2.png',
                    fuxiu_skill3: 'assets/images/player/fuxiu/skill3.png',
                    fuxiu_ultimate: 'assets/images/player/fuxiu/ultimate.png',
                    fuxiu_hurt: 'assets/images/player/fuxiu/hurt.png',
                    fuxiu_dead: 'assets/images/player/fuxiu/dead.png',
                },
                
                // === NPC动画精灵图 ===
                npc: {
                    ahe_idle: 'assets/images/npc/ahe/idle.png',
                    ahe_walk: 'assets/images/npc/ahe/walk.png',
                    qibo_idle: 'assets/images/npc/qibo/idle.png',
                    qibo_walk: 'assets/images/npc/qibo/walk.png',
                    ahe_heal: 'assets/images/npc/ahe/heal.png',
                    // 第一章NPC：柳婶、阿砚、周叔
                    liushen_idle: 'assets/images/npc/liushen/idle.png',
                    liushen_walk: 'assets/images/npc/liushen/walk.png',
                    ayan_idle: 'assets/images/npc/ayan/sit_idle.png',
                    ayan_walk: 'assets/images/npc/ayan/walk.png',
                    ayan_stand_idle: 'assets/images/npc/ayan/stand_idle.png',
                    zhoushu_idle: 'assets/images/npc/zhoushu/idle.png',
                    zhoushu_walk: 'assets/images/npc/zhoushu/walk.png',
                    // 第二章 NPC：陆舟 / 江婆 / 江晚 / 陈栎 / 许录
                    // （陆舟、江婆的键此前已登记；江晚 / 陈栎 / 许录为本章新增）
                    // 规格：陆舟 / 江晚 单帧 32×64；陈栎 232×64（列排列 4 列 × 58×64）；
                    //       许录 192×64（列排列 4 列 × 48×64）；江婆两张单帧 32×64（获救前 / 后）
                    luzhou_idle: 'assets/images/npc/luzhou/idle.png',
                    luzhou_walk: 'assets/images/npc/luzhou/walk.png',
                    jiangpo_idle: 'assets/images/npc/jiangpo/idle.png',
                    jiangpo_idle_after: 'assets/images/npc/jiangpo/idle_after.png',
                    jiangpo_walk: 'assets/images/npc/jiangpo/walk.png',
                    jiangwan_idle: 'assets/images/npc/jiangwan/idle.png',
                    jiangwan_walk: 'assets/images/npc/jiangwan/walk.png',
                    chenli_idle: 'assets/images/npc/chenli/idle.png',
                    chenli_walk: 'assets/images/npc/chenli/walk.png',
                    xulu_idle: 'assets/images/npc/xulu/idle.png',
                    xulu_walk: 'assets/images/npc/xulu/walk.png',
                    wensheng_idle: 'assets/images/npc/wensheng/idle.png',
                    wensheng_walk: 'assets/images/npc/wensheng/walk.png',
                    zhiwei_idle: 'assets/images/npc/zhiwei/idle.png',
                    zhiwei_walk: 'assets/images/npc/zhiwei/walk.png',
                },
                
                // === 怪物动画精灵图 ===
                monsters: {
                    // 普通怪物
                    fenglang_idle: 'assets/images/monsters/fenglang/idle.png',
                    fenglang_attack: 'assets/images/monsters/fenglang/attack.png',
                    fenglang_hurt: 'assets/images/monsters/fenglang/hurt.png',
                    fenglang_dead: 'assets/images/monsters/fenglang/dead.png',
                    
                    // Boss - 摄风山魈（主线四 · 山口石台战场）
                    // 规格：idle/walk/attack/skill1/skill2/hurt 为 4 行（下/左/右/上）× 6 帧、单帧 96×96；
                    //       dead 为单行 6 帧、单帧 96×96。
                    // 逻辑动作与资源键的对应关系（横扫=attack / 扑击=skill1 / 蓄力=skill2）见 js/ShanxiaoBoss.js 顶部说明
                    boss_shanxiao_walk: 'assets/images/monsters/boss_shanxiao/walk.png',
                    boss_shanxiao_idle: 'assets/images/monsters/boss_shanxiao/idle.png',
                    boss_shanxiao_attack: 'assets/images/monsters/boss_shanxiao/attack.png',
                    boss_shanxiao_skill1: 'assets/images/monsters/boss_shanxiao/skill1.png',
                    boss_shanxiao_skill2: 'assets/images/monsters/boss_shanxiao/skill2.png',
                    boss_shanxiao_hurt: 'assets/images/monsters/boss_shanxiao/hurt.png',
                    boss_shanxiao_dead: 'assets/images/monsters/boss_shanxiao/dead.png',
                    
                    // Boss - 渡厄使（第二章万灯台战场，js/DueBoss.js）
                    // 规格：单帧 96×96。idle 为列排列（4 列 = 下/左/右/上，每列 1 帧 → 384×96）；
                    //       summon / dash / control / hurt / move 为 4 行 × 6 帧 → 576×384；
                    //       dead 为单行 6 帧 → 576×96。
                    boss_due_idle: 'assets/images/monsters/boss_due/idle.png',
                    boss_due_move: 'assets/images/monsters/boss_due/move.png',
                    boss_due_dash: 'assets/images/monsters/boss_due/dash.png',
                    boss_due_summon: 'assets/images/monsters/boss_due/summon.png',
                    boss_due_control: 'assets/images/monsters/boss_due/control.png',
                    boss_due_hurt: 'assets/images/monsters/boss_due/hurt.png',
                    boss_due_dead: 'assets/images/monsters/boss_due/dead.png',
                    // 渡厄使召唤的小兵（守台傀儡，js/DueBoss.js 的 DueMinion）
                    // 规格：单帧 96×32（宽扁），4 行（下/左/右/上）；idle 6 帧 / move 8 帧 / attack 7 帧
                    boss_due_minion_idle: 'assets/images/monsters/boss_due/minion_idle.png',
                    boss_due_minion_move: 'assets/images/monsters/boss_due/minion_move.png',
                    boss_due_minion_attack: 'assets/images/monsters/boss_due/minion_attack.png',
                    
                    // Boss - 丹霞真人
                    boss_danxia_walk: 'assets/images/monsters/boss_danxia/walk.png',
                    boss_danxia_idle: 'assets/images/monsters/boss_danxia/idle.png',
                    boss_danxia_attack: 'assets/images/monsters/boss_danxia/attack.png',
                    boss_danxia_skill1: 'assets/images/monsters/boss_danxia/skill1.png',
                    boss_danxia_skill2: 'assets/images/monsters/boss_danxia/skill2.png',
                    boss_danxia_hurt: 'assets/images/monsters/boss_danxia/hurt.png',
                    boss_danxia_dead: 'assets/images/monsters/boss_danxia/dead.png',
                    
                    // Boss - 无相真君
                    boss_wuxiang_walk: 'assets/images/monsters/boss_wuxiang/walk.png',
                    boss_wuxiang_idle: 'assets/images/monsters/boss_wuxiang/idle.png',
                    boss_wuxiang_attack: 'assets/images/monsters/boss_wuxiang/attack.png',
                    boss_wuxiang_skill1: 'assets/images/monsters/boss_wuxiang/skill1.png',
                    boss_wuxiang_skill2: 'assets/images/monsters/boss_wuxiang/skill2.png',
                    boss_wuxiang_hurt: 'assets/images/monsters/boss_wuxiang/hurt.png',
                    boss_wuxiang_dead: 'assets/images/monsters/boss_wuxiang/dead.png',
                    
                    // Boss - 太玄道君
                    boss_taixuan_walk: 'assets/images/monsters/boss_taixuan/walk.png',
                    boss_taixuan_idle: 'assets/images/monsters/boss_taixuan/idle.png',
                    boss_taixuan_attack: 'assets/images/monsters/boss_taixuan/attack.png',
                    boss_taixuan_skill1: 'assets/images/monsters/boss_taixuan/skill1.png',
                    boss_taixuan_skill2: 'assets/images/monsters/boss_taixuan/skill2.png',
                    boss_taixuan_skill3: 'assets/images/monsters/boss_taixuan/skill3.png',
                    boss_taixuan_hurt: 'assets/images/monsters/boss_taixuan/hurt.png',
                    boss_taixuan_dead: 'assets/images/monsters/boss_taixuan/dead.png',
                },
                
                // === 任务物品图标 ===
                questItems: {
                    guixiang_pai: 'assets/images/quest_items/guixiang_pai.png',
                    hundeng: 'assets/images/quest_items/hundeng.png',
                    yisha: 'assets/images/quest_items/yisha.png',
                    mingce: 'assets/images/quest_items/mingce.png',
                    zhenhe: 'assets/images/quest_items/zhenhe.png',
                    zhenfeng_heipian: 'assets/images/quest_items/zhenfeng_heipian.png',
                    lingcao: 'assets/images/quest_items/lingcao.png',
                    // === 第二章剧情 / 任务物品 ===
                    dengji_zhaie: 'assets/images/quest_items/dengji_zhaie.png',
                    jiangwan_jiashu: 'assets/images/quest_items/jiangwan_jiashu.png',
                    hundeng_jiangwan: 'assets/images/quest_items/hundeng_jiangwan.png',
                    hundeng_chenli: 'assets/images/quest_items/hundeng_chenli.png',
                    tongxing_pingzheng: 'assets/images/quest_items/tongxing_pingzheng.png',
                    zhuanyun_zhangce: 'assets/images/quest_items/zhuanyun_zhangce.png',
                    taixuan_mingling: 'assets/images/quest_items/taixuan_mingling.png',
                },
                
                // === 技能特效 ===
                skills: {
                    // 基础技能
                    lingxi_dan: 'assets/images/skills/basic/lingxi_dan.png',
                    huti_shu: 'assets/images/skills/basic/huti_shu.png',
                    huixi_shu: 'assets/images/skills/basic/huixi_shu.png',
                    // 剑修技能
                    jian_tangfeng: 'assets/images/skills/jianxiu/tangfeng.png',
                    jian_guiyi: 'assets/images/skills/jianxiu/guiyi.png',
                    jian_jianying: 'assets/images/skills/jianxiu/jianying.png',
                    jian_wanjian: 'assets/images/skills/jianxiu/wanjian.png',
                    // 法修技能
                    fa_yanling: 'assets/images/skills/faxiu/yanling.png',
                    fa_hanchao: 'assets/images/skills/faxiu/hanchao.png',
                    fa_tianlei: 'assets/images/skills/faxiu/tianlei.png',
                    fa_sanxiang: 'assets/images/skills/faxiu/sanxiang.png',
                    // 体修技能
                    ti_bengshan: 'assets/images/skills/tixiu/bengshan.png',
                    ti_jingang: 'assets/images/skills/tixiu/jingang.png',
                    ti_zhenyue: 'assets/images/skills/tixiu/zhenyue.png',
                    ti_faxiang: 'assets/images/skills/tixiu/faxiang.png',
                    // 符修技能
                    fu_zhuihun: 'assets/images/skills/fuxiu/zhuihun.png',
                    fu_fuling: 'assets/images/skills/fuxiu/fuling.png',
                    fu_baofu: 'assets/images/skills/fuxiu/baofu.png',
                    fu_qianfu: 'assets/images/skills/fuxiu/qianfu.png',
                },
                
                // === 物品图标 ===
                items: {
                    // 丹药
                    dan_wangchen: 'assets/images/items/dan_wangchen.png',
                    dan_huiyuan: 'assets/images/items/dan_huiyuan.png',
                    dan_huiling: 'assets/images/items/dan_huiling.png',
                    // 材料
                    material_lingcao: 'assets/images/items/material_lingcao.png',
                    material_ninglu: 'assets/images/items/material_ninglu.png',
                    // 剧情物品
                    item_guixiangpai: 'assets/images/items/item_guixiangpai.png',
                    item_hundeng: 'assets/images/items/item_hundeng.png',
                    item_yisha: 'assets/images/items/item_yisha.png',
                    item_zhenfengzhuang: 'assets/images/items/item_zhenfengzhuang.png',
                    item_hunlu: 'assets/images/items/item_hunlu.png',
                    item_zhenqi: 'assets/images/items/item_zhenqi.png',

                },
                
                // === 路标图标（地图交互点；靠近后显示“按 E 键…”提示） ===
                // 绘制规则：以路标世界坐标为中心、按 Chapter1Config 里的 imageWidth/imageHeight 绘制
                //          （两处路标的显示尺寸都是 60×60）；美术原图建议同尺寸或更高（会缩放）。
                // 缺图 / 加载失败（ResourceManager 返回 32×32 占位图）时，Signpost 回退到程序化木牌渲染。
                signposts: {
                    herb_collect: 'assets/images/signposts/herb_collect.png',
                    depart_boat: 'assets/images/signposts/depart_boat.png',
                    // === 第二章路标 ===
                    // 认灯台（认灯归魂入口）/ 旧水道（逆流行舟入口）；缺图时回退程序化木牌
                    lantern_identify: 'assets/images/signposts/lantern_identify.png',
                    river_escort: 'assets/images/signposts/river_escort.png',
                },

                // === 传送法阵（主线四：山口石台，静态图 96×96） ===
                teleportArrays: {
                    boss_enter: 'assets/images/teleport_arrays/boss_enter.png',
                    // 第二章：万灯台石台（同上规格 96×96）
                    wandengtai: 'assets/images/teleport_arrays/wandengtai.png',
                },

                // === 镇风桩（青岚浮野调查点，58×128，每根桩图片不同） ===
                windPiles: {
                    zhenfeng_pile_1: 'assets/images/wind_piles/zhenfeng_pile_1.png',
                    zhenfeng_pile_2: 'assets/images/wind_piles/zhenfeng_pile_2.png',
                    zhenfeng_pile_3: 'assets/images/wind_piles/zhenfeng_pile_3.png',
                    // === 第二章调查点 ===
                    // 引渡司核验栏（读线索）/ 台后石案（账册 / 命令）；缺图时回退程序化石桩
                    verify_rack: 'assets/images/wind_piles/verify_rack.png',
                    zhangce_stand: 'assets/images/wind_piles/zhangce_stand.png',
                    mingling_stand: 'assets/images/wind_piles/mingling_stand.png',
                },
                // === 破损运灯箱（青岚浮野调查点，原图 64×58） ===
                lanternBoxes: {
                    broken_lantern_box: 'assets/images/lantern_box/broken_lantern_box.png',
                },
                // === 飘落物（落叶 / 落花；环境特效，见 js/FallingFoliage.js）===
                // 规格：1 行 12 帧，单帧 16×16（整图 192×16），循环播放。
                // 只在前两章主图（GameMap 的 FallingFoliage.isFoliageMap 白名单：qinglan_fuye / yunduze）
                // 与开始界面 / 游戏完结界面显示；小游戏、Boss 战场、世界地图都不显示。
                // 缺图 / 尺寸不符（含 ResourceManager 的 32×32 品红占位图）→ 程序化叶片 / 花瓣兜底。
                // 生成 / 覆盖占位图：py -3 tools/generate_foliage_assets.py（--force 覆盖，--check 只校验）
                foliage: {
                    falling_leaf: 'assets/images/foliage/falling_leaf.png',
                    falling_flower: 'assets/images/foliage/falling_flower.png',
                },
                // === 战斗特效（Boss 技能表现：叠加在 Boss 之上绘制） ===
                effects: {
                    // 扑击落地扬尘：1 行 6 帧，单帧 48×48
                    boss_pounce_dust: 'assets/images/effects/boss_pounce_dust.png',
                    // 蓄力风旋：1 行 4 帧，单帧 48×48
                    boss_charge_wind: 'assets/images/effects/boss_charge_wind.png',
                    // 渡厄使「控制」命中的锁链（玩家头顶，32×32 单帧；缺图时 PlayerCombat 程序化绘制锁链）
                    boss_due_chain: 'assets/images/effects/boss_due_chain.png',
                    // === 主角战斗特效（PlayerCombatSystem；缺图时自动程序化绘制） ===
                    // 剑气：1 行 4 帧，单帧 128×108
                    player_sword_aura: 'assets/images/effects/player_sword_aura.png',
                    // 灵息弹弹体：4 行（右/左/下/上）× 4 帧，单帧 32×32
                    player_lingxidan: 'assets/images/effects/player_lingxidan.png',
                    // 灵息弹命中：1 行 6 帧，单帧 48×48
                    player_lingxidan_hit: 'assets/images/effects/player_lingxidan_hit.png',
                    // 剑气：4 行（右/左/下/上）× 6 帧，单帧 96×96，循环播放
                    player_jianying: 'assets/images/effects/player_jianying.png',
                    // 剑影连斩命中：以命中点为圆心的透明渐变扩大圆，1 行 6 帧，单帧 96×96
                    player_jianying_hit: 'assets/images/effects/player_jianying_hit.png',
                    // 护体术气场：1 行 4 帧，单帧 48×64（角色之下、地图之上）
                    player_hutishu_aura: 'assets/images/effects/player_hutishu_aura.png',
                    // 闪避气场：1 行 4 帧，单帧 48×64（角色之下、地图之上）
                    player_dodge_aura: 'assets/images/effects/player_dodge_aura.png',
                    // 筑基调息气场（章末：与祁伯对话“开始筑基调息”时在主角背后播放 5 秒）
                    // 1 行 8 帧，单帧 48×128（角色之下、地图之上）；缺图时自动程序化绘制
                    player_zhuji_aura: 'assets/images/effects/player_zhuji_aura.png',
                },
                // === 小游戏相关 ===
                miniGame: {
                    // 乘风采药
                    caoyao_bg: 'assets/images/minigame/caoyao/bg.png',
                    caoyao_collision: 'assets/images/minigame/caoyao/collision.png',
                    caoyao_wind: 'assets/images/minigame/caoyao/wind.png',
                    caoyao_herb: 'assets/images/minigame/caoyao/herb.png',
                    // 定息引气
                    yinqi_bg: 'assets/images/minigame/yinqi/bg.png',
                    yinqi_circle: 'assets/images/minigame/yinqi/circle.png',
                    yinqi_dot: 'assets/images/minigame/yinqi/dot.png',
                    // 逆流送灯（横版行舟：小船横置朝右、只上下闪避，障碍自右向左；见 js/BoatNavigationMiniGame.js）
                    xingzhou_bg: 'assets/images/minigame/xingzhou/bg.png',                    // 河道背景 1280×720
                    xingzhou_boat: 'assets/images/minigame/xingzhou/boat.png',                // 小船朝右动画：单行 4 帧，单帧 128×104（整图 512×104）
                    xingzhou_rock: 'assets/images/minigame/xingzhou/rock.png',                // 礁石：单帧 96×96
                    xingzhou_wood: 'assets/images/minigame/xingzhou/wood.png',                // 浮木：单帧 96×96
                    xingzhou_collision: 'assets/images/minigame/xingzhou/collision.png',      // 河道碰撞图 1280×720（白 = 可通行；取上下活动范围）
                    // 认灯归魂（魂灯：暗 / 亮两张图，各 48×64；缺图 → 程序化魂灯）
                    rendeng_bg: 'assets/images/minigame/rendeng/bg.png',
                    rendeng_deng_off: 'assets/images/minigame/rendeng/deng_off.png',
                    rendeng_deng_on: 'assets/images/minigame/rendeng/deng_on.png',
                    rendeng_collision: 'assets/images/minigame/rendeng/collision.png',        // 认灯台碰撞图 1280×720（白 = 可走 / 黑 = 阻挡，40px 瓦片）
                    // 忆片归序
                    yipian_bg: 'assets/images/minigame/yipian/bg.png',
                    yipian_card: 'assets/images/minigame/yipian/card.png',
                    // 控火炼丹
                    konghuo_bg: 'assets/images/minigame/konghuo/bg.png',
                    konghuo_fire: 'assets/images/minigame/konghuo/fire.png',
                    konghuo_danlu: 'assets/images/minigame/konghuo/danlu.png',
                    // 元婴双身解阵
                    yuanying_bg: 'assets/images/minigame/yuanying/bg.png',
                    yuanying_body: 'assets/images/minigame/yuanying/body.png',
                    yuanying_soul: 'assets/images/minigame/yuanying/soul.png',
                },
            },
            
            audio: {
                // ============================================================
                // 音频资源（背景音乐 = 循环播放；音效 = 单次播放）
                // 播放统一由 js/AudioManager.js 负责；文件缺失 / 名称不符时静默跳过，
                // 不会导致游戏报错（把音频文件按下面路径放进去即可生效）。
                // 完整地址清单（键 / 路径 / 循环与否 / 触发时机）见 tools/音频资源清单.txt
                // ============================================================

                // === 背景音乐（循环播放）===
                bgm: {
                    main_menu: 'assets/audio/bgm/main_menu.mp3',           // 开始游戏界面（加载完即播，点开始即停）
                    qinglan: 'assets/audio/bgm/qinglan.mp3',               // 第一章主图 青岚浮野（回主图 10 秒后起播）
                    yunduze: 'assets/audio/bgm/yunduze.mp3',               // 第二章主图 云渡泽（同上）
                    minigame_boat: 'assets/audio/bgm/minigame_boat.mp3',   // 逆流送灯小游戏（开局即播 / 结束即停）
                    minigame_herb: 'assets/audio/bgm/minigame_herb.mp3',   // 乘风采药小游戏（只在起风期间循环）
                    ending: 'assets/audio/bgm/ending.mp3',                 // 游戏结束滚动字幕（退出界面才停）
                },

                // === 音效（单次播放）===
                sfx: {
                    // --- 玩家（技能 / 攻击真的发动才播；受伤音效不叠加）---
                    player_attack: 'assets/audio/sfx/player_attack.mp3',         // J 普通攻击
                    player_lingxidan: 'assets/audio/sfx/player_lingxidan.mp3',   // U 灵息弹（与释放动画同一时刻）
                    player_hutishu: 'assets/audio/sfx/player_hutishu.mp3',       // I 护体术
                    player_dodge: 'assets/audio/sfx/player_dodge.mp3',           // L 闪避
                    player_jianying: 'assets/audio/sfx/player_jianying.mp3',     // O 剑影连斩
                    player_hurt: 'assets/audio/sfx/player_hurt.mp3',             // 玩家受伤（正在播时不重播）
                    pickup: 'assets/audio/sfx/pickup.mp3',                       // 拾取任务道具 / 乘风采药采到草药
                    // --- 摄风山魈（第一章 Boss）---
                    boss_shanxiao_charge: 'assets/audio/sfx/boss_shanxiao_charge.mp3',   // 蓄力（与蓄力动画同步）
                    boss_shanxiao_sweep: 'assets/audio/sfx/boss_shanxiao_sweep.mp3',     // 横扫（与横扫动画同步）
                    boss_shanxiao_pounce: 'assets/audio/sfx/boss_shanxiao_pounce.mp3',   // 扑击（与扑击动画同步）
                    boss_shanxiao_slam: 'assets/audio/sfx/boss_shanxiao_slam.mp3',       // 扑击落地砸地（与扬尘特效同步）
                    boss_shanxiao_hurt: 'assets/audio/sfx/boss_shanxiao_hurt.mp3',       // 受伤（正在播时不重播）
                    boss_shanxiao_defeat: 'assets/audio/sfx/boss_shanxiao_defeat.mp3',   // 战败（与战败动画同步）
                    // --- 渡厄使（第二章 Boss）---
                    boss_due_summon: 'assets/audio/sfx/boss_due_summon.mp3',     // 召唤（与召唤动画同步）
                    boss_due_dash: 'assets/audio/sfx/boss_due_dash.mp3',         // 冲刺（与冲刺动画同步）
                    boss_due_control: 'assets/audio/sfx/boss_due_control.mp3',   // 控制（与控制动画同步）
                    boss_due_hurt: 'assets/audio/sfx/boss_due_hurt.mp3',         // 受伤（正在播时不重播）
                    boss_due_defeat: 'assets/audio/sfx/boss_due_defeat.mp3',     // 战败（与战败动画同步）
                    // --- UI（所有按钮通用）---
                    ui_hover: 'assets/audio/sfx/ui_hover.mp3',               // 鼠标每次放到按钮上
                    ui_click: 'assets/audio/sfx/ui_click.mp3',               // 鼠标点击按钮
                    ui_quest_panel: 'assets/audio/sfx/ui_quest_panel.mp3',   // 任务栏开 / 关（同一个音效）
                    // --- 小游戏（认灯归魂）---
                    minigame_lantern_light: 'assets/audio/sfx/minigame_lantern_light.mp3',            // 每点亮一盏魂灯
                    minigame_lantern_extinguish: 'assets/audio/sfx/minigame_lantern_extinguish.mp3',  // 猜错且还有机会 → 灭灯
                    // --- 胜负 ---
                    victory: 'assets/audio/sfx/victory.mp3',   // 小游戏成功 / 打败 Boss 并走归途法阵回原位置
                    defeat: 'assets/audio/sfx/defeat.mp3',     // 小游戏失败 / 被 Boss 打败
                },
            },
        };

        // ========== 资源分组（按业务场景组织的资源键集合） ==========
        // 说明：每一项都是上面 this.resources 里的“点号路径”，
        //       供 preloadResourceGroup / releaseResourceGroup / getResourceGroupImagePaths 使用，
        //       避免各调用处重复硬编码文件列表（新增资源只需在这里补一行）
        this.resourceGroups = {
            // 游戏开始界面（主菜单）：整屏背景 + 居中开始按钮，启动时预加载
            // （见 js/MainMenuScene.js；缺图时不画兜底图形，补图刷新即生效）
            mainMenu: {
                images: [
                    'ui.start_screen',
                    'ui.start_button',
                ],
                // 开始游戏界面背景音乐（加载完成后立刻循环，点「开始游戏」立刻停）
                audio: [
                    'bgm.main_menu',
                ],
            },
            // 游戏完结界面（章末二登船后的滚动字幕）：整屏背景底图，启动时随主菜单一起预加载
            // （见 js/EndingScene.js；缺图时改回程序化「深墨渐变 + 渡口暖光晕」，不影响播放）
            ending: {
                images: [
                    'ui.ending_bg',
                ],
                // 完结界面背景音乐（滚动字幕期间循环，退出界面才停）
                audio: [
                    'bgm.ending',
                ],
            },
            // 飘落物（落叶 / 落花）：三处界面共用这两张图（开始界面 / 游戏完结界面 /
            // 第一·第二章主图），故随启动一起预加载；缺图时走程序化叶片 / 花瓣兜底
            // （见 js/FallingFoliage.js、js/MainMenuScene.js、js/EndingScene.js、js/GameMap.js）
            foliage: {
                images: [
                    'foliage.falling_leaf',
                    'foliage.falling_flower',
                ],
                audio: [],
            },
            // 主角战斗系统：剑气 / 灵息弹 / 命中 / 剑气（剑影连斩）/ 护体术气场 / 闪避气场 /
            // 气血条 / 灵息条 / 技能栏图标（进入游戏前预加载）
            playerCombat: {
                images: [
                    'player.sanxiu_idle',
                    'player.sanxiu_walk',
                    'player.sanxiu_skill',
                    'player.sanxiu_hurt',
                    'effects.player_sword_aura',
                    'effects.player_lingxidan',
                    'effects.player_lingxidan_hit',
                    'effects.player_jianying',
                    'effects.player_jianying_hit',
                    'effects.player_hutishu_aura',
                    'effects.player_dodge_aura',
                    // HUD 资源条：气血条 / 灵息条（外框 500×64 + 内条 454×64）
                    'ui.health_bar_bg',
                    'ui.health_bar_fill',
                    'ui.mana_bar_bg',
                    'ui.mana_bar_fill',
                    // 左下角技能栏图标：U 灵息弹 / I 护体术 / L 闪避 / O 剑影连斩（规格 100×100）
                    // 普通攻击（J）不占技能栏，故没有对应图标；剑影连斩学会后才补出第 4 格
                    'ui.skill_lingxidan',
                    'ui.skill_hutishu',
                    'ui.skill_dodge',
                    'ui.skill_jianying',
                ],
                // 玩家技能音效（技能 / 攻击真的发动时才播；受伤音效正在播时不重播）
                audio: [
                    'sfx.player_attack',
                    'sfx.player_lingxidan',
                    'sfx.player_hutishu',
                    'sfx.player_dodge',
                    'sfx.player_jianying',
                    'sfx.player_hurt',
                    'sfx.pickup',
                ],
            },
            // 主线四：摄风山魈战场（山口石台）
            // 进入战场前预加载；战斗结束时由 ShanxiaoBoss.destroy() 释放，保证二次进场动画完整
            bossArena: {
                images: [
                    // 摄风山魈 7 套动画（全套一起加载，避免切换动作时首帧空白）
                    'monsters.boss_shanxiao_idle',
                    'monsters.boss_shanxiao_walk',
                    'monsters.boss_shanxiao_attack',
                    'monsters.boss_shanxiao_skill1',
                    'monsters.boss_shanxiao_skill2',
                    'monsters.boss_shanxiao_hurt',
                    'monsters.boss_shanxiao_dead',
                    // 战斗特效：扑击落地扬尘 / 蓄力风旋
                    'effects.boss_pounce_dust',
                    'effects.boss_charge_wind',
                ],
                // 摄风山魈音效（蓄力 / 横扫 / 扑击 / 砸地 / 受伤 / 战败）
                audio: [
                    'sfx.boss_shanxiao_charge',
                    'sfx.boss_shanxiao_sweep',
                    'sfx.boss_shanxiao_pounce',
                    'sfx.boss_shanxiao_slam',
                    'sfx.boss_shanxiao_hurt',
                    'sfx.boss_shanxiao_defeat',
                ],
            },
            // 第二章：万灯台战场（渡厄使 + 其召唤的小兵 + 控制锁链）
            // 进入战场前预加载；战斗结束时由 DueBoss.destroy() 释放，保证二次进场动画完整
            bossArenaCh2: {
                images: [
                    'monsters.boss_due_idle',
                    'monsters.boss_due_move',
                    'monsters.boss_due_dash',
                    'monsters.boss_due_summon',
                    'monsters.boss_due_control',
                    'monsters.boss_due_hurt',
                    'monsters.boss_due_dead',
                    // 召唤出的小兵（3 套动作，随 Boss 一起预加载）
                    'monsters.boss_due_minion_idle',
                    'monsters.boss_due_minion_move',
                    'monsters.boss_due_minion_attack',
                    // 控制技：玩家头顶的锁链图（32×32）
                    'effects.boss_due_chain',
                ],
                // 渡厄使音效（召唤 / 冲刺 / 控制 / 受伤 / 战败）
                audio: [
                    'sfx.boss_due_summon',
                    'sfx.boss_due_dash',
                    'sfx.boss_due_control',
                    'sfx.boss_due_hurt',
                    'sfx.boss_due_defeat',
                ],
            },
        };

        // 图片缓存，用于存储已加载的图片对象
        this.imageCache = new Map();
        // 音频缓存，用于存储已加载的音频对象
        this.audioCache = new Map();
    }

    /**
     * 获取图片资源路径
     * @param {string} path - 使用点号分隔的路径，如 'player.jianxiu_idle'
     * @returns {string} 图片资源路径
     */
    getImagePath(path) {
        const keys = path.split('.');
        let current = this.resources.images;
        for (const key of keys) {
            if (current[key] === undefined) {
                console.error(`图片资源路径不存在: ${path}`);
                return null;
            }
            current = current[key];
        }
        return current;
    }

    /**
     * 获取音频资源路径
     * @param {string} path - 使用点号分隔的路径，如 'bgm.qinglan'
     * @returns {string} 音频资源路径
     */
    getAudioPath(path) {
        const keys = path.split('.');
        let current = this.resources.audio;
        for (const key of keys) {
            if (current[key] === undefined) {
                console.error(`音频资源路径不存在: ${path}`);
                return null;
            }
            current = current[key];
        }
        return current;
    }

    /**
     * 加载图片资源
     * @param {string} path - 资源路径（点号分隔）
     * @returns {Promise<Image>} 加载完成的图片对象
     */
    loadImage(path) {
        const imagePath = this.getImagePath(path);
        if (!imagePath) {
            console.warn(`图片资源路径不存在: ${path}`);
            // 返回一个空的占位图，而不是 reject
            return Promise.resolve(this.createPlaceholderImage());
        }
        
        if (this.imageCache.has(imagePath)) {
            return Promise.resolve(this.imageCache.get(imagePath));
        }
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(imagePath, img);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`图片加载失败: ${imagePath}，使用占位图`);
                // 失败时返回占位图，不 reject
                const placeholder = this.createPlaceholderImage();
                this.imageCache.set(imagePath, placeholder);
                resolve(placeholder);
            };
            img.src = imagePath;
        });
    }

    /**
     * 创建占位图片（当资源加载失败时使用）
     */
    createPlaceholderImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        // 画一个品红色的方块作为占位
        ctx.fillStyle = '#FF00FF';
        ctx.fillRect(0, 0, 32, 32);
        
        // 画一个叉
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, 4);
        ctx.lineTo(28, 28);
        ctx.moveTo(28, 4);
        ctx.lineTo(4, 28);
        ctx.stroke();
        
        const img = new Image();
        img.src = canvas.toDataURL();
        return img;
    }

    /**
     * 批量加载图片资源
     * @param {string[]} paths - 资源路径数组
     * @returns {Promise<Map>} 加载完成的图片对象Map
     */
    async loadImages(paths) {
        const results = new Map();
        const promises = paths.map(async (path) => {
            const img = await this.loadImage(path);
            results.set(path, img);
        });
        await Promise.all(promises);
        return results;
    }

    /**
     * 获取已缓存的图片对象
     * @param {string} path - 资源路径（点号分隔）
     * @returns {Image|null} 图片对象或null
     */
    getCachedImage(path) {
        const imagePath = this.getImagePath(path);
        if (!imagePath) return null;
        return this.imageCache.get(imagePath) || null;
    }

    /**
     * 加载音频资源
     * @param {string} path - 资源路径（点号分隔）
     * @returns {Promise<Audio>} 加载完成的音频对象
     */
    loadAudio(path) {
        const audioPath = this.getAudioPath(path);
        if (!audioPath) {
            console.warn(`音频资源路径不存在: ${path}`);
            return Promise.resolve(new Audio()); // 返回空音频
        }
        
        if (this.audioCache.has(audioPath)) {
            return Promise.resolve(this.audioCache.get(audioPath));
        }
        
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => {
                this.audioCache.set(audioPath, audio);
                resolve(audio);
            };
            audio.onerror = () => {
                console.warn(`音频加载失败: ${audioPath}，使用空音频`);
                this.audioCache.set(audioPath, audio);
                resolve(audio); // 失败也返回，不 reject
            };
            audio.src = audioPath;
        });
    }

    /**
     * 预加载某一类资源（如某个地图的所有资源）
     * @param {Object} resourceGroup - 资源组配置
     */
    async preloadResources(resourceGroup) {
        const loadPromises = [];
        
        if (resourceGroup.images) {
            resourceGroup.images.forEach(path => {
                loadPromises.push(this.loadImage(path));
            });
        }
        
        if (resourceGroup.audio) {
            resourceGroup.audio.forEach(path => {
                loadPromises.push(this.loadAudio(path));
            });
        }
        
        await Promise.all(loadPromises);
    }

    /**
     * 释放单张图片缓存
     * 用于战斗结束后清理 Boss 等一次性资源（下次使用时 loadImage 会重新读取）
     * @param {string} path - 资源路径（点号分隔）
     * @returns {boolean} 是否释放了缓存
     */
    releaseImage(path) {
        const imagePath = this.getImagePath(path);
        if (!imagePath) return false;
        return this.imageCache.delete(imagePath);
    }

    /**
     * 批量释放图片缓存
     * @param {string[]} paths - 资源路径数组
     * @returns {number} 实际释放的数量
     */
    releaseImages(paths) {
        if (!Array.isArray(paths)) return 0;
        let released = 0;
        paths.forEach(path => {
            if (this.releaseImage(path)) {
                released++;
            }
        });
        return released;
    }

    /**
     * 获取资源分组（点号键列表）
     * @param {string} name - 分组名，如 'bossArena'
     * @returns {{images: string[], audio: string[]}} 分组副本（避免调用方误改配置）
     */
    getResourceGroup(name) {
        const group = this.resourceGroups ? this.resourceGroups[name] : null;
        if (!group) {
            console.warn(`资源分组不存在: ${name}`);
            return { images: [], audio: [] };
        }
        return {
            images: (group.images || []).slice(),
            audio: (group.audio || []).slice(),
        };
    }

    /**
     * 获取资源分组内图片的真实文件路径（便于排查资源缺失）
     * @param {string} name - 分组名，如 'bossArena'
     * @returns {string[]} 绝对/相对路径数组
     */
    getResourceGroupImagePaths(name) {
        return this.getResourceGroup(name).images
            .map(key => this.getImagePath(key))
            .filter(path => !!path);
    }

    /**
     * 预加载整个资源分组（图片 + 音频）
     * @param {string} name - 分组名，如 'bossArena'
     * @returns {Promise<number>} 本次加载的资源数量
     */
    async preloadResourceGroup(name) {
        const group = this.getResourceGroup(name);
        const tasks = group.images.map(key => this.loadImage(key))
            .concat(group.audio.map(key => this.loadAudio(key)));

        await Promise.all(tasks);
        return tasks.length;
    }

    /**
     * 释放资源分组内的图片缓存（音频缓存不回收）
     * 用于 Boss 战结束后清理一次性资源，下次使用时会重新读取文件
     * @param {string} name - 分组名，如 'bossArena'
     * @returns {number} 实际释放的图片数量
     */
    releaseResourceGroup(name) {
        return this.releaseImages(this.getResourceGroup(name).images);
    }
}
