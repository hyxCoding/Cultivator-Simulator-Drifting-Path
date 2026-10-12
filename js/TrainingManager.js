/**
 * 训练管理器
 * 管理基础操作教学的全流程：创建训练目标、检测完成、回调通知
 */
class TrainingManager {
    /**
     * 基础操作教学的 4 个地面标记（世界坐标，像素）
     * 位置：青岚浮野中央广场（1040, 600）附近；坐标已按地图碰撞图
     * （assets/images/maps/qinglan_fuye/_collision.png，白色=可通行）逐点校验为可通行地面。
     * 按键与需求书一致：J 普通攻击 / U 灵息弹 / I 护体术 / L 闪避
     * @returns {Array}
     */
    static get BASIC_TRAINING_LAYOUT() {
        return [
            {
                id: 'training_attack',
                name: '普通攻击',
                position: { x: 1680, y: 1087 },
                actionType: 'attack',
                actionKey: 'j',
                promptText: '靠近并按 J 施展普通攻击',
            },
            {
                id: 'training_lingxidan',
                name: '灵息弹',
                position: { x: 1556, y: 1070 },
                actionType: 'skill_lingxidan',
                actionKey: 'u',
                promptText: '靠近并按 U 施展灵息弹',
            },
            {
                id: 'training_hutishu',
                name: '护体术',
                position: { x: 1476, y: 962 },
                actionType: 'skill_hutishu',
                actionKey: 'i',
                promptText: '靠近并按 I 施展护体术',
            },
            {
                id: 'training_dodge',
                name: '闪避',
                position: { x: 1484, y: 831 },
                actionType: 'dodge',
                actionKey: 'l',
                promptText: '靠近并按 L 闪避',
            },
        ];
    }

    constructor() {
        /** @type {TrainingZone[]} */
        this.zones = [];
        this.isActive = false;
        this.onAllCompleted = null; // callback when all zones done
        this.completedCount = 0;
        // 玩家附近正在提示的 zone
        this.nearbyZone = null;
        // 本次训练对应的任务目标 target（第一章为 'basic'，第二章剑修试炼为 'sword'）
        this.currentTarget = 'basic';
        this.currentLabel = '基础训练';
    }

    /**
     * 开始基础训练
     * @param {Function} onComplete - 全部完成时的回调
     * @param {Object} [options] - 可选项
     * @param {Array} [options.layout] - 教学圈布局（缺省 = 青岚浮野中央广场的 BASIC_TRAINING_LAYOUT；
     *                                    第二章云渡泽的剑修试炼用 Chapter2Config.getSwordTrainingLayout()）
     * @param {string} [options.target] - 完成后要推进的任务目标 target（缺省 'basic'）
     * @param {string} [options.label] - 日志用名称
     */
    startBasicTraining(onComplete, options = {}) {
        const layout = Array.isArray(options.layout) && options.layout.length > 0
            ? options.layout
            : TrainingManager.BASIC_TRAINING_LAYOUT;

        this.zones = layout.map(config => new TrainingZone({
            id: config.id,
            name: config.name,
            position: config.position,
            actionType: config.actionType,
            actionKey: config.actionKey,
            promptText: config.promptText,
            radius: 52,          // 地面标记的绘制半径
            detectRadius: 40,    // 判定半径（略小于绘制半径，避免相邻圆球相互干扰）
        }));

        this.completedCount = 0;
        this.nearbyZone = null;
        this.isActive = true;
        // 本次训练要推进的任务目标（Main.onAllCompleted 读取）
        this.currentTarget = options.target || 'basic';
        this.currentLabel = options.label || '基础训练';
        if (onComplete) {
            this.onAllCompleted = onComplete;
        }

        Logger.log(`[TrainingManager] ${this.currentLabel} 开始，${this.zones.length} 个目标已放置`);
    }

    /**
     * 每帧更新
     * @param {number} deltaTime
     * @param {Player} player
     * @param {Object} input - 输入状态
     */
    update(deltaTime, player) {
        if (!this.isActive || !player) return;

        // 更新每个 zone，并记录玩家附近的训练目标（取最近的一个）
        this.nearbyZone = null;
        let nearestDistance = Infinity;
        for (const zone of this.zones) {
            zone.update(deltaTime);
            if (zone.isCompleted) continue;

            const dx = zone.position.x - player.position.x;
            const dy = zone.position.y - player.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= zone.detectRadius && distance < nearestDistance) {
                nearestDistance = distance;
                this.nearbyZone = zone;
            }
        }

        // 说明：训练是否完成由"真实施展对应战斗行为"驱动
        // （PlayerCombatSystem 施展成功后调用 notifyAction），
        // 这里不再直接读取按键，避免"随便按键即可完成"与真实战斗行为脱节。

        // 检查所有是否完成
        if (this.completedCount === this.zones.length) {
            this._allCompleted();
        }
    }

    /**
     * 由 PlayerCombatSystem 通知"玩家刚施展了某个战斗行为"
     * 只有真实施展成功（灵息足够、冷却结束）且站在对应训练圆球范围内才会完成该步骤
     * @param {string} actionType - 'attack' | 'skill_lingxidan' | 'skill_hutishu' | 'dodge'
     * @param {Player} [player] - 玩家实例（用于立即刷新附近目标）
     * @returns {boolean} 是否完成了某个训练目标
     */
    notifyAction(actionType, player) {
        if (!this.isActive) return false;

        // 行为与移动同帧发生：先用最新坐标刷新一次"附近目标"
        if (player) this.update(0, player);

        const zone = this.nearbyZone;
        if (!zone || zone.isCompleted || zone.actionType !== actionType) return false;

        if (!this._completeZone(zone)) return false;

        // 教学保底：每完成一步回复一部分灵息，避免练习时灵息耗尽导致教学卡住
        if (player && player.isAlive) {
            player.restoreMana(15);
        }

        if (this.completedCount === this.zones.length) {
            this._allCompleted();
        }
        return true;
    }

    /**
     * 某个教学动作是否已完成（用于教学期逐格解锁左下角技能栏）
     * @param {string} actionType - 'attack' | 'skill_lingxidan' | 'skill_hutishu' | 'dodge'
     * @returns {boolean}
     */
    isTrainingActionCompleted(actionType) {
        if (!actionType) return false;
        return this.zones.some(zone => zone && zone.actionType === actionType && zone.isCompleted);
    }

    /**
     * 已完成的教学动作类型列表（便于外部按技能栏顺序判断解锁进度）
     * @returns {string[]}
     */
    getCompletedActionTypes() {
        return this.zones
            .filter(zone => zone && zone.isCompleted)
            .map(zone => zone.actionType);
    }

    /**
     * 渲染所有训练目标
     */
    render(ctx, camera) {
        if (!this.isActive) return;
        for (const zone of this.zones) {
            zone.render(ctx, camera);
        }
    }

    /**
     * 渲染附近训练目标的提示
     */
    renderPrompt(ctx, camera) {
        if (!this.isActive || !this.nearbyZone) return;
        this.nearbyZone.renderPrompt(ctx, camera);
    }

    /**
     * 完成一个训练目标
     * @param {TrainingZone} zone
     * @returns {boolean} 是否完成成功（已完成过则返回 false）
     */
    _completeZone(zone) {
        if (!zone.complete()) return false;

        this.completedCount++;
        Logger.log(`[TrainingManager] 完成训练: ${zone.name} (${this.completedCount}/${this.zones.length})`);
        return true;
    }

    /**
     * 全部完成
     */
    _allCompleted() {
        this.isActive = false;
        this.nearbyZone = null;
        Logger.log('[TrainingManager] 基础训练全部完成！');
        if (this.onAllCompleted) {
            this.onAllCompleted();
        }
    }

    /**
     * 强制结束训练（如玩家切换地图）
     */
    cancel() {
        this.isActive = false;
        this.zones = [];
        this.nearbyZone = null;
        this.completedCount = 0;
    }

    serialize() {
        return {
            isActive: this.isActive,
            completedCount: this.completedCount,
            zones: this.zones.map(z => z.serialize()),
        };
    }

    deserialize(data) {
        if (!data) return;
        this.isActive = data.isActive || false;
        this.completedCount = data.completedCount || 0;
        if (data.zones) {
            data.zones.forEach(zoneData => {
                const existing = this.zones.find(z => z.id === zoneData.id);
                if (existing) existing.deserialize(zoneData);
            });
        }
    }
}

if (typeof window !== 'undefined') window.TrainingManager = TrainingManager;