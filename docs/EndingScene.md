# EndingScene.js / EndingText.js — 结局滚动字幕

> 对应模块：`EndingScene`（结局场景：背景 + 逐行居中上滚 + 任意键返回）、
> `EndingText`（字幕文案数据，由 `tools/generate_ending_text.py` 生成）。

---

## 一、EndingScene

由 `Main.initScenes()` 注册为 `ending` 场景。

```js
scene.enter(params)                 // 进入结局界面（重置滚动、加载背景）
scene.update(dt, input)             // 推进滚动；任意键 / 点击 → dismiss()
scene.render(ctx)                   // 背景 + 字幕 + 提示
scene.dismiss()                     // 结束结局，返回上一场景
scene.exit()

scene.readLines()                   // 读取字幕行（来自 EndingText）
scene.loadBackground() / resetScroll()
scene.getLineY(i) / getTotalHeight() / getDuration() / isLineVisible(i)
scene.renderBackground(ctx, w, h)
scene.renderLine(ctx, text, y, w, h)
scene.renderPrompt(ctx, w, h)
```

---

## 二、EndingText

字幕文案以数据形式提供（避免把长文本写死在逻辑里）：

```js
EndingText.lines        // 或等价的数据结构
```

文案由 `tools/generate_ending_text.py` 从 `tools/游戏结束滚动文字.txt` 生成，
修改文案后重新运行该脚本即可。

---

## 三、触发

章末二登船后的剧情节点调用 `sceneManager.switchScene('ending', { ... })`。
飘落物特效在此界面同样启用（见 [Animation.md](Animation.md)）。
