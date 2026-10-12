# ChapterLoader.js / Chapter1Config.js / Chapter2Config.js — 章节配置

> 对应模块：`ChapterLoader`（章节配置注册器）、
> `Chapter1Config`（第一章「青岚浮野」）、`Chapter2Config`（第二章「云渡泽」）。

---

## 一、作用

章节配置是**剧情内容的唯一来源**：NPC、任务、怪物、地图、对白、商店、掉落等。
`ChapterLoader` 把它们注册进 `GameConfig` 的运行时容器：

```
Chapter1Config.getAll()  ┐
                         ├─► ChapterLoader.registerChapter(data)
Chapter2Config.getAll()  ┘        └─► GameConfig.registeredNPCConfigs
                                      GameConfig.registeredQuests
                                      GameConfig.registeredMonsters
                                      GameConfig.registeredMaps
                                      GameConfig.registeredItems
```

之后所有模块通过 `GameConfig.getMonster(id)` / `getQuest(id)` / `getNPCConfig(id)` 等取值，
**不需要知道配置来自哪一章**。

---

## 二、ChapterLoader 接口

```js
const cl = new ChapterLoader();       // 实际以 window.chapterLoader 提供
cl.registerChapter(chapterData)       // 注册一章
cl.registerChapters([data1, data2])
cl.isChapterLoaded(chapterId)
cl.getLoadedChapters()
```

### 深合并规则
同名 NPC（如「阿禾」跨两章出现）会做**深合并**：保留第一章的美术与商店数据，
并入第二章的对白与任务（`ChapterLoader._mergeConfig`）。这样同一 NPC 无需重复定义。

---

## 三、注册时机

`Main.init()` 中：

```js
window.chapterLoader.registerChapter(Chapter1Config.getAll());
window.chapterLoader.registerChapter(Chapter2Config.getAll());
```

必须在创建玩家 / 加载地图**之前**完成。

---

## 四、新增章节

```js
// 1) 新建 js/Chapter3Config.js，导出 getAll()
class Chapter3Config {
    static getAll() {
        return {
            chapterId: 'chapter3',
            npcs: { ... },
            quests: { ... },
            monsters: { ... },
            maps: { ... },
            dialogues: { ... },
        };
    }
}
// 2) game.html 第 2.5 层引入
// 3) Main.init 中 registerChapter(Chapter3Config.getAll())
```
**无需修改 ChapterLoader 或任何既有章节配置。**

---

## 五、常见配置位置

| 想改的东西 | 位置 |
|---|---|
| 怪物血量 / 伤害 / 掉落 | `ChapterXConfig.getAll().monsters` |
| 任务目标链 / 前置 / 奖励 | `.quests` |
| NPC 站位 / 对白 / 商店 | `.npcs` |
| 地图瓦片 / 碰撞 / 交互点 | `.maps` |
| Boss 战场 tuning（移速 / 技能冷却等） | `.maps` 或 `.bossPosition` 的 `tuning` |

> 注意：Boss 类内部还有一份 `DEFAULT_TUNING` 兜底，与章节 `tuning` 数值重复
> （章节优先）。见 [Monster.md](Monster.md) 的「遗留」。
