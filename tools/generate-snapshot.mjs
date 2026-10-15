/* 每日快照生成脚本(Node,GitHub Actions 定时调用)
 * 用站长自己的 API Key(环境变量注入,绝不写入仓库)跑一轮四个看板的生成,
 * 与旧 web/data/snapshot.json 合并(保留历史、标记 NEW、最新在前),写回快照文件。
 * 提交推送后 Netlify 自动重新部署,访客无需任何 Key 即可查看。
 *
 * 环境变量:
 *   AIFXB_API_KEY      必填。大模型 API Key(OpenAI 兼容格式,默认千问百炼)。
 *   AIFXB_BASE_URL     默认 https://dashscope.aliyuncs.com/compatible-mode/v1
 *   AIFXB_MODEL        默认 qwen-plus
 *   AIFXB_REGION       本地机会地区,默认 福建省
 *   AIFXB_SEARCH       置 0 关闭 enable_search(默认开启)
 *   AIFXB_TIMEOUT_SEC  单次请求超时秒数,默认 300
 *   AIFXB_SNAPSHOT_FILE 快照输出路径覆盖(仅测试用)
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import https from 'node:https';
import http from 'node:http';

const require = createRequire(import.meta.url);
const core = require('../web/core.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SNAP_FILE = process.env.AIFXB_SNAPSHOT_FILE || join(ROOT, 'web', 'data', 'snapshot.json');

const CFG = {
  apiKey: process.env.AIFXB_API_KEY || '',
  baseUrl: (process.env.AIFXB_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, ''),
  model: process.env.AIFXB_MODEL || 'qwen-plus',
  region: process.env.AIFXB_REGION || '福建省',
  search: process.env.AIFXB_SEARCH !== '0',
  timeoutMs: (parseInt(process.env.AIFXB_TIMEOUT_SEC || '300', 10) || 300) * 1000
};

function postJSON(url, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'http:' ? http : https;
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const req = mod.request(u, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CFG.apiKey,
        'Content-Length': body.length
      },
      timeout: timeoutMs
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('请求超过 ' + Math.round(timeoutMs / 1000) + ' 秒未完成,已中止')));
    req.on('error', reject);
    req.end(body);
  });
}

let totalTokens = 0;
let totalCalls = 0;

async function chat(label, messages) {
  const payload = { model: CFG.model, messages, temperature: 0.4, stream: false };
  if (CFG.search) payload.enable_search = true;
  const r = await postJSON(CFG.baseUrl + '/chat/completions', payload, CFG.timeoutMs);
  if (r.status !== 200) {
    throw new Error(label + ':HTTP ' + r.status + ' · ' + r.text.slice(0, 400));
  }
  let j;
  try { j = JSON.parse(r.text); } catch (e) {
    throw new Error(label + ':返回不是合法 JSON · ' + r.text.slice(0, 300));
  }
  const content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (!content) throw new Error(label + ':API 未返回内容(choices 为空)· ' + r.text.slice(0, 300));
  if (j.usage && typeof j.usage.total_tokens === 'number') { totalTokens += j.usage.total_tokens; }
  totalCalls += 1;
  return content;
}

function loadOld() {
  try { return JSON.parse(readFileSync(SNAP_FILE, 'utf8')); } catch (e) { return null; }
}

// 调用 + 解析 + 归一化;结果为 0 条视为失败(打印原始返回片段便于排查),自动重试一次
async function genBoard(label, messages, normalize) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await chat(label, messages);
    let p;
    try {
      p = normalize(core.extractJSON(raw));
    } catch (e) {
      lastErr = new Error(label + ':返回内容无法解析为 JSON · ' + raw.slice(0, 300));
      console.error('[snapshot] ' + lastErr.message + '(第 ' + attempt + ' 次)');
      continue;
    }
    if (p.items && p.items.length) return p;
    lastErr = new Error(label + ':模型返回了 0 条数据(原始返回前 300 字:' + raw.slice(0, 300) + ')');
    console.error('[snapshot] ' + label + ' 返回 0 条(第 ' + attempt + ' 次),原始返回前 300 字:' + raw.slice(0, 300));
  }
  throw lastErr;
}
const old = loadOld();
function oldBucket(k) {
  return (old && old[k] && Array.isArray(old[k].items)) ? old[k] : null;
}

let failures = [];
async function runJob(name, fn) {
  try {
    const r = await fn();
    console.log('[snapshot] ' + name + ' 完成(累计 ' + totalTokens + ' tokens / ' + totalCalls + ' 次调用)');
    return r;
  } catch (e) {
    failures.push(name);
    console.error('[snapshot] ' + name + ' 失败:' + (e && e.message ? e.message : String(e)));
    return null;
  }
}

const now = Date.now();

if (!CFG.apiKey) {
  console.error('[snapshot] 缺少 API Key:请设置环境变量 AIFXB_API_KEY(GitHub Actions 里为仓库 Secret DASHSCOPE_API_KEY)。');
  process.exit(1);
}

// ---- 四个看板:sum(3天)/ tech(30天)/ news(3天)/ ops(ai+policy+local) ----
const sumRes = await runJob('sum', async () => {
  const p = await genBoard('sum', core.buildSumMessages(3), core.normalizeSum);
  const ob = oldBucket('sum');
  const items = core.mergeBucketItems('sum', ob ? ob.items : [], p.items);
  return { status: 'ready', items, overview: p.overview || (ob && ob.overview) || '', generated_at: p.generated_at, fetched_at: now, range: 3 };
});

const techRes = await runJob('tech', async () => {
  const p = await genBoard('tech', core.buildTechMessages(30), core.normalizeTech);
  const ob = oldBucket('tech');
  const items = core.mergeBucketItems('tech', ob ? ob.items : [], p.items);
  return { status: 'ready', items, generated_at: p.generated_at, fetched_at: now, range: 30 };
});

const newsRes = await runJob('news', async () => {
  const p = await genBoard('news', core.buildNewsMessages(3), core.normalizeNews);
  const ob = oldBucket('news');
  const items = core.mergeBucketItems('news', ob ? ob.items : [], p.items);
  return { status: 'ready', items, generated_at: p.generated_at, fetched_at: now, range: 3 };
});

// ops:三种类型分别生成、按 origin 分组合并(与前端 generateOps 相同规则)
const OPS_JOBS = [
  { mode: 'ai', origin: '市场商机', build: () => core.buildAiOpsMessages() },
  { mode: 'policy', origin: '政策规划', build: () => core.buildPolicyOpsMessages() },
  { mode: 'local', origin: '本地机会', build: () => core.buildLocalOpsMessages(CFG.region) }
];
let opsItems = (oldBucket('ops') && oldBucket('ops').items) || [];
let opsUpdated = false;
for (const j of OPS_JOBS) {
  const r = await runJob('ops-' + j.mode, async () => {
    const p = await genBoard('ops-' + j.mode, j.build(), core.normalizeOps);
    p.items.forEach((it) => {
      it.origin = j.origin;
      if (j.mode === 'ai') { it.level = ''; it.region = ''; it.policy = ''; }
    });
    const same = opsItems.filter((it) => it.origin === j.origin);
    const other = opsItems.filter((it) => it.origin !== j.origin);
    opsItems = core.mergeBucketItems('ops', same, p.items).concat(core.stampExisting('ops', other));
    opsUpdated = true;
    return true;
  });
  if (!r) { /* 单项失败:保留该 origin 旧数据,继续下一项 */ }
}
const oldOps = oldBucket('ops');
const opsRes = opsItems.length
  ? { status: 'ready', items: opsItems, generated_at: core.todayStr(), fetched_at: opsUpdated ? now : ((oldOps && oldOps.fetched_at) || 0), range: 0 }
  : null;

const snap = {
  generated_at: core.todayStr(),
  generated_ts: now,
  model: CFG.model,
  sum: sumRes || oldBucket('sum') || { status: 'idle', items: [] },
  tech: techRes || oldBucket('tech') || { status: 'idle', items: [] },
  news: newsRes || oldBucket('news') || { status: 'idle', items: [] },
  ops: opsRes || oldBucket('ops') || { status: 'idle', items: [] }
};

const produced = [sumRes, techRes, newsRes, opsUpdated ? opsRes : null].filter(Boolean).length;
if (!produced && !old) {
  console.error('[snapshot] 全部生成失败且没有旧快照可保留,不写文件。失败项:' + failures.join(', '));
  process.exit(1);
}

mkdirSync(dirname(SNAP_FILE), { recursive: true });
writeFileSync(SNAP_FILE, JSON.stringify(snap), 'utf8');
console.log('[snapshot] 已写入 ' + SNAP_FILE);
console.log('[snapshot] 本次成功 ' + produced + '/4 个看板' + (failures.length ? ',失败:' + failures.join(', ') : '') +
  ' · 共 ' + totalCalls + ' 次调用,' + totalTokens + ' tokens');
console.log('[snapshot] 条目数:sum=' + snap.sum.items.length + ' tech=' + snap.tech.items.length +
  ' news=' + snap.news.items.length + ' ops=' + snap.ops.items.length);
if (failures.length && !old) process.exit(1);
