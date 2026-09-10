/**
 * 乘风采药小游戏
 * 观察风向，选择漂移路线，在落点短暂定身采药
 */
class HerbCollectMiniGame extends MiniGame {
    /**
     * @param {Object} config - 配置
     */
    constructor(config = {}) {
        super({
            id: 'herb_collect',
            name: '乘风采药',
            timeLimit: 45,
            maxScore: 100,
            ...config,
        });
        
        // ========== 游戏元素 ==========
        this.player = {
            x: 400,
            y: 300,
            width: 30,
            height: 30,
            vx: 0,
            vy: 0,
            isGrounded: false,
        };
        
        // 风
        this.wind = {
            direction: 1,      // 风向：-1左，1右
            strength: 50,      // 风力强度
            changeTimer: 0,
            changeInterval: 3, // 风向变化间隔
        };
        
        // 草药
        this.herbs = [];
        this.collectedHerbs = 0;
        this.totalHerbs = 10;
        
        // 平台
        this.platforms = [];
        
        // 输入状态
        this.moveLeft = false;
        this.moveRight = false;
        this.jumpPressed = false;
        this.groundPressed = false; // 定身键
        
        // 定身状态
        this.isAnchored = false;
        this.anchorDuration = 0.5;
        this.anchorTimer = 0;
        
        // 初始化
        this.initGameElements();
    }

    /**
     * 初始化游戏元素
     */
    initGameElements() {
        // 生成平台
        this.platforms = [
            { x: 100, y: 500, width: 200, height: 20 },
            { x: 350, y: 420, width: 150, height: 20 },
            { x: 550, y: 350, width: 180, height: 20 },
            { x: 300, y: 250, width: 160, height: 20 },
            { x: 500, y: 150, width: 200, height: 20 },
        ];
        
        // 生成草药
        this.platforms.forEach((platform, index) => {
            const herbCount = 2;
            for (let i = 0; i < herbCount; i++) {
                this.herbs.push({
                    x: platform.x + (platform.width / (herbCount + 1)) * (i + 1),
                    y: platform.y - 20,
                    collected: false,
                });
            }
        });
        
        this.totalHerbs = this.herbs.length;
    }

    /**
     * 开始游戏
     */
    start() {
        super.start();
        this.player.x = 400;
        this.player.y = 300;
        this.collectedHerbs = 0;
        this.initGameElements();
    }

    /**
     * 更新游戏
     */
    update(deltaTime, input) {
        super.update(deltaTime, input);
        
        if (!this.isRunning || this.isPaused) return;
        
        // 更新输入
        this.updateInput(input);
        
        // 更新风
        this.updateWind(deltaTime);
        
        // 更新定身
        this.updateAnchor(deltaTime);
        
        // 更新玩家
        this.updatePlayer(deltaTime);
        
        // 检查草药收集
        this.checkHerbCollection();
        
        // 检查完成条件
        if (this.collectedHerbs >= this.totalHerbs) {
            this.score = this.maxScore;
            this.complete();
        }
        
        // 检查掉落
        if (this.player.y > 600) {
            this.fail();
        }
    }

    /**
     * 更新输入
     */
    updateInput(input) {
        if (!input || !input.keys) return;
        
        this.moveLeft = input.keys['a'] || input.keys['arrowleft'] || false;
        this.moveRight = input.keys['d'] || input.keys['arrowright'] || false;
        this.jumpPressed = input.pressedKeys['w'] || input.pressedKeys['arrowup'] || false;
        this.groundPressed = input.keys['s'] || input.keys['arrowdown'] || false;
    }

    /**
     * 更新风
     */
    updateWind(deltaTime) {
        this.wind.changeTimer += deltaTime;
        
        if (this.wind.changeTimer >= this.wind.changeInterval) {
            this.wind.changeTimer = 0;
            this.wind.direction = Math.random() < 0.5 ? -1 : 1;
            this.wind.strength = 30 + Math.random() * 50;
        }
    }

    /**
     * 更新定身
     */
    updateAnchor(deltaTime) {
        if (this.groundPressed && !this.isAnchored) {
            this.isAnchored = true;
            this.anchorTimer = this.anchorDuration;
        }
        
        if (this.isAnchored) {
            this.anchorTimer -= deltaTime;
            if (this.anchorTimer <= 0) {
                this.isAnchored = false;
            }
        }
    }

    /**
     * 更新玩家
     */
    updatePlayer(deltaTime) {
        // 水平移动
        const moveSpeed = 200;
        if (this.moveLeft && !this.isAnchored) {
            this.player.vx = -moveSpeed;
        } else if (this.moveRight && !this.isAnchored) {
            this.player.vx = moveSpeed;
        } else {
            this.player.vx *= 0.9; // 摩擦力
        }
        
        // 风力影响
        if (!this.isAnchored) {
            this.player.vx += this.wind.direction * this.wind.strength * deltaTime;
        }
        
        // 跳跃
        if (this.jumpPressed && this.player.isGrounded) {
            this.player.vy = -400;
            this.player.isGrounded = false;
        }
        
        // 重力
        const gravity = 800;
        this.player.vy += gravity * deltaTime;
        
        // 更新位置
        this.player.x += this.player.vx * deltaTime;
        this.player.y += this.player.vy * deltaTime;
        
        // 边界检查
        if (this.player.x < 0) this.player.x = 0;
        if (this.player.x > 800) this.player.x = 800;
        
        // 平台碰撞
        this.player.isGrounded = false;
        this.platforms.forEach(platform => {
            const playerRect = {
                x: this.player.x - this.player.width / 2,
                y: this.player.y - this.player.height / 2,
                width: this.player.width,
                height: this.player.height,
            };
            
            const platformRect = {
                x: platform.x,
                y: platform.y,
                width: platform.width,
                height: platform.height,
            };
            
            if (CollisionDetector.aabb(playerRect, platformRect)) {
                // 从上方落下
                if (this.player.vy > 0 && 
                    this.player.y - this.player.height / 2 < platform.y) {
                    this.player.y = platform.y - this.player.height / 2;
                    this.player.vy = 0;
                    this.player.isGrounded = true;
                }
            }
        });
    }

    /**
     * 检查草药收集
     */
    checkHerbCollection() {
        this.herbs.forEach(herb => {
            if (herb.collected) return;
            
            const distance = Math.sqrt(
                Math.pow(this.player.x - herb.x, 2) +
                Math.pow(this.player.y - herb.y, 2)
            );
            
            if (distance < 30) {
                herb.collected = true;
                this.collectedHerbs++;
                this.score += this.maxScore / this.totalHerbs;
            }
        });
    }

    /**
     * 渲染游戏
     */
    render(ctx) {
        ctx.save();
        
        // 背景
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, 800, 600);
        
        // 平台
        ctx.fillStyle = '#8B4513';
        this.platforms.forEach(platform => {
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        });
        
        // 草药
        this.herbs.forEach(herb => {
            if (herb.collected) return;
            ctx.fillStyle = '#00FF00';
            ctx.beginPath();
            ctx.arc(herb.x, herb.y, 8, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // 玩家
        ctx.fillStyle = this.isAnchored ? '#FFD700' : '#FF6347';
        ctx.fillRect(
            this.player.x - this.player.width / 2,
            this.player.y - this.player.height / 2,
            this.player.width,
            this.player.height
        );
        
        // 风指示器
        this.renderWindIndicator(ctx);
        
        // UI文字
        ctx.fillStyle = '#000000';
        ctx.font = '20px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.fillText(`收集: ${this.collectedHerbs}/${this.totalHerbs}`, 20, 30);
        ctx.fillText(`时间: ${Math.ceil(this.timeLimit - this.gameTimer)}秒`, 20, 60);
        ctx.fillText(`分数: ${Math.floor(this.score)}`, 20, 90);
        
        ctx.restore();
    }

    /**
     * 渲染风指示器
     */
    renderWindIndicator(ctx) {
        const indicatorX = 400;
        const indicatorY = 50;
        
        ctx.fillStyle = '#000000';
        ctx.font = '16px Microsoft YaHei';
        ctx.textAlign = 'center';
        
        const windDirection = this.wind.direction > 0 ? '→' : '←';
        const windStrength = Math.floor(this.wind.strength);
        ctx.fillText(`风: ${windDirection} ${windStrength}`, indicatorX, indicatorY);
    }
}