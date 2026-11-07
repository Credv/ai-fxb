/* 快照清理脚本(Node,零 token):删除已写入快照里的占位条目(「XX待核实」这类空壳)。
 * 与 generate-snapshot.mjs 用同一份判定规则(core.isPlaceholderItem),不联网、不调模型。
 *
 *   node tools/purge-placeholder.mjs            就地改写快照文件
 *   node tools/purge-placeholder.mjs --check    只报告,发现占位条目时退出码 1
 *
 * 环境变量:AIFXB_SNAPSHOT_FILE 快照路径覆盖(默认 apps/console/public/data/snapshot.json)
 */
import * as core from '@ai-fxb/core';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAP_FILE = process.env.AIFXB_SNAPSHOT_FILE || join(__dirname, '..', 'apps', 'console', 'public', 'data', 'snapshot.json');

const checkOnly = process.argv.includes('--check');

let snap;
try {
  snap = JSON.parse(readFileSync(SNAP_FILE, 'utf8'));
} catch (e) {
  console.error('[purge] 读不到快照 JSON:' + SNAP_FILE + ' · ' + (e && e.message ? e.message : String(e)));
  process.exit(2);
}

const BOARDS = ['sum', 'tech', 'news', 'rank', 'ops'];
let totalDropped = 0;
BOARDS.forEach((k) => {
  const b = snap[k];
  if (!b || !Array.isArray(b.items)) return;
  const dropped = core.countPlaceholders(b.items);
  totalDropped += dropped;
  if (!dropped) { console.log('[purge] ' + k + ' 无占位条目(' + b.items.length + ' 条)'); return; }
  if (!checkOnly) {
    b.items = core.dropPlaceholders(b.items);
    if (!b.items.length) b.status = 'idle';
  }
  console.log('[purge] ' + k + (checkOnly ? ' 有 ' : ' 丢弃 ') + dropped + ' 条,剩 ' + b.items.length + ' 条');
});

if (checkOnly) {
  console.log('[purge] --check:' + (totalDropped ? '发现 ' + totalDropped + ' 条占位条目' : '干净,无占位条目'));
  process.exit(totalDropped ? 1 : 0);
}
if (!totalDropped) {
  console.log('[purge] 没有需要清理的条目,文件未改动。');
  process.exit(0);
}

writeFileSync(SNAP_FILE, JSON.stringify(snap), 'utf8');
console.log('[purge] 已丢弃 ' + totalDropped + ' 条占位条目并重写 ' + SNAP_FILE);
