/* 每日快照生成脚本(Node,GitHub Actions 定时调用)
 * 用站长自己的 API Key(环境变量注入,绝不写入仓库)跑一轮四个看板的生成(sum/tech/news/ops),
 * 模型排行(rank)不经过大模型:直接抓取 Artificial Analysis 公开榜单的每日镜像,真实分数、零 token。
 * 与上一份快照合并(保留历史、标记 NEW、最新在前),写回 apps/console/public/data/snapshot.json。
 * 提交推送后 Cloudflare Pages 自动重新部署,访客无需任何 Key 即可查看(路由 /ai-fxb/)。
 *
 * 环境变量:
 *   AIFXB_API_KEY      必填。大模型 API Key(OpenAI 兼容格式,默认千问百炼)。
 *   AIFXB_BASE_URL     默认 https://dashscope.aliyuncs.com/compatible-mode/v1
 *   AIFXB_MODEL        默认 qwen3.8-flash
 *   AIFXB_REGION       本地机会地区,默认 福建省
 *   AIFXB_SEARCH       置 0 关闭 enable_search(默认开启)
 *   AIFXB_TIMEOUT_SEC  单次请求超时秒数,默认 300
 *   AIFXB_SNAPSHOT_FILE 快照输出路径覆盖(仅测试用)
 */
import * as core from '@ai-fxb/core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import https from 'node:https';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SNAP_FILE = process.env.AIFXB_SNAPSHOT_FILE || join(ROOT, 'apps', 'console', 'public', 'data', 'snapshot.json');

const CFG = {
  apiKey: process.env.AIFXB_API_KEY || '',
  baseUrl: (process.env.AIFXB_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, ''),
  model: process.env.AIFXB_MODEL || 'qwen3.8-flash',
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

// ---- 模型排行:抓取 Artificial Analysis 公开榜单的每日镜像(真实数据,不调大模型、不耗 token) ----
const AA_MIRROR = process.env.AIFXB_RANK_MIRROR || 'https://raw.githubusercontent.com/EvanZhouDev/ai-model-index/main/data';
const AA_SITE_URL = 'https://artificialanalysis.ai/';
const RANK_TRACK_DEFS = [
  { track: '综合总榜', file: 'llm/aa-intelligence.json', metric: '智能指数' },
  { track: '逻辑推理', file: 'llm/gpqa.json', metric: 'GPQA Diamond' },
  { track: '代码编程', file: 'llm/aa-coding.json', metric: '代码指数' },
  { track: '视频生成', file: 'text-to-video/elo.json', metric: 'Elo' },
  { track: '图像生成', file: 'text-to-image/elo.json', metric: 'Elo' },
  { track: '语音多模态', file: 'text-to-speech/elo.json', metric: 'Elo' }
];
function getJSON(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'http:' ? http : https;
    const req = mod.get(u, { headers: { 'User-Agent': 'ai-fxb-snapshot/1.0', 'Accept': 'application/json' }, timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
        res.resume();
        return resolve(getJSON(new URL(res.headers.location, u).toString(), timeoutMs));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error('返回不是合法 JSON')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', reject);
  });
}
function fmtScore(metric, v) {
  if (typeof v !== 'number') return String(v || '');
  if (metric === 'GPQA Diamond' && v <= 1) return (v * 100).toFixed(1) + '%';
  return String(v);
}
async function fetchTrackBoard(d) {
  const j = await getJSON(AA_MIRROR + '/' + d.file, 30000);
  const date = String(j.generated_at || '').slice(0, 10);
  const seen = Object.create(null);
  const items = [];
  (Array.isArray(j.models) ? j.models : []).forEach((m) => {
    if (items.length >= 5) return;
    const base = String(m.name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!base || seen[base]) return;
    seen[base] = 1;
    const score = fmtScore(d.metric, m.score);
    const rank = items.length + 1;
    items.push({
      title: base, vendor: String(m.creator || ''), rank, track: d.track, score,
      note: 'Artificial Analysis ' + d.metric + ' 得分 ' + score,
      detail: '排名依据:Artificial Analysis(独立第三方评测平台)' + d.metric + ' 榜第 ' + rank + ' 名,数据日期 ' + date + ',模型由 ' + (m.creator || '未知') + ' 提供。边界提示:该榜基于固定题库或竞技场对战统计,对特定任务可能有偏差,选型建议以实测为准。',
      source: 'Artificial Analysis · ' + d.metric, url: AA_SITE_URL, date
    });
  });
  if (!items.length) throw new Error('榜单为空');
  return { track: d.track, date, items };
}
async function fetchRankReal() {
  const results = await Promise.all(RANK_TRACK_DEFS.map((d) =>
    (async () => {
      let last = null;
      for (let i = 0; i < 3; i++) {
        try { return await fetchTrackBoard(d); }
        catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500)); }
      }
      throw last;
    })().catch((e) => {
      console.error('[snapshot] rank/' + d.track + ' 抓取失败:' + (e && e.message ? e.message : String(e)));
      return null;
    })
  ));
  const ok = results.filter(Boolean);
  if (ok.length < 4) throw new Error('排行镜像 ' + ok.length + '/' + RANK_TRACK_DEFS.length + ' 个榜单抓取成功,不足 4 个,保留旧数据');
  const items = [];
  RANK_TRACK_DEFS.forEach((d) => {
    const r = results[RANK_TRACK_DEFS.indexOf(d)];
    if (r) r.items.forEach((it) => items.push(it));
  });
  const overall = results[RANK_TRACK_DEFS.findIndex((d) => d.track === '综合总榜')];
  const top1 = overall && overall.items[0];
  const overview = '六大榜单抓取自独立第三方评测 Artificial Analysis 的公开数据(镜像每日同步,数据日期 ' + (ok[0].date || '') + ')。' +
    (top1 ? '当前综合总榜第一:' + top1.title + '(' + top1.vendor + ',' + top1.score + ')。' : '');
  return { generated_at: core.todayStr(), overview, items };
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

// ---- 五个看板:sum(3天)/ tech(30天)/ news(3天)/ rank(整榜替换)/ ops(ai+policy+local) ----
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

// 排行:整榜替换;数据来自 Artificial Analysis 真实榜单镜像(不经大模型)
const rankRes = await runJob('rank', async () => {
  const p = await fetchRankReal();
  const items = core.stampExisting('rank', p.items);
  return { status: 'ready', items, overview: p.overview, generated_at: p.generated_at, fetched_at: now, range: 0 };
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
  rank: rankRes || oldBucket('rank') || { status: 'idle', items: [] },
  ops: opsRes || oldBucket('ops') || { status: 'idle', items: [] }
};

const produced = [sumRes, techRes, newsRes, rankRes, opsUpdated ? opsRes : null].filter(Boolean).length;
if (!produced && !old) {
  console.error('[snapshot] 全部生成失败且没有旧快照可保留,不写文件。失败项:' + failures.join(', '));
  process.exit(1);
}

mkdirSync(dirname(SNAP_FILE), { recursive: true });
writeFileSync(SNAP_FILE, JSON.stringify(snap), 'utf8');
console.log('[snapshot] 已写入 ' + SNAP_FILE);
console.log('[snapshot] 本次成功 ' + produced + '/5 个看板' + (failures.length ? ',失败:' + failures.join(', ') : '') +
  ' · 共 ' + totalCalls + ' 次调用,' + totalTokens + ' tokens');
console.log('[snapshot] 条目数:sum=' + snap.sum.items.length + ' tech=' + snap.tech.items.length +
  ' news=' + snap.news.items.length + ' rank=' + snap.rank.items.length + ' ops=' + snap.ops.items.length);
if (failures.length && !old) process.exit(1);
