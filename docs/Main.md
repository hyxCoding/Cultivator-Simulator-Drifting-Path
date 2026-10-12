# Main.js — 主程序 / 编排层

> 项目的编排层：持有并初始化全部子系统，处理输入、剧情、场景、小游戏与存档的串联。
> 是全局唯一的「上帝对象」，其它模块不应反向依赖它。
>
> **拆分说明（本次重构）**：`Main` 原本是约 5000 行的单文件。现已按职责把内聚方法抽到
> `js/main/*.js`，经**原型混入**挂回 `Main`（`Object.assign(Main.prototype, {...})`）——
> 调用点仍写作 `this.xxx()`，行为完全不变。`js/Main.js` 现只保留编排与生命周期（约 1900 行）。

---

## 〇、文件构成

| 文件 | 职责 |
|---|---|
| `js/Main.js` | 生命周期（`init`/`start`/`pause`/`resume`/`save`/`load`）、子系统初始化与接线、输入事件、地图切换与传送、主循环回调（`update`/`updateGameWorld`）、玩家创建、初始资源与地图加载 |
| `js/main/MainAudio.js` | 主图 / 小游戏 / 完结界面的 BGM 调度与音效 |
| `js/main/MainRender.js` | 各场景画面分派绘制（主菜单 / 大地图 / 字幕 / 战斗 / 小游戏 / 完结） |
| `js/main/MainMiniGame.js` | 小游戏启动（传参 + 服务）/ 结束回调 / 各类结算收尾 |
| `js/main/MainStory.js` | NPC 对话、剧情时间轴、旁白字幕与剧情对白播放 |
| `js/main/MainBossArena.js` | Boss 战场流程（进场 / 控制锁 / 战败成长 / 击败判定 / 门控 / 回合制战斗驱动） |
| `js/main/MainProgression.js` | 任务奖励、境界属性、职业技能、永久加成、剧情旗标与各类试炼 |
| `js/main/MainChapter2.js` | 第二章专属流程（地图判定 / NPC 位移 / 阶段推进 / 登船） |

> 依赖顺序：这些文件必须在 `game.html` 中排在 `js/Main.js` **之后**（见第 17 层）。
> 静态守卫（冒烟测试）面向「整个 Main 层」扫描，会把上述文件一并读入。

---

## 一、生命周期

```js
const main = new Main();
await main.init('gameCanvas');   // 初始化全部子系统（异步：含资源预加载）
main.start();                    // 启动主循环
```

`init()` 顺序（`Main.init`）：

1. 取 Canvas、设置尺寸 `1280×720`
2. `ResourceManager` / `GameConfig` 单例
3. `startMenuBgmEarly()` 试播开始界面 BGM
4. `preloadInitialResources()` 预加载资源
5. `initCoreSystems()` → `gameLoop / sceneManager / mapManager / camera / inputManager / audioManager`
6. `initUISystems()` → `mapTeleport / questUI / dialogBox`
7. `initGameSystems()` → `battleSystem / miniGameManager / shop / trainingManager / playerCombat`（并注册 5 个小游戏）
8. 注册章节配置（`Chapter1Config` / `Chapter2Config` → `ChapterLoader`）
9. `initSaveManager()` → `saveManager`
10. `initScenes()` / `bindInputEvents()`
11. `createPlayer()` → 创建 `Player` 并注册到存档管理器
12. `loadInitialMap()` / `setupQuestCallbacks()` / `setupGameLoop()`

---

## 二、主要职责分区

| 区块 | 方法 | 所在文件 |
|---|---|---|
| 系统初始化 | `initCoreSystems` `initUISystems` `initGameSystems` `initSaveManager` `initScenes` | `Main.js` |
| 音频调度 | `onGameWorldSceneEnter` `onMapSwitched` `startMenuBgmEarly` `stopMainMapBgm` | `MainAudio.js` |
| 输入 | `bindInputEvents` `handleKeyDown` `handleInteraction` | `Main.js` |
| 地图 / 传送 | `switchToMap` `triggerTeleport` | `Main.js` |
| Boss 战场 | `enterBossArena` `handleBossArenaVictory` `getBossArenaReturnPoint` | `MainBossArena.js` |
| 剧情 / 对话 | `startNPCInteraction` `handleDialogueComplete` `playStoryDialogue` `playDialogueText` | `MainStory.js` |
| 小游戏 | `startMiniGame` `getMiniGameParams` `getMiniGameServices` `handleMiniGameEnd` `startMiniGameFromSignpost` | `MainMiniGame.js` |
| 章末流程 | `startFoundationTrial` `applyRealmStats` `applyPermanentStatBonus` | `MainProgression.js` |
| 第二章 | `applyChapter2Stage` `setJiangpoReunitedIdle` `ensureChapter2BoatSignpost` | `MainChapter2.js` |
| 更新 / 渲染 | `update` `updateGameWorld`（`Main.js`）；`render` `renderGameWorld` `renderBattle`（`MainRender.js`） | 通过 `GameLoop` 的额外回调挂入 |

---

## 三、玩家与数据

```js
main.player                  // Player 实例
main.player.playerData       // ★ 唯一运行时数据源（见 PlayerData.md）
main.player.questSystem
main.player.questItemSystem
main.playerCombat            // PlayerCombatSystem
main.saveManager             // SaveManager
```

### 玩家创建（重构后）
```js
createPlayer() {
    const defaults = GameConfig.getInstance().getPlayerDefaults();
    this.player = new Player({
        position: { x: defaults.spawn.x, y: defaults.spawn.y },
        playerData: { realm: defaults.realm, stage: defaults.stage, lingShi: defaults.lingShi },
        profession: { professionId: 'sanxiu' },
    });
    // 气血 / 灵息上限由 GameConfig.realms 派生，不再硬编码
    ...
    this.saveManager.registerSystems({ player: this.player });   // 注册进存档
}
```

### 境界数值写入
```js
main.applyRealmStats('zhuji');       // 按 GameConfig 写满上限 + 叠加永久加成 + 回满
main.applyPermanentStatBonus(data);  // 仅叠加 Boss 战败成长加成
```

---

## 四、小游戏参数提供（重构新增）

```js
main.getMiniGameParams(gameId)   // 以 GameConfig.miniGames 为底 + 玩家状态 → 纯数据
main.getMiniGameServices()       // 资源 / 音频适配器
```

详见 [MiniGame.md](MiniGame.md)。

---

## 五、按键速查

| 按键 | 行为 |
|---|---|
| `W A S D` / 方向键 | 移动 |
| `E` | 交互（NPC / 路标 / 拾取） |
| `J` | 普通攻击 |
| `U` `I` `L` | 灵息弹 / 护体术 / 闪避 |
| `O` | 剑影连斩（习得后） |
| `Q` | 任务栏 |
| `ESC` | 关闭面板 / 世界地图 |
| `F2` | 碰撞网格调试（开发用） |

> 世界地图（`M` 键入口）已按需求移除，仅由剧情节点触发。

---

## 六、注意

- `Main` 是唯一允许持有全部子系统引用的模块；新增功能应优先落在对应子系统内，由 `Main` 调用，而不是把逻辑堆进 `Main`。
- 新增的编排方法请落到**对应的 `js/main/Main*.js` 混入文件**里（就近原则），别再堆回 `js/Main.js`；新开混入文件时记得在 `game.html` 第 17 层补一行 `<script>`。
- 与「玩家数值」相关的读写请走 `PlayerData` 方法；与「配置」相关的读取请走 `GameConfig` 方法。
- 静态守卫（`tools/smoke_chapter2.js` / `tools/smoke_chapter_end.js`）会拼接 `Main.js + js/main/*.js` 一起做源码断言，故方法移动位置不会漏检。
