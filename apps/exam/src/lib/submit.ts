// 交卷。先按考场实际能落地的方式：把这一份答卷整理成一个可以直接上交的文件，
// 学生用课堂传输软件发给老师；在线提交在能连到时优先走在线，连不上不拦学生交卷。
import type { Grade } from './grade';
import { findQuestion } from './paper';
import type { Answer, Record0, Shot, SubmitMark } from './store';
import type { Paper, Question } from './types';

export const REPORT_VERSION = 'exam-report-1';

/** 在线收卷地址。留空表示本次只走上交文件这条路，页面不会去连不存在的地址 */
export const REPORT_URL = '';

export type SubmitOutcome =
  | { via: 'online'; at: number }
  | { via: 'file'; at: number; fileName: string; bytes: number }
  | { via: 'none'; error: string };

/** 交卷结果写进答卷记录，刷新或换浏览器重开这张卷子时还能告诉学生答卷在哪 */
export function markOf(o: SubmitOutcome): SubmitMark {
  if (o.via === 'file') return { via: 'file', fileName: o.fileName, bytes: o.bytes };
  if (o.via === 'online') return { via: 'online' };
  return { via: 'none', error: o.error };
}

function pad(n: number) {
  return n < 10 ? '0' + n : String(n);
}

export function stamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function clockText(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function durationText(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${pad(m)}:${pad(s)}`;
}

export function fileNameFor(paper: Paper, r: Record0): string {
  const who = [r.className, r.name].filter(Boolean).join('-') || '未填写考生';
  const safe = who.replace(/[\\/:*?"<>|\s]+/g, '');
  return `${paper.name}-答卷-${safe}-${stamp(r.submittedAt ?? Date.now())}.html`;
}

/** 卷面文字里的 ``` 代码段在答卷里排成代码块，缩进不能丢 */
function rich(text: string): string {
  return text
    .split('```')
    .map((part, i) => (i % 2 === 1 ? `<pre class="code">${esc(trimBlock(part))}</pre>` : esc(part)))
    .join('');
}

function trimBlock(s: string): string {
  const ls = s.replace(/\r\n/g, '\n').split('\n');
  while (ls.length && ls[0] === '') ls.shift();
  while (ls.length && ls[ls.length - 1] === '') ls.pop();
  return ls.join('\n');
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

function shotHtml(s: Shot): string {
  if (!s.data) return `<p class="miss">${esc(s.name)} 未能随答卷保存，请另外上交该截图。</p>`;
  return `<figure><img alt="${esc(s.name)}" src="${s.data}" /><figcaption>${esc(s.name)}</figcaption></figure>`;
}

function answerBlock(q: Question, a: Answer | undefined): string {
  if (!a) return '<p class="none">未作答</p>';
  switch (q.type) {
    case 'single':
      return a.pick === undefined || a.pick < 0
        ? '<p class="none">未作答</p>'
        : `<p>选择 ${letter(a.pick)}　${esc(q.options[a.pick] ?? '')}</p>`;
    case 'ip':
      return `<table class="fill"><tr><th>项目</th><th>填写内容</th></tr>${q.fields
        .map((f) => `<tr><td>${esc(f.label)}</td><td>${esc((a.values ?? {})[f.key] ?? '') || '—'}</td></tr>`)
        .join('')}</table>`;
    case 'python':
      return `<pre class="code">${esc(a.code ?? '')}</pre>`;
    case 'sheet':
      return `${a.note ? `<p>${esc(a.note)}</p>` : ''}${(a.shots ?? []).map(shotHtml).join('')}` || '<p class="none">未作答</p>';
  }
}

function letter(i: number): string {
  return String.fromCharCode(65 + i);
}

function scoreLine(state: Grade['items'][number]): string {
  if (state.state === 'pending') return `<span class="pend">待教师评定 ${state.full} 分</span>`;
  if (state.state === 'blank') return '<span class="zero">未作答 0 分</span>';
  const cls = state.state === 'right' ? 'full' : state.state === 'partial' ? 'part' : 'zero';
  return `<span class="${cls}">${state.score} / ${state.full} 分</span>`;
}

/** 答卷正文：考生信息、用时、逐题作答与得分，程序题把评分点的比对一并写进去 */
export function reportBody(paper: Paper, r: Record0, g: Grade): string {
  const rows = g.items
    .map((it) => {
      const q = findQuestion(paper, it.id);
      const pts = it.points.length
        ? `<table class="pts"><tr><th>评分点</th><th>结果</th><th>得分</th></tr>${it.points
            .map(
              (p) =>
                `<tr><td>${esc(p.label)}</td><td class="${p.ok ? 'ok' : 'no'}">${esc(p.got ?? '')}</td><td>${p.score} / ${p.full}</td></tr>`
            )
            .join('')}</table>`
        : '';
      return `<section class="q">
  <h3>第 ${it.number} 题 <i>${esc(q ? typeName(q) : '')}　${it.full} 分</i> ${scoreLine(it)}</h3>
  <div class="stem">${rich(q ? q.stem : '')}</div>
  <div class="ans">${answerBlock(q!, r.answers[it.id])}</div>
  ${pts}
</section>`;
    })
    .join('');

  return `<h1>${esc(paper.name)}</h1>
<p class="sub">${esc(paper.subtitle)}</p>
<table class="who">
  <tr><th>姓名</th><td>${esc(r.name) || '—'}</td><th>班级</th><td>${esc(r.className) || '—'}</td></tr>
  <tr><th>考号</th><td>${esc(r.examNo) || '—'}</td><th>交卷时间</th><td>${clockText(r.submittedAt ?? Date.now())}</td></tr>
  <tr><th>用时</th><td>${durationText(r.elapsed ?? 0)}</td><th>卷面满分</th><td>${g.full} 分</td></tr>
</table>
<p class="sum">系统当场评定 <b>${g.got}</b> 分${g.pending ? `；另有 <b>${g.pending}</b> 分待教师复核。` : '。'}</p>
${rows}
<p class="foot">本答卷记录考生的作答过程与系统比对结果，成绩以教师复核为准。</p>`;
}

export function typeName(q: Question): string {
  return q.type === 'single' ? '单项选择题' : q.type === 'ip' ? '网络参数设置' : q.type === 'python' ? '程序设计' : '电子表格操作';
}

const STYLE = `
body{font:14px/1.7 "Microsoft YaHei",sans-serif;color:#14181f;background:#fff;margin:0;padding:32px 40px;max-width:900px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:26px 0 8px}h3{font-size:15px;margin:0 0 6px;font-weight:600}
.sub{color:#5b6472;margin:0 0 18px}
table{border-collapse:collapse;width:100%;margin:6px 0}
th,td{border:1px solid #c9d1d9;padding:5px 8px;text-align:left;vertical-align:top}
th{background:#f4f6f8;font-weight:600}
.who th{width:64px}.who td{width:auto}
.pts td.ok{color:#0f766e}.pts td.no{color:#a8071a}
.q{border-top:1px solid #dfe3e8;padding:16px 0 6px}
.q i{color:#5b6472;font-style:normal;font-weight:400;margin-left:8px}
.stem{white-space:pre-wrap;color:#2c3340}
.ans{margin:8px 0}
.none{color:#8a929e;margin:0}
.miss{color:#a8071a}
pre.code{background:#f6f8fa;border:1px solid #dfe3e8;border-radius:4px;padding:10px 12px;overflow:auto;font:13px/1.6 Consolas,monospace;white-space:pre-wrap;margin:6px 0}
figure{margin:8px 0}figure img{max-width:100%;border:1px solid #dfe3e8;border-radius:4px}
figcaption{color:#5b6472;font-size:12px;margin-top:4px}
.full{color:#0f766e}.part{color:#8a5a00}.zero{color:#a8071a}.pend{color:#5b6472}
.full,.part,.zero,.pend{margin-left:8px;font-size:13px}
.sum{background:#f4f6f8;border-left:3px solid #0f766e;padding:8px 12px}
.foot{color:#5b6472;border-top:1px solid #dfe3e8;margin-top:24px;padding-top:10px;font-size:12px}
@media print{body{padding:0}}
`;

/** 单文件答卷：截图一并嵌进去，老师收到一个文件就能看完，不需要另外要图 */
export function reportHtml(paper: Paper, r: Record0, g: Grade): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(paper.name)} 答卷 · ${esc(r.name || '未填写考生')}</title>
<style>${STYLE}</style></head><body>
${reportBody(paper, r, g)}
</body></html>`;
}

export function download(name: string, html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob.size;
}

async function tryOnline(paper: Paper, r: Record0, g: Grade): Promise<boolean> {
  if (!REPORT_URL) return false;
  try {
    const res = await fetch(REPORT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ v: REPORT_VERSION, paper: paper.id, record: r, grade: g }),
      signal: AbortSignal.timeout(8000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 交卷落库。在线能到就在线；到不了或没开在线，一律生成交件文件，学生照样交得出。
 * 浏览器存不下才算失败——那种情况必须说清楚，不能假装交上了。
 */
export async function submitPaper(paper: Paper, r: Record0, g: Grade): Promise<SubmitOutcome> {
  const at = r.submittedAt ?? Date.now();
  if (await tryOnline(paper, r, g)) return { via: 'online', at };
  try {
    const html = reportHtml(paper, r, g);
    const name = fileNameFor(paper, r);
    const bytes = download(name, html);
    return { via: 'file', at, fileName: name, bytes };
  } catch (e) {
    return { via: 'none', error: e instanceof Error ? e.message : String(e) };
  }
}
