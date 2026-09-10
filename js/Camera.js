/**
 * 摄像机类
 * 管理游戏世界的视图，支持跟随目标和边界限制
 */
class Camera {
    /**
     * @param {Object} config - 摄像机配置
     * @param {number} config.width - 视口宽度（像素）
     * @param {number} config.height - 视口高度（像素）
     */
    constructor(config = {}) {
        this.x = 0; // 摄像机x坐标（世界坐标）
        this.y = 0; // 摄像机y坐标（世界坐标）
        this.width = config.width || 800;
        this.height = config.height || 600;
        
        // 边界限制
        this.minX = 0;
        this.minY = 0;
        this.maxX = Infinity;
        this.maxY = Infinity;
        
        // 跟随目标
        this.target = null;
        this.followSpeed = 5; // 跟随速度（插值系数）
        
        // 抖动效果
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeTimer = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
    }

    /**
     * 设置摄像机位置
     */
    setPosition(x, y) {
        this.x = this.clampX(x);
        this.y = this.clampY(y);
    }

    /**
     * 设置边界
     */
    setBounds(minX, minY, maxX, maxY) {
        this.minX = minX;
        this.minY = minY;
        this.maxX = maxX;
        this.maxY = maxY;
    }

    /**
     * 设置跟随目标
     */
    setTarget(target) {
        this.target = target;
    }

    /**
     * 更新摄像机
     */
    update(deltaTime) {
        // 跟随目标
        if (this.target && this.target.position) {
            const targetX = this.target.position.x - this.width / 2;
            const targetY = this.target.position.y - this.height / 2;
            
            // 平滑跟随
            const lerpFactor = Math.min(1, this.followSpeed * deltaTime);
            this.x += (targetX - this.x) * lerpFactor;
            this.y += (targetY - this.y) * lerpFactor;
            
            // 边界限制
            this.x = this.clampX(this.x);
            this.y = this.clampY(this.y);
        }
        
        // 更新抖动
        this.updateShake(deltaTime);
    }

    /**
     * 更新抖动效果
     */
    updateShake(deltaTime) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= deltaTime;
            
            if (this.shakeTimer <= 0) {
                this.shakeIntensity = 0;
                this.shakeOffsetX = 0;
                this.shakeOffsetY = 0;
            } else {
                const progress = this.shakeTimer / this.shakeDuration;
                const intensity = this.shakeIntensity * progress;
                this.shakeOffsetX = (Math.random() - 0.5) * intensity * 2;
                this.shakeOffsetY = (Math.random() - 0.5) * intensity * 2;
            }
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
        }
    }

    /**
     * 触发抖动效果
     */
    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeTimer = duration;
    }

    /**
     * 获取实际渲染位置（包含抖动偏移）
     */
    getRenderPosition() {
        return {
            x: this.x + (this.shakeOffsetX || 0),
            y: this.y + (this.shakeOffsetY || 0),
        };
    }

    /**
     * 限制x坐标
     */
    clampX(x) {
        return Math.max(this.minX, Math.min(x, this.maxX));
    }

    /**
     * 限制y坐标
     */
    clampY(y) {
        return Math.max(this.minY, Math.min(y, this.maxY));
    }

    /**
     * 世界坐标转屏幕坐标
     */
    worldToScreen(worldX, worldY) {
        const renderPos = this.getRenderPosition();
        return {
            x: worldX - renderPos.x,
            y: worldY - renderPos.y,
        };
    }

    /**
     * 屏幕坐标转世界坐标
     */
    screenToWorld(screenX, screenY) {
        const renderPos = this.getRenderPosition();
        return {
            x: screenX + renderPos.x,
            y: screenY + renderPos.y,
        };
    }

    /**
     * 检查世界坐标是否在视口内
     */
    isInView(worldX, worldY, margin = 100) {
        const renderPos = this.getRenderPosition();
        return worldX >= renderPos.x - margin &&
               worldX <= renderPos.x + this.width + margin &&
               worldY >= renderPos.y - margin &&
               worldY <= renderPos.y + this.height + margin;
    }

    /**
     * 序列化摄像机状态（用于存档）
     */
    serialize() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
        };
    }

    /**
     * 反序列化摄像机状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.x = data.x || 0;
        this.y = data.y || 0;
        this.width = data.width || this.width;
        this.height = data.height || this.height;
    }
}