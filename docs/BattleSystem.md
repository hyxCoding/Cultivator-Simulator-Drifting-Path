# BattleSystem.js — 回合制战斗

> 独立的回合制战斗系统（与 `PlayerCombat` 的大地图实时战斗并存）。
> 由 `BattleScene` 驱动，用于野外切磋 / 特定战斗流程。

---

## 一、接口

```js
const bs = new BattleSystem({ player, enemies });
bs.startBattle(player, enemies)
bs.update(dt)
bs.executePlayerAction(action)      // 攻击 / 技能 / 道具 / 逃跑
bs.useSkill(skillId)
bs.calculatePlayerDamage()          // 暴击 + 伤害计算
bs.calculateEnemyDamage()
bs.dealDamageToEnemy(target, damage, source, name)
bs.isBattleOver() / getResult()
bs.serialize() / deserialize(data)
```

## 二、数值

| 参数 | 位置 |
|---|---|
| 伤害倍率 / 暴击率 / 暴击倍率 | `BattleSystem` 构造（`damageMultiplier` / `criticalChance` / `criticalMultiplier`） |
| 技能伤害 | `GameConfig.getSkill(skillId).damage` |
| 技能等级加成 | `1 + (level - 1) * 0.1` |
| 逃跑成功率 | `0.5` |
| 回合时限 / 敌人行动后停顿 | ★ `GameConfig.getBattleTiming()`（唯一来源） |

### 回合节奏（唯一来源）

```js
// js/GameConfig.js
this.combat = {
    ...
    turnBased: {
        turnDuration: 30,      // 玩家单回合操作时限（秒），超时自动结束该回合
        enemyTurnDelay: 0.5,   // 敌人行动后停顿多久再推进到下一回合（秒）
    },
};
GameConfig.getInstance().getBattleTiming()   // → { turnDuration, enemyTurnDelay }（返回副本）
```

`BattleSystem` 构造时读取：`this.turnDuration = config.turnDuration || timing.turnDuration;`
`this.enemyTurnDelay = config.enemyTurnDelay || timing.enemyTurnDelay;`。
**改这一处即全局生效**，不要在别处再写 `30` / `0.5`。

## 三、回合推进：与主循环 `deltaTime` 对齐（本轮已收敛）

敌人行动后不再用 `setTimeout(..., 500)`，改为由主循环 `update(deltaTime)` 驱动的倒计时：

```js
// advanceTurn()：敌人回合末尾只设置倒计时
this.turnAdvanceTimer = this.enemyTurnDelay;

// updateTurnBasedBattle(deltaTime)：逐帧递减，到点才推进
if (this.turnAdvanceTimer > 0) {
    this.turnAdvanceTimer -= deltaTime;
    if (this.turnAdvanceTimer <= 0) { this.turnAdvanceTimer = 0; this.advanceTurn(); }
    return;                 // 待推进期间不计回合计时
}
this.turnTimer -= deltaTime;
if (this.turnTimer <= 0) this.advanceTurn();   // 回合超时
```

- **好处**：游戏暂停时倒计时一并暂停、低帧率下节奏不漂移；`turnAdvanceTimer` 是瞬时值，
  不写存档（`deserialize` 归零）。
- 生命周期清理：`startBattle` / `startTurnBasedBattle` / `endBattle` / `deserialize` 都会把
  `turnAdvanceTimer` 归零。
- 验证脚本：`node tools/verify_battle_turn.js`（21 项断言，含「全程不调用 `setTimeout`」）。

## 四、与 `PlayerCombat` 的区别

| | `PlayerCombat` | `BattleSystem` |
|---|---|---|
| 场景 | 大地图即时战斗 | 独立回合制战斗场景 |
| 触发 | `J` / `U` / `I` / `L` / `O` 实时按键 | `BattleScene` 内的行动指令 |
| 技能数值来源 | `GameConfig.skills`（启动同步） | `GameConfig.skills`（直接读取） |
| 玩家普攻路径 | `PlayerCombat.tryAttack` | `Player.performAttack` + `checkPlayerAttacks` |

> 两套系统共存是既有设计；本次重构未合并（涉及玩法差异），但两者读取的技能数值已统一指向 `GameConfig.skills`。

## 五、存档

```js
bs.serialize()      // 战斗状态（回合 / 双方状态）
bs.deserialize(data)
```
