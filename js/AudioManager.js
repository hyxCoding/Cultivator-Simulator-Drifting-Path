/**
 * 音频管理器（单例）—— 背景音乐（循环播放）+ 音效（单次播放）
 * ==========================================================================
 * 一、两类音频的区别
 *   · 背景音乐（BGM）：用带 loop = true 的 <audio> 播放，同一时刻只允许一首在播；
 *     本类负责「立即播 / 立即停 / 延迟 N 秒后再播（回主图的 10 秒倒计时）」。
 *   · 音效（SFX）：每次调用播放一次（不循环），同一个键最多允许 SFX_POOL_SIZE 个实例
 *     重叠播放（连打 / 多目标命中不会互相掐断）；其中「受伤」类音效走 playSfxExclusive ——
 *     同一音效正在播时，这一次直接跳过（需求：受伤音效不叠加）。
 *   · 同一音效的「最小间隔」：SFX_MIN_INTERVAL（0.2 秒）内同一个键重复调用会被跳过 ——
 *     同一帧里被两处逻辑各播一次（例：主循环一帧内更新两次小游戏 / 连点 / 多目标同帧命中）
 *     听感上就是「本该播一次的音响了两声」。不同音效之间互不影响，间隔够了照样能叠加。
 *
 * 二、音频键（唯一的资源地址来源：js/ResourceManager.js → resources.audio）
 *   背景音乐：
 *     bgm.main_menu      开始游戏界面（游戏加载完成后立刻循环；点「开始游戏」立刻停）
 *     bgm.qinglan        第一章主图 青岚浮野（回主图 10 秒后起播）
 *     bgm.yunduze        第二章主图 云渡泽（同上）
 *     bgm.minigame_boat  逆流送灯（开局立刻播、结束立刻停）
 *     bgm.minigame_herb  乘风采药（只在起风期间循环，风停 / 结束立刻停）
 *     bgm.ending         游戏结束滚动字幕（进入界面立刻播，退出界面才停）
 *   音效：
 *     sfx.player_attack / player_lingxidan / player_hutishu / player_dodge / player_jianying
 *     sfx.player_hurt / pickup
 *     sfx.boss_shanxiao_charge / _sweep / _pounce / _slam / _hurt / _defeat
 *     sfx.boss_due_summon / _dash / _control / _hurt / _defeat
 *     sfx.ui_hover / ui_click / ui_quest_panel
 *     sfx.minigame_lantern_light / minigame_lantern_extinguish
 *     sfx.victory / defeat
 *   （完整地址清单见 tools/音频资源清单.txt）
 *
 * 三、缺文件 / 浏览器限制的兜底（需求：缺失音频不播，且不能导致游戏报错）
 *   1) 资源键不存在 / 路径取不到 → 返回 false，静默跳过（同一次会话只处理一遍）；
 *   2) 文件缺失、格式不支持（error 事件 / play() 以 NotSupportedError 拒绝）→ 标记为不可用，
 *      之后该键不再尝试播放；
 *   3) 浏览器自动播放策略拦下（NotAllowedError）→ 记住该 BGM，等第一次用户交互后再试一次。
 *      交互监听在 AudioManager **构造时就绑上**（越早越好）：加载界面（game.html 的
 *      loadingOverlay，本管理器由 Main.init 的 startMenuBgmEarly / 加载提示逻辑提早创建）
 *      上玩家的那一次点击同样算数 —— 会被记成 hasUserGesture() = true，并立刻补播被拦下的
 *      BGM（handleUserGesture()），玩家不必在开始界面**再点一次**才听到声音；
 *      第一次交互还会触发 onUnlock 回调（加载界面据此收起「点一下开启声音」的提示）；
 *   4) 所有 play() / pause() 调用都包在 try/catch 里，且 play() 返回的 Promise 一定挂 catch ——
 *      无论环境里有没有 Audio 实现（如无头测试的桩），都不会抛出异常。
 *
 * 四、调用方式
 *   · Main 持有实例：this.audioManager = AudioManager.getInstance()（由它统一调度 BGM）；
 *   · 没有 main 引用的类（UIButton / MapAreaButton / QuestUI / 各技能 / Boss / 小游戏）
 *     用本文件底部的全局入口 gameAudio（内部同样做了上述全部兜底）：
 *       gameAudio.playSfx('sfx.ui_click')
 *       gameAudio.playSfxExclusive('sfx.player_hurt')
 *       gameAudio.playBgm('bgm.minigame_boat') / gameAudio.stopBgm('bgm.minigame_boat')
 */
class AudioManager {
    /**
     * 获取音频管理器单例
     * @returns {AudioManager}
     */
    static getInstance() {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    /**
     * 主图背景音乐表（地图 ID → 音频键）
     * 只有这两张主图有背景音乐：进小游戏 / 进 Boss 战场 / 传送到另一张地图都会立即停，
     * 回到主图后延迟 MAP_BGM_RETURN_DELAY 秒再起播（见 Main.scheduleMainMapBgm）。
     */
    static get MAP_BGM() {
        return {
            qinglan_fuye: 'bgm.qinglan',
            yunduze: 'bgm.yunduze',
        };
    }

    /**
     * 小游戏背景音乐表（小游戏 ID → 音频键）
     * 注：认灯归魂 / 定息引气等小游戏没有背景音乐，只有音效。
     */
    static get MINIGAME_BGM() {
        return {
            boat_navigation: 'bgm.minigame_boat',
            herb_collect: 'bgm.minigame_herb',
        };
    }

    /** 回到主图后重新起播背景音乐的等待秒数（需求：10 秒；频繁传送则每次重新计时） */
    static get MAP_BGM_RETURN_DELAY() {
        return 10;
    }

    /** 同一个音效键最多同时播放几个实例（超出后循环复用最早的那个） */
    static get SFX_POOL_SIZE() {
        return 4;
    }

    /**
     * 同一个音效键两次播放之间的最小间隔（秒）
     * 需求：同一种音效在 0.2 秒内不重复播放（防止同一帧被播两次 / 连点重复出声）。
     * 注意：只按「键」节流 —— 不同音效互不影响，间隔超过 0.2 秒后照常可以叠加播放。
     */
    static get SFX_MIN_INTERVAL() {
        return 0.2;
    }

    /**
     * 地图 ID → 主图背景音乐键
     * @param {string} mapId
     * @returns {string|null} 没有对应 BGM（小地图 / Boss 战场 / 未知地图）时返回 null
     */
    static getMapBgmKey(mapId) {
        if (!mapId) return null;
        const table = AudioManager.MAP_BGM;
        return Object.prototype.hasOwnProperty.call(table, mapId) ? table[mapId] : null;
    }

    /**
     * 小游戏 ID → 小游戏背景音乐键
     * @param {string} gameId
     * @returns {string|null}
     */
    static getMinigameBgmKey(gameId) {
        if (!gameId) return null;
        const table = AudioManager.MINIGAME_BGM;
        return Object.prototype.hasOwnProperty.call(table, gameId) ? table[gameId] : null;
    }

    /**
     * 该音频键是否是主图背景音乐（用于「只停主图音乐」的判断）
     * @param {string} key
     * @returns {boolean}
     */
    static isMapBgm(key) {
        return Object.keys(AudioManager.MAP_BGM).some(mapId => AudioManager.MAP_BGM[mapId] === key);
    }

    /**
     * 该音频键是否是小游戏背景音乐
     * @param {string} key
     * @returns {boolean}
     */
    static isMinigameBgm(key) {
        return Object.keys(AudioManager.MINIGAME_BGM)
            .some(gameId => AudioManager.MINIGAME_BGM[gameId] === key);
    }

    constructor() {
        if (AudioManager.instance) {
            return AudioManager.instance;
        }
        AudioManager.instance = this;

        // ========== 音量（改这里统一调音量）==========
        this.bgmVolume = 0.6;
        this.sfxVolume = 0.9;

        // ========== 总开关（调试用：置 false 即静音，不影响游戏逻辑）==========
        this.enabled = true;

        // ========== 缓存 ==========
        this.resourceManager = null;      // 惰性取 ResourceManager 单例
        this._pathCache = new Map();      // 音频键 → 文件路径（null = 键不存在）
        this._bgmCache = new Map();       // 音频键 → { audio, failed, path }
        this._sfxCache = new Map();       // 音频键 → { audios: [], next, failed, path }
        this._sfxLastPlayAt = new Map();  // 音频键 → 上次播放时间（毫秒），用于 SFX_MIN_INTERVAL 节流

        // ========== 背景音乐状态 ==========
        this.currentBgmKey = null;        // 当前正在播放的 BGM 键
        this.bgmElement = null;           // 当前正在播放的 Audio 元素
        this._scheduledBgm = null;        // { key, timer } 待播 BGM（回主图的 10 秒倒计时）
        this._pendingBgmKey = null;       // 被浏览器自动播放策略拦下、等用户交互后重试的 BGM
        this._userGestureSeen = false;    // 玩家是否已经交互过（点击 / 按键 / 触摸）
        this.onUnlock = null;             // 第一次交互时的回调（加载界面据此收起「点一下开启声音」提示）
        this._unlockBound = false;

        // 用户交互监听**在这里就绑上**（构造 = 最早时机）：加载界面上的那一次点击也要被记下来，
        // 否则这次交互被浪费，玩家得在开始界面再点一次才听得到声音（旧行为）。
        this._bindUserGestureUnlock();
    }

    // ==================== 资源 / 元素创建 ====================

    /**
     * 惰性获取资源管理器（ResourceManager 尚未加载时返回 null）
     * @returns {ResourceManager|null}
     */
    _getResourceManager() {
        if (this.resourceManager) return this.resourceManager;
        if (typeof ResourceManager !== 'undefined' && ResourceManager
            && typeof ResourceManager.getInstance === 'function') {
            this.resourceManager = ResourceManager.getInstance();
        }
        return this.resourceManager;
    }

    /**
     * 音频键 → 文件路径（未知键只处理一次，返回 null）
     * @param {string} key - 如 'sfx.ui_click'
     * @returns {string|null}
     */
    _resolvePath(key) {
        if (!key) return null;
        if (this._pathCache.has(key)) return this._pathCache.get(key);

        let path = null;
        const rm = this._getResourceManager();
        if (rm && typeof rm.getAudioPath === 'function') {
            try {
                path = rm.getAudioPath(key) || null;
            } catch (error) {
                path = null;
            }
        }

        this._pathCache.set(key, path);
        if (!path) {
            console.warn(`[AudioManager] 未登记的音频键（本次不播放）: ${key}`);
        }
        return path;
    }

    /**
     * 创建音频元素
     * @param {string} path - 文件路径
     * @param {boolean} loop - 是否循环（背景音乐 true）
     * @returns {HTMLAudioElement|null} 环境不支持 / 创建失败 → null
     */
    _createElement(path, loop) {
        if (typeof Audio !== 'function') return null;
        try {
            const audio = new Audio();
            audio.loop = !!loop;
            audio.volume = loop ? this.bgmVolume : this.sfxVolume;
            audio.preload = 'auto';
            audio.src = path;
            return audio;
        } catch (error) {
            console.warn(`[AudioManager] 音频元素创建失败（本次不播放）: ${path}`);
            return null;
        }
    }

    /**
     * 绑定「文件缺失 / 解码失败」处理：标记该键不可用，之后不再尝试播放
     * @param {Object} entry - { audio, failed }
     * @param {string} key - 音频键
     * @param {string} path - 文件路径
     */
    _bindErrorHandler(entry, key, path) {
        const audio = entry ? entry.audio : null;
        if (!audio || typeof audio.addEventListener !== 'function') return;

        audio.addEventListener('error', () => {
            if (entry.failed) return;
            entry.failed = true;
            console.warn(`[AudioManager] 音频文件缺失或无法解码，本次不播放: ${key} → ${path}`);
            if (this.currentBgmKey === key) {
                this.currentBgmKey = null;
                this.bgmElement = null;
            }
        });
    }

    /**
     * 发起播放（统一的异常兜底）
     * @param {Object} entry - { audio, failed }
     * @param {string} key - 音频键（用于日志与自动播放重试）
     * @param {boolean} isLoop - 是否背景音乐
     * @returns {boolean} 是否成功发起播放
     */
    _playElement(entry, key, isLoop) {
        if (!this.enabled) return false;
        const audio = entry ? entry.audio : null;
        if (!audio || entry.failed) return false;

        let promise = null;
        try {
            promise = audio.play();
        } catch (error) {
            // 同步抛错（例如元素未挂 src）：按缺失处理，不再尝试
            entry.failed = true;
            return false;
        }

        if (promise && typeof promise.catch === 'function') {
            promise.catch(error => {
                const name = error && error.name;
                if (name === 'NotAllowedError' || name === 'AbortError') {
                    // 浏览器自动播放策略：等第一次用户交互后重试（只对背景音乐重试）
                    if (isLoop) {
                        this._pendingBgmKey = key;
                        this._bindUserGestureUnlock();
                    }
                    return;
                }
                entry.failed = true;
                console.warn(`[AudioManager] 音频播放失败，本次不播放: ${key} → ${this._resolvePath(key)}`);
                if (this.currentBgmKey === key) {
                    this.currentBgmKey = null;
                    this.bgmElement = null;
                }
            });
        }

        return true;
    }

    /**
     * 绑定「玩家第一次交互」监听（构造时调用，只绑一次）
     * 浏览器自动播放策略要求「玩家先与页面交互」才允许出声：这里把最早的那次交互记下来，
     * 并立刻补播被拦下的 BGM —— 包括在加载界面（loadingOverlay）上发生的那一次点击。
     * 事件类型：指针按下 / 鼠标按下 / 键盘按下 / 触摸开始（与浏览器认可的“用户激活”一致）。
     */
    _bindUserGestureUnlock() {
        if (this._unlockBound) return;
        if (typeof document === 'undefined' || !document
            || typeof document.addEventListener !== 'function') {
            return;
        }
        this._unlockBound = true;

        const events = ['pointerdown', 'mousedown', 'keydown', 'touchstart'];
        const onGesture = () => this.handleUserGesture();
        events.forEach(type => document.addEventListener(type, onGesture, true));
    }

    /**
     * 记录「玩家已经交互过」，并补播被浏览器自动播放策略拦下的 BGM
     * · 由 _bindUserGestureUnlock 绑定的监听调用；也可由调用方（测试 / 特殊入口）直接调用；
     * · 重复调用无害：只有第一次会触发 onUnlock 回调、只有存在待播 BGM 时才会补播。
     * @returns {boolean} 是否补播了一次被拦下的 BGM
     */
    handleUserGesture() {
        const firstTime = !this._userGestureSeen;
        this._userGestureSeen = true;

        if (firstTime && typeof this.onUnlock === 'function') {
            try {
                this.onUnlock();
            } catch (error) {
                // 回调异常不能影响音频（兜底：这里永不抛出）
            }
        }

        const key = this._pendingBgmKey;
        if (!key) return false;
        this._pendingBgmKey = null;
        return this.playBgm(key);
    }

    /**
     * 玩家是否已经与页面交互过
     * 浏览器自动播放策略：交互过（点击 / 按键 / 触摸）之后才允许带声音播放。
     * @returns {boolean}
     */
    hasUserGesture() {
        return this._userGestureSeen;
    }

    /**
     * 是否有被自动播放策略拦下、等玩家交互后补播的背景音乐
     * @returns {boolean}
     */
    isBgmPending() {
        return !!this._pendingBgmKey;
    }

    /**
     * 音频元素此刻是否正在播放（无 paused 属性的测试桩视为「未播放」）
     * @param {HTMLAudioElement|null} audio
     * @returns {boolean}
     */
    _isPlaying(audio) {
        if (!audio) return false;
        if (typeof audio.paused === 'boolean') return audio.paused === false;
        return false;
    }

    // ==================== 音效（单次播放）====================

    /**
     * 取某个音效键的条目（惰性创建；路径缺失 / 环境不支持 → null）
     * @param {string} key
     * @returns {Object|null}
     */
    _getSfxEntry(key) {
        if (this._sfxCache.has(key)) return this._sfxCache.get(key);

        const path = this._resolvePath(key);
        const first = path ? this._createElement(path, false) : null;
        if (!first) {
            this._sfxCache.set(key, null);
            return null;
        }

        const entry = { audios: [first], next: 0, failed: false, path: path };
        this._bindErrorHandler(entry, key, path);
        this._sfxCache.set(key, entry);
        return entry;
    }

    /**
     * 取一个可用于本次播放的音效实例（优先空闲实例，否则循环复用）
     * @param {Object} entry
     * @returns {HTMLAudioElement|null}
     */
    _acquireSfxAudio(entry) {
        for (const audio of entry.audios) {
            if (!this._isPlaying(audio)) return audio;
        }

        if (entry.audios.length < AudioManager.SFX_POOL_SIZE) {
            const audio = this._createElement(entry.path, false);
            if (!audio) return entry.audios[0] || null;
            entry.audios.push(audio);
            return audio;
        }

        const audio = entry.audios[entry.next % entry.audios.length];
        entry.next = (entry.next + 1) % entry.audios.length;
        return audio;
    }

    /**
     * 内部：取当前时间（毫秒）
     * 抽成方法是为了让冒烟测试可以注入可控时钟（见 tools/smoke_chapter2_runner.js 的音频节流断言），
     * 生产环境永远走 performance.now()（拿不到就退化为 Date.now()）。
     * @returns {number}
     */
    _now() {
        if (typeof performance !== 'undefined' && performance
            && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    /**
     * 播放一次音效（可叠加；同一键并发上限见 SFX_POOL_SIZE）
     * 附加节流：同一音效键在 SFX_MIN_INTERVAL（0.2 秒）内只播一次 ——
     * 同一帧里两处逻辑都调了一次（例如主循环一帧内把小游戏更新了两遍）时，第二次直接跳过。
     * @param {string} key - 音频键，如 'sfx.player_attack'
     * @returns {boolean} 是否真的发起了播放（键不存在 / 文件缺失 / 0.2 秒内重复调用 → false）
     */
    playSfx(key) {
        if (!this.enabled || !key) return false;

        const entry = this._getSfxEntry(key);
        if (!entry || entry.failed) return false;

        // 同种音效节流：间隔不足 SFX_MIN_INTERVAL 的重复调用直接跳过（不占池、不出声）
        const now = this._now();
        const lastPlayAt = this._sfxLastPlayAt.get(key);
        if (typeof lastPlayAt === 'number'
            && (now - lastPlayAt) < AudioManager.SFX_MIN_INTERVAL * 1000) {
            return false;
        }
        this._sfxLastPlayAt.set(key, now);

        const audio = this._acquireSfxAudio(entry);
        if (!audio) return false;

        try {
            audio.currentTime = 0;
        } catch (error) {
            // 部分环境（音频尚未就绪）赋值会抛错：忽略即可
        }

        // 绑定本次要播的实例：_playElement 会把「播放失败」直接标记到缓存的条目上，
        // 于是同一个键之后不再反复尝试（缺文件 / 解码失败都走这条路径）
        entry.audio = audio;
        return this._playElement(entry, key, false);
    }

    /**
     * 播放一次音效，但「同一音效正在播放时跳过这一次」
     * 用于受伤音效（需求：玩家 / Boss 每次受伤都播，若当前正在播受伤音效则不播）
     * @param {string} key
     * @returns {boolean} 是否真的发起了播放
     */
    playSfxExclusive(key) {
        if (this.isSfxPlaying(key)) return false;
        return this.playSfx(key);
    }

    /**
     * 该音效此刻是否正在播放
     * @param {string} key
     * @returns {boolean}
     */
    isSfxPlaying(key) {
        const entry = this._sfxCache.get(key);
        if (!entry || !entry.audios) return false;
        return entry.audios.some(audio => this._isPlaying(audio));
    }

    // ==================== 背景音乐（循环播放）====================

    /**
     * 取某个 BGM 键的条目（惰性创建；路径缺失 / 环境不支持 → null）
     * @param {string} key
     * @returns {Object|null}
     */
    _getBgmEntry(key) {
        if (this._bgmCache.has(key)) return this._bgmCache.get(key);

        const path = this._resolvePath(key);
        const audio = path ? this._createElement(path, true) : null;
        if (!audio) {
            this._bgmCache.set(key, null);
            return null;
        }

        const entry = { audio: audio, failed: false, path: path };
        this._bindErrorHandler(entry, key, path);
        this._bgmCache.set(key, entry);
        return entry;
    }

    /**
     * 立即循环播放背景音乐（同一首正在播放时不打断，其它情况先停当前再起播）
     * @param {string} key - 音频键，如 'bgm.qinglan'
     * @returns {boolean} 是否成功发起播放
     */
    playBgm(key) {
        if (!key) return false;

        // 起播就代表这次延迟调度已经用掉
        this._scheduledBgm = null;
        this._pendingBgmKey = null;

        // 同一首已在播放 → 不重头播（避免频繁调用造成音乐卡顿）
        if (this.currentBgmKey === key && this._isPlaying(this.bgmElement)) return true;

        this._stopBgmElement();
        this.currentBgmKey = null;
        this.bgmElement = null;

        const entry = this._getBgmEntry(key);
        if (!entry) return false;

        try {
            entry.audio.currentTime = 0;
        } catch (error) {
            // 尚未就绪：忽略
        }

        this.currentBgmKey = key;
        this.bgmElement = entry.audio;

        if (!this._playElement(entry, key, true)) {
            this.currentBgmKey = null;
            this.bgmElement = null;
            return false;
        }
        return true;
    }

    /**
     * 立即停止背景音乐
     * @param {string|string[]} [onlyIfKey] - 仅当「当前播放 / 待播倒计时」的 BGM 是这些键之一时才停；
     *        省略 = 无条件停（并取消待播的倒计时）
     * @returns {boolean} 是否执行了停止 / 取消
     */
    stopBgm(onlyIfKey) {
        if (onlyIfKey) {
            const keys = Array.isArray(onlyIfKey) ? onlyIfKey : [onlyIfKey];
            const scheduledKey = this._scheduledBgm ? this._scheduledBgm.key : null;
            const hitCurrent = !!this.currentBgmKey && keys.indexOf(this.currentBgmKey) !== -1;
            const hitScheduled = !!scheduledKey && keys.indexOf(scheduledKey) !== -1;

            if (!hitCurrent && !hitScheduled) return false;
            if (hitScheduled) this._scheduledBgm = null;
            if (!hitCurrent) return true;   // 只是取消了待播的倒计时
        } else {
            this._scheduledBgm = null;
        }

        this._pendingBgmKey = null;
        const hadBgm = !!this.bgmElement || !!this.currentBgmKey;
        this._stopBgmElement();
        this.currentBgmKey = null;
        this.bgmElement = null;
        return hadBgm;
    }

    /**
     * 延迟播放背景音乐（回主图后 10 秒再起播）
     * - 每次调用都会重新计时（需求：频繁传送时 10 秒倒计时每次重新开始）
     * - 调度时会把当前正在播的其它 BGM 立即停掉（需求：进小游戏 / 传送 / 进 Boss 关立刻停）
     * @param {string} key - 目标 BGM 键
     * @param {number} [delaySeconds] - 等待秒数，默认 AudioManager.MAP_BGM_RETURN_DELAY（10 秒）
     * @returns {boolean} 是否成功登记
     */
    scheduleBgm(key, delaySeconds = AudioManager.MAP_BGM_RETURN_DELAY) {
        this._pendingBgmKey = null;

        if (!key) {
            this._scheduledBgm = null;
            return false;
        }

        // 同一首已经在播 → 不需要再调度
        if (this.currentBgmKey === key && this._isPlaying(this.bgmElement)) {
            this._scheduledBgm = null;
            return true;
        }

        // 换成另一首：当前音乐立刻停（等倒计时结束才响起新的那首）
        if (this.currentBgmKey || this.bgmElement) {
            this.stopBgm();
        }

        const delay = (typeof delaySeconds === 'number' && delaySeconds > 0) ? delaySeconds : 0;
        this._scheduledBgm = { key: key, timer: delay };
        if (delay === 0) this.update(0);
        return true;
    }

    /**
     * 推进背景音乐的延迟倒计时（由 Main.update 每帧调用）
     * @param {number} deltaTime - 时间增量（秒）
     */
    update(deltaTime) {
        if (!this._scheduledBgm) return;

        const dt = (typeof deltaTime === 'number' && deltaTime > 0) ? deltaTime : 0;
        this._scheduledBgm.timer -= dt;
        if (this._scheduledBgm.timer > 0) return;

        const key = this._scheduledBgm.key;
        this._scheduledBgm = null;
        this.playBgm(key);
    }

    // ==================== 查询 / 工具 ====================

    /** 待播 BGM 的键（没有倒计时中的 BGM 时返回 null） */
    getScheduledBgmKey() {
        return this._scheduledBgm ? this._scheduledBgm.key : null;
    }

    /** 待播 BGM 的剩余秒数（没有倒计时中的 BGM 时返回 0） */
    getScheduledBgmRemaining() {
        return this._scheduledBgm ? Math.max(0, this._scheduledBgm.timer) : 0;
    }

    /** 当前 BGM 是否正在播放 */
    isBgmPlaying() {
        return this._isPlaying(this.bgmElement);
    }

    /**
     * 设置音量
     * @param {Object} volumes - { bgm, sfx }
     */
    setVolume(volumes = {}) {
        if (typeof volumes.bgm === 'number') this.bgmVolume = Math.max(0, Math.min(1, volumes.bgm));
        if (typeof volumes.sfx === 'number') this.sfxVolume = Math.max(0, Math.min(1, volumes.sfx));

        this._bgmCache.forEach(entry => {
            if (entry && entry.audio) entry.audio.volume = this.bgmVolume;
        });
        this._sfxCache.forEach(entry => {
            if (entry && entry.audios) {
                entry.audios.forEach(audio => { audio.volume = this.sfxVolume; });
            }
        });
    }

    /** 全部停止（BGM + 所有音效），并取消待播倒计时 */
    stopAll() {
        this._scheduledBgm = null;
        this._pendingBgmKey = null;
        this._sfxLastPlayAt.clear();     // 连节流记录一起清：停干净后再播不该被上一次的时间戳拦住
        this._stopBgmElement();
        this.currentBgmKey = null;
        this.bgmElement = null;

        this._sfxCache.forEach(entry => {
            if (entry && entry.audios) {
                entry.audios.forEach(audio => this._stopElement(audio));
            }
        });
    }

    /** 内部：暂停当前 BGM 元素（异常兜底） */
    _stopBgmElement() {
        this._stopElement(this.bgmElement);
    }

    /**
     * 内部：暂停指定音频元素（异常兜底）
     * @param {HTMLAudioElement|null} audio
     */
    _stopElement(audio) {
        if (!audio || typeof audio.pause !== 'function') return;
        try {
            audio.pause();
        } catch (error) {
            // 暂停失败无需处理
        }
    }

    /**
     * 当前音频状态快照（调试 / 回归断言用）
     * @returns {Object}
     */
    getState() {
        return {
            enabled: this.enabled,
            currentBgmKey: this.currentBgmKey,
            bgmPlaying: this.isBgmPlaying(),
            scheduledBgmKey: this.getScheduledBgmKey(),
            scheduledTimer: Number(this.getScheduledBgmRemaining().toFixed(3)),
            pendingBgmKey: this._pendingBgmKey,      // 被自动播放策略拦下、等交互后补播的 BGM
            userGesture: this.hasUserGesture(),      // 玩家是否已经交互过（浏览器才允许出声）
            bgmVolume: this.bgmVolume,
            sfxVolume: this.sfxVolume,
            sfxMinInterval: AudioManager.SFX_MIN_INTERVAL,   // 同种音效最小播放间隔（秒）
        };
    }
}

/**
 * 音频全局便捷入口（给没有 main 引用的类使用：UI 组件 / 玩家技能 / Boss / 小游戏）
 * 说明：内部全部走 AudioManager，并保证「取不到 AudioManager / 音频文件缺失 → 静默跳过，不抛错」。
 */
const gameAudio = {
    /**
     * 取音频管理器（环境里没有 AudioManager 时返回 null）
     * @returns {AudioManager|null}
     */
    manager() {
        if (typeof AudioManager === 'undefined' || !AudioManager) return null;
        return AudioManager.getInstance();
    },

    /**
     * 播放一次音效
     * @param {string} key - 音频键，如 'sfx.ui_click'
     * @returns {boolean} 是否真的发起了播放
     */
    playSfx(key) {
        const manager = this.manager();
        return manager ? manager.playSfx(key) : false;
    },

    /**
     * 播放一次音效（同一音效正在播放时跳过）—— 受伤音效用
     * @param {string} key
     * @returns {boolean}
     */
    playSfxExclusive(key) {
        const manager = this.manager();
        return manager ? manager.playSfxExclusive(key) : false;
    },

    /**
     * 该音效此刻是否正在播放
     * @param {string} key
     * @returns {boolean}
     */
    isSfxPlaying(key) {
        const manager = this.manager();
        return manager ? manager.isSfxPlaying(key) : false;
    },

    /**
     * 立即循环播放背景音乐
     * @param {string} key
     * @returns {boolean}
     */
    playBgm(key) {
        const manager = this.manager();
        return manager ? manager.playBgm(key) : false;
    },

    /**
     * 立即停止背景音乐（可只停指定的键）
     * @param {string|string[]} [onlyIfKey]
     * @returns {boolean}
     */
    stopBgm(onlyIfKey) {
        const manager = this.manager();
        return manager ? manager.stopBgm(onlyIfKey) : false;
    },

    /**
     * 延迟播放背景音乐（回主图 10 秒倒计时）
     * @param {string} key
     * @param {number} [delaySeconds]
     * @returns {boolean}
     */
    scheduleBgm(key, delaySeconds) {
        const manager = this.manager();
        return manager ? manager.scheduleBgm(key, delaySeconds) : false;
    },
};

if (typeof window !== 'undefined') {
    window.AudioManager = AudioManager;
    window.gameAudio = gameAudio;
}





