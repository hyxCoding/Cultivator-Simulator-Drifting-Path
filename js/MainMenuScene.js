/**
 * 主菜单场景（游戏开始界面）
 *
 * 美术（把图片放进 assets/images/ui/ 即自动生效，无需改代码 —— 见 tools/generate_start_screen_assets.py）：
 *   ui.start_screen   assets/images/ui/start_screen.png   1280×720  整屏背景（开始界面整幅画面）
 *   ui.start_button   assets/images/ui/start_button.png   400×112   开始按钮（居中显示）
 *   两张图已在 Main.preloadInitialResources 里随启动预加载。
 *
 * 规则：
 *   1) 本场景**不做任何界面绘制**：只把上面两张图贴到画布上，不写字 / 不画框 / 不画渐变；
 *      唯一的例外是飘落物（落叶 / 落花，见 js/FallingFoliage.js）—— 它属于环境特效，
 *      画在整屏背景与开始按钮之间；缺图时程序化兜底，同样不写一个字、不画界面方框；
 *   2) 开始按钮固定居中：x = (画布宽 - 400) / 2，y = (画布高 - 112) / 2（1280×720 → 440, 304）；
 *   3) 只有点击按钮矩形范围（400×112）才开始游戏；键盘不再触发开始（避免误触）；
 *   4) 缺图时只铺一层底色（不画品红占位块），鼠标移到按钮区域仍提示可点击（手型光标）；
 *      补图 / 换图后刷新页面（Ctrl+F5）即生效；
 *   5) 鼠标悬停按钮时图片**平滑上浮**（只改渲染位置 renderX / renderY，逻辑位置 buttonX /
 *      buttonY 不变 → 点击热区仍是居中的 400×112 矩形），与 UIButton / MapAreaButton 同一套写法；
 *      上浮距离 / 过渡速度见 this.hoverOffset / this.hoverTransitionSpeed。
 *
 * 音频（见 js/AudioManager.js，音频地址清单见 tools/音频资源清单.txt）：
 *   6) 进入本场景（游戏加载完成后）立刻循环播放 bgm.main_menu；
 *      点击「开始游戏」按钮时立刻停止，并播放按钮点击音效（滑过按钮播 sfx.ui_hover）。
 *   7) 这首 BGM 其实在 Main.init 的加载阶段就试播过一次（Main.startMenuBgmEarly）：
 *      若浏览器自动播放策略把它拦下了，AudioManager 会等玩家的第一次点击 / 按键补播
 *      （加载界面上的那一次点击也算数）→ 进本场景时的 playBgm 只是「已在播就不重头播」的兜底。
 */
class MainMenuScene extends Scene {
    constructor(main) {
        super('mainMenu');
        this.main = main;

        // ========== 开始界面美术（只贴图，不做程序化绘制）==========
        this.backgroundKey = 'ui.start_screen';   // assets/images/ui/start_screen.png（1280×720）
        this.buttonKey = 'ui.start_button';       // assets/images/ui/start_button.png（400×112）
        this.backgroundImage = null;
        this.buttonImage = null;

        // ========== 开始按钮（图片原尺寸，居中）==========
        this.buttonWidth = 400;
        this.buttonHeight = 112;
        this.buttonX = 0;           // 逻辑左上角 x（点击热区，不随悬停变化）
        this.buttonY = 0;           // 逻辑左上角 y（点击热区，不随悬停变化）

        // ========== 悬停上浮（与 UIButton / MapAreaButton 同一套写法）==========
        this.hoverOffset = { x: 0, y: -12 };  // 鼠标悬停时向上浮起的像素（改这里调幅度）
        this.hoverTransitionSpeed = 8;        // 悬停过渡速度（越大越快，8 ≈ 0.13 秒到位）
        this.currentOffsetX = 0;              // 当前偏移量（平滑过渡用）
        this.currentOffsetY = 0;
        this.renderX = 0;           // 实际渲染左上角 x = buttonX + currentOffsetX
        this.renderY = 0;           // 实际渲染左上角 y = buttonY + currentOffsetY

        // ========== 飘落物（落叶 / 落花；见 js/FallingFoliage.js）==========
        // 开始界面也飘落叶 / 落花（小游戏 / Boss 战场 / 世界地图都不显示）
        // maxCount = 界面中同时存在的最大数量，调它控疏密；贴图与主图 / 完结界面共用
        this.foliage = new FallingFoliage({
            name: '开始界面 飘落物',
            area: { x: 0, y: 0, width: 1280, height: 720 },
            maxCount: 10,        // 开始界面疏一些，别抢开始按钮的注意力
            spawnRate: 0.8,
            scale: 2,            // 单帧 16×16 → 显示 32×32
            leafWeight: 0.7,
            flowerWeight: 0.3,
        });

        // ========== 状态 ==========
        this.isStarting = false;        // 本次点击已触发开始，防止重复切换场景
        this.isHoveringButton = false;  // 鼠标是否停在开始按钮上（只切光标，不绘制任何图形）
        this.missingArtLogged = false;  // 缺图警告只打一次
    }

    /**
     * 进入场景：读取美术 + 计算按钮居中位置
     */
    enter(params = {}) {
        super.enter(params);
        Logger.log('进入主菜单');
        this.isStarting = false;
        this.isHoveringButton = false;
        this.currentOffsetX = 0;      // 每次进场都从「未悬停」状态开始
        this.currentOffsetY = 0;
        this.loadImages();
        this.layoutButton();

        // 飘落物：读贴图（三处界面共用同一组图）+ 重新铺场（每次进开始界面从头飘）
        this.foliage.loadImages(this.main ? this.main.resourceManager : null);
        this.foliage.reset();

        // 背景音乐：游戏加载完成后立刻循环播放开始界面 BGM
        // （点「开始游戏」按钮时立刻停止，见 update；缺失音频文件时静默跳过）
        gameAudio.playBgm('bgm.main_menu');
    }

    /**
     * 离开场景：把鼠标指针恢复成默认样式
     */
    exit() {
        super.exit();
        this.setPointerCursor(false);
    }

    /**
     * 读取开始界面两张图（启动预加载缓存）
     * 缺图 / ResourceManager 占位图 → 保持 null（不画兜底图形，也不会出现品红占位块）
     */
    loadImages() {
        const rm = this.main ? this.main.resourceManager : null;
        const bg = rm ? rm.getCachedImage(this.backgroundKey) : null;
        const btn = rm ? rm.getCachedImage(this.buttonKey) : null;

        this.backgroundImage = this.isUsableImage(bg) ? bg : null;
        this.buttonImage = this.isUsableImage(btn) ? btn : null;

        if ((!this.backgroundImage || !this.buttonImage) && !this.missingArtLogged) {
            this.missingArtLogged = true;
            const missing = [];
            if (!this.backgroundImage) missing.push(`${this.backgroundKey}（assets/images/ui/start_screen.png，1280×720）`);
            if (!this.buttonImage) missing.push(`${this.buttonKey}（assets/images/ui/start_button.png，400×112）`);
            console.warn(`[主菜单] 开始界面美术缺失：${missing.join(' / ')}；缺图不影响点击开始，补图后刷新页面即生效`);
        }
    }

    /**
     * 图片是否可绘制：排除空图与 ResourceManager 的 dataURL 占位图（品红 32×32）
     * 约定与 PickupItem / Signpost / 认灯归魂一致 —— 缺图时宁可不画，也不画品红块
     * @param {Image|null} img - 待校验图片
     * @returns {boolean} 是否可用于绘制
     */
    isUsableImage(img) {
        if (!img) return false;
        if (typeof img.src === 'string' && img.src.startsWith('data:')) return false;
        return (img.naturalWidth || img.width || 0) > 0;
    }

    /**
     * 开始按钮居中：按钮左上角 =（画布宽 - 400)/2,（画布高 - 112)/2
     * 同时把渲染位置复位到逻辑位置（currentOffset = 0，不带悬停上浮）
     */
    layoutButton() {
        const canvas = this.main ? this.main.canvas : null;
        const canvasWidth = (canvas && canvas.width) || 1280;
        const canvasHeight = (canvas && canvas.height) || 720;
        this.buttonX = Math.round((canvasWidth - this.buttonWidth) / 2);
        this.buttonY = Math.round((canvasHeight - this.buttonHeight) / 2);
        this.renderX = this.buttonX + this.currentOffsetX;
        this.renderY = this.buttonY + this.currentOffsetY;

        // 飘落物范围 = 整个画布（开始界面是平铺界面，不需要摄像机偏移）
        this.foliage.setArea({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
    }

    /**
     * 点是否落在开始按钮矩形内（用**逻辑位置**判定，不随悬停上浮改变 ——
     * 与 UIButton.containsPoint / MapAreaButton.containsPoint 同一规则）
     * @param {number} px - 鼠标 x 坐标
     * @param {number} py - 鼠标 y 坐标
     * @returns {boolean} 是否在按钮内
     */
    containsButtonPoint(px, py) {
        if (typeof px !== 'number' || typeof py !== 'number') return false;
        return px >= this.buttonX && px <= this.buttonX + this.buttonWidth
            && py >= this.buttonY && py <= this.buttonY + this.buttonHeight;
    }

    /**
     * 鼠标指针提示（DOM 光标，不是画布绘制）
     * @param {boolean} isPointer - true = 手型（可点击）
     */
    setPointerCursor(isPointer) {
        const canvas = this.main ? this.main.canvas : null;
        if (canvas && canvas.style) {
            canvas.style.cursor = isPointer ? 'pointer' : 'default';
        }
    }

    /**
     * 悬停上浮动画：朝目标偏移量平滑过渡（鼠标靠近 → 上浮；移开 → 落回原位）
     * 只改渲染位置 renderX / renderY，逻辑位置 buttonX / buttonY 始终不变（点击热区不漂移）
     * @param {number} deltaTime - 时间增量（秒，GameLoop 固定步长 1/60）
     */
    updateHoverAnimation(deltaTime) {
        const dt = (typeof deltaTime === 'number' && deltaTime > 0) ? deltaTime : 0.016;
        const targetOffsetX = this.isHoveringButton ? this.hoverOffset.x : 0;
        const targetOffsetY = this.isHoveringButton ? this.hoverOffset.y : 0;

        // 平滑过渡（与 UIButton / MapAreaButton 的 lerpFactor 写法一致）
        const lerpFactor = Math.min(1, this.hoverTransitionSpeed * dt);
        this.currentOffsetX += (targetOffsetX - this.currentOffsetX) * lerpFactor;
        this.currentOffsetY += (targetOffsetY - this.currentOffsetY) * lerpFactor;

        // 更新渲染位置（逻辑位置不变）
        this.renderX = this.buttonX + this.currentOffsetX;
        this.renderY = this.buttonY + this.currentOffsetY;
    }

    update(deltaTime, input) {
        super.update(deltaTime, input);

        // 飘落物（落叶 / 落花）：与场景状态无关，一直在飘
        this.foliage.update(deltaTime);

        // 悬停判定：开始切换场景后不再响应鼠标
        const hovering = !!(input && !this.isStarting
            && this.containsButtonPoint(input.mouseX, input.mouseY));
        if (hovering !== this.isHoveringButton) {
            this.isHoveringButton = hovering;
            this.setPointerCursor(hovering);
            // 鼠标滑过按钮音效（每次放到按钮上播一次；与 UIButton / MapAreaButton 同一套规则）
            if (hovering) gameAudio.playSfx('sfx.ui_hover');
        }

        // 悬停上浮（已点击开始时停在当前偏移，不再继续动画）
        if (!this.isStarting) {
            this.updateHoverAnimation(deltaTime);
        }

        if (!input || this.isStarting) return;

        // 点击「开始游戏」按钮 → 进入游戏世界（键盘不再触发开始）
        if (input.mouseClicked && hovering) {
            this.isStarting = true;
            this.setPointerCursor(false);
            // 按钮点击音效 + 开始界面背景音乐立刻停止（需求：点开始游戏立刻停）
            gameAudio.playSfx('sfx.ui_click');
            gameAudio.stopBgm('bgm.main_menu');
            this.main.sceneManager.switchScene('gameWorld');
        }
    }

    /**
     * 渲染开始界面：整屏背景图 + 飘落物 + 居中开始按钮图（场景本身不写一个字、不画图形）
     * 按钮按 renderX / renderY 绘制（悬停时整体上浮，逻辑热区不变）
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        const canvas = this.main ? this.main.canvas : null;
        const canvasWidth = (canvas && canvas.width) || 1280;
        const canvasHeight = (canvas && canvas.height) || 720;

        // 1) 整屏背景：按 1280×720 铺满画布（只贴图）
        if (this.backgroundImage) {
            ctx.drawImage(this.backgroundImage, 0, 0, canvasWidth, canvasHeight);
        } else {
            // 缺图兜底：只铺一层底色，不画任何图形 / 文字 / 占位块
            ctx.fillStyle = '#0a0a14';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        // 2) 飘落物（落叶 / 落花）：贴图帧动画 + 飘落轨迹，画在开始按钮之下
        if (this.foliage) {
            this.foliage.render(ctx);
        }

        // 3) 开始按钮：居中贴图（点击热区仍是 buttonX / buttonY 那块 400×112）
        if (this.buttonImage) {
            ctx.drawImage(this.buttonImage, this.renderX, this.renderY, this.buttonWidth, this.buttonHeight);
        }
    }
}
