// Python 运行环境跑在 Worker 里：学生写出死循环时主线程还能响应，掐掉 Worker 重建即可，
// 整页不会假死。放在 public/ 下按原样发布，不经打包器改写。
/* global loadPyodide, importScripts */

const BASE = '/exam/pyodide/';
let pyodide = null;
let outBuf = [];
let errBuf = [];

async function boot() {
  importScripts(BASE + 'pyodide.js');
  pyodide = await loadPyodide({
    indexURL: BASE,
    stdout: (s) => outBuf.push(s + '\n'),
    stderr: (s) => errBuf.push(s + '\n')
  });
  postMessage({ type: 'ready', python: pyodide.version });
}

// 把输入串做成读数器：逐字符给码点，读完给 undefined，真 Python 在这里会抛 EOFError
function readerOf(text) {
  const s = String(text == null ? '' : text);
  let i = 0;
  return () => (i < s.length ? s.charCodeAt(i++) : undefined);
}

// 把异常里属于运行环境自身的栈帧削掉，只留学生写的那几行对应的部分。
// 不削的话报错里会出现 /lib/python313.zip/_pyodide/_base.py 这种机房里根本不存在的文件名。
function scrubTraceback(text) {
  const lines = String(text).split('\n');
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*File "<exec>", line /.test(lines[i])) last = i;
  }
  if (last < 0) return String(text).trim();
  return ['Traceback (most recent call last):'].concat(lines.slice(last)).join('\n').trim();
}

async function run(msg) {
  outBuf = [];
  errBuf = [];
  pyodide.setStdin({ stdin: readerOf(msg.stdin) });
  let ok = true;
  let thrown = '';
  try {
    await pyodide.runPythonAsync(String(msg.code == null ? '' : msg.code));
  } catch (e) {
    ok = false;
    thrown = scrubTraceback(String((e && e.message) || e));
  }
  const err = [errBuf.join(''), thrown].filter(Boolean).join('\n');
  postMessage({ type: 'done', id: msg.id, ok, out: outBuf.join(''), err });
}

const booted = boot().catch((e) =>
  postMessage({ type: 'boot-error', message: String((e && e.message) || e) })
);

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  if (msg.type !== 'run') return;
  await booted;
  if (pyodide) await run(msg);
};
