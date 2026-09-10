/**
 * 可拾取物品类（世界中的任务物品）
 * 玩家靠近并按 E 可拾取，拾取后加入任务物品栏
 */
class PickupItem {
    /**
     * @param {Object} config
     * @param {string} config.id - 唯一ID
     * @param {string} config.itemId - 对应的任务物品ID
     * @param {string} config.name - 显示名称
     * @param {Object} config.position - 世界坐标 {x, y}
     * @param {number} config.radius - 交互半径，默认40
     * @param {string} config.promptText - 交互提示文本
     * @param {number} config.count - 拾取数量，默认1
     * @param {Image} config.image - 显示图片（可选）
     * @param {string} config.questId - 关联任务ID
     * @param {string} config.objectiveType - 关联目标类型
     */
    constructor(config = {}) {
        this.id = config.id || `pickup_${Date.now()}`;
        this.itemId = config.itemId || 'unknown_item';
        this.name = config.name || '未知物品';
        this.position = config.position || { x: 0, y: 0 };
        this.radius = config.radius || 40;
        this.promptText = config.promptText || '按 E 拾取';
        this.count = config.count || 1;
        this.image = config.image || null;
        this.questId = config.questId || null;
        this.objectiveType = config.objectiveType || 'find_item';

        this.isPickedUp = false;
        this.isVisible = true;

        this.floatPhase = Math.random() * Math.PI * 2;
        this.floatSpeed = 1.5;
        this.floatAmplitude = 4;
        this.glowTimer = 0;
        this.glowSpeed = 2;

        this.onPickup = null;
    }
update(deltaTime) {
        if (this.isPickedUp || !this.isVisible) return;
        this.floatPhase += deltaTime * this.floatSpeed;
        this.glowTimer += deltaTime * this.glowSpeed;
    }

    render(ctx, camera) {
        if (this.isPickedUp || !this.isVisible) return;
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        const screenY = this.position.y - renderPos.y + Math.sin(this.floatPhase) * this.floatAmplitude;
        const glowRadius = this.radius + Math.sin(this.glowTimer) * 6;
        const gradient = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, glowRadius);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
        gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        const size = this.radius * 0.8;
        if (this.image) {
            // 按图片原始尺寸绘制，保留清晰度
            const imgW = this.image.naturalWidth || this.image.width || 16;
            const imgH = this.image.naturalHeight || this.image.height || 16;
            // 对过小的图片（如 16×16）以 2 倍显示，确保可见
            const scale = (imgW < 32 || imgH < 32) ? 2 : 1;
            const dispW = imgW * scale;
            const dispH = imgH * scale;
            ctx.drawImage(this.image, screenX - dispW / 2, screenY - dispH / 2, dispW, dispH);
        } else {
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#B8860B';
            ctx.lineWidth = 2;
            ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
            ctx.strokeRect(-size * 0.5, -size * 0.5, size, size);
            ctx.restore();
            ctx.font = '12px Microsoft YaHei';
            ctx.fillStyle = '#FFD700';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(this.name, screenX, screenY - size - 4);
        }
    }

    renderPrompt(ctx, camera) {
        if (this.isPickedUp || !this.isVisible) return;
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        const screenY = this.position.y - renderPos.y - this.radius - 20;
        ctx.font = '13px Microsoft YaHei';
        const textWidth = ctx.measureText(this.promptText).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const px = screenX - textWidth / 2 - 10;
        const py = screenY - 12;
        ctx.beginPath();
        ctx.roundRect(px, py, textWidth + 20, 24, 6);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.promptText, screenX, screenY);
    }

    pickup(questItemSystem, questSystem) {
        if (this.isPickedUp) return false;
        if (questItemSystem) questItemSystem.addItem(this.itemId, this.count);
        if (questSystem && this.questId) {
            questSystem.updateQuestProgress(this.questId, this.objectiveType, this.itemId, this.count);
        }
        this.isPickedUp = true;
        this.isVisible = false;
        console.log(`[PickupItem] 拾取: ${this.name} (${this.itemId})`);
        if (this.onPickup) this.onPickup(this);
        return true;
    }

    isPlayerInRange(playerPosition) {
        if (this.isPickedUp || !this.isVisible) return false;
        const dx = this.position.x - playerPosition.x;
        const dy = this.position.y - playerPosition.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }

    serialize() {
        return { id: this.id, itemId: this.itemId, position: { ...this.position }, isPickedUp: this.isPickedUp, isVisible: this.isVisible };
    }

    deserialize(data) {
        if (!data) return;
        this.isPickedUp = data.isPickedUp || false;
        this.isVisible = data.isVisible !== undefined ? data.isVisible : true;
    }
}

if (typeof window !== 'undefined') window.PickupItem = PickupItem;