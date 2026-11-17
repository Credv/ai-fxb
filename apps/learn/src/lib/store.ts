import { useSyncExternalStore } from 'react';
import { fetchEnvelope, GateError, unlock, type Decrypted, type Envelope } from './crypto';
import type { Parts } from './types';

export type View = 'trial' | 'students' | 'map' | 'cert';
export type Status = 'booting' | 'locked' | 'opening' | 'open' | 'error';

export const VIEWS: { id: View; ico: string; label: string; hint: string }[] = [
  { id: 'trial', ico: '⚑', label: '试讲突击', hint: '11.20 那一节课' },
  { id: 'students', ico: '☗', label: '学生相处', hint: '高中部怎么带' },
  { id: 'map', ico: '▦', label: '知识地图', hint: '任职要求 → 缺口' },
  { id: 'cert', ico: '✎', label: '教师资格证', hint: '笔试面试认定' }
];

const PW_KEY = 'learn-pw-v1';
const OPEN_KEY = 'learn-open-v1';

export const state = {
  status: 'booting' as Status,
  error: '',
  env: null as Envelope | null,
  parts: null as Parts | null,
  view: 'trial' as View,
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

export function setView(v: View) {
  state.view = v;
  location.hash = '#' + v;
  notify();
}

function viewFromHash(): View {
  const h = location.hash.replace('#', '');
  return VIEWS.some((v) => v.id === h) ? (h as View) : 'trial';
}

function partsOf(d: Decrypted): Parts {
  const p = d.parts || {};
  const need = ['trial', 'python', 'students', 'map', 'cert'];
  const missing = need.filter((k) => !p[k]);
  if (missing.length) throw new GateError('内容里缺片段:' + missing.join('、') + '。重跑 npm run learn:data 并把生成的 content.json 提交。');
  return p as unknown as Parts;
}

/** 启动:拿密文信封。密文本身不含任何可读信息,所以这一步在锁屏前也能做。 */
export async function boot() {
  try {
    state.env = await fetchEnvelope();
    state.status = 'locked';
  } catch (e) {
    state.status = 'error';
    state.error = e instanceof Error ? e.message : String(e);
  }
  state.view = viewFromHash();
  notify();
  // 同一标签页刷新不重新问密码:密码只在内存与 sessionStorage 里,关掉标签页就没了。
  const saved = sessionStorage.getItem(PW_KEY);
  if (saved && state.env) await enter(saved, false);
}

export async function enter(password: string, remember = true): Promise<string> {
  if (!state.env) return '还没有拿到加密内容,先刷新一次。';
  state.status = 'opening';
  state.error = '';
  notify();
  try {
    const d = await unlock(password, state.env);
    state.parts = partsOf(d);
    state.status = 'open';
    if (remember) sessionStorage.setItem(PW_KEY, password);
    notify();
    return '';
  } catch (e) {
    state.status = 'locked';
    const msg = e instanceof Error ? e.message : String(e);
    notify();
    return msg;
  }
}

export function leave() {
  sessionStorage.removeItem(PW_KEY);
  state.parts = null;
  state.status = 'locked';
  notify();
}

/** 距离试讲还有几天:日子写在内容里,天数每次现算,不写死。 */
export function daysLeft(iso: string): number {
  const target = new Date(iso + 'T00:00:00');
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - midnight.getTime()) / 86400000);
}
