/**
 * 任务系统类 —— 状态机版本
 * 
 * 任务生命周期：LOCKED → ACTIVE → COMPLETED
 * - LOCKED:    已注册但未解锁，不显示在任务列表中
 * - ACTIVE:    玩家已接取，正在推进中
 * - COMPLETED: 所有目标已完成，永远不再显示或触发
 * - FAILED:    任务失败（预留）
 * 
 * 关键规则：
 * 1. 已完成的任务绝不出现在任务清单中
 * 2. 已完成的任务相关的任何回调/逻辑绝不执行
 * 3. 每日志记录所有编号任务的完成情况
 */
class QuestSystem {
    static STATE_LOCKED = 'locked';
    static STATE_ACTIVE = 'active';
    static STATE_COMPLETED = 'completed';
    static STATE_FAILED = 'failed';

    constructor() {
        /** @type {Map<string, Object>} questId → { questId, state, objectives, acceptedTime, completedTime } */
        this.quests = new Map();

        // ====== 回调 ======
        this.onQuestProgress = null;   // (questId, questState) => void
        this.onQuestComplete = null;   // (questId, rewards) => void
        this.onQuestFail = null;       // (questId) => void
        this.onQuestAccept = null;     // (questId) => void  ← 新任务解锁时触发（NPC搬迁等）
    }

 /**
     * 更新任务系统
     * 检查任务超时、过期等（当前版本暂无可更新内容，预留接口）
     * @param {number} deltaTime - 时间增量（秒）
     */
    update(deltaTime) {
        // 预留：限时任务倒计时等
    }

    // ==================== 任务注册（初始化时调用） ====================

    /**
     * 注册所有任务配置到状态机中（初始为 LOCKED 状态）
     * 建议在章节加载完成后调用
     */
    registerAllQuests() {
        const gameConfig = GameConfig.getInstance();
        for (const chapterId in gameConfig.registeredQuests) {
            const chapterQuests = gameConfig.registeredQuests[chapterId];
            for (const questKey in chapterQuests) {
                const questConfig = chapterQuests[questKey];
                if (questConfig && questConfig.id) {
                    this._registerQuest(questConfig.id);
                }
            }
        }
        console.log(`[QuestSystem] 已注册 ${this.quests.size} 个任务`);
    }

    /**
     * 注册单个任务（内部使用）
     * @param {string} questId
     * @private
     */
    _registerQuest(questId) {
        if (this.quests.has(questId)) return;
        this.quests.set(questId, {
            questId: questId,
            state: QuestSystem.STATE_LOCKED,
            objectives: null,
            acceptedTime: null,
            completedTime: null,
        });
    }

    // ==================== 状态查询 ====================

    /**
     * 获取任务状态
     * @param {string} questId
     * @returns {Object|null}
     */
    getQuestState(questId) {
        return this.quests.get(questId) || null;
    }

    /**
     * 检查任务是否激活中
     * @param {string} questId
     * @returns {boolean}
     */
    isQuestActive(questId) {
        const entry = this.quests.get(questId);
        return entry && entry.state === QuestSystem.STATE_ACTIVE;
    }

    /**
     * 检查任务是否已完成
     * @param {string} questId
     * @returns {boolean}
     */
    isQuestCompleted(questId) {
        const entry = this.quests.get(questId);
        return entry && entry.state === QuestSystem.STATE_COMPLETED;
    }

    /**
     * 获取所有进行中的任务
     * @returns {Map<string, Object>}
     */
    getActiveQuests() {
        const result = new Map();
        for (const [id, entry] of this.quests) {
            if (entry.state === QuestSystem.STATE_ACTIVE) {
                result.set(id, entry);
            }
        }
        return result;
    }

    /**
     * 获取所有已完成的任务
     * @returns {Map<string, Object>}
     */
    getCompletedQuests() {
        const result = new Map();
        for (const [id, entry] of this.quests) {
            if (entry.state === QuestSystem.STATE_COMPLETED) {
                result.set(id, entry);
            }
        }
        return result;
    }

    /**
     * 检查某个目标是否已完成
     * @param {string} questId
     * @param {string} objectiveType
     * @param {string} target
     * @returns {boolean}
     */
    isObjectiveCompleted(questId, objectiveType, target) {
        const entry = this.quests.get(questId);
        if (!entry) return false;
        if (entry.state === QuestSystem.STATE_COMPLETED) return true;
        if (entry.state === QuestSystem.STATE_ACTIVE && entry.objectives) {
            for (const obj of entry.objectives) {
                if (obj.type === objectiveType && obj.target === target) {
                    return obj.completed;
                }
            }
        }
        return false;
    }

    // ==================== 状态转换 ====================

    /**
     * 接受/解锁任务（LOCKED → ACTIVE）
     * 自动检查前置任务是否完成
     * @param {string} questId
     * @returns {boolean}
     */
    acceptQuest(questId) {
        const entry = this.quests.get(questId);
        if (!entry) {
            console.warn(`[QuestSystem] 任务未注册: ${questId}`);
            return false;
        }
        if (entry.state !== QuestSystem.STATE_LOCKED) {
            console.warn(`[QuestSystem] 任务 ${questId} 不能从 ${entry.state} 状态接受`);
            return false;
        }

        const gameConfig = GameConfig.getInstance();
        const questConfig = gameConfig.getQuest(questId);
        if (!questConfig) {
            console.warn(`[QuestSystem] 任务配置不存在: ${questId}`);
            return false;
        }

        // 检查前置任务
        if (questConfig.prerequisites && questConfig.prerequisites.length > 0) {
            for (const prereqId of questConfig.prerequisites) {
                const prereq = this.quests.get(prereqId);
                if (!prereq || prereq.state !== QuestSystem.STATE_COMPLETED) {
                    console.warn(`[QuestSystem] 任务 ${questId} 的前置 ${prereqId} 未完成`);
                    return false;
                }
            }
        }

        entry.state = QuestSystem.STATE_ACTIVE;
        entry.objectives = questConfig.objectives.map(obj => ({
            ...obj,
            progress: 0,
            completed: false,
        }));
        entry.acceptedTime = Date.now();
        entry.completedTime = null;

        console.log(`[QuestSystem] 接受任务: ${questId}（${questConfig.title || ''}）`);

        if (this.onQuestAccept) {
            this.onQuestAccept(questId);
        }
        return true;
    }

    /**
     * 更新任务进度（仅 ACTIVE 状态的任务可更新）
     * @param {string} questId
     * @param {string} objectiveType
     * @param {string} target
     * @param {number} count - 进度增量，默认1
     */
    updateQuestProgress(questId, objectiveType, target, count = 1) {
        const entry = this.quests.get(questId);
        
        // 已完成的任务不执行任何进度更新
        if (!entry || entry.state !== QuestSystem.STATE_ACTIVE) {
            return;
        }

        const objectives = entry.objectives;
        if (!objectives) return;

        // 仅允许推进第一个未完成的目标
        const firstUncompleted = objectives.find(obj => !obj.completed);
        if (!firstUncompleted) {
            this.completeQuest(questId);
            return;
        }

        if (firstUncompleted.type === objectiveType && 
            (firstUncompleted.target === target || firstUncompleted.target === null)) {
            firstUncompleted.progress += count;
            
            if (firstUncompleted.progress >= firstUncompleted.count) {
                firstUncompleted.progress = firstUncompleted.count;
                firstUncompleted.completed = true;
            }
        } else {
            return;
        }

        if (this.onQuestProgress) {
            this.onQuestProgress(questId, entry);
        }

        const allCompleted = objectives.every(obj => obj.completed);
        if (allCompleted) {
            this.completeQuest(questId);
        }
    }

    /**
     * 完成任务（ACTIVE → COMPLETED）
     * @param {string} questId
     */
    completeQuest(questId) {
        const entry = this.quests.get(questId);
        if (!entry || entry.state !== QuestSystem.STATE_ACTIVE) {
            console.warn(`[QuestSystem] 任务 ${questId} 无法完成：状态为 ${entry ? entry.state : '不存在'}`);
            return;
        }

        const gameConfig = GameConfig.getInstance();
        const questConfig = gameConfig.getQuest(questId);
        if (!questConfig) {
            console.warn(`[QuestSystem] 任务 ${questId} 配置不存在，无法完成`);
            return;
        }

        entry.state = QuestSystem.STATE_COMPLETED;
        entry.completedTime = Date.now();

        console.log(`[QuestSystem] 完成任务: ${questId}（${questConfig.title || ''}）`);

        if (this.onQuestComplete) {
            this.onQuestComplete(questId, questConfig.rewards || {});
        }

        // ====== 不再自动接取下一任务 → 改为由对话 action / on_complete 驱动 ======
        // if (questConfig.nextQuest) {
        //     console.log(`[QuestSystem] 自动接取下一任务: ${questConfig.nextQuest}`);
        //     this.acceptQuest(questConfig.nextQuest);
        // }
    }

    /**
     * 放弃任务（ACTIVE → LOCKED）
     * @param {string} questId
     */
    abandonQuest(questId) {
        const entry = this.quests.get(questId);
        if (!entry || entry.state !== QuestSystem.STATE_ACTIVE) return;
        entry.state = QuestSystem.STATE_LOCKED;
        entry.objectives = null;
        entry.acceptedTime = null;
    }

    /**
     * 任务失败（ACTIVE → FAILED）
     * @param {string} questId
     */
    failQuest(questId) {
        const entry = this.quests.get(questId);
        if (!entry || entry.state !== QuestSystem.STATE_ACTIVE) return;
        entry.state = QuestSystem.STATE_FAILED;
        console.log(`[QuestSystem] 任务失败: ${questId}`);
        if (this.onQuestFail) this.onQuestFail(questId);
    }

    // ==================== 序列化 ====================

    /**
     * 序列化（用于存档）
     */
    serialize() {
        return {
            quests: Array.from(this.quests.entries()).map(([id, entry]) => [
                id,
                {
                    questId: entry.questId,
                    state: entry.state,
                    objectives: entry.objectives ? entry.objectives.map(o => ({ ...o })) : null,
                    acceptedTime: entry.acceptedTime,
                    completedTime: entry.completedTime,
                },
            ]),
        };
    }

    /**
     * 反序列化（用于读档）
     * @param {Object} data
     */
    deserialize(data) {
        if (!data) return;
        if (data.quests) {
            this.quests = new Map(data.quests.map(([id, entryData]) => [
                id,
                {
                    questId: entryData.questId,
                    state: entryData.state,
                    objectives: entryData.objectives || null,
                    acceptedTime: entryData.acceptedTime || null,
                    completedTime: entryData.completedTime || null,
                },
            ]));
        } else {
            // 兼容旧存档格式
            this.quests = new Map();
            if (data.activeQuests) {
                for (const [id, state] of data.activeQuests) {
                    this.quests.set(id, {
                        questId: id,
                        state: QuestSystem.STATE_ACTIVE,
                        objectives: state.objectives || null,
                        acceptedTime: state.acceptedTime || null,
                        completedTime: null,
                    });
                }
            }
            if (data.completedQuests) {
                for (const [id, state] of data.completedQuests) {
                    this.quests.set(id, {
                        questId: id,
                        state: QuestSystem.STATE_COMPLETED,
                        objectives: state.objectives || null,
                        acceptedTime: state.acceptedTime || null,
                        completedTime: state.completedTime || Date.now(),
                    });
                }
            }
        }
        console.log(`[QuestSystem] 反序列化完成，共 ${this.quests.size} 个任务记录`);
    }
}