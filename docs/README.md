# 模块文档索引

本目录按 `js/` 下的模块组织，说明各模块**主要功能与使用方法**。
命名尽量与 `js/` 中的文件名对应，便于对照。

---

## 一、基础与配置

| 文档 | 对应模块 | 一句话说明 |
|---|---|---|
| [GameConfig.md](GameConfig.md) | `GameConfig.js` | ★ **唯一常量源**：境界 / 技能 / 物品 / 战斗规则 / 小游戏参数 |
| [PlayerData.md](PlayerData.md) | `PlayerData.js` | ★ **唯一运行时玩家数据源**：属性读写方法 |
| [StateMachine.md](StateMachine.md) | `StateMachine.js` `ProgressStateMachine.js` `QuestStateMachine.js` `PlayerStateMachine.js` | ★ **进度状态唯一事实源**：任务树 / 剧情进度 / 玩家（存亡·技能解锁·冷却） |
| [ResourceManager.md](ResourceManager.md) | `ResourceManager.js` | 图片 / 音频的路径登记、缓存与占位兜底 |
| [AudioManager.md](AudioManager.md) | `AudioManager.js` | 背景音乐与音效（含自动播放解锁） |
| [CollisionDetector.md](CollisionDetector.md) | `CollisionDetector.js` | ★ **碰撞判定唯一实现**（AABB / 点与矩形 / 圆与矩形 / 射线） |

## 二、主程序与循环

| 文档 | 对应模块 | 一句话说明 |
|---|---|---|
| [Main.md](Main.md) | `Main.js` + `main/Main*.js`（7 个原型混入） | 主程序 / 编排层（已按职责拆分，见文档第〇节） |
| [GameLoop.md](GameLoop.md) | `GameLoop.js` | 固定步长主循环 |
| [Scene.md](Scene.md) | `Scene.js` `SceneManager.js` `MainMenuScene.js` `GameWorldScene.js` `BattleScene.js` `MiniGameScene.js` | 场景系统 |

## 三、玩家与战斗

| 文档 | 对应模块 | 一句话说明 |
|---|---|---|
| [Player.md](Player.md) | `Player.js` | 玩家实体（移动 / 交互 / 成长） |
| [ProfessionSystem.md](ProfessionSystem.md) | `ProfessionSystem.js` | 职业与技能解锁 |
| [PlayerCombat.md](PlayerCombat.md) | `PlayerCombat.js` | 大地图实时战斗（普攻 / 技能 / 闪避 / HUD） |
| [BattleSystem.md](BattleSystem.md) | `BattleSystem.js` | 回合制战斗 |
| [Monster.md](Monster.md) | `Monster.js` `Boss.js` `ShanxiaoBoss.js` `DueBoss.js` `CombatEffect.js` | 怪物、Boss 与战斗特效 |

## 四、小游戏（独立子系统）

| 文档 | 对应模块 | 一句话说明 |
|---|---|---|
| [MiniGame.md](MiniGame.md) | `MiniGame.js` `MiniGameManager.js` `MiniGameScene.js` + 5 个小游戏 | ★ **启动 / 结束通信契约**与全部小游戏 |

## 五、世界与实体

| 文档 | 对应模块 | 一句话说明 |
|---|---|---|
| [GameMap.md](GameMap.md) | `GameMap.js` `MapManager.js` `TileSystem.js` `AStar.js` | 地图、瓦片、寻路 |
| [NPC.md](NPC.md) | `NPC.js` `NPCStateMachine.js` `DialogueSystem.js` `DialogBox.js` | NPC、状态机与对话 |
| [QuestSystem.md](QuestSystem.md) | `QuestSystem.js` `QuestUI.js` `QuestItemSystem.js` | 任务与任务物品 |
| [Inventory.md](Inventory.md) | `Inventory.js` `Shop.js` `PickupItem.js` | 背包、商店与拾取物 |
| [Signpost.md](Signpost.md) | `Signpost.js` `WindPile.js` `LanternBox.js` `TeleportArray.js` `MapTeleport.js` `MapAreaButton.js` `TrainingManager.js` `TrainingZone.js` | 世界交互点与地图传送 |

## 六、表现层

| 文档 | 对应模块 | 一句话说明 |
|---|---|---|
| [Animation.md](Animation.md) | `Animation.js` `AnimationManager.js` `FallingFoliage.js` | 帧动画与飘落物特效 |
| [InputManager.md](InputManager.md) | `InputManager.js` `UIButton.js` `Camera.js` | 输入、按钮与镜头 |
| [EndingScene.md](EndingScene.md) | `EndingScene.js` `EndingText.js` | 结局滚动字幕 |

## 七、配置与存档

| 文档 | 对应模块 | 一句话说明 |
|---|---|---|
| [ChapterLoader.md](ChapterLoader.md) | `ChapterLoader.js` `Chapter1Config.js` `Chapter2Config.js` | 章节剧情配置注册 |
| [SaveManager.md](SaveManager.md) | `SaveManager.js` `GameDataManager.js` | 存档收集 / 写入 / 读档 |

---

## 本次修复清单（重构时一并处理）

| 文件 | 问题 | 修复 |
|---|---|---|
| `Main.js` | `createPlayer` 硬编码 `health:100 / mana:50`，覆盖 `GameConfig` 的练气 150/70 | 改为只传境界，数值由配置派生 |
| `Shop.js` | `renderMessage(ctx,px,py,pw)` 函数体引用未定义的 `ph` → 每次买卖提示抛 `ReferenceError` | 补 `ph` 参数 + 兜底 |
| `ProfessionSystem.js` | `getCurrentRealm()` 硬编码返回 `'zhuji'`，练气期就解锁筑基技能 | 注入 `playerData` 实时读取境界 |
| `PlayerData.js` | `deserialize` 用 `data.x \|\| 默认`，`health=0` / `lingShi=0` 被覆盖 | 改为仅在 `undefined/null` 时兜底 |
| `PlayerData.js` | `checkStageUp` 已到圆满仍扣 `maxExp`，溢出经验被吞 | 仅在真正升级时扣经验 |
| `Player.js` | `performDodge` 播放从未注册的 `'skill'` 动画（告警且无效） | 改为存在 `dodge` 动画才播放 |
| `DueBoss.js` | 兜底血量 400 与章节配置 500 冲突；`drops` 字段名与配置 `dropItems` 不匹配 | 统一兜底源 + 兼容两种字段名 |
| `ShanxiaoBoss.js` | 遗留调试注释 `//this.maxHealth = 1;` | 删除 |
| `SaveManager.js` | **从未保存玩家数据**（属性 / 背包 / 任务 / 职业全部丢失） | 注册 `player` 并收集 / 应用 |
| `MiniGame*` | `HerbCollectMiniGame_bak.js` 为无引用死代码 | 删除 |

---

## 遗留重复收敛（第二轮）

| 模块 | 问题 | 修复 | 验证 |
|---|---|---|---|
| `PlayerData` / `ProfessionSystem` | 技能点**双份存储**，`Main.applyQuestRewards` 同写两处 | 唯一存储＝`PlayerData`；`ProfessionSystem` 改 getter/setter 代理 | `tools/verify_legacy_fixes.js` |
| `Boss` / `ShanxiaoBoss` / `DueBoss` / `DueMinion` | 各自实现圆-矩形 / 矩形相交算法 | 删除，统一调用 `CollisionDetector.rectsIntersect / circleIntersectsRect` | `tools/verify_legacy_fixes.js` |
| `Chapter1Config` / `Chapter2Config` | 章节 `tuning` 与 `Boss.DEFAULT_TUNING` **逐条重复** | `DEFAULT_TUNING` 为唯一来源，章节 `tuning` 仅保留「可选覆盖」入口（默认留空） | `tools/verify_legacy_fixes.js` |
| `BattleSystem` | 回合推进用 `setTimeout`，与主循环 `deltaTime` 脱钩 | 改为 `turnAdvanceTimer`，由 `update(deltaTime)` 驱动；节奏来源 `GameConfig.getBattleTiming()` | `tools/verify_battle_turn.js` |

> 对应保证：根 `README.md` 的 G11 ~ G14。

---

## 状态收敛（第三轮：统一到状态机）

| 模块 | 问题 | 修复 | 验证 |
|---|---|---|---|
| `QuestSystem` / `PlayerData` / `PlayerCombat` | 进度型布尔状态**散落各处**且同一件事存在多份存储（任务完成 / 剧情标记 / 玩家存亡 / 技能解锁·习得） | 新增 `StateMachine` 基类 + `ProgressStateMachine` / `QuestStateMachine` / `PlayerStateMachine`；各模块改为**委托**（对外 API 不变），状态机为唯一权威 | `tools/verify_state_machines.js` |
| `Player` | `isAlive` 字段与 `PlayerData` 派生的 `isAlive()` 各存一份，会漂移 | `isAlive` 改为访问器，读写转发到玩家状态机 | `tools/verify_state_machines.js` |
| `PlayerCombat` | 冷却表、战斗解锁、技能解锁 / 习得分散自持；`isUnlocked()` 未读本地兜底导致无状态机时门控失效 | 冷却 / 解锁 / 习得全部委托玩家状态机；补回本地兜底读取 | `tools/verify_state_machines.js` |
| `ProfessionSystem` | `isSkillUnlocked(unlockStage)` 名不副实（实为境界门槛比较） | 改名 `isRealmReached()`，`isSkillUnlocked` 保留为 `@deprecated` 别名 | `tools/verify_state_machines.js` |

> 对应保证：根 `README.md` 的 G15 ~ G18。详见 [StateMachine.md](StateMachine.md)。

---

## 专题文档

| 文档 | 说明 |
|---|---|
| [静态分析报告.md](静态分析报告.md) | 全项目静态检测结果（问题清单 + 分级 + 证据）+ **全部问题的修复记录** |
| [未实现内容与后续开发方向.md](未实现内容与后续开发方向.md) | 已预留接口但尚未落地的功能清单与开发优先级建议 |
| [C++移植技术需求清单.md](C++移植技术需求清单.md) | 移植到 C++ 前的选型清单（标准版本 / 语言特性 / 第三方库 / 专项需求） |

> 资源缺口体检：`node tools/check_assets.js`（加 `--json` 输出机器可读结果）—— 登记资源 ↔ 磁盘文件逐条比对，缺失项按子系统分组列出。
