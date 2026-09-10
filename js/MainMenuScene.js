/**
 * 主菜单场景
 */
class MainMenuScene extends Scene {
    constructor(main) {
        super('mainMenu');
        this.main = main;
    }

    enter(params = {}) {
        super.enter(params);
        console.log('进入主菜单');
    }

    update(deltaTime, input) {
        super.update(deltaTime, input);
        
        // 按任意键开始游戏
        if (input && input.pressedKeys && Object.keys(input.pressedKeys).length > 0) {
            this.main.sceneManager.switchScene('gameWorld');
        }
        
        // 鼠标点击开始
        if (input && input.mouseClicked) {
            this.main.sceneManager.switchScene('gameWorld');
        }
    }
}