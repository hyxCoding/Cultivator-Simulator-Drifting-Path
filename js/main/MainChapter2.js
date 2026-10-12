/**
 * Main · 第二章专属流程
 * 第二章地图判定、NPC 位移 / 移除、章内阶段推进、江婆重逢与渡口登船。
 *
 * 由 js/Main.js 拆分而来，经原型混入挂回 Main（Object.assign(Main.prototype, {...})）：
 * 调用点仍写作 this.xxx()，行为与原单文件实现完全一致。
 */

Object.assign(Main.prototype, {

        /**
         * 当前地图是否属于第二章（云渡泽 / 万灯台）
         * @param {string} [mapId] - 缺省取当前地图
         * @returns {boolean}
         */
        isChapter2Map(mapId) {
            const id = mapId || (this.currentMap ? this.currentMap.mapId : null);
            if (!id) return false;
            if (window.Chapter2Config && typeof Chapter2Config.isChapter2Map === 'function') {
                return Chapter2Config.isChapter2Map(id);
            }
            return id === 'yunduze' || id === 'boss_arena_ch2';
        },

        /**
         * 是否为第一章的舞台地图（青岚浮野）
         * 判据：地图配置里的 chapter === 1，且不是战场地图
         * （boss_arena_ch1 的舞台由战场流程自己恢复，不归章节舞台管）。
         *
         * 参数可传 mapId（string）或地图实例（GameMap / 测试桩对象）：
         * Main.applyChapterEndStage 要在“刚切好图”的时机判断章节，此时优先读地图自己的
         * mapConfig.chapter，避免 mapId 还没登记时判错章节。
         *
         * @param {string|Object} [map] - 缺省取当前地图
         * @returns {boolean}
         */
        isChapter1Map(map) {
            const target = map || this.currentMap;
            if (!target) return false;

            const mapId = typeof target === 'string' ? target : (target.mapId || null);
            if (this.isArenaMap(mapId)) return false;

            const ownConfig = typeof target === 'string' ? null : (target.mapConfig || null);
            const config = ownConfig
                || ((mapId && this.gameConfig && typeof this.gameConfig.getMap === 'function')
                    ? this.gameConfig.getMap(mapId)
                    : null);
            return !!config && config.chapter === 1;
        },

        /**
         * 第二章各主线完成时的舞台推进（NPC 搬迁 / 状态推进 / 门槛兜底）
         * @param {string} questId
         * @param {GameMap} [map] - 完成时的当前地图
         */
        handleChapter2QuestComplete(questId, map) {
            switch (questId) {
                case 'chapter2_main_1':
                    // 主线一交付：名册与摘页留存在阿禾处，站位不变
                    break;

                case 'chapter2_main_2':
                    // 主线二交付：两盏灯的身份已确认（归魂要等主线三护送完成）
                    this.setStoryFlag('chapter2_lamps_identified');
                    break;

                case 'chapter2_main_3':
                    // 主线三交付：历练已足 → 筑基圆满（主线四的门槛要求）
                    this.ensureFoundationPerfect();
                    // 归魂完成后阿禾移到右侧救助院
                    this.moveChapter2NPC('ahe', { x: 2500, y: 980 });
                    this.moveChapter2NPC('jiangpo', { x: 2338, y: 989 });
                    break;

                case 'chapter2_main_4':
                    // 主线四交付：许录把原册搬到救助院登记点
                    this.repositionChapter2AfterBoss();
                    break;

                case 'chapter2_ending_1':
                    // 结丹完成：阿禾与陆舟移到中央泊位，准备登船
                    this.moveChapter2NPC('ahe', { x: 555, y: 1400 });
                    this.moveChapter2NPC('luzhou', { x: 700, y: 1320 });
                    this.moveChapter2NPC('xulu', { x: 2671, y: 1126 });
                    break;

                case 'chapter2_ending_2':
                    // 第二章完成：陈栎随返乡船回青岚（云渡泽不再留重复实体）
                    this.setStoryFlag('chapter2_complete');
                    this.removeChapter2NPC('chenli');
                    break;
                default:
                    break;
            }
        },

        /**
         * 云渡泽地图实例（未加载时返回 null）
         * @returns {GameMap|null}
         */
        getChapter2Map() {
            if (!this.mapManager || !this.mapManager.getMap) return null;
            return this.mapManager.getMap('yunduze');
        },

        /**
         * 搬迁云渡泽上的 NPC（世界坐标，像素）
         * @param {string} npcId
         * @param {Object} worldPosition - {x, y}
         * @returns {boolean}
         */
        moveChapter2NPC(npcId, worldPosition) {
            const map = this.getChapter2Map();
            if (!map || !map.npcs || !worldPosition) return false;
            const npc = map.npcs.get(npcId);
            if (!npc || typeof npc.repositionWorld !== 'function') return false;

            npc.repositionWorld(worldPosition.x, worldPosition.y, map);
            return true;
        },

        /**
         * 从云渡泽移除一个 NPC（如陈栎随返乡船回青岚）
         * @param {string} npcId
         * @returns {boolean}
         */
        removeChapter2NPC(npcId) {
            const map = this.getChapter2Map();
            if (!map || !map.npcs || !map.npcs.has(npcId)) return false;
            map.removeNPC(npcId);
            Logger.log(`[Main] ${npcId} 已离开云渡泽`);
            return true;
        },

        /**
         * 江婆 idle 立绘切换：女儿江晚获救前 / 后各一张单帧 32×64（Chapter2Config.npc.jiangpo）
         * - 获救前：baseAnimations.idle（资源 npc.jiangpo_idle）
         * - 获救后：extraAnimations.idle_after（资源 npc.jiangpo_idle_after）
         *
         * 判据只有一个 —— 主线三「完成逆流行舟护送」目标（complete_minigame / boat_navigation）是否完成；
         * 演出结束（completeSoulReturn）与读档重进地图（applyChapter2Stage）都走这里，
         * 保证存档前后立绘一致。切到 idle_after 后锁 animationOverridden，
         * 否则 NPC.updateAnimation 每帧都会把动画切回普通 idle。
         * @param {boolean} reunited - true = 女儿已获救
         * @param {number} [attempt] - 内部用：资源异步加载时的重试次数
         * @returns {boolean} 是否成功应用
         */
        setJiangpoReunitedIdle(reunited, attempt = 0) {
            const map = this.getChapter2Map();
            const jiangpo = (map && map.npcs) ? map.npcs.get('jiangpo') : null;
            if (!jiangpo || !jiangpo.animationManager || typeof jiangpo.setAnimation !== 'function') return false;

            if (reunited) {
                // 动画资源是异步加载的（NPC.loadAnimations）：刚进地图时 idle_after 可能还没就绪
                if (!jiangpo.animationManager.hasAnimation('idle_after')) {
                    if (attempt < 20 && !this.chapter2JiangpoIdleTimer) {
                        // 重试改为 deltaTime 驱动（见 updateChapter2IdleRetry），不再用 setTimeout
                        this.chapter2JiangpoIdleTimer = { timer: 0.1, attempt: attempt + 1 };
                    }
                    return false;
                }
                if (jiangpo.animationManager.currentAnimationName === 'idle_after') return true;   // 已就位
                jiangpo.animationOverridden = true;      // 锁定：不让 updateAnimation 覆盖
                jiangpo.setAnimation('idle_after', { loop: true });
                jiangpo.setNpcState('daughter_rescued', true);
                return true;
            }

            jiangpo.animationOverridden = false;
            if (typeof jiangpo.setIdleAnimation === 'function') jiangpo.setIdleAnimation();
            jiangpo.setNpcState('daughter_rescued', false);
            return true;
        },

        /**
         * 推进江婆「获救后」立绘的延迟重试。
         * NPC 动画是异步加载的，刚进地图时 `idle_after` 可能还没就绪 —— 这里每 0.1 秒重试一次，
         * 最多 20 次。替代原来的 setTimeout（定时器与暂停 / 帧率脱钩）。
         * @param {number} deltaTime - 时间增量（秒）
         */
        updateChapter2IdleRetry(deltaTime) {
            const retry = this.chapter2JiangpoIdleTimer;
            if (!retry) return;

            retry.timer -= deltaTime;
            if (retry.timer > 0) return;

            const attempt = retry.attempt;
            this.chapter2JiangpoIdleTimer = null;
            this.setJiangpoReunitedIdle(true, attempt);
        },

        /**
         * Boss 战后的云渡泽站位：
         *   许录 → 救助院登记点；江婆 / 江晚 → 救助院；阿禾 → 救助院
         * （JSON npc_persistence：Boss 胜利后可移至右院登记点）
         */
        repositionChapter2AfterBoss() {
            this.moveChapter2NPC('xulu', { x: 2671, y: 1126 });
            this.moveChapter2NPC('jiangpo', { x: 2338, y: 989 });
            this.moveChapter2NPC('ahe', { x: 2500, y: 980 });
        },

        /**
         * 进入第二章地图时恢复舞台状态（读档 / 反复进出图保持一致）
         * - 首次进入云渡泽：播 S01 开场旁白，并记录已播放
         * - 归魂演出之前：江晚 / 陈栎不出现在救助院（从地图中摘除，触发时再放回）
         * - 按任务进度恢复 NPC 站位
         * - 同步世界地图各区域的解锁状态
         * @param {GameMap} gameMap
         */
        applyChapter2Stage(gameMap) {
            const map = gameMap || this.currentMap;
            if (!map) return;
            this.updateWorldMapUnlocks();
            if (!this.isChapter2Map(map.mapId)) return;
            if (!this.player || !this.player.questSystem) return;

            const qs = this.player.questSystem;

            // ---- 逆流行舟护送完成（归魂）之前：江晚 / 陈栎不在场上 ----
            if (map.mapId === 'yunduze' && map.npcs) {
                const released = typeof qs.isObjectiveCompleted === 'function'
                    && qs.isObjectiveCompleted('chapter2_main_3', 'complete_minigame', 'boat_navigation');
                ['jiangwan', 'chenli'].forEach(npcId => {
                    if (!released) {
                        const npc = map.npcs.get(npcId);
                        if (npc) {
                            // 暂存引用，归魂演出时再放回地图
                            this.chapter2DormantNPCs[npcId] = npc;
                            map.removeNPC(npcId);
                        }
                    } else if (!map.npcs.has(npcId) && this.chapter2DormantNPCs[npcId]) {
                        map.addNPC(npcId, this.chapter2DormantNPCs[npcId]);
                    }
                });

                // 江婆立绘：与上面同一个判据 —— 女儿归魂前 / 后各一张 32×64 单帧图
                // （逆流行舟护送成功 → complete_minigame boat_navigation 完成 → 切 idle_after）
                this.setJiangpoReunitedIdle(released);
            }

            // ---- 第二章完成后：陈栎已随返乡船回青岚 ----
            if (map.mapId === 'yunduze' && qs.hasStoryFlag && qs.hasStoryFlag('chapter2_complete')) {
                this.removeChapter2NPC('chenli');
            }

            // ---- 按任务进度恢复站位 ----
            if (map.mapId === 'yunduze') {
                if (qs.isQuestCompleted && qs.isQuestCompleted('chapter2_main_3')) {
                    this.moveChapter2NPC('ahe', { x: 2500, y: 980 });
                    this.moveChapter2NPC('jiangpo', { x: 2338, y: 989 });
                }
                if (qs.hasStoryFlag && qs.hasStoryFlag('due_boss_defeated')) {
                    this.repositionChapter2AfterBoss();
                }
                if (qs.isQuestCompleted && qs.isQuestCompleted('chapter2_ending_1')) {
                    this.moveChapter2NPC('ahe', { x: 555, y: 1400 });
                    this.moveChapter2NPC('luzhou', { x: 700, y: 1320 });
                }
            }

            // ---- 首次进入云渡泽：开场旁白（S01）----
            if (map.mapId === 'yunduze'
                && qs.hasStoryFlag && !qs.hasStoryFlag('chapter2_intro_done')
                && qs.isQuestCompleted && qs.isQuestCompleted('chapter1_ending_3')) {
                this.setStoryFlag('chapter2_intro_done');
                this.playStoryDialogue('s01_opening', '旁白: ');
            }
        },

        /**
         * 同步世界地图区域按钮的解锁状态
         * - 青岚浮野（第一章）：常开
         * - 云渡泽（第二章）：调试期常开（debugUnlockAllWorldMapButtons === true）；
         *   置 false 即恢复原逻辑 —— 需剧情标记 yunduze_unlocked / chapter1_farewell_done
         *   （第一章筑基结束后写入）
         */
        updateWorldMapUnlocks() {
            if (!this.mapTeleport || typeof this.mapTeleport.setButtonEnabled !== 'function') return;

            // 第一章：世界地图上的起点，始终可点
            this.mapTeleport.setButtonEnabled('btn_qinglan', true);

            const forceUnlock = this.debugUnlockAllWorldMapButtons !== false;
            const qs = this.player ? this.player.questSystem : null;
            const hasFlag = (flag) => !!(qs && typeof qs.hasStoryFlag === 'function' && qs.hasStoryFlag(flag));
            const yunduzeUnlocked = forceUnlock
                || hasFlag('yunduze_unlocked') || hasFlag('chapter1_farewell_done');
            this.mapTeleport.setButtonEnabled('btn_yunduze', yunduzeUnlocked);
        },

        /**
         * 确保章末「登船」路标存在（主线《行舟有归处》进行中且已与阿禾交接后可见）
         * 数据源：Chapter2Config → maps.yunduze.chapterEnd.departSignpost（世界坐标 587,1327）
         * @returns {Signpost|null}
         */
        ensureChapter2BoatSignpost() {
            const map = this.getChapter2Map();
            if (!map || !map.signposts || typeof Signpost !== 'function') return null;

            const chapterEnd = (map.mapConfig && map.mapConfig.chapterEnd) || {};
            const config = chapterEnd.departSignpost || {};
            const id = config.id || 'signpost_zhaochen_boat';

            const existed = map.signposts.get(id);
            if (existed) return existed;

            const signpost = new Signpost({
                id: id,
                name: config.name || '登船',
                position: config.position || { x: 587, y: 1327 },
                radius: config.radius || 56,
                promptText: config.promptText || '登船前往照尘仙城',
                image: config.image || null,
                imageWidth: config.imageWidth || null,
                imageHeight: config.imageHeight || null,
                questRequired: config.questRequired || 'chapter2_ending_2',
                requireObjective: config.requireObjective || { type: 'talk_to', target: 'ahe' },
                oneShot: false,
                onActivate: () => this.boardZhaochenBoat(),
            });

            map.signposts.set(signpost.id, signpost);
            if (this.player && this.player.questSystem) {
                signpost.updateQuestGate(this.player.questSystem);
            }
            Logger.log(`[Main] 中央泊位登船路标已生成 (${signpost.position.x}, ${signpost.position.y})`);
            return signpost;
        },

        /**
         * 泊位登船（中央泊位 · 章末二）
         * - 首次：播放 S02 确认 → 结算《行舟有归处》 →（第三章未开放）播放 S03 → 进入游戏完结界面
         * - 已经看过完结界面：不再重播对白与字幕，直接打开世界地图界面
         */
        boardZhaochenBoat() {
            if (this.chapter2Boarding) return;

            // 已播放过完结字幕 → 直接显示世界地图界面（泊位可重复乘船，不丢进度）
            if (this.hasStoryFlag(this.gameEndingSeenFlag)) {
                this.openWorldMapFromBerth();
                return;
            }

            this.chapter2Boarding = true;
            this.addGameNotification('船已备好');
            this.playDialogueText(this.getChapter2StoryText('s02_berth'), '陆舟: ', () => this.sailToZhaochen());
        },

        /**
         * 完结之后再登船：直接打开世界地图界面（九州总图）
         */
        openWorldMapFromBerth() {
            Logger.log('[Main] 完结后续登船：直接打开世界地图');
            this.addGameNotification('航路已开 —— 九州总图');
            if (this.mapTeleport && !this.mapTeleport.isVisible) {
                this.mapTeleport.show();
            }
        },

        /**
         * 进入游戏完结界面（滚动字幕，js/EndingScene.js）
         * 由 sailToZhaochen 在结算完《行舟有归处》后调用；玩家在完结界面按任意键退出
         * 时才写入 game_ending_seen 标记并回到世界地图（见 finishGameEnding）
         * @returns {boolean} 是否成功切到完结界面
         */
        startGameEnding() {
            if (!this.sceneManager || typeof this.sceneManager.switchScene !== 'function') return false;
            Logger.log('[Main] 登船后进入游戏完结界面（滚动字幕）');
            this.sceneManager.switchScene('ending');
            return true;
        },

        /**
         * 退出游戏完结界面：记标记 + 打开世界地图 + 切回游戏世界场景
         * （EndingScene 在玩家于提示后按任意键 / 鼠标任意键时调用）
         */
        finishGameEnding() {
            this.setStoryFlag(this.gameEndingSeenFlag);
            this.chapter2Boarding = false;
            Logger.log('[Main] 完结界面结束，返回世界地图');
            if (this.mapTeleport && !this.mapTeleport.isVisible) {
                this.mapTeleport.show();
            }
            if (this.sceneManager && typeof this.sceneManager.switchScene === 'function') {
                this.sceneManager.switchScene('gameWorld');
            }
        },

        /**
         * 登船：结算章末任务并开启世界地图（第一章结束）
         */
        boardShipAndOpenWorldMap() {
            Logger.log('[Main] 登船离开青岚浮野');

            if (this.player && this.player.questSystem) {
                // 推进“登船离开”目标（完成后 chapter1_ending_3《登船辞行》完结）
                this.player.questSystem.updateQuestProgress('chapter1_ending_3', 'board_boat', 'depart_boat', 1);
            }
            this.setStoryFlag('chapter1_complete');
            this.addGameNotification('第一章 完 —— 云渡泽');

            // 切到世界地图（原 M 键打开世界地图的逻辑已移除，只在此剧情节点开启）
            if (this.mapTeleport && !this.mapTeleport.isVisible) {
                this.mapTeleport.show();
            }
        },

        /**
         * 按剧情标记恢复章末的舞台状态（重新进图 / 读档后保持一致）
         * - chapter1_ending_1 完成 → 阿禾迁到码头告别位
         * - chapter1_farewell_done 已记录 → 补生成永久登船路标
         *
         * ⚠ 只作用于**第一章舞台图（青岚浮野）**：这里恢复的是第一章章末 ——
         *   阿禾站位取自第一章的 chapterEnd.aheQuayTile（81,44），路标也要用第一章的
         *   chapterEnd.departSignpost（2566,1419）与 boardShipAndOpenWorldMap 回调。
         *   本方法由 switchToMap / loadInitialMap 对**每一张地图**调用，
         *   对其它章节地图直接执行会产生两个真机 bug（加这道判断就是为了修它们）：
         *     ① 阿禾被挪到第一章码头瓦片 —— 刚进云渡泽她还站在第一章的位置；
         *     ② 用该图的 chapterEnd.departSignpost 生成一个**无任务门控**的第一章登船路标 ——
         *        进入云渡泽就冒出「登船前往照尘仙城」，且按 E 走的是第一章的登船逻辑。
         *   第二章泊位的「登船」路标一律由 Main.ensureChapter2BoatSignpost 在
         *   《行舟有归处》任务门控下生成。
         *
         * @param {GameMap} gameMap - 地图实例
         */
        applyChapterEndStage(gameMap) {
            const map = gameMap || this.currentMap;
            if (!map || !this.player || !this.player.questSystem) return;
            if (!this.isChapter1Map(map)) return;
            const qs = this.player.questSystem;

            if (typeof qs.isQuestCompleted === 'function' && qs.isQuestCompleted('chapter1_ending_1')) {
                const ahe = map.npcs ? map.npcs.get('ahe') : null;
                const chapterEnd = (map.mapConfig && map.mapConfig.chapterEnd) || {};
                const quayTile = chapterEnd.aheQuayTile || { x: 81, y: 44 };
                if (ahe && ahe.reposition) {
                    ahe.reposition(quayTile.x, quayTile.y, map);
                }
            }

            if (typeof qs.hasStoryFlag === 'function' && qs.hasStoryFlag('chapter1_farewell_done')) {
                this.createDepartSignpost(map);
            }
        }

});
