/**
 * 小游戏基类
 * 所有小游戏都继承此类
 */
class MiniGame {
    /**
     * @param {Object} config - 小游戏配置
     * @param {string} config.id - 小游戏ID
     * @param {string} config.name - 小游戏名称
     * @param {Object} config.resources - 资源引用 {images: {...}, audio: {...}}
     */
    constructor(config = {}) {
        this.id = config.id || `minigame_${Date.now()}`;
        this.name = config.name || '小游戏';
        this.resources = config.resources || { images: {}, audio: {} };
        
        // ========== 玩家精灵显示尺寸（与大地图一致） ==========
        // 大地图 Player 的精灵帧是 32×32，绘制时按 Player.width*2 × Player.height*2
        // = 48×64 输出（见 js/Player.js 的 render）。小游戏里如果按 32×32 原尺寸画，
        // 角色会比大地图小一圈 → 统一在这里给出显示尺寸，各小游戏渲染玩家时都用它。
        // 注意：这只是「画多大」，不与走位碰撞盒（player.width/height，约 22×26）挂钩；
        // 《逆流送灯》画的是小船而不是角色，不适用本约定。
        this.playerSpriteWidth = 48;
        this.playerSpriteHeight = 64;

        // 状态
        this.isRunning = false;
        this.isPaused = false;
        this.isCompleted = false;
        this.isFailed = false;
        // 「胜利锁定」状态位（需求：只要检测到小游戏胜利，就直接忽略失败）
        // 与 isCompleted 的区别：本标记在**判定到胜利条件的那一刻**就置位（早于 complete()），
        // 且之后（含重开前的收尾阶段）任何 fail() 一律被忽略 —— 防止同一局里「成功 / 失败」
        // 两套判断逻辑各跑一次，导致胜利与失败音效同时响（见 HerbCollectMiniGame）。
        this.isWinLocked = false;
        
        // 计时
        this.gameTimer = 0;
        // 时间限制（秒）：0 = 不限时（如第二章「认灯归魂」），故不能用 || 兜底
        this.timeLimit = config.timeLimit !== undefined ? config.timeLimit : 60;
        
        // 得分
        this.score = 0;
        this.maxScore = config.maxScore || 100;
        
        // 回调
        this.onComplete = null;  // 完成回调 (result) => void
        this.onFail = null;      // 失败回调 (result) => void
        this.onExit = null;      // 退出回调
        
        // 结果
        this.result = null;
    }

    /**
     * 开始小游戏
     */
    start() {
        this.isRunning = true;
        this.isPaused = false;
        this.isCompleted = false;
        this.isFailed = false;
        this.isWinLocked = false;      // 新一局解锁（见构造函数的「胜利锁定」说明）
        this.gameTimer = 0;
        this.score = 0;
    }

    /**
     * 更新小游戏
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态
     */
    update(deltaTime, input) {
        if (!this.isRunning || this.isPaused) return;
        
        this.gameTimer += deltaTime;
        
        // 检查时间限制
        if (this.timeLimit > 0 && this.gameTimer >= this.timeLimit) {
            this.checkTimeUp();
        }
    }

    /**
     * 检查时间到
     */
    checkTimeUp() {
        if (this.score >= this.getPassScore()) {
            this.complete();
        } else {
            this.fail();
        }
    }

    /**
     * 获取及格分数
     */
    getPassScore() {
        return this.maxScore * 0.6; // 默认60%及格
    }

    /**
     * 完成小游戏
     * 同一局只结算一次：已经结算过（完成 / 失败）后调用直接返回 false。
     * 需要这道闸是因为「两种结算可能落在同一帧」（例：乘风采药最后一株草药长在虚空上、
     * 同帧风又停了 → 旧顺序先 fail() 再 complete()，成功 / 失败音效一起响、结算界面连开两次）。
     * 完成即置「胜利锁定」（isWinLocked）：之后同一局的 fail() 一律被忽略。
     * @returns {boolean} 本次调用是否真的完成了小游戏
     */
    complete() {
        if (this.isCompleted || this.isFailed) return false;

        this.isRunning = false;
        this.isCompleted = true;
        this.isWinLocked = true;      // 胜利锁定：本局不再接受任何失败判定（见构造函数说明）
        
        this.result = {
            success: true,
            score: this.score,
            maxScore: this.maxScore,
            timeUsed: this.gameTimer,
            rating: this.getRating(),
        };
        
        if (this.onComplete) {
            this.onComplete(this.result);
        }
        return true;
    }

    /**
     * 失败小游戏
     * 同一局只结算一次（同 complete()：重复调用 / 结算后再 complete 都不再触发）。
     * 另外：本局已经胜利（isWinLocked / isCompleted）→ 直接忽略（需求：检测到胜利就不再判失败），
     * 否则胜利与失败音效会在同一局里各响一次。
     * @returns {boolean} 本次调用是否真的判定了失败
     */
    fail() {
        if (this.isWinLocked || this.isCompleted) return false;
        if (this.isFailed) return false;

        this.isRunning = false;
        this.isFailed = true;
        
        this.result = {
            success: false,
            score: this.score,
            maxScore: this.maxScore,
            timeUsed: this.gameTimer,
            rating: 'fail',
        };
        
        if (this.onFail) {
            this.onFail(this.result);
        }
        return true;
    }

    /**
     * 获取评级
     */
    getRating() {
        const ratio = this.score / this.maxScore;
        
        if (ratio >= 0.9) return 'perfect';
        if (ratio >= 0.75) return 'excellent';
        if (ratio >= 0.6) return 'good';
        return 'pass';
    }

    /**
     * 暂停小游戏
     */
    pause() {
        this.isPaused = true;
    }

    /**
     * 恢复小游戏
     */
    resume() {
        this.isPaused = false;
    }

    /**
     * 退出小游戏
     */
    exit() {
        this.isRunning = false;
        
        if (this.onExit) {
            this.onExit();
        }
    }

    /**
     * 渲染小游戏
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        // 子类实现
    }

    /**
     * 序列化小游戏状态（用于存档）
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            isCompleted: this.isCompleted,
            isFailed: this.isFailed,
            isWinLocked: this.isWinLocked,
            gameTimer: this.gameTimer,
            score: this.score,
        };
    }

    /**
     * 反序列化小游戏状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.id = data.id || this.id;
        this.name = data.name || this.name;
        this.isRunning = data.isRunning || false;
        this.isPaused = data.isPaused || false;
        this.isCompleted = data.isCompleted || false;
        this.isFailed = data.isFailed || false;
        // 读档兜底：已完成但旧档没有本字段时，同样视为「胜利锁定」
        this.isWinLocked = data.isWinLocked !== undefined
            ? !!data.isWinLocked
            : (this.isCompleted === true);
        this.gameTimer = data.gameTimer || 0;
        this.score = data.score || 0;
    }
}