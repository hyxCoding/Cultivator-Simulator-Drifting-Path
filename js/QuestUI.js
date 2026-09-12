/**
 * 任务栏UI类
 * 显示已完成任务（灰色）和进行中任务，按任务顺序排列
 * 左对齐展示，目标从上到下排列
 */
class QuestUI {
    /**
     * @param {Object} config - 配置
     * @param {QuestSystem} config.questSystem - 任务系统实例
     * @param {number} config.x - UI面板x坐标
     * @param {number} config.y - UI面板y坐标
     * @param {number} config.width - UI面板宽度
     * @param {number} config.height - UI面板高度
     */
    constructor(config = {}) {
        // ========== 引用 ==========
        this.questSystem = config.questSystem || null;
        
        // ========== 面板位置与尺寸 ==========
        this.x = config.x || 50;
        this.y = config.y || 50;
        this.width = config.width || 500;
        this.height = config.height || 200;
        
        // ========== 背景图 ==========
        this.backgroundImage = config.backgroundImage || null;
        
        // ========== 样式 ==========
        this.padding = config.padding || { top: 20, right: 25, bottom: 20, left: 25 };
        this.font = config.font || 'Microsoft YaHei, sans-serif';
        this.fontSize = config.fontSize || 14;
        this.titleFontSize = config.titleFontSize || 18;
        this.textColor = config.textColor || '#333333';
        this.titleColor = config.titleColor || '#8B4513';
        this.completedColor = config.completedColor || '#4CAF50';
        this.inProgressColor = config.inProgressColor || '#FF9800';
        this.rewardColor = config.rewardColor || '#FF5722';
        this.lineHeight = config.lineHeight || this.fontSize * 1.6;
        
        // ========== 文本排版 ==========
        // 面板内每行文字最多 280px：任务标题 / 描述 / 目标进度超出都自动换行
        this.maxLineWidth = config.maxLineWidth || 280;
        // 标题在 padding.top 基础上再下移的像素（避让面板顶部的装饰纹样）
        this.titleOffsetY = config.titleOffsetY !== undefined ? config.titleOffsetY : 20;
        // 续行缩进：换行后的文字对齐在上一行文字下方（而不是对齐在 ✓ / □ 符号下方），
        // 描述行也整体内缩这么多，换行宽度同步扣除，保证每行（含缩进）都落在 280px 内
        this.continuationIndent = config.continuationIndent !== undefined ? config.continuationIndent : 16;
        
        // ========== 状态 ==========
        this.isVisible = false;
        
        // ========== 回调 ==========
        this.onClose = null;          // 关闭面板回调
    }

    /**
     * 设置任务系统引用
     * @param {QuestSystem} questSystem - 任务系统实例
     */
    setQuestSystem(questSystem) {
        this.questSystem = questSystem;
    }

    /**
     * 获取所有已排序的显示任务
     * 规则：已完成任务按order升序排列在最前面 + 当前进行中的任务（只显示order最小的一个）
     * @returns {Array<{questId:string, state:Object, completed:boolean, order:number}>}
     */
    getDisplayQuests() {
        if (!this.questSystem) return [];
        const result = [];
        const gameConfig = GameConfig.getInstance();
        
        // 已完成任务：只显示支线，不显示已完结的主线
        const completedQuests = this.questSystem.getCompletedQuests();
        for (const [questId, questState] of completedQuests) {
            const questConfig = gameConfig.getQuest(questId);
            // 跳过已完成的主线任务（只显示当前激活的主线）
            if (questConfig && questConfig.type === 'main') continue;
            result.push({
                questId,
                state: questState,
                completed: true,
                order: questConfig ? questConfig.order : 999,
                title: questConfig ? questConfig.title : questId,
                description: questConfig ? questConfig.description : '',
            });
        }
        
        // 进行中的任务：只显示 order 最小的一个（当前任务）
        const activeQuests = this.questSystem.getActiveQuests();
        let minOrder = Infinity;
        let minEntry = null;
        for (const [questId, questState] of activeQuests) {
            const questConfig = gameConfig.getQuest(questId);
            const order = questConfig ? questConfig.order : 999;
            if (order < minOrder) {
                minOrder = order;
                minEntry = {
                    questId,
                    state: questState,
                    completed: false,
                    order,
                    title: questConfig ? questConfig.title : questId,
                    description: questConfig ? questConfig.description : '',
                };
            }
        }
        if (minEntry) result.push(minEntry);
        
        // 按 order 排序
        result.sort((a, b) => a.order - b.order);
        
        return result;
    }

    /**
     * 更新任务UI
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态
     */
    update(deltaTime, input) {
        // 无需交互更新
    }

    /**
     * 渲染任务UI
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isVisible) return;
        
        ctx.save();
        
        // 绘制背景
        this.renderBackground(ctx);
        
        // 绘制标题
        this.renderTitle(ctx);
        
        // 绘制任务列表（左对齐，已完成的灰色显示）
        this.renderQuestList(ctx);
        
        // 绘制关闭提示
        this.renderCloseHint(ctx);
        
        ctx.restore();
    }

    /**
     * 渲染背景
     */
    renderBackground(ctx) {
        if (this.backgroundImage) {
            ctx.drawImage(
                this.backgroundImage,
                this.x,
                this.y,
                this.width,
                this.height
            );
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
    }

    /**
     * 渲染标题
     */
    renderTitle(ctx) {
        ctx.font = `bold ${this.titleFontSize}px ${this.font}`;
        ctx.fillStyle = this.titleColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        // 标题：padding.top 基础上再下移 titleOffsetY（当前 20px），仍按 280px 上限换行
        this.drawWrappedText(
            ctx,
            '任  务  记  录',
            this.x + this.width / 2,
            this.y + this.padding.top + this.titleOffsetY,
            this.maxLineWidth,
            this.lineHeight
        );
    }

    /**
     * 绘制任务列表（左对齐，已完成灰色显示，目标按顺序依次展示）
     */
    renderQuestList(ctx) {
        const quests = this.getDisplayQuests();
        const leftX = this.x + this.padding.left + 90; // 整体X +30
        const maxWidth = this.maxLineWidth; // 每行最多 280px（超出自动换行）
        let currentY = this.y + this.padding.top + this.titleFontSize + 12 + 80; // 整体Y -20

        if (quests.length === 0) {
            // 无任务时居中显示
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            ctx.font = `${this.fontSize}px ${this.font}`;
            ctx.fillStyle = '#999999';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('暂无任务', centerX, centerY);
            return;
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const questGap = 10;

        for (let qi = 0; qi < quests.length; qi++) {
            const quest = quests[qi];
            const isCompleted = quest.completed;

            // ——— 任务标题 ———
            ctx.font = `bold ${this.fontSize + 2}px ${this.font}`;
            ctx.fillStyle = isCompleted ? '#888888' : this.titleColor;
            // 任务标题：超过 280px 自动换行（续行缩进对齐标题文字）
            currentY = this.drawWrappedText(
                ctx,
                (isCompleted ? '✓ ' : '□ ') + quest.title,
                leftX,
                currentY,
                maxWidth,
                this.lineHeight,
                this.continuationIndent
            );

            // ——— 任务描述 ———
            if (quest.description) {
                ctx.font = `${this.fontSize - 2}px ${this.font}`;
                ctx.fillStyle = isCompleted ? '#aaaaaa' : '#666666';
                // 任务描述：整体内缩 continuationIndent，换行宽度同步扣除
                currentY = this.drawWrappedText(
                    ctx,
                    quest.description,
                    leftX + this.continuationIndent,
                    currentY,
                    maxWidth - this.continuationIndent,
                    this.lineHeight - 2
                );
            }

            // ——— 任务目标进度：仅显示已完成的 + 第一个未完成的 ———
            if (quest.state && quest.state.objectives) {
                ctx.font = `${this.fontSize}px ${this.font}`;
                let hasShownIncomplete = false;
                for (const objective of quest.state.objectives) {
                    // 已完成 → 始终显示（灰色/绿色）
                    if (objective.completed) {
                        ctx.fillStyle = isCompleted ? '#aaaaaa' : this.completedColor;
                        currentY = this.drawWrappedText(
                            ctx,
                            `  ✓ ${objective.description} (${objective.progress}/${objective.count})`,
                            leftX,
                            currentY,
                            maxWidth,
                            this.lineHeight,
                            this.continuationIndent
                        );
                    } else if (!hasShownIncomplete) {
                        // 第一个未完成 → 显示
                        hasShownIncomplete = true;
                        ctx.fillStyle = isCompleted ? '#aaaaaa' : this.textColor;
                        currentY = this.drawWrappedText(
                            ctx,
                            `  □ ${objective.description} (${objective.progress}/${objective.count})`,
                            leftX,
                            currentY,
                            maxWidth,
                            this.lineHeight,
                            this.continuationIndent
                        );
                    }
                    // 后续的未完成目标不显示
                }
            }

            currentY += questGap;

            // 超出面板范围则截断
            if (currentY > this.y + this.height - this.padding.bottom - this.lineHeight) {
                ctx.fillStyle = '#999999';
                ctx.font = `${this.fontSize - 2}px ${this.font}`;
                ctx.fillText('......', leftX, currentY);
                break;
            }
        }
    }

    /**
     * 渲染关闭提示
     */
    renderCloseHint(ctx) {
        ctx.font = `${this.fontSize - 2}px ${this.font}`;
        ctx.fillStyle = '#999999';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
            '按 Q 或 ESC 关闭',
            this.x + this.width - this.padding.right,
            this.y + this.height - this.padding.bottom
        );
    }

    /**
     * 文本自动换行
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {string} text - 待排版文本
     * @param {number} maxWidth - 首行最大像素宽度（任务栏固定 280px）
     * @param {number} continueIndent - 续行缩进像素：续行会右移该距离，
     *                                  可排版宽度也同步扣减，保证整行（含缩进）不超过 maxWidth
     * @returns {Array<string>} 每行文字
     */
    wrapText(ctx, text, maxWidth, continueIndent = 0) {
        const lines = [];
        let currentLine = '';
        
        for (const char of text) {
            // 首行可用 maxWidth；已经换过行 → 续行右移 indent，可排版宽度相应变小
            const limit = lines.length === 0 ? maxWidth : maxWidth - continueIndent;
            const testLine = currentLine + char;
            if (ctx.measureText(testLine).width > limit && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    /**
     * 按最大宽度绘制（自动换行的）一段文字，返回绘制完成后的 Y 坐标
     * 任务标题 / 任务描述 / 目标进度统一走这里，保证面板内每行最多 280px
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {string} text - 待绘制文本
     * @param {number} x - 首行绘制 X（续行会再右移 continueIndent）
     * @param {number} startY - 首行绘制 Y
     * @param {number} maxWidth - 单行最大像素宽度（含缩进）
     * @param {number} lineStep - 行高步进（像素）
     * @param {number} continueIndent - 续行缩进像素（默认 0 = 续行与首行左对齐）
     * @returns {number} 绘制结束后的 Y（可直接用于下一段排版）
     */
    drawWrappedText(ctx, text, x, startY, maxWidth, lineStep, continueIndent = 0) {
        const lines = this.wrapText(ctx, text, maxWidth, continueIndent);
        let currentY = startY;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x + (i === 0 ? 0 : continueIndent), currentY);
            currentY += lineStep;
        }
        return currentY;
    }

    /**
     * 显示任务UI
     */
    show() {
        this.isVisible = true;
    }

    /**
     * 隐藏任务UI
     */
    hide() {
        this.isVisible = false;
    }

    /**
     * 切换显示/隐藏
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 序列化任务UI状态（用于存档）
     */
    serialize() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            isVisible: this.isVisible,
        };
    }

    /**
     * 反序列化任务UI状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.x = data.x || this.x;
        this.y = data.y || this.y;
        this.width = data.width || this.width;
        this.height = data.height || this.height;
        this.isVisible = data.isVisible || false;
    }
}