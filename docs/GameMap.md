# GameMap.js / MapManager.js / TileSystem.js / AStar.js — 地图与寻路

> 对应模块：`GameMap`（单张地图）、`MapManager`（地图加载与切换）、
> `TileSystem`（瓦片可通行表）、`AStar`（寻路）。

---

## 一、MapManager

```js
const mm = new MapManager();
const map = await mm.loadMap('qinglan_fuye');       // → GameMap
await mm.switchMap('yunduze', player);              // 切换地图并把玩家放到入口
mm.getCurrentMap() / mm.getMap(mapId)
mm.update(dt, input) / mm.render(ctx, camera)
mm.serialize() / mm.deserialize(data)
```

## 二、GameMap

一张地图持有：瓦片层、NPC、怪物、可拾取物、路标、调查点、传送法阵、场景动画（飘落物）。

```js
map.init()                                  // 按配置初始化
map.setPlayer(player)

// 实体增删
map.addNPC(npcId, npc) / map.removeNPC(npcId)
map.addMonster(key, monster) / map.removeMonster(key)
map.addPickupItem(item) / map.removePickupItem(id) / map.getPickupItemsNearby(pos, radius)
map.addTeleport(key, teleport)

// 竞技场 Boss
map.spawnArenaBoss('boss_shanxiao', { position, tuning })
map.clearArenaBoss() / map.hasArenaBoss() / map.detachArenaBoss() / map.ensureArenaBoss()
map.setArenaBossDefeated(bool) / map.isArenaBossDefeated()
map.setArenaIntroLock(bool)

// 场景动画
map.updateSceneAnimations(dt, camera)
map.getCenterWorldPosition()
map.createArenaExitArray(config)
```

## 三、TileSystem

把碰撞图（白 = 可走 / 黑 = 阻挡）解析成瓦片可通行表。

```js
const ts = new TileSystem({ ... });
ts.initTilesFromCollisionImage()
ts.isTileWalkable(tileX, tileY)             // → boolean
ts.getTileIndexFromPixel(px, py)
ts.getTileCenterPixel(tileX, tileY)
ts.getWalkableTilesAround(px, py, radius)
ts.getWalkableGrid()
ts.serialize() / deserialize(data)
```

> 碰撞图在 `file://` 下会被 CORS 拦截 `getImageData`，此时走硬编码兜底表（各小游戏 / 地图自带）。

## 四、AStar

纯静态寻路工具。

```js
AStar.findPath(start, end, grid, tileSize)              // → 路径点数组
AStar.findAxisAlignedPath(start, end, grid, tileSize)   // 轴对齐路径（Boss 追击用）
AStar.hasLineOfSight(tileA, tileB)
AStar.optimizePath(tilePath) / simplifyAxisAlignedPath(tilePath, grid)
```

---

## 五、坐标与碰撞约定

- 世界坐标单位为像素；地图以左上角为原点。
- `Camera` 负责世界坐标 ↔ 屏幕坐标转换（见 [InputManager.md](InputManager.md)）。
- 玩家移动碰撞盒为 24×24（小于瓦片边长 32），以保证窄道 / 单瓦片桥可通行。

## 六、性能

`GameLoop` 对地图实体的遍历已改为索引 `for` 循环（去闭包分配），
详见 [GameLoop.md](GameLoop.md)。
