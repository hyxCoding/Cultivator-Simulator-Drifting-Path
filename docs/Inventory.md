# Inventory.js / Shop.js / PickupItem.js — 背包、商店与拾取物

> 对应模块：`Inventory`（玩家背包）、`Shop`（商店 UI 与买卖）、`PickupItem`（地图上的可拾取物）。

---

## 一、Inventory

由 `Player` 持有：`player.inventory`。

```js
const inv = new Inventory({ capacity: 20 });
inv.addItem(itemId, count)          // → boolean（满则失败）
inv.removeItem(itemId, count)       // → boolean
inv.hasItem(itemId, count)
inv.getItemCount(itemId)
inv.getAllItems() / getItemList()
inv.getCapacity() / isFull() / clear()
inv.serialize() / deserialize(data)
```

物品定义来自 `GameConfig.items`（含 `stackable / maxStack / sellPrice / buyPrice / effect`）。

### 使用物品
```js
player.useItem('huiyuan_dan');   // 按 GameConfig.items[id].effect 结算（回血 / 回灵）
```

## 二、Shop

商店面板，由 NPC 的商店配置驱动。

```js
const shop = new Shop();
shop.open(npc, player)
shop.close()
shop.loadShopItems(npc)             // 从 NPC 配置读商品（含库存）
shop.update(dt, input) / render(ctx)
shop.performBuy(qty) / performSell(qty)
shop.executeAction()
shop.showMessage(text)
shop.serialize() / deserialize(data)
```

操作：`↑ ↓` 选择，`Enter` 确认，`Tab` 切换买 / 卖，`ESC` 关闭。

> 本次重构修复：`renderMessage(ctx, px, py, pw)` 函数体引用了未定义的 `ph`，
> 导致**每次买卖提示都抛 `ReferenceError`**。已补 `ph` 参数并给兜底高度。

## 三、PickupItem

地图上的可拾取物（任务道具 / 材料）。

```js
const item = new PickupItem(config);
item.update(dt)
item.render(ctx, camera) / item.renderPrompt(ctx, camera)
item.isPlayerInRange(playerPosition)
item.pickup(questItemSystem, questSystem)   // 拾取：进任务物品或普通背包
item.serialize() / deserialize(data)
```

拾取时播放音效 `sfx.pickup`（与《乘风采药》同一音效）。

---

## 四、物品来源与去向

| 来源 | 去向 |
|---|---|
| 商店购买（`Shop.performBuy`） | `player.inventory` |
| 怪物掉落（`Monster.drops`） | `player.inventory` |
| 地图拾取（`PickupItem`，普通物品） | `player.inventory` |
| 地图拾取（任务物品） | `player.questItemSystem` |
| 任务奖励 | `Main.applyQuestRewards` |

物品定义统一来自 `GameConfig.items`（唯一源，见 [GameConfig.md](GameConfig.md)）。
