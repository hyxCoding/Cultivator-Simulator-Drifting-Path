/**
 * Main · 成长与奖励结算
 * 任务奖励、境界属性、职业技能学习、永久加成、剧情旗标与各类试炼推进。
 *
 * 由 js/Main.js 拆分而来，经原型混入挂回 Main（Object.assign(Main.prototype, {...})）：
 * 调用点仍写作 this.xxx()，行为与原单文件实现完全一致。
 */

Object.assign(Main.prototype, {

        /**
         * 接取任务（带玩家可见的失败提示）—— 第一章 / 第二章共用的唯一接取入口
         *
         * 背景：QuestSystem.acceptQuest 只返回布尔值，前置未满足时仅打印 console 警告。
         * 玩家在对话里点了「接取」却什么都没发生（任务面板仍是「暂无任务」），
         * 只看得到“接了任务但面板没显示”。这里统一为：
         *   先问 QuestSystem.getAcceptStatus 拿原因 → 成功才接取 → 失败给屏幕通知。
         *
         * @param {string} questId - 任务ID
         * @returns {boolean} 是否接取成功
         */
        tryAcceptQuest(questId) {
            if (!questId) return false;
            const questSystem = this.player && this.player.questSystem;
            if (!questSystem) return false;

            if (typeof questSystem.getAcceptStatus === 'function') {
                const status = questSystem.getAcceptStatus(questId);
                if (!status.ok) {
                    console.warn(`[Main] 任务 ${questId} 接受失败：${status.reason}`);
                    this.addGameNotification(`无法接取任务：${status.reason}`);
                    return false;
                }
            }

            const success = questSystem.acceptQuest(questId);
            if (!success) {
                // 兜底（理论上 getAcceptStatus 已覆盖）：保持显式提示，不要再静默失败
                console.warn(`[Main] 任务 ${questId} 接受失败（前置条件未满足或已接受）`);
                this.addGameNotification('无法接取任务：条件未满足');
            }
            return success;
        },

        /**
         * 周叔获救后的落点（世界坐标，像素）
         * 单一数据源：Chapter1Config 中 zhoushu.moveWorldPositions.rescued（像素，优先）
         * 未配置时回落到 zhoushu.movePositions.rescued（瓦片）再换算
         * @param {GameMap} map - 当前地图实例（瓦片换算/兜底用，可省略）
         * @returns {Object} 世界坐标 {x, y}（像素）
         */
        getZhoushuRescuedWorldPosition(map) {
            const fallbackTile = { x: 71, y: 36 };
            const zhoushuConfig = (window.Chapter1Config && Chapter1Config.getNPCConfigs)
                ? (Chapter1Config.getNPCConfigs().zhoushu || {})
                : {};

            // 1）精确世界坐标（像素）
            const worldPos = zhoushuConfig.moveWorldPositions && zhoushuConfig.moveWorldPositions.rescued;
            if (worldPos) {
                return { x: worldPos.x, y: worldPos.y };
            }

            // 2）瓦片坐标 → 世界坐标
            const tilePos = (zhoushuConfig.movePositions && zhoushuConfig.movePositions.rescued) || fallbackTile;
            const currentMap = map || this.currentMap;
            if (currentMap && currentMap.tileToWorld) {
                return currentMap.tileToWorld(tilePos.x, tilePos.y);
            }
            return { x: tilePos.x * 32, y: tilePos.y * 32 };
        },

        /**
         * 处理基础训练开始
         * @param {NPC} npc - 训练导师 NPC
         */
        handleStartTraining(npc) {
            Logger.log('[Main] 开始基础训练');

            // 启动训练场景（在中央广场放置训练目标）
            if (this.trainingManager && !this.trainingManager.isActive) {
                this.trainingManager.startBasicTraining();
                this.addGameNotification('前往中央广场完成基础训练！');
            } else if (this.trainingManager && this.trainingManager.isActive) {
                this.addGameNotification('训练目标已放置，前往中央广场完成！');
            }
            // 注意：不在此处 endNPCInteraction，由 DialogueSystem.selectOption 中的对话结束逻辑自动处理
        },

        /**
         * 风桥护送：周叔过桥（主线三《散落的炊烟》）
         * - 玩家在周叔对话中选择"护送周叔过桥"后触发
         * - 前置门控：必须先询问柳婶（chapter1_main_3 的 talk_to liushen 完成 → rescue 成为当前待完成目标），
         *   否则不护送、不搬迁、不推进任务（防止“找祁伯接完任务就直接救回周叔”）
         * - 直接将周叔迁往获救后的地点（Chapter1Config: zhoushu.moveWorldPositions.rescued，世界坐标 2300,1160）
         * - 推进 chapter1_main_3 的 rescue/zhoushu 目标
         * @param {NPC} npc - 周叔 NPC（当前交互对象）
         */
        startWindBridgeRescue(npc) {
            const map = this.currentMap;
            if (!map || !map.npcs) return;

            const zhoushu = map.npcs.get('zhoushu') || npc;
            if (!zhoushu) return;

            // ===== 门控：必须先询问柳婶（main_3 的 talk_to liushen 完成 → rescue 才成为当前待完成目标）=====
            // 未满足时不护送、不搬迁、不推进任务，避免接完祁伯的任务就能跳过柳婶直接救人。
            const questSystem = this.player ? this.player.questSystem : null;
            if (questSystem && typeof questSystem.isObjectiveCurrent === 'function'
                && !questSystem.isObjectiveCurrent('chapter1_main_3', 'rescue', 'zhoushu')) {
                console.warn('[Main] 尚未询问柳婶周叔的去向，无法开始风桥护送');
                this.addGameNotification('先去问柳婶，才知道周叔的去向');
                return;
            }

            // 获救地点取自章节配置（与 Main.onQuestComplete(main_3) / move_zhoushu_to_village 共用同一数据源）
            const rescued = this.getZhoushuRescuedWorldPosition(map);

            if (zhoushu.repositionWorld) {
                zhoushu.repositionWorld(rescued.x, rescued.y, map);
                Logger.log(`[Main] 风桥护送完成，${zhoushu.name} 已迁往获救地点 (${Math.round(rescued.x)}, ${Math.round(rescued.y)})`);
            }

            // 推进"救回周叔"目标（门控保证此刻它正是 main_3 的当前待完成目标）
            if (this.player && this.player.questSystem) {
                this.player.questSystem.updateQuestProgress('chapter1_main_3', 'rescue', 'zhoushu', 1);
            }

            this.addGameNotification('周叔已安全过桥');
        },

        /**
         * 定息引气：阿禾为阿砚疗伤的动画序列
         * - 对话结束后播放，通过 setTimeout(0) 让 endNPCInteraction 先执行完毕再重新锁定输入
         * - 阿禾向左转，循环播放 heal 动画5秒
         * - 5秒后阿禾恢复朝下 idle
         * - 再过2秒（共7秒）阿砚切换为站立 idle
         * - 期间玩家操作被禁止
         * @param {NPC} npc - 阿禾 NPC
         */
        startBreathHealSequence(npc) {
            Logger.log('[Main] 开始定息引气序列');

            // 用主循环时间轴替代原来的嵌套 setTimeout(0 / 5000 / 2000)。
            // 第 0 步会在「下一帧」才执行（updateStoryTimeline 在本帧更早的位置被调用），
            // 等效于原来的 setTimeout(0)：先让 endNPCInteraction 走完，再重新锁定输入。
            this.startStoryTimeline([
                { at: 0, run: () => {
                    // 锁定玩家操作
                    this.player.isInteracting = true;
                    this.inputManager.setMovementBlocked(true);

                    const map = this.currentMap;
                    if (!map) return;

                    const ahe = map.npcs.get('ahe');
                    const ayan = map.npcs.get('ayan');
                    if (!ahe || !ayan) return;

                    // 1. 锁定阿禾动画（阻止 updateAnimation 覆盖），向左转，播放 heal 循环 5 秒
                    ahe.animationOverridden = true;
                    ahe.facing = 'left';
                    ahe.animationManager.setDirection('left');
                    if (ahe.animationManager.hasAnimation('heal')) {
                        ahe.setAnimation('heal', { loop: true });
                        Logger.log('[Main] 阿禾开始治疗动画（5秒）');
                    } else {
                        console.warn('[Main] Ahe 没有 heal 动画');
                    }

                    this._breathHealActors = { ahe: ahe, ayan: ayan };
                } },
                // 2. 5 秒后：阿禾恢复朝下 idle，解锁动画
                { at: 5, run: () => {
                    const actors = this._breathHealActors;
                    if (!actors) return;
                    actors.ahe.animationOverridden = false;
                    actors.ahe.facing = 'down';
                    actors.ahe.setIdleAnimation();
                    Logger.log('[Main] 阿禾治疗动画结束');
                } },
                // 3. 再过 2 秒（共 7 秒）：阿砚切站立 idle；4. 推进任务目标；5. 解除操作锁定
                { at: 7, run: () => {
                    const actors = this._breathHealActors;
                    if (actors) {
                        actors.ayan.animationOverridden = true;
                        if (actors.ayan.animationManager.hasAnimation('stand_idle')) {
                            actors.ayan.setAnimation('stand_idle', { loop: true });
                            actors.ayan.setNpcState('healed', true);
                            Logger.log('[Main] 阿砚被治愈，切换为站立动画');
                        }
                    }

                    if (this.player && this.player.questSystem) {
                        this.player.questSystem.updateQuestProgress('chapter1_main_2', 'complete_minigame', 'breath_control', 1);
                        Logger.log('[Main] 定息引气任务目标已完成');
                    }

                    this._breathHealActors = null;
                    if (this.player) this.player.isInteracting = false;
                    this.inputManager.setMovementBlocked(false);
                    Logger.log('[Main] 定息引气序列完成，恢复玩家操作');
                } },
            ]);
        },

        /**
         * 开始“筑基调息”（章末剧情，由祁伯对话选项 action: start_foundation_trial 触发）
         * 流程：禁键盘输入 → 主角朝下静立 → 背后播放筑基气场 5 秒 → 续接 breakthrough_success 对话
         * @param {NPC} npc - 当前交互的 NPC（祁伯）
         */
        startFoundationTrial(npc) {
            Logger.log('[Main] 开始筑基调息');

            // 用剧情时间轴替代原来的 setTimeout(0)：让当前对话的结束流程
            // （endNPCInteraction 会解除输入锁）先执行完，下一帧再重新锁定。
            this.startStoryTimeline([
                { at: 0, run: () => {
                    if (!this.player) return;

                    // 1. 锁定一切输入（移动 / 战斗 / 交互 / 键盘）
                    this.foundationTrialNPC = npc || null;
                    this.isFoundationTrialPlaying = true;
                    this.player.isInteracting = true;
                    this.inputManager.setMovementBlocked(true);
                    this.inputManager.setInputBlocked(true);

                    // 2. 主角朝下静立（movementBlocked 时 Player.updateMovement 不会改写朝向）
                    this.player.facing = 'down';
                    this.player.animationManager.setDirection('down');
                    if (this.player.playIdleAnimation) this.player.playIdleAnimation();

                    // 3. 背后播放筑基气场（时长取自 PlayerCombatSystem.CONFIG.foundationAura.duration，默认 5 秒）
                    const auraConfig = this.playerCombat && this.playerCombat.config
                        ? this.playerCombat.config.foundationAura : null;
                    const duration = auraConfig ? auraConfig.duration : 5;
                    this.foundationTrialTimer = duration;
                    if (this.playerCombat && this.playerCombat.playFoundationAura) {
                        this.playerCombat.playFoundationAura(duration);
                    }

                    this.addGameNotification('筑基调息……');
                } },
            ]);
        },

        /**
         * 推进筑基调息计时（updateGameWorld 中每帧调用，到时结束序列）
         * @param {number} deltaTime - 时间增量（秒）
         */
        updateFoundationTrial(deltaTime) {
            this.foundationTrialTimer -= deltaTime;
            if (this.foundationTrialTimer > 0) return;
            this.finishFoundationTrial();
        },

        /**
         * 结束筑基调息：停止气场、解锁输入并续接“筑基成功”对话
         */
        finishFoundationTrial() {
            this.foundationTrialTimer = 0;
            this.isFoundationTrialPlaying = false;

            if (this.playerCombat && this.playerCombat.stopFoundationAura) {
                this.playerCombat.stopFoundationAura();
            }

            this.inputManager.setInputBlocked(false);
            this.inputManager.setMovementBlocked(false);

            // 续接对话：breakthrough_success（其 on_complete 负责筑基结算 / 解锁云渡泽 / 接取《桥边寻阿禾》）
            const npc = this.foundationTrialNPC || (this.player ? this.player.nearbyNPC : null);
            this.foundationTrialNPC = null;

            if (npc && this.showDialogueNode(npc, 'breakthrough_success')) {
                Logger.log('[Main] 筑基调息结束，续接 breakthrough_success 对话');
                return;
            }

            if (this.player) this.player.isInteracting = false;
            console.warn('[Main] 筑基调息结束，但未找到 breakthrough_success 对话节点');
        },

        /**
         * 筑基结算（对话 on_complete: complete_foundation_trial）
         * - 记录剧情标记 → 境界提升（练气圆满 → 筑基）→ 推进 chapter1_ending_1 的 complete_foundation_trial 目标
         *   （目标完成 → onQuestComplete 把阿禾迁到码头送别位）
         * - 数值按筑基境界写满：气血上限 400 / 灵息上限 250（另加累积的 Boss 战败成长），两项当前值同时回满（见 applyFoundationRealmStats）
         */
        completeFoundationTrial() {
            this.setStoryFlag('foundation_trial_done');

            if (this.player && typeof this.player.breakthrough === 'function') {
                const advanced = this.player.breakthrough();
                if (advanced) {
                    this.addGameNotification(`筑基已成（${this.player.playerData.realm}）`);
                } else {
                    console.warn('[Main] 境界提升未生效：需练气圆满（剧情流程继续）');
                }
            }

            // 数值兜底：不论上面是否走到境界提升，筑基调息结束都必须拿到筑基数值
            // （气血上限 400 / 灵息上限 250 并回满），避免练气未到圆满时数值不生效。
            this.applyFoundationRealmStats();

            if (this.player && this.player.questSystem) {
                this.player.questSystem.updateQuestProgress('chapter1_ending_1', 'complete_foundation_trial', 'foundation', 1);
            }
        },

        /**
         * 筑基数值：按 GameConfig 的 ZHUJI 境界配置写满玩家数据
         * - 境界 / 小阶段 → 筑基·初期；气血上限 400、灵息上限 250（唯一基准数据源：GameConfig.realms.ZHUJI，
         *   其上再叠加累积的 Boss 战败成长 maxHealthBonus / maxManaBonus）；
         * - 当前气血 / 灵息一并回满（调息成功即巅峰状态）；
         * - 重复调用幂等（数值相同，不会叠加）。
         * @returns {boolean} 是否成功写入（缺少玩家或境界配置时返回 false）
         */
        applyFoundationRealmStats() {
            if (!this.player || !this.player.playerData) return false;

            const realmConfig = GameConfig.getInstance().getRealm('zhuji');
            if (!realmConfig) {
                console.warn('[Main] 缺少筑基境界配置（GameConfig.realms.ZHUJI），无法写入筑基数值');
                return false;
            }

            const data = this.player.playerData;
            data.realm = realmConfig.id || 'zhuji';
            data.stage = realmConfig.stages[0];
            data.maxHealth = realmConfig.maxHealth;
            data.maxMana = realmConfig.maxMana;
            data.health = realmConfig.maxHealth;
            data.mana = realmConfig.maxMana;

            // 移速等派生数值跟着当前境界重算（Player.getCurrentMoveSpeed）
            if (typeof this.player.getCurrentMoveSpeed === 'function') {
                this.player.moveSpeed = this.player.getCurrentMoveSpeed();
            }

            // Boss 战败成长的累计加成叠加在筑基基准值之上（没有战败成长时数值不变）
            this.applyPermanentStatBonus(data);

            Logger.log(`[Main] 筑基数值已生效：气血 ${data.health}/${data.maxHealth}，灵息 ${data.mana}/${data.maxMana}`);
            return true;
        },

        /**
         * 切换职业（set_profession_sword / mage / body / talisman）
         * @param {string} action - 选项动作名
         */
        applyProfessionAction(action) {
            const professionId = action.replace(/^set_profession_/, '');
            const player = this.player;
            if (!player || !player.professionSystem || typeof player.professionSystem.switchProfession !== 'function') {
                return;
            }

            if (player.professionSystem.switchProfession(professionId)) {
                Logger.log(`[Main] 已选择修行传承: ${professionId}`);
                this.addGameNotification('已选定修行传承');
            } else {
                console.warn(`[Main] 职业切换失败: ${professionId}`);
            }
        },

        /**
         * 发放剧情 / 任务物品
         * @param {string} itemId
         * @param {number} [count=1]
         * @param {boolean} [once=false] - true 时已持有则跳过（对话可重复触发时用）
         * @returns {boolean} 是否实际发放
         */
        grantQuestItem(itemId, count = 1, once = false) {
            const questItemSystem = this.player && this.player.questItemSystem;
            if (!questItemSystem) return false;
            if (once && questItemSystem.hasItem(itemId, 1)) return false;

            questItemSystem.addItem(itemId, count);
            const gameConfig = GameConfig.getInstance();
            const itemConfig = gameConfig.getItem(itemId);
            this.addGameNotification(`获得${itemConfig ? itemConfig.name : itemId}`);
            return true;
        },

        /**
         * 学习职业 / 基础技能（等级 1，已学则不重复）
         * @param {string} skillId
         * @returns {boolean}
         */
        learnProfessionSkill(skillId) {
            const player = this.player;
            if (!player || !player.professionSystem) return false;

            const gameConfig = GameConfig.getInstance();
            const skillConfig = gameConfig.getSkill(skillId);
            if (!skillConfig) {
                console.warn(`[Main] 技能不存在: ${skillId}`);
                return false;
            }

            const system = player.professionSystem;
            if (system.getSkillLevel(skillId) > 0) return false;

            if (skillConfig.type === 'basic') {
                system.basicSkills.set(skillId, 1);
            } else {
                system.professionSkills.set(skillId, 1);
            }
            // 技能「已习得」的唯一权威 = 玩家状态机（skillLearned:<id>，单调、随存档保存）。
            // 职业系统里的等级仍保留（用于战斗数值 / 读档兜底），但技能栏与可用性判定以状态机为准。
            const sm = player.playerData && typeof player.playerData.getStateMachine === 'function'
                ? player.playerData.getStateMachine() : null;
            if (sm) sm.learnSkill(skillId);
            Logger.log(`[Main] 习得技能: ${skillConfig.name}（${skillId}）`);
            this.addGameNotification(`习得${skillConfig.name}`);
            return true;
        },

        /**
         * 任务完成时自动发奖（第一章 + 第二章通用）
         *
         * 支持的奖励字段（都是可选的）：
         *   exp                  —— 修为（经验）
         *   lingShi              —— 灵石
         *   basicSkillPoints     —— 基础修习点
         *   professionSkillPoints—— 职业悟道点
         *   items: []            —— 物品 ID 数组（进背包，可堆叠的按堆叠处理）
         *   storyItems: []       —— 剧情物品 ID 数组（进任务物品栏）
         *   maxHealth / maxMana  —— 气血 / 灵息上限的小幅提升（当前值同步补足同等量）
         *   realm                —— 直接提升到的境界（按 GameConfig.realms 写满上限并回满）
         *   skills: []           —— 习得的技能（等级 1）
         *   unlockMap            —— 解锁的世界地图区域（写入 map_unlocked_<区域> 剧情标记，
         *                          并调用 updateWorldMapUnlocks 重算按钮状态；地图删减为前两章后，
         *                          数据里的照尘仙城不再有对应按钮，标记仅作存档 / 后续章节预留）
         * @param {string} questId
         * @param {Object} rewards
         */
        applyQuestRewards(questId, rewards) {
            if (!this.player || !rewards) return;

            const player = this.player;
            const data = player.playerData;
            const notes = [];

            // ---- 修为 / 灵石 / 技能点 ----
            if (rewards.exp) {
                player.gainExperience(rewards.exp);
                notes.push(`修为+${rewards.exp}`);
            }
            if (rewards.lingShi) {
                data.gainLingShi(rewards.lingShi);
                notes.push(`灵石+${rewards.lingShi}`);
            }
            // 技能点唯一存储在 PlayerData（ProfessionSystem 通过访问器读取同一份数据），
            // 因此只写一次即可。旧代码同时写 playerData 与 professionSystem —— 在两者合并为
            // 同一份存储后，那会变成「加两次」，故删除第二次写入。
            if (rewards.basicSkillPoints) {
                data.basicSkillPoints += rewards.basicSkillPoints;
                notes.push(`基础修习点+${rewards.basicSkillPoints}`);
            }
            if (rewards.professionSkillPoints) {
                data.professionSkillPoints += rewards.professionSkillPoints;
                notes.push(`职业悟道点+${rewards.professionSkillPoints}`);
            }

            // ---- 气血 / 灵息上限小幅提升（当前值同步补足，避免刚提升就显示残血）----
            if (rewards.maxHealth) {
                data.maxHealth += rewards.maxHealth;
                data.health = Math.min(data.maxHealth, data.health + rewards.maxHealth);
                notes.push(`气血上限+${rewards.maxHealth}`);
            }
            if (rewards.maxMana) {
                data.maxMana += rewards.maxMana;
                data.mana = Math.min(data.maxMana, data.mana + rewards.maxMana);
                notes.push(`灵息上限+${rewards.maxMana}`);
            }

            // ---- 物品 / 剧情物品 ----
            if (Array.isArray(rewards.items)) {
                rewards.items.forEach(itemId => {
                    if (player.inventory && player.inventory.addItem(itemId, 1)) {
                        const itemConfig = GameConfig.getInstance().getItem(itemId);
                        notes.push(`${itemConfig ? itemConfig.name : itemId}×1`);
                    }
                });
            }
            if (Array.isArray(rewards.storyItems)) {
                rewards.storyItems.forEach(itemId => this.grantQuestItem(itemId, 1, true));
            }

            // ---- 技能 ----
            if (Array.isArray(rewards.skills)) {
                rewards.skills.forEach(skillId => this.learnProfessionSkill(skillId));
            }

            // ---- 境界（按 GameConfig.realms 写满并回满）----
            if (rewards.realm) {
                this.applyRealmStats(rewards.realm);
            }

            // ---- 解锁世界地图区域 ----
            if (rewards.unlockMap) {
                this.setStoryFlag(`map_unlocked_${rewards.unlockMap}`);
                this.updateWorldMapUnlocks();
                notes.push(`解锁${rewards.unlockMap}`);
            }

            if (notes.length > 0) {
                Logger.log(`[奖励] ${questId} → ${notes.join('，')}`);
                this.addGameNotification(`任务奖励：${notes.join('，')}`);
            }
        },

        /**
         * 把累积的 Boss 战败成长叠加到气血 / 灵息上限之上（境界数值写入之后调用）
         * - 数值来源：PlayerData.maxHealthBonus / maxManaBonus（每次 Boss 战败累加，
         *   见 Main.applyBossFailureBonus）；
         * - 两个加成都是 0 时不做任何改动（旧存档 / 没战败过的角色数值不变）；
         * - 叠加后按新上限回满（境界切换 / 调息结算本身即巅峰状态）。
         * @param {Object} [data] - 玩家数据（缺省用 this.player.playerData）
         * @returns {boolean} 是否叠加了加成
         */
        applyPermanentStatBonus(data) {
            const target = data || (this.player && this.player.playerData);
            if (!target) return false;

            const bonusHealth = target.maxHealthBonus || 0;
            const bonusMana = target.maxManaBonus || 0;
            if (bonusHealth === 0 && bonusMana === 0) return false;

            target.maxHealth += bonusHealth;
            target.maxMana += bonusMana;
            target.health = target.maxHealth;
            target.mana = target.maxMana;

            Logger.log(`[Main] Boss 战败成长已叠加：气血上限 ${target.maxHealth}（含 +${bonusHealth}）、灵息上限 ${target.maxMana}（含 +${bonusMana}）`);
            return true;
        },

        /**
         * 按 GameConfig 的境界配置写满玩家数值（气血 / 灵息上限并回满）
         * 写入后叠加累积的 Boss 战败成长（见 applyPermanentStatBonus）并按上限回满
         * @param {string} realmId - 'lianqi' | 'zhuji' | 'jiedan' | ...
         * @returns {boolean}
         */
        applyRealmStats(realmId) {
            if (!this.player || !this.player.playerData) return false;

            const realmConfig = GameConfig.getInstance().getRealm(realmId);
            if (!realmConfig) {
                console.warn(`[Main] 缺少境界配置（${realmId}），无法写入境界数值`);
                return false;
            }

            const data = this.player.playerData;
            data.realm = realmConfig.id || realmId;
            data.stage = realmConfig.stages ? realmConfig.stages[0] : data.stage;
            data.maxHealth = realmConfig.maxHealth;
            data.maxMana = realmConfig.maxMana;
            data.health = realmConfig.maxHealth;
            data.mana = realmConfig.maxMana;

            if (typeof this.player.getCurrentMoveSpeed === 'function') {
                this.player.moveSpeed = this.player.getCurrentMoveSpeed();
            }

            // Boss 战败成长的累计加成叠加在境界基准值之上（没有战败成长时数值不变）
            this.applyPermanentStatBonus(data);

            Logger.log(`[Main] 境界数值已生效：${realmConfig.name}，气血 ${data.health}/${data.maxHealth}，灵息 ${data.mana}/${data.maxMana}`);
            return true;
        },

        /**
         * 确保筑基修为圆满（第二章主线四的门槛）
         * 主线三交付后调用：若当前仍在筑基，则把阶段推到「圆满」并清零溢出经验，
         * 让「M03 完成且筑基圆满」的条件真正成立（与第一章筑基数值兜底同一思路）。
         * @returns {boolean} 是否做了调整
         */
        ensureFoundationPerfect() {
            if (!this.player || !this.player.playerData) return false;
            const data = this.player.playerData;
            if (data.realm !== 'zhuji') return false;
            if (data.stage === '圆满') return false;

            data.stage = '圆满';
            data.experience = 0;
            Logger.log('[Main] 历练已足：筑基修为推至圆满');
            this.addGameNotification('修为已至筑基圆满，可以准备万灯台一战');
            return true;
        },

        /**
         * 第二章：剑修连招试炼（陆舟）
         * 复用第一章的基础操作教学框架（TrainingManager），教学圈放在云渡泽码头栈道北侧的小路；
         * 本次试炼只有一个剑影连斩圈：站进圈内按 O → 完成教学圈 → onAllCompleted 传授剑影连斩。
         * @param {NPC} [npc] - 陆舟（可省略）
         */
        startSwordTraining(npc) {
            if (!this.trainingManager) return;
            if (this.trainingManager.isActive) {
                this.addGameNotification('试炼圈已经放好了，去码头北侧的小路练招');
                return;
            }

            // 任务门控：只在《渡口无归客》推进到第 3 步（complete_training / sword）时才放教学圈。
            // 否则刚进章节跟陆舟闲聊就能把试炼做完 —— 任务系统会拒收那一步的进度
            // （第 1、2 步还没完成），但教学圈与技能发放会被提前消耗掉，主线一从此卡死。
            const questSystem = this.player && this.player.questSystem;
            if (questSystem && typeof questSystem.isObjectiveCurrent === 'function'
                && !questSystem.isObjectiveCurrent('chapter2_main_1', 'complete_training', 'sword')) {
                this.addGameNotification('先把渡口的事理清：找许录拿登记摘页，再与陆舟核对旧航线');
                Logger.log('[Main] 剑修连招试炼未到任务步骤，暂不放置教学圈');
                return;
            }

            const layout = window.Chapter2Config && Chapter2Config.getSwordTrainingLayout
                ? Chapter2Config.getSwordTrainingLayout()
                : null;

            this.trainingManager.startBasicTraining(null, {
                layout: layout,
                target: 'sword',
                label: '剑修基础连招试炼',
            });
            this.addGameNotification('前往码头栈道北侧完成剑修连招试炼（靠近教学圈按 O 施展剑影连斩）');
        },

        /**
         * 第二章章末：结丹调息（复用第一章「定息」规则）
         * 流程：禁键盘输入 → 主角朝下静立 → 背后播放筑基/结丹气场 5 秒 → 续接 T07（结丹成功演出）
         * @param {NPC} [npc] - 阿禾（可省略）
         */
        startCoreFormationTrial(npc) {
            // 用剧情时间轴替代原来的 setTimeout(0)：下一帧再进入调息（先让对话收尾）
            this.startStoryTimeline([
                { at: 0, run: () => {
                    if (!this.player || this.isCoreTrialPlaying) return;

                    const questSystem = this.player.questSystem;
                    if (!questSystem || typeof questSystem.isQuestActive !== 'function'
                        || !questSystem.isQuestActive('chapter2_ending_1')) {
                        console.warn('[Main] 结丹调息需要在《灯定丹成》任务进行中触发');
                        return;
                    }

                    this.coreTrialNPC = npc || this.player.nearbyNPC || null;
                    this.isCoreTrialPlaying = true;
                    this.player.isInteracting = true;
                    this.inputManager.setMovementBlocked(true);
                    this.inputManager.setInputBlocked(true);

                    // 主角朝下静立（movementBlocked 时不会改写朝向）
                    this.player.facing = 'down';
                    this.player.animationManager.setDirection('down');
                    if (this.player.playIdleAnimation) this.player.playIdleAnimation();

                    // 复用筑基气场表现（时长取自 PlayerCombatSystem CONFIG.foundationAura.duration）
                    const auraConfig = this.playerCombat && this.playerCombat.config
                        ? this.playerCombat.config.foundationAura : null;
                    const duration = auraConfig ? auraConfig.duration : 5;
                    this.coreTrialTimer = duration;
                    if (this.playerCombat && this.playerCombat.playFoundationAura) {
                        this.playerCombat.playFoundationAura(duration);
                    }

                    this.addGameNotification('结丹调息……');
                } },
            ]);
        },

        /**
         * 推进结丹调息计时（updateGameWorld 每帧调用）
         * @param {number} deltaTime
         */
        updateCoreFormationTrial(deltaTime) {
            this.coreTrialTimer -= deltaTime;
            if (this.coreTrialTimer > 0) return;
            this.finishCoreFormationTrial(true);
        },

        /**
         * 结束结丹调息
         * @param {boolean} [success=true] - 成功 → T07（结丹演出）；失败 → T06（可再试）
         */
        finishCoreFormationTrial(success = true) {
            this.coreTrialTimer = 0;
            this.isCoreTrialPlaying = false;

            if (this.playerCombat && this.playerCombat.stopFoundationAura) {
                this.playerCombat.stopFoundationAura();
            }
            this.inputManager.setInputBlocked(false);
            this.inputManager.setMovementBlocked(false);

            const npc = this.coreTrialNPC || (this.player ? this.player.nearbyNPC : null);
            this.coreTrialNPC = null;

            if (!success) {
                this.playStoryDialogue('t06_core_fail', '阿禾: ');
                if (npc) this.showDialogueNode(npc, 'c2_a08_core_ready');
                return;
            }

            this.playStoryDialogue('t07_core_success', '旁白: ', () => this.completeCoreFormationTrial());
        },

        /**
         * 结丹结算：推进《灯定丹成》的唯一目标（结丹调息）
         * 境界与气血 / 灵息上限的实际写入由这里的 applyRealmStats('jiedan') 完成
         * （本任务不再配置奖励，境界推进不依赖 rewards.realm），
         * 这里先按配置写满结丹数值，保证即使玩家修为未到圆满也能正常进入结丹。
         * 注：剑影连斩已在第二章主线一《渡口无归客》的剑修基础连招试炼中传授，此处不再重复发放。
         */
        completeCoreFormationTrial() {
            if (!this.player) return;
            const questSystem = this.player.questSystem;

            if (typeof this.player.breakthrough === 'function') {
                const advanced = this.player.breakthrough();
                if (!advanced) {
                    console.warn('[Main] 境界自动提升未生效（小阶段未满），按配置直接写入结丹数值');
                }
            }
            this.applyRealmStats('jiedan');
            this.setStoryFlag('chapter2_core_trial_done');

            if (questSystem) {
                questSystem.updateQuestProgress('chapter2_ending_1', 'complete_core_trial', 'jiedan', 1);
            }
        },

        /**
         * 设置剧情标记（QuestSystem.storyFlags；无 QuestSystem 时静默忽略）
         * @param {string} flag - 标记名
         * @param {*} [value=true] - 标记值
         */
        setStoryFlag(flag, value = true) {
            if (this.player && this.player.questSystem && this.player.questSystem.setStoryFlag) {
                this.player.questSystem.setStoryFlag(flag, value);
            }
        },

        /**
         * 读取剧情标记（QuestSystem.storyFlags；无 QuestSystem / 旧接口时视为未设置）
         *
         * ⚠ 补漏记录（2026-09-12）：Main 之前只有 setStoryFlag，没有读取端，
         *   而 enterBossArena 里写着 `!this.hasStoryFlag('chapter2_b01_seen')` ——
         *   于是进第二章战场（万灯台）时会抛 TypeError，B01 战前对白根本播不到、
         *   渡厄使也不会生成（玩家进去只见空场）。补上本方法即修复；
         *   tools/smoke_chapter2.js 第 7 节「首次进场先播 B01、对白结束才生成渡厄使」为回归断言。
         * @param {string} flag - 标记名
         * @returns {boolean}
         */
        hasStoryFlag(flag) {
            const questSystem = this.player && this.player.questSystem;
            if (!questSystem || typeof questSystem.hasStoryFlag !== 'function') return false;
            return questSystem.hasStoryFlag(flag);
        },

        /**
         * 显示游戏内通知
         * @param {string} message - 通知文本
         */
        addGameNotification(message) {
            Logger.log(`[通知] ${message}`);
            // 后续可扩展为屏幕上方淡入淡出的通知 UI
            // 目前先打印日志，如果有 notificationManager 则使用
            if (this.notificationManager && typeof this.notificationManager.addNotification === 'function') {
                this.notificationManager.addNotification(message);
            }
        }

});
