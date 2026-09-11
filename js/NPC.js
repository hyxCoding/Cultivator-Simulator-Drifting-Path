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
        this.defaultFacing = 'down';        // NPC默认朝向（对话结束后恢复）
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
        
        // ========== NPC自定义状态 ==========
        this.npcState = config.initialNpcState || {}; // NPC内部状态（如受伤、已治疗等）
        this.animationOverridden = false;         // 外部锁定动画，阻止 updateAnimation 覆盖
        
        // ========== 基础动画配置（idle / walk 的帧尺寸、排列方式） ==========
        this.baseAnimations = config.baseAnimations || {};
        
        // ========== NPC显示尺寸（来自基础空闲动画的帧尺寸） ==========
        if (this.baseAnimations.idle) {
            this.width = this.baseAnimations.idle.frameWidth || 24;
            this.height = this.baseAnimations.idle.frameHeight || 32;
        }
        // 显示缩放系数（渲染时 displaySize = frameSize * displayScale）
        this.displayScale = 2;
        
        // ========== 额外动画配置 ==========
        this.extraAnimations = config.extraAnimations || []; // NPC额外动画配置
        
        // ========== 回调 ==========
        this.onInteract = null;      // 交互回调
        this.onReachTarget = null;   // 到达目标回调
        this.onDialogueEnd = null;   // 对话结束回调
        this.onOpenShop = null;      // 打开商店回调
        this.onBreathHeal = null;      // 定息引气回调
        this.onFoundationTrial = null; // 筑基调息回调（章末：禁键 → 主角朝下 → 背后气场 5 秒 → 续接对话）
        
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
        
        const animationConfigs = [];
        
        // ----- 基础 idle 动画 -----
        // 优先使用 NPC 自定义配置，否则回退默认
        const idleAnim = this.baseAnimations.idle || {
            frameWidth: 24,
            frameHeight: 32,
            directionMode: 'row',
            directions: {
                down:  { row: 0, frames: 1 },
                up:    { row: 3, frames: 1 },
                left:  { row: 1, frames: 1 },
                right: { row: 2, frames: 1 },
            },
            fps: 8,
            loop: true,
        };
        animationConfigs.push({
            name: 'idle',
            resourcePath: `${resourcePrefix}_idle`,
            frameWidth: idleAnim.frameWidth,
            frameHeight: idleAnim.frameHeight,
            directionMode: idleAnim.directionMode,
            directions: idleAnim.directions,
            fps: idleAnim.fps,
            loop: idleAnim.loop,
        });
        
        // ----- 基础 walk 动画 -----
        const walkAnim = this.baseAnimations.walk || {
            frameWidth: 24,
            frameHeight: 32,
            directionMode: 'row',
            directions: {
                down:  { row: 0, frames: 1 },
                up:    { row: 3, frames: 1 },
                left:  { row: 1, frames: 1 },
                right: { row: 2, frames: 1 },
            },
            fps: 10,
            loop: true,
        };
        animationConfigs.push({
            name: 'walk',
            resourcePath: `${resourcePrefix}_walk`,
            frameWidth: walkAnim.frameWidth,
            frameHeight: walkAnim.frameHeight,
            directionMode: walkAnim.directionMode,
            directions: walkAnim.directions,
            fps: walkAnim.fps,
            loop: walkAnim.loop,
        });
        
        // ----- 额外动画（heal、stand_idle 等） -----
        if (this.extraAnimations.length > 0) {
            animationConfigs.push(...this.extraAnimations);
        }
        
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

    // ==================== 动画变体切换 ====================

    /**
     * 切换到指定动画（如 heal、stand_idle 等额外动画）
     * @param {string} animationName - 动画名称
     * @param {Object} [options] - 播放选项
     */
    setAnimation(animationName, options = {}) {
        if (this.animationManager.hasAnimation(animationName)) {
            this.animationManager.play(animationName, { loop: options.loop !== false, ...options });
        } else {
            console.warn(`NPC ${this.id} 没有动画: ${animationName}`);
        }
    }

    /**
     * 恢复默认 idle 动画
     */
    setIdleAnimation() {
        this.animationManager.play('idle', { loop: true });
    }

    // ==================== NPC状态管理 ====================

    /**
     * 设置NPC内部状态
     * @param {string} key - 状态键
     * @param {*} value - 状态值
     */
    setNpcState(key, value) {
        this.npcState[key] = value;
    }

    /**
     * 获取NPC内部状态
     * @param {string} key - 状态键
     * @returns {*} 状态值
     */
    getNpcState(key) {
        return this.npcState[key];
    }

    // ==================== NPC间交互 ====================

    /**
     * 阿禾对阿砚执行治疗（自动动画序列）
     * - 阿禾播放 heal 动画
     * - 阿砚切换为站立动画
     * 此方法由任务完成回调触发，不需要玩家交互
     * @param {NPC} ayan - 阿砚NPC实例
     */
    performHeal(ayan) {
        if (!ayan || this.id !== 'ahe') return;

        // 锁定动画（阻止 updateAnimation 覆盖）
        this.animationOverridden = true;

        // 阿禾播放治疗动画（播放一次，不循环）
        this.setAnimation('heal', { loop: false });
        this.facing = 'down';

        // 动画播放完成后，阿砚切换为站立状态
        // 估算 heal 动画时长：假设单帧，约1秒
        const healDuration = 1000;

        setTimeout(() => {
            // 阿砚切换为站立 idle（锁定动画，不被 updateAnimation 覆盖）
            ayan.animationOverridden = true;
            if (ayan.animationManager.hasAnimation('stand_idle')) {
                ayan.setAnimation('stand_idle', { loop: true });
                ayan.setNpcState('healed', true);
                console.log(`[NPC] ${ayan.name} 已被 ${this.name} 治愈，切换为站立动画`);
            }
            // 阿禾恢复 idle，解锁动画
            this.animationOverridden = false;
            this.setIdleAnimation();
        }, healDuration);
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
        // 如果动画被外部锁定（如定息引气序列），跳过自动切换，仅更新当前动画
        if (this.animationOverridden) {
            this.animationManager.update(deltaTime);
            return;
        }

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
        
        // 恢复默认朝向（对话期间 faceTarget 改变了朝向）
        this.facing = this.defaultFacing || 'down';
        this.animationManager.setDirection(this.facing);
        
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

    /**
     * 重新定位NPC（瓦片坐标 → 世界坐标）
     * 用于阿禾从开场移到救助点、周叔从被困地回村落等剧情搬迁
     * @param {number} tileX - 目标瓦片 X
     * @param {number} tileY - 目标瓦片 Y
     * @param {GameMap} map - 当前地图实例（用于 tileToWorld 转换）
     */
    reposition(tileX, tileY, map) {
        if (!map) return;
        const worldPos = map.tileToWorld(tileX, tileY);
        this.position.x = worldPos.x;
        this.position.y = worldPos.y;
        // 重置移动状态
        this.isMoving = false;
        this.moveTarget = null;
        this.path = [];
        this.currentPathIndex = 0;
        console.log(`[NPC] ${this.name} 搬迁至瓦片 (${tileX}, ${tileY}) → 世界 (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`);
    }

    /**
     * 重新定位NPC（世界坐标，像素）
     * 用于按美术图实测像素点精确摆放（不做瓦片取整）
     * @param {number} worldX - 目标世界坐标 X（像素）
     * @param {number} worldY - 目标世界坐标 Y（像素）
     * @param {GameMap} map - 当前地图实例（可选，仅用于日志中换算瓦片）
     */
    repositionWorld(worldX, worldY, map) {
        this.position.x = worldX;
        this.position.y = worldY;
        // 重置移动状态
        this.isMoving = false;
        this.moveTarget = null;
        this.path = [];
        this.currentPathIndex = 0;
        const tile = (map && map.worldToTile) ? map.worldToTile(worldX, worldY) : null;
        const tileInfo = tile ? `（约瓦片 ${tile.x}, ${tile.y}）` : '';
        console.log(`[NPC] ${this.name} 搬迁至世界坐标 (${Math.round(worldX)}, ${Math.round(worldY)})${tileInfo}`);
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
            this.width * this.displayScale,
            this.height * this.displayScale
        );
    }

    /**
     * 渲染交互提示（按 E 对话）
     * 在 NPC 头顶显示，拾取物提示的同款样式
     */
    renderPrompt(ctx, camera) {
        if (!this.canInteract) return;
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        const screenY = this.position.y - renderPos.y - this.height * this.displayScale - 10;
        const text = '按 E 对话';
        ctx.font = 'bold 13px Microsoft YaHei';
        const textWidth = ctx.measureText(text).width;
        // 半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const px = screenX - textWidth / 2 - 10;
        const py = screenY - 10;
        ctx.beginPath();
        ctx.roundRect(px, py, textWidth + 20, 24, 6);
        ctx.fill();
        // 金色文字
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, screenX, screenY);
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
            npcState: { ...this.npcState },
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
        if (data.npcState) this.npcState = { ...data.npcState };
        
        // 读档后恢复站立动画（如果已被治疗过）
        if (this.npcState && this.npcState.healed && this.animationManager.hasAnimation('stand_idle')) {
            this.animationManager.play('stand_idle', { loop: true });
        }
    }
}