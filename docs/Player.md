# Player.js — 玩家实体

> 玩家实体：位置 / 移动 / 碰撞 / 动画 / 交互 / 成长。
> 持有 `playerData`（唯一数据源）、`inventory`、`professionSystem`、`questSystem`、`questItemSystem`、`animationManager`。

---

## 一、构造

```js
const player = new Player({
    position: { x, y },
    playerData: { realm: 'lianqi', stage: '初期', lingShi: 0 },  // 数值由 GameConfig 派生
    profession: { professionId: 'sanxiu' },
    animationManager,     // 可选
    inventory,            // 可选
});
```

`Player` 构造时会把 `playerData` 注入 `ProfessionSystem`（`professionSystem.setPlayerData` 亦可手动重绑）。

---

## 二、主要方法

### 移动与碰撞
```js
player.update(dt, input, map)          // 每帧更新（移动 / 动画 / 灵息恢复 / 交互检测）
player.updateMovement(dt, input, map)
player.moveWithCollision(newX, newY, map)   // 分轴推进（贴墙滑动）
player.getCollisionRect(x, y)          // 移动碰撞盒（24×24，与绘制尺寸解耦）
```

### 属性（走 PlayerData 方法）
```js
player.heal(amount)          // → playerData.changeHealth(+amount)
player.restoreMana(amount)   // → playerData.changeMana(+amount)
player.die() / player.revive(position)
player.updateManaRegen(dt)   // 按 GameConfig.getManaRegen(境界) 恢复灵息
player.getCurrentMoveSpeed() // 境界移速 + 职业加成
```

### 成长
```js
player.gainExperience(amount)
player.breakthrough()        // 圆满 + 有下一境界 → applyRealmStats(下一境界)
```

### 交互与战斗
```js
player.interactWithNPC() / player.endInteraction()
player.performAttack()       // 旧攻击路径（回合制 / BattleScene 使用）
player.performDodge()        // 闪避（无敌 + 冲刺）
player.useItem(itemId)
player.onAttack / onDeath / onInteract     // 回调
```

### 存档
```js
player.serialize()           // position / playerData / inventory / professionSystem / questSystem / animationManager
player.deserialize(data)
```

---

## 三、关键数值来源（重构后）

| 数值 | 来源 |
|---|---|
| 气血 / 灵息上限 | `GameConfig.realms[境界]`（经 `PlayerData` 派生） |
| 移速 | `realms[境界].moveSpeed` + `professions[x].moveSpeedBonus` |
| 灵息恢复 | `GameConfig.getManaRegen(境界)` |
| 闪避冷却 / 时长 / 速度系数 | `GameConfig.playerCombatBase` |
| 普攻伤害 / 范围 / 冷却 | `ProfessionSystem` → `GameConfig.playerCombatBase` |
| 境界推进顺序 | `GameConfig.getRealmOrder()` |

---

## 四、本次重构修复

| 问题 | 修复 |
|---|---|
| `performDodge` 播放从未注册的 `'skill'` 动画（每次闪避都告警且无效） | 改为 `hasAnimation('dodge')` 才播放 |
| `dodgeCooldown = 1.0 / dodgeDuration = 0.25` 硬编码 | 取自 `GameConfig.playerCombatBase` |
| `getCurrentMoveSpeed` 兜底 `200` 硬编码 | 取自 `getPlayerCombatBase().moveSpeed` |
| `breakthrough` 本地 `realmOrder` 数组 + 手写上限赋值 | 改用 `getNextRealm()` + `playerData.applyRealmStats()` |
| `updateManaRegen` 重复的 `> 0 ? : 1/2` 兜底 | 改用 `GameConfig.getManaRegen()` |
| `heal / restoreMana / revive` 直接改字段 | 改走 `PlayerData` 方法（自动裁剪） |
