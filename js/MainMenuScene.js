/**
 * 主菜单场景（游戏开始界面）
 *
 * 美术（把图片放进 assets/images/ui/ 即自动生效，无需改代码 —— 见 tools/generate_start_screen_assets.py）：
 *   ui.start_screen   assets/images/ui/start_screen.png   1280×720  整屏背景（开始界面整幅画面）
 *   ui.start_button   assets/images/ui/start_button.png   400×112   开始按钮（居中显示）
 *   两张图已在 Main.preloadInitialResources 里随启动预加载。
 *
 * 规则：
 *   1) 本场景**不做任何代码绘图**：只把上面两张图贴到画布上，不写字 / 不画框 / 不画渐变；
 *   2) 开始按钮固定居中：x = (画布宽 - 400) / 2，y = (画布高 - 112) / 2（1280×720 → 440, 304）；
 *   3) 只有点击按钮矩形范围（400×112）才开始游戏；键盘不再触发开始（避免误触）；
 *   4) 缺图时只铺一层底色（不画品红占位块），鼠标移到按钮区域仍提示可点击（手型光标）；
 *      补图 / 换图后刷新页面（Ctrl+F5）即生效。
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
        this.buttonX = 0;
        this.buttonY = 0;

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
        console.log('进入主菜单');
        this.isStarting = false;
        this.loadImages();
        this.layoutButton();
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
     */
    layoutButton() {
        const canvas = this.main ? this.main.canvas : null;
        const canvasWidth = (canvas && canvas.width) || 1280;
        const canvasHeight = (canvas && canvas.height) || 720;
        this.buttonX = Math.round((canvasWidth - this.buttonWidth) / 2);
        this.buttonY = Math.round((canvasHeight - this.buttonHeight) / 2);
    }

    /**
     * 点是否落在开始按钮矩形内（与绘制的 400×112 矩形完全一致）
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

    update(deltaTime, input) {
        super.update(deltaTime, input);

        if (!input || this.isStarting) return;

        const hovering = this.containsButtonPoint(input.mouseX, input.mouseY);
        if (hovering !== this.isHoveringButton) {
            this.isHoveringButton = hovering;
            this.setPointerCursor(hovering);
        }

        // 点击「开始游戏」按钮 → 进入游戏世界（键盘不再触发开始）
        if (input.mouseClicked && hovering) {
            this.isStarting = true;
            this.setPointerCursor(false);
            this.main.sceneManager.switchScene('gameWorld');
        }
    }

    /**
     * 渲染开始界面：整屏背景图 + 居中开始按钮图（不做任何程序化绘制）
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

        // 2) 开始按钮：居中贴图（点击热区就是这块 400×112）
        if (this.buttonImage) {
            ctx.drawImage(this.buttonImage, this.buttonX, this.buttonY, this.buttonWidth, this.buttonHeight);
        }
    }
}
