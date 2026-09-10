/**
 * 乘风采药小游戏
 * 瓦片地图碰撞 + 随机风系统 + 草药采集
 * 地图：1280×720，32×18 格，每格 40px（精确适配碰撞图分辨率）
 * 起风时主角切换为乘风飞行动画
 * 碰撞判断：继承自 collision.png 分析结果，硬编码为静态 COLLISION_MAP（32×18），
 *   避免运行时 getImageData 在 file:// 协议下受 CORS 限制无法读取像素
 */
// 碰撞数据（硬编码自 collision.png 逐瓦片白/黑像素统计）
// 1=陆地, 0=虚空；32 列 × 18 行，每格 40px；1280×720 地图
const COLLISION_MAP = [
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,1,1,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,1,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
[0,0,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
[0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

class HerbCollectMiniGame extends MiniGame {
    constructor(config) {
        super({ id: 'herb_collect', name: '乘风采药', timeLimit: 0, maxScore: 100, ...config });
        this.collisionData = COLLISION_MAP;  // 静态碰撞数据，无需异步加载
        this.tileSize = 40;
        this.mapCols = 32;
        this.mapRows = 18;
        this.mapWidth = 1280;
        this.mapHeight = 720;
        this.player = { x: 300, y: 550, width: 22, height: 26, speed: 160 };
        this.wind = { active: false, timer: 0, duration: 0, cooldown: 0, animOffset: 0, fadeAlpha: 0, fadeSpeed: 2.0 };
        this.windAnimFrame = 0;
        this.windAnimTimer = 0;
        this.herbs = this._generateHerbs();
        this.collectedHerbs = 0;
        this.requiredHerbs = this.herbs.length;
        this.nearbyHerb = null;
        this.gamePhase = 'tutorial';
        this.tutorialStep = 0;
        this.tutorialTimer = 0;
        this.isFirstPlay = true;
        this.keys = {};
        this.eJustPressed = false;
        this.playerDir = 0;      // 0=下, 1=左, 2=右, 3=上
        this.animFrame = 0;      // 行走动画帧 0~3
        this.animTimer = 0;
        this.isMoving = false;
        this.bgImage = null;
        this.windImage = null;
        this.playerImage = null;      // 行走状态图像
        this.playerFlyImage = null;   // 乘风飞行状态图像
        this.playerIdleImage = null;  // 闲置站立图像
        this.herbImage = null;
        this._loadResources();
    }

    _loadResources() {
        try {
            const rm = ResourceManager.getInstance();
            // 仅从缓存同步读取（Main.js 预加载保证图片已缓存）
            const bg      = rm.getCachedImage('miniGame.caoyao_bg');
            const wind    = rm.getCachedImage('miniGame.caoyao_wind');
            const player  = rm.getCachedImage('player.sanxiu_walk');
            const fly     = rm.getCachedImage('player.sanxiu_fly');
            const idle    = rm.getCachedImage('player.sanxiu_idle');
            const herb    = rm.getCachedImage('miniGame.caoyao_herb');

            if (bg)      this.bgImage = bg;
            if (wind)    this.windImage = wind;
            if (player)  this.playerImage = player;
            if (fly)     this.playerFlyImage = fly;
            if (idle)    this.playerIdleImage = idle;
            if (herb)    this.herbImage = herb;
        } catch (_) {}
    }

    _generateHerbs() {
        // 草药像素坐标（直接指定，不依赖瓦片换算）
        const posList = [
            { x: 250, y: 520 },
            { x: 240, y: 240 },
            { x: 383, y: 117 },
            { x: 450, y: 150 },
            { x: 667, y: 93 },
            { x: 925, y: 150 },
            { x: 1050, y: 300 },
            { x: 1110, y: 344 },
        ];
        return posList.map(p => ({ x: p.x, y: p.y, collected: false }));
    }

    start() {
        super.start();
        this.player.x = 300;
        this.player.y = 550;
        this.herbs = this._generateHerbs();
        this.collectedHerbs = 0;
        this.nearbyHerb = null;
        this.wind.active = false; this.wind.timer = 0; this.wind.duration = 0;
        this.wind.cooldown = 0.5 + Math.random() * 1.5; // 首次起风随机 0.5~2 秒
        this.wind.animOffset = 0; this.wind.fadeAlpha = 0;
        this.windAnimFrame = 0; this.windAnimTimer = 0;
        this.gamePhase = this.isFirstPlay ? 'tutorial' : 'playing';
        this.tutorialStep = 0; this.tutorialTimer = 0;
        this.keys = {}; this.eJustPressed = false;
    }
update(dt, input) {
        super.update(dt, input);
        if (!this.isRunning || this.isPaused) return;
        this._readInput(input);
        if (this.gamePhase === 'tutorial') this._updateTutorial(dt);
        if (this.gamePhase === 'playing') this._updateWind(dt);
        this._updatePlayerMovement(dt);
        this._updateWindVisual(dt);
        this._checkHerbProximity();
        this._checkVoidFall();
        if (this.collectedHerbs >= this.requiredHerbs) { this.score = this.maxScore; this.complete(); }
    }

    _readInput(input) {
        if (!input) return;
        this.keys = {};
        if (input.keys) for (const k of ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']) this.keys[k] = !!input.keys[k];
        this.eJustPressed = !!(input.pressedKeys && input.pressedKeys['e']);
    }

    _updateTutorial(dt) {
        this.tutorialTimer += dt;
        const steps = [
            { text: '按 WASD 或方向键移动', done: () => this._hasMoved() },
            { text: '靠近发光的草药，按 E 采集', done: () => this.collectedHerbs >= 1 },
            { text: '风起时可在虚空中行走', done: () => this.tutorialTimer > 8 },
        ];
        if (steps[this.tutorialStep] && steps[this.tutorialStep].done()) {
            if (this.tutorialStep < steps.length - 1) { this.tutorialStep++; this.tutorialTimer = 0; }
            else { this.gamePhase = 'playing'; this.tutorialStep = 0; this.tutorialTimer = 0; this.isFirstPlay = false; }
        }
    }

    _hasMoved() {
        const sx = 300, sy = 550;
        return Math.hypot(this.player.x-sx, this.player.y-sy) > this.tileSize;
    }

    // ======================================================================
    //  风系统
    // ======================================================================

    _updateWind(dt) {
        if (this.wind.active) {
            this.wind.timer += dt;
            this.wind.fadeAlpha = Math.min(1, this.wind.fadeAlpha + this.wind.fadeSpeed * dt);
            if (this.wind.timer >= this.wind.duration) {
                this.wind.active = false; this.wind.timer = 0;
                this.wind.fadeAlpha = Math.max(0, 1 - this.wind.fadeSpeed * dt * 2);
                this.wind.cooldown = 0.5 + Math.random() * 1.5; // 风停后 0.5~2 秒再次起风
            }
        } else {
            this.wind.cooldown -= dt;
            this.wind.fadeAlpha = Math.max(0, this.wind.fadeAlpha - this.wind.fadeSpeed * dt);
            if (this.wind.cooldown <= 0) {
                this.wind.active = true; this.wind.duration = 5 + Math.random() * 5;
                this.wind.timer = 0; this.wind.fadeAlpha = 0;
            }
        }
    }

    _updateWindVisual(dt) {
        if (this.wind.active || this.wind.fadeAlpha > 0.01) {
            this.wind.animOffset += dt * 120;
            if (this.wind.animOffset > 200) this.wind.animOffset = 0;
            // 风精灵帧动画（4帧循环）
            this.windAnimTimer += dt;
            if (this.windAnimTimer >= 0.12) {
                this.windAnimTimer -= 0.12;
                this.windAnimFrame = (this.windAnimFrame + 1) % 4;
            }
        } else {
            this.windAnimFrame = 0;
            this.windAnimTimer = 0;
        }
    }
// ======================================================================
    //  玩家移动（瓦片碰撞）
    // ======================================================================

    _updatePlayerMovement(dt) {
        let dx = 0, dy = 0;
        if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
        if (this.keys['d'] || this.keys['arrowright']) dx += 1;
        if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
        if (dx !== 0 && dy !== 0) { const inv = 1 / Math.SQRT2; dx *= inv; dy *= inv; }
        const spd = this.player.speed * dt, pw = this.player.width, ph = this.player.height;
        if (dx !== 0) {
            const nx = this.player.x + dx * spd;
            if (this._canStandAt(nx - pw / 2, this.player.y - ph / 2, pw, ph)) this.player.x = nx;
        }
        if (dy !== 0) {
            const ny = this.player.y + dy * spd;
            if (this._canStandAt(this.player.x - pw / 2, ny - ph / 2, pw, ph)) this.player.y = ny;
        }

        // ========== 方向追踪 & 行走动画 ==========
        // 优先以水平方向为准（左/右覆盖上/下）
        if (dx < 0) this.playerDir = 1;       // 左
        else if (dx > 0) this.playerDir = 2;  // 右
        else if (dy < 0) this.playerDir = 3;  // 上
        else if (dy > 0) this.playerDir = 0;  // 下

        this.isMoving = (dx !== 0 || dy !== 0);
        if (this.isMoving) {
            this.animTimer += dt;
            const frameDuration = 0.15; // 每秒约 6.7 帧
            if (this.animTimer >= frameDuration) {
                this.animTimer -= frameDuration;
                this.animFrame = (this.animFrame + 1) % 4;
            }
        } else {
            this.animFrame = 0;
            this.animTimer = 0;
        }
    }

    _canStandAt(l, t, w, h) {
        const tile = this.tileSize;
        const c1 = Math.floor(l / tile), r1 = Math.floor(t / tile);
        const c2 = Math.floor((l + w - 1) / tile), r2 = Math.floor((t + h - 1) / tile);
        for (let r = r1; r <= r2; r++)
            for (let c = c1; c <= c2; c++)
                if (!this._isTileWalkable(r, c)) return false;
        return true;
    }

    _isTileWalkable(r, c) {
        if (r < 0 || r >= this.mapRows || c < 0 || c >= this.mapCols) return false;
        if (!this.collisionData) return true;
        // 无风时只有陆地可走；起风时虚空也能行走（飞行）
        if (this.collisionData[r] && this.collisionData[r][c] === 1) return true;
        return this.wind.active;
    }

    /** 纯碰撞数据查询：瓦片是否为虚空（忽略风状态） */
    _isVoidTile(r, c) {
        if (r < 0 || r >= this.mapRows || c < 0 || c >= this.mapCols) return true;
        // 碰撞数据硬编码自 collision.png 分析结果（见 COLLISION_MAP），
        // 避免浏览器 file:// 协议下 canvas.getImageData 受 CORS 限制无法读取像素
        if (!this.collisionData) return true;
        if (!this.collisionData[r]) return true;
        return this.collisionData[r][c] !== 1;
    }

    // ======================================================================
    //  虚空坠落
    // ======================================================================

    _checkVoidFall() {
        if (this.gamePhase !== 'playing') return;
        const c = Math.floor(this.player.x / this.tileSize);
        const r = Math.floor(this.player.y / this.tileSize);
        // 站在虚空瓦片上且风已停 → 坠落失败
        if (this._isVoidTile(r, c) && !this.wind.active) {
            this.fail();
        }
        if (this.player.x < 0 || this.player.x > this.mapWidth || this.player.y < 0 || this.player.y > this.mapHeight) {
            this.fail();
        }
    }

    // ======================================================================
    //  草药采集
    // ======================================================================

    _checkHerbProximity() {
        this.nearbyHerb = null;
        let nd = 48;
        for (const h of this.herbs) {
            if (h.collected) continue;
            const d = Math.hypot(this.player.x - h.x, this.player.y - h.y);
            if (d < nd) { nd = d; this.nearbyHerb = h; }
        }
        if (this.eJustPressed && this.nearbyHerb) {
            this.nearbyHerb.collected = true;
            this.collectedHerbs++;
            this.score = (this.collectedHerbs / this.requiredHerbs) * this.maxScore;
            this.nearbyHerb = null;
        }
    }
// ======================================================================
    //  渲染
    // ======================================================================

    render(ctx) {
        if (!ctx) return;
        this._renderTiles(ctx);
        this._renderWind(ctx);
        this._renderHerbs(ctx);
        this._renderPlayer(ctx);
        this._renderInteractionHint(ctx);
        this._renderUI(ctx);
        if (this.gamePhase === 'tutorial') this._renderTutorialUI(ctx);
    }

    _renderTiles(ctx) {
        if (this.bgImage) {
            ctx.drawImage(this.bgImage, 0, 0, 1280, 720);
        }
    }

    _renderWind(ctx) {
        if (!this.wind.active && this.wind.fadeAlpha <= 0.01) return;
        const alpha = Math.min(1, this.wind.fadeAlpha);
        if (this.windImage) {
            const FRAME_W = 202, FRAME_H = 128;
            ctx.globalAlpha = alpha * 0.3;
            for (let i = 0; i < 4; i++) {
                const wx = (i * 400 + this.wind.animOffset * 0.5) % (1280 + 200) - 100;
                const wy = 100 + i * 150;
                ctx.drawImage(this.windImage, this.windAnimFrame * FRAME_W, 0, FRAME_W, FRAME_H,
                    wx, wy, FRAME_W, FRAME_H);
            }
            ctx.globalAlpha = 1;
        }
    }

    _renderHerbs(ctx) {
        const t = Date.now() / 1000;
        for (const h of this.herbs) {
            if (h.collected) continue;
            const glow = 0.7 + Math.sin(t * 3 + h.x) * 0.3;
            ctx.shadowColor = '#aaffaa';
            ctx.shadowBlur = 16 * glow;
            ctx.fillStyle = 'rgba(170, 255, 170, ' + glow * 0.4 + ')';
            ctx.beginPath();
            ctx.arc(h.x, h.y, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            if (this.herbImage) {
                ctx.drawImage(this.herbImage, h.x - 16, h.y - 14, 32, 28);
            } else {
                ctx.fillStyle = '#66ff66';
                ctx.beginPath();
                ctx.arc(h.x, h.y, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#44cc44';
                ctx.beginPath();
                ctx.arc(h.x - 2, h.y - 2, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
_renderPlayer(ctx) {
        const px = this.player.x, py = this.player.y;
        const pw = this.player.width, ph = this.player.height;
        const FRAME_SIZE = 32;

        // 状态判定：闲置(静止) / 行走(移动无风) / 飞行(移动+起风)
        const isFlying = this.isMoving && this.wind.active && this.wind.fadeAlpha > 0.1;
        const isIdle = !this.isMoving;

        if (isFlying) {
            // === 飞行：乘风飞行图像 + 上下浮动 ===
            const img = this.playerFlyImage;
            if (img) {
                const t = Date.now() / 1000;
                const floatY = Math.sin(t * 4) * 2;
                ctx.save();
                ctx.translate(px, py + floatY);
                // 行排列：0=下, 1=左, 2=右, 3=上，每行4帧，每帧32×32
                const sx = this.animFrame * FRAME_SIZE;
                const sy = this.playerDir * FRAME_SIZE;
                ctx.drawImage(img, sx, sy, FRAME_SIZE, FRAME_SIZE,
                    -FRAME_SIZE / 2, -FRAME_SIZE / 2, FRAME_SIZE, FRAME_SIZE);
                ctx.restore();
            } else {
                // 降级：蓝色角色 + 翅膀
                ctx.fillStyle = '#66aaff';
                ctx.shadowColor = '#88ccff';
                ctx.shadowBlur = 12;
                ctx.fillRect(px - pw / 2, py - ph / 2 - 2, pw, ph + 4);
                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 2;
                const t2 = Date.now() / 1000;
                for (let side = -1; side <= 1; side += 2) {
                    const flap = Math.sin(t2 * 6) * 6;
                    ctx.beginPath();
                    ctx.moveTo(px + side * pw / 2, py - 4);
                    ctx.lineTo(px + side * (pw / 2 + 12 + flap), py - 10);
                    ctx.lineTo(px + side * (pw / 2 + flap), py + 4);
                    ctx.closePath();
                    ctx.stroke();
                }
            }
        } else if (isIdle) {
            // === 闲置：使用闲置精灵图，显示第一帧 ===
            const img = this.playerIdleImage || this.playerImage;
            if (img) {
                const sx = 0; // 始终第一帧（静止姿态）
                const sy = this.playerDir * FRAME_SIZE;
                ctx.drawImage(img, sx, sy, FRAME_SIZE, FRAME_SIZE,
                    px - FRAME_SIZE / 2, py - FRAME_SIZE / 2, FRAME_SIZE, FRAME_SIZE);
            } else {
                // 降级：暖色调方形
                ctx.fillStyle = '#ff8844';
                ctx.fillRect(px - pw / 2, py - ph / 2, pw, ph);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px - 4, py - 6, 4, 4);
                ctx.fillRect(px + 2, py - 6, 4, 4);
            }
        } else {
            // === 行走：行走精灵表动画 ===
            const img = this.playerImage;
            if (img) {
                // 行排列：0=下, 1=左, 2=右, 3=上，每行4帧，每帧32×32
                const sx = this.animFrame * FRAME_SIZE;
                const sy = this.playerDir * FRAME_SIZE;
                ctx.drawImage(img, sx, sy, FRAME_SIZE, FRAME_SIZE,
                    px - FRAME_SIZE / 2, py - FRAME_SIZE / 2, FRAME_SIZE, FRAME_SIZE);
            } else {
                // 降级：暖色调方形
                ctx.fillStyle = '#ff8844';
                ctx.fillRect(px - pw / 2, py - ph / 2, pw, ph);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px - 4, py - 6, 4, 4);
                ctx.fillRect(px + 2, py - 6, 4, 4);
            }
        }
    }

    _renderInteractionHint(ctx) {
        if (this.gamePhase !== 'playing' || !this.nearbyHerb) return;
        const hx = this.nearbyHerb.x;
        const hy = this.nearbyHerb.y - 30;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = '14px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText('[E] 采集', hx, hy);
        ctx.restore();
    }

    _renderUI(ctx) {
        const bx = 20, by = 20, bw = 300, bh = 36;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 8);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.fillText('草药: ' + this.collectedHerbs + '/' + this.requiredHerbs, bx + 12, by + 24);
        const windText = this.wind.active ? '起风' : '风息';
        ctx.fillStyle = this.wind.active ? '#aaddff' : '#aaaaaa';
        ctx.textAlign = 'right';
        ctx.fillText(windText, bx + bw - 12, by + 24);
        ctx.restore();
    }

    _renderTutorialUI(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, 1280, 720);
        const tw = 500, th = 100;
        const tx = (1280 - tw) / 2, ty = 720 - th - 40;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 12);
        ctx.fill();
        const texts = [
            '按 WASD 或方向键移动角色',
            '靠近发光的草药，按 E 采集',
            '风起时可在虚空中行走，收集所有草药！',
        ];
        ctx.fillStyle = '#ffffff';
        ctx.font = '18px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(texts[this.tutorialStep] || '', 1280 / 2, ty + th / 2 + 6);
        ctx.restore();
    }

    // ======================================================================
    //  分数
    // ======================================================================

    getPassScore() { return Math.ceil(this.maxScore * 0.5); }
}