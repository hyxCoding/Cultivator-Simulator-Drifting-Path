/**
 * QuestStateMachine.js —— 任务状态机（任务树）
 *
 * 职责：记录每个任务的**生命周期状态**，是任务完成情况的唯一事实源。
 *
 * 状态与严格转移规则（唯一合法路径）：
 *
 *     locked ──accept──▶ active ──complete──▶ completed（终态）
 *                          │  │
 *                          │  └──fail────▶ failed（终态）
 *                          └──abandon───▶ locked（放弃后回到未接取）
 *
 *   - completed / failed 为终态，不可再转移（严格拒绝）；
 *   - 未登记的任务一律拒绝更新（必须先 register）。
 *
 * 与 QuestSystem 的分工：
 *   QuestSystem 保留「业务逻辑」（前置校验、目标推进、回调），
 *   状态的**存储与合法性**全部交给本状态机 —— 状态只此一份。
 *
 * 对外方法：
 *   register(questId)                       登记任务（初始 locked）
 *   getState(questId)                       读取状态（未登记返回 null）
 *   getEntry(questId)                       读取整条记录（含 objectives / 时间戳）
 *   isLocked/isActive/isCompleted/isFailed
 *   apply(questId, to, patch)               严格转移 + 附带数据补丁
 *   getEntries()                            全部记录（Map 副本）
 *   serialize() / deserialize(data)         存档
 *
 * 依赖：StateMachine（基类）。
 */
class QuestStateMachine extends StateMachine {
    static STATE_LOCKED = 'locked';
    static STATE_ACTIVE = 'active';
    static STATE_COMPLETED = 'completed';
    static STATE_FAILED = 'failed';

    /** 唯一合法转移表 */
    static get TRANSITIONS() {
        return {
            [QuestStateMachine.STATE_LOCKED]: [QuestStateMachine.STATE_ACTIVE],
            [QuestStateMachine.STATE_ACTIVE]: [
                QuestStateMachine.STATE_COMPLETED,
                QuestStateMachine.STATE_FAILED,
                QuestStateMachine.STATE_LOCKED,
            ],
            [QuestStateMachine.STATE_COMPLETED]: [],   // 终态
            [QuestStateMachine.STATE_FAILED]: [],      // 终态
        };
    }

    static get VALUES() {
        return [
            QuestStateMachine.STATE_LOCKED,
            QuestStateMachine.STATE_ACTIVE,
            QuestStateMachine.STATE_COMPLETED,
            QuestStateMachine.STATE_FAILED,
        ];
    }

    constructor() {
        super('QuestStateMachine');
        /** @type {Map<string, Object>} questId → { questId, objectives, acceptedTime, completedTime } */
        this._entries = new Map();
    }

    // ==================== 登记 ====================

    /**
     * 登记一个任务（幂等；已登记直接返回）
     * @param {string} questId
     * @returns {Object} 该任务的记录
     */
    register(questId) {
        if (!questId) throw new Error('[QuestStateMachine] register 需要 questId');
        if (!this.isDefined(questId)) {
            this.define(questId, {
                values: QuestStateMachine.VALUES,
                initial: QuestStateMachine.STATE_LOCKED,
                transitions: QuestStateMachine.TRANSITIONS,
                describe: `任务 ${questId}`,
            });
        }
        if (!this._entries.has(questId)) {
            this._entries.set(questId, {
                questId,
                objectives: null,
                acceptedTime: null,
                completedTime: null,
            });
        }
        return this._entries.get(questId);
    }

    // ==================== 读取 ====================

    /**
     * 任务状态（未登记返回 null）
     * @param {string} questId
     * @returns {string|null}
     */
    getState(questId) {
        return this.isDefined(questId) ? this.get(questId) : null;
    }

    /**
     * 任务整条记录（含目标、时间戳与当前状态；未登记返回 null）
     * 返回的是**合并副本**（等价于旧 `QuestSystem.getQuestState` 的返回结构），改动不会影响内部存储。
     * @param {string} questId
     */
    getEntry(questId) {
        const entry = this._entries.get(questId);
        if (!entry) return null;
        return {
            questId: entry.questId,
            state: this.getState(questId),
            objectives: entry.objectives,
            acceptedTime: entry.acceptedTime,
            completedTime: entry.completedTime,
        };
    }

    isLocked(questId) { return this.getState(questId) === QuestStateMachine.STATE_LOCKED; }
    isActive(questId) { return this.getState(questId) === QuestStateMachine.STATE_ACTIVE; }
    isCompleted(questId) { return this.getState(questId) === QuestStateMachine.STATE_COMPLETED; }
    isFailed(questId) { return this.getState(questId) === QuestStateMachine.STATE_FAILED; }

    /** 全部任务记录（只读副本） */
    getEntries() { return new Map(this._entries); }

    /** 已登记任务数 */
    get size() { return this._entries.size; }

    /**
     * 按状态筛选任务 id
     * @param {string} state
     * @returns {string[]}
     */
    getIdsByState(state) {
        const out = [];
        for (const [id] of this._entries) if (this.getState(id) === state) out.push(id);
        return out;
    }

    // ==================== 写入（严格） ====================

    /**
     * 执行一次状态转移，并附带记录补丁（严格：转移不合法则整体不生效）
     * @param {string} questId
     * @param {string} to - 目标状态
     * @param {Object} [patch] - 同时写入记录的字段（objectives / acceptedTime / completedTime）
     * @returns {boolean} 是否成功
     */
    apply(questId, to, patch) {
        if (!this.isDefined(questId)) {
            return this._reject(questId, undefined, to, '任务未登记（请先 register）');
        }
        const from = this.get(questId);
        if (!this.set(questId, to)) return false;

        if (patch && typeof patch === 'object') {
            const entry = this._entries.get(questId);
            if (entry) Object.assign(entry, patch);
        }
        // 附带转移记录便于排查（from → to）
        if (typeof console !== 'undefined' && console.log) {
            Logger.log(`[QuestStateMachine] ${questId}: ${from} → ${to}`);
        }
        return true;
    }

    /** 设置任务的目标列表（仅记录数据，不改状态） */
    setObjectives(questId, objectives) {
        const entry = this._entries.get(questId);
        if (!entry) return false;
        entry.objectives = objectives || null;
        return true;
    }

    // ==================== 序列化 ====================

    /**
     * 序列化：与旧存档字段 `quests` 完全兼容
     * @returns {Array} [[questId, { questId, state, objectives, acceptedTime, completedTime }], ...]
     */
    serialize() {
        return Array.from(this._entries.entries()).map(([id, entry]) => [
            id,
            {
                questId: entry.questId,
                state: this.getState(id),
                objectives: entry.objectives ? entry.objectives.map(o => ({ ...o })) : null,
                acceptedTime: entry.acceptedTime,
                completedTime: entry.completedTime,
            },
        ]);
    }

    /**
     * 反序列化（快照恢复，绕过转移校验）
     * @param {Array} data - serialize() 的输出
     */
    deserialize(data) {
        if (!Array.isArray(data)) return;
        for (const pair of data) {
            if (!Array.isArray(pair) || pair.length < 2) continue;
            const [id, entryData] = pair;
            this.register(id);
            // 快照恢复：直接写值（存档即事实）
            this._values.set(id, entryData.state);
            const entry = this._entries.get(id);
            entry.objectives = entryData.objectives || null;
            entry.acceptedTime = entryData.acceptedTime || null;
            entry.completedTime = entryData.completedTime || null;
        }
    }

    /** 复位：清空全部任务记录（保留登记表，状态回 locked） */
    reset() {
        super.reset();
        for (const [id, entry] of this._entries) {
            entry.objectives = null;
            entry.acceptedTime = null;
            entry.completedTime = null;
        }
    }
}
