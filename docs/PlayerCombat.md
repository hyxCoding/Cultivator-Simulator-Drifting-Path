# PlayerCombat.js — 大地图实时战斗

> 大地图上的即时战斗：普通攻击（J）、灵息弹（U）、护体术（I）、闪避（L）、剑影连斩（O），
> 以及气血条 / 灵息条 / 技能栏 HUD 与全部战斗特效。

由 `Main` 持有：`main.playerCombat`（构造时传入 `{ main }`）。

---

## 一、构造

```js
new PlayerCombatSystem({ main });    // main 用于取 player / map
```

构造时调用 `_applyGameConfigValues()`，把 `GameConfig.skills` 的技能数值**整体同步**过来。

---

## 二、数值来源（重构后）

`PlayerCombatSystem.CONFIG` 仍是本模块美术规格与按键布局的唯一来源，
但**战斗数值**统一从 `GameConfig.skills` 同步：

| 同步字段 | 来源 |
|---|---|
| `lingxidan` 的 `manaCost / cooldown / damage / maxDistance / projectileSpeed` | `GameConfig.skills.basic.lingxidan` |
| `hutishu` 的 `manaCost / cooldown / duration / damageReduction` | `GameConfig.skills.basic.hutishu` |
| `jianying` 的 `manaCost / cooldown / damage / maxDistance / projectileSpeed` | `GameConfig.skills.jianxiu.jianying` |
| 普攻 `attack` 的 `manaCost / cooldown` | `CONFIG.attack`（无对应技能定义） |
| `dodge` 的数值 | `CONFIG.dodge`（无对应技能定义） |

> 修复前：只同步了 `damage / maxDistance / projectileSpeed / damageReduction`，
> `manaCost` 与 `cooldown` 长期与 `GameConfig` 不一致（改配置不生效）。

---

## 三、主要接口

```js
pcs.update(dt)                          // 每帧：冷却 / buff / 施法 / 投射物 / 特效
pcs.renderUnderLayer(ctx, camera)       // 气场类特效（角色之下）
pcs.renderOverLayer(ctx, camera)        // 剑气 / 灵息弹 / 命中特效（角色之上）

pcs.tryAttack() / trySkill(slot) / tryDodge()
pcs.isSkillLearned(skillId)             // 剑影连斩等「习得制」技能
pcs.playFoundationAura() / playFoundationAura 系列   // 章末剧情气场
pcs.getHudState()                       // HUD 数据（血条 / 灵息条 / 冷却）

pcs.serialize() / deserialize(data)
```

`GameLoop.render` 会依次调用 `renderUnderLayer` 与 `renderOverLayer`（见 [GameLoop.md](GameLoop.md)）。

---

## 四、HUD

- **气血条 / 灵息条**：使用自定义图片（`ui.health_bar_bg` + `ui.health_bar_fill`、`ui.mana_bar_bg` + `ui.mana_bar_fill`），
  条上不显示数字；图片缺失 / 尺寸不符时不绘制。
- **左下角技能栏**：`CONFIG.hud.skillBar.order = ['lingxidan','hutishu','dodge','jianying']`，
  每格 100×100 图标，不写文字；冷却只画遮罩。剑影连斩习得后才占格。

美术规格与偏移量全部集中在 `CONFIG`（含注释），改一个值即可微调位置 / 缩放。

---

## 五、按键

| 键 | 技能 |
|---|---|
| `J` | 普通攻击 |
| `U` | 灵息弹 |
| `I` | 护体术 |
| `L` | 闪避 |
| `O` | 剑影连斩（习得后） |

---

## 六、状态委托：冷却 / 解锁 / 习得（第三轮）★

`PlayerCombat` **不再自持**冷却与解锁状态，全部委托玩家状态机
（`player.playerData.stateMachine`，见 [StateMachine.md](StateMachine.md)）：

| 能力 | 实现 |
|---|---|
| 冷却表 | `get cooldowns()` 直接返回 `stateMachine.skillCooldowns`（全项目唯一一份）；`_tickTimers` 调 `sm.tick(dt)` 推进 |
| 战斗按键解锁 | `isUnlocked()` / `setUnlocked()` 读写 `combatUnlocked`（单调） |
| 技能解锁 | `isSkillUnlocked(id)`：按上下文推导 → `sm.unlockSkill(id)` → 以状态机为准读出 |
| 技能习得 | `isSkillLearned(id)`：命中推导即 `sm.learnSkill(id)`（读档兜底：职业技能等级 / 任务目标） |
| 技能互斥 | `_checkCost` 检查 `sm.isSkillLocked(id)`（技能 A 施展后一段时间禁用 B） |

> 无玩家状态机时（极早期 / 桩测试）退回本地兜底 `_fallbackCooldowns` / `_fallbackCombatUnlocked`。
> 修复记录：`isUnlocked()` 一度写了兜底却从不读它，导致无状态机时门控恒失效（技能按不出来）——
> 现已补上读取分支，并新增 `tools/verify_state_machines.js` 的接线断言守住。

