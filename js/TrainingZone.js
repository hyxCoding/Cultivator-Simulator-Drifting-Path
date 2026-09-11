/**
 * 训练区目标（地面标记）
 * 每个标记代表一个教学步骤，玩家在附近执行指定动作即可完成
 */
class TrainingZone {
    /**
     * @param {Object} config
     * @param {string} config.id - 唯一ID
     * @param {string} config.name - 显示名称（如"普通攻击"）
     * @param {Object} config.position - 世界坐标 {x, y}
     * @param {string} config.actionType - 动作类型：'attack', 'skill_lingxidan', 'skill_hutishu', 'dodge'
     * @param {string} config.promptText - 提示文本
     * @param {string} config.actionKey - 触发按键：'j' | 'u' | 'i' | 'l'
     * @param {number} config.radius - 绘制半径，默认55
     * @param {number} config.detectRadius - 判定半径，默认同绘制半径
     */
    constructor(config = {}) {
        this.id = config.id || `training_${Date.now()}`;
        this.name = config.name || '训练目标';
        this.position = config.position || { x: 0, y: 0 };
        this.actionType = config.actionType || 'attack';
        this.promptText = config.promptText || '按 J 攻击';
        this.actionKey = config.actionKey || 'j';
        this.radius = config.radius || 55;
        this.detectRadius = config.detectRadius || this.radius;

        this.isCompleted = false;
        this.isVisible = true;

        // 浮动动画
        this.floatPhase = Math.random() * Math.PI * 2;
        this.floatSpeed = 1.2;
        this.floatAmplitude = 3;
        this.glowTimer = 0;
        this.glowSpeed = 1.8;

        // 颜色配置
        this.colors = {
            attack:     { primary: '#ef4444', secondary: '#fca5a5', glow: 'rgba(239,68,68,0.3)' },
            skill_lingxidan: { primary: '#3b82f6', secondary: '#93c5fd', glow: 'rgba(59,130,246,0.3)' },
            skill_hutishu:   { primary: '#22c55e', secondary: '#86efac', glow: 'rgba(34,197,94,0.3)' },
            dodge:     { primary: '#a855f7', secondary: '#d8b4fe', glow: 'rgba(168,85,247,0.3)' },
        };
        const colorSet = this.colors[this.actionType] || this.colors.attack;
        this.colorPrimary = colorSet.primary;
        this.colorSecondary = colorSet.secondary;
        this.colorGlow = colorSet.glow;
    }

    update(deltaTime) {
        if (this.isCompleted || !this.isVisible) return;
        this.floatPhase += deltaTime * this.floatSpeed;
        this.glowTimer += deltaTime * this.glowSpeed;
    }

    render(ctx, camera) {
        if (this.isCompleted || !this.isVisible) return;
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        const screenY = this.position.y - renderPos.y + Math.sin(this.floatPhase) * this.floatAmplitude;

        // 外发光脉动
        const glowRadius = this.radius + Math.sin(this.glowTimer) * 8;
        const gradient = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, glowRadius);
        gradient.addColorStop(0, this.colorGlow);
        gradient.addColorStop(0.5, this.colorGlow.replace('0.3', '0.1'));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 地面标记圆环
        ctx.save();
        ctx.strokeStyle = this.colorPrimary;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 内部填充（半透明）
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = this.colorPrimary;
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 标签
        ctx.font = 'bold 15px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(this.name, screenX, screenY);
        ctx.shadowBlur = 0;

        // 完成勾
        if (this.isCompleted) {
            ctx.fillStyle = this.colorPrimary;
            ctx.font = 'bold 20px Microsoft YaHei';
            ctx.fillText('✓', screenX + 30, screenY - 15);
        }
    }

    renderPrompt(ctx, camera) {
        if (this.isCompleted || !this.isVisible) return;
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        const screenY = this.position.y - renderPos.y - this.radius - 20;

        ctx.font = '13px Microsoft YaHei';
        const textWidth = ctx.measureText(this.promptText).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        const px = screenX - textWidth / 2 - 10;
        const py = screenY - 12;
        ctx.beginPath();
        ctx.roundRect(px, py, textWidth + 20, 24, 6);
        ctx.fill();
        ctx.fillStyle = this.colorSecondary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.promptText, screenX, screenY);
    }

    /**
     * 检查玩家是否在范围内（使用判定半径 detectRadius）
     */
    isPlayerInRange(playerPosition) {
        if (this.isCompleted || !this.isVisible) return false;
        const dx = this.position.x - playerPosition.x;
        const dy = this.position.y - playerPosition.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.detectRadius;
    }

    /**
     * 标记为完成
     */
    complete() {
        if (this.isCompleted) return false;
        this.isCompleted = true;
        return true;
    }

    serialize() {
        return {
            id: this.id,
            position: { ...this.position },
            isCompleted: this.isCompleted,
            isVisible: this.isVisible,
            actionType: this.actionType,
        };
    }

    deserialize(data) {
        if (!data) return;
        this.isCompleted = data.isCompleted || false;
        this.isVisible = data.isVisible !== undefined ? data.isVisible : true;
    }
}

if (typeof window !== 'undefined') window.TrainingZone = TrainingZone;