/**
 * 忆片归序小游戏
 * 将混乱的记忆片段按正确顺序排列
 */
class MemorySortMiniGame extends MiniGame {
    /**
     * @param {Object} config - 配置
     * @param {Array} config.memoryFragments - 记忆片段列表
     */
    constructor(config = {}) {
        super({
            id: 'memory_sort',
            name: '忆片归序',
            timeLimit: 90,
            maxScore: 100,
            ...config,
        });
        
        // ========== 记忆片段 ==========
        this.memoryFragments = config.memoryFragments || [
            { id: 'fragment_1', text: '风灾发生的那天', correctOrder: 0 },
            { id: 'fragment_2', text: '阿禾拉着我逃跑', correctOrder: 1 },
            { id: 'fragment_3', text: '归乡牌掉在地上', correctOrder: 2 },
            { id: 'fragment_4', text: '祁伯的呼喊声', correctOrder: 3 },
            { id: 'fragment_5', text: '青岚村飘向天空', correctOrder: 4 },
        ];
        
        // ========== 卡片状态 ==========
        this.cards = [];           // 卡片列表
        this.selectedCard = null;  // 选中的卡片
        this.correctCount = 0;
        this.attemptCount = 0;
        
        // ========== 初始化 ==========
        this.initCards();
    }

    /**
     * 初始化卡片（打乱顺序）
     */
    initCards() {
        this.cards = this.memoryFragments.map(fragment => ({
            ...fragment,
            x: 0,
            y: 0,
            isSelected: false,
            isCorrect: false,
        }));
        
        // 打乱顺序
        this.shuffleCards();
        
        // 设置卡片位置
        this.layoutCards();
    }

    /**
     * 打乱卡片
     */
    shuffleCards() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    /**
     * 布局卡片
     */
    layoutCards() {
        const cardWidth = 200;
        const cardHeight = 80;
        const startX = 300;
        const startY = 100;
        const gapY = 20;
        
        this.cards.forEach((card, index) => {
            card.x = startX;
            card.y = startY + index * (cardHeight + gapY);
        });
    }

    /**
     * 开始游戏
     */
    start() {
        super.start();
        this.initCards();
        this.selectedCard = null;
        this.correctCount = 0;
        this.attemptCount = 0;
    }

    /**
     * 更新游戏
     */
    update(deltaTime, input) {
        super.update(deltaTime, input);
        
        if (!this.isRunning || this.isPaused) return;
        
        // 处理鼠标点击
        if (input && input.mouseClicked) {
            this.handleCardClick(input.mouseX, input.mouseY);
        }
        
        // 检查完成
        if (this.correctCount >= this.cards.length) {
            this.score = this.maxScore;
            this.complete();
        }
    }

    /**
     * 处理卡片点击
     */
    handleCardClick(mouseX, mouseY) {
        this.cards.forEach(card => {
            const cardRect = {
                x: card.x,
                y: card.y,
                width: 200,
                height: 80,
            };
            
            if (CollisionDetector.pointInRect(mouseX, mouseY, cardRect)) {
                if (this.selectedCard === null) {
                    // 第一次选择
                    this.selectedCard = card;
                    card.isSelected = true;
                } else if (this.selectedCard === card) {
                    // 取消选择
                    this.selectedCard = null;
                    card.isSelected = false;
                } else {
                    // 交换卡片
                    this.swapCards(this.selectedCard, card);
                    this.selectedCard.isSelected = false;
                    this.selectedCard = null;
                    this.attemptCount++;
                    
                    // 检查正确性
                    this.checkCorrectness();
                }
            }
        });
    }

    /**
     * 交换卡片
     */
    swapCards(card1, card2) {
        const tempOrder = card1.correctOrder;
        card1.correctOrder = card2.correctOrder;
        card2.correctOrder = tempOrder;
        
        // 交换位置
        const tempY = card1.y;
        card1.y = card2.y;
        card2.y = tempY;
    }

    /**
     * 检查正确性
     */
    checkCorrectness() {
        this.correctCount = 0;
        this.cards.forEach((card, index) => {
            if (card.correctOrder === index) {
                card.isCorrect = true;
                this.correctCount++;
            } else {
                card.isCorrect = false;
            }
        });
        
        this.score = (this.correctCount / this.cards.length) * this.maxScore;
    }

    /**
     * 渲染游戏
     */
    render(ctx) {
        ctx.save();
        
        // 背景
        ctx.fillStyle = '#2E2E2E';
        ctx.fillRect(0, 0, 800, 600);
        
        // 标题
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText('将记忆片段按正确顺序排列', 400, 50);
        
        // 卡片
        this.cards.forEach(card => {
            const cardRect = {
                x: card.x,
                y: card.y,
                width: 200,
                height: 80,
            };
            
            // 卡片背景
            if (card.isCorrect) {
                ctx.fillStyle = '#4CAF50';
            } else if (card.isSelected) {
                ctx.fillStyle = '#FF9800';
            } else {
                ctx.fillStyle = '#555555';
            }
            ctx.fillRect(cardRect.x, cardRect.y, cardRect.width, cardRect.height);
            
            // 卡片边框
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.strokeRect(cardRect.x, cardRect.y, cardRect.width, cardRect.height);
            
            // 卡片文字
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '16px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText(
                card.text,
                cardRect.x + cardRect.width / 2,
                cardRect.y + cardRect.height / 2
            );
        });
        
        // UI文字
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '18px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.fillText(`正确: ${this.correctCount}/${this.cards.length}`, 20, 30);
        ctx.fillText(`尝试: ${this.attemptCount}`, 20, 60);
        ctx.fillText(`分数: ${Math.floor(this.score)}`, 20, 90);
        ctx.fillText('点击两张卡片交换位置', 20, 550);
        
        ctx.restore();
    }
}