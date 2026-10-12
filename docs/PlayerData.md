# PlayerData.js — 唯一运行时玩家数据源

> 玩家的「当前值」只保存在 `PlayerData` 实例里。
> 所有读取与修改都走本类的方法，禁止外部直接改 `this.health` 等字段。

由 `Player` 持有：`player.playerData`。

---

## 一、字段一览

| 字段 | 含义 |
|---|---|
| `realm` / `stage` | 当前境界 / 小阶段（`'lianqi'` / `'初期'`） |
| `experience` | 当前境界内经验 |
| `health` / `maxHealth` | 当前气血 / 气血上限（**上限 = 境界基准 + 永久加成**） |
| `mana` / `maxMana` | 当前灵息 / 灵息上限 |
| `lingShi` | 灵石 |
| `basicSkillPoints` / `professionSkillPoints` | 基础修习点 / 职业悟道点 |
| `bossFailures` | `{ 战场id: 战败次数 }` |
| `maxHealthBonus` / `maxManaBonus` | Boss 战败成长的永久上限加成 |
| `cultivationProgress` / `totalExperienceGained` | 修炼进度 / 累计经验 |
| `statistics` | 击杀 / 死亡 / 任务 / 用物品 / 游戏时长 |
| `stateMachine` | ★ 玩家状态机（存亡 / 战斗解锁 / 技能解锁·习得·冷却·互斥的唯一权威，见 [StateMachine.md](StateMachine.md)） |

> 初始值：构造时若未传 `health / maxHealth / mana / maxMana`，一律由 `GameConfig.realms[realm]` 派生。
> 因此**改配置即改初始值**（见 [GameConfig.md](GameConfig.md)）。

---

## 二、读取方法

```js
pd.getHealth()        // 当前气血
pd.getMaxHealth()     // 气血上限
pd.getMana()          // 当前灵息
pd.getMaxMana()       // 灵息上限
pd.getHealthRatio()   // 0~1，用于血条
pd.getManaRatio()     // 0~1
pd.isAlive()          // ★ 委托玩家状态机（alive 状态）；由气血写入路径同步，不再是独立字段
pd.getRealmConfig()   // 当前境界配置（来自 GameConfig）
pd.getStateMachine()  // ★ 玩家状态机（存亡 / 技能解锁·习得·冷却·互斥）
```

## 三、写入方法（自动裁剪上下限）

```js
pd.setHealth(v)            // 裁剪到 [0, maxHealth]
pd.setMana(v)              // 裁剪到 [0, maxMana]
pd.changeHealth(delta)     // 增减，返回实际变化量（治疗传正数、受伤传负数）
pd.changeMana(delta)       // 增减，返回实际变化量
pd.addMaxHealth(n, refill) // 提升上限；refill=true 时同时回满
pd.addMaxMana(n, refill)
pd.refill()                // 回满气血与灵息
```

## 四、成长方法

```js
pd.gainExperience(amount)   // 加经验并检查小阶段提升
pd.applyRealmStats('zhuji') // 按境界写入上限 + 叠加永久加成 + 回满
pd.spendLingShi(amount)     // 消耗灵石（不足返回 false）
pd.gainLingShi(amount)
pd.updatePlayTime(dt)
```

### `applyRealmStats(realmOrId, keepStage)` 详解
境界突破 / 章末调息 / 读档统一走它：

```js
// 上限 = 境界基准值 + 永久加成
maxHealth = realms[realm].maxHealth + (maxHealthBonus || 0);
maxMana   = realms[realm].maxMana   + (maxManaBonus   || 0);
refill();   // 回满
```

- `realmOrId`：境界 ID 字符串或配置对象。
- `keepStage`：`true` 保留当前小阶段，缺省重置为该境界第一阶段。

---

## 五、玩家状态机（存亡 / 技能）★

本类构造时创建一个 `PlayerStateMachine`（`this.stateMachine`），它是**玩家维度进度状态的唯一权威**
（见 [StateMachine.md](StateMachine.md)）：

- **存亡 `alive`**：`isAlive()` 直接读状态机；所有改动气血的路径（`setHealth` / `addMaxHealth` / `refill` /
  `applyRealmStats` / 读档）都会调用内部 `_syncAlive()`，把 `health > 0` 同步进状态机。
  因此**不存在第二份存亡布尔**（`Player.isAlive` 也只是转发到这里的访问器）。
- **技能**：战斗解锁、技能解锁 / 习得、冷却、互斥禁用全部存于状态机：

```js
const sm = player.playerData.getStateMachine();
sm.isCombatUnlocked() / setCombatUnlocked(true)
sm.isSkillUnlocked(id) / unlockSkill(id) / isSkillLearned(id) / learnSkill(id)
sm.startCooldown(id, sec) / isOnCooldown(id) / tick(dt)
sm.lockSkill(id, sec) / isSkillLocked(id)
sm.checkCanUseSkill(id, mana)   // → { ok, reason }
```

- **存档**：`serialize()` 输出 `stateMachine` 字段；`deserialize()` 读回后按读档气血重新同步 `alive`
  （旧存档无该字段时保持初始值，仍以气血为准）。

## 六、使用示例

```js
// 受伤（来自 PlayerCombat / 怪物攻击）
player.playerData.changeHealth(-damage);

// 吃药回血（按上限百分比）
const heal = player.playerData.getMaxHealth() * (item.value / 100);
player.playerData.changeHealth(heal);

// 突破到筑基
player.playerData.applyRealmStats('zhuji');

// 血条绘制
const ratio = player.playerData.getHealthRatio();   // 0~1
```

---

## 七、本次重构修复

| 问题 | 原行为 | 现行为 |
|---|---|---|
| 反序列化 falsy 覆盖 | `this.health = data.health \|\| this.health`，存档 `health=0`（死亡态）被覆盖回默认 | 仅在 `undefined/null` 时兜底，`0` 被正确保留 |
| `statistics` 整块替换 | 旧存档缺新子字段时丢默认值 | 逐字段兜底 |
| `checkStageUp` 吞经验 | 已到圆满仍先扣一个 `maxExp` 再 `break`，溢出经验被丢弃 | 仅在真正推进小阶段时扣经验，圆满后原样保留 |

---

## 八、保证

- **G1**：改 `GameConfig.realms.<境界>.maxHealth`，新建角色的 `getMaxHealth()` 与 `getHealth()` 立即同步。
- **G8**：所有属性变更都经过 `setHealth/setMana` 的上下限裁剪，不会出现超上限或负数。
- **G17**：玩家存亡唯一存储于 `PlayerStateMachine.alive`（`isAlive()` 委托状态机，气血写入自动同步），不再有第二份。
