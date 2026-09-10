/**
 * 小游戏管理器（修正版）
 * 统一管理所有小游戏的创建、更新和渲染
 */
class MiniGameManager {
    constructor() {
        this.miniGames = new Map();      // 小游戏实例 {id: MiniGame}
        this.currentMiniGame = null;     // 当前进行的小游戏
        this.isPlaying = false;          // 是否正在游戏中
        this.isFinished = false;         // 游戏是否刚结束（完成或失败）
        
        // 回调
        this.onGameStart = null;    // 小游戏开始回调 (gameId, miniGame) => void
        this.onGameComplete = null; // 小游戏完成回调 (gameId, result) => void
        this.onGameFail = null;     // 小游戏失败回调 (gameId, result) => void
        this.onGameExit = null;     // 小游戏退出回调 (gameId) => void
    }

    /**
     * 注册小游戏
     * @param {string} gameId - 小游戏ID
     * @param {MiniGame} miniGame - 小游戏实例
     */
    registerMiniGame(gameId, miniGame) {
        this.miniGames.set(gameId, miniGame);
    }

    /**
     * 批量注册小游戏
     * @param {Object} games - {gameId: MiniGame}
     */
    registerMiniGames(games) {
        for (const gameId in games) {
            this.registerMiniGame(gameId, games[gameId]);
        }
    }

    /**
     * 开始小游戏
     * @param {string} gameId - 小游戏ID
     * @returns {boolean} 是否开始成功
     */
    startMiniGame(gameId) {
        const miniGame = this.miniGames.get(gameId);
        
        if (!miniGame) {
            console.warn(`小游戏不存在: ${gameId}`);
            return false;
        }
        
        if (this.isPlaying) {
            console.warn('已有小游戏在进行中');
            return false;
        }
        
        this.currentMiniGame = miniGame;
        this.isPlaying = true;
        this.isFinished = false;
        
        // 绑定小游戏回调
        this.bindMiniGameCallbacks(miniGame);
        
        // 开始小游戏
        miniGame.start();
        
        if (this.onGameStart) {
            this.onGameStart(gameId, miniGame);
        }
        
        return true;
    }

    /**
     * 绑定小游戏回调
     */
    bindMiniGameCallbacks(miniGame) {
        const gameId = miniGame.id;
        
        miniGame.onComplete = (result) => {
            this.isPlaying = false;
            this.isFinished = true;
            
            if (this.onGameComplete) {
                this.onGameComplete(gameId, result);
            }
        };
        
        miniGame.onFail = (result) => {
            this.isPlaying = false;
            this.isFinished = true;
            
            if (this.onGameFail) {
                this.onGameFail(gameId, result);
            }
        };
        
        miniGame.onExit = () => {
            this.isPlaying = false;
            this.isFinished = false;
            
            if (this.onGameExit) {
                this.onGameExit(gameId);
            }
        };
    }

    /**
     * 结束当前小游戏
     */
    endCurrentMiniGame() {
        if (this.currentMiniGame) {
            this.currentMiniGame.exit();
        }
        
        this.currentMiniGame = null;
        this.isPlaying = false;
        this.isFinished = false;
    }

    /**
     * 更新当前小游戏
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态
     */
    update(deltaTime, input) {
        if (this.currentMiniGame && this.isPlaying) {
            this.currentMiniGame.update(deltaTime, input);
        }
    }

    /**
     * 渲染当前小游戏
     * 完成/失败后仍渲染最后一帧，由外部决定何时清除
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (this.currentMiniGame) {
            // 游戏进行中或刚结束都渲染
            this.currentMiniGame.render(ctx);
        }
    }

    /**
     * 获取当前小游戏
     */
    getCurrentMiniGame() {
        return this.currentMiniGame;
    }

    /**
     * 获取当前小游戏ID
     */
    getCurrentGameId() {
        return this.currentMiniGame ? this.currentMiniGame.id : null;
    }

    /**
     * 获取当前小游戏结果
     */
    getCurrentGameResult() {
        if (this.currentMiniGame) {
            return this.currentMiniGame.result;
        }
        return null;
    }

    /**
     * 检查是否有小游戏正在进行
     */
    isGamePlaying() {
        return this.isPlaying;
    }

    /**
     * 检查小游戏是否刚结束
     */
    isGameFinished() {
        return this.isFinished;
    }

    /**
     * 清除当前小游戏状态（在获取结果后调用）
     */
    clearCurrentGame() {
        this.currentMiniGame = null;
        this.isPlaying = false;
        this.isFinished = false;
    }

    /**
     * 获取所有已注册的小游戏
     */
    getAllMiniGames() {
        return this.miniGames;
    }

    /**
     * 序列化小游戏管理器状态（用于存档）
     */
    serialize() {
        return {
            isPlaying: this.isPlaying,
            isFinished: this.isFinished,
            currentGameId: this.currentMiniGame ? this.currentMiniGame.id : null,
            currentGameState: this.currentMiniGame ? this.currentMiniGame.serialize() : null,
        };
    }

    /**
     * 反序列化小游戏管理器状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.isPlaying = data.isPlaying || false;
        this.isFinished = data.isFinished || false;
        
        if (data.currentGameId) {
            this.currentMiniGame = this.miniGames.get(data.currentGameId) || null;
            
            if (this.currentMiniGame && data.currentGameState) {
                this.currentMiniGame.deserialize(data.currentGameState);
            }
        }
    }
}