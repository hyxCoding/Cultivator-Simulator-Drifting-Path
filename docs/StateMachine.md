# StateMachine.js / ProgressStateMachine.js / QuestStateMachine.js / PlayerStateMachine.js — 状态机（进度唯一事实源）

> ★ **全项目「进度型布尔状态」的唯一事实源**。
>
> 由 `Main` / `Player` 间接持有：
> `player.questSystem.questState`（任务树）、`player.questSystem.progressState`（剧情进度）、
> `player.playerData.stateMachine`（玩家）。
>
> 分层：本组文件位于 `game.html` 第 1 层（基础类），**不依赖任何上层模块**（仅 `PlayerStateMachine` 读 `GameConfig` 取技能消耗）。

---

## 一、为什么要有状态机

重构前，进度型布尔状态散落在各模块的实例字段里，且**同一件事会有多份存储**，典型：

| 状态 | 重构前的存储 | 后果 |
|---|---|---|
| 单个任务完成与否 | `QuestSystem.quests`（Map） | 与 UI / 剧情判定分散读取 |
| 剧情进度标记 | `QuestSystem.storyFlags`（自由对象） | 拼错标记名不报错、无法审计 |
| 玩家存亡 | `Player.isAlive`（字段）**与** `PlayerData` 派生的 `isAlive()` | 两处会漂移 |
| 技能是否解锁 / 习得 | `PlayerCombat.unlockedOnce` / `ProfessionSystem` 技能等级 | 语义混淆、读档兜底各写一套 |
| 技能冷却 | `PlayerCombat.cooldowns` | 与技能可用性判定分离 |

现在统一收敛为 **3 个业务状态机**（+ 1 个通用基类），对外只暴露方法，更新**严格校验**：

- **任务完成情况** → `QuestStateMachine`（任务树）
- **剧情进度**（章节完结 / Boss 击败 / 能力解锁 / 结局等）→ `ProgressStateMachine`
- **玩家维度**（存亡 / 战斗解锁 / 技能解锁·习得·冷却·互斥）→ `PlayerStateMachine`

> 怪物的状态**不**纳入统一状态机（由各怪物 / Boss 类自行管理）。

---

## 二、`StateMachine` —— 通用基类

一个状态机 = 一组「具名状态」。每个状态有：允许取值集合、初始值、转移规则、单调开关。

```js
const sm = new StateMachine('Demo');
sm.define('flag', { values: [false, true], initial: false, monotonic: true });
sm.define('mode', { values: ['a','b','c'], initial: 'a', transitions: { a:['b'], b:['c'], c:[] } });

sm.get('flag')          // 读取（未登记 → undefined + 告警）
sm.is('flag', true)     // 是否等于期望值（默认与 true 比较）
sm.isTrue('flag')       // 布尔便捷读取（非 true 一律 false）

sm.set('flag', true)    // 严格更新：已登记 + 取值合法 + 转移允许，缺一即拒绝
sm.setMany({ ... })     // 批量；返回被拒绝的键列表
sm.reset()              // 复位到各状态初始值（清空非法计数）
sm.serialize()          // { key: value } 全量快照（调试 / 存档）
sm.deserialize(data)    // 快照恢复（绕过转移校验，但只接受已登记键）
```

### 「严格」体现在哪

| 校验 | 行为 |
|---|---|
| 状态未 `define` | 拒绝 + `console.warn` + `illegalCount++` |
| 取值不在 `values` 内 | 拒绝 |
| 转移不在 `transitions` 表 / 函数内 | 拒绝 |
| `monotonic: true` 且 `true → false` | 拒绝（不可逆） |
| 同值写入 | 视为成功（幂等） |

被拒绝的更新**不会静默**：一律 `console.warn` 并触发 `onIllegalTransition(machine, key, from, to, reason)` 回调；
`illegalCount` 累计被拒绝次数，便于测试断言「确实拦住了」。

> `deserialize()` 是**快照恢复**（存档即事实）：绕过转移校验直接写值，但同样只接受已登记的状态键，
> 未知键忽略并告警。

---

## 三、`ProgressStateMachine` —— 剧情进度

记录「这件事有没有发生过」：章节是否完结、Boss 是否击败过、地图 / 能力是否解锁、结局是否看过。

- **登记表**：`ProgressStateMachine.FLAGS`（`flag → 说明`）是唯一登记处，新增标记只需在此补一行。
- **全部单调**：只置真、不可逆（本项目从无「撤销剧情进度」的用法）。
- **动态前缀**：`DYNAMIC_PREFIXES = ['map_unlocked_']`，如 `map_unlocked_yunduze` 自动登记。
  其余未登记标记会**告警但仍登记**（不静默丢进度，留下痕迹便于补齐登记表）。

```js
psm.mark('chapter1_complete')            // 置真（严格：只接受布尔）
psm.has('chapter1_complete')             // 是否已发生
psm.getFlag('chapter1_complete')         // 原始值（未登记 → undefined）
psm.markMany(['a', 'b'])                 // 批量
psm.getAll()                             // ★ 只含「已发生」的标记（等价于旧的 storyFlags 袋）
psm.isKnown('map_unlocked_xxx')          // 是否在登记表 / 动态前缀内
psm.getPending()                         // 已登记但从未置真的标记（调试）
psm.getAutoRegistered()                  // 运行期自动登记的标记
```

> `getAll()` 只返回值为 `true` 的标记，因此存档的 `storyFlags` 字段与旧格式完全一致
> （旧实现也只在标记被设置后才写进对象）。
> `deserialize()` 会先按动态前缀补登记再写值，避免 `map_unlocked_*` 读档时被判「未登记」而丢失。

---

## 四、`QuestStateMachine` —— 任务树

记录每个任务的**生命周期状态**（任务完成情况的唯一事实源）。

```
locked ──accept──▶ active ──complete──▶ completed（终态）
                     │  │
                     │  └──fail────▶ failed（终态）
                     └──abandon───▶ locked（放弃后回到未接取）
```

- `completed` / `failed` 为**终态**，不可再转移（严格拒绝）；
- 未登记的任务一律拒绝更新（必须先 `register`）。

```js
qsm.register('chapter1_main_1')          // 登记（初始 locked）
qsm.getState('chapter1_main_1')          // 'locked' | 'active' | 'completed' | 'failed'
qsm.getEntry('chapter1_main_1')          // 整条记录（含 objectives / 时间戳，合并副本）
qsm.isLocked / isActive / isCompleted / isFailed
qsm.apply('chapter1_main_1', 'active', { objectives, acceptedTime })   // 严格转移 + 附带数据补丁
qsm.getEntries()                         // 全部记录（只读 Map 副本）
qsm.size                                 // 已登记任务数
qsm.getIdsByState('completed')
qsm.serialize() / deserialize(data)      // 存档（字段形状与旧 quests 完全兼容）
```

> `QuestSystem` 保留**业务逻辑**（前置校验、目标推进、回调），状态一律经本状态机读写（见 [QuestSystem.md](QuestSystem.md)）。

---

## 五、`PlayerStateMachine` —— 玩家

集中记录「玩家维度」的全部进度型布尔状态与技能可用性。

### 5.1 布尔状态（严格校验）

| 状态键 | 说明 | 规则 |
|---|---|---|
| `alive` | 玩家存亡 | 双向（死 → 复活）；只接受布尔 |
| `combatUnlocked` | 战斗按键是否已解锁 | 单调 |
| `skillUnlocked:<id>` | 技能是否已解锁（能否出现在技能栏） | 单调 |
| `skillLearned:<id>` | 技能是否已习得（剧情 / 任务传授） | 单调 |

```js
psm.setAlive(bool) / isAlive() / markDead() / revive()
psm.setCombatUnlocked(true) / isCombatUnlocked()
psm.unlockSkill(id) / isSkillUnlocked(id) / setSkillUnlocked(id, false) / relockSkills(ids)
psm.learnSkill(id) / isSkillLearned(id)
```

> `setSkillUnlocked(id, false)` / `relockSkills()` 是**显式、受控**的「解锁回退」，仅供转职 / 重置场景使用
> （单调状态的一次受控例外）。

### 5.2 技能可用性（数值型计时器 + 严格更新方法）

| 字段 | 说明 |
|---|---|
| `skillCooldowns[id]` | 冷却剩余秒数（唯一权威，`PlayerCombat` 直接引用本对象） |
| `skillLocks[id]` | 技能互斥禁用剩余秒数（技能 A 施展后，一段时间内禁用技能 B） |

```js
psm.startCooldown(id, seconds) / getCooldown(id) / isOnCooldown(id) / clearCooldowns()
psm.lockSkill(id, seconds, reason) / lockSkills(ids, seconds) / unlockSkillLock(id)
psm.isSkillLocked(id) / getSkillLock(id)
psm.tick(deltaTime)                      // 每帧推进冷却与禁用计时（由 PlayerCombat 调用一次）
```

### 5.3 统一门控查询（唯一入口）

```js
psm.checkCanUseSkill(id, mana)   // → { ok, reason }
//   reason ∈ null | 'locked' | 'lockedBySkill' | 'cooldown' | 'mana'
psm.canUseSkill(id, mana)        // 布尔便捷版
```

条件（全部满足才 `ok`）：**已解锁 + 未被互斥禁用 + 冷却就绪**（传入 `mana` 时再校验灵息足够）。

> 技能消耗读 `GameConfig.getSkill(id).manaCost`（唯一常量源）。

### 5.4 存档

```js
psm.serialize()    // { alive, combatUnlocked, skills: { <id>: { unlocked, learned } } }
psm.deserialize(data)   // 快照恢复；冷却 / 禁用为瞬时状态，读档后归零
```

---

## 六、各模块如何接入（委托模式）

状态机是唯一权威，**既有系统保留原对外 API**，内部改为委托状态机（getter / 代理 / 「推导 → 写入 → 读回」）：

| 模块 | 接入方式 |
|---|---|
| `QuestSystem` | 新增 `questState` / `progressState` 两个状态机；`quests` / `storyFlags` 改为只读访问器；`setStoryFlag` 等委托 `progressState`；状态转移走 `questState.apply` |
| `PlayerData` | 持有 `stateMachine`；`isAlive()` 委托状态机；气血写入路径（`setHealth` / `addMaxHealth` / `refill` / 读档）调用 `_syncAlive()` 同步 `alive` |
| `Player` | `isAlive` 由字段改为**访问器**，读写转发到 `playerData` 的状态机（不再另存一份） |
| `PlayerCombat` | `cooldowns` getter 直接返回 `stateMachine.skillCooldowns`；`isUnlocked` / `isSkillUnlocked` / `isSkillLearned` 改为「按上下文推导 → 写入状态机 → 以状态机为准读出」；`_tickTimers` 调 `sm.tick(dt)` |
| `ProfessionSystem` | `isSkillUnlocked(unlockStage)` 语义澄清并改名 `isRealmReached()`（境界门槛比较，非技能解锁状态） |

> 无状态机时（极早期 / 桩测试）各模块保留本地兜底表（如 `PlayerCombat._fallbackCooldowns`），保证可用性。

---

## 七、存档兼容

- `PlayerData.serialize()` 新增 `stateMachine` 字段；旧存档无此字段时保持初始值，并按读档后的气血重新同步 `alive`。
- `QuestSystem.serialize()` 仍输出 `{ quests, storyFlags }`，形状与旧版一致；`deserialize()` 兼容更旧的
  `activeQuests` / `completedQuests` 两表格式。
- 冷却 / 互斥禁用等**瞬时状态不存档**，读档后归零。

---

## 八、验证

```bash
node tools/verify_state_machines.js     # 86 项：基类严格性 / 三个状态机 / 接线 / 存档往返
```

对应根 `README.md` 保证清单 **G15 ~ G18**。
