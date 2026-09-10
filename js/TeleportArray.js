/**
 * 传送法阵类
 * 用于地图中的交互型传送门，靠近后按 E 触发地图切换
 */
class TeleportArray {
    constructor(config = {}) {
        this.id = config.id || `teleport_${Date.now()}`;
        this.name = config.name || '传送法阵';

        this.position = config.position || { x: 0, y: 0 };
        this.width = config.width || 40;
        this.height = config.height || 40;
        this.radius = config.radius || 60;

        this.targetMapId = config.targetMapId || null;
        this.targetPosition = config.targetPosition || { x: 0, y: 0 };
        this.promptText = config.promptText || '按 E 进入法阵';

        this.color = config.color || 'rgba(120, 200, 255, 0.9)';
        this.glowColor = config.glowColor || 'rgba(120, 200, 255, 0.4)';
        this.isActive = config.isActive !== false;
        this.rotation = 0;
    }

    /**
     * 检查玩家是否靠近法阵
     * @param {Object} playerPosition - 玩家位置 {x, y}
     * @returns {boolean}
     */
    isNearby(playerPosition) {
        if (!playerPosition) return false;
        const dx = this.position.x - playerPosition.x;
        const dy = this.position.y - playerPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.radius;
    }

    /**
     * 更新法阵动画
     */
    update(deltaTime) {
        if (!this.isActive) return;
        this.rotation += deltaTime * 2.5;
    }

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
        this.isActive = data.isActive !== undefined ? data.isActive : this.isActive;
    }
}
