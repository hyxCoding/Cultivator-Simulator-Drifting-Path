/**
 * 传送法阵类（TeleportArray）
 *
 * 地图上的交互型传送阵：玩家靠近后按 E 键触发地图切换。
 *
 * 特性：
 * - 支持图片（ResourceManager 资源键，默认 96×96）。图片为静态图，不旋转；
 *   图片缺失/加载失败时回退到程序化绘制的环形法阵（保留缓慢旋转，便于识别）。
 * - 支持任务门控（config.questRequired）：任务未接取（locked）时法阵不显示，
 *   也不会被 Player 的交互检测命中；任务接取后由 updateQuestGate 刷新为可见。
 *   （主线四《山口不止风》的传送法阵即在接取 chapter1_main_4 后才出现）
 * - 支持目标门控（config.requireObjective = { type, target }，与 js/Signpost.js 同一套语义）：
 *   还要 questRequired 任务的该目标已完成，法阵才显示。例：第二章云渡泽的万灯台石台法阵
 *   除了要接取 chapter2_main_4，还必须先完成 talk_to:xulu（向许录取得万灯台通行凭证）
 *   —— 否则玩家能跳过「拿凭证」那一步直接登台。
 *   目标完成的瞬间由 Main.onQuestProgress → updateTeleportQuestGates → updateQuestGate 刷新。
 * - 支持 bossArena 标记：标记为 true 时由 Main 走“战场”流程
 *   （记录返回点，战败后落回法阵旁；胜利后在战场正中心生成归途法阵，按 E 回到同一落点）。
 *   战场内的归途法阵由 GameMap.createArenaExitArray 动态生成（bossArena=false，走普通换图流程）。
 *
 * 坐标约定：position 为世界坐标（像素）。配置中 teleporters 的
 * position（瓦片坐标）与 worldPosition（世界坐标，像素）由 GameMap 统一换算。
 */
class TeleportArray {
    /**
     * @param {Object}  config
     * @param {string}  config.id             - 唯一 ID
     * @param {string}  config.name           - 显示名称（如“传送法阵”）
     * @param {Object}  config.position       - 世界坐标（像素）{x, y}（图片中心）
     * @param {number}  config.radius         - 交互半径，默认 60
     * @param {string}  config.targetMapId    - 目标地图 ID
     * @param {Object}  config.targetPosition - 目标地图中的落点（世界坐标，像素）
     * @param {string}  config.promptText     - 交互提示文本（完整文本，如“按 E 进入boss战斗”）
     * @param {string}  config.image          - ResourceManager 图片键（可选），如 'teleportArrays.boss_enter'
     * @param {number}  config.imageWidth     - 图片显示宽度，默认 96
     * @param {number}  config.imageHeight    - 图片显示高度，默认 96
     * @param {string}  config.anchor         - 图片对齐方式：'center'（默认，中心对齐）/ 'bottom'
     * @param {string}  config.questRequired  - 需要的任务 ID（可选），任务未接取时法阵隐藏
     * @param {Object}  config.requireObjective - 目标门控（可选）{ type, target }：
     *                 需 questRequired 任务的该目标也已完成，法阵才显示（与 Signpost 同一套语义）
     * @param {boolean} config.bossArena      - 是否为主角战场入口（默认 false）
     * @param {string}  config.color          - 程序化法阵颜色（图片缺失时使用）
     * @param {string}  config.glowColor      - 程序化法阵光晕颜色
     * @param {boolean} config.isActive       - 初始是否可见（默认 true，由 updateQuestGate 控制）
     */
    constructor(config = {}) {
        this.id = config.id || `teleport_${Date.now()}`;
        this.name = config.name || '传送法阵';

        this.position = {
            x: config.position?.x ?? 0,
            y: config.position?.y ?? 0,
        };
        this.width = config.width || 40;
        this.height = config.height || 40;
        this.radius = config.radius || 60;

        this.targetMapId = config.targetMapId || null;
        this.targetPosition = config.targetPosition || { x: 0, y: 0 };
        this.promptText = config.promptText || '按 E 进入法阵';

        this.color = config.color || 'rgba(120, 200, 255, 0.9)';
        this.glowColor = config.glowColor || 'rgba(120, 200, 255, 0.4)';

        // 图片（静态，96×96）
        this.imageKey = config.image || null;
        this.imageWidth = config.imageWidth || 96;
        this.imageHeight = config.imageHeight || 96;
        this.anchor = config.anchor === 'bottom' ? 'bottom' : 'center';
        this.image = null;

        // 任务门控
        this.questRequired = config.questRequired || null;
        // 目标门控（可选）：{ type, target } —— 任务接取 + 指定目标已完成，法阵才可见
        this.requireObjective = config.requireObjective || null;

        // 战场入口标记（主线四）
        this.bossArena = config.bossArena === true;

        // 战场流程参数（由地图配置透传；Main.enterBossArena 读取，缺省时回落到第一章默认值）
        //   arenaDefeatFlag     —— 击败后写入的剧情标记（决定再次进场是否再生成 Boss）
        //   arenaVictory        —— 胜利要推进的任务目标 { questId, type, target }
        //   arenaResourceGroup  —— 进场预加载 / 清场释放用的资源分组名
        //   arenaReturnMapId    —— 战败 / 胜利后回到的地图（缺省 = 进场所在地图）
        this.arenaDefeatFlag = config.arenaDefeatFlag || null;
        this.arenaVictory = config.arenaVictory || null;
        this.arenaResourceGroup = config.arenaResourceGroup || null;
        this.arenaReturnMapId = config.arenaReturnMapId || null;

        this.isActive = config.isActive !== false;
        this.rotation = 0;

        this._loadImage();
    }

    // ==================== 资源 ====================

    /**
     * 异步加载法阵图片
     * 说明：ResourceManager 在图片不存在时会返回一张 dataURL 占位图，
     *       检测到占位图（data: 开头）时保持 this.image = null，
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
                // 静默失败，后续回退到程序化法阵渲染
            });
        } catch (e) {
            // 静默失败，后续回退到程序化法阵渲染
        }
    }

    // ==================== 更新 ====================

    /**
     * 根据任务状态控制法阵可见性
     * 任务已接取（active/completed）→ 显示；未接取（locked/未注册）→ 隐藏
     * 另外支持 requireObjective：只有指定任务目标也已完成时才显示
     * @param {Object} questSystem - 任务的 QuestSystem 实例
     */
    updateQuestGate(questSystem) {
        if (!this.questRequired && !this.requireObjective) return;  // 无门控，不做处理
        if (!questSystem) {
            this.isActive = false;
            return;
        }
        const questState = this.questRequired ? questSystem.getQuestState(this.questRequired) : null;
        let visible = this.questRequired
            ? !!(questState && questState.state !== 'locked')
            : true;

        // 目标门控：接取任务还不够，指定目标也得已完成
        // （例：万灯台法阵要先向许录取得通行凭证 —— talk_to:xulu）
        if (visible && this.requireObjective && this.questRequired
            && typeof questSystem.isObjectiveCompleted === 'function') {
            visible = questSystem.isObjectiveCompleted(
                this.questRequired, this.requireObjective.type, this.requireObjective.target
            );
        }

        this.isActive = visible;
    }

    /**
     * 更新法阵动画
     * 使用静态图片时不再旋转（需求：静态图片）
     */
    update(deltaTime) {
        if (!this.isActive || this.image) return;
        this.rotation += deltaTime * 2.5;
    }

    /**
     * 检查玩家是否靠近法阵
     * @param {Object} playerPosition - 玩家位置 {x, y}
     * @returns {boolean}
     */
    isNearby(playerPosition) {
        if (!this.isActive || !playerPosition) return false;
        const dx = this.position.x - playerPosition.x;
        const dy = this.position.y - playerPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.radius;
    }

    // ==================== 渲染 ====================

    /**
     * 渲染法阵
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {Object} camera - 摄像机实例
     */
    render(ctx, camera) {
        if (!this.isActive) return;

        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        const screenY = this.position.y - renderPos.y;

        ctx.save();

        // ---- 地面光晕（图片/程序化共用） ----
        const glowRadius = Math.max(this.radius, this.imageWidth * 0.5);
        const glow = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, glowRadius);
        glow.addColorStop(0, this.glowColor);
        glow.addColorStop(1, 'rgba(120, 200, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, glowRadius, glowRadius * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // ---- 有图片：静态绘制（不旋转） ----
        if (this.image) {
            const imgW = this.imageWidth || this.image.naturalWidth || 96;
            const imgH = this.imageHeight || this.image.naturalHeight || 96;
            const drawX = screenX - imgW / 2;
            const drawY = this.anchor === 'bottom' ? screenY - imgH : screenY - imgH / 2;
            ctx.drawImage(this.image, drawX, drawY, imgW, imgH);
            ctx.restore();
            return;
        }

        // ---- 无图片：程序化法阵（旋转光环） ----
        ctx.translate(screenX, screenY);

        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 12;
        ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.arc(0, 0, this.radius * 0.32, this.rotation, this.rotation + Math.PI * 1.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = 'rgba(120,200,255,0.25)';
        ctx.arc(0, 0, this.radius * 0.18, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * 渲染“按 E …”交互提示（仅法阵可见时显示）
     */
    renderPrompt(ctx, camera) {
        if (!this.isActive) return;

        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        const screenY = this.position.y - renderPos.y;
        const topOffset = this.image
            ? (this.anchor === 'bottom' ? this.imageHeight : this.imageHeight / 2)
            : this.radius * 0.6;
        const promptY = screenY - topOffset - 14;
        const fullText = this.promptText;

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
        ctx.arcTo(x, y + h, x + r, y + h, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    /**
     * 序列化法阵状态
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            position: { ...this.position },
            width: this.width,
            height: this.height,
            radius: this.radius,
            targetMapId: this.targetMapId,
            targetPosition: { ...this.targetPosition },
            promptText: this.promptText,
            isActive: this.isActive,
        };
    }

    /**
     * 反序列化法阵状态
     */
    deserialize(data) {
        if (!data) return;

        this.id = data.id || this.id;
        this.name = data.name || this.name;
        this.position = data.position || this.position;
        this.width = data.width || this.width;
        this.height = data.height || this.height;
        this.radius = data.radius || this.radius;
        this.targetMapId = data.targetMapId || this.targetMapId;
        this.targetPosition = data.targetPosition || this.targetPosition;
        this.promptText = data.promptText || this.promptText;
        this.questRequired = data.questRequired || this.questRequired;
        this.requireObjective = data.requireObjective || this.requireObjective;
        this.isActive = data.isActive !== undefined ? data.isActive : this.isActive;
    }
}

if (typeof window !== 'undefined') window.TeleportArray = TeleportArray;

