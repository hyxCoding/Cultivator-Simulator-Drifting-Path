# GameLoop.js — 固定步长主循环

> 驱动整局游戏的 update / render 节奏，采用**固定步长 + 累加器**，避免不同帧率下物理行为漂移。

---

## 一、基本用法

```js
const loop = new GameLoop({ fps: 60 });

loop.setContext(ctx);              // Canvas 2D 上下文
loop.setPlayer(player);
loop.setPlayerCombat(playerCombat);
loop.setCurrentMap(map);
loop.setInputManager(inputManager);
loop.setSceneManager(sceneManager);
loop.setCamera(camera);
loop.setUiManager(uiManager);

loop.addUpdateCallback((dt, input) => { /* Main.update */ });
loop.addRenderCallback((ctx, interpolation) => { /* Main.render */ });

loop.start();      // 开始
loop.pause();      // 暂停
loop.resume();
loop.stop();
```

`Main` 通过 `setupGameLoop()` 把自身的 `update / render` 挂到额外回调上。

---

## 二、循环机制

- `fixedDeltaTime = 1/60`：逻辑更新步长恒定。
- `maxDeltaTime = 0.1`：单帧最大补偿时长（切后台回来时防止「追帧爆炸」）。
- `maxUpdates = 5`：单帧最多执行的逻辑步数。
- 渲染时传入 `interpolation`（0~1）用于插值。

```
loop()
  ├─ 计算 deltaTime（上限 maxDeltaTime）
  ├─ accumulator += deltaTime
  ├─ while (accumulator >= fixedDeltaTime && steps < maxUpdates)
  │     ├─ update(fixedDeltaTime)
  │     └─ accumulator -= fixedDeltaTime
  └─ render(accumulator / fixedDeltaTime)
```

---

## 三、每帧更新顺序（`update`）

```
1. inputManager.getInputState()
2. sceneManager.update()          ← 场景切换 / 当前场景更新
3. player.update()
4. currentMap.npcs.forEach(update)
5. currentMap.monsters.forEach(update)
6. currentMap.pickupItems.forEach(update)
7. currentMap.signposts.forEach(update)
8. currentMap.windPiles.forEach(update)
9. currentMap.updateSceneAnimations()   ← 飘落物等
10. camera.update()
11. uiManager.update()
12. extraUpdateCallbacks（Main.update）
13. 调试信息
```

## 四、每帧渲染顺序（`render`，自下而上）

```
清屏
1. currentMap.render()              ← 地图背景 + 场景动画
2. 碰撞调试覆盖层（F2）
3. currentMap.npcs.forEach(render)
4. currentMap.monsters.forEach(render)
5. currentMap.windPiles.forEach(render)
6. currentMap.teleporters.forEach(render)
7. playerCombat.renderUnderLayer()  ← 气场类（角色之下）
8. player.render()
9. playerCombat.renderOverLayer()   ← 剑气 / 灵息弹 / 命中特效
10. uiManager.render()
11. extraRenderCallbacks（Main.render）
```

---

## 五、性能说明（本次优化）

- 实体遍历由 `forEach(箭头函数)` 改为**索引 `for` 循环**，消除每帧的闭包分配。
- 每帧调用频率最高的模块（`GameConfig.getRealm` / `getManaRegen`）已加缓存与零分配返回，详见 [GameConfig.md](GameConfig.md)。

---

## 六、存档

```js
loop.serialize()      // { fps, frameCount, elapsedTime, isRunning, isPaused }
loop.deserialize(data)
```

> 注意：`GameLoop` 不负责保存玩家数据（由 `SaveManager` 统一收集 `player.serialize()`）。
