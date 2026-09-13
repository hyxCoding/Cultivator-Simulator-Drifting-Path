/**
 * 游戏世界场景
 */
class GameWorldScene extends Scene {
    constructor(main) {
        super('gameWorld');
        this.main = main;
    }

    enter(params = {}) {
        super.enter(params);
        console.log('进入游戏世界');
        
        // 激活当前地图
        if (this.main.currentMap) {
            this.main.currentMap.activate();
        }

        // 背景音乐：首次进入（从开始界面）立即播主图 BGM；返回大地图 → 10 秒后再播
        if (this.main && typeof this.main.onGameWorldSceneEnter === 'function') {
            this.main.onGameWorldSceneEnter();
        }
    }

    exit() {
        super.exit();
        
        // 停用当前地图
        if (this.main.currentMap) {
            this.main.currentMap.deactivate();
        }

        // 背景音乐：离开大地图（进小游戏 / 战斗 / 完结界面）→ 主图 BGM 立即停
        if (this.main && typeof this.main.onGameWorldSceneExit === 'function') {
            this.main.onGameWorldSceneExit();
        }
    }
}