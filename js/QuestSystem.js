/**
 * 任务系统类
 * 管理玩家当前任务和历史完成任务
 */
class QuestSystem {
    constructor() {
        this.activeQuests = new Map();    // 当前进行中的任务 {questId: questState}
        this.completedQuests = new Map(); // 已完成的任务 {questId: completeTime}
        this.failedQuests = new Map();    // 失败的任务 {questId: failTime}
        
        // 任务进度更新回调
        this.onQuestProgress = null;
        this.onQuestComplete = null;
        this.onQuestFail = null;
    }

 /**
     * 更新任务系统
     * 检查任务超时、过期等（当前版本暂无可更新内容，预留接口）
     * @param {number} deltaTime - 时间增量（秒）
     */
    update(deltaTime) {
        // 当前版本暂无每帧更新逻辑
        // 预留用于：
        // - 限时任务倒计时
        // - 任务目标自动追踪
        // - 任务提示更新
    }

    /**
     * 接受任务
     * @param {string} questId - 任务ID
     * @returns {boolean} 是否接受成功
     */
    acceptQuest(questId) {
        const gameConfig = GameConfig.getInstance();
        const questConfig = gameConfig.getQuest(questId);
        
        if (!questConfig) {
            console.warn(`任务不存在: ${questId}`);
            return false;
        }
        
        // 检查是否已接受
        if (this.activeQuests.has(questId)) {
            return false;
        }
        
        // 创建任务状态
        const questState = {
            questId: questId,
            objectives: questConfig.objectives.map(obj => ({
                ...obj,
                progress: 0,
                completed: false,
            })),
            acceptedTime: Date.now(),
            completedTime: null,
        };
        
        this.activeQuests.set(questId, questState);
        
        return true;
    }

    /**
     * 更新任务进度
     * @param {string} questId - 任务ID
     * @param {string} objectiveType - 目标类型
     * @param {string} target - 目标对象
     * @param {number} count - 进度增量
     */
    updateQuestProgress(questId, objectiveType, target, count = 1) {
        if (!this.activeQuests.has(questId)) {
            return;
        }
        
        const questState = this.activeQuests.get(questId);
        let allCompleted = true;
        
        questState.objectives.forEach(objective => {
            if (objective.completed) return;
            
            if (objective.type === objectiveType && 
                (objective.target === target || objective.target === null)) {
                objective.progress += count;
                
                if (objective.progress >= objective.count) {
                    objective.progress = objective.count;
                    objective.completed = true;
                }
            }
            
            if (!objective.completed) {
                allCompleted = false;
            }
        });
        
        // 触发进度更新回调
        if (this.onQuestProgress) {
            this.onQuestProgress(questId, questState);
        }
        
        // 检查任务是否完成
        if (allCompleted) {
            this.completeQuest(questId);
        }
    }

    /**
     * 完成任务
     * @param {string} questId - 任务ID
     */
    completeQuest(questId) {
        if (!this.activeQuests.has(questId)) {
            return;
        }
        
        const questState = this.activeQuests.get(questId);
        questState.completedTime = Date.now();
        
        // 移动到已完成列表
        this.completedQuests.set(questId, questState);
        this.activeQuests.delete(questId);
        
        // 获取任务奖励
        const gameConfig = GameConfig.getInstance();
        const questConfig = gameConfig.getQuest(questId);
        
        if (questConfig && this.onQuestComplete) {
            this.onQuestComplete(questId, questConfig.rewards);
        }
    }

    /**
     * 放弃任务
     * @param {string} questId - 任务ID
     */
    abandonQuest(questId) {
        if (!this.activeQuests.has(questId)) {
            return;
        }
        
        this.activeQuests.delete(questId);
    }

    /**
     * 获取任务状态
     * @param {string} questId - 任务ID
     * @returns {Object|null} 任务状态
     */
    getQuestState(questId) {
        return this.activeQuests.get(questId) || 
               this.completedQuests.get(questId) || 
               null;
    }

    /**
     * 获取所有进行中的任务
     */
    getActiveQuests() {
        return this.activeQuests;
    }

    /**
     * 获取所有已完成的任务
     */
    getCompletedQuests() {
        return this.completedQuests;
    }

    /**
     * 序列化任务系统（用于存档）
     * @returns {Object} 序列化数据
     */
    serialize() {
        return {
            activeQuests: Array.from(this.activeQuests.entries()),
            completedQuests: Array.from(this.completedQuests.entries()),
            failedQuests: Array.from(this.failedQuests.entries()),
        };
    }

    /**
     * 反序列化任务系统（用于读档）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        this.activeQuests = new Map(data.activeQuests || []);
        this.completedQuests = new Map(data.completedQuests || []);
        this.failedQuests = new Map(data.failedQuests || []);
    }
}