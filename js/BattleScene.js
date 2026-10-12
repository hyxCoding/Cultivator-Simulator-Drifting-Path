/**
 * 战斗场景
 */
class BattleScene extends Scene {
    constructor(main) {
        super('battle');
        this.main = main;
    }

    enter(params = {}) {
        super.enter(params);
        Logger.log('进入战斗');
        
        this.player = params.player;
        this.enemies = params.enemies;
        this.battleSystem = params.battleSystem;
    }

    /**
     * 战斗场景更新 —— **战斗系统的唯一驱动点**
     *
     * 每帧由 GameLoop → SceneManager.update → 本方法调用一次。
     * ⚠ 不可在 Main.update 的 'battle' 分支里再调一次 battleSystem.update：
     *   两处都驱动会让同一帧推进两遍（回合倒计时 / 敌人行动延迟按 2× 速度走）。
     *   与 'miniGame' 同一条规则（见 Main.update）。
     *
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态
     */
    update(deltaTime, input) {
        super.update(deltaTime, input);

        if (!this.battleSystem || !this.battleSystem.isInBattle) return;

        this.battleSystem.update(deltaTime);

        // 敌人：以 battleSystem.enemies 为准（战斗中动态增删的敌人也能跟上）
        const enemies = this.battleSystem.enemies || this.enemies || [];
        for (const enemy of enemies) {
            if (enemy && enemy.update) {
                enemy.update(deltaTime, null);
            }
        }

        if (this.player && this.player.isAlive && this.player.isInBattle
            && input && input.pressedKeys && (input.pressedKeys['j'] || input.pressedKeys[' '])) {
            this.player.performAttack();
        }

        // 战斗结束 → 回大地图
        if (!this.battleSystem.isInBattle) {
            this.main.sceneManager.switchScene('gameWorld');
        }
    }

    render(ctx) {
        super.render(ctx);

        if (this.main && typeof this.main.renderBattle === 'function') {
            this.main.renderBattle(ctx);
            return;
        }
        
        // 战斗场景渲染
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 800, 600);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText('战斗中...', 400, 300);
        
        // 渲染战斗日志
        if (this.battleSystem) {
            const log = this.battleSystem.getBattleLog();
            const recentLog = log.slice(-5);
            
            ctx.font = '14px Microsoft YaHei';
            ctx.textAlign = 'left';
            
            recentLog.forEach((entry, index) => {
                ctx.fillText(entry.message, 50, 400 + index * 25);
            });
        }
    }
}