/**
 * 逆流送灯 —— 横版行舟小游戏（第二章主线三《逆流送灯》）
 *
 * 入口：云渡泽「旧水道」路标 signpost_river_escort → MiniGameManager.startMiniGame('boat_navigation')
 *       （陆舟的对话选项也走同一条链路，见 Main.startRiverEscort）
 *
 * 玩法（横版 · 小船固定屏幕左侧、船头朝右）：
 *   · 小船横置在河道左侧，全程只有上下两个方向可用（↑/↓ 或 W/S），不会左右移动；
 *   · 河道纵向活动区间 [minY, maxY] = [270, 500]（这里说的是「船心 / 障碍中心的 Y」）；
 *   · 礁石 / 浮木从右侧屏幕外生成、向左漂过屏幕，X + 宽 < 0 即回收（= 完全超出视野）；
 *   · 本局一共生成 60 个障碍物（totalObstacles）：每有一个障碍物完全漂出左侧视野，
 *     「剩余障碍物」计数就 -1（左上角显示的就是它，不再有倒计时）；
 *   · 撞上任一障碍 → 立即 fail()（回大地图，Main.finishRiverEscort 播 T04，可重试，不丢魂灯）；
 *   · 最后一个障碍物也因超出视野而消失的那一帧 → complete()
 *     （Main 播 T05 归魂演出 → 江晚 / 陈栎归位）。
 *
 * 河道范围怎么来：
 *   · 优先读碰撞图 miniGame.xingzhou_collision（1280×720，白 = 可通行水域）：
 *     逐行统计亮度 ≥ 60% 的行，取首末行作为水域带 [top, bottom]（含末行），
 *     再把「水面上/下各留半个船身」换算成船心区间 —— minY = top + 52、maxY = bottom + 1 - 52。
 *   · 缺图 / 全黑 / getImageData 被 file:// 的 CORS 拦下 → 用默认水域带
 *     { top: 218, bottom: 551 }（同样得到 270 ~ 500），游戏照样能玩。
 *
 * 美术规格（都从 ResourceManager 缓存同步取，Main.preloadInitialResources 已预加载）：
 *   miniGame.xingzhou_boat       小船朝右动画：**单行 4 帧，单帧 128×104**（整图 512×104）
 *                                （也兼容单帧图 / 旧版竖版图：自动按单帧等比缩放绘制）
 *   miniGame.xingzhou_rock       礁石：单帧 96×96
 *   miniGame.xingzhou_wood       浮木：单帧 96×96
 *   miniGame.xingzhou_bg         河道背景 1280×720
 *   miniGame.xingzhou_collision  河道碰撞图 1280×720（白 = 可通行；只用它取上下范围）
 * 缺图一律回退程序化绘制 —— 冒烟测试（无浏览器 / 无图片）跑的也是这条回退路径。
 */
class BoatNavigationMiniGame extends MiniGame {
    /**
     * @param {Object} config - 配置（timeLimit / maxScore 等可覆盖）
     */
    constructor(config = {}) {
        super({
            id: 'boat_navigation',
            name: '逆流送灯',
            // 不再按时间结算：timeLimit = 0 = 不限时（基类语义）。
            // 本局的结束条件是「60 个障碍物全部漂出视野」（见 totalObstacles），不是倒计时。
            timeLimit: 0,
            maxScore: 100,
            ...config,
        });

        // ==================== 画面 / 河道 ====================
        this.mapWidth = 1280;
        this.mapHeight = 720;
        // 河道纵向活动区间（小船 / 障碍物的「中心 Y」，单位 px）—— 与碰撞图行 218~551 的白水域对应
        this.minY = 270;
        this.maxY = 500;
        this.riverBand = null;          // 从 collision.png 读出来的 { top, bottom }；null = 用默认

        // ==================== 小船（横置、朝右、只上下动） ====================
        this.boatFrameWidth = 128;      // 动画单帧 128×104
        this.boatFrameHeight = 104;
        // 默认水域带（行区间，含首末行）：minY - 半个船身 ~ maxY + 半个船身 - 1 = 218 ~ 551（334 行）
        this.defaultRiverBand = {
            top: this.minY - this.boatFrameHeight / 2,
            bottom: this.maxY + this.boatFrameHeight / 2 - 1,
        };
        this.boatFrameCount = 4;        // 单行 4 帧（朝右）
        this.boatFramesPerSecond = 8;   // 划桨动画帧率
        this.boatX = 220;               // 船心 X 固定不动（行进的视觉来自障碍物左移）
        this.boatSpeed = 420;           // 上下移动速度 px/s（横穿整条河道 230px 只需 0.55s）
        this.boatHitboxWidth = 88;      // 判定框比美术小一圈（贴船体，避免“空气墙”）
        this.boatHitboxHeight = 56;

        // ==================== 障碍物（礁石 / 浮木） ====================
        this.obstacleSize = 96;         // 单帧 96×96
        this.obstacleHitboxInset = 12;  // 判定框内缩 → 96 - 24 = 72×72
        this.scrollSpeed = 300;         // 障碍物左移速度 px/s
        this.spawnIntervalStart = 1.6;  // 开局生成间隔（秒）
        this.spawnIntervalEnd = 1.3;    // 生成难度爬到顶时的间隔（缓慢提升，仍留出穿越间隙）
        this.obstacles = [];
        this.obstacleSpawnTimer = 0;
        this.obstacleSpawnEnabled = true;
        // 本局一共生成 60 个障碍物（需求）：每有一个「完全漂出左侧视野」→ 剩余计数 -1，
        // 最后一个也消失的那一帧 = 两盏魂灯送到救助院（取代原来的 60 秒倒计时）。
        this.totalObstacles = 60;       // 一局要生成的障碍物总数
        this.spawnedObstacles = 0;      // 已生成多少个（到 60 就停止生成）
        this.clearedObstacles = 0;      // 已因超出视野而消失多少个（剩余 = 60 - 它）

        // ==================== 运行状态 ====================
        this.animTimer = 0;
        this.animFrame = 0;
        this.moveUp = false;
        this.moveDown = false;
        // 船心（x 恒为 boatX；y 在 [minY, maxY] 内上下）
        this.boat = { x: this.boatX, y: (this.minY + this.maxY) / 2, vy: 0, width: this.boatFrameWidth, height: this.boatFrameHeight };

        // ==================== 美术 ====================
        this.backgroundImage = null;
        this.boatImage = null;
        this.rockImage = null;
        this.woodImage = null;
        this._loadResources();
    }

    // ======================================================================
    //  流程
    // ======================================================================

    /**
     * 开始游戏（重进小游戏时全部重置；河道范围沿用已解析的结果）
     */
    start() {
        super.start();
        this.obstacles = [];
        this.obstacleSpawnTimer = 0;
        this.obstacleSpawnEnabled = true;
        this.spawnedObstacles = 0;
        this.clearedObstacles = 0;
        this.animTimer = 0;
        this.animFrame = 0;
        this.moveUp = false;
        this.moveDown = false;
        this.boat.x = this.boatX;
        this.boat.y = (this.minY + this.maxY) / 2;
        this.boat.vy = 0;
        this._loadResources();
    }

    /**
     * 更新游戏
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态 { keys, pressedKeys, ... }
     */
    update(deltaTime, input) {
        if (!this.isRunning || this.isPaused) return;

        this.updateInput(input);
        this.updateBoat(deltaTime);
        this.updateObstacles(deltaTime);

        // 分数 = 送达进度（已因超出视野消失的障碍物 / 总数；最后一个消失的那一帧就是 100 分）
        this.score = Math.min(this.maxScore, (this.clearedObstacles / this.totalObstacles) * this.maxScore);

        // 基类推进 gameTimer（本玩法 timeLimit = 0，不再按时限结算）
        super.update(deltaTime, input);
    }

    /**
     * 时间到（基类钩子）：本玩法已改为「清完全部 60 个障碍物即送达」，
     * timeLimit = 0 → 基类不会再调用到这里；保留成「时间到也算成功」以防将来重新设时限。
     */
    checkTimeUp() {
        this.complete();
    }

    /**
     * 及格线：0（保留基类语义 —— 万一有时间到，也不会因为“分数不够”判失败）
     */
    getPassScore() {
        return 0;
    }

    /**
     * 剩余障碍物个数 = 总数 - 已因超出视野而消失的个数
     * （含还没生成的与正在屏幕上的；每消失一个就 -1，归零即送达）
     */
    getRemainingObstacles() {
        return Math.max(0, this.totalObstacles - this.clearedObstacles);
    }

    /** 剩余障碍物文案（左上角白色计数用） */
    getRemainingObstaclesText() {
        return '剩余障碍物 ' + this.getRemainingObstacles();
    }

    /**
     * 读取输入：只有上下两个方向键
     */
    updateInput(input) {
        const keys = (input && input.keys) ? input.keys : {};
        this.moveUp = !!(keys['w'] || keys['arrowup']);
        this.moveDown = !!(keys['s'] || keys['arrowdown']);
    }

    // ======================================================================
    //  小船
    // ======================================================================

    /**
     * 小船上下移动：X 恒定、Y 夹在河道区间内；划桨动画一直播
     */
    updateBoat(deltaTime) {
        const dir = (this.moveDown ? 1 : 0) - (this.moveUp ? 1 : 0);
        this.boat.vy = dir * this.boatSpeed;
        this.boat.y += this.boat.vy * deltaTime;
        this.boat.x = this.boatX;               // 横版：船不左右移动

        if (this.boat.y < this.minY) {
            this.boat.y = this.minY;
            this.boat.vy = 0;
        }
        if (this.boat.y > this.maxY) {
            this.boat.y = this.maxY;
            this.boat.vy = 0;
        }

        this.animTimer += deltaTime;
        this.animFrame = Math.floor(this.animTimer * this.boatFramesPerSecond) % this.boatFrameCount;
    }

    /**
     * 小船判定框（比美术小一圈）：{x, y, width, height}（左上角 + 宽高，供 CollisionDetector 用）
     */
    getBoatRect() {
        return {
            x: this.boat.x - this.boatHitboxWidth / 2,
            y: this.boat.y - this.boatHitboxHeight / 2,
            width: this.boatHitboxWidth,
            height: this.boatHitboxHeight,
        };
    }

    // ======================================================================
    //  障碍物（礁石 / 浮木）
    // ======================================================================

    /**
     * 当前生成间隔：从 spawnIntervalStart 线性收紧到 spawnIntervalEnd。
     * 爬坡进度 = 已生成个数 / 总数（原先按倒计时进度；倒计时已按需求移除，
     * 只是换了驱动量，两端的取值与手感不变）。
     * 可穿越性怎么保证：
     *   · 任意时刻一个障碍只占 96px 高（判定框 72），河道 230px 的通行空间始终留得下船；
     *   · 最短间隔 1.3s × 300px/s = 390px 间距，相邻障碍的判定框在船身上重叠的时间只有
     *     (88+72)/300 = 0.53s → 两船之间至少还有 0.77s 可自由调整；
     *   · 而横穿整条河道只要 (500-270)/420 = 0.55s（boatSpeed 420）→ 永远来得及躲。
     */
    getSpawnInterval() {
        const progress = this.totalObstacles > 0
            ? Math.min(1, this.spawnedObstacles / this.totalObstacles)
            : 1;
        return this.spawnIntervalStart + (this.spawnIntervalEnd - this.spawnIntervalStart) * progress;
    }

    /**
     * 生成一个障碍物（从右侧屏幕外进场），并计入「本局已生成」计数
     * （生成到 totalObstacles = 60 就停止生成，见 updateObstacles）
     * @param {number} [y] - 障碍物中心 Y（缺省在 [minY, maxY] 内随机；供测试指定位置）
     * @param {string} [type] - 'rock'（礁石）| 'wood'（浮木）；缺省五五开随机
     * @returns {Object} 生成的障碍物
     */
    spawnObstacle(y, type) {
        const centerY = (typeof y === 'number')
            ? Math.min(this.maxY, Math.max(this.minY, y))
            : this.minY + Math.random() * (this.maxY - this.minY);
        const kind = (type === 'rock' || type === 'wood')
            ? type
            : (Math.random() < 0.5 ? 'rock' : 'wood');

        const obstacle = {
            x: this.mapWidth + this.obstacleSize / 2,   // 屏幕右侧外
            y: centerY,
            type: kind,
            width: this.obstacleSize,
            height: this.obstacleSize,
        };
        this.spawnedObstacles += 1;                 // 本局已生成的障碍物个数（到 60 就停止生成）
        this.obstacles.push(obstacle);
        return obstacle;
    }

    /**
     * 障碍物判定框（96×96 内缩 12px → 72×72）
     */
    getObstacleRect(obstacle) {
        const size = this.obstacleSize - this.obstacleHitboxInset * 2;
        return {
            x: obstacle.x - size / 2,
            y: obstacle.y - size / 2,
            width: size,
            height: size,
        };
    }

    /**
     * 生成 / 左移 / 回收（完全超出视野 → 剩余障碍物计数 -1）/ 碰撞
     */
    updateObstacles(deltaTime) {
        // 生成：本局一共 totalObstacles（60）个，生成够了就永久停下
        if (this.obstacleSpawnEnabled && this.spawnedObstacles < this.totalObstacles) {
            this.obstacleSpawnTimer += deltaTime;
            let interval = this.getSpawnInterval();
            while (this.obstacleSpawnTimer >= interval && this.spawnedObstacles < this.totalObstacles) {
                this.obstacleSpawnTimer -= interval;
                this.spawnObstacle();
                interval = this.getSpawnInterval();
            }
            if (this.spawnedObstacles >= this.totalObstacles) {
                this.obstacleSpawnEnabled = false;      // 60 个都生成完了：不再生成新的
            }
        }

        // 障碍物自右向左漂；完全移出左侧屏幕即回收，并把剩余障碍物计数减 1
        const stillOnScreen = [];
        for (const obstacle of this.obstacles) {
            obstacle.x -= this.scrollSpeed * deltaTime;
            if (obstacle.x + obstacle.width / 2 >= 0) stillOnScreen.push(obstacle);
            else this.clearedObstacles += 1;            // 超出视野而消失 → 计数 -1
        }
        this.obstacles = stillOnScreen;

        // 撞上任意障碍立即失败
        if (this.checkCollisions()) return;

        // 最后一个障碍物也因超出视野而消失 → 两盏魂灯送到救助院
        if (this.clearedObstacles >= this.totalObstacles) this.complete();
    }

    /**
     * 碰撞检测（AABB；撞上即 fail）
     * @returns {boolean} 是否发生碰撞
     */
    checkCollisions() {
        const boatRect = this.getBoatRect();
        for (const obstacle of this.obstacles) {
            if (CollisionDetector.aabb(boatRect, this.getObstacleRect(obstacle))) {
                this.fail();
                return true;
            }
        }
        return false;
    }

    // ======================================================================
    //  渲染
    // ======================================================================

    /**
     * 渲染游戏（背景 → 障碍物 → 小船 → 左上角剩余障碍物 → 操作提示）
     */
    render(ctx) {
        if (!ctx) return;
        ctx.save();

        this.renderBackground(ctx);
        this.renderObstacles(ctx);
        this.renderBoat(ctx);
        this.renderObstacleCounter(ctx);
        this.renderHint(ctx);

        ctx.restore();
    }

    /**
     * 背景：miniGame.xingzhou_bg（1280×720）；缺图 → 程序化河道
     */
    renderBackground(ctx) {
        if (this.backgroundImage) {
            ctx.drawImage(this.backgroundImage, 0, 0, this.mapWidth, this.mapHeight);
            return;
        }

        // 程序化：上下河岸 + 中间水流 + 几条流速线
        ctx.fillStyle = '#2f4f42';
        ctx.fillRect(0, 0, this.mapWidth, this.mapHeight);
        const water = ctx.createLinearGradient(0, this.minY - 52, 0, this.maxY + 52);
        water.addColorStop(0, '#2b6d8f');
        water.addColorStop(0.5, '#3f92b5');
        water.addColorStop(1, '#245a78');
        ctx.fillStyle = water;
        ctx.fillRect(0, this.minY - 52, this.mapWidth, (this.maxY - this.minY) + 104);

        ctx.fillStyle = '#5c5a3c';
        ctx.fillRect(0, 0, this.mapWidth, this.minY - 52);
        ctx.fillRect(0, this.maxY + 52, this.mapWidth, this.mapHeight - (this.maxY + 52));

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 2;
        for (let y = this.minY - 24; y <= this.maxY + 24; y += 56) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.mapWidth, y - 6);
            ctx.stroke();
        }
    }

    /**
     * 障碍物：礁石 / 浮木（各 96×96）
     */
    renderObstacles(ctx) {
        for (const obstacle of this.obstacles) {
            const size = this.obstacleSize;
            const dx = obstacle.x - size / 2;
            const dy = obstacle.y - size / 2;
            const art = obstacle.type === 'wood' ? this.woodImage : this.rockImage;

            if (art) {
                const fit = this._fitRect(this._imageWidth(art), this._imageHeight(art), size, size);
                ctx.drawImage(art, dx + fit.x, dy + fit.y, fit.width, fit.height);
            } else if (obstacle.type === 'wood') {
                this._drawProceduralWood(ctx, dx, dy, size);
            } else {
                this._drawProceduralRock(ctx, dx, dy, size);
            }
        }
    }

    /**
     * 小船：横置朝右动画（单行 4 帧 128×104）；缺图 → 程序化小船
     */
    renderBoat(ctx) {
        const w = this.boatFrameWidth;
        const h = this.boatFrameHeight;
        const dx = this.boat.x - w / 2;
        const dy = this.boat.y - h / 2;

        if (this.boatImage) {
            const sheet = this._resolveBoatSheet(this.boatImage);
            if (sheet) {
                const frame = this.animFrame % sheet.frames;
                ctx.drawImage(this.boatImage,
                    frame * sheet.frameWidth, 0, sheet.frameWidth, sheet.frameHeight,
                    dx, dy, w, h);
                return;
            }
            // 单帧图 / 旧版竖版图：等比缩放后居中放进 128×104 的框
            const fit = this._fitRect(this._imageWidth(this.boatImage), this._imageHeight(this.boatImage), w, h);
            ctx.drawImage(this.boatImage, dx + fit.x, dy + fit.y, fit.width, fit.height);
            return;
        }

        this._drawProceduralBoat(ctx, dx, dy, w, h);
    }

    /**
     * 左上角白色「剩余障碍物」计数（取代原来的倒计时）
     * 每有一个障碍物完全漂出视野就 -1；归零 = 送达救助院
     */
    renderObstacleCounter(ctx) {
        const text = this.getRemainingObstaclesText();
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.roundRect(20, 20, 246, 48, 10);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 26px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 36, 45);

        // 剩余障碍物进度条（与计数同色，细线：满 = 60 个都还在，空 = 全部清完）
        const ratio = Math.max(0, Math.min(1, this.getRemainingObstacles() / this.totalObstacles));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(36, 58, 214, 3);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(36, 58, 214 * ratio, 3);
        ctx.restore();
    }

    /**
     * 首次进入时的操作提示（前 5 秒）
     */
    renderHint(ctx) {
        if (this.gameTimer > 5) return;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.roundRect(this.mapWidth / 2 - 240, this.mapHeight - 96, 480, 52, 10);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↑ / ↓（W / S）上下闪避，躲完 ' + this.totalObstacles + ' 个障碍（礁石 / 浮木）把灯送到救助院',
            this.mapWidth / 2, this.mapHeight - 70);
        ctx.restore();
    }

    // ======================================================================
    //  美术工具 / 资源
    // ======================================================================

    _imageWidth(image) {
        return (image && (image.width || image.naturalWidth)) || 0;
    }

    _imageHeight(image) {
        return (image && (image.height || image.naturalHeight)) || 0;
    }

    /**
     * 等比缩放并居中放进 targetW×targetH 的框
     */
    _fitRect(srcW, srcH, targetW, targetH) {
        if (!srcW || !srcH) return { x: 0, y: 0, width: targetW, height: targetH };
        const scale = Math.min(targetW / srcW, targetH / srcH);
        const width = srcW * scale;
        const height = srcH * scale;
        return { x: (targetW - width) / 2, y: (targetH - height) / 2, width, height };
    }

    /**
     * 判断小船图是否为「单行 N 帧」动画图集（N ≥ 2）
     * 判据：整图宽高比 ÷ 单帧宽高比（128/104）四舍五入。
     *   512×104 → 4 帧（正式美术）；128×104（单帧）/ 100×128（旧版竖版图）→ 不是图集，按单帧绘制。
     * @returns {Object|null} { frames, frameWidth, frameHeight }
     */
    _resolveBoatSheet(image) {
        const iw = this._imageWidth(image);
        const ih = this._imageHeight(image);
        if (!iw || !ih) return null;
        const frames = Math.round((iw / ih) / (this.boatFrameWidth / this.boatFrameHeight));
        if (frames < 2) return null;
        return { frames, frameWidth: iw / frames, frameHeight: ih };
    }

    /**
     * 程序化礁石（缺图时的回退）
     */
    _drawProceduralRock(ctx, dx, dy, size) {
        ctx.save();
        ctx.fillStyle = '#6b6b6b';
        ctx.beginPath();
        ctx.moveTo(dx + size * 0.50, dy + size * 0.08);
        ctx.lineTo(dx + size * 0.92, dy + size * 0.55);
        ctx.lineTo(dx + size * 0.72, dy + size * 0.94);
        ctx.lineTo(dx + size * 0.24, dy + size * 0.92);
        ctx.lineTo(dx + size * 0.08, dy + size * 0.50);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#8f8f8f';
        ctx.beginPath();
        ctx.moveTo(dx + size * 0.50, dy + size * 0.16);
        ctx.lineTo(dx + size * 0.74, dy + size * 0.52);
        ctx.lineTo(dx + size * 0.42, dy + size * 0.60);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /**
     * 程序化浮木（缺图时的回退）
     */
    _drawProceduralWood(ctx, dx, dy, size) {
        ctx.save();
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(dx + size * 0.06, dy + size * 0.30, size * 0.88, size * 0.34);
        ctx.fillStyle = '#6d431c';
        ctx.beginPath();
        ctx.ellipse(dx + size * 0.06, dy + size * 0.47, size * 0.07, size * 0.17, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(dx + size * 0.94, dy + size * 0.47, size * 0.07, size * 0.17, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(60, 36, 12, 0.8)';
        ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) {
            const x = dx + size * (0.18 + i * 0.19);
            ctx.beginPath();
            ctx.moveTo(x, dy + size * 0.34);
            ctx.lineTo(x, dy + size * 0.60);
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * 程序化小船（船头朝右；缺图时的回退）
     */
    _drawProceduralBoat(ctx, dx, dy, w, h) {
        ctx.save();
        ctx.fillStyle = '#8a6a3c';
        ctx.beginPath();
        ctx.moveTo(dx + w * 0.06, dy + h * 0.52);
        ctx.lineTo(dx + w * 0.94, dy + h * 0.52);   // 船头朝右
        ctx.lineTo(dx + w * 0.82, dy + h * 0.86);
        ctx.lineTo(dx + w * 0.18, dy + h * 0.86);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#c9a166';
        ctx.fillRect(dx + w * 0.12, dy + h * 0.46, w * 0.78, h * 0.08);

        ctx.fillStyle = '#4a5a46';                  // 船篷
        ctx.beginPath();
        ctx.ellipse(dx + w * 0.34, dy + h * 0.38, w * 0.16, h * 0.16, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffe9a8';                  // 船头魂灯
        ctx.beginPath();
        ctx.arc(dx + w * 0.74, dy + h * 0.34, h * 0.10, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#d9c08a';                // 划桨
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(dx + w * 0.20, dy + h * 0.50);
        ctx.lineTo(dx + w * 0.08, dy + h * 0.90);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * 从 ResourceManager 缓存同步取图（Main.preloadInitialResources 已预加载）。
     * 取不到就是 null → 渲染走程序化回退。
     */
    _loadResources() {
        try {
            const rm = ResourceManager.getInstance();
            this.backgroundImage = rm.getCachedImage('miniGame.xingzhou_bg') || null;
            this.boatImage = rm.getCachedImage('miniGame.xingzhou_boat') || null;
            this.rockImage = rm.getCachedImage('miniGame.xingzhou_rock') || null;
            this.woodImage = rm.getCachedImage('miniGame.xingzhou_wood') || null;
            if (!this.riverBand) {
                this._loadRiverBand(rm.getCachedImage('miniGame.xingzhou_collision'));
            }
        } catch (error) {
            console.warn('[逆流送灯] 美术资源读取失败，改用程序化绘制：', error);
        }
    }

    /**
     * 从河道碰撞图（miniGame.xingzhou_collision，1280×720，白 = 可通行水域）解析上下活动范围。
     * 逐行统计亮度：采样点里 ≥ 60% 是亮像素的行算「水域行」，取首末行 [top, bottom]，
     * 再各让出半个船身 → 【船心】区间 minY = top + 52、maxY = bottom - 52。
     * 缺图 / 全黑 / 读不到像素（file:// 下 getImageData 会被 CORS 拦下）→ 保持默认 270~500。
     * @param {Image} image - 碰撞图
     * @returns {Object|null} 解析出的水域带 { top, bottom }；失败返回 null
     */
    _loadRiverBand(image) {
        const iw = this._imageWidth(image);
        const ih = this._imageHeight(image);
        if (!iw || !ih) return null;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = iw;
            canvas.height = ih;
            const cctx = canvas.getContext('2d');
            if (!cctx || typeof cctx.drawImage !== 'function') return null;
            cctx.drawImage(image, 0, 0, iw, ih);
            const data = cctx.getImageData(0, 0, iw, ih).data;
            if (!data || data.length < iw * ih * 4) return null;

            const step = 4;                             // 每 4 列采样一次（够用且快）
            const samples = Math.ceil(iw / step);
            const need = Math.ceil(samples * 0.6);
            const waterRows = [];
            for (let y = 0; y < ih; y++) {
                let bright = 0;
                for (let x = 0; x < iw; x += step) {
                    const i = (y * iw + x) * 4;
                    if (data[i] + data[i + 1] + data[i + 2] >= 384) bright++;   // 三通道均值 ≥ 128 视为白
                }
                if (bright >= need) waterRows.push(y);
            }
            if (waterRows.length < 40) return null;     // 没涂绘 / 全黑 → 默认河道

            const top = waterRows[0];
            const bottom = waterRows[waterRows.length - 1];      // 含末行
            const half = this.boatFrameHeight / 2;      // 让出半个船身，船不会压到岸上
            const minY = Math.round(top + half);        // 218 + 52 → 270
            const maxY = Math.round(bottom + 1 - half); // 551 + 1 - 52 → 500
            if (maxY - minY < 80) return null;          // 河道太窄（涂错了）→ 默认河道

            this.riverBand = { top, bottom };
            this.minY = minY;
            this.maxY = maxY;
            this.defaultRiverBand = { top, bottom };
            // 河道变了 → 船放回中间
            this.boat.y = Math.min(this.maxY, Math.max(this.minY, this.boat.y));
            return this.riverBand;
        } catch (error) {
            // file:// 下 canvas 读像素会被 CORS 拦下：直接用默认河道
            console.warn('[逆流送灯] 河道碰撞图读取失败，改用默认河道 270~500：', error);
            return null;
        }
    }
}
