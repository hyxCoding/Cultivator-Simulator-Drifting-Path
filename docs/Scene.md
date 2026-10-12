# Scene.js / SceneManager.js — 场景系统

> 对应模块：`Scene.js`（基类）、`SceneManager.js`（管理器）、
> `MainMenuScene` `GameWorldScene` `BattleScene` `MiniGameScene` `EndingScene`（具体场景）。

---

## 一、场景基类 `Scene`

```js
class Scene {
    constructor(id)          // 场景 ID
    enter(params)            // 【子类覆写】进入场景（接收切换时传入的参数）
    exit()                   // 【子类覆写】退出场景
    update(dt, input)        // 【子类覆写】每帧更新
    render(ctx)              // 【子类覆写】绘制
    isActive()               // 是否当前激活场景
}
```

## 二、场景管理器 `SceneManager`

```js
const sm = new SceneManager();

sm.registerScene('gameWorld', new GameWorldScene(main));
sm.switchScene('gameWorld', { ...params });   // 只登记「待切换」，真正切换在 update 内
sm.update(dt, input);
sm.render(ctx);
sm.getCurrentScene() / getCurrentSceneId();
sm.serialize() / deserialize(data);
```

**切换是延迟的**：`switchScene` 只写 `nextSceneId`，实际 `exit → enter` 发生在下一次 `SceneManager.update` 的 `performSceneSwitch`。
这样可以在当前帧安全地完成渲染与结算，避免「渲染到一半场景被换掉」。

---

## 三、各场景职责

| 场景 | 职责 |
|---|---|
| `MainMenuScene` | 开始界面：背景 / 标题按钮（悬停上浮 + 点击），点击 → `switchScene('gameWorld')` |
| `GameWorldScene` | 大地图：`enter/exit` 只做 BGM 切换（`onGameWorldSceneEnter/Exit`），实体更新由 `GameLoop` 驱动 |
| `BattleScene` | 回合制战斗：驱动 `battleSystem.update`，战斗结束切回 `gameWorld` |
| `MiniGameScene` | 小游戏：`enter` 兜底启动小游戏，`update` 驱动并检测结算，`exit` 清理小游戏状态 |
| `EndingScene` | 结局滚动字幕（见 [EndingScene.md](EndingScene.md)） |

### MiniGameScene 细节（重构后）

```js
enter(params) {
    this.gameId  = params.gameId;
    this.params  = params.params;      // 主游戏注入的启动参数
    this.services= params.services;    // 资源 / 音频适配器
    // 兜底启动：正常路径下 Main 已启动，这里不会重复
    if (this.gameId && !main.miniGameManager.isPlaying) {
        main.miniGameManager.startMiniGame(this.gameId, this.params, this.services);
    }
}
update(dt, input) {
    if (miniGameManager.isPlaying) miniGameManager.update(dt, input);
    if (miniGameManager.isFinished) main.handleMiniGameEnd(miniGameManager.getCurrentGameResult());
}
exit() { miniGameManager.clearCurrentGame(); }   // 场景真正切走后才清，保证结算帧能画完最后一帧
```

---

## 四、新增场景

```js
class MyScene extends Scene {
    constructor(main) { super('myScene'); this.main = main; }
    enter(params = {}) { super.enter(params); /* … */ }
    exit() { super.exit(); /* … */ }
    update(dt, input) { super.update(dt, input); /* … */ }
    render(ctx) { super.render(ctx); /* … */ }
}
// Main.initScenes() 中：this.scenes.myScene = new MyScene(this);
// 然后 sceneManager.switchScene('myScene', {...})
```
