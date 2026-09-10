/**
 * NPC类
 * 包含A*寻路、状态机、对话系统
 * 动画更新在内部update方法中处理
 */
class NPC {
    /**
     * @param {Object} config - NPC配置
     * @param {string} config.id - NPC唯一ID
     * @param {string} config.name - NPC名称
     * @param {Object} config.position - 初始位置 {x, y}（世界坐标，像素）
     * @param {Object} config.dialogues - 对话配置
     * @param {Object} config.animationManager - 动画管理器实例（可选）
     * @param {number} config.moveSpeed - 移动速度，默认80
     * @param {boolean} config.isStatic - 是否静止不动，默认false
     */
    constructor(config = {}) {
        // ========== 基本信息 ==========
        this.id = config.id || `npc_${Date.now()}`;
        this.name = config.name || '无名氏';
        
        // ========== 基本物理数据 ==========
        this.position = config.position || { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0 };
        this.width = 24;
        this.height = 32;
        this.facing = 'down';
        this.moveSpeed = config.moveSpeed || 80;
        this.isStatic = config.isStatic || false; // 是否静止NPC
        
        // ========== 动画系统 ==========
        this.animationManager = config.animationManager || new AnimationManager();
        
        // ========== 移动相关 ==========
        this.isMoving = false;
        this.moveTarget = null;        // 当前移动目标 {x, y}（世界坐标）
        this.path = [];                // A*寻路结果路径
        this.currentPathIndex = 0;     // 当前路径索引
        this.pathUpdateInterval = 0.5; // 路径重算间隔（秒）
        this.pathUpdateTimer = 0;
        this.reachedThreshold = 10;    // 到达判定阈值（像素）
        
        // ========== 巡逻相关 ==========
        this.patrolPoints = config.patrolPoints || []; // 巡逻点列表 [{x, y}, ...]
        this.currentPatrolIndex = 0;
        this.patrolWaitTime = 2;       // 到达巡逻点后等待时间（秒）
        this.patrolWaitTimer = 0;
        this.isWaiting = false;
        
        // ========== 状态机 ==========
        this.stateMachine = new NPCStateMachine(this);
        this.currentState = 'idle'; // idle, patrol, follow, talk, quest, flee
        
        // ========== 对话系统 ==========
        this.dialogueSystem = new DialogueSystem(this, config.dialogues || {});
        
        // ========== 交互相关 ==========
        this.interactionRadius = 50;
        this.canInteract = true;
        
        // ========== 商店相关 ==========
        this.shopItems = config.shopItems || []; // NPC的商店物品列表
        
        // ========== 任务相关 ==========
        this.assignedQuests = config.assignedQuests || []; // NPC可发布的任务ID列表
        this.questProgress = new Map(); // 玩家与该NPC的任务进度
        
        // ========== 回调 ==========
        this.onInteract = null;      // 交互回调
        this.onReachTarget = null;   // 到达目标回调
        this.onDialogueEnd = null;   // 对话结束回调
        this.onOpenShop = null;      // 打开商店回调
        
        // ========== 初始化 ==========
        this.initAnimations();
    }

    // ==================== 动画初始化 ====================

    /**
     * 初始化NPC动画
     */
    initAnimations() {
        const resourceManager = ResourceManager.getInstance();
        
        // NPC动画资源路径基于NPC ID
        const resourcePrefix = `npc.${this.id}`;
        
        const animationConfigs = [
            {
                name: 'idle',
                resourcePath: `${resourcePrefix}_idle`,
                frameWidth: 24,
                frameHeight: 32,
                directionMode: 'row',
                directions: {
                    down:  { col: 0, frames: 1 },
                    up:    { col: 3, frames: 1 },
                    left:  { col: 1, frames: 1 },
                    right: { col: 2, frames: 1 },
                },
                fps: 8,
                loop: true,
            },
            {
                name: 'walk',
                resourcePath: `${resourcePrefix}_walk`,
                frameWidth: 24,
                frameHeight: 32,
                directionMode: 'row',
                directions: {
                    down:  { col: 0, frames: 1 },
                    up:    { col: 3, frames: 1 },
                    left:  { col: 1, frames: 1 },
                    right: { col: 2, frames: 1 },
                },
                fps: 10,
                loop: true,
            },
        ];
        
        this.loadAnimations(animationConfigs);
    }

    /**
     * 异步加载动画
     */
    async loadAnimations(animationConfigs) {
        const resourceManager = ResourceManager.getInstance();
        
        for (const config of animationConfigs) {
            try {
                const spriteSheet = await resourceManager.loadImage(config.resourcePath);
                
                const animation = new Animation({
                    name: config.name,
                    spriteSheet: spriteSheet,
                    frameWidth: config.frameWidth,
                    frameHeight: config.frameHeight,
                    directionMode: config.directionMode,
                    directions: config.directions,
                    fps: config.fps,
                    loop: config.loop,
                    scale: 1.5,
                    defaultDirection: 'down',
                });
                
                this.animationManager.addAnimation(config.name, animation);
            } catch (error) {
                console.warn(`NPC ${this.id} 加载动画失败: ${config.name}`, error);
            }
        }
        
        this.animationManager.play('idle');
        this.animationManager.setDirection('down');
    }

    // ==================== 更新逻辑 ====================

    /**
     * 更新NPC
     * @param {number} deltaTime - 时间增量（秒）
     * @param {GameMap} map - 当前地图
     */
    update(deltaTime, map) {
        // 更新状态机
        this.stateMachine.update(deltaTime, map);
        
        // 根据当前状态执行行为
        switch (this.currentState) {
            case 'idle':
                this.updateIdle(deltaTime, map);
                break;
            case 'patrol':
                this.updatePatrol(deltaTime, map);
                break;
            case 'follow':
                this.updateFollow(deltaTime, map);
                break;
            case 'talk':
                this.updateTalk(deltaTime);
                break;
            case 'quest':
                this.updateQuest(deltaTime);
                break;
            case 'flee':
                this.updateFlee(deltaTime, map);
                break;
        }
        
        // 更新动画
        this.updateAnimation(deltaTime);
        
        // 更新对话系统
        this.dialogueSystem.update(deltaTime);
    }

    /**
     * 更新待机状态
     */
    updateIdle(deltaTime, map) {
        this.isMoving = false;
        this.velocity = { x: 0, y: 0 };
    }

    /**
     * 更新巡逻状态
     */
    updatePatrol(deltaTime, map) {
        if (this.isStatic || this.patrolPoints.length === 0) {
            this.changeState('idle');
            return;
        }
        
        // 如果在等待
        if (this.isWaiting) {
            this.patrolWaitTimer -= deltaTime;
            this.isMoving = false;
            this.velocity = { x: 0, y: 0 };
            
            if (this.patrolWaitTimer <= 0) {
                this.isWaiting = false;
                this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
            }
            return;
        }
        
        // 获取当前巡逻目标
        const target = this.patrolPoints[this.currentPatrolIndex];
        
        // 检查是否到达
        const distance = this.getDistanceTo(target);
        if (distance <= this.reachedThreshold) {
            // 到达，等待
            this.isWaiting = true;
            this.patrolWaitTimer = this.patrolWaitTime;
            return;
        }
        
        // 移动向目标
        this.moveTowards(target, deltaTime, map);
    }

    /**
     * 更新跟随状态
     */
    updateFollow(deltaTime, map) {
        if (!this.moveTarget) {
            this.changeState('idle');
            return;
        }
        
        // 检查距离
        const distance = this.getDistanceTo(this.moveTarget);
        if (distance <= this.reachedThreshold) {
            this.isMoving = false;
            this.velocity = { x: 0, y: 0 };
            
            if (this.onReachTarget) {
                this.onReachTarget(this.moveTarget);
                this.moveTarget = null;
            }
            return;
        }
        
        this.moveTowards(this.moveTarget, deltaTime, map);
    }

    /**
     * 更新对话状态
     */
    updateTalk(deltaTime) {
        this.isMoving = false;
        this.velocity = { x: 0, y: 0 };
    }

    /**
     * 更新任务状态
     */
    updateQuest(deltaTime) {
        this.isMoving = false;
        this.velocity = { x: 0, y: 0 };
    }

    /**
     * 更新逃跑状态
     */
    updateFlee(deltaTime, map) {
        if (!this.moveTarget) {
            this.changeState('idle');
            return;
        }
        
        // 远离目标
        const dx = this.position.x - this.moveTarget.x;
        const dy = this.position.y - this.moveTarget.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const fleeX = this.position.x + (dx / distance) * 100;
            const fleeY = this.position.y + (dy / distance) * 100;
            this.moveTowards({ x: fleeX, y: fleeY }, deltaTime, map);
        }
    }

    /**
     * 向目标移动（带寻路和碰撞检测）
     * @param {Object} target - 目标位置 {x, y}
     * @param {number} deltaTime - 时间增量
     * @param {GameMap} map - 地图
     */
    moveTowards(target, deltaTime, map) {
        // 更新路径重算计时器
        this.pathUpdateTimer -= deltaTime;
        
        // 需要重新计算路径
        if (this.pathUpdateTimer <= 0 || this.path.length === 0) {
            if (map) {
                this.path = AStar.findPath(
                    this.position,
                    target,
                    map.getWalkableGrid(),
                    map.tileSize
                );
                this.currentPathIndex = 0;
                this.pathUpdateTimer = this.pathUpdateInterval;
            }
        }
        
        // 如果有路径，沿路径移动
        if (this.path.length > 0) {
            this.followPath(deltaTime, map);
        } else {
            // 无路径（可能没有地图数据），直接直线移动
            this.moveDirectly(target, deltaTime, map);
        }
    }

    /**
     * 沿A*路径移动
     */
    followPath(deltaTime, map) {
        if (this.currentPathIndex >= this.path.length) {
            this.isMoving = false;
            this.velocity = { x: 0, y: 0 };
            return;
        }
        
        const waypoint = this.path[this.currentPathIndex];
        const distance = this.getDistanceTo(waypoint);
        
        // 到达当前路径点
        if (distance <= this.reachedThreshold) {
            this.currentPathIndex++;
            
            if (this.currentPathIndex >= this.path.length) {
                this.isMoving = false;
                this.velocity = { x: 0, y: 0 };
            }
            return;
        }
        
        // 移动向路径点
        this.moveDirectly(waypoint, deltaTime, map);
    }

    /**
     * 直接向目标移动（无寻路）
     */
    moveDirectly(target, deltaTime, map) {
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) {
            this.isMoving = false;
            this.velocity = { x: 0, y: 0 };
            return;
        }
        
        // 计算移动方向
        const moveX = dx / distance;
        const moveY = dy / distance;
        
        // 更新朝向
        this.updateFacing(moveX, moveY);
        
        // 计算速度
        this.velocity.x = moveX * this.moveSpeed;
        this.velocity.y = moveY * this.moveSpeed;
        this.isMoving = true;
        
        // 计算新位置
        const step = this.moveSpeed * deltaTime;
        const newX = this.position.x + moveX * step;
        const newY = this.position.y + moveY * step;
        
        // 碰撞检测移动
        this.moveWithCollision(newX, newY, map);
    }

    /**
     * 带碰撞检测的移动
     */
    moveWithCollision(newX, newY, map) {
        if (!map) {
            this.position.x = newX;
            this.position.y = newY;
            return;
        }
        
        // X轴
        const xRect = {
            x: newX - this.width / 2,
            y: this.position.y - this.height / 2,
            width: this.width,
            height: this.height,
        };
        
        if (!this.checkCollision(xRect, map)) {
            this.position.x = newX;
        }
        
        // Y轴
        const yRect = {
            x: this.position.x - this.width / 2,
            y: newY - this.height / 2,
            width: this.width,
            height: this.height,
        };
        
        if (!this.checkCollision(yRect, map)) {
            this.position.y = newY;
        }
    }

    /**
     * 检查碰撞
     */
    checkCollision(rect, map) {
        const mapBounds = {
            x: 0,
            y: 0,
            width: map.mapWidth * map.tileSize,
            height: map.mapHeight * map.tileSize,
        };
        
        if (rect.x < mapBounds.x ||
            rect.y < mapBounds.y ||
            rect.x + rect.width > mapBounds.x + mapBounds.width ||
            rect.y + rect.height > mapBounds.y + mapBounds.height) {
            return true;
        }
        
        return !map.isRectWalkable(rect);
    }

    /**
     * 更新朝向
     */
    updateFacing(moveX, moveY) {
        if (Math.abs(moveX) > Math.abs(moveY)) {
            this.facing = moveX > 0 ? 'right' : 'left';
        } else {
            this.facing = moveY > 0 ? 'down' : 'up';
        }
    }

    /**
     * 更新动画
     */
    updateAnimation(deltaTime) {
        if (this.isMoving) {
            this.animationManager.play('walk', { reset: false, loop: true });
            this.animationManager.setDirection(this.facing);
        } else {
            this.animationManager.play('idle', { reset: false, loop: true });
            this.animationManager.setDirection(this.facing);
        }
        
        this.animationManager.update(deltaTime);
    }

    // ==================== 状态切换 ====================

    /**
     * 改变NPC状态
     * @param {string} newState - 新状态
     */
    changeState(newState) {
        if (this.currentState === newState) return;
        
        // 退出旧状态
        this.stateMachine.exitState(this.currentState);
        
        // 切换状态
        this.currentState = newState;
        
        // 进入新状态
        this.stateMachine.enterState(newState);
    }

    /**
     * 设置巡逻点
     * @param {Array} points - 巡逻点列表 [{x, y}, ...]
     */
    setPatrolPoints(points) {
        this.patrolPoints = points;
        this.currentPatrolIndex = 0;
    }

    /**
     * 开始跟随玩家
     * @param {Object} target - 跟随目标（通常是玩家位置）
     */
    startFollow(target) {
        this.moveTarget = target;
        this.changeState('follow');
    }

    /**
     * 停止跟随
     */
    stopFollow() {
        this.moveTarget = null;
        this.path = [];
        this.changeState('idle');
    }

    /**
     * 逃跑（远离指定目标）
     * @param {Object} threat - 威胁来源位置 {x, y}
     */
    fleeFrom(threat) {
        this.moveTarget = threat;
        this.changeState('flee');
    }

    // ==================== 交互相关 ====================

    /**
     * 开始对话
     * @param {Player} player - 玩家实例
     * @param {string} dialogueId - 对话ID（可选，不传则使用默认对话）
     */
    startDialogue(player, dialogueId = null) {
        this.changeState('talk');
        
        // 更新朝向面对玩家
        this.faceTarget(player.position);
        
        // 开始对话
        this.dialogueSystem.startDialogue(dialogueId);
        
        if (this.onInteract) {
            this.onInteract(this, player);
        }
    }

    /**
     * 结束对话
     */
    endDialogue() {
        this.dialogueSystem.endDialogue();
        
        this.changeState('idle');
        
        if (this.onDialogueEnd) {
            this.onDialogueEnd(this);
        }
    }

    /**
     * 面向目标
     * @param {Object} targetPosition - 目标位置 {x, y}
     */
    faceTarget(targetPosition) {
        const dx = targetPosition.x - this.position.x;
        const dy = targetPosition.y - this.position.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            this.facing = dx > 0 ? 'right' : 'left';
        } else {
            this.facing = dy > 0 ? 'down' : 'up';
        }
        
        this.animationManager.setDirection(this.facing);
    }

    /**
     * 检查玩家是否在交互范围内
     * @param {Object} playerPosition - 玩家位置
     * @returns {boolean} 是否在范围内
     */
    isPlayerInRange(playerPosition) {
        return this.getDistanceTo(playerPosition) <= this.interactionRadius;
    }

    // ==================== 任务相关 ====================

    /**
     * 发布任务给玩家
     * @param {string} questId - 任务ID
     * @param {Player} player - 玩家实例
     */
    assignQuest(questId, player) {
        if (!this.assignedQuests.includes(questId)) {
            return false;
        }
        
        // 通过玩家任务系统接受任务
        const success = player.questSystem.acceptQuest(questId);
        
        if (success) {
            this.questProgress.set(questId, {
                state: 'in_progress',
                assignedTo: player,
            });
        }
        
        return success;
    }

    /**
     * 检查玩家任务完成情况
     * @param {string} questId - 任务ID
     * @param {Player} player - 玩家实例
     */
    checkQuestCompletion(questId, player) {
        const questState = player.questSystem.getQuestState(questId);
        
        if (questState && questState.completedTime) {
            this.questProgress.set(questId, {
                state: 'completed',
                completedBy: player,
            });
            return true;
        }
        
        return false;
    }

    // ==================== 工具方法 ====================

    /**
     * 获取到目标位置的距离
     */
    getDistanceTo(target) {
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 获取世界坐标转瓦片坐标
     */
    getTilePosition(map) {
        if (!map) return null;
        return map.worldToTile(this.position.x, this.position.y);
    }

    // ==================== 渲染 ====================

    /**
     * 渲染NPC
     */
    render(ctx, camera) {
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x - this.width / 2;
        const screenY = this.position.y - renderPos.y - this.height / 2;
        
        this.animationManager.render(
            ctx,
            screenX,
            screenY,
            this.width * 2,
            this.height * 2
        );
    }

    // ==================== 序列化 ====================

    /**
     * 序列化NPC状态（用于存档）
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            position: { ...this.position },
            facing: this.facing,
            currentState: this.currentState,
            isMoving: this.isMoving,
            currentPatrolIndex: this.currentPatrolIndex,
            patrolWaitTimer: this.patrolWaitTimer,
            isWaiting: this.isWaiting,
            dialogueSystem: this.dialogueSystem.serialize(),
            questProgress: Array.from(this.questProgress.entries()),
            animationManager: this.animationManager.serialize(),
        };
    }

    /**
     * 反序列化NPC状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.id = data.id || this.id;
        this.name = data.name || this.name;
        this.position = data.position || this.position;
        this.facing = data.facing || this.facing;
        this.currentState = data.currentState || this.currentState;
        this.isMoving = data.isMoving || false;
        this.currentPatrolIndex = data.currentPatrolIndex || 0;
        this.patrolWaitTimer = data.patrolWaitTimer || 0;
        this.isWaiting = data.isWaiting || false;
        
        if (data.dialogueSystem) this.dialogueSystem.deserialize(data.dialogueSystem);
        if (data.questProgress) this.questProgress = new Map(data.questProgress);
        if (data.animationManager) this.animationManager.deserialize(data.animationManager);
    }
}