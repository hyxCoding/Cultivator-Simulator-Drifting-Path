/**
 * Main · 背景音乐与音效
 * 主图 / 小游戏 / 完结界面的 BGM 调度，以及一次性音效播放。
 *
 * 由 js/Main.js 拆分而来，经原型混入挂回 Main（Object.assign(Main.prototype, {...})）：
 * 调用点仍写作 this.xxx()，行为与原单文件实现完全一致。
 */

Object.assign(Main.prototype, {

        /**
         * 当前主图应播的背景音乐键
         * Boss 战场 / 未知地图没有主图 BGM → null
         * @returns {string|null}
         */
        getCurrentMapBgmKey() {
            if (!this.currentMap || !this.currentMap.mapId) return null;
            return AudioManager.getMapBgmKey(this.currentMap.mapId);
        },

        /**
         * 进入大地图场景（GameWorldScene.enter → 本方法）
         * · 首次（从开始界面点「开始游戏」进来）：主图 BGM 立刻起播；
         * · 之后（小游戏退出 / Boss 关退出 / 完结界面返回 / 从世界地图传送落地）：
         *   立刻停掉其它音乐，等 10 秒再播当前主图的 BGM（频繁切换则重新计时）。
         */
        onGameWorldSceneEnter() {
            const firstEntry = !this.hasEnteredGameWorld;
            this.hasEnteredGameWorld = true;

            if (firstEntry) {
                this.playCurrentMapBgm();
            } else {
                this.scheduleMainMapBgm();
            }
        },

        /**
         * 离开大地图场景（GameWorldScene.exit → 本方法）
         * 进小游戏 / 进战斗场景 / 进完结界面：主图 BGM 立即停（结束界面 / 小游戏会自行起播各自的 BGM）
         */
        onGameWorldSceneExit() {
            this.stopMainMapBgm();
        },

        /**
         * 立即起播当前主图的背景音乐（没有对应 BGM 的图则不停不播）
         * @returns {boolean}
         */
        playCurrentMapBgm() {
            if (!this.audioManager) return false;
            const key = this.getCurrentMapBgmKey();
            return key ? this.audioManager.playBgm(key) : false;
        },

        /**
         * 回主图：立刻停掉当前音乐，登记「10 秒后再播本图 BGM」
         * @param {number} [delay] - 等待秒数（缺省 10 秒；测试可传小值）
         * @returns {boolean}
         */
        scheduleMainMapBgm(delay) {
            if (!this.audioManager) return false;
            // 重复调度 = 重新计时（需求：频繁传送时 10 秒倒计时每次重新开始）
            this.audioManager.stopBgm(this._mainMapBgmKeys());
            const key = this.getCurrentMapBgmKey();
            if (!key) return false;
            const seconds = (typeof delay === 'number') ? delay : AudioManager.MAP_BGM_RETURN_DELAY;
            return this.audioManager.scheduleBgm(key, seconds);
        },

        /**
         * 停掉主图背景音乐（正在播的 + 10 秒倒计时中的），不动小游戏 / 完结界面 / 开始界面的 BGM
         * @returns {boolean}
         */
        stopMainMapBgm() {
            if (!this.audioManager) return false;
            return this.audioManager.stopBgm(this._mainMapBgmKeys());
        }

        /** 全部主图 BGM 键（AudioManager.MAP_BGM 的值列表） */,

        _mainMapBgmKeys() {
            return Object.keys(AudioManager.MAP_BGM).map(mapId => AudioManager.MAP_BGM[mapId]);
        },

        /**
         * 提早尝试起播开始界面背景音乐（bgm.main_menu）—— Main.init 加载阶段调用
         * · 正常情况（玩家此前已与页面交互过）：加载界面就开始循环播放；
         * · 被浏览器自动播放策略拦下：AudioManager 记下这次尝试，玩家的第一次点击 / 按键
         *   （**包括在加载界面上发生的那一次**）会立刻补播 —— 不必在开始界面再点一次；
         * · 正式开始界面（MainMenuScene.enter）还会再调一次 playBgm：同一首已在播时不会重头播。
         * @returns {boolean} 是否成功发起播放（被拦下时返回 true，由 AudioManager 负责补播）
         */
        startMenuBgmEarly() {
            return gameAudio.playBgm('bgm.main_menu');
        },

        /**
         * 地图切换（Main.switchToMap 调用）后的背景音乐处理：
         * · 落到 Boss 战场 → 主图 BGM 立即停（战场没有背景音乐）；
         * · 落到主图（另一张图 / 从战场返回）→ 10 秒后再播该图 BGM。
         * @param {string} fromMapId - 切换前的地图 ID
         * @param {string} toMapId - 切换后的地图 ID
         */
        onMapSwitched(fromMapId, toMapId) {
            if (!this.audioManager) return;

            // 只是同一张地图内的重新落点（例如同图传送）→ 不动音乐
            if (fromMapId && toMapId && fromMapId === toMapId) return;

            if (this.isArenaMap(toMapId)) {
                // 进 Boss 关：立即停止主图背景音乐（战场本身没有 BGM）
                this.stopMainMapBgm();
                return;
            }

            if (AudioManager.getMapBgmKey(toMapId)) {
                this.scheduleMainMapBgm();
            } else {
                // 未知地图（没有配 BGM）→ 别留上一张图的音乐
                this.stopMainMapBgm();
            }
        },

        /**
         * 播放一次音效（缺失音频文件时静默跳过）
         * @param {string} key - 音频键，如 'sfx.victory'
         * @returns {boolean}
         */
        playSfx(key) {
            return this.audioManager ? this.audioManager.playSfx(key) : false;
        },

        _minigameBgmKeys() {
            return Object.keys(AudioManager.MINIGAME_BGM).map(gameId => AudioManager.MINIGAME_BGM[gameId]);
        }

});
