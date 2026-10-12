# ResourceManager.js — 资源管理

> 图片 / 音频的路径登记、缓存与占位兜底。**单例**：`ResourceManager.getInstance()`。

---

## 一、路径约定

资源用「点号键」引用，例如：

```js
'ui.health_bar_bg'          // → assets/images/ui/health_bar_bg.png
'player.sanxiu_walk'        // → assets/images/player/sanxiu_walk.png
'miniGame.caoyao_bg'        // → assets/images/miniGame/caoyao_bg.png
'bgm.minigame_herb'         // → assets/audio/bgm/minigame_herb.mp3
'sfx.pickup'                // → assets/audio/sfx/pickup.mp3
```

路径映射登记在 `this.resources.images` / `this.resources.audio` 中。

---

## 二、常用接口

```js
const rm = ResourceManager.getInstance();

rm.getImagePath('ui.skill_dodge')      // 键 → 图片文件路径
rm.getAudioPath('sfx.pickup')          // 键 → 音频文件路径

rm.loadImage(key)                      // → Promise<Image>；失败返回占位图（不 reject）
rm.loadImages([key1, key2])            // → Promise<Image[]>
rm.getCachedImage(key)                 // 同步取缓存；未命中返回 null
rm.loadAudio(key)                      // → Promise<Audio>；失败返回空 Audio

rm.preloadResources(group)             // 预加载一组
rm.preloadResourceGroup(name)
rm.releaseImage(key) / releaseImages(keys) / releaseResourceGroup(name)

rm.getResourceGroup(name)              // 分组（返回副本）
rm.getResourceGroupImagePaths(name)
```

**容错约定**：加载失败不抛错，返回占位图（32×32 品红块）。
调用方可通过判断尺寸 / `src.startsWith('data:')` 识别占位图并走程序化绘制。

---

## 三、资源分组

`resourceGroups` 按用途分组（如 `bossArena` / `bossArenaCh2`），用于进 Boss 战前批量预加载。
`Main.preloadInitialResources()` 在启动时预加载常用资源，保证小游戏 / 战斗能用 `getCachedImage` 同步取图。

---

## 四、在小游戏中的使用

小游戏**不直接调用** `ResourceManager`，而是通过基类服务适配器：

```js
// 小游戏内部
const bg = this.getServiceImage('miniGame.caoyao_bg');
this.loadServiceImage('miniGame.caoyao_bg').then(img => { ... });
```

未注入服务时，适配器自动回落 `ResourceManager` 单例（见 [MiniGame.md](MiniGame.md)）。
