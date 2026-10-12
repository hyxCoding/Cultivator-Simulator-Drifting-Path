/**
 * 渡厄使（第二章 Boss · 万灯台）+ 其召唤的小兵
 * ------------------------------------------------------------------
 * 本文件与第一章的 js/ShanxiaoBoss.js 同构（独立实现，不继承 js/Boss.js）：
 * 渡厄使有专属美术规格与行为规则，Boss.js 那套“单帧 64×64 / walk-attack-skill1-skill2”体系不适用。
 *
 * 一、美术规格
 *   渡厄使：单帧 96×96，7 套动作
 *     idle     待机：**列排列**（每列一个方向、每列 1 帧），列序 = 下 / 左 / 右 / 上 → 384×96
 *     summon   召唤：行排列 4 行（下/左/右/上）× 6 帧 → 576×384
 *     dash     冲刺：行排列 4 行 × 6 帧
 *     control  控制：行排列 4 行 × 6 帧
 *     hurt     受击：行排列 4 行 × 6 帧
 *     move     移动：行排列 4 行 × 6 帧
 *     dead     战败：单行 6 帧（不分方向）→ 576×96
 *   小兵：单帧 96×32（宽扁的小傀儡），3 套动作（行排列 4 行 = 下/左/右/上）
 *     idle 6 帧 / move 8 帧 / attack 7 帧
 *   占位图由 tools/generate_chapter2_assets.py 生成（--due-only）。
 *
 * 二、渡厄使行为（行为树 = 选择器，按优先级挑选动作）
 *   - 动作带“最短持续时间”：动作必须持续一段时间，不会同一帧内反复横跳。
 *   - 移动：只允许上下左右（轴对齐），用 AStar.findAxisAlignedPath 在碰撞网格上寻路；
 *           进入攻击范围 / 超过最长移动时间 / 无路可走 → 停下（回到决策）。
 *   - 冲刺（5 秒冷却，**不可打断**）：沿锁定轴高速位移，待动画结束停止移动，
 *           并以本体为圆心画圆判定伤害（玩家碰撞盒落在圆内即受伤）；
 *           播放期间照常掉血，但不播放受击动画、不中断冲刺。
 *   - 控制（40 秒冷却，可被打断）：动画播完 → 玩家头顶出现 32×32 锁链图、
 *           禁止一切按键输入 3 秒（输入封锁由 Main.startArenaControlLock 接管，
 *           锁链图由 PlayerCombat.attachControlChain 绘制）。
 *   - 召唤（60 秒冷却，可被打断）：动画结束时在原地生成 1 个小兵；场上最多 2 个小兵。
 *   - 受击（非循环）：受击动画播放期间再次受伤 → 本次播完即回到决策，**不重播**受击动画
 *           （不延长、不叠加，按本章设计）。
 *   - 战败：dead 播完停在最后一帧（继续渲染该帧）；战败后清空场上所有小兵。
 *           由 Main.updateBossArenaBattle 结算胜利（记剧情标记 due_boss_defeated、
 *           推进主线四、在战场正中心开启永久归途法阵）；随后
 *           GameMap.clearArenaBoss → destroy() 释放 'bossArenaCh2' 资源分组。
 *
 * 三、小兵行为
 *   - 只走上下左右（A* 寻路、不能穿墙），自动追击并攻击玩家，有自己的行为树与最短动作时长。
 *   - 血量 / 攻击都低；3 套动画里没有受击与战败图，因此受伤只闪白、气血归零即退场。
 *   - 标记 isArenaBoss = true：只吃玩家攻击（普攻 / 剑气 / 灵息弹 / 剑影连斩），
 *     不进野外“按 E 切磋”，也不走 BattleSystem 的经验 / 灵石掉落。
 *
 * 依赖：GameConfig / ResourceManager / AnimationManager / Animation / AStar
 */

/**
 * 渡厄使召唤的小兵（守台傀儡）
 * 与野外怪物 / Boss 的区别：isArenaBoss = true → 只吃玩家攻击，不进野外切磋，也不给奖励
 */
class DueMinion {
    /** 精灵图单帧宽度（美术规格：96×32 —— 宽扁的小傀儡） */
    static get FRAME_WIDTH() { return 96; }

    /** 精灵图单帧高度（美术规格：96×32） */
    static get FRAME_HEIGHT() { return 32; }

    /** 多方向精灵图的行序：下/左/右/上（与美术约定一致，勿随意调整） */
    static get DIRECTION_ROWS() {
        return { down: 0, left: 1, right: 2, up: 3 };
    }

    /**
     * 小兵数值唯一来源（Single Source of Truth）。
     * DueBoss.DEFAULT_TUNING.minion 或 Chapter2Config 的 tuning.minion 仅用于覆盖个别字段，
     * 不再逐条重复本表——改数值只需改这里一处。
     */
    static get DEFAULT_TUNING() {
        return {
            moveSpeed: 88,           // 追击速度（像素/秒）
            maxMoveTime: 2.0,        // 单次追击最长持续时间（秒）
            minMoveTime: 0.35,       // 单次追击最短持续时间（秒，避免立刻回头切待机）
            attackRange: 48,         // 进入该距离即停下出手
            detectRange: 460,        // 察觉范围（超出则原地待机）
            keepDistance: 34,        // 与玩家保持的最小距离（避免贴脸重叠）
            attackRadius: 46,        // 攻击判定圆半径
            attackHitFrame: 3,       // 攻击动画第几帧（0 起）结算伤害
            attackDuration: 0.7,     // 攻击动画时长（7 帧 @10fps）
            cooldownAttack: 1.6,     // 攻击冷却（秒）
            idleDuration: 0.5,       // 待机最短持续时间（秒）
            decisionInterval: 0.15,  // 行为树评估间隔（秒）
            hitFlashDuration: 0.14,  // 受击闪白时长（秒）
            bodyWidth: 30,           // 脚下碰撞盒宽
            bodyHeight: 24,          // 脚下碰撞盒高
            hitBoxSize: 32,          // 被玩家攻击时的受击盒边长
            scale: 1,                // 精灵图缩放
            debugHitboxes: false,    // 调试：绘制判定圈
        };
    }

    /**
     * @param {Object} config
     * @param {string} config.id - 唯一 ID
     * @param {string} [config.monsterId] - 配置 ID（GameConfig.monsters 中的键）
     * @param {Object} config.position - 初始位置（世界坐标，精灵图中心）
     * @param {Object} [config.tuning] - 覆盖 DEFAULT_TUNING 的数值
     */
    constructor(config = {}) {
        this.id = config.id || `due_minion_${Date.now()}`;
        this.monsterId = config.monsterId || 'boss_due_minion';
        this.name = config.name || '守台傀儡';
        this.isBoss = false;
        this.isArenaBoss = true;    // 只吃玩家攻击：不进野外切磋，也不走 BattleSystem 奖励流程
        this.isDestroyed = false;

        const gameConfig = GameConfig.getInstance();
        this.monsterConfig = gameConfig.getMonster(this.monsterId) || {};
        this.tuning = Object.assign({}, DueMinion.DEFAULT_TUNING, config.tuning || {});

        // 数值一律来自章节配置（Chapter2Config.boss_due_minion），兜底取 GameConfig.monsterDefaults
        const monDefaults = gameConfig.getMonsterDefaults();
        this.maxHealth = config.maxHealth || this.monsterConfig.health || monDefaults.health;
        this.health = this.maxHealth;
        this.damage = config.damage || this.monsterConfig.damage || monDefaults.damage;
        this.defense = config.defense || this.monsterConfig.defense || monDefaults.defense;

        this.position = {
            x: (config.position && config.position.x) || 0,
            y: (config.position && config.position.y) || 0,
        };
        this.spawnPosition = { x: this.position.x, y: this.position.y };
        this.tilePosition = null;
        this.tileSize = config.tileSize || 32;

        this.facing = 'down';
        this.width = this.tuning.bodyWidth;
        this.height = this.tuning.bodyHeight;

        this.isAlive = true;
        this.isMoving = false;
        this.isHit = false;
        this.hitFlashTimer = 0;

        this.action = 'idle';        // idle | move | attack
        this.actionTime = 0;
        this.actionMinDuration = this.tuning.idleDuration;
        this.decisionTimer = 0;
        this.hitFrameApplied = false;
        this.attackCooldown = 0;
        this.unreachableTimer = 0;
        this.showHitCircle = config.showHitCircle === true;

        this.path = [];
        this.pathIndex = 0;

        /** @type {Object|null} 玩家（由 DueBoss 注入） */
        this.target = null;
        /** @type {GameMap|null} 当前地图（GameLoop / DueBoss 注入） */
        this.map = null;

        // 回调
        this.onDeath = null;         // (minion) => void，由 DueBoss 从地图上移除
        this.onActionChange = null;  // (minion, action, previous) => void
        this.onAttackLand = null;    // (minion, hitPlayer) => void
        this.onDamageTaken = null;   // (minion, damage, source) => void

        // 动画
        this.animationManager = config.animationManager || new AnimationManager();
        this.animationsReady = false;
        this.initAnimations();

        this.behaviorTree = this.buildBehaviorTree();
        this.animationManager.setDirection(this.facing);
    }

    /**
     * 初始化 3 套动画（行排列 4 行 = 下/左/右/上，单帧 96×32）
     * 精灵图异步加载，加载前动画对象已登记（渲染时会自动跳过无图的帧）
     */
    initAnimations() {
        const resourceManager = ResourceManager.getInstance();
        const prefix = `monsters.${this.monsterId}`;
        const frameWidth = DueMinion.FRAME_WIDTH;
        const frameHeight = DueMinion.FRAME_HEIGHT;
        const rows = DueMinion.DIRECTION_ROWS;

        this.animationSpecs = [
            { name: 'idle',   key: `${prefix}_idle`,   fps: 6,  loop: true,  frames: 6 },  // 待机
            { name: 'move',   key: `${prefix}_move`,   fps: 10, loop: true,  frames: 8 },  // 移动
            { name: 'attack', key: `${prefix}_attack`, fps: 10, loop: false, frames: 7 },  // 攻击
        ];

        this.animationSpecs.forEach(spec => {
            const directions = {};
            Object.keys(rows).forEach(dir => {
                directions[dir] = { row: rows[dir], frames: spec.frames };
            });

            const animation = new Animation({
                name: spec.name,
                spriteSheet: null,
                frameWidth: frameWidth,
                frameHeight: frameHeight,
                directionMode: 'row',
                directions: directions,
                fps: spec.fps,
                loop: spec.loop,
                defaultDirection: 'down',
            });
            this.animationManager.addAnimation(spec.name, animation);
        });

        this.animationsPromise = Promise.all(this.animationSpecs.map(async spec => {
            const image = await resourceManager.loadImage(spec.key);
            const animation = this.animationManager.getAnimation(spec.name);
            if (animation) animation.spriteSheet = image;
        })).then(() => {
            this.animationsReady = true;
        }).catch(error => {
            console.warn(`[守台傀儡] 动画资源加载异常: ${error && error.message}`);
        });
    }

    // ==================== 行为树 ====================

    /**
     * 构建行为树（选择器 → 命中即执行并结束本次评估）
     * @returns {Object} 行为树根节点
     */
    buildBehaviorTree() {
        const t = this.tuning;
        return {
            type: 'selector',
            name: 'minion_root',
            children: [
                {
                    name: '攻击（已进入攻击范围且冷却结束）',
                    condition: (m) => m.hasTarget() && m.getTargetDistance() <= t.attackRange
                        && m.attackCooldown <= 0,
                    action: (m) => m.startAttack(),
                },
                {
                    name: '追击（察觉范围内接近玩家）',
                    condition: (m) => m.hasTarget() && m.getTargetDistance() <= t.detectRange,
                    action: (m) => m.startMove(),
                },
                {
                    name: '待机（玩家太远）',
                    action: (m) => m.startIdle(),
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
     * @param {Object} node
     * @returns {boolean} 是否成功
     */
    runNode(node) {
        if (!node) return false;

        if (Array.isArray(node.children) && node.children.length > 0) {
            for (const child of node.children) {
                if (this.runNode(child)) return true;
            }
            return false;
        }

        if (node.condition && !node.condition(this)) return false;
        if (!node.action) return false;

        node.action(this);
        return true;
    }

    /**
     * 当前动作是否可以重新决策（防止动作来回横跳）
     * - idle：达到最短待机时长
     * - attack：当前动画播放完毕
     * - move：由移动逻辑自行结束（到达 / 超时 / 无路径）
     * @returns {boolean}
     */
    canDecide() {
        if (!this.isAlive) return false;

        switch (this.action) {
            case 'idle':
                return this.actionTime >= this.actionMinDuration;
            case 'attack':
                return this.isCurrentAnimationFinished();
            case 'move':
                return false;
            default:
                return this.actionTime >= this.actionMinDuration;
        }
    }

    // ==================== 主更新 ====================

    /**
     * 每帧更新（GameLoop 会对 currentMap.monsters 统一调用）
     * @param {number} deltaTime
     * @param {GameMap} [map]
     */
    update(deltaTime, map) {
        if (this.isDestroyed) return;

        if (map) {
            this.map = map;
            if (map.tileSize) this.tileSize = map.tileSize;
        }

        this.updateHitFlash(deltaTime);
        this.animationManager.update(deltaTime);

        if (!this.isAlive) return;

        if (this.attackCooldown > 0) {
            this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
        }

        this.updateAction(deltaTime);

        this.decisionTimer -= deltaTime;
        if (this.decisionTimer <= 0) {
            this.decisionTimer = this.tuning.decisionInterval;
            if (this.canDecide()) this.runBehaviorTree();
        }
    }

    /**
     * 受击闪白计时
     * @param {number} deltaTime
     */
    updateHitFlash(deltaTime) {
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer = Math.max(0, this.hitFlashTimer - deltaTime);
            this.isHit = this.hitFlashTimer > 0;
        }
    }

    /**
     * 推进当前动作
     * @param {number} deltaTime
     */
    updateAction(deltaTime) {
        this.actionTime += deltaTime;

        switch (this.action) {
            case 'idle':   this.updateIdle(); break;
            case 'move':   this.updateMove(deltaTime); break;
            case 'attack': this.updateAttack(); break;
            default: break;
        }
    }

    // ==================== 动作 ====================

    /**
     * 切换动作（记录上一动作并触发回调）
     * @param {string} action
     * @param {number} minDuration
     * @returns {boolean} 是否发生了变化
     */
    changeAction(action, minDuration) {
        const changed = this.action !== action;
        const previous = this.action;

        this.action = action;
        this.actionTime = 0;
        this.actionMinDuration = minDuration !== undefined ? minDuration : 0;
        this.hitFrameApplied = false;

        if (changed && this.onActionChange) this.onActionChange(this, action, previous);
        return changed;
    }

    /** 待机：面朝玩家（已在待机时不重启动画，避免待机反复回到第一帧） */
    startIdle(minDuration) {
        const changed = this.changeAction('idle',
            minDuration !== undefined ? minDuration : this.tuning.idleDuration);
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;

        const idleAnimation = this.animationManager.getAnimation('idle');
        if (changed || this.animationManager.getCurrentAnimation() !== idleAnimation) {
            this.playAnimation('idle', true);
        }
    }

    /** 开始追击：重新寻路（只走上下左右） */
    startMove() {
        this.changeAction('move', this.tuning.maxMoveTime);
        this.isMoving = true;
        this.repathToTarget();
        this.playAnimation('move', true);
    }

    /** 待机：面朝玩家 */
    updateIdle() {
        const target = this.getTarget();
        if (target && target.position) this.facePoint(target.position);
    }

    /** 推进追击：结束条件＝进入攻击范围 / 超过最长追击时间 / 无路可走 */
    updateMove(deltaTime) {
        const target = this.getTarget();
        if (!target || !target.position) {
            this.startIdle();
            return;
        }

        const distance = this.getTargetDistance();

        // 结束条件一：已进入攻击范围 → 停下出手
        if (distance <= this.tuning.attackRange) {
            this.startIdle(0.05);
            return;
        }

        // 结束条件二：超过单次追击最长持续时间（贴太近时满足最短追击时长即可收手）
        if (this.actionTime >= this.tuning.maxMoveTime
            || (this.actionTime >= this.tuning.minMoveTime && distance <= this.tuning.keepDistance)) {
            this.startIdle(0.1);
            return;
        }

        // 路径为空 → 重新寻路；始终无路则原地待机（避免卡墙抖动）
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

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            this.pathIndex++;
            return;
        }

        // 轴对齐推进：正常情况路径点与当前位置同行或同列，只有一个轴有效；
        // 主轴被挡时尝试另一轴（贴角滑行），避免碰撞盒卡在瓦片拐角
        const step = this.tuning.moveSpeed * deltaTime;
        if (step <= 0) return;

        const stepX = Math.sign(dx) * Math.min(step, Math.abs(dx));
        const stepY = Math.sign(dy) * Math.min(step, Math.abs(dy));

        let usedX = 0;
        let usedY = 0;
        let moved = false;

        if (Math.abs(dx) >= Math.abs(dy)) {
            if (this.tryMove(stepX, 0)) {
                moved = true;
                usedX = stepX;
            } else if (Math.abs(dy) >= 1 && this.tryMove(0, stepY)) {
                moved = true;
                usedY = stepY;
            }
        } else if (this.tryMove(0, stepY)) {
            moved = true;
            usedY = stepY;
        } else if (Math.abs(dx) >= 1 && this.tryMove(stepX, 0)) {
            moved = true;
            usedX = stepX;
        }

        if (!moved) {
            // 两轴都走不通：重新寻路；连续受阻则原地待机（避免卡墙抖动）
            this.unreachableTimer += deltaTime;
            this.repathToTarget();
            if (this.unreachableTimer >= 0.6) {
                this.unreachableTimer = 0;
                this.startIdle(0.2);
            }
            return;
        }

        this.unreachableTimer = 0;
        this.faceDirection(usedX, usedY);
    }

    /** 开始攻击（进冷却、锁朝向、播攻击动画） */
    startAttack() {
        this.changeAction('attack', this.tuning.attackDuration);
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;
        this.attackCooldown = this.tuning.cooldownAttack;

        const target = this.getTarget();
        if (target && target.position) this.facePoint(target.position);

        this.playAnimation('attack', false);
    }

    /** 推进攻击：到达命中帧结算一次圆形伤害，动画播完回到决策 */
    updateAttack() {
        if (!this.hitFrameApplied && this.getCurrentAnimationFrame() >= this.tuning.attackHitFrame) {
            this.hitFrameApplied = true;
            this.dealCircleDamage(this.tuning.attackRadius);
        }

        if (this.isCurrentAnimationFinished()) {
            this.startIdle(0.05);
        }
    }

    // ==================== 目标 / 朝向 ====================

    /**
     * 当前目标（优先缓存，其次取地图上的玩家）
     * @returns {Object|null}
     */
    getTarget() {
        if (this.target && this.target.isAlive !== false) return this.target;

        if (this.map && this.map.player && this.map.player.isAlive !== false) {
            this.target = this.map.player;
            return this.target;
        }
        return null;
    }

    /** 是否存在有效目标 */
    hasTarget() {
        return !!this.getTarget();
    }

    /** 与目标的距离（无目标返回 Infinity） */
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
     * 面向目标
     * @param {Object} point - {x, y}
     */
    facePoint(point) {
        if (!point) return;
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        this.facing = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');
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

    /** 当前动画是否已播放完毕 */
    isCurrentAnimationFinished() {
        const animation = this.animationManager.getCurrentAnimation();
        return !!(animation && animation.isFinished);
    }

    /**
     * 播放动画（动作开始时调用，会重置到首帧）
     * @param {string} name
     * @param {boolean} loop
     */
    playAnimation(name, loop) {
        return this.animationManager.play(name, {
            reset: true,
            loop: !!loop,
            direction: this.facing,
        });
    }

    /** 当前动画帧索引（0 起） */
    getCurrentAnimationFrame() {
        const animation = this.animationManager.getCurrentAnimation();
        return animation ? animation.currentFrame : 0;
    }

    // ==================== 寻路 / 碰撞 ====================

    /** 重新计算到玩家当前位置的轴对齐路径 */
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

        while (path.length > 0 && this.getDistanceTo(path[0]) < 2) {
            path.shift();
        }

        this.path = path;
        this.pathIndex = 0;
    }

    /**
     * 尝试按 (dx, dy) 移动（轴对齐；脚下碰撞盒必须落在可通行瓦片上 → 不能穿墙）
     * @param {number} dx
     * @param {number} dy
     * @returns {boolean} 是否成功移动
     */
    tryMove(dx, dy) {
        if (dx === 0 && dy === 0) return false;

        const nextX = this.position.x + dx;
        const nextY = this.position.y + dy;

        if (!this.isInsideMap(nextX, nextY)) return false;

        if (this.map && this.map.isRectWalkable) {
            if (!this.map.isRectWalkable(this.getFootRect({ x: nextX, y: nextY }))) return false;
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
     * @param {Object} [position]
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getFootRect(position) {
        const pos = position || this.position;
        const frameHeight = DueMinion.FRAME_HEIGHT * this.tuning.scale;
        const bottomY = pos.y + frameHeight / 2;

        return {
            x: pos.x - this.tuning.bodyWidth / 2,
            y: bottomY - this.tuning.bodyHeight,
            width: this.tuning.bodyWidth,
            height: this.tuning.bodyHeight,
        };
    }

    /**
     * 受击判定盒（供玩家普通攻击 / 技能命中检测）
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

    // ==================== 伤害 ====================

    /**
     * 受到伤害（小兵没有受击动画：只闪白；气血归零即退场）
     * @param {number} damage - 原始伤害
     * @param {Object} [source] - 伤害来源
     * @returns {boolean} 是否成功结算
     */
    takeDamage(damage, source) {
        if (!this.isAlive || !damage || damage <= 0) return false;

        const actualDamage = GameConfig.getInstance().calculateDamage(damage, this.defense);
        this.health = Math.max(0, this.health - actualDamage);

        this.isHit = true;
        this.hitFlashTimer = this.tuning.hitFlashDuration;

        if (this.onDamageTaken) this.onDamageTaken(this, actualDamage, source);

        if (this.health <= 0) this.die();
        return true;
    }

    /** 退场：停止行为并交由 DueBoss 从地图上移除（onDeath 回调） */
    die() {
        if (!this.isAlive) return;

        this.isAlive = false;
        this.isMoving = false;
        this.action = 'idle';
        this.path = [];
        this.pathIndex = 0;
        this.animationManager.stop();

        if (this.onDeath) this.onDeath(this);
    }

    /**
     * 以本体为中心结算一次圆形范围伤害
     * @param {number} radius - 判定半径（像素）
     * @returns {boolean} 是否命中玩家
     */
    dealCircleDamage(radius) {
        const target = this.getTarget();
        let hit = false;

        if (target && target.position && target.isAlive !== false) {
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

        if (this.onAttackLand) this.onAttackLand(this, hit);
        return hit;
    }

    /**
     * 处理玩家普通攻击（由 DueBoss.handlePlayerAttack 转发）
     * @param {Object} attackData - { rect, damage, source }
     * @returns {boolean} 是否命中
     */
    handlePlayerAttack(attackData) {
        if (!this.isAlive || !attackData || !attackData.rect) return false;
        if (!CollisionDetector.rectsIntersect(attackData.rect, this.getHitRect())) return false;
        return this.takeDamage(attackData.damage || 0, attackData.source);
    }

    // ==================== 渲染 / 存档 / 清理 ====================

    /**
     * 渲染小兵（受击时闪白）
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    render(ctx, camera) {
        if (!ctx || this.isDestroyed) return;

        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const frameWidth = DueMinion.FRAME_WIDTH * this.tuning.scale;
        const frameHeight = DueMinion.FRAME_HEIGHT * this.tuning.scale;
        const screenX = this.position.x - renderPos.x - frameWidth / 2;
        const screenY = this.position.y - renderPos.y - frameHeight / 2;

        const renderOptions = {};
        if (this.isHit && Math.floor(this.hitFlashTimer * 20) % 2 === 0) {
            renderOptions.alpha = 0.7;
        }

        this.animationManager.render(ctx, screenX, screenY, frameWidth, frameHeight, renderOptions);
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
        };
    }

    /**
     * 反序列化（用于读档）
     * @param {Object} data
     */
    deserialize(data) {
        if (!data) return;

        if (data.position) this.position = { x: data.position.x, y: data.position.y };
        if (data.health !== undefined) this.health = data.health;
        if (data.maxHealth) this.maxHealth = data.maxHealth;
        if (data.facing) {
            this.facing = data.facing;
            this.animationManager.setDirection(this.facing);
        }
        if (data.isAlive === false) this.isAlive = false;
    }

    /** 释放引用（不回收精灵图缓存：小兵与 Boss 共用 'bossArenaCh2' 分组，由 Boss 统一释放） */
    destroy() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        this.path = [];
        this.target = null;
        this.map = null;
        if (this.animationManager) this.animationManager.stop();
    }
}

/**
 * 渡厄使（第二章 Boss · 万灯台）
 * 行为树 + 轴对齐 A* 寻路 + 7 套动作；详细规则见本文件顶部说明
 */
class DueBoss {
    /** 精灵图单帧尺寸（美术规格：96×96） */
    static get FRAME_SIZE() { return 96; }

    /** 多方向精灵图的行序：下/左/右/上（与美术约定一致，勿随意调整） */
    static get DIRECTION_ROWS() {
        return { down: 0, left: 1, right: 2, up: 3 };
    }

    /** 多方向动画的帧数（除待机外的行排列动画都是 6 帧） */
    static get DIRECTION_FRAMES() { return 6; }

    /** 待机图列序：下/左/右/上（每列一帧，列排列） */
    static get IDLE_COLUMNS() {
        return { down: 0, left: 1, right: 2, up: 3 };
    }

    /** 战败图帧数（单行） */
    static get DEAD_FRAMES() { return 6; }

    /**
     * 渡厄使数值唯一来源（Single Source of Truth）。
     * Chapter2Config 的 bossPosition[...].tuning 仅用于按章节覆盖个别字段，
     * 不再逐条重复本表——改数值只需改这里一处。
     */
    static get DEFAULT_TUNING() {
        return {
            moveSpeed: 96,               // 追击速度（像素/秒）
            dashSpeed: 520,              // 冲刺速度（像素/秒）
            dashRadius: 150,             // 冲刺结束时的圆形判定半径
            dashTriggerRange: 440,       // 玩家在此距离内就会冲刺
            dashAfterimage: 4,           // 冲刺残影数量（表现层）
            controlRange: 340,           // 控制技的最远触发距离
            controlLockDuration: 3,      // 控制命中后玩家禁键时长（秒）
            summonMaxMinions: 2,         // 场上小兵上限
            // 脚下碰撞盒：必须小于战场瓦片边长（40），否则 96×96 的本体在瓦片边界会
            // 同时压住三个列/行，A*（按瓦片中心寻路）算出的通道走不过去 → 卡在墙角
            bodyWidth: 36,               // 脚下碰撞盒宽
            bodyHeight: 30,              // 脚下碰撞盒高
            hitBoxSize: 80,              // 被玩家攻击时的受击盒边长
            scale: 1,                    // 精灵图缩放
            aggroRange: 760,             // 仇恨范围（超出只待机）
            keepDistance: 84,            // 与玩家保持的最小距离（避免贴脸重叠）
            attackStopRange: 130,        // 进入该距离即停止追击，准备出手（冲刺）
            maxMoveTime: 2.4,            // 单次追击最长持续时间（秒）
            minMoveTime: 0.4,            // 单次追击最短持续时间（秒，避免立刻切回待机）
            idleDuration: 0.6,           // 待机最短持续时间（秒）
            decisionInterval: 0.15,      // 行为树评估间隔（秒）
            hurtDuration: 0.5,           // 受击动画时长（6 帧 @10fps；实际以动画播完为准）
            dashDuration: 0.5,           // 冲刺动画时长（6 帧 @12fps）
            summonDuration: 0.75,        // 召唤动画时长（6 帧 @8fps）
            controlDuration: 0.75,       // 控制动画时长（6 帧 @8fps）
            hitFlashDuration: 0.14,      // 受击闪白时长（秒）
            cooldownDash: 5,             // 冲刺冷却（秒）
            cooldownControl: 40,         // 控制冷却（秒）
            cooldownSummon: 60,          // 召唤冷却（秒）
            initialCooldownDash: 0,      // 开战时冲刺已就绪
            initialCooldownControl: 6,   // 开战 6 秒后第一次控制
            initialCooldownSummon: 12,   // 开战 12 秒后第一次召唤
            lowHealthPercent: 0.5,       // 低气血阶段（触发的 onLowHealth 字幕）
            debugHitboxes: false,        // 调试：绘制判定圆
            minion: {},                  // 覆盖 DueMinion.DEFAULT_TUNING
        };
    }

    /**
     * @param {Object} config
     * @param {string} config.id - 唯一 ID
     * @param {string} [config.monsterId] - 配置 ID（GameConfig.monsters 中的键）
     * @param {Object} config.position - 初始位置（世界坐标，精灵图中心）
     * @param {Object} [config.tuning] - 覆盖 DEFAULT_TUNING 的数值
     */
    constructor(config = {}) {
        this.id = config.id || 'boss_due';
        this.monsterId = config.monsterId || 'boss_due';
        this.isBoss = true;
        this.isArenaBoss = config.isArenaBoss !== false;   // 战场 Boss：不参与野外“按 E 切磋”
        this.isDestroyed = false;
        this.releaseResources = config.releaseResources !== false;

        const gameConfig = GameConfig.getInstance();
        this.monsterConfig = gameConfig.getMonster(this.monsterId) || {};
        this.tuning = Object.assign({}, DueBoss.DEFAULT_TUNING, config.tuning || {});
        this.name = config.name || this.monsterConfig.name || '渡厄使';

        this.realm = this.monsterConfig.realm || 'zhuji';
        // 数值一律来自章节配置（Chapter2Config.boss_due，health 500），兜底取 GameConfig.monsterDefaults
        const monDefaults = gameConfig.getMonsterDefaults();
        this.maxHealth = config.maxHealth || this.monsterConfig.health || monDefaults.health;
        this.health = this.maxHealth;
        this.damage = config.damage || this.monsterConfig.damage || monDefaults.damage;
        this.defense = config.defense || this.monsterConfig.defense || monDefaults.defense;
        this.expReward = this.monsterConfig.expReward || monDefaults.expReward;
        this.lingShiReward = this.monsterConfig.lingShiReward || monDefaults.lingShiReward;
        // 掉落字段兼容 drops / dropItems（Chapter2Config 用的是 dropItems）
        this.drops = this.monsterConfig.drops || this.monsterConfig.dropItems || [];

        this.position = {
            x: (config.position && config.position.x) || 0,
            y: (config.position && config.position.y) || 0,
        };
        this.spawnPosition = { x: this.position.x, y: this.position.y };
        this.facing = 'down';
        this.width = this.tuning.bodyWidth;
        this.height = this.tuning.bodyHeight;
        this.tileSize = config.tileSize || 32;
        this.tilePosition = null;

        this.isAlive = true;
        this.isInBattle = true;      // 战场 Boss 始终视为战斗中
        // 入场对白冻结：true 时只站在出生位 —— 不移动、不使用任何招式、不造成任何伤害，
        // 由 Main.enterBossArena 播 B01 战前对白前打开（GameMap.setArenaIntroLock），
        // Main.startArenaFight → startFight 解除。见 setIntroLock / update。
        this.introLock = config.introLock === true;
        this.isMoving = false;
        this.isHit = false;
        this.hitFlashTimer = 0;

        // 行为树 / 动作
        this.action = 'idle';        // idle | move | dash | control | summon | hurt | dead
        this.actionTime = 0;
        this.actionMinDuration = this.tuning.idleDuration;
        this.decisionTimer = 0;
        this.unreachableTimer = 0;   // 连续无法寻路的时间（避免无限重算）
        this.hitFrameApplied = false;// 当前动作的命中帧是否已结算

        // 技能冷却 / 阶段
        this.cooldowns = {
            dash: this.tuning.initialCooldownDash,
            control: this.tuning.initialCooldownControl,
            summon: this.tuning.initialCooldownSummon,
        };
        this.lowHealthAnnounced = false;
        this.summonCount = 0;        // 累计召唤次数（用于给小兵编号）

        // 冲刺状态
        this.dashAxis = 'x';
        this.dashSign = 1;
        this.dashTrail = [];
        this.dashHitApplied = false;

        // 控制状态（动画播完才真正锁住玩家）
        this.controlApplied = false;

        // 受击延迟重播（正在受击时再次受击）
        this.hurtQueued = false;

        // 战败
        this.deathAnimationFinished = false;

        // 小兵
        /** @type {DueMinion[]} */
        this.minions = [];

        // 寻路
        this.path = [];
        this.pathIndex = 0;

        // 表现
        this.showHitCircle = config.showHitCircle !== false;   // 判定提示圈
        this.arenaBounds = null;     // 由外部注入的可行走矩形（可选，默认用地图尺寸）

        // 回调
        this.onDeath = null;             // (boss) => void（战败动画播放完毕）
        this.onActionChange = null;      // (boss, action, previous) => void
        this.onAttackLand = null;        // (boss, action, hitPlayer) => void
        this.onDamageTaken = null;       // (boss, damage, source) => void
        this.onSummon = null;            // (boss, minion) => void（召唤出小兵）
        this.onControl = null;           // (boss, lockDuration) => void（控制命中玩家）
        this.onLowHealth = null;         // (boss) => void（气血 ≤ 50%，只触发一次）
        this.onMinionDeath = null;       // (boss, minion) => void

        // 目标 / 地图
        this.target = null;
        this.map = null;

        // 动画
        this.animationManager = config.animationManager || new AnimationManager();
        this.animationsReady = false;
        this.fightStarted = false;
        this.initAnimations();

        // 行为树
        this.behaviorTree = this.buildBehaviorTree();
        this.animationManager.setDirection(this.facing);
    }

    // ==================== 动画初始化 ====================

    /**
     * 初始化 7 套动画
     * 规格：idle 为列排列（4 列 = 下/左/右/上，每列 1 帧）；
     *       summon / dash / control / hurt / move 为行排列（4 行 = 下/左/右/上）× 6 帧；
     *       dead 为单行 6 帧（不分方向）。单帧 96×96。
     * 精灵图异步加载，加载前动画对象已登记（渲染时会自动跳过无图的帧）。
     */
    initAnimations() {
        const resourceManager = ResourceManager.getInstance();
        const prefix = `monsters.${this.monsterId}`;
        const frameSize = DueBoss.FRAME_SIZE;
        const rows = DueBoss.DIRECTION_ROWS;
        const frames = DueBoss.DIRECTION_FRAMES;
        const idleColumns = DueBoss.IDLE_COLUMNS;

        // 行排列（4 行 × 6 帧）方向配置：同一份对象可被多套动画共享
        const rowDirections = {};
        Object.keys(rows).forEach(dir => {
            rowDirections[dir] = { row: rows[dir], frames: frames };
        });

        // 列排列（4 列 × 1 帧）方向配置：待机专用
        const idleDirections = {};
        Object.keys(idleColumns).forEach(dir => {
            idleDirections[dir] = { col: idleColumns[dir], frames: 1 };
        });

        this.animationSpecs = [
            { name: 'idle',    key: `${prefix}_idle`,    fps: 4,  loop: true,  directionMode: 'column', directions: idleDirections },
            { name: 'move',    key: `${prefix}_move`,    fps: 10, loop: true,  directionMode: 'row', directions: rowDirections },
            { name: 'dash',    key: `${prefix}_dash`,    fps: 12, loop: false, directionMode: 'row', directions: rowDirections },
            { name: 'summon',  key: `${prefix}_summon`,  fps: 8,  loop: false, directionMode: 'row', directions: rowDirections },
            { name: 'control', key: `${prefix}_control`, fps: 8,  loop: false, directionMode: 'row', directions: rowDirections },
            { name: 'hurt',    key: `${prefix}_hurt`,    fps: 10, loop: false, directionMode: 'row', directions: rowDirections },
            { name: 'dead',    key: `${prefix}_dead`,    fps: 8,  loop: false, directionMode: 'row',
              directions: { down: { row: 0, frames: DueBoss.DEAD_FRAMES } } },
        ];

        this.animationSpecs.forEach(spec => {
            const animation = new Animation({
                name: spec.name,
                spriteSheet: null,
                frameWidth: frameSize,
                frameHeight: frameSize,
                directionMode: spec.directionMode,
                directions: spec.directions,
                fps: spec.fps,
                loop: spec.loop,
                defaultDirection: 'down',
            });
            this.animationManager.addAnimation(spec.name, animation);
        });

        this.animationsPromise = Promise.all(this.animationSpecs.map(async spec => {
            const image = await resourceManager.loadImage(spec.key);
            const animation = this.animationManager.getAnimation(spec.name);
            if (animation) animation.spriteSheet = image;
        })).then(() => {
            this.animationsReady = true;
        }).catch(error => {
            console.warn(`[渡厄使] 动画资源加载异常: ${error && error.message}`);
        });
    }

    /**
     * 载入小兵数值（Chapter2Config 的怪物配置 > DueBoss.tuning.minion > DueMinion 默认值）
     * @returns {Object} 交给 DueMinion 的 tuning
     */
    getMinionTuning() {
        return Object.assign({}, this.tuning.minion || {});
    }

    // ==================== 行为树 ====================

    /**
     * 构建行为树
     * 结构：选择器（root）→ 依次尝试子节点，命中即执行并结束本次评估。
     * 优先级：战败 > 受击打断 > 召唤 > 控制 > 冲刺 > 追击 > 待机
     * （冷却更长的招式排在前面，避免被 5 秒冷却的冲刺一直抢占出手机会）
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
                    name: '召唤（冷却结束且场上小兵未满）',
                    condition: (boss) => boss.cooldowns.summon <= 0
                        && boss.aliveMinionCount() < t.summonMaxMinions,
                    action: (boss) => boss.startSummon(),
                },
                {
                    name: '控制（冷却结束且在范围内）',
                    condition: (boss) => boss.cooldowns.control <= 0 && boss.hasTarget()
                        && boss.getTargetDistance() <= t.controlRange,
                    action: (boss) => boss.startControl(),
                },
                {
                    name: '冲刺（冷却结束且在触发范围内）',
                    condition: (boss) => boss.cooldowns.dash <= 0 && boss.hasTarget()
                        && boss.getTargetDistance() <= t.dashTriggerRange,
                    action: (boss) => boss.startDash(),
                },
                {
                    name: '追击（接近玩家）',
                    condition: (boss) => boss.hasTarget() && boss.getTargetDistance() > t.attackStopRange
                        && boss.getTargetDistance() <= t.aggroRange,
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
                if (this.runNode(child)) return true;
            }
            return false;
        }

        if (node.condition && !node.condition(this)) return false;
        if (!node.action) return false;

        node.action(this);
        return true;
    }

    /**
     * 当前动作是否可以重新决策（防止每帧乱切动作）
     * - idle：达到最短待机时长
     * - summon / control / hurt：当前动画播放完毕
     * - move：由移动逻辑自行结束（到达 / 超时 / 无路径）
     * - dash：不可打断，必须等动画播完
     * @returns {boolean}
     */
    canDecide() {
        if (!this.isAlive) return false;

        // 受击打断不受“最短动作时长”限制：一旦排队受击，立即允许行为树重新决策
        if (this.hurtQueued && this.canBeInterrupted()) return true;

        switch (this.action) {
            case 'idle':
                return this.actionTime >= this.actionMinDuration;
            case 'summon':
            case 'control':
            case 'hurt':
                return this.isCurrentAnimationFinished();
            case 'move':
            case 'dash':
                return false;
            default:
                return this.actionTime >= this.actionMinDuration;
        }
    }

    /**
     * 当前动作是否可被受击打断（冲刺不可打断）
     * @returns {boolean}
     */
    canBeInterrupted() {
        return this.action === 'idle' || this.action === 'move'
            || this.action === 'summon' || this.action === 'control';
    }

    /**
     * 入场对白冻结开关（战前对白期间由 Main / GameMap 打开，正式开战解除）
     *
     * 冻结期间 DueBoss.update 只推进计时与动画：不评估行为树、不移动、不使用
     * 冲刺 / 控制 / 召唤，因此不会对玩家造成任何伤害（玩家此时被锁输入）。
     * @param {boolean} [locked=true] - true=冻结（对白中）/ false=解冻（开战）
     */
    setIntroLock(locked = true) {
        this.introLock = !!locked;

        if (this.introLock) {
            // 站定在出生位：清掉在途路径与追击状态（若冻结时正在冲刺则收回动作）
            this.path = [];
            this.pathIndex = 0;
            this.unreachableTimer = 0;
            this.isMoving = false;
            if (this.isAlive && this.action !== 'idle' && typeof this.startIdle === 'function') {
                this.startIdle(0);
            }
        }

        Logger.log(`[DueBoss] 入场冻结 ${this.introLock ? '开启（对白期间不移动 / 不出手）' : '解除'}`);
    }

    /**
     * 正式开战（由 Main.startArenaFight 在战前对白结束后调用）
     * 重置冷却与阶段标记：冲刺立刻可用，控制 6 秒后、召唤 12 秒后第一次可用
     */
    startFight() {
        this.fightStarted = true;
        this.introLock = false;     // 对白已读完：解除入场冻结，开始正常行动
        this.cooldowns.dash = this.tuning.initialCooldownDash;
        this.cooldowns.control = this.tuning.initialCooldownControl;
        this.cooldowns.summon = this.tuning.initialCooldownSummon;
        this.lowHealthAnnounced = false;

        if (!this.target && this.map && this.map.player) {
            this.target = this.map.player;
        }
        this.startIdle(0);
    }

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
            if (map.tileSize) this.tileSize = map.tileSize;
        }

        this.updateTimers(deltaTime);
        this.updateHitFlash(deltaTime);

        // 入场对白冻结（B01 战前对白）：只推进计时与动画，不决策、不移动、不使用任何招式 ——
        // 玩家此时被锁输入，这里必须保证 Boss 对玩家零伤害（见 setIntroLock）。
        if (this.introLock) {
            this.animationManager.update(deltaTime);
            return;
        }

        if (this.isAlive) {
            this.updateAction(deltaTime);
            this.checkLowHealth();

            // 行为树按固定间隔评估，且只允许在动作结束后切换（动作最短持续时间）；
            // 受击打断例外：排队受击时立即重新决策，保证打断手感（不受节流限制）
            const interruptPending = this.hurtQueued && this.canBeInterrupted();

            this.decisionTimer -= deltaTime;
            if (this.decisionTimer <= 0 || interruptPending) {
                this.decisionTimer = this.tuning.decisionInterval;
                if (this.canDecide()) this.runBehaviorTree();
            }
        } else {
            this.updateDeath();
        }

        this.animationManager.update(deltaTime);
    }

    /**
     * 冷却计时（冲刺 / 控制 / 召唤）
     * @param {number} deltaTime
     */
    updateTimers(deltaTime) {
        ['dash', 'control', 'summon'].forEach(key => {
            if (this.cooldowns[key] > 0) {
                this.cooldowns[key] = Math.max(0, this.cooldowns[key] - deltaTime);
            }
        });
    }

    /**
     * 受击闪烁计时
     * @param {number} deltaTime
     */
    updateHitFlash(deltaTime) {
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer = Math.max(0, this.hitFlashTimer - deltaTime);
            this.isHit = this.hitFlashTimer > 0;
        }
    }

    /**
     * 低气血阶段：气血 ≤ 50% 时只触发一次 onLowHealth（Main 用来播短字幕）
     */
    checkLowHealth() {
        if (this.lowHealthAnnounced) return;
        if (this.health > this.maxHealth * this.tuning.lowHealthPercent) return;

        this.lowHealthAnnounced = true;
        if (this.onLowHealth) this.onLowHealth(this);
    }

    /**
     * 推进当前动作
     * @param {number} deltaTime
     */
    updateAction(deltaTime) {
        this.actionTime += deltaTime;

        switch (this.action) {
            case 'idle':    this.updateIdle(deltaTime); break;
            case 'move':    this.updateMove(deltaTime); break;
            case 'dash':    this.updateDash(deltaTime); break;
            case 'control': this.updateControl(); break;
            case 'summon':  this.updateSummon(); break;
            case 'hurt':    this.updateHurt(); break;
            default: break;
        }
    }

    // ==================== 目标 / 朝向 / 动画 ====================

    /**
     * 设置目标（通常是玩家）
     * @param {Object} target
     */
    setTarget(target) {
        this.target = target || null;
    }

    /** 清除目标 */
    clearTarget() {
        this.target = null;
    }

    /**
     * 获取当前目标（优先缓存，其次取地图上的玩家）
     * @returns {Object|null}
     */
    getTarget() {
        if (this.target && this.target.isAlive !== false) return this.target;

        if (this.map && this.map.player && this.map.player.isAlive !== false) {
            this.target = this.map.player;
            return this.target;
        }
        return null;
    }

    /** 是否存在有效目标 */
    hasTarget() {
        return !!this.getTarget();
    }

    /** 与目标的距离（无目标返回 Infinity） */
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
     * 面向目标（待机 / 控制 / 召唤时朝向玩家）
     * @param {Object} point - {x, y}
     */
    facePoint(point) {
        if (!point) return;

        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        this.facing = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');
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

    /** 当前动画是否已播放完毕 */
    isCurrentAnimationFinished() {
        const animation = this.animationManager.getCurrentAnimation();
        return !!(animation && animation.isFinished);
    }

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

    /** 当前动画帧索引（0 起） */
    getCurrentAnimationFrame() {
        const animation = this.animationManager.getCurrentAnimation();
        return animation ? animation.currentFrame : 0;
    }

    // ==================== 动作切换 ====================

    /**
     * 切换动作（记录上一动作并触发回调）
     * @param {string} action - 动作名
     * @param {number} minDuration - 最短持续时间（秒）
     * @returns {boolean} 是否发生了变化
     */
    changeAction(action, minDuration) {
        const changed = this.action !== action;
        const previous = this.action;

        this.action = action;
        this.actionTime = 0;
        this.actionMinDuration = minDuration !== undefined ? minDuration : 0;
        this.hitFrameApplied = false;   // 命中帧在每次动作开始时重新计算

        if (changed && this.onActionChange) this.onActionChange(this, action, previous);
        return changed;
    }

    /**
     * 待机
     * 已在待机且当前播放的就是待机动画时不重启动画（避免待机反复回到第一帧）
     * @param {number} [minDuration] - 最短待机时长
     */
    startIdle(minDuration) {
        const changed = this.changeAction('idle',
            minDuration !== undefined ? minDuration : this.tuning.idleDuration);
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;

        const idleAnimation = this.animationManager.getAnimation('idle');
        if (changed || this.animationManager.getCurrentAnimation() !== idleAnimation) {
            this.playAnimation('idle', true);
        }
    }

    /** 开始追击（行为树节点：追击） */
    startMove() {
        this.changeAction('move', this.tuning.maxMoveTime);
        this.isMoving = true;
        this.repathToTarget();
        this.playAnimation('move', true);
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

        // 结束条件二：超过单次追击最长持续时间（贴太近时满足最短追击时长即可收手）
        if (this.actionTime >= this.tuning.maxMoveTime
            || (this.actionTime >= this.tuning.minMoveTime && distance <= this.tuning.keepDistance)) {
            this.startIdle(0.1);
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

        // 轴对齐推进：正常情况路径点与当前位置同行或同列，只有一个轴有效；
        // 主轴被挡时尝试另一轴（贴角滑行），避免大型碰撞盒卡在瓦片拐角
        const step = this.tuning.moveSpeed * deltaTime;
        if (step <= 0) return;

        const stepX = Math.sign(dx) * Math.min(step, Math.abs(dx));
        const stepY = Math.sign(dy) * Math.min(step, Math.abs(dy));

        let usedX = 0;
        let usedY = 0;
        let moved = false;

        if (Math.abs(dx) >= Math.abs(dy)) {
            if (this.tryMove(stepX, 0)) {
                moved = true;
                usedX = stepX;
            } else if (Math.abs(dy) >= 1 && this.tryMove(0, stepY)) {
                moved = true;
                usedY = stepY;
            }
        } else if (this.tryMove(0, stepY)) {
            moved = true;
            usedY = stepY;
        } else if (Math.abs(dx) >= 1 && this.tryMove(stepX, 0)) {
            moved = true;
            usedX = stepX;
        }

        if (!moved) {
            // 两轴都走不通：重新寻路；连续受阻则原地待机（避免卡墙抖动）
            this.unreachableTimer += deltaTime;
            this.repathToTarget();
            if (this.unreachableTimer >= 0.6) {
                this.unreachableTimer = 0;
                this.startIdle(0.2);
            }
            return;
        }

        this.unreachableTimer = 0;
        this.faceDirection(usedX, usedY);
    }

    // ==================== 冲刺（不可打断） ====================

    /**
     * 冲刺：锁定突进轴与方向，沿轴高速位移；动画结束时以本体为圆心判定伤害
     * 播放期间照常掉血，但不播放受击动画、不中断冲刺（见 takeDamage）
     */
    startDash() {
        this.changeAction('dash', this.tuning.dashDuration);
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;
        this.cooldowns.dash = this.tuning.cooldownDash;
        this.dashHitApplied = false;
        this.dashTrail = [];

        // 锁定突进轴（只允许上下左右）与方向
        const target = this.getTarget();
        if (target && target.position) {
            const dx = target.position.x - this.position.x;
            const dy = target.position.y - this.position.y;
            this.dashAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
            this.dashSign = Math.sign(this.dashAxis === 'x' ? dx : dy) || 1;
        } else {
            this.dashAxis = 'x';
            this.dashSign = 1;
        }

        this.faceDirection(
            this.dashAxis === 'x' ? this.dashSign : 0,
            this.dashAxis === 'y' ? this.dashSign : 0
        );

        this.playAnimation('dash', false);
        // 冲刺音效：与冲刺动画同一时刻
        this._playSfx('sfx.boss_due_dash');
    }

    /**
     * 冲刺推进：位移 + 残影；动画播完 → 停止移动并结算圆形范围伤害
     * @param {number} deltaTime
     */
    updateDash(deltaTime) {
        // 突进（不可打断：此处不检查受伤状态）
        const step = this.tuning.dashSpeed * deltaTime;
        if (this.dashAxis === 'x') {
            this.tryMove(this.dashSign * step, 0);
        } else {
            this.tryMove(0, this.dashSign * step);
        }

        // 残影（表现层：沿冲刺轨迹留下一串淡影）
        this.dashTrail.push({ x: this.position.x, y: this.position.y, life: 0.22 });
        if (this.dashTrail.length > this.tuning.dashAfterimage) this.dashTrail.shift();
        this.dashTrail.forEach(trail => { trail.life = Math.max(0, trail.life - deltaTime); });

        // 动画播完 → 以本体为圆心画圆：玩家碰撞盒落在圆内即受伤
        if (this.isCurrentAnimationFinished()) {
            if (!this.dashHitApplied) {
                this.dashHitApplied = true;
                this.dealCircleDamage(this.tuning.dashRadius);
            }
            this.dashTrail = [];
            this.startIdle(0.08);
        }
    }

    // ==================== 控制（可被打断） ====================

    /**
     * 控制：动画播完后玩家头顶出现锁链、禁止一切按键输入（时长见 controlLockDuration）
     * 由 Main 接管输入封锁与锁链绘制（onControl 回调）
     */
    startControl() {
        this.changeAction('control', this.tuning.controlDuration);
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;
        this.cooldowns.control = this.tuning.cooldownControl;
        this.controlApplied = false;

        const target = this.getTarget();
        if (target && target.position) this.facePoint(target.position);

        this.playAnimation('control', false);
        // 控制音效：与控制动画同一时刻（真正命中玩家是在动画播完后，另有锁链表现）
        this._playSfx('sfx.boss_due_control');
    }

    /** 控制推进：动画播完 → 施加控制（只施加一次） */
    updateControl() {
        const target = this.getTarget();
        if (target && target.position) this.facePoint(target.position);

        if (!this.isCurrentAnimationFinished()) return;

        if (!this.controlApplied) {
            this.controlApplied = true;
            if (this.onControl) this.onControl(this, this.tuning.controlLockDuration);
        }
        this.startIdle(0.1);
    }

    // ==================== 召唤（可被打断） ====================

    /**
     * 召唤：动画结束时在原地生成 1 个小兵（场上最多 summonMaxMinions 个）
     */
    startSummon() {
        this.changeAction('summon', this.tuning.summonDuration);
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;
        this.cooldowns.summon = this.tuning.cooldownSummon;

        const target = this.getTarget();
        if (target && target.position) this.facePoint(target.position);

        this.playAnimation('summon', false);
        // 召唤音效：与召唤动画同一时刻
        this._playSfx('sfx.boss_due_summon');
    }

    /** 召唤推进：动画播完 → 生成小兵 */
    updateSummon() {
        if (!this.isCurrentAnimationFinished()) return;

        this.spawnMinion();
        this.startIdle(0.1);
    }

    // ==================== 小兵管理 ====================

    /** 场上存活小兵数量 */
    aliveMinionCount() {
        return this.minions.filter(minion => minion && minion.isAlive).length;
    }

    /**
     * 在 Boss 当前位置生成一个小兵（场上最多 summonMaxMinions 个）
     * @returns {DueMinion|null}
     */
    spawnMinion() {
        if (this.aliveMinionCount() >= this.tuning.summonMaxMinions) return null;
        if (typeof DueMinion !== 'function') return null;

        this.summonCount++;
        const minion = new DueMinion({
            id: `${this.id}_minion_${this.summonCount}`,
            monsterId: 'boss_due_minion',
            position: { x: this.position.x, y: this.position.y },
            tuning: this.getMinionTuning(),
            tileSize: this.tileSize,
            showHitCircle: this.showHitCircle,
        });

        minion.map = this.map;
        minion.target = this.getTarget();
        minion.facing = this.facing;
        minion.onDeath = (dead) => this.removeMinion(dead);

        this.minions.push(minion);
        if (this.map && this.map.monsters) {
            this.map.monsters.set(minion.id, minion);   // 进 monsters：GameLoop 统一 update / render
        }

        Logger.log(`[渡厄使] 召唤小兵 ${minion.id}`
            + `（场上 ${this.aliveMinionCount()} / ${this.tuning.summonMaxMinions}）`);

        if (this.onSummon) this.onSummon(this, minion);
        return minion;
    }

    /**
     * 移除一个小兵（从地图 monsters 中删除并释放引用）
     * @param {DueMinion} minion
     */
    removeMinion(minion) {
        if (!minion) return;

        if (this.map && this.map.monsters) {
            this.map.monsters.delete(minion.id);
        }

        const index = this.minions.indexOf(minion);
        if (index !== -1) this.minions.splice(index, 1);

        if (typeof minion.destroy === 'function') minion.destroy();
        if (this.onMinionDeath) this.onMinionDeath(this, minion);
    }

    /** 清空场上所有小兵（Boss 战败 / 战场清理时调用） */
    clearMinions() {
        this.minions.slice().forEach(minion => this.removeMinion(minion));
        this.minions = [];
    }

    // ==================== 受击 ====================

    /**
     * 受击（打断可打断动作：待机 / 移动 / 召唤 / 控制；冲刺与受击中的处理见 takeDamage）
     */
    startHurt() {
        this.hurtQueued = false;

        this.changeAction('hurt', this.tuning.hurtDuration);
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;

        this.playAnimation('hurt', false);
    }

    /**
     * 受击推进：动画播完即回到决策
     * （受击动画播放期间再次受伤不会重播受击动画，见 takeDamage）
     */
    updateHurt() {
        if (!this.isCurrentAnimationFinished()) return;

        this.startIdle(0.05);
    }

    // ==================== 战败 ====================

    /**
     * 战败：播放战败动画并停在最后一帧（播完后清空小兵并触发 onDeath）
     */
    enterDead() {
        if (this.action === 'dead') return;

        this.isAlive = false;
        this.hurtQueued = false;
        this.isMoving = false;
        this.path = [];
        this.pathIndex = 0;
        this.dashTrail = [];

        this.changeAction('dead', 0);
        this.playAnimation('dead', false);

        // 战败音效：与战败动画同一时刻
        this._playSfx('sfx.boss_due_defeat');

        Logger.log('[渡厄使] 战败');
    }

    /**
     * 战败状态推进：动画播完后停帧、删除所有小兵，并触发一次 onDeath
     */
    updateDeath() {
        if (this.deathAnimationFinished) return;
        if (!this.isCurrentAnimationFinished()) return;

        this.deathAnimationFinished = true;
        this.clearMinions();

        if (this.onDeath) this.onDeath(this);
    }

    /**
     * 战败动画是否已播完（Main 据此结算胜利：记标记 + 战场正中心开启归途法阵）
     * @returns {boolean}
     */
    isDefeatSequenceFinished() {
        return !this.isAlive && this.deathAnimationFinished;
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
     * 尝试按 (dx, dy) 移动（轴对齐，不做斜向；脚下碰撞盒必须落在可通行瓦片上）
     * @param {number} dx - x 方向位移
     * @param {number} dy - y 方向位移
     * @returns {boolean} 是否成功移动
     */
    tryMove(dx, dy) {
        if (dx === 0 && dy === 0) return false;

        const nextX = this.position.x + dx;
        const nextY = this.position.y + dy;

        if (!this.isInsideMap(nextX, nextY)) return false;

        if (this.map && this.map.isRectWalkable) {
            if (!this.map.isRectWalkable(this.getFootRect({ x: nextX, y: nextY }))) return false;
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
        const frameSize = DueBoss.FRAME_SIZE * this.tuning.scale;
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
     * - 冲刺中：照常掉血，但不播放受击动画、不中断冲刺
     * - 受击动画中再次受伤：本次播完即回到决策，不重播受击动画（不延长、不叠加）
     * - 其余可打断动作（待机 / 移动 / 召唤 / 控制）：立即打断为受击
     * @param {number} damage - 原始伤害
     * @param {Object} [source] - 伤害来源
     * @returns {boolean} 是否成功结算
     */
    takeDamage(damage, source) {
        if (!this.isAlive || !damage || damage <= 0) return false;

        const actualDamage = GameConfig.getInstance().calculateDamage(damage, this.defense);
        this.health = Math.max(0, this.health - actualDamage);

        // 受击闪烁
        this.isHit = true;
        this.hitFlashTimer = this.tuning.hitFlashDuration;

        if (this.onDamageTaken) this.onDamageTaken(this, actualDamage, source);

        if (this.health <= 0) {
            // 这一击致命 → 由 enterDead 播战败音效（与战败动画同步，不再叠受伤音效）
            this.enterDead();
            return true;
        }

        // 受伤音效：每次受伤都播；受伤音效正在播放时这一次不播（不叠加）
        this._playSfxExclusive('sfx.boss_due_hurt');

        // 打断规则
        if (this.action === 'dash' || this.action === 'hurt') {
            // 冲刺不可打断（仅掉血与闪白）；受击动画播放中再次受伤也不重播
        } else if (this.canBeInterrupted()) {
            this.hurtQueued = true;
        }

        return true;
    }

    /**
     * 处理玩家普通攻击（由 Main 在战场内转发；同时转发给场上小兵）
     * @param {Object} attackData - { rect: {x,y,width,height}, damage: number, source: Object }
     * @returns {boolean} 是否命中 Boss 本体
     */
    handlePlayerAttack(attackData) {
        if (!attackData || !attackData.rect) return false;

        // 小兵：普攻在战场内只转发给 Boss，因此这里一并转发，保证小兵也能被普攻打死
        this.minions.forEach(minion => {
            if (minion && typeof minion.handlePlayerAttack === 'function') {
                minion.handlePlayerAttack(attackData);
            }
        });

        if (!this.isAlive) return false;
        if (!CollisionDetector.rectsIntersect(attackData.rect, this.getHitRect())) return false;

        return this.takeDamage(attackData.damage || 0, attackData.source);
    }

    /**
     * 以 Boss 为中心结算一次圆形范围伤害（冲刺结束时使用）
     * @param {number} radius - 判定半径（像素）
     * @returns {boolean} 是否命中玩家
     */
    dealCircleDamage(radius) {
        const target = this.getTarget();
        let hit = false;

        if (target && target.position && target.isAlive !== false) {
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

        if (this.onAttackLand) this.onAttackLand(this, this.action, hit);
        return hit;
    }

    // ==================== 渲染 ====================

    /**
     * 渲染 Boss（冲刺残影 → 判定圈 → 本体）
     * 战败动画播完后停在最后一帧，因此这里不做“播完即隐藏”的处理。
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    render(ctx, camera) {
        if (!ctx || this.isDestroyed) return;

        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };

        // 1. 判定提示圈（地面层，先于本体绘制）
        this.renderHitCircle(ctx, renderPos);

        // 2. 冲刺残影（沿冲刺轨迹的淡影）
        this.renderDashTrail(ctx, renderPos);

        // 3. 本体
        const frameSize = DueBoss.FRAME_SIZE * this.tuning.scale;
        const screenX = this.position.x - renderPos.x - frameSize / 2;
        const screenY = this.position.y - renderPos.y - frameSize / 2;

        const renderOptions = {};
        if (this.isHit && Math.floor(this.hitFlashTimer * 20) % 2 === 0) {
            renderOptions.alpha = 0.75;
        }

        this.animationManager.render(ctx, screenX, screenY, frameSize, frameSize, renderOptions);
    }

    /**
     * 冲刺残影（程序化绘制，不依赖额外美术）
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} renderPos - 摄像机渲染偏移
     */
    renderDashTrail(ctx, renderPos) {
        if (!this.dashTrail || this.dashTrail.length === 0) return;

        ctx.save();
        this.dashTrail.forEach(trail => {
            const alpha = Math.max(0, trail.life / 0.22) * 0.28;
            if (alpha <= 0) return;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(180, 150, 255, 1)';
            ctx.beginPath();
            ctx.ellipse(
                trail.x - renderPos.x,
                trail.y - renderPos.y,
                34,
                46,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();
        });
        ctx.restore();
    }

    /**
     * 绘制判定提示圈（冲刺可见；调试模式下常显）
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} renderPos - 摄像机渲染偏移
     */
    renderHitCircle(ctx, renderPos) {
        let radius = 0;
        if (this.action === 'dash') {
            radius = this.tuning.dashRadius;
        } else if (this.action === 'control') {
            radius = this.tuning.controlRange;
        }

        if (!this.showHitCircle && !this.tuning.debugHitboxes) return;
        if (radius <= 0 && !this.tuning.debugHitboxes) return;

        if (radius <= 0) {
            radius = this.tuning.hitBoxSize / 2;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(this.position.x - renderPos.x, this.position.y - renderPos.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.action === 'dash'
            ? 'rgba(255, 168, 92, 0.55)'
            : 'rgba(198, 230, 255, 0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = this.action === 'dash'
            ? 'rgba(255, 168, 92, 0.10)'
            : 'rgba(198, 230, 255, 0.06)';
        ctx.fill();
        ctx.restore();
    }

    // ==================== 奖励 / 存档 ====================

    /**
     * 战斗奖励（与其他怪物保持一致，便于后续发奖）
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
            cooldowns: { ...this.cooldowns },
            lowHealthAnnounced: this.lowHealthAnnounced,
            fightStarted: this.fightStarted,
            minions: this.minions.map(minion => minion.serialize()),
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
        if (data.cooldowns) Object.assign(this.cooldowns, data.cooldowns);

        this.lowHealthAnnounced = !!data.lowHealthAnnounced;
        this.fightStarted = !!data.fightStarted;

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
     * - 先删除场上所有小兵（战败后残留的小兵一并清掉）
     * - 清空路径 / 残影缓存，断开地图 / 目标引用
     * - 释放 'bossArenaCh2' 资源分组（Boss + 小兵的所有精灵图，下次进场重新加载）
     */
    destroy() {
        if (this.isDestroyed) return;

        this.clearMinions();

        this.isDestroyed = true;
        this.path = [];
        this.dashTrail = [];
        this.target = null;
        this.map = null;

        // 资源键统一来自 ResourceManager.resourceGroups.bossArenaCh2（与进场预加载保持一致）
        if (typeof ResourceManager !== 'undefined') {
            const resourceManager = ResourceManager.getInstance();

            if (this.releaseResources && resourceManager.releaseResourceGroup) {
                const released = resourceManager.releaseResourceGroup('bossArenaCh2');
                Logger.log(`[渡厄使] 已清理 Boss 资源（释放 ${released} 张精灵图缓存）`);
            } else {
                Logger.log('[渡厄使] 已清理 Boss 资源（保留图片缓存）');
            }
        }

        if (this.animationManager) this.animationManager.stop();
    }
}

if (typeof window !== 'undefined') {
    window.DueMinion = DueMinion;
    window.DueBoss = DueBoss;
}

