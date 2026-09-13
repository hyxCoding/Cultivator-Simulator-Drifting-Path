/**
 * 地图区域按钮类
 * 专门用于地图传送界面
 * 悬停时图片上移，不改变逻辑位置
 */
class MapAreaButton {
    /**
     * @param {Object} config - 按钮配置
     * @param {string} config.id - 按钮ID
     * @param {number} config.x - 按钮x坐标（逻辑位置，不变）
     * @param {number} config.y - 按钮y坐标（逻辑位置，不变）
     * @param {number} config.width - 按钮宽度
     * @param {number} config.height - 按钮高度
     * @param {Image} config.image - 按钮图标
     * @param {Image} config.hoverImage - 悬停图标（可选）
     * @param {Image} config.disabledImage - 禁用图标（可选）
     * @param {boolean} config.enabled - 是否可点击
     * @param {boolean} config.visible - 是否可见
     * @param {Function} config.callback - 点击回调
     * @param {Object} config.hoverOffset - 悬停偏移 {x, y}，默认 {x: 0, y: -8}
     * @param {number} config.hoverTransitionSpeed - 悬停过渡速度
     * @param {string} config.areaName - 区域名称
     */
    constructor(config = {}) {
        // ========== 基本信息 ==========
        this.id = config.id || `area_btn_${Date.now()}`;
        this.areaName = config.areaName || this.id;
        this.targetMapId = config.targetMapId || null;

        // ========== 中心坐标（用户配置时使用） ==========
        this.centerX = config.x || 0;   // 按钮中心x坐标
        this.centerY = config.y || 0;   // 按钮中心y坐标
        this.width = config.width || 80;
        this.height = config.height || 80;
        
        // ========== 左上角坐标（内部计算使用） ==========
        this.x = this.centerX - this.width / 2;   // 左上角x = 中心x - 宽度/2
        this.y = this.centerY - this.height / 2;  // 左上角y = 中心y - 高度/2
        
        // ========== 渲染位置（随悬停偏移改变） ==========
        this.renderX = this.x;
        this.renderY = this.y;
        
        // ========== 悬停偏移 ==========
        this.hoverOffset = config.hoverOffset || { x: 0, y: -8 };
        this.hoverTransitionSpeed = config.hoverTransitionSpeed || 8;
        this.currentOffsetX = 0;
        this.currentOffsetY = 0;
        
        // ========== 图片 ==========
        this.image = config.image || null;
        this.hoverImage = config.hoverImage || null;
        this.disabledImage = config.disabledImage || null;
        
        // ========== 回调 ==========
        this.callback = config.callback || null;
        this.onHoverEnter = config.onHoverEnter || null;
        this.onHoverExit = config.onHoverExit || null;
        
        // ========== 状态 ==========
        this.isHovered = false;
        this.isPressed = false;
        this.isEnabled = config.enabled !== undefined ? config.enabled : true;
        this.isVisible = config.visible !== undefined ? config.visible : true;
        
        // ========== 悬停提示文字 ==========
        this.showTooltip = config.showTooltip !== undefined ? config.showTooltip : true;
        this.tooltipTimer = 0;
        this.tooltipDelay = 0.3; // 悬停多久后显示提示
    }

    /**
     * 检查点是否在按钮内（使用逻辑位置）
     * @param {number} px - 鼠标x坐标
     * @param {number} py - 鼠标y坐标
     * @returns {boolean} 是否在按钮内
     */
    containsPoint(px, py) {
        return px >= this.centerX - this.width / 2 &&
               px <= this.centerX + this.width / 2 &&
               py >= this.centerY - this.height / 2 &&
               py <= this.centerY + this.height / 2;
    }

    /**
     * 更新按钮
     * @param {number} mouseX - 鼠标x坐标
     * @param {number} mouseY - 鼠标y坐标
     * @param {boolean} mousePressed - 鼠标是否按下
     * @param {boolean} mouseClicked - 本帧是否点击
     * @param {number} deltaTime - 时间增量（秒）
     */
    update(mouseX, mouseY, mousePressed, mouseClicked, deltaTime = 0.016) {
        if (!this.isVisible) {
            this.isHovered = false;
            this.isPressed = false;
            return;
        }
        
        const wasHovered = this.isHovered;
        const isInside = this.containsPoint(mouseX, mouseY);
        
        // 更新悬停状态（禁用按钮也可以悬停显示提示）
        this.isHovered = isInside;
        
        // 悬停状态变化回调
        if (isInside && !wasHovered && this.onHoverEnter) {
            this.onHoverEnter(this);
        }
        if (!isInside && wasHovered && this.onHoverExit) {
            this.onHoverExit(this);
        }

        // 鼠标滑过按钮音效（每次放到按钮上播一次；禁用按钮也可悬停 → 同样出声）
        if (isInside && !wasHovered) {
            gameAudio.playSfx('sfx.ui_hover');
        }
        
        // 提示计时器
        if (this.isHovered) {
            this.tooltipTimer += deltaTime;
        } else {
            this.tooltipTimer = 0;
        }
        
        // 更新按下状态（仅可用按钮）
        if (this.isEnabled) {
            if (isInside && mousePressed) {
                this.isPressed = true;
            } else {
                this.isPressed = false;
            }
            
            // 点击处理
            if (isInside && mouseClicked) {
                // 按钮点击音效（所有按钮通用）
                gameAudio.playSfx('sfx.ui_click');
                if (this.callback) {
                    this.callback(this);
                }
            }
        } else {
            this.isPressed = false;
        }
        
        // 更新悬停偏移动画
        this.updateHoverAnimation(deltaTime);
    }

    /**
     * 更新悬停动画
     */
    updateHoverAnimation(deltaTime) {
        const targetOffsetX = this.isHovered ? this.hoverOffset.x : 0;
        const targetOffsetY = this.isHovered ? this.hoverOffset.y : 0;
        
        // 平滑过渡
        const lerpFactor = Math.min(1, this.hoverTransitionSpeed * deltaTime);
        this.currentOffsetX += (targetOffsetX - this.currentOffsetX) * lerpFactor;
        this.currentOffsetY += (targetOffsetY - this.currentOffsetY) * lerpFactor;
        
        // 更新渲染位置（逻辑位置不变）
        this.renderX = this.x + this.currentOffsetX;
        this.renderY = this.y + this.currentOffsetY;
    }

    /**
     * 渲染按钮
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isVisible) return;
        
        ctx.save();
        
        // 不可用按钮降低透明度
        if (!this.isEnabled) {
            ctx.globalAlpha = 0.5;
        }
        
        // 选择绘制图片
        let drawImage = this.image;
        
        if (!this.isEnabled && this.disabledImage) {
            drawImage = this.disabledImage;
        } else if (this.isHovered && this.hoverImage) {
            drawImage = this.hoverImage;
        }
        
        // 绘制按钮
        if (drawImage) {
            ctx.drawImage(
                drawImage,
                this.renderX,
                this.renderY,
                this.width,
                this.height
            );
        } else {
            // 无图片时绘制默认按钮
            this.renderDefaultButton(ctx);
        }
        
        // 按下效果
        if (this.isPressed) {
            ctx.globalAlpha = 0.8;
        }
        
        ctx.restore();
        
        // 渲染悬停提示
        if (this.isHovered && this.showTooltip && 
            this.tooltipTimer >= this.tooltipDelay) {
            this.renderTooltip(ctx);
        }
    }

    /**
     * 渲染默认按钮（无图片时）
     */
    renderDefaultButton(ctx) {
        // 按钮背景
        ctx.fillStyle = this.isHovered ? 'rgba(255, 200, 100, 0.9)' : 'rgba(200, 160, 100, 0.7)';
        ctx.fillRect(this.renderX, this.renderY, this.width, this.height);
        
        // 边框
        ctx.strokeStyle = this.isEnabled ? '#ffffff' : '#888888';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.renderX, this.renderY, this.width, this.height);
        
        // 区域名称
        if (this.areaName) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                this.areaName,
                this.renderX + this.width / 2,
                this.renderY + this.height / 2
            );
        }
    }

    /**
     * 渲染悬停提示
     */
    renderTooltip(ctx) {
        const tooltipText = this.areaName || this.id;
        const lockedText = this.isEnabled ? '' : '（未解锁）';
        const fullText = `${tooltipText}${lockedText}`;
        
        ctx.save();
        
        // 测量文字宽度
        ctx.font = '14px Microsoft YaHei';
        const textWidth = ctx.measureText(fullText).width;
        
        // 提示框位置
        const tooltipX = this.x + this.width / 2 - textWidth / 2 - 10;
        const tooltipY = this.y - 35;
        const tooltipWidth = textWidth + 20;
        const tooltipHeight = 25;
        
        // 提示框背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // 提示框边框
        ctx.strokeStyle = this.isEnabled ? '#FFD700' : '#888888';
        ctx.lineWidth = 1;
        ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // 提示文字
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            fullText,
            tooltipX + tooltipWidth / 2,
            tooltipY + tooltipHeight / 2
        );
        
        ctx.restore();
    }

    /**
     * 设置回调
     */
    setCallback(callback) {
        this.callback = callback;
    }

    /**
     * 设置可用状态
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    /**
     * 设置可见状态
     */
    setVisible(visible) {
        this.isVisible = visible;
    }

    /**
     * 设置按钮图标
     * @param {Image} image - 按钮图标
     */
    setImage(image) {
        this.image = image;
    }

    /**
     * 设置悬停图标
     */
    setHoverImage(image) {
        this.hoverImage = image;
    }

    /**
     * 设置禁用图标
     */
    setDisabledImage(image) {
        this.disabledImage = image;
    }

    /**
     * 序列化按钮状态（用于存档）
     */
    serialize() {
        return {
            id: this.id,
            centerX: this.centerX,   // ← 保存中心坐标
            centerY: this.centerY,   // ← 保存中心坐标
            width: this.width,
            height: this.height,
            isEnabled: this.isEnabled,
            isVisible: this.isVisible,
            targetMapId: this.targetMapId,
            areaName: this.areaName,
        };
    }

    /**
     * 反序列化按钮状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.id = data.id || this.id;
        this.centerX = data.centerX || this.centerX;   // ← 恢复中心坐标
        this.centerY = data.centerY || this.centerY;   // ← 恢复中心坐标
        this.width = data.width || this.width;
        this.height = data.height || this.height;
        this.isEnabled = data.isEnabled !== undefined ? data.isEnabled : this.isEnabled;
        this.isVisible = data.isVisible !== undefined ? data.isVisible : this.isVisible;
        this.targetMapId = data.targetMapId || this.targetMapId;
        this.areaName = data.areaName || this.areaName;
        
        // 重新计算左上角坐标
        this.x = this.centerX - this.width / 2;
        this.y = this.centerY - this.height / 2;
        this.renderX = this.x;
        this.renderY = this.y;
    }
}
