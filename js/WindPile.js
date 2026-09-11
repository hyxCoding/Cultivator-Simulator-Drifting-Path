/**
 * 镇风桩类（WindPile）
 *
 * 青岚浮野地图上的固定调查点。
 * - 镇风桩始终显示在地图上（渲染不受任务状态影响）
 * - 只有主线《散落的炊烟》推进到“调查第 N 根镇风桩”这一步时，
 *   玩家靠近该桩才会出现“按 E 调查”提示
 * - 调查过的桩不能重复调查（提示同时隐藏）
 * - 调查会弹出对话框（内容来自配置的 dialogue），对话结束后推进对应的
 *   investigate 任务目标，进而进入下一步任务
 *
 * 与 Signpost 的差异：
 * - 支持每根桩使用各自独立的图片（默认 58×128，image 为 ResourceManager 资源键）
 * - 门控基于任务目标（questId + objectiveType + objectiveTarget），
 *   且只允许调查“当前待完成”的那一根
 * - 图片对齐方式由 config.anchor 决定：'bottom'（默认）以图片底边中心对齐
 *   config.position（桩基立在坐标点上）；'center' 以图片中心对齐 config.position
 * - 若图片缺失或加载失败，回退到程序化渲染，保证地图上依旧可见
 *
 * 复用说明：本类同时是“任务门控调查点”的通用实现。
 * 破损运灯箱（LanternBox）等其它调查点通过继承本类复用门控 / 交互 / 渲染逻辑，
 * 只需覆盖默认贴图尺寸、锚点与 _renderFallback 外观。
 */
class WindPile {
    /**
     * @param {Object}   config
     * @param {string}   config.id              - 唯一 ID
     * @param {string}   config.name            - 显示名称（如“镇风桩一”）
     * @param {Object}   config.position        - 世界坐标（像素）{x, y}，指桩基底部中心
     * @param {number}   config.radius          - 交互半径，默认 56
     * @param {string}   config.promptText      - 提示文本后半部分，例如“调查第一根镇风桩”
     * @param {string}   config.image           - ResourceManager 图片键（可选），如 'windPiles.zhenfeng_pile_1'
     * @param {number}   config.imageWidth      - 图片显示宽度（默认 58）
     * @param {number}   config.imageHeight     - 图片显示高度（默认 128）
     * @param {string}   config.anchor          - 图片对齐方式：'bottom'（默认，底边中心对齐）/ 'center'（图片中心对齐）
     * @param {string}   config.type            - 类型标记（默认 'wind_pile'，子类可覆盖）
     * @param {string}   config.questId         - 关联任务 ID
     * @param {string}   config.objectiveType   - 关联目标类型，默认 'investigate'
     * @param {string}   config.objectiveTarget - 关联目标 target，如 'zhenfeng_pile_1'
     * @param {Object}   config.dialogue        - 调查对话 { text } （text 用 \n 分行）
     */
    constructor(config = {}) {
        this.id = config.id || `wind_pile_${Date.now()}`;
        this.name = config.name || '镇风桩';
        this.position = {
            x: config.position?.x ?? 0,
            y: config.position?.y ?? 0,
        };
        this.radius = config.radius ?? 56;
        this.promptText = config.promptText || '调查镇风桩';

        this.imageKey = config.image || null;
        this.imageWidth = config.imageWidth || 58;
        this.imageHeight = config.imageHeight || 128;
        this.anchor = config.anchor === 'center' ? 'center' : 'bottom';
        this.type = config.type || 'wind_pile';

        // 任务门控信息
        this.questId = config.questId || null;
        this.objectiveType = config.objectiveType || 'investigate';
        this.objectiveTarget = config.objectiveTarget || null;

        // 调查对话内容
        this.dialogue = config.dialogue || null;

        // 状态
        this.isVisible = true;          // 桩体常驻显示
        this.canInvestigate = false;    // 是否处于“当前待调查”状态（由 updateQuestGate 计算）
        this.isInvestigated = false;    // 是否已调查（由任务目标完成情况推导）
        this.glowTimer = Math.random() * Math.PI * 2;

        // 图片（异步加载，缺失时回退程序化渲染）
        this.image = null;
        this._loadImage();
    }

    // ==================== 资源 ====================

    /**
     * 异步加载镇风桩图片
     * 说明：ResourceManager 在图片不存在时会返回一张 dataURL 占位图，
     *       此处检测到占位图（data: 开头）时保持 this.image = null，
     *       由 render() 走程序化兜底渲染，避免地图上出现品红占位块。
     */
    _loadImage() {
        if (!this.imageKey) return;
        try {
            const resourceManager = ResourceManager.getInstance();
            resourceManager.loadImage(this.imageKey).then(img => {
                if (!img) return;
                if (typeof img.src === 'string' && img.src.startsWith('data:')) return;
                this.image = img;
            }).catch(() => {
                // 静默失败，后续回退到程序化石桩渲染
            });
        } catch (e) {
            // 静默失败，后续回退到程序化石桩渲染
        }
    }

    // ==================== 更新 ====================

    update(deltaTime) {
        this.glowTimer += deltaTime * 2;
    }

    /**
     * 根据任务进度刷新“可否调查”状态
     * 规则：
     * - 任务未注册/未接取（locked）或未配置目标 → 不可调查
     * - 该桩对应的 investigate 目标已完成（含任务整体完成）→ 视为已调查，不可再调查
     * - 仅当该桩的目标正好是任务的“当前待完成目标”时，才允许调查
     *   （即接到“调查第一根镇风桩”时只能调查第一根，其余同理）
     * @param {QuestSystem} questSystem - 任务系统实例
     */
    updateQuestGate(questSystem) {
        if (!questSystem || !this.questId || !this.objectiveTarget) {
            this.canInvestigate = false;
            this.isInvestigated = false;
            return;
        }

        // 已调查：目标已完成（任务完成时 isObjectiveCompleted 同样返回 true）
        this.isInvestigated = questSystem.isObjectiveCompleted
            ? questSystem.isObjectiveCompleted(this.questId, this.objectiveType, this.objectiveTarget)
            : false;

        if (this.isInvestigated) {
            this.canInvestigate = false;
            return;
        }

        // 只允许调查“当前待完成”的那一根桩
        this.canInvestigate = questSystem.isObjectiveCurrent
            ? questSystem.isObjectiveCurrent(this.questId, this.objectiveType, this.objectiveTarget)
            : false;
    }

    /**
     * 标记为已调查（对话结束后由 Main 调用）
     */
    markInvestigated() {
        this.isInvestigated = true;
        this.canInvestigate = false;
    }

    /**
     * 获取调查对话数据
     * @returns {Object|null} { text }
     */
    getDialogue() {
        return this.dialogue || null;
    }

    // ==================== 范围检测 ====================

    /**
     * 玩家是否处于可调查范围内
     * @param {Object} playerPosition - 玩家世界坐标 {x, y}
     * @returns {boolean}
     */
    isPlayerInRange(playerPosition) {
        if (!this.isVisible || !this.canInvestigate || this.isInvestigated) return false;
        const dx = this.position.x - playerPosition.x;
        const dy = this.position.y - playerPosition.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }

    // ==================== 渲染 ====================

    /**
     * 锚点（config.position）在屏幕上的 Y 坐标
     * @param {Object} renderPos - 摄像机渲染偏移 {x, y}
     * @returns {number}
     */
    _getAnchorScreenY(renderPos) {
        return this.position.y - (renderPos ? renderPos.y : 0);
    }

    /**
     * 图片顶边所在的屏幕 Y（anchor 为 'center' 时需在锚点基础上上移半张图高）
     * @param {Object} renderPos - 摄像机渲染偏移 {x, y}
     * @returns {number}
     */
    _getImageTopY(renderPos) {
        const anchorY = this._getAnchorScreenY(renderPos);
        return this.anchor === 'center' ? anchorY - this.imageHeight / 2 : anchorY - this.imageHeight;
    }

    render(ctx, camera) {
        if (!this.isVisible) return;

        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        const w = this.imageWidth;
        const h = this.imageHeight;
        // 图片底边所在屏幕 Y：anchor 为 'bottom' 时即锚点本身，'center' 时为锚点下移半张图高
        const anchorY = this._getAnchorScreenY(renderPos);
        const groundY = this.anchor === 'center' ? anchorY + h / 2 : anchorY;   // 桩基 / 箱底

        ctx.save();

        // 地面阴影，让桩体“站”在地上
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(screenX, groundY, w * 0.6, Math.max(4, w * 0.2), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // 可调查时的高亮光晕（脉动）
        if (this.canInvestigate) {
            const centerY = groundY - h * 0.45;
            const glowRadius = w * 1.6 + Math.sin(this.glowTimer) * 4;
            const gradient = ctx.createRadialGradient(screenX, centerY, 2, screenX, centerY, glowRadius);
            gradient.addColorStop(0, 'rgba(255, 226, 130, 0.32)');
            gradient.addColorStop(0.6, 'rgba(255, 226, 130, 0.12)');
            gradient.addColorStop(1, 'rgba(255, 226, 130, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenX, centerY, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 桩体
        if (this.image) {
            ctx.drawImage(this.image, screenX - w / 2, groundY - h, w, h);
        } else {
            this._renderFallback(ctx, screenX, groundY, w, h);
        }

        ctx.restore();
    }

    /**
     * 无图片（或图片加载失败）时的回退渲染：一根刻着引流槽、嵌着黑铁片的石桩
     */
    _renderFallback(ctx, screenX, groundY, w, h) {
        const topY = groundY - h;
        const halfTop = w * 0.32;
        const halfBottom = w * 0.45;

        // 桩身（上窄下宽的梯形）
        const bodyGrad = ctx.createLinearGradient(screenX - halfBottom, 0, screenX + halfBottom, 0);
        bodyGrad.addColorStop(0, '#5C5C63');
        bodyGrad.addColorStop(0.45, '#8A8A93');
        bodyGrad.addColorStop(1, '#494A50');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.moveTo(screenX - halfTop, topY);
        ctx.lineTo(screenX + halfTop, topY);
        ctx.lineTo(screenX + halfBottom, groundY);
        ctx.lineTo(screenX - halfBottom, groundY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(30, 30, 36, 0.85)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 桩顶（受光面）
        ctx.fillStyle = 'rgba(210, 210, 220, 0.55)';
        ctx.beginPath();
        ctx.ellipse(screenX, topY + 1, halfTop, Math.max(2, w * 0.1), 0, 0, Math.PI * 2);
        ctx.fill();

        // 新凿的引流槽（三道斜槽）
        ctx.strokeStyle = this.isInvestigated ? 'rgba(70, 66, 60, 0.55)' : 'rgba(226, 214, 186, 0.75)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            const y1 = topY + h * (0.22 + i * 0.18);
            const y2 = y1 + h * 0.12;
            ctx.beginPath();
            ctx.moveTo(screenX - halfTop * 0.75, y1);
            ctx.lineTo(screenX + halfTop * 0.75, y2);
            ctx.stroke();
        }

        // 嵌入的黑铁片
        ctx.fillStyle = this.isInvestigated ? '#2A2A2E' : '#3B3B44';
        ctx.fillRect(screenX - w * 0.12, topY + h * 0.62, w * 0.24, h * 0.1);
        ctx.strokeStyle = 'rgba(20, 20, 24, 0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX - w * 0.12, topY + h * 0.62, w * 0.24, h * 0.1);

        // 已调查：桩顶浮起一缕散开的引气（淡蓝）
        if (this.isInvestigated) {
            ctx.strokeStyle = 'rgba(150, 210, 235, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(screenX, topY - 6, w * 0.28, Math.PI * 0.15, Math.PI * 0.85);
            ctx.stroke();
        }
    }

    /**
     * 渲染“按 E 调查”提示（仅在自身为当前待调查目标且尚未调查时显示）
     */
    renderPrompt(ctx, camera) {
        if (!this.isVisible || !this.canInvestigate || this.isInvestigated) return;

        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        // 提示条贴在图片顶边之上（anchor 为 'center' 时图片顶边也要相应上移）
        const promptY = this._getImageTopY(renderPos) - 14;
        const fullText = `按 E ${this.promptText}`;

        ctx.save();
        ctx.font = '13px Microsoft YaHei';
        const textWidth = ctx.measureText(fullText).width;
        const px = screenX - textWidth / 2 - 10;
        const py = promptY - 12;
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

    // ==================== 存档 ====================

    serialize() {
        return {
            id: this.id,
            isInvestigated: this.isInvestigated,
        };
    }

    deserialize(data) {
        if (!data) return;
        this.isInvestigated = data.isInvestigated || false;
        if (this.isInvestigated) this.canInvestigate = false;
    }
}

if (typeof window !== 'undefined') window.WindPile = WindPile;
