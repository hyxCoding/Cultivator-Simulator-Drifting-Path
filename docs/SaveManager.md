# SaveManager.js / GameDataManager.js — 存档

> 对应模块：`SaveManager.js`（存档收集 / 写入 / 读取）、`GameDataManager.js`（子系统引用聚合）。

---

## 一、SaveManager

单实例由 `Main.initGameDataManager()` 创建并注册系统。

```js
const sm = new SaveManager({ storageKey: 'xiuxian_save_data', autoSave: false });

sm.registerSystems({
    gameLoop, sceneManager, mapManager, camera, inputManager,
    mapTeleport, miniGameManager, battleSystem, questUI, dialogBox,
    player,           // ★ 本次重构补上（此前缺失，导致角色数据不落盘）
});

sm.save();            // → boolean
sm.load();            // → saveData | null
sm.hasSave();         // → boolean
sm.deleteSave();
sm.getSaveInfo();     // → { version, saveTime, saveTimeFormatted, saveCount }
sm.exportSave();      // → JSON 字符串
sm.importSave(json);  // → boolean
sm.update(dt);        // 自动保存计时
sm.enableAutoSave(60) / disableAutoSave()
```

存储介质：`localStorage`，键名默认 `xiuxian_save_data`。

### 收集的内容（`collectSaveData`）
```
meta（版本 / 时间 / 次数）
gameLoop / sceneManager / mapManager / camera / inputManager
mapTeleport / miniGameManager / battleSystem / questUI / dialogBox
player   ← 角色属性 + 背包 + 职业 + 任务 + 动画
```

### 玩家存档结构
`player.serialize()` 返回：
```js
{
    position, facing, isAlive, isInteracting, isInBattle,
    playerData,        // PlayerData.serialize()（含 stateMachine：存亡 / 技能解锁·习得）
    inventory,         // Inventory.serialize()
    professionSystem,  // ProfessionSystem.serialize()
    questSystem,       // QuestSystem.serialize()（含 quests 任务树 + storyFlags 剧情进度）
    animationManager,
}
```

> ★ 第三轮：`playerData` 内新增 `stateMachine` 字段（玩家状态机快照），`questSystem` 的 `quests` / `storyFlags`
> 分别由 `QuestStateMachine` / `ProgressStateMachine` 产出，字段形状与旧存档一致 —— 旧存档可直接读
> （缺 `stateMachine` 时按读档后的气血重新同步 `alive`）。

读档时 `applySaveData` 会调用 `player.deserialize(...)`，并重新绑定
`professionSystem.setPlayerData(player.playerData)`（保证职业系统读到正确境界）。

---

## 二、本次重构修复

| 问题 | 影响 | 修复 |
|---|---|---|
| `registerSystems` 未包含 `player` | 保存的 JSON **不含角色属性 / 背包 / 任务 / 职业**，读档后全部回到默认值 | 补 `player` 槽位 + 收集 + 应用 |
| 玩家在 `initGameDataManager` 之后才创建 | 即使注册也拿不到实例 | 在 `Main.createPlayer()` 末尾补注册 |

---

## 三、GameDataManager

把分散的子系统引用聚合到一处，便于 `SaveManager` 使用：

```js
const gdm = new GameDataManager();
gdm.init({ ... });        // 创建核心系统并注册到 saveManager
gdm.setPlayer(player);
gdm.setCurrentMap(map);
gdm.save() / gdm.load();
gdm.serialize() / gdm.deserialize(data);
```

> 当前 `Main` 采用「直接赋值字段」的方式接线（`this.gameDataManager.gameLoop = ...`），
> `GameDataManager` 作为可选聚合层保留。

---

## 四、注意事项

- `saveVersion` 变更时 `load()` 只打印告警，不做迁移；如需兼容旧档请在 `applySaveData` 内做兜底。
- 常量（`GameConfig.realmOrder` 等）**不参与存档**，始终以代码为准，避免旧档覆盖新规则。
