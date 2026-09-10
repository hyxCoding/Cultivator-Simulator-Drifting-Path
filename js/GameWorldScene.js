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
    }

    exit() {
        super.exit();
        
        // 停用当前地图
        if (this.main.currentMap) {
            this.main.currentMap.deactivate();
        }
    }
}