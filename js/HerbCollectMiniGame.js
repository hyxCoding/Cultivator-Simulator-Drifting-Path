/**
 * 乘风采药小游戏
 * 瓦片地图碰撞 + 固定节奏风系统 + 草药采集
 * 地图：1280×720，32×18 格，每格 40px（精确适配碰撞图分辨率）
 * 起风时主角切换为乘风飞行动画
 * 碰撞判断：继承自 collision.png 分析结果，硬编码为静态 COLLISION_MAP（32×18），
 *   避免运行时 getImageData 在 file:// 协议下受 CORS 限制无法读取像素
 *
 * ==========================================================================
 * 一、核心规则（第十三次改动后的最终需求，改行为先看这里）
 *   1) 无风时玩家只能待在陆地上：走位要求「整块碰撞盒（22×26）都落在陆地瓦片」才允许
 *      （_updatePlayerMovement → _canStandAt → _isTileWalkable）；
 *   2) 有风时虚空瓦片同样可站 / 可走（角色切乘风飞行动画）；
 *   3) 风一停，玩家若还留在虚空上 → 小游戏失败（_checkVoidFall：判定对象与走位一致，
 *      碰撞盒有任何一格是虚空即算「还在虚空」）；
 *   4) 采完全部草药 → 立刻胜利：本帧结算 complete()（胜利音效）→ 退出小游戏
 *      （MiniGameScene → Main.handleMiniGameEnd 切回主图）→ 主角收尾对白
 *      （文本见路标 successDialogue / Main.playHerbCollectSuccessDialogue）；
 *   5) 风系统是固定节奏，不再随机：每次起风固定 WIND_DURATION_SECONDS（3 秒），
 *      上一阵风停到下一阵风起固定 WIND_INTERVAL_SECONDS（5 秒）—— 见 _updateWind()；
 *   6) 背景音乐 bgm.minigame_herb **只在起风期间循环**：起风播、风停立刻停，
 *      本局结算（complete / fail）与退出（exit）也立刻停（_stopWindBgm）。
 *
 * 二、每帧只更新一次（2026-09-13 第十三次改动一并修掉）
 *   更新链路只有一条：GameLoop → SceneManager.update → MiniGameScene.update →
 *   MiniGameManager.update。Main.update 不再重复驱动小游戏 —— 旧代码
 *   MiniGameScene.update 与 Main.updateMiniGame 各调一次，同一帧 dt 翻倍：
 *   固定节奏的风会变成「实际 1.5 秒」，同一份 pressedKeys 也会被读两遍。
 * ==========================================================================
 */
// 碰撞数据（硬编码自 collision.png 逐瓦片白/黑像素统计）
// 1=陆地, 0=虚空；32 列 × 18 行，每格 40px；1280×720 地图
const COLLISION_MAP = [
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,1,1,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,1,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
[0,0,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
[0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// ==========================================================================
//  风系统节奏（固定值）
// --------------------------------------------------------------------------
//  · WIND_DURATION_SECONDS：一次起风持续多久（秒）—— 需求「每次风持续的时间都是固定时长，3 秒左右」
//  · WIND_INTERVAL_SECONDS：上一阵风停到下一阵风起之间的间隔（秒）—— 需求「起风的时间间隔为 5 秒」
//  只在这两个常量上调节奏；_updateWind() 是唯一读取它们的地方（不再随机抽时长 / 冷却）。
// ==========================================================================
const WIND_DURATION_SECONDS = 3;
const WIND_INTERVAL_SECONDS = 5;

class HerbCollectMiniGame extends MiniGame {
    constructor(config) {
        super({ id: 'herb_collect', name: '乘风采药', timeLimit: 0, maxScore: 100, ...config });
        this.collisionData = COLLISION_MAP;  // 静态碰撞数据，无需异步加载
        this.tileSize = 40;
        this.mapCols = 32;
        this.mapRows = 18;
        this.mapWidth = 1280;
        this.mapHeight = 720;
        this.player = { x: 300, y: 550, width: 22, height: 26, speed: 160 };
        // 风状态（固定节奏，见 WIND_DURATION_SECONDS / WIND_INTERVAL_SECONDS）
        //   active   —— 当前是否有风（有风时虚空可走 / 可站，BGM 循环播放）
        //   timer    —— 本阶段已经过的秒数（起风时 = 本阵风已刮多久；静风时也照常累加）
        //   duration —— 一阵风的固定时长（起风那一刻写入，供 HUD / 调试查看）
        //   cooldown —— 距离下一阵风还有多少秒（静风期间递减，归零即起风）
        this.wind = { active: false, timer: 0, duration: WIND_DURATION_SECONDS, cooldown: WIND_INTERVAL_SECONDS, animOffset: 0, fadeAlpha: 0, fadeSpeed: 2.0 };
        this.windAnimFrame = 0;
        this.windAnimTimer = 0;
        this.herbs = this._generateHerbs();
        this.collectedHerbs = 0;
        this.requiredHerbs = this.herbs.length;
        this.nearbyHerb = null;
        this.gamePhase = 'tutorial';
        this.tutorialStep = 0;
        this.tutorialTimer = 0;
        this.isFirstPlay = true;
        this.keys = {};
        this.eJustPressed = false;
        this.playerDir = 0;      // 0=下, 1=左, 2=右, 3=上
        this.animFrame = 0;      // 行走动画帧 0~3
        this.animTimer = 0;
        this.isMoving = false;
        this.bgImage = null;
        this.windImage = null;
        this.playerImage = null;      // 行走状态图像
        this.playerFlyImage = null;   // 乘风飞行状态图像
        this.playerIdleImage = null;  // 闲置站立图像
        this.herbImage = null;
        this._loadResources();
    }

    _loadResources() {
        try {
            // 通过基类服务适配器取图（主游戏未注入服务时回落 ResourceManager 单例）——
            // 小游戏不再直接依赖具体资源单例。仅从缓存同步读取（Main.js 预加载保证已缓存）。
            const bg      = this.getServiceImage('miniGame.caoyao_bg');
            const wind    = this.getServiceImage('miniGame.caoyao_wind');
            const player  = this.getServiceImage('player.sanxiu_walk');
            const fly     = this.getServiceImage('player.sanxiu_fly');
            const idle    = this.getServiceImage('player.sanxiu_idle');
            const herb    = this.getServiceImage('miniGame.caoyao_herb');

            if (bg)      this.bgImage = bg;
            if (wind)    this.windImage = wind;
            if (player)  this.playerImage = player;
            if (fly)     this.playerFlyImage = fly;
            if (idle)    this.playerIdleImage = idle;
            if (herb)    this.herbImage = herb;
        } catch (_) {}
    }

    _generateHerbs() {
        // 草药像素坐标（直接指定，不依赖瓦片换算）
        const posList = [
            { x: 250, y: 520 },
            { x: 240, y: 240 },
            { x: 383, y: 117 },
            { x: 450, y: 150 },
            { x: 667, y: 93 },
            { x: 925, y: 150 },
            { x: 1050, y: 300 },
            { x: 1110, y: 344 },
        ];
        return posList.map(p => ({ x: p.x, y: p.y, collected: false }));
    }

    /**
     * 读取启动参数（主游戏在 start 时注入）。
     * requiredHerbs：本次需要采集的草药数量（默认取生成的全部，即 8）。
     * 后续若要「只采 5 株」的新任务，只需在 GameConfig.miniGames / 调用处传参，无需改本文件逻辑。
     */
    applyParams(params) {
        this._requiredHerbsOverride = 0;
        if (params && Number.isInteger(params.requiredHerbs) && params.requiredHerbs > 0) {
            this._requiredHerbsOverride = params.requiredHerbs;
        }
    }

    start(params, services) {
        super.start(params, services);
        this.player.x = 300;
        this.player.y = 550;
        this.herbs = this._generateHerbs();
        // 启动参数可限定本次采集数量（缺省 = 全部）
        if (this._requiredHerbsOverride && this._requiredHerbsOverride < this.herbs.length) {
            this.herbs = this.herbs.slice(0, this._requiredHerbsOverride);
        }
        this.requiredHerbs = this.herbs.length;
        this.collectedHerbs = 0;
        this.nearbyHerb = null;
        this.wind.active = false;
        this.wind.timer = 0;
        // 一阵风固定 3 秒；开局先静风固定 5 秒（旧写法是 0.5~2 秒随机 + 5~10 秒随机风）
        this.wind.duration = WIND_DURATION_SECONDS;
        this.wind.cooldown = WIND_INTERVAL_SECONDS;
        this.wind.animOffset = 0; this.wind.fadeAlpha = 0;
        this.windAnimFrame = 0; this.windAnimTimer = 0;
        this.gamePhase = this.isFirstPlay ? 'tutorial' : 'playing';
        this.tutorialStep = 0; this.tutorialTimer = 0;
        this.keys = {}; this.eJustPressed = false;
        // 背景音乐：新一局开始时确保「起风期间才播」的小游戏 BGM 是停着的
        this._stopWindBgm();
    }
update(dt, input) {
        super.update(dt, input);
        if (!this.isRunning || this.isPaused) return;
        this._readInput(input);
        if (this.gamePhase === 'tutorial') this._updateTutorial(dt);
        // 风系统按固定时间线推进：教学阶段也照样起风 / 停风
        // （教学第 3 步就是「风起时可在虚空中行走」，旧写法只在 playing 阶段推进风，
        //   教学时永远等不到风。走同一条时间线，教学与正式局的节奏也完全一致。）
        this._updateWind(dt);
        this._updatePlayerMovement(dt);
        this._updateWindVisual(dt);
        this._checkHerbProximity();

        // 先判「采齐」再判「坠落」：最后一株草药若正好长在虚空上（x/y 见 _generateHerbs，
        // 右侧两株确实在虚空瓦片上）、同帧风又停了，旧顺序会先 fail() 再 complete() ——
        // 成功 / 失败音效同时响、结算界面连开两次（偶发）。采齐即本局结束（成功优先），
        // 本帧不再做坠落判定。
        //
        // 2026-09-13 追加加固（玩家反馈：胜利后仍会听到失败音效）：
        //   胜利判定不止「本帧返回」，还置**胜利锁定状态位** this.isWinLocked ——
        //   此后同一局里任何一处失败判定（本帧以后的坠落、到点结算 checkTimeUp）都被忽略，
        //   胜利与失败两套逻辑不会再各响一次（见 _checkVoidFall / fail / MiniGame.isWinLocked）。
        if (this.collectedHerbs >= this.requiredHerbs) {
            this.isWinLocked = true;      // 胜利锁定：本局不再接受任何失败判定
            this.score = this.maxScore;
            this.complete();
            return;
        }
        this._checkVoidFall();
    }

    _readInput(input) {
        if (!input) return;
        this.keys = {};
        if (input.keys) for (const k of ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']) this.keys[k] = !!input.keys[k];
        this.eJustPressed = !!(input.pressedKeys && input.pressedKeys['e']);
    }

    _updateTutorial(dt) {
        this.tutorialTimer += dt;
        const steps = [
            { text: '按 WASD 或方向键移动', done: () => this._hasMoved() },
            { text: '靠近发光的草药，按 E 采集', done: () => this.collectedHerbs >= 1 },
            { text: '风起时可在虚空中行走', done: () => this.tutorialTimer > 8 },
        ];
        if (steps[this.tutorialStep] && steps[this.tutorialStep].done()) {
            if (this.tutorialStep < steps.length - 1) { this.tutorialStep++; this.tutorialTimer = 0; }
            else { this.gamePhase = 'playing'; this.tutorialStep = 0; this.tutorialTimer = 0; this.isFirstPlay = false; }
        }
    }

    _hasMoved() {
        const sx = 300, sy = 550;
        return Math.hypot(this.player.x-sx, this.player.y-sy) > this.tileSize;
    }

    // ======================================================================
    //  风系统（固定节奏：静风 5 秒 → 起风 3 秒 → 静风 5 秒 → ……）
    // ======================================================================

    /**
     * 推进风系统（固定时长，不再随机）
     *
     * 时间线（从 start() 那一刻算起）：
     *   0s ── 静风 5 秒（cooldown 从 WIND_INTERVAL_SECONDS 递减到 0）── 5s
     *   5s ── 起风 3 秒（timer 从 0 累加到 WIND_DURATION_SECONDS）── 8s
     *   8s ── 风停 → 重新静风 5 秒 ── 13s 起下一阵风 …… 如此循环
     *
     * 与需求一一对应：
     *   · 「每次风持续的时间都是固定时长，3 秒左右」→ duration 每次写 WIND_DURATION_SECONDS；
     *   · 「起风的时间间隔为 5 秒」→ 风停后 cooldown 重置为 WIND_INTERVAL_SECONDS；
     *   · 「只有起风时循环播放背景音乐，一旦风停止立即停止」→ 起风分支 playBgm，
     *     风停分支 _stopWindBgm（结算 / 退出另有 complete / fail / exit 三处收尾）。
     *
     * 注意：本局结算（complete / fail）后 update 不再被驱动，所以这里的风停分支
     * 只处理「小游戏还在进行时的那一次风停」。
     * @param {number} dt - 帧时长（秒）
     */
    _updateWind(dt) {
        if (this.wind.active) {
            // ---- 起风中：推进本阵风的计时，到点即停风（立刻停 BGM） ----
            this.wind.timer += dt;
            this.wind.fadeAlpha = Math.min(1, this.wind.fadeAlpha + this.wind.fadeSpeed * dt);
            if (this.wind.timer >= this.wind.duration) {
                // 风停：本次改动的核心之一 —— 此刻还在虚空上的玩家由 _checkVoidFall 判失败
                this.wind.active = false;
                this.wind.timer = 0;
                this.wind.duration = WIND_DURATION_SECONDS;
                this.wind.cooldown = WIND_INTERVAL_SECONDS;   // 间隔固定 5 秒（不再随机）
                this.wind.fadeAlpha = Math.max(0, 1 - this.wind.fadeSpeed * dt * 2);
                // 风停 → 小游戏背景音乐立即停止（只停这一首，不动别的）
                this._stopWindBgm();
            }
        } else {
            // ---- 静风中：等待固定间隔后起风 ----
            this.wind.timer += dt;
            this.wind.cooldown -= dt;
            this.wind.fadeAlpha = Math.max(0, this.wind.fadeAlpha - this.wind.fadeSpeed * dt);
            if (this.wind.cooldown <= 0) {
                // 起风：固定时长 3 秒
                this.wind.active = true;
                this.wind.duration = WIND_DURATION_SECONDS;
                this.wind.timer = 0;
                this.wind.fadeAlpha = 0;
                // 起风 → 循环播放小游戏背景音乐（风停 / 小游戏结束立刻停）
                this.playBgm('bgm.minigame_herb');
            }
        }
    }

    /**
     * 停掉「起风期间才播」的小游戏 BGM（bgm.minigame_herb）
     *
     * 这首 BGM 只属于本小游戏，所以「谁起播谁收尾」：起风时播、风停时停，
     * 另外**本局结算（complete / fail）与退出（exit）也必须停** —— 不能只靠
     * Main.handleMiniGameEnd 兜底：任何绕过「小游戏场景 → handleMiniGameEnd」的路径
     * （例如结算当帧又按 E 被路标重开一局）都会把这首 BGM 留在场上继续响。
     * 重复调用无副作用（AudioManager.stopBgm 只停这一首，没在播就什么都不做）。
     */
    _stopWindBgm() {
        this.stopBgm('bgm.minigame_herb');
    }

    _updateWindVisual(dt) {
        if (this.wind.active || this.wind.fadeAlpha > 0.01) {
            this.wind.animOffset += dt * 120;
            if (this.wind.animOffset > 200) this.wind.animOffset = 0;
            // 风精灵帧动画（4帧循环）
            this.windAnimTimer += dt;
            if (this.windAnimTimer >= 0.12) {
                this.windAnimTimer -= 0.12;
                this.windAnimFrame = (this.windAnimFrame + 1) % 4;
            }
        } else {
            this.windAnimFrame = 0;
            this.windAnimTimer = 0;
        }
    }
// ======================================================================
    //  玩家移动（瓦片碰撞）
    // ======================================================================

    _updatePlayerMovement(dt) {
        let dx = 0, dy = 0;
        if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
        if (this.keys['d'] || this.keys['arrowright']) dx += 1;
        if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
        if (dx !== 0 && dy !== 0) { const inv = 1 / Math.SQRT2; dx *= inv; dy *= inv; }
        const spd = this.player.speed * dt, pw = this.player.width, ph = this.player.height;
        if (dx !== 0) {
            const nx = this.player.x + dx * spd;
            if (this._canStandAt(nx - pw / 2, this.player.y - ph / 2, pw, ph)) this.player.x = nx;
        }
        if (dy !== 0) {
            const ny = this.player.y + dy * spd;
            if (this._canStandAt(this.player.x - pw / 2, ny - ph / 2, pw, ph)) this.player.y = ny;
        }

        // ========== 方向追踪 & 行走动画 ==========
        // 优先以水平方向为准（左/右覆盖上/下）
        if (dx < 0) this.playerDir = 1;       // 左
        else if (dx > 0) this.playerDir = 2;  // 右
        else if (dy < 0) this.playerDir = 3;  // 上
        else if (dy > 0) this.playerDir = 0;  // 下

        this.isMoving = (dx !== 0 || dy !== 0);
        if (this.isMoving) {
            this.animTimer += dt;
            const frameDuration = 0.15; // 每秒约 6.7 帧
            if (this.animTimer >= frameDuration) {
                this.animTimer -= frameDuration;
                this.animFrame = (this.animFrame + 1) % 4;
            }
        } else {
            this.animFrame = 0;
            this.animTimer = 0;
        }
    }

    _canStandAt(l, t, w, h) {
        const tile = this.tileSize;
        const c1 = Math.floor(l / tile), r1 = Math.floor(t / tile);
        const c2 = Math.floor((l + w - 1) / tile), r2 = Math.floor((t + h - 1) / tile);
        for (let r = r1; r <= r2; r++)
            for (let c = c1; c <= c2; c++)
                if (!this._isTileWalkable(r, c)) return false;
        return true;
    }

    _isTileWalkable(r, c) {
        if (r < 0 || r >= this.mapRows || c < 0 || c >= this.mapCols) return false;
        if (!this.collisionData) return true;
        // 无风时只有陆地可走；起风时虚空也能行走（飞行）
        if (this.collisionData[r] && this.collisionData[r][c] === 1) return true;
        return this.wind.active;
    }

    /** 纯碰撞数据查询：瓦片是否为虚空（忽略风状态） */
    _isVoidTile(r, c) {
        if (r < 0 || r >= this.mapRows || c < 0 || c >= this.mapCols) return true;
        // 碰撞数据硬编码自 collision.png 分析结果（见 COLLISION_MAP），
        // 避免浏览器 file:// 协议下 canvas.getImageData 受 CORS 限制无法读取像素
        if (!this.collisionData) return true;
        if (!this.collisionData[r]) return true;
        return this.collisionData[r][c] !== 1;
    }

    /**
     * 玩家的整块碰撞盒是否完全落在陆地上（忽略风状态，纯地形查询）
     *
     * 与 _canStandAt 用同一套「碰撞盒 → 覆盖到的每格瓦片」算法，但只查地形：
     * 无风时玩家能站在哪里（走位）与「风停后是否还留在虚空」（坠落判定）共用这一把尺子，
     * 避免出现「走位按碰撞盒、坠落只看角色中心那一格」的两套判定错位。
     * @returns {boolean} true = 碰撞盒覆盖的每一格都是陆地
     */
    _isFootprintAllOnLand() {
        const pw = this.player.width, ph = this.player.height;
        const l = this.player.x - pw / 2, t = this.player.y - ph / 2;
        const tile = this.tileSize;
        const c1 = Math.floor(l / tile), r1 = Math.floor(t / tile);
        const c2 = Math.floor((l + pw - 1) / tile), r2 = Math.floor((t + ph - 1) / tile);
        for (let r = r1; r <= r2; r++)
            for (let c = c1; c <= c2; c++)
                if (this._isVoidTile(r, c)) return false;
        return true;
    }

    // ======================================================================
    //  虚空坠落
    // ======================================================================

    /**
     * 虚空坠落判定：风停之后玩家还留在虚空上 → 失败
     *
     * 判定对象与走位完全一致（整块碰撞盒，见 _isFootprintAllOnLand）：
     *   · 走位（_updatePlayerMovement → _canStandAt → _isTileWalkable）要求碰撞盒每一格都可站，
     *     无风时虚空瓦片一律不可站；
     *   · 这里同样按整块碰撞盒反查「是否还踩在虚空上」—— 只要有一格是虚空（含越出地图的越界格），
     *     就算「还在虚空」，风停即败。
     * 用同一把尺子（而不是只看角色中心那一格）是为了避免两套判定错位：
     * 旧写法走位按碰撞盒、坠落只看中心点，站在陆地边缘时会出现「看着站在陆地上却判失败」。
     * 另：本帧采齐时 update 里已先行 complete()（胜利锁定），这里会直接返回。
     */
    _checkVoidFall() {
        if (this.isWinLocked) return;         // 本局已采齐（胜利锁定）→ 坠落判定作废
        // 教学阶段（首局 isFirstPlay 的那一段）不判坠：教学第 3 步正是让玩家试
        // 「风起时可在虚空中行走」，首局一进虚空就判失败太苛刻；风停后被留在虚空上也只是
        // 等 5 秒下一阵风就能飞回来（不会卡死）。教学结束（gamePhase = 'playing'）后全程生效。
        if (this.gamePhase !== 'playing') return;
        if (!this.isRunning) return;          // 已经结算（采齐 / 坠落）→ 不再重复判定
        if (this.wind.active) return;         // 有风时可停在虚空上（乘风飞行），无需判定
        // 风停：碰撞盒碰到任何虚空瓦片 → 坠落失败
        if (!this._isFootprintAllOnLand()) {
            this.fail();
        }
    }

    // ======================================================================
    //  草药采集
    // ======================================================================

    _checkHerbProximity() {
        this.nearbyHerb = null;
        let nd = 48;
        for (const h of this.herbs) {
            if (h.collected) continue;
            const d = Math.hypot(this.player.x - h.x, this.player.y - h.y);
            if (d < nd) { nd = d; this.nearbyHerb = h; }
        }
        if (this.eJustPressed && this.nearbyHerb) {
            this.nearbyHerb.collected = true;
            this.collectedHerbs++;
            this.score = (this.collectedHerbs / this.requiredHerbs) * this.maxScore;
            this.nearbyHerb = null;
            // 拾取音效：与拾取任务道具同一个音效（缺失音频文件时静默跳过）
            this.playSfx('sfx.pickup');
        }
    }
// ======================================================================
    //  渲染
    // ======================================================================

    render(ctx) {
        if (!ctx) return;
        this._renderTiles(ctx);
        this._renderWind(ctx);
        this._renderHerbs(ctx);
        this._renderPlayer(ctx);
        this._renderInteractionHint(ctx);
        this._renderUI(ctx);
        if (this.gamePhase === 'tutorial') this._renderTutorialUI(ctx);
    }

    _renderTiles(ctx) {
        if (this.bgImage) {
            ctx.drawImage(this.bgImage, 0, 0, 1280, 720);
        }
    }

    _renderWind(ctx) {
        if (!this.wind.active && this.wind.fadeAlpha <= 0.01) return;
        const alpha = Math.min(1, this.wind.fadeAlpha);
        if (this.windImage) {
            const FRAME_W = 202, FRAME_H = 128;
            ctx.globalAlpha = alpha * 0.3;
            for (let i = 0; i < 4; i++) {
                const wx = (i * 400 + this.wind.animOffset * 0.5) % (1280 + 200) - 100;
                const wy = 100 + i * 150;
                ctx.drawImage(this.windImage, this.windAnimFrame * FRAME_W, 0, FRAME_W, FRAME_H,
                    wx, wy, FRAME_W, FRAME_H);
            }
            ctx.globalAlpha = 1;
        }
    }

    _renderHerbs(ctx) {
        const t = Date.now() / 1000;
        for (const h of this.herbs) {
            if (h.collected) continue;
            const glow = 0.7 + Math.sin(t * 3 + h.x) * 0.3;
            ctx.shadowColor = '#aaffaa';
            ctx.shadowBlur = 16 * glow;
            ctx.fillStyle = 'rgba(170, 255, 170, ' + glow * 0.4 + ')';
            ctx.beginPath();
            ctx.arc(h.x, h.y, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            if (this.herbImage) {
                ctx.drawImage(this.herbImage, h.x - 16, h.y - 14, 32, 28);
            } else {
                ctx.fillStyle = '#66ff66';
                ctx.beginPath();
                ctx.arc(h.x, h.y, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#44cc44';
                ctx.beginPath();
                ctx.arc(h.x - 2, h.y - 2, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    _renderPlayer(ctx) {
        const px = this.player.x, py = this.player.y;
        const FRAME_SIZE = 32;                              // 源帧尺寸（player.sanxiu_* 为 4 行 × 4 帧 32×32）
        // 显示尺寸与大地图 Player 一致（32×32 帧 → 48×64，见 MiniGame.playerSpriteWidth）；
        // 走位碰撞盒仍是 this.player.width/height（22×26）—— 只决定「能不能站」，不决定画多大。
        const drawW = this.playerSpriteWidth;
        const drawH = this.playerSpriteHeight;

        // 状态判定：闲置(静止) / 行走(移动无风) / 飞行(移动+起风)
        const isFlying = this.isMoving && this.wind.active && this.wind.fadeAlpha > 0.1;
        const isIdle = !this.isMoving;

        if (isFlying) {
            // === 飞行：乘风飞行图像 + 上下浮动 ===
            const img = this.playerFlyImage;
            if (img) {
                const t = Date.now() / 1000;
                const floatY = Math.sin(t * 4) * 2;
                ctx.save();
                ctx.translate(px, py + floatY);
                // 行排列：0=下, 1=左, 2=右, 3=上，每行4帧，每帧32×32
                const sx = this.animFrame * FRAME_SIZE;
                const sy = this.playerDir * FRAME_SIZE;
                ctx.drawImage(img, sx, sy, FRAME_SIZE, FRAME_SIZE,
                    -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();
            } else {
                // 降级：蓝色角色 + 翅膀（按大地图显示尺寸画）
                ctx.fillStyle = '#66aaff';
                ctx.shadowColor = '#88ccff';
                ctx.shadowBlur = 12;
                ctx.fillRect(px - drawW * 0.45, py - drawH * 0.42 - 2, drawW * 0.9, drawH * 0.84 + 4);
                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 2;
                const t2 = Date.now() / 1000;
                for (let side = -1; side <= 1; side += 2) {
                    const flap = Math.sin(t2 * 6) * 6;
                    ctx.beginPath();
                    ctx.moveTo(px + side * drawW * 0.45, py - drawH * 0.06);
                    ctx.lineTo(px + side * (drawW * 0.45 + 12 + flap), py - drawH * 0.16);
                    ctx.lineTo(px + side * (drawW * 0.45 + flap), py + drawH * 0.06);
                    ctx.closePath();
                    ctx.stroke();
                }
            }
        } else if (isIdle) {
            // === 闲置：使用闲置精灵图，显示第一帧 ===
            const img = this.playerIdleImage || this.playerImage;
            if (img) {
                const sx = 0; // 始终第一帧（静止姿态）
                const sy = this.playerDir * FRAME_SIZE;
                ctx.drawImage(img, sx, sy, FRAME_SIZE, FRAME_SIZE,
                    px - drawW / 2, py - drawH / 2, drawW, drawH);
            } else {
                // 降级：暖色调方形（按大地图显示尺寸画）
                this._renderPlayerFallback(ctx, px, py, drawW, drawH);
            }
        } else {
            // === 行走：行走精灵表动画 ===
            const img = this.playerImage;
            if (img) {
                // 行排列：0=下, 1=左, 2=右, 3=上，每行4帧，每帧32×32
                const sx = this.animFrame * FRAME_SIZE;
                const sy = this.playerDir * FRAME_SIZE;
                ctx.drawImage(img, sx, sy, FRAME_SIZE, FRAME_SIZE,
                    px - drawW / 2, py - drawH / 2, drawW, drawH);
            } else {
                // 降级：暖色调方形（按大地图显示尺寸画）
                this._renderPlayerFallback(ctx, px, py, drawW, drawH);
            }
        }
    }

    /** 缺精灵图时的程序化小人（尺寸与大地图玩家显示尺寸一致） */
    _renderPlayerFallback(ctx, px, py, drawW, drawH) {
        ctx.fillStyle = '#ff8844';
        ctx.fillRect(px - drawW * 0.45, py - drawH * 0.4, drawW * 0.9, drawH * 0.8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - drawW * 0.17, py - drawH * 0.24, drawW * 0.14, drawH * 0.09);
        ctx.fillRect(px + drawW * 0.03, py - drawH * 0.24, drawW * 0.14, drawH * 0.09);
    }

    _renderInteractionHint(ctx) {
        if (this.gamePhase !== 'playing' || !this.nearbyHerb) return;
        const hx = this.nearbyHerb.x;
        const hy = this.nearbyHerb.y - 30;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = '14px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText('[E] 采集', hx, hy);
        ctx.restore();
    }

    _renderUI(ctx) {
        const bx = 20, by = 20, bw = 300, bh = 36;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 8);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.fillText('草药: ' + this.collectedHerbs + '/' + this.requiredHerbs, bx + 12, by + 24);
        // 风况：固定节奏（起风 3 秒 / 间隔 5 秒）→ 把剩余秒数一并给玩家，便于安排飞行时机
        const windText = this.wind.active
            ? ('起风 ' + Math.max(0, this.wind.duration - this.wind.timer).toFixed(1) + 's')
            : ('风息 ' + Math.max(0, this.wind.cooldown).toFixed(1) + 's');
        ctx.fillStyle = this.wind.active ? '#aaddff' : '#aaaaaa';
        ctx.textAlign = 'right';
        ctx.fillText(windText, bx + bw - 12, by + 24);
        ctx.restore();
    }

    _renderTutorialUI(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, 1280, 720);
        const tw = 500, th = 100;
        const tx = (1280 - tw) / 2, ty = 720 - th - 40;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 12);
        ctx.fill();
        const texts = [
            '按 WASD 或方向键移动角色',
            '靠近发光的草药，按 E 采集',
            '风起时可在虚空中行走，收集所有草药！',
        ];
        ctx.fillStyle = '#ffffff';
        ctx.font = '18px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(texts[this.tutorialStep] || '', 1280 / 2, ty + th / 2 + 6);
        ctx.restore();
    }

    // ======================================================================
    //  分数
    // ======================================================================

    getPassScore() { return Math.ceil(this.maxScore * 0.5); }

    // ======================================================================
    //  结算 / 退出：小游戏自己收尾（起风 BGM 不再只依赖 Main 兜底）
    // ======================================================================
    //  背景（2026-09-13 审查）：旧写法只有「风起 / 风停」两个瞬间同步 BGM，
    //  本局结算完全靠 Main.handleMiniGameEnd 停这首 BGM；一旦结算当帧玩家还按着 E
    //  （浏览器会连发 keydown），世界里的「采药点」路标会被再触发一次 → 小游戏被重开，
    //  玩家以为已经退出，实际这首 BGM 过一会儿又响、风停时角色若在虚空上还会再判一次
    //  fail()（于是听感就是「胜利音效 → 起风 BGM → BGM 停 → 失败音效」）。
    //  这里把收尾责任放回小游戏自己：结算 / 退出都必须先停掉自己的 BGM。

    /** 成功结算：先收掉起风 BGM（同一局只结算一次，重复调用不会再停别的音乐） */
    complete() {
        const settled = super.complete();
        if (settled) this._stopWindBgm();
        return settled;
    }

    /**
     * 失败结算（坠落 / 到点）
     * 需求：只要检测到本局胜利（isWinLocked），失败一律忽略 —— 不结算、不播失败音效。
     * 对应玩家反馈的「乘风采药胜利后同时听到胜利和失败音效」。
     */
    fail() {
        if (this.isWinLocked) return false;   // 已采齐 → 本局的失败判定全部作废
        const settled = super.fail();
        if (settled) this._stopWindBgm();
        return settled;
    }

    /** 退出（MiniGameManager.endCurrentMiniGame 等路径）：先收掉起风 BGM */
    exit() {
        this._stopWindBgm();
        return super.exit();
    }
}