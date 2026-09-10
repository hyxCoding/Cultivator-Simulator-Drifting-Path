/**
 * 背包系统类
 * 管理玩家的物品存储
 */
class Inventory {
    /**
     * @param {Object} config - 初始配置
     * @param {number} config.maxSlots - 最大格子数，默认50
     */
    constructor(config = {}) {
        this.maxSlots = config.maxSlots || 50;
        this.items = new Map(); // 物品列表 {itemId: {itemId, count}}
    }

    /**
     * 添加物品
     * @param {string} itemId - 物品ID
     * @param {number} count - 数量
     * @returns {boolean} 是否添加成功
     */
    addItem(itemId, count = 1) {
        const gameConfig = GameConfig.getInstance();
        const itemConfig = gameConfig.getItem(itemId);
        
        if (!itemConfig) {
            console.warn(`物品不存在: ${itemId}`);
            return false;
        }
        
        // 检查背包是否已满
        if (this.items.size >= this.maxSlots && !this.items.has(itemId)) {
            console.warn('背包已满');
            return false;
        }
        
        // 如果已有该物品
        if (this.items.has(itemId)) {
            const existingItem = this.items.get(itemId);
            
            // 检查是否可堆叠
            if (itemConfig.stackable) {
                const newCount = existingItem.count + count;
                
                // 检查堆叠上限
                if (newCount <= itemConfig.maxStack) {
                    existingItem.count = newCount;
                } else {
                    // 堆叠溢出，创建新堆叠（如果还有空间）
                    const remaining = newCount - itemConfig.maxStack;
                    existingItem.count = itemConfig.maxStack;
                    
                    if (remaining > 0 && this.items.size < this.maxSlots) {
                        this.items.set(`${itemId}_${Date.now()}`, {
                            itemId: itemId,
                            count: remaining,
                        });
                    }
                }
            } else {
                // 不可堆叠，创建新条目
                if (this.items.size < this.maxSlots) {
                    this.items.set(`${itemId}_${Date.now()}`, {
                        itemId: itemId,
                        count: 1,
                    });
                } else {
                    return false;
                }
            }
        } else {
            // 新物品
            this.items.set(itemId, {
                itemId: itemId,
                count: count,
            });
        }
        
        // 触发物品添加回调
        if (this.onItemAdded) {
            this.onItemAdded(itemId, count);
        }
        
        return true;
    }

    /**
     * 移除物品
     * @param {string} itemId - 物品ID
     * @param {number} count - 数量
     * @returns {boolean} 是否移除成功
     */
    removeItem(itemId, count = 1) {
        if (!this.items.has(itemId)) {
            return false;
        }
        
        const item = this.items.get(itemId);
        
        if (item.count < count) {
            return false;
        }
        
        item.count -= count;
        
        if (item.count <= 0) {
            this.items.delete(itemId);
        }
        
        // 触发物品移除回调
        if (this.onItemRemoved) {
            this.onItemRemoved(itemId, count);
        }
        
        return true;
    }

    /**
     * 检查是否有指定物品
     * @param {string} itemId - 物品ID
     * @param {number} count - 数量（可选）
     * @returns {boolean} 是否有该物品
     */
    hasItem(itemId, count = 1) {
        if (!this.items.has(itemId)) {
            return false;
        }
        
        const item = this.items.get(itemId);
        return item.count >= count;
    }

    /**
     * 获取物品数量
     * @param {string} itemId - 物品ID
     * @returns {number} 物品数量
     */
    getItemCount(itemId) {
        if (!this.items.has(itemId)) {
            return 0;
        }
        
        return this.items.get(itemId).count;
    }

    /**
     * 获取所有物品
     * @returns {Map} 物品列表
     */
    getAllItems() {
        return this.items;
    }

    /**
     * 获取物品列表（数组形式）
     * @returns {Array} 物品数组
     */
    getItemList() {
        return Array.from(this.items.values());
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

    /**
     * 序列化背包数据（用于存档）
     * @returns {Object} 序列化数据
     */
    serialize() {
        return {
            maxSlots: this.maxSlots,
            items: Array.from(this.items.entries()).map(([key, item]) => ({
                key: key,
                itemId: item.itemId,
                count: item.count,
            })),
        };
    }

    /**
     * 反序列化背包数据（用于读档）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        this.maxSlots = data.maxSlots || this.maxSlots;
        this.items.clear();
        
        if (data.items) {
            data.items.forEach(itemData => {
                this.items.set(itemData.key, {
                    itemId: itemData.itemId,
                    count: itemData.count,
                });
            });
        }
    }
}