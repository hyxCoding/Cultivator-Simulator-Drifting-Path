/**
 * 任务物品系统类
 * 管理玩家持有的任务物品（如归乡牌、魂灯、名册等）
 * 并支持 NPC 对话根据持有物品解锁
 */
class QuestItemSystem {
    constructor() {
        /** @type {Map<string, number>} 物品ID → 持有数量 */
        this.items = new Map();
        /** @type {Function|null} 物品变更回调 (itemId, count) => void */
        this.onItemChanged = null;
    }

    /**
     * 添加任务物品
     * @param {string} itemId - 物品ID
     * @param {number} count - 添加数量，默认1
     * @returns {boolean}
     */
    addItem(itemId, count = 1) {
        const current = this.items.get(itemId) || 0;
        this.items.set(itemId, current + count);
        Logger.log(`[QuestItemSystem] 获得任务物品: ${itemId} x${count}，现有: ${current + count}`);
        if (this.onItemChanged) this.onItemChanged(itemId, this.items.get(itemId));
        return true;
    }

    /**
     * 移除任务物品
     * @param {string} itemId - 物品ID
     * @param {number} count - 移除数量，默认1
     * @returns {boolean} 是否移除成功
     */
    removeItem(itemId, count = 1) {
        const current = this.items.get(itemId) || 0;
        if (current < count) return false;
        const remaining = current - count;
        if (remaining <= 0) {
            this.items.delete(itemId);
        } else {
            this.items.set(itemId, remaining);
        }
        Logger.log(`[QuestItemSystem] 消耗任务物品: ${itemId} x${count}，剩余: ${Math.max(0, remaining)}`);
        if (this.onItemChanged) this.onItemChanged(itemId, Math.max(0, remaining));
        return true;
    }

    /**
     * 检查是否持有指定物品
     * @param {string} itemId - 物品ID
     * @param {number} count - 所需数量，默认1
     * @returns {boolean}
     */
    hasItem(itemId, count = 1) {
        return (this.items.get(itemId) || 0) >= count;
    }

    /**
     * 获取物品数量
     * @param {string} itemId
     * @returns {number}
     */
    getItemCount(itemId) {
        return this.items.get(itemId) || 0;
    }

    /**
     * 获取所有持有物品
     * @returns {Object} {itemId: count, ...}
     */
    getAllItems() {
        const result = {};
        for (const [id, count] of this.items) {
            result[id] = count;
        }
        return result;
    }

    /**
     * 获取持有物品数量
     * @returns {number}
     */
    getItemCountTotal() {
        let total = 0;
        for (const count of this.items.values()) {
            total += count;
        }
        return total;
    }

    /**
     * 序列化（用于存档）
     */
    serialize() {
        return {
            items: Array.from(this.items.entries()),
        };
    }

    /**
     * 反序列化（用于读档）
     * @param {Object} data
     */
    deserialize(data) {
        if (!data) return;
        this.items = new Map(data.items || []);
    }
}

if (typeof window !== 'undefined') window.QuestItemSystem = QuestItemSystem;