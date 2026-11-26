// 判分。单选、判断、网络参数按卷面答案直接对；程序题把考生的代码连同各评分点的输入
// 喂给浏览器里的 Python，比输出。表格题没有可靠的机器判法，只记作答，成绩等人工看截图。
import { isAnswered, type Answer, type Record0 } from './store';
import { runPython } from './python';
import type { IpTask, Paper, PythonTask, Question, SingleChoice } from './types';
import type { SectionKind } from './types';
import { entries, sumKind } from './paper';

/** 单个评分点最多跑这么多时间；一个死循环不能把整卷判分卡住 */
const CHECK_LIMIT_MS = 8000;

export type Point = {
  label: string;
  ok: boolean;
  score: number;
  full: number;
  /** 判分依据，考生看得到：实际输出，或没跑出来的原因 */
  got?: string;
};

export type ItemResult = {
  id: string;
  number: number;
  kind: SectionKind;
  type: Question['type'];
  full: number;
  score: number;
  state: 'right' | 'wrong' | 'partial' | 'pending' | 'blank';
  points: Point[];
};

export type Grade = {
  items: ItemResult[];
  /** 当场判出的分 */
  got: number;
  /** 卷面满分 */
  full: number;
  theory: { got: number; full: number };
  practice: { got: number; full: number };
  /** 等人工复核的分 */
  pending: number;
};

/** 比对输出：行尾空格和末尾空行不算差异，行内空格照原样比 */
function normOut(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
    .trim();
}

/** 比对填写值：不分大小写，多个空格算一个 */
function normText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function choiceResult(q: SingleChoice, ans: Answer | undefined, number: number, kind: SectionKind): ItemResult {
  const pick = ans?.pick ?? -1;
  const right = pick === q.answer;
  return {
    id: q.id,
    number,
    kind,
    type: 'single',
    full: q.score,
    score: right ? q.score : 0,
    state: pick < 0 ? 'blank' : right ? 'right' : 'wrong',
    points: [],
  };
}

function ipResult(q: IpTask, ans: Answer | undefined, number: number, kind: SectionKind): ItemResult {
  const labels = new Map(q.fields.map((f) => [f.key, f.label]));
  const values = ans?.values ?? {};
  let got = 0;
  const points: Point[] = q.answers.map((a) => {
    const mine = values[a.key] ?? '';
    const ok = mine.trim() !== '' && normText(mine) === normText(a.value);
    if (ok) got += a.score;
    return { label: labels.get(a.key) ?? a.key, ok, score: ok ? a.score : 0, full: a.score, got: mine.trim() };
  });
  const touched = points.some((p) => p.got);
  return {
    id: q.id,
    number,
    kind,
    type: 'ip',
    full: q.score,
    score: got,
    state: !touched ? 'blank' : got === q.score ? 'right' : got > 0 ? 'partial' : 'wrong',
    points,
  };
}

async function pythonResult(q: PythonTask, ans: Answer | undefined, number: number, kind: SectionKind): Promise<ItemResult> {
  const code = (ans?.code ?? '').trim();
  const shape = { id: q.id, number, kind, type: 'python' as const, full: q.score, points: [] as Point[] };
  // 没写代码但交了截图的，按待教师评定处理，不能当成 0 分
  if (!code) return { ...shape, score: 0, state: ans?.shots?.length ? 'pending' : 'blank' };
  const checks = q.checks ?? [];
  // 没配评分点的程序题只留作答记录，跑不跑都由人工看
  if (!checks.length) return { ...shape, score: 0, state: 'pending' };

  let got = 0;
  const points: Point[] = [];
  for (const c of checks) {
    const r = await runPython(code, c.stdin, CHECK_LIMIT_MS);
    const want = normOut(c.expect);
    const have = normOut(r.out);
    const ok = r.ok && !r.killed && have === want;
    if (ok) got += c.score;
    points.push({
      label: c.label,
      ok,
      score: ok ? c.score : 0,
      full: c.score,
      got: r.killed ? '运行超过 8 秒已停止' : !r.ok ? r.err || '程序未能运行' : have || '（没有输出）'
    });
  }
  return {
    ...shape,
    score: got,
    state: got === q.score ? 'right' : got > 0 ? 'partial' : 'wrong',
    points
  };
}

function assemble(paper: Paper, items: ItemResult[]): Grade {
  const by = (kind: SectionKind) => items.filter((i) => i.kind === kind);
  const pending = items.filter((i) => i.state === 'pending').reduce((t, i) => t + i.full, 0);
  const theory = { got: by('theory').reduce((t, i) => t + i.score, 0), full: sumKind(paper, 'theory') };
  const practice = { got: by('practice').reduce((t, i) => t + i.score, 0), full: sumKind(paper, 'practice') };
  return { items, got: theory.got + practice.got, full: theory.full + practice.full, theory, practice, pending };
}

/** 判分本身出错时的兜底：不下任何结论，答过的题全留给教师，答卷照样能出——总比卡住交不了卷好 */
export function pendingGrade(paper: Paper, record: Record0): Grade {
  return assemble(
    paper,
    entries(paper).map((e) => ({
      id: e.q.id,
      number: e.number,
      kind: e.kind,
      type: e.q.type,
      full: e.q.score,
      score: 0,
      state: isAnswered(e.q, record.answers[e.q.id]) ? ('pending' as const) : ('blank' as const),
      points: []
    }))
  );
}

/** 判整卷。程序题要现场跑，所以是异步的；环境起不来时程序题按待评处理，不影响理论分出来 */
export async function gradePaper(paper: Paper, record: Record0): Promise<Grade> {
  const items: ItemResult[] = [];
  for (const e of entries(paper)) {
    const ans = record.answers[e.q.id];
    let r: ItemResult;
    if (e.q.type === 'single') r = choiceResult(e.q, ans, e.number, e.kind);
    else if (e.q.type === 'ip') r = ipResult(e.q, ans, e.number, e.kind);
    else if (e.q.type === 'python') r = await pythonResult(e.q, ans, e.number, e.kind);
    else r = { id: e.q.id, number: e.number, kind: e.kind, type: 'sheet', full: e.q.score, score: 0, state: 'pending', points: [] };
    if (r.state === 'pending' && !isAnswered(e.q, ans)) r = { ...r, state: 'blank' };
    items.push(r);
  }
  return assemble(paper, items);
}

