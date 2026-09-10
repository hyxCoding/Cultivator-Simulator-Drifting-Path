/**
 * 对话框类
 * 用于显示对话内容，将字符串规整地填充在背景图中
 * 支持从左到右、从上到下排列文字
 */
class DialogBox {
    /**
     * @param {Object} config - 对话框配置
     * @param {number} config.x - 对话框x坐标
     * @param {number} config.y - 对话框y坐标
     * @param {number} config.width - 对话框宽度
     * @param {number} config.height - 对话框高度
     * @param {Image} config.backgroundImage - 背景图片
     * @param {Object} config.padding - 内边距 {top, right, bottom, left}
     * @param {string} config.font - 字体样式
     * @param {number} config.fontSize - 字体大小
     * @param {string} config.textColor - 文字颜色
     * @param {number} config.lineHeight - 行高
     */
    constructor(config = {}) {
        // ========== 位置与尺寸 ==========
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.width = config.width || 600;
        this.height = config.height || 200;
        
        // ========== 背景图片 ==========
        this.backgroundImage = config.backgroundImage || null;
        
        // ========== 文字样式 ==========
        this.padding = config.padding || { top: 20, right: 30, bottom: 20, left: 30 };
        this.font = config.font || 'Microsoft YaHei, sans-serif';
        this.fontSize = config.fontSize || 16;
        this.textColor = config.textColor || '#333333';
        this.lineHeight = config.lineHeight || this.fontSize * 1.5;
        
        // ========== 内容 ==========
        this.lines = [];           // 格式化后的文本行
        this.currentText = '';     // 当前显示的完整文本
        this.displayedText = '';   // 当前已显示的文本（用于打字机效果）
        
        // ========== 打字机效果 ==========
        this.typewriterEnabled = config.typewriterEnabled || false;
        this.typewriterSpeed = config.typewriterSpeed || 30; // 字符/秒
        this.typewriterTimer = 0;
        this.isTyping = false;
        
        // ========== 状态 ==========
        this.isVisible = false;
        this.isActive = false;
        this.showSpeaker = config.showSpeaker || false; // 是否显示说话者名字
        this.speakerName = '';
        
        // ========== 按钮 ==========
        this.buttons = []; // 对话选项按钮
        
        // ========== 回调 ==========
        this.onTextComplete = null;   // 文字显示完成回调
        this.onAdvance = null;        // 推进对话回调
    }

    /**
     * 设置对话内容
     * @param {string} text - 对话内容
     * @param {string} speakerName - 说话者名称（可选）
     */
    setText(text, speakerName = '') {
        this.currentText = text || '';
        this.displayedText = '';
        this.speakerName = speakerName;
        this.typewriterTimer = 0;
        
        if (this.typewriterEnabled) {
            this.isTyping = true;
        } else {
            this.displayedText = this.currentText;
            this.isTyping = false;
        }
        
        this.formatText(this.displayedText);
    }

    /**
     * 设置完整文本并立即显示
     */
    setTextImmediate(text, speakerName = '') {
        this.currentText = text || '';
        this.displayedText = this.currentText;
        this.speakerName = speakerName;
        this.isTyping = false;
        
        this.formatText(this.displayedText);
    }

    /**
     * 立即完成打字机效果
     */
    completeTypewriter() {
        if (this.isTyping) {
            this.displayedText = this.currentText;
            this.isTyping = false;
            this.formatText(this.displayedText);
            
            if (this.onTextComplete) {
                this.onTextComplete();
            }
        }
    }

    /**
     * 格式化文本
     * 将字符串按宽度自动换行，从左到右、从上到下排列
     * @param {string} text - 要格式化的文本
     */
    formatText(text) {
        this.lines = [];
        
        if (!text) return;
        
        const ctx = this.getMeasureContext();
        ctx.font = `${this.fontSize}px ${this.font}`;
        
        const maxWidth = this.width - this.padding.left - this.padding.right;
        let currentLine = '';
        
        // 按字符逐个处理
        for (const char of text) {
            // 处理换行符
            if (char === '\n') {
                this.lines.push(currentLine);
                currentLine = '';
                continue;
            }
            
            // 检查是否超宽
            const testLine = currentLine + char;
            const testWidth = ctx.measureText(testLine).width;
            
            if (testWidth > maxWidth && currentLine.length > 0) {
                this.lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        
        // 最后一行
        if (currentLine) {
            this.lines.push(currentLine);
        }
    }

    /**
     * 获取用于测量文字的上下文
     */
    getMeasureContext() {
        if (!DialogBox.measureCtx) {
            const canvas = document.createElement('canvas');
            DialogBox.measureCtx = canvas.getContext('2d');
        }
        return DialogBox.measureCtx;
    }

    /**
     * 更新对话框
     * @param {number} deltaTime - 时间增量（秒）
     */
    update(deltaTime) {
        if (!this.isVisible) return;
        
        // 打字机效果
        if (this.isTyping) {
            this.typewriterTimer += deltaTime;
            
            const charsToShow = Math.floor(this.typewriterTimer * this.typewriterSpeed);
            
            if (charsToShow >= this.currentText.length) {
                this.displayedText = this.currentText;
                this.isTyping = false;
                
                if (this.onTextComplete) {
                    this.onTextComplete();
                }
            } else {
                this.displayedText = this.currentText.substring(0, charsToShow);
            }
            
            this.formatText(this.displayedText);
        }
        
        // 更新选项按钮
        this.buttons.forEach(button => {
            button.update(0, 0, false, false, deltaTime); // 按钮位置由外部管理
        });
    }

    /**
     * 渲染对话框
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isVisible) return;
        
        ctx.save();
        
        // 绘制背景
        if (this.backgroundImage) {
            ctx.drawImage(
                this.backgroundImage,
                this.x,
                this.y,
                this.width,
                this.height
            );
        } else {
            this.renderDefaultBackground(ctx);
        }
        
        // 绘制说话者名称
        let textStartY = this.y + this.padding.top;
        
        if (this.showSpeaker && this.speakerName) {
            ctx.font = `bold ${this.fontSize * 1.1}px ${this.font}`;
            ctx.fillStyle = '#8B4513';
            ctx.textAlign = 'left';
            ctx.fillText(
                this.speakerName,
                this.x + this.padding.left,
                textStartY
            );
            textStartY += this.lineHeight * 1.5;
        }
        
        // 绘制文本
        ctx.font = `${this.fontSize}px ${this.font}`;
        ctx.fillStyle = this.textColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        this.lines.forEach((line, index) => {
            const lineY = textStartY + index * this.lineHeight;
            ctx.fillText(
                line,
                this.x + this.padding.left,
                lineY
            );
        });
        
        // 渲染选项按钮
        this.buttons.forEach(button => {
            button.render(ctx);
        });
        
        // 绘制提示箭头（如果打字机完成）
        if (!this.isTyping && this.lines.length > 0) {
            this.renderAdvanceIndicator(ctx);
        }
        
        ctx.restore();
    }

    /**
     * 渲染默认背景（无图片时）
     */
    renderDefaultBackground(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    /**
     * 渲染推进提示箭头
     */
    renderAdvanceIndicator(ctx) {
        const arrowX = this.x + this.width - this.padding.right - 10;
        const arrowY = this.y + this.height - this.padding.bottom - 10;
        
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(arrowX - 5, arrowY);
        ctx.lineTo(arrowX + 5, arrowY);
        ctx.lineTo(arrowX, arrowY + 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /**
     * 添加选项按钮
     * @param {UIButton} button - 按钮实例
     */
    addOptionButton(button) {
        this.buttons.push(button);
    }

    /**
     * 清除选项按钮
     */
    clearOptionButtons() {
        this.buttons = [];
    }

    /**
     * 显示对话框
     */
    show() {
        this.isVisible = true;
        this.isActive = true;
    }

    /**
     * 隐藏对话框
     */
    hide() {
        console.log('[调试] hide 被调用');
        this.isVisible = false;
        this.isActive = false;
        this.isTyping = false;
        this.clearOptionButtons();
    }

    /**
     * 推进对话（点击或按键时调用）
     */
    advance() {
        if (this.isTyping) {
            this.completeTypewriter();
        } else if (this.onAdvance) {
            this.onAdvance();
        }
    }

    /**
     * 序列化对话框状态（用于存档）
     */
    serialize() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            isVisible: this.isVisible,
            isActive: this.isActive,
            currentText: this.currentText,
            displayedText: this.displayedText,
            speakerName: this.speakerName,
            lines: [...this.lines],
        };
    }

    /**
     * 反序列化对话框状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.x = data.x || this.x;
        this.y = data.y || this.y;
        this.width = data.width || this.width;
        this.height = data.height || this.height;
        this.isVisible = data.isVisible || false;
        this.isActive = data.isActive || false;
        this.currentText = data.currentText || '';
        this.displayedText = data.displayedText || '';
        this.speakerName = data.speakerName || '';
        this.lines = data.lines || [];
    }
}

// 静态测量上下文
DialogBox.measureCtx = null;