/**
 * 第二章《云渡泽》冒烟测试（无浏览器，Node 环境）
 *
 * 运行方式（本机无独立 node，用 VS Code 自带的 Electron 以 node 模式运行）：
 *   $env:ELECTRON_RUN_AS_NODE='1'
 *   & 'D:\Microsoft VS Code\Code.exe' tools\smoke_chapter2.js
 *
 * 覆盖范围：
 *   1) 加载 game.html 中列出的全部 js（含新增的 Chapter2Config / DueBoss / LanternIdentifyMiniGame）
 *   2) 第二章任务链：6 条主线首尾相接、章内前置未完成不可接取（章首无跨章前置）、目标不可跳步
 *   3) 阿禾跨章深合并（保留第一章美术与商店数据，并入第二章对白）、新 NPC 规格
 *   4) 全部对话节点都有文本、选择器在 20+ 种任务状态下返回预期对白
 *   5) 云渡泽 / 万灯台两张地图的碰撞表尺寸、外圈封死、所有交互点从入口可达
 *   6) 门控：万灯台调查点顺序、认灯台 / 旧水道 / 泊位路标、万灯台传送法阵
 *      （接取主线四 + 向许录取得万灯台通行凭证后才出现，teleporters.requireObjective）；
 *      第二章战场只保留正式入口 wandengtai（云渡泽出生点旁的调试法阵已下线），
 *      且「打赢过就不再生成 Boss」（击败标记 或 击败目标已完成，见 Main.isArenaBossAlreadyDefeated）
 *   7) 小游戏：认灯归魂（4 盏魂灯 / 灯序全排列 / 3 次机会 /「几盏位置对」反馈常驻到下次结算）、
 *      逆流送灯（横版行舟：小船单行 4 帧 128×104 只上下闪避、礁石/浮木 96×96 自右向左、
 *      河道碰撞图取上下范围、一局共 60 个障碍物、左上角显示剩余障碍物（不再倒计时）、
 *      每个障碍物超出视野计数 -1、最后一个消失即送达、撞上即失败）
 *   8) 渡厄使：7 套动画规格（单帧 96×96；待机列排列）、召唤小兵（上限 2）、冲刺（不可打断 + 圆形判定）、
 *      控制（禁键 3 秒 + 头顶锁链）、受击打断（播放中再次受伤不重播）、轴对齐追击、战败停帧 + 清空小兵
 *   9) 任务奖励：灵石 / 上限小增 / 丹药 / 技能点 / 境界 / 技能 / 解锁地图
 *  10) 资源登记齐全 + 占位资源文件尺寸符合规格
 *  10b) 剑影连斩（O）：第二章主线一试炼传授 / 四向剑气 / 命中扩大圆 / 教学圈门控（唯一教学圈）
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function check(name, condition, extra) {
    if (condition) {
        passed++;
        console.log(`  [通过] ${name}`);
    } else {
        failed++;
        console.log(`  [失败] ${name}${extra !== undefined ? ' → ' + JSON.stringify(extra) : ''}`);
    }
}

function section(title) {
    console.log(`\n=== ${title} ===`);
}

// ==================== 浏览器环境最小桩 ====================

function createRecordingContext() {
    const ctx = {
        canvas: { width: 1280, height: 720 },
        fillText: () => {},
        strokeText: () => {},
        drawImage: () => {},
        fillRect: () => {},
        measureText: (t) => ({ width: String(t).length * 8 }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    };
    return new Proxy(ctx, {
        get(target, prop) {
            if (prop in target) return target[prop];
            return () => {};
        },
        set(target, prop, value) {
            target[prop] = value;
            return true;
        },
    });
}

function installBrowserStubs() {
    const canvas = {
        width: 1280, height: 720,
        getContext: () => createRecordingContext(),
        addEventListener() {}, removeEventListener() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
        style: {},
    };

    globalThis.window = globalThis;
    globalThis.addEventListener = () => {};
    globalThis.removeEventListener = () => {};
    globalThis.requestAnimationFrame = () => 0;
    globalThis.cancelAnimationFrame = () => {};
    globalThis.performance = globalThis.performance || { now: () => Date.now() };
    globalThis.document = {
        getElementById: () => canvas,
        createElement: () => ({
            getContext: () => createRecordingContext(),
            toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=',
            style: {},
            addEventListener() {},
        }),
        addEventListener() {}, removeEventListener() {},
        body: { appendChild() {} },
    };
    globalThis.localStorage = {
        _data: {},
        getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; },
        clear() { this._data = {}; },
    };
    globalThis.Audio = class { play() {} pause() {} cloneNode() { return this; } };
    globalThis.Image = class {
        constructor() { this.width = 0; this.height = 0; this.naturalWidth = 0; this.naturalHeight = 0; }
        set src(v) { this._src = v; }
        get src() { return this._src; }
    };
}

// ==================== 脚本加载 / 图片尺寸 ====================

function getScriptFiles() {
    const html = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
    const files = [];
    const re = /<script\s+src="(js\/[^"]+\.js)"\s*>\s*<\/script>/g;
    let m;
    while ((m = re.exec(html)) !== null) files.push(m[1]);
    return files;
}

function loadGameScripts(context) {
    const files = getScriptFiles();
    for (const rel of files) {
        const filePath = path.join(ROOT, rel.replace(/\//g, path.sep));
        vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: rel });
    }
    return files;
}

function readPngSize(filePath) {
    const buf = fs.readFileSync(filePath);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function pngSize(...segments) {
    const filePath = path.join(ROOT, ...segments);
    if (!fs.existsSync(filePath)) return null;
    return readPngSize(filePath);
}

function sizeEq(size, w, h) {
    return !!size && size.width === w && size.height === h;
}

// ==================== 断言 ====================

async function main() {
    installBrowserStubs();
    const context = vm.createContext(globalThis);

    section('1. 加载 game.html 中列出的全部脚本');
    const files = loadGameScripts(context);
    check(`加载 ${files.length} 个 js 文件（语法/加载期均正常）`, files.length > 0);
    check('game.html 已引入 Chapter2Config.js', files.indexOf('js/Chapter2Config.js') !== -1);
    check('game.html 已引入 DueBoss.js', files.indexOf('js/DueBoss.js') !== -1);
    check('game.html 已引入 LanternIdentifyMiniGame.js', files.indexOf('js/LanternIdentifyMiniGame.js') !== -1);

    const runner = fs.readFileSync(path.join(__dirname, 'smoke_chapter2_runner.js'), 'utf8');
    const R = JSON.parse(await vm.runInContext(runner, context, { filename: 'smoke_chapter2_runner.js' }));

    section('2. 第二章任务链（6 条主线首尾相接）');
    check('6 个任务全部注册',
        R.chain.ids.join(',') === 'chapter2_main_1,chapter2_main_2,chapter2_main_3,chapter2_main_4,chapter2_ending_1,chapter2_ending_2',
        R.chain.ids);
    check('任务标题与策划一致',
        R.chain.titles.join(',') === '渡口无归客,一封到不了的家书,逆流送灯,万灯渡口,灯定丹成,行舟有归处',
        R.chain.titles);
    check('前置链：main_1（章首无跨章前置，策划案 M01=初到云渡泽）→ main_2 → main_3 → main_4 → ending_1 → ending_2',
        JSON.stringify(R.chain.prereq) === JSON.stringify([
            [], ['chapter2_main_1'], ['chapter2_main_2'], ['chapter2_main_3'],
            ['chapter2_main_4'], ['chapter2_ending_1'],
        ]), R.chain.prereq);
    check('nextQuest 链与前置链一致',
        JSON.stringify(R.chain.next) === JSON.stringify([
            'chapter2_main_2', 'chapter2_main_3', 'chapter2_main_4',
            'chapter2_ending_1', 'chapter2_ending_2', null,
        ]), R.chain.next);
    check('order 依次为 1..6', R.chain.orders.join(',') === '1,2,3,4,5,6', R.chain.orders);
    check('每条主线都配置了奖励（灵石或气血/灵息上限）',
        R.chain.rewards.every(r => (r.lingShi || 0) > 0 || (r.maxHealth || 0) > 0 || (r.maxMana || 0) > 0),
        R.chain.rewards);
    check('主线一/二/三灵石合计 1200（策划案数值）', R.chain.lingShiMain3 === 1200, R.chain.lingShiMain3);
    check('主线一：第 3 个目标是完成剑修基础连招试炼（complete_training/sword）→ 试炼完成即传授剑影连斩',
        R.chain.objectives[0][2] && R.chain.objectives[0][2].type === 'complete_training'
        && R.chain.objectives[0][2].target === 'sword'
        && JSON.stringify(R.chain.rewards[0].skills) === JSON.stringify(['jianying']),
        { objective: R.chain.objectives[0][2], rewards: R.chain.rewards[0] });
    check('章末一《灯定丹成》只剩一个目标：完成结丹调息（不再有 learn_skill jianying）',
        R.chain.objectives[4].length === 1
        && R.chain.objectives[4][0].type === 'complete_core_trial'
        && R.chain.objectives[4][0].target === 'jiedan',
        R.chain.objectives[4]);
    check('章末一奖励只剩灵石 +400 与境界→结丹（不再发技能、不再解锁照尘仙城）',
        R.chain.rewards[4].lingShi === 400 && R.chain.rewards[4].realm === 'jiedan'
        && R.chain.rewards[4].skills === undefined && R.chain.rewards[4].unlockMap === undefined,
        R.chain.rewards[4]);
    check('主线三《逆流送灯》目标链 = 5 项（ahe → 逆流行舟 → 江晚 → 陈栎 → 陆舟），soul_return 目标已删除',
        R.chain.objectives[2].map(o => o.type).join(',') === 'talk_to,complete_minigame,talk_to,talk_to,talk_to'
        && R.chain.objectives[2].map(o => o.target).join(',') === 'ahe,boat_navigation,jiangwan,chenli,luzhou'
        && R.chain.objectives[2].every(o => o.type !== 'soul_return'),
        R.chain.objectives[2]);

    section('3. 顺序约束：不可跳章 / 不可跳任务 / 不可跳目标');
    check('第一章未完成也能接取第二章主线一（章首无跨章前置 → 任务面板会立刻显示该任务）',
        R.order.acceptBeforeChapter1 === true);
    check('前置未完成 → 无法直接接取主线三', R.order.acceptAhead === false);
    check('第一章完成后可接取主线一', R.order.acceptMain1 === true);
    check('跳步推进第 3 个目标无效（当前目标仍是 talk_to xulu）',
        R.order.afterSkip.type === 'talk_to' && R.order.afterSkip.target === 'xulu'
        && R.order.afterSkip.progress === 0, R.order.afterSkip);
    check('主线一未完成 → 无法接取主线二', R.order.acceptMain2Early === false);
    check('按序跑完整条链：6 个任务全部完成',
        R.order.fullChain.length === 6 && R.order.fullChain.every(pair => pair[1] === true),
        R.order.fullChain);

    section('4. NPC：阿禾跨章复用 + 新角色规格');
    check('阿禾同时保留第一章与第二章对白（深合并）',
        R.npc.ahe.ch1Dialogue === true && R.npc.ahe.ch2Dialogue === true, R.npc.ahe);
    check('阿禾 idle 帧尺寸沿用第一章（32×32，图片资源复用）', R.npc.ahe.idleFrameWidth === 32, R.npc.ahe.idleFrameWidth);
    check('阿禾商店数据保留（配置里仍有 shopItems；闲聊里的商店入口已下线）', R.npc.ahe.shopItems >= 3, R.npc.ahe.shopItems);
    check('阿禾治疗动画保留（extraAnimations 含 heal）',
        R.npc.ahe.extraAnimations.indexOf('heal') !== -1, R.npc.ahe.extraAnimations);
    check('阿禾搬迁点两章并存', R.npc.ahe.movePositionKeys.join(',') === 'berth,court,quay,rescue_point',
        R.npc.ahe.movePositionKeys);
    check('新增 5 名 NPC（陆舟 / 江婆 / 江晚 / 陈栎 / 许录）均有名字与 idle 尺寸',
        R.npc.newNpcs.length === 5 && R.npc.newNpcs.every(n => n[0] && n[1] && n[3] > 0), R.npc.newNpcs);
    check('新 NPC 的 idle 单帧尺寸：陆舟 / 江婆 / 江晚 32×64，陈栎 58×64，许录 48×64',
        R.npc.newNpcs.map(n => `${n[2]}×${n[3]}`).join(',') === '32×64,32×64,32×64,58×64,48×64',
        R.npc.newNpcs.map(n => [n[0], `${n[2]}×${n[3]}`]));
    check('陆舟 / 江婆 / 江晚 idle 为单帧（row，四方向共用第 0 行）',
        ['luzhou', 'jiangpo', 'jiangwan'].every(id => {
            const n = R.npc.newNpcs.find(x => x[0] === id);
            return n[5] === 'row' && n[6] === '0,0,0,0' && n[7] === '1,1,1,1';
        }), R.npc.newNpcs.filter(n => ['luzhou', 'jiangpo', 'jiangwan'].indexOf(n[0]) !== -1));
    check('陈栎 / 许录 idle 为列排列（column，4 列 = 下/左/右/上，每列 1 帧）',
        ['chenli', 'xulu'].every(id => {
            const n = R.npc.newNpcs.find(x => x[0] === id);
            return n[5] === 'column' && n[6] === '0,1,2,3' && n[7] === '1,1,1,1';
        }), R.npc.newNpcs.filter(n => ['chenli', 'xulu'].indexOf(n[0]) !== -1));
    check('江婆有两个 idle（idle + extraAnimations.idle_after，均为单帧 32×64）',
        (() => {
            const jp = R.npc.newNpcs.find(x => x[0] === 'jiangpo');
            const idleAfter = R.npc.jiangpoIdleAfter || {};
            return jp[8] === 'idle_after' && idleAfter.frameWidth === 32 && idleAfter.frameHeight === 64
                && idleAfter.resourcePath === 'npc.jiangpo_idle_after'
                && idleAfter.directionMode === 'row'
                && ['down', 'left', 'right', 'up'].every(dir =>
                    idleAfter.directions && idleAfter.directions[dir] && idleAfter.directions[dir].frames === 1);
        })(), { names: R.npc.newNpcs.find(x => x[0] === 'jiangpo')[8], idleAfter: R.npc.jiangpoIdleAfter });
    check('第二章 5 名 NPC 的 displayScale 均为 1（新美术 2 倍像素密度）',
        R.npc.newNpcs.every(n => n[9] === 1), R.npc.newNpcs.map(n => [n[0], n[9]]));
    check('每个 NPC 至少配置 4 段对白', R.npc.newNpcs.every(n => n[4] >= 4), R.npc.newNpcs.map(n => [n[0], n[4]]));
    check('所有对话节点都有文本', R.npc.missingText.length === 0, R.npc.missingText);
    check('对话节点的 id 与键名一致', R.npc.badId.length === 0, R.npc.badId);

    section('5. 对话选择器：按任务状态回放');
    check('A 初到云渡泽 → 阿禾 A01 / 陆舟闲聊 / 许录闲聊',
        R.sel.A[0] === 'c2_a01_arrive' && R.sel.A[1] === 'c2_luzhou_idle' && R.sel.A[2] === 'c2_xulu_idle',
        R.sel.A);
    check('B 主线一进行中 → 阿禾提醒 / 许录登记 / 陆舟先要摘页',
        R.sel.B[0] === 'c2_a02_progress' && R.sel.B[1] === 'c2_x01_registry' && R.sel.B[2] === 'c2_luzhou_idle',
        R.sel.B);
    check('B2 取得摘页后 → 陆舟核对旧航线（L01）', R.sel.B2[0] === 'c2_l01_route', R.sel.B2);
    check('B3 核对完航线 → 陆舟提示练招（L02）', R.sel.B3[0] === 'c2_l02_sword_hint', R.sel.B3);
    check('C 主线一完成 → 阿禾指向江婆 / 江婆可接任务 / 许录闲聊',
        R.sel.C[0] === 'c2_a03_next' && R.sel.C[1] === 'c2_j01_ask' && R.sel.C[2] === 'c2_x02_after_registry',
        R.sel.C);
    check('D 主线二进行中 → 阿禾补充线索 / 许录开核验栏 / 江婆给线索',
        R.sel.D[0] === 'c2_a04_chenli_clue' && R.sel.D[1] === 'c2_x03_lamps' && R.sel.D[2] === 'c2_j02_progress',
        R.sel.D);
    check('D2 取得魂灯后再找许录仍是开核验栏（可重复查看）', R.sel.D2[0] === 'c2_x03_lamps', R.sel.D2);
    check('E 主线二完成 → 陆舟给旧水道方案 / 许录说文书被退',
        R.sel.E[0] === 'c2_l03_old_route' && R.sel.E[1] === 'c2_x04_refused', R.sel.E);
    check('F 主线三进行中 → 阿禾确认归魂点 / 陆舟开船叮嘱 / 江晚陈栎给证词',
        R.sel.F[0] === 'c2_a05_court_ready' && R.sel.F[1] === 'c2_l04_escort_ready'
        && R.sel.F[3] === 'c2_w01_testimony' && R.sel.F[4] === 'c2_c01_testimony', R.sel.F);
    check('F2 归魂之后 → 阿禾提示问证词 / 江婆陪女儿',
        R.sel.F2[0] === 'c2_a05b_after_soul_return' && R.sel.F2[1] === 'c2_j04_wait', R.sel.F2);
    check('F3 证词齐 → 陆舟交付（L05）', R.sel.F3[0] === 'c2_l05_deliver', R.sel.F3);
    check('G 主线三完成 → 陆舟接取万灯台（L06）/ 阿禾战前叮嘱',
        R.sel.G[0] === 'c2_l06_wandengtai' && R.sel.G[1] === 'c2_a06_pre_boss', R.sel.G);
    check('H 主线四进行中 → 许录给凭证 / 阿禾战前叮嘱 / 陆舟进度提示',
        R.sel.H[0] === 'c2_x05_token' && R.sel.H[1] === 'c2_a06_pre_boss' && R.sel.H[2] === 'c2_l07_progress',
        R.sel.H);
    check('H2 Boss 已胜 → 四名 NPC 战后对白 / 陆舟提示回去交付',
        R.sel.H2[0] === 'c2_x06_after_boss' && R.sel.H2[1] === 'c2_j05_after_boss'
        && R.sel.H2[2] === 'c2_w03_after_boss' && R.sel.H2[3] === 'c2_c03_after_boss'
        && R.sel.H2[4] === 'c2_l07b_investigated', R.sel.H2);
    check('I 主线四完成 → 阿禾结丹入口（A08）', R.sel.I[0] === 'c2_a08_core_ready', R.sel.I);
    check('I2 结丹进行中 → 仍是结丹入口（可重复触发）', R.sel.I2[0] === 'c2_a08_core_ready', R.sel.I2);
    check('I3 结丹完成 → 陆舟行舟已修好（L08）', R.sel.I3[0] === 'c2_l08_boat_ready', R.sel.I3);
    check('I4 行舟有归处进行中 → 阿禾安置交接（A09）', R.sel.I4[0] === 'c2_a09_depart_plan', R.sel.I4);
    check('I5 第二章完成 → 阿禾 / 陆舟改为船上闲聊',
        R.sel.I5[0] === 'c2_ahe_idle' && R.sel.I5[1] === 'c2_luzhou_idle', R.sel.I5);

    section('5b. 阶段推进后的回落对白（交付节点 / 过期接取选项 / 死节点）');
    check('C0 主线一目标全齐（只差交付）→ 阿禾交付对话 A03（不再念 A02「先找许录要登记…」）',
        R.sel.C0[0] === 'c2_a03_report', R.sel.C0);
    check('D3 认灯核对完成（只差交付）→ 江婆交付对话 J03（不再念 J02「她过河怕…」线索）',
        R.sel.D3[0] === 'c2_j03_deliver', R.sel.D3);
    check('D4 主线二进行中（陈栎线索已问、认灯台未做）→ 阿禾改为阶段闲聊（不再念主线一的 A02）',
        R.sel.D4[0] === 'c2_ahe_idle_shed', R.sel.D4);
    check('E 主线二完成、还没找陆舟接主线三 → 阿禾 / 江婆都改为阶段闲聊',
        R.sel.E[2] === 'c2_ahe_idle_shed' && R.sel.E[3] === 'c2_jiangpo_idle', R.sel.E);
    check('E 阿禾阶段闲聊节点 c2_ahe_idle_shed：有文本 + 结束选项（商店入口已移除）',
        R.npc.aheShedIdle.hasText && R.npc.aheShedIdle.options.length === 1
        && R.npc.aheShedIdle.options.every(o => o.indexOf('open_shop') === -1), R.npc.aheShedIdle);
    check('G2 主线三完成、万灯台未接取 → 江婆陪女儿（J04）/ 江晚 W02 / 陈栎 C02（不再跳「我帮您认灯」）',
        R.sel.G2[0] === 'c2_j04_wait' && R.sel.G2[1] === 'c2_w02_wait' && R.sel.G2[2] === 'c2_c02_wait',
        R.sel.G2);
    check('H0 Boss 已胜、台后账册/命令还没查 → 阿禾不再念战前叮嘱「你一定回来」（改为阶段闲聊）',
        R.sel.H0[0] === 'c2_ahe_idle_shed', R.sel.H0);
    check('H1 账册与命令已查、只差向阿禾交付 → 交付对话 A07（A07 不再是取不到的死节点）',
        R.sel.H1[0] === 'c2_a07_deliver', R.sel.H1);
    check('I 主线四完成、结丹未接取 → 阿禾结丹入口（A08）/ 陆舟闲聊（不再催万灯台通行凭证）',
        R.sel.I[0] === 'c2_a08_core_ready' && R.sel.I[1] === 'c2_luzhou_idle', R.sel.I);
    check('全阶段审计：没有任何阶段的「接取任务」选项指向已完成的任务（过期接取选项）',
        R.audit.expiredAccepts.length === 0, R.audit.expiredAccepts);
    check('全阶段审计：没有取不到的死节点（交付对话 A03 / A07 / J03 均已可达）',
        R.audit.deadNodes.length === 0, R.audit.deadNodes);
    check(`全阶段审计：${R.audit.stageCount} 个任务阶段 × 6 名 NPC 都取到了对白`,
        R.audit.stageCount >= 30
        && R.audit.stages.every(row => Object.keys(row[1]).every(id => !!row[1][id])), R.audit.stageCount);
    check('第一章地图上阿禾 / 祁伯仍走第一章对白（回归保护）',
        !!R.sel.chapter1[0] && !!R.sel.chapter1[1], R.sel.chapter1);

    section('6. 地图与碰撞：云渡泽 / 万灯台');
    check('云渡泽：tileSize 32，100×56 瓦片，碰撞表 56 行且每行 100 格',
        R.map.yun.tileSize === 32 && R.map.yun.mapWidth === 100 && R.map.yun.mapHeight === 56
        && R.map.yun.rows === 56 && R.map.yun.uniformCols === true, R.map.yun);
    check('云渡泽碰撞表仅含 . 与 #', R.map.yun.chars === '.#' || R.map.yun.chars === '#.', R.map.yun.chars);
    check('云渡泽外圈（首/末行）封死，玩家不会走出地图', R.map.yunBorderBlocked === true);
    check('云渡泽所有交互点（NPC/调查点/路标/法阵/教学圈/泊位）从入口可达',
        R.map.yunUnreachable.length === 0, R.map.yunUnreachable);
    check('云渡泽可通行区域整体连通（可达 = 可通行）',
        R.map.yunWalkable.reached === R.map.yunWalkable.walkable, R.map.yunWalkable);
    check('万灯台：tileSize 40，32×18 瓦片，碰撞表 18 行且每行 32 格',
        R.map.arena.tileSize === 40 && R.map.arena.mapWidth === 32 && R.map.arena.mapHeight === 18
        && R.map.arena.rows === 18 && R.map.arena.uniformCols === true, R.map.arena);
    check('万灯台所有交互点（落点/Boss/阵灯/账册/命令）可达',
        R.map.arenaUnreachable.length === 0, R.map.arenaUnreachable);
    check('万灯台地图正中心可站人（归途法阵落点）', R.map.arenaCenterWalkable === true);
    check('云渡泽石台法阵的落点＝万灯台入场点', R.map.arenaTeleportTargetMatchesEntry === true);

    section('7. 门控：调查点 / 路标 / 传送法阵（正式入口 wandengtai + 战后不再生成 Boss）');
    check('账册在击败 Boss 前不可调查', R.gates.zhangceBeforeBoss === false);
    check('击败 Boss 后账册可调查', R.gates.zhangceAfterBoss === true);
    check('账册未查完前，命令不可调查（严格按顺序）',
        R.gates.minglingBeforeZhangce === false && R.gates.minglingAfterZhangce === true, R.gates);
    check('两个调查点各自发放对应剧情物品',
        R.gates.zhangceGrant.join(',') === 'zhuanyun_zhangce' && R.gates.minglingGrant.join(',') === 'taixuan_mingling',
        [R.gates.zhangceGrant, R.gates.minglingGrant]);
    check('认灯台：读清线索前不可见 / 之后可见',
        R.gates.lanternSignBeforeClue === false && R.gates.lanternSignAfterClue === true, R.gates);
    check('旧水道：主线三未接取时不可见', R.gates.escortSignBeforeM3 === false);
    check('旧水道：主线三完成后仍保留（可按 E 重玩护送）', R.gates.escortSignAfterM3 === true);
    check('万灯台法阵：接取主线四前隐藏 / 接取后仍隐藏（要先拿通行凭证）/「向许录取得万灯台通行凭证」后才出现',
        R.gates.wandengtaiBeforeM4 === false
        && R.gates.wandengtaiAfterM4 === false
        && R.gates.wandengtaiAfterToken === true, R.gates);
    check('万灯台法阵参数正确（战场流程 / 击败标记 / 资源分组 / 胜利目标 / 返回地图 / 目标门控 talk_to:xulu）',
        R.gates.wandengtaiArena.bossArena === true
        && R.gates.wandengtaiArena.flag === 'due_boss_defeated'
        && R.gates.wandengtaiArena.group === 'bossArenaCh2'
        && R.gates.wandengtaiArena.victory.questId === 'chapter2_main_4'
        && R.gates.wandengtaiArena.victory.target === 'boss_due'
        && R.gates.wandengtaiArena.returnMapId === 'yunduze'
        && R.gates.wandengtaiArena.questRequired === 'chapter2_main_4'
        && R.gates.wandengtaiArena.requireObjective.type === 'talk_to'
        && R.gates.wandengtaiArena.requireObjective.target === 'xulu',
        R.gates.wandengtaiArena);
    check('调试通道已下线：云渡泽只剩正式入口（无 teleport_boss_due_debug / 无调试开关与配置方法）',
        R.gates.debugPortalGone.mapHasArray === false
        && R.gates.debugPortalGone.teleporterKeys.join(',') === 'teleport_wandengtai'
        && R.gates.debugPortalGone.configHasToggle === false
        && R.gates.debugPortalGone.configHasGetter === false
        && R.gates.debugPortalGone.arrayHasDebugField === false
        && R.gates.debugPortalGone.mainHasResetMethod === false,
        R.gates.debugPortalGone);
    check('击败判据：有标记 / 只有击败目标完成（并补记标记）/ 没赢过 → 已击败·已击败·未击败',
        R.gates.bossRespawnGuard.withFlag === true
        && R.gates.bossRespawnGuard.objectiveOnly === true
        && R.gates.bossRespawnGuard.flagBackfilled === true
        && R.gates.bossRespawnGuard.noWin === false,
        R.gates.bossRespawnGuard);
    check('打赢后再从正式入口进场：不再生成渡厄使（ensureArenaBoss=false）+ 归途法阵已就位',
        R.gates.arenaEntry.bossBeforeEnter === false
        && R.gates.arenaEntry.bossAfterEnter === false
        && R.gates.arenaEntry.bossAlive === false
        && R.gates.arenaEntry.defeatFlagAfterEnter === true
        && R.gates.arenaEntry.exitArrayCreated === true,
        R.gates.arenaEntry);
    check('正式入口进场参数正确（战场参数 / 返回云渡泽法阵旁 2900,358 / 结算标记重置 / 交出操作权）',
        R.gates.arenaEntry.arenaFlag === 'due_boss_defeated'
        && R.gates.arenaEntry.arenaGroup === 'bossArenaCh2'
        && R.gates.arenaEntry.returnPoint !== null
        && R.gates.arenaEntry.returnPoint.mapId === 'yunduze'
        && R.gates.arenaEntry.returnPoint.x === 2900
        && R.gates.arenaEntry.returnPoint.y === 358
        && R.gates.arenaEntry.victoryHandled === false
        && R.gates.arenaEntry.interacting === false,
        R.gates.arenaEntry);
    check('首次进场先播 B01 对白、对白读完才生成渡厄使（补漏回归：Main.hasStoryFlag）',
        R.gates.firstEntry.dialogueId === 'b01_encounter'
        && R.gates.firstEntry.dialoguePrefix === '渡厄使: '
        && R.gates.firstEntry.hasCallback === true
        && R.gates.firstEntry.bossDuringDialogue === false
        && R.gates.firstEntry.introLockDuringDialogue === true
        && R.gates.firstEntry.introLockAfterDialogue === true
        && R.gates.firstEntry.b01FlagSet === true
        && R.gates.firstEntry.bossAfterDialogue === true,
        R.gates.firstEntry);
    check('泊位登船路标：主线四阶段不可见', R.gates.boatSignAtM4 === false);
    check('泊位登船路标：接取《行舟有归处》后仍不可见（要先与阿禾交接）', R.gates.boatSignAfterAccept === false);
    check('泊位登船路标：与阿禾交接后可见', R.gates.boatSignAfterTalkToAhe === true);
    check('泊位登船路标位置 = 中央泊位 (587,1327)',
        R.gates.boatSignPosition.x === 587 && R.gates.boatSignPosition.y === 1327, R.gates.boatSignPosition);

    section('8. 小游戏：认灯归魂 / 逆流送灯');
    check('认灯归魂：地图中心上/下/左/右各 200px 一盏魂灯，编号 1-4',
        R.lanternIdentify.lanternCount === 4
        && R.lanternIdentify.numbers.join(',') === '1,2,3,4'
        && R.lanternIdentify.offsets.map(o => o.join(',')).join('|') === '0,-200|0,200|-200,0|200,0',
        R.lanternIdentify);
    check('认灯归魂：开局四盏都是灭的 / 魂灯图 48×64 / 无限时',
        R.lanternIdentify.litAtStart === true
        && R.lanternIdentify.art.w === 48 && R.lanternIdentify.art.h === 64
        && R.lanternIdentify.timeLimit === 0, R.lanternIdentify);
    check('认灯归魂：每次开始抽一个 1234 的全排列作为目标灯序',
        R.lanternIdentify.targetOrderIsPermutation === true
        && R.lanternIdentify.maxAttempts === 3, R.lanternIdentify);
    check('认灯归魂：点错顺序扣一次机会 + 提示「2 盏位置对」+ 熄灭全部魂灯重来（灯序不变）',
        R.lanternIdentify.afterWrong.correct === 2
        && R.lanternIdentify.afterWrong.attemptsLeft === 2
        && R.lanternIdentify.afterWrong.round === 2
        && R.lanternIdentify.afterWrong.litAfterReset === 0
        && R.lanternIdentify.afterWrong.litOrderAfterReset.length === 0
        && R.lanternIdentify.afterWrong.completed === false
        && R.lanternIdentify.afterWrong.feedback.indexOf('2 盏灯亮的位置是对的') !== -1
        && R.lanternIdentify.afterWrong.targetBeforeWrong === R.lanternIdentify.afterWrong.targetAfterWrong,
        R.lanternIdentify.afterWrong);
    check('认灯归魂：失败提示常驻（点错后过 4 秒仍显示「N 盏位置对」，不随计时器消失）',
        R.lanternIdentify.afterWrong.feedbackPersistent === true
        && R.lanternIdentify.afterWrong.feedbackTimer === 0
        && R.lanternIdentify.afterWrong.hintSurvivedTimer === true
        && R.lanternIdentify.afterWrong.hintTextAfter4s === R.lanternIdentify.afterWrong.feedback
        && R.lanternIdentify.afterWrong.hintTextAfter4s.indexOf('2 盏灯亮的位置是对的') !== -1,
        R.lanternIdentify.afterWrong);
    check('认灯归魂：点错后按住 E 不放 → 四盏保持熄灭（不会被按键连发立刻重新点亮）；松开再按可继续',
        R.lanternIdentify.eHold.afterHold.litCount === 0
        && R.lanternIdentify.eHold.afterHold.litOrder.length === 0
        && R.lanternIdentify.eHold.afterHold.attemptsLeft === 2
        && R.lanternIdentify.eHold.afterHold.eHeld === true
        && R.lanternIdentify.eHold.afterReleasePress === 1,
        R.lanternIdentify.eHold);
    check('认灯归魂：同一帧被更新两次（MiniGameScene + Main.updateMiniGame）→ 第 4 盏不会被二次点亮',
        R.lanternIdentify.eSameFrame.litCount === 0
        && R.lanternIdentify.eSameFrame.litOrder.length === 0
        && R.lanternIdentify.eSameFrame.attemptsLeft === 2
        && R.lanternIdentify.eSameFrame.armed === false,
        R.lanternIdentify.eSameFrame);
    check('认灯归魂：按目标灯序点亮 → 完成并返回 success（第 2 次机会通关）',
        R.lanternIdentify.completed === true && R.lanternIdentify.resultSuccess === true
        && R.lanternIdentify.resultAttemptsUsed === 2
        && R.lanternIdentify.resultLitOrder.join('') === R.lanternIdentify.afterWrong.targetAfterWrong
        && R.lanternIdentify.litStaysLit === true, R.lanternIdentify);
    check('认灯归魂：点亮后不可熄灭 / 不可重复点亮',
        R.lanternIdentifyFail.replay.afterFirst === '1'
        && R.lanternIdentifyFail.replay.lit === true
        && R.lanternIdentifyFail.replay.litOrderLength === 1, R.lanternIdentifyFail.replay);
    check('认灯归魂：3 次机会用尽 → fail 退出（每轮都给「几盏位置对」的反馈）',
        R.lanternIdentifyFail.failed === true && R.lanternIdentifyFail.resultSuccess === false
        && R.lanternIdentifyFail.attemptsLeft === 0
        && R.lanternIdentifyFail.resultAttemptsUsed === 3
        && R.lanternIdentifyFail.rounds.map(r => r.attemptsLeft).join(',') === '2,1,0'
        && R.lanternIdentifyFail.rounds.map(r => r.correct).join(',') === '0,0,0'
        && R.lanternIdentifyFail.rounds[0].feedback.indexOf('没有一盏灯亮在正确的位置') !== -1
        && R.lanternIdentifyFail.rounds[0].feedbackPersistent === true
        && R.lanternIdentifyFail.rounds[1].feedbackPersistent === true
        && R.lanternIdentifyFail.rounds[2].feedbackPersistent === false,
        R.lanternIdentifyFail);
    check('认灯归魂：认灯台碰撞图折成 40px 瓦片表（32×18 / 白可走 黑阻挡 / 出生点与边框判定）',
        R.lanternCollision.tileSize === 40
        && R.lanternCollision.mapCols === 32 && R.lanternCollision.mapRows === 18
        && R.lanternCollision.source === 'fallback' && R.lanternCollision.enabled === true
        && R.lanternCollision.walkableCount === 217
        && R.lanternCollision.reachableCenterCount > 100
        && R.lanternCollision.spawnWalkable === true
        && R.lanternCollision.cornerBlocked === true,
        R.lanternCollision);
    check('认灯归魂：四向走到认灯台边框就停（不靠 60/1220 的死边界，也不穿出菱形场地）',
        R.lanternCollision.stopRight > 1040
        && R.lanternCollision.stopRight < R.lanternCollision.bounds.right - 100
        && R.lanternCollision.stopLeft > 200 && R.lanternCollision.stopLeft < 260
        && R.lanternCollision.stopUp > 80 && R.lanternCollision.stopUp < 130
        && R.lanternCollision.stopDown > 560
        && R.lanternCollision.stopDown < R.lanternCollision.bounds.bottom - 40,
        R.lanternCollision);
    check('认灯归魂：碰撞自检要求四盏魂灯都走得到、F2 碰撞覆盖层可开关',
        R.lanternCollision.maxLanternDistance <= R.lanternCollision.interactRadius
        && R.lanternCollision.debug.before === false
        && R.lanternCollision.debug.on === true && R.lanternCollision.debug.off === false,
        R.lanternCollision);

    // ---- 小游戏：逆流送灯（横版行舟）----
    check('逆流送灯：小船横置在左侧 X=220、只上下移动（Y 夹在 270~500 河道内，X 全程不变）',
        R.boat.boatX === 220 && R.boat.startY === 385
        && R.boat.afterUp.y === R.boat.minY && R.boat.afterDown.y === R.boat.maxY
        && R.boat.afterUp.x === R.boat.boatX && R.boat.afterDown.x === R.boat.boatX
        && R.boat.minY === 270 && R.boat.maxY === 500, R.boat);
    check('逆流送灯：美术规格 = 朝右单行 4 帧 128×104、障碍单帧 96×96、默认水域行 218~551',
        R.boat.frameWidth === 128 && R.boat.frameHeight === 104 && R.boat.frameCount === 4
        && R.boat.obstacleSize === 96
        && R.boat.defaultRiverBand.top === 218 && R.boat.defaultRiverBand.bottom === 551,
        R.boat);
    check('逆流送灯：障碍自右向左（右屏外 1328 进场 → 左移 → 完全出屏即回收），礁石 / 浮木两类都有',
        R.boatFlow.spawnX === 1328 && R.boatFlow.leftShift === true && R.boatFlow.recycled === true
        && R.boatFlow.types === 'rock,wood' && R.boatFlow.randomTypes === 'rock,wood'
        && R.boatFlow.randomYInBand === true, R.boatFlow);
    check('逆流送灯：撞上障碍立即 fail（success=false）；纵向错开 230px 就擦不到',
        R.boatCrash.collided === true && R.boatCrash.failed === true
        && R.boatCrash.completed === false && R.boatCrash.resultSuccess === false
        && R.boatMiss.collided === false && R.boatMiss.failed === false,
        { crash: R.boatCrash, miss: R.boatMiss });
    check('逆流送灯：不再有倒计时（timeLimit = 0），一局一共生成 60 个障碍物，生成间隔 1.6s → 1.3s',
        R.boat.totalObstacles === 60 && R.boat.timeLimit === 0
        && R.boatPassable.spawned === 60 && R.boatPassable.spawnStopped === true
        && Math.abs(R.boatFlow.intervalStart - 1.6) < 1e-9
        && Math.abs(R.boatFlow.intervalEnd - 1.3) < 1e-9,
        { boat: R.boat, passable: R.boatPassable, flow: R.boatFlow });
    check('逆流送灯：左上角白色「剩余障碍物」计数（开局 60；每个障碍物超出视野 -1，不再显示倒计时）',
        R.boat.counterAtStart === '剩余障碍物 60' && R.boat.remainingAtStart === 60
        && R.boat.spawnedAfterOneGone === 1 && R.boat.clearedAfterOneGone === 1
        && R.boat.counterAfterOneGone === 59 && R.boat.counterTextAfterOneGone === '剩余障碍物 59',
        R.boat);
    check('逆流送灯：最后一个障碍物也超出视野才送达（success + 计数归零 + 屏幕无残留），可穿越',
        R.boatPassable.completed === true && R.boatPassable.failed === false
        && R.boatPassable.cleared === 60 && R.boatPassable.remaining === 0
        && R.boatPassable.leftOnScreen === 0 && R.boatPassable.score === 100
        && R.boatPassable.spawnCycles >= 59 && R.boatPassable.maxOnScreen <= 5,
        R.boatPassable);

    section('9. 渡厄使（动画规格 / 召唤小兵 / 冲刺 / 控制 / 受击 / 移动 / 战败）');
    check('7 套动画齐备：idle / summon / dash / control / hurt / move / dead',
        ['idle', 'summon', 'dash', 'control', 'hurt', 'move', 'dead']
            .every(name => R.boss.animations.indexOf(name) !== -1), R.boss.animations);
    check('单帧 96×96；待机为列排列（下/左/右/上各 1 帧，列 0-3）',
        R.boss.frameSize === 96 && R.boss.idleDirectionMode === 'column'
        && R.boss.idleFrames.join(',') === '1,1,1,1' && R.boss.idleColumns.join(',') === '0,1,2,3',
        { frameSize: R.boss.frameSize, mode: R.boss.idleDirectionMode, frames: R.boss.idleFrames, cols: R.boss.idleColumns });
    check('其余动作为行排列（下/左/右/上 = 行 0-3）× 6 帧；战败为单行 6 帧',
        R.boss.moveRows.join(',') === '0,1,2,3' && R.boss.moveFrames === 6
        && R.boss.deadDirections.join(',') === 'down' && R.boss.deadFrames === 6,
        { rows: R.boss.moveRows, frames: R.boss.moveFrames, dead: R.boss.deadDirections });

    check('召唤：动画播完生成 1 个小兵（进地图 monsters）',
        R.boss.summon.action === 'summon' && R.boss.summon.alive === 1
        && R.boss.summon.inMap === 1, R.boss.summon);
    check('小兵：3 套动画（idle 6 / move 8 / attack 7 帧）+ 单帧 96×32 + 4 行（下左右上）',
        R.boss.summon.minionAnimations.join(',') === 'idle,move,attack'
        && R.boss.summon.minionFrameWidth === 96
        && R.boss.summon.minionFrameHeight === 32
        && R.boss.summon.minionRows.join(',') === '0,1,2,3'
        && R.boss.summon.minionFrames
        && R.boss.summon.minionFrames.idle === 6
        && R.boss.summon.minionFrames.move === 8
        && R.boss.summon.minionFrames.attack === 7, R.boss.summon);
    check('召唤上限 2：第三次被拦下；清场后地图里不再有残余小兵',
        R.boss.summonCap.alive === 2 && R.boss.summonCap.max === 2
        && R.boss.summonCap.thirdBlocked === true
        && R.boss.summonSpawnPoint.clearedFromMap === true, { cap: R.boss.summonCap, spawn: R.boss.summonSpawnPoint });
    check('召唤的小兵在 Boss 原地生成', R.boss.summonSpawnPoint.sameAsBoss === true, R.boss.summonSpawnPoint);
    check('小兵：自动追击玩家 + 只走上下左右（不斜走）+ 进入攻击范围出手命中',
        R.boss.minion.moved === true && R.boss.minion.diagonal === false
        && R.boss.minion.sawAttack === true && R.boss.minion.attackLanded === true, R.boss.minion);
    check('战场普攻会一并转发给场上小兵（小兵可被普攻打死）',
        R.boss.attackForward.minionDamaged === true && R.boss.attackForward.minionHealthAfter < R.boss.attackForward.minionHealthBefore,
        R.boss.attackForward);

    check('冲刺：不可打断（受击不改动作，但照常掉血）',
        R.boss.dash.action === 'dash' && R.boss.dash.damageApplied === true
        && R.boss.dash.uninterruptible === true, R.boss.dash);
    check('冲刺：只沿一个轴高速位移，动画结束时圆形判定命中玩家',
        R.boss.dash.movedDown === true && R.boss.dash.sameAxis === true
        && R.boss.dash.playerDamaged === true, R.boss.dash);

    check('受击：打断可打断动作（待机 → 受击）', R.boss.hurt.interrupted === true, R.boss.hurt);
    check('受击：播放中再次受伤不重播（本次播完即回到决策）',
        R.boss.hurt.ignoredDuringHurt === true && R.boss.hurt.restarted === false
        && R.boss.hurt.leftAt !== null && R.boss.hurt.leftAt <= 0.7, R.boss.hurt);

    check('移动：A* 轴对齐追击，进入攻击范围即停（不斜走）',
        R.boss.move.sawMove === true && R.boss.move.diagonal === false
        && R.boss.move.withinRange === true, R.boss.move);

    check('入场对白冻结：introLock 期间渡厄使只站桩（不移动 / 不使用招式 / 玩家零伤害）',
        R.boss.introLock.locked === true && R.boss.introLock.actions === 'idle'
        && R.boss.introLock.stayed === true && R.boss.introLock.playerUnhurt === true,
        R.boss.introLock);

    check('控制：动画播完 → 禁止一切按键（含移动）+ 玩家头顶锁链',
        R.boss.control.action === 'control' && R.boss.control.inputBlocked === true
        && R.boss.control.movementBlocked === true && R.boss.control.chainActive === true
        && R.boss.control.lockDuration === 3, R.boss.control);
    check('控制：持续 3 秒后自动恢复按键与锁链',
        R.boss.control.released === true, R.boss.control);

    check('气血归零 → 战败，且战败演出播完并停在最后一帧（可结算胜利）',
        R.boss.dead.isAlive === false && R.boss.dead.defeatSequenceFinished === true
        && R.boss.dead.finalFrame === 5, R.boss.dead);
    check('战败后删除场上所有小兵',
        R.boss.dead.minionsBefore === 1 && R.boss.dead.minionsAfter === 0
        && R.boss.dead.minionsInMap === 0, R.boss.dead);

    section('10. 任务奖励结算');
    check('主线二：灵石 +400', R.rewards.after.lingShi - R.rewards.before.lingShi === 400, R.rewards.after);
    check('主线二：灵息上限 +10（当前值同步补足）',
        R.rewards.after.maxMana - R.rewards.before.maxMana === 10, R.rewards.after);
    check('主线二：职业悟道点 +1', R.rewards.after.professionSkillPoints === 1, R.rewards.after);
    check('主线二：回元丹 ×3 / 回灵丹 ×2',
        R.rewards.huiyuanDan === 3 && R.rewards.huilingDan === 2, R.rewards);
    check('结丹奖励：境界 → 结丹（气血 220 / 灵息 100 并回满）',
        R.rewards.realm === 'jiedan' && R.rewards.maxHealth === 220 && R.rewards.maxMana === 100
        && R.rewards.health === 220 && R.rewards.mana === 100, R.rewards);
    check('结丹奖励不再重复发放剑影连斩（该技能在上述 complete_training sword 目标中传授）',
        R.rewards.jianying === 0, R.rewards.jianying);
    check('结丹奖励不再解锁照尘仙城（第三图未开放；世界地图按钮调试期常开）',
        R.rewards.zhaochenFlag === false, R.rewards.zhaochenFlag);
    check('筑基圆满兜底：筑基初期的存档会被推到圆满（主线四门槛）',
        R.rewards.foundationStage === '圆满', R.rewards.foundationStage);
    check('剧情物品发放幂等（once 只发一次）',
        R.rewards.firstGrant === true && R.rewards.registryCount === 1, R.rewards);

    section('10b. 剑影连斩（O）：主线一试炼传授 + 四向剑气 + 15 秒冷却');
    const jy = R.jianying;
    check('技能规格：O 键 / 冷却 15 秒 / 消耗较多灵息 / 无技能动画',
        jy.id === 'jianying' && jy.name === '剑影连斩' && jy.key === 'o'
        && jy.cooldown === 15 && jy.manaCost >= 25 && jy.castAnimation === null,
        jy);
    check('剑气只占第 5 个战斗键位，并排在技能栏 U/I/L 之后（第 4 格，学会后才出现）',
        jy.inSkillOrder === 4 && jy.inSkillBar === 3, { skillOrder: jy.inSkillOrder, skillBar: jy.inSkillBar });
    check('剑气动画规格：4 行（右/左/下/上）× 6 帧，单帧 96×96，循环播放',
        jy.frames === 6 && jy.frameSize[0] === 96 && jy.frameSize[1] === 96
        && jy.rows.right === 0 && jy.rows.left === 1 && jy.rows.down === 2 && jy.rows.up === 3,
        { frames: jy.frames, frameSize: jy.frameSize, rows: jy.rows });
    check('命中特效规格：以命中点为圆心的透明渐变扩大圆（ring_expand，6 帧 96×96）',
        jy.hitShape === 'ring_expand' && jy.hitFrames === 6
        && jy.hitFrameSize[0] === 96 && jy.hitFrameSize[1] === 96,
        { shape: jy.hitShape, frames: jy.hitFrames, size: jy.hitFrameSize });
    check('未习得剑影连斩时：技能栏不出格，按 O 完全无响应（不扣灵息、不出剑气）',
        jy.beforeLearn.unlocked === false && jy.beforeLearn.projectiles === 0
        && jy.beforeLearn.mana === 200, jy.beforeLearn);
    check('学会后按 O：上/下/左/右各生成一道剑气（共 4 道）',
        jy.unlockedAfterLearn === true && jy.cast.count === 4
        && jy.cast.directions === 'up,down,left,right', jy.cast);
    check('施展消耗较多灵息（30）并进入 15 秒冷却；伤害结算带技能名（剑影连斩）',
        jy.cast.manaSpent === jy.manaCost && jy.cast.cooldown === 15
        && jy.cast.label === '剑影连斩', jy.cast);
    check('冷却中再按 O：不施展，只提示"冷却中"',
        jy.cooldownBlock.projectiles === 4
        && typeof jy.cooldownBlock.toast === 'string'
        && jy.cooldownBlock.toast.indexOf('冷却中') !== -1, jy.cooldownBlock);
    check('剑气命中敌人：扣血 → 该道剑气立刻消失（4 → 3）并在命中点生成扩大圆特效',
        jy.hit.damage === jy.damage && jy.hit.projectilesLeft === 3 && jy.hit.hitEffects === 1,
        jy.hit);
    check('未命中的剑气飞满最大移动距离后自行消失（场上不留剑气 / 残留特效）',
        jy.expired.projectiles === 0 && jy.expired.effectsLeft === 0, jy.expired);
    check('受伤不打断技能施展：受伤后剑气照旧存在并继续飞行',
        jy.hurtNotInterrupt.before === 4 && jy.hurtNotInterrupt.after === 4
        && jy.hurtNotInterrupt.flew === true, jy.hurtNotInterrupt);
    check('美术未到位时也走程序化绘制：剑气 sword_qi + 命中 ring_expand 绘制不抛异常',
        jy.procedural.error === null && jy.procedural.projectilesRendered === 4
        && jy.procedural.ringRenders === 6, jy.procedural);
    check('传授逻辑同第一章：learnProfessionSkill 写入职业技能 1 级 + 弹出"习得…"提示框，重复学会不重复发',
        jy.learn.learned === true && jy.learn.level === 1 && jy.learn.repeat === false
        && jy.learn.levelAfterRepeat === 1
        && jy.learn.notifications.some(m => m.indexOf('习得') !== -1 && m.indexOf('剑影连斩') !== -1),
        jy.learn);
    check('剑修连招试炼只有 1 个教学圈：剑影连斩（世界 737,1079 / O 键 / skill_jianying）',
        R.training.layoutCount === 1
        && R.training.layoutId === 'c2_training_jianying'
        && R.training.layoutAction === 'skill_jianying'
        && R.training.layoutKey === 'o'
        && R.training.layoutPosition.x === 737 && R.training.layoutPosition.y === 1079,
        R.training);
    check('教学圈的 actionType 与 CONFIG.jianying.trainingAction 一致（否则未习得的技能在圈里也按不出来 → 主线一卡死）',
        R.training.jianyingTrainingAction === 'skill_jianying'
        && R.training.actionMatchesConfig === true, R.training);
    check('未习得时站在教学圈内按 O：施展四向剑气并完成该圈（全部完成 → 传授剑影连斩 / target=sword）',
        R.training.inZoneUsable === true && R.training.insideProjectiles === 4
        && R.training.completedInZone === true && R.training.allCompleted === true
        && R.training.currentTarget === 'sword', R.training);
    check('未习得时在教学圈外按 O：不施展（0 道剑气），只提示先走到教学圈内',
        R.training.outsideProjectiles === 0
        && typeof R.training.outsideToast === 'string'
        && R.training.outsideToast.indexOf('教学圈') !== -1, R.training);
    check('任务门控：主线一没推进到 complete_training/sword 时，教学圈不放（刚进章节做不掉这一步）',
        R.training.gateBlockedAtStep1 === true && R.training.gateBlockedAtStep2 === true
        && R.training.gateOpenedAtStep3 === true, R.training);
    check('陆舟闲聊对白不再提供「练一遍剑招」（否则等于刚进章节即可执行 complete_training）',
        R.training.idleChatStartsTrial === false, R.training);

    section('11. 资源登记与占位资源规格');
    check('ResourceManager 已登记第二章全部图片键', R.resources.missing.length === 0, R.resources.missing);
    check('资源分组 bossArenaCh2 含 11 张图（渡厄使 7 + 小兵 3 + 控制锁链 1）',
        R.resources.bossArenaCh2 === 11, R.resources.bossArenaCh2);
    check('剧情对白全部有文本', R.story.missingText.length === 0, R.story.missingText);
    check('剧情对白包含关键节点',
        ['s01_opening', 't01_sword_done', 't03_identify_success', 't05_soul_return', 't07_core_success',
            'b01_encounter', 'b04_boss_win', 's02_berth', 's03_arrive_zhaochen']
            .every(id => R.story.ids.indexOf(id) !== -1), R.story.ids);

    // 云渡泽美术：以“覆盖地图网格（100×56 @32px = 3200×1792）”为硬约束 ——
    // 缩小到小于网格会让超出的瓦片没有像素可采样（TileSystem 会判成可通行）；
    // 略大于网格（例如美术导出为 3344×1882）只是右侧/下侧多出边距，不影响采样，
    // 但会触发 tools/generate_collision_data.py 的“非整数倍”提示。
    const yunArt = { bg: pngSize('assets', 'images', 'maps', 'yunduze', 'bg.png'), collision: pngSize('assets', 'images', 'maps', 'yunduze', 'collision.png') };
    const yunGrid = { width: R.map.yun.gridWidth, height: R.map.yun.gridHeight };
    const coversGrid = (size) => size.width >= yunGrid.width && size.height >= yunGrid.height;
    check(`云渡泽背景图覆盖地图网格 ${yunGrid.width}×${yunGrid.height}（当前 ${yunArt.bg.width}×${yunArt.bg.height}）`,
        coversGrid(yunArt.bg), { art: yunArt.bg, grid: yunGrid });
    check(`云渡泽碰撞图覆盖地图网格 ${yunGrid.width}×${yunGrid.height}（当前 ${yunArt.collision.width}×${yunArt.collision.height}）`,
        coversGrid(yunArt.collision), { art: yunArt.collision, grid: yunGrid });
    check('云渡泽背景图与碰撞图尺寸一致（碰撞涂绘与美术对得上）',
        yunArt.bg.width === yunArt.collision.width && yunArt.bg.height === yunArt.collision.height,
        { bg: yunArt.bg, collision: yunArt.collision });
    check('万灯台战场背景图 1280×720',
        sizeEq(pngSize('assets', 'images', 'maps', 'boss_arena_ch2', 'bg.png'), 1280, 720));
    check('万灯台碰撞图 1280×720',
        sizeEq(pngSize('assets', 'images', 'maps', 'boss_arena_ch2', 'collision.png'), 1280, 720));
    check('新增 NPC 的 idle 图尺寸与配置一致（陆舟 / 江婆（含 idle_after）/ 江晚 32×64；陈栎 232×64；许录 192×64）',
        sizeEq(pngSize('assets', 'images', 'npc', 'luzhou', 'idle.png'), 32, 64)
        && sizeEq(pngSize('assets', 'images', 'npc', 'jiangpo', 'idle.png'), 32, 64)
        && sizeEq(pngSize('assets', 'images', 'npc', 'jiangpo', 'idle_after.png'), 32, 64)
        && sizeEq(pngSize('assets', 'images', 'npc', 'jiangwan', 'idle.png'), 32, 64)
        && sizeEq(pngSize('assets', 'images', 'npc', 'chenli', 'idle.png'), 232, 64)
        && sizeEq(pngSize('assets', 'images', 'npc', 'xulu', 'idle.png'), 192, 64));
    check('渡厄使动作图集规格（单帧 96×96；idle 列排列 384×96；多方向 576×384；dead 576×96）',
        sizeEq(pngSize('assets', 'images', 'monsters', 'boss_due', 'idle.png'), 384, 96)
        && sizeEq(pngSize('assets', 'images', 'monsters', 'boss_due', 'move.png'), 576, 384)
        && sizeEq(pngSize('assets', 'images', 'monsters', 'boss_due', 'dash.png'), 576, 384)
        && sizeEq(pngSize('assets', 'images', 'monsters', 'boss_due', 'summon.png'), 576, 384)
        && sizeEq(pngSize('assets', 'images', 'monsters', 'boss_due', 'control.png'), 576, 384)
        && sizeEq(pngSize('assets', 'images', 'monsters', 'boss_due', 'hurt.png'), 576, 384)
        && sizeEq(pngSize('assets', 'images', 'monsters', 'boss_due', 'dead.png'), 576, 96));
    check('小兵动作图集规格（单帧 96×32；idle 576×128 / move 768×128 / attack 672×128）',
        sizeEq(pngSize('assets', 'images', 'monsters', 'boss_due', 'minion_idle.png'), 576, 128)
        && sizeEq(pngSize('assets', 'images', 'monsters', 'boss_due', 'minion_move.png'), 768, 128)
        && sizeEq(pngSize('assets', 'images', 'monsters', 'boss_due', 'minion_attack.png'), 672, 128));
    check('控制锁链图 32×32（玩家头顶）',
        sizeEq(pngSize('assets', 'images', 'effects', 'boss_due_chain.png'), 32, 32));

    section('12. 主程序接线（静态检查）');
    const mainJs = fs.readFileSync(path.join(ROOT, 'js', 'Main.js'), 'utf8');
    const npcJs = fs.readFileSync(path.join(ROOT, 'js', 'NPC.js'), 'utf8');
    const gameMapJs = fs.readFileSync(path.join(ROOT, 'js', 'GameMap.js'), 'utf8');
    const teleportJs = fs.readFileSync(path.join(ROOT, 'js', 'TeleportArray.js'), 'utf8');
    const windPileJs = fs.readFileSync(path.join(ROOT, 'js', 'WindPile.js'), 'utf8');
    check('Main 注册了第二章配置', mainJs.indexOf('Chapter2Config.getAll()') !== -1);
    check('Main 使用章节感知的对话选择器', mainJs.indexOf('Chapter2Config.isChapter2Map') !== -1);
    check('Main 在任务完成时统一发奖', mainJs.indexOf('this.applyQuestRewards(questId, rewards)') !== -1);
    check('Main 有第二章章末流程（登船路标 / 结丹调息）',
        mainJs.indexOf('ensureChapter2BoatSignpost') !== -1 && mainJs.indexOf('startCoreFormationTrial') !== -1);
    check('Main 在剑修试炼（complete_training sword）完成的那一刻传授剑影连斩',
        mainJs.indexOf("trainingTarget === 'sword'") !== -1
        && mainJs.indexOf("this.learnProfessionSkill('jianying')") !== -1);
    check('结丹结算不再重复发放剑影连斩（completeCoreFormationTrial 里没有 learnProfessionSkill）',
        mainJs.indexOf("updateQuestProgress('chapter2_ending_1', 'learn_skill'") === -1
        && mainJs.indexOf("completeCoreFormationTrial") !== -1);
    check('Main 有剧情对白 / 短字幕播放器',
        mainJs.indexOf('playStoryDialogue') !== -1 && mainJs.indexOf('showSubtitle') !== -1);
    check('世界地图按钮统一走 switchToMap；地图删减为前两章（青岚浮野 / 云渡泽）且调试期常开',
        mainJs.indexOf('enterMapFromWorldMap') !== -1
        && mainJs.indexOf('updateWorldMapUnlocks') !== -1
        && mainJs.indexOf('debugUnlockAllWorldMapButtons') !== -1
        && mainJs.indexOf("'btn_zhaochen'") === -1
        && mainJs.indexOf("'btn_wuxiang'") === -1);
    check('Main 不再有调试通道接线（resetDebugPortalDefeatFlag / debugPortal 已删除）',
        mainJs.indexOf('resetDebugPortalDefeatFlag') === -1
        && mainJs.indexOf('debugPortal') === -1);
    check('Main 用 isArenaBossAlreadyDefeated 判断「打赢过」（击败标记 或 击败 Boss 目标已完成）',
        mainJs.indexOf('isArenaBossAlreadyDefeated(this.activeArena)') !== -1
        && mainJs.indexOf("isObjectiveCompleted(victory.questId, victory.type, victory.target)") !== -1);
    check('GameMap.ensureArenaBoss 在「已被击败」时直接不生成 Boss（双保险）',
        gameMapJs.indexOf('if (this.arenaBossDefeated) {') !== -1);
    check('TeleportArray / GameMap 不再透传 debugPortal 字段',
        teleportJs.indexOf('debugPortal') === -1 && gameMapJs.indexOf('debugPortal') === -1);

    // ---- 万灯台台后调查点：缺立绘也要有可调查高亮 ----
    check('WindPile：缺立绘（showPlaceholderBody:false）时仍绘制可调查高亮，查完自动消失',
        windPileJs.indexOf('_renderHighlight') !== -1
        && windPileJs.indexOf('if (!drawBody && !this.canInvestigate) return;') !== -1
        && windPileJs.indexOf('if (this.canInvestigate) {') !== -1);

    // ---- 小游戏玩家精灵尺寸与大地图一致（48×64）----
    const miniGameBaseJs = fs.readFileSync(path.join(ROOT, 'js', 'MiniGame.js'), 'utf8');
    const herbGameJs = fs.readFileSync(path.join(ROOT, 'js', 'HerbCollectMiniGame.js'), 'utf8');
    const lanternGameJs = fs.readFileSync(path.join(ROOT, 'js', 'LanternIdentifyMiniGame.js'), 'utf8');
    check('玩家精灵显示尺寸统一：MiniGame 基类给出 48×64（大地图 Player 的绘制尺寸）',
        miniGameBaseJs.indexOf('this.playerSpriteWidth = 48') !== -1
        && miniGameBaseJs.indexOf('this.playerSpriteHeight = 64') !== -1);
    check('认灯归魂 / 乘风采药都用基类尺寸画玩家（不再写死 32×32）',
        lanternGameJs.indexOf('this.playerSpriteWidth') !== -1
        && lanternGameJs.indexOf('this.playerSpriteHeight') !== -1
        && herbGameJs.indexOf('this.playerSpriteWidth') !== -1
        && herbGameJs.indexOf('this.playerSpriteHeight') !== -1);
    check('认灯归魂：E 键要求「一次按下只点亮一盏」（eArmed：同帧第二次更新 / 按住不放都不重复触发）',
        lanternGameJs.indexOf('this.eJustPressed = eDownThisCall && this.eArmed === true;') !== -1
        && lanternGameJs.indexOf('if (this.eJustPressed) this.eArmed = false;') !== -1
        && lanternGameJs.indexOf('this.eArmed = true;') !== -1);
    check('认灯归魂：失败提示常驻（feedbackPersistent：不带计时器，直到下次结算或本局结束才换）',
        lanternGameJs.indexOf('this.feedbackPersistent = true;') !== -1
        && lanternGameJs.indexOf('this.feedbackTimer > 0 || this.feedbackPersistent || !this.isRunning') !== -1
        && lanternGameJs.indexOf('this.feedbackPersistent = false;') !== -1);

    // ---- 传送法阵的目标门控（requireObjective：与路标同一套语义）----
    const chapter2ConfigJs = fs.readFileSync(path.join(ROOT, 'js', 'Chapter2Config.js'), 'utf8');
    check('TeleportArray 支持目标门控 requireObjective（任务接取 + 指定目标已完成，法阵才可见）',
        teleportJs.indexOf('this.requireObjective = config.requireObjective || null') !== -1
        && teleportJs.indexOf('questSystem.isObjectiveCompleted(') !== -1);
    check('GameMap 把 teleporters 的 requireObjective 透传给 TeleportArray',
        gameMapJs.indexOf('requireObjective: teleportConfig.requireObjective || null') !== -1);
    check('万灯台法阵先要「向许录取得万灯台通行凭证」（teleporters.wandengtai.requireObjective = talk_to:xulu）',
        chapter2ConfigJs.indexOf("requireObjective: { type: 'talk_to', target: 'xulu' }") !== -1);

    // ---- 第二章 NPC 立绘接线（displayScale + 江婆双 idle）----
    check('NPC 显示缩放可由配置指定（NPC.js 读 config.displayScale，缺省 2）',
        npcJs.indexOf('this.displayScale = config.displayScale || 2') !== -1);
    check('GameMap 建 NPC 时把 displayScale 交给 NPC',
        gameMapJs.indexOf('displayScale: npcConfig.displayScale') !== -1);
    check('Main 在归魂演出后把江婆换成「获救后」的 idle（setJiangpoReunitedIdle + idle_after）',
        mainJs.indexOf('setJiangpoReunitedIdle') !== -1 && mainJs.indexOf("hasAnimation('idle_after')") !== -1);

    // ---- 第二章小游戏接线（认灯归魂：灯序玩法 / 两张魂灯图 / 结算分流）----
    const lanternJs = fs.readFileSync(path.join(ROOT, 'js', 'LanternIdentifyMiniGame.js'), 'utf8');
    check('认灯归魂：魂灯按亮/暗状态取两张 48×64 图（缺图回退程序化魂灯）',
        lanternJs.indexOf('rendeng_deng_off') !== -1 && lanternJs.indexOf('rendeng_deng_on') !== -1
        && lanternJs.indexOf('lanternDarkImage') !== -1 && lanternJs.indexOf('lanternLitImage') !== -1
        && lanternJs.indexOf('this.lanternWidth = 48') !== -1
        && lanternJs.indexOf('this.lanternHeight = 64') !== -1);
    check('认灯归魂：Main 路由成功（T03 主角自言自语）与失败（T02）两条结算分支',
        mainJs.indexOf('this.finishLanternIdentify(result)') !== -1
        && mainJs.indexOf("playStoryDialogue('t02_identify_fail'") !== -1
        && mainJs.indexOf("playStoryDialogue('t03_identify_success'") !== -1);
    const rendengCollisionJs = fs.readFileSync(
        path.join(ROOT, 'js', 'LanternIdentifyMiniGame.js'), 'utf8');
    const resourceManagerJs = fs.readFileSync(path.join(ROOT, 'js', 'ResourceManager.js'), 'utf8');
    check('认灯归魂：认灯台碰撞图接进小游戏（白可走 / 黑阻挡 → 32×18 表 + 兜底表 + 自检 + F2 覆盖层）',
        rendengCollisionJs.indexOf('miniGame.rendeng_collision') !== -1
        && rendengCollisionJs.indexOf('LANTERN_COLLISION_MAP') !== -1
        && rendengCollisionJs.indexOf('_buildWalkableFromImage') !== -1
        && rendengCollisionJs.indexOf('_canStandAt') !== -1
        && rendengCollisionJs.indexOf('_validateCollision') !== -1
        && rendengCollisionJs.indexOf('_renderCollisionDebug') !== -1
        && rendengCollisionJs.indexOf('blackPixelThreshold') !== -1
        && rendengCollisionJs.indexOf('debugCollision') !== -1);
    check('认灯归魂：碰撞图文件在磁盘上、ResourceManager 有登记、Main 预加载且 F2 会转发给小游戏',
        fs.existsSync(path.join(ROOT, 'assets', 'images', 'minigame', 'rendeng', 'collision.png'))
        && resourceManagerJs.indexOf('rendeng_collision') !== -1
        && resourceManagerJs.indexOf('assets/images/minigame/rendeng/collision.png') !== -1
        && mainJs.indexOf("'miniGame.rendeng_collision'") !== -1
        && mainJs.indexOf('miniGame.setCollisionDebug(on)') !== -1);

    // ---- 第二章小游戏接线（逆流送灯：横版横置船 / 只上下动 / 两类障碍 / 河道碰撞图 / 结算分流）----
    const boatJs = fs.readFileSync(path.join(ROOT, 'js', 'BoatNavigationMiniGame.js'), 'utf8');
    check('逆流送灯：小船横置朝右（单行 4 帧 128×104）、只认上下键、河道 270~500',
        boatJs.indexOf('this.boatFrameWidth = 128') !== -1
        && boatJs.indexOf('this.boatFrameHeight = 104') !== -1
        && boatJs.indexOf('this.boatFrameCount = 4') !== -1
        && boatJs.indexOf('this.minY = 270') !== -1 && boatJs.indexOf('this.maxY = 500') !== -1
        && boatJs.indexOf("keys['arrowup']") !== -1 && boatJs.indexOf("keys['arrowdown']") !== -1
        && boatJs.indexOf("keys['a']") === -1 && boatJs.indexOf("keys['d']") === -1);
    check('逆流送灯：障碍从右侧生成、向左漂、完全出屏即回收并把剩余计数 -1；碰撞即 fail、清完 60 个即 complete',
        boatJs.indexOf('this.mapWidth + this.obstacleSize / 2') !== -1
        && boatJs.indexOf('obstacle.x -= this.scrollSpeed * deltaTime') !== -1
        && boatJs.indexOf('this.clearedObstacles += 1') !== -1
        && boatJs.indexOf('this.fail()') !== -1 && boatJs.indexOf('this.complete()') !== -1
        && boatJs.indexOf('this.totalObstacles = 60') !== -1
        && boatJs.indexOf('this.spawnedObstacles < this.totalObstacles') !== -1
        && boatJs.indexOf('if (this.clearedObstacles >= this.totalObstacles) this.complete();') !== -1);
    check('逆流送灯：礁石 / 浮木两张 96×96 图 + 河道碰撞图取范围 + 左上角白色「剩余障碍物」计数（倒计时已移除）',
        boatJs.indexOf('xingzhou_rock') !== -1 && boatJs.indexOf('xingzhou_wood') !== -1
        && boatJs.indexOf('xingzhou_collision') !== -1 && boatJs.indexOf('_loadRiverBand') !== -1
        && boatJs.indexOf('renderObstacleCounter') !== -1 && boatJs.indexOf("'#FFFFFF'") !== -1
        && boatJs.indexOf('roundRect(20, 20') !== -1
        && boatJs.indexOf('renderCountdown') === -1
        && boatJs.indexOf('getCountdownText') === -1
        && boatJs.indexOf('getRemainingObstaclesText') !== -1);
    check('逆流送灯：Main 路由成功（T05 归魂演出）与失败（T04）两条分支，且主线三不再有 soul_return 目标',
        mainJs.indexOf('this.finishRiverEscort(result)') !== -1
        && mainJs.indexOf("playStoryDialogue('t05_soul_return'") !== -1
        && mainJs.indexOf("playStoryDialogue('t04_escort_fail'") !== -1
        && mainJs.indexOf("'soul_return'") === -1
        && mainJs.indexOf("'complete_minigame', 'boat_navigation'") !== -1);

    console.log(`\n结果：通过 ${passed} 项，失败 ${failed} 项`);
    return failed === 0 ? 0 : 1;
}

main().then(code => {
    process.exitCode = code;
}).catch(error => {
    console.error('冒烟测试异常：', error);
    process.exitCode = 1;
});
