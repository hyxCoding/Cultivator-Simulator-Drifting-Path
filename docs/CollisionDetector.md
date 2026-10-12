# CollisionDetector.js — 碰撞检测工具

> 纯静态工具类，无状态、无依赖，可在任意模块直接使用。

---

## 一、接口

```js
// 矩形 vs 矩形（AABB）
CollisionDetector.aabb(rect1, rect2)              // → boolean
CollisionDetector.rectsIntersect(rect1, rect2)    // → boolean（aabb 的别名，语义更直观）

// 点 vs 矩形
CollisionDetector.pointInRect(px, py, rect)       // → boolean

// 圆 vs 矩形
CollisionDetector.circleRect(circle, rect)        // → boolean
// circle = { x, y, radius }
CollisionDetector.circleIntersectsRect(center, radius, rect)  // → boolean
// center = { x, y }，供只有圆心 + 半径的场景直接调用

// 分离向量（用于把移动矩形推出静态矩形）
CollisionDetector.getSeparationVector(movingRect, staticRect)  // → { x, y } | null

// 射线 vs 矩形
CollisionDetector.rayRect(rayOrigin, rayDirection, rect)       // → { hit, distance, point } | null
```

所有矩形参数格式统一为 `{ x, y, width, height }`（`x/y` 为左上角）。

---

## 二、使用示例

```js
// 小游戏：船与礁石碰撞
if (CollisionDetector.aabb(boatRect, this.getObstacleRect(obstacle))) { /* 失败 */ }

// 小游戏：鼠标点击卡片
if (CollisionDetector.pointInRect(mouseX, mouseY, cardRect)) { /* 选中 */ }

// 圆形判定（剑气命中）
if (CollisionDetector.circleRect({ x, y, radius: 40 }, enemyRect)) { /* 命中 */ }
```

---

## 三、说明

- 该类是**纯函数集合**，可安全在小游戏 / 战斗 / UI 中复用；
- 小游戏（`BoatNavigationMiniGame`、`MemorySortMiniGame` 等）依赖它，但这是无副作用的纯工具，不构成与主游戏的耦合。

### 圆-矩形 / 矩形相交：全项目唯一实现（本轮已收敛）

`rectsIntersect` 与 `circleIntersectsRect` 是**全项目唯一的相交判定实现**。
`Boss` / `ShanxiaoBoss` / `DueBoss` / `DueMinion` 原先各自实现过一份同名的圆-矩形 / 矩形相交算法，
现已全部删除、改为调用本类；`PlayerCombat` 的 `_rectsIntersect` / `_circleIntersectsRect`
也改为代理本类（保留方法名以兼容既有调用点）。

```js
// Boss 受击判定（示例）
if (!CollisionDetector.rectsIntersect(attackData.rect, this.getHitRect())) return false;
// 圆形技能命中（示例）
const hit = CollisionDetector.circleIntersectsRect(center, radius, enemyRect);
```

> 收敛后「改一处即全局生效」：相交规则（含边界 `<=` 的相切判定）只在本文件维护。
> 验证脚本：`node tools/verify_legacy_fixes.js`（覆盖 4 类 Boss 不再自带同名静态方法 + 判定正确性）。
