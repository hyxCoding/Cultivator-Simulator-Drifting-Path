/**
 * 定息引气小游戏
 * 通过宽松的节奏判定疏通灵气
 */
class BreathControlMiniGame extends MiniGame {
    /**
     * @param {Object} config - 配置
     */
    constructor(config = {}) {
        super({
            id: 'breath_control',
            name: '定息引气',
            timeLimit: 30,
            maxScore: 100,
            ...config,
        });
        
        // ========== 游戏元素 ==========
        this.circleRadius = 150;       // 外圈半径
        this.innerCircleRadius = 80;   // 内圈半径
        this.targetZoneRadius = 30;    // 目标区域半径
        this.centerX = 400;
        this.centerY = 300;
        
        // 移动点
        this.dotAngle = 0;
        this.dotSpeed = 2; // 弧度/秒
        this.dotRadius = 10;
        
        // 节奏判定
        this.pressTiming = 0;
        this.perfectTiming = 0.15;  // 完美判定时间窗口（秒）
        this.goodTiming = 0.3;      // 良好判定时间窗口（秒）
        
        // 成功次数
        this.successCount = 0;
        this.perfectCount = 0;
        this.totalAttempts = 10;
        
        // 灵气粒子
        this.particles = [];
    }

    /**
     * 开始游戏
     */
    start() {
        super.start();
        this.dotAngle = 0;
        this.successCount = 0;
        this.perfectCount = 0;
        this.particles = [];
    }

    /**
     * 更新游戏
     */
    update(deltaTime, input) {
        super.update(deltaTime, input);
        
        if (!this.isRunning || this.isPaused) return;
        
        // 更新移动点位置
        this.dotAngle += this.dotSpeed * deltaTime;
        
        // 检查按键
        if (input && input.pressedKeys && 
            (input.pressedKeys[' '] || input.pressedKeys['j'])) {
            this.checkTiming();
        }
        
        // 更新粒子
        this.particles.forEach(particle => {
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            particle.life -= deltaTime;
            particle.alpha = particle.life / particle.maxLife;
        });
        this.particles = this.particles.filter(p => p.life > 0);
        
        // 检查完成
        if (this.successCount >= this.totalAttempts) {
            this.score = this.maxScore * (this.successCount / this.totalAttempts);
            this.complete();
        }
    }

    /**
     * 检查节奏判定
     */
    checkTiming() {
        // 计算移动点到目标区域的距离
        const dotX = this.centerX + Math.cos(this.dotAngle) * this.circleRadius;
        const dotY = this.centerY + Math.sin(this.dotAngle) * this.circleRadius;
        
        const targetX = this.centerX;
        const targetY = this.centerY - this.innerCircleRadius;
        
        const distance = Math.sqrt(
            Math.pow(dotX - targetX, 2) +
            Math.pow(dotY - targetY, 2)
        );
    
        let timing = 'miss';
        if (distance <= this.targetZoneRadius) {
            timing = 'perfect';
            this.perfectCount++;
            this.score += this.maxScore / this.totalAttempts;
        } else if (distance <= this.targetZoneRadius * 2) {
            timing = 'good';
            this.score += (this.maxScore / this.totalAttempts) * 0.7;
        }
        
        if (timing !== 'miss') {
            this.successCount++;
            this.createSuccessParticles(timing);
        }
    }

    /**
     * 创建成功粒子
     */
    createSuccessParticles(timing) {
        const color = timing === 'perfect' ? '#FFD700' : '#00FF00';
        const particleCount = timing === 'perfect' ? 20 : 10;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 150;
            
            this.particles.push({
                x: this.centerX,
                y: this.centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                maxLife: 1,
                alpha: 1,
                color: color,
            });
        }
    }

    /**
     * 渲染游戏
     */
    render(ctx) {
        ctx.save();
        
        // 背景
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, 800, 600);
        
        // 外圈
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.circleRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 内圈
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.innerCircleRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 目标区域
        const targetX = this.centerX;
        const targetY = this.centerY - this.innerCircleRadius;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(targetX, targetY, this.targetZoneRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 移动点
        const dotX = this.centerX + Math.cos(this.dotAngle) * this.circleRadius;
        const dotY = this.centerY + Math.sin(this.dotAngle) * this.circleRadius;
        ctx.fillStyle = '#FF6347';
        ctx.beginPath();
        ctx.arc(dotX, dotY, this.dotRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 粒子
        this.particles.forEach(particle => {
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = particle.alpha;
            ctx.fillRect(particle.x - 3, particle.y - 3, 6, 6);
        });
        ctx.globalAlpha = 1;
        
        // UI文字
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.fillText(`成功: ${this.successCount}/${this.totalAttempts}`, 20, 30);
        ctx.fillText(`完美: ${this.perfectCount}`, 20, 60);
        ctx.fillText(`分数: ${Math.floor(this.score)}`, 20, 90);
        ctx.fillText('按空格键或J键进行判定', 20, 550);
        
        ctx.restore();
    }
}