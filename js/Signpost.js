/**
 * 路标类（Signpost）
 * 地图上的交互点，靠近后按 E 可触发回调（如开启小游戏）
 * 支持加载图片（通过 ResourceManager 资源键），无图片时回退到木牌渲染
 * 独立实体，由 GameMap 持有、GameLoop+Main 协调更新渲染
 */
class Signpost {
    /**
     * @param {Object} config
     * @param {string}   config.id          - 唯一 ID
     * @param {string}   config.name        - 显示名称（路标牌上的文字）
     * @param {Object}   config.position    - 世界坐标 {x, y}
     * @param {number}   config.radius      - 交互半径，默认 40
     * @param {string}   config.promptText  - 提示文本后半部分，例如"开始修炼"→ "按 E 键开始修炼"
     * @param {Function} config.onActivate  - 玩家按 E 后被调用的回调函数
     * @param {string}   config.image       - ResourceManager 图片键（可选），如 'signposts.herb_collect'
     * @param {number}   config.imageWidth  - 图片显示宽度（px），不填则自动取原图宽
     * @param {number}   config.imageHeight - 图片显示高度（px），不填则自动取原图高
     * @param {string}   config.questRequired - 需要的任务 ID（可选），仅当任务已接取（active/completed）时路标才可见
     * @param {string}   config.gameId      - 关联的小游戏 ID（可选），Main 会在 activate 后自动启动
     * @param {boolean}  config.oneShot     - 是否只触发一次，默认 false
     */
    constructor(config = {}) {
        this.id = config.id || `signpost_${Date.now()}`;
        this.name = config.name || '路标';
        this.position = { x: config.position?.x || 0, y: config.position?.y || 0 };
        this.radius = config.radius ?? 40;
        this.promptText = config.promptText || '开始交互';
        this.onActivate = config.onActivate || null;
        this.imageKey = config.image || null;
        this.imageWidth = config.imageWidth || null;
        this.imageHeight = config.imageHeight || null;
        this.questRequired = config.questRequired || null;  // 任务门控
        this.gameId = config.gameId || null;
        this.oneShot = config.oneShot ?? false;
        this.isActivated = false;
        this.isActive = true;  // 初始可见，由 updateQuestGate 控制

        // 加载图片（异步，加载完成后自动显示）
        this.image = null;
        this._loadImage();
    }

    /**
     * 异步加载图片
     */
    _loadImage() {
        if (!this.imageKey) return;
        try {
            const resourceManager = ResourceManager.getInstance();
            resourceManager.loadImage(this.imageKey).then(img => {
                if (img) this.image = img;
            });
        } catch (e) {
            // 静默失败，后续回退到木牌渲染
        }
    }

    // ==================== 更新 ====================

    update(deltaTime) {
        // 无浮动动画，保留以供未来扩展
    }

    /**
     * 根据任务状态控制路标可见性
     * 任务已接取（active/completed）→ 显示；未接取（locked/未注册）→ 隐藏
     * @param {Object} questSystem - 任务的 QuestSystem 实例
     */
    updateQuestGate(questSystem) {
        if (!this.questRequired) return;  // 无任务门控，不做处理
        if (!questSystem) {
            this.isActive = false;
            return;
        }
        const questState = questSystem.getQuestState(this.questRequired);
        // 任务已存在且不是 locked 状态 → 已接取，显示
        this.isActive = !!(questState && questState.state !== 'locked');
    }

    // ==================== 范围检测 ====================

    isPlayerInRange(playerPosition) {
        if (!this.isActive) return false;
        const dx = this.position.x - playerPosition.x;
        const dy = this.position.y - playerPosition.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }

    // ==================== 交互 ====================

    activate() {
        if (!this.isActive) return false;
        if (this.oneShot && this.isActivated) return false;
        if (typeof this.onActivate !== 'function') return false;
        this.onActivate(this);
        this.isActivated = true;
        return true;
    }

    // ==================== 渲染 ====================

    render(ctx, camera) {
        if (!this.isActive) return;
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        const screenY = this.position.y - renderPos.y;

        ctx.save();

        // ---- 有图片时渲染图片 ----
        if (this.image) {
            // 图片半透明背景（柔和光晕）
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = 'rgba(120, 200, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(screenX, screenY, 28, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            // 绘制图片
            const imgW = this.imageWidth || this.image.width || 48;
            const imgH = this.imageHeight || this.image.height || 48;
            ctx.drawImage(this.image, screenX - imgW / 2, screenY - imgH / 2, imgW, imgH);
            ctx.restore();
            return;
        }

        // ---- 无图片：回退到木牌渲染 ----
        const poleWidth = 6;
        const poleHeight = 40;
        const poleX = screenX - poleWidth / 2;
        const poleY = screenY - poleHeight;
        const poleGrad = ctx.createLinearGradient(poleX, 0, poleX + poleWidth, 0);
        poleGrad.addColorStop(0, '#8B5E3C');
        poleGrad.addColorStop(0.5, '#A0764A');
        poleGrad.addColorStop(1, '#6D4226');
        ctx.fillStyle = poleGrad;
        ctx.fillRect(poleX, poleY, poleWidth, poleHeight);

        // ---- 指示牌（木板） ----
        const boardWidth = 64;
        const boardHeight = 24;
        const boardX = screenX - boardWidth / 2;
        const boardY = screenY - poleHeight - boardHeight + 4;
        ctx.fillStyle = '#C4956A';
        ctx.strokeStyle = '#8B5E3C';
        ctx.lineWidth = 2;
        this._roundRect(ctx, boardX, boardY, boardWidth, boardHeight, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#D4A574';
        this._roundRect(ctx, boardX + 3, boardY + 2, boardWidth - 6, boardHeight / 2 - 2, 3);
        ctx.fill();

        // ---- 牌面文字 ----
        ctx.fillStyle = '#3E2723';
        ctx.font = 'bold 11px Microsoft YaHei, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, screenX, boardY + boardHeight / 2);
        ctx.restore();
    }

    renderPrompt(ctx, camera) {
        if (!this.isActive) return;
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        const baseY = this.position.y - renderPos.y;
        // 有图片时提示在图片上方，无图片时提示在牌子上方
        const offsetY = this.image ? 36 : 40 + 24 - 4 + 6;
        const promptY = baseY - offsetY;
        const fullText = `按 E 键${this.promptText}`;

        ctx.save();
        ctx.font = '13px Microsoft YaHei';
        const textWidth = ctx.measureText(fullText).width;
        const px = screenX - textWidth / 2 - 10;
        const py = promptY - 14;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this._roundRect(ctx, px, py, textWidth + 20, 24, 6);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fullText, screenX, py + 12);
        ctx.restore();
    }

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }
}