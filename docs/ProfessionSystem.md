# ProfessionSystem.js — 职业与技能

> 管理玩家职业选择、技能配置、攻击数值计算。
> 由 `Player` 持有：`player.professionSystem`。

---

## 一、构造与境界来源

```js
new ProfessionSystem({ professionId: 'sanxiu', playerData })   // playerData 由 Player 注入
```

**境界来源**：`getCurrentRealm()` 实时读取注入的 `playerData.realm`；未注入时回落
`GameConfig.getDefaultRealmId()`。

> 修复前：`getCurrentRealm()` 硬编码返回 `'zhuji'`，导致练气期就解锁了筑基技能。

---

## 二、接口

```js
ps.switchProfession('jianxiu')       // 切换职业（重置职业技能，按境界解锁）
ps.isRealmReached('zhuji')           // ★ 是否已达某境界门槛（境界顺序取自 GameConfig.realmOrder）
ps.isSkillUnlocked('zhuji')          // @deprecated 旧名别名，等价于 isRealmReached
ps.getCurrentRealm()                 // 当前境界（读 playerData）
ps.getCurrentRealmStage()            // 当前小阶段
ps.setPlayerData(playerData)         // 重绑数据引用（读档时用）

ps.upgradeSkill(skillId, 'basic' | 'profession')
ps.getSkillLevel(skillId)
ps.getProfessionSkills() / getBasicSkills()

ps.getAttackDamage()                 // 基础伤害（GameConfig.playerCombatBase）+ 职业加成
ps.getAttackRange()                  // 基础范围 + 职业加成
ps.getAttackCooldown()               // 基础冷却 - 职业减冷却
ps.calculateDamageTaken(incoming)    // 职业防御减伤

ps.serialize() / ps.deserialize(data)
```

> ★ **语义澄清（第三轮）**：旧名 `isSkillUnlocked(unlockStage)` 容易被误解为「技能是否解锁」，
> 实际做的是**境界门槛比较**。已改名 `isRealmReached()`；技能**是否解锁 / 习得**由玩家状态机
> `PlayerStateMachine.isSkillUnlocked / isSkillLearned` 统一负责（见 [StateMachine.md](StateMachine.md)）。

---

## 三、数值来源（重构后）

| 数值 | 来源 |
|---|---|
| `baseDamage` | `GameConfig.playerCombatBase.attackDamage` |
| `baseRange` | `GameConfig.playerCombatBase.attackRange` |
| `baseCooldown` | `GameConfig.playerCombatBase.attackCooldown` |
| 职业加成 | `GameConfig.professions[职业]` |
| 境界顺序 | `GameConfig.getRealmOrder()` |
| 技能定义 | `GameConfig.getSkill(skillId)` |

---

## 四、技能点：唯一存储 = `PlayerData`（本轮已收敛）

技能点（`basicSkillPoints` / `professionSkillPoints`）的**唯一存储位置是 `PlayerData`**。
`ProfessionSystem` 对外暴露同名属性，但它们是**访问器（getter/setter）代理**：

```js
get basicSkillPoints()      { return this.playerData ? this.playerData.basicSkillPoints || 0 : this._basicSkillPoints || 0; }
set basicSkillPoints(value) { this.playerData ? (this.playerData.basicSkillPoints = value) : (this._basicSkillPoints = value); }
// professionSkillPoints 同理
```

- **注入了 `playerData`**（`Player` 构造时会注入）：读写一律落到 `playerData`，
  改 `PlayerData` 一处即全局生效，外部调用代码无需改动。
- **未注入 `playerData`**（单独实例化 / 测试）：退回本对象的兜底字段 `_basicSkillPoints` /
  `_professionSkillPoints`，保证可用性。
- `Main.applyQuestRewards` 现在**只写一次** `playerData`（不再同时写两处）。
- `serialize()` 输出访问器值（兼容旧存档）；`deserialize()` 仅在无 `playerData` 时用旧值兜底。

> 修复前：`PlayerData` 与 `ProfessionSystem` 各存一份，`Main.applyQuestRewards` 同时写两处，
> 改一处不生效 —— 现已收敛为单一存储。

---

## 五、注意

- 职业系统**不持有**玩家数据副本，只持有引用，因此境界变更会自动生效。
- 技能点读取统一走 `playerData`（或访问器），不要再直接读 `ProfessionSystem` 上的私有兜底字段。
