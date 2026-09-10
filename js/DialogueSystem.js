/**
 * 对话系统类
 * 管理NPC的对话内容和玩家选择
 */
class DialogueSystem {
    /**
     * @param {NPC} npc - NPC实例
     * @param {Object} dialogues - 对话配置
     */
    constructor(npc, dialogues = {}) {
        this.npc = npc;
        this.dialogues = dialogues;
        
        this.currentDialogue = null;    // 当前对话内容
        this.currentDialogueId = null;  // 当前对话ID
        this.dialogueHistory = [];      // 对话历史
        this.isActive = false;          // 对话是否进行中
        this.currentOptions = [];       // 当前可选项
        this._savedOnComplete = [];     // 保存的 on_complete 列表（endDialogue 清空前保存）
        
        // 回调
        this.onDialogueStart = null;
        this.onDialogueEnd = null;
        this.onOptionSelected = null;
    }

    /**
     * 更新对话系统
     */
    update(deltaTime) {
        // 对话状态更新（如打字机效果等）
    }

    /**
     * 开始对话
     * @param {string} dialogueId - 对话ID（可选）
     */
    startDialogue(dialogueId = null) {
        const dialogue = dialogueId ? 
            this.getDialogue(dialogueId) : 
            this.getDefaultDialogue();
        
        if (!dialogue) {
            console.warn(`NPC ${this.npc.id} 没有可用对话`);
            return false;
        }
        
        this.currentDialogue = dialogue;
        this.currentDialogueId = dialogue.id;
        this.isActive = true;
        this.dialogueHistory.push(dialogue.id);
        this._savedOnComplete = (dialogue.on_complete || []).slice(); // 保存 on_complete 列表
        
        if (this.onDialogueStart) {
            this.onDialogueStart(this.currentDialogue);
        }
        
        return true;
    }

    /**
     * 获取当前对话的 on_complete 回调列表
     * @returns {string[]}
     */
    getCurrentOnComplete() {
        if (this.currentDialogue) {
            return this.currentDialogue.on_complete || [];
        }
        // 对话已结束但还未读取 on_complete 时，返回保存的列表
        return this._savedOnComplete || [];
    }

    /**
     * 结束对话
     */
    endDialogue() {
        if (!this.isActive) return; // 防止重复调用
        
        // 在清空前保存 on_complete 列表
        if (this.currentDialogue) {
            this._savedOnComplete = (this.currentDialogue.on_complete || []).slice();
        }
        
        this.isActive = false;
        this.currentDialogue = null;
        this.currentDialogueId = null;
        this.currentOptions = [];
        
        if (this.onDialogueEnd) {
            this.onDialogueEnd();
        }
    }

    /**
     * 获取默认对话
     */
    getDefaultDialogue() {
        const dialogueIds = Object.keys(this.dialogues);
        if (dialogueIds.length === 0) return null;
        
        return this.dialogues[dialogueIds[0]];
    }

    /**
     * 获取指定对话
     */
    getDialogue(dialogueId) {
        return this.dialogues[dialogueId] || null;
    }

    /**
     * 获取当前对话选项
     */
    getCurrentOptions() {
        if (!this.currentDialogue || !this.currentDialogue.options) {
            return [];
        }
        
        return this.currentDialogue.options;
    }

    /**
     * 选择对话选项
     * @param {number} optionIndex - 选项索引
     */
    selectOption(optionIndex) {
        if (!this.currentDialogue || !this.currentDialogue.options) {
            return null;
        }
        
        const option = this.currentDialogue.options[optionIndex];
        if (!option) return null;
        
        // 触发选项选择回调
        if (this.onOptionSelected) {
            this.onOptionSelected(option);
        }
        
        // 处理选项逻辑
        if (option.action) {
            this.executeAction(option.action);
        }
        
        // 跳转到下一个对话
        if (option.next) {
            const nextDialogue = this.getDialogue(option.next);
            if (nextDialogue) {
                this.currentDialogue = nextDialogue;
                this.currentDialogueId = nextDialogue.id;
                this.dialogueHistory.push(nextDialogue.id);
            }
        } else {
            // 无下一个对话，结束
            this.endDialogue();
        }
        
        return option;
    }

    /**
     * 执行对话选项动作
     */
    executeAction(action) {
        if (!action) return;
        
        switch (action) {
            case 'end_dialogue':
                this.endDialogue();
                break;
            case 'open_shop':
                // 打开商店
                if (this.npc.onOpenShop) {
                    this.npc.onOpenShop();
                }
                break;
            case 'start_basic_training':
                // 开始基础训练
                if (this.npc.onStartTraining) {
                    this.npc.onStartTraining();
                }
                break;
            case 'start_breath_heal_sequence':
                // 定息引气：阿禾引导玩家为阿砚疗伤
                if (this.npc.onBreathHeal) {
                    this.npc.onBreathHeal();
                }
                break;
            default:
                if (action.startsWith('start_quest_') || action.startsWith('accept_quest_')) {
                    // 开始任务
                    const questId = action.replace(/^(start_quest_|accept_quest_)/, '');
                    if (this.npc.onAssignQuest) {
                        this.npc.onAssignQuest(questId);
                    }
                }
                break;
        }
    }

    /**
     * 检查对话是否已进行过
     */
    hasDialogueOccurred(dialogueId) {
        return this.dialogueHistory.includes(dialogueId);
    }

    /**
     * 序列化对话系统状态
     */
    serialize() {
        return {
            dialogueHistory: [...this.dialogueHistory],
            currentDialogueId: this.currentDialogueId,
            isActive: this.isActive,
        };
    }

    /**
     * 反序列化对话系统状态
     */
    deserialize(data) {
        if (!data) return;
        
        this.dialogueHistory = data.dialogueHistory || [];
        this.currentDialogueId = data.currentDialogueId || null;
        this.isActive = data.isActive || false;
        
        if (this.currentDialogueId) {
            this.currentDialogue = this.getDialogue(this.currentDialogueId);
        }
    }
}

