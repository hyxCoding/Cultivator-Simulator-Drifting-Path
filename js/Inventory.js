/**
 * 背包系统类
 * 管理玩家的物品存储
 *
 * 存储模型
 * --------
 * `this.items` 是 Map<槽位键, {itemId, count}>，**一个键 = 一个格子**：
 *   · 某物品的第一个格子用 `itemId` 作键（保证与旧存档 / 外部直觉一致）；
 *   · 溢出 / 不可堆叠的额外格子用 `itemId#2`、`itemId#3` …（确定性递增，不再用 Date.now()）。
 *
 * ⚠ 历史 bug（已修）：旧实现用 `${itemId}_${Date.now()}` 作溢出键，而
 *   removeItem / hasItem / getItemCount 只按 `itemId` 查键 →
 *   溢出堆与不可堆叠物品的第 2 件**永远查不到、删不掉**（静默丢物 / 计数漏算），
 *   且同一毫秒内连续 addItem 会生成**相同键**互相覆盖。
 *   现改为「按 itemId 聚合遍历所有格子」，并提供 `_totalOf` 统一口径。
 */
class Inventory {
    /**
     * @param {Object} config - 初始配置
     * @param {number} config.maxSlots - 最大格子数，默认 50（兼容旧字段 capacity）
     */
    constructor(config = {}) {
        this.maxSlots = config.maxSlots || config.capacity || 50;
        this.items = new Map(); // 槽位键 → {itemId, count}
    }

    // ==================== 内部工具 ====================

    /**
     * 取某物品占用的全部格子（按插入顺序）
     * @param {string} itemId
     * @returns {Array<{key: string, stack: Object}>}
     */
    _entriesOf(itemId) {
        const out = [];
        for (const [key, stack] of this.items) {
            if (stack && stack.itemId === itemId) out.push({ key, stack });
        }
        return out;
    }

    /**
     * 某物品的总数量（跨所有格子）
     * @param {string} itemId
     * @returns {number}
     */
    _totalOf(itemId) {
        let total = 0;
        for (const stack of this.items.values()) {
            if (stack && stack.itemId === itemId) total += stack.count;
        }
        return total;
    }

    /**
     * 生成下一个可用的槽位键（同物品的第一个格子用 itemId）
     * @param {string} itemId
     * @returns {string}
     */
    _nextKey(itemId) {
        if (!this.items.has(itemId)) return itemId;
        let n = 2;
        while (this.items.has(`${itemId}#${n}`)) n++;
        return `${itemId}#${n}`;
    }

    // ==================== 增删查 ====================

    /**
     * 添加物品（原子操作：放不下则整批失败，不做部分添加）
     * @param {string} itemId - 物品ID
     * @param {number} count - 数量
     * @returns {boolean} 是否全部添加成功
     */
    addItem(itemId, count = 1) {
        if (!itemId || count <= 0) return false;

        const gameConfig = GameConfig.getInstance();
        const itemConfig = gameConfig.getItem(itemId);

        if (!itemConfig) {
            console.warn(`物品不存在: ${itemId}`);
            return false;
        }

        const stackable = !!itemConfig.stackable;
        const maxStack = stackable ? (itemConfig.maxStack || 99) : 1;
        const entries = this._entriesOf(itemId);
        const freeSlots = this.maxSlots - this.items.size;

        // 1) 先算可用容量（已有格子的剩余空间 + 空格子 × 单格上限）
        let space = 0;
        if (stackable) {
            for (const { stack } of entries) {
                space += Math.max(0, maxStack - stack.count);
            }
        }
        space += Math.max(0, freeSlots) * maxStack;

        if (space < count) {
            console.warn(`背包已满（${itemId} × ${count} 放不下）`);
            return false;
        }

        // 2) 先填已有格子的空位（仅可堆叠）
        let remaining = count;
        if (stackable) {
            for (const { stack } of entries) {
                if (remaining <= 0) break;
                const room = maxStack - stack.count;
                if (room <= 0) continue;
                const put = Math.min(room, remaining);
                stack.count += put;
                remaining -= put;
            }
        }

        // 3) 余下部分开新格子
        while (remaining > 0) {
            const put = Math.min(maxStack, remaining);
            this.items.set(this._nextKey(itemId), { itemId: itemId, count: put });
            remaining -= put;
        }

        if (this.onItemAdded) {
            this.onItemAdded(itemId, count);
        }

        return true;
    }

    /**
     * 移除物品（跨格子扣减）
     * @param {string} itemId - 物品ID
     * @param {number} count - 数量
     * @returns {boolean} 是否移除成功（数量不足则失败，不做部分移除）
     */
    removeItem(itemId, count = 1) {
        if (!itemId || count <= 0) return false;

        const entries = this._entriesOf(itemId);
        let total = 0;
        for (const { stack } of entries) total += stack.count;
        if (total < count) return false;

        let remaining = count;
        // 从后往前扣：优先保留第一个格子（键为 itemId），减少键的增删
        for (let i = entries.length - 1; i >= 0 && remaining > 0; i--) {
            const { key, stack } = entries[i];
            const take = Math.min(stack.count, remaining);
            stack.count -= take;
            remaining -= take;
            if (stack.count <= 0) this.items.delete(key);
        }

        if (this.onItemRemoved) {
            this.onItemRemoved(itemId, count);
        }

        return true;
    }

    /**
     * 检查是否有指定物品（跨格子合计）
     * @param {string} itemId - 物品ID
     * @param {number} count - 数量（可选）
     * @returns {boolean} 是否有该物品
     */
    hasItem(itemId, count = 1) {
        return this._totalOf(itemId) >= count;
    }

    /**
     * 获取物品数量（跨格子合计）
     * @param {string} itemId - 物品ID
     * @returns {number} 物品数量
     */
    getItemCount(itemId) {
        return this._totalOf(itemId);
    }

    /**
     * 获取所有物品（按 itemId 聚合）
     * @returns {Map<string, {itemId: string, count: number}>} 物品列表
     */
    getAllItems() {
        return new Map(this.getItemList().map(item => [item.itemId, item]));
    }

    /**
     * 获取物品列表（数组形式，按 itemId 聚合）
     * @returns {Array<{itemId: string, count: number}>} 物品数组
     */
    getItemList() {
        const merged = new Map();
        for (const stack of this.items.values()) {
            if (!stack) continue;
            const existed = merged.get(stack.itemId);
            if (existed) {
                existed.count += stack.count;
            } else {
                merged.set(stack.itemId, { itemId: stack.itemId, count: stack.count });
            }
        }
        return Array.from(merged.values());
    }

    /**
     * 清空背包
     */
    clear() {
        this.items.clear();
    }

    /**
     * 获取背包占用情况
     * @returns {Object} {used, max}
     */
    getCapacity() {
        return {
            used: this.items.size,
            max: this.maxSlots,
        };
    }

    /**
     * 检查背包是否已满
     * @returns {boolean} 是否已满
     */
    isFull() {
        return this.items.size >= this.maxSlots;
    }

    // ==================== 存档 ====================

    /**
     * 序列化背包数据（用于存档）
     * @returns {Object} 序列化数据
     */
    serialize() {
        return {
            maxSlots: this.maxSlots,
            items: Array.from(this.items.entries()).map(([key, stack]) => ({
                key: key,
                itemId: stack.itemId,
                count: stack.count,
            })),
        };
    }

    /**
     * 反序列化背包数据（用于读档）
     * 兼容旧存档：旧格式的溢出键是 `${itemId}_${时间戳}`，这里一律按 itemId 重新归位。
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;

        this.maxSlots = data.maxSlots || this.maxSlots;
        this.items.clear();

        if (Array.isArray(data.items)) {
            for (const itemData of data.items) {
                if (!itemData || !itemData.itemId) continue;
                const count = itemData.count || 0;
                if (count <= 0) continue;
                // 逐件累加：既能兼容旧键名，也能把旧存档里拆散的堆重新合并
                this.addItemSilently(itemData.itemId, count);
            }
        }
    }

    /**
     * 读档专用：跳过容量校验与回调，直接把物品放回（存档是可信数据）
     * @param {string} itemId
     * @param {number} count
     */
    addItemSilently(itemId, count) {
        const gameConfig = GameConfig.getInstance();
        const itemConfig = gameConfig.getItem(itemId);
        const stackable = itemConfig ? !!itemConfig.stackable : true;
        const maxStack = stackable ? ((itemConfig && itemConfig.maxStack) || 99) : 1;

        let remaining = count;
        if (stackable) {
            for (const { stack } of this._entriesOf(itemId)) {
                if (remaining <= 0) break;
                const room = maxStack - stack.count;
                if (room <= 0) continue;
                const put = Math.min(room, remaining);
                stack.count += put;
                remaining -= put;
            }
        }
        while (remaining > 0) {
            const put = Math.min(maxStack, remaining);
            this.items.set(this._nextKey(itemId), { itemId: itemId, count: put });
            remaining -= put;
        }
    }
}
