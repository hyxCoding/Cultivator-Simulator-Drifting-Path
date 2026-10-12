class MiniGameScene extends Scene {
    constructor(main) {
        super('miniGame');
        this.main = main;
        this.gameId = null;
    }
    
    enter(params = {}) {
        super.enter(params);
        this.gameId = params.gameId || null;
        this.params = params.params || {};
        this.services = params.services || null;
        
        // 兜底启动：正常情况下 Main.startMiniGame 已经在切换场景前启动了小游戏
        // （此时 isPlaying 已为 true，这里不会重复启动）。保留这一条是为了让
        // 「直接 switchScene('miniGame', {gameId, params})」这类路径也能独立工作。
        if (this.gameId && this.main && this.main.miniGameManager
            && !this.main.miniGameManager.isPlaying) {
            this.main.miniGameManager.startMiniGame(this.gameId, this.params, this.services);
        }
    }

    /**
     * 退出小游戏场景 → 清掉「当前小游戏 / 刚结算完成」状态
     *
     * 背景（2026-09-13 审查）：MiniGameScene.update 在 isFinished 为真时每帧都会调
     * Main.handleMiniGameEnd，而 MiniGameManager 里那份状态（currentMiniGame / isFinished）
     * 此前没有任何地方清理 —— 于是「已结算」的小游戏实例会一直挂在管理器上，
     * 只要有人再调 startMiniGame，就会被当成一次干净的新开局（旧 bug：结算当帧的 E 键
     * 经路标重开一局，玩家以为退出了、其实小游戏还在跑）。
     * 现在退出场景即清空：currentMiniGame=null、isPlaying=false、isFinished=false。
     * 注意放在 exit（而不是 handleMiniGameEnd 当帧）里清：handleMiniGameEnd 之后、
     * 场景真正切走之前，渲染仍要用 currentMiniGame 画完最后 1 帧。
     */
    exit() {
        super.exit();
        if (this.main && this.main.miniGameManager) {
            this.main.miniGameManager.clearCurrentGame();
        }
    }
    
    update(deltaTime, input) {
        super.update(deltaTime, input);
        
        if (this.main.miniGameManager.isPlaying) {
            this.main.miniGameManager.update(deltaTime, input);
        }
        
        // 小游戏结束
        if (this.main.miniGameManager.isFinished) {
            const result = this.main.miniGameManager.getCurrentGameResult();
            this.main.handleMiniGameEnd(result);
        }
    }
    
    render(ctx) {
        super.render(ctx);
        if (this.main.miniGameManager.currentMiniGame) {
            this.main.miniGameManager.render(ctx);
        }
    }
}