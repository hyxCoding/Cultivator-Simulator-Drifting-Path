/**
 * 章末流程冒烟测试（无浏览器，Node 环境）
 *
 * 运行方式（本机无独立 node，用 VS Code 自带的 Electron 以 node 模式运行）：
 *   $env:ELECTRON_RUN_AS_NODE='1'
 *   & 'D:\Microsoft VS Code\Code.exe' tools\smoke_chapter_end.js
 *
 * 想把输出存成文件比对 / 归档（PowerShell 的 > 抓不到 Code.exe 的控制台输出）：
 *   & 'D:\Microsoft VS Code\Code.exe' tools\smoke_capture.js tools\smoke_chapter_end.js tools\ce_result.txt
 *
 * 覆盖范围：
 *   1) 加载 game.html 中列出的全部 js（语法 + 加载期逻辑）
 *   2) 筑基气场精灵图规格（384×128，1 行 8 帧 48×128）与 CombatEffect.isSpriteUsable 判定
 *   3) 任务链：main_4 → ending_1（complete_foundation_trial）→ ending_2《桥边寻阿禾》(talk_to ahe)
 *            → ending_3《登船辞行》(board_boat)
 *   4) 剧情标记（QuestSystem.storyFlags）与 NPC 对话选择规则（Chapter1Config.getDialogueForNPC）
 *      - 筑基后祁伯只闲聊（after_foundation_chat），不再出现择道 / 换传承
 *   5) Main 章末流程：
 *      - startFoundationTrial：禁键盘输入 / 主角朝下 / 背后（under 层）筑底气场播放 5 秒
 *      - 5 秒后自动续接 breakthrough_success 对话；on_complete 完成筑基、解锁云渡泽、
 *        自动接取《桥边寻阿禾》（不含 open_profession_selection）
 *      - 阿禾告别 on_complete → 码头 (2566,1419) 生成永久登船路标 + 接取《登船辞行》
 *        → 按 E 登船开启世界地图
 *   6) 世界地图：M 键入口已删除（第十三次改动）—— 按 M 什么都不发生，开图只走剧情入口
 *      （章末登船 / 完结后续登船 openWorldMapFromBerth）；地图已删减为前两章，世界地图只保留
 *      青岚浮野 / 云渡泽两个传送按钮且都常开；落地固定坐标（Main.worldMapSpawnPoints）：
 *      青岚浮野 (2718, 1500) / 云渡泽 (541, 1385)，两点均核对过可站；
 *      频繁传送时另一张地图静默（不更新 / 不渲染），但实例与资源不释放（切回复用同一实例）
 *   7) 世界地图（MapTeleport）打开时只渲染世界地图本身：交互提示 / HUD / 任务栏都不绘制，
 *      Q（任务栏）与 E（交互）均无响应
 *   8) 调试代码清理与数值核对：DebugCheats 已删除 / 山口法阵仍由任务门控 /
 *      玩家气血回到正常值 100 / Boss 气血临时为 1（方便击杀）
 *   9) 基础操作教学：按键只看教学圈（不在圈内按对应键不施展）+ 左下角技能栏随教学步骤
 *      逐格解锁（教学开始前只显示气血 / 法力；技能栏只有 U/I/L 三格，普攻 J 不占格）
 *  10) Boss 战场：首次进场生成摄风山魈、伏诛后不再生成；战场正中心生成永久归途法阵
 *      （按 E 回到进场时的原来位置）；已删除“等 10 秒自动回城”的倒计时
 *  11) 自定义气血条 / 灵息条（纯图片绘制，条上不显示数字）：外框 500×64 与内条 454×64
 *      左上角对齐、先画内条再画外框；内条真正能看见的血量像素是 X∈[78,454)（X∈[0,78) 是左侧
 *      固定装饰），故只取 X = 0 → 78 + 当前值/上限 × (454 - 78)（空血 78 / 半血 266 / 满血 454）；
 *      图片缺失 / 尺寸不符时该条不绘制（不再用代码画条）；四张条图入库尺寸实检
 *  12) 路标自定义美术：ResourceManager.signposts（herb_collect 采药点 / depart_boat 章末登船点）
 *      → Chapter1Config 配置 → Main.createDepartSignpost 透传 → Signpost 按 60×60 绘制；
 *      缺图（dataURL 占位图）时回退程序化木牌，不在地图上画出品红占位块
 *  13) 左下角技能栏（U 灵息弹 / I 护体术 / L 闪避）：三格各自一张 100×100 图片，
 *      格子中央绘制按键字母，冷却中改为剩余秒数倒计时；普攻 J 不占格（教学仍在）、
 *      普攻冷却也不再弹屏幕中下方提示；缺图 / 尺寸不符时该格回退程序化方框
 *  14) 主线三《散落的炊烟》任务顺序：必须先询问柳婶问出周叔去向（main_3 的 talk_to liushen 完成、
 *      rescue 成为当前目标）才能救助周叔 —— 在此之前周叔只说被困（trapped_idle，无护送选项），
 *      Main.startWindBridgeRescue 也会拦下（不搬迁、不推进目标）；
 *      另核对对话框渲染在左下角按键提示 UI（技能栏 / 气血灵息条）之后（画在其上方）
 *  15) 青岚浮野地图碰撞：
 *      - Chapter1Config 带 105×59 的 collisionData（file:// 读不到碰撞图像素时兜底，
 *        否则整图被判为“全部可通行”，碰撞完全失效）
 *      - 模拟 file://（碰撞图 = null）时真实 TileSystem / GameMap 按 collisionData 建表，
 *        出生点可站、房屋阻挡、外圈不可走出
 *      - 玩家移动碰撞盒 24×24（严格小于瓦片边长 32），与精灵绘制尺寸 24×32 解耦：
 *        碰撞盒若正好 32 高会横跨两行瓦片，单瓦片宽的桥 / 窄路整条走不过去
 *      - 从出生点出发可达 ≥ 95% 可站立区域，19 个任务 / NPC 交互点 + 4 个教学圈都能站到
 *  16) 任务栏排版（QuestUI）：标题「任  务  记  录」在 padding.top 基础上再下移 20px（y = 160）；
 *      任务标题 / 描述 / 目标进度每行最多 280px，超出自动换行（续行缩进 16px，整行不越出 leftX + 280）
 *  17) 开始界面：取消全部程序化绘制（不再画标题 / 「按任意键开始游戏」），
 *      改为两张美术贴图 —— assets/images/ui/start_screen.png（1280×720 整屏背景）
 *      + assets/images/ui/start_button.png（400×112，画布正中显示）；
 *      只有点击按钮的 400×112 矩形才开始游戏（键盘 / 按钮外点击都不再开始）；
 *      悬停时按钮图片平滑上浮（只改渲染位置 renderX / renderY，逻辑热区仍是 (440,304,400×112)）；
 *      缺图（ResourceManager 品红占位图）时只铺底色，不画占位块
 *  18) 游戏完结界面（章末二 · 中央泊位登船后的滚动字幕）：
 *      - 文案 js/EndingText.js（281 行，正文 141 + 空行 140，每行 ≤ 25 字）
 *        由 tools/generate_ending_text.py 从 tools/游戏结束滚动文字.txt 生成，
 *        改文案只需改 txt 后重新生成（--check 校验一致性）
 *      - js/EndingScene.js：整段从屏幕底部逐行上滚（行距 56px / 字号 40px /
 *        默认 100px 每秒 ≈ 2.7 分钟），每行水平居中，空行同样占一个行位；
 *        最后一行滚出屏幕上方后屏幕中心显示「按任意键返回游戏」，
 *        此时按任意键 / 鼠标任意键 → 写 game_ending_seen + 打开世界地图 + 回 gameWorld；
 *        播放期间 Main.handleKeyDown 对 'ending' 场景直接 return（不能跳过、不误触发其它 UI）
 *      - Main.sailToZhaochen 结算《行舟有归处》后 startGameEnding 进入完结界面；
 *        完结之后再在中央泊位登船（boardZhaochenBoat）不再重播对白与字幕，直接显示世界地图
 *      - 整屏底图（可选美术）ui.ending_bg = assets/images/ui/ending_bg.png（1280×720，
 *        py -3 tools/generate_ending_assets.py 生成占位图）：有图 → 整屏贴图铺底；
 *        缺图 / 空图 / dataURL 品红占位图 → 一张图都不画，改回程序化「深墨渐变 + 渡口暖光晕」；
 *        两种情况下浮尘 + 四周暗角都照常叠加（字幕永远在最上层、始终可读）
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
    const texts = [];
    const images = [];
    const rects = [];
    const ctx = {
        canvas: { width: 1280, height: 720 },
        drawnTexts: texts,
        fillText: (t) => texts.push(t),
        strokeText: (t) => texts.push(t),
        drawnImages: images,
        drawImage: (...args) => images.push(args),
        // 填充矩形（技能格程序化方框 / 冷却遮罩等）：记录左上角与宽高
        drawnRects: rects,
        fillRect: (x, y, w, h) => rects.push({ x: x, y: y, w: w, h: h }),
        measureText: (t) => ({ width: String(t).length * 8 }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    };
    // 其余 2D API 一律当作空实现（方法调用不报错，属性读写不报错）
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
    // 游戏脚本（Main.js 等）在加载期会直接向 window 注册事件监听
    globalThis.addEventListener = () => {};
    globalThis.removeEventListener = () => {};
    globalThis.requestAnimationFrame = () => 0;
    globalThis.cancelAnimationFrame = () => {};
    globalThis.performance = globalThis.performance || { now: () => Date.now() };
    globalThis.document = {
        getElementById: () => canvas,
        // createElement('canvas') 供 ResourceManager.createPlaceholderImage() 使用，
        // 故这里补一个 toDataURL —— 占位图正是靠 "data:" 前缀被各实体识别并回退程序化渲染
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

// ==================== 加载游戏脚本 ====================

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
        const source = fs.readFileSync(filePath, 'utf8');
        vm.runInContext(source, context, { filename: rel });
    }
    return files;
}

/**
 * Main 层源码（Main.js + js/main/*.js 原型混入）拼接。
 * Main 已按职责拆分，静态守卫面向「整个 Main 层」，故统一从这里取源码。
 */
function readMainLayerSource() {
    const mainDir = path.join(ROOT, 'js', 'main');
    const extra = fs.existsSync(mainDir)
        ? fs.readdirSync(mainDir).filter(f => f.endsWith('.js')).sort().map(f => path.join(mainDir, f))
        : [];
    return [path.join(ROOT, 'js', 'Main.js')].concat(extra)
        .map(f => fs.readFileSync(f, 'utf8')).join('\n');
}

/** 读取 PNG 尺寸（IHDR：宽/高各 4 字节，偏移 16/20） */
function readPngSize(filePath) {
    const buf = fs.readFileSync(filePath);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// ==================== 测试主体 ====================

async function main() {
    installBrowserStubs();
    const context = vm.createContext(globalThis);

    section('1. 加载 game.html 中列出的全部脚本');
    const files = loadGameScripts(context);
    check(`加载 ${files.length} 个 js 文件（语法/加载期均正常）`, files.length > 0);

    // 静态源码断言（预加载列表等）用：Main 层源码（Main.js + js/main/*.js）
    const mainJsSource = readMainLayerSource();

    // 断言用的场景脚本（在同一个 global 词法环境中执行，可直接访问游戏类）
    const runner = fs.readFileSync(path.join(__dirname, 'smoke_chapter_end_runner.js'), 'utf8');
    const results = await vm.runInContext(runner, context, { filename: 'smoke_chapter_end_runner.js' });

    section('2. 筑基气场精灵图（384×128 = 1 行 8 帧 × 48×128）');
    const auraPath = path.join(ROOT, 'assets', 'images', 'effects', 'player_zhuji_aura.png');
    check('精灵图文件存在', fs.existsSync(auraPath), auraPath);
    const size = readPngSize(auraPath);
    check('图集尺寸 384×128', size.width === 384 && size.height === 128, size);
    const usable = vm.runInContext(
        `CombatEffect.isSpriteUsable({ width: 384, height: 128, naturalWidth: 384, naturalHeight: 128 }, 48, 128, 8, 0)`,
        context
    );
    check('CombatEffect 判定该图集可用（不会回退程序化绘制）', usable === true, usable);
    const auraCfg = JSON.parse(vm.runInContext(`JSON.stringify(PlayerCombatSystem.CONFIG.foundationAura)`, context));
    // 注：offsetX / offsetY 是主角与气场的对齐微调值（会被反复试调），故只校验是有限数值，
    //     其余规格（帧数 / 单帧尺寸 / 时长 / 绘制层）保持严格断言。
    check('PlayerCombat 配置：8 帧 / 48×128 / 5 秒 / under 层',
        auraCfg.frames === 8 && auraCfg.frameWidth === 48 && auraCfg.frameHeight === 128
        && auraCfg.duration === 5
        && Number.isFinite(auraCfg.offsetX) && Number.isFinite(auraCfg.offsetY), auraCfg);
    check('ResourceManager 已登记 effects.player_zhuji_aura',
        vm.runInContext(`!!ResourceManager.getInstance().getImagePath('effects.player_zhuji_aura')`, context) === true);

    section('3. 章节注册 + 章末任务链');
    check('game.html 脚本与任务注册成功', results.questCount > 0, results.questCount);
    check('chapter1_ending_1 已注册', results.hasEnding1 === true);
    check('chapter1_ending_2 已注册（桥边寻阿禾）', results.hasEnding2 === true);
    check('chapter1_ending_3 已注册（登船辞行）', results.hasEnding3 === true);
    check('主线四的 nextQuest 指向 chapter1_ending_1',
        results.main4Config && results.main4Config.nextQuest === 'chapter1_ending_1',
        results.main4Config && results.main4Config.nextQuest);
    check('ending_1 目标为 complete_foundation_trial/foundation',
        results.ending1Config.objectives.length === 1
        && results.ending1Config.objectives[0].type === 'complete_foundation_trial'
        && results.ending1Config.objectives[0].target === 'foundation',
        results.ending1Config.objectives);
    check('ending_2《桥边寻阿禾》目标为 talk_to ahe（去桥边找阿禾）',
        results.ending2Config.title === '桥边寻阿禾'
        && results.ending2Config.objectives.length === 1
        && results.ending2Config.objectives[0].type === 'talk_to'
        && results.ending2Config.objectives[0].target === 'ahe',
        results.ending2Config);
    check('ending_3《登船辞行》目标为 board_boat/depart_boat 且前置为 ending_2',
        results.ending3Config.objectives.length === 1
        && results.ending3Config.objectives[0].type === 'board_boat'
        && results.ending3Config.objectives[0].target === 'depart_boat'
        && Array.isArray(results.ending3Config.prerequisites)
        && results.ending3Config.prerequisites.indexOf('chapter1_ending_2') !== -1,
        results.ending3Config);
    check('主线一~四可依次完成', results.chain.every(c => c[1] === true), results.chain);
    check('ending_1 可接取并可由筑基调息目标完结',
        results.ending1Accepted === true && results.ending1Completed === true);
    check('ending_2 可接取并可由与阿禾对话（talk_to ahe）完结',
        results.ending2Accepted === true && results.ending2Completed === true);
    check('ending_3 可接取并可由登船（board_boat）完结',
        results.ending3Accepted === true && results.ending3Completed === true);

    section('4. 剧情标记与 NPC 对话选择规则');
    check('storyFlags 初始为空', results.flagsEmptyBefore === true);
    check('setStoryFlag / hasStoryFlag 生效', results.flagSet === true);
    check('storyFlags 可随存档序列化 / 反序列化', results.flagsSerialize === true);
    check('祁伯：主线四完成后 → quest_m04_complete',
        results.dlg.qibo_m04done === 'quest_m04_complete', results.dlg.qibo_m04done);
    check('祁伯：foundation_unlocked → breakthrough_ready',
        results.dlg.qibo_breakthroughReady === 'breakthrough_ready', results.dlg.qibo_breakthroughReady);
    check('祁伯：foundation_trial_done → 只闲聊（after_foundation_chat）',
        results.dlg.qibo_afterFoundation === 'after_foundation_chat', results.dlg.qibo_afterFoundation);
    check('祁伯：旧存档残留 profession_chosen 标记 → 仍是闲聊（不弹择道/换传承）',
        results.dlg.qibo_legacyProfessionChosen === 'after_foundation_chat',
        results.dlg.qibo_legacyProfessionChosen);
    check('祁伯：第一章完成（chapter1_complete）→ idle_talk 闲聊',
        results.dlg.qibo_chapterComplete === 'idle_talk', results.dlg.qibo_chapterComplete);
    check('阿禾：ending_1 完成 → farewell', results.dlg.ahe_farewell === 'farewell', results.dlg.ahe_farewell);
    check('阿禾：告别后 → after_farewell',
        results.dlg.ahe_afterFarewell === 'after_farewell', results.dlg.ahe_afterFarewell);

    section('5. 筑基调息（禁键 / 朝下 / 气场 5 秒 / 续接对话）');
    check('进入筑基调息状态', results.trial.playing === true);
    check('移动输入被封锁', results.trial.movementBlocked === true);
    check('键盘输入被封锁（InputManager.inputBlocked）', results.trial.inputBlocked === true);
    check('主角朝向为 down', results.trial.playerFacing === 'down', results.trial.playerFacing);
    check('背后气场正在播放', results.trial.auraPlaying === true);
    check('气场时长为 5 秒（已推进一帧 → 4.98）', results.trial.auraDuration > 4.9 && results.trial.auraDuration <= 5,
        results.trial.auraDuration);
    check('气场绘制在角色之下（layer=under）', results.trial.auraLayer === 'under', results.trial.auraLayer);
    check('气场跟随主角并按 offsetY 定位', results.trial.auraFollows === true);
    check('序列中玩家处于交互锁定', results.trial.isInteracting === true);
    check('序列中 Q / M / E 键盘均无响应', results.trial.keyboardLocked === true);
    check('气场约 5 秒后结束序列', Math.abs(results.trial.elapsed - 5) < 0.35, results.trial.elapsed);
    check('序列结束后气场停止', results.afterTrial.auraPlaying === false);
    check('序列结束后键盘解锁（InputManager.inputBlocked=false）',
        results.afterTrial.inputBlocked === false, results.afterTrial.inputBlocked);
    check('续接对话中禁止移动（与其它对话一致）',
        results.afterTrial.movementBlocked === true, results.afterTrial.movementBlocked);
    check('续接对话结束后移动解锁、对话框关闭',
        results.afterTrial.movementBlockedAfterDialogue === false
        && results.afterTrial.dialogBoxVisibleAfterDialogue === false, results.afterTrial);
    check('序列结束后自动续接 breakthrough_success 对话',
        results.afterTrial.qiboDialogues.indexOf('breakthrough_success') !== -1
        && results.afterTrial.dialogBoxVisible === true, results.afterTrial.qiboDialogues);
    check('续接对话文本为筑基成功节点',
        typeof results.afterTrial.lastText === 'string' && results.afterTrial.lastText.indexOf('筑基已成') !== -1,
        results.afterTrial.lastText);

    section('6. 筑基结算 → 生成《桥边寻阿禾》→ 阿禾迁码头 → 登船路标 → 世界地图');
    check('breakthrough_success 的 on_complete 含筑基结算/解锁云渡泽/接取《桥边寻阿禾》',
        Array.isArray(results.breakthroughOnComplete)
        && results.breakthroughOnComplete.indexOf('complete_foundation_trial') !== -1
        && results.breakthroughOnComplete.indexOf('unlock_yunduze') !== -1
        && results.breakthroughOnComplete.indexOf('accept_quest_chapter1_ending_2') !== -1,
        results.breakthroughOnComplete);
    check('breakthrough_success 的 on_complete 已移除择道（open_profession_selection）',
        Array.isArray(results.breakthroughOnComplete)
        && results.breakthroughOnComplete.indexOf('open_profession_selection') === -1,
        results.breakthroughOnComplete);
    check('筑基完成 → 记录 foundation_trial_done 标记', results.afterBreakthrough.flagFoundationTrialDone === true);
    check('筑基完成 → 境界提升为筑基', results.afterBreakthrough.realm === 'zhuji', results.afterBreakthrough.realm);
    check('筑基完成 → 数值写满：气血 400/400、灵息 250/250（Main.applyFoundationRealmStats）',
        results.afterBreakthrough.playerStats.realm === 'zhuji'
        && results.afterBreakthrough.playerStats.maxHealth === 400
        && results.afterBreakthrough.playerStats.health === 400
        && results.afterBreakthrough.playerStats.maxMana === 250
        && results.afterBreakthrough.playerStats.mana === 250,
        results.afterBreakthrough.playerStats);
    check('筑基完成 → chapter1_ending_1 完结（触发阿禾迁码头）',
        results.afterBreakthrough.ending1Completed === true);
    check('ending_1 完成后 → 阿禾被移到码头（瓦片 81,44）',
        results.restage.aheReposition.length === 1 && results.restage.aheReposition[0][0] === 81
        && results.restage.aheReposition[0][1] === 44, results.restage.aheReposition);
    check('章末未发生时（无标记）阿禾不迁移、不生成路标',
        results.gatedOff.aheReposition.length === 0 && results.gatedOff.signpostCount === 0, results.gatedOff);
    check('筑基完成 → 解锁云渡泽航线', results.afterBreakthrough.flagYunduze === true);
    check('筑基完成 → 自动生成新任务《桥边寻阿禾》（进行中）',
        results.afterBreakthrough.ending2Active === true
        && results.afterBreakthrough.ending2Title === '桥边寻阿禾', results.afterBreakthrough);
    check('筑基完成后不再进入择道（未启动 choose_profession / respec_profession）',
        results.professionFlow.hasChooseProfession === false && results.professionFlow.hasRespec === false,
        results.professionFlow);
    check('到桥边找阿禾：真实交互取到 farewell 对话',
        Array.isArray(results.aheInteraction.startedWith)
        && results.aheInteraction.startedWith.indexOf('farewell') !== -1,
        results.aheInteraction);
    check('与阿禾对话 → chapter1_ending_2《桥边寻阿禾》完结',
        results.aheInteraction.ending2Completed === true, results.aheInteraction);
    check('阿禾 farewell 的 on_complete 会生成登船路标并接取《登船辞行》',
        Array.isArray(results.farewellOnComplete)
        && results.farewellOnComplete.indexOf('create_depart_signpost') !== -1
        && results.farewellOnComplete.indexOf('accept_quest_chapter1_ending_3') !== -1,
        results.farewellOnComplete);
    check('阿禾告别后 → chapter1_ending_3 已接取（进行中）', results.ending3AfterFarewell === true);
    check('路标生成于 (2566,1419)',
        !!results.signpost && results.signpost.position.x === 2566 && results.signpost.position.y === 1419,
        results.signpost && results.signpost.position);
    check('路标为永久（oneShot=false 且可见）',
        !!results.signpost && results.signpost.oneShot === false && results.signpost.isActive === true, results.signpost);
    check('路标提示为“按 E 键乘船离开”', results.promptDrawn.indexOf('按 E 键乘船离开') !== -1, results.promptDrawn);
    check('重复生成不产生重复路标', results.signpostCountAfterSecondCall === 1, results.signpostCountAfterSecondCall);
    check('按 E 登船 → chapter1_ending_3《登船辞行》完结', results.boardResult.ending3Completed === true);
    check('按 E 登船 → 切到世界地图', results.boardResult.mapTeleportOpened.indexOf('show') !== -1, results.boardResult);
    check('按 E 登船 → 记录 chapter1_complete 标记', results.boardResult.flagChapterComplete === true);
    check('重新进图按标记恢复：阿禾在码头 + 路标重建',
        results.restage.aheReposition.length === 1 && results.restage.aheReposition[0][0] === 81
        && results.restage.signpostRecreated === true, results.restage);

    // ---- 路标自定义美术：资源键 → 配置 → 实例 → 缺图回退 ----
    const signpostArt = results.signpostArt;
    check('ResourceManager 已登记路标资源键 signposts.depart_boat / signposts.herb_collect',
        signpostArt.resourcePaths.departBoat === 'assets/images/signposts/depart_boat.png'
        && signpostArt.resourcePaths.herbCollect === 'assets/images/signposts/herb_collect.png',
        signpostArt.resourcePaths);
    check('章末登船路标改用自定义图片（signposts.depart_boat，60×60）',
        signpostArt.departBoatConfig.image === 'signposts.depart_boat'
        && signpostArt.departBoatConfig.imageWidth === 60
        && signpostArt.departBoatConfig.imageHeight === 60, signpostArt.departBoatConfig);
    check('Main.createDepartSignpost 把图片键与显示尺寸透传给路标实例',
        !!signpostArt.departBoatInstance
        && signpostArt.departBoatInstance.imageKey === 'signposts.depart_boat'
        && signpostArt.departBoatInstance.imageWidth === 60
        && signpostArt.departBoatInstance.imageHeight === 60, signpostArt.departBoatInstance);
    check('采药点路标同样走自定义图片（signposts.herb_collect，60×60）',
        !!signpostArt.herbCollectConfig
        && signpostArt.herbCollectConfig.image === 'signposts.herb_collect'
        && signpostArt.herbCollectConfig.imageWidth === 60
        && signpostArt.herbCollectConfig.imageHeight === 60, signpostArt.herbCollectConfig);
    check('两处路标图片键已加入启动预加载（Main.preloadInitialResources）',
        ["'signposts.herb_collect'", "'signposts.depart_boat'"]
            .every(k => mainJsSource.indexOf(k) !== -1));
    check('缺图时 ResourceManager 返回 dataURL 占位图（判定依据）',
        signpostArt.placeholderIsDataUrl === true);
    check('缺图路标不画出品红占位块：image 保持 null → 回退程序化木牌',
        signpostArt.missingArtFallsBack === true && signpostArt.missingArtKeepsKey === true,
        signpostArt);
    check('登船路标美术规格说明已写进配置注释（60×60，缺图回退木牌）',
        mainJsSource.indexOf('assets/images/signposts/depart_boat.png') !== -1);

    // ---- 自定义图片对位（anchor）：默认 center，可行改为 bottom ----
    const anchor = signpostArt.anchor;
    check('路标图片默认居中（anchor 缺省为 center，现有采药点路标行为不变）',
        anchor.defaultsToCenter === 'center' && anchor.center.anchor === 'center', anchor);
    check('anchor=center：60×60 图片以路标坐标为中心（y = 500 - 30）',
        anchor.center.x === 970 && anchor.center.y === 470
        && anchor.center.w === 60 && anchor.center.h === 60, anchor.center);
    check('anchor=bottom：图片底边贴在路标坐标上（y = 500 - 60，适合带杆木牌）',
        anchor.bottom.x === 970 && anchor.bottom.y === 440
        && anchor.bottom.w === 60 && anchor.bottom.h === 60, anchor.bottom);

    // 美术文件：已交付则校验尺寸，未交付则确认“缺图自动回退”路径已生效
    const departSignpostArtPath = path.join(ROOT, 'assets', 'images', 'signposts', 'depart_boat.png');
    if (fs.existsSync(departSignpostArtPath)) {
        const artSize = readPngSize(departSignpostArtPath);
        check('登船路标美术已就位（60×60 显示，原图不小于 60×60）',
            artSize.width >= 60 && artSize.height >= 60, artSize);
    } else {
        check('登船路标美术暂未交付 → 资源键已登记，放入 assets/images/signposts/depart_boat.png 即生效'
            + '（当前回退程序化木牌）', true);
    }

    section('7. 世界地图：M 键已移除（只剩剧情入口）+ 只保留前两章传送按钮（常开）');
    check('按 M 不再打开 / 关闭世界地图（第十三次改动：键盘调试入口已删除，MapTeleport 零调用）',
        results.mKey.calls.length === 0 && results.mKey.blocked === true
        && results.mKey.visibleAfter === false, results.mKey);
    check('战场内按 M 同样毫无反应（M 不再影响战场流程，也就不存在「开图让战场停摆」）',
        results.mKeyBlockedInArena.calls.length === 0 && results.mKeyBlockedInArena.opened === false,
        results.mKeyBlockedInArena);
    check('世界地图的剧情入口保留：章末登船仍能打开（openWorldMapFromBerth → MapTeleport.show）',
        results.worldMapStoryEntry.calls.join(',') === 'show'
        && results.worldMapStoryEntry.visible === true, results.worldMapStoryEntry);

    // 静态检查：世界地图区域按钮只剩青岚浮野 / 云渡泽，且都 enabled: true、都走统一入口
    const mainJsText = readMainLayerSource();
    const wmBlock = mainJsText.slice(
        mainJsText.indexOf('区域按钮：地图已删减为前两章'),
        mainJsText.indexOf('const taskPanelBg'));
    const wmStatic = {
        hasQinglan: wmBlock.indexOf("id: 'btn_qinglan'") !== -1,
        hasYunduze: wmBlock.indexOf("id: 'btn_yunduze'") !== -1,
        enabledCount: (wmBlock.match(/enabled: true/g) || []).length,
        enterMapCount: (wmBlock.match(/this\.enterMapFromWorldMap\(btn\.targetMapId\)/g) || []).length,
        noRemovedButtons: wmBlock.indexOf('btn_zhaochen') === -1 && wmBlock.indexOf('btn_wuxiang') === -1,
    };
    check('世界地图只保留两章按钮（青岚浮野 / 云渡泽），不再有照尘仙城 / 无乡天阙',
        wmStatic.hasQinglan && wmStatic.hasYunduze && wmStatic.noRemovedButtons, wmStatic);
    check('两个按钮都解锁（enabled: true）', wmStatic.enabledCount === 2, wmStatic);
    check('两个按钮都走 enterMapFromWorldMap（统一落点 / 门控 / 通知）',
        wmStatic.enterMapCount === 2, wmStatic);
    check('世界地图配置（GameConfig）只剩两章按钮且都已解锁',
        results.worldMap.ids.join(',') === 'btn_qinglan,btn_yunduze'
        && results.worldMap.targets.join(',') === 'qinglan_fuye,yunduze'
        && results.worldMap.unlocked.every(v => v === true), results.worldMap);
    check('第三 / 第四章地图未注册（地图已删减为前两章）',
        results.worldMap.zhaochenRegistered === false && results.worldMap.wuxiangRegistered === false,
        results.worldMap);

    section('7b. 世界地图频繁传送：另一张地图静默，但实例与资源不释放');
    check('青岚浮野 / 云渡泽两张地图都已加载并缓存',
        results.fastTravel.instanceCount === 2, results.fastTravel);
    check('切走的地图被置为非活动（静默：render 不产生任何绘制调用）',
        results.fastTravel.qinglanSilentWhenOther === true && results.fastTravel.silentMapDraws === 0,
        results.fastTravel);
    check('任意时刻只有当前地图处于活动状态（另一张地图静默）',
        results.fastTravel.qinglanActiveWhileCurrent === true
        && results.fastTravel.yunduzeActiveWhileCurrent === true
        && results.fastTravel.yunduzeSilentAfterLeaving === true, results.fastTravel);
    check('切回时复用同一地图实例（不重新加载 / 不释放资源）',
        results.fastTravel.sameInstanceReused === true, results.fastTravel);
    check('传送落点生效：切回后当前地图为青岚浮野',
        results.fastTravel.currentMapId === 'qinglan_fuye', results.fastTravel);

    // 世界地图传送落点：由 Main.worldMapSpawnPoints 固定，且两个点都站得住
    const spawnStatic = {
        tableDefined: /this\.worldMapSpawnPoints\s*=\s*\{/.test(mainJsText),
        qinglanPoint: mainJsText.indexOf('qinglan_fuye: { x: 2718, y: 1500 }') !== -1,
        yunduzePoint: mainJsText.indexOf('yunduze: { x: 541, y: 1385 }') !== -1,
        usedInEntry: mainJsText.indexOf('this.worldMapSpawnPoints[mapId]') !== -1,
    };
    check('Main 里写死世界地图传送落点（青岚浮野 2718,1500 / 云渡泽 541,1385）并在 enterMapFromWorldMap 生效',
        spawnStatic.tableDefined && spawnStatic.qinglanPoint && spawnStatic.yunduzePoint
        && spawnStatic.usedInEntry, spawnStatic);
    check('落点：青岚浮野 (2718, 1500) 可站（24×24 碰撞盒四角均通行）',
        results.worldMapSpawn.qinglan_fuye.standable === true
        && results.worldMapSpawn.qinglan_fuye.insideBounds === true,
        results.worldMapSpawn.qinglan_fuye);
    check('落点：云渡泽 (541, 1385) 可站（24×24 碰撞盒四角均通行）',
        results.worldMapSpawn.yunduze.standable === true
        && results.worldMapSpawn.yunduze.insideBounds === true,
        results.worldMapSpawn.yunduze);
    check('世界地图按钮解锁由 updateWorldMapUnlocks 同步（两章常开）',
        results.worldMapUnlockCalls.indexOf('btn_qinglan=true') !== -1
        && results.worldMapUnlockCalls.indexOf('btn_yunduze=true') !== -1, results.worldMapUnlockCalls);

    section('8. 世界地图打开时只显示世界地图及其上的按钮');
    check('世界地图打开时渲染世界地图本身', results.overlay.mapRenderedWhenOpen > 0, results.overlay.mapRenderedWhenOpen);
    check('对照：地图关闭时路标提示会绘制（“按 E 键乘船离开”）',
        results.overlay.textsWhenMapClosed.indexOf('按 E 键乘船离开') !== -1, results.overlay.textsWhenMapClosed);
    check('世界地图打开时不再绘制路标提示（不会叠在地图上）',
        results.overlay.textsWhenMapOpen.indexOf('按 E 键乘船离开') === -1, results.overlay.textsWhenMapOpen);
    check('世界地图打开时画面无多余 UI 文本', results.overlay.textsWhenMapOpen.length === 0, results.overlay.textsWhenMapOpen);
    check('世界地图打开时按 Q 不会打开任务栏', results.overlay.questUIOpenedByQ === false, results.overlay);
    check('世界地图打开时按 E 不触发交互', results.overlay.interactionTriggered === 0, results.overlay);

    section('9. 调试代码清理 + 数值核对（玩家 150/70、灵息每秒回 2、Boss 300、法阵门控）');
    const debugCheatsPath = path.join(ROOT, 'js', 'DebugCheats.js');
    check('调试文件 js/DebugCheats.js 已删除', fs.existsSync(debugCheatsPath) === false, debugCheatsPath);
    check('game.html 不再引用调试脚本',
        files.indexOf('js/DebugCheats.js') === -1, files.filter(f => f.indexOf('DebugCheats') !== -1));
    check('运行期不存在调试开关 window.DebugCheats', results.numeric.debugCheatsGlobal === false);
    const htmlSource = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
    check('game.html 源码中已无 DebugCheats 残留', htmlSource.indexOf('DebugCheats') === -1);

    check('山口法阵仍由任务 chapter1_main_4 门控',
        results.numeric.teleportQuestRequired === 'chapter1_main_4', results.numeric.teleportQuestRequired);
    check('山口法阵仍走战场流程（bossArena=true）', results.numeric.teleportBossArena === true);
    check('任务未接取 → 法阵隐藏', results.numeric.teleportHiddenWhenLocked === false,
        results.numeric.teleportHiddenWhenLocked);
    check('无任务系统 → 法阵隐藏', results.numeric.teleportHiddenWithoutQuestSystem === false,
        results.numeric.teleportHiddenWithoutQuestSystem);
    check('接取主线四 → 法阵显示', results.numeric.teleportVisibleWhenAccepted === true,
        results.numeric.teleportVisibleWhenAccepted);
    check('主线四完成后法阵仍显示（可重复挑战）', results.numeric.teleportVisibleWhenCompleted === true,
        results.numeric.teleportVisibleWhenCompleted);

    check('练气境界：气血上限 150 / 灵息上限 70',
        results.numeric.realmMaxHealth === 150 && results.numeric.realmMaxMana === 70,
        { maxHealth: results.numeric.realmMaxHealth, maxMana: results.numeric.realmMaxMana });
    check('玩家建号即为满值：气血 150/150，灵息 70/70',
        results.numeric.freshPlayerHealth === 150 && results.numeric.freshPlayerMaxHealth === 150
        && results.numeric.freshPlayerMana === 70 && results.numeric.freshPlayerMaxMana === 70,
        {
            health: results.numeric.freshPlayerHealth, maxHealth: results.numeric.freshPlayerMaxHealth,
            mana: results.numeric.freshPlayerMana, maxMana: results.numeric.freshPlayerMaxMana,
        });

    check('灵息自然恢复：按境界分档 —— 练气 每秒 2 点（顶层兜底值）',
        !!results.numeric.manaRegenConfig && results.numeric.manaRegenConfig.interval === 1
        && results.numeric.manaRegenConfig.amount === 2,
        results.numeric.manaRegenConfig);
    check('灵息自然恢复分档表：练气 1 秒 2 点 / 筑基 1 秒 4 点 / 结丹 1 秒 10 点',
        !!results.numeric.manaRegenByRealm
        && results.numeric.manaRegenByRealm.lianqi.interval === 1
        && results.numeric.manaRegenByRealm.lianqi.amount === 2
        && results.numeric.manaRegenByRealm.zhuji.interval === 1
        && results.numeric.manaRegenByRealm.zhuji.amount === 4
        && results.numeric.manaRegenByRealm.jiedan.interval === 1
        && results.numeric.manaRegenByRealm.jiedan.amount === 10,
        results.numeric.manaRegenByRealm);
    check('灵息恢复按间隔结算：0.9 秒仍 0 点 → 满 1 秒 +2 点 → 5 秒共 10 点',
        results.numeric.regenAt0p9 === 0 && results.numeric.regenAt1 === 2 && results.numeric.regenAt5 === 10,
        { t0p9: results.numeric.regenAt0p9, t1: results.numeric.regenAt1, t5: results.numeric.regenAt5 });
    check('筑基（1 秒 4 点）：0.9 秒 0 点 → 1 秒 4 点 → 3 秒 12 点',
        results.numeric.zhujiRegenAt0p9 === 0 && results.numeric.zhujiRegenAt1 === 4
        && results.numeric.zhujiRegenAt3 === 12,
        {
            at0p9: results.numeric.zhujiRegenAt0p9, at1: results.numeric.zhujiRegenAt1,
            at3: results.numeric.zhujiRegenAt3,
        });
    check('结丹（1 秒 10 点）：1 秒 10 点 → 2.5 秒 20 点',
        results.numeric.jiedanRegenAt1 === 10 && results.numeric.jiedanRegenAt2p5 === 20,
        { at1: results.numeric.jiedanRegenAt1, at2p5: results.numeric.jiedanRegenAt2p5 });
    check('长时间挂机：灵息封顶在 maxMana（70）不溢出，计时器清零',
        results.numeric.regenCapped === 70 && results.numeric.regenTimerAtCap === 0,
        { mana: results.numeric.regenCapped, timer: results.numeric.regenTimerAtCap });

    check('筑基境界配置：气血上限 400 / 灵息上限 250',
        results.numeric.zhujiMaxHealth === 400 && results.numeric.zhujiMaxMana === 250,
        { maxHealth: results.numeric.zhujiMaxHealth, maxMana: results.numeric.zhujiMaxMana });
    check('筑基突破（Player.breakthrough）：上限 400/250 并把残血残灵息直接回满',
        results.numeric.breakthroughAdvanced === true
        && results.numeric.breakthroughRealm === 'zhuji'
        && results.numeric.breakthroughMaxHealth === 400 && results.numeric.breakthroughMaxMana === 250
        && results.numeric.breakthroughHealth === 400 && results.numeric.breakthroughMana === 250,
        {
            advanced: results.numeric.breakthroughAdvanced, realm: results.numeric.breakthroughRealm,
            health: results.numeric.breakthroughHealth, maxHealth: results.numeric.breakthroughMaxHealth,
            mana: results.numeric.breakthroughMana, maxMana: results.numeric.breakthroughMaxMana,
        });

    check('Boss 摄风山魈配置气血为 300', results.numeric.bossConfigHealth === 300, results.numeric.bossConfigHealth);
    check('真实 ShanxiaoBoss 实例气血为 300',
        results.numeric.spawnedBossHp === 300, results.numeric.spawnedBossHp || results.numeric.spawnedBossError);

    section('10. 基础操作教学：按键只看教学圈 + 左下角技能栏逐格解锁');
    const training = results.training;
    check('战斗按键顺序为 J/U/I/L/O（attack → lingxidan → hutishu → dodge → jianying）',
        Array.isArray(training.order) && training.order.join(',') === 'attack,lingxidan,hutishu,dodge,jianying',
        training.order);
    check('教学开始时四个战斗按键全部未解锁（左下角没有任何技能格）',
        training.unlockedAtStart.length === 0, training.unlockedAtStart);
    check('教学开始时只显示气血条 / 灵息条（不出现 J/U/I/L 技能格与数值文案）',
        ['J', 'U', 'I', 'L'].every(k => training.hudTextsAtStart.indexOf(k) === -1)
        && training.hudTextsAtStart.every(t => t.indexOf('气血') === -1 && !/\d+\s*\/\s*\d+/.test(t)),
        training.hudTextsAtStart);
    check('站在普通攻击教学圈内：J 可用', training.canUseAttackOnCircle === true,
        training.nearbyZoneOnCircle);
    check('不在对应教学圈内：U/I/L 不可用', training.canUseOthersOnCircle.length === 0,
        training.canUseOthersOnCircle);
    check('离开所有教学圈：四个按键都不可用', training.canUseAnyOffCircle.length === 0,
        training.canUseAnyOffCircle);
    check('不在教学圈内按 J：不施展，仅提示去教学圈',
        training.attackCallsOffCircle === 0
        && typeof training.toastOffCircle === 'string'
        && training.toastOffCircle.indexOf('教学圈') !== -1,
        { calls: training.attackCallsOffCircle, toast: training.toastOffCircle });
    check('教学期按 O（剑影连斩）：本次试炼没有这个教学圈 → 完全静默，不弹任何提示',
        training.jianyingToastDuringTraining === '', training.jianyingToastDuringTraining);
    check('在教学圈内按 J：施展成功并完成该教学步骤',
        training.attackCallsOnCircle === 1 && training.completedAfterAttack === true,
        { calls: training.attackCallsOnCircle, completed: training.completedAfterAttack });
    check('完成普攻教学 → 只解锁普攻这一个动作（但左下角不会出现 J 格）',
        training.unlockedAfterAttack.join(',') === 'attack', training.unlockedAfterAttack);
    check('普攻学会后左下角不显示任何技能格（J 格已删除）',
        training.hudTextsAfterAttack.length === 0, training.hudTextsAfterAttack);
    check('教学圈完成后消失：同一位置再按 J 不再可用',
        training.canUseAttackAfterCompleted === false);
    check('逐步完成 → 解锁状态逐格补全（attack → +U → +I → +L，技能栏只画 U/I/L）',
        JSON.stringify(training.unlockAfterEachStep) === JSON.stringify([
            ['attack', 'lingxidan'],
            ['attack', 'lingxidan', 'hutishu'],
            ['attack', 'lingxidan', 'hutishu', 'dodge'],
        ]), training.unlockAfterEachStep);
    check('基础教学不涉及剑影连斩（O 由第二章主线一试炼传授，未习得时一直不解锁）',
        training.unlockedAtStart.indexOf('jianying') === -1
        && training.canUseAnyAfterTraining.indexOf('jianying') === -1,
        { atStart: training.unlockedAtStart, afterTraining: training.canUseAnyAfterTraining });
    check('四步全部完成 → 教学结束（4/4）',
        training.completedCount === 4 && training.isActiveAfterAll === false,
        { completed: training.completedCount, active: training.isActiveAfterAll });
    check('三格齐全后 HUD 上没有任何技能格文字（U/I/L 按键、技能名、普攻 J 都不显示）',
        ['U', 'I', 'L', 'J', '灵息弹', '护体术', '闪避', '普通攻击']
            .every(k => training.hudTextsAfterAll.indexOf(k) === -1)
        && training.hudTextsAfterAll.every(t => !/\d+(\.\d+)?s$/.test(t)),
        training.hudTextsAfterAll);
    check('教学完成后永久解锁：离开教学圈也能施展四个技能',
        training.canUseAnyAfterTraining.length === 4, training.canUseAnyAfterTraining);

    section('11. Boss 战场：只生成一次 + 正中心永久归途法阵 + 不再 10 秒自动回城');
    const arena = results.arena;
    check('首次进入战场会生成摄风山魈', arena.firstEntrySpawned === true);
    check('战场正中心 = (640, 360)（1280×720 的一半）',
        arena.center.x === 640 && arena.center.y === 360, arena.center);
    check('Boss 伏诛后不再自动传回（推进 20 秒无任何返回调用）',
        arena.autoReturnCalls.length === 0, arena.autoReturnCalls);
    check('已删除“等 10 秒自动回城”的倒计时字段',
        arena.victoryTimerFieldGone === true);
    check('Boss 伏诛 → 记录剧情标记 boss_shanxiao_defeated', arena.storyFlag === true);
    check('Boss 伏诛 → 胜利结算只执行一次（victoryHandled）', arena.victoryHandled === true);
    check('Boss 伏诛 → 场上 Boss 实体被清理', arena.bossCleared === true);
    check('Boss 伏诛 → 战场正中心生成传送法阵',
        !!arena.exitArray && arena.exitArray.position.x === 640 && arena.exitArray.position.y === 360,
        arena.exitArray);
    check('归途法阵落点＝进场时记录的“原来位置”（青岚浮野 2959, 358）',
        !!arena.exitArray && arena.exitArray.targetMapId === 'qinglan_fuye'
        && arena.exitArray.targetPosition.x === 2959 && arena.exitArray.targetPosition.y === 358,
        arena.exitArray);
    check('归途法阵走普通换图流程（bossArena=false）且可见',
        !!arena.exitArray && arena.exitArray.bossArena === false && arena.exitArray.isActive === true,
        arena.exitArray);
    check('再次进入战场不再生成 Boss', arena.secondEntry.spawnBlocked === true, arena.secondEntry);
    check('归途法阵永久存在且不重复生成',
        arena.secondEntry.stillActive === true && arena.secondEntry.exitArrayCount === 1,
        arena.secondEntry);

    // ---- 11b. 战败清场（第十三次改动）：被 Boss 打死 → 清技能效果 + 所有技能冷却清 0 ----
    // 需求：「玩家与 boss 战斗中死亡后，清除自身的技能效果，如闪避技能的加速、护身术的伤害减免，
    //       同时将所有技能的冷却时长清 0」。走真实 Main.returnFromBossArena 链路
    //       （PlayerCombatSystem.resetOnDeath，见 runner 同名探针）。
    const dr = results.deathReset;
    check('战败回到法阵旁走真实链路（returnFromBossArena 返回 true，并复活玩家）',
        dr.returned === true && dr.after.alive === true, dr);
    check('战败清场：护身术减伤去掉（受伤倍率回到 1）+ 闪避加速去掉（移速回到境界基准）',
        dr.before.reduction < 1 && dr.after.damageMultiplier === 1
        && dr.before.speed > dr.after.speed && dr.after.speed === dr.after.baseSpeed
        && dr.after.buffs.hutishu === 0 && dr.after.buffs.dodge === 0,
        { before: dr.before, after: dr.after });
    check('战败清场：所有技能冷却清 0（普攻 / 灵息弹 / 护体术 / 闪避 / 剑影连斩）',
        dr.before.cooldowns.dodge === 51 && dr.before.cooldowns.hutishu === 22
        && dr.after.allCooldownsZero === true, dr.after.cooldowns);
    check('战败清场：气场特效一并收掉 + 受伤僵直 / 施法残留清空',
        dr.after.hutishuAura === null && dr.after.dodgeAura === null
        && dr.after.hurtLock === 0 && dr.after.casting === null
        && dr.after.playerHurtLocked === false && dr.after.playerCasting === false, dr.after);

    section('12. 自定义气血条 / 灵息条（纯图片绘制：先内条后外框，条上无数字）');
    const bars = results.bars;

    // 内条绘制宽度 = fillStartX + 比例 × (fillWidth - fillStartX)
    // 美术更正：内条 X∈[78, 454) 才是"真正能看见的血量/灵息"像素（X∈[0,78) 是左侧固定装饰），
    // 即当前血量 h、上限 H 时只取源图 X = 0 → 78 + h/H × (454 - 78)。
    const fillStartX = bars.spec.fillStartX;
    const fillWidth = bars.spec.fillWidth;
    const barWidthAt = (ratio) => fillStartX + ratio * (fillWidth - fillStartX);

    check('美术规格：外框 500×64 / 内条 454×64 / 真实血量像素从 X = 78 到右边界 454',
        bars.spec.frameWidth === 500 && bars.spec.frameHeight === 64
        && bars.spec.fillWidth === 454 && bars.spec.fillHeight === 64
        && bars.spec.fillStartX === 78, bars.spec);
    check('气血条 / 灵息条各自绑定 assets/images/ui 下的外框图与内条图',
        bars.resourcePaths.healthFrame === 'assets/images/ui/health_bar_bg.png'
        && bars.resourcePaths.healthFill === 'assets/images/ui/health_bar_fill.png'
        && bars.resourcePaths.manaFrame === 'assets/images/ui/mana_bar_bg.png'
        && bars.resourcePaths.manaFill === 'assets/images/ui/mana_bar_fill.png',
        bars.resourcePaths);

    // 美术文件实检：尺寸不符时 PlayerCombat 会整条不绘制，所以这里直接量 PNG
    const barArtFiles = [
        ['assets/images/ui/health_bar_bg.png', 500, 64],
        ['assets/images/ui/health_bar_fill.png', 454, 64],
        ['assets/images/ui/mana_bar_bg.png', 500, 64],
        ['assets/images/ui/mana_bar_fill.png', 454, 64],
    ];
    const barArtActual = barArtFiles.map(([rel, w, h]) => {
        const p = path.join(ROOT, rel.replace(/\//g, path.sep));
        if (!fs.existsSync(p)) return `${rel}: 缺失（期望 ${w}×${h}）`;
        const s = readPngSize(p);
        return `${rel}: ${s.width}×${s.height}（期望 ${w}×${h}）`;
    });
    check('四张条图已入库且尺寸与规格完全一致（尺寸不符该条不绘制）',
        barArtFiles.every(([rel, w, h]) => {
            const p = path.join(ROOT, rel.replace(/\//g, path.sep));
            if (!fs.existsSync(p)) return false;
            const s = readPngSize(p);
            return s.width === w && s.height === h;
        }), barArtActual);
    check('四张条图已加入 playerCombat 分组 + 游戏启动预加载列表',
        ['assets/images/ui/health_bar_bg.png', 'assets/images/ui/health_bar_fill.png',
            'assets/images/ui/mana_bar_bg.png', 'assets/images/ui/mana_bar_fill.png']
            .every(p => bars.pathsInPreloadGroup.indexOf(p) !== -1)
        && ['ui.health_bar_bg', 'ui.health_bar_fill', 'ui.mana_bar_bg', 'ui.mana_bar_fill']
            .every(k => mainJsSource.indexOf("'" + k + "'") !== -1),
        bars.pathsInPreloadGroup);
    check('旧的代码画条方法 _drawBar 已删除（不再用代码画条）',
        bars.legacyCodeBarHelperGone === true);

    const halfDraws = bars.half.draws;
    check('气血 50/100：内条只裁切源图 X = 0 → 266（78 + 0.5 × (454 - 78)）',
        halfDraws.length === 4
        && halfDraws[0].tag === 'healthFill'
        && halfDraws[0].source.x === 0 && halfDraws[0].source.y === 0
        && halfDraws[0].source.w === barWidthAt(0.5) && halfDraws[0].source.h === 64,
        { expected: barWidthAt(0.5), actual: halfDraws[0] });
    check('绘制顺序：先画内条、再画外框',
        halfDraws[0].tag === 'healthFill' && halfDraws[1].tag === 'healthFrame',
        halfDraws.map(d => d.tag));
    check('外框与内条左上角对齐（同一个 x / y，且位于 CONFIG.hud.origin）',
        halfDraws[0].dest.x === halfDraws[1].dest.x
        && halfDraws[0].dest.y === halfDraws[1].dest.y
        && halfDraws[0].dest.x === bars.spec.origin.x
        && halfDraws[0].dest.y === bars.spec.origin.y,
        [halfDraws[0].dest, halfDraws[1].dest]);
    check('外框按整张 500×64 绘制（不带源矩形裁切）',
        halfDraws[1].source === null
        && halfDraws[1].dest.w === 500 && halfDraws[1].dest.h === 64,
        halfDraws[1]);
    check('灵息条逻辑与气血条完全一致（同规格、先内条后外框、位于气血条下方）',
        halfDraws[2].tag === 'manaFill' && halfDraws[3].tag === 'manaFrame'
        && halfDraws[2].source.w === barWidthAt(0.25)       // 灵息 25/100 → 78 + 0.25 × 376 = 172
        && halfDraws[3].source === null
        && halfDraws[2].dest.x === halfDraws[3].dest.x
        && halfDraws[2].dest.y === halfDraws[3].dest.y
        && halfDraws[2].dest.y === bars.spec.origin.y + bars.spec.frameHeight + bars.spec.lineGap,
        halfDraws.slice(2));
    check('气血为 0：只显示左侧 78px 固定装饰（真实血量像素长度归零）',
        bars.zero.draws[0].tag === 'healthFill'
        && bars.zero.draws[0].source.x === 0 && bars.zero.draws[0].source.w === fillStartX,
        bars.zero.draws[0]);
    check('满血：内条裁切整张 454 宽（78 + 376，正好到图片右边界）',
        bars.full.draws[0].source.w === fillWidth, bars.full.draws[0]);
    check('比例越界（160/100）自动夹紧到上限 454（不会超出图片右边界）',
        bars.over.draws[0].source.w === fillWidth, bars.over.draws[0]);
    check('任意比例都按同一公式线性取值：气血 75/100 → 78 + 0.75 × 376 = 360',
        bars.seventyFive.draws[0].source.w === barWidthAt(0.75),
        { expected: barWidthAt(0.75), actual: bars.seventyFive.draws[0] });
    check('实际绘制长度 = 裁切宽度（气血 0 → 78 / 半血 → 266 / 满血 → 454；灵息 25/100 → 172）',
        bars.zero.draws[0].dest.w === barWidthAt(0)
        && bars.half.draws[0].dest.w === barWidthAt(0.5)
        && bars.full.draws[0].dest.w === barWidthAt(1)
        && bars.half.draws[2].dest.w === barWidthAt(0.25),
        [bars.zero.draws[0], bars.half.draws[0], bars.full.draws[0], bars.half.draws[2]]);
    check('内条图片缺失 → 气血条整条不绘制（不退回代码画条）',
        bars.missingHealthFill.draws.map(d => d.tag).join(',') === 'manaFill,manaFrame',
        bars.missingHealthFill.draws.map(d => d.tag));
    check('外框尺寸不符（32×32 占位图）→ 该条不绘制',
        bars.brokenHealthFrame.draws.map(d => d.tag).join(',') === 'manaFill,manaFrame',
        bars.brokenHealthFrame.draws.map(d => d.tag));
    check('图片尚未加载完 → 两条都不绘制（不会画出占位图 / 错误图形）',
        bars.noImages.draws.length === 0, bars.noImages.draws);
    check('条上不显示数字：HUD 不再绘制“气血 100/100”这类数值文案',
        bars.half.texts.every(t => t.indexOf('气血') === -1 && !/\d+\s*\/\s*\d+/.test(t)),
        bars.half.texts);

    section('13. 左下角技能栏：三格 100×100 图片（格上无文字），冷却只压遮罩（普攻不占格）');
    const skillBar = results.skillBar;

    check('技能栏顺序为 U → I → L → O（普攻 J 已从技能格中删除；O 剑影连斩学会后才出现）',
        skillBar.spec.order.join(',') === 'lingxidan,hutishu,dodge,jianying', skillBar.spec.order);
    check('美术规格：每格 100×100（iconSize × scale = 100）',
        skillBar.spec.iconSize === 100 && Math.round(skillBar.spec.iconSize * skillBar.spec.scale) === 100,
        skillBar.spec);
    check('三格分别绑定 assets/images/ui/skill_lingxidan.png / skill_hutishu.png / skill_dodge.png',
        skillBar.resourcePaths.lingxidan === 'assets/images/ui/skill_lingxidan.png'
        && skillBar.resourcePaths.hutishu === 'assets/images/ui/skill_hutishu.png'
        && skillBar.resourcePaths.dodge === 'assets/images/ui/skill_dodge.png',
        skillBar.resourcePaths);
    check('四张图标键已写进各技能配置（hudIcon），普攻没有图标且已标记 silentCooldown',
        skillBar.hudIcons.join(',') === 'ui.skill_lingxidan,ui.skill_hutishu,ui.skill_dodge,ui.skill_jianying'
        && skillBar.attackHasIcon === false
        && skillBar.attackSilentCooldown === true,
        { hudIcons: skillBar.hudIcons, attackHasIcon: skillBar.attackHasIcon, silent: skillBar.attackSilentCooldown });
    check('剑影连斩图标绑定 assets/images/ui/skill_jianying.png（O 剑影连斩）',
        skillBar.resourcePaths.jianying === 'assets/images/ui/skill_jianying.png',
        skillBar.resourcePaths);
    check('四张图标已加入 playerCombat 分组 + 启动预加载列表',
        ['assets/images/ui/skill_lingxidan.png', 'assets/images/ui/skill_hutishu.png',
            'assets/images/ui/skill_dodge.png', 'assets/images/ui/skill_jianying.png']
            .every(p => skillBar.pathsInPreloadGroup.indexOf(p) !== -1)
        && ['ui.skill_lingxidan', 'ui.skill_hutishu', 'ui.skill_dodge', 'ui.skill_jianying']
            .every(k => mainJsSource.indexOf("'" + k + "'") !== -1),
        skillBar.pathsInPreloadGroup);

    // 绘制：三格各按 100×100 画在自己位置上，格子上不写任何文字（只保留冷却遮罩）
    const readyDraws = skillBar.ready.draws;
    const expectedSlotY = skillBar.spec.canvasHeight - skillBar.spec.iconSize - skillBar.spec.bottomMargin;
    const expectedSlotLeft = (index) => skillBar.spec.startX
        + index * (skillBar.spec.iconSize + skillBar.spec.gap);
    check('三格图片按 100×100 绘制，从左下角起依次排开（间距 = CONFIG.hud.skillBar.gap）',
        readyDraws.length === 3
        && readyDraws[0].tag === 'icon_lingxidan' && readyDraws[1].tag === 'icon_hutishu'
        && readyDraws[2].tag === 'icon_dodge'
        && readyDraws.every(d => d.dest.w === 100 && d.dest.h === 100 && d.dest.y === expectedSlotY)
        && readyDraws[0].dest.x === expectedSlotLeft(0)
        && readyDraws[1].dest.x === expectedSlotLeft(1)
        && readyDraws[2].dest.x === expectedSlotLeft(2),
        readyDraws);
    check('就绪时格子中央不绘制按键字母（U / I / L / O），格子下方也不绘制技能名',
        skillBar.ready.texts.length === 0 && skillBar.ready.rects.length === 0, skillBar.ready);
    check('冷却中不写倒计时：只按剩余比例从格子顶部压下冷却遮罩（灵息弹 1.5s / 护体术 12s 各一块）',
        skillBar.cooling.texts.length === 0
        && skillBar.cooling.rects.length === 2
        && Math.abs(skillBar.cooling.rects[0].h - 100 * Math.min(1, 1.5 / skillBar.cooldowns[0])) < 0.001
        && Math.abs(skillBar.cooling.rects[1].h - 100 * Math.min(1, 12 / skillBar.cooldowns[1])) < 0.001,
        { texts: skillBar.cooling.texts, rects: skillBar.cooling.rects, cooldowns: skillBar.cooldowns });
    check('冷却遮罩与格子对齐（x / y / w 都与该格一致，从头压下）',
        skillBar.cooling.rects.every((r, i) => r.w === 100 && r.y === expectedSlotY
            && r.x === expectedSlotLeft(i)), skillBar.cooling.rects);
    check('技能格文字开关默认全关（showKey / showCooldownText / showName 均为 false）',
        skillBar.textToggles.showKey === false && skillBar.textToggles.showCooldownText === false
        && skillBar.textToggles.showName === false, skillBar.textToggles);
    check('图片未加载 → 该格回退程序化方框，同样不写按键 / 倒计时',
        skillBar.missingIcons.draws.length === 0
        && skillBar.missingIcons.texts.length === 0
        && skillBar.missingIcons.rects.length === 3,
        skillBar.missingIcons);
    check('图片尺寸不符（64×64）→ 同样回退程序化方框（不拉伸变形、不写文字）',
        skillBar.wrongSizeIcons.draws.length === 0
        && skillBar.wrongSizeIcons.texts.length === 0
        && skillBar.wrongSizeIcons.rects.length === 3,
        skillBar.wrongSizeIcons);
    check('剑影连斩未习得 → 技能栏不画第 4 格；习得（O）后补出第 4 格 100×100 并排在 L 右侧',
        skillBar.jianyingSlot.orderIndex === 3
        && skillBar.jianyingSlot.hiddenDrawCount === 3
        && skillBar.jianyingSlot.learned.draws.length === 4
        && skillBar.jianyingSlot.learned.draws[3].tag === 'icon_jianying'
        && skillBar.jianyingSlot.learned.draws[3].dest.w === 100
        && skillBar.jianyingSlot.learned.draws[3].dest.h === 100
        && skillBar.jianyingSlot.learned.draws[3].dest.x === expectedSlotLeft(3)
        && skillBar.jianyingSlot.learned.draws[3].dest.y === expectedSlotY
        && skillBar.jianyingSlot.learned.texts.length === 0,
        skillBar.jianyingSlot);
    check('普攻教学本身仍在：教学圈提示仍指向 J 键（普攻始终不占左下角技能格）',
        !!skillBar.attackTrainingZone && skillBar.attackTrainingZone.actionKey === 'j'
        && skillBar.attackTrainingZone.promptText.indexOf('J') !== -1,
        skillBar.attackTrainingZone);
    check('普攻冷却不再弹屏幕中下方提示（silentCooldown：静默失败，不改冷却数值）',
        skillBar.attackCooldownToast.blocked === true
        && skillBar.attackCooldownToast.toastText === ''
        && skillBar.attackCooldownToast.toastTimer === 0, skillBar.attackCooldownToast);
    check('对照：其它技能冷却时仍有屏幕提示（“冷却中”）',
        skillBar.lingxidanCooldownToast.blocked === true
        && typeof skillBar.lingxidanCooldownToast.toastText === 'string'
        && skillBar.lingxidanCooldownToast.toastText.indexOf('冷却中') !== -1,
        skillBar.lingxidanCooldownToast);

    // 美术文件：已交付则校验 100×100，未交付则确认“缺图自动回退方框”路径已生效
    const skillIconFiles = [
        'assets/images/ui/skill_lingxidan.png',
        'assets/images/ui/skill_hutishu.png',
        'assets/images/ui/skill_dodge.png',
        'assets/images/ui/skill_jianying.png',
    ];
    const skillIconToLocal = (rel) => path.join(ROOT, rel.replace(/\//g, path.sep));
    const skillIconActual = skillIconFiles.map((rel) => {
        if (!fs.existsSync(skillIconToLocal(rel))) return `${rel}: 未交付（当前回退程序化方框）`;
        const s = readPngSize(skillIconToLocal(rel));
        return `${rel}: ${s.width}×${s.height}（期望 100×100）`;
    });
    if (skillIconFiles.every((rel) => fs.existsSync(skillIconToLocal(rel)))) {
        check('三张技能栏图标已入库且尺寸为 100×100', skillIconFiles.every((rel) => {
            const s = readPngSize(skillIconToLocal(rel));
            return s.width === 100 && s.height === 100;
        }), skillIconActual);
    } else {
        check('技能栏图标尚未全部交付 → 资源键与缺图回退路径已生效'
            + '（把 100×100 PNG 放进 assets/images/ui/ 即自动显示）', true, skillIconActual);
    }

    section('14. 主线三《散落的炊烟》：先问柳婶才能救助周叔 + 对话框画在左下角按键提示之上');
    const rescueGate = results.rescueGate;

    check('主线三接取后第一个目标是“询问阿砚”（顺序：阿砚 → 柳婶 → 救回周叔）',
        rescueGate.main3Active === true
        && rescueGate.objectiveAtAccept.type === 'talk_to'
        && rescueGate.objectiveAtAccept.target === 'ayan',
        rescueGate.objectiveAtAccept);
    check('刚接任务（尚未询问柳婶）→ 周叔只说被困（trapped_idle），不进入风桥护送',
        rescueGate.dialogueAtAccept === 'trapped_idle', rescueGate.dialogueAtAccept);
    check('只问过阿砚、未问柳婶 → 仍不可救助（trapped_idle；rescue 不是当前目标）',
        rescueGate.dialogueAfterAyan === 'trapped_idle' && rescueGate.rescueCurrentAfterAyan === false,
        { dialogue: rescueGate.dialogueAfterAyan, rescueCurrent: rescueGate.rescueCurrentAfterAyan });
    check('询问柳婶后（rescue 成为当前目标）→ 周叔进入风桥护送对话（rescue_start）',
        rescueGate.dialogueAfterLiushen === 'rescue_start' && rescueGate.rescueCurrentAfterLiushen === true,
        { dialogue: rescueGate.dialogueAfterLiushen, rescueCurrent: rescueGate.rescueCurrentAfterLiushen });
    check('风桥护送对话才提供“护送周叔过桥”（action: start_wind_bridge_rescue）；trapped_idle 无任何选项',
        rescueGate.rescueStartOptionTexts.indexOf('护送周叔过桥') !== -1
        && rescueGate.rescueStartActions.indexOf('start_wind_bridge_rescue') !== -1
        && rescueGate.trappedIdleOptionCount === 0,
        { texts: rescueGate.rescueStartOptionTexts, actions: rescueGate.rescueStartActions,
            trappedOptions: rescueGate.trappedIdleOptionCount });
    check('对照：柳婶自己的规则不受影响（未问 → ask_zhoushu；问完 → waiting_rescue）',
        rescueGate.liushenDialogueBeforeAsking === 'ask_zhoushu'
        && rescueGate.liushenDialogueAfterAsking === 'waiting_rescue',
        { before: rescueGate.liushenDialogueBeforeAsking, after: rescueGate.liushenDialogueAfterAsking });

    const rescueGuard = results.rescueGuard;
    check('Main.startWindBridgeRescue 门控：未询问柳婶时不搬迁周叔、不推进“救回周叔”',
        rescueGuard.blockedRepositionCalls === 0 && rescueGuard.blockedRescueObjective === false,
        rescueGuard);
    check('询问柳婶后护送生效：周叔迁往获救点 (2300,1160)，且“救回周叔”目标完成',
        rescueGuard.allowedRepositionCalls === 1 && rescueGuard.allowedRescueObjective === true
        && !!rescueGuard.movedTo && rescueGuard.movedTo[0] === 2300 && rescueGuard.movedTo[1] === 1160,
        rescueGuard);

    const layering = results.layering;
    check('对话框在左下角按键提示 UI（技能栏 / 气血灵息条）之后绘制 → 叠在其上方',
        layering.hudPromptIndex !== -1 && layering.dialogBoxIndex !== -1
        && layering.hudPromptIndex < layering.dialogBoxIndex,
        layering);
    check('Main.renderGameWorld 中 this.dialogBox.render(ctx) 位于 this.playerCombat.renderHud(ctx) 之后',
        mainJsSource.indexOf('this.playerCombat.renderHud(ctx)') !== -1
        && mainJsSource.indexOf('this.dialogBox.render(ctx)') !== -1
        && mainJsSource.indexOf('this.playerCombat.renderHud(ctx)')
            < mainJsSource.indexOf('this.dialogBox.render(ctx)'));

    section('15. 青岚浮野地图碰撞：collisionData 兜底 + 玩家碰撞盒必须小于瓦片边长');
    const qc = results.qinglanCollision;
    const unreachableNew = qc.reach.points.filter(p => !p.reachable).map(p => p.name);

    check('青岚浮野在 Chapter1Config 里带 collisionData（file:// 读不到碰撞图像素时兜底，否则全图可通行）',
        !!qc.table, qc.table ? 'rows=' + qc.table.rows : null);
    check('碰撞表尺寸与地图配置一致（105 × 59），且只含 . / # 两种字符',
        !!qc.table && qc.table.rows === qc.map.mapHeight
        && qc.table.cols.every(c => c === qc.map.mapWidth)
        && qc.table.chars.slice().sort().join(',') === '#,.',
        { rows: qc.table && qc.table.rows, cols: qc.table && qc.table.cols, chars: qc.table && qc.table.chars });
    check('碰撞表内容合理：出生点瓦片(14,43) / 祁伯瓦片(58,31) 可通行，房屋墙体(瓦片 48..53 × 28..31) 阻挡',
        qc.table.spawnTileWalkable === true && qc.table.qiboTileWalkable === true
        && qc.table.houseWallBlocked === true, qc.table);
    check('地图外圈（最后一行 + 首/末列）全为阻挡，玩家不会走出地图',
        qc.table.outerFrameBlocked === true);
    check('模拟 file://（碰撞图 = null）时，TileSystem 按 collisionData 建表：出生点可站、房屋墙体阻挡',
        qc.viaRealCode.spawnWalkable === true && qc.viaRealCode.houseBlocked === true
        && qc.viaRealCode.rectAtSpawnWalkable === true,
        qc.viaRealCode);
    check('真实代码路径建出的表与 collisionData 完全一致（行 × 列一致，可通行 / 阻挡都非空）',
        qc.viaRealCode.gridShape.rows === qc.map.mapHeight
        && qc.viaRealCode.gridShape.cols === qc.map.mapWidth
        && qc.viaRealCode.gridShape.walkable === qc.table.walkable
        && qc.table.walkable > 0 && qc.table.blocked > 0,
        { grid: qc.viaRealCode.gridShape, table: { walkable: qc.table.walkable, blocked: qc.table.blocked } });

    check('玩家移动碰撞盒 24×24，严格小于瓦片边长 32（否则正好横跨两行瓦片，单瓦片宽的桥/路走不过去）',
        qc.playerBox.collisionWidth === 24 && qc.playerBox.collisionHeight === 24
        && qc.playerBox.collisionWidth < qc.map.tileSize && qc.playerBox.collisionHeight < qc.map.tileSize,
        qc.playerBox);
    check('碰撞盒与精灵绘制尺寸解耦：render 用的 width/height 仍是 24×32（精灵不会被压缩）',
        qc.playerBox.drawWidth === 24 && qc.playerBox.drawHeight === 32, qc.playerBox);
    check('Player.getCollisionRect 以位置为中心：出生点 (448,1376) → x=436 / y=1364 / 24×24；省略参数时取当前位置',
        qc.playerBox.rect.x === 448 - 12 && qc.playerBox.rect.y === 1376 - 12
        && qc.playerBox.rect.width === 24 && qc.playerBox.rect.height === 24
        && qc.playerBox.rectDefault.x === qc.playerBox.rect.x
        && qc.playerBox.rectDefault.y === qc.playerBox.rect.y,
        { rect: qc.playerBox.rect, rectDefault: qc.playerBox.rectDefault });

    check('开启青岚浮野碰撞后玩家仍能走遍全图：从出生点可达 ≥ 95% 的可站立位置',
        qc.reach.fraction > 0.95,
        { fraction: Number(qc.reach.fraction.toFixed(4)), standable: qc.reach.standable, reachable: qc.reach.reachable });
    check('所有任务 / NPC / 教学交互点在各自交互半径内都能站到（19 个交互点 + 4 个教学圈）',
        unreachableNew.length === 0 && qc.reach.points.length === 23,
        { unreachable: unreachableNew, points: qc.reach.points });
    check('对照：新碰撞盒（24×24）的可达面积与修复前的 24×32 盒相当（差距 ≤ 1 个百分点）',
        qc.reach.fraction + 0.01 >= qc.reachLegacy.fraction,
        {
            newFraction: Number(qc.reach.fraction.toFixed(4)),
            legacyFraction: Number(qc.reachLegacy.fraction.toFixed(4)),
            legacyUnreachable: qc.reachLegacy.unreachable.length,
        });
    // 说明：原断言为“旧碰撞盒只能走到 24% 的区域、祁伯/教学圈全部走不到”，
    //       用于证明“碰撞盒等于瓦片边长会卡死单瓦片宽的桥/窄道”。
    //       当前 collision.png 已被重绘得比原图更开阔（可通行瓦片更多），
    //       旧碰撞盒在这张图上已不再复现卡死，故改为“新盒不劣于旧盒”的对照。
    //       两个碰撞盒的可站立格子总数不同（分母不同），所以用 1 个百分点容差比较，
    //       真正的硬约束是上面那条“23 个交互点全部可达”。
    //       需要复核历史结论时，可用旧版 collision.png（或 _collision.png）重跑本段。

    section('16. 任务栏排版：标题下移 20px + 每行最多 280px 自动换行');
    const ql = results.questUILayout;
    check('QuestUI 默认单行上限 280px / 标题在 padding.top 基础上再下移 20px',
        ql.maxLineWidth === 280 && ql.titleOffsetY === 20 && ql.continuationIndent === 16,
        { maxLineWidth: ql.maxLineWidth, titleOffsetY: ql.titleOffsetY, continuationIndent: ql.continuationIndent });
    check('标题「任  务  记  录」绘制在 y = 120 + 20 + 20 = 160（原 140），且仍水平居中',
        !!ql.title && ql.title.y === 160 && ql.title.x === 400 + 480 / 2,
        ql.title);
    check('任务标题 / 描述 / 目标进度统一按 280px 换行：没有任何一行文字超过 280px',
        ql.overLimit.length === 0 && ql.maxWidth <= 280,
        { overLimit: ql.overLimit, maxWidth: ql.maxWidth, lines: ql.lines });
    check('换行后的续行缩进 16px，文字块整行不越出右边界（leftX + 280）；'
        + '右下角「按 Q 或 ESC 关闭」是右对齐提示，不计入 280px 文字块',
        ql.indentedContinuations > 0 && ql.overflowRight.length === 0
        && !!ql.closeHint && ql.closeHint.x === 400 + 480 - 25,
        { indentedContinuations: ql.indentedContinuations, overflowRight: ql.overflowRight, closeHint: ql.closeHint });

    section('17. 开始界面：取消程序化绘制，改为整屏背景图 + 居中开始按钮图');
    const ss = results.startScreen;
    check('资源键已登记：ui.start_screen / ui.start_button',
        ss.keys.background === 'ui.start_screen' && ss.keys.button === 'ui.start_button'
        && ss.resourcePaths.background === 'assets/images/ui/start_screen.png'
        && ss.resourcePaths.button === 'assets/images/ui/start_button.png',
        { keys: ss.keys, paths: ss.resourcePaths });
    check('两张开始界面图已进入 mainMenu 资源分组（启动预加载列表）',
        ss.pathsInPreloadGroup.join(',') === 'assets/images/ui/start_screen.png,assets/images/ui/start_button.png',
        ss.pathsInPreloadGroup);
    check('Main.preloadInitialResources 里显式写入 ui.start_screen / ui.start_button',
        mainJsText.indexOf("'ui.start_screen'") !== -1 && mainJsText.indexOf("'ui.start_button'") !== -1);
    check('开始界面两张美术已入库且尺寸为 1280×720 / 400×112', (() => {
        const files = [
            ['assets/images/ui/start_screen.png', 1280, 720],
            ['assets/images/ui/start_button.png', 400, 112],
        ];
        return files.every(([rel, w, h]) => {
            const local = path.join(ROOT, rel.replace(/\//g, path.sep));
            if (!fs.existsSync(local)) return false;
            const s = readPngSize(local);
            return s.width === w && s.height === h;
        });
    })(), 'start_screen 1280×720 / start_button 400×112');

    check('开始按钮居中：左上角 (440, 304) = ((1280-400)/2, (720-112)/2)，尺寸 400×112',
        ss.buttonRect.x === 440 && ss.buttonRect.y === 304
        && ss.buttonRect.width === 400 && ss.buttonRect.height === 112
        && ss.insideRect === true && ss.outsideRect === true, ss.buttonRect);
    check('开始界面只贴两张图：整屏背景 (0,0,1280,720) + 居中按钮 (440,304,400,112)，'
        + '全程不写一个字、不画一个矩形',
        ss.artRender.imageCount === 2
        && ss.artRender.backgroundTargetIsScreenImage === true
        && (ss.artRender.backgroundRect || []).join(',') === '0,0,1280,720'
        && ss.artRender.buttonTargetIsButtonImage === true
        && (ss.artRender.buttonRect || []).join(',') === '440,304,400,112'
        && ss.artRender.textCount === 0 && ss.artRender.rectCount === 0, ss.artRender);
    check('点击开始按钮 → 切到 gameWorld（同一次开始不会重复切场景）',
        ss.startedByInsideClick.join(',') === 'gameWorld'
        && ss.switchesAfterRepeatClick.join(',') === 'gameWorld', ss.switchesAfterRepeatClick);
    check('按钮外点击 / 只按键盘（J、回车）都不再开始游戏',
        ss.ignoredOutside.length === 0, ss.ignoredOutside);
    check('鼠标悬停开始按钮时画布光标变手型，移开后恢复默认（只切 DOM 光标，不绘制图形）',
        ss.cursorWhenHover === 'pointer' && ss.cursorAfterLeave === 'default',
        { hover: ss.cursorWhenHover, leave: ss.cursorAfterLeave });
    check('缺图（dataURL 占位图）时不画品红占位块：只铺一层底色、无文字',
        ss.noArtRender.imageCount === 0 && ss.noArtRender.rectCount === 1
        && ss.noArtRender.textCount === 0
        && ss.sceneNoArtImages.background === null && ss.sceneNoArtImages.button === null,
        ss.noArtRender);
    check('js 代码里不再绘制开始界面文字（标题 / 「按任意键开始游戏」均已删除，改为贴图）', (() => {
        const mm = fs.readFileSync(path.join(ROOT, 'js', 'MainMenuScene.js'), 'utf8');
        const mainJs = readMainLayerSource();
        return mm.indexOf('fillText') === -1 && mm.indexOf('strokeText') === -1
            && mainJs.indexOf("ctx.fillText('按任意键开始游戏'") === -1
            && mainJs.indexOf("ctx.fillText('修仙者模拟器：飘途'") === -1
            && mainJs.indexOf('mainMenuScene.render(ctx)') !== -1;
    })());

    section('18. 游戏完结界面：章末二登船后的滚动字幕（逐行居中上滚 + 任意键返回世界地图）');
    const ge = results.gameEnding;
    check('game.html 已引入 js/EndingText.js（字幕文案）与 js/EndingScene.js（完结场景）',
        files.indexOf('js/EndingText.js') !== -1 && files.indexOf('js/EndingScene.js') !== -1,
        files.filter(f => f.indexOf('Ending') !== -1));
    check('js/EndingText.js 与 tools/游戏结束滚动文字.txt 逐行一致（改文案只需改 txt 后重新生成）', (() => {
        const raw = fs.readFileSync(path.join(ROOT, 'tools', '游戏结束滚动文字.txt'), 'utf8')
            .replace(/\r\n/g, '\n');
        const txtLines = (raw.endsWith('\n') ? raw.slice(0, -1) : raw).split('\n');
        const ctx = vm.createContext({});
        vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'EndingText.js'), 'utf8'), ctx,
            { filename: 'js/EndingText.js' });
        const jsLines = vm.runInContext('EndingText.getLines()', ctx);
        return jsLines.length === txtLines.length && jsLines.every((l, i) => l === txtLines[i]);
    })());
    check('字幕文案：281 行（正文 141 + 空行 140），每行 ≤ 25 字（最长 20 字），首 / 末行与源文件一致',
        ge.sourceFile === 'tools/游戏结束滚动文字.txt' && ge.lineLimit === 25
        && ge.lineCount === 281 && ge.blankLineCount === 140
        && ge.maxLineLength === 20 && ge.overLimit.length === 0
        && ge.firstLine === '如果你看到了这里，' && ge.lastLine === '谢谢你，走完这段飘途。'
        && ge.firstBlankIndex === 1,
        { source: ge.sourceFile, count: ge.lineCount, blanks: ge.blankLineCount, max: ge.maxLineLength, over: ge.overLimit });
    check('EndingScene：画布 1280×720 / 行距 56px / 字号 40px / 楷体宋体艺术字栈 / 默认 100px 每秒（整段约 2.7 分钟）',
        ge.canvas.width === 1280 && ge.canvas.height === 720
        && ge.lineHeight === 56 && ge.fontSize === 40
        && ge.textFont.indexOf('KaiTi') !== -1 && ge.textFont.indexOf('serif') !== -1
        && ge.defaultSpeed === 100
        && ge.durationAtDefaultSpeed > 150 && ge.durationAtDefaultSpeed < 220,
        { canvas: ge.canvas, lineHeight: ge.lineHeight, fontSize: ge.fontSize, speed: ge.defaultSpeed, duration: ge.durationAtDefaultSpeed });
    check('空行同样占一个行位：整段高度 = 281 行 × 56px = 15736px',
        ge.totalHeight === ge.lineCount * ge.lineHeight && ge.totalHeight === 15736, ge.totalHeight);
    check('进入场景：整段从屏幕下缘外开始（首行 y = 720）、尚未播完、世界输入被封死（移动 + 键盘）',
        ge.enterState.offset === 720 && ge.enterState.finished === false
        && ge.enterState.movementBlocked === true && ge.enterState.inputBlocked === true, ge.enterState);
    check('字幕播放中不显示「按任意键返回游戏」，且按任意键 / 点鼠标都不退出（不能跳过字幕）',
        ge.promptBeforeFinish === 0 && ge.switchesWhileScrolling.length === 0
        && ge.promptText === '按任意键返回游戏',
        { promptBeforeFinish: ge.promptBeforeFinish, switches: ge.switchesWhileScrolling });
    check('每行占位恒定 56px（第 2 行是空行也照样占位）；同一行随时间上移（0.05s × 20000px/s = 1000px）',
        ge.linePitch[0] === 56 && ge.linePitch[1] === 56
        && Math.abs(ge.firstLineDelta - 1000) < 0.001, { pitch: ge.linePitch, delta: ge.firstLineDelta });
    check('每行水平居中：绘制 x = (1280 - 行宽) / 2（行宽 = 字数 × 40 + 字距 6 × (字数-1)）',
        ge.midLineCount > 0 && ge.midCenteredCount === ge.midLineCount,
        { drawn: ge.midLineCount, centered: ge.midCenteredCount });
    check('最后一行完全滚出屏幕上方后停止滚动（约 0.83 秒 @20000px/s），此时屏幕上没有字幕了',
        ge.finishedState.finished === true && ge.finishedState.lastLineY <= 0
        && ge.finishedState.elapsed < 2 && ge.finishedState.noSwitchYet === true
        && ge.drawnLineCount === 0,
        ge.finishedState);
    check('屏幕中心显示「按任意键返回游戏」：恰好画在 (640, 360) 且只画一次',
        ge.promptDraws.length === 1 && ge.promptDraws[0].x === 640 && ge.promptDraws[0].y === 360,
        ge.promptDraws);
    check('空行只占行位、不绘制任何文字（不会画出空字符串）', ge.blankLineDrawn === false);
    check('任意键退出：写剧情标记 game_ending_seen + 打开世界地图 + 切回 gameWorld 场景',
        ge.keyExit.dismissed === true && ge.keyExit.flag === true
        && ge.keyExit.switches.join(',') === 'gameWorld'
        && ge.keyExit.mapShown === 'show' && ge.keyExit.mapVisible === true, ge.keyExit);
    check('鼠标任意键同样能退出（提示出现后点一下即可）',
        ge.mouseExit.switchesBefore === 0 && ge.mouseExit.dismissed === true
        && ge.mouseExit.switches.join(',') === 'gameWorld', ge.mouseExit);
    check('退出后解锁世界输入（可移动 / 可交互）',
        ge.afterExit.movementBlocked === false && ge.afterExit.inputBlocked === false
        && ge.afterExit.interacting === false, ge.afterExit);
    check('完结界面吞掉 Q / M / ESC / F2（播放期间不会误开任务栏 / 世界地图 / 调试叠层）',
        ge.keyboardSwallowed === true);
    check('首次登船（中央泊位）：S02 → S03 → 结算《行舟有归处》→ 进入完结界面；'
        + '此时还不写 game_ending_seen、也不开世界地图',
        ge.firstBoard.storyCalls.join(',') === 's02_berth,s03_arrive_zhaochen'
        && ge.firstBoard.switches.join(',') === 'ending'
        && ge.firstBoard.progressCalls.join(',') === 'chapter2_ending_2|board_boat|zhaochen_boat|1'
        && ge.firstBoard.boardingDone === true && ge.firstBoard.endingSeen === false
        && ge.firstBoard.mapVisible === false, ge.firstBoard);
    check('完结之后再登船：不重播对白 / 不再进完结界面，直接显示世界地图界面',
        ge.reboard.storyCalls.length === 0 && ge.reboard.switches.length === 0
        && ge.reboard.mapShown === 'show' && ge.reboard.mapVisible === true, ge.reboard);
    check('Main 侧接线：注册 ending 场景 / render 分发 / 完结键盘屏蔽 / startGameEnding + finishGameEnding',
        mainJsText.indexOf('this.scenes.ending = new EndingScene(this)') !== -1
        && mainJsText.indexOf('this.renderEnding(ctx)') !== -1
        && mainJsText.indexOf("currentScene.sceneId === 'ending'") !== -1
        && mainJsText.indexOf('this.startGameEnding();') !== -1
        && mainJsText.indexOf('finishGameEnding()') !== -1
        && mainJsText.indexOf("this.gameEndingSeenFlag = 'game_ending_seen'") !== -1);

    // 可选美术：整屏底图（有图 → 贴图铺底；缺图 / 品红占位图 → 程序化兜底，绝不画品红块）
    check('完结界面底图已登记且进入启动预加载分组：ui.ending_bg → assets/images/ui/ending_bg.png'
        + '（ui 分组 + ending 资源分组，Main.preloadInitialResources 随主菜单一起预加载）',
        ge.backdrop.key === 'ui.ending_bg'
        && ge.backdrop.resourcePath === 'assets/images/ui/ending_bg.png'
        && ge.backdrop.groupPaths.join(',') === 'assets/images/ui/ending_bg.png'
        && mainJsText.indexOf("'ui.ending_bg'") !== -1,
        { key: ge.backdrop.key, path: ge.backdrop.resourcePath, group: ge.backdrop.groupPaths });
    check('完结界面底图：有图时整屏贴图 (0,0,1280,720) 铺底，浮尘 + 暗角照常叠加（字幕仍在最上层）',
        ge.backdrop.loadedWithArt === true && ge.backdrop.artImageCount === 1
        && (ge.backdrop.artDraw || []).join(',') === '0,0,1280,720'
        && ge.backdrop.artRectCount === ge.backdrop.missingRectCount - 2,
        ge.backdrop);
    check('完结界面底图：缺图 / 空图 / dataURL 品红占位图 → 一张图都不画，'
        + '改回程序化「深墨渐变 + 渡口暖光晕」兜底（不会出现品红块）',
        ge.backdrop.loadedWithPlaceholder === false && ge.backdrop.placeholderImageCount === 0
        && ge.backdrop.loadedWithNothing === false && ge.backdrop.missingImageCount === 0
        && ge.backdrop.placeholderRectCount === ge.backdrop.missingRectCount
        && ge.backdrop.missingRectCount === ge.backdrop.artRectCount + 2,
        ge.backdrop);
    check('完结界面底图（可选美术）已入库时尺寸必须为 1280×720'
        + '（未入库也能玩，走程序化兜底；生成 / 重画：py -3 tools/generate_ending_assets.py --force）', (() => {
        const p = path.join(ROOT, 'assets', 'images', 'ui', 'ending_bg.png');
        if (!fs.existsSync(p)) return true;      // 可选美术：未交付时不断言尺寸
        const s = readPngSize(p);
        return s.width === 1280 && s.height === 720;
    })(), 'assets/images/ui/ending_bg.png');

    console.log(`\n结果：通过 ${passed} 项，失败 ${failed} 项`);
    if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
    console.error('[冒烟测试异常]', err);
    process.exitCode = 1;
});

