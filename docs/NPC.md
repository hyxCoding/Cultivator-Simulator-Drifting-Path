# NPC.js / NPCStateMachine.js / DialogueSystem.js / DialogBox.js — NPC 与对话

> 对应模块：`NPC`（NPC 实体与 AI）、`NPCStateMachine`（状态机）、
> `DialogueSystem`（对话逻辑 / 选项 / 动作）、`DialogBox`（对话渲染 / 打字机效果）。

---

## 一、NPC

```js
const npc = new NPC(config);        // 配置来自章节配置（ChapterLoader 注册）
npc.update(dt, map)
npc.render(ctx, camera)
npc.setAnimation(name, options) / setIdleAnimation()
npc.setNpcState(key, value) / getNpcState(key)
npc.performHeal(ayan)               // 剧情治疗演出
npc.changeState(newState)           // 切换状态机状态
```

NPC 的移动方式：`idle` / `patrol` / `follow` / `talk` / `quest` / `flee`，
均带碰撞检测（`moveWithCollision`）。

## 二、NPCStateMachine

```js
const sm = new NPCStateMachine(states, initial);
sm.update(dt, map)
sm.enterState(name) / sm.exitState(name)
sm.getCurrentState() / sm.setState(name)
```

## 三、DialogueSystem

```js
const ds = new DialogueSystem(npc, questSystem);
ds.startDialogue(dialogueId)         // 开始对话（缺省用 NPC 默认对白）
ds.update(dt)
ds.getCurrentOptions()               // 当前可选选项
ds.selectOption(index)               // 选择选项
ds.executeAction(action)             // 执行对白动作（推进任务 / 给物品 / 切换场景…）
ds.endDialogue()
ds.hasDialogueOccurred(id)
ds.serialize() / deserialize(data)
```

对白文本来自章节配置（`Chapter1Config` / `Chapter2Config` 的 `dialogues`）。
`Main.playDialogueText` / `playStoryDialogue` 是对外的高层封装。

## 四、DialogBox

```js
const box = new DialogBox();
box.setText(text, speakerName)
box.update(dt)                        // 打字机推进
box.render(ctx)
box.advance() / advanceLine()         // 下一行
box.hasNextLine() / completeTypewriter()
box.addOptionButton(btn) / clearOptionButtons()
box.show() / hide()
box.serialize() / deserialize(data)
```

- 打字机效果：逐字显示，按 `J` 或点击可立即显示全句 / 进入下一句；
- 选项按钮为 `UIButton`，悬停音效只在「放上去」那一次播放。

---

## 五、对白驱动流程（简述）

```
Main.startNPCInteraction(npc)
  └─ 取 NPC 当前对白（按任务状态选择）→ DialogueSystem.startDialogue
       └─ DialogBox 逐行渲染
            └─ 玩家推进 → DialogueSystem.executeAction(action)
                 └─ 任务进度 / 给物品 / 触发剧情 / 打开商店 …
            └─ 对白结束 → Main.handleDialogueComplete（可能触发下一段剧情）
```

## 六、新增 NPC / 对白

1. 在 `Chapter1Config` / `Chapter2Config` 的 `npcs` 中新增 NPC 定义（含美术、站位、对白、商店等）；
2. `ChapterLoader.registerChapter` 会深合并进 `GameConfig`；
3. 地图配置里引用 NPC id 即可。

**无需修改 `NPC` / `DialogueSystem` 代码。**
