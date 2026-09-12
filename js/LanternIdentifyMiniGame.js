/**
 * 认灯归魂（第二章 · 主线二《一封到不了的家书》）
 * ------------------------------------------------------------------
 * 玩法（灯序全排列 + 三次机会）：
 *   1) 玩家被传送到认灯台小游戏地图：地图中心（640,360）的上 / 下 / 左 / 右
 *      各 200px 处有一盏魂灯，编号固定 1 = 上、2 = 下、3 = 左、4 = 右，开局都是灭的。
 *   2) WASD / 方向键走位；靠近未点亮的魂灯会出现「[E] 点亮魂灯」提示，按 E 点亮。
 *      魂灯点亮后不可再被熄灭（也不能重复点亮）。
 *   3) 记录点亮顺序（依次点 1、2、3、4 → "1234"）。每次进入小游戏都会在 1234 的
 *      24 种全排列里随机抽一个作为本次「目标灯序」，灯序面板里可反复查看
 *      （showTargetOrder = false 即变成纯记忆玩法）。
 *   4) 四盏全亮时比对灯序：
 *        · 完全一致 → complete()：退出小游戏、对话框跳出主角的自言自语（T03），
 *          Main 同时推进主线二「在认灯台完成身份核对」。
 *        · 不一致 → 扣一次机会；还有机会就提示「有 N 盏灯亮的位置是对的」
 *          （例：1234 与 1243 → 1、2 两盏对），随后熄灭所有魂灯重来
 *          （目标灯序不变，好让玩家用「几盏对」的反馈逐步逼近）；
 *          机会用尽（3 次）则 fail() 退出，回大地图后仍可再进认灯台重玩（重新抽灯序）。
 *        · 失败提示（「有 N 盏灯亮的位置是对的」）**常驻**：熄灭重来后仍然留在屏幕上，
 *          直到下一次结算给出新提示、或本局结束才换掉 —— 玩家不用记着数字点灯
 *          （feedbackPersistent；见 _evaluateRound / _renderHUD）。
 *   5) 无限时（timeLimit = 0）。
 *
 * 美术（缺图 / 占位图都会回退为程序化绘制）：
 *   miniGame.rendeng_bg        1280×720 认灯台背景（可选）
 *   miniGame.rendeng_deng_off  48×64    暗魂灯（未点亮）
 *   miniGame.rendeng_deng_on   48×64    亮魂灯（已点亮）
 *   miniGame.rendeng_collision 1280×720 认灯台碰撞图（白 = 可走 / 黑 = 阻挡）
 *
 * 碰撞（与 js/TileSystem.js 同一套约定：白可走、黑阻挡）：
 *   · 认灯台按 40px 瓦片切成 32×18 格（同乘风采药 / 万灯台战场），加载时解析
 *     collision.png 逐格统计黑像素占比（≥ 50% 视为阻挡）→ 之后走位只查这张表；
 *   · 以 file:// 直接打开游戏时读不到本地图片像素（浏览器判跨源，getImageData 抛
 *     SecurityError）→ 自动改用文件末尾 LANTERN_COLLISION_MAP（由同一张图预生成的
 *     兜底表），玩法照常可玩；想「改图刷新即生效」请用本地 http 服务打开；
 *   · 自检：出生点 (640,360) 必须站得住，且四盏魂灯都要走得到，否则说明新碰撞图把人
 *     围死 / 把灯圈在墙外 → 此时自动停用瓦片碰撞、只留 bounds 边界钳制，避免卡死；
 *   · 改完 collision.png 后刷新页面（Ctrl+F5）；游戏内按 F2 开碰撞网格覆盖层核对
 *     绿 = 可走 / 红 = 阻挡，并显示当前用的是「碰撞图」还是「兜底表」。
 */
// ======================================================================
//  认灯台兜底碰撞表（32 列 × 18 行，每格 40px；'1' = 可走 / '0' = 阻挡）
//  ---------------------------------------------------------------------
//  由 assets/images/minigame/rendeng/collision.png 逐瓦片统计生成
//  （瓦片内黑像素占比 ≥ 50% 记 '0'），形状即认灯台的场地：
//
//    行 0-1   : 台外（不可走）
//    行 2-14  : 场地菱形（中心 640,360 一带；四盏魂灯各在走得到的一格旁）
//    行 15-17 : 台外（不可走）
//
//  用途：以 file:// 直接打开游戏时 canvas.getImageData 会被浏览器判定为跨源
//  （SecurityError），拿不到碰撞图像素 —— 此时用这张表兜底，保证玩法照常可玩。
//  改完 collision.png 后：
//    · 想让这张表跟着变 → 跑 py -3 tools/generate_chapter2_assets.py --check
//      （会报「认灯台兜底表 ↔ collision.png 不一致」并给出提示），
//      再跑一次不带 --check 的命令即可从图重生成占位图；
//    · 用本地 http 服务打开游戏时无需改这张表 —— 运行时直接读图，改图刷新即生效。
// ======================================================================
const LANTERN_COLLISION_MAP = [
    '00000000000000000000000000000000',
    '00000000000000000000000000000000',
    '00000000000011111111111000000000',
    '00000000111111111111111100000000',
    '00000001111111111111111111000000',
    '00000011111111111111111111000000',
    '00000011111111111111111111100000',
    '00000111111111111111111111100000',
    '00000111111111111111111111100000',
    '00000111111111111111111111100000',
    '00000111111111111111111111000000',
    '00000000111111111111111100000000',
    '00000000011111111111111100000000',
    '00000000000011111111000000000000',
    '00000000000000111100000000000000',
    '00000000000000000000000000000000',
    '00000000000000000000000000000000',
    '00000000000000000000000000000000',
];

class LanternIdentifyMiniGame extends MiniGame {
    /**
     * @param {Object} config
     * @param {number} [config.maxAttempts=3]         机会数（默认 3）
     * @param {number} [config.lanternOffset=200]     魂灯离地图中心的距离（像素）
     * @param {boolean} [config.showTargetOrder=true] 是否常显目标灯序
     */
    constructor(config = {}) {
        super({
            id: 'lantern_identify',
            name: '认灯归魂',
            timeLimit: 0,        // 不限时
            maxScore: 100,
            ...config,
        });

        // ========== 灯台版面（1280×720 画布） ==========
        this.center = { x: 640, y: 360 };
        this.lanternOffset = config.lanternOffset !== undefined ? config.lanternOffset : 200;
        this.lanternWidth = 48;    // 魂灯图 / 程序化魂灯：48×64
        this.lanternHeight = 64;
        this.interactRadius = config.interactRadius !== undefined ? config.interactRadius : 56;
        this.lanterns = this._createLanterns();

        // ========== 玩家（小游戏内独立走位） ==========
        this.player = {
            x: this.center.x, y: this.center.y,
            width: 22, height: 26, speed: 200,
            dir: 0,                       // 0=下, 1=左, 2=右, 3=上
            animFrame: 0, animTimer: 0, isMoving: false,
        };
        this.playerFrameSize = 32;        // player.sanxiu_* 单帧 32×32
        this.bounds = { left: 60, right: 1220, top: 60, bottom: 660 };

        // ========== 规则 ==========
        this.maxAttempts = config.maxAttempts !== undefined ? config.maxAttempts : 3;
        this.showTargetOrder = config.showTargetOrder !== undefined ? config.showTargetOrder : true;
        this.targetOrder = [];     // 本次目标灯序（1234 的全排列）
        this.litOrder = [];        // 玩家点亮顺序
        this.attemptsLeft = this.maxAttempts;
        this.round = 1;            // 第几次尝试
        this.lastCorrectCount = -1;
        this.isSolved = false;

        // ========== 运行状态 ==========
        this.nearbyLantern = null;
        this.feedback = '';
        this.feedbackTimer = 0;
        // 提示是否「常驻」：失败提示（「有 N 盏灯亮的位置是对的」）要一直留着给玩家对照，
        // 只在下一次结算写出新提示、或本局结束（complete / fail）时才换掉 / 收走 ——
        // 不会被 feedbackTimer 计时器悄悄淡掉（见 _evaluateRound / _renderHUD）。
        this.feedbackPersistent = false;
        this.flashTimer = 0;
        this.keys = {};
        this.eJustPressed = false;
        this.eHeld = false;            // E 键是否仍按着（按住不放 → 不再算「刚按下」）
        this.eArmed = true;            // 是否允许下一次点亮（一次按下只放行一次；松开后重新武装）

        // 通知（Main / 调试用，不影响流程）
        this.onAttemptFailed = null;   // ({correct, attemptsLeft, round, litOrder, targetOrder}) => void
        this.onRoundReset = null;      // ({round, attemptsLeft}) => void

        // ========== 美术（缺图 → 程序化绘制） ==========
        this.backgroundImage = null;
        this.lanternDarkImage = null;
        this.lanternLitImage = null;
        this.playerImage = null;       // 行走图（4 行 × 4 帧，32×32）
        this.playerIdleImage = null;   // 站立图（4 行 × 1 帧，32×32）

        // ========== 碰撞（认灯台 collision.png → 40px 瓦片表，见文件头说明） ==========
        this.mapWidth = 1280;
        this.mapHeight = 720;
        this.tileSize = 40;                                // 32×18 格（同乘风采药 / 万灯台战场）
        this.mapCols = this.mapWidth / this.tileSize;      // 32
        this.mapRows = this.mapHeight / this.tileSize;     // 18
        this.blackPixelThreshold = 0.5;    // 瓦片内黑像素占比 ≥ 50% → 阻挡（同 TileSystem）
        this.collisionImage = null;        // miniGame.rendeng_collision（1280×720）
        this.collisionImageUnreadable = false;   // 像素读失败过（file:// 跨源）→ 不再重试
        this.walkableTiles = null;         // 二维布尔表：true = 可走
        this.collisionSource = 'none';     // 'image' = 碰撞图实时解析 / 'fallback' = 兜底表 / 'none'
        this.collisionEnabled = false;     // 自检通过才启用瓦片碰撞
        this.debugCollision = false;       // F2 碰撞网格覆盖层（Main 的 F2 会转发过来）
        this._loadResources();
    }

    /**
     * 四盏魂灯：地图中心的上 / 下 / 左 / 右各 lanternOffset 像素处一盏。
     * 编号固定：1 = 上, 2 = 下, 3 = 左, 4 = 右（灯序里的数字就是这四个编号）。
     */
    _createLanterns() {
        const cx = this.center.x, cy = this.center.y, d = this.lanternOffset;
        return [
            { number: 1, dir: 'up',    name: '上灯', x: cx,     y: cy - d, lit: false, flashTimer: 0 },
            { number: 2, dir: 'down',  name: '下灯', x: cx,     y: cy + d, lit: false, flashTimer: 0 },
            { number: 3, dir: 'left',  name: '左灯', x: cx - d, y: cy,     lit: false, flashTimer: 0 },
            { number: 4, dir: 'right', name: '右灯', x: cx + d, y: cy,     lit: false, flashTimer: 0 },
        ];
    }

    /** 读图：先取预加载缓存，未命中再异步补一次（缺图 / 占位图 → 保持 null，走程序化绘制） */
    _loadResources() {
        try {
            const rm = ResourceManager.getInstance();
            const keys = {
                bg: 'miniGame.rendeng_bg',
                dark: 'miniGame.rendeng_deng_off',
                lit: 'miniGame.rendeng_deng_on',
                walk: 'player.sanxiu_walk',
                idle: 'player.sanxiu_idle',
                collision: 'miniGame.rendeng_collision',
            };
            const assign = (img, slot, minW, minH) => {
                if (this._isUsableImage(img, minW, minH)) this[slot] = img;
            };
            assign(rm.getCachedImage(keys.bg), 'backgroundImage', 320, 180);
            assign(rm.getCachedImage(keys.dark), 'lanternDarkImage', this.lanternWidth, this.lanternHeight);
            assign(rm.getCachedImage(keys.lit), 'lanternLitImage', this.lanternWidth, this.lanternHeight);
            assign(rm.getCachedImage(keys.walk), 'playerImage', this.playerFrameSize, this.playerFrameSize);
            assign(rm.getCachedImage(keys.idle), 'playerIdleImage', this.playerFrameSize, this.playerFrameSize);
            // 碰撞图只作数据源（白 = 可走 / 黑 = 阻挡）→ 解析成 32×18 瓦片表
            assign(rm.getCachedImage(keys.collision), 'collisionImage', this.mapWidth, this.mapHeight);
            this._initCollision();

            rm.loadImage(keys.bg)
                .then(img => assign(img, 'backgroundImage', 320, 180)).catch(() => {});
            rm.loadImage(keys.dark)
                .then(img => assign(img, 'lanternDarkImage', this.lanternWidth, this.lanternHeight)).catch(() => {});
            rm.loadImage(keys.lit)
                .then(img => assign(img, 'lanternLitImage', this.lanternWidth, this.lanternHeight)).catch(() => {});
            rm.loadImage(keys.walk)
                .then(img => assign(img, 'playerImage', this.playerFrameSize, this.playerFrameSize)).catch(() => {});
            rm.loadImage(keys.idle)
                .then(img => assign(img, 'playerIdleImage', this.playerFrameSize, this.playerFrameSize)).catch(() => {});
            // 碰撞图未命中缓存（例如实例早于预加载创建）→ 异步补一次并重建碰撞表
            rm.loadImage(keys.collision)
                .then(img => {
                    assign(img, 'collisionImage', this.mapWidth, this.mapHeight);
                    this._initCollision();
                })
                .catch(() => {});
        } catch (e) {
            // 静默：一律用程序化绘制
        }
    }

    /**
     * 图片是否可用：排除空图与 ResourceManager 的 dataURL 占位图（品红块），
     * 并要求至少达到期望尺寸（缺图时不画品红块，改画程序化魂灯 / 小人）。
     */
    _isUsableImage(img, minWidth, minHeight) {
        if (!img) return false;
        if (typeof img.src === 'string' && img.src.startsWith('data:')) return false;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        return w >= minWidth && h >= minHeight;
    }

    // ======================================================================
    //  碰撞（认灯台 collision.png → 32×18 瓦片表；白 = 可走 / 黑 = 阻挡）
    // ======================================================================

    /**
     * 建碰撞表：优先解析 collision.png 的像素（改图刷新即生效），
     * 读不到像素 / 缺图时退回 LANTERN_COLLISION_MAP 兜底表。
     * 只在「还没用图片建过表」且「图片刚拿到」时才重建（其余情况直接复用）。
     */
    _initCollision() {
        const preferImage = this.collisionImage && this.collisionSource !== 'image'
            && !this.collisionImageUnreadable;

        if (preferImage && this._buildWalkableFromImage()) {
            this.collisionSource = 'image';
            this.collisionEnabled = this._validateCollision();
            return;
        }
        if (this.walkableTiles) return;    // 已有兜底表 / 已解析过 → 不重复建

        if (this._buildWalkableFromData(LANTERN_COLLISION_MAP)) {
            this.collisionSource = 'fallback';
            console.warn('[认灯归魂] 认灯台碰撞图不可用（缺图 / 读不到像素）→ 改用内置兜底碰撞表；'
                + '想「改图刷新即生效」请用本地 http 服务打开游戏');
        } else {
            this.collisionSource = 'none';
            this._fillWalkable(true);
        }
        this.collisionEnabled = this._validateCollision();
    }

    /**
     * 按瓦片统计黑像素占比生成碰撞表（白可走 / 黑阻挡，规则与 js/TileSystem.js 一致）
     * @returns {boolean} 是否成功（file:// 读本地像素会抛 SecurityError → false）
     */
    _buildWalkableFromImage() {
        const image = this.collisionImage;
        try {
            if (!image || !image.width || !image.height) return false;
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

            const tiles = [];
            for (let row = 0; row < this.mapRows; row++) {
                const line = [];
                for (let col = 0; col < this.mapCols; col++) {
                    line.push(this._analyzeTileWalkable(col, row, pixels, canvas.width, canvas.height));
                }
                tiles.push(line);
            }
            this.walkableTiles = tiles;
            return true;
        } catch (error) {
            this.collisionImageUnreadable = true;
            console.warn('[认灯归魂] 认灯台碰撞图像素解析失败（' + (error && error.name)
                + '）→ 改用兜底碰撞表（用本地 http 服务打开游戏即可直接读图）');
            return false;
        }
    }

    /** 单格是否可走：瓦片内黑像素（a > 0 且 r/g/b < 50）占比 < 50% 即可走 */
    _analyzeTileWalkable(col, row, pixels, imageWidth, imageHeight) {
        const startX = col * this.tileSize;
        const startY = row * this.tileSize;
        const endX = Math.min(startX + this.tileSize, imageWidth);
        const endY = Math.min(startY + this.tileSize, imageHeight);
        let black = 0;
        let total = 0;
        for (let py = startY; py < endY; py++) {
            for (let px = startX; px < endX; px++) {
                const index = (py * imageWidth + px) * 4;
                total++;
                if (pixels[index + 3] > 0 && pixels[index] < 50
                    && pixels[index + 1] < 50 && pixels[index + 2] < 50) {
                    black++;
                }
            }
        }
        if (total <= 0) return false;
        return (black / total) < this.blackPixelThreshold;
    }

    /**
     * 用预生成的兜底碰撞表填充（LANTERN_COLLISION_MAP）：
     * 每行支持 '1010…' 字符串 / 数字数组 / 字符数组；'1' / 1 / true / '.' = 可走
     * @returns {boolean} 是否成功
     */
    _buildWalkableFromData(data) {
        if (!Array.isArray(data) || data.length < this.mapRows) return false;
        const tiles = [];
        for (let row = 0; row < this.mapRows; row++) {
            const source = data[row];
            if (!source || source.length < this.mapCols) {
                console.warn('[认灯归魂] 兜底碰撞表第 ' + row + ' 行不足 ' + this.mapCols + ' 格，忽略该表');
                return false;
            }
            const line = [];
            for (let col = 0; col < this.mapCols; col++) {
                const cell = source[col];
                line.push(cell === '1' || cell === 1 || cell === true || cell === '.');
            }
            tiles.push(line);
        }
        this.walkableTiles = tiles;
        return true;
    }

    /** 无碰撞数据时的兜底：整张地图可走（只受 bounds 边界钳制，保持旧行为） */
    _fillWalkable(value) {
        const tiles = [];
        for (let row = 0; row < this.mapRows; row++) {
            tiles.push(new Array(this.mapCols).fill(value));
        }
        this.walkableTiles = tiles;
    }

    /** 瓦片是否可走（越界 = 阻挡） */
    _isTileWalkable(col, row) {
        if (!this.walkableTiles) return true;
        if (col < 0 || row < 0 || col >= this.mapCols || row >= this.mapRows) return false;
        return this.walkableTiles[row][col];
    }

    /**
     * 整个碰撞盒（player.width × player.height，写法同乘风采药）都能站才算能站
     * @param {number} x - 碰撞盒中心 X
     * @param {number} y - 碰撞盒中心 Y
     */
    _canStandAt(x, y) {
        if (!this.walkableTiles) return true;
        const tile = this.tileSize;
        const halfW = this.player.width / 2;
        const halfH = this.player.height / 2;
        const col1 = Math.floor((x - halfW) / tile);
        const col2 = Math.floor((x + halfW - 1) / tile);
        const row1 = Math.floor((y - halfH) / tile);
        const row2 = Math.floor((y + halfH - 1) / tile);
        for (let row = row1; row <= row2; row++) {
            for (let col = col1; col <= col2; col++) {
                if (!this._isTileWalkable(col, row)) return false;
            }
        }
        return true;
    }

    /**
     * 碰撞自检：出生点必须站得住、四盏魂灯都必须走得到。
     * 任何一条不满足 → 说明新碰撞图把路封死 / 把灯围在墙外，
     * 此时停用瓦片碰撞（只留 bounds 钳制），避免玩家卡在墙里或够不到灯。
     */
    _validateCollision() {
        if (!this.walkableTiles) return false;
        if (!this._canStandAt(this.center.x, this.center.y)) {
            console.warn('[认灯归魂] 碰撞图把出生点 (' + this.center.x + ',' + this.center.y
                + ') 涂成了阻挡 → 本次只用边界钳制，不启用瓦片碰撞');
            return false;
        }
        const reachable = this._reachableTileCenters(this.center.x, this.center.y);
        for (const lantern of this.lanterns) {
            const reachableLantern = reachable.some(point =>
                Math.hypot(point.x - lantern.x, point.y - lantern.y) <= this.interactRadius);
            if (!reachableLantern) {
                console.warn('[认灯归魂] 碰撞图把「' + lantern.name + '」围在走不到的地方 → '
                    + '本次只用边界钳制，不启用瓦片碰撞'
                    + '（请检查 assets/images/minigame/rendeng/collision.png）');
                return false;
            }
        }
        return true;
    }

    /** 从出生点洪泛填充，收集「碰撞盒站得下」的瓦片中心坐标（仅碰撞表重建时跑一次） */
    _reachableTileCenters(x, y) {
        const tile = this.tileSize;
        const startCol = Math.floor(x / tile);
        const startRow = Math.floor(y / tile);
        const seen = new Set([startCol + ',' + startRow]);
        const queue = [[startCol, startRow]];
        const centers = [{ x: startCol * tile + tile / 2, y: startRow * tile + tile / 2 }];
        while (queue.length) {
            const current = queue.shift();
            const col = current[0];
            const row = current[1];
            const neighbors = [[col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]];
            for (const next of neighbors) {
                const nextCol = next[0];
                const nextRow = next[1];
                const key = nextCol + ',' + nextRow;
                if (seen.has(key)) continue;
                if (nextCol < 0 || nextRow < 0 || nextCol >= this.mapCols || nextRow >= this.mapRows) continue;
                if (!this._isTileWalkable(nextCol, nextRow)) continue;
                const centerX = nextCol * tile + tile / 2;
                const centerY = nextRow * tile + tile / 2;
                if (!this._canStandAt(centerX, centerY)) continue;
                seen.add(key);
                queue.push([nextCol, nextRow]);
                centers.push({ x: centerX, y: centerY });
            }
        }
        return centers;
    }

    /** 开关碰撞网格覆盖层（Main 的 F2 会转发到当前小游戏） */
    setCollisionDebug(enabled) {
        this.debugCollision = !!enabled;
        return this.debugCollision;
    }

    /** 切换碰撞网格覆盖层，返回切换后的状态 */
    toggleCollisionDebug() {
        return this.setCollisionDebug(!this.debugCollision);
    }

    /** 开始 / 重开：抽本次目标灯序、清空点亮记录、机会回到 3 次、玩家回到灯台中心 */
    start() {
        super.start();
        this.targetOrder = this._generateTargetOrder();
        this.litOrder = [];
        this.attemptsLeft = this.maxAttempts;
        this.round = 1;
        this.lastCorrectCount = -1;
        this.isSolved = false;
        this.nearbyLantern = null;
        this.feedback = '';
        this.feedbackTimer = 0;
        this.feedbackPersistent = false;
        this.flashTimer = 0;
        this.keys = {};
        this.eJustPressed = false;
        this.eHeld = false;
        this.eArmed = true;
        this.player.x = this.center.x;
        this.player.y = this.center.y;
        this.player.dir = 0;
        this.player.animFrame = 0;
        this.player.animTimer = 0;
        this.player.isMoving = false;
        this.lanterns.forEach(lantern => { lantern.lit = false; lantern.flashTimer = 0; });
        // 重读一次资源：实例早于预加载创建、或美术后来才补上时，也能立刻用上（含碰撞图）
        this._loadResources();
    }

    /** 随机抽一个 1234 的全排列作为本次目标灯序（Fisher-Yates 洗牌） */
    _generateTargetOrder() {
        const order = this.lanterns.map(lantern => lantern.number);
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = order[i];
            order[i] = order[j];
            order[j] = tmp;
        }
        return order;
    }

    /** 四盏是否都已点亮 */
    _allLit() {
        return this.lanterns.every(lantern => lantern.lit);
    }

    /**
     * 逐位比对两串灯序：亮在同一位置的有几盏
     * 例：order = 1243, target = 1234 → 第 1、2 位相同 → 2
     */
    countCorrectPositions(order, target) {
        const mine = order || this.litOrder;
        const goal = target || this.targetOrder;
        let correct = 0;
        for (let i = 0; i < goal.length; i++) {
            if (mine[i] === goal[i]) correct++;
        }
        return correct;
    }

    /** 目标灯序文本（如 "3 → 1 → 4 → 2"；隐去时返回 "？"） */
    getTargetOrderText() {
        if (!this.showTargetOrder) return '？';
        return this.targetOrder.length ? this.targetOrder.join(' → ') : '？';
    }

    /** 已点亮的灯序文本（如 "1 2"；还没点亮时返回 "—"） */
    getLitOrderText() {
        return this.litOrder.length ? this.litOrder.join(' ') : '—';
    }

    /** 熄灭所有魂灯并进入下一次机会（目标灯序保持不变） */
    _extinguishAll() {
        this.lanterns.forEach(lantern => { lantern.lit = false; lantern.flashTimer = 0; });
        this.litOrder = [];
    }

    /**
     * 读输入：移动键沿用第一章小游戏的写法；E 必须「本帧刚按下」，且一次按下只能点亮一盏灯。
     *
     * 为什么不能只看 input.pressedKeys.e ——
     *   小游戏每帧会被更新两次（MiniGameScene.update 一次、Main.updateMiniGame 一次），
     *   而 inputManager.clearFrameState() 在帧末才清 pressedKeys：同一份 pressedKeys.e
     *   会被读两遍。灯序点错时第 4 盏正是刚点亮的那盏，玩家还站在它旁边（nearbyLantern 又算回它），
     *   于是第二次更新立刻把它重新点亮 —— 看起来就是「第 4 盏灯没被熄灭」。
     *   按住 E 不放时同理（keys.e 一直是 true），连发/长按都可能被当成新的一次按下。
     *
     * 这里用两个标记把「一次真实按下」圈死：
     *   · eArmed —— 只有出现过一帧「E 没按下」才会重新武装；一次按下只放行一次点亮
     *     （同帧第二次更新、按住不放的后续帧都不会再触发）。
     *   · eHeld —— 记录 E 是否仍按着（keys.e），松手后 eArmed 才恢复。
     * 效果：点错熄灭后必须松手再按才能重新点灯，节奏与玩家预期一致。
     */
    _readInput(input) {
        if (!input) return;
        this.keys = {};
        if (input.keys) {
            for (const k of ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']) {
                this.keys[k] = !!input.keys[k];
            }
        }

        const ePressed = !!(input.pressedKeys && input.pressedKeys['e']);
        const eHeldNow = !!(input.keys && input.keys['e']);
        const eDownThisCall = ePressed || eHeldNow;

        // 这一「次」输入里 E 没按下 → 重新武装，允许下一次点亮
        if (!eDownThisCall) this.eArmed = true;

        this.eJustPressed = eDownThisCall && this.eArmed === true;
        if (this.eJustPressed) this.eArmed = false;   // 本次按下已经用掉（同帧第二次更新不再触发）
        this.eHeld = eHeldNow;
    }
    /** 主循环：走位 → 找身旁的魂灯 → 按 E 点亮 */
    update(deltaTime, input) {
        super.update(deltaTime, input);
        if (!this.isRunning || this.isPaused) return;

        this._readInput(input);

        if (this.feedbackTimer > 0) this.feedbackTimer = Math.max(0, this.feedbackTimer - deltaTime);
        if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - deltaTime);
        this.lanterns.forEach(lantern => {
            if (lantern.flashTimer > 0) lantern.flashTimer = Math.max(0, lantern.flashTimer - deltaTime);
        });

        this._updatePlayerMovement(deltaTime);
        this._updateNearbyLantern();

        if (this.eJustPressed && this.nearbyLantern) {
            this._lightLantern(this.nearbyLantern);
        }
    }

    /** 走位（八向，斜着走会归一化速度；出界就贴边） */
    _updatePlayerMovement(deltaTime) {
        const p = this.player;
        let dx = 0, dy = 0;
        if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
        if (this.keys['d'] || this.keys['arrowright']) dx += 1;
        if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) dy += 1;

        if (dx !== 0 || dy !== 0) {
            const length = Math.hypot(dx, dy) || 1;
            const step = p.speed * deltaTime;
            // 分轴移动（先横后纵）：撞墙时另一轴照常走 → 可以贴着墙滑行
            this._movePlayer((dx / length) * step, 0);
            this._movePlayer(0, (dy / length) * step);
            // 朝向 0=下 / 1=左 / 2=右 / 3=上（与 player.sanxiu_walk 的 4 行排列一致）
            if (dx < 0) p.dir = 1;
            else if (dx > 0) p.dir = 2;
            else if (dy < 0) p.dir = 3;
            else if (dy > 0) p.dir = 0;
        }

        p.x = Math.min(this.bounds.right, Math.max(this.bounds.left, p.x));
        p.y = Math.min(this.bounds.bottom, Math.max(this.bounds.top, p.y));

        p.isMoving = (dx !== 0 || dy !== 0);
        if (p.isMoving) {
            p.animTimer += deltaTime;
            const frameDuration = 0.15;
            while (p.animTimer >= frameDuration) {
                p.animTimer -= frameDuration;
                p.animFrame = (p.animFrame + 1) % 4;
            }
        } else {
            p.animFrame = 0;
            p.animTimer = 0;
        }
    }

    /**
     * 单轴移动 + 瓦片碰撞：被墙挡住就停在墙边（由 `_updatePlayerMovement` 分轴调用 → 贴墙可滑行）
     * · 未启用瓦片碰撞（碰撞图不可用 / 自检未通过）→ 只做边界钳制，保持旧手感；
     * · 当前位置本身不合法（例如刚改完碰撞图）→ 放行，避免玩家卡死在墙里。
     */
    _movePlayer(dx, dy) {
        const p = this.player;
        const nextX = p.x + dx;
        const nextY = p.y + dy;
        if (!this.collisionEnabled || this._canStandAt(nextX, nextY)) {
            p.x = nextX;
            p.y = nextY;
            return;
        }
        if (!this._canStandAt(p.x, p.y)) {
            p.x = nextX;
            p.y = nextY;
        }
    }

    /** 找玩家身旁（interactRadius 内）最近的一盏「还没亮」的魂灯 */
    _updateNearbyLantern() {
        let nearest = null;
        let nearestDistance = Infinity;
        this.lanterns.forEach(lantern => {
            if (lantern.lit) return;
            const distance = Math.hypot(lantern.x - this.player.x, lantern.y - this.player.y);
            if (distance <= this.interactRadius && distance < nearestDistance) {
                nearest = lantern;
                nearestDistance = distance;
            }
        });
        this.nearbyLantern = nearest;
    }

    /**
     * 点亮一盏魂灯：点亮后不可熄灭、不可重复点亮；
     * 四盏全亮时立即结算灯序。
     */
    _lightLantern(lantern) {
        if (!lantern || lantern.lit || !this.isRunning) return;
        lantern.lit = true;
        lantern.flashTimer = 0.6;
        this.litOrder.push(lantern.number);
        this.eJustPressed = false;   // 本次「按下」已被这盏灯用掉（同一帧不会再去点第二盏）
        this.lastCorrectCount = -1;
        this.flashTimer = 0.35;
        this.nearbyLantern = null;
        if (this._allLit()) this._evaluateRound();
    }

    /**
     * 四盏全亮后的结算：
     *   完全一致 → complete()（Main 推进任务 + 播主角自言自语）
     *   不一致   → 扣一次机会：还有机会 = 提示「N 盏灯的位置对」+ 熄灭重来（灯序不变）
     *                        机会用尽 = fail() 退出（回大地图后可再进认灯台重玩）
     */
    _evaluateRound() {
        const correct = this.countCorrectPositions(this.litOrder, this.targetOrder);
        this.lastCorrectCount = correct;

        if (correct === this.lanterns.length) {
            this.isSolved = true;
            this.score = this.maxScore;
            this.feedback = '灯序对上了：' + this.litOrder.join('') + '。';
            this.feedbackTimer = 2.0;
            this.feedbackPersistent = false;   // 通关提示：本局随即结束（isRunning = false，一直显示）
            this.complete();
            if (this.result) {
                this.result.litOrder = this.litOrder.slice();
                this.result.targetOrder = this.targetOrder.slice();
                this.result.correctPositions = correct;
                this.result.attemptsUsed = this.maxAttempts - this.attemptsLeft + 1;
            }
            return;
        }

        this.attemptsLeft = Math.max(0, this.attemptsLeft - 1);

        if (this.attemptsLeft <= 0) {
            // 机会用尽 → 直接退出（认灯台路标仍在，可再进小游戏重抽灯序）
            this.feedback = '三次机会都用完了，灯序还是没对上（你点亮的是 ' + this.litOrder.join('') + '）。';
            this.feedbackTimer = 3.0;
            this.feedbackPersistent = false;   // 本局结束：isRunning = false，收尾提示一直显示
            this.score = 0;
            this.fail();
            if (this.result) {
                this.result.litOrder = this.litOrder.slice();
                this.result.targetOrder = this.targetOrder.slice();
                this.result.correctPositions = correct;
                this.result.attemptsUsed = this.maxAttempts;
            }
            return;
        }

        // 还有机会：告诉玩家「有几盏灯亮的位置是对的」→ 熄灭全部魂灯 → 重新点（目标灯序不变）
        this.feedback = correct > 0
            ? ('顺序不对：有 ' + correct + ' 盏灯亮的位置是对的（还余 ' + this.attemptsLeft + ' 次机会）')
            : ('顺序不对：没有一盏灯亮在正确的位置（还余 ' + this.attemptsLeft + ' 次机会）');
        // 失败提示常驻：玩家退回重新点灯时还要照着「上次有几盏位置对」推断，
        // 所以这里不走计时器 —— 一直显示到下一次结算写出新提示、或本局结束。
        this.feedbackTimer = 0;
        this.feedbackPersistent = true;
        const info = {
            correct: correct,
            attemptsLeft: this.attemptsLeft,
            round: this.round,
            litOrder: this.litOrder.slice(),
            targetOrder: this.targetOrder.slice(),
        };
        this._extinguishAll();
        this.round = this.maxAttempts - this.attemptsLeft + 1;
        if (this.onAttemptFailed) this.onAttemptFailed(info);
        if (this.onRoundReset) this.onRoundReset({ round: this.round, attemptsLeft: this.attemptsLeft });
    }

    // ======================================================================
    //  渲染（1280×720）
    // ======================================================================

    render(ctx) {
        ctx.save();
        this._renderBackground(ctx);
        this._renderPlayer(ctx);
        this._renderLanterns(ctx);
        this._renderInteractionHint(ctx);
        this._renderHUD(ctx);
        if (this.debugCollision) this._renderCollisionDebug(ctx);
        ctx.restore();
    }

    /**
     * 碰撞网格调试覆盖层（F2）：绿 = 可走 / 红 = 阻挡，并标出当前数据来源。
     * 用于改完 assets/images/minigame/rendeng/collision.png 后进小游戏立刻核对
     * （与大地图 F2 覆盖层同一套配色，但认灯台是固定单屏、不需要相机）。
     */
    _renderCollisionDebug(ctx) {
        const tile = this.tileSize;
        ctx.save();
        ctx.lineWidth = 1;
        for (let row = 0; row < this.mapRows; row++) {
            for (let col = 0; col < this.mapCols; col++) {
                const walkable = !!(this.walkableTiles && this.walkableTiles[row]
                    && this.walkableTiles[row][col]);
                ctx.fillStyle = walkable ? 'rgba(64, 214, 118, 0.22)' : 'rgba(226, 72, 72, 0.22)';
                ctx.fillRect(col * tile, row * tile, tile, tile);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
                ctx.strokeRect(col * tile + 0.5, row * tile + 0.5, tile - 1, tile - 1);
            }
        }

        // 玩家碰撞盒（实际参与判定的框：22×26）
        const p = this.player;
        ctx.strokeStyle = 'rgba(255, 224, 138, 0.95)';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);

        // 图例 + 数据来源（一眼看出用的是碰撞图还是兜底表）
        const source = this.collisionSource === 'image'
            ? '认灯台碰撞图（实时像素解析）'
            : (this.collisionSource === 'fallback'
                ? '内置兜底表（读不到图片像素；用 http 服务打开即可直接读图）'
                : '未启用瓦片碰撞（只用边界钳制）');
        const text = '认灯归魂 · 碰撞调试：绿 = 可走 / 红 = 阻挡　｜　来源：' + source + '　｜　按 F2 关闭';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const width = ctx.measureText(text).width + 28;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(20, 118, width, 34, 8);
        else ctx.rect(20, 118, width, 34);
        ctx.fill();
        ctx.fillStyle = '#EAF4FF';
        ctx.fillText(text, 34, 135);
        ctx.restore();
    }

    /** 背景：有 miniGame.rendeng_bg 就用图，缺图则程序化「暗水 + 中央石台」 */
    _renderBackground(ctx) {
        if (this.backgroundImage) {
            ctx.drawImage(this.backgroundImage, 0, 0, 1280, 720);
            return;
        }
        const water = ctx.createLinearGradient(0, 0, 0, 720);
        water.addColorStop(0, '#0c141d');
        water.addColorStop(1, '#04080d');
        ctx.fillStyle = water;
        ctx.fillRect(0, 0, 1280, 720);

        // 远处水纹
        ctx.strokeStyle = 'rgba(120, 168, 200, 0.06)';
        ctx.lineWidth = 1;
        for (let r = 140; r <= 640; r += 60) {
            ctx.beginPath();
            ctx.ellipse(640, 380, r, r * 0.6, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 石台
        ctx.fillStyle = 'rgba(46, 58, 70, 0.95)';
        ctx.beginPath();
        ctx.ellipse(640, 380, 330, 215, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(196, 214, 230, 0.25)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 灯台内圈（四盏灯与玩家的活动区）
        ctx.fillStyle = 'rgba(26, 34, 42, 0.9)';
        ctx.beginPath();
        ctx.ellipse(640, 360, 250, 160, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(240, 208, 128, 0.28)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 中心灯纹
        ctx.strokeStyle = 'rgba(240, 208, 128, 0.22)';
        ctx.beginPath();
        ctx.ellipse(640, 360, 84, 54, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(640, 360, 40, 26, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    _renderLanterns(ctx) {
        this.lanterns.forEach(lantern => this._renderLantern(ctx, lantern));
    }

    /** 单盏魂灯：按 lit 状态选「亮 / 暗」两张图（48×64），缺图则程序化绘制 */
    _renderLantern(ctx, lantern) {
        const x = lantern.x - this.lanternWidth / 2;
        const y = lantern.y - this.lanternHeight;
        const cx = lantern.x;
        const cy = lantern.y - this.lanternHeight / 2;

        // 已点亮：灯外光晕
        if (lantern.lit) {
            const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 78);
            glow.addColorStop(0, 'rgba(255, 214, 130, 0.5)');
            glow.addColorStop(1, 'rgba(255, 190, 96, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(cx, cy, 78, 0, Math.PI * 2);
            ctx.fill();
        }

        // 刚点亮 / 顺序不对时的闪白
        if (lantern.flashTimer > 0) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, lantern.flashTimer / 0.6) * 0.45;
            ctx.fillStyle = lantern.lit ? '#fff3cf' : '#8fa2b6';
            ctx.beginPath();
            ctx.arc(cx, cy, 34, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        const image = lantern.lit ? this.lanternLitImage : this.lanternDarkImage;
        if (image) {
            ctx.drawImage(image, x, y, this.lanternWidth, this.lanternHeight);
        } else {
            this._renderLanternFallback(ctx, x, y, lantern.lit);
        }

        // 编号牌（1=上 / 2=下 / 3=左 / 4=右，灯序里的数字就是它）
        const badgeY = y - 16;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, badgeY, 13, 0, Math.PI * 2);
        ctx.fillStyle = lantern.lit ? 'rgba(240, 200, 110, 0.95)' : 'rgba(28, 38, 48, 0.92)';
        ctx.fill();
        ctx.strokeStyle = lantern.lit ? '#fff0c4' : 'rgba(180, 200, 216, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = lantern.lit ? '#2a1c08' : '#cfdae4';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(lantern.number), cx, badgeY + 1);
        ctx.restore();

        // 灯下状态
        ctx.save();
        ctx.font = '13px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = lantern.lit ? 'rgba(255, 224, 150, 0.95)' : 'rgba(170, 186, 200, 0.75)';
        ctx.fillText(lantern.lit ? this._litIndexText(lantern) : '未亮', cx, lantern.y + 8);
        ctx.restore();
    }

    /** 灯下文案："已亮（第 1 盏）" / "已亮" */
    _litIndexText(lantern) {
        const index = this.litOrder.indexOf(lantern.number);
        return index >= 0 ? ('已亮（第 ' + (index + 1) + ' 盏）') : '已亮';
    }

    /** 程序化魂灯（缺图回退，48×64） */
    _renderLanternFallback(ctx, x, y, lit) {
        const w = this.lanternWidth;
        const h = this.lanternHeight;

        // 灯座
        ctx.fillStyle = lit ? '#8a6a3a' : '#3c4657';
        ctx.fillRect(x + 8, y + h - 10, w - 16, 8);

        // 灯体（梯形）
        ctx.fillStyle = lit ? '#b8863c' : '#4a5668';
        ctx.beginPath();
        ctx.moveTo(x + 6, y + h - 10);
        ctx.lineTo(x + 9, y + 12);
        ctx.lineTo(x + w - 9, y + 12);
        ctx.lineTo(x + w - 6, y + h - 10);
        ctx.closePath();
        ctx.fill();

        // 灯罩里的火光
        ctx.fillStyle = lit ? '#ffd986' : '#1d2531';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2 + 2, w / 2 - 12, (h - 28) / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (lit) {
            ctx.fillStyle = 'rgba(255, 246, 214, 0.95)';
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2 - 2, 5, 9, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 灯顶提梁
        ctx.strokeStyle = lit ? '#d8ab5c' : '#556072';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + 12, w / 2 - 13, Math.PI, Math.PI * 2);
        ctx.stroke();
    }
    /** 玩家：优先用 player.sanxiu_walk / _idle（4 行 = 下/左/右/上，每行 4 帧 32×32），缺图画暖色小人 */
    _renderPlayer(ctx) {
        const p = this.player;
        const frame = this.playerFrameSize;          // 源帧尺寸（32×32）
        // 显示尺寸与大地图 Player 一致（32×32 帧 → 48×64），见 MiniGame.playerSpriteWidth
        const drawW = this.playerSpriteWidth;
        const drawH = this.playerSpriteHeight;
        const image = p.isMoving ? this.playerImage : (this.playerIdleImage || this.playerImage);

        if (image) {
            const sx = p.isMoving ? p.animFrame * frame : 0;
            const sy = p.dir * frame;
            ctx.drawImage(image, sx, sy, frame, frame,
                p.x - drawW / 2, p.y - drawH / 2, drawW, drawH);
            return;
        }

        // 降级：暖色小人（同样按大地图尺寸画，保证两种表现一样大）
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + drawH * 0.22, drawW * 0.28, drawH * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e9a05a';
        ctx.fillRect(p.x - drawW * 0.24, p.y - drawH * 0.42, drawW * 0.48, drawH * 0.84);
        ctx.fillStyle = '#ffe9c8';
        ctx.fillRect(p.x - drawW * 0.09, p.y - drawH * 0.3, drawW * 0.18, drawH * 0.16);
        ctx.restore();
    }

    /** 靠近未点亮的魂灯时的交互提示 */
    _renderInteractionHint(ctx) {
        if (!this.nearbyLantern) return;
        const lantern = this.nearbyLantern;
        const tx = lantern.x;
        const ty = lantern.y - this.lanternHeight - 36;
        const text = '[E] 点亮魂灯 ' + lantern.number;

        ctx.save();
        ctx.font = '16px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const width = ctx.measureText(text).width + 22;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(tx - width / 2, ty - 15, width, 30, 8);
            ctx.fill();
        } else {
            ctx.fillRect(tx - width / 2, ty - 15, width, 30);
        }
        ctx.fillStyle = '#ffe08a';
        ctx.fillText(text, tx, ty);
        ctx.restore();
    }
    /** HUD：左上机会与进度、顶部目标灯序、中下反馈、底部操作说明 */
    _renderHUD(ctx) {
        const litCount = this.lanterns.filter(lantern => lantern.lit).length;

        ctx.save();
        ctx.textBaseline = 'middle';

        // ---- 左上：第几次 / 机会 / 已点亮进度 ----
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(20, 18, 340, 92, 10);
        else ctx.rect(20, 18, 340, 92);
        ctx.fill();
        ctx.strokeStyle = 'rgba(240, 208, 128, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = '#f0d080';
        ctx.font = 'bold 20px Microsoft YaHei';
        ctx.fillText('认灯归魂 · 第 ' + Math.min(this.round, this.maxAttempts) + ' 次', 40, 44);

        ctx.font = '16px Microsoft YaHei';
        ctx.fillStyle = '#dfe8f0';
        ctx.fillText(
            '机会：' + '●'.repeat(this.attemptsLeft) + '○'.repeat(this.maxAttempts - this.attemptsLeft)
            + '（' + this.attemptsLeft + '/' + this.maxAttempts + '）',
            40, 72
        );
        ctx.fillText('已点亮 ' + litCount + '/' + this.lanterns.length + '　灯序：' + this.getLitOrderText(), 40, 96);

        // ---- 顶部中央：目标灯序 ----
        const orderText = this.showTargetOrder
            ? ('目标灯序：' + this.getTargetOrderText())
            : '目标灯序：已隐去（凭记忆点亮）';
        ctx.font = 'bold 20px Microsoft YaHei';
        const panelWidth = Math.max(340, ctx.measureText(orderText).width + 44);
        const panelX = (1280 - panelWidth) / 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(panelX, 18, panelWidth, 44, 10);
        else ctx.rect(panelX, 18, panelWidth, 44);
        ctx.fill();
        ctx.strokeStyle = 'rgba(240, 208, 128, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = this.showTargetOrder ? '#ffe08a' : 'rgba(200, 214, 224, 0.85)';
        ctx.fillText(orderText, 640, 41);

        // ---- 反馈（顺序不对 / 机会用尽 / 成功） ----
        // feedbackPersistent = 失败提示常驻：一直显示到下一次结算换掉它、或本局结束
        if (this.feedback && (this.feedbackTimer > 0 || this.feedbackPersistent || !this.isRunning)) {
            ctx.font = 'bold 18px Microsoft YaHei';
            const textWidth = ctx.measureText(this.feedback).width + 44;
            const boxX = (1280 - textWidth) / 2;
            const boxY = 560;
            ctx.fillStyle = 'rgba(10, 14, 20, 0.78)';
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(boxX, boxY, textWidth, 42, 10);
            else ctx.rect(boxX, boxY, textWidth, 42);
            ctx.fill();
            ctx.strokeStyle = this.isSolved ? 'rgba(159, 224, 180, 0.7)' : 'rgba(232, 106, 82, 0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = this.isSolved ? '#b6f0c8' : '#ffc9b6';
            ctx.fillText(this.feedback, 640, boxY + 21);
        }

        // ---- 底部操作说明 ----
        ctx.font = '15px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(214, 226, 236, 0.75)';
        ctx.fillText('WASD / 方向键移动 ｜ 靠近魂灯按 E 点亮（点亮后不可熄灭，四盏全亮即比对灯序）', 640, 696);

        ctx.restore();
    }
}

if (typeof window !== 'undefined') window.LanternIdentifyMiniGame = LanternIdentifyMiniGame;
