/**
 * 摄风山魈（主线四 Boss）
 *
 * 与普通怪物（Monster）/通用 Boss（Boss.js）的区别：
 * - 专属美术规格：7 张精灵图，多方向图为 4 行 × 6 帧、单帧 96×96，行序为 下/左/右/上；
 *   战败图为单行 6 帧（不区分方向）。
 * - 移动：只允许上下左右（轴对齐），用 AStar.findAxisAlignedPath 在碰撞网格上寻路。
 * - 行为：行为树（选择器）按优先级挑选动作，动作带“最短持续时间”，避免同一帧内反复切换；
 *   追击带最长移动时间与“进入攻击范围即停”条件。
 * - 技能：
 *   横扫（attack 动画）—— 可被受击打断；动画推进到命中帧后判定一次圆形范围伤害；
 *   蓄力（skill2 动画）—— 可被受击打断；播放期间生成风旋特效（绘制在 Boss 之上），
 *                        完成后置“蓄力完成”标记，强化下一次扑击；
 *   扑击（skill1 动画）—— 不可被打断：受到伤害照常结算，但不播放受击动画、继续当前动作；
 *                        动画结束时落地生成扬尘特效 + 圆形范围伤害，并清除“蓄力完成”标记。
 * - 受击：正在播放受击动画时再次受击 → 延迟到本次受击动画结束后重播一次（不丢帧、不叠加）。
 * - 战败：战败动画播完后停在最后一帧（继续渲染），并触发 onDeath。
 *
 * 依赖：GameConfig / ResourceManager / AnimationManager / Animation / AStar
 */

/**
 * 战斗特效实例（扬尘 / 风旋）
 * 单行精灵图（frameCount 帧），可跟随宿主（如蓄力时的风旋跟随 Boss 身体）
 */
class ShanxiaoBossEffect {
    /**
     * @param {Object} config
     * @param {string} config.name - 特效名称（仅用于调试）
     * @param {Image} config.spriteSheet - 精灵图
     * @param {number} [config.frameWidth=48] - 单帧宽
     * @param {number} [config.frameHeight=48] - 单帧高
     * @param {number} [config.frameCount=6] - 帧数（单行，从左到右）
     * @param {number} [config.fps=14] - 播放帧率
     * @param {boolean} [config.loop=false] - 是否循环
     * @param {Object} config.position - 世界坐标（中心）{x, y}
     * @param {number} [config.scale=1] - 缩放
     * @param {number} [config.alpha=1] - 透明度
     * @param {Object} [config.follow] - 跟随对象（需有 position），如 Boss
     * @param {Object} [config.offset] - 相对跟随对象的偏移 {x, y}
     */
    constructor(config = {}) {
        this.name = config.name || 'effect';
        this.spriteSheet = config.spriteSheet || null;
        this.frameWidth = config.frameWidth || 48;
        this.frameHeight = config.frameHeight || 48;
        this.frameCount = config.frameCount || 6;
        this.fps = config.fps || 14;
        this.loop = config.loop === true;
        this.position = {
            x: (config.position && config.position.x) || 0,
            y: (config.position && config.position.y) || 0,
        };
        this.scale = config.scale || 1;
        this.alpha = config.alpha !== undefined ? config.alpha : 1;
        this.follow = config.follow || null;
        this.offset = config.offset || { x: 0, y: 0 };

        // 播放状态
        this.currentFrame = 0;
        this.elapsedTime = 0;
        this.frameInterval = 1 / this.fps;
        this.isFinished = false;
    }

    /**
     * 更新特效（跟随时同步宿主位置）
     * @param {number} deltaTime
     * @returns {boolean} 是否仍然存活
     */
    update(deltaTime) {
        if (this.isFinished) {
            return false;
        }

        // 跟随宿主
        if (this.follow && this.follow.position) {
            this.position.x = this.follow.position.x + this.offset.x;
            this.position.y = this.follow.position.y + this.offset.y;
        }

        this.elapsedTime += deltaTime;
        if (this.elapsedTime >= this.frameInterval) {
            const advance = Math.floor(this.elapsedTime / this.frameInterval);
            this.elapsedTime -= advance * this.frameInterval;
            this.currentFrame += advance;

            if (this.currentFrame >= this.frameCount) {
                if (this.loop) {
                    this.currentFrame = this.currentFrame % this.frameCount;
                } else {
                    this.currentFrame = this.frameCount - 1;
                    this.isFinished = true;
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 渲染特效（以 position 为中心，绘制在 Boss 之上）
     */
    render(ctx, camera) {
        if (!this.spriteSheet) return;

        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const drawWidth = this.frameWidth * this.scale;
        const drawHeight = this.frameHeight * this.scale;
        const screenX = this.position.x - renderPos.x - drawWidth / 2;
        const screenY = this.position.y - renderPos.y - drawHeight / 2;

        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.drawImage(
            this.spriteSheet,
            this.currentFrame * this.frameWidth,
            0,
            this.frameWidth,
            this.frameHeight,
            screenX,
            screenY,
            drawWidth,
            drawHeight
        );
        ctx.restore();
    }
}

class ShanxiaoBoss {
    /** 精灵图单帧尺寸（美术规格：96×96） */
    static get FRAME_SIZE() { return 96; }

    /** 多方向精灵图的行序：下/左/右/上（与美术约定一致，勿随意调整） */
    static get DIRECTION_ROWS() {
        return { down: 0, left: 1, right: 2, up: 3 };
    }

    /** 多方向动画的帧数 */
    static get DIRECTION_FRAMES() { return 6; }

    /** 战败图帧数（单行） */
    static get DEAD_FRAMES() { return 6; }

    /**
     * 山魈数值唯一来源（Single Source of Truth）。
     * Chapter1Config 的 bossPosition[...].tuning 仅用于「按章节覆盖」个别字段，
     * 不再逐条重复本表——改数值只需改这里一处。
     */
    static get DEFAULT_TUNING() {
        return {
            moveSpeed: 120,          // 追击速度（像素/秒）
            pounceSpeed: 460,        // 扑击速度（像素/秒）
            pounceSpeedCharged: 600, // 蓄力后扑击速度（像素/秒）
            pounceDurationScale: 1,  // 扑击动画时长倍数（蓄力扑击会额外乘 1.15）
            sweepRadius: 120,        // 横扫判定圆半径
            pounceRadius: 130,       // 扑击落点判定圆半径
            bodyWidth: 56,           // 碰撞盒（脚下）宽
            bodyHeight: 40,          // 碰撞盒（脚下）高
            hitBoxSize: 80,          // 被玩家攻击时的受击盒边长
            scale: 1,                // 精灵图缩放
            aggroRange: 620,         // 仇恨/察觉范围
            keepDistance: 76,        // 与玩家保持的最小距离（避免贴脸重叠）
            attackStopRange: 108,    // 进入该距离即停止追击，准备出手
            maxMoveTime: 2.4,        // 单次追击最长持续时间（秒）
            idleDuration: 0.45,      // 待机最短持续时间（秒）
            decisionInterval: 0.12,  // 行为树评估间隔（秒）
            sweepDuration: 0.6,      // 横扫动画时长（6 帧 @10fps）
            chargeDuration: 0.75,    // 蓄力动画时长（6 帧 @8fps）
            pounceDuration: 0.5,     // 扑击动画时长（6 帧 @12fps）
            hurtDuration: 0.4,       // 受击最短僵直（动画结束即退出）
            sweepHitFrame: 3,        // 横扫在第几帧（0 起）结算伤害
            pounceHitFrame: 3,       // 扑击在第几帧（0 起）结算落地伤害与扬尘
            cooldownSweep: 2.2,      // 横扫冷却（秒）
            cooldownCharge: 6.5,     // 蓄力冷却（秒）
            cooldownPounce: 4.5,     // 扑击冷却（秒）
            pounceTriggerRange: 300, // 中距离直接扑击的触发距离
            chargeRangeMax: 520,     // 玩家远于此距离时优先蓄力（便于读招）
            debugHitboxes: false,    // 调试：绘制判定圆
        };
    }

    /**
     * @param {Object} config
     * @param {string} config.id - 唯一 ID
     * @param {string} config.monsterId - 配置 ID（GameConfig.monsters 中的键）
     * @param {Object} config.position - 初始位置（世界坐标，精灵图中心）
     * @param {Object} [config.tuning] - 覆盖 DEFAULT_TUNING 的数值
     */
    constructor(config = {}) {
        // ========== 基本信息 ==========
        this.id = config.id || 'boss_shanxiao';
        this.monsterId = config.monsterId || 'boss_shanxiao';
        this.isBoss = true;
        this.isArenaBoss = config.isArenaBoss !== false;   // 战场 Boss：不参与野外“按 E 切磋”
        this.isDestroyed = false;
        this.releaseResources = config.releaseResources !== false;   // destroy() 时是否释放精灵图缓存

        // ========== 配置 ==========
        const gameConfig = GameConfig.getInstance();
        this.monsterConfig = gameConfig.getMonster(this.monsterId) || {};
        this.tuning = Object.assign({}, ShanxiaoBoss.DEFAULT_TUNING, config.tuning || {});

        // ========== 属性 ==========
        // 数值一律来自章节配置（Chapter1Config.boss_shanxiao），兜底取 GameConfig.monsterDefaults
        const monDefaults = gameConfig.getMonsterDefaults();
        this.realm = this.monsterConfig.realm || 'lianqi';
        this.maxHealth = config.maxHealth || this.monsterConfig.health || monDefaults.health;
        this.health = this.maxHealth;
        this.damage = config.damage || this.monsterConfig.damage || monDefaults.damage;
        this.defense = config.defense || this.monsterConfig.defense || monDefaults.defense;
        this.expReward = this.monsterConfig.expReward || monDefaults.expReward;
        this.lingShiReward = this.monsterConfig.lingShiReward || monDefaults.lingShiReward;
        this.drops = this.monsterConfig.drops || this.monsterConfig.dropItems || [];

        // ========== 位置 / 碰撞 ==========
        this.position = {
            x: (config.position && config.position.x) || 0,
            y: (config.position && config.position.y) || 0,
        };
        this.spawnPosition = { x: this.position.x, y: this.position.y };
        this.facing = 'down';
        this.width = this.tuning.bodyWidth;
        this.height = this.tuning.bodyHeight;

        // ========== 状态 ==========
        this.isAlive = true;
        this.isInBattle = true;      // 战场 Boss 始终视为战斗中
        this.isMoving = false;
        this.isHit = false;          // 受击闪烁
        this.hitFlashTimer = 0;
        this.hitFlashDuration = 0.14;

        // 行为树 / 动作
        this.action = 'idle';        // idle | move | sweep | charge | pounce | hurt | dead
        this.actionTime = 0;
        this.actionMinDuration = this.tuning.idleDuration;
        this.decisionTimer = 0;
        this.unreachableTimer = 0;   // 连续无法寻路的时间（避免无限重算）
        this.hitFrameApplied = false;// 当前动作的命中帧是否已结算

        // 技能冷却
        this.cooldowns = { sweep: 0, charge: 0, pounce: 0 };

        // 蓄力标记：蓄力完成后强化下一次扑击（扑击结束后清除）
        this.isCharged = false;
        this.chargeWindEffect = null;

        // 受击延迟重播（正在受击时再次受击）
        this.hurtQueued = false;

        // 战败
        this.deathAnimationFinished = false;

        // ========== 寻路 ==========
        this.path = [];
        this.pathIndex = 0;

        // ========== 表现 ==========
        this.effects = [];
        this.effectSheets = {};      // { boss_pounce_dust: Image, boss_charge_wind: Image }
        this.showHitCircle = config.showHitCircle !== false;   // 攻击范围提示圈
        this.arenaBounds = null;     // 由外部注入的可行走矩形（可选，默认用地图尺寸）

        // ========== 回调 ==========
        this.onDeath = null;             // (boss) => void（战败动画播放完毕）
        this.onActionChange = null;      // (boss, action, previous) => void
        this.onAttackLand = null;        // (boss, action, hitPlayer) => void
        this.onDamageTaken = null;       // (boss, damage) => void
        this.onEffectSpawn = null;       // (boss, effectName) => void

        // ========== 动画 ==========
        this.animationManager = config.animationManager || new AnimationManager();
        this.animationsReady = false;
        this.initAnimations();

        // ========== 行为树 ==========
        this.behaviorTree = this.buildBehaviorTree();

        this.animationManager.setDirection(this.facing);
    }

    // ==================== 动画初始化 ====================

    /**
     * 初始化 7 套动画
     * 规格：多方向图为 4 行（下/左/右/上）× 6 帧、单帧 96×96；战败图为单行 6 帧。
     * 精灵图异步加载，加载前动画对象已登记（渲染时会自动跳过无图的帧）。
     */
    initAnimations() {
        const resourceManager = ResourceManager.getInstance();
        const prefix = `monsters.${this.monsterId}`;
        const frameSize = ShanxiaoBoss.FRAME_SIZE;
        const rows = ShanxiaoBoss.DIRECTION_ROWS;
        const frameCount = ShanxiaoBoss.DIRECTION_FRAMES;

        // 四个方向的行配置（同一份对象可被多套动画共享）
        const directions = {};
        Object.keys(rows).forEach(dir => {
            directions[dir] = { row: rows[dir], frames: frameCount };
        });

        // 动画规格表：name 为逻辑名，key 为资源键
        this.animationSpecs = [
            { name: 'idle',   key: `${prefix}_idle`,   fps: 6,  loop: true,  directional: true },  // 待机
            { name: 'walk',   key: `${prefix}_walk`,   fps: 10, loop: true,  directional: true },  // 移动
            { name: 'sweep',  key: `${prefix}_attack`, fps: 10, loop: false, directional: true },  // 横扫
            { name: 'pounce', key: `${prefix}_skill1`, fps: 12, loop: false, directional: true },  // 扑击
            { name: 'charge', key: `${prefix}_skill2`, fps: 8,  loop: false, directional: true },  // 蓄力
            { name: 'hurt',   key: `${prefix}_hurt`,   fps: 10, loop: false, directional: true },  // 受击
            { name: 'dead',   key: `${prefix}_dead`,   fps: 8,  loop: false, directional: false }, // 战败
        ];

        this.animationSpecs.forEach(spec => {
            const animation = new Animation({
                name: spec.name,
                spriteSheet: null,
                frameWidth: frameSize,
                frameHeight: frameSize,
                directionMode: 'row',
                directions: spec.directional
                    ? directions
                    : { down: { row: 0, frames: ShanxiaoBoss.DEAD_FRAMES } },
                fps: spec.fps,
                loop: spec.loop,
                defaultDirection: 'down',
            });
            this.animationManager.addAnimation(spec.name, animation);
        });

        // 异步补齐精灵图
        this.animationsPromise = Promise.all(this.animationSpecs.map(async spec => {
            const image = await resourceManager.loadImage(spec.key);
            const animation = this.animationManager.getAnimation(spec.name);
            if (animation) {
                animation.spriteSheet = image;
            }
        })).then(() => {
            this.animationsReady = true;
            this.loadEffectSheets();
        }).catch(error => {
            console.warn(`[摄风山魈] 动画资源加载异常: ${error && error.message}`);
        });
    }

    /**
     * 加载战斗特效精灵图（扬尘 / 风旋）
     */
    loadEffectSheets() {
        const resourceManager = ResourceManager.getInstance();
        const keys = {
            boss_pounce_dust: 'effects.boss_pounce_dust',
            boss_charge_wind: 'effects.boss_charge_wind',
        };

        Object.keys(keys).forEach(name => {
            resourceManager.loadImage(keys[name]).then(image => {
                this.effectSheets[name] = image;
            }).catch(() => {
                // 特效资源缺失时静默跳过：不影响战斗逻辑
            });
        });
    }

    // ==================== 行为树 ====================

    /**
     * 构建行为树
     * 结构：选择器（root）→ 依次尝试子节点，命中即执行并结束本次评估。
     * 叶子节点：condition 通过（未定义视为通过）后执行 action，action 返回 true 视为成功。
     * @returns {Object} 行为树根节点
     */
    buildBehaviorTree() {
        const t = this.tuning;
        return {
            type: 'selector',
            name: 'root',
            children: [
                {
                    name: '战败',
                    condition: (boss) => !boss.isAlive,
                    action: (boss) => boss.enterDead(),
                },
                {
                    name: '受击（打断可打断动作）',
                    condition: (boss) => boss.hurtQueued && boss.canBeInterrupted(),
                    action: (boss) => boss.startHurt(),
                },
                {
                    name: '扑击·蓄力强化',
                    condition: (boss) => boss.isCharged && boss.cooldowns.pounce <= 0 && boss.hasTarget(),
                    action: (boss) => boss.startPounce(true),
                },
                {
                    name: '横扫（近身）',
                    condition: (boss) => boss.cooldowns.sweep <= 0 && boss.hasTarget()
                        && boss.getTargetDistance() <= t.sweepRadius * 0.9,
                    action: (boss) => boss.startSweep(),
                },
                {
                    name: '扑击（中距离突进）',
                    condition: (boss) => boss.cooldowns.pounce <= 0 && boss.hasTarget()
                        && boss.getTargetDistance() > t.sweepRadius * 0.9
                        && boss.getTargetDistance() <= t.pounceTriggerRange,
                    action: (boss) => boss.startPounce(false),
                },
                {
                    name: '蓄力（未强化时积攒下一击）',
                    condition: (boss) => boss.cooldowns.charge <= 0 && !boss.isCharged
                        && boss.hasTarget() && boss.getTargetDistance() <= t.chargeRangeMax,
                    action: (boss) => boss.startCharge(),
                },
                {
                    name: '追击（接近玩家）',
                    condition: (boss) => boss.hasTarget() && boss.getTargetDistance() > t.attackStopRange,
                    action: (boss) => boss.startMove(),
                },
                {
                    name: '待机（等待冷却）',
                    action: (boss) => boss.startIdle(),
                },
            ],
        };
    }

    /**
     * 运行行为树一次
     * @returns {boolean} 是否成功执行了某个动作
     */
    runBehaviorTree() {
        return this.runNode(this.behaviorTree);
    }

    /**
     * 递归执行行为树节点
     * @param {Object} node - 节点
     * @returns {boolean} 是否成功
     */
    runNode(node) {
        if (!node) return false;

        if (Array.isArray(node.children) && node.children.length > 0) {
            for (const child of node.children) {
                if (this.runNode(child)) {
                    return true;
                }
            }
            return false;
        }

        if (node.condition && !node.condition(this)) {
            return false;
        }
        if (!node.action) {
            return false;
        }

        node.action(this);
        return true;
    }

    /**
     * 当前动作是否可以重新决策（防止每帧乱切动作）
     * - idle：达到最短待机时长
     * - sweep / charge / hurt：当前动画播放完毕
     * - move：由移动逻辑自行结束（到达 / 超时 / 无路径）
     * - pounce：不可打断，必须等动画播完
     * @returns {boolean}
     */
    canDecide() {
        if (!this.isAlive) return false;

        // 受击打断不受“最短动作时长”限制：
        // 横扫 / 蓄力 / 移动 / 待机 一旦排队受击，立即允许行为树重新决策
        if (this.hurtQueued && this.canBeInterrupted()) {
            return true;
        }

        switch (this.action) {
            case 'idle':
                return this.actionTime >= this.actionMinDuration;
            case 'sweep':
            case 'charge':
            case 'hurt':
                return this.isCurrentAnimationFinished();
            case 'move':
            case 'pounce':
                return false;
            default:
                return this.actionTime >= this.actionMinDuration;
        }
    }

    /**
     * 当前动作是否可被受击打断（扑击不可打断）
     * @returns {boolean}
     */
    canBeInterrupted() {
        return this.action === 'idle' || this.action === 'move'
            || this.action === 'sweep' || this.action === 'charge';
    }

    /**
     * 当前动画是否已播放完毕
     * @returns {boolean}
     */
    // ==================== 主更新 ====================

    /**
     * 每帧更新（GameLoop 会对 currentMap.monsters 统一调用）
     * @param {number} deltaTime - 时间增量（秒）
     * @param {GameMap} [map] - 当前地图
     */
    update(deltaTime, map) {
        if (this.isDestroyed) return;

        if (map) {
            this.map = map;
            if (map.tileSize) {
                this.tileSize = map.tileSize;
            }
        }

        this.updateTimers(deltaTime);
        this.updateEffects(deltaTime);
        this.updateHitFlash(deltaTime);

        if (this.isAlive) {
            this.updateAction(deltaTime);

            // 行为树按固定间隔评估，且只允许在动作结束后切换（动作最短持续时间）；
            // 受击打断例外：排队受击时立即重新决策，保证打断手感（不受节流限制）
            const interruptPending = this.hurtQueued && this.canBeInterrupted();

            this.decisionTimer -= deltaTime;
            if (this.decisionTimer <= 0 || interruptPending) {
                this.decisionTimer = this.tuning.decisionInterval;
                if (this.canDecide()) {
                    this.runBehaviorTree();
                }
            }
        } else {
            this.updateDeath();
        }

        this.animationManager.update(deltaTime);
    }

    /**
     * 冷却计时
     */
    updateTimers(deltaTime) {
        ['sweep', 'charge', 'pounce'].forEach(key => {
            if (this.cooldowns[key] > 0) {
                this.cooldowns[key] = Math.max(0, this.cooldowns[key] - deltaTime);
            }
        });
    }

    /**
     * 受击闪烁计时
     */
    updateHitFlash(deltaTime) {
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer = Math.max(0, this.hitFlashTimer - deltaTime);
            this.isHit = this.hitFlashTimer > 0;
        }
    }

    /**
     * 更新并清理特效
     */
    updateEffects(deltaTime) {
        if (this.effects.length === 0) return;

        this.effects = this.effects.filter(effect => effect.update(deltaTime));

        if (this.chargeWindEffect && this.effects.indexOf(this.chargeWindEffect) === -1) {
            this.chargeWindEffect = null;
        }
    }

    // ==================== 目标 ====================

    /**
     * 获取当前目标（优先缓存，其次取地图上的玩家）
     * @returns {Object|null}
     */
    getTarget() {
        if (this.target && this.target.isAlive !== false) {
            return this.target;
        }

        if (this.map && this.map.player && this.map.player.isAlive !== false) {
            this.target = this.map.player;
            return this.target;
        }

        return null;
    }

    /**
     * 是否存在有效目标
     * @returns {boolean}
     */
    hasTarget() {
        return !!this.getTarget();
    }

    /**
     * 与目标的距离（无目标返回 Infinity）
     * @returns {number}
     */
    getTargetDistance() {
        const target = this.getTarget();
        if (!target || !target.position) return Infinity;
        return this.getDistanceTo(target.position);
    }

    /**
     * 到某点的距离
     * @param {Object} point - {x, y}
     * @returns {number}
     */
    getDistanceTo(point) {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 面向目标（移动/待机时朝向玩家）
     * @param {Object} point - {x, y}
     */
    facePoint(point) {
        if (!point) return;

        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        const facing = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');

        if (facing !== this.facing) {
            this.facing = facing;
        }
        this.animationManager.setDirection(this.facing);
    }

    /**
     * 按移动方向设置朝向（轴对齐，只会有上下左右）
     * @param {number} dx
     * @param {number} dy
     */
    faceDirection(dx, dy) {
        if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx !== 0) this.facing = dx > 0 ? 'right' : 'left';
        } else if (dy !== 0) {
            this.facing = dy > 0 ? 'down' : 'up';
        }
        this.animationManager.setDirection(this.facing);
    }

    /**
     * 当前动画是否已播放完毕
     * @returns {boolean}
     */
    isCurrentAnimationFinished() {
        const animation = this.animationManager.getCurrentAnimation();
        return !!(animation && animation.isFinished);
    }

    // ==================== 动作切换 ====================

    /**
     * 切换动作（记录上一动作并触发回调）
     * @param {string} action - 动作名
     * @param {number} minDuration - 最短持续时间（秒）
     */
    changeAction(action, minDuration) {
        const changed = this.action !== action;
        const previous = this.action;

        this.action = action;
        this.actionTime = 0;
        this.actionMinDuration = minDuration !== undefined ? minDuration : 0;
        this.hitFrameApplied = false;   // 命中帧在每次动作开始时重新计算

        if (changed && this.onActionChange) {
            this.onActionChange(this, action, previous);
        }

        return changed;
    }

    /**
     * 待机
     * 已在待机且当前播放的就是待机动画时不重启动画（避免待机反复回到第一帧）
     * @param {number} [minDuration] - 最短待机时长
     */
    startIdle(minDuration) {
        const changed = this.changeAction('idle', minDuration !== undefined ? minDuration : this.tuning.idleDuration);
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;

        const idleAnimation = this.animationManager.getAnimation('idle');
        if (changed || this.animationManager.getCurrentAnimation() !== idleAnimation) {
            this.playAnimation('idle', true);
        }
    }

    /**
     * 开始追击（行为树节点：追击）
     */
    startMove() {
        this.changeAction('move', this.tuning.maxMoveTime);
        this.isMoving = true;
        this.repathToTarget();
        this.playAnimation('walk', true);
    }

    // ==================== 动作推进 ====================

    /**
     * 推进当前动作
     * @param {number} deltaTime
     */
    updateAction(deltaTime) {
        this.actionTime += deltaTime;

        switch (this.action) {
            case 'idle':   this.updateIdle(deltaTime); break;
            case 'move':   this.updateMove(deltaTime); break;
            case 'sweep':  this.updateSweep(deltaTime); break;
            case 'charge': this.updateCharge(deltaTime); break;
            case 'pounce': this.updatePounce(deltaTime); break;
            case 'hurt':   this.updateHurt(deltaTime); break;
            default: break;
        }
    }

    /**
     * 待机：面朝玩家
     */
    updateIdle() {
        const target = this.getTarget();
        if (target && target.position) {
            this.facePoint(target.position);
        }
    }

    /**
     * 追击：沿轴对齐路径接近玩家
     * 结束条件：进入攻击范围 / 超过最长追击时间 / 无法寻路
     * @param {number} deltaTime
     */
    updateMove(deltaTime) {
        const target = this.getTarget();
        if (!target || !target.position) {
            this.startIdle();
            return;
        }

        const distance = this.getTargetDistance();

        // 结束条件一：已进入攻击范围 → 停下出手
        if (distance <= this.tuning.attackStopRange) {
            this.startIdle(0.05);
            return;
        }

        // 结束条件二：超过单次追击最长持续时间
        if (this.actionTime >= this.tuning.maxMoveTime) {
            this.startIdle(0.05);
            return;
        }

        // 贴太近时不再前压，只调整朝向（避免与玩家模型重叠）
        if (distance <= this.tuning.keepDistance) {
            this.facePoint(target.position);
            return;
        }

        // 路径为空 → 重新寻路
        if (!this.path || this.pathIndex >= this.path.length) {
            this.repathToTarget();
            if (!this.path || this.path.length === 0) {
                this.unreachableTimer += deltaTime;
                if (this.unreachableTimer >= 0.4) {
                    this.unreachableTimer = 0;
                    this.startIdle(0.2);
                }
                return;
            }
            this.unreachableTimer = 0;
        }

        const waypoint = this.path[this.pathIndex];
        if (!waypoint) {
            this.startIdle(0.05);
            return;
        }

        const dx = waypoint.x - this.position.x;
        const dy = waypoint.y - this.position.y;

        // 到达路径点 → 推进到下一个
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            this.pathIndex++;
            return;
        }

        // 轴对齐推进：路径点与当前位置同行或同列，因此只有一个轴有效
        const step = this.tuning.moveSpeed * deltaTime;
        let moveX = 0;
        let moveY = 0;
        if (Math.abs(dx) >= Math.abs(dy)) {
            moveX = Math.sign(dx) * Math.min(step, Math.abs(dx));
        } else {
            moveY = Math.sign(dy) * Math.min(step, Math.abs(dy));
        }

        if (!this.tryMove(moveX, moveY)) {
            // 被挡住：重新寻路；连续受阻则原地待机（避免卡墙抖动）
            this.unreachableTimer += deltaTime;
            this.repathToTarget();
            if (this.unreachableTimer >= 0.6) {
                this.unreachableTimer = 0;
                this.startIdle(0.2);
            }
            return;
        }

        this.unreachableTimer = 0;
        this.faceDirection(moveX, moveY);
    }

    // ==================== 寻路 / 碰撞 ====================

    /**
     * 重新计算到玩家当前位置的轴对齐路径
     */
    repathToTarget() {
        const target = this.getTarget();

        if (!target || !target.position || !this.map || !this.map.getWalkableGrid) {
            this.path = [];
            this.pathIndex = 0;
            return;
        }

        const grid = this.map.getWalkableGrid();
        if (!grid || grid.length === 0) {
            this.path = [];
            this.pathIndex = 0;
            return;
        }

        const path = AStar.findAxisAlignedPath(
            this.position,
            { x: target.position.x, y: target.position.y },
            grid,
            this.tileSize
        ) || [];

        // 丢弃与当前位置几乎重合的首个路径点（避免先退回去对齐瓦片中心）
        while (path.length > 0 && this.getDistanceTo(path[0]) < 2) {
            path.shift();
        }

        this.path = path;
        this.pathIndex = 0;
    }

    /**
     * 尝试按 (dx, dy) 移动（轴对齐，不做斜向）
     * @param {number} dx - x 方向位移
     * @param {number} dy - y 方向位移
     * @returns {boolean} 是否成功移动
     */
    tryMove(dx, dy) {
        if (dx === 0 && dy === 0) return false;

        const nextX = this.position.x + dx;
        const nextY = this.position.y + dy;

        if (!this.isInsideMap(nextX, nextY)) {
            return false;
        }

        // 碰撞检测：脚下碰撞盒必须落在可通行瓦片上
        if (this.map && this.map.isRectWalkable) {
            const rect = this.getFootRect({ x: nextX, y: nextY });
            if (!this.map.isRectWalkable(rect)) {
                return false;
            }
        }

        this.position.x = nextX;
        this.position.y = nextY;
        return true;
    }

    /**
     * 目标位置是否在地图范围内
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isInsideMap(x, y) {
        if (this.arenaBounds) {
            return x >= this.arenaBounds.minX && x <= this.arenaBounds.maxX
                && y >= this.arenaBounds.minY && y <= this.arenaBounds.maxY;
        }

        if (this.map && this.map.mapWidth && this.map.mapHeight && this.map.tileSize) {
            const rect = this.getFootRect({ x, y });
            return rect.x >= 0 && rect.y >= 0
                && rect.x + rect.width <= this.map.mapWidth * this.map.tileSize
                && rect.y + rect.height <= this.map.mapHeight * this.map.tileSize;
        }

        return true;
    }

    /**
     * 脚下碰撞盒（世界坐标，精灵图下缘对齐）
     * @param {Object} [position] - 指定位置，默认当前位置
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getFootRect(position) {
        const pos = position || this.position;
        const frameSize = ShanxiaoBoss.FRAME_SIZE * this.tuning.scale;
        const bottomY = pos.y + frameSize / 2;

        return {
            x: pos.x - this.tuning.bodyWidth / 2,
            y: bottomY - this.tuning.bodyHeight,
            width: this.tuning.bodyWidth,
            height: this.tuning.bodyHeight,
        };
    }

    /**
     * 受击判定盒（供玩家普通攻击命中检测）
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getHitRect() {
        const size = this.tuning.hitBoxSize * this.tuning.scale;
        return {
            x: this.position.x - size / 2,
            y: this.position.y - size / 2,
            width: size,
            height: size,
        };
    }

    // ==================== 动画播放 ====================

    /**
     * 播放动画（动作开始时调用，会重置到首帧）
     * @param {string} name - 逻辑动画名
     * @param {boolean} loop - 是否循环
     * @returns {Animation|null}
     */
    playAnimation(name, loop) {
        return this.animationManager.play(name, {
            reset: true,
            loop: !!loop,
            direction: this.facing,
        });
    }

    /**
     * 当前动画帧索引（0 起）
     * @returns {number}
     */
    getCurrentAnimationFrame() {
        const animation = this.animationManager.getCurrentAnimation();
        return animation ? animation.currentFrame : 0;
    }

    // ==================== 横扫 ====================

    /**
     * 横扫（可被受击打断）
     */
    startSweep() {
        this.changeAction('sweep', this.tuning.sweepDuration);
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;
        this.cooldowns.sweep = this.tuning.cooldownSweep;

        const target = this.getTarget();
        if (target && target.position) {
            this.facePoint(target.position);
        }

        this.playAnimation('sweep', false);
        // 横扫音效：与横扫动画同一时刻（见 tools/音频资源清单.txt）
        this._playSfx('sfx.boss_shanxiao_sweep');
    }

    /**
     * 横扫推进：推进到命中帧后结算一次圆形范围伤害
     */
    updateSweep() {
        if (!this.hitFrameApplied && this.getCurrentAnimationFrame() >= this.tuning.sweepHitFrame) {
            this.hitFrameApplied = true;
            this.dealCircleDamage(this.tuning.sweepRadius);
        }
    }

    // ==================== 蓄力 ====================

    /**
     * 蓄力（可被受击打断）：完成后置「蓄力完成」标记，强化下一次扑击
     */
    startCharge() {
        this.changeAction('charge', this.tuning.chargeDuration);
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;
        this.cooldowns.charge = this.tuning.cooldownCharge;

        const target = this.getTarget();
        if (target && target.position) {
            this.facePoint(target.position);
        }

        this.playAnimation('charge', false);
        // 蓄力音效：与蓄力动画同一时刻
        this._playSfx('sfx.boss_shanxiao_charge');

        // 风旋特效：跟随 Boss 身体，绘制在 Boss 之上（循环播放，直至蓄力结束或被中断）
        this.stopChargeWind();
        this.spawnEffect('boss_charge_wind', {
            follow: this,
            offset: { x: 0, y: -8 },
            loop: true,
        });
    }

    /**
     * 蓄力推进
     */
    updateCharge() {
        // 蓄力期间缓慢转向玩家（保持压迫感）
        const target = this.getTarget();
        if (target && target.position) {
            this.facePoint(target.position);
        }

        // 动画播完 → 蓄力完成（若被打断则不会走到这里，标记保持 false）
        if (this.isCurrentAnimationFinished() && !this.isCharged) {
            this.isCharged = true;
            this.stopChargeWind();
            Logger.log('[摄风山魈] 蓄力完成 → 下一次扑击将被强化');
        }
    }

    // ==================== 扑击 ====================

    /**
     * 扑击（不可被打断）
     * 只沿主轴（水平或垂直）突进，动画结束时落地扬尘 + 圆形范围伤害，
     * 随后清除「蓄力完成」标记（强化只作用于一次扑击）。
     * @param {boolean} charged - 是否为蓄力强化后的扑击
     */
    startPounce(charged) {
        this.changeAction('pounce', this.tuning.pounceDuration * (charged ? 1.15 : 1));
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;
        this.cooldowns.pounce = this.tuning.cooldownPounce;
        this.pounceCharged = !!charged;
        this.pounceSpeed = charged ? this.tuning.pounceSpeedCharged : this.tuning.pounceSpeed;

        // 锁定突进轴与方向（轴对齐）
        const target = this.getTarget();
        if (target && target.position) {
            const dx = target.position.x - this.position.x;
            const dy = target.position.y - this.position.y;
            this.pounceAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
            this.pounceSign = Math.sign(this.pounceAxis === 'x' ? dx : dy) || 1;
        } else {
            this.pounceAxis = 'x';
            this.pounceSign = 1;
        }

        this.faceDirection(
            this.pounceAxis === 'x' ? this.pounceSign : 0,
            this.pounceAxis === 'y' ? this.pounceSign : 0
        );

        this.playAnimation('pounce', false);
        // 扑击音效：与扑击动画同一时刻（落地时另有砸地音效，见 updatePounce）
        this._playSfx('sfx.boss_shanxiao_pounce');
    }

    /**
     * 扑击推进
     * @param {number} deltaTime
     */
    updatePounce(deltaTime) {
        // 突进（不可打断：此处不检查受伤状态）
        const step = this.pounceSpeed * deltaTime;
        if (this.pounceAxis === 'x') {
            this.tryMove(this.pounceSign * step, 0);
        } else {
            this.tryMove(0, this.pounceSign * step);
        }

        // 落地帧：扬尘特效 + 砸地音效 + 圆形范围伤害
        if (!this.hitFrameApplied && this.getCurrentAnimationFrame() >= this.tuning.pounceHitFrame) {
            this.hitFrameApplied = true;
            this.spawnEffect('boss_pounce_dust', {
                position: { x: this.position.x, y: this.position.y + ShanxiaoBoss.FRAME_SIZE * this.tuning.scale / 2 - 12 },
            });
            // 砸地音效：与落地扬尘特效同一时刻
            this._playSfx('sfx.boss_shanxiao_slam');
            this.dealCircleDamage(this.tuning.pounceRadius);
        }

        // 动画播完 → 清除蓄力标记并回到决策
        if (this.isCurrentAnimationFinished()) {
            this.isCharged = false;
            this.pounceCharged = false;
            this.startIdle(0.08);
        }
    }

    // ==================== 受击 ====================

    /**
     * 受击（打断可打断动作；扑击除外）
     */
    startHurt() {
        this.hurtQueued = false;
        this.stopChargeWind();

        this.changeAction('hurt', this.tuning.hurtDuration);
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;
        this.actionMinDuration = this.tuning.hurtDuration;

        this.playAnimation('hurt', false);
    }

    /**
     * 受击推进
     * 受击动画播放期间再次受击 → 动画结束后重播一次（延迟处理，不丢帧不叠加）
     */
    updateHurt() {
        if (!this.isCurrentAnimationFinished()) {
            return;
        }

        if (this.hurtQueued) {
            this.hurtQueued = false;
            this.playAnimation('hurt', false);
            return;
        }

        this.startIdle(0.05);
    }

    // ==================== 战败 ====================

    /**
     * 战败：播放战败动画并停在最后一帧（战败动画播完后触发 onDeath）
     */
    enterDead() {
        if (this.action === 'dead') return;

        this.isAlive = false;
        this.hurtQueued = false;
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;
        this.stopChargeWind();

        this.changeAction('dead', 0);
        this.playAnimation('dead', false);

        // 战败音效：与战败动画同一时刻
        this._playSfx('sfx.boss_shanxiao_defeat');

        Logger.log('[摄风山魈] 战败');
    }

    /**
     * 战败状态推进：动画播完后停帧并触发一次 onDeath
     */
    updateDeath() {
        if (this.deathAnimationFinished) return;
        if (!this.isCurrentAnimationFinished()) return;

        this.deathAnimationFinished = true;
        if (this.onDeath) {
            this.onDeath(this);
        }
    }

    /**
     * 战败动画是否已播完（Main 据此结算胜利：记标记 + 战场正中心开启归途法阵）
     * @returns {boolean}
     */
    isDefeatSequenceFinished() {
        return !this.isAlive && this.deathAnimationFinished;
    }

    // ==================== 伤害结算 ====================

    // ==================== 音效 ====================

    /**
     * 播放一次音效（缺失音频文件时静默跳过，不影响战斗逻辑）
     * 音频键 / 文件路径见 js/ResourceManager.js，触发时机见 tools/音频资源清单.txt
     * @param {string} key
     * @returns {boolean}
     */
    _playSfx(key) {
        return gameAudio.playSfx(key);
    }

    /**
     * 播放一次音效，但「同一音效正在播放时跳过这一次」（受伤音效用）
     * @param {string} key
     * @returns {boolean}
     */
    _playSfxExclusive(key) {
        return gameAudio.playSfxExclusive(key);
    }

    /**
     * 受到伤害
     * - 扑击中：照常掉血，但不播放受击动画、不中断突进
     * - 受击动画中再次受击：延迟到当前受击动画结束后重播一次
     * - 其余可打断动作：立即打断为受击
     * @param {number} damage - 原始伤害
     * @param {Object} [source] - 伤害来源
     * @returns {boolean} 是否成功结算
     */
    takeDamage(damage, source) {
        if (!this.isAlive || !damage || damage <= 0) {
            return false;
        }

        const actualDamage = GameConfig.getInstance().calculateDamage(damage, this.defense);
        this.health = Math.max(0, this.health - actualDamage);

        // 受击闪烁
        this.isHit = true;
        this.hitFlashTimer = this.hitFlashDuration;

        if (this.onDamageTaken) {
            this.onDamageTaken(this, actualDamage, source);
        }

        if (this.health <= 0) {
            // 这一击致命 → 由 enterDead 播战败音效（与战败动画同步，不再叠受伤音效）
            this.enterDead();
            return true;
        }

        // 受伤音效：每次受伤都播；受伤音效正在播放时这一次不播（不叠加）
        this._playSfxExclusive('sfx.boss_shanxiao_hurt');

        // 打断规则
        if (this.action === 'pounce') {
            // 扑击不可打断：仅掉血与闪白
        } else if (this.action === 'hurt' || this.canBeInterrupted()) {
            this.hurtQueued = true;
        }

        return true;
    }

    /**
     * 处理玩家普通攻击（由 Main 在战场内转发）
     * @param {Object} attackData - { rect: {x,y,width,height}, damage: number, source: Object }
     * @returns {boolean} 是否命中
     */
    handlePlayerAttack(attackData) {
        if (!this.isAlive || !attackData || !attackData.rect) {
            return false;
        }
        if (!CollisionDetector.rectsIntersect(attackData.rect, this.getHitRect())) {
            return false;
        }
        return this.takeDamage(attackData.damage || 0, attackData.source);
    }

    /**
     * 以 Boss 为中心结算一次圆形范围伤害（横扫 / 扑击落地）
     * @param {number} radius - 判定半径（像素）
     * @returns {boolean} 是否命中玩家
     */
    dealCircleDamage(radius) {
        const target = this.getTarget();
        const canHit = !!(target && target.position && target.isAlive !== false);

        let hit = false;
        if (canHit) {
            hit = CollisionDetector.circleIntersectsRect(
                { x: this.position.x, y: this.position.y },
                radius,
                {
                    x: target.position.x - (target.width || 24) / 2,
                    y: target.position.y - (target.height || 32) / 2,
                    width: target.width || 24,
                    height: target.height || 32,
                }
            );

            if (hit && typeof target.takeDamage === 'function') {
                target.takeDamage(this.damage);
            }
        }

        if (this.onAttackLand) {
            this.onAttackLand(this, this.action, hit);
        }

        return hit;
    }

    // ==================== 战斗特效 ====================

    /**
     * 生成战斗特效（绘制在 Boss 之上）
     * @param {string} name - 特效名（boss_pounce_dust / boss_charge_wind）
     * @param {Object} [options] - 覆盖默认参数
     * @returns {ShanxiaoBossEffect|null}
     */
    spawnEffect(name, options = {}) {
        const presets = {
            boss_pounce_dust: { frameCount: 6, fps: 14, scale: 1.25, alpha: 0.9, loop: false },
            boss_charge_wind: { frameCount: 4, fps: 10, scale: 1.1, alpha: 0.85, loop: true },
        };
        const preset = presets[name] || { frameCount: 1, fps: 12, scale: 1, alpha: 1, loop: false };

        const effect = new ShanxiaoBossEffect(Object.assign({}, preset, options, {
            name: name,
            spriteSheet: this.effectSheets[name] || null,
            position: options.position || { x: this.position.x, y: this.position.y },
        }));

        this.effects.push(effect);

        if (name === 'boss_charge_wind') {
            this.chargeWindEffect = effect;
        }
        if (this.onEffectSpawn) {
            this.onEffectSpawn(this, name);
        }

        return effect;
    }

    /**
     * 移除蓄力风旋（蓄力结束或被中断时调用）
     */
    stopChargeWind() {
        if (!this.chargeWindEffect) return;
        this.effects = this.effects.filter(effect => effect !== this.chargeWindEffect);
        this.chargeWindEffect = null;
    }

    // ==================== 渲染 ====================

    /**
     * 渲染 Boss（特效绘制在 Boss 之上）
     * 战败动画播完后停在最后一帧，因此这里不做“播完即隐藏”的处理。
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    render(ctx, camera) {
        if (!ctx || this.isDestroyed) return;

        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };

        // 1. 攻击范围提示圈（地面层，先于本体绘制）
        this.renderHitCircle(ctx, renderPos);

        // 2. Boss 本体
        const frameSize = ShanxiaoBoss.FRAME_SIZE * this.tuning.scale;
        const screenX = this.position.x - renderPos.x - frameSize / 2;
        const screenY = this.position.y - renderPos.y - frameSize / 2;

        const renderOptions = {};
        if (this.isHit && Math.floor(this.hitFlashTimer * 20) % 2 === 0) {
            renderOptions.alpha = 0.75;
        }

        this.animationManager.render(ctx, screenX, screenY, frameSize, frameSize, renderOptions);

        // 3. 战斗特效（扬尘 / 风旋）——绘制在 Boss 上方
        this.effects.forEach(effect => effect.render(ctx, camera));
    }

    /**
     * 绘制攻击范围提示圈（横扫 / 扑击期间可见；便于玩家读招与闪避）
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} renderPos - 摄像机渲染偏移
     */
    renderHitCircle(ctx, renderPos) {
        let radius = 0;
        if (this.action === 'sweep') {
            radius = this.tuning.sweepRadius;
        } else if (this.action === 'pounce') {
            radius = this.tuning.pounceRadius;
        }

        if (!this.showHitCircle && !this.tuning.debugHitboxes) return;
        if (radius <= 0 && !this.tuning.debugHitboxes) return;

        if (radius <= 0) {
            radius = this.tuning.hitBoxSize / 2;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(this.position.x - renderPos.x, this.position.y - renderPos.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.action === 'pounce'
            ? 'rgba(255, 168, 92, 0.55)'
            : 'rgba(198, 230, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = this.action === 'pounce'
            ? 'rgba(255, 168, 92, 0.10)'
            : 'rgba(198, 230, 255, 0.08)';
        ctx.fill();
        ctx.restore();
    }

    // ==================== 奖励 / 存档 ====================

    /**
     * 战斗奖励（与 Monster 保持一致，便于后续发奖）
     * @returns {{exp: number, lingShi: number, drops: Array}}
     */
    getRewards() {
        return {
            exp: this.expReward,
            lingShi: this.lingShiReward,
            drops: this.drops || [],
        };
    }

    /**
     * 序列化（用于存档）
     * @returns {Object}
     */
    serialize() {
        return {
            id: this.id,
            monsterId: this.monsterId,
            position: { x: this.position.x, y: this.position.y },
            health: this.health,
            maxHealth: this.maxHealth,
            isAlive: this.isAlive,
            facing: this.facing,
            action: this.action,
            isCharged: this.isCharged,
            cooldowns: { ...this.cooldowns },
        };
    }

    /**
     * 反序列化（用于读档）
     * @param {Object} data
     */
    deserialize(data) {
        if (!data) return;

        if (data.position) {
            this.position = { x: data.position.x, y: data.position.y };
        }
        if (data.health !== undefined) this.health = data.health;
        if (data.maxHealth) this.maxHealth = data.maxHealth;
        if (data.facing) {
            this.facing = data.facing;
            this.animationManager.setDirection(this.facing);
        }
        if (data.cooldowns) {
            Object.assign(this.cooldowns, data.cooldowns);
        }

        this.isCharged = !!data.isCharged;

        // 读档时若已战败则不复活
        if (data.isAlive === false) {
            this.isAlive = false;
            this.deathAnimationFinished = true;
            this.action = 'dead';
        }
    }

    // ==================== 清理 ====================

    /**
     * 释放资源（战斗结束 / 清理战场时由 GameMap.clearArenaBoss 调用）
     * - 清空特效与路径缓存，断开地图/目标引用
     * - 释放该 Boss 的精灵图缓存（下次进场时重新加载）
     */
    destroy() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        this.effects = [];
        this.chargeWindEffect = null;
        this.path = [];
        this.target = null;
        this.map = null;

        // 资源键统一来自 ResourceManager.resourceGroups.bossArena（与进场预加载保持一致）
        const resourceManager = ResourceManager.getInstance();

        if (this.releaseResources && resourceManager.releaseImages) {
            const released = typeof resourceManager.releaseResourceGroup === 'function'
                ? resourceManager.releaseResourceGroup('bossArena')
                : resourceManager.releaseImages(
                    (this.animationSpecs || []).map(spec => spec.key)
                        .concat(['effects.boss_pounce_dust', 'effects.boss_charge_wind'])
                );
            Logger.log(`[摄风山魈] 已清理 Boss 资源（释放 ${released} 张精灵图缓存）`);
        } else {
            Logger.log('[摄风山魈] 已清理 Boss 资源（保留图片缓存）');
        }

        if (this.animationManager) {
            this.animationManager.stop();
        }
    }
}
