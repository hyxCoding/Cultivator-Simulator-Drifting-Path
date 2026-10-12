# 修仙者模拟器：飘途

一个基于原生 JavaScript + Canvas 2D 的修仙题材 2D 单机网页游戏（无需构建工具，直接打开 `game.html` 即可运行）。

本文件说明**当前项目的整体架构**。各模块的详细用法见 [`docs/`](docs/README.md)。

---

## 一、快速开始

```
# 直接双击 game.html，或用任意静态服务器打开
python -m http.server 8000     # 然后访问 http://localhost:8000/game.html
```

> 音频受浏览器「自动播放策略」限制，首次进入需点击画面任意处才出声（加载界面已有提示）。

---

## 二、目录结构

```
AI Game Jam/
├── game.html                  # 唯一入口：按依赖顺序引入全部 js + 启动脚本
├── README.md                  # 本文件（架构总览）
├── docs/                      # 各模块使用文档（按 js 文件名组织）
├── js/                        # 全部游戏代码（75 个模块）
│   ├── GameConfig.js          # ★ 唯一常量源（境界 / 技能 / 物品 / 战斗规则 / 小游戏参数）
│   ├── PlayerData.js          # ★ 唯一运行时玩家数据源（含读写方法）
│   ├── StateMachine.js        # ★ 状态机基类（进度状态唯一事实源底座）
│   ├── ProgressStateMachine.js#   剧情进度状态机（章节 / Boss / 解锁 / 结局）
│   ├── QuestStateMachine.js   #   任务树状态机（任务完成情况）
│   ├── PlayerStateMachine.js  #   玩家状态机（存亡 / 技能解锁·习得·冷却·互斥）
│   ├── Main.js                # 主程序 / 编排层（生命周期与接线，约 1900 行）
│   ├── main/                  #   Main 的职责拆分（原型混入，见 docs/Main.md）
│   │   ├── MainAudio.js       #     音频 / BGM 调度
│   │   ├── MainRender.js      #     各场景画面分派绘制
│   │   ├── MainMiniGame.js    #     小游戏编排
│   │   ├── MainStory.js       #     对话与剧情序列
│   │   ├── MainBossArena.js   #     Boss 战场流程
│   │   ├── MainProgression.js #     成长与奖励结算
│   │   └── MainChapter2.js    #     第二章专属流程
│   ├── GameLoop.js            # 固定步长主循环
│   ├── ...                    # 其余模块，见 docs/
├── assets/                    # images/ + audio/（美术与音频资源）
├── tools/                     # 资源生成脚本（Python）+ 无浏览器冒烟测试（Node）
├── 第一章-青岚浮野-主线与NPC对话-v1.0.json
├── 第二章-云渡泽-主线与NPC对话-v1.0.json
├── 修仙者模拟器-飘途-策划案-v0.3.md
└── 飘途-战斗与数值细案-v0.3.md
```

---

## 三、分层架构

`game.html` 中脚本按 **17 个依赖层**自上而下引入，低层不依赖高层：

| 层 | 模块 | 职责 |
|---|---|---|
| 1 | `ResourceManager` `AudioManager` `GameConfig` `CollisionDetector` `StateMachine` `ProgressStateMachine` `QuestStateMachine` `PlayerStateMachine` | 资源 / 音频 / **配置** / 碰撞工具 / **状态机** |
| 2 | `TileSystem` `AStar` `GameMap` `MapManager` | 地图与寻路 |
| 2.5 | `ChapterLoader` `Chapter1Config` `Chapter2Config` `EndingText` | 章节剧情配置注册 |
| 3 | `Animation` `AnimationManager` `Camera` `FallingFoliage` | 动画与镜头 |
| 4 | `GameLoop` | 主循环 |
| 5 | `Scene` `SceneManager` | 场景基类与管理 |
| 6 | `PlayerData` `Inventory` `ProfessionSystem` `QuestSystem` … | 玩家数据与背包 / 职业 / 任务 |
| 7 | `Player` | 玩家实体 |
| 8 | `NPCStateMachine` `DialogueSystem` `NPC` | NPC 与对话 |
| 9 | `Monster` `Boss` `ShanxiaoBoss` `DueBoss` | 怪物与 Boss |
| 10 | `InputManager` `UIButton` `DialogBox` | 输入与基础 UI |
| 10.5 | `Shop` | 商店 |
| 11 | `CombatEffect` `PlayerCombat` `BattleSystem` | 战斗 |
| 12 | `MiniGame` + 5 个小游戏 + `MiniGameManager` | **小游戏（独立子系统）** |
| 13 | `MapAreaButton` `MapTeleport` `TeleportArray` | 地图传送 |
| 14 | `QuestUI` | 任务 UI |
| 15 | `SaveManager` `GameDataManager` | 存档 |
| 16 | `MainMenuScene` `GameWorldScene` `BattleScene` `MiniGameScene` `EndingScene` | 场景实现 |
| 17 | `Main` + `main/Main*`（7 个原型混入） | 主程序（最后加载，持有并编排全部子系统；内聚职责拆分到 `js/main/`，调用点不变） |

**依赖原则：高层可以调用低层，低层不得反向依赖高层。**
唯一的例外是 `Main` 作为编排层持有所有子系统引用（见 `Main.initGameDataManager` / `createPlayer`）。

---

## 四、数据流向

```
                 ┌──────────────────────────────────────────────┐
                 │  GameConfig（唯一常量源，只读）               │
                 │  realms / skills / items / combat / miniGames │
                 └───────────────┬──────────────────────────────┘
                                 │ 读取（getRealm / getSkill / getManaRegen / calculateDamage …）
                                 ▼
   Player ──持有──► PlayerData（唯一运行时数据源：health/maxHealth/mana/…）
     │                 ▲
     │                 │ 全部读写走方法：getHealth / setHealth / changeHealth / applyRealmStats …
     │                 │
     ├─ ProfessionSystem ─（注入 playerData 引用，实时读取境界）
     ├─ Inventory / QuestSystem / QuestItemSystem
     └─ PlayerCombat ──读取──► GameConfig.skills（技能数值唯一来源）

   ★ 状态唯一事实源（进度型布尔状态全部收敛到状态机，各模块只读 / 只经方法写）：
     PlayerData.stateMachine  ──► PlayerStateMachine    （存亡 / 技能解锁·习得·冷却·互斥）
     QuestSystem.questState   ──► QuestStateMachine     （任务树：locked/active/completed/failed）
     QuestSystem.progressState──► ProgressStateMachine  （剧情进度：章节 / Boss / 解锁 / 结局）
       ▲ 委托（对外 API 不变）：Player.isAlive → PlayerData.stateMachine；
         QuestSystem.quests / storyFlags → 上述状态机；PlayerCombat.cooldowns → stateMachine.skillCooldowns

   每帧：
   GameLoop.loop
     └─ update(dt)
          ├─ InputManager.getInputState()
          ├─ SceneManager.update()          ← 场景切换 / 当前场景更新
          ├─ Player.update()
          ├─ currentMap.npcs / monsters / pickupItems / signposts / windPiles …
          ├─ Camera.update()
          └─ Main.update()（通过 extraUpdateCallbacks 挂入）
     └─ render()
          └─ 地图 → NPC → 怪物 → 调查点 → 法阵 → 战斗特效(下层) → 玩家 → 战斗特效(上层) → UI

   小游戏（完全独立）：
   Main.startMiniGame(gameId, cb)
     ├─ params = Main.getMiniGameParams(gameId)   ← 以 GameConfig.miniGames 为底 + 玩家状态
     ├─ services = Main.getMiniGameServices()     ← 资源/音频适配器
     └─ MiniGameManager.startMiniGame(gameId, params, services)
            └─ miniGame.start(params, services)   ← 【启动】唯一通信入口
                 … 小游戏内部自成闭环，不触碰主游戏任何状态 …
                 └─ complete()/fail() → onComplete/onFail(result)  ← 【结束】唯一通信入口
                        └─ MiniGameScene 检测 → Main.handleMiniGameEnd(result)
                               └─ Main 的回调：更新任务 / 物品 / 剧情状态
```

---

## 五、核心设计约定（重构后）

### 1. 唯一常量源：`GameConfig`
所有「初始值 / 基准值 / 规则参数」只在 `js/GameConfig.js` 定义一次。其它模块一律通过方法读取，不得复制数值。

| 你想改的东西 | 改哪里 | 全局生效范围 |
|---|---|---|
| 各境界气血 / 灵息 / 移速 / 升级经验 | `GameConfig.realms` | 建号、突破、章末调息、HUD 血条 |
| 技能伤害 / 冷却 / 消耗 / 射程 | `GameConfig.skills` | 大地图实时战斗（`PlayerCombat` 启动时同步） |
| 灵息自然恢复（按境界分档） | `GameConfig.combat.manaRegen` | `Player.updateManaRegen` |
| 回合制战斗节奏（回合时限 / 敌人停顿） | `GameConfig.combat.turnBased` | `BattleSystem`（经 `getBattleTiming()`） |
| 境界推进顺序 | `GameConfig.realmOrder` | 突破、技能解锁判定 |
| 伤害结算公式 | `GameConfig.calculateDamage()` | 全部怪物 / Boss / 小兵 |
| 圆-矩形 / 矩形相交判定 | `CollisionDetector` | 全部 Boss / 小兵 / 玩家战斗 |
| Boss 的 AI 数值（速度 / 冷却 / 判定半径…） | 各 Boss 类内 `DEFAULT_TUNING` | 该 Boss 全部行为（章节 `tuning` 仅可选覆盖） |
| 普攻 / 闪避 / 移速兜底值 | `GameConfig.playerCombatBase` | `Player` / `ProfessionSystem` |
| 怪物缺配置时的兜底 | `GameConfig.monsterDefaults` | `Monster` / `Boss` / `ShanxiaoBoss` / `DueBoss` / `DueMinion` |
| 小游戏默认参数 | `GameConfig.miniGames` | 各小游戏启动参数 |
| 玩家建号坐标 / 初始资源 | `GameConfig.playerDefaults` | `Main.createPlayer` |

### 2. 唯一运行时数据源：`PlayerData`
玩家的「当前值」只存在于 `PlayerData` 实例，所有读写走方法：

```js
playerData.getHealth() / getMaxHealth() / getMana() / getMaxMana()   // 读
playerData.setHealth(v) / setMana(v)                                 // 写（自动裁剪上下限）
playerData.changeHealth(delta) / changeMana(delta)                   // 增减（返回实际变化量）
playerData.addMaxHealth(n) / addMaxMana(n)                           // 提升上限
playerData.applyRealmStats(realmId)                                  // 按境界写入上限 + 叠加永久加成 + 回满
playerData.refill() / isAlive() / getHealthRatio() / getManaRatio()
```

### 3. 小游戏与主游戏松耦合
小游戏与主游戏**只在两个时刻通信**：
- **启动**：主游戏通过 `start(params, services)` 注入纯数据参数与资源/音频适配器；
- **结束**：小游戏通过 `onComplete/onFail(result)` 回传结果，主游戏据此更新状态。

小游戏内部**不引用** `Player` / `PlayerData` / `QuestSystem` / `Main` 等任何主游戏状态；取图 / 播音也走服务适配器（未注入时回落单例），因此替换资源或音频实现无需改动小游戏代码。

### 4. 唯一状态事实源：状态机（进度收敛）
所有「进度型布尔状态」（任务完成、剧情标记、玩家存亡、技能解锁 / 习得 / 冷却）统一收敛到 3 个业务状态机，
更新走**严格校验**的方法，读取走 `get / is / has`：

| 状态机 | 覆盖范围 | 持有位置 |
|---|---|---|
| `QuestStateMachine` | 任务树（`locked / active / completed / failed`，含终态不可逆） | `player.questSystem.questState` |
| `ProgressStateMachine` | 剧情进度（章节完结 / Boss 击败 / 地图·能力解锁 / 结局；单调不可逆） | `player.questSystem.progressState` |
| `PlayerStateMachine` | 玩家（存亡 / 战斗解锁 / 技能解锁·习得 / 冷却 / 互斥禁用） | `player.playerData.stateMachine` |

- 严格性：未登记状态、非法取值、非法转移一律**拒绝**并 `console.warn`（`illegalCount` 计数）；
  `monotonic` 状态置真后不可回退。
- 既有系统**保留原对外 API**，内部改为委托状态机（如 `QuestSystem.quests` 只读访问器、`Player.isAlive` 访问器、
  `PlayerCombat.cooldowns` getter），因此调用方无需改动。
- 统一门控入口：`PlayerStateMachine.checkCanUseSkill(id, mana) → { ok, reason }`（已解锁 + 未被互斥 + 冷却就绪 + 灵息足够）。
- 详见 [docs/StateMachine.md](docs/StateMachine.md)。

---

## 六、保证说明（用于降低代码核查成本）

以下结论均已通过 `tools/` 下的冒烟测试与专项验证脚本核对：

| 编号 | 保证 | 验证方式 |
|---|---|---|
| G1 | 改 `GameConfig.realms.<境界>.maxHealth`，新建角色的气血上限与当前值立即同步 | 配置唯一源 → `PlayerData` 构造函数派生 |
| G2 | 改 `GameConfig.skills.<技能>.cooldown / manaCost`，大地图战斗立即生效（启动时整体同步） | `PlayerCombat._applyGameConfigValues` |
| G3 | 改 `GameConfig.realmOrder`，突破链与技能解锁判定同步变化 | `getRealmOrder()` 唯一数组 |
| G4 | 改 `GameConfig.calculateDamage()`，全部怪物 / Boss 伤害公式同步变化 | 5 处旧公式已收敛为 1 处调用 |
| G5 | 改 `GameConfig.monsterDefaults`，缺章节配置的怪物数值同步变化 | 类内魔数已替换为兜底源 |
| G6 | 改 `GameConfig.combat.manaRegen`，灵息恢复速率同步变化 | `Player.updateManaRegen` 唯一读取点 |
| G7 | 改 `GameConfig.miniGames.<id>`，对应小游戏启动参数同步变化 | `Main.getMiniGameParams` |
| G8 | 小游戏不读写主游戏状态，只在启动/结束通信 | 小游戏源码中无 `Player` / `QuestSystem` / `Main` 引用 |
| G9 | 玩家属性 / 背包 / 任务 / 职业随存档保存与恢复 | `SaveManager` 已注册 `player`（此前缺失） |
| G10 | 修改一处数据不需要再去第二处同步 | 重复魔数清单见 `docs/GameConfig.md` 附录 |
| G11 | 技能点唯一存储于 `PlayerData`，改一处即全局生效（`ProfessionSystem` 走访问器代理） | `tools/verify_legacy_fixes.js` |
| G12 | 圆-矩形 / 矩形相交判定唯一实现于 `CollisionDetector`，4 类 Boss 不再各写一份 | `tools/verify_legacy_fixes.js` |
| G13 | Boss 数值唯一来源＝类内 `DEFAULT_TUNING`，章节 `tuning` 不再逐条重复（仅可选覆盖） | `tools/verify_legacy_fixes.js` |
| G14 | 回合推进随主循环 `deltaTime` 走（不再 `setTimeout`），暂停 / 低帧不漂移 | `tools/verify_battle_turn.js` |
| G15 | 任务完成情况唯一存储于 `QuestStateMachine`，转移严格（`locked→active→completed`，终态不可逆），`QuestSystem.quests` 为只读访问器 | `tools/verify_state_machines.js` |
| G16 | 剧情进度唯一存储于 `ProgressStateMachine`（单调不可逆），动态前缀 `map_unlocked_*` 自动登记且读档不丢 | `tools/verify_state_machines.js` |
| G17 | 玩家存亡唯一存储于 `PlayerStateMachine.alive`（`Player.isAlive` 为访问器，`PlayerData` 气血写入自动同步），不再有第二份 | `tools/verify_state_machines.js` |
| G18 | 技能解锁 / 习得 / 冷却 / 互斥唯一存储于 `PlayerStateMachine`；`checkCanUseSkill` 为唯一门控入口 | `tools/verify_state_machines.js` |

---

## 七、无浏览器测试

项目自带 Node 冒烟测试（用托管 Node 直接运行）：

```bash
node tools/smoke_chapter2.js         # 第二章：任务链 / 小游戏 / Boss / 音频 / 存档
node tools/smoke_chapter_end.js      # 章末：登船 / 结局滚动字幕
node tools/verify_legacy_fixes.js    # 专项：技能点唯一存储 / 碰撞收敛 / Boss 数值唯一来源
node tools/verify_battle_turn.js     # 专项：回合推进与 deltaTime 对齐
node tools/verify_state_machines.js  # 专项：状态机基类严格性 / 三个业务状态机 / 接线 / 存档往返
```

测试会加载 `game.html` 中列出的全部 js 并在 Node 中跑真实逻辑（含 DOM/Canvas 桩），
输出 `通过 N 项，失败 M 项`。退出码 0 表示全通过。

> 已知遗留（测试自身缺陷，与游戏代码无关）：`smoke_chapter2.js` 中「云渡泽外圈封死」一项引用了
> 从未赋值的 `R.map.yunBorderBlocked`；`smoke_chapter_end.js` 中「登船路标美术」一项依赖
> 资源尺寸（原图 31×32，小于断言的 60×60）。两项在重构前即失败。

---

## 八、本次重构要点

1. **建立唯一常量源**：`GameConfig` 新增 `realmOrder` / `playerDefaults` / `playerCombatBase` / `monsterDefaults` / `miniGames` 与一批取值方法；消除「配置写 150、开局硬编码 100」等冲突。
2. **建立唯一运行时数据源**：`PlayerData` 新增全套 get/set 方法；`Player` / `Main` / `ProfessionSystem` 改为方法取值。
3. **统一伤害公式**：5 处重复的 `max(1, 伤害 - 防御)` 收敛为 `GameConfig.calculateDamage()`。
4. **技能数值单一来源**：`PlayerCombat` 启动时从 `GameConfig.skills` 整体同步（含冷却与消耗）。
5. **小游戏彻底解耦**：新增 `start(params, services)` 契约 + 服务适配器 + 参数注入；删除死代码 `HerbCollectMiniGame_bak.js`。
6. **修复已知 bug**：见 `docs/README.md` 的「本次修复」清单。
7. **性能优化**：`GameConfig` 境界 / 职业查询缓存；灵息恢复查询零分配；`GameLoop` 每帧遍历去闭包分配。
8. **收敛遗留重复（第二轮）**：
   - 技能点唯一存储于 `PlayerData`，`ProfessionSystem` 改用 getter/setter 代理；
   - Boss 数值唯一来源＝类内 `DEFAULT_TUNING`，删除章节 `tuning` 中逐条重复的覆盖项（覆盖入口保留）；
   - 圆-矩形 / 矩形相交算法 4 份收敛为 `CollisionDetector.rectsIntersect / circleIntersectsRect`；
   - `BattleSystem` 回合推进由 `setTimeout` 改为随主循环 `deltaTime` 的倒计时。
9. **状态收敛（第三轮）**：
   - 新增 `StateMachine` 基类（严格更新 + 转移校验 + 单调不可逆 + 非法计数）；
   - 新增 `ProgressStateMachine`（剧情进度）/ `QuestStateMachine`（任务树）/ `PlayerStateMachine`（玩家）三个业务状态机；
   - `QuestSystem` 状态改由状态机持有（`quests` / `storyFlags` 变只读访问器）；
     `PlayerData` 持有玩家状态机并同步 `alive`；`Player.isAlive` 改为访问器；
     `PlayerCombat` 的冷却 / 解锁 / 习得全部委托状态机；`ProfessionSystem.isSkillUnlocked` 改名 `isRealmReached`；
   - 存档形状保持兼容（`PlayerData.stateMachine` 为新增可选字段，旧存档可读）。
