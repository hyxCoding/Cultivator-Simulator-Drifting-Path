/**
 * Main · 小游戏编排
 * 小游戏启动（传参 + 服务）/ 结束回调（成功 / 失败）/ 各类小游戏结算收尾。
 *
 * 由 js/Main.js 拆分而来，经原型混入挂回 Main（Object.assign(Main.prototype, {...})）：
 * 调用点仍写作 this.xxx()，行为与原单文件实现完全一致。
 */

Object.assign(Main.prototype, {

        /**
         * 路标 → 小游戏（统一入口）
         * - 路标带 roleplayDialogue 时先播引导对白，读完再开小游戏（如「认灯台」「旧水道」）
         * - 不同小游戏的结算回调在此分流：乘风采药（第一章）/ 认灯归魂 / 逆流送灯（第二章）
         * @param {Signpost} signpost
         */
        startMiniGameFromSignpost(signpost) {
            if (!signpost || !signpost.gameId) return;
            const gameId = signpost.gameId;

            const launch = () => {
                this.startMiniGame(gameId, (result) => {
                    // 认灯归魂：成功推进目标 + 播 T03（主角自言自语）；3 次机会用尽 → 播 T02 后回大地图
                    if (gameId === 'lantern_identify') {
                        this.finishLanternIdentify(result);
                        return;
                    }
                    // 逆流行舟：成功播 T05 归魂演出；失败播 T04（可重试，不丢魂灯）
                    if (gameId === 'boat_navigation') {
                        this.finishRiverEscort(result);
                        return;
                    }
                    if (!result || !result.success) {
                        Logger.log(`[路标] ${signpost.name} 未完成：${result ? result.rating : 'unknown'}`);
                        return;
                    }
                    Logger.log(`[路标] ${signpost.name} 完成！`);

                    if (gameId === 'herb_collect') {
                        // 第一章：乘风采药成功 → 推进主线二「一盏安身灯」采药目标
                        if (this.player && this.player.questSystem) {
                            this.player.questSystem.updateQuestProgress('chapter1_main_2', 'collect_item', 'lingcao', 3);
                        }
                        // 需求：成功退出小游戏后补一句收尾对白（文本见路标 successDialogue，缺省用内置台词）
                        this.playHerbCollectSuccessDialogue(signpost);
                        return;
                    }
                });
            };

            if (signpost.roleplayDialogue) {
                this.playDialogueText(signpost.roleplayDialogue, signpost.name + ': ', launch);
            } else {
                launch();
            }
        },

        /**
         * 乘风采药「成功退出」后的收尾对白（主角自言自语）
         *
         * 需求：小游戏成功 → 退出后加个对话（说明采药成功）。
         * 文本优先取路标配置（Chapter1Config 采药点路标的 successDialogue / successSpeaker，
         * 见 Signpost.js），没配就用 Main 顶部的内置台词 —— 保证成功之后一定有句话。
         * 走的是和其余剧情对白同一条链路（playDialogueText：锁移动 / 按 J 或点击推进），
         * 所以玩家刚回到主图时不会误操作。
         * @param {Signpost} [signpost] - 触发本局小游戏的路标（可空）
         * @returns {boolean} 是否播出了对白
         */
        playHerbCollectSuccessDialogue(signpost) {
            const text = (signpost && signpost.successDialogue) || HERB_COLLECT_SUCCESS_DIALOGUE;
            const speaker = (signpost && signpost.successSpeaker) || HERB_COLLECT_SUCCESS_SPEAKER;
            return this.playDialogueText(text, speaker);
        },

        /**
         * 第二章：认灯归魂（灯序）结算
         * 成功 → 推进主线二「在认灯台完成身份核对」目标，并播 T03（主角自言自语 + 灯中回应）
         * 失败（3 次机会用尽）→ 播 T02；认灯台路标仍在，可再进小游戏重新抽灯序
         * @param {Object} result - 小游戏结果
         */
        finishLanternIdentify(result) {
            if (!result || !result.success) {
                this.playStoryDialogue('t02_identify_fail', '系统: ');
                return;
            }
            if (this.player && this.player.questSystem) {
                this.player.questSystem.updateQuestProgress('chapter2_main_2', 'complete_minigame', 'lantern_identify', 1);
            }
            this.setStoryFlag('chapter2_identify_done');
            // 对白跳出：主角自言自语游戏胜利（T03 首行），随后灯中回应
            this.playStoryDialogue('t03_identify_success', '旁白: ');
        },

        /**
         * 第二章：逆流送灯（横版行舟护送，见 js/BoatNavigationMiniGame.js）
         * 成功 → 推进主线三「完成逆流行舟护送」目标 → 播放 T05 归魂演出 → 江晚 / 陈栎出现在救助院
         *        （主线三此后只剩问江晚 / 陈栎证词与向陆舟交付三步）
         * 失败 → 播放 T04（可重试，不丢魂灯、不清认灯记录）
         * @param {Object} result
         */
        finishRiverEscort(result) {
            const questSystem = this.player ? this.player.questSystem : null;

            if (!result || !result.success) {
                this.playStoryDialogue('t04_escort_fail', '陆舟: ');
                return;
            }

            if (questSystem) {
                questSystem.updateQuestProgress('chapter2_main_3', 'complete_minigame', 'boat_navigation', 1);
            }
            this.setStoryFlag('chapter2_escort_done');

            // 归魂演出（T05）→ 演出结束后江晚、陈栎归位
            this.playStoryDialogue('t05_soul_return', '旁白: ', () => this.completeSoulReturn());
        },

        /**
         * 归魂演出结算：江晚 / 陈栎出现在右侧救助院，阿禾与江婆移到救助院，
         * 两盏任务魂灯转为空灯（移除任务物品）。
         * 注：主线三已不再有独立的「归魂演出」目标 —— 演出由逆流行舟成功这一目标自动带出，
         *     演出一结束玩家就能去问江晚 / 陈栎证词（主线三第 3、4 步）。
         */
        completeSoulReturn() {
            const map = this.getChapter2Map();

            // 1) 江晚 / 陈栎登台（此前被 applyChapter2Stage 摘除，这里放回）
            if (map && map.npcs) {
                ['jiangwan', 'chenli'].forEach(npcId => {
                    if (!map.npcs.has(npcId) && this.chapter2DormantNPCs[npcId]) {
                        map.addNPC(npcId, this.chapter2DormantNPCs[npcId]);
                    }
                });
            }

            // 2) 阿禾 / 江婆移到救助院
            this.moveChapter2NPC('ahe', { x: 2500, y: 980 });
            this.moveChapter2NPC('jiangpo', { x: 2338, y: 989 });

            // 2b) 江婆换上「女儿获救后」的 idle（idle_after，单帧 32×64）
            this.setJiangpoReunitedIdle(true);

            // 3) 两盏魂灯已归体 → 转为空灯（从任务物品栏移除）
            if (this.player && this.player.questItemSystem) {
                this.player.questItemSystem.removeItem('hundeng_jiangwan', 1);
                this.player.questItemSystem.removeItem('hundeng_chenli', 1);
            }

            this.setStoryFlag('chapter2_soul_returned');
            this.addGameNotification('江晚与陈栎已归魂，去问问他们在灯里看到的事');
        },

        /**
         * 当前是否处于「小游戏」中（含结算完成、场景还没切回主图的那一帧）
         *
         * 为什么不能只看 MiniGameManager.isPlaying：
         *   · 结算完成那一刻 isPlaying 就变 false 了，但 MiniGameScene 还要到下一帧才 exit、
         *     主图才 enter —— 这一帧里事件驱动的按键 / 交互仍然可能进来（见 Main.handleKeyDown 规则0）；
         *   · 用「场景 or 正在玩」两个条件一起判，才能把这段窗口彻底关掉。
         * @returns {boolean}
         */
        isMiniGameActive() {
            const scene = this.sceneManager ? this.sceneManager.getCurrentScene() : null;
            if (scene && scene.sceneId === 'miniGame') return true;
            return !!(this.miniGameManager && this.miniGameManager.isPlaying);
        },

        /**
         * 启动小游戏（隔离运行）
         * @param {string} gameId - 小游戏ID
         * @param {Function} callback - 结束回调 (result) => void
         */
        startMiniGame(gameId, callback) {
            // 已经在小游戏里（含结算完成、场景还没切回主图的那一帧）→ 拒绝重复启动。
            // 旧行为：结算那一帧按住 E（浏览器连发 keydown）会被世界里的路标再次触发到这里 ——
            // 既重开了一局小游戏，又把下面 switchScene('miniGame') 写进 nextSceneId，覆盖掉
            // handleMiniGameEnd 刚登记的 'gameWorld' → 玩家以为退出了，其实还在小游戏里。
            if (this.isMiniGameActive()) {
                console.warn(`[小游戏] 已在小游戏中，忽略重复启动: ${gameId}`);
                return false;
            }

            // 保存进入小游戏时的玩家大地图坐标（结束时恢复）
            this._savedPlayerX = this.player.position.x;
            this._savedPlayerY = this.player.position.y;

            // 输入隔离：放掉主图残留的「按住」按键（含刚按下但还没消费的瞬时键）
            // 玩家按着 WASD 时按 E 进小游戏，那份按住状态会被小游戏读走 —— 角色一进局就被主图
            // 的操作推着走：乘风采药里会直接飘到虚空瓦片上，风一停就坠落判失败。听感即
            // 「刚听到胜利音效，紧接着又响失败音效」（玩家反馈，2026-09-13）。
            this._resetInputForMiniGame();

            // 保存回调
            this.miniGameCallback = callback || null;

            // ===== 背景音乐：进小游戏 → 主图 BGM 立即停 =====
            // · 逆流送灯：开局立刻循环播放小游戏 BGM（结束由 handleMiniGameEnd 立刻停）；
            // · 乘风采药：不在这里起播 —— 只有起风时才循环播放（见 HerbCollectMiniGame._updateWind）；
            // · 认灯归魂等其余小游戏：没有背景音乐，保持静音。
            this.stopMainMapBgm();
            const minigameBgm = AudioManager.getMinigameBgmKey(gameId);
            if (this.audioManager && minigameBgm && gameId === 'boat_navigation') {
                this.audioManager.playBgm(minigameBgm);
            }

            // 准备启动参数与服务（一次算好，场景与管理器共用同一份）
            const miniGameParams = this.getMiniGameParams(gameId);
            const miniGameServices = this.getMiniGameServices();

            // 切换到小游戏场景
            this.sceneManager.switchScene('miniGame', {
                gameId: gameId,
                params: miniGameParams,
                services: miniGameServices,
            });

            // 启动小游戏（把主游戏准备好的参数与服务注入 —— 「启动」通信的唯一入口）
            this.miniGameManager.startMiniGame(gameId, miniGameParams, miniGameServices);
        },

        /**
         * 提供小游戏的启动参数（纯数据）
         *
         * 设计约定：小游戏本身不认识主游戏的任何状态；它需要的一切都由这里在「启动」时一次性喂给它。
         * 以 GameConfig.miniGames[gameId] 为默认值，再叠加当前剧情 / 玩家状态。
         * 后续新增玩法参数时：在 GameConfig.miniGames 里加字段 + 在这里叠加即可，
         * 不需要修改小游戏内部逻辑（也无需改其它调用方）。
         * @param {string} gameId
         * @returns {Object} 启动参数
         */
        getMiniGameParams(gameId) {
            const params = GameConfig.getInstance().getMiniGameConfig(gameId);

            // 叠加：把「当前玩家境界」这类随存档变化的数据注入小游戏（小游戏不反向读取玩家状态）
            if (this.player && this.player.playerData) {
                params.playerRealm = this.player.playerData.realm;
            }
            return params;
        },

        /**
         * 提供小游戏可用的服务适配器（资源 / 音频）
         *
         * 小游戏通过它取图 / 播音，而不必直接依赖 ResourceManager / gameAudio 单例 ——
         * 这样替换资源或音频实现时，小游戏代码无需改动。
         * @returns {Object} 服务适配器
         */
        getMiniGameServices() {
            const rm = this.resourceManager || ResourceManager.getInstance();
            return {
                getImage: (key) => rm.getCachedImage(key),
                loadImage: (key) => rm.loadImage(key),
                playBgm: (key) => { if (this.audioManager) this.audioManager.playBgm(key); else gameAudio.playBgm(key); },
                stopBgm: (key) => { if (this.audioManager) this.audioManager.stopBgm(key); else gameAudio.stopBgm(key); },
                playSfx: (key) => { if (this.audioManager) this.audioManager.playSfx(key); else gameAudio.playSfx(key); },
            };
        },

        /**
         * 进小游戏前的输入隔离（见 Main.startMiniGame）
         * - 清掉本帧瞬时键（刚按下还没消费的 E / WASD 不带进小游戏）
         * - 清掉「按住不放」的键（大地图按着的方向键不带进小游戏；必须重新按才生效）
         * 环境没提供对应方法时静默跳过（测试桩可能只有部分接口）。
         * @returns {number} 被放掉的「按住」键数量（便于调试 / 断言）
         */
        _resetInputForMiniGame() {
            if (!this.inputManager) return 0;
            if (typeof this.inputManager.clearFrameState === 'function') {
                this.inputManager.clearFrameState();
            }
            if (typeof this.inputManager.clearHeldKeys === 'function') {
                return this.inputManager.clearHeldKeys();
            }
            return 0;
        },

        /**
         * 小游戏结束处理
         * @param {Object} result - 小游戏结果
         */
        handleMiniGameEnd(result) {
            // ===== 背景音乐：小游戏结束 → 立刻停掉小游戏 BGM =====
            // （乘风采药：起风时播的那首同样在这里收尾；回到大地图后主图 BGM 走 10 秒延迟）
            if (this.audioManager) {
                this.audioManager.stopBgm(this._minigameBgmKeys());
            }

            // ===== E 键保护期：刚结算回主图的这 0.5 秒不响应世界交互 =====
            // 玩家结算那一刻通常还按着 E（采药 / 确认），浏览器会连发 keydown；若这一路
            // keydown 落到脚下的「采药点」路标上，就会立刻又开一局（见 MINI_GAME_EXIT_GUARD_SECONDS）。
            this._miniGameExitGuard = MINI_GAME_EXIT_GUARD_SECONDS;

            // 切换回之前的场景
            this.sceneManager.switchScene('gameWorld');

            // 恢复进入小游戏前的玩家大地图坐标
            if (this._savedPlayerX !== undefined) {
                this.player.position.x = this._savedPlayerX;
                this.player.position.y = this._savedPlayerY;
            }

            // 执行回调
            if (this.miniGameCallback) {
                this.miniGameCallback(result);
                this.miniGameCallback = null;
            }
        }

        /** 全部小游戏 BGM 键（用于「只停小游戏音乐」） */

});
