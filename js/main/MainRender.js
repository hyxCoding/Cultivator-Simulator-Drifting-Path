/**
 * Main · 画面渲染
 * 按当前场景分派到主菜单 / 大地图 / 对话字幕 / 战斗 / 小游戏 / 完结界面各自的绘制。
 *
 * 由 js/Main.js 拆分而来，经原型混入挂回 Main（Object.assign(Main.prototype, {...})）：
 * 调用点仍写作 this.xxx()，行为与原单文件实现完全一致。
 */

Object.assign(Main.prototype, {

        /**
         * 渲染游戏
         * @param {CanvasRenderingContext2D} ctx - Canvas上下文
         */
        render(ctx) {
            const currentScene = this.sceneManager.getCurrentScene();

            if (!currentScene) return;

            switch (currentScene.sceneId) {
                case 'mainMenu':
                    this.renderMainMenu(ctx);
                    break;

                case 'gameWorld':
                    this.renderGameWorld(ctx);
                    break;

                case 'battle':
                    this.renderBattle(ctx);
                    break;

                case 'miniGame':
                    this.renderMiniGame(ctx);
                    break;

                case 'ending':
                    this.renderEnding(ctx);
                    break;
            }
        },

        /**
         * 渲染主菜单（游戏开始界面）
         * 画面全部来自美术图片，由 MainMenuScene 负责：
         *   assets/images/ui/start_screen.png 1280×720 整屏背景
         *   assets/images/ui/start_button.png 400×112  居中开始按钮
         * 这里不再用代码绘制任何标题 / 提示文字（「按任意键开始游戏」已随该版本取消）。
         */
        renderMainMenu(ctx) {
            const mainMenuScene = (this.scenes && this.scenes.mainMenu)
                || (this.sceneManager && this.sceneManager.getScene
                    ? this.sceneManager.getScene('mainMenu')
                    : null);
            if (mainMenuScene && typeof mainMenuScene.render === 'function') {
                mainMenuScene.render(ctx);
            }
        },

        /**
         * 渲染游戏完结界面（滚动字幕）
         * 画面全部由 EndingScene 负责：深墨背景 + 逐行居中的滚动文字 + 「按任意键返回游戏」提示
         * （数据源 js/EndingText.js，见 js/EndingScene.js 类头说明）
         * @param {CanvasRenderingContext2D} ctx - Canvas上下文
         */
        renderEnding(ctx) {
            const endingScene = (this.scenes && this.scenes.ending)
                || (this.sceneManager && this.sceneManager.getScene
                    ? this.sceneManager.getScene('ending')
                    : null);
            if (endingScene && typeof endingScene.render === 'function') {
                endingScene.render(ctx);
            }
        },

        /**
         * 渲染游戏世界
         */
        renderGameWorld(ctx) {
            // 地图渲染由GameLoop处理
            // 这里渲染UI层

            // ===== 规则：世界地图（MapTeleport）打开时，画面只保留世界地图及其上的区域按钮 =====
            // 地图背景为不透明全屏绘制，若继续绘制其它 UI（交互提示 / HUD / 任务栏 / 对话框），
            // 就会出现“按 E 键乘船离开”等提示叠在世界地图上的穿帮（按 E 登船之后尤为明显）。
            if (this.mapTeleport && this.mapTeleport.isVisible) {
                this.mapTeleport.render(ctx);
                return;
            }

            // 渲染商店（最上层，叠在所有 UI 之上）
            if (this.shop && this.shop.isOpen) {
                this.shop.render(ctx);
                return;
            }

            // 注：对话框不在此处绘制 —— 必须画在左下角按键提示 UI（技能栏 / 气血灵息条）之上，
            //     故统一放到下方 renderHud 之后再绘制（见本方法末尾），避免技能格盖住对话框左下角。

            // 渲染拾取物提示（玩家附近有可拾取物品时显示）
            if (this.player && this.player.nearbyPickupItem && !this.player.nearbyPickupItem.isPickedUp) {
                this.player.nearbyPickupItem.renderPrompt(ctx, this.camera);
            }

            // 渲染 NPC 交互提示（靠近 NPC 时显示"按 E 对话"）
            // 对话中或正在交互时不再显示提示
            if (this.player && this.player.nearbyNPC && this.player.nearbyNPC.canInteract
                && !this.dialogBox.isVisible && !this.player.isInteracting) {
                this.player.nearbyNPC.renderPrompt(ctx, this.camera);
            }

            // 渲染路标提示（靠近路标时显示"按 E 键…"）
            if (this.player && this.player.nearbySignpost && this.player.nearbySignpost.isActive
                && !this.dialogBox.isVisible && !this.player.isInteracting) {
                this.player.nearbySignpost.renderPrompt(ctx, this.camera);
            }

            // 渲染调查点提示（仅当前待调查且未调查的调查点会显示）
            if (this.player && this.player.nearbyWindPile
                && !this.dialogBox.isVisible && !this.player.isInteracting) {
                this.player.nearbyWindPile.renderPrompt(ctx, this.camera);
            }

            // 渲染传送法阵提示（靠近法阵时显示“按 E 进入boss战斗”等）
            if (this.player && this.player.nearbyTeleportArray && this.player.nearbyTeleportArray.isActive
                && !this.dialogBox.isVisible && !this.player.isInteracting) {
                this.player.nearbyTeleportArray.renderPrompt(ctx, this.camera);
            }

            // 渲染训练目标（地面标记 + 提示）
            if (this.trainingManager && this.trainingManager.isActive) {
                this.trainingManager.render(ctx, this.camera);
                this.trainingManager.renderPrompt(ctx, this.camera);
            }

            // 渲染玩家战斗 HUD（气血 / 灵息 / 技能冷却 / 灵息不足提示）
            if (this.playerCombat) {
                this.playerCombat.renderHud(ctx);
            }

            // 渲染战斗短字幕（第二章 Boss 战中不暂停操作的台词）
            this.renderSubtitle(ctx);

            // 渲染对话框（画在左下角按键提示 UI 之上：技能栏 / 气血灵息条先绘制，
            // 否则技能格会盖住对话框左下角的正文与选项按钮）
            if (this.dialogBox.isVisible) {
                this.dialogBox.render(ctx);
            }

            // 任务UI渲染在最后（最顶层，不被其他UI覆盖）
            if (this.questUI.isVisible) {
                this.questUI.render(ctx);
            }
        },

        /**
         * 渲染屏幕中下方的战斗短字幕（不暂停操作）
         * @param {CanvasRenderingContext2D} ctx
         */
        renderSubtitle(ctx) {
            if (!this.subtitle || this.subtitle.timer <= 0 || !this.subtitle.text) return;

            const canvasWidth = this.canvas ? this.canvas.width : 1280;
            const canvasHeight = this.canvas ? this.canvas.height : 720;

            ctx.save();
            ctx.font = 'bold 17px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const textWidth = ctx.measureText(this.subtitle.text).width;
            const boxWidth = Math.min(canvasWidth - 80, textWidth + 48);
            const boxX = (canvasWidth - boxWidth) / 2;
            const boxY = canvasHeight - 168;

            ctx.fillStyle = 'rgba(8, 14, 22, 0.78)';
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, 40, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(220, 196, 140, 0.55)';
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX, boxY, boxWidth, 40);

            ctx.fillStyle = '#f2e2b8';
            ctx.fillText(this.subtitle.text, canvasWidth / 2, boxY + 21);
            ctx.restore();
        },

        /**
         * 渲染战斗
         */
        renderBattle(ctx) {
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            // 画布背景装饰
            ctx.fillStyle = 'rgba(96, 165, 250, 0.15)';
            ctx.fillRect(0, 0, this.canvas.width, 120);
            ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
            ctx.fillRect(0, 120, this.canvas.width, this.canvas.height - 120);

            const player = this.player;
            const enemies = this.battleSystem && this.battleSystem.enemies ? this.battleSystem.enemies.filter(enemy => enemy && enemy.isAlive) : [];
            const boss = enemies[0] || null;

            // 顶部：Boss血条
            if (boss) {
                const bossBarWidth = 500;
                const bossBarX = (this.canvas.width - bossBarWidth) / 2;
                const bossBarY = 30;
                const bossPercent = Math.max(0, Math.min(1, boss.health / (boss.maxHealth || 1)));

                ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
                ctx.fillRect(bossBarX, bossBarY, bossBarWidth, 22);
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(bossBarX, bossBarY, bossBarWidth * bossPercent, 22);

                ctx.strokeStyle = '#f8fafc';
                ctx.strokeRect(bossBarX, bossBarY, bossBarWidth, 22);

                ctx.fillStyle = '#f8fafc';
                ctx.font = 'bold 18px Microsoft YaHei';
                ctx.textAlign = 'center';
                ctx.fillText(`${boss.name || 'Boss'}  ${Math.max(0, Math.ceil(boss.health))}/${boss.maxHealth || 1}`, this.canvas.width / 2, bossBarY + 16);
            }

            // 中央：Boss立绘/模型
            if (boss && boss.animationManager) {
                const bossX = this.canvas.width / 2 - 80;
                const bossY = 130;
                boss.animationManager.render(ctx, bossX, bossY, 160, 160, { alpha: 1 });
            } else {
                ctx.fillStyle = '#f8fafc';
                ctx.font = '30px Microsoft YaHei';
                ctx.textAlign = 'center';
                ctx.fillText('战斗中', this.canvas.width / 2, 260);
            }

            // 下方：玩家状态栏（统一走 PlayerData 方法读取，禁止外部直接读字段）
            if (player) {
                const pd = player.playerData;
                const playerHp = pd ? pd.getHealth() : 0;
                const playerMaxHp = pd ? pd.getMaxHealth() : 1;
                const playerMana = pd ? pd.getMana() : 0;
                const playerMaxMana = pd ? pd.getMaxMana() : 1;
                const panelX = 60;
                const panelY = this.canvas.height - 130;
                const panelW = 420;
                const panelH = 80;

                ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
                ctx.fillRect(panelX, panelY, panelW, panelH);

                ctx.fillStyle = '#f8fafc';
                ctx.font = '20px Microsoft YaHei';
                ctx.textAlign = 'left';
                ctx.fillText(player.playerData && player.playerData.name ? player.playerData.name : '修仙者', panelX + 20, panelY + 25);

                const hpRatio = Math.max(0, Math.min(1, playerHp / playerMaxHp));
                ctx.fillStyle = '#374151';
                ctx.fillRect(panelX + 120, panelY + 16, 260, 16);
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(panelX + 120, panelY + 16, 260 * hpRatio, 16);
                ctx.fillStyle = '#f8fafc';
                ctx.fillText(`HP ${Math.ceil(playerHp)}/${playerMaxHp}`, panelX + 120, panelY + 52);

                const manaRatio = Math.max(0, Math.min(1, playerMana / playerMaxMana));
                ctx.fillStyle = '#374151';
                ctx.fillRect(panelX + 120, panelY + 58, 260, 10);
                ctx.fillStyle = '#3b82f6';
                ctx.fillRect(panelX + 120, panelY + 58, 260 * manaRatio, 10);
            }

            // 战斗日志
            if (this.battleSystem) {
                const log = this.battleSystem.getBattleLog();
                const recentLog = log.slice(-4);
                ctx.font = '14px Microsoft YaHei';
                ctx.textAlign = 'left';
                recentLog.forEach((entry, index) => {
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
                    ctx.fillRect(780, 520 + index * 28, 420, 22);
                    ctx.fillStyle = '#f8fafc';
                    ctx.fillText(entry.message, 790, 536 + index * 28);
                });
            }
        },

        /**
         * 渲染小游戏
         */
        renderMiniGame(ctx) {
            if (this.miniGameManager.currentMiniGame) {
                this.miniGameManager.render(ctx);
            }
        }

});
