// 主线程这边只管三件事：等环境就绪、把代码发进 Worker、超时就把 Worker 掐掉重建。
// 环境文件全部来自本站 /exam/pyodide/，不依赖任何第三方 CDN。

export type RunResult = {
  ok: boolean;
  out: string;
  err: string;
  ms: number;
  killed?: boolean;
};

export type EnvState = 'idle' | 'loading' | 'ready' | 'failed';

const WORKER_URL = '/exam/py-worker.js';
const BOOT_TIMEOUT_MS = 90_000;
const DEFAULT_RUN_TIMEOUT_MS = 10_000;

let worker: Worker | null = null;
let state: EnvState = 'idle';
let pythonVersion = '';
let bootError = '';
let seq = 0;
const listeners = new Set<(s: EnvState) => void>();

function setState(next: EnvState) {
  state = next;
  listeners.forEach((fn) => fn(state));
}

export function onEnvChange(fn: (s: EnvState) => void) {
  listeners.add(fn);
  fn(state);
  return () => {
    listeners.delete(fn);
  };
}

export function envState() {
  return state;
}
export function envVersion() {
  return pythonVersion;
}
export function envError() {
  return bootError;
}

function spawn(): Worker {
  const w = new Worker(WORKER_URL);
  w.onmessage = (ev) => {
    const m = ev.data || {};
    if (m.type === 'ready') {
      pythonVersion = m.python || '';
      setState('ready');
    } else if (m.type === 'boot-error') {
      bootError = m.message || '运行环境未能启动';
      setState('failed');
    }
  };
  w.onerror = (e) => {
    bootError = e.message || '运行环境未能启动';
    setState('failed');
  };
  return w;
}

export function ensureEnv(): Promise<void> {
  if (state === 'ready') return Promise.resolve();
  if (worker) return waitReady();
  setState('loading');
  worker = spawn();
  return waitReady();
}

function waitReady(): Promise<void> {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    const poll = () => {
      if (state === 'ready') return res();
      if (state === 'failed') return rej(new Error(bootError));
      if (Date.now() - t0 > BOOT_TIMEOUT_MS) return rej(new Error('运行环境加载超时'));
      setTimeout(poll, 120);
    };
    poll();
  });
}

function rebuild() {
  if (worker) worker.terminate();
  worker = null;
  setState('idle');
}

// Worker 里的输入缓冲和输出缓冲是共用的，两次运行同时在跑会互相读到对方的输入，
// 所以这里的运行一律排队，一次只让一段代码进 Worker。
type RunJob = {
  code: string;
  stdin: string;
  timeoutMs: number;
  t0: number;
  resolve: (r: RunResult) => void;
};

const queue: RunJob[] = [];
let draining = false;

export function runPython(code: string, stdin = '', timeoutMs = DEFAULT_RUN_TIMEOUT_MS): Promise<RunResult> {
  return new Promise<RunResult>((resolve) => {
    queue.push({ code, stdin, timeoutMs, t0: performance.now(), resolve });
    void drain();
  });
}

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    await exec(queue.shift() as RunJob);
  }
  draining = false;
}

async function exec(job: RunJob) {
  try {
    await ensureEnv();
  } catch (e) {
    return job.resolve({
      ok: false,
      out: '',
      err: '运行环境尚未就绪：' + ((e as Error).message || String(e)),
      ms: Math.round(performance.now() - job.t0)
    });
  }
  const w = worker as Worker;
  const id = ++seq;
  await new Promise<void>((resolve) => {
    let settled = false;
    let timer = 0;
    const finish = (r: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      w.removeEventListener('message', onMsg);
      job.resolve(r);
      resolve();
    };
    timer = setTimeout(() => {
      rebuild();
      finish({
        ok: false,
        out: '',
        err: '程序运行超过 ' + Math.round(job.timeoutMs / 1000) + ' 秒已停止。请检查是否有不会结束的循环。',
        ms: Math.round(performance.now() - job.t0),
        killed: true
      });
    }, job.timeoutMs);

    function onMsg(ev: MessageEvent) {
      const m = ev.data || {};
      if (m.type !== 'done' || m.id !== id) return;
      finish({ ok: !!m.ok, out: m.out || '', err: m.err || '', ms: Math.round(performance.now() - job.t0) });
    }

    w.addEventListener('message', onMsg);
    w.postMessage({ type: 'run', id, code: job.code, stdin: job.stdin });
  });
}
