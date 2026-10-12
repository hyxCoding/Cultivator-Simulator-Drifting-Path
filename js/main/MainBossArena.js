/**
 * Main · Boss 战场流程
 * 进场 / 控制锁 / 战败成长 / 击败判定 / 出口与传送法阵门控 / 回合制战斗驱动。
 *
 * 由 js/Main.js 拆分而来，经原型混入挂回 Main（Object.assign(Main.prototype, {...})）：
 * 调用点仍写作 this.xxx()，行为与原单文件实现完全一致。
 */

Object.assign(Main.prototype, {

        /**
         * 进入战场（第一章《山口不止风》摄风山魈 / 第二章《万灯渡口》渡厄使共用本流程）
         * - 记录法阵位置作为返回点（战败后落回法阵旁；胜利后由战场内归途法阵回到这里）
         * - 玩家数据（气血、灵力、速度、伤害、技能等）随同一个 Player 实例进入战场，不做重置
         * - Boss 只生成一次：已被击败过（剧情标记）则不再生成，并保证地图正中心的归途法阵存在
         * - 战场参数（击败标记 / 胜利推进的目标 / 资源分组 / 返回地图）来自传送法阵配置，
         *   缺省时回落到第一章的默认值
         * @param {TeleportArray} teleportArray - 战场入口法阵
         */
        async enterBossArena(teleportArray) {
            if (!this.player || !teleportArray) return;

            // 进场即清掉上一次「打赢 Boss 的胜利音效」待播标记：
            // 只有这一次真的打赢 Boss 并从归途法阵回原位置时才补播（见 triggerTeleport）
            this.pendingBossVictorySound = false;

            const arenaMapId = teleportArray.targetMapId || this.bossArenaMapId;
            const dropPoint = this.getBossArenaReturnPoint(teleportArray);
            this.bossArenaReturn = dropPoint;
            this.activeArena = {
                mapId: arenaMapId,
                defeatFlag: teleportArray.arenaDefeatFlag || this.bossArenaDefeatedFlag,
                victory: teleportArray.arenaVictory || {
                    questId: 'chapter1_main_4', type: 'defeat_boss', target: 'boss_shanxiao',
                },
                resourceGroup: teleportArray.arenaResourceGroup || 'bossArena',
                returnMapId: teleportArray.arenaReturnMapId || 'qinglan_fuye',
                // 战败成长参数（来自战场传送法阵配置）：每次战败提升的上限与次数上限
                defeatBonus: teleportArray.arenaDefeatBonus || null,
                returnPoint: dropPoint,
            };

            this.player.isInteracting = true;
            this.inputManager.setMovementBlocked(true);

            try {
                const arenaMap = await this.switchToMap(arenaMapId, teleportArray.targetPosition);
                if (!arenaMap) return;

                // 预加载 Boss 精灵图（上次战斗结束时已释放，避免第二次进场出现空帧）
                await this.preloadBossArenaImages(this.activeArena.resourceGroup);

                // Boss 就位：只在"尚未被击败"时生成（击败过则整场不再出现）
                // 击败判据见 isArenaBossAlreadyDefeated：战场击败标记已写入，
                // 或该战场的「击败 Boss」目标已经完成 —— 两条都算赢过；因此不论隔多久
                // 再进场（换了入口、读档重进也一样），渡厄使都不会重新生成。
                const defeated = this.isArenaBossAlreadyDefeated(this.activeArena);
                if (arenaMap.setArenaBossDefeated) {
                    arenaMap.setArenaBossDefeated(defeated);
                }
                if (defeated) {
                    // 永久归途法阵：地图正中心，落点＝进场时的"原来位置"
                    this.ensureBossArenaExitArray(arenaMap);
                } else {
                    // 第二章：先播战前对白（B01），对白读完再开战（此时才生成 Boss）
                    if (this.isChapter2Map(arenaMapId) && !this.hasStoryFlag('chapter2_b01_seen')) {
                        this.setStoryFlag('chapter2_b01_seen');
                        // 对白期间渡厄使不上场：地图载入时已随 bossPosition 生成的实体先撤下，
                        // 同时给地图挂上入场冻结（双保险）—— 保证读对白时它不移动、不出手，
                        // 因为此时玩家被锁输入，无法走位躲避。对白读完 startArenaFight 再生成并解冻。
                        if (typeof arenaMap.setArenaIntroLock === 'function') {
                            arenaMap.setArenaIntroLock(true);
                        }
                        if (typeof arenaMap.detachArenaBoss === 'function') {
                            arenaMap.detachArenaBoss();
                        }
                        this.playStoryDialogue('b01_encounter', '渡厄使: ', () => this.startArenaFight(arenaMap));
                    } else {
                        this.startArenaFight(arenaMap);
                    }
                }

                // 新一场战斗：允许本次胜利结算（记标记 / 开法阵）
                this.bossArenaVictoryHandled = false;

                Logger.log(`[Boss战场] 进入 ${arenaMap.name}（返回点 ${Math.round(dropPoint.x)}, ${Math.round(dropPoint.y)}）`);
                this.addGameNotification(`进入${arenaMap.name}`);
            } finally {
                this.player.isInteracting = false;
                this.inputManager.setMovementBlocked(false);
            }
        },

        /**
         * 正式开战：解除入场冻结、生成战场 Boss、设置目标与招式回调
         * （第二章渡厄使另有召唤小兵 / 控制命中 / 低气血短字幕回调）
         * @param {GameMap} arenaMap - 战场地图实例
         */
        startArenaFight(arenaMap) {
            const map = arenaMap || this.currentMap;
            if (!map || !map.ensureArenaBoss) return null;

            // 战前对白已经读完：先解除入场冻结，再生成 / 接管渡厄使（对白期间它被撤下或冻结）
            if (typeof map.setArenaIntroLock === 'function') {
                map.setArenaIntroLock(false);
            }

            const boss = map.ensureArenaBoss();
            if (!boss) return null;

            // 通用 Boss（含渡厄使）需要手动设置目标与攻击手势回调
            if (typeof boss.setTarget === 'function' && this.player) {
                boss.setTarget(this.player);
            }
            boss.map = map;

            // 第二章：渡厄使招式回调（召唤小兵 / 控制命中 → 短字幕 + 禁键）
            if (typeof boss.startFight === 'function') {
                boss.onSummon = (dueBoss, minion) => {
                    this.showSubtitle(this.getChapter2StoryText('subtitle_summon'), 5);
                };
                boss.onControl = (dueBoss, lockDuration) => {
                    this.showSubtitle(this.getChapter2StoryText('subtitle_control'), 3.5);
                    this.startArenaControlLock(lockDuration);
                };
                boss.onLowHealth = () => {
                    this.showSubtitle(this.getChapter2StoryText('subtitle_low_hp'), 6);
                };
                if (!boss.fightStarted) {
                    this.showSubtitle(this.getChapter2StoryText('subtitle_retry'), 3.5);
                }
                boss.startFight();
            }

            return boss;
        },

        /**
         * 渡厄使「控制」命中：玩家头顶出现锁链图 + 禁止一切按键输入
         * - 锁链图由 PlayerCombat.attachControlChain 绘制（32×32，跟随玩家头顶）
         * - 输入封锁用 inputManager.setInputBlocked(true)，到时由
         *   updateBossArenaControlLock 解除（战场内死亡 / 离开战场也会兜底解除）
         * @param {number} [duration=3] - 禁键时长（秒）
         */
        startArenaControlLock(duration = 3) {
            const seconds = Math.max(0, duration || 0);
            this.arenaControlLockTimer = seconds;
            this.arenaControlLockActive = seconds > 0;

            if (seconds <= 0) return;

            if (this.inputManager) {
                this.inputManager.setInputBlocked(true);
                this.inputManager.setMovementBlocked(true);
            }
            if (this.playerCombat && typeof this.playerCombat.attachControlChain === 'function') {
                this.playerCombat.attachControlChain(seconds);
            }

            Logger.log(`[Boss战场] 渡厄使控制命中：禁止按键 ${seconds} 秒`);
        },

        /**
         * 推进「控制」禁键计时（每帧由 updateGameWorld 调用；到时自动解除）
         * @param {number} deltaTime
         */
        updateBossArenaControlLock(deltaTime) {
            if (!this.arenaControlLockActive) return;

            this.arenaControlLockTimer -= deltaTime;
            if (this.arenaControlLockTimer > 0) return;

            this.releaseArenaControlLock();
        }

        /** 解除「控制」禁键（到时 / 玩家阵亡 / 离场时调用） */,

        releaseArenaControlLock() {
            if (!this.arenaControlLockActive) return;

            this.arenaControlLockActive = false;
            this.arenaControlLockTimer = 0;

            if (this.inputManager) {
                this.inputManager.setInputBlocked(false);

                // 若此刻正在播剧情对白（例如击杀瞬间的 B04），移动继续保持封住，
                // 交给对白结束流程解锁；否则直接解锁移动
                const dialogueOpen = !!(this.dialogBox && this.dialogBox.isVisible);
                this.inputManager.setMovementBlocked(dialogueOpen);
            }
            if (this.playerCombat && typeof this.playerCombat.stopControlChain === 'function') {
                this.playerCombat.stopControlChain();
            }

            Logger.log('[Boss战场] 渡厄使控制结束，恢复按键输入');
        },

        /**
         * 预加载战场 Boss 相关精灵图（进场时调用）
         * 资源键统一维护在 ResourceManager.resourceGroups.<分组名>（单一数据源）：
         *   第一章 'bossArena'（摄风山魈）/ 第二章 'bossArenaCh2'（渡厄使）
         * Boss.destroy() 会释放这些图片缓存，因此再次进场需要重新加载
         * @param {string} [resourceGroup='bossArena'] - 资源分组名
         */
        async preloadBossArenaImages(resourceGroup = 'bossArena') {
            if (!this.resourceManager) return;

            // 优先走资源分组：键列表只在 ResourceManager 里维护一份
            if (typeof this.resourceManager.preloadResourceGroup === 'function') {
                await this.resourceManager.preloadResourceGroup(resourceGroup);
                return;
            }

            // 兜底：不支持资源分组的旧版 ResourceManager（仅第一章 Boss）
            if (!this.resourceManager.loadImages) return;
            await this.resourceManager.loadImages([
                'monsters.boss_shanxiao_idle',
                'monsters.boss_shanxiao_walk',
                'monsters.boss_shanxiao_attack',
                'monsters.boss_shanxiao_skill1',
                'monsters.boss_shanxiao_skill2',
                'monsters.boss_shanxiao_hurt',
                'monsters.boss_shanxiao_dead',
                'monsters.boss_due_idle',
                'monsters.boss_due_move',
                'monsters.boss_due_dash',
                'monsters.boss_due_summon',
                'monsters.boss_due_control',
                'monsters.boss_due_hurt',
                'monsters.boss_due_dead',
                'monsters.boss_due_minion_idle',
                'monsters.boss_due_minion_move',
                'monsters.boss_due_minion_attack',
                'effects.boss_due_chain',
                'effects.boss_pounce_dust',
                'effects.boss_charge_wind',
            ]);
        },

        /**
         * 清理战场：删除 Boss 实体并释放其资源（战败离场时调用）
         * @returns {boolean} 是否执行了清理
         */
        clearBossArenaResources() {
            const arenaMapId = (this.activeArena && this.activeArena.mapId) || this.bossArenaMapId;
            const arenaMap = this.mapManager && this.mapManager.getMap
                ? this.mapManager.getMap(arenaMapId)
                : null;

            if (!arenaMap || !arenaMap.clearArenaBoss) {
                return false;
            }

            return arenaMap.clearArenaBoss();
        },

        /**
         * Boss 战败成长：每个战场每次战败都会提升气血 / 灵息上限
         * - 参数来源：战场传送法阵配置 arenaDefeatBonus { id, maxHealth, maxMana, maxFailures }
         *     第一章摄风山魈：气血上限 +20 / 灵息上限 +10，最多结算 5 次
         *     第二章渡厄使  ：气血上限 +35 / 灵息上限 +20，最多结算 5 次
         * - 战败次数（PlayerData.bossFailures）与累计加成（maxHealthBonus / maxManaBonus）随存档保存；
         *   境界切换时由 Main.applyPermanentStatBonus 把累计加成叠加在境界基准值之上；
         * - 达到 maxFailures 后不再提升（只写 console 日志，不再发通知）。
         * @param {Object} [arena] - 战场参数（缺省用 this.activeArena）
         * @returns {boolean} 本次是否实际提升了上限
         */
        applyBossFailureBonus(arena) {
            const info = arena || this.activeArena;
            if (!this.player || !this.player.playerData || !info) return false;

            const bonus = info.defeatBonus;
            if (!bonus) return false;

            const bonusHealth = bonus.maxHealth || 0;
            const bonusMana = bonus.maxMana || 0;
            if (bonusHealth <= 0 && bonusMana <= 0) return false;

            const maxFailures = bonus.maxFailures > 0 ? bonus.maxFailures : 5;
            const key = bonus.id || info.defeatFlag || info.mapId || 'boss';

            const data = this.player.playerData;
            if (!data.bossFailures) data.bossFailures = {};

            const times = data.bossFailures[key] || 0;
            if (times >= maxFailures) {
                Logger.log(`[Boss战场] ${key} 战败成长已达上限（${maxFailures} 次），本次不再提升上限`);
                return false;
            }

            data.bossFailures[key] = times + 1;
            data.maxHealthBonus = (data.maxHealthBonus || 0) + bonusHealth;
            data.maxManaBonus = (data.maxManaBonus || 0) + bonusMana;
            data.maxHealth += bonusHealth;
            data.maxMana += bonusMana;
            data.health = Math.min(data.maxHealth, data.health + bonusHealth);
            data.mana = Math.min(data.maxMana, data.mana + bonusMana);

            Logger.log(`[Boss战场] 第 ${times + 1}/${maxFailures} 次战败：气血上限 +${bonusHealth}、灵息上限 +${bonusMana}`);
            this.addGameNotification(`屡败屡进：气血上限 +${bonusHealth}，灵息上限 +${bonusMana}（${times + 1}/${maxFailures}）`);
            return true;
        },

        /**
         * 战败后回到法阵旁
         * - 复活并落回法阵旁，不发放战利品
         * - 战败成长：先按战场配置提升上限（见 applyBossFailureBonus），再由 revive 按新上限回满
         * - 战败清场：清掉自身的技能效果（闪避加速 / 护身术减伤）与全部技能冷却
         *   （PlayerCombatSystem.resetOnDeath，第十三次改动）
         * - 胜利不再走这里：Boss 伏诛后由 handleBossArenaVictory 在战场正中心开启永久归途法阵，
         *   玩家自行按 E 返回原来位置（回归后的 switchToMap 会依任务目标补生成战利品）
         * @returns {Promise<boolean>} 是否成功返回
         */
        async returnFromBossArena() {
            if (!this.player || this.isReturningFromBossArena) return false;

            // 被 Boss 打败（战场内阵亡）→ 播一次失败音效；同时清掉可能残留的胜利待播标记
            this.pendingBossVictorySound = false;
            this.playSfx('sfx.defeat');

            // 战败清场（第十三次改动，2026-09-13）：清掉自身的技能效果（闪避的加速、护身术的减伤）
            // 并把所有技能冷却清 0 —— 复活后是干净的上场状态，不会带着上一轮的增益 / 冷却重打。
            // 见 PlayerCombatSystem.resetOnDeath（顺带清受伤僵直与施法残留）。
            if (this.playerCombat && typeof this.playerCombat.resetOnDeath === 'function') {
                this.playerCombat.resetOnDeath();
            }

            // 离开战场：兜底解除「控制」禁键（正常情况计时已到）
            this.releaseArenaControlLock();

            const dropPoint = this.bossArenaReturn || this.getBossArenaReturnPoint();
            const mapId = dropPoint.mapId || 'qinglan_fuye';

            this.isReturningFromBossArena = true;
            try {
                const backMap = await this.switchToMap(mapId, { x: dropPoint.x, y: dropPoint.y });
                if (!backMap) return false;

                // 清理战场：删除战场 Boss 并释放其资源（再次进场会重新生成，直到它被击败）
                this.clearBossArenaResources();

                // 战败成长：先提升上限（前 5 次），再由 revive 按新上限回满
                this.applyBossFailureBonus();

                // 落回法阵旁后复活（气血/灵力恢复，短暂无敌）
                if (!this.player.isAlive && this.player.revive) {
                    this.player.revive({ x: dropPoint.x, y: dropPoint.y });
                }

                Logger.log('[Boss战场] 玩家战败，已回到法阵旁');
                this.addGameNotification('被击退，回到法阵旁');
                // 第二章：按 JSON B05 给出战败提示（可调整后重新挑战）
                if (this.isChapter2Map(mapId)) {
                    this.showSubtitle(this.getChapter2StoryText('subtitle_death'), 5);
                }

                return true;
            } finally {
                this.isReturningFromBossArena = false;
            }
        },

        /**
         * 战场 Boss 是否已被击败（按剧情标记判断；击败后战场不再生成 Boss）
         * @param {string} [flag] - 剧情标记名（缺省用第一章摄风山魈的标记）
         * @returns {boolean}
         */
        hasBossDefeated(flag) {
            const questSystem = this.player && this.player.questSystem;
            if (!questSystem || typeof questSystem.hasStoryFlag !== 'function') return false;
            return questSystem.hasStoryFlag(flag || this.bossArenaDefeatedFlag || 'boss_shanxiao_defeated');
        },

        /**
         * 兼容旧调用名：摄风山魈是否已被击败
         * @returns {boolean}
         */
        hasBossShanxiaoDefeated() {
            return this.hasBossDefeated(this.bossArenaDefeatedFlag || 'boss_shanxiao_defeated');
        },

        /**
         * 这场战斗的 Boss 是否已经打赢过（决定进场时还要不要生成）
         *
         * 判据（任一成立即算赢过 → 进场不再生成 Boss）：
         *   1) 战场击败标记已写入（handleBossArenaVictory → setStoryFlag(arena.defeatFlag)）；
         *   2) 该战场的「击败 Boss」任务目标已完成 —— 兼容「打赢了但标记没落盘」的情况
         *      （旧存档 / 曾经的调试通道击杀）。只凭标记判断时，这两种情况都会让
         *      Boss 在下次进场时复活 —— 现在只要赢过一次就不会再刷。
         * 命中第 2 条时顺手把标记补上（幂等），之后直接走第 1 条。
         *
         * 注意：战败退回不算赢过 → 两条都不成立，玩家可以再进战场重试。
         *
         * @param {Object} [arena] - 战场参数 { defeatFlag, victory }（缺省用 this.activeArena）
         * @returns {boolean}
         */
        isArenaBossAlreadyDefeated(arena) {
            const info = arena || this.activeArena;
            if (!info) return false;

            if (this.hasBossDefeated(info.defeatFlag)) return true;

            const questSystem = this.player && this.player.questSystem;
            const victory = info.victory;
            if (questSystem && victory && typeof questSystem.isObjectiveCompleted === 'function'
                && questSystem.isObjectiveCompleted(victory.questId, victory.type, victory.target)) {
                // 目标已完成 = 确实赢过 → 补记击败标记，此后进场直接走第 1 条
                this.setStoryFlag(info.defeatFlag);
                return true;
            }

            return false;
        }

        /**
         * 在战场地图正中心生成 / 刷新永久归途法阵
         * 目标落点＝进场时记录的"原来位置"（山口法阵旁）
         * @param {GameMap} [arenaMap] - 战场地图实例（缺省时从 MapManager 取）
         * @returns {TeleportArray|null}
         */,

        /**
         * 该传送法阵是否是战场「归途法阵」（打赢 Boss 后回原位置的出口）
         * @param {TeleportArray} teleportArray
         * @returns {boolean}
         */
        isBossArenaExitArray(teleportArray) {
            return !!(teleportArray && teleportArray.id === 'teleport_boss_exit');
        },

        ensureBossArenaExitArray(arenaMap) {
            const arenaMapId = (this.activeArena && this.activeArena.mapId) || this.bossArenaMapId;
            const map = arenaMap || (this.mapManager && this.mapManager.getMap
                ? this.mapManager.getMap(arenaMapId)
                : null);

            if (!map || typeof map.createArenaExitArray !== 'function') return null;

            const dropPoint = this.bossArenaReturn || this.getBossArenaReturnPoint();
            const targetMapId = dropPoint.mapId || 'qinglan_fuye';
            return map.createArenaExitArray({
                targetMapId: targetMapId,
                targetPosition: { x: dropPoint.x, y: dropPoint.y },
                promptText: this.isChapter2Map(targetMapId)
                    ? this.getChapter2ArenaConfig().exitPrompt
                    : '按 E 返回青岚浮野',
            });
        },

        /**
         * 战场 Boss 伏诛结算（战败动画播完后由 updateBossArenaBattle 调用，只执行一次）
         * 1) 记录剧情标记（第一章 boss_shanxiao_defeated / 第二章 due_boss_defeated）→ 之后进场不再生成 Boss
         * 2) 推进对应的「击败 Boss」任务目标
         * 3) 清理 Boss 实体（释放精灵图缓存）
         * 4) 在战场地图正中心开启永久归途法阵（按 E 回到原来位置）
         * 战利品在玩家用法阵回到主图时按任务目标补生成。
         * @param {GameMap} [arenaMap] - 战场地图实例
         */
        handleBossArenaVictory(arenaMap) {
            if (this.bossArenaVictoryHandled) return;

            const arena = this.activeArena || {
                mapId: this.bossArenaMapId,
                defeatFlag: this.bossArenaDefeatedFlag || 'boss_shanxiao_defeated',
                victory: { questId: 'chapter1_main_4', type: 'defeat_boss', target: 'boss_shanxiao' },
                returnMapId: 'qinglan_fuye',
            };

            const map = arenaMap || this.currentMap;
            if (!map || map.mapId !== arena.mapId) return;

            this.bossArenaVictoryHandled = true;

            // 胜利音效不在这里播：需求是「打赢 Boss 并通过传送门回到原来位置」才播，
            // 所以这里只挂起标记，等玩家走归途法阵回原位置时由 triggerTeleport 补播
            // （打赢后再进战场不会再生成 Boss，因此后续进场不会误播）
            this.pendingBossVictorySound = true;

            // 1) 剧情标记（读档 / 再次进场时据此不再生成 Boss）
            this.setStoryFlag(arena.defeatFlag);

            // 2) 推进主线「击败 Boss」目标
            if (this.player && this.player.questSystem && arena.victory) {
                this.player.questSystem.updateQuestProgress(
                    arena.victory.questId, arena.victory.type, arena.victory.target, 1
                );
            }

            // 3) 清理 Boss 实体（地图记住"已被击败"，之后 ensureArenaBoss 不再生成）
            if (typeof map.setArenaBossDefeated === 'function') {
                map.setArenaBossDefeated(true);
            } else {
                this.clearBossArenaResources();
            }

            // 4) 地图正中心开启永久归途法阵
            this.ensureBossArenaExitArray(map);

            const bossName = this.isChapter2Map(arena.mapId) ? '渡厄使' : '摄风山魈';
            Logger.log(`[Boss战场] ${bossName}已伏诛，战场中央已开启归途法阵`);
            this.addGameNotification(`${bossName}已伏诛，战场中央已开启归途法阵`);

            // 第二章：胜利演出（B04）+ 把救助院的 NPC 安排到战后状态
            if (this.isChapter2Map(arena.mapId)) {
                this.playStoryDialogue('b04_boss_win', '旁白: ');
                this.repositionChapter2AfterBoss();
            }
        },

        /**
         * 计算“法阵旁”的落点（世界坐标，像素）
         * 优先使用进场时记录的入口法阵位置；读档直接进入战场时回落到配置中的战场法阵。
         * @param {TeleportArray} [teleportArray] - 可选：直接指定法阵
         * @returns {{mapId: string, x: number, y: number}}
         */
        getBossArenaReturnPoint(teleportArray) {
            const OFFSET_Y = 88;    // 落在法阵下缘外侧，避免正好站在法阵中心

            // 返回地图：优先取法阵配置，其次取进场前所在的主图
            const returnMapId = (teleportArray && teleportArray.arenaReturnMapId)
                || (this.activeArena && this.activeArena.returnMapId)
                || (this.currentMap && this.currentMap.mapId && !this.isArenaMap(this.currentMap.mapId)
                    ? this.currentMap.mapId
                    : 'qinglan_fuye');

            const arrayPosition = teleportArray && teleportArray.position
                ? teleportArray.position
                : this.findBossArenaTeleportPosition(returnMapId);

            if (arrayPosition) {
                return {
                    mapId: returnMapId,
                    x: arrayPosition.x,
                    y: arrayPosition.y + OFFSET_Y,
                };
            }

            // 兜底一：第二章云渡泽石台法阵（Chapter2Config）
            if (this.isChapter2Map(returnMapId) && window.Chapter2Config) {
                const wandengtai = Chapter2Config.getMapConfigs().yunduze.teleporters.wandengtai;
                return {
                    mapId: returnMapId,
                    x: wandengtai.worldPosition.x,
                    y: wandengtai.worldPosition.y + OFFSET_Y,
                };
            }

            // 兜底二：与 Chapter1Config 中主线四法阵的世界坐标保持一致（2946, 231）
            return { mapId: returnMapId, x: 2946, y: 231 + OFFSET_Y };
        },

        /**
         * 在已加载的地图中查找战场入口法阵的位置（世界坐标）
         * @param {string} [mapId='qinglan_fuye'] - 入口法阵所在的地图
         * @returns {Object|null}
         */
        findBossArenaTeleportPosition(mapId = 'qinglan_fuye') {
            if (!this.mapManager || !this.mapManager.getMap) return null;
            const sourceMap = this.mapManager.getMap(mapId);
            if (!sourceMap || !sourceMap.teleporters) return null;
            for (const [, teleport] of sourceMap.teleporters) {
                if (teleport && teleport.bossArena && teleport.position) {
                    return teleport.position;
                }
            }
            return null;
        },

        /**
         * 遍历当前地图的所有传送法阵，根据任务状态控制可见性
         * （主线四的山口法阵在接取 chapter1_main_4 后才出现）
         * @param {GameMap} gameMap - 地图实例
         */
        updateTeleportQuestGates(gameMap) {
            const map = gameMap || this.currentMap;
            if (!map || !map.teleporters || !this.player || !this.player.questSystem) return;
            for (const [, teleport] of map.teleporters) {
                if (teleport && teleport.updateQuestGate) {
                    teleport.updateQuestGate(this.player.questSystem);
                }
            }
        },

        /**
         * 是否为战场地图（第一章摄风山魈战场 / 第二章万灯台）
         * @param {string} [mapId]
         * @returns {boolean}
         */
        isArenaMap(mapId) {
            const id = mapId || (this.currentMap ? this.currentMap.mapId : null);
            if (!id) return false;
            if (id === this.bossArenaMapId) return true;
            const chapter2Arena = window.Chapter2Config
                ? Chapter2Config.getArenaConfig().mapId
                : 'boss_arena_ch2';
            return id === chapter2Arena;
        },

        /**
         * 第二章战场（万灯台）参数
         * @returns {Object}
         */
        getChapter2ArenaConfig() {
            if (window.Chapter2Config) return Chapter2Config.getArenaConfig();
            return { mapId: 'boss_arena_ch2', exitPrompt: '按 E 返回云渡泽', deathSubtitle: '' };
        },

        /**
         * 开始怪物战斗
         * @param {Object} monster - 怪物实例
         */
        startMonsterBattle(monster) {
            if (!monster || !monster.isAlive) return;

            // 设置战斗类型
            const isBoss = monster instanceof Boss;
            const battleType = isBoss ? 
                BattleSystem.BattleType.ACTIVE : 
                BattleSystem.BattleType.ACTIVE;

            // 开始战斗
            this.battleSystem.startBattle({
                player: this.player,
                enemies: [monster],
                battleType: battleType,
            });

            // 切换到战斗场景
            this.sceneManager.switchScene('battle', {
                player: this.player,
                enemies: [monster],
                battleSystem: this.battleSystem,
            });
        },

        /**
         * 战场战斗流程（主线四《山口不止风》）
         * - Boss 伏诛（战败动画播完）→ 一次性结算：记剧情标记、推进任务目标、
         *   在战场正中心开启永久归途法阵（见 handleBossArenaVictory）
         * - 不再倒计时自动离场：玩家自行走到法阵按 E 返回原来位置
         * - 玩家阵亡由 updateGameWorld 末尾的死亡分支处理（立即送回）
         */
        updateBossArenaBattle() {
            const map = this.currentMap;
            const arenaMapId = (this.activeArena && this.activeArena.mapId) || this.bossArenaMapId;

            if (!map || map.mapId !== arenaMapId) {
                return;
            }

            const boss = map.arenaBoss;
            if (!boss) return;

            // Boss 仍存活 → 无需处理
            if (boss.isAlive) return;

            // 等战败动画播完再结算（让玩家看完倒地演出）
            if (boss.isDefeatSequenceFinished && !boss.isDefeatSequenceFinished()) {
                return;
            }

            this.handleBossArenaVictory(map);
        }

});
