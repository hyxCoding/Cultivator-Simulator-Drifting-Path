# AudioManager.js — 音频管理

> 背景音乐（循环、单曲）与音效（单次、池化、节流）。
> 单例 + 全局便捷对象 `gameAudio`。

---

## 一、两种调用方式

```js
// 1) 全局便捷对象（推荐）
gameAudio.playBgm('bgm.qinglan_fuye');
gameAudio.stopBgm();
gameAudio.playSfx('sfx.pickup');

// 2) 单例
const am = AudioManager.getInstance();
am.playBgm('bgm.minigame_herb');
am.stopBgm('bgm.minigame_herb');
am.playSfx('sfx.victory');
```

`Main` 持有 `this.audioManager` 并优先使用它（便于统一控制音量与场景切换）。

---

## 二、核心接口

```js
am.playSfx(key)              // 播放音效（单次，池化，同种音效 0.2s 内不重复）
am.playSfxExclusive(key)     // 独占音效（会打断同类）
am.isSfxPlaying(key)

am.playBgm(key)              // 播放背景音乐（循环）
am.stopBgm(onlyIfKey)        // 停止；传 key 则只停这一首
am.scheduleBgm(key, delay)   // 延迟播放（回主图 BGM 用 10 秒倒计时，重复调度重新计时）
am.getScheduledBgmKey() / getScheduledBgmRemaining()
am.isBgmPlaying()

am.setVolume(bgm, sfx) / stopAll() / update(dt)
am.getState()                // 调试用状态快照
```

### 静态成员
```js
AudioManager.MAP_BGM          // { mapId: bgmKey } 地图 BGM 映射
AudioManager.MINIGAME_BGM     // { gameId: bgmKey } 小游戏 BGM 映射
AudioManager.getMapBgmKey(mapId)
AudioManager.getMinigameBgmKey(gameId)
AudioManager.isMapBgm(key) / isMinigameBgm(key)
AudioManager.MAP_BGM_RETURN_DELAY  // 回主图 BGM 延迟（10 秒）
AudioManager.SFX_POOL_SIZE         // 音效池大小（4）
AudioManager.SFX_MIN_INTERVAL      // 同种音效节流（0.2 秒）
```

---

## 三、浏览器自动播放策略

浏览器要求「玩家先与页面交互」才允许出声。`AudioManager` 在**构造时就绑定**交互监听：

```js
am.handleUserGesture()   // 被首次点击 / 按键触发
am.hasUserGesture()      // 是否已交互
am.isBgmPending()        // 是否有被拦下、等待补播的 BGM
```

- 加载界面上的那一次点击同样算数，会立刻补播被拦下的 BGM；
- `game.html` 中的 `#soundHint`（「点一下画面任意处即可开启声音」）据此显示 / 隐藏。

---

## 四、场景切换约定

| 时机 | 行为 |
|---|---|
| 进入大地图 | 播主图 BGM（`onGameWorldSceneEnter`） |
| 切换地图 | 换对应地图 BGM（`onMapSwitched`） |
| 进入小游戏 | 立即停主图 BGM；`boat_navigation` 起播小游戏 BGM |
| 小游戏结束 | 立即停小游戏 BGM（`Main.handleMiniGameEnd`） |
| 回到大地图 | 主图 BGM 走 10 秒延迟（`scheduleBgm`），期间不打断 |
| 进入 Boss 战 | 停主图 BGM，播战斗 BGM |

小游戏内部的 BGM 由小游戏自己起播 / 收尾（如《乘风采药》只在起风期间循环），
通过基类服务适配器 `this.playBgm / this.stopBgm` 调用（见 [MiniGame.md](MiniGame.md)）。

---

## 五、容错

- 缺失音频文件时**静默跳过**，不报错、不阻塞；
- 同种音效 0.2 秒内不重复播放（连点 / 同帧多次调用只响一次）；
- 受伤音效不叠加（避免受击时噪音）。
