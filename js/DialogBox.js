class DialogBox {
    constructor(config = {}) {
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.width = config.width || 600;
        this.height = config.height || 200;
        this.backgroundImage = config.backgroundImage || null;
        this.padding = config.padding || { top: 20, right: 30, bottom: 20, left: 30 };
        this.font = config.font || 'Microsoft YaHei, sans-serif';
        this.fontSize = config.fontSize || 16;
        this.textColor = config.textColor || '#333333';
        this.lineHeight = config.lineHeight || this.fontSize * 1.5;
        this.dialogueLines = [];
        this.currentLineIndex = 0;
        this.currentText = '';
        this.displayedText = '';
        this.currentSpeakerName = '';
        this.typewriterEnabled = config.typewriterEnabled || false;
        this.typewriterSpeed = config.typewriterSpeed || 30;
        this.typewriterTimer = 0;
        this.isTyping = false;
        this.isVisible = false;
        this.isActive = false;
        this.buttons = [];
        this.onTextComplete = null;
        this.onAdvance = null;
    }

    setText(text, speakerName = '') {
        const rawLines = (text || '').split('\n').filter(line => line.trim().length > 0);
        this.dialogueLines = rawLines.map(line => {
            if (line.includes(':')) return line;
            return speakerName + ': ' + line;
        });
        this.currentLineIndex = 0;
        this.displayedText = '';
        this.typewriterTimer = 0;
        this.loadCurrentLine();
    }

    loadCurrentLine() {
        if (this.currentLineIndex < this.dialogueLines.length) {
            this.currentText = this.dialogueLines[this.currentLineIndex];
            this.extractSpeakerFromCurrentLine();
            this.displayedText = '';
            this.typewriterTimer = 0;
            if (this.typewriterEnabled) {
                this.isTyping = true;
            } else {
                this.displayedText = this.currentText;
                this.isTyping = false;
            }
        } else {
            this.currentText = '';
            this.displayedText = '';
            this.isTyping = false;
        }
    }

    extractSpeakerFromCurrentLine() {
        const colonIdx = this.currentText.indexOf(':');
        if (colonIdx > 0) {
            this.currentSpeakerName = this.currentText.substring(0, colonIdx).trim();
        } else {
            this.currentSpeakerName = '';
        }
    }

    completeTypewriter() {
        if (this.isTyping) {
            this.displayedText = this.currentText;
            this.isTyping = false;
            if (this.onTextComplete) this.onTextComplete();
        }
    }

    getCurrentSpeakerDisplay() { return this.currentSpeakerName; }
    hasNextLine() { return this.currentLineIndex < this.dialogueLines.length - 1; }

    advanceLine() {
        if (this.hasNextLine()) {
            this.currentLineIndex++;
            this.loadCurrentLine();
            return true;
        }
        return false;
    }

    getSpeakerColor() {
        const name = this.currentSpeakerName;
        if (name === '旁白' || name === '系统') return '#888888';
        if (name === '主角') return '#FFD700';
        return '#8B4513';
    }

    update(deltaTime) {
        if (!this.isVisible) return;
        if (this.isTyping) {
            this.typewriterTimer += deltaTime;
            const charsToShow = Math.floor(this.typewriterTimer * this.typewriterSpeed);
            if (charsToShow >= this.currentText.length) {
                this.displayedText = this.currentText;
                this.isTyping = false;
                if (this.onTextComplete) this.onTextComplete();
            } else {
                this.displayedText = this.currentText.substring(0, charsToShow);
            }
        }
        // 选项按钮（this.buttons）的每帧更新由 Main.updateGameWorld 负责 —— 它会喂入本帧真实
        // 鼠标坐标 / 点击状态，悬停（sfx.ui_hover）与点击（sfx.ui_click）判定都在 UIButton.update 里。
        //
        // ⚠ 补漏记录（2026-09-13）：这里本来还有一句
        //     this.buttons.forEach(b => b.update(0, 0, false, false, deltaTime));
        //   它每帧先用 (0,0) 空鼠标把选项按钮刷成「未悬停」，紧接着 Main 再用真实坐标 update 一次，
        //   于是 UIButton 内部的 wasHovered 永远是 false → 鼠标停在 NPC 对话选项按钮上时，
        //   滑过音效每帧重播（听感上就是一直响）。
        //   开始界面「开始游戏」按钮与大地图传送按钮只被真实鼠标 update 一次，所以没这个毛病。
        //   回归断言：tools/smoke_chapter2.js 第 14 节 + smoke_chapter2_runner.js 探针 R.audio.dialogHover。
    }

    render(ctx) {
        if (!this.isVisible) return;
        ctx.save();
        if (this.backgroundImage) {
            ctx.drawImage(this.backgroundImage, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
        let textStartY = this.y + this.padding.top + 30;
        let displayLine = this.displayedText;
        const colonIdx = displayLine.indexOf(':');
        const maxWidth = this.width - this.padding.left - this.padding.right;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        if (colonIdx > 0) {
            const speakerPart = displayLine.substring(0, colonIdx + 1);
            const textPart = displayLine.substring(colonIdx + 1);
            // 说话人 + ":" 用粗体 + 颜色
            ctx.font = 'bold ' + this.fontSize + 'px ' + this.font;
            ctx.fillStyle = this.getSpeakerColor();
            const sw = ctx.measureText(speakerPart).width;
            ctx.fillText(speakerPart, this.x + this.padding.left, textStartY);
            // 对话内容用正常字体，跟在后面
            ctx.font = this.fontSize + 'px ' + this.font;
            ctx.fillStyle = this.textColor;
            let rw = maxWidth - sw;
            if (rw > 0) {
                const wl = this.wrapText(ctx, textPart, rw);
                wl.forEach((l, i) => ctx.fillText(l, this.x + this.padding.left + sw, textStartY + i * this.lineHeight));
            }
        } else {
            ctx.font = this.fontSize + 'px ' + this.font;
            ctx.fillStyle = this.textColor;
            const wl = this.wrapText(ctx, displayLine, maxWidth);
            wl.forEach((l, i) => ctx.fillText(l, this.x + this.padding.left, textStartY + i * this.lineHeight));
        }
        this.buttons.forEach(b => b.render(ctx));
        if (!this.isTyping && this.currentText.length > 0) this.renderAdvanceIndicator(ctx);
        ctx.restore();
    }

    wrapText(ctx, text, maxWidth) {
        const lines = []; let cl = '';
        for (const c of text) {
            const tl = cl + c;
            if (ctx.measureText(tl).width > maxWidth && cl.length > 0) { lines.push(cl); cl = c; }
            else cl = tl;
        }
        if (cl) lines.push(cl);
        return lines;
    }

    renderAdvanceIndicator(ctx) {
        const ax = this.x + this.width - this.padding.right - 10;
        const ay = this.y + this.height - this.padding.bottom - 10;
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(ax - 5, ay); ctx.lineTo(ax + 5, ay); ctx.lineTo(ax, ay + 8);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        if (this.hasNextLine()) {
            ctx.save();
            ctx.font = '12px Microsoft YaHei';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('继续', this.x + this.width - this.padding.right - 20, this.y + this.height - this.padding.bottom - 2);
            ctx.restore();
        }
    }

    addOptionButton(b) { this.buttons.push(b); }
    clearOptionButtons() { this.buttons = []; }
    show() { this.isVisible = true; this.isActive = true; }

    hide() {
        this.isVisible = false; this.isActive = false;
        this.isTyping = false; this.clearOptionButtons();
    }

    advance() {
        if (this.isTyping) { this.completeTypewriter(); }
        else if (this.hasNextLine()) { this.advanceLine(); }
        else if (this.onAdvance) { this.onAdvance(); }
    }

    serialize() {
        return { x: this.x, y: this.y, width: this.width, height: this.height,
            isVisible: this.isVisible, isActive: this.isActive,
            currentText: this.currentText, displayedText: this.displayedText,
            dialogueLines: [...this.dialogueLines], currentLineIndex: this.currentLineIndex,
            currentSpeakerName: this.currentSpeakerName };
    }

    deserialize(data) {
        if (!data) return;
        this.x = data.x || this.x; this.y = data.y || this.y;
        this.width = data.width || this.width; this.height = data.height || this.height;
        this.isVisible = data.isVisible || false; this.isActive = data.isActive || false;
        this.currentText = data.currentText || ''; this.displayedText = data.displayedText || '';
        this.dialogueLines = data.dialogueLines || [];
        this.currentLineIndex = data.currentLineIndex || 0;
        this.currentSpeakerName = data.currentSpeakerName || '';
    }
}
DialogBox.measureCtx = null;

