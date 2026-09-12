/**
 * 玩家战斗特效（CombatEffect / CombatProjectile）
 *
 * 设计要点：
 * 1) 每个特效优先使用美术精灵图；当精灵图缺失、或尺寸与规格不符时，自动回退为
 *    程序化绘制（canvas 绘制的占位特效），保证在美术资源到位前功能即可玩、可验证。
 * 2) 图层（layer）：
 *      'under' —— 绘制在角色之下、地图之上（护体术 / 闪避的气场）；
 *      'over'  —— 绘制在角色之上（剑气、灵息弹、命中特效）。
 * 3) 特效可跟随宿主（follow，需含 position），用于"包围主角的剑气""角色气场"。
 *
 * 美术规格（把文件放到对应路径即自动生效，无需改代码）：
 *   剑气   assets/images/effects/player_sword_aura.png     1 行 4 帧，单帧 128×108
 *   灵息弹 assets/images/effects/player_lingxidan.png      4 行（右/左/下/上）× 4 帧，单帧 32×32
 *   命中   assets/images/effects/player_lingxidan_hit.png  1 行 6 帧，单帧 48×48
 *   护体术 assets/images/effects/player_hutishu_aura.png   1 行 4 帧，单帧 48×64
 *   闪避   assets/images/effects/player_dodge_aura.png     1 行 4 帧，单帧 48×64
 *   剑影连斩·剑气 assets/images/effects/player_jianying.png      4 行（右/左/下/上）× 6 帧，单帧 96×96，循环
 *   剑影连斩·命中 assets/images/effects/player_jianying_hit.png  1 行 6 帧，单帧 96×96
 */

/**
 * 通用战斗特效实例（单行 / 多行精灵图，可循环，可跟随宿主）
 */
class CombatEffect {
    /**
     * @param {Object} config
     * @param {string} config.name - 特效名（仅用于调试与默认程序化表现选择）
     * @param {Image} [config.spriteSheet] - 精灵图（缺失时走程序化绘制）
     * @param {number} [config.frameWidth=48] - 单帧宽
     * @param {number} [config.frameHeight=48] - 单帧高
     * @param {number} [config.frameCount=4] - 帧数（每行从左到右）
     * @param {number} [config.row=0] - 使用精灵图的第几行（多行图集）
     * @param {number} [config.fps=12] - 播放帧率
     * @param {boolean} [config.loop=false] - 是否循环播放
     * @param {Object} [config.position] - 世界坐标（中心）{x, y}
     * @param {number} [config.scale=1] - 缩放
     * @param {number} [config.alpha=1] - 透明度
     * @param {Object} [config.follow] - 跟随对象（需有 position）
     * @param {Object} [config.offset] - 相对跟随对象的偏移 {x, y}
     * @param {string} [config.layer='over'] - 绘制层：'under' | 'over'
     * @param {string} [config.shape] - 程序化表现形状：'aura_ring' | 'aura_glow' | 'burst' | 'orb'
     *        | 'sword_qi' | 'ring_expand' | 'chain'（渡厄使「控制」命中时的玩家头顶锁链）
     * @param {string} [config.color] - 程序化表现主色（#RRGGBB）
     */
    constructor(config = {}) {
        this.name = config.name || 'combat_effect';
        this.spriteSheet = config.spriteSheet || null;
        this.frameWidth = config.frameWidth || 48;
        this.frameHeight = config.frameHeight || 48;
        this.frameCount = config.frameCount || 4;
        this.row = config.row || 0;
        this.fps = config.fps || 12;
        this.loop = config.loop === true;
        this.position = {
            x: (config.position && config.position.x) || 0,
            y: (config.position && config.position.y) || 0,
        };
        this.scale = config.scale || 1;
        this.alpha = config.alpha !== undefined ? config.alpha : 1;
        this.follow = config.follow || null;
        this.offset = config.offset || { x: 0, y: 0 };
        this.layer = config.layer === 'under' ? 'under' : 'over';
        this.shape = config.shape || 'burst';
        this.color = config.color || '#9ad8ff';

        // 播放状态
        this.currentFrame = 0;
        this.elapsedTime = 0;
        this.frameInterval = 1 / this.fps;
        this.isFinished = false;
        this.spin = 0;
        this.tailDirection = { x: 0, y: 1 };

        // 精灵图是否可用（尺寸必须与规格吻合，否则用程序化表现，避免画出占位图/错帧）
        this.spriteUsable = CombatEffect.isSpriteUsable(
            this.spriteSheet, this.frameWidth, this.frameHeight, this.frameCount, this.row
        );
    }

    /**
     * 判断精灵图是否满足"每帧 frameWidth×frameHeight、至少 columns 列、至少 row+1 行"的规格
     * （占位图 32×32 会因尺寸不足被判为不可用）
     * @param {Image} sheet
     * @param {number} frameWidth
     * @param {number} frameHeight
     * @param {number} columns - 需要的列数（帧数）
     * @param {number} row - 需要覆盖的行号（0 基）
     * @returns {boolean}
     */
    static isSpriteUsable(sheet, frameWidth, frameHeight, columns = 1, row = 0) {
        if (!sheet || !frameWidth || !frameHeight) return false;
        const w = sheet.naturalWidth || sheet.width || 0;
        const h = sheet.naturalHeight || sheet.height || 0;
        if (w < frameWidth * columns || h < frameHeight * (row + 1)) return false;
        if (w % frameWidth !== 0 || h % frameHeight !== 0) return false;
        return true;
    }

    /**
     * 更新特效（跟随时同步宿主位置）
     * @param {number} deltaTime
     * @returns {boolean} 是否仍然存活
     */
    update(deltaTime) {
        if (this.isFinished) return false;

        // 跟随宿主（剑气 / 气场的常见用法）
        if (this.follow && this.follow.position) {
            this.position.x = this.follow.position.x + this.offset.x;
            this.position.y = this.follow.position.y + this.offset.y;
        }

        this.spin += deltaTime * 6;

        this.elapsedTime += deltaTime;
        if (this.elapsedTime >= this.frameInterval) {
            const advance = Math.floor(this.elapsedTime / this.frameInterval);
            this.elapsedTime -= advance * this.frameInterval;
            this.currentFrame += advance;

            if (this.currentFrame >= this.frameCount) {
                if (this.loop) {
                    this.currentFrame = this.currentFrame % this.frameCount;
                } else {
                    this.currentFrame = this.frameCount - 1;
                    this.isFinished = true;
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 渲染特效
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera
     */
    render(ctx, camera) {
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const drawWidth = this.frameWidth * this.scale;
        const drawHeight = this.frameHeight * this.scale;
        const screenX = this.position.x - renderPos.x - drawWidth / 2;
        const screenY = this.position.y - renderPos.y - drawHeight / 2;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        if (this.spriteUsable) {
            ctx.drawImage(
                this.spriteSheet,
                this.currentFrame * this.frameWidth,
                this.row * this.frameHeight,
                this.frameWidth,
                this.frameHeight,
                screenX,
                screenY,
                drawWidth,
                drawHeight
            );
        } else {
            this._renderProcedural(ctx, this.position.x - renderPos.x, this.position.y - renderPos.y);
        }

        ctx.restore();
    }

    /**
     * 程序化表现（美术资源缺失或尺寸不符时的占位绘制）
     */
    _renderProcedural(ctx, centerX, centerY) {
        const progress = this.frameCount > 1 ? this.currentFrame / (this.frameCount - 1) : 0;

        ctx.translate(centerX, centerY);
        ctx.scale(this.scale, this.scale);

        switch (this.shape) {
            case 'aura_ring':
                this._drawAuraRing(ctx, progress);
                break;
            case 'aura_glow':
                this._drawAuraGlow(ctx, progress);
                break;
            case 'orb':
                this._drawOrb(ctx, progress);
                break;
            case 'sword_qi':
                this._drawSwordQi(ctx, progress);
                break;
            case 'ring_expand':
                this._drawExpandRing(ctx, progress);
                break;
            case 'chain':
                this._drawChain(ctx, progress);
                break;
            case 'burst':
            default:
                this._drawBurst(ctx, progress);
                break;
        }
    }

    /** 剑气：环绕主角的旋转剑弧 */
    _drawAuraRing(ctx, progress) {
        const radius = this.frameWidth * 0.42 * (0.78 + 0.34 * progress);
        const gradient = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
        gradient.addColorStop(0, CombatEffect.colorWithAlpha(this.color, 0.30 * (1 - progress * 0.5)));
        gradient.addColorStop(0.65, CombatEffect.colorWithAlpha(this.color, 0.20 * (1 - progress * 0.4)));
        gradient.addColorStop(1, CombatEffect.colorWithAlpha(this.color, 0));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = CombatEffect.colorWithAlpha('#ffffff', 0.85 * (1 - progress * 0.35));
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
            const start = this.spin + i * (Math.PI * 2 / 3);
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.95, start, start + 1.05);
            ctx.stroke();
        }
    }

    /** 气场：角色身周的纵向光晕（护体术 / 闪避） */
    _drawAuraGlow(ctx, progress) {
        const rx = this.frameWidth * 0.45;
        const ry = this.frameHeight * 0.46;
        const pulse = 0.82 + 0.18 * Math.sin(progress * Math.PI);

        const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, ry);
        gradient.addColorStop(0, CombatEffect.colorWithAlpha(this.color, 0.40 * pulse));
        gradient.addColorStop(0.55, CombatEffect.colorWithAlpha(this.color, 0.22 * pulse));
        gradient.addColorStop(1, CombatEffect.colorWithAlpha(this.color, 0));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = CombatEffect.colorWithAlpha('#ffffff', 0.28 * pulse);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * 0.72, ry * 0.78, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    /** 命中特效：扩散的光爆 + 放射线 */
    _drawBurst(ctx, progress) {
        const radius = this.frameWidth * (0.18 + 0.42 * progress);
        const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, radius);
        gradient.addColorStop(0, CombatEffect.colorWithAlpha('#ffffff', 0.85 * (1 - progress)));
        gradient.addColorStop(0.5, CombatEffect.colorWithAlpha(this.color, 0.55 * (1 - progress * 0.8)));
        gradient.addColorStop(1, CombatEffect.colorWithAlpha(this.color, 0));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = CombatEffect.colorWithAlpha('#ffffff', 0.75 * (1 - progress));
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4 + this.spin * 0.25;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * radius * 0.45, Math.sin(angle) * radius * 0.45);
            ctx.lineTo(Math.cos(angle) * radius * 1.25, Math.sin(angle) * radius * 1.25);
            ctx.stroke();
        }
    }

    /**
     * 剑影连斩的剑气：沿飞行方向拉长的剑形光刃（美术缺图时的程序化表现）
     * 朝向由 CombatProjectile.render 写入 tailDirection（= 飞行方向向量）
     */
    _drawSwordQi(ctx, progress) {
        const travel = this.tailDirection || { x: 1, y: 0 };
        const angle = Math.atan2(travel.y, travel.x);
        const length = Math.max(this.frameWidth, this.frameHeight) * (0.62 + 0.10 * Math.sin(progress * Math.PI));
        const halfWidth = Math.max(4, this.frameHeight * 0.14);

        ctx.save();
        ctx.rotate(angle);

        // 外发光（沿剑身铺开，尾部渐隐）
        const glow = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
        glow.addColorStop(0, CombatEffect.colorWithAlpha(this.color, 0));
        glow.addColorStop(0.5, CombatEffect.colorWithAlpha(this.color, 0.28));
        glow.addColorStop(1, CombatEffect.colorWithAlpha(this.color, 0.42));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(0, 0, length / 2, halfWidth * 2.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // 剑身：细长菱形，前端（飞行方向）最亮，尾部透明
        const body = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
        body.addColorStop(0, CombatEffect.colorWithAlpha(this.color, 0));
        body.addColorStop(0.55, CombatEffect.colorWithAlpha(this.color, 0.55));
        body.addColorStop(0.9, CombatEffect.colorWithAlpha('#ffffff', 0.9));
        body.addColorStop(1, CombatEffect.colorWithAlpha('#ffffff', 0.95));
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(length / 2, 0);
        ctx.lineTo(0, halfWidth);
        ctx.lineTo(-length / 2, 0);
        ctx.lineTo(0, -halfWidth);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    /**
     * 命中特效：以命中点为圆心、透明渐变并不断扩大的圆
     * （剑影连斩命中时的程序化表现；美术图到位后自动改用精灵图）
     */
    _drawExpandRing(ctx, progress) {
        const maxRadius = Math.max(this.frameWidth, this.frameHeight) * 0.5;
        const radius = maxRadius * (0.25 + 0.75 * progress);
        const alpha = Math.max(0, 1 - progress);      // 越扩越透明

        // 渐变圆：圆心几乎透明 → 中段彩色光晕 → 边缘亮环 → 最外圈透明
        const gradient = ctx.createRadialGradient(0, 0, radius * 0.12, 0, 0, radius);
        gradient.addColorStop(0, CombatEffect.colorWithAlpha(this.color, 0.05 * alpha));
        gradient.addColorStop(0.55, CombatEffect.colorWithAlpha(this.color, 0.42 * alpha));
        gradient.addColorStop(0.88, CombatEffect.colorWithAlpha('#ffffff', 0.5 * alpha));
        gradient.addColorStop(1, CombatEffect.colorWithAlpha(this.color, 0));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // 外圈亮环：随扩大逐渐变细、变淡
        ctx.strokeStyle = CombatEffect.colorWithAlpha('#ffffff', 0.55 * alpha);
        ctx.lineWidth = Math.max(1, 3 * alpha);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.96, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * 渡厄使「控制」命中：玩家头顶的锁链（32×32 规格，程序化表现）
     * 两个互相扣住的链环 + 暖色光晕；美术图（effects.boss_due_chain）到位后自动改用精灵图
     */
    _drawChain(ctx, progress) {
        const size = Math.min(this.frameWidth, this.frameHeight);
        const pulse = 0.86 + 0.14 * Math.abs(Math.sin(this.spin * 1.6));

        // 锁链的光晕（限制在 32×32 内）
        const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, size * 0.5);
        glow.addColorStop(0, CombatEffect.colorWithAlpha(this.color, 0.40 * pulse));
        glow.addColorStop(1, CombatEffect.colorWithAlpha(this.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // 两个斜向交叠的链环
        const linkW = size * 0.40;
        const linkH = size * 0.62;
        [-1, 1].forEach(side => {
            ctx.save();
            ctx.translate(side * size * 0.13, side * size * 0.09);
            ctx.rotate(side * 0.45);

            ctx.strokeStyle = CombatEffect.colorWithAlpha(this.color, 0.95);
            ctx.lineWidth = Math.max(2, size * 0.12);
            ctx.beginPath();
            ctx.ellipse(0, 0, linkW / 2, linkH / 2, 0, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = CombatEffect.colorWithAlpha('#ffffff', 0.55 * pulse);
            ctx.lineWidth = Math.max(1, size * 0.05);
            ctx.beginPath();
            ctx.ellipse(
                0, 0,
                Math.max(1, linkW / 2 - size * 0.07),
                Math.max(1, linkH / 2 - size * 0.07),
                0, 0, Math.PI * 2
            );
            ctx.stroke();

            ctx.restore();
        });

        // 顶部锁扣（暗示“缚住”）
        ctx.strokeStyle = CombatEffect.colorWithAlpha('#ffffff', 0.7 * pulse);
        ctx.lineWidth = Math.max(1.5, size * 0.08);
        ctx.beginPath();
        ctx.arc(0, -size * 0.34, size * 0.11, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
    }

    /** 弹体：发光灵息球（带朝向拖尾） */
    _drawOrb(ctx, progress) {
        const radius = this.frameWidth * 0.34;
        const tail = this.tailDirection || { x: 0, y: 1 };

        const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, radius * 1.6);
        gradient.addColorStop(0, CombatEffect.colorWithAlpha('#ffffff', 0.95));
        gradient.addColorStop(0.45, CombatEffect.colorWithAlpha(this.color, 0.85));
        gradient.addColorStop(1, CombatEffect.colorWithAlpha(this.color, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = CombatEffect.colorWithAlpha(this.color, 0.35);
        ctx.beginPath();
        ctx.ellipse(
            -tail.x * radius * 0.9,
            -tail.y * radius * 0.9,
            radius * 0.7,
            radius * 0.45,
            Math.atan2(tail.y, tail.x),
            0, Math.PI * 2
        );
        ctx.fill();

        ctx.strokeStyle = CombatEffect.colorWithAlpha('#ffffff', 0.6);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius * (0.9 + 0.1 * progress), 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * 颜色 + 透明度 → rgba 字符串（程序化表现用）
     * @param {string} hex - '#RRGGBB'
     * @param {number} alpha
     * @returns {string}
     */
    static colorWithAlpha(hex, alpha) {
        const value = (hex || '#ffffff').replace('#', '');
        const r = parseInt(value.substring(0, 2), 16) || 255;
        const g = parseInt(value.substring(2, 4), 16) || 255;
        const b = parseInt(value.substring(4, 6), 16) || 255;
        const safeAlpha = Math.max(0, Math.min(1, alpha));
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + safeAlpha + ')';
    }
}

/**
 * 投射物（灵息弹 / 剑影连斩的剑气）
 * 直线飞行；超过最大飞行距离自行消失；帧序列循环播放（剑气 4 行 × 6 帧循环）；
 * 命中判定由 PlayerCombatSystem 负责（命中后立即消失并生成命中特效）。
 */
class CombatProjectile {
    /**
     * @param {Object} config
     * @param {Object} config.position - 起始世界坐标（中心）{x, y}
     * @param {string} config.direction - 飞行方向：'up' | 'down' | 'left' | 'right'
     * @param {number} [config.speed=320] - 飞行速度（像素/秒）
     * @param {number} [config.maxDistance=300] - 最大飞行距离（像素）
     * @param {number} [config.damage=15] - 命中伤害
     * @param {Image} [config.spriteSheet] - 精灵图（4 行：右/左/下/上）
     * @param {number} [config.frameWidth=32] - 单帧宽
     * @param {number} [config.frameHeight=32] - 单帧高
     * @param {number} [config.frameCount=4] - 每行帧数
     * @param {Object} [config.directionRows] - 方向 → 行号
     * @param {number} [config.fps=12] - 播放帧率
     * @param {string} [config.color] - 程序化表现主色
     * @param {string} [config.shape='orb'] - 程序化表现形状：'orb'（灵息球）| 'sword_qi'（剑气）
     * @param {string} [config.label] - 战斗日志用的技能名（命中时随伤害一起结算）
     * @param {Object} [config.hitEffect] - 命中特效配置（技能自带；缺省用灵息弹命中特效）
     */
    constructor(config = {}) {
        this.name = config.name || 'lingxidan';
        this.position = {
            x: (config.position && config.position.x) || 0,
            y: (config.position && config.position.y) || 0,
        };
        this.direction = config.direction || 'down';
        this.speed = config.speed || 320;
        this.maxDistance = config.maxDistance || 300;
        this.damage = config.damage || 15;
        this.radius = config.radius || 14;
        this.color = config.color || '#7fd8ff';
        this.shape = config.shape || 'orb';
        this.label = config.label || '';
        this.hitEffect = config.hitEffect || null;

        this.spriteSheet = config.spriteSheet || null;
        this.frameWidth = config.frameWidth || 32;
        this.frameHeight = config.frameHeight || 32;
        this.frameCount = config.frameCount || 4;
        this.fps = config.fps || 12;
        this.directionRows = config.directionRows || { right: 0, left: 1, down: 2, up: 3 };

        this.row = this.directionRows[this.direction] !== undefined ? this.directionRows[this.direction] : 0;
        this.spriteUsable = CombatEffect.isSpriteUsable(
            this.spriteSheet, this.frameWidth, this.frameHeight, this.frameCount, this.row
        );

        this.currentFrame = 0;
        this.elapsedTime = 0;
        this.frameInterval = 1 / this.fps;
        this.traveled = 0;
        this.alive = true;
    }

    /**
     * 飞行方向向量
     * @returns {Object} {x, y}
     */
    getVector() {
        switch (this.direction) {
            case 'up': return { x: 0, y: -1 };
            case 'down': return { x: 0, y: 1 };
            case 'left': return { x: -1, y: 0 };
            case 'right': return { x: 1, y: 0 };
            default: return { x: 0, y: 1 };
        }
    }

    /**
     * 前进（超过最大飞行距离自行消失）
     * @param {number} deltaTime
     * @returns {boolean} 是否仍然存活
     */
    update(deltaTime) {
        if (!this.alive) return false;

        const vector = this.getVector();
        const step = this.speed * deltaTime;
        this.position.x += vector.x * step;
        this.position.y += vector.y * step;
        this.traveled += step;

        if (this.traveled >= this.maxDistance) {
            this.alive = false;
            return false;
        }

        this.elapsedTime += deltaTime;
        if (this.elapsedTime >= this.frameInterval) {
            const advance = Math.floor(this.elapsedTime / this.frameInterval);
            this.elapsedTime -= advance * this.frameInterval;
            this.currentFrame = (this.currentFrame + advance) % this.frameCount;
        }

        return true;
    }

    /**
     * 命中判定矩形
     * @returns {Object} {x, y, width, height}
     */
    getRect() {
        const size = this.radius * 2;
        return {
            x: this.position.x - size / 2,
            y: this.position.y - size / 2,
            width: size,
            height: size,
        };
    }

    /**
     * 渲染（以 position 为中心）
     */
    render(ctx, camera) {
        const renderPos = camera ? camera.getRenderPosition() : { x: 0, y: 0 };
        const screenX = this.position.x - renderPos.x;
        const screenY = this.position.y - renderPos.y;

        ctx.save();

        if (this.spriteUsable) {
            ctx.drawImage(
                this.spriteSheet,
                this.currentFrame * this.frameWidth,
                this.row * this.frameHeight,
                this.frameWidth,
                this.frameHeight,
                screenX - this.frameWidth / 2,
                screenY - this.frameHeight / 2,
                this.frameWidth,
                this.frameHeight
            );
        } else {
            const effect = new CombatEffect({
                name: this.name,
                frameWidth: this.frameWidth,
                frameHeight: this.frameHeight,
                frameCount: this.frameCount,
                shape: this.shape,
                color: this.color,
                position: this.position,
            });
            effect.tailDirection = this.getVector();
            effect._renderProcedural(ctx, screenX, screenY);
        }

        ctx.restore();
    }
}

if (typeof window !== 'undefined') {
    window.CombatEffect = CombatEffect;
    window.CombatProjectile = CombatProjectile;
}
