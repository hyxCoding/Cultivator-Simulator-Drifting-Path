# Monster.js / Boss.js / ShanxiaoBoss.js / DueBoss.js / CombatEffect.js — 怪物与战斗特效

> 怪物、Boss、小兵与战斗特效（投射物 / 命中 / 气场）。

---

## 一、类继承关系

```
Monster            （普通怪物，如风狼）
  └─ Boss          （通用 Boss 基类：韧性 / 阶段 / 技能）
ShanxiaoBoss       （第一章 Boss 摄风山魈，独立类）
DueBoss            （第二章 Boss 渡厄使，独立类）
DueMinion          （渡厄使召唤的小兵，独立类）
```

---

## 二、数值来源（重构后，唯一）

```
章节配置（Chapter1Config / Chapter2Config）
        │  ChapterLoader.registerChapter → GameConfig.registerMonster
        ▼
GameConfig.getMonster(id)   ← 怪物 / Boss 构造时读取
        │
        │ 配置缺失时
        ▼
GameConfig.getMonsterDefaults()   ← 唯一兜底（health/damage/defense/expReward/lingShiReward）
```

| 文件 | 读取方式 |
|---|---|
| `Monster` | `config.maxHealth \|\| monsterConfig.health \|\| monDefaults.health` |
| `Boss` | 继承 `Monster`，额外 `toughness / moveSpeed / aggroRange / …` |
| `ShanxiaoBoss` | `monsterConfig` + `ShanxiaoBoss.DEFAULT_TUNING`（★ 唯一来源） |
| `DueBoss` | `monsterConfig` + `DueBoss.DEFAULT_TUNING`（★ 唯一来源） |
| `DueMinion` | `monsterConfig` + `DueMinion.DEFAULT_TUNING`（★ 唯一来源） |

### Boss 数值（`DEFAULT_TUNING`）：唯一来源

每个 Boss 类内都有一张 `static get DEFAULT_TUNING()`，**它是该 Boss 全部 AI 数值的唯一来源**
（速度 / 判定半径 / 冷却 / 动画时长 / 受击盒等）。构造时：

```js
this.tuning = Object.assign({}, ShanxiaoBoss.DEFAULT_TUNING, config.tuning || {});
//                                                ↑ 唯一来源              ↑ 章节「可选」覆盖
```

章节配置里的 `bossPosition[...].tuning` **只用于按章节覆盖个别字段**，
默认留空（第一章 `boss_shanxiao`、第二章 `boss_due` 现均为空），不再逐条重复默认值。
**改数值只需改 `DEFAULT_TUNING` 一处**；若某章要单独调平衡，只写要改的字段即可，其余自动继承。

```js
// 例：某章想让山魈跑快一点，只写这一项，其余（扑击速度 / 冷却…）继承默认
tuning: { moveSpeed: 200 }
```

**伤害公式统一**（5 处收敛为 1 处）：

```js
const actualDamage = GameConfig.getInstance().calculateDamage(damage, this.defense);
```

### 掉落字段
配置中 `drops` 与 `dropItems` 两种写法都支持：
```js
this.drops = this.monsterConfig.drops || this.monsterConfig.dropItems || [];
```

---

## 三、接口速查

```js
// Monster
monster.update(dt, map)
monster.takeDamage(damage)
monster.render(ctx, camera)
monster.onDeath / onDamageTaken

// Boss
boss.handlePlayerAttack(attackData)
boss.takeDamage(damage)
boss.reduceToughness(amount)      // 韧性归零 → 破势
boss.getCurrentPhase()            // 阶段（phase1 / phase2）

// 竞技场 Boss（由 GameMap 生成）
map.spawnArenaBoss('boss_shanxiao', { position, tuning })
map.clearArenaBoss() / map.hasArenaBoss() / map.isArenaBossDefeated()
```

---

## 四、战斗特效 `CombatEffect.js`

```js
// 帧动画特效（剑气 / 命中 / 气场）
new CombatEffect({ key, frames, frameWidth, frameHeight, fps, layer })
new CombatProjectile({ x, y, dir, speed, maxDistance, damage, radius, ... })
```

- `layer: 'under'` 绘制在角色之下（气场），`'over'` 绘制在角色之上（剑气 / 命中）；
- 由 `PlayerCombat.renderUnderLayer / renderOverLayer` 统一绘制；
- 缺图时自动回退为程序化绘制（圆形 / 环形扩散）。

---

## 五、本次重构修复

| 文件 | 问题 | 修复 |
|---|---|---|
| `DueBoss` | 兜底血量 `400` 与章节配置 `500` 冲突 | 改用 `getMonsterDefaults()` |
| `DueBoss` | `this.drops = monsterConfig.drops`，但第二章配置用的是 `dropItems` → 掉落恒为空 | 兼容两种字段名 |
| `ShanxiaoBoss` | 遗留调试注释 `//this.maxHealth = 1;` | 删除 |
| 全部 | 5 处重复的 `Math.max(1, 伤害 - 防御)` | 收敛为 `calculateDamage()` |
| `Monster` | `defense` 兜底 `0` 与配置 `2` 不一致 | 改用 `getMonsterDefaults()` |
| 全部 Boss | 章节 `tuning` 逐条重复 `DEFAULT_TUNING` | 删除章节重复项，`DEFAULT_TUNING` 为唯一来源（保留覆盖入口） |
| `Boss`/`ShanxiaoBoss`/`DueBoss`/`DueMinion` | 各自实现圆-矩形 / 矩形相交算法 | 删除，统一调用 `CollisionDetector` |

## 六、注意

- Boss 数值改动一律改 `DEFAULT_TUNING`（唯一来源）；章节 `tuning` 仅作可选覆盖。
- 相交判定一律走 `CollisionDetector.rectsIntersect` / `circleIntersectsRect`，
  不要在 Boss 类内再写一份（见 [CollisionDetector.md](CollisionDetector.md)）。
- 验证脚本：`node tools/verify_legacy_fixes.js`（覆盖 tuning 唯一来源 + 碰撞收敛）。
