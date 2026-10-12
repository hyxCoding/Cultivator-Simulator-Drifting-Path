/**
 * 任务系统类
 *
 * 任务生命周期：LOCKED → ACTIVE → COMPLETED（另有 ACTIVE → FAILED / LOCKED 分支）
 * - LOCKED:    已注册但未解锁，不显示在任务列表中
 * - ACTIVE:    玩家已接取，正在推进中
 * - COMPLETED: 所有目标已完成，永远不再显示或触发（终态）
 * - FAILED:    任务失败（终态，预留）
 *
 * 关键规则：
 * 1. 已完成的任务绝不出现在任务清单中
 * 2. 已完成的任务相关的任何回调/逻辑绝不执行
 * 3. 日志记录所有编号任务的完成情况
 *
 * ★ 重构（状态收敛）：本类不再自己持有状态。
 *   - 任务状态（locked/active/completed/failed）→ QuestStateMachine（唯一事实源，含严格转移校验）
 *   - 剧情进度标记（storyFlags）→ ProgressStateMachine（唯一事实源，单调不可逆）
 *   本类只保留「业务逻辑」（前置校验、目标推进、回调），状态一律经状态机读写。
 */
class QuestSystem {
    static STATE_LOCKED = 'locked';
    static STATE_ACTIVE = 'active';
    static STATE_COMPLETED = 'completed';
    static STATE_FAILED = 'failed';

    constructor() {
        // ====== 状态唯一事实源 ======
        /** @type {QuestStateMachine} 任务树状态机 */
        this.questState = new QuestStateMachine();
        /** @type {ProgressStateMachine} 剧情进度状态机 */
        this.progressState = new ProgressStateMachine();

        // ====== 回调 ======
        this.onQuestProgress = null;   // (questId, questState) => void
        this.onQuestComplete = null;   // (questId, rewards) => void
        this.onQuestFail = null;       // (questId) => void
        this.onQuestAccept = null;     // (questId) => void  ← 新任务解锁时触发（NPC搬迁等）
    }

    // ==================== 兼容访问器 ====================

    /** 任务记录表（只读副本；等价于旧的 this.quests） */
    get quests() { return this.questState.getEntries(); }

    /** 剧情标记表（只读副本；等价于旧的 this.storyFlags） */
    get storyFlags() { return this.progressState.getAll(); }

    // ==================== 剧情标记（委托 ProgressStateMachine） ====================

    /**
     * 设置剧情标记（单调：只置真、不可逆）
     * @param {string} flag - 标记名
     * @param {boolean} [value=true] - 标记值
     */
    setStoryFlag(flag, value = true) {
        if (!flag) return false;
        const ok = this.progressState.mark(flag, value === true);
        if (ok) Logger.log(`[QuestSystem] 剧情标记: ${flag} = ${value}`);
        return ok;
    }

    /**
     * 是否已设置该剧情标记
     * @param {string} flag
     * @returns {boolean}
     */
    hasStoryFlag(flag) { return this.progressState.has(flag); }

    /**
     * 读取剧情标记值
     * @param {string} flag
     * @returns {*}
     */
    getStoryFlag(flag) { return this.progressState.getFlag(flag); }

    /**
     * 更新任务系统
     *
     * ⚠ 预留扩展点（有意为之的空实现）：当前所有任务都是「完成即结束」，没有限时 / 超时逻辑，
     *   因此本方法暂时什么都不做。将来实现「限时任务倒计时」时在此补充即可。
     *   —— 不是漏写，也不是可以删掉的死代码：`Player.update` 每帧都会调用它。
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
                    this.questState.register(questConfig.id);
                }
            }
        }
        Logger.log(`[QuestSystem] 已注册 ${this.questState.size} 个任务`);
    }

    // ==================== 状态查询 ====================

    /**
     * 获取任务状态记录（含 state / objectives / 时间戳）
     * @param {string} questId
     * @returns {Object|null}
     */
    getQuestState(questId) {
        return this.questState.getEntry(questId);
    }

    /**
     * 检查任务是否激活中
     * @param {string} questId
     * @returns {boolean}
     */
    isQuestActive(questId) { return this.questState.isActive(questId); }

    /**
     * 检查任务是否已完成
     * @param {string} questId
     * @returns {boolean}
     */
    isQuestCompleted(questId) { return this.questState.isCompleted(questId); }

    /**
     * 获取所有进行中的任务
     * @returns {Map<string, Object>}
     */
    getActiveQuests() { return this._collectByState(QuestSystem.STATE_ACTIVE); }

    /**
     * 获取所有已完成的任务
     * @returns {Map<string, Object>}
     */
    getCompletedQuests() { return this._collectByState(QuestSystem.STATE_COMPLETED); }

    /**
     * 按状态收集任务记录
     * @param {string} state
     * @returns {Map<string, Object>}
     * @private
     */
    _collectByState(state) {
        const result = new Map();
        for (const id of this.questState.getIdsByState(state)) {
            result.set(id, this.questState.getEntry(id));
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
        const entry = this.questState.getEntry(questId);
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

    /**
     * 获取任务的“当前待完成目标”（第一个未完成的目标）
     * 与 updateQuestProgress 的推进规则保持一致（只推进第一个未完成目标）
     * @param {string} questId
     * @returns {Object|null} 目标对象或 null（任务未接取 / 已无未完成目标）
     */
    getCurrentObjective(questId) {
        const entry = this.questState.getEntry(questId);
        if (!entry || entry.state !== QuestSystem.STATE_ACTIVE || !entry.objectives) return null;
        return entry.objectives.find(obj => !obj.completed) || null;
    }

    /**
     * 判断某个目标是否正好是任务的“当前待完成目标”
     * 用于镇风桩等“只能按顺序推进”的调查点门控
     * @param {string} questId
     * @param {string} objectiveType
     * @param {string} target
     * @returns {boolean}
     */
    isObjectiveCurrent(questId, objectiveType, target) {
        const current = this.getCurrentObjective(questId);
        if (!current) return false;
        return current.type === objectiveType &&
            (current.target === target || current.target === null);
    }

    // ==================== 状态转换（经 QuestStateMachine 严格校验） ====================

    /**
     * 接受/解锁任务（LOCKED → ACTIVE）
     * 自动检查前置任务是否完成
     * @param {string} questId
     * @returns {boolean}
     */
    acceptQuest(questId) {
        if (!this.questState.isDefined(questId)) {
            console.warn(`[QuestSystem] 任务未注册: ${questId}`);
            return false;
        }
        if (!this.questState.isLocked(questId)) {
            console.warn(`[QuestSystem] 任务 ${questId} 不能从 ${this.questState.getState(questId)} 状态接受`);
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
                if (!this.questState.isCompleted(prereqId)) {
                    console.warn(`[QuestSystem] 任务 ${questId} 的前置 ${prereqId} 未完成`);
                    return false;
                }
            }
        }

        const objectives = questConfig.objectives.map(obj => ({
            ...obj,
            progress: 0,
            completed: false,
        }));
        // 状态转移 + 附带数据一次写入（状态机内部做合法性校验）
        const ok = this.questState.apply(questId, QuestSystem.STATE_ACTIVE, {
            objectives,
            acceptedTime: Date.now(),
            completedTime: null,
        });
        if (!ok) return false;

        Logger.log(`[QuestSystem] 接受任务: ${questId}（${questConfig.title || ''}）`);

        if (this.onQuestAccept) {
            this.onQuestAccept(questId);
        }
        return true;
    }

    /**
     * 查询任务当前能否被接取（只读，不改变任何状态）
     *
     * 与 acceptQuest 的前置校验保持同一套规则，但把“为什么不能接”翻译成玩家可读的原因：
     * acceptQuest 只返回布尔值 + console 警告，玩家看到的是“对话里点了接取，
     * 任务面板里却什么都没有”。Main.tryAcceptQuest 用本方法给出提示。
     *
     * @param {string} questId
     * @returns {{ ok: boolean, reason: string|null, missingPrerequisites: string[] }}
     *          ok=true 时可接取；ok=false 时 reason 为玩家可读原因
     */
    getAcceptStatus(questId) {
        const deny = (reason, missingPrerequisites = []) => ({ ok: false, reason, missingPrerequisites });

        if (!this.questState.isDefined(questId)) return deny(`任务 ${questId} 未注册`);

        const gameConfig = GameConfig.getInstance();
        const questConfig = gameConfig.getQuest(questId);
        if (!questConfig) return deny(`任务 ${questId} 配置不存在`);

        const title = questConfig.title || questId;
        const state = this.questState.getState(questId);
        if (state === QuestSystem.STATE_ACTIVE) return deny(`《${title}》已在进行中`);
        if (state === QuestSystem.STATE_COMPLETED) return deny(`《${title}》已完成`);
        if (state === QuestSystem.STATE_FAILED) return deny(`《${title}》已失败`);

        const missing = [];
        for (const prereqId of (questConfig.prerequisites || [])) {
            if (!this.questState.isCompleted(prereqId)) {
                const prereqConfig = gameConfig.getQuest(prereqId);
                missing.push(prereqConfig ? (prereqConfig.title || prereqId) : prereqId);
            }
        }
        if (missing.length > 0) {
            return deny(`需先完成《${missing.join('》《')}》`, missing);
        }

        return { ok: true, reason: null, missingPrerequisites: [] };
    }

    /**
     * 更新任务进度（仅 ACTIVE 状态的任务可更新）
     * @param {string} questId
     * @param {string} objectiveType
     * @param {string} target
     * @param {number} count - 进度增量，默认1
     */
    updateQuestProgress(questId, objectiveType, target, count = 1) {
        const entry = this.questState.getEntry(questId);

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
            this.onQuestProgress(questId, this.questState.getEntry(questId));
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
        if (!this.questState.isActive(questId)) {
            console.warn(`[QuestSystem] 任务 ${questId} 无法完成：状态为 ${this.questState.getState(questId) || '不存在'}`);
            return;
        }

        const gameConfig = GameConfig.getInstance();
        const questConfig = gameConfig.getQuest(questId);
        if (!questConfig) {
            console.warn(`[QuestSystem] 任务 ${questId} 配置不存在，无法完成`);
            return;
        }

        if (!this.questState.apply(questId, QuestSystem.STATE_COMPLETED, { completedTime: Date.now() })) return;

        Logger.log(`[QuestSystem] 完成任务: ${questId}（${questConfig.title || ''}）`);

        if (this.onQuestComplete) {
            this.onQuestComplete(questId, questConfig.rewards || {});
        }

        // ====== 不再自动接取下一任务 → 改为由对话 action / on_complete 驱动 ======
    }

    /**
     * 放弃任务（ACTIVE → LOCKED）
     * @param {string} questId
     */
    abandonQuest(questId) {
        if (!this.questState.isActive(questId)) return;
        this.questState.apply(questId, QuestSystem.STATE_LOCKED, { objectives: null, acceptedTime: null });
    }

    /**
     * 任务失败（ACTIVE → FAILED）
     *
     * ⚠ 预留扩展点：当前主线没有「可失败任务」（任务都是完成即结束），所以本方法暂无调用者；
     *   但它是 `QuestStateMachine` 里 `failed` 终态**唯一**的公开入口，属于已文档化的 API
     *   （见 docs/QuestSystem.md），因此保留 —— 不是死代码，将来加「限时 / 护送失败」时直接用。
     * @param {string} questId
     */
    failQuest(questId) {
        if (!this.questState.isActive(questId)) return;
        if (!this.questState.apply(questId, QuestSystem.STATE_FAILED)) return;
        Logger.log(`[QuestSystem] 任务失败: ${questId}`);
        if (this.onQuestFail) this.onQuestFail(questId);
    }

    // ==================== 序列化 ====================

    /**
     * 序列化（用于存档）；字段形状与旧版完全一致，旧存档可直接读
     */
    serialize() {
        return {
            quests: this.questState.serialize(),
            storyFlags: this.progressState.getAll(),
        };
    }

    /**
     * 反序列化（用于读档）
     * @param {Object} data
     */
    deserialize(data) {
        if (!data) return;
        // 剧情进度（旧存档无此字段 → 空）
        this.progressState.deserialize(data.storyFlags || {});

        if (data.quests) {
            this.questState.deserialize(data.quests);
        } else {
            // 兼容更旧的存档格式（activeQuests / completedQuests 两张表）
            const legacy = [];
            if (data.activeQuests) {
                for (const [id, state] of data.activeQuests) {
                    legacy.push([id, {
                        questId: id, state: QuestSystem.STATE_ACTIVE,
                        objectives: state.objectives || null,
                        acceptedTime: state.acceptedTime || null, completedTime: null,
                    }]);
                }
            }
            if (data.completedQuests) {
                for (const [id, state] of data.completedQuests) {
                    legacy.push([id, {
                        questId: id, state: QuestSystem.STATE_COMPLETED,
                        objectives: state.objectives || null,
                        acceptedTime: state.acceptedTime || null,
                        completedTime: state.completedTime || Date.now(),
                    }]);
                }
            }
            this.questState.deserialize(legacy);
        }
        Logger.log(`[QuestSystem] 反序列化完成，共 ${this.questState.size} 个任务记录`);
    }
}
