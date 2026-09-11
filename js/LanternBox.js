/**
 * 破损运灯箱类（LanternBox）
 *
 * 青岚浮野地图上的固定调查点，与镇风桩（WindPile）共用同一套“任务门控调查点”逻辑：
 * - 箱体常驻显示在地图上（渲染不受任务状态影响）
 * - 只有主线《散落的炊烟》推进到“调查破损运灯箱”这一步时，
 *   玩家靠近破损运灯箱才会出现“按 E 调查”提示
 * - 调查过的箱子不能重复调查（提示同时隐藏）
 * - 调查对话给出“空魂灯”与“云渡泽运送残页”的线索，对话结束后推进对应的
 *   investigate 任务目标
 *
 * 与 WindPile 的差异（仅默认参数与外观）：
 * - 默认贴图尺寸 64×64，image 为 ResourceManager 资源键 'lanternBoxes.broken_lantern_box'
 * - 默认 anchor 为 'center'：图片中心对齐 config.position
 *   （箱子较小且常放在地图上边缘附近，避免顶部被地图上边界裁掉）
 * - 图片缺失时回退到程序化的“破木箱 + 空魂灯 + 运送残页”渲染
 */
class LanternBox extends WindPile {
    /**
     * @param {Object}   config
     * @param {string}   config.id              - 唯一 ID
     * @param {string}   config.name            - 显示名称（默认“破损运灯箱”）
     * @param {Object}   config.position        - 世界坐标（像素）{x, y}，指箱体图片中心
     * @param {number}   config.radius          - 交互半径，默认 60
     * @param {string}   config.promptText      - 提示文本后半部分，默认“调查破损运灯箱”
     * @param {string}   config.image           - ResourceManager 图片键，默认 'lanternBoxes.broken_lantern_box'
     * @param {number}   config.imageWidth      - 图片显示宽度（默认 64）
     * @param {number}   config.imageHeight     - 图片显示高度（默认 64）
     * @param {string}   config.anchor          - 图片对齐方式，默认 'center'
     * @param {string}   config.questId         - 关联任务 ID
     * @param {string}   config.objectiveType   - 关联目标类型，默认 'investigate'
     * @param {string}   config.objectiveTarget - 关联目标 target，如 'broken_lantern_box'
     * @param {Object}   config.dialogue        - 调查对话 { text }（text 用换行符分行）
     */
    constructor(config = {}) {
        super({
            name: '破损运灯箱',
            promptText: '调查破损运灯箱',
            radius: 60,
            imageWidth: 64,
            imageHeight: 64,
            anchor: 'center',
            ...config,
        });
        this.type = 'lantern_box';
    }

    /**
     * 无图片（或图片加载失败）时的回退渲染：一只撬开的破木箱，
     * 箱里立着一盏没点亮过的空魂灯，箱底露出半张运送残页。
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} screenX - 图片中心屏幕 X
     * @param {number} groundY - 图片底边屏幕 Y
     * @param {number} w - 图片显示宽度
     * @param {number} h - 图片显示高度
     */
    _renderFallback(ctx, screenX, groundY, w, h) {
        const topY = groundY - h;
        const dim = this.isInvestigated;   // 已调查：整体压暗

        // ===== 箱体（破木箱）=====
        const boxX = screenX - w * 0.40;
        const boxY = topY + h * 0.36;
        const boxW = w * 0.80;
        const boxH = h * 0.56;

        const bodyGrad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
        bodyGrad.addColorStop(0, dim ? '#4A3A2A' : '#6B4A2F');
        bodyGrad.addColorStop(0.5, dim ? '#5A4632' : '#8A6039');
        bodyGrad.addColorStop(1, dim ? '#3E3024' : '#5C3F28');
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(boxX, boxY, boxW, boxH);

        // 木箱板缝
        ctx.strokeStyle = 'rgba(40, 26, 16, 0.55)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 2; i++) {
            const sx = boxX + (boxW * i) / 3;
            ctx.beginPath();
            ctx.moveTo(sx, boxY);
            ctx.lineTo(sx, boxY + boxH);
            ctx.stroke();
        }

        // 箱口（内部深处）
        ctx.fillStyle = dim ? 'rgba(24, 18, 14, 0.9)' : 'rgba(30, 22, 16, 0.9)';
        ctx.fillRect(boxX + 1, boxY + 1, boxW - 2, boxH * 0.3);

        // 箱体描边
        ctx.strokeStyle = 'rgba(28, 18, 10, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // ===== 撬开的箱盖（斜挂在箱口后侧）=====
        ctx.save();
        ctx.translate(screenX, boxY);
        ctx.rotate(-0.22);
        ctx.fillStyle = dim ? '#4E3C29' : '#7A5535';
        ctx.fillRect(-boxW * 0.46, -h * 0.14, boxW * 0.92, h * 0.13);
        ctx.strokeStyle = 'rgba(28, 18, 10, 0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-boxW * 0.46, -h * 0.14, boxW * 0.92, h * 0.13);
        ctx.restore();

        // ===== 空魂灯（箱内存放，未曾点亮）=====
        const lampX = screenX - w * 0.13;
        const lampY = boxY + boxH * 0.30;
        const lampW = w * 0.22;
        const lampH = h * 0.24;

        // 提梁
        ctx.strokeStyle = dim ? '#6E6A60' : '#9A9488';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(lampX, lampY, lampW * 0.45, Math.PI, Math.PI * 2);
        ctx.stroke();

        // 灯身
        ctx.fillStyle = dim ? '#3A3A42' : '#4C4C56';
        ctx.fillRect(lampX - lampW / 2, lampY, lampW, lampH);
        ctx.strokeStyle = 'rgba(22, 22, 26, 0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(lampX - lampW / 2, lampY, lampW, lampH);

        // 灯芯格（空灯：不亮；可调查时透出一点冷光）
        ctx.fillStyle = this.canInvestigate
            ? 'rgba(150, 205, 230, 0.55)'
            : 'rgba(120, 124, 132, 0.45)';
        ctx.fillRect(lampX - lampW * 0.28, lampY + lampH * 0.24, lampW * 0.56, lampH * 0.52);

        // ===== 运送残页（从箱底露出一角）=====
        ctx.save();
        ctx.translate(screenX + w * 0.22, boxY + boxH * 0.82);
        ctx.rotate(0.18);
        ctx.fillStyle = dim ? '#B9B2A0' : '#E8E2CE';
        ctx.beginPath();
        ctx.moveTo(-w * 0.14, 0);
        ctx.lineTo(w * 0.16, -h * 0.04);
        ctx.lineTo(w * 0.13, h * 0.12);      // 被风撕开的斜边
        ctx.lineTo(-w * 0.02, h * 0.10);
        ctx.lineTo(-w * 0.16, h * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(90, 78, 60, 0.85)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 残页上的字迹与小印
        ctx.strokeStyle = 'rgba(92, 82, 66, 0.7)';
        ctx.beginPath();
        ctx.moveTo(-w * 0.10, h * 0.02);
        ctx.lineTo(w * 0.08, h * 0.01);
        ctx.stroke();
        ctx.fillStyle = 'rgba(160, 60, 48, 0.75)';
        ctx.fillRect(w * 0.06, h * 0.04, w * 0.04, h * 0.04);
        ctx.restore();

        // 已调查：箱口浮起一缕将散的引气（与镇风桩的收尾一致）
        if (this.isInvestigated) {
            ctx.strokeStyle = 'rgba(150, 210, 235, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(screenX, topY + h * 0.16, w * 0.16, Math.PI * 0.15, Math.PI * 0.85);
            ctx.stroke();
        }
    }
}

if (typeof window !== 'undefined') window.LanternBox = LanternBox;
