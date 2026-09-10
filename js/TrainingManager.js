/**
 * 训练管理器
 * 管理基础操作教学的全流程：创建训练目标、检测完成、回调通知
 */
class TrainingManager {
    constructor() {
        /** @type {TrainingZone[]} */
        this.zones = [];
        this.isActive = false;
        this.onAllCompleted = null; // callback when all zones done
        this.completedCount = 0;
        // 玩家附近正在提示的 zone
        this.nearbyZone = null;
    }

    /**
     * 开始基础训练
     * 在中央广场 (1040,600) 附近创建 4 个训练目标
     * @param {Function} onComplete - 全部完成时的回调
     */
    startBasicTraining(onComplete) {

        this.zones = [
            new TrainingZone({
                id: 'training_attack',
                name: '普通攻击',
                position: { x: 1718, y: 1100 },
                actionType: 'attack',
                actionKey: 'j',
                promptText: '靠近并按 J 施展普通攻击',
            }),
            new TrainingZone({
                id: 'training_lingxidan',
                name: '灵息弹',
                position: { x: 1578, y: 1080 },
                actionType: 'skill_lingxidan',
                actionKey: 'k',
                promptText: '靠近并按 K 施展灵息弹',
            }),
            new TrainingZone({
                id: 'training_hutishu',
                name: '护体术',
                position: { x: 1485, y: 1008 },
                actionType: 'skill_hutishu',
                actionKey: 'l',
                promptText: '靠近并按 L 施展护体术',
            }),
            new TrainingZone({
                id: 'training_dodge',
                name: '闪避',
                position: { x: 1466, y: 850 },
                actionType: 'dodge',
                actionKey: 'shift',
                promptText: '靠近并按 Shift 闪避',
            }),
        ];

        this.completedCount = 0;
        this.nearbyZone = null;
        this.isActive = true;
        if (onComplete) {
            this.onAllCompleted = onComplete;
        }

        console.log('[TrainingManager] 基础训练开始，4个目标已放置');
    }

    /**
     * 每帧更新
     * @param {number} deltaTime
     * @param {Player} player
     * @param {Object} input - 输入状态
     */
    update(deltaTime, player, input) {
        if (!this.isActive || !player) return;

        // 更新每个 zone
        this.nearbyZone = null;
        for (const zone of this.zones) {
            zone.update(deltaTime);
            if (!zone.isCompleted && zone.isPlayerInRange(player.position)) {
                this.nearbyZone = zone;
            }
        }

        // 检查按键完成训练
        if (this.nearbyZone && input && input.pressedKeys) {
            const zone = this.nearbyZone;
            let actionPerformed = false;

            switch (zone.actionKey) {
                case 'j':
                    if (input.pressedKeys['j'] || input.pressedKeys[' ']) {
                        actionPerformed = true;
                    }
                    break;
                case 'k':
                    if (input.pressedKeys['k']) {
                        actionPerformed = true;
                    }
                    break;
                case 'l':
                    if (input.pressedKeys['l']) {
                        actionPerformed = true;
                    }
                    break;
                case 'shift':
                    if (input.pressedKeys['Shift']) {
                        actionPerformed = true;
                    }
                    break;
            }

            // 也允许按 E 作为备用完成方式
            if (!actionPerformed && input.pressedKeys['e']) {
                actionPerformed = true;
            }

            if (actionPerformed) {
                this._completeZone(zone);
            }
        }

        // 检查所有是否完成
        if (this.completedCount === this.zones.length) {
            this._allCompleted();
        }
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
     */
    _completeZone(zone) {
        if (zone.complete()) {
            this.completedCount++;
            console.log(`[TrainingManager] 完成训练: ${zone.name} (${this.completedCount}/4)`);
        }
    }

    /**
     * 全部完成
     */
    _allCompleted() {
        this.isActive = false;
        this.nearbyZone = null;
        console.log('[TrainingManager] 基础训练全部完成！');
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