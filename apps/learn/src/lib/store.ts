import { useSyncExternalStore } from 'react';
import { fetchEnvelope, GateError, unlock, type Decrypted, type Envelope } from './crypto';
import type { PrivateParts } from './types';

export type Sec = 'catalog' | 'course' | 'student' | 'private';
export type PrivateView = 'prep' | 'students' | 'map' | 'cert';
/** 只描述私密区那一侧的状态:公开课件不经过它,首屏因此完全不碰密文。 */
export type Gate = 'idle' | 'loading' | 'locked' | 'opening' | 'open' | 'error';

export const PRIVATE_VIEWS: { id: PrivateView; ico: string; label: string; hint: string }[] = [
  { id: 'prep', ico: '⚑', label: '试讲准备', hint: '要问清楚的、话术、要带的' },
  { id: 'students', ico: '☗', label: '学生相处', hint: '高中部怎么带' },
  { id: 'map', ico: '▦', label: '知识地图', hint: '任职要求 → 缺口' },
  { id: 'cert', ico: '✎', label: '教师资格证', hint: '笔试面试认定' }
];

const PW_KEY = 'learn-pw-v1';
const OPEN_KEY = 'learn-open-v1';

export const state = {
  sec: 'catalog' as Sec,
  id: '',
  gate: 'idle' as Gate,
  error: '',
  env: null as Envelope | null,
  parts: null as PrivateParts | null,
  open: readOpen()
};

let version = 0;
const listeners = new Set<() => void>();

export function notify() {
  version++;
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useVersion() {
  useSyncExternalStore(subscribe, () => version);
}

function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeOpen() {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify(state.open));
  } catch {
    /* 隐私模式下写不进 localStorage:折叠状态记住就行,记不住不该影响看内容 */
  }
}

export function toggle(key: string, fallback = false) {
  state.open[key] = !(key in state.open ? state.open[key] : fallback);
  writeOpen();
  notify();
}

export function isOpen(key: string, fallback = false) {
  return key in state.open ? state.open[key] : fallback;
}

/** 一组一起开关:章节多的时候,逐个点不是办法。 */
export function setGroup(ids: string[], on: boolean) {
  ids.forEach((id) => {
    state.open[id] = on;
  });
  writeOpen();
  notify();
}

/* ---------------- 路由:四种页面都走 hash,静态托管不用配任何重写 ---------------- */

export function hashFor(sec: Sec, id = '') {
  if (sec === 'course') return '#/c/' + id;
  if (sec === 'student') return '#/s/' + id;
  if (sec === 'private') return '#/private' + (id ? '/' + id : '');
  return '#/';
}

export function parseHash(): { sec: Sec; id: string } {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 'c' && b) return { sec: 'course', id: b };
  if (a === 's' && b) return { sec: 'student', id: b };
  if (a === 'private') {
    const v = PRIVATE_VIEWS.some((x) => x.id === b) ? (b as PrivateView) : 'prep';
    return { sec: 'private', id: v };
  }
  return { sec: 'catalog', id: '' };
}

export function go(sec: Sec, id = '') {
  const h = hashFor(sec, id);
  if (location.hash === h) applyRoute(sec, id);
  else location.hash = h;
}

export function applyRoute(sec: Sec, id: string) {
  state.sec = sec;
  state.id = id;
  notify();
  if (sec === 'private') void ensurePrivate();
}

export function boot() {
  const r = parseHash();
  applyRoute(r.sec, r.id);
}

/* ---------------- 私密区:只有真的走到 #/private 才去取密文 ---------------- */

let fetching = false;

async function ensurePrivate() {
  if (state.gate === 'open' || state.gate === 'opening') return;
  if (state.env) {
    state.gate = state.parts ? 'open' : 'locked';
    notify();
    return;
  }
  if (fetching) return;
  fetching = true;
  state.gate = 'loading';
  state.error = '';
  notify();
  try {
    state.env = await fetchEnvelope();
  } catch (e) {
    state.gate = 'error';
    state.error = e instanceof Error ? e.message : String(e);
    fetching = false;
    notify();
    return;
  }
  fetching = false;
  // 同一标签页刷新不重新问密码:密码只在内存与 sessionStorage 里,关掉标签页就没了。
  const saved = sessionStorage.getItem(PW_KEY);
  if (saved) {
    await enter(saved, false);
    return;
  }
  state.gate = 'locked';
  notify();
}

function partsOf(d: Decrypted): PrivateParts {
  const p = (d.parts || {}) as Record<string, unknown>;
  const need = ['prep', 'students', 'map', 'cert'];
  const missing = need.filter((k) => !p[k]);
  if (missing.length) throw new GateError('私密内容里缺片段:' + missing.join('、') + '。重跑 npm run learn:data 并把生成的 content.json 提交。');
  return p as unknown as PrivateParts;
}

export async function enter(password: string, remember = true): Promise<string> {
  if (!state.env) {
    state.error = '还没拿到加密内容,先刷新一次。';
    notify();
    return state.error;
  }
  state.gate = 'opening';
  state.error = '';
  notify();
  try {
    const d = await unlock(password, state.env);
    state.parts = partsOf(d);
    state.gate = 'open';
    if (remember) sessionStorage.setItem(PW_KEY, password);
    notify();
    return '';
  } catch (e) {
    state.gate = 'locked';
    // 报错写进 store 而不是组件的局部 state:解开失败时锁屏会重新挂载,局部 state 跟着没了,
    // 用户只看得到「什么都没发生」。
    state.error = e instanceof Error ? e.message : String(e);
    notify();
    return state.error;
  }
}

export function leave() {
  sessionStorage.removeItem(PW_KEY);
  state.parts = null;
  state.gate = 'locked';
  state.error = '';
  notify();
}

/** 距离试讲还有几天:日子在加密内容里,天数每次现算,不写死。 */
export function daysLeft(iso: string): number {
  const target = new Date(iso + 'T00:00:00');
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - midnight.getTime()) / 86400000);
}
