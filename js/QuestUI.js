/**
 * 任务UI类
 * 显示当前任务内容、完成情况、任务奖励
 * 显示历史已完成任务
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
        this.height = config.height || 400;
        
        // ========== 背景图 ==========
        this.backgroundImage = config.backgroundImage || null;
        
        // ========== 样式 ==========
        this.padding = config.padding || { top: 20, right: 20, bottom: 20, left: 20 };
        this.font = config.font || 'Microsoft YaHei, sans-serif';
        this.fontSize = config.fontSize || 14;
        this.titleFontSize = config.titleFontSize || 20;
        this.textColor = config.textColor || '#333333';
        this.titleColor = config.titleColor || '#8B4513';
        this.completedColor = config.completedColor || '#4CAF50';
        this.inProgressColor = config.inProgressColor || '#FF9800';
        this.rewardColor = config.rewardColor || '#FF5722';
        this.lineHeight = config.lineHeight || this.fontSize * 1.6;
        
        // ========== 状态 ==========
        this.isVisible = false;
        this.currentTab = 'active'; // 'active' 或 'completed'
        this.scrollOffset = 0;
        this.maxScrollOffset = 0;
        
        // ========== 标签按钮 ==========
        this.tabButtons = [];
        this.initTabButtons();
        
        // ========== 回调 ==========
        this.onQuestSelected = null;  // 选中任务回调 (questId) => void
        this.onClose = null;          // 关闭面板回调
        
        // ========== 选中的任务 ==========
        this.selectedQuestId = null;
    }

    /**
     * 初始化标签按钮
     */
    initTabButtons() {
        const tabWidth = 100;
        const tabHeight = 30;
        
        this.tabButtons = [
            new UIButton({
                x: this.x + this.padding.left,
                y: this.y + this.padding.top,
                width: tabWidth,
                height: tabHeight,
                text: '进行中',
                callback: () => {
                    this.currentTab = 'active';
                    this.selectedQuestId = null;
                    this.scrollOffset = 0;
                },
            }),
            new UIButton({
                x: this.x + this.padding.left + tabWidth + 10,
                y: this.y + this.padding.top,
                width: tabWidth,
                height: tabHeight,
                text: '已完成',
                callback: () => {
                    this.currentTab = 'completed';
                    this.selectedQuestId = null;
                    this.scrollOffset = 0;
                },
            }),
        ];
    }

    /**
     * 设置任务系统引用
     * @param {QuestSystem} questSystem - 任务系统实例
     */
    setQuestSystem(questSystem) {
        this.questSystem = questSystem;
    }

    /**
     * 更新任务UI
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态
     */
    update(deltaTime, input) {
        if (!this.isVisible) return;
        
        // 更新标签按钮
        if (input) {
            this.tabButtons.forEach(button => {
                button.update(
                    input.mouseX,
                    input.mouseY,
                    input.mousePressed,
                    input.mouseClicked,
                    deltaTime
                );
            });
        }
        
        // 处理滚轮滚动
        if (input && input.mouseWheelDelta) {
            this.scrollOffset -= input.mouseWheelDelta;
            this.clampScrollOffset();
        }
        
        // 处理任务选择
        if (input && input.mouseClicked) {
            this.handleQuestSelection(input.mouseX, input.mouseY);
        }
    }

    /**
     * 处理任务选择
     */
    handleQuestSelection(mouseX, mouseY) {
        const questList = this.getCurrentQuestList();
        const listStartY = this.y + this.padding.top + 60;
        
        questList.forEach((questEntry, index) => {
            const itemY = listStartY + index * (this.lineHeight * 2) - this.scrollOffset;
            
            if (mouseX >= this.x + this.padding.left &&
                mouseX <= this.x + this.width - this.padding.right &&
                mouseY >= itemY &&
                mouseY <= itemY + this.lineHeight * 1.8) {
                
                this.selectedQuestId = questEntry.questId;
                
                if (this.onQuestSelected) {
                    this.onQuestSelected(questEntry.questId);
                }
            }
        });
    }

    /**
     * 获取当前标签的任务列表
     */
    getCurrentQuestList() {
        if (!this.questSystem) return [];
        
        if (this.currentTab === 'active') {
            const activeQuests = this.questSystem.getActiveQuests();
            return Array.from(activeQuests.entries()).map(([questId, questState]) => ({
                questId: questId,
                state: questState,
            }));
        } else {
            const completedQuests = this.questSystem.getCompletedQuests();
            return Array.from(completedQuests.entries()).map(([questId, questState]) => ({
                questId: questId,
                state: questState,
            }));
        }
    }

    /**
     * 限制滚动偏移
     */
    clampScrollOffset() {
        const questCount = this.getCurrentQuestList().length;
        const listHeight = this.height - this.padding.top - this.padding.bottom - 60;
        const contentHeight = questCount * (this.lineHeight * 2);
        
        this.maxScrollOffset = Math.max(0, contentHeight - listHeight);
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, this.maxScrollOffset));
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
        
        // 绘制标签按钮
        this.tabButtons.forEach(button => button.render(ctx));
        
        // 绘制任务列表
        this.renderQuestList(ctx);
        
        // 绘制选中任务详情
        if (this.selectedQuestId) {
            this.renderQuestDetail(ctx);
        }
        
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
        ctx.fillText(
            '任 务 簿',
            this.x + this.width / 2,
            this.y + this.padding.top + 20
        );
    }

    /**
     * 渲染任务列表
     */
    renderQuestList(ctx) {
        const questList = this.getCurrentQuestList();
        const listStartX = this.x + this.padding.left;
        const listStartY = this.y + this.padding.top + 60;
        const listWidth = this.width - this.padding.left - this.padding.right;
        const listHeight = this.height - this.padding.top - this.padding.bottom - 80;
        
        // 裁剪列表区域
        ctx.save();
        ctx.beginPath();
        ctx.rect(listStartX, listStartY, listWidth, listHeight);
        ctx.clip();
        
        // 空列表提示
        if (questList.length === 0) {
            ctx.font = `${this.fontSize}px ${this.font}`;
            ctx.fillStyle = '#999999';
            ctx.textAlign = 'center';
            ctx.fillText(
                this.currentTab === 'active' ? '暂无进行中的任务' : '暂无已完成的任务',
                listStartX + listWidth / 2,
                listStartY + listHeight / 2
            );
        } else {
            // 渲染每个任务条目
            questList.forEach((questEntry, index) => {
                this.renderQuestListItem(ctx, questEntry, index, listStartX, listStartY, listWidth);
            });
        }
        
        ctx.restore();
        
        // 渲染滚动条
        if (this.maxScrollOffset > 0) {
            this.renderScrollbar(ctx, listStartX + listWidth, listStartY, listHeight);
        }
    }

    /**
     * 渲染单个任务条目
     */
    renderQuestListItem(ctx, questEntry, index, listStartX, listStartY, listWidth) {
        const gameConfig = GameConfig.getInstance();
        const questConfig = gameConfig.getQuest(questEntry.questId);
        
        const itemY = listStartY + index * (this.lineHeight * 2) - this.scrollOffset;
        
        // 超出可视区域
        if (itemY + this.lineHeight * 2 < listStartY || itemY > listStartY + this.height) {
            return;
        }
        
        const isSelected = questEntry.questId === this.selectedQuestId;
        
        // 背景高亮
        if (isSelected) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(listStartX, itemY, listWidth, this.lineHeight * 1.8);
        }
        
        // 任务名称
        const questTitle = questConfig ? questConfig.title : questEntry.questId;
        ctx.font = `${this.fontSize}px ${this.font}`;
        ctx.fillStyle = isSelected ? '#ffffff' : this.textColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(questTitle, listStartX + 10, itemY + 5);
        
        // 任务状态
        let statusText = '';
        let statusColor = this.inProgressColor;
        
        if (this.currentTab === 'completed') {
            statusText = '✓ 已完成';
            statusColor = this.completedColor;
        } else {
            const completedObjectives = questEntry.state.objectives.filter(obj => obj.completed).length;
            const totalObjectives = questEntry.state.objectives.length;
            statusText = `进度: ${completedObjectives}/${totalObjectives}`;
        }
        
        ctx.fillStyle = statusColor;
        ctx.font = `${this.fontSize - 2}px ${this.font}`;
        ctx.fillText(statusText, listStartX + 10, itemY + this.lineHeight);
        
        // 分隔线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(listStartX, itemY + this.lineHeight * 1.8);
        ctx.lineTo(listStartX + listWidth, itemY + this.lineHeight * 1.8);
        ctx.stroke();
    }

    /**
     * 渲染滚动条
     */
    renderScrollbar(ctx, scrollbarX, scrollbarY, scrollbarHeight) {
        const scrollbarWidth = 6;
        const scrollbarXPos = scrollbarX - scrollbarWidth - 2;
        
        // 背景
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(scrollbarXPos, scrollbarY, scrollbarWidth, scrollbarHeight);
        
        // 滑块
        const sliderHeight = Math.max(
            20,
            (scrollbarHeight / (this.maxScrollOffset + scrollbarHeight)) * scrollbarHeight
        );
        const sliderY = scrollbarY + 
            (this.scrollOffset / this.maxScrollOffset) * (scrollbarHeight - sliderHeight);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(scrollbarXPos, sliderY, scrollbarWidth, sliderHeight);
    }

    /**
     * 渲染选中任务详情
     */
    renderQuestDetail(ctx) {
        if (!this.questSystem || !this.selectedQuestId) return;
        
        const gameConfig = GameConfig.getInstance();
        const questConfig = gameConfig.getQuest(this.selectedQuestId);
        const questState = this.questSystem.getQuestState(this.selectedQuestId);
        
        if (!questConfig) return;
        
        const detailX = this.x + this.padding.left;
        const detailY = this.y + this.height - 180;
        const detailWidth = this.width - this.padding.left - this.padding.right;
        const detailHeight = 150;
        
        // 背景
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(detailX, detailY, detailWidth, detailHeight);
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        let currentY = detailY + 10;
        
        // 任务标题
        ctx.font = `bold ${this.fontSize + 2}px ${this.font}`;
        ctx.fillStyle = this.titleColor;
        ctx.fillText(questConfig.title, detailX + 10, currentY);
        currentY += this.lineHeight * 1.2;
        
        // 任务描述
        ctx.font = `${this.fontSize}px ${this.font}`;
        ctx.fillStyle = this.textColor;
        const descriptionLines = this.wrapText(ctx, questConfig.description, detailWidth - 20);
        descriptionLines.forEach(line => {
            ctx.fillText(line, detailX + 10, currentY);
            currentY += this.lineHeight;
        });
        currentY += 5;
        
        // 目标
        if (questState && questState.objectives) {
            ctx.font = `${this.fontSize - 1}px ${this.font}`;
            questState.objectives.forEach(objective => {
                const statusText = objective.completed ? '✓' : '□';
                const progressText = `${objective.progress}/${objective.count}`;
                ctx.fillStyle = objective.completed ? this.completedColor : this.textColor;
                ctx.fillText(
                    `${statusText} ${objective.description} (${progressText})`,
                    detailX + 10,
                    currentY
                );
                currentY += this.lineHeight * 0.8;
            });
            currentY += 5;
        }
        
        // 奖励
        if (questConfig.rewards) {
            ctx.font = `${this.fontSize - 1}px ${this.font}`;
            ctx.fillStyle = this.rewardColor;
            
            let rewardText = '奖励: ';
            if (questConfig.rewards.exp) {
                rewardText += `经验+${questConfig.rewards.exp} `;
            }
            if (questConfig.rewards.lingShi) {
                rewardText += `灵石+${questConfig.rewards.lingShi} `;
            }
            if (questConfig.rewards.items && questConfig.rewards.items.length > 0) {
                questConfig.rewards.items.forEach(itemId => {
                    const itemConfig = gameConfig.getItem(itemId);
                    rewardText += `${itemConfig ? itemConfig.name : itemId} `;
                });
            }
            
            ctx.fillText(rewardText, detailX + 10, currentY);
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
     */
    wrapText(ctx, text, maxWidth) {
        const lines = [];
        let currentLine = '';
        
        for (const char of text) {
            const testLine = currentLine + char;
            if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
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
     * 显示任务UI
     */
    show() {
        this.isVisible = true;
        this.scrollOffset = 0;
        this.selectedQuestId = null;
    }

    /**
     * 隐藏任务UI
     */
    hide() {
        this.isVisible = false;
        this.selectedQuestId = null;
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
            currentTab: this.currentTab,
            selectedQuestId: this.selectedQuestId,
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
        this.currentTab = data.currentTab || 'active';
        this.selectedQuestId = data.selectedQuestId || null;
        
        this.initTabButtons();
    }
}