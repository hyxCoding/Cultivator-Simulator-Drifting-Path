

/**
 * 动画类（修正版）
 * 一个动画实例 = 一张精灵图 + 方向配置
 * 精灵图内实际包含上下左右四个方向的帧序列
 * 支持行排列和列排列两种模式
 */
class Animation {
    /**
     * @param {Object} config - 动画配置
     * @param {string} config.name - 动画名称（如 'idle', 'walk', 'attack'）
     * @param {Image} config.spriteSheet - 精灵图图片对象
     * @param {number} config.frameWidth - 每帧宽度（像素）
     * @param {number} config.frameHeight - 每帧高度（像素）
     * @param {string} config.directionMode - 方向排列模式：
     *   'row'（每个方向占一行，帧从左到右）
     *   'column'（每个方向占一列，帧从上到下）
     * @param {Object} config.directions - 方向配置
     *   行排列模式：{ down: {row: 0, frames: 4}, up: {row: 1, frames: 4}, left: {row: 2, frames: 4}, right: {row: 3, frames: 4} }
     *   列排列模式：{ down: {col: 0, frames: 4}, up: {col: 1, frames: 4}, left: {col: 2, frames: 4}, right: {col: 3, frames: 4} }
     * @param {number} config.fps - 播放帧率（帧/秒），默认12
     * @param {boolean} config.loop - 是否循环播放，默认true
     * @param {number} config.scale - 缩放比例，默认1
     * @param {string} config.defaultDirection - 默认方向，'down' | 'up' | 'left' | 'right'，默认'down'
     */
    constructor(config) {
        this.name = config.name || 'animation';
        this.spriteSheet = config.spriteSheet;
        this.frameWidth = config.frameWidth;
        this.frameHeight = config.frameHeight;
        this.directionMode = config.directionMode || 'row'; // 'row' 或 'column'
        this.directions = config.directions || {};
        this.fps = config.fps || 12;
        this.loop = config.loop !== undefined ? config.loop : true;
        this.scale = config.scale || 1;
        this.defaultDirection = config.defaultDirection || 'down';
        
        // 动画状态
        this.currentDirection = this.defaultDirection;
        this.currentFrame = 0;       // 当前帧索引（相对于当前方向）
        this.elapsedTime = 0;        // 累计时间
        this.isPlaying = false;
        this.isFinished = false;
        this.frameInterval = 1 / this.fps;
        
        // 回调函数
        this.onComplete = null;         // 非循环动画播放完成回调
        this.onFrameChange = null;      // 帧变化回调
        this.onDirectionChange = null;  // 方向切换回调
        
        // 预计算每个方向的源矩形
        this.directionSourceRects = {};
        this.calculateDirectionSourceRects();
        
        // 缓存当前方向数据
        this.updateCurrentDirectionData();
    }

    /**
     * 计算每个方向的源矩形
     */
    calculateDirectionSourceRects() {
        this.directionSourceRects = {};
        
        for (const direction in this.directions) {
            const dirConfig = this.directions[direction];
            const frames = dirConfig.frames || 1;
            const sourceRects = [];
            
            if (this.directionMode === 'column') {
                // 列排列：该方向占一列，帧从上到下排列
                const col = dirConfig.col !== undefined ? dirConfig.col : 0;
                for (let i = 0; i < frames; i++) {
                    sourceRects.push({
                        x: col * this.frameWidth,
                        y: i * this.frameHeight,
                        width: this.frameWidth,
                        height: this.frameHeight,
                    });
                }
            } else {
                // 行排列（默认）：该方向占一行，帧从左到右排列
                const row = dirConfig.row !== undefined ? dirConfig.row : 0;
                for (let i = 0; i < frames; i++) {
                    sourceRects.push({
                        x: i * this.frameWidth,
                        y: row * this.frameHeight,
                        width: this.frameWidth,
                        height: this.frameHeight,
                    });
                }
            }
            
            this.directionSourceRects[direction] = sourceRects;
        }
    }

    /**
     * 更新当前方向的数据缓存
     */
    updateCurrentDirectionData() {
        this.currentSourceRects = this.directionSourceRects[this.currentDirection] || [];
        this.currentFrameCount = this.currentSourceRects.length;
        
        // 确保当前帧索引在有效范围内
        if (this.currentFrame >= this.currentFrameCount) {
            this.currentFrame = 0;
        }
    }

    /**
     * 切换方向
     * @param {string} direction - 目标方向：'up' | 'down' | 'left' | 'right'
     * @param {Object} options - 选项
     * @param {boolean} options.resetFrame - 是否重置到该方向的第0帧，默认false
     */
    setDirection(direction, options = {}) {
        // 检查方向是否已配置
        if (!this.directionSourceRects[direction]) {
            console.warn(`动画 ${this.name} 未配置方向: ${direction}`);
            return false;
        }
        
        // 检查是否真的切换了方向
        if (this.currentDirection === direction) {
            return true;
        }
        
        this.currentDirection = direction;
        this.updateCurrentDirectionData();
        
        // 是否重置帧
        if (options.resetFrame) {
            this.currentFrame = 0;
            this.elapsedTime = 0;
        } else {
            // 保持帧索引在有效范围内
            if (this.currentFrame >= this.currentFrameCount) {
                this.currentFrame = this.currentFrameCount - 1;
            }
        }
        
        // 触发方向切换回调
        if (this.onDirectionChange) {
            this.onDirectionChange(this.currentDirection, this);
        }
        
        return true;
    }

    /**
     * 播放动画
     * @param {Object} options - 播放选项
     * @param {boolean} options.reset - 是否重置到第一帧，默认false
     * @param {boolean} options.loop - 是否循环播放，覆盖构造函数中的设置
     * @param {number} options.fps - 播放帧率，覆盖构造函数中的设置
     * @param {string} options.direction - 播放方向，覆盖当前方向
     */
    play(options = {}) {
        if (options.direction) {
            this.setDirection(options.direction, { resetFrame: options.reset });
        }
        
        if (options.reset !== false) {
            this.reset();
        }
        
        if (options.loop !== undefined) {
            this.loop = options.loop;
        }
        
        if (options.fps !== undefined) {
            this.fps = options.fps;
            this.frameInterval = 1 / this.fps;
        }
        
        this.isPlaying = true;
        this.isFinished = false;
    }

    /**
     * 停止播放
     */
    stop() {
        this.isPlaying = false;
    }

    /**
     * 暂停播放
     */
    pause() {
        this.isPlaying = false;
    }

    /**
     * 恢复播放
     */
    resume() {
        if (!this.isFinished || this.loop) {
            this.isPlaying = true;
        }
    }

    /**
     * 重置动画到当前方向的第0帧
     */
    reset() {
        this.currentFrame = 0;
        this.elapsedTime = 0;
        this.isFinished = false;
    }

    /**
     * 跳转到指定帧
     * @param {number} frameIndex - 帧索引（相对于当前方向）
     */
    goToFrame(frameIndex) {
        if (frameIndex >= 0 && frameIndex < this.currentFrameCount) {
            this.currentFrame = frameIndex;
            this.elapsedTime = 0;
            
            if (this.onFrameChange) {
                this.onFrameChange(this.currentFrame, this);
            }
        }
    }

    /**
     * 更新动画
     * @param {number} deltaTime - 时间增量（秒）
     */
    update(deltaTime) {
        if (!this.isPlaying || this.isFinished) {
            return;
        }
        
        // 无帧可播
        if (this.currentFrameCount === 0) {
            return;
        }
        
        this.elapsedTime += deltaTime;
        
        if (this.elapsedTime >= this.frameInterval) {
            // 计算前进的帧数
            const framesToAdvance = Math.floor(this.elapsedTime / this.frameInterval);
            this.elapsedTime -= framesToAdvance * this.frameInterval;
            
            const oldFrame = this.currentFrame;
            this.currentFrame += framesToAdvance;
            
            // 检查是否超出帧范围
            if (this.currentFrame >= this.currentFrameCount) {
                if (this.loop) {
                    this.currentFrame = this.currentFrame % this.currentFrameCount;
                } else {
                    this.currentFrame = this.currentFrameCount - 1;
                    this.isPlaying = false;
                    this.isFinished = true;
                    
                    if (this.onComplete) {
                        this.onComplete(this);
                    }
                }
            }
            
            // 触发帧变化回调
            if (oldFrame !== this.currentFrame && this.onFrameChange) {
                this.onFrameChange(this.currentFrame, this);
            }
        }
    }

    /**
     * 渲染当前帧
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} x - 目标x坐标（画布位置）
     * @param {number} y - 目标y坐标（画布位置）
     * @param {number} width - 目标宽度（可选，默认帧宽*缩放）
     * @param {number} height - 目标高度（可选，默认帧高*缩放）
     * @param {Object} options - 渲染选项
     * @param {number} options.alpha - 透明度 0-1
     * @param {number} options.rotation - 旋转角度（弧度）
     * @param {boolean} options.flipX - 是否水平翻转（仅用于特殊效果，正常方向切换不用此参数）
     * @param {boolean} options.flipY - 是否垂直翻转（仅用于特殊效果）
     */
    render(ctx, x, y, width, height, options = {}) {
        if (!this.spriteSheet || !this.currentSourceRects[this.currentFrame]) {
            return;
        }
        
        const sourceRect = this.currentSourceRects[this.currentFrame];
        const targetWidth = width || this.frameWidth * this.scale;
        const targetHeight = height || this.frameHeight * this.scale;
        
        ctx.save();
        
        if (options.alpha !== undefined) {
            ctx.globalAlpha = options.alpha;
        }
        
        if (options.rotation || options.flipX || options.flipY) {
            const centerX = x + targetWidth / 2;
            const centerY = y + targetHeight / 2;
            ctx.translate(centerX, centerY);
            
            if (options.rotation) {
                ctx.rotate(options.rotation);
            }
            if (options.flipX) {
                ctx.scale(-1, 1);
            }
            if (options.flipY) {
                ctx.scale(1, -1);
            }
            
            ctx.drawImage(
                this.spriteSheet,
                sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height,
                -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight
            );
        } else {
            ctx.drawImage(
                this.spriteSheet,
                sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height,
                x, y, targetWidth, targetHeight
            );
        }
        
        ctx.restore();
    }

    /**
     * 获取当前帧源矩形
     */
    getCurrentSourceRect() {
        return this.currentSourceRects[this.currentFrame] || null;
    }

    /**
     * 获取当前方向
     */
    getCurrentDirection() {
        return this.currentDirection;
    }

    /**
     * 获取当前方向的帧数
     */
    getCurrentFrameCount() {
        return this.currentFrameCount;
    }

    /**
     * 检查是否已配置指定方向
     * @param {string} direction - 方向
     */
    hasDirection(direction) {
        return !!this.directionSourceRects[direction];
    }

    /**
     * 克隆动画
     */
    clone() {
        const animation = new Animation({
            name: this.name,
            spriteSheet: this.spriteSheet,
            frameWidth: this.frameWidth,
            frameHeight: this.frameHeight,
            directionMode: this.directionMode,
            directions: JSON.parse(JSON.stringify(this.directions)),
            fps: this.fps,
            loop: this.loop,
            scale: this.scale,
            defaultDirection: this.defaultDirection,
        });
        animation.onComplete = this.onComplete;
        animation.onFrameChange = this.onFrameChange;
        animation.onDirectionChange = this.onDirectionChange;
        return animation;
    }

    /**
     * 序列化动画状态（用于存档）
     */
    serialize() {
        return {
            name: this.name,
            currentDirection: this.currentDirection,
            currentFrame: this.currentFrame,
            isPlaying: this.isPlaying,
            isFinished: this.isFinished,
        };
    }

    /**
     * 反序列化动画状态（用于读档）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        this.name = data.name || this.name;
        if (data.currentDirection && this.hasDirection(data.currentDirection)) {
            this.setDirection(data.currentDirection);
        }
        this.currentFrame = data.currentFrame || 0;
        this.isPlaying = data.isPlaying || false;
        this.isFinished = data.isFinished || false;
    }
}