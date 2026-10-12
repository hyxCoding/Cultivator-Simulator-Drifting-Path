# MiniGame.js — 小游戏系统（独立子系统）

> 对应模块：`MiniGame.js`（基类）、`MiniGameManager.js`（管理器）、`MiniGameScene.js`（场景），
> 以及 5 个小游戏：`HerbCollectMiniGame` `BoatNavigationMiniGame` `LanternIdentifyMiniGame` `BreathControlMiniGame` `MemorySortMiniGame`。

---

## 一、设计目标：与主游戏松耦合

小游戏与主游戏**只在两个时刻通信**：

```
【启动】主游戏 ──start(params, services)──► 小游戏
【结束】小游戏 ──onComplete/onFail(result)──► 主游戏
```

- 小游戏内部**不引用** `Player` / `PlayerData` / `QuestSystem` / `Main` 等任何主游戏状态；
- 小游戏**不直接依赖** `ResourceManager` / `gameAudio` 单例，取图 / 播音走基类服务适配器；
- 因此新增一个小游戏只需新增文件 + 注册一行，**不需要改动主游戏逻辑**。

---

## 二、启动参数契约

### 参数来源
`GameConfig.miniGames[gameId]` 为默认值，`Main.getMiniGameParams(gameId)` 叠加当前剧情 / 玩家状态：

```js
// Main.js
getMiniGameParams(gameId) {
    const params = GameConfig.getInstance().getMiniGameConfig(gameId);
    if (this.player && this.player.playerData) {
        params.playerRealm = this.player.playerData.realm;   // 例：注入当前境界
    }
    return params;
}
```

当前默认参数（`GameConfig.miniGames`）：

| gameId | 参数 |
|---|---|
| `herb_collect` | `timeLimit:0, maxScore:100, requiredHerbs:8` |
| `breath_control` | `timeLimit:30, maxScore:100, totalAttempts:10` |
| `boat_navigation` | `timeLimit:0, maxScore:100, totalObstacles:60` |
| `memory_sort` | `timeLimit:90, maxScore:100` |
| `lantern_identify` | `timeLimit:0, maxScore:100, maxAttempts:3` |

### 服务适配器
`Main.getMiniGameServices()` 提供：

```js
{
    getImage(key),      // 取已缓存图片
    loadImage(key),     // 异步加载图片（返回 Promise）
    playBgm(key),
    stopBgm(key),
    playSfx(key),
}
```

基类封装为 `this.getServiceImage / loadServiceImage / playBgm / stopBgm / playSfx`；
**未注入服务时自动回落** `ResourceManager` / `gameAudio` 单例，保证向后兼容。

---

## 三、结果契约

小游戏结算时回传 `result`（由基类 `complete()` / `fail()` 生成）：

```js
{
    success:   true | false,
    score:     number,
    maxScore:  number,
    timeUsed:  number,     // 秒
    rating:    'perfect' | 'excellent' | 'good' | 'pass' | 'fail',
}
```

个别小游戏会追加字段（如 `lantern_identify` 追加 `litOrder / targetOrder / correctPositions / attemptsUsed`）。

主游戏消费结果的唯一位置：`Main.startMiniGame(gameId, callback)` 的 `callback`。
例如：

```js
this.startMiniGame(gameId, (result) => {
    if (gameId === 'lantern_identify') { this.finishLanternIdentify(result); return; }
    if (gameId === 'boat_navigation')  { this.finishRiverEscort(result);   return; }
    if (!result || !result.success) return;
    if (gameId === 'herb_collect') {
        this.player.questSystem.updateQuestProgress('chapter1_main_2','collect_item','lingcao',3);
        this.playHerbCollectSuccessDialogue(signpost);
    }
});
```

---

## 四、基类 `MiniGame` 接口

```js
class MiniGame {
    constructor(config)          // { id, name, timeLimit, maxScore, resources }

    // 生命周期（由 MiniGameManager 驱动）
    start(params, services)      // 启动：注入参数与服务
    applyParams(params)          // 【子类覆写】读取自己的玩法参数（默认空实现）
    update(dt, input)            // 每帧更新（基类处理计时与超时）
    render(ctx)                  // 【子类实现】绘制
    pause() / resume() / exit()

    // 结算（内部调用，子类触发）
    complete()                   // 成功：置 isWinLocked，触发 onComplete(result)
    fail()                       // 失败：本局已胜利则忽略，触发 onFail(result)
    getRating() / getPassScore() // 评级 / 及格线

    // 服务适配器（见上）
    getServiceImage(key) / loadServiceImage(key) / playBgm / stopBgm / playSfx

    serialize() / deserialize(data)
}
```

### 关键状态位
| 字段 | 含义 |
|---|---|
| `isRunning` | 是否进行中 |
| `isCompleted` / `isFailed` | 是否已结算 |
| `isWinLocked` | **胜利锁定**：判定到胜利那一刻置位，之后本局任何 `fail()` 都被忽略（防止同帧「胜利 + 失败」音效齐响） |
| `gameTimer` / `score` / `result` | 计时 / 得分 / 结果 |

---

## 五、管理器 `MiniGameManager` 接口

```js
const mgr = new MiniGameManager();

mgr.registerMiniGame(gameId, instance)
mgr.registerMiniGames({ herb_collect: new HerbCollectMiniGame(), ... })

mgr.startMiniGame(gameId, params, services)   // → boolean（已在游戏中则拒绝）
mgr.update(dt, input)
mgr.render(ctx)
mgr.endCurrentMiniGame() / clearCurrentGame()

mgr.isGamePlaying() / isGameFinished()
mgr.getCurrentGameResult() / getCurrentParams() / getCurrentGameId()

// 事件（可选订阅；Main 目前用回调链而非这些）
mgr.onGameStart = (gameId, miniGame) => {}
mgr.onGameComplete = (gameId, result) => {}
mgr.onGameFail = (gameId, result) => {}
mgr.onGameExit = (gameId) => {}
```

**一局只结算一次**：内部用 `_runToken` / `_settledRunToken` 闸门，先到达的结算路径（成功或失败）拿走结算权，后到的丢弃（连同音效）。

---

## 六、完整启动链路

```
Main.startMiniGame(gameId, callback)
  ├─ 去重：isMiniGameActive() → 已在小游戏则忽略
  ├─ 保存玩家大地图坐标 _savedPlayerX/Y
  ├─ _resetInputForMiniGame()  ← 放掉主图「按住」的方向键（防止角色一进局就被推走）
  ├─ 停主图 BGM / 起小游戏 BGM
  ├─ params  = getMiniGameParams(gameId)
  ├─ services= getMiniGameServices()
  ├─ sceneManager.switchScene('miniGame', { gameId, params, services })
  └─ miniGameManager.startMiniGame(gameId, params, services)
        └─ miniGame.start(params, services)   ← 【启动】

… 小游戏运行（MiniGameScene.update → miniGameManager.update）…

小游戏 complete()/fail()
  └─ MiniGameManager 的 onComplete/onFail
        └─ isFinished = true + 播胜利/失败音效
MiniGameScene.update 检测 isFinished
  └─ Main.handleMiniGameEnd(result)
        ├─ 停小游戏 BGM
        ├─ 设 0.5 秒 E 键保护期 _miniGameExitGuard
        ├─ switchScene('gameWorld') + 恢复玩家坐标
        └─ callback(result)   ← 【结束】主游戏据此更新任务 / 物品 / 剧情
MiniGameScene.exit()
  └─ miniGameManager.clearCurrentGame()
```

---

## 七、新增一个小游戏

```js
// 1) 新建 js/MyMiniGame.js
class MyMiniGame extends MiniGame {
    constructor(config = {}) {
        super({ id: 'my_game', name: '我的小游戏', timeLimit: 30, maxScore: 100, ...config });
    }
    applyParams(params) {          // 读取主游戏注入的参数
        if (params && params.someValue) this.someValue = params.someValue;
    }
    start(params, services) {      // 必须转发 params / services
        super.start(params, services);
        // 重置本局状态
    }
    update(dt, input) { super.update(dt, input); /* … */ }
    render(ctx) { /* … */ }
}

// 2) game.html 第 12 层引入 <script src="js/MyMiniGame.js"></script>
// 3) Main.initGameSystems 注册：miniGames: { ..., my_game: new MyMiniGame() }
// 4) GameConfig.miniGames 加默认参数
// 5) Main.startMiniGameFromSignpost 里按 gameId 分流结果
```
**无需修改任何既有小游戏的代码。**

---

## 八、本次重构修复

- 删除死代码 `HerbCollectMiniGame_bak.js`（无引用，且与正式版同名类会冲突）。
- 小游戏不再直接调用 `gameAudio` / `ResourceManager` 单例，改走基类服务适配器（未注入时回落单例）。
- 小游戏 `start()` 统一签名 `start(params, services)` 并转发 `super.start(...)`。

> 备注：`breath_control` 与 `memory_sort` 已注册但当前主线未接入（`breath_control` 的任务进度由过场直接写入）。
