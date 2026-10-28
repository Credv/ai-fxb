/* 全站状态:一个可变对象 + 订阅通知(等价于旧版的全局 state + render())。
 * 板块数据、设置、用量、弹层开关都在这里;组件用 useVersion() 订阅后直接读 state。
 */
import { useSyncExternalStore } from 'react';
import type { ItemBase } from '@ai-fxb/core';
import {
  CACHE_KEY, loadModelsCache, loadSettings, loadUsage,
  persistUsage, PROVIDERS, saveModelsCache, threeEnabledByFlag,
  type Provider, type Settings, type Usage
} from './settings';

export type View = 'sum' | 'news' | 'tech' | 'rank' | 'ops' | 'net';
export type BucketKind = 'news' | 'sum' | 'tech' | 'rank' | 'ops';
export type OpsMode = 'ai' | 'policy' | 'local';
export type BucketStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Bucket {
  status: BucketStatus;
  items: ItemBase[];
  overview?: string;
  generated_at: string;
  fetched_at: number;
  range: number;
  // 静默同步中标记:商机按类型分别同步,所以这里存的是 mode 字符串,其它板块存 true
  syncing: boolean | string;
  newCount: number;
  tabNew: number;
  loadingMode: OpsMode | null;
  loadError: string;
  loadErrorDetail: string;
  loadErrorMode: OpsMode | '';
  error: string;
  errorMeta: string;
  errorDetail: string;
}

export interface Filters {
  newsCat: string; newsRegion: string; newsImp: string;
  opsTime: string; opsTrack: string; opsOrigin: string;
  techTrack: string; rankTrack: string; netRoute: string;
}

export interface SnapshotMeta { ts: number; model: string; at: string }

export interface UiState {
  settingsOpen: boolean;
  genKind: string | null;
  genRange: number;
  genTechRange: number;
  genMode: OpsMode;
  detail: { kind: BucketKind; id: string } | null;
  loadStart: number;
  loadSec: number;
  threeOn: boolean;
}

export interface AppState {
  settings: Settings;
  models: string[];
  view: View;
  newsRange: number;
  sumRange: number;
  techRange: number;
  opsMode: OpsMode;
  news: Bucket;
  ops: Bucket;
  sum: Bucket;
  tech: Bucket;
  rank: Bucket;
  usage: Usage;
  snapshot: SnapshotMeta | null;
  snapshotError: string;
  filters: Filters;
  ui: UiState;
}

export const OPS_MODES: Record<OpsMode, { label: string; origin: string }> = {
  ai: { label: 'AI 赛道商机', origin: '市场商机' },
  policy: { label: '国家政策支持', origin: '政策规划' },
  local: { label: '本地机会', origin: '本地机会' }
};
export const OPS_MODE_ORDER: OpsMode[] = ['ai', 'policy', 'local'];

export const NEWS_CATS = ['全部', '模型发布', '融资并购', '政策监管', '产品应用', '研究突破', '行业动态'];
export const REGIONS = ['全部', '全球', '中国', '美国', '欧洲', '其他'];
export const IMPS = ['全部', '重大', '一般'];
export const OPS_TIMES = ['全部', '本周', '本月'];
export const OPS_ORIGINS = ['全部', '政策规划', '市场商机', '本地机会'];
export const KIND_NAME: Record<BucketKind, string> = {
  news: 'AI 大事件', sum: 'AI 汇总', tech: '前沿技术', rank: '模型排行', ops: '商机雷达'
};

export function blankBucket(): Bucket {
  return {
    status: 'idle', items: [], generated_at: '', fetched_at: 0, range: 0, syncing: false,
    newCount: 0, tabNew: 0, loadingMode: null, loadError: '', loadErrorDetail: '', loadErrorMode: '',
    error: '', errorMeta: '', errorDetail: ''
  };
}

export const state: AppState = {
  settings: loadSettings(),
  models: loadModelsCache(),
  view: 'sum',
  newsRange: 3,
  sumRange: 3,
  techRange: 30,
  opsMode: 'ai',
  news: blankBucket(),
  ops: blankBucket(),
  sum: blankBucket(),
  tech: blankBucket(),
  rank: blankBucket(),
  usage: loadUsage(),
  snapshot: null,
  snapshotError: '',
  filters: {
    newsCat: '全部', newsRegion: '全部', newsImp: '全部',
    opsTime: '全部', opsTrack: '全部', opsOrigin: '全部',
    techTrack: '全部', rankTrack: '全部', netRoute: 'all'
  },
  ui: {
    settingsOpen: false, genKind: null, genRange: 3, genTechRange: 30, genMode: 'ai',
    detail: null, loadStart: 0, loadSec: 0, threeOn: threeEnabledByFlag()
  }
};

let version = 0;
const listeners = new Set<() => void>();

export function notify(): void {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
// 返回自增版本号:任何 notify() 都会让订阅组件重渲染一次(状态是一整块可变对象,不必做浅比较)
export function useVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

export function providerOf(s: Settings = state.settings): Provider {
  const p = PROVIDERS[s.provider];
  if (p) return p;
  const bu = (s.baseUrl || '').replace(/\/+$/, '');
  for (const k of Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]) {
    const cand = PROVIDERS[k];
    if (cand.baseUrl && bu && bu === cand.baseUrl.replace(/\/+$/, '')) return cand;
  }
  return PROVIDERS.custom;
}

export function configured(): boolean {
  const s = state.settings;
  return !s.demo && !!s.apiKey && !!s.baseUrl && !!s.model;
}

export function saveCache(): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      news: state.news, ops: state.ops, sum: state.sum, tech: state.tech, rank: state.rank, snap: state.snapshot
    }));
  } catch { /* 写不进本机缓存不影响本次浏览 */ }
}

export function recordUsage(usage: { total_tokens?: number } | undefined, silent: boolean): void {
  if (!usage || typeof usage.total_tokens !== 'number') return;
  const u = state.usage;
  const t = usage.total_tokens;
  const today = fmtDate(new Date());
  if (u.day !== today) { u.day = today; u.dayTotal = 0; u.daySilent = 0; }
  u.total += t; u.calls += 1; u.dayTotal += t;
  if (silent) { u.silent += t; u.silentCalls += 1; u.daySilent += t; }
  persistUsage(u);
}

// 切到某 tab 即视为已读:清除该板块的 tab 角标(卡片内的 NEW 当日仍保留)
export function markViewed(view: View): void {
  const b = state[view as BucketKind];
  if (!b) return;
  if (b && b.tabNew) { b.tabNew = 0; saveCache(); }
}

// ---------- 时间格式 ----------
function pad(n: number): string { return n < 10 ? '0' + n : '' + n; }
export function fmtDate(d: Date): string { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
export function fmtDateTime(ts: number): string { return fmtDate(new Date(ts)) + ' ' + fmtTime(ts); }
export function todayStr(): string { return fmtDate(new Date()); }

export function anyLoading(): boolean {
  return state.news.status === 'loading' || state.ops.status === 'loading'
    || state.sum.status === 'loading' || state.tech.status === 'loading';
}
export function anySyncing(): boolean {
  return !!(state.news.syncing || state.sum.syncing || state.ops.syncing || state.rank.syncing || state.tech.syncing);
}
export function totalNew(): number {
  return (['news', 'sum', 'ops', 'rank', 'tech'] as BucketKind[])
    .reduce((n, k) => n + state[k].items.filter((it) => it.isNew).length, 0);
}
export function lastFetchTs(): number {
  return Math.max(
    state.news.fetched_at || 0, state.sum.fetched_at || 0, state.ops.fetched_at || 0,
    state.rank.fetched_at || 0, state.tech.fetched_at || 0
  );
}

export function loadCacheIntoState(): void {
  let cache: Record<string, unknown> | null = null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    cache = raw ? JSON.parse(raw) : null;
  } catch { cache = null; }
  if (!cache) return;
  (['news', 'ops', 'sum', 'tech', 'rank'] as BucketKind[]).forEach((k) => {
    const b = cache?.[k] as Bucket | undefined;
    if (b && b.status === 'ready' && Array.isArray(b.items) && b.items.length) state[k] = b;
  });
  const snap = cache.snap as SnapshotMeta | null | undefined;
  if (snap && snap.ts) state.snapshot = snap;
}

export function rememberModels(ids: string[]): void {
  state.models = ids;
  saveModelsCache(ids);
}

// ---------- UI 动作(等价于旧版里散落在 bind() 的那些点击处理) ----------
export function setView(view: View): void {
  state.view = view;
  markViewed(view);
  notify();
}
export function setFilter(group: keyof Filters, val: string): void {
  state.filters[group] = val;
  notify();
}
export function openDetail(kind: BucketKind, id: string): void {
  state.ui.detail = { kind, id };
  notify();
}
export function findItem(kind: BucketKind, id: string): ItemBase | null {
  const items = state[kind].items;
  for (let i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
  return null;
}
export function closeDetail(): void {
  state.ui.detail = null;
  notify();
}
export function openSettings(): void {
  state.ui.settingsOpen = true;
  notify();
}
export function closeSettings(): void {
  state.ui.settingsOpen = false;
  notify();
}
export function openGenModal(kind: string): void {
  state.ui.genKind = kind;
  state.ui.genRange = kind === 'sum' ? state.sumRange : state.newsRange;
  state.ui.genTechRange = state.techRange;
  state.ui.genMode = state.opsMode;
  notify();
}
export function closeGenModal(): void {
  state.ui.genKind = null;
  notify();
}
