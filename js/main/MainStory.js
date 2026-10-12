/**
 * Main · 对话与剧情序列
 * NPC 交互对话、剧情时间轴（deltaTime 驱动）、旁白字幕与剧情对白播放。
 *
 * 由 js/Main.js 拆分而来，经原型混入挂回 Main（Object.assign(Main.prototype, {...})）：
 * 调用点仍写作 this.xxx()，行为与原单文件实现完全一致。
 */

Object.assign(Main.prototype, {

        /**
         * 开始NPC交互
         * @param {NPC} npc - NPC实例
         */
        startNPCInteraction(npc) {
            // 设置玩家交互状态
            this.player.isInteracting = true;
            this.inputManager.setMovementBlocked(true);

            // 面向NPC
            npc.faceTarget(this.player.position);

            // ===== 清空上一对话缓存，防止跨NPC消息残留 =====
            this.dialogBox.dialogueLines = [];
            this.dialogBox.currentText = '';
            this.dialogBox.displayedText = '';
            this.dialogBox.currentSpeakerName = '';
            this.dialogBox.isTyping = false;
            this.dialogBox.currentLineIndex = 0;

            // 根据任务进度选择对话ID
            const dialogueId = this.getDialogueForNPC(npc);

            // ===== 推进 talk_to 任务目标（在 getDialogueForNPC 之后执行） =====
            // 与 NPC 对话时，自动推进所有 active 任务中 type='talk_to' 且 target=该NPC 的目标
            // 必须在 getDialogueForNPC 之后执行，以免影响当前对话选择（如 talk_to 未完成时显示初次教学）
            if (this.player && this.player.questSystem) {
                for (const [questId] of this.player.questSystem.getActiveQuests()) {
                    this.player.questSystem.updateQuestProgress(questId, 'talk_to', npc.id);
                }
            }

            // 开始对话
            npc.startDialogue(this.player, dialogueId);

            // 设置对话框
            this.dialogBox.show();

            const currentDialogue = npc.dialogueSystem.currentDialogue;
            if (currentDialogue) {
                this.dialogBox.setText(
                    currentDialogue.text,
                    npc.name
                );
            }

            // 绑定对话推进
            this.dialogBox.onAdvance = () => {
                this.advanceDialogue(npc);
            };

            // 设置 NPC 的任务发布回调（失败时会给出玩家可见提示，见 tryAcceptQuest）
            npc.onAssignQuest = (questId) => {
                this.tryAcceptQuest(questId);
            };

            // 设置 NPC 的商店回调
            npc.onOpenShop = () => {
                if (this.shop) {
                    this.shop.open(npc, this.player);
                    this.dialogBox.hide();
                }
            };

            // ===== 设置对话结束回调：处理 on_complete =====
            npc.dialogueSystem.onDialogueEnd = () => {
                this.handleDialogueComplete(npc);
            };

            // ===== 设置训练回调：处理 start_basic_training 动作 =====
            npc.onStartTraining = () => {
                this.handleStartTraining(npc);
            };

            // ===== 设置定息引气回调：处理 start_breath_heal_sequence 动作 =====
            npc.onBreathHeal = () => {
                this.startBreathHealSequence(npc);
            };

            // ===== 设置风桥护送回调：处理 start_wind_bridge_rescue 动作（周叔过桥） =====
            npc.onWindBridgeRescue = () => {
                this.startWindBridgeRescue(npc);
            };

            // ===== 设置筑基调息回调：处理 start_foundation_trial 动作（章末：祁伯） =====
            npc.onFoundationTrial = () => {
                this.startFoundationTrial(npc);
            };

            // ===== 第二章：剑修连招试炼（陆舟，动作 start_sword_training） =====
            npc.onSwordTraining = () => {
                this.startSwordTraining(npc);
            };

            // ===== 第二章：逆流送灯（陆舟，动作 start_river_escort） =====
            npc.onRiverEscort = () => {
                this.startRiverEscort(npc);
            };

            // ===== 第二章：结丹调息（阿禾，动作 start_core_formation_trial） =====
            npc.onCoreTrial = () => {
                this.startCoreFormationTrial(npc);
            };

            // ===== 对话选项动作（set_profession_* / trial_profession_* 等） =====
            npc.dialogueSystem.onOptionSelected = (option) => {
                if (option && option.action) {
                    this.handleDialogueOptionAction(option.action);
                }
            };
        },

        /**
         * 根据玩家任务进度获取 NPC 当前应显示的对话 ID
         *
         * 章节判定：按当前地图决定先问哪一章的选择器
         *   - 云渡泽 / 万灯台（第二章地图）→ 先问 Chapter2Config，未命中再回退第一章
         *   - 其余地图（青岚浮野等）      → 先问 Chapter1Config，未命中再回退第二章
         * 这样阿禾（两章同名同一人）在两章地图上各自走本章对白。
         * @param {NPC} npc
         * @returns {string|null}
         */
        getDialogueForNPC(npc) {
            const questSystem = this.player && this.player.questSystem;
            const questItemSystem = this.player && this.player.questItemSystem;
            if (!questSystem) return null;

            const inChapter2 = window.Chapter2Config
                && Chapter2Config.isChapter2Map(this.currentMap ? this.currentMap.mapId : null);

            const providers = inChapter2
                ? [window.Chapter2Config, window.Chapter1Config]
                : [window.Chapter1Config, window.Chapter2Config];

            for (const provider of providers) {
                if (!provider || typeof provider.getDialogueForNPC !== 'function') continue;
                try {
                    const dialogueId = provider.getDialogueForNPC(npc.id, questSystem, questItemSystem);
                    if (dialogueId) {
                        Logger.log(`[Main] NPC ${npc.id} → 对话: ${dialogueId}（${provider === window.Chapter2Config ? '第二章' : '第一章'}）`);
                        return dialogueId;
                    }
                } catch (e) {
                    console.warn('[Main] getDialogueForNPC 错误:', e);
                }
            }
            return null;
        },

        /**
         * 处理对话结束时的 on_complete 回调
         * @param {NPC} npc
         */
        handleDialogueComplete(npc) {
            const onCompleteList = npc.dialogueSystem.getCurrentOnComplete();
            if (!onCompleteList || onCompleteList.length === 0) return;

            Logger.log(`[Main] 对话结束，处理 on_complete:`, onCompleteList);

            for (const action of onCompleteList) {
                switch (action) {
                    case 'teach_basic_skills':
                        // 教学基本技能 + 启动训练场景（在中央广场放置训练目标）
                        Logger.log('[Main] 传授基础技能: 灵息弹、护体术，启动训练');
                        if (this.trainingManager && !this.trainingManager.isActive) {
                            this.trainingManager.startBasicTraining();
                            this.addGameNotification('前往中央广场完成基础训练！');
                        }
                        break;

                    case 'complete_quest_chapter1_main_1':
                        // 任务完成时的交付对话，任务已完成，无需额外操作
                        Logger.log('[Main] 主线一交付对话结束');
                        break;

                    // ===== 章末：筑基 → 桥边寻阿禾 → 登船 =====
                    case 'unlock_foundation_breakthrough':
                        // 主线四交付完成 → 解锁筑基调息（祁伯对话规则 whenStoryFlag: foundation_unlocked）
                        this.setStoryFlag('foundation_unlocked');
                        this.addGameNotification('可以去找祁伯完成筑基调息了');
                        break;

                    case 'complete_foundation_trial':
                        // 筑基结算：境界提升 + 推进 chapter1_ending_1（完成后阿禾迁往码头）
                        this.completeFoundationTrial();
                        break;

                    case 'unlock_yunduze':
                        this.setStoryFlag('yunduze_unlocked');
                        this.addGameNotification('云渡泽航线已解锁');
                        // 世界地图上的「云渡泽」按钮同步开放
                        this.updateWorldMapUnlocks();
                        break;

                    // ===== 第二章（云渡泽）=====
                    case 'obtain_yunduze_registry':
                        // X01：许录交出登记摘页（剧情物品，重复对话不会重复发放）
                        this.grantQuestItem('dengji_zhaie', 1, true);
                        this.addGameNotification('取得登记摘页');
                        break;

                    case 'obtain_jiangwan_letter':
                        // J01：江婆借出江晚家书
                        this.grantQuestItem('jiangwan_jiashu', 1, true);
                        break;

                    case 'obtain_hundeng_pair':
                        // X03：许录打开核验栏 → 两盏待认领魂灯
                        this.grantQuestItem('hundeng_jiangwan', 1, true);
                        this.grantQuestItem('hundeng_chenli', 1, true);
                        this.addGameNotification('取得两盏待认领魂灯（渡四二 / 青十七）');
                        break;

                    case 'obtain_tongxing_token':
                        // X05：通行凭证
                        this.grantQuestItem('tongxing_pingzheng', 1, true);
                        this.addGameNotification('取得万灯台通行凭证');
                        break;

                    case 'start_core_formation_trial':
                        // A08：接取《灯定丹成》后播放结丹调息序列
                        this.startCoreFormationTrial(this.player ? this.player.nearbyNPC : null);
                        break;

                    case 'record_boat_repaired':
                        this.setStoryFlag('chapter2_boat_repaired');
                        this.addGameNotification('行舟已修好，可以出发了');
                        break;

                    case 'unlock_travel_boat':
                    case 'unlock_zhaochen':
                        // 行舟落脚点 / 照尘仙城航线解锁
                        this.setStoryFlag('chapter2_travel_boat_unlocked');
                        this.updateWorldMapUnlocks();
                        break;

                    // 注：原 'open_profession_selection'（筑基后续接择道）已随“本版本不做职业选择”移除；
                    // 择道节点仍保留在 Chapter1Config 中，后续版本恢复时把该分支加回即可。

                    case 'set_profession_sword':
                    case 'set_profession_mage':
                    case 'set_profession_body':
                    case 'set_profession_talisman':
                        this.applyProfessionAction(action);
                        break;

                    case 'complete_profession_selection':
                        // 择道完成 → 祁伯对话规则切换为“换传承说明”
                        this.setStoryFlag('profession_chosen');
                        break;

                    case 'record_farewell_done':
                        // 码头告别（阿禾 farewell）已完成 → 读档/重新进图时补生成登船路标
                        this.setStoryFlag('chapter1_farewell_done');
                        break;

                    case 'create_depart_signpost':
                        // 告别对话结束 → 在码头 (2566, 1419) 生成永久登船路标
                        this.createDepartSignpost(this.currentMap);
                        break;

                    case 'trial_profession_sword':
                    case 'trial_profession_mage':
                    case 'trial_profession_body':
                    case 'trial_profession_talisman':
                    case 'open_free_trial':
                    case 'open_respec_confirm':
                    case 'open_skill_config':
                        // 职业试用 / 重塑 / 技能配置界面尚未实现 → 仅提示，避免出现“未处理动作”警告
                        this.addGameNotification('该功能将在后续版本开放');
                        break;

                    default:
                        // 支持 on_complete 中写 accept_quest_xxx / start_quest_xxx
                        if (action.startsWith('accept_quest_') || action.startsWith('start_quest_')) {
                            const questId = action.replace(/^(accept_quest_|start_quest_)/, '');
                            if (this.player && this.player.questSystem) {
                                this.tryAcceptQuest(questId);
                            }
                        } else if (action.startsWith('complete_quest_')) {
                            // 主线结算由 updateQuestProgress / completeQuest 完成，此处仅记录
                            const questId = action.replace(/^complete_quest_/, '');
                            Logger.log(`[Main] 主线交付对话结束: ${questId}`);
                        } else if (action === 'move_zhoushu_to_village') {
                            // 周叔迁往获救点（与风桥护送的落点共用同一数据源）
                            const map = this.currentMap;
                            const zhoushu = map && map.npcs ? map.npcs.get('zhoushu') : null;
                            if (zhoushu && zhoushu.repositionWorld) {
                                const rescued = this.getZhoushuRescuedWorldPosition(map);
                                zhoushu.repositionWorld(rescued.x, rescued.y, map);
                            }
                        } else if (action.startsWith('record_') || action.startsWith('mark_')
                            || action.startsWith('hint_') || action.startsWith('switch_')) {
                            // 剧情标记类动作：只做记录，无额外运行时逻辑
                            Logger.log(`[Main] 剧情记录: ${action}`);
                        } else {
                            console.warn(`[Main] 未处理的 on_complete 动作: ${action}`);
                        }
                        break;
                }
            }
        },

        /**
         * 启动一段「剧情时间轴」：按主循环 deltaTime 推进，到点执行各步骤。
         *
         * 为什么不用 setTimeout：定时器与游戏暂停 / 帧率脱钩 —— 暂停时照跑，
         * 切场景 / 读档后还可能作用在过期状态上；嵌套定时器也无法取消。
         * 时间轴由 `updateStoryTimeline` 在主循环里推进，暂停即停。
         *
         * @param {Array<{at:number, run:Function}>} steps - at = 相对启动时刻的秒数（内部会按 at 升序排序）
         */
        startStoryTimeline(steps) {
            if (!Array.isArray(steps) || steps.length === 0) return;
            this.storyTimeline = {
                steps: steps.slice().sort((a, b) => a.at - b.at),
                elapsed: 0,
                nextIndex: 0,
            };
        },

        /**
         * 推进剧情时间轴（由 updateGameWorld 每帧调用；放在对话处理之前，
         * 这样 `at: 0` 的步骤天然延迟一帧执行）
         * @param {number} deltaTime - 时间增量（秒）
         */
        updateStoryTimeline(deltaTime) {
            const timeline = this.storyTimeline;
            if (!timeline) return;

            timeline.elapsed += deltaTime;
            while (timeline.nextIndex < timeline.steps.length
                && timeline.steps[timeline.nextIndex].at <= timeline.elapsed) {
                const step = timeline.steps[timeline.nextIndex++];
                if (typeof step.run === 'function') step.run();
            }
            if (timeline.nextIndex >= timeline.steps.length) {
                this.storyTimeline = null;
            }
        }

        /** 取消当前剧情时间轴（切场景 / 读档时调用，避免过期步骤继续执行） */,

        cancelStoryTimeline() {
            this.storyTimeline = null;
            this._breathHealActors = null;
        },

        /**
         * 直接展示某个对话节点（用于剧情序列结束后续接对话，如筑基成功）
         * @param {NPC} npc - 对话对象
         * @param {string} dialogueId - 对话节点 ID
         * @returns {boolean} 是否成功展示
         */
        showDialogueNode(npc, dialogueId) {
            if (!npc || !npc.dialogueSystem || !npc.dialogueSystem.getDialogue) return false;

            const dialogue = npc.dialogueSystem.getDialogue(dialogueId);
            if (!dialogue) {
                console.warn(`[Main] 对话节点不存在: ${dialogueId}`);
                return false;
            }

            this.player.isInteracting = true;
            this.inputManager.setMovementBlocked(true);

            // 清空上一段对话残留（与 startNPCInteraction 保持一致）
            this.dialogBox.dialogueLines = [];
            this.dialogBox.currentText = '';
            this.dialogBox.displayedText = '';
            this.dialogBox.currentSpeakerName = '';
            this.dialogBox.isTyping = false;
            this.dialogBox.currentLineIndex = 0;

            npc.startDialogue(this.player, dialogueId);
            this.dialogBox.show();
            this.dialogBox.setText(dialogue.text, npc.name);

            this.dialogBox.onAdvance = () => {
                this.advanceDialogue(npc);
            };
            npc.dialogueSystem.onDialogueEnd = () => {
                this.handleDialogueComplete(npc);
            };

            return true;
        },

        /**
         * 处理对话选项动作（set_profession_* / trial_profession_* 等由 Chapter1Config 配置）
         * @param {string} action - 选项动作名
         */
        handleDialogueOptionAction(action) {
            if (!action) return;
            if (action.startsWith('set_profession_')) {
                this.applyProfessionAction(action);
            } else if (action.startsWith('trial_profession_')) {
                this.addGameNotification('职业试用将在后续版本开放');
            }
        },

        /**
         * 取第二章剧情对白的文本（无 NPC 承载的旁白 / 系统提示）
         * @param {string} dialogueId
         * @returns {string}
         */
        getChapter2StoryText(dialogueId) {
            if (!window.Chapter2Config || typeof Chapter2Config.getStoryDialogue !== 'function') return '';
            const dialogue = Chapter2Config.getStoryDialogue(dialogueId);
            return dialogue ? dialogue.text : '';
        },

        /**
         * 播放无 NPC 承载的剧情对白（旁白 / 系统 / 战后演出）
         * - 播放期间锁定移动与交互，读完最后一行按 J / 点击推进结束
         * - 结束时可执行回调（如进入战场、开始小游戏）
         * @param {string} dialogueId - Chapter2Config.getStoryDialogues() 中的 ID
         * @param {string} [speakerName] - 无冒号行使用的话者名（默认 '旁白'）
         * @param {Function} [onDone] - 读完后的回调
         * @returns {boolean} 是否成功播放
         */
        playStoryDialogue(dialogueId, speakerName = '旁白', onDone = null) {
            const text = this.getChapter2StoryText(dialogueId);
            if (!text) {
                console.warn(`[Main] 剧情对白不存在: ${dialogueId}`);
                if (onDone) onDone();
                return false;
            }
            return this.playDialogueText(text, speakerName, onDone);
        },

        /**
         * 播放一段（无 NPC 承载的）对话文本，读完按 J / 点击推进结束
         * @param {string} text - 文本（用 \n 分行，行首可带“说话人: ”）
         * @param {string} [speakerName='旁白'] - 无冒号行使用的话者名
         * @param {Function} [onDone] - 读完后的回调
         * @returns {boolean}
         */
        playDialogueText(text, speakerName = '旁白', onDone = null) {
            if (!text) {
                if (onDone) onDone();
                return false;
            }

            this.storyDialogueActive = true;
            if (this.player) this.player.isInteracting = true;
            this.inputManager.setMovementBlocked(true);

            // 清空上一段对话残留
            this.dialogBox.dialogueLines = [];
            this.dialogBox.currentText = '';
            this.dialogBox.displayedText = '';
            this.dialogBox.currentSpeakerName = '';
            this.dialogBox.isTyping = false;
            this.dialogBox.currentLineIndex = 0;
            this.dialogBox.clearOptionButtons();

            this.dialogBox.show();
            this.dialogBox.setText(text, speakerName);
            this.dialogBox.onAdvance = () => {
                this.finishStoryDialogue();
                if (onDone) onDone();
            };

            return true;
        },

        /**
         * 结束当前剧情对白并解锁操作（playDialogueText / playStoryDialogue 内部使用）
         */
        finishStoryDialogue() {
            this.dialogBox.dialogueLines = [];
            this.dialogBox.currentText = '';
            this.dialogBox.displayedText = '';
            this.dialogBox.currentSpeakerName = '';
            this.dialogBox.isTyping = false;
            this.dialogBox.currentLineIndex = 0;
            this.dialogBox.onAdvance = null;
            this.dialogBox.hide();

            this.storyDialogueActive = false;
            if (this.player) this.player.isInteracting = false;
            this.inputManager.setMovementBlocked(false);
        },

        /**
         * 屏幕中下方的短字幕（不暂停操作，用于战斗中的台词）
         * @param {string} text
         * @param {number} [duration=4] - 显示秒数
         */
        showSubtitle(text, duration = 4) {
            if (!text) return;
            this.subtitle.text = text;
            this.subtitle.timer = duration;
            Logger.log(`[字幕] ${text}`);
        },

        /**
         * 推进对话
         * @param {NPC} npc - NPC实例
         */
        advanceDialogue(npc) {
            const dialogueSystem = npc.dialogueSystem;
            const currentDialogue = dialogueSystem.currentDialogue;

            if (!currentDialogue) {
                this.endNPCInteraction(npc);
                return;
            }

            // 检查是否有选项
            const options = dialogueSystem.getCurrentOptions();

            if (options && options.length > 0) {
                // 渲染对话选项按钮
                this.renderDialogueOptions(options, npc);
            } else if (currentDialogue.next) {
                // 跳转到下一个对话
                const nextDialogue = dialogueSystem.getDialogue(currentDialogue.next);
                if (nextDialogue) {
                    dialogueSystem.currentDialogue = nextDialogue;
                    this.dialogBox.setText(nextDialogue.text, npc.name);
                } else {
                    this.endNPCInteraction(npc);
                }
            } else {
                this.endNPCInteraction(npc);
            }
        },

        /**
         * 渲染对话选项
         */
        renderDialogueOptions(options, npc) {
            this.dialogBox.clearOptionButtons();

            const buttonWidth = 400;
            const buttonHeight = 78;
            const buttonGap = 15;

            // 计算按钮组的总高度
            const totalHeight = options.length * buttonHeight + (options.length - 1) * buttonGap;

            // 计算起始Y坐标，使按钮组在对话框内垂直居中
            const dialogCenterY = 720 - this.dialogBox.height;
            const startY = dialogCenterY / 2 - totalHeight / 2;

            // 按钮水平居中
            const startX = this.dialogBox.x + (this.dialogBox.width - buttonWidth) / 2;

            options.forEach((option, index) => {
                const button = new UIButton({
                    x: startX,
                    y: startY + index * (buttonHeight + buttonGap),
                    width: buttonWidth,
                    height: buttonHeight,

                    // ========== 在这里设置按钮图片 ==========
                    backgroundImage: this.resourceManager.getCachedImage('ui.button_normal'),
                    hoverImage: this.resourceManager.getCachedImage('ui.button_hover'),
                    pressedImage: this.resourceManager.getCachedImage('ui.button_pressed'),

                    text: option.text || `选项 ${index + 1}`,
                    callback: () => {
                        this.selectDialogueOption(npc, option, index);
                    },
                });

                this.dialogBox.addOptionButton(button);
            });

        },

        /**
         * 选择对话选项
         */
        selectDialogueOption(npc, option, optionIndex) {
            const result = npc.dialogueSystem.selectOption(optionIndex);

            // 清除选项按钮
            this.dialogBox.clearOptionButtons();

            // 如果打开了商店，不要结束交互（商店自行管理输入阻塞）
            if (this.shop && this.shop.isOpen) {
                return;
            }

            if (npc.dialogueSystem.isActive) {
                const currentDialogue = npc.dialogueSystem.currentDialogue;
                if (currentDialogue) {
                    this.dialogBox.setText(currentDialogue.text, npc.name);
                }
            } else {
                this.endNPCInteraction(npc);
            }
        },

        /**
         * 结束NPC交互
         */
        endNPCInteraction(npc) {
            // ===== 清除对话框残留文字，防止下一NPC对话闪烁 =====
            this.dialogBox.dialogueLines = [];
            this.dialogBox.currentText = '';
            this.dialogBox.displayedText = '';
            this.dialogBox.currentSpeakerName = '';
            this.dialogBox.isTyping = false;
            this.dialogBox.currentLineIndex = 0;
            this.dialogBox.onAdvance = null; // 清除回调引用
            this.dialogBox.hide();
            this.player.isInteracting = false;
            this.inputManager.setMovementBlocked(false);
            npc.endDialogue();
        }

});
