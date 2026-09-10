class MiniGameScene extends Scene {
    constructor(main) {
        super('miniGame');
        this.main = main;
        this.gameId = null;
    }
    
    enter(params = {}) {
        super.enter(params);
        this.gameId = params.gameId || null;
        
        if (this.gameId) {
            this.main.miniGameManager.startMiniGame(this.gameId);
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