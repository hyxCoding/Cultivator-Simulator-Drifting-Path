/**
 * 飘落物（落叶 / 落花）—— 图片帧动画 + 飘落轨迹的通用环境特效
 *
 * ============ 只在这些界面显示 ============
 *   1) 第一章主图 青岚浮野（qinglan_fuye）—— GameMap.initSceneAnimations 自动开启
 *   2) 第二章主图 云渡泽（yunduze）        —— 同上
 *   3) 开始游戏界面（js/MainMenuScene.js）
 *   4) 游戏结束滚动字幕界面（js/EndingScene.js）
 * 不显示：
 *   · 小游戏（各自整屏背景，且切场景时 GameWorldScene.exit 已把地图 deactivate，
 *     地图（含本特效）既不更新也不绘制）
 *   · Boss 战场（boss_arena_ch1 / boss_arena_ch2，两张战场图都不在 FOLIAGE_MAP_IDS 白名单里）
 *   · 世界地图界面（MapTeleport 为不透明全屏底图，盖在地图之上）
 * 判定用的是**严格地图白名单**（FOLIAGE_MAP_IDS），不做名字模糊匹配 ——
 * 以后新加地图默认不显示，需要时再往白名单里加一条。
 *
 * ============ 美术规格（把文件放到对应路径即自动生效，无需改代码）============
 *   foliage.falling_leaf    assets/images/foliage/falling_leaf.png    1 行 12 帧，单帧 16×16（整图 192×16）
 *   foliage.falling_flower  assets/images/foliage/falling_flower.png  1 行 12 帧，单帧 16×16（整图 192×16）
 *   两套动画都**循环播放**（12 帧 @ 12fps ≈ 每 1 秒一圈）；
 *   尺寸与规格不符（含 ResourceManager 的 32×32 品红占位图）→ 该贴图整张作废，
 *   自动回退程序化叶片 / 花瓣（不会画出品红块）。
 *   生成 / 覆盖占位图：py -3 tools/generate_foliage_assets.py（--force 覆盖，--check 只校验尺寸）
 *
 * ============ 飘落轨迹（不是直线下落）============
 *   竖向   y += vy·dt，vy 带轻微重力加速          —— 由慢到快
 *   横向   x += (drift + swaySpeed·sin(2π·f·t + φ))·dt
 *          —— 基础风飘（drift）叠加左右摆动（正弦速度），轨迹是蛇形曲线，且会来回往复
 *   旋转   rotation = spinAmp·sin(2π·f2·t + φ2)   —— 叶片 / 花瓣翻飞
 *   每片飘落物的下落速度 / 加速度 / 摆幅 / 频率 / 起始相位 / 自转 / 缩放 / 透明度 / 水平翻转
 *   都各自随机，互不同步，所以不会看出「一排整齐直线下落」。
 *
 * ============ 数量与性能 ============
 *   config.maxCount = **界面中同时存在的最大飘落物数量**（到达上限即停止生成，最省事的就是调它）
 *   config.spawnRate = 每秒生成数量；低于上限 1/3 时按 4 倍速补场，避免刚进图长时间空场。
 *   config.enabled = false 时既不生成也不绘制（清空已有飘落物）。
 *   飘出下边界或左右边界的立即回收（见 _isOutside）。
 *
 * 用法（三处调用点的写法一致）：
 *   const foliage = new FallingFoliage({ maxCount: 16, spawnRate: 0.9, leafWeight: 0.7 });
 *   foliage.setArea({ x: 0, y: 0, width: 1280, height: 720 });   // 主图传摄像机视口（世界坐标）
 *   foliage.loadImages(resourceManager);                          // 或省略 → 自动取单例
 *   foliage.update(deltaTime);
 *   foliage.render(ctx, renderPos.x, renderPos.y);                // 平铺界面不传偏移
 */
class FallingFoliage {
    /**
     * 显示飘落物的地图（严格白名单：只含前两章主图）
     * 小游戏地图 / Boss 战场（boss_arena_ch1 / boss_arena_ch2）/ 世界地图都不在其中
     */
    static FOLIAGE_MAP_IDS = ['qinglan_fuye', 'yunduze'];

    /**
     * 默认参数（可被构造 options / 地图配置 ambientConfig.fallingFoliage 覆盖）
     * 区间参数一律写 [最小值, 最大值]，生成时在该区间内随机取值
     */
    static DEFAULT_CONFIG = {
        enabled: true,          // 是否显示
        maxCount: 18,           // 同屏最大飘落物数量（上限，到顶即停止生成）
        spawnRate: 1.1,         // 每秒生成数量
        leafWeight: 0.6,        // 「落叶 : 落花」比例权重（0~1，1 = 全是落叶）
        flowerWeight: 0.4,
        scale: 2,               // 贴图缩放（单帧 16×16 → 默认显示 32×32）
        fps: 12,                // 帧率（12 帧循环 → 每圈 1 秒）
        frameWidth: 16,         // 单帧宽
        frameHeight: 16,        // 单帧高
        frameCount: 12,         // 每行帧数
        fallSpeed: [26, 62],    // 下落初速（px/s）
        fallAccel: [2, 12],     // 下落加速度（px/s²）
        drift: [-18, 18],       // 基础横向漂移（px/s）
        swaySpeed: [14, 46],    // 左右摆动速度幅值（px/s）
        swayFrequency: [0.16, 0.44],  // 摆动频率（Hz）
        spinAmplitude: [0.35, 1.15],  // 自转摆幅（弧度）
        spinFrequency: [0.10, 0.28],  // 自转频率（Hz）
        scaleRange: [0.85, 1.2],      // 单片缩放抖动
        alphaRange: [0.72, 1.0],      // 单片透明度
        fadeIn: 0.6,            // 入场淡入（秒）
        fadeOutDistance: 96,    // 距离下边界多少像素内开始淡出
        edgeMargin: 40,         // 超出边界多少像素才算「飘出」（上下）
        sideMargin: 160,        // 超出左右多少像素才算「飘出」
        flip: true,             // 是否随机水平翻转（同一张图两种朝向）
    };

    /**
     * 两套贴图（顺序即落叶 / 落花；权重来自 config.leafWeight / flowerWeight）
     * color / color2 供「缺图时程序化兜底」用
     */
    static SPRITE_SPECS = [
        { key: 'foliage.falling_leaf', type: 'leaf', color: '#b9cd6b', color2: '#8aa94f' },
        { key: 'foliage.falling_flower', type: 'flower', color: '#f6c8dc', color2: '#e9a2c2' },
    ];

    /**
     * 该地图是否显示飘落物（只认前两章主图）
     * @param {string} mapId - 地图 ID
     * @returns {boolean}
     */
    static isFoliageMap(mapId) {
        return FallingFoliage.FOLIAGE_MAP_IDS.indexOf(mapId) !== -1;
    }

    /**
     * 精灵图是否满足「每行 frameWidth×frameHeight、至少 columns 列、至少 row+1 行」的规格
     * （规则与 CombatEffect.isSpriteUsable 一致：占位图 32×32 会因尺寸不足被判为不可用）
     * @param {Image} sheet - 精灵图
     * @param {number} frameWidth - 单帧宽
     * @param {number} frameHeight - 单帧高
     * @param {number} [columns=1] - 需要的列数（帧数）
     * @param {number} [row=0] - 需要覆盖的行号（0 基）
     * @returns {boolean}
     */
    static isSpriteUsable(sheet, frameWidth, frameHeight, columns = 1, row = 0) {
        if (!sheet || !frameWidth || !frameHeight) return false;
        const w = sheet.naturalWidth || sheet.width || 0;
        const h = sheet.naturalHeight || sheet.height || 0;
        if (w < frameWidth * columns || h < frameHeight * (row + 1)) return false;
        if (w % frameWidth !== 0 || h % frameHeight !== 0) return false;
        return true;
    }

    /**
     * 该 canvas 上下文是否支持画布变换（save / restore / translate / rotate / scale）
     * 无头冒烟测试里的「记录型 ctx」未必实现这些方法 —— 缺方法时整帧跳过绘制，
     * 不影响逻辑与断言（真机 canvas 一定齐全）
     * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
     * @returns {boolean}
     */
    static canTransform(ctx) {
        if (!ctx) return false;
        const methods = ['save', 'restore', 'translate', 'rotate', 'scale'];
        return methods.every(m => typeof ctx[m] === 'function');
    }

    /**
     * 区间随机
     * @param {number[]} range - [最小值, 最大值]
     * @returns {number}
     */
    static randomRange(range) {
        const min = (range && range.length === 2) ? range[0] : 0;
        const max = (range && range.length === 2) ? range[1] : min;
        return min + Math.random() * (max - min);
    }

    /**
     * @param {Object} [options] - 参数（键名见 FallingFoliage.DEFAULT_CONFIG）
     * @param {string}   [options.name] - 实例名（仅日志用）
     * @param {Object}   [options.area] - 生成区域 {x, y, width, height}（世界坐标 / 屏幕坐标）
     * @param {Object}   [options.resourceManager] - 资源管理器（缺省自动取 ResourceManager 单例）
     * @param {Array}    [options.sprites] - 自定义贴图表 [{ key, type, weight }]（一般不用传）
     */
    constructor(options = {}) {
        this.name = options.name || 'falling_foliage';

        // 只挑 DEFAULT_CONFIG 里的键 → 避免把 area / name / sprites 等一起塞进 config
        this.config = {};
        Object.keys(FallingFoliage.DEFAULT_CONFIG).forEach(key => {
            this.config[key] = (options[key] !== undefined)
                ? options[key]
                : FallingFoliage.DEFAULT_CONFIG[key];
        });

        // 生成 / 回收区域（默认整块 1280×720；地图侧每帧按摄像机视口更新）
        this.area = Object.assign({ x: 0, y: 0, width: 1280, height: 720 }, options.area || {});

        // 贴图：0 = 落叶，1 = 落花（权重取自 config）
        const specs = (Array.isArray(options.sprites) && options.sprites.length)
            ? options.sprites
            : FallingFoliage.SPRITE_SPECS;
        this.sprites = specs.map((spec, index) => Object.assign({}, spec, {
            weight: (spec.weight !== undefined)
                ? spec.weight
                : (index === 0 ? this.config.leafWeight : this.config.flowerWeight),
            image: null,
            status: 'unknown',   // 'ready' | 'pending' | 'missing'
        }));
        this._rebuildSpriteTable();

        this.particles = [];
        this.resourceManager = options.resourceManager || null;
        this.time = 0;                 // 实例累计时间（秒）
        this.spawnAccumulator = 0;     // 生成计数的小数部分
        this.prewarmed = false;        // 是否已做过「进场先铺几片」的预热
        this.missingArtLogged = false; // 缺图警告只打一次

        // 传入 resourceManager 时立刻读一次缓存（三处调用点都会显式调 loadImages，这里只是兜底）
        if (this.resourceManager) this.loadImages(this.resourceManager);
    }

    // ==================== 参数 / 区域 ====================

    /**
     * 覆盖参数（地图读档后 / 配置变更时用；只认 DEFAULT_CONFIG 里的键）
     * @param {Object} config - 参数表
     * @returns {FallingFoliage} 自身（链式）
     */
    applyConfig(config) {
        if (!config) return this;
        Object.keys(FallingFoliage.DEFAULT_CONFIG).forEach(key => {
            if (config[key] !== undefined) this.config[key] = config[key];
        });
        this._rebuildSpriteTable();
        if (this.config.enabled === false) this.particles.length = 0;
        return this;
    }

    /**
     * 是否显示飘落物（enabled = true）
     * @returns {boolean}
     */
    isEnabled() {
        return this.config.enabled !== false;
    }

    /**
     * 开关飘落物（关闭时清空已有飘落物）
     * @param {boolean} enabled
     * @returns {FallingFoliage} 自身（链式）
     */
    setEnabled(enabled) {
        this.config.enabled = enabled !== false;
        if (!this.config.enabled) this.particles.length = 0;
        return this;
    }

    /**
     * 更新活动区域（世界坐标 / 屏幕坐标）
     * 主图每帧传摄像机视口 → 飘落物只出现在屏幕附近，同屏数量稳定，
     * config.maxCount 就是玩家看到的「界面中最大飘落物数量」
     * @param {Object} area - {x, y, width, height}
     * @returns {FallingFoliage} 自身（链式）
     */
    setArea(area) {
        if (!area) return this;
        if (typeof area.x === 'number') this.area.x = area.x;
        if (typeof area.y === 'number') this.area.y = area.y;
        if (typeof area.width === 'number' && area.width > 0) this.area.width = area.width;
        if (typeof area.height === 'number' && area.height > 0) this.area.height = area.height;
        return this;
    }

    /**
     * 当前活动区域副本
     * @returns {Object} {x, y, width, height}
     */
    getArea() {
        return Object.assign({}, this.area);
    }

    /**
     * 当前飘落物数量（同屏最大数量上限见 config.maxCount）
     * @returns {number}
     */
    getCount() {
        return this.particles.length;
    }

    /**
     * 清空并允许下一次 update 重新「预热铺场」（进场景 / 进图时调）
     * @returns {FallingFoliage} 自身（链式）
     */
    reset() {
        this.particles.length = 0;
        this.spawnAccumulator = 0;
        this.time = 0;
        this.prewarmed = false;
        return this;
    }

    /**
     * 按权重重建「贴图抽取表」（权重为 0 的贴图不会出现）
     */
    _rebuildSpriteTable() {
        this.spriteTable = [];
        let total = 0;
        this.sprites.forEach((sprite, index) => {
            const weight = Math.max(0, sprite.weight || 0);
            if (weight <= 0) return;
            total += weight;
            this.spriteTable.push({ index: index, threshold: total });
        });
        this.spriteTotalWeight = total;
    }

    // ==================== 贴图加载 ====================

    /**
     * 读取两张飘落物贴图（先同步取缓存，再异步兜底加载）
     * 约定与 Signpost / MainMenuScene / EndingScene 一致：
     * dataURL 占位图 / 尺寸与规格不符 → 该贴图作废（image = null）→ 走程序化兜底，绝不画品红块
     * @param {Object} [resourceManager] - 资源管理器（省略则用 ResourceManager 单例）
     */
    loadImages(resourceManager) {
        const rm = resourceManager || this.resourceManager
            || ((typeof ResourceManager !== 'undefined' && ResourceManager.getInstance)
                ? ResourceManager.getInstance() : null);
        this.resourceManager = rm;
        if (!rm) return;

        this.sprites.forEach(sprite => {
            // 1) 先看缓存（启动预加载过就有）
            let cached = null;
            try {
                cached = (typeof rm.getCachedImage === 'function') ? rm.getCachedImage(sprite.key) : null;
            } catch (e) {
                cached = null;
            }
            if (this._isUsableSprite(cached)) {
                sprite.image = cached;
                sprite.status = 'ready';
                return;
            }

            // 2) 缓存里没有或是占位图 → 异步加载一次（无头测试环境没有 loadImage 时直接判缺图）
            if (typeof rm.loadImage !== 'function') {
                sprite.image = null;
                sprite.status = 'missing';
                return;
            }
            sprite.status = 'pending';
            try {
                rm.loadImage(sprite.key).then(img => {
                    if (this._isUsableSprite(img)) {
                        sprite.image = img;
                        sprite.status = 'ready';
                    } else {
                        sprite.image = null;
                        sprite.status = 'missing';
                        this._warnMissingArt();
                    }
                }).catch(() => {
                    sprite.status = 'missing';
                    this._warnMissingArt();
                });
            } catch (e) {
                sprite.status = 'missing';
            }
        });

        this._warnMissingArt();
    }

    /**
     * 贴图是否可用：排除空图 / dataURL 占位图，且逐帧尺寸必须等于规格（16×16 × 12 帧）
     * @param {Image|null} img - 待校验图片
     * @returns {boolean}
     */
    _isUsableSprite(img) {
        if (img === null || typeof img === 'undefined') return false;
        if (typeof img.src === 'string' && img.src.indexOf('data:') === 0) return false;
        return FallingFoliage.isSpriteUsable(img,
            this.config.frameWidth, this.config.frameHeight, this.config.frameCount);
    }

    /**
     * 两张贴图都不可用时提示一次（真机缺图 → 程序化叶片 / 花瓣照样有飘落物，不会画品红块）
     */
    _warnMissingArt() {
        if (this.missingArtLogged) return;
        if (this.sprites.some(sprite => sprite.status === 'ready')) return;
        if (this.sprites.some(sprite => sprite.status === 'pending')) return;  // 还在加载，等结果再判
        this.missingArtLogged = true;
        const list = this.sprites.map(sprite => sprite.key).join(' / ');
        console.warn(`[飘落物] 贴图缺失或尺寸不符（规格：1 行 12 帧，单帧 16×16）：${list}；`
            + '本次改用程序化叶片 / 花瓣兜底，补图后刷新页面（Ctrl+F5）即生效'
            + '（可先跑 py -3 tools/generate_foliage_assets.py 生成占位图）');
    }

    // ==================== 更新 ====================

    /**
     * 推进飘落物：预热铺场 → 生成 → 逐片更新轨迹与帧动画 → 回收飘出边界的
     * @param {number} deltaTime - 时间增量（秒）
     */
    update(deltaTime) {
        const dt = (typeof deltaTime === 'number' && deltaTime > 0) ? deltaTime : 0;
        if (!this.isEnabled()) {
            if (this.particles.length) this.particles.length = 0;
            return;
        }
        if (dt <= 0) return;

        this.time += dt;

        // 1) 刚进图 / 刚进场景：先铺几片（否则按生成速率要十几秒才看得出效果）
        if (!this.prewarmed) {
            this.prewarmed = true;
            const initial = Math.floor(Math.max(0, this.config.maxCount) * 0.5);
            for (let i = 0; i < initial; i++) {
                const particle = this.spawn();
                // 预热的这几片直接散布在区域内（不是都挤在上边界）
                if (particle) particle.y = this.area.y + Math.random() * this.area.height * 0.85;
            }
        }

        // 2) 生成新飘落物（到达 maxCount 即停止）
        this._spawnStep(dt);

        // 3) 逐片更新轨迹 / 帧动画 / 透明度
        this.particles.forEach(particle => this._updateParticle(particle, dt));

        // 4) 回收飘出边界的
        this.particles = this.particles.filter(particle => !this._isOutside(particle));
    }

    /**
     * 生成进度：spawnRate（个/秒）+ 小数累积；数量低于上限 1/3 时 4 倍速补场
     * @param {number} dt - 时间增量（秒）
     */
    _spawnStep(dt) {
        const cfg = this.config;
        const maxCount = Math.max(0, Math.floor(cfg.maxCount || 0));
        if (this.particles.length >= maxCount) {
            this.spawnAccumulator = 0;
            return;
        }
        const boost = (this.particles.length < maxCount / 3) ? 4 : 1;
        this.spawnAccumulator += cfg.spawnRate * boost * dt;
        let count = Math.floor(this.spawnAccumulator);
        if (count <= 0) return;
        this.spawnAccumulator -= count;
        count = Math.min(count, maxCount - this.particles.length);
        for (let i = 0; i < count; i++) this.spawn();
    }

    /**
     * 按权重抽一张贴图（leafWeight : flowerWeight）
     * @returns {Object|null} this.sprites 里的表项
     */
    _pickSprite() {
        if (!this.spriteTable || this.spriteTable.length === 0) return this.sprites[0] || null;
        const roll = Math.random() * this.spriteTotalWeight;
        for (let i = 0; i < this.spriteTable.length; i++) {
            if (roll < this.spriteTable[i].threshold) return this.sprites[this.spriteTable[i].index];
        }
        return this.sprites[this.spriteTable[this.spriteTable.length - 1].index];
    }

    /**
     * 生成一片飘落物（水平位置在区域内随机，从上边界之外进入）
     * @returns {Object|null} 粒子（区域尺寸非法 / 没有可用贴图配置时返回 null）
     */
    spawn() {
        const cfg = this.config;
        const area = this.area;
        if (!(area.width > 0 && area.height > 0)) return null;

        const sprite = this._pickSprite();
        if (!sprite) return null;

        const scale = Math.max(0.1, cfg.scale) * FallingFoliage.randomRange(cfg.scaleRange);
        const size = cfg.frameWidth * scale;      // 显示尺寸 = 单帧宽 × 缩放
        const particle = {
            sprite: sprite,
            x: area.x + Math.random() * area.width,
            y: area.y - size * 0.5 - Math.random() * 48,   // 上边界之外
            size: size,

            // 竖向：初速 + 轻微重力加速（由慢到快）
            vy: FallingFoliage.randomRange(cfg.fallSpeed),
            gravity: FallingFoliage.randomRange(cfg.fallAccel),

            // 横向：基础风飘 + 正弦摆动（轨迹是蛇形，不是直线）
            drift: FallingFoliage.randomRange(cfg.drift),
            swaySpeed: FallingFoliage.randomRange(cfg.swaySpeed),
            swayFrequency: FallingFoliage.randomRange(cfg.swayFrequency),
            swayPhase: Math.random() * Math.PI * 2,

            // 自转：正弦摆动式翻飞
            rotation: 0,
            spinAmplitude: FallingFoliage.randomRange(cfg.spinAmplitude),
            spinFrequency: FallingFoliage.randomRange(cfg.spinFrequency),
            spinPhase: Math.random() * Math.PI * 2,

            // 表现
            baseAlpha: FallingFoliage.randomRange(cfg.alphaRange),
            alpha: 0,
            flip: cfg.flip === true && Math.random() < 0.5,

            // 帧动画
            age: 0,
            frameIndex: Math.floor(Math.random() * Math.max(1, cfg.frameCount)),
            frameTimer: 0,
        };
        this.particles.push(particle);
        return particle;
    }

    /**
     * 更新一片飘落物：竖向加速下落 + 横向正弦摆动 + 自转 + 帧动画 + 淡入淡出
     * @param {Object} p - 粒子
     * @param {number} dt - 时间增量（秒）
     */
    _updateParticle(p, dt) {
        const cfg = this.config;
        p.age += dt;

        // 1) 竖向：vy 带加速度，越落越快
        p.vy += p.gravity * dt;
        p.y += p.vy * dt;

        // 2) 横向：基础风飘 + 正弦摆动（速度正负交替 → 左右往复的蛇形轨迹）
        const sway = Math.sin(p.age * p.swayFrequency * Math.PI * 2 + p.swayPhase);
        p.x += (p.drift + p.swaySpeed * sway) * dt;

        // 3) 自转：绕自身中心来回翻飞
        p.rotation = p.spinAmplitude * Math.sin(p.age * p.spinFrequency * Math.PI * 2 + p.spinPhase);

        // 4) 帧动画（12 帧循环）
        const frameCount = Math.max(1, cfg.frameCount);
        p.frameTimer += dt * Math.max(1, cfg.fps);
        const advance = Math.floor(p.frameTimer);
        if (advance > 0) {
            p.frameTimer -= advance;
            p.frameIndex = (p.frameIndex + advance) % frameCount;
        }

        // 5) 透明度：入场淡入 + 出下边界前淡出
        let alpha = p.baseAlpha;
        if (cfg.fadeIn > 0) alpha *= Math.min(1, p.age / cfg.fadeIn);
        const bottom = this.area.y + this.area.height;
        const fadeDistance = Math.max(1, cfg.fadeOutDistance);
        if (p.y > bottom - fadeDistance) {
            alpha *= Math.max(0, (bottom - p.y) / fadeDistance);
        }
        p.alpha = Math.max(0, Math.min(1, alpha));
    }

    /**
     * 是否已飘出活动区域（下边界之外，或向左右飘得太远）
     * @param {Object} p - 粒子
     * @returns {boolean}
     */
    _isOutside(p) {
        const cfg = this.config;
        if (p.y - p.size * 0.5 > this.area.y + this.area.height + cfg.edgeMargin) return true;
        if (p.x < this.area.x - cfg.sideMargin) return true;
        if (p.x > this.area.x + this.area.width + cfg.sideMargin) return true;
        return false;
    }

    // ==================== 渲染 ====================

    /**
     * 绘制所有飘落物（各自取帧号、按各自旋转 / 缩放 / 透明度绘制）
     * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
     * @param {number} [offsetX=0] - 世界坐标 → 屏幕坐标的横向偏移（地图传摄像机 renderPos.x）
     * @param {number} [offsetY=0] - 纵向偏移（地图传摄像机 renderPos.y）；平铺界面（主菜单 / 完结）不传
     */
    render(ctx, offsetX = 0, offsetY = 0) {
        if (!ctx || !this.isEnabled() || this.particles.length === 0) return;
        if (!FallingFoliage.canTransform(ctx)) return;   // 无头测试的记录型 ctx：跳过绘制，不影响逻辑

        const cfg = this.config;
        this.particles.forEach(p => {
            const half = p.size / 2;
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x - offsetX, p.y - offsetY);
            ctx.rotate(p.rotation);
            if (p.flip) ctx.scale(-1, 1);

            const image = p.sprite ? p.sprite.image : null;
            if (this._isUsableSprite(image)) {
                // 单行 12 帧：源矩形 = (帧号 × 16, 0, 16, 16)，循环播放
                const frame = ((p.frameIndex % cfg.frameCount) + cfg.frameCount) % cfg.frameCount;
                ctx.drawImage(image,
                    frame * cfg.frameWidth, 0, cfg.frameWidth, cfg.frameHeight,
                    -half, -half, p.size, p.size);
            } else {
                // 缺图 → 程序化叶片 / 花瓣（不会出现品红占位块）
                FallingFoliage.drawProcedural(ctx, p.sprite, p.size);
            }
            ctx.restore();
        });
    }

    /**
     * 程序化兜底：按类型画一片叶子 / 一朵花
     * （调用前 ctx 已 translate 到中心并按 p.rotation 旋转）
     * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
     * @param {Object} sprite - 贴图表项（取 type / color / color2）
     * @param {number} size - 显示尺寸（px）
     */
    static drawProcedural(ctx, sprite, size) {
        if (!ctx || typeof ctx.beginPath !== 'function' || typeof ctx.fill !== 'function') return;
        const half = size / 2;
        const type = (sprite && sprite.type) || 'leaf';
        const color = (sprite && sprite.color) || '#b9cd6b';
        const color2 = (sprite && sprite.color2) || color;

        // 花：五瓣绕中心均布 + 花心
        if (type === 'flower') {
            ctx.fillStyle = color;
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 / 5) * i;
                ctx.beginPath();
                if (typeof ctx.ellipse === 'function') {
                    ctx.ellipse(Math.cos(angle) * half * 0.42, Math.sin(angle) * half * 0.42,
                        half * 0.44, half * 0.3, angle, 0, Math.PI * 2);
                    ctx.fill();
                } else if (typeof ctx.arc === 'function') {
                    ctx.arc(Math.cos(angle) * half * 0.42, Math.sin(angle) * half * 0.42,
                        half * 0.34, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    return;   // 上下文画不了弧 → 本片跳过
                }
            }
            if (typeof ctx.arc === 'function') {
                ctx.fillStyle = color2;
                ctx.beginPath();
                ctx.arc(0, 0, half * 0.22, 0, Math.PI * 2);
                ctx.fill();
            }
            return;
        }

        // 叶：柳叶形（两段对称曲线）+ 中脉
        ctx.fillStyle = color;
        if (typeof ctx.moveTo === 'function' && typeof ctx.quadraticCurveTo === 'function') {
            ctx.beginPath();
            ctx.moveTo(0, -half);
            ctx.quadraticCurveTo(half, 0, 0, half);
            ctx.quadraticCurveTo(-half, 0, 0, -half);
            ctx.fill();
            if (typeof ctx.stroke === 'function' && typeof ctx.lineTo === 'function') {
                ctx.strokeStyle = color2;
                ctx.beginPath();
                ctx.moveTo(0, -half * 0.8);
                ctx.lineTo(0, half * 0.8);
                ctx.stroke();
            }
        } else if (typeof ctx.ellipse === 'function') {
            ctx.beginPath();
            ctx.ellipse(0, 0, half * 0.55, half, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
