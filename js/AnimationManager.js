
/**
 * 动画管理器类（修正版）
 * 管理角色的所有动画，支持方向切换
 */
class AnimationManager {
    constructor() {
        this.animations = new Map(); // 动画集合 {name: Animation}
        this.currentAnimation = null;
        this.currentAnimationName = null;
        this.currentDirection = 'down'; // 当前方向
    }

    /**
     * 添加动画
     */
    addAnimation(name, animation) {
        this.animations.set(name, animation);
        if (!this.currentAnimation) {
            this.currentAnimation = animation;
            this.currentAnimationName = name;
        }
    }

    /**
     * 批量添加动画
     */
    addAnimations(animations) {
        for (const name in animations) {
            this.addAnimation(name, animations[name]);
        }
    }

    /**
     * 播放指定动画
     * @param {string} name - 动画名称
     * @param {Object} options - 播放选项
     * @param {string} options.direction - 播放方向
     * @param {boolean} options.reset - 是否重置
     * @param {boolean} options.loop - 是否循环
     */
    play(name, options = {}) {
        const animation = this.animations.get(name);
        if (!animation) {
            console.warn(`动画不存在: ${name}`);
            return null;
        }
        
        // 如果方向有变化，先切换方向
        const direction = options.direction || this.currentDirection;
        if (animation.hasDirection(direction)) {
            animation.setDirection(direction);
            this.currentDirection = direction;
        }
        
        // 切换动画
        if (this.currentAnimationName !== name) {
            if (this.currentAnimation) {
                this.currentAnimation.stop();
            }
            this.currentAnimation = animation;
            this.currentAnimationName = name;
        }
        
        animation.play(options);
        return animation;
    }

    /**
     * 切换当前动画的方向
     * @param {string} direction - 方向：'up' | 'down' | 'left' | 'right'
     */
    setDirection(direction) {
        this.currentDirection = direction;
        if (this.currentAnimation) {
            this.currentAnimation.setDirection(direction);
        }
    }

    /**
     * 获取当前方向
     */
    getDirection() {
        return this.currentDirection;
    }

    /**
     * 停止当前动画
     */
    stop() {
        if (this.currentAnimation) {
            this.currentAnimation.stop();
        }
    }

    /**
     * 暂停当前动画
     */
    pause() {
        if (this.currentAnimation) {
            this.currentAnimation.pause();
        }
    }

    /**
     * 恢复当前动画
     */
    resume() {
        if (this.currentAnimation) {
            this.currentAnimation.resume();
        }
    }

    /**
     * 更新当前动画
     */
    update(deltaTime) {
        if (this.currentAnimation) {
            this.currentAnimation.update(deltaTime);
        }
    }

    /**
     * 渲染当前动画
     */
    render(ctx, x, y, width, height, options = {}) {
        if (this.currentAnimation) {
            this.currentAnimation.render(ctx, x, y, width, height, options);
        }
    }

    /**
     * 获取当前动画
     */
    getCurrentAnimation() {
        return this.currentAnimation;
    }

    /**
     * 获取指定动画
     */
    getAnimation(name) {
        return this.animations.get(name) || null;
    }

    /**
     * 检查是否存在指定动画
     */
    hasAnimation(name) {
        return this.animations.has(name);
    }

    /**
     * 序列化（用于存档）
     */
    serialize() {
        const animationStates = {};
        this.animations.forEach((animation, name) => {
            animationStates[name] = animation.serialize();
        });
        
        return {
            currentAnimationName: this.currentAnimationName,
            currentDirection: this.currentDirection,
            animations: animationStates,
        };
    }

    /**
     * 反序列化（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        if (data.animations) {
            for (const name in data.animations) {
                const animation = this.animations.get(name);
                if (animation) {
                    animation.deserialize(data.animations[name]);
                }
            }
        }
        
        if (data.currentAnimationName) {
            this.currentAnimation = this.animations.get(data.currentAnimationName) || null;
            this.currentAnimationName = data.currentAnimationName;
        }
        
        if (data.currentDirection) {
            this.currentDirection = data.currentDirection;
            if (this.currentAnimation) {
                this.currentAnimation.setDirection(data.currentDirection);
            }
        }
    }
}