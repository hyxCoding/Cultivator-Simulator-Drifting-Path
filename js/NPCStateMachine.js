/**
 * NPC状态机类
 * 管理NPC的状态切换和状态行为
 */
class NPCStateMachine {
    /**
     * @param {NPC} npc - NPC实例
     */
    constructor(npc) {
        this.npc = npc;
        
        // 状态定义
        this.states = {
            idle: {
                enter: () => {
                    this.npc.isMoving = false;
                    this.npc.velocity = { x: 0, y: 0 };
                },
                exit: () => {},
            },
            patrol: {
                enter: () => {
                    this.npc.isWaiting = false;
                },
                exit: () => {
                    this.npc.path = [];
                    this.npc.currentPathIndex = 0;
                },
            },
            follow: {
                enter: () => {},
                exit: () => {
                    this.npc.path = [];
                    this.npc.currentPathIndex = 0;
                },
            },
            talk: {
                enter: () => {
                    this.npc.isMoving = false;
                    this.npc.velocity = { x: 0, y: 0 };
                },
                exit: () => {
                    this.npc.dialogueSystem.endDialogue();
                },
            },
            quest: {
                enter: () => {
                    this.npc.isMoving = false;
                    this.npc.velocity = { x: 0, y: 0 };
                },
                exit: () => {},
            },
            flee: {
                enter: () => {},
                exit: () => {
                    this.npc.path = [];
                    this.npc.currentPathIndex = 0;
                },
            },
        };
    }

    /**
     * 更新状态机
     */
    update(deltaTime, map) {
        // 状态行为在NPC的update方法中处理
        // 这里可以放置通用的状态检查逻辑
    }

    /**
     * 进入状态
     */
    enterState(stateName) {
        if (this.states[stateName] && this.states[stateName].enter) {
            this.states[stateName].enter();
        }
    }

    /**
     * 退出状态
     */
    exitState(stateName) {
        if (this.states[stateName] && this.states[stateName].exit) {
            this.states[stateName].exit();
        }
    }
}