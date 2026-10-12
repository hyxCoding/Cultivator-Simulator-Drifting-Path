/**
 * StateMachine.js —— 通用状态机基类（全项目状态收敛的底座）
 *
 * 设计目标（对应「统一状态到状态机」的重构要求）：
 *   1. 全项目所有**布尔型 / 枚举型进度状态**统一登记到这里，不再散落在各模块的实例字段里；
 *   2. 对外只暴露方法：`get / is / set`（读）+ 各子类的语义化方法（写）；
 *   3. 状态更新**严格**：未登记的状态直接拒绝；取值必须在允许集合内；
 *      转移必须满足 `transitions` 规则；`monotonic` 状态一旦为 true 不可回退。
 *   4. 非法更新不会静默 —— 一律 `console.warn` 并通过 `onIllegalTransition` 回调抛出，
 *      便于测试断言与线上排查。
 *
 * 模型：一个状态机 = 一组「具名状态」；每个状态有
 *   - values    允许取值集合（布尔状态为 [false, true]；任务状态为 ['locked','active','completed','failed']）
 *   - initial   初始值（必须属于 values）
 *   - transitions 允许的转移表 { fromValue: [toValue...] }，或函数 (from,to)=>bool；缺省表示不限制
 *   - monotonic 便捷开关：仅对布尔状态有意义，true 之后不可再回 false
 *
 * 注意：`deserialize()` 是**快照恢复**（存档即事实），会绕过转移校验直接写入；
 *       但同样只接受已登记的状态键，未知键一律忽略并告警。
 *
 * 依赖：无（纯逻辑类，可在任意层使用）。子类：ProgressStateMachine / QuestStateMachine / PlayerStateMachine。
 */
class StateMachine {
    /**
     * @param {string} name - 状态机名称（仅用于日志与调试）
     */
    constructor(name = 'StateMachine') {
        this.name = name;

        /** @type {Map<string, Object>} 状态定义：key → { values, initial, transitions, monotonic, describe } */
        this._defs = new Map();
        /** @type {Map<string, *>} 状态当前值：key → value */
        this._values = new Map();

        // ====== 观察者（可选；测试与调试用）======
        /** @type {?Function} (machine, key, from, to, reason) => void —— 非法更新被拒绝时触发 */
        this.onIllegalTransition = null;
        /** @type {?Function} (machine, key, from, to) => void —— 合法更新成功后触发 */
        this.onTransition = null;

        /** 累计被拒绝的非法更新次数（便于测试断言「确实拦住了」） */
        this.illegalCount = 0;
    }

    // ==================== 状态定义 ====================

    /**
     * 登记一个状态（重复登记直接返回已存在的定义，不覆盖）
     * @param {string} key
     * @param {Object} [options]
     * @param {Array} [options.values=[false,true]] - 允许取值集合
     * @param {*} [options.initial] - 初始值（缺省取 values[0]）
     * @param {Object|Function} [options.transitions] - 允许的转移（表或函数）；缺省不限制
     * @param {boolean} [options.monotonic=false] - 布尔状态：true 之后不可回 false
     * @param {string} [options.describe=''] - 说明（调试用）
     * @returns {Object} 状态定义
     */
    define(key, options = {}) {
        if (!key) throw new Error(`[${this.name}] define 需要非空的 key`);
        if (this._defs.has(key)) return this._defs.get(key);

        const values = Array.isArray(options.values) && options.values.length > 0
            ? options.values.slice()
            : [false, true];
        const initial = options.initial !== undefined ? options.initial : values[0];
        if (values.indexOf(initial) === -1) {
            throw new Error(`[${this.name}] define("${key}") 的 initial=${JSON.stringify(initial)} 不在 values 中`);
        }

        const def = {
            values,
            initial,
            transitions: options.transitions || null,
            monotonic: options.monotonic === true,
            describe: options.describe || '',
        };
        this._defs.set(key, def);
        this._values.set(key, initial);
        return def;
    }

    /** 该状态是否已登记 */
    isDefined(key) { return this._defs.has(key); }

    /** 已登记的全部状态键 */
    keys() { return Array.from(this._defs.keys()); }

    // ==================== 读取 ====================

    /**
     * 读取状态值（未登记返回 undefined 并告警）
     * @param {string} key
     */
    get(key) {
        if (!this._defs.has(key)) {
            this._warn(`读取未登记的状态："${key}"（返回 undefined）`);
            return undefined;
        }
        return this._values.get(key);
    }

    /**
     * 判断状态是否等于期望值（默认与 true 比较）
     * @param {string} key
     * @param {*} [expected=true]
     */
    is(key, expected = true) { return this.get(key) === expected; }

    /** 该状态当前是否为真（布尔状态的便捷读取；非 true 一律 false） */
    isTrue(key) { return this.get(key) === true; }

    // ==================== 写入（严格） ====================

    /**
     * 更新状态（严格校验：已登记 + 取值合法 + 转移允许）
     * @param {string} key
     * @param {*} value
     * @returns {boolean} 是否更新成功（幂等写入返回 true；被拒绝返回 false）
     */
    set(key, value) {
        const def = this._defs.get(key);
        if (!def) return this._reject(key, undefined, value, '状态未登记（请先 define）');
        if (def.values.indexOf(value) === -1) {
            return this._reject(key, this._values.get(key), value,
                `取值不在允许集合 ${JSON.stringify(def.values)} 内`);
        }

        const from = this._values.get(key);
        if (from === value) return true;   // 幂等：同值写入视为成功

        if (!this._canTransit(def, from, value)) {
            return this._reject(key, from, value, '该转移不被允许');
        }

        this._values.set(key, value);
        if (this.onTransition) this.onTransition(this, key, from, value);
        return true;
    }

    /**
     * 批量更新（逐个走严格校验）
     * @param {Object} obj
     * @returns {string[]} 被拒绝的状态键列表（空数组表示全部成功）
     */
    setMany(obj) {
        const rejected = [];
        for (const key in obj) {
            if (!this.set(key, obj[key])) rejected.push(key);
        }
        return rejected;
    }

    /**
     * 转移是否被允许（不改变状态）
     * @param {Object} def
     * @param {*} from
     * @param {*} to
     */
    _canTransit(def, from, to) {
        if (def.monotonic && from === true && to === false) return false;
        if (!def.transitions) return true;
        if (typeof def.transitions === 'function') return def.transitions(from, to) === true;
        const allowed = def.transitions[from];
        return Array.isArray(allowed) && allowed.indexOf(to) !== -1;
    }

    /**
     * 拒绝一次非法更新：告警 + 计数 + 回调
     * @returns {boolean} 恒为 false（方便 `return this._reject(...)`）
     */
    _reject(key, from, to, reason) {
        this.illegalCount++;
        const message = `[${this.name}] 非法状态更新被拒绝：${key}  ${String(from)} → ${String(to)}（${reason}）`;
        if (typeof console !== 'undefined' && console.warn) console.warn(message);
        if (this.onIllegalTransition) this.onIllegalTransition(this, key, from, to, reason);
        return false;
    }

    /** 内部告警 */
    _warn(message) {
        if (typeof console !== 'undefined' && console.warn) console.warn(`[${this.name}] ${message}`);
    }

    // ==================== 复位 / 序列化 ====================

    /** 复位到各状态的初始值（清空非法计数） */
    reset() {
        for (const [key, def] of this._defs) this._values.set(key, def.initial);
        this.illegalCount = 0;
    }

    /**
     * 序列化当前状态快照（供存档）
     * @returns {Object} { key: value }
     */
    serialize() {
        const out = {};
        for (const [key, value] of this._values) out[key] = value;
        return out;
    }

    /**
     * 反序列化（快照恢复；绕过转移校验，但只接受已登记的状态键）
     * @param {Object} data
     */
    deserialize(data) {
        if (!data) return;
        for (const key in data) {
            if (!this._defs.has(key)) {
                this._warn(`反序列化遇到未登记的状态："${key}"（已忽略）`);
                continue;
            }
            this._values.set(key, data[key]);
        }
    }

    /** 当前状态快照（调试用，等价于 serialize） */
    snapshot() { return this.serialize(); }

    /** 打印当前状态（调试用） */
    dump() {
        const snap = this.snapshot();
        if (typeof console !== 'undefined' && console.log) {
            Logger.log(`[${this.name}] ${JSON.stringify(snap)}`);
        }
        return snap;
    }
}
