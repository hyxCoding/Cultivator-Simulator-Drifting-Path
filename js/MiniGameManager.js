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

        // 结算闸门：一次开局只允许结算一次（先到的那条路径生效）
        // 背景：小游戏内部有「胜利 / 失败」两套判断逻辑，若同一局里两条路径都被触发，
        // 这里就会跟着播两次结算音效（胜利 + 失败同时响）。用「开局序号」把结算绑到本局：
        // _runToken 每次 startMiniGame +1，_settledRunToken 记录已经结算过的那一局。
        this._runToken = 0;
        this._settledRunToken = -1;
        this._currentParams = {};        // 本局启动参数（主游戏注入，见 startMiniGame）
        
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
     * @param {Object} [params] - 主游戏注入的启动参数（纯数据，见 GameConfig.miniGames[gameId]）
     * @param {Object} [services] - 可选服务适配器（资源 / 音频），不传则由小游戏回落全局单例
     * @returns {boolean} 是否开始成功
     */
    startMiniGame(gameId, params = {}, services = null) {
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
        this._runToken += 1;              // 新一局：结算闸门随之翻页（见构造函数说明）
        this._currentParams = params || {};
        
        // 绑定小游戏回调
        this.bindMiniGameCallbacks(miniGame);
        
        // 开始小游戏（把启动参数与服务注入进去 —— 小游戏与主游戏的「启动」通信唯一入口）
        miniGame.start(this._currentParams, services);
        
        if (this.onGameStart) {
            this.onGameStart(gameId, miniGame);
        }
        
        return true;
    }

    /**
     * 内部：认领本局结算权（一次开局只允许结算一次）
     * 第一条到达的结算路径（成功 / 失败）拿走本局的结算权，后到的直接丢弃 ——
     * 连 onGameComplete / onGameFail 回调与结算音效一起拦住。
     * @param {number} runToken - 开局序号（bindMiniGameCallbacks 时固定）
     * @param {string} gameId
     * @param {string} outcome - 'success' | 'fail'（仅用于日志）
     * @returns {boolean} 是否拿到结算权
     */
    _claimSettlement(runToken, gameId, outcome) {
        if (this._settledRunToken === runToken) {
            console.warn(`[小游戏] ${gameId} 本局已结算，忽略重复结算：${outcome}`);
            return false;
        }
        this._settledRunToken = runToken;
        return true;
    }

    /**
     * 绑定小游戏回调
     */
    bindMiniGameCallbacks(miniGame) {
        const gameId = miniGame.id;
        const runToken = this._runToken;   // 把回调绑到「这一局」，见 _claimSettlement
        
        miniGame.onComplete = (result) => {
            if (!this._claimSettlement(runToken, gameId, 'success')) return;

            this.isPlaying = false;
            this.isFinished = true;

            // 胜利音效：小游戏成功（缺失音频文件时静默跳过；同种音效 0.2 秒内不重复，见 AudioManager）
            gameAudio.playSfx('sfx.victory');

            if (this.onGameComplete) {
                this.onGameComplete(gameId, result);
            }
        };
        
        miniGame.onFail = (result) => {
            // 胜利锁定（isWinLocked / isCompleted）：本局已经赢了 → 失败直接丢弃
            // （小游戏基类里 fail() 已经拦了一层，这里是最后一道闸，确保失败音效不会响）
            if (miniGame.isWinLocked || miniGame.isCompleted) {
                console.warn(`[小游戏] ${gameId} 本局已胜利，忽略失败结算`);
                return;
            }
            if (!this._claimSettlement(runToken, gameId, 'fail')) return;

            this.isPlaying = false;
            this.isFinished = true;

            // 失败音效：小游戏失败
            gameAudio.playSfx('sfx.defeat');

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
     * 获取本局启动参数
     */
    getCurrentParams() {
        return this._currentParams;
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