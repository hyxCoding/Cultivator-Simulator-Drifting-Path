/**
 * 玩家战斗系统（PlayerCombatSystem）
 * ------------------------------------------------------------------
 * 负责主角在“大地图（gameWorld）”内的实时战斗行为：
 *   J 普通攻击 / U 灵息弹 / I 护体术 / L 闪避 / O 剑影连斩
 *
 * 规则要点（均按需求实现）：
 * 1) 只有"基础操作教学"开始后才捕获战斗按键；教学开始前这几个键完全没有响应。
 *    —— 教学进行中：必须站在对应的教学圈（训练地面标记）范围内、按提示按下对应按键，
 *       技能/攻击才会施展（不在圈内按对应键没有任何响应，只给出提示），
 *       并且每完成一步，左下角技能栏里对应的那一格（含冷却遮罩）才解锁
 *       （普通攻击 J 不占格子：教学步骤照旧，但学会后左下角不显示）；
 *       四步全部完成（或读档时该任务目标已完成）后永久解锁，任何位置都能施展。
 *    —— 教学开始前：HUD 只显示气血条/灵息条，技能栏整条隐藏。
 * 2) 所有行为都消耗灵息（法力），按键按下的瞬间立刻校验灵息是否足够。
 * 3) 普通攻击：0.5 秒冷却、无角色攻击动画，生成包围主角的剑气（4 帧非循环），
 *    剑气范围内敌人受伤；受伤时攻击不被打断（伤害在按下瞬间结算）。
 *    普攻不进左下角技能栏，冷却中也不弹屏幕中下方提示（silentCooldown：只静默失败）。
 * 4) 灵息弹：3 秒冷却、播放施法动画（4 行 下/左/右/上，每行 4 帧），动画播完后
 *    在朝向前方生成灵息弹；超过最大飞行距离自行消失；命中敌人扣血并在原地生成命中特效；
 *    施法中受伤 → 终止施法、冷却清零、返还灵息。
 * 5) 护体术：30 秒冷却、10 秒减伤（减伤期间受伤不播放受伤动画），气场特效在角色之下。
 * 6) 闪避：60 秒冷却、朝当前方向瞬移一段距离（不穿墙）、10 秒内移速 +25%，
 *    气场特效在角色之下；护体术与闪避互斥，不能同时存在。
 * 7) 剑影连斩（O，第二章主线一《渡口无归客》剑修基础连招试炼传授）：15 秒冷却、消耗较多灵息、
 *    无技能动画（按下瞬间出手，因此受伤也不会被打断）；在角色的上/下/左/右四个方向各生成一道剑气，
 *    剑气朝各自方向直线飞行、超过最大飞行距离自行消失；剑气只对敌人造成伤害，
 *    命中敌人后立刻消失，并在命中点生成"透明渐变扩大的圆"命中特效。
 *    该技能只有"已习得"才占左下角技能栏第 4 格（见 isSkillLearned / CONFIG.jianying.learnedGate）。
 * 8) 受伤动画播放期间禁止一切玩家输入（由 hurtLock 控制，Player 同步停止移动）。
 * 9) 气血条 / 灵息条用自定义图片绘制（外框图 + 内条图，条上不显示数字，只看长度）：
 *    两图左上角对齐、先画内条再画外框；内条只绘制"X∈[0,78) 的左侧固定装饰 + X∈[78,454) 中
 *    按当前值比例的部分"（当前血量 h、上限 H 时 = 源图 X = 0 → 78 + h/H × 376）。
 *    图片规格与路径见 CONFIG.hud；图片缺失或尺寸不符时该条不绘制（不再用代码画条）。
 *
 * 10) 左下角技能栏（灵息弹 / 护体术 / 闪避，以及习得后的剑影连斩）用各自的 100×100 图片绘制，
 *    格子上不写任何文字
 *    （按键字母 / 技能名 / 冷却倒计时全部由美术图承担，见 CONFIG.hud.skillBar 的三个 show* 开关）；
 *    技能冷却中只从格子顶部按下冷却遮罩；图片缺失 / 尺寸不符时该格回退程序化方框（同样不写字）。
 *    普通攻击（J）不占格子；剑影连斩（O）习得后才补出第 4 格。
 *    规格与路径见 CONFIG.hud.skillBar 与各技能的 hudIcon。
 *
 * 美术资源：战斗特效见 js/CombatEffect.js 顶部说明（资源缺失时自动使用程序化占位特效）；
 *          气血条 / 灵息条 / 左下角技能栏图标见 CONFIG.hud（assets/images/ui/ 下的图片）。
 */
class PlayerCombatSystem {
    /**
     * 战斗数值与美术规格（唯一数据源，改这里即可调平衡）
     * @returns {Object}
     */
    static get CONFIG() {
        return {
            // J 普通攻击
            // 说明：普攻不占左下角技能栏（见 hud.skillBar.order），
            //       冷却中也不再弹屏幕中下方提示（silentCooldown = 只静默失败，不改数值）。
            attack: {
                id: 'attack', name: '普通攻击', key: 'j',
                manaCost: 2, cooldown: 0.5,
                silentCooldown: true,
                auraRadius: 60,
                auraKey: 'effects.player_sword_aura',
                auraFrameWidth: 128, auraFrameHeight: 108, auraFrames: 4, auraFps: 12,
                auraColor: '#bfe9ff',
                trainingAction: 'attack',
            },
            // U 灵息弹
            // 左下角技能栏图标（规格 100×100）：assets/images/ui/skill_lingxidan.png
            lingxidan: {
                id: 'lingxidan', name: '灵息弹', key: 'u',
                hudIcon: 'ui.skill_lingxidan',
                manaCost: 10, cooldown: 3,
                castAnimation: 'skill_lingxidan', castFrames: 4, castFps: 10,
                // 出生点偏移（按朝向，相对玩家逻辑坐标 = 角色碰撞盒中心）
                // 说明：Player.render 的绘制盒为 48×64，而 32×32 单帧内角色内容包围盒约
                //       x[8,25] / y[1,30]，故"贴图可见中心" ≈ 逻辑坐标 + (13, 15)；
                //       下表已含该补偿，并沿朝向前移 22px（即旧的 spawnOffset 距离）。
                //       想让灵息弹从角色手心 / 胸口飞出，直接改这四个分量即可。
                spawnOffset: 22,
                spawnOffsets: {
                    down:  { x: 13, y: 37 },   // (13, 15) + 22
                    up:    { x: 13, y: -7 },   // (13, 15) - 22
                    left:  { x: -9, y: 15 },   // (13, 15) - (22, 0)
                    right: { x: 35, y: 15 },   // (13, 15) + (22, 0)
                },
                projectileSpeed: 320, maxDistance: 300, damage: 15, hitRadius: 14,
                projectileKey: 'effects.player_lingxidan',
                projectileFrames: 4, projectileFrameWidth: 32, projectileFrameHeight: 32, projectileFps: 14,
                projectileRows: { right: 0, left: 1, down: 2, up: 3 },
                projectileColor: '#7fd8ff',
                hitKey: 'effects.player_lingxidan_hit',
                hitFrames: 6, hitFrameWidth: 48, hitFrameHeight: 48, hitFps: 14,
                hitColor: '#9fe6ff',
                trainingAction: 'skill_lingxidan',
            },
            // I 护体术
            // 左下角技能栏图标（规格 100×100）：assets/images/ui/skill_hutishu.png
            hutishu: {
                id: 'hutishu', name: '护体术', key: 'i',
                hudIcon: 'ui.skill_hutishu',
                manaCost: 15, cooldown: 30,
                duration: 10, damageReduction: 0.3,
                auraKey: 'effects.player_hutishu_aura',
                auraFrames: 4, auraFrameWidth: 72, auraFrameHeight: 96, auraFps: 6,
                auraColor: '#7ef0a8',
                trainingAction: 'skill_hutishu',
            },
            // L 闪避
            // 左下角技能栏图标（规格 100×100）：assets/images/ui/skill_dodge.png
            dodge: {
                id: 'dodge', name: '闪避', key: 'l',
                hudIcon: 'ui.skill_dodge',
                manaCost: 12, cooldown: 60,
                duration: 10, speedBonus: 0.25, distance: 140,
                auraKey: 'effects.player_dodge_aura',
                auraFrames: 4, auraFrameWidth: 72, auraFrameHeight: 96, auraFps: 8,
                auraColor: '#c8a6ff',
                trainingAction: 'dodge',
            },
            // O 剑影连斩（第二章主线一《渡口无归客》「剑修基础连招试炼」传授，学会后才占技能栏）
            // 需求：冷却 15 秒 / 消耗较多法力 / 无技能动画（按下瞬间出手）/ 受伤不打断；
            //       在角色的上、下、左、右四个方向各生成一道剑气，剑气朝各自方向直线飞行，
            //       超过最大移动距离自行消失；剑气只对敌人造成伤害，命中敌人后立刻消失并生成命中特效。
            // 剑气动画规格：4 行（右/左/下/上）× 6 帧，单帧 96×96，循环播放。
            // 左下角技能栏图标（规格 100×100）：assets/images/ui/skill_jianying.png
            jianying: {
                id: 'jianying', name: '剑影连斩', key: 'o',
                hudIcon: 'ui.skill_jianying',
                manaCost: 30, cooldown: 15,
                // 只有「已习得」才占技能栏（不吃基础操作教学的逐格解锁）：
                //   学会时机 = 第二章主线一「剑修连招试炼」教学圈完成（Main.learnProfessionSkill('jianying')）；
                //   读档兜底见 isSkillLearned()（技能等级 / 任务目标任一满足即可）。
                learnedGate: true,
                learnedFrom: { questId: 'chapter2_main_1', type: 'complete_training', target: 'sword' },
                // 无技能动画：不写 casting，因此受伤也不会打断（与普攻同一条"按下瞬间结算"路径）
                castAnimation: null,
                // 出生点偏移（按方向，相对玩家逻辑坐标 = 角色碰撞盒中心；(13,15) 为贴图可见中心，
                // 再沿该方向前移 60px，避免剑气压在角色身上；改这四组分量即可微调出手位置）
                spawnOffsets: {
                    up:    { x: 13, y: -45 },   // (13, 15) - 60
                    down:  { x: 13, y: 75 },    // (13, 15) + 60
                    left:  { x: -47, y: 15 },   // (13, 15) - (60, 0)
                    right: { x: 73, y: 15 },    // (13, 15) + (60, 0)
                },
                projectileSpeed: 360, maxDistance: 240, damage: 30, hitRadius: 40,
                projectileKey: 'effects.player_jianying',
                projectileFrames: 6, projectileFrameWidth: 96, projectileFrameHeight: 96, projectileFps: 12,
                projectileRows: { right: 0, left: 1, down: 2, up: 3 },
                projectileColor: '#cfe9ff',
                projectileShape: 'sword_qi',
                // 命中特效：以命中点为圆心的"透明 / 渐变 / 扩大"的圆
                hitKey: 'effects.player_jianying_hit',
                hitFrames: 6, hitFrameWidth: 96, hitFrameHeight: 96, hitFps: 14,
                hitColor: '#bfe9ff',
                hitShape: 'ring_expand',
                trainingAction: 'skill_jianying',   // 教学圈动作类型（与 Chapter2Config.getSwordTrainingLayout() 一致）
                                                    // 未习得时 O 仅在第二章试炼的教学圈内可施展 → 圈内按 O 即完成教学圈 → 学会该技能
            },
            // 筑基调息气场（章末剧情，非战斗技能）
            // 由 Main.startFoundationTrial 调用 playFoundationAura()：主角朝下静立 5 秒，
            // 气场绘制在角色之下（layer 'under'），循环播放到 duration 结束。
            // 美术规格：1 行 8 帧，单帧 48×128。改 offsetX / offsetY 即可微调气场与角色的相对位置。
            foundationAura: {
                id: 'foundation_aura', name: '筑基调息气场',
                key: 'effects.player_zhuji_aura',
                frames: 8, frameWidth: 48, frameHeight: 128, fps: 6,
                duration: 5,                 // 播放时长（秒）
                offsetX: 16, offsetY: 10,    // 相对玩家逻辑坐标：气场底部落在角色脚下（Player 绘制盒 48×64，脚下 ≈ position.y + 16）
                color: '#a8dcff',
            },
            // 受伤僵直（受伤动画期间禁止一切玩家输入）
            hurt: {
                lockDuration: 0.5,
                spriteKey: 'player.sanxiu_hurt',
            },
            // ========== 气血条 / 灵息条（自定义图片，条上不显示数字） ==========
            // 美术规格（气血条与灵息条格式完全一致，把文件放到下列路径即自动生效）：
            //   气血条 外框 assets/images/ui/health_bar_bg.png    500×64
            //   气血条 内条 assets/images/ui/health_bar_fill.png  454×64
            //   灵息条 外框 assets/images/ui/mana_bar_bg.png      500×64
            //   灵息条 内条 assets/images/ui/mana_bar_fill.png    454×64
            // 绘制规则：
            //   1) 外框与内条左上角对齐（同一个 x/y）；先画内条，再把外框盖在其上；
            //   2) 内条只有 X∈[fillStartX, fillWidth) 是"真正能看见的血量/灵息"像素；
            //      本套美术里即 X∈[78, 454)：图片从 X = 78 起直到右边界都是真实血量，
            //      X∈[0, 78) 是左侧固定装饰（始终绘制，与数值无关）；
            //      当前值 v、上限 V 时，内条只取源图 X = 0 → fillStartX + v/V × (fillWidth - fillStartX)，
            //      即 X = 0 → 78 + v/V × (454 - 78)：满血 454（整张）、半血 266、空血 78；
            //   3) 条上不绘制任何数字，玩家只通过长度判断剩余量；
            //      图片缺失 / 尺寸不符（含加载失败的 32×32 占位图）时该条不绘制。
            hud: {
                // 气血条：外框 + 内条
                healthBar: { frameKey: 'ui.health_bar_bg', fillKey: 'ui.health_bar_fill' },
                // 灵息条（魔法条）：逻辑与气血条完全一致
                manaBar: { frameKey: 'ui.mana_bar_bg', fillKey: 'ui.mana_bar_fill' },
                frameWidth: 500, frameHeight: 64,   // 外框规格（也是内条的对齐基准）
                fillWidth: 454, fillHeight: 64,     // 内条规格
                fillStartX: 78,                     // 内条左侧固定装饰宽度（像素）：X∈[0,78) 不是血量像素
                origin: { x: 18, y: 18 },           // 气血条左上角（屏幕坐标）
                lineGap: 12,                        // 气血条与灵息条之间的垂直间距
                scale: 1,                           // 整体缩放（1 = 图片原尺寸，改这一个值即可整体放大 / 缩小两条）
                // ===== 左下角技能栏（灵息弹 / 护体术 / 闪避；格子上不写任何文字） =====
                // 美术规格（每格一张 100×100 PNG，按下列文件名放进 assets/images/ui/ 即自动生效）：
                //   灵息弹 assets/images/ui/skill_lingxidan.png
                //   护体术 assets/images/ui/skill_hutishu.png
                //   闪避   assets/images/ui/skill_dodge.png
                // 绘制规则：
                //   1) order 决定格子顺序，且不含普通攻击 —— 普攻只走教学，左下角不显示（J 格已删除）；
                //   2) 每格只按 iconSize（100）绘制对应图片，不叠加任何文字（按键字母 / 技能名 / 倒计时
                //      全部由美术图承担 —— 下面 showKey / showCooldownText / showName 三个开关默认全关）；
                //   3) 冷却中：只从格子顶部按下冷却遮罩（比例 = 剩余 / 总冷却），不写剩余秒数；
                //   4) 图片缺失 / 尺寸不符（含 32×32 品红占位图）时该格回退程序化方框（同样不写文字）；
                //   5) 该格对应的技能尚未解锁（教学未完成该步）时不绘制；一格都没有时整条技能栏隐藏。
                skillBar: {
                    order: ['lingxidan', 'hutishu', 'dodge', 'jianying'],   // 参与技能栏的技能（普攻 J 不在其中；
                                                                            // 剑影连斩习得后才出现，见 CONFIG.jianying.learnedGate）
                    iconSize: 100,      // 图标规格 = 默认绘制尺寸（100×100）
                    scale: 1,           // 整体缩放（1 = 100×100 原尺寸）
                    gap: 12,            // 格子间距
                    startX: 18,         // 第一个格子左边缘（与气血条左对齐）
                    bottomMargin: 30,   // 整条技能栏距画布底部的距离
                    showKey: false,     // 就绪时格子中央的按键字母（U / I / L）—— 默认不画
                    showCooldownText: false, // 冷却中格子中央的剩余秒数 —— 默认不画（只保留冷却遮罩）
                    showName: false,    // 格子下方的技能名 —— 默认不画
                },
            },
            // 灵息回复：统一走 Player.updateManaRegen 的全局自然恢复（GameConfig.combat.manaRegen：每 2 秒 1 点）；
            // 教学期不再额外加速回灵，需要补灵时由 TrainingManager 每完成一步回一部分。
        };
    }

    /**
     * 战斗按键顺序（J 普通攻击 → U 灵息弹 → I 护体术 → L 闪避 → O 剑影连斩）
     * 与 CONFIG 中各项的 id 一致：按键捕获与教学步骤都按这个顺序。
     * 注意：左下角技能栏只画 U / I / L（普攻不占格；O 习得后补出第 4 格），
     *       顺序见 CONFIG.hud.skillBar.order。
     * @returns {string[]}
     */
    static get SKILL_ORDER() {
        return ['attack', 'lingxidan', 'hutishu', 'dodge', 'jianying'];
    }

    /**
     * 剑影连斩的四道剑气方向（上 / 下 / 左 / 右，与需求一致）
     * @returns {string[]}
     */
    static get JIANYING_DIRECTIONS() {
        return ['up', 'down', 'left', 'right'];
    }

    /**
     * @param {Object} config
     * @param {Object} config.main - Main 实例
     * @param {boolean} [config.forceUnlocked] - 强制解锁（调试/测试用）
     */
    constructor(config = {}) {
        this.main = config.main || null;
        this.config = PlayerCombatSystem.CONFIG;

        // 数值从 GameConfig 读取（灵息弹伤害 / 护体术减伤），保持与技能配置一致
        this._applyGameConfigValues();

        // ========== 运行状态 ==========
        this.cooldowns = { attack: 0, lingxidan: 0, hutishu: 0, dodge: 0, jianying: 0 };
        this.buffs = { hutishu: 0, dodge: 0 };     // 剩余秒数
        this.hurtLock = 0;                          // 受伤僵直剩余秒数（>0 时禁止一切输入）
        this.casting = null;                        // { timer } 施法中的灵息弹
        this.effects = [];                          // CombatEffect 列表（含 layer）
        this.projectiles = [];                      // CombatProjectile 列表
        this.hutishuAura = null;                    // 护体术气场实例（跟随玩家）
        this.dodgeAura = null;                      // 闪避气场实例（跟随玩家）
        this.foundationAura = null;                 // 筑基调息气场实例（章末剧情，跟随玩家）
        this.foundationAuraTimer = 0;               // 筑基调息气场剩余秒数
        this.controlChain = null;                   // 渡厄使「控制」命中的锁链实例（跟随玩家头顶）
        this.controlChainTimer = 0;                 // 锁链剩余秒数
        this.controlChainSpriteRequested = false;   // 锁链图是否已发起加载
        this.toast = { text: '', timer: 0 };        // 屏幕提示（灵息不足 / 冷却中等）
        this.unlockedOnce = false;                  // 教学开始后永久锁定为解锁
        this.forceUnlocked = config.forceUnlocked === true;

        // 速度增益恢复用
        this._speedBonusApplied = false;

        // 资源（精灵图，缺失时为占位图 → 由 CombatEffect 自动回退为程序化绘制）
        this.sprites = {};
        // 气血条 / 灵息条图片的尺寸告警去重（同一张图只提示一次，避免每帧刷屏）
        this._barSpriteWarnings = new Set();
        // 左下角技能栏图标的尺寸 / 缺失告警去重（同上）
        this._skillIconWarnings = new Set();
        this._loadSprites();
    }

    /** 玩家实例 */
    get player() {
        return this.main ? this.main.player : null;
    }

    /** 当前地图 */
    get map() {
        return this.main ? this.main.currentMap : null;
    }

    // ==================== 初始化 ====================

    /**
     * 用 GameConfig 中的技能配置校准数值（伤害 / 减伤比例）
     * 说明：冷却与消耗按需求书为准，故不从 GameConfig 覆盖。
     */
    _applyGameConfigValues() {
        try {
            const gameConfig = GameConfig.getInstance();

            const lingxidan = gameConfig.getSkill && gameConfig.getSkill('lingxidan');
            if (lingxidan) {
                if (typeof lingxidan.damage === 'number') this.config.lingxidan.damage = lingxidan.damage;
                if (typeof lingxidan.range === 'number' && lingxidan.range > 0) {
                    this.config.lingxidan.maxDistance = lingxidan.range;
                }
                if (typeof lingxidan.projectileSpeed === 'number' && lingxidan.projectileSpeed > 0) {
                    this.config.lingxidan.projectileSpeed = lingxidan.projectileSpeed;
                }
            }

            const hutishu = gameConfig.getSkill && gameConfig.getSkill('hutishu');
            if (hutishu && typeof hutishu.shieldPercent === 'number') {
                this.config.hutishu.damageReduction = hutishu.shieldPercent / 100;
            }

            // 剑影连斩：伤害 / 最大飞行距离（range）/ 飞行速度取 GameConfig（冷却与消耗仍按需求书）
            const jianying = gameConfig.getSkill && gameConfig.getSkill('jianying');
            if (jianying) {
                if (typeof jianying.damage === 'number') this.config.jianying.damage = jianying.damage;
                if (typeof jianying.range === 'number' && jianying.range > 0) {
                    this.config.jianying.maxDistance = jianying.range;
                }
                if (typeof jianying.projectileSpeed === 'number' && jianying.projectileSpeed > 0) {
                    this.config.jianying.projectileSpeed = jianying.projectileSpeed;
                }
            }
        } catch (error) {
            console.warn('[PlayerCombat] 读取 GameConfig 技能数值失败，使用默认配置', error);
        }
    }

    /**
     * 预加载战斗精灵图（缺失时 ResourceManager 返回占位图，
     * CombatEffect 会因尺寸不符自动改用程序化绘制）
     */
    _loadSprites() {
        if (typeof ResourceManager === 'undefined') return;
        const resourceManager = ResourceManager.getInstance();
        const cfg = this.config;

        const tasks = [
            ['swordAura', cfg.attack.auraKey],
            ['lingxidanProjectile', cfg.lingxidan.projectileKey],
            ['lingxidanHit', cfg.lingxidan.hitKey],
            ['jianyingProjectile', cfg.jianying.projectileKey],
            ['jianyingHit', cfg.jianying.hitKey],
            ['hutishuAura', cfg.hutishu.auraKey],
            ['dodgeAura', cfg.dodge.auraKey],
            ['foundationAura', cfg.foundationAura.key],
            // 气血条 / 灵息条（自定义 UI 图片：外框 500×64 + 内条 454×64）
            ['hudHealthFrame', cfg.hud.healthBar.frameKey],
            ['hudHealthFill', cfg.hud.healthBar.fillKey],
            ['hudManaFrame', cfg.hud.manaBar.frameKey],
            ['hudManaFill', cfg.hud.manaBar.fillKey],
        ];

        // 左下角技能栏图标（U/I/L：100×100，各技能的 hudIcon；普攻无 hudIcon 故不入列）
        PlayerCombatSystem.SKILL_ORDER.forEach(id => {
            if (cfg[id] && cfg[id].hudIcon) {
                tasks.push(['skillIcon_' + id, cfg[id].hudIcon]);
            }
        });

        tasks.forEach(task => {
            const key = task[0];
            const path = task[1];
            resourceManager.loadImage(path)
                .then(image => { this.sprites[key] = image; })
                .catch(() => { this.sprites[key] = null; });
        });
    }

    // ==================== 解锁（教学） ====================

    /**
     * 战斗按键是否已解锁
     * 规则：基础操作教学开始（或已完成）后才会捕获战斗按键输入
     * @returns {boolean}
     */
    isUnlocked() {
        if (this.forceUnlocked || this.unlockedOnce) return true;

        const main = this.main;
        const trainingManager = main && main.trainingManager;
        if (trainingManager && trainingManager.isActive) return true;

        // 任务层兜底（读档后依旧解锁）：chapter1_main_1 的 complete_training/basic 已完成
        const questSystem = main && main.player ? main.player.questSystem : null;
        if (questSystem && typeof questSystem.isObjectiveCompleted === 'function'
            && questSystem.isObjectiveCompleted('chapter1_main_1', 'complete_training', 'basic')) {
            return true;
        }

        return false;
    }

    /**
     * 标记为已解锁（教学开始 / 教学完成后调用）
     * @param {boolean} [value=true]
     * @returns {boolean} 是否发生了变化
     */
    setUnlocked(value = true) {
        const changed = this.unlockedOnce !== !!value;
        this.unlockedOnce = !!value;
        if (changed && value) {
            console.log('[PlayerCombat] 战斗系统已解锁（可捕获 J/U/I/L 按键）');
        }
        return changed;
    }

    // ==================== 技能解锁 / 教学按键门控 ====================

    /**
     * 当前的基础操作教学管理器（未开始时为 null）
     * @returns {TrainingManager|null}
     */
    _trainingManager() {
        const trainingManager = this.main ? this.main.trainingManager : null;
        return trainingManager && trainingManager.isActive ? trainingManager : null;
    }

    /**
     * 某个技能当前是否已解锁（决定左下角技能栏是否画出这一格）
     * 注意：普通攻击（attack）同样随教学解锁，但不画进技能栏（见 CONFIG.hud.skillBar.order）。
     * - 需要「已习得」的技能（CONFIG.xxx.learnedGate，如剑影连斩）：只看是否学会（见 isSkillLearned）
     * - 教学进行中：只有已完成的教学步骤对应的技能解锁（逐格解锁 + 冷却提示）
     * - 教学已完成 / 读档后任务目标已完成：全部解锁
     * - 教学尚未开始：全部未解锁（技能栏整条隐藏，按键无响应）
     * @param {string} id - 'attack' | 'lingxidan' | 'hutishu' | 'dodge' | 'jianying'
     * @returns {boolean}
     */
    isSkillUnlocked(id) {
        if (this.forceUnlocked) return true;

        const cfg = this.config[id];
        if (!cfg) return false;

        // 由剧情 / 任务传授的技能（如第二章试炼的剑影连斩）：学会才可用，不参与基础操作教学
        if (cfg.learnedGate === true) return this.isSkillLearned(id);

        const trainingManager = this._trainingManager();
        if (trainingManager) {
            // 教学期：已完成的教学圆球 → 解锁该技能格
            return typeof trainingManager.isTrainingActionCompleted === 'function'
                && trainingManager.isTrainingActionCompleted(cfg.trainingAction);
        }

        // 教学未进行：完全解锁（教学完成后 unlockedOnce / 任务目标兜底）才全部可用
        return this.isUnlocked();
    }

    /**
     * 某个技能是否已习得（读档 / 存档通用）
     * 判定顺序：
     *   1) 职业系统里的技能等级 > 0（Main.learnProfessionSkill 写入，随存档保存）；
     *   2) 任务目标兜底（例如剑影连斩 = 第二章主线一《渡口无归客》的 complete_training/sword 已完成），
     *      避免旧存档里"任务已完成但技能未写入"时技能栏空一格。
     * @param {string} id - 技能 id（需在 CONFIG 中配置 learnedFrom）
     * @returns {boolean}
     */
    isSkillLearned(id) {
        const cfg = this.config[id];
        if (!cfg) return false;

        const player = this.player;
        const system = player ? player.professionSystem : null;
        if (system && typeof system.getSkillLevel === 'function' && system.getSkillLevel(id) > 0) {
            return true;
        }

        const gate = cfg.learnedFrom;
        const questSystem = player ? player.questSystem : null;
        if (gate && questSystem && typeof questSystem.isObjectiveCompleted === 'function') {
            return !!questSystem.isObjectiveCompleted(gate.questId, gate.type, gate.target);
        }

        return false;
    }

    /**
     * 某个战斗行为当前是否可施展（按键门控）
     * - 教学进行中：必须站在对应教学圈（训练地面标记）范围内
     *   （由 TrainingManager.nearbyZone 判定，未完成且动作类型匹配）
     * - 其余情况：按 isSkillUnlocked 判定
     * @param {string} id - 'attack' | 'lingxidan' | 'hutishu' | 'dodge' | 'jianying'
     * @returns {boolean}
     */
    canUseAction(id) {
        const cfg = this.config[id];
        if (!cfg) return false;

        const trainingManager = this._trainingManager();
        if (trainingManager) {
            const zone = trainingManager.nearbyZone;
            return !!zone && !zone.isCompleted && zone.actionType === cfg.trainingAction;
        }

        return this.isSkillUnlocked(id);
    }

    /**
     * 教学期按键未命中教学圈时的提示（教学外静默，保持"教学前按键完全无响应"）
     * 说明：本次教学没有该动作的教学圈时完全静默（例如第一章基础教学的 4 个圈里没有剑影连斩），
     *       不弹"先走到「…」教学圈内"这类无意义提示；第二章剑修试炼只有一个剑影连斩圈，
     *       此时只有 O 键会出现该提示。
     * @param {string} id - 'attack' | 'lingxidan' | 'hutishu' | 'dodge' | 'jianying'
     */
    _notifyTrainingGate(id) {
        const trainingManager = this._trainingManager();
        if (!trainingManager) return;

        const cfg = this.config[id];
        if (!cfg) return;

        const zones = Array.isArray(trainingManager.zones) ? trainingManager.zones : [];
        const included = zones.some(zone => zone && zone.actionType === cfg.trainingAction);
        if (!included) return;      // 本次教学没有这个动作 → 静默

        const zone = this._findTrainingZone(cfg.trainingAction);
        const zoneName = zone && zone.name ? zone.name : cfg.name;
        this._toast(cfg.name + '：先走到「' + zoneName + '」教学圈内，再按 '
            + cfg.key.toUpperCase());
    }

    /**
     * 取得（未完成的）对应教学圈
     * @param {string} actionType - 'attack' | 'skill_lingxidan' | 'skill_hutishu' | 'dodge' | 'skill_jianying'
     * @returns {TrainingZone|null}
     */
    _findTrainingZone(actionType) {
        const trainingManager = this._trainingManager();
        if (!trainingManager || !Array.isArray(trainingManager.zones)) return null;

        // 优先取玩家附近（正在提示）的那一个
        if (trainingManager.nearbyZone && trainingManager.nearbyZone.actionType === actionType) {
            return trainingManager.nearbyZone;
        }
        return trainingManager.zones.find(zone => zone
            && !zone.isCompleted && zone.actionType === actionType) || null;
    }

    // ==================== 主更新 ====================

    /**
     * 每帧更新（由 Main.updateGameWorld 调用）
     * @param {number} deltaTime
     * @param {Object} input - 输入状态（InputManager.getInputState()）
     */
    update(deltaTime, input) {
        // 1. 计时器 / 特效 / 投射物始终推进（解锁前后都让既有效果正常结束）
        this._tickTimers(deltaTime);
        this._updateEffects(deltaTime);
        this._updateProjectiles(deltaTime);
        this._updateCasting(deltaTime);
        this._updateFoundationAura(deltaTime);
        this._updateControlChain(deltaTime);

        // 2. 解锁判定：教学一开始就永久解锁
        //    灵息回复不在这里处理：统一走 Player.updateManaRegen 的全局自然恢复
        //    （GameConfig.combat.manaRegen：每 2 秒 1 点），教学期同样吃这条规则。
        const trainingManager = this.main ? this.main.trainingManager : null;
        if (trainingManager && trainingManager.isActive) {
            this.setUnlocked(true);
        }

        // 3. 未解锁 → 不捕获任何战斗按键
        if (!this.isUnlocked()) return;

        // 4. 受伤僵直：禁止一切和玩家行为有关的按键输入
        if (this.hurtLock > 0) return;

        // 5. 施法（灵息弹攻击动画）中不再接受新的战斗按键
        if (this.casting) return;

        // 6. UI / 战斗场景占用输入时不捕获
        if (!this._canCaptureInput()) return;

        // 7. 按键捕获（一帧只触发一个行为）
        //    教学期：只有站在对应教学圈内按提示按键才会施展，否则仅提示、不施展；
        //    教学前：isUnlocked() 已在上方返回，完全无响应。
        const pressed = input.pressedKeys;
        for (const id of PlayerCombatSystem.SKILL_ORDER) {
            const cfg = this.config[id];
            if (!cfg || !pressed[cfg.key]) continue;

            if (!this.canUseAction(id)) {
                this._notifyTrainingGate(id);
                return;
            }

            switch (id) {
                case 'attack': this.tryAttack(); break;
                case 'lingxidan': this.tryCastLingxidan(); break;
                case 'hutishu': this.tryHutishu(); break;
                case 'dodge': this.tryDodge(); break;
                case 'jianying': this.tryCastJianying(); break;
            }
            return;
        }
    }

    /**
     * 推进所有计时器（冷却 / 增益 / 受伤僵直 / 提示）
     * @param {number} deltaTime
     */
    _tickTimers(deltaTime) {
        for (const key in this.cooldowns) {
            if (this.cooldowns[key] > 0) {
                this.cooldowns[key] = Math.max(0, this.cooldowns[key] - deltaTime);
            }
        }

        for (const key in this.buffs) {
            if (this.buffs[key] > 0) {
                this.buffs[key] = Math.max(0, this.buffs[key] - deltaTime);
                if (this.buffs[key] === 0) this._onBuffExpired(key);
            }
        }

        if (this.hurtLock > 0) {
            this.hurtLock = Math.max(0, this.hurtLock - deltaTime);
            if (this.hurtLock === 0 && this.player) {
                this.player.isHurtLocked = false;
            }
        }

        if (this.toast.timer > 0) {
            this.toast.timer = Math.max(0, this.toast.timer - deltaTime);
        }
    }

    /**
     * 增益结束处理（移除气场、还原移速）
     * @param {string} key - 'hutishu' | 'dodge'
     */
    _onBuffExpired(key) {
        if (key === 'hutishu') {
            this._removeEffect(this.hutishuAura);
            this.hutishuAura = null;
        } else if (key === 'dodge') {
            this._removeEffect(this.dodgeAura);
            this.dodgeAura = null;
            // 还原移动速度（按当前境界/职业重新计算，避免覆盖其它增速来源）
            if (this.player) {
                this.player.moveSpeed = this.player.getCurrentMoveSpeed();
            }
            this._speedBonusApplied = false;
        }
    }

    /**
     * 是否可以捕获战斗按键
     * @returns {boolean}
     */
    _canCaptureInput() {
        const main = this.main;
        const player = this.player;
        if (!main || !player || !player.isAlive) return false;

        // 只在游戏世界场景中生效（回合制战斗场景由 BattleScene 处理）
        const scene = main.sceneManager ? main.sceneManager.getCurrentScene() : null;
        if (!scene || scene.sceneId !== 'gameWorld') return false;

        if (player.isInBattle || player.isInteracting) return false;
        if (main.questUI && main.questUI.isVisible) return false;
        if (main.dialogBox && main.dialogBox.isVisible) return false;
        if (main.mapTeleport && main.mapTeleport.isVisible) return false;
        if (main.shop && main.shop.isOpen) return false;

        return true;
    }

    // ==================== 行为：普通攻击（J） ====================

    /**
     * 普通攻击：0.5 秒冷却、较少灵息、无角色攻击动画，
     * 生成一道包围主角的剑气（4 帧非循环），剑气范围内敌人立刻受伤。
     * @returns {boolean} 是否成功施展
     */
    tryAttack() {
        const cfg = this.config.attack;
        if (!this._checkCost(cfg)) return false;

        const player = this.player;
        this._pay(cfg.manaCost);
        this.cooldowns.attack = cfg.cooldown;

        // 包围主角的剑气（跟随主角，非循环）
        this._spawnEffect('sword_aura', {
            spriteSheet: this.sprites.swordAura,
            frameWidth: cfg.auraFrameWidth,
            frameHeight: cfg.auraFrameHeight,
            frameCount: cfg.auraFrames,
            fps: cfg.auraFps,
            loop: false,
            follow: player,
            offset: { x: 8, y: 8 },
            layer: 'over',
            shape: 'aura_ring',
            color: cfg.auraColor,
            alpha: 0.95,
        });

        // 伤害在按下瞬间结算：受伤时攻击也不会被打断
        const damage = player.professionSystem.getAttackDamage();
        this._damageEnemiesInCircle(player.position, cfg.auraRadius, damage, cfg.name);

        this._notifyTraining(cfg.trainingAction);
        return true;
    }

    // ==================== 行为：灵息弹（U） ====================

    /**
     * 灵息弹：3 秒冷却、较多灵息，播放施法动画（4 行 下/左/右/上，各 4 帧），
     * 动画播完后在朝向前方生成灵息弹。
     * @returns {boolean} 是否成功开始施法
     */
    tryCastLingxidan() {
        const cfg = this.config.lingxidan;
        if (this.casting) return false;
        if (!this._checkCost(cfg)) return false;

        const player = this.player;
        this._pay(cfg.manaCost);
        this.cooldowns.lingxidan = cfg.cooldown;

        // 施法（攻击动画）全过程
        this.casting = { timer: Math.max(0.05, cfg.castFrames / cfg.castFps) };
        player.isCastingSkill = true;
        if (player.animationManager.hasAnimation(cfg.castAnimation)) {
            player.animationManager.play(cfg.castAnimation, {
                reset: true,
                loop: false,
                direction: player.facing,
            });
        }

        this._notifyTraining(cfg.trainingAction);
        return true;
    }

    // ==================== 行为：护体术（I） ====================

    /**
     * 护体术：30 秒冷却、很多灵息，10 秒减伤 + 气场特效（角色之下）；
     * 与闪避互斥，不能同时存在。
     * @returns {boolean} 是否成功施展
     */
    tryHutishu() {
        const cfg = this.config.hutishu;

        if (this.buffs.hutishu > 0) {
            this._toast(cfg.name + '：护体气场正在生效');
            return false;
        }
        if (this.buffs.dodge > 0) {
            this._toast('闪避期间无法施展护体术（两者不可同时执行）');
            return false;
        }
        if (!this._checkCost(cfg)) return false;

        const player = this.player;
        this._pay(cfg.manaCost);
        this.cooldowns.hutishu = cfg.cooldown;
        this.buffs.hutishu = cfg.duration;

        this.hutishuAura = this._spawnEffect('hutishu_aura', {
            spriteSheet: this.sprites.hutishuAura,
            frameWidth: cfg.auraFrameWidth,
            frameHeight: cfg.auraFrameHeight,
            frameCount: cfg.auraFrames,
            fps: cfg.auraFps,
            loop: true,
            follow: player,
            offset: { x: 12, y: 8 },
            layer: 'under',
            shape: 'aura_glow',
            color: cfg.auraColor,
            alpha: 0.9,
        });

        this._toast(cfg.name + '：' + cfg.duration + ' 秒内减伤 '
            + Math.round(cfg.damageReduction * 100) + '%');
        this._notifyTraining(cfg.trainingAction);
        return true;
    }

    // ==================== 行为：闪避（L） ====================

    /**
     * 闪避：60 秒冷却、大量灵息，朝当前方向瞬移一段距离（不穿墙），
     * 10 秒内移速 +25% + 气场特效（角色之下）；与护体术互斥。
     * @returns {boolean} 是否成功施展
     */
    tryDodge() {
        const cfg = this.config.dodge;

        if (this.buffs.dodge > 0) {
            this._toast(cfg.name + '：加速气场正在生效');
            return false;
        }
        if (this.buffs.hutishu > 0) {
            this._toast('护体术期间无法闪避（两者不可同时执行）');
            return false;
        }
        if (!this._checkCost(cfg)) return false;

        const player = this.player;
        this._pay(cfg.manaCost);
        this.cooldowns.dodge = cfg.cooldown;
        this.buffs.dodge = cfg.duration;

        // 通知教学（在瞬移之前：闪避会位移，需按按键时的站位判定训练圆球）
        this._notifyTraining(cfg.trainingAction);

        // 瞬移（分步推进 + 碰撞检测，不能穿墙）
        this._teleportForward(cfg.distance);

        // 移速 +25%
        player.moveSpeed = player.getCurrentMoveSpeed() * (1 + cfg.speedBonus);
        this._speedBonusApplied = true;

        this.dodgeAura = this._spawnEffect('dodge_aura', {
            spriteSheet: this.sprites.dodgeAura,
            frameWidth: cfg.auraFrameWidth,
            frameHeight: cfg.auraFrameHeight,
            frameCount: cfg.auraFrames,
            fps: cfg.auraFps,
            loop: true,
            follow: player,
            offset: { x: 12, y: 8 },
            layer: 'under',
            shape: 'aura_glow',
            color: cfg.auraColor,
            alpha: 0.9,
        });

        this._toast(cfg.name + '：' + cfg.duration + ' 秒内移速 +'
            + Math.round(cfg.speedBonus * 100) + '%');
        return true;
    }

    // ==================== 行为：剑影连斩（O） ====================

    /**
     * 剑影连斩：15 秒冷却、较多灵息，无技能动画（按下瞬间出手，因此受伤也不会被打断）；
     * 在角色的上 / 下 / 左 / 右四个方向各生成一道剑气，剑气朝各自方向直线飞行，
     * 超过最大飞行距离自行消失；剑气只对敌人造成伤害，命中敌人后立刻消失并生成命中特效。
     * @returns {boolean} 是否成功施展
     */
    tryCastJianying() {
        const cfg = this.config.jianying;
        if (!this._checkCost(cfg)) return false;

        const player = this.player;
        this._pay(cfg.manaCost);
        this.cooldowns.jianying = cfg.cooldown;

        // 四向剑气：立即生成（不写 casting → 受伤不会中断，与普攻同一套"按下瞬间结算"规则）
        PlayerCombatSystem.JIANYING_DIRECTIONS.forEach(direction => {
            const offset = this._getJianyingSpawnOffset(direction);
            this.projectiles.push(new CombatProjectile({
                name: cfg.id,
                label: cfg.name,
                position: {
                    x: player.position.x + offset.x,
                    y: player.position.y + offset.y,
                },
                direction: direction,
                speed: cfg.projectileSpeed,
                maxDistance: cfg.maxDistance,
                damage: cfg.damage,
                radius: cfg.hitRadius,
                spriteSheet: this.sprites.jianyingProjectile,
                frameWidth: cfg.projectileFrameWidth,
                frameHeight: cfg.projectileFrameHeight,
                frameCount: cfg.projectileFrames,
                directionRows: cfg.projectileRows,
                fps: cfg.projectileFps,
                color: cfg.projectileColor,
                shape: cfg.projectileShape,
                // 命中特效：透明 / 渐变 / 扩大的圆（缺图时由 CombatEffect 程序化绘制）
                hitEffect: {
                    name: cfg.id + '_hit',
                    spriteSheet: this.sprites.jianyingHit,
                    frameWidth: cfg.hitFrameWidth,
                    frameHeight: cfg.hitFrameHeight,
                    frameCount: cfg.hitFrames,
                    fps: cfg.hitFps,
                    shape: cfg.hitShape,
                    color: cfg.hitColor,
                },
            }));
        });

        // 教学圈：在第二章试炼的剑影连斩圈内施展 → 完成该教学圈（全部完成即学会该技能）
        this._notifyTraining(cfg.trainingAction);

        return true;
    }

    // ==================== 内部工具 ====================

    /**
     * 灵息 / 冷却校验（按键按下的瞬间立即执行）
     * @param {Object} cfg - 行为配置
     * @returns {boolean} 是否可以执行
     */
    _checkCost(cfg) {
        const player = this.player;
        if (!player || !player.isAlive) return false;

        // 1) 灵息是否足够
        if (player.playerData.mana < cfg.manaCost) {
            this._toast(cfg.name + '：灵息不足（需要 ' + cfg.manaCost + '，当前 '
                + Math.floor(player.playerData.mana) + '）');
            return false;
        }

        // 2) 冷却是否结束
        if (this.cooldowns[cfg.id] > 0) {
            // 普通攻击不进左下角技能栏，也不再弹屏幕中下方的冷却提示（CONFIG.attack.silentCooldown）：
            // 按快了就静默失败，冷却时长与伤害结算完全不变
            if (!cfg.silentCooldown) {
                this._toast(cfg.name + '：冷却中（还需 ' + this.cooldowns[cfg.id].toFixed(1) + ' 秒）');
            }
            return false;
        }

        return true;
    }

    /**
     * 扣除灵息
     * @param {number} amount
     */
    _pay(amount) {
        const player = this.player;
        if (!player) return;
        player.playerData.mana = Math.max(0, player.playerData.mana - amount);
    }

    /**
     * 朝向 → 单位向量
     * @param {string} facing - 'up' | 'down' | 'left' | 'right'
     * @returns {Object} {x, y}
     */
    _facingVector(facing) {
        switch (facing) {
            case 'up': return { x: 0, y: -1 };
            case 'left': return { x: -1, y: 0 };
            case 'right': return { x: 1, y: 0 };
            default: return { x: 0, y: 1 };
        }
    }

    /**
     * 灵息弹出生点偏移（按朝向，相对玩家逻辑坐标）
     * 数值来源：CONFIG.lingxidan.spawnOffsets；配置缺项时回退为
     * "沿朝向前进 spawnOffset 像素"，与旧版本行为一致。
     * @param {string} facing - 'up' | 'down' | 'left' | 'right'
     * @returns {Object} {x, y} 偏移
     */
    _getLingxidanSpawnOffset(facing) {
        const cfg = this.config.lingxidan;
        const table = cfg.spawnOffsets || {};
        const offset = table[facing];
        if (offset && typeof offset.x === 'number' && typeof offset.y === 'number') {
            return { x: offset.x, y: offset.y };
        }

        const vector = this._facingVector(facing);
        const distance = typeof cfg.spawnOffset === 'number' ? cfg.spawnOffset : 0;
        return { x: vector.x * distance, y: vector.y * distance };
    }

    /**
     * 剑影连斩剑气出生点偏移（按方向，相对玩家逻辑坐标）
     * 数值来源：CONFIG.jianying.spawnOffsets；配置缺项时回退为"沿该方向前移 60px"。
     * @param {string} direction - 'up' | 'down' | 'left' | 'right'
     * @returns {Object} {x, y} 偏移
     */
    _getJianyingSpawnOffset(direction) {
        const cfg = this.config.jianying;
        const table = cfg.spawnOffsets || {};
        const offset = table[direction];
        if (offset && typeof offset.x === 'number' && typeof offset.y === 'number') {
            return { x: offset.x, y: offset.y };
        }

        const vector = this._facingVector(direction);
        return { x: vector.x * 60, y: vector.y * 60 };
    }

    /**
     * 朝当前朝向瞬移（分步推进，遇墙 / 出界即停止）
     * @param {number} distance - 期望距离（像素）
     * @returns {number} 实际移动距离
     */
    _teleportForward(distance) {
        const player = this.player;
        if (!player) return 0;

        const map = this.map;
        const vector = this._facingVector(player.facing);
        const stepSize = 6;
        let moved = 0;

        while (moved < distance) {
            const step = Math.min(stepSize, distance - moved);
            const nextX = player.position.x + vector.x * step;
            const nextY = player.position.y + vector.y * step;
            // 与 Player.moveWithCollision 用同一套碰撞盒（collisionWidth × collisionHeight）
            const rect = typeof player.getCollisionRect === 'function'
                ? player.getCollisionRect(nextX, nextY)
                : {
                    x: nextX - player.width / 2,
                    y: nextY - player.height / 2,
                    width: player.width,
                    height: player.height,
                };

            if (player.checkCollision(rect, map)) break;   // 撞墙 / 出界 → 停止推进

            player.position.x = nextX;
            player.position.y = nextY;
            moved += step;
        }

        player.isMoving = false;
        return moved;
    }

    /**
     * 通知训练管理器（教学中完成对应训练圆球）
     * @param {string} actionType - 'attack' | 'skill_lingxidan' | 'skill_hutishu' | 'dodge' | 'skill_jianying'
     */
    _notifyTraining(actionType) {
        const trainingManager = this.main ? this.main.trainingManager : null;
        if (trainingManager && trainingManager.isActive
            && typeof trainingManager.notifyAction === 'function') {
            trainingManager.notifyAction(actionType, this.player);
        }
    }

    /**
     * 屏幕提示（灵息不足 / 冷却中等）
     * @param {string} text
     */
    _toast(text) {
        this.toast.text = text;
        this.toast.timer = 1.8;
        console.log('[PlayerCombat] ' + text);
    }

    // ==================== 施法（灵息弹攻击动画） ====================

    /**
     * 推进施法计时：动画播完（或计时结束）→ 生成灵息弹
     * @param {number} deltaTime
     */
    _updateCasting(deltaTime) {
        if (!this.casting) return;

        this.casting.timer -= deltaTime;
        if (this.casting.timer <= 0) {
            this._finishCast();
        }
    }

    /**
     * 施法完成：在朝向前方一点生成灵息弹
     */
    _finishCast() {
        this.casting = null;

        const player = this.player;
        if (player) player.isCastingSkill = false;
        if (!player || !player.isAlive) return;

        const cfg = this.config.lingxidan;
        const spawnOffset = this._getLingxidanSpawnOffset(player.facing);

        this.projectiles.push(new CombatProjectile({
            name: 'lingxidan',
            position: {
                x: player.position.x + spawnOffset.x,
                y: player.position.y + spawnOffset.y,
            },
            direction: player.facing,
            speed: cfg.projectileSpeed,
            maxDistance: cfg.maxDistance,
            damage: cfg.damage,
            radius: cfg.hitRadius,
            spriteSheet: this.sprites.lingxidanProjectile,
            frameWidth: cfg.projectileFrameWidth,
            frameHeight: cfg.projectileFrameHeight,
            frameCount: cfg.projectileFrames,
            directionRows: cfg.projectileRows,
            fps: cfg.projectileFps,
            color: cfg.projectileColor,
        }));
    }

    /**
     * 中断施法（施法中受伤）：终止攻击动画、重置冷却、不消耗灵息
     */
    _cancelCast() {
        if (!this.casting) return;

        this.casting = null;

        const player = this.player;
        if (player) {
            player.isCastingSkill = false;
            if (player.isAlive) player.playIdleAnimation();
            // 不消耗法力 → 返还已扣除的灵息
            player.restoreMana(this.config.lingxidan.manaCost);
        }
        // 重置冷却（立刻可以再次施法）
        this.cooldowns.lingxidan = 0;

        console.log('[PlayerCombat] 施法被打断：终止灵息弹动画，冷却重置，灵息已返还');
    }

    // ==================== 受伤联动（由 Player.takeDamage 调用） ====================

    /**
     * 玩家受到伤害时由 Player 调用
     * @returns {Object} { playHurtAnimation: boolean, lockDuration: number }
     */
    onPlayerHurt() {
        // 施法（灵息弹攻击动画）中受伤 → 终止动画、重置冷却、不消耗法力
        this._cancelCast();

        const playHurtAnimation = this.shouldPlayHurtAnimation();
        const lockDuration = playHurtAnimation ? this.getHurtLockDuration() : 0;

        if (lockDuration > 0) {
            this.hurtLock = lockDuration;
        }

        return { playHurtAnimation, lockDuration };
    }

    /**
     * 护体术减伤后的受伤倍率
     * @returns {number} 1 = 无减伤
     */
    getIncomingDamageMultiplier() {
        if (this.buffs.hutishu > 0) {
            return Math.max(0, 1 - this.config.hutishu.damageReduction);
        }
        return 1;
    }

    /**
     * 是否播放受伤动画
     * 护体术 / 闪避生效期间受伤不播放受伤动画（也不进入受伤僵直）
     * @returns {boolean}
     */
    shouldPlayHurtAnimation() {
        return this.buffs.hutishu <= 0 && this.buffs.dodge <= 0;
    }

    /**
     * 受伤僵直时长（受伤动画期间禁止一切玩家输入）
     * @returns {number} 秒
     */
    getHurtLockDuration() {
        return this.config.hurt.lockDuration;
    }

    // ==================== 特效管理 ====================

    /**
     * 生成一个战斗特效
     * @param {string} name - 特效名（调试用）
     * @param {Object} config - CombatEffect 配置（layer 决定绘制层）
     * @returns {CombatEffect|null}
     */
    _spawnEffect(name, config = {}) {
        if (typeof CombatEffect !== 'function') return null;

        const effect = new CombatEffect(Object.assign({ name: name }, config));
        this.effects.push(effect);
        return effect;
    }

    /**
     * 移除指定特效（增益结束时调用）
     * @param {CombatEffect|null} effect
     */
    _removeEffect(effect) {
        if (!effect) return;
        const index = this.effects.indexOf(effect);
        if (index !== -1) this.effects.splice(index, 1);
    }

    /**
     * 更新所有特效
     * @param {number} deltaTime
     */
    _updateEffects(deltaTime) {
        if (this.effects.length === 0) return;
        this.effects = this.effects.filter(effect => effect.update(deltaTime));
    }

    // ==================== 筑基调息气场（章末剧情） ====================

    /**
     * 播放“筑基调息”气场：主角背后的气场，循环播放到 duration 结束
     * 由 Main.startFoundationTrial 调用；有美术图时用精灵图，缺图时自动程序化绘制
     * @param {number} [durationSeconds] - 播放时长（秒），默认取 CONFIG.foundationAura.duration
     * @returns {CombatEffect|null}
     */
    playFoundationAura(durationSeconds) {
        const cfg = this.config.foundationAura;
        const player = this.player;
        if (!player) return null;

        // 重复触发时先清掉上一份，避免气场叠加
        this.stopFoundationAura();

        this.foundationAura = this._spawnEffect('foundation_aura', {
            spriteSheet: this.sprites.foundationAura,
            frameWidth: cfg.frameWidth,
            frameHeight: cfg.frameHeight,
            frameCount: cfg.frames,
            fps: cfg.fps,
            loop: true,                     // 精灵图循环播放，何时结束由计时器决定
            follow: player,
            offset: { x: cfg.offsetX, y: cfg.offsetY },
            layer: 'under',                 // 角色之下、地图之上 → 表现为主角“背后”的气场
            shape: 'aura_glow',
            color: cfg.color,
        });

        this.foundationAuraTimer = typeof durationSeconds === 'number' ? durationSeconds : cfg.duration;
        console.log(`[PlayerCombat] 筑基调息气场开始播放（${this.foundationAuraTimer} 秒）`);
        return this.foundationAura;
    }

    /**
     * 停止“筑基调息”气场
     */
    stopFoundationAura() {
        this.foundationAuraTimer = 0;
        if (this.foundationAura) {
            this._removeEffect(this.foundationAura);
            this.foundationAura = null;
        }
    }

    /**
     * “筑基调息”气场是否正在播放
     * @returns {boolean}
     */
    isFoundationAuraPlaying() {
        return !!this.foundationAura && this.foundationAuraTimer > 0;
    }

    /**
     * 推进“筑基调息”气场计时（到时自动停止）
     * @param {number} deltaTime
     */
    _updateFoundationAura(deltaTime) {
        if (!this.foundationAura) return;
        this.foundationAuraTimer -= deltaTime;
        if (this.foundationAuraTimer <= 0) {
            console.log('[PlayerCombat] 筑基调息气场播放结束');
            this.stopFoundationAura();
        }
    }

    // ==================== 渡厄使「控制」锁链 ====================

    /**
     * 「控制」命中：玩家头顶出现 32×32 锁链图（跟随玩家，绘制在角色之上）
     * 只负责表现；禁止按键由 Main.startArenaControlLock 接管
     * @param {number} [durationSeconds=3] - 锁链显示时长（秒）
     * @returns {CombatEffect|null}
     */
    attachControlChain(durationSeconds = 3) {
        this.stopControlChain();

        this.controlChainTimer = Math.max(0, durationSeconds || 0);
        if (this.controlChainTimer <= 0) return null;

        this._ensureControlChainSprite();

        this.controlChain = this._spawnEffect('boss_due_chain', {
            spriteSheet: this.sprites.bossDueChain || null,   // 缺图 → CombatEffect 程序化绘制锁链
            frameWidth: 32,
            frameHeight: 32,
            frameCount: 1,
            fps: 4,
            loop: true,                 // 循环播放，何时结束由计时器决定
            follow: this.player,
            offset: { x: 0, y: -46 },   // 玩家头顶
            layer: 'over',
            shape: 'chain',
            color: '#f2d9a0',
        });

        console.log(`[PlayerCombat] 控制锁链出现（${this.controlChainTimer} 秒）`);
        return this.controlChain;
    }

    /**
     * 停止锁链特效（计时结束 / 解除控制时调用）
     */
    stopControlChain() {
        this.controlChainTimer = 0;
        if (this.controlChain) {
            this._removeEffect(this.controlChain);
            this.controlChain = null;
        }
    }

    /**
     * 锁链是否正在显示
     * @returns {boolean}
     */
    isControlChainActive() {
        return !!this.controlChain && this.controlChainTimer > 0;
    }

    /**
     * 推进锁链计时（到时自动移除）
     * @param {number} deltaTime
     */
    _updateControlChain(deltaTime) {
        if (!this.controlChain) return;

        this.controlChainTimer -= deltaTime;
        if (this.controlChainTimer <= 0) {
            console.log('[PlayerCombat] 控制锁链结束');
            this.stopControlChain();
        }
    }

    /**
     * 懒加载锁链图（effects.boss_due_chain，32×32 单帧）
     * 缺失时 CombatEffect 自动改用程序化锁链，功能不受影响
     */
    _ensureControlChainSprite() {
        if (this.controlChainSpriteRequested) return;
        this.controlChainSpriteRequested = true;

        if (typeof ResourceManager === 'undefined') return;
        ResourceManager.getInstance().loadImage('effects.boss_due_chain')
            .then(image => { this.sprites.bossDueChain = image; })
            .catch(() => { this.sprites.bossDueChain = null; });
    }

    // ==================== 灵息弹：飞行与命中 ====================

    /**
     * 更新所有灵息弹（超出最大距离自行消失；命中敌人扣血 + 生成命中特效）
     * @param {number} deltaTime
     */
    _updateProjectiles(deltaTime) {
        if (this.projectiles.length === 0) return;

        const map = this.map;
        const survivors = [];

        for (const projectile of this.projectiles) {
            const alive = projectile.update(deltaTime);
            if (!alive) continue;   // 超过最大飞行距离 → 自行消失

            // 撞墙（有碰撞图的地图才会触发）→ 直接消失
            if (map && typeof map.isRectWalkable === 'function'
                && !map.isRectWalkable(projectile.getRect())) {
                continue;
            }

            // 命中敌人 → 扣血 + 原地生成命中特效（剑气命中后立刻消失：continue 不再入 survivors）
            const enemy = this._findHitEnemy(projectile.getRect());
            if (enemy) {
                this._applyDamage(enemy, projectile.damage, projectile.label || this.config.lingxidan.name);
                this._spawnHitEffect(projectile.position, projectile.hitEffect);
                continue;
            }

            survivors.push(projectile);
        }

        this.projectiles = survivors;
    }

    /**
     * 找到与矩形相交的第一个存活敌人
     * @param {Object} rect - {x, y, width, height}
     * @returns {Object|null}
     */
    _findHitEnemy(rect) {
        const enemies = this._getEnemies();
        for (const enemy of enemies) {
            if (this._rectsIntersect(rect, this._getEnemyRect(enemy))) return enemy;
        }
        return null;
    }

    /**
     * 生成命中特效
     * - 不传 hitEffect 时使用灵息弹命中特效（原地，1 行 6 帧 48×48，'burst'）
     * - 剑影连斩传自己的 hitEffect（1 行 6 帧 96×96，shape 'ring_expand' =
     *   以命中点为圆心、透明渐变并不断扩大的圆）
     * @param {Object} position - 命中点世界坐标
     * @param {Object} [hitEffect] - 命中特效配置（技能自带，见 CONFIG.jianying.hitEffect 组装的字段）
     */
    _spawnHitEffect(position, hitEffect) {
        const cfg = this.config.lingxidan;
        const preset = hitEffect || {
            name: 'lingxidan_hit',
            spriteSheet: this.sprites.lingxidanHit,
            frameWidth: cfg.hitFrameWidth,
            frameHeight: cfg.hitFrameHeight,
            frameCount: cfg.hitFrames,
            fps: cfg.hitFps,
            shape: 'burst',
            color: cfg.hitColor,
        };

        this._spawnEffect(preset.name || 'hit', Object.assign({}, preset, {
            loop: false,
            position: { x: position.x, y: position.y },
            layer: 'over',
        }));
    }

    // ==================== 伤害结算 ====================

    /**
     * 当前地图上的存活敌人（含战场 Boss）
     * @returns {Array}
     */
    _getEnemies() {
        const enemies = [];
        const map = this.map;
        if (map && map.monsters) {
            map.monsters.forEach(monster => {
                if (monster && monster.isAlive !== false && monster.position) {
                    enemies.push(monster);
                }
            });
        }
        return enemies;
    }

    /**
     * 敌人受击矩形
     * @param {Object} enemy
     * @returns {Object} {x, y, width, height}
     */
    _getEnemyRect(enemy) {
        if (enemy && typeof enemy.getHitRect === 'function') return enemy.getHitRect();
        const width = (enemy && enemy.width) || 32;
        const height = (enemy && enemy.height) || 32;
        return {
            x: enemy.position.x - width / 2,
            y: enemy.position.y - height / 2,
            width: width,
            height: height,
        };
    }

    /**
     * 圆形范围内所有敌人受伤
     * @param {Object} center - 圆心 {x, y}
     * @param {number} radius - 半径（像素）
     * @param {number} damage - 伤害
     * @param {string} label - 技能名（用于战斗日志）
     * @returns {number} 命中数量
     */
    _damageEnemiesInCircle(center, radius, damage, label) {
        let hits = 0;
        for (const enemy of this._getEnemies()) {
            if (this._circleIntersectsRect(center, radius, this._getEnemyRect(enemy))) {
                if (this._applyDamage(enemy, damage, label)) hits++;
            }
        }
        return hits;
    }

    /**
     * 对单个敌人结算伤害
     * - 战场 Boss：直接走受击 / 打断 / 战败流程
     * - 野外怪物：沿用 BattleSystem 的日志与击杀奖励流程
     * @param {Object} enemy
     * @param {number} damage
     * @param {string} label - 技能名
     * @returns {boolean} 是否成功结算
     */
    _applyDamage(enemy, damage, label) {
        if (!enemy || enemy.isAlive === false) return false;
        const player = this.player;

        if (typeof enemy.takeDamage === 'function' && (enemy.isArenaBoss || enemy.isBoss)) {
            return !!enemy.takeDamage(damage, player);
        }

        const battleSystem = this.main ? this.main.battleSystem : null;
        if (battleSystem && typeof battleSystem.dealDamageToEnemy === 'function') {
            battleSystem.dealDamageToEnemy(enemy, damage, player, label);
            return true;
        }

        if (typeof enemy.takeDamage === 'function') return !!enemy.takeDamage(damage, player);
        return false;
    }

    /**
     * 圆与矩形相交判定（与 ShanxiaoBoss.circleIntersectsRect 相同的算法）
     * @param {Object} center - 圆心 {x, y}
     * @param {number} radius
     * @param {Object} rect - {x, y, width, height}
     * @returns {boolean}
     */
    _circleIntersectsRect(center, radius, rect) {
        const closestX = Math.max(rect.x, Math.min(center.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));
        const dx = closestX - center.x;
        const dy = closestY - center.y;
        return dx * dx + dy * dy <= radius * radius;
    }

    /**
     * 矩形相交判定
     * @param {Object} a
     * @param {Object} b
     * @returns {boolean}
     */
    _rectsIntersect(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x
            && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    // ==================== 渲染 ====================

    /**
     * 下层特效：气场类（护体术 / 闪避）——位于角色之下、地图之上
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera
     */
    renderUnderLayer(ctx, camera) {
        this._renderEffectsByLayer(ctx, camera, 'under');
    }

    /**
     * 上层特效：剑气 / 灵息弹 / 命中特效——位于角色之上
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera
     */
    renderOverLayer(ctx, camera) {
        this._renderEffectsByLayer(ctx, camera, 'over');

        for (const projectile of this.projectiles) {
            if (projectile.render) projectile.render(ctx, camera);
        }
    }

    /**
     * 按图层渲染特效
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera
     * @param {string} layer - 'under' | 'over'
     */
    _renderEffectsByLayer(ctx, camera, layer) {
        for (const effect of this.effects) {
            if (effect && effect.layer === layer && effect.render) {
                effect.render(ctx, camera);
            }
        }
    }

    // ==================== 序列化 ====================

    /**
     * 序列化（存档）：只记录解锁状态，冷却 / 增益读档后重置
     * @returns {Object}
     */
    serialize() {
        return {
            unlockedOnce: this.unlockedOnce,
        };
    }

    /**
     * 反序列化（读档）
     * @param {Object} data
     */
    deserialize(data) {
        if (!data) return;
        this.unlockedOnce = !!data.unlockedOnce || this.unlockedOnce;
    }

    // ==================== HUD（气血 / 灵息 / 技能冷却 / 提示） ====================

    /**
     * 渲染战斗 HUD（解锁后常驻显示）
     * @param {CanvasRenderingContext2D} ctx
     */
    renderHud(ctx) {
        if (!this.isUnlocked()) return;

        const main = this.main;
        const player = this.player;
        const canvas = main && main.canvas;
        if (!main || !player || !player.playerData || !canvas) return;

        const scene = main.sceneManager ? main.sceneManager.getCurrentScene() : null;
        if (!scene || scene.sceneId !== 'gameWorld') return;

        const data = player.playerData;
        const width = canvas.width;
        const height = canvas.height;
        const hud = this.config.hud;
        const barScale = hud.scale > 0 ? hud.scale : 1;

        ctx.save();
        ctx.textBaseline = 'middle';

        // 气血条 / 灵息条（自定义图片：两图左上角对齐，先画内条再画外框；条上不显示数字）
        const manaY = hud.origin.y + hud.frameHeight * barScale + hud.lineGap;
        this._drawImageBar(ctx, hud.origin.x, hud.origin.y,
            data.health / Math.max(1, data.maxHealth),
            { frame: this.sprites.hudHealthFrame, fill: this.sprites.hudHealthFill });
        this._drawImageBar(ctx, hud.origin.x, manaY,
            data.mana / Math.max(1, data.maxMana),
            { frame: this.sprites.hudManaFrame, fill: this.sprites.hudManaFill });

        ctx.font = '12px Microsoft YaHei';
        ctx.textAlign = 'left';

        // 增益计时（护体术 / 闪避）——紧贴在灵息条下方
        let buffY = manaY + hud.frameHeight * barScale + 12;
        if (this.buffs.hutishu > 0) {
            ctx.fillStyle = '#7ef0a8';
            ctx.fillText('护体术 剩余 ' + this.buffs.hutishu.toFixed(1) + 's（减伤 '
                + Math.round(this.config.hutishu.damageReduction * 100) + '%）', hud.origin.x + 2, buffY);
            buffY += 18;
        }
        if (this.buffs.dodge > 0) {
            ctx.fillStyle = '#c8a6ff';
            ctx.fillText('闪避 剩余 ' + this.buffs.dodge.toFixed(1) + 's（移速 +'
                + Math.round(this.config.dodge.speedBonus * 100) + '%）', hud.origin.x + 2, buffY);
        }

        // 技能栏（教学期逐格解锁：只画出已完成的教学步骤对应的技能与冷却提示）
        this._renderSkillBar(ctx, width, height);

        // 提示（灵息不足 / 冷却中）
        if (this.toast.timer > 0 && this.toast.text) {
            ctx.font = 'bold 15px Microsoft YaHei';
            ctx.textAlign = 'center';
            const textWidth = ctx.measureText(this.toast.text).width;
            const toastX = width / 2;
            const toastY = height - 110;
            ctx.fillStyle = 'rgba(10, 16, 26, 0.78)';
            ctx.beginPath();
            ctx.roundRect(toastX - textWidth / 2 - 14, toastY - 15, textWidth + 28, 30, 8);
            ctx.fill();
            ctx.fillStyle = '#ffd873';
            ctx.fillText(this.toast.text, toastX, toastY);
        }

        ctx.restore();
    }

    /**
     * 渲染左下角技能栏（灵息弹 / 护体术 / 闪避：各自的 100×100 图片，格子上不写任何文字）
     * 规则（见 CONFIG.hud.skillBar）：
     *   1) order 决定格子顺序，且不含普通攻击 —— 普攻只走教学，左下角不显示（J 格已删除）；
     *   2) 只绘制"已解锁"的格子：教学期逐格解锁，教学完成后三格齐全；一格都没有时整条隐藏；
     *   3) 每格只画图片（不叠加文字）；冷却中只从格子顶部按下冷却遮罩；
     *   4) 图片缺失 / 尺寸不符 → 该格回退程序化方框（同样不写文字）。
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     */
    _renderSkillBar(ctx, canvasWidth, canvasHeight) {
        const bar = this.config.hud.skillBar;
        if (!bar || bar.enabled === false) return;

        const entries = (bar.order || [])
            .map(id => this.config[id])
            .filter(cfg => cfg && this.isSkillUnlocked(cfg.id));

        if (entries.length === 0) return;

        const scale = bar.scale > 0 ? bar.scale : 1;
        const slotSize = (bar.iconSize > 0 ? bar.iconSize : 100) * scale;
        const gap = typeof bar.gap === 'number' ? bar.gap : 12;
        const startX = typeof bar.startX === 'number' ? bar.startX : 18;
        const bottomMargin = typeof bar.bottomMargin === 'number' ? bar.bottomMargin : 30;
        const startY = canvasHeight - slotSize - bottomMargin;

        ctx.save();
        entries.forEach((cfg, index) => {
            this._drawSkillSlot(ctx, cfg, startX + index * (slotSize + gap), startY, slotSize);
        });
        ctx.restore();
    }

    /**
     * 绘制单个技能格（自定义图片 + 冷却遮罩；默认不写任何文字）
     * 文字默认全关（见 CONFIG.hud.skillBar.showKey / showCooldownText / showName）：按键字母、
     * 技能名与剩余秒数都由 100×100 美术图承担；图片不可用时用程序化方框兜底。
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} cfg - 技能配置（含 id / key / name / hudIcon）
     * @param {number} x - 格子左上角 X
     * @param {number} y - 格子左上角 Y
     * @param {number} slotSize - 格子边长（图片按此尺寸绘制）
     */
    _drawSkillSlot(ctx, cfg, x, y, slotSize) {
        const icon = this.sprites['skillIcon_' + cfg.id] || null;

        ctx.save();

        if (this._isSkillIconReady(icon, cfg)) {
            ctx.drawImage(icon, x, y, slotSize, slotSize);
        } else {
            // 美术未就位：程序化方框兜底（不写文字）
            ctx.fillStyle = 'rgba(12, 20, 32, 0.75)';
            ctx.fillRect(x, y, slotSize, slotSize);
            ctx.strokeStyle = 'rgba(170, 214, 255, 0.45)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, slotSize - 1, slotSize - 1);
        }

        const remaining = this.cooldowns[cfg.id] || 0;
        const cooling = remaining > 0 && cfg.cooldown > 0;

        // 冷却遮罩：从格子顶部按剩余比例压下
        if (cooling) {
            const ratio = Math.max(0, Math.min(1, remaining / cfg.cooldown));
            ctx.fillStyle = 'rgba(6, 10, 18, 0.72)';
            ctx.fillRect(x, y, slotSize, slotSize * ratio);
        }

        const bar = this.config.hud.skillBar || {};
        const centerX = x + slotSize / 2;

        // 按键字母（就绪）/ 剩余秒数（冷却中）：默认都不画，只在开关打开时补上（调试用）
        if (bar.showKey === true || (cooling && bar.showCooldownText === true)) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const centerY = y + slotSize / 2;
            if (cooling) {
                ctx.fillStyle = '#ffd873';
                ctx.font = 'bold ' + Math.round(slotSize * 0.32) + 'px Microsoft YaHei';
                ctx.fillText(remaining >= 10 ? Math.ceil(remaining) + 's' : remaining.toFixed(1) + 's',
                    centerX, centerY);
            } else {
                ctx.fillStyle = '#f2f7ff';
                ctx.font = 'bold ' + Math.round(slotSize * 0.42) + 'px Microsoft YaHei';
                ctx.fillText(cfg.key.toUpperCase(), centerX, centerY);
            }
        }

        // 技能名（画在格子下方，不压在美术图上；CONFIG.hud.skillBar.showName = true 时才画）
        if (bar.showName === true) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#9fb6d0';
            ctx.font = '10px Microsoft YaHei';
            ctx.fillText(cfg.name, centerX, y + slotSize + 13);
        }

        ctx.restore();
    }

    /**
     * 技能栏图标是否可用（可用 = 已加载且尺寸恰好等于 CONFIG.hud.skillBar.iconSize 的正方形）
     * 未加载完（undefined / null）时静默回退；尺寸不符（含 32×32 品红占位图）时每个技能只提示一次。
     * @param {Image} image
     * @param {Object} cfg - 技能配置（仅用于日志名称）
     * @returns {boolean}
     */
    _isSkillIconReady(image, cfg) {
        if (!image) return false;

        const size = this.config.hud.skillBar.iconSize;
        const w = image.naturalWidth || image.width || 0;
        const h = image.naturalHeight || image.height || 0;
        if (w === size && h === size) return true;

        const warnKey = cfg ? cfg.id : 'unknown';
        if (this._skillIconWarnings && !this._skillIconWarnings.has(warnKey)) {
            this._skillIconWarnings.add(warnKey);
            console.warn('[PlayerCombat] 技能栏图标不可用，该格回退程序化方框：'
                + (cfg ? cfg.hudIcon : '') + ' 期望 ' + size + '×' + size
                + '，实际 ' + w + '×' + h + '（请检查 assets/images/ui/skill_*.png）');
        }
        return false;
    }

    /**
     * 用图片绘制一条资源条（气血条 / 灵息条，两者逻辑完全一致）
     * 规则：
     *   1) 外框与内条左上角对齐（同一个 x/y）；先画内条，再把外框盖在其上；
     *   2) 内条只取源图 X = 0 → fillStartX + ratio × (fillWidth - fillStartX)：
     *      X∈[0, fillStartX)（本套美术 = [0, 78)）是左侧固定装饰，始终可见；
     *      X∈[fillStartX, fillWidth)（= [78, 454)）才是真实数值像素，按当前值比例显示，
     *      即绘制宽度 = 78 + h/H × (454 - 78)：满血 454（整张）、半血 266、空血 78；
     *   3) 条上不绘制任何数字；图片不可用（未加载 / 尺寸不符 / 占位图）时返回 false 且不绘制。
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - 外框（同时也是内条）左上角 X
     * @param {number} y - 外框（同时也是内条）左上角 Y
     * @param {number} ratio - 当前值 / 上限（0~1，越界自动夹紧）
     * @param {Object} images - { frame, fill }
     * @returns {boolean} 是否完成绘制
     */
    _drawImageBar(ctx, x, y, ratio, images) {
        const cfg = this.config.hud;
        const frame = images ? images.frame : null;
        const fill = images ? images.fill : null;

        if (!this._isBarImageReady(frame, cfg.frameWidth, cfg.frameHeight, '外框')) return false;
        if (!this._isBarImageReady(fill, cfg.fillWidth, cfg.fillHeight, '内条')) return false;

        const scale = cfg.scale > 0 ? cfg.scale : 1;
        const safeRatio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
        // 内条可见像素宽度 = 左侧固定装饰（X∈[0,78)）+ 真实数值像素（X∈[78,454) 中按比例的部分）
        // 即 X = 0 → 78 + h/H × (454 - 78)
        const visibleWidth = cfg.fillStartX + safeRatio * (cfg.fillWidth - cfg.fillStartX);

        // 1) 内条：只绘制源图 X = 0 → visibleWidth 范围内的像素
        if (visibleWidth > 0) {
            ctx.drawImage(fill, 0, 0, visibleWidth, cfg.fillHeight,
                x, y, visibleWidth * scale, cfg.fillHeight * scale);
        }

        // 2) 外框：与内条左上角对齐，覆盖在内条之上
        ctx.drawImage(frame, x, y, cfg.frameWidth * scale, cfg.frameHeight * scale);
        return true;
    }

    /**
     * 气血条 / 灵息条图片是否可用
     * 尺寸必须与规格完全吻合：未加载（undefined）、加载失败的 32×32 占位图、
     * 或者美术导出的尺寸与 CONFIG.hud 不一致时都判为不可用，由调用方跳过绘制。
     * @param {Image} image
     * @param {number} width - 期望宽度
     * @param {number} height - 期望高度
     * @param {string} label - 日志名称（外框 / 内条）
     * @returns {boolean}
     */
    _isBarImageReady(image, width, height, label) {
        if (!image) return false;

        const w = image.naturalWidth || image.width || 0;
        const h = image.naturalHeight || image.height || 0;
        if (w === width && h === height) return true;

        // 尺寸不符：同一张图只提示一次，避免每帧刷屏
        const warnKey = label + '@' + width + 'x' + height;
        if (this._barSpriteWarnings && !this._barSpriteWarnings.has(warnKey)) {
            this._barSpriteWarnings.add(warnKey);
            console.warn('[PlayerCombat] ' + label + '图片尺寸不符：期望 ' + width + '×' + height
                + '，实际 ' + w + '×' + h
                + '（请检查 assets/images/ui/ 下的 health_bar_* / mana_bar_* 图片；尺寸不符时该条不绘制）');
        }
        return false;
    }
}

if (typeof window !== 'undefined') {
    window.PlayerCombatSystem = PlayerCombatSystem;
}
