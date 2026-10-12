# Animation.js / AnimationManager.js / FallingFoliage.js — 帧动画与特效

> 对应模块：`Animation`（单个动画，含四方向帧序列）、`AnimationManager`（动画集合管理）、
> `FallingFoliage`（飘落物：落叶 / 落花）。

---

## 一、Animation

一个动画实例内部包含四个方向（下 / 左 / 右 / 上）的帧序列，按行（row）切图。

```js
const anim = new Animation({
    name: 'walk',
    image,                  // 图集
    frameWidth: 32, frameHeight: 32,
    directionMode: 'row',
    directions: {
        down:  { row: 0, frames: 4 },
        left:  { row: 1, frames: 4 },
        right: { row: 2, frames: 4 },
        up:    { row: 3, frames: 4 },
    },
    fps: 10, loop: true,
});

anim.play({ reset: true, loop: true, direction: 'down' })
anim.update(dt)
anim.render(ctx, x, y, width, height, options)
anim.setDirection('up') / anim.stop() / pause() / resume() / reset() / goToFrame(i)
anim.getCurrentSourceRect() / getCurrentDirection() / getCurrentFrameCount()
anim.hasDirection(dir) / anim.clone()
anim.onComplete = () => {}      // 非循环动画结束回调
anim.serialize() / deserialize(data)
```

## 二、AnimationManager

```js
const am = new AnimationManager();
am.addAnimation(name, anim) / am.addAnimations(animations)

am.play(name, options)          // 切换并播放；不存在则告警并返回 null
am.setDirection(dir) / getDirection()
am.stop() / pause() / resume()
am.update(dt) / am.render(ctx, x, y, w, h, options)
am.getCurrentAnimation() / getAnimation(name) / hasAnimation(name)
am.serialize() / deserialize(data)
```

> **注意**：`play(name)` 在动画不存在时会打印 `动画不存在: xxx` 并返回 `null`。
> 调用前请用 `hasAnimation(name)` 判断（本次重构修复了 `Player.performDodge` 里
> 对不存在的 `'skill'` 动画的调用）。

## 三、FallingFoliage

环境特效：图片帧动画 + 飘落轨迹（用于前两章主图 / 开始界面 / 完结界面）。

```js
const ff = new FallingFoliage(config);
ff.applyConfig(config)
ff.setEnabled(bool) / isEnabled()
ff.setArea(area) / getArea()
ff.getCount()
ff.reset()
ff.loadImages(resourceManager)
ff.update(dt)
ff.render(ctx, offsetX, offsetY)
```

特性：
- 按摄像机视口生成，同屏数量稳定（`maxCount` 上限）；
- 12 帧循环，飘落轨迹非直线；
- 飘出边界自动回收；
- 缺图时走程序化兜底。

显示范围：仅前两章主图 + 开始界面 + 完结界面（小游戏 / Boss 战场 / 世界地图不显示）。

---

## 四、动画命名约定（玩家）

| 名称 | 说明 |
|---|---|
| `idle` / `walk` / `attack` / `hurt` | 基础动作（4 方向） |
| `skill_lingxidan` | 灵息弹施法动画 |
| `dead` | 死亡 |

动画图集资源键前缀由职业决定（如 `player.sanxiu_*`）。
