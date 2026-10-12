# Signpost.js / WindPile.js / LanternBox.js / TeleportArray.js / MapTeleport.js / MapAreaButton.js / TrainingManager.js / TrainingZone.js — 世界交互点

> 地图上可交互的对象集合：路标、调查点、传送法阵、世界地图、教学圈。

---

## 一、Signpost（路标）

触发对白或小游戏的世界交互点（如「采药点」「认灯台」「旧水道」）。

```js
const sp = new Signpost(config);
sp.update(dt) / sp.render(ctx, camera) / sp.renderPrompt(ctx, camera)
sp.isPlayerInRange(playerPosition)
sp.activate()                       // 激活（由 Main.handleInteraction 调用）
sp.updateQuestGate(questSystem)     // 任务门控：未满足条件时不显示 / 不可交互
```

关键配置字段：
| 字段 | 说明 |
|---|---|
| `gameId` | 绑定的**小游戏 ID**（有则激活时启动小游戏，见 [MiniGame.md](MiniGame.md)） |
| `roleplayDialogue` | 引导对白（先播对白，读完再开小游戏） |
| `successDialogue` / `successSpeaker` | 小游戏成功后的收尾对白 |

`Main.startMiniGameFromSignpost` 是统一入口，按 `gameId` 分流结果。

## 二、WindPile（调查点）

镇风桩 / 破损运灯箱等高亮调查点。

```js
wp.update(dt) / wp.render(ctx, camera)
wp.isPlayerInRange(pos) / wp.markInvestigated()
wp.getDialogue() / wp.updateQuestGate(questSystem)
wp.serialize() / deserialize(data)
```

## 三、LanternBox（运灯箱）

可交互的灯箱容器，逻辑与 `WindPile` 类似。

## 四、TeleportArray（传送法阵）

```js
ta.update(dt) / ta.render(ctx, camera)
ta.isNearby(playerPosition)
ta.updateQuestGate(questSystem)     // 需持有凭证 / 完成目标后才出现
ta.serialize() / deserialize(data)
```

## 五、MapTeleport / MapAreaButton（世界地图）

```js
const mt = new MapTeleport();
mt.initAreaButtons(buttonConfigs)
mt.addAreaButton(config) / removeAreaButton(id) / getAreaButton(id)
mt.setButtonEnabled(id, bool) / setButtonVisible(id, bool)
mt.show() / hide() / toggle()
mt.update(dt, input) / render(ctx)
mt.loadFromConfig(mapConfig)
mt.serialize() / deserialize(data)
```

按钮配置来自 `GameConfig.maps.worldMap.buttons`（唯一源）。
世界地图仅由剧情节点打开（原 `M` 键入口已按需求移除）。

## 六、TrainingManager / TrainingZone（教学圈）

基础操作教学与技能试炼。

```js
const tm = new TrainingManager();
tm.startBasicTraining(onComplete, options)
tm.update(dt, player)
tm.notifyAction(actionType, player)      // 玩家做出对应动作 → 完成该步
tm.isTrainingActionCompleted(type) / getCompletedActionTypes()
tm.render(ctx, camera) / tm.renderPrompt(ctx, camera)
tm.cancel()
tm.serialize() / deserialize(data)
```

教学圈动作类型与 `PlayerCombatSystem.CONFIG.<skill>.trainingAction` 对应
（如 `skill_jianying` ↔ 第二章「剑修连招试炼」）。

---

## 七、通用约定

- 所有交互点都实现 `isPlayerInRange(playerPosition)`，由 `Main.handleInteraction` 统一分发；
- `updateQuestGate(questSystem)` 用于按任务进度显示 / 隐藏；
- 全部支持 `serialize / deserialize` 以随存档保存状态。
