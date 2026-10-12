# InputManager.js / UIButton.js / Camera.js — 输入、按钮与镜头

> 对应模块：`InputManager`（键鼠输入）、`UIButton`（通用按钮）、`Camera`（镜头跟随与坐标转换）。

---

## 一、InputManager

```js
const im = new InputManager();
im.attachEventListeners(canvas) / detachEventListeners()

// 查询
im.getInputState()               // 每帧状态快照 { keys, mouseX, mouseY, mousePressed, ... }
im.isKeyDown(key) / isKeyPressed(key) / isKeyReleased(key)
im.isMovementKeyPressed() / isInteractKeyPressed() / isAttackKeyPressed()
im.isSkillKeyPressed(slotIndex)

// 屏蔽
im.setInputBlocked(bool) / isInputBlocked()
im.setMovementBlocked(bool) / setCombatBlocked(bool) / setInteractionBlocked(bool)

// 隔离（进入小游戏时清空残留输入）
im.clearFrameState()             // 清本帧瞬时键
im.clearHeldKeys()               // 清「按住不放」的键

im.serialize() / deserialize(data)
```

### 按键处理
`isGameKey(key)` 判断某键是否属于游戏键；非游戏键（如浏览器快捷键）不拦截。

### 进入小游戏时的输入隔离
`Main._resetInputForMiniGame()` 调用 `clearFrameState()` + `clearHeldKeys()`，
防止主图按住的 `WASD` 被小游戏读走（否则角色一进局就被推着走）。

---

## 二、UIButton

通用按钮（主菜单 / 对话框选项 / 商店等）。

```js
const btn = new UIButton({
    x, y, width, height,
    text: '读取存档',
    onClick: () => {},
});
btn.containsPoint(px, py)
btn.update(mouseX, mouseY, mousePressed, mouseClicked, dt)
btn.render(ctx)
btn.setPosition(x, y) / setCallback(fn) / setEnabled(bool) / setVisible(bool)
btn.serialize() / deserialize(data)
```

悬停音效只在鼠标**放上去**那一次播放（停住不动不重播）。

## 三、Camera

```js
const cam = new Camera({ width: 1280, height: 720 });
cam.setTarget(player)
cam.setBounds(minX, minY, maxX, maxY)
cam.update(dt)
cam.shake(intensity, duration) / updateShake(dt)

cam.getRenderPosition()              // 渲染偏移
cam.worldToScreen(wx, wy) / cam.screenToWorld(sx, sy)
cam.isInView(wx, wy, margin)
cam.clampX(x) / clampY(y)
cam.serialize() / deserialize(data)
```

镜头跟随目标并限制在地图边界内；`shake` 用于战斗 / 演出震屏。

---

## 四、坐标约定

| 坐标系 | 用途 |
|---|---|
| 世界坐标 | 实体位置、地图碰撞（像素，地图左上角为原点） |
| 屏幕坐标 | 绘制、鼠标点击（画布 1280×720） |

渲染实体时统一用 `const rp = camera.getRenderPosition()` 后做 `world - rp` 换算。
