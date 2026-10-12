# QuestSystem.js / QuestUI.js / QuestItemSystem.js — 任务系统

> 对应模块：`QuestSystem`（任务状态机与进度）、`QuestUI`（任务栏面板）、
> `QuestItemSystem`（任务物品，独立于普通背包）。

---

## 一、QuestSystem

由 `Player` 持有：`player.questSystem`。

> ★ **状态收敛（第三轮）**：本类**不再自持状态**，只保留业务逻辑（前置校验、目标推进、回调）。
> 状态一律经两个状态机读写（见 [StateMachine.md](StateMachine.md)）：
> - `qs.questState` → `QuestStateMachine`：任务完成情况（`locked / active / completed / failed`）
> - `qs.progressState` → `ProgressStateMachine`：剧情进度标记（单调不可逆）
>
> 兼容访问器：`qs.quests`（任务记录 **只读 Map 副本**，`getEntries()`）、
> `qs.storyFlags`（**只读**对象，仅含已发生的标记）。**不可**再直接 `qs.quests.set(...)` 写状态。

```js
const qs = new QuestSystem();
qs.registerAllQuests()                          // 从 GameConfig 注册全部任务
qs.update(dt)

// 查询
qs.getQuestState(questId)                       // LOCKED / ACTIVE / COMPLETED / FAILED
qs.isQuestActive(questId) / isQuestCompleted(questId)
qs.getActiveQuests() / getCompletedQuests()
qs.getCurrentObjective(questId)
qs.isObjectiveCompleted(questId, type, target)
qs.isObjectiveCurrent(questId, type, target)
qs.getAcceptStatus(questId)                     // 是否可接取

// 变更
qs.acceptQuest(questId)
qs.updateQuestProgress(questId, objectiveType, target, count)
qs.completeQuest(questId)
qs.abandonQuest(questId) / failQuest(questId)

// 剧情标记
qs.setStoryFlag(flag, value) / hasStoryFlag(flag) / getStoryFlag(flag)

qs.serialize() / deserialize(data)
```

### 目标类型（`objectiveType`）示例
`collect_item` / `complete_minigame` / `complete_training` / `talk_to` / `defeat_boss` …

### 常用调用
```js
// 小游戏成功后推进任务
player.questSystem.updateQuestProgress('chapter1_main_2', 'collect_item', 'lingcao', 3);
player.questSystem.setStoryFlag('chapter2_identify_done');
```

### 底层状态机（需要精确读写状态时用）
```js
qs.questState.getState(id) / isActive(id) / isCompleted(id) / getEntry(id)
qs.questState.size / getIdsByState('completed') / getEntries()   // 只读副本
qs.progressState.has(flag) / getAll() / getPending()             // 剧情进度
```

## 二、QuestUI

任务栏面板（`Q` 键开关）。

```js
const ui = new QuestUI();
ui.setQuestSystem(qs)
ui.show() / hide() / toggle()
ui.update(dt, input) / render(ctx)
ui.serialize() / deserialize(data)
```

## 三、QuestItemSystem

任务物品**独立于普通背包**（不占容量，只随剧情增删）。

```js
const qis = new QuestItemSystem();
qis.addItem(itemId, count)
qis.removeItem(itemId, count)
qis.hasItem(itemId, count) / getItemCount(itemId)
qis.getAllItems() / getItemCountTotal()
qis.onItemChanged = (itemId, count) => {}      // 变更回调
qis.serialize() / deserialize(data)
```

例如第二章的魂灯：
```js
player.questItemSystem.removeItem('hundeng_jiangwan', 1);
```

---

## 四、新增任务

1. 在 `Chapter1Config` / `Chapter2Config` 的 `quests` 中新增任务定义（目标链 / 前置 / 奖励）；
2. `ChapterLoader.registerChapter` 合并进 `GameConfig.registeredQuests`；
3. 用 `updateQuestProgress` 在各流程中推进目标。

**无需修改 `QuestSystem` 代码。**
