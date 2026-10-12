/**
 * 游戏完结界面（章末二 · 中央泊位登船后播放的滚动字幕）
 *
 * 触发：Main.sailToZhaochen 结算完《行舟有归处》后 → Main.startGameEnding → switchScene('ending')
 *      （之后在中央泊位再次登船不再播放，直接打开世界地图，见 Main.boardZhaochenBoat）
 *
 * 画面（1280×720）：
 *   · 背景底（可选美术）：ui.ending_bg —— assets/images/ui/ending_bg.png（1280×720）
 *     有图 → 整屏贴图铺底（按画布尺寸拉伸铺满）；缺图 / 空图 / ResourceManager 品红占位图
 *     → 程序化兜底「深墨渐变 + 中部渡口暖光晕」（不会画出品红块，界面照常播）；
 *     两种情况都会继续叠加「缓慢上浮的浮尘」与「四周暗角」，保证字幕始终可读；
 *     生成 / 覆盖占位图：py -3 tools/generate_ending_assets.py（补图后 Ctrl+F5 生效）；
 *   · 字幕：js/EndingText.js 的整段文字（每行 ≤ 25 字，空行占一个行位）从屏幕**底部逐行上滚**，
 *     每行水平居中，采用楷体 / 宋体优先的「艺术字」字栈，40px、手动字距、暖金色 + 柔光；
 *   · 飘落物：落叶 / 落花（见 js/FallingFoliage.js），叠在底图与浮尘之上、**字幕之下**，
 *     数量由 maxCount 控制（默认 14，比主图更淡）；缺图时程序化叶片 / 花瓣兜底；
 *   · 提示：最后一行完全滚出屏幕上方后，屏幕中心淡入「按任意键返回游戏」（带呼吸明暗）。
 *
 * 交互（模态：播放期间世界输入全部封死）：
 *   · 进入场景即 inputManager.setMovementBlocked(true) + setInputBlocked(true)，
 *     Main.handleKeyDown 也对 'ending' 场景直接 return —— 播放中任何键都不生效（不能跳过）；
 *   · 提示出现后，键盘任意键 / 鼠标任意键 → Main.finishGameEnding()：
 *     写入剧情标记 game_ending_seen、打开世界地图（MapTeleport）、切回 gameWorld 场景。
 *
 * 音频（见 js/AudioManager.js，音频地址清单见 tools/音频资源清单.txt）：
 *   · enter：滚动字幕一开始就循环播放 bgm.ending；
 *   · exit：只有玩家退出本界面时才停止（播放期间不会被打断）；
 *   · 回大地图后主图 BGM 由 Main.onGameWorldSceneEnter 走「10 秒后起播」。
 *
 * 可调参数（都收在构造函数里）：lineHeight 行距 / fontSize 字号 / scrollSpeed 滚动速度。
 */

class EndingScene extends Scene {
    /**
     * @param {Main} main - 主程序实例（取 canvas / inputManager / sceneManager）
     */
    constructor(main) {
        super('ending');
        this.main = main;

        // ========== 数据：滚动字幕（生成物，见 tools/generate_ending_text.py）==========
        this.lines = [];

        // ========== 画布与排版（1280×720）==========
        this.canvasWidth = 1280;
        this.canvasHeight = 720;
        this.lineHeight = 56;      // 每行占位高度（空行同样占 56px）
        this.fontSize = 40;        // 「艺术字」字号：25 字 × (40 + 6) = 1150 < 1280，不会溢出画布
        this.letterSpacing = 6;    // 逐字绘制时的手动字距（Canvas 的 letterSpacing 兼容性不稳）
        this.textFont = '"STKaiti", "KaiTi", "Kaiti SC", "STSong", "SimSun", serif';
        this.textColor = '#f2dfb2';
        this.glowColor = 'rgba(255, 206, 122, 0.75)';
        this.promptFont = `bold 30px ${this.textFont}`;

        // ========== 滚动参数 ==========
        // 整段 = 720（入场）+ 281 行 × 56 ≈ 16456px；100px/秒 ≈ 2.7 分钟（每行在屏上约 7 秒）
        this.defaultScrollSpeed = 100;  // 像素 / 秒
        this.scrollSpeed = this.defaultScrollSpeed;

        // ========== 文案 ==========
        this.promptText = '按任意键返回游戏';

        // ========== 背景美术（可选：ui.ending_bg；缺图时代码画底，见 loadBackground）==========
        this.backgroundKey = 'ui.ending_bg';   // assets/images/ui/ending_bg.png（1280×720）
        this.backgroundImage = null;
        this.missingArtLogged = false;         // 缺图警告只打一次

        // ========== 运行时状态（enter 时 resetScroll() 复位）==========
        this.scrollOffset = this.canvasHeight;  // 首行的 y：正好在屏幕下缘之外
        this.isFinished = false;                // 最后一行是否已完全滚出屏幕上方
        this.promptTimer = 0;                   // 提示淡入计时（秒）
        this.isDismissed = false;               // 防止同一帧重复触发退出
        this.time = 0;                          // 场景计时（浮尘闪烁 / 提示呼吸用）

        // ========== 背景浮尘（固定伪随机，避免每帧跳动）==========
        this.dustParticles = this.createDustParticles(70);

        // ========== 飘落物（落叶 / 落花；见 js/FallingFoliage.js）==========
        // 完结界面也飘落叶 / 落花（小游戏 / Boss 战场 / 世界地图都不显示）
        // 画在「整屏底 + 浮尘 + 暗角」之上、滚动字幕之下 —— 字幕永远保持最上层、清晰可读
        // maxCount = 界面中同时存在的最大数量，调它控疏密；贴图与主图 / 开始界面共用
        this.foliage = new FallingFoliage({
            name: '游戏完结 飘落物',
            area: { x: 0, y: 0, width: this.canvasWidth, height: this.canvasHeight },
            maxCount: 14,
            spawnRate: 1.0,
            scale: 2,            // 单帧 16×16 → 显示 32×32
            leafWeight: 0.5,     // 完结画面：落叶 / 落花各半，更柔和
            flowerWeight: 0.5,
            alphaRange: [0.55, 0.9],   // 比主图更淡一点，不干扰字幕
        });
    }

    /**
     * 生成背景浮尘（用固定种子的线性同余发生器，保证每次进入画面一致、便于回归比对）
     * @param {number} count - 数量
     * @returns {Array<Object>} [{ x, y, size, alpha, parallax, twinkle }]
     */
    createDustParticles(count) {
        const particles = [];
        let seed = 20260912;
        const nextRandom = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        for (let i = 0; i < count; i++) {
            particles.push({
                x: nextRandom() * this.canvasWidth,
                y: nextRandom() * this.canvasHeight,
                size: 1 + Math.floor(nextRandom() * 2),
                alpha: 0.10 + nextRandom() * 0.35,
                parallax: 0.10 + nextRandom() * 0.25,   // 背景视差：越大的跟着字幕走得越快
                twinkle: nextRandom() * Math.PI * 2,    // 闪烁相位
            });
        }
        return particles;
    }

    // ==================== 生命周期 ====================

    /**
     * 进入场景：读文案 + 复位滚动 + 封死世界输入
     * @param {Object} [params] - { speed } 可覆盖滚动速度（调试 / 回归用，正常流程不传）
     */
    enter(params = {}) {
        super.enter(params);
        Logger.log('进入游戏完结界面（滚动字幕）');

        this.lines = this.readLines();
        this.loadBackground();
        this.scrollSpeed = (params && params.speed > 0) ? params.speed : this.defaultScrollSpeed;
        this.resetScroll();

        // 模态画面：世界输入全部封死（键盘由 Main.handleKeyDown 对 'ending' 场景直接放行给本场景）
        if (this.main && this.main.inputManager) {
            this.main.inputManager.setMovementBlocked(true);
            this.main.inputManager.setInputBlocked(true);
        }
        if (this.main && this.main.player) {
            this.main.player.isInteracting = true;
        }

        // 飘落物：读贴图（三处界面共用同一组图）+ 重新铺场 + 同步画布范围
        this.foliage.setArea({ x: 0, y: 0, width: this.canvasWidth, height: this.canvasHeight });
        this.foliage.loadImages(this.main ? this.main.resourceManager : null);
        this.foliage.reset();

        // 背景音乐：滚动字幕开始播放时立刻循环播放完结 BGM
        // （只有玩家退出本界面（exit）才停；缺失音频文件时静默跳过）
        gameAudio.playBgm('bgm.ending');
    }

    /**
     * 离开场景：解锁世界输入
     */
    exit() {
        super.exit();
        if (this.main && this.main.inputManager) {
            this.main.inputManager.setMovementBlocked(false);
            this.main.inputManager.setInputBlocked(false);
        }
        if (this.main && this.main.player) {
            this.main.player.isInteracting = false;
        }

        // 背景音乐：玩家退出完结界面 → 立刻停掉完结 BGM
        // （回到大地图后主图 BGM 由 Main.onGameWorldSceneEnter 走 10 秒延迟）
        gameAudio.stopBgm('bgm.ending');
    }

    /**
     * 读取滚动字幕（js/EndingText.js 生成物；缺失时回退为空数组，界面仍可正常退出）
     * @returns {string[]} 行数组
     */
    readLines() {
        if (typeof EndingText !== 'undefined' && EndingText && typeof EndingText.getLines === 'function') {
            const lines = EndingText.getLines();
            if (Array.isArray(lines)) return lines;
        }
        console.warn('[游戏完结] 未找到 EndingText（js/EndingText.js），字幕为空');
        return [];
    }

    /**
     * 读取可选的整屏背景美术（启动已随 Main.preloadInitialResources 预加载到缓存）
     * 缺图 / 空图 / ResourceManager 的 dataURL 占位图 → 保持 null，改由 renderBackground 程序化兜底
     * （约定与 js/MainMenuScene.js / PickupItem / Signpost 一致：宁可不画，也不画品红块）
     */
    loadBackground() {
        const rm = (this.main && this.main.resourceManager) || null;
        const img = rm && typeof rm.getCachedImage === 'function'
            ? rm.getCachedImage(this.backgroundKey)
            : null;

        this.backgroundImage = this.isUsableImage(img) ? img : null;

        if (!this.backgroundImage && !this.missingArtLogged) {
            this.missingArtLogged = true;
            console.warn(`[游戏完结] 背景美术缺失：${this.backgroundKey}`
                + '（assets/images/ui/ending_bg.png，1280×720）；'
                + '本次改用程序化「深墨渐变 + 渡口暖光晕」兜底，补图后刷新页面（Ctrl+F5）即生效'
                + '（可用 py -3 tools/generate_ending_assets.py 生成占位图）');
        }
    }

    /**
     * 图片是否可绘制：排除空图与 ResourceManager 的 dataURL 占位图（品红 32×32）
     * @param {Image|null} img - 待校验图片
     * @returns {boolean} 是否可用于绘制
     */
    isUsableImage(img) {
        if (!img) return false;
        if (typeof img.src === 'string' && img.src.startsWith('data:')) return false;
        return (img.naturalWidth || img.width || 0) > 0;
    }

    /**
     * 复位滚动状态：整段字幕从屏幕底部重新上滚
     */
    resetScroll() {
        this.scrollOffset = this.canvasHeight;
        this.isFinished = false;
        this.promptTimer = 0;
        this.isDismissed = false;
        this.time = 0;
    }

    // ==================== 排版计算 ====================

    /**
     * 某一行当前所在 y（文字以行中为基线）
     * @param {number} index - 行号（0 起）
     * @returns {number} 画布 y 坐标
     */
    getLineY(index) {
        return this.scrollOffset + index * this.lineHeight;
    }

    /**
     * 整段字幕占位总高（含空行）
     * @returns {number} 像素
     */
    getTotalHeight() {
        return this.lines.length * this.lineHeight;
    }

    /**
     * 整段播完所需秒数（720 入场 + 整段高度 + 一行收尾）
     * @returns {number} 秒
     */
    getDuration() {
        const speed = this.scrollSpeed > 0 ? this.scrollSpeed : this.defaultScrollSpeed;
        return (this.canvasHeight + this.getTotalHeight() + this.lineHeight) / speed;
    }

    /**
     * 某一行此刻是否应该绘制（只在屏幕上下缘附近绘制，省掉整段文字的逐字开销）
     * @param {number} index - 行号
     * @returns {boolean}
     */
    isLineVisible(index) {
        const y = this.getLineY(index);
        return y > -this.lineHeight && y < this.canvasHeight + this.lineHeight;
    }

    // ==================== 更新 ====================

    /**
     * 更新：推进滚动 → 最后一行滚出后显示提示 → 任意键 / 鼠标任意键退出
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态（InputManager.getInputState()）
     */
    update(deltaTime, input) {
        super.update(deltaTime, input);
        const dt = (typeof deltaTime === 'number' && deltaTime > 0) ? deltaTime : 0;
        this.time += dt;

        // ---- 0) 飘落物（落叶 / 落花）：无论字幕播到哪一步都在飘 ----
        this.foliage.update(dt);

        // ---- 1) 滚动中：整段一行一行向上走 ----
        if (!this.isFinished) {
            this.scrollOffset -= this.scrollSpeed * dt;
            // 最后一行完全滚出屏幕上方（含行高）→ 停止滚动，准备提示
            if (this.lines.length > 0
                && this.getLineY(this.lines.length - 1) + this.lineHeight / 2 <= 0) {
                this.isFinished = true;
                this.promptTimer = 0;
                Logger.log('[游戏完结] 字幕播毕，等待玩家按键返回');
            }
            return;
        }

        // ---- 2) 提示出现后：任意键 / 鼠标任意键 → 退出完结界面 ----
        this.promptTimer += dt;
        if (this.isDismissed) return;

        const pressedKeys = (input && input.pressedKeys) ? Object.keys(input.pressedKeys) : [];
        const mouseClicked = !!(input && input.mouseClicked);
        if (pressedKeys.length > 0 || mouseClicked) {
            this.isDismissed = true;
            this.dismiss();
        }
    }

    /**
     * 退出完结界面：交给 Main 记标记 + 打开世界地图 + 切回游戏世界场景
     */
    dismiss() {
        if (this.main && typeof this.main.finishGameEnding === 'function') {
            this.main.finishGameEnding();
            return;
        }
        // 兜底：没有 Main.finishGameEnding 时只切场景（不应发生）
        if (this.main && this.main.sceneManager) {
            this.main.sceneManager.switchScene('gameWorld');
        }
    }

    // ==================== 渲染 ====================

    /**
     * 渲染完结界面：深墨背景 + 飘落物 + 滚动字幕 + 「按任意键返回游戏」提示
     * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
     */
    render(ctx) {
        if (!ctx) return;
        const canvasWidth = this.canvasWidth || 1280;
        const canvasHeight = this.canvasHeight || 720;

        this.renderBackground(ctx, canvasWidth, canvasHeight);

        // 飘落物（落叶 / 落花）：叠在背景（含浮尘 / 暗角）之上、字幕之下
        if (this.foliage) {
            this.foliage.render(ctx);
        }

        // 滚动字幕（只画屏幕附近的几行）
        for (let i = 0; i < this.lines.length; i++) {
            if (!this.isLineVisible(i)) continue;
            this.renderLine(ctx, this.lines[i], this.getLineY(i), canvasWidth, canvasHeight);
        }

        // 提示（最后一行滚出后才出现）
        if (this.isFinished) {
            this.renderPrompt(ctx, canvasWidth, canvasHeight);
        }
    }

    /**
     * 背景：整屏底（优先贴图 ui.ending_bg，缺图时代码画）+ 上浮浮尘 + 四周暗角
     * 底图与程序化底二选一；浮尘 / 暗角两种情况都照常叠加，保证字幕始终可读
     * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
     * @param {number} canvasWidth - 画布宽
     * @param {number} canvasHeight - 画布高
     */
    renderBackground(ctx, canvasWidth, canvasHeight) {
        const centerX = canvasWidth / 2;

        if (this.backgroundImage) {
            // 1) 贴图铺底：整屏 1280×720（与 js/MainMenuScene.js 同一写法，按画布尺寸铺满）
            ctx.drawImage(this.backgroundImage, 0, 0, canvasWidth, canvasHeight);
        } else {
            // 1) 底色（深墨 → 夜蓝 → 深墨）
            const base = ctx.createLinearGradient(0, 0, 0, canvasHeight);
            base.addColorStop(0, '#04050a');
            base.addColorStop(0.45, '#0b1122');
            base.addColorStop(1, '#04050a');
            ctx.fillStyle = base;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 2) 渡口的灯：屏幕中部偏下的暖光晕
            const halo = ctx.createRadialGradient(centerX, canvasHeight * 0.62, 10,
                centerX, canvasHeight * 0.62, canvasHeight * 0.72);
            halo.addColorStop(0, 'rgba(255, 198, 112, 0.10)');
            halo.addColorStop(0.55, 'rgba(255, 178, 96, 0.04)');
            halo.addColorStop(1, 'rgba(255, 178, 96, 0)');
            ctx.fillStyle = halo;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        // 3) 浮尘：随字幕一起缓慢上浮（视差），到顶后从底部绕回
        ctx.save();
        for (const dust of this.dustParticles) {
            let y = dust.y + this.scrollOffset * dust.parallax;
            y = ((y % canvasHeight) + canvasHeight) % canvasHeight;
            const alpha = dust.alpha * (0.65 + 0.35 * Math.sin(this.time * 1.6 + dust.twinkle));
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
            ctx.fillStyle = '#ffe6b8';
            ctx.fillRect(dust.x, y, dust.size, dust.size);
        }
        ctx.restore();

        // 4) 暗角：四周压暗，把视线收在中间的字幕上
        const vignette = ctx.createRadialGradient(centerX, canvasHeight / 2, canvasHeight * 0.25,
            centerX, canvasHeight / 2, canvasHeight * 1.05);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    /**
     * 绘制一行字幕：水平居中、逐字加字距；靠近屏幕上下的行淡出，屏幕中部的行带柔光
     * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
     * @param {string} text - 一行文字（空字符串 = 空行，只占行位不绘制）
     * @param {number} y - 该行中心 y
     * @param {number} canvasWidth - 画布宽
     * @param {number} canvasHeight - 画布高
     */
    renderLine(ctx, text, y, canvasWidth, canvasHeight) {
        if (!text) return;   // 空行照样占一个 lineHeight 的行位

        // 上下边缘 90px 内线性淡出（进 / 出屏更柔和）
        const edgeFade = Math.min(1, Math.max(0, Math.min(y, canvasHeight - y) / 90));
        const alpha = 0.15 + 0.85 * edgeFade;
        if (alpha <= 0.16) return;

        // 柔光只给屏幕中部的行（免去整屏逐字阴影开销）
        const isFocal = Math.abs(y - canvasHeight * 0.45) < canvasHeight * 0.28;

        ctx.save();
        // 先定字体再量宽（measureText 依赖当前 font）
        ctx.font = `${this.fontSize}px ${this.textFont}`;
        const chars = Array.from(text);
        const widths = chars.map(ch => ctx.measureText(ch).width);
        const totalWidth = widths.reduce((sum, w) => sum + w, 0)
            + this.letterSpacing * Math.max(0, chars.length - 1);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.textColor;
        if (isFocal) {
            ctx.shadowColor = this.glowColor;
            ctx.shadowBlur = 14;
        }

        let x = (canvasWidth - totalWidth) / 2;
        for (let i = 0; i < chars.length; i++) {
            ctx.fillText(chars[i], x, y);
            x += widths[i] + this.letterSpacing;
        }
        ctx.restore();
    }

    /**
     * 绘制屏幕中心的「按任意键返回游戏」：淡入 + 呼吸明暗
     * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
     * @param {number} canvasWidth - 画布宽
     * @param {number} canvasHeight - 画布高
     */
    renderPrompt(ctx, canvasWidth, canvasHeight) {
        const fade = Math.min(1, this.promptTimer / 0.8);
        const breath = 0.72 + 0.28 * Math.sin(this.time * 3.2);
        const alpha = Math.max(0, Math.min(1, fade * breath));
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = this.promptFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffe9b0';
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 18;
        ctx.fillText(this.promptText, canvasWidth / 2, canvasHeight / 2);
        ctx.restore();
    }

    // ==================== 存档 ====================

    /**
     * 反序列化：读档落在这个场景时，字幕从头开始播（不沿用上一局的进度）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        super.deserialize(data);
        this.lines = this.readLines();
        this.resetScroll();
        if (this.foliage) this.foliage.reset();   // 飘落物同样从头铺场
    }
}
