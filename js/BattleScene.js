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
        console.log('进入战斗');
        
        this.player = params.player;
        this.enemies = params.enemies;
        this.battleSystem = params.battleSystem;
    }

    update(deltaTime, input) {
        super.update(deltaTime, input);
        
        if (this.battleSystem && this.battleSystem.isInBattle) {
            this.battleSystem.update(deltaTime);

            if (this.enemies && this.enemies.length > 0) {
                this.enemies.forEach(enemy => {
                    if (enemy && enemy.update) {
                        enemy.update(deltaTime, null);
                    }
                });
            }

            if (this.player && this.player.isAlive && this.player.isInBattle) {
                if (input && input.pressedKeys && (input.pressedKeys['j'] || input.pressedKeys[' '])) {
                    this.player.performAttack();
                }
            }
            
            // 战斗结束
            if (!this.battleSystem.isInBattle) {
                this.main.sceneManager.switchScene('gameWorld');
            }
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