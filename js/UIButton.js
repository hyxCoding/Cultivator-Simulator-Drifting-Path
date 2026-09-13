/**
 * UI按钮类
 * 具有位置、尺寸、背景图片和点击回调
 * 支持鼠标悬停时图片上移的选中提示效果
 */
class UIButton {
    /**
     * @param {Object} config - 按钮配置
     * @param {number} config.x - 按钮x坐标（逻辑位置）
     * @param {number} config.y - 按钮y坐标（逻辑位置）
     * @param {number} config.width - 按钮宽度
     * @param {number} config.height - 按钮高度
     * @param {Image} config.backgroundImage - 背景图片
     * @param {Function} config.callback - 点击回调 (button) => void
     * @param {Object} config.hoverOffset - 悬停偏移 {x, y}，默认向上移动5像素
     */
    constructor(config = {}) {
        // ========== 位置与尺寸 ==========
        this.x = config.x || 0;             // 逻辑x坐标
        this.y = config.y || 0;             // 逻辑y坐标
        this.width = config.width || 100;
        this.height = config.height || 40;
        
        // ========== 渲染位置 ==========
        this.renderX = this.x;              // 实际渲染x坐标
        this.renderY = this.y;              // 实际渲染y坐标
        this.hoverOffset = config.hoverOffset || { x: 0, y: -5 }; // 悬停上移偏移
        this.currentOffsetX = 0;   // ← 确保初始化为 0
        this.currentOffsetY = 0;   // ← 确保初始化为 0
        
        // ========== 图片 ==========
        this.backgroundImage = config.backgroundImage || null;
        this.hoverImage = config.hoverImage || null;   // 悬停时显示的图片（可选）
        this.pressedImage = config.pressedImage || null; // 按下时显示的图片（可选）

        // ========== 文本 ==========
        this.text = config.text || '';
        this.font = config.font || 'Microsoft YaHei, sans-serif';
        this.fontSize = config.fontSize || 20;
        this.textColor = config.textColor || '#333333';
        this.textShadowColor = config.textShadowColor || 'rgba(0, 0, 0, 0.5)';
        this.textAlign = config.textAlign || 'center';
        this.textBaseline = config.textBaseline || 'middle';
        
        // ========== 回调 ==========
        this.callback = config.callback || null;         // 点击回调
        this.onHoverEnter = config.onHoverEnter || null; // 悬停进入回调
        this.onHoverExit = config.onHoverExit || null;   // 悬停退出回调
        this.onPressed = config.onPressed || null;       // 按下回调
        
        // ========== 状态 ==========
        this.isHovered = false;
        this.isPressed = false;
        this.isEnabled = config.isEnabled !== undefined ? config.isEnabled : true;
        this.isVisible = config.isVisible !== undefined ? config.isVisible : true;
        
        // ========== 悬停动画 ==========
        this.hoverTransitionSpeed = 10; // 悬停过渡速度
        this.currentOffsetY = 0;        // 当前偏移量
    }

    /**
     * 检查点是否在按钮内
     * @param {number} px - 鼠标x坐标
     * @param {number} py - 鼠标y坐标
     * @returns {boolean} 是否在按钮内
     */
    containsPoint(px, py) {
        // 使用逻辑位置进行碰撞检测（不随悬停偏移改变）
        return px >= this.x &&
               px <= this.x + this.width &&
               py >= this.y &&
               py <= this.y + this.height;
    }

    /**
     * 更新按钮状态
     * @param {number} mouseX - 鼠标x坐标
     * @param {number} mouseY - 鼠标y坐标
     * @param {boolean} mousePressed - 鼠标是否按下
     * @param {boolean} mouseClicked - 本帧是否点击
     * @param {number} deltaTime - 时间增量（秒）
     */
    update(mouseX, mouseY, mousePressed, mouseClicked, deltaTime = 0.016) {
        if (!this.isVisible || !this.isEnabled) {
            this.isHovered = false;
            this.isPressed = false;
            return;
        }
        
        const wasHovered = this.isHovered;
        const isInside = this.containsPoint(mouseX, mouseY);
        
        // 更新悬停状态
        this.isHovered = isInside;
        
        // 悬停状态变化回调
        if (isInside && !wasHovered && this.onHoverEnter) {
            this.onHoverEnter(this);
        }
        if (!isInside && wasHovered && this.onHoverExit) {
            this.onHoverExit(this);
        }

        // 鼠标滑过按钮音效（每次放到按钮上播一次）
        if (isInside && !wasHovered) {
            gameAudio.playSfx('sfx.ui_hover');
        }
        
        // 更新按下状态
        if (isInside && mousePressed) {
            if (!this.isPressed) {
                this.isPressed = true;
                if (this.onPressed) {
                    this.onPressed(this);
                }
            }
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
        
        // 更新悬停偏移动画
        this.updateHoverAnimation(deltaTime);
    }

    /**
     * 更新悬停动画
     */
    updateHoverAnimation(deltaTime) {
        const targetOffsetY = this.isHovered ? this.hoverOffset.y : 0;
        const targetOffsetX = this.isHovered ? this.hoverOffset.x : 0;
        
        // 平滑过渡
        const lerpFactor = Math.min(1, this.hoverTransitionSpeed * deltaTime);
        this.currentOffsetY += (targetOffsetY - this.currentOffsetY) * lerpFactor;
        
        // 更新渲染位置
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
        
        // 设置透明度
        if (!this.isEnabled) {
            ctx.globalAlpha = 0.5;
        }
        
        // 选择要绘制的图片
        let drawImage = this.backgroundImage;
        if (this.isPressed && this.pressedImage) {
            drawImage = this.pressedImage;
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
            // 无图片时绘制默认背景
            this.renderDefaultBackground(ctx);
        }

        if (this.text) {
            this.renderText(ctx);
        }
        
        ctx.restore();
    }

    /**
     * 渲染按钮文字
     */
    renderText(ctx) {
        ctx.save();
        ctx.font = `${this.fontSize}px ${this.font}`;
        ctx.textAlign = this.textAlign;
        ctx.textBaseline = this.textBaseline;
        ctx.fillStyle = this.textColor;

        if (this.textShadowColor) {
            ctx.shadowColor = this.textShadowColor;
            ctx.shadowBlur = 2;
            ctx.shadowOffsetY = 1;
        }

        let x = this.renderX + this.width / 2;
        let y = this.renderY + this.height / 2;

        if (this.textAlign === 'left') {
            x = this.renderX + 12;
        } else if (this.textAlign === 'right') {
            x = this.renderX + this.width - 12;
        }

        if (this.textBaseline === 'top') {
            y = this.renderY + 10;
        } else if (this.textBaseline === 'bottom') {
            y = this.renderY + this.height - 10;
        }

        ctx.fillText(this.text, x, y);
        ctx.restore();
    }

    /**
     * 渲染默认背景（无图片时）
     */
    renderDefaultBackground(ctx) {
        ctx.fillStyle = this.isHovered ? 'rgba(100, 150, 200, 0.8)' : 'rgba(60, 80, 120, 0.6)';
        ctx.fillRect(this.renderX, this.renderY, this.width, this.height);
        
        ctx.strokeStyle = this.isPressed ? '#ffffff' : '#cccccc';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.renderX, this.renderY, this.width, this.height);
    }

    /**
     * 设置按钮位置
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.renderX = x;
        this.renderY = y;
    }

    /**
     * 设置按钮回调
     */
    setCallback(callback) {
        this.callback = callback;
    }

    /**
     * 启用/禁用按钮
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    /**
     * 显示/隐藏按钮
     */
    setVisible(visible) {
        this.isVisible = visible;
    }

    /**
     * 序列化按钮状态（用于存档）
     */
    serialize() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            isEnabled: this.isEnabled,
            isVisible: this.isVisible,
        };
    }

    /**
     * 反序列化按钮状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.setPosition(data.x || this.x, data.y || this.y);
        this.width = data.width || this.width;
        this.height = data.height || this.height;
        this.isEnabled = data.isEnabled !== undefined ? data.isEnabled : this.isEnabled;
        this.isVisible = data.isVisible !== undefined ? data.isVisible : this.isVisible;
    }
}