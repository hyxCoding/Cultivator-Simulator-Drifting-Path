# GameConfig.js — 唯一常量源

> 全项目所有「初始值 / 基准值 / 规则参数」的唯一出处。
> **改这里的数字即全局生效**，不需要再去别的文件同步第二遍。

单例：`const cfg = GameConfig.getInstance();`

---

## 一、数据分区

| 字段 | 内容 | 谁在用 |
|---|---|---|
| `realms` | 各境界的 `maxHealth / maxMana / moveSpeed / maxExp / stages` | 建号、突破、章末调息、HUD |
| `professions` | 职业定义（攻击类型 / 技能列表 / 解锁境界 / 加成） | `ProfessionSystem` |
| `skills` | 全部技能数值（伤害 / 冷却 / 消耗 / 射程 / 飞行速度） | `PlayerCombat`、`BattleSystem` |
| `passives` | 被动效果 | `ProfessionSystem` |
| `items` | 物品定义（效果 / 价格 / 堆叠） | `Inventory`、`Shop`、`Player.useItem` |
| `recipes` | 炼丹配方 | 炼丹相关流程 |
| `combat.manaRegen` | 灵息自然恢复（按境界分档） | `Player.updateManaRegen` |
| `combat.turnBased` | 回合制战斗节奏（回合时限 / 敌人行动后停顿） | `BattleSystem` |
| `realmOrder` | **境界推进顺序** | 突破、技能解锁 |
| `playerDefaults` | 建号默认（境界 / 阶段 / 灵石 / 出生坐标） | `Main.createPlayer` |
| `playerCombatBase` | 普攻 / 闪避 / 移速兜底 | `Player`、`ProfessionSystem` |
| `monsterDefaults` | 怪物缺配置时的兜底 | 全部怪物 / Boss |
| `miniGames` | 各小游戏默认启动参数 | `Main.getMiniGameParams` |
| `maps` | 世界地图（九州总图）按钮 | `MapTeleport` |

---

## 二、取值方法（统一入口）

```js
// 基础查询
cfg.getRealm('zhuji')            // → 境界配置对象（大小写不敏感，带缓存）
cfg.getProfession('jianxiu')     // → 职业配置
cfg.getSkill('lingxidan')        // → 技能配置
cfg.getItem('huiyuan_dan')       // → 物品配置（含运行时注册的物品）
cfg.getMonster('boss_shanxiao')  // → 怪物配置（来自章节配置注册）
cfg.getQuest('chapter1_main_2')  // → 任务配置
cfg.getMap('yunduze')            // → 地图配置
cfg.get('combat.manaRegen')      // → 点号路径取值

// 唯一常量：境界顺序
cfg.getRealmOrder()              // → ['lianqi','zhuji','jiedan','yuanying','huashen']（副本）
cfg.getRealmIndex('zhuji')       // → 1
cfg.getNextRealm('zhuji')        // → 结丹配置（最高境界返回 null）
cfg.getDefaultRealmId()          // → 'lianqi'

// 唯一常量：玩家与怪物基准
cfg.getPlayerDefaults()          // → { realm, stage, lingShi, spawn:{x,y} }（深拷贝）
cfg.getPlayerCombatBase()        // → { attackDamage, attackRange, attackCooldown, moveSpeed, ... }
cfg.getMonsterDefaults()         // → { health, damage, defense, expReward, lingShiReward }

// 唯一常量：规则
cfg.getManaRegen('zhuji')        // → { interval:1, amount:4 }（共享只读对象，零分配）
cfg.getBattleTiming()            // → { turnDuration:30, enemyTurnDelay:0.5 }（副本）
cfg.calculateDamage(20, 5)       // → 15（统一伤害公式：max(minimum, 伤害 - 防御)）
cfg.getMiniGameConfig('herb_collect') // → 小游戏默认参数副本
```

---

## 三、常用改动示例

### 例 1：调整练气期气血上限
```js
// GameConfig.js
LIANQI: { ..., maxHealth:150, maxMana:70 }
```
**生效范围**：新建角色初始气血、HUD 血条上限、丹药回复比例、`PlayerData.applyRealmStats`。
（无需再改 `Main.createPlayer` —— 重构后那里已不再硬编码血量。）

### 例 2：调整灵息弹消耗与冷却
```js
// GameConfig.js → skills.basic.lingxidan
lingxidan: { ..., manaCost:10, cooldown:3 }
```
**生效范围**：大地图实时战斗（`PlayerCombat` 在构造时整体同步 `manaCost / cooldown / damage / range / projectileSpeed`）。

### 例 3：调整某境界灵息恢复速度
```js
// GameConfig.js → combat.manaRegen.byRealm
zhuji: { interval:1, amount:4 }
```
**生效范围**：`Player.updateManaRegen`（唯一读取点）。

### 例 4：调整伤害结算公式
```js
// GameConfig.js
calculateDamage(baseDamage, defense, options) { ... }
```
**生效范围**：`Monster` / `Boss` / `ShanxiaoBoss` / `DueBoss` / `DueMinion`（5 处已收敛为调用此方法）。

### 例 5：调整小游戏默认参数
```js
// GameConfig.js → miniGames
herb_collect: { timeLimit:0, maxScore:100, requiredHerbs:8 }
```
**生效范围**：`Main.getMiniGameParams(gameId)` 以此为底 → `MiniGameManager.startMiniGame` → 小游戏 `start(params)`。

### 例 6：调整玩家建号出生点
```js
// GameConfig.js → playerDefaults.spawn
spawn: { x: 448, y: 1376 }
```

### 例 7：调整回合制战斗节奏
```js
// GameConfig.js → combat.turnBased
turnDuration: 30,      // 玩家单回合操作时限（秒）
enemyTurnDelay: 0.5,   // 敌人行动后停顿多久再推进（秒）
```
**生效范围**：`BattleSystem` 构造时读取（`getBattleTiming()`）→ 回合超时推进 / 敌人回合后延迟推进。
延迟推进由主循环 `update(deltaTime)` 计时（不再用 `setTimeout`），改这里一处即全局生效。

---

## 四、注意事项

- `getRealmOrder()` / `getPlayerDefaults()` / `getPlayerCombatBase()` / `getMonsterDefaults()` / `getMiniGameConfig()` 均返回**副本**，外部改动不会污染唯一常量源。
- `getManaRegen()` 返回的是**配置内的共享对象**（已在构造时归一化），请勿修改其字段。
- `serialize()` 只导出需要随存档保存的运行时注册数据；`realmOrder` 等纯常量不参与序列化（读档后仍以代码为准，这是刻意设计 —— 常量不该被旧存档覆盖）。

---

## 附录：本次重构消除的重复数值

| 原重复位置 | 原问题 | 现来源 |
|---|---|---|
| `Main.createPlayer` `health:100 / mana:50` | 与 `realms.LIANQI` 的 150/70 冲突，改配置不生效 | `PlayerData` 从 `realms` 派生 |
| `Player.breakthrough` 本地 `realmOrder` 数组 | 与配置重复，新增境界需改多处 | `getRealmOrder()` |
| `ProfessionSystem.isRealmReached`（旧名 `isSkillUnlocked`）本地 `realmOrder` 数组 | 同上 | `getRealmOrder()` |
| `ProfessionSystem` `baseDamage=10 / baseRange=50 / baseCooldown=0.5` | 硬编码 | `getPlayerCombatBase()` |
| `Player.getCurrentMoveSpeed` 兜底 `200` | 与 `realms.LIANQI.moveSpeed` 重复 | `getPlayerCombatBase().moveSpeed` |
| `Player.updateManaRegen` `> 0 ? : 1/2` | 与 `combat.manaRegen` 顶层兜底重复 | `getManaRegen()` |
| `Monster/Boss/ShanxiaoBoss/DueBoss` `\|\| 50/300/400/26/8…` | 与章节配置冲突 | `getMonsterDefaults()` |
| 5 处 `Math.max(1, damage - defense)` | 公式复制 5 份 | `calculateDamage()` |
| `PlayerCombat.CONFIG` 与 `skills` 的冷却 / 消耗不一致 | 改一处不生效 | `skills` 为唯一源，启动时同步 |
| `Player.dodgeCooldown = 1.0 / dodgeDuration = 0.25` | 硬编码 | `getPlayerCombatBase()` |
| `BattleSystem` `turnDuration = 30` / `setTimeout(..., 500)` | 回合节奏硬编码 + 定时器与主循环脱钩 | `getBattleTiming()` + `update(deltaTime)` |
| 章节 `bossPosition[...].tuning` | 逐条重复 `Boss.DEFAULT_TUNING` | `DEFAULT_TUNING` 为唯一来源，章节仅可选覆盖 |
| `Boss/ShanxiaoBoss/DueBoss/DueMinion` 各自的相交算法 | 同一算法 4 份 | `CollisionDetector.rectsIntersect / circleIntersectsRect` |
| `PlayerData` 与 `ProfessionSystem` 各存技能点 | 改一处不生效 | 唯一存储 = `PlayerData`（访问器代理） |
