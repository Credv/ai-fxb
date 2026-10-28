/* 生成动作:五个板块各一次独立请求(单次更小、更容易在超时内跑通)。
 * 每次都做:静默/手动区分 → 调 API → 归一化 → 与本机历史合并(保留 firstSeen、标 NEW) → 写本机缓存。
 */
import {
  buildNewsMessages, buildOpsMessages, buildRankMessages, buildSumMessages, buildTechMessages,
  countNew, extractJSON, mergeBucketItems, normalizeNews, normalizeOps, normalizeRank,
  normalizeSum, normalizeTech, stampExisting, type ItemBase, type Message, type OpsItem
} from '@ai-fxb/core';
import { callAPI } from './api';
import { demoData } from './demo';
import { ADMIT } from './settings';
import {
  configured, fmtDate, notify, OPS_MODES, saveCache, state, todayStr,
  type Bucket, type BucketKind, type OpsMode
} from './store';

export interface GenOpts { silent?: boolean }

interface Parsed { generated_at: string; overview?: string; items: ItemBase[] }

function clearErrors(b: Bucket): void {
  b.error = ''; b.errorMeta = ''; b.errorDetail = '';
  b.loadError = ''; b.loadErrorDetail = '';
}

function failBucket(b: Bucket, err: unknown): void {
  const e = err as { message?: string; meta?: string; detail?: string };
  b.status = 'error';
  b.error = (e && e.message) || String(err);
  b.errorMeta = (e && e.meta) || '';
  b.errorDetail = (e && e.detail) || '';
}

// 未配置 Key 就点生成:把原因说清,并把「设置」打开(仅管理面)
function guardConfig(b: Bucket): void {
  b.status = 'error';
  b.error = !ADMIT
    ? '访客模式:当前展示站长每日更新的公开快照,不提供实时生成。'
    : (state.snapshot
      ? '当前浏览的是站长每日更新的公开快照;如需自己实时生成,请在「设置」配置你自己的 API Key。'
      : '还没有配置大模型 API。请先在「设置」里填写 Base URL、API Key 和模型。');
  b.errorMeta = ''; b.errorDetail = '';
  notify();
  if (ADMIT) state.ui.settingsOpen = true;
}

function isStale(b: Bucket): boolean {
  if (!b.fetched_at) return true;
  return fmtDate(new Date(b.fetched_at)) !== todayStr();
}

function startLoading(b: Bucket, silent: boolean, hasItems: boolean): void {
  if (silent && hasItems) b.syncing = true;
  else {
    b.status = 'loading'; b.syncing = false;
    state.ui.loadStart = Date.now(); state.ui.loadSec = 0;
  }
  clearErrors(b);
}

// 排行是"整榜替换"而不是与历史合并:名次每天都可能变,留着旧名次会同时出现两个 #1
function applyResult(kind: BucketKind, b: Bucket, p: Parsed): void {
  const prevIds: Record<string, number> = {};
  b.items.forEach((it) => { if (it && it.id) prevIds[it.id] = 1; });
  let items: ItemBase[];
  if (kind === 'rank') {
    items = stampExisting('rank', p.items);
    items.forEach((it) => { it.isNew = !(it.id && prevIds[it.id]); });
    b.overview = p.overview || '';
  } else {
    items = mergeBucketItems(kind, b.items, p.items);
    if (kind === 'sum') b.overview = p.overview || b.overview || '';
  }
  b.items = items;
  b.status = 'ready'; b.syncing = false;
  b.generated_at = p.generated_at; b.fetched_at = Date.now();
  b.newCount = countNew(items); b.tabNew = countNew(items);
  b.loadError = ''; b.loadErrorDetail = ''; b.loadErrorMode = '';
  saveCache();
}

function runOnce(kind: BucketKind, messages: Message[], opts: GenOpts, parse: (text: string) => Parsed): void {
  const b = state[kind];
  const hasItems = !!(b.items && b.items.length);
  const silent = !!opts.silent;
  startLoading(b, silent, hasItems);
  notify();
  callAPI(messages, { silent })
    .then((content) => { applyResult(kind, b, parse(content)); notify(); })
    .catch((err: unknown) => {
      b.syncing = false;
      const e = err as { message?: string; detail?: string };
      if (hasItems) { b.loadError = (e && e.message) || String(err); b.loadErrorDetail = (e && e.detail) || ''; }
      else failBucket(b, err);
      notify();
    });
}

// 生成前的三道闸:演示模式直接载入示例;没配 Key 就把原因说清(静默请求两者都跳过)
function prepare(kind: BucketKind, opts: GenOpts, b: Bucket): boolean {
  if (state.settings.demo) { if (!opts.silent) loadDemoBucket(kind); return false; }
  if (!configured()) { if (!opts.silent) guardConfig(b); return false; }
  return true;
}

export function generateNews(opts: GenOpts = {}): void {
  const b = state.news;
  if (b.status === 'loading' || b.syncing) return;
  if (!prepare('news', opts, b)) { notify(); return; }
  b.range = state.newsRange;
  runOnce('news', buildNewsMessages(state.newsRange), opts, (t) => normalizeNews(extractJSON(t)));
}

export function generateSum(opts: GenOpts = {}): void {
  const b = state.sum;
  if (b.status === 'loading' || b.syncing) return;
  if (!prepare('sum', opts, b)) { notify(); return; }
  b.range = state.sumRange;
  runOnce('sum', buildSumMessages(state.sumRange), opts, (t) => normalizeSum(extractJSON(t)));
}

export function generateTech(opts: GenOpts = {}): void {
  const b = state.tech;
  if (b.status === 'loading' || b.syncing) return;
  if (!prepare('tech', opts, b)) { notify(); return; }
  b.range = state.techRange;
  runOnce('tech', buildTechMessages(state.techRange), opts, (t) => normalizeTech(extractJSON(t)));
}

export function generateRank(opts: GenOpts = {}): void {
  const b = state.rank;
  if (b.status === 'loading' || b.syncing) return;
  if (!prepare('rank', opts, b)) { notify(); return; }
  runOnce('rank', buildRankMessages(), opts, (t) => normalizeRank(extractJSON(t)));
}

// 商机三类分开生成:只替换同类 origin 的条目,其它类别的结果保留在同一份列表里融合展示
export function generateOps(opts: GenOpts = {}): void {
  const b = state.ops;
  if (b.loadingMode || b.status === 'loading' || b.syncing) return;
  if (!prepare('ops', opts, b)) { notify(); return; }
  const mode: OpsMode = state.opsMode === 'policy' ? 'policy' : (state.opsMode === 'local' ? 'local' : 'ai');
  const genOrigin = OPS_MODES[mode].origin;
  const hasItems = !!(b.items && b.items.length);
  const silent = !!opts.silent;
  if (silent && hasItems) b.syncing = mode;
  else {
    b.loadingMode = mode;
    if (!hasItems) { b.status = 'loading'; state.ui.loadStart = Date.now(); state.ui.loadSec = 0; }
  }
  clearErrors(b);
  b.loadErrorMode = '';
  notify();
  callAPI(buildOpsMessages(mode, state.settings.region), { silent })
    .then((content) => {
      const p = normalizeOps(extractJSON(content));
      p.items.forEach((it) => {
        it.origin = genOrigin;
        if (mode === 'ai') { it.level = ''; it.region = ''; it.policy = ''; }
      });
      const prev = b.items as OpsItem[];
      const oldSame = prev.filter((it) => it.origin === genOrigin);
      const oldOther = prev.filter((it) => it.origin !== genOrigin);
      const mergedSame = mergeBucketItems('ops', oldSame, p.items);
      b.items = mergedSame.concat(stampExisting('ops', oldOther));
      b.status = 'ready'; b.generated_at = p.generated_at; b.fetched_at = Date.now(); b.range = 0;
      b.loadingMode = null; b.syncing = false;
      b.loadError = ''; b.loadErrorDetail = ''; b.loadErrorMode = '';
      b.newCount = countNew(b.items); b.tabNew = countNew(b.items);
      saveCache();
      notify();
    })
    .catch((err: unknown) => {
      b.loadingMode = null; b.syncing = false;
      const e = err as { message?: string; detail?: string };
      if (hasItems) {
        b.loadError = (e && e.message) || String(err);
        b.loadErrorDetail = (e && e.detail) || '';
        b.loadErrorMode = mode;
      } else failBucket(b, err);
      notify();
    });
}

// ---------- 演示模式:载入内置示例 ----------
function demoBucket<T extends ItemBase>(kind: BucketKind, items: T[], range: number): Bucket {
  return {
    status: 'ready', items: stampExisting(kind, items), generated_at: fmtDate(new Date()),
    fetched_at: Date.now(), range, syncing: false, newCount: 0, tabNew: 0, loadingMode: null,
    loadError: '', loadErrorDetail: '', loadErrorMode: '', error: '', errorMeta: '', errorDetail: ''
  };
}

export function loadDemoBucket(kind: BucketKind): void {
  const d = demoData();
  if (kind === 'news') state.news = demoBucket('news', d.news, state.newsRange);
  else if (kind === 'ops') state.ops = demoBucket('ops', d.opportunities, 0);
  else if (kind === 'sum') state.sum = { ...demoBucket('sum', d.highlights, state.sumRange), overview: d.overview };
  else if (kind === 'tech') state.tech = demoBucket('tech', d.tech, state.techRange);
  else state.rank = { ...demoBucket('rank', d.ranks, 0), overview: d.rankOverview };
  notify();
}

export function loadAllDemo(): void {
  (['news', 'ops', 'sum', 'tech', 'rank'] as BucketKind[]).forEach(loadDemoBucket);
}

// 打开页面时的静默同步:仅当"今天还没同步过"才调用,避免重复消耗 token
export function syncStale(): void {
  if (state.settings.demo || !configured() || !state.settings.autoSync) return;
  if (isStale(state.sum)) generateSum({ silent: true });
  if (isStale(state.tech)) generateTech({ silent: true });
  if (isStale(state.rank)) generateRank({ silent: true });
  if (isStale(state.news)) generateNews({ silent: true });
  if (isStale(state.ops)) generateOps({ silent: true });
}
