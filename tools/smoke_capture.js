/*
 * 冒烟测试输出抓取器（本机没有独立 node 时的标准跑法之一）
 *
 * 背景：本机（Windows + VS Code）没有独立 node，只能用 VS Code 自带的 Electron 以 node 模式
 *       跑冒烟测试：$env:ELECTRON_RUN_AS_NODE='1'; & 'D:\Microsoft VS Code\Code.exe' tools\smoke_chapter2.js
 *       这种做法下子进程直接写控制台，PowerShell 的 `>` / `$out = ...` 都抓不到输出
 *       （重定向会得到 0 字节文件）。本脚本在进程内 require 冒烟脚本，
 *       把 console.log 拦到内存里、进程退出时一次性落盘，方便比对/存档基线。
 *
 * 用法（第 3 个参数是输出文件，可写相对路径）：
 *   $env:ELECTRON_RUN_AS_NODE='1'
 *   & 'D:\Microsoft VS Code\Code.exe' tools\smoke_capture.js tools\smoke_chapter2.js tools\c2_result.txt
 *   & 'D:\Microsoft VS Code\Code.exe' tools\smoke_capture.js tools\smoke_chapter_end.js tools\ce_result.txt
 *   Get-Content tools\c2_result.txt | Select-String -Pattern '结果：|失败\]'
 *
 * 退出码与冒烟脚本一致（0 = 全通过），便于 CI 直接判断。
 */
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
const outFile = process.argv[3];
const lines = [];
const originalLog = console.log;

console.log = (...args) => {
    lines.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    originalLog(...args);
};
console.error = console.log;

process.on('exit', () => {
    try {
        if (outFile) fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
    } catch (e) {
        originalLog('capture write failed: ' + e.message);
    }
});

if (!target) {
    originalLog('用法：smoke_capture.js <冒烟脚本> [输出文件]');
    process.exit(2);
}

require(path.resolve(target));
