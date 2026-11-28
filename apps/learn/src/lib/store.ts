import { useSyncExternalStore } from 'react';
import { fetchEnvelope, GateError, unlock, type Decrypted, type Envelope } from './crypto';
import type { Cert, PrivateParts } from './types';

export type PrivateView = 'cert';

export const PRIVATE_VIEWS: { id: PrivateView; ico: string; label: string; hint: string }[] = [
  { id: 'cert', ico: '✎', label: '教资备考', hint: '三科笔试学习与练习' }
];

const PW_KEY = 'learn-pw-v1';
const OPEN_KEY = 'learn-open-v1';

export type Gate = 'idle' | 'loading' | 'locked' | 'opening' | 'open' | 'error';

export const state = {
  view: 'cert' as PrivateView,
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
  return key in state.open ? key in state.open ? state.open[key] : fallback : fallback;
}

/** 一组一起开关:条目多的时候,逐个点不是办法。 */
export function setGroup(ids: string[], on: boolean) {
  ids.forEach((id) => {
    state.open[id] = on;
  });
  writeOpen();
  notify();
}

/* ---------------- 路由:全走 hash,静态托管不用配任何重写 ---------------- */

export function hashFor(view: PrivateView) {
  return '#/' + view;
}

/** 课件时代的 #/c/<课件号>、学生版的 #/s/<课件号> 都发出去过,不能留死链:
 *  遇到就直接落到备课台的默认那一页。 */
function isLegacyCoursewareHash(): boolean {
  return /^#\/[cs]\//.test(location.hash);
}

export function parseHash(): PrivateView {
  const seg = location.hash.replace(/^#\/?/, '').split('/');
  const want = seg[0] === 'private' ? seg[1] : seg[0];
  return PRIVATE_VIEWS.some((v) => v.id === want) ? (want as PrivateView) : 'cert';
}

export function go(view: PrivateView) {
  const h = hashFor(view);
  if (location.hash === h) applyRoute(view);
  else location.hash = h;
}

export function applyRoute(view: PrivateView) {
  state.view = view;
  notify();
}

export function boot() {
  if (isLegacyCoursewareHash()) {
    location.replace('/learn/');
    return;
  }
  applyRoute(parseHash());
  void ensurePrivate();
}

/* ---------------- 密文与解锁 ---------------- */

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
  const need = ['cert'];
  const missing = need.filter((k) => !p[k]);
  if (missing.length) throw new GateError('私密内容里缺片段:' + missing.join('、') + '。重跑 npm run learn:data 并把生成的 content.json 提交。');
  const cert = p.cert as Partial<Cert>;
  if (!Array.isArray(cert.subjects) || cert.subjects.length !== 3) {
    throw new GateError('教资内容还是旧版。请在本机运行 npm run learn:data 重新生成 content.json，并把新密文一起提交。');
  }
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
