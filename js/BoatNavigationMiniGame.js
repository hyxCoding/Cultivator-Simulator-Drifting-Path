/**
 * 逆流行舟小游戏
 * 控制小舟逆流而上，避开障碍物
 */
class BoatNavigationMiniGame extends MiniGame {
    /**
     * @param {Object} config - 配置
     */
    constructor(config = {}) {
        super({
            id: 'boat_navigation',
            name: '逆流行舟',
            timeLimit: 30,
            maxScore: 100,
            ...config,
        });
        
        const resourceManager = ResourceManager.getInstance();
        
        // 加载图片
        resourceManager.loadImage('miniGame.xingzhou_bg').then(img => {
            this.backgroundImage = img;
        });

        resourceManager.loadImage('miniGame.xingzhou_boat').then(img => {
            this.boatImage = img;
        });

        resourceManager.loadImage('miniGame.xingzhou_rock').then(img => {
            this.rockImage = img;
        });        

        // ========== 游戏元素 ==========
        this.boat = {
            x: 400,
            y: 500,
            width: 100,
            height: 128,
            vx: 0,
        };
        
        // 河流
        this.riverFlow = 100; // 水流速度
        
        // 障碍物
        this.obstacles = [];
        this.obstacleSpawnTimer = 0;
        this.obstacleSpawnInterval = 2;
        
        // 进度
        this.distanceTraveled = 0;
        this.targetDistance = 1000;
        
        // 输入
        this.moveLeft = false;
        this.moveRight = false;
        this.moveUp = false;
        this.moveDown = false;
    }

    /**
     * 开始游戏
     */
    start() {
        super.start();
        this.boat.x = 400;
        this.boat.y = 500;
        this.obstacles = [];
        this.distanceTraveled = 0;
        this.obstacleSpawnTimer = 0;
    }

    /**
     * 更新游戏
     */
    update(deltaTime, input) {
        super.update(deltaTime, input);
        
        if (!this.isRunning || this.isPaused) return;
        
        // 更新输入
        this.updateInput(input);
        
        // 更新小船
        this.updateBoat(deltaTime);
        
        // 生成障碍物
        this.updateObstacles(deltaTime);
        
        // 更新进度
        this.distanceTraveled += this.boat.vy * deltaTime;
        this.score = (this.distanceTraveled / this.targetDistance) * this.maxScore;
        
        // 检查完成
        if (this.distanceTraveled >= this.targetDistance) {
            this.complete();
        }
    }

    /**
     * 更新输入
     */
    updateInput(input) {
        if (!input || !input.keys) return;
        
        this.moveLeft = input.keys['a'] || input.keys['arrowleft'] || false;
        this.moveRight = input.keys['d'] || input.keys['arrowright'] || false;
        this.moveUp = input.keys['w'] || input.keys['arrowup'] || false;
        this.moveDown = input.keys['s'] || input.keys['arrowdown'] || false;
    }

    /**
     * 更新小船
     */
    updateBoat(deltaTime) {
        const moveSpeed = 200;
        
        // 只处理左右移动
        if (this.moveLeft) {
            this.boat.vx = -moveSpeed;
        } else if (this.moveRight) {
            this.boat.vx = moveSpeed;
        } else {
            this.boat.vx *= 0.9;
        }
        
        // 船的X轴移动
        this.boat.x += this.boat.vx * deltaTime;
        
        // 边界检查（只限制X轴）
        if (this.boat.x < 340) this.boat.x = 340;
        if (this.boat.x > 940) this.boat.x = 940;
        
        // 船的Y轴固定
        this.boat.y = 400;
        this.boat.vy = 0;
    }

    /**
     * 更新障碍物
     */
    updateObstacles(deltaTime) {
        this.obstacleSpawnTimer += deltaTime;
        
        if (this.obstacleSpawnTimer >= this.obstacleSpawnInterval) {
            this.obstacleSpawnTimer = 0;
            
            this.obstacles.push({
                x: Math.random() * 600 + 340,
                y: -50,
                width: 80,
                height: 80,
            });
        }
        
        // 移动障碍物（向下）
        this.obstacles.forEach(obstacle => {
            obstacle.y += 200 * deltaTime;
        });
        
        // 移除超出屏幕的障碍物
        this.obstacles = this.obstacles.filter(obstacle => obstacle.y < 650);
        
        // 碰撞检测
        this.obstacles.forEach(obstacle => {
            const boatRect = {
                x: this.boat.x - this.boat.width / 2,
                y: this.boat.y - this.boat.height / 2,
                width: this.boat.width,
                height: this.boat.height,
            };
            
            if (CollisionDetector.aabb(boatRect, obstacle)) {
                this.fail();
            }
        });
    }

    /**
     * 渲染游戏
     */
    render(ctx) {
        ctx.save();
        
        if (this.backgroundImage && this.boatImage && this.rockImage)
        {
            ctx.drawImage(this.backgroundImage, 0, 0, 1280, 720);
            ctx.drawImage(
                this.boatImage,
                this.boat.x - this.boat.width / 2,
                this.boat.y - this.boat.height / 2,
                this.boat.width,
                this.boat.height
            );
            this.obstacles.forEach(obstacle => {
                ctx.drawImage(this.rockImage,obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            });
        }

        else
        {
            // 背景
            ctx.fillStyle = '#1E90FF';
            ctx.fillRect(0, 0, 800, 600);
            
            // 河岸
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(0, 0, 50, 600);
            ctx.fillRect(750, 0, 50, 600);
            
            // 障碍物
            ctx.fillStyle = '#666666';
            this.obstacles.forEach(obstacle => {
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            });
            
            // 小船
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(
                this.boat.x - this.boat.width / 2,
                this.boat.y - this.boat.height / 2,
                this.boat.width,
                this.boat.height
            );
        }

        // UI文字
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.fillText(`进度: ${Math.floor(this.distanceTraveled / this.targetDistance * 100)}%`, 20, 30);
        ctx.fillText(`分数: ${Math.floor(this.score)}`, 20, 60);
        
        ctx.restore();
    }
}
