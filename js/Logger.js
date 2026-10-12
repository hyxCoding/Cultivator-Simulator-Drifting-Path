/**
 * 统一日志开关（第十四次改动新增）
 *
 * 背景：全项目原有 127 处 `console.log`，生产环境会持续刷屏（Main.js 独占 70 处），
 *       既干扰排查真实问题，也带来无谓的字符串拼接开销。
 *
 * 规则：
 *   · `Logger.log(...)`   —— 调试日志，**默认静默**；需要时打开开关才输出；
 *   · `Logger.warn(...)`  —— 告警，始终输出（保留 console.warn 语义）；
 *   · `Logger.error(...)` —— 错误，始终输出。
 *
 * 打开调试日志的两种方式：
 *   1) 页面地址加参数：`game.html?debug=1`；
 *   2) 浏览器控制台执行：`Logger.enable()`。
 */
class Logger {
    /**
     * 调试日志是否开启。
     * 默认值：地址栏带 `?debug=1`（或 `&debug=1`）时为 true。
     * 用 try 包住 `location` 访问，兼容无 DOM 的测试环境（Node / vm 冒烟测试）。
     */
    static _debugEnabled = Logger._detectDebugFromUrl();

    /** 从 URL 推断是否开启调试日志 */
    static _detectDebugFromUrl() {
        try {
            if (typeof location === 'undefined' || !location || typeof location.search !== 'string') {
                return false;
            }
            return /[?&]debug=1\b/.test(location.search);
        } catch (e) {
            return false;
        }
    }

    /** 当前是否开启调试日志 */
    static get enabled() { return Logger._debugEnabled === true; }

    /** 打开调试日志 */
    static enable() { Logger._debugEnabled = true; return true; }

    /** 关闭调试日志 */
    static disable() { Logger._debugEnabled = false; return false; }

    /**
     * 调试日志（默认静默）
     * @param {...*} args
     */
    static log(...args) {
        if (Logger._debugEnabled) console.log(...args);
    }

    /**
     * 告警（始终输出）
     * @param {...*} args
     */
    static warn(...args) {
        console.warn(...args);
    }

    /**
     * 错误（始终输出）
     * @param {...*} args
     */
    static error(...args) {
        console.error(...args);
    }
}
