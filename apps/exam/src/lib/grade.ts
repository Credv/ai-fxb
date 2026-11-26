// 判分。单选、判断、网络参数按卷面答案直接对；程序题的读程序写结果与程序填空，按卷面
// 标准答案逐空对；整题编写和表格操作题没有可靠的机器判法，只记作答，成绩等人工看截图。
import { isAnswered, blankKey, type Answer, type Record0 } from './store';
import type { IpTask, Paper, PythonTask, Question, SingleChoice } from './types';
import type { SectionKind } from './types';
import { entries, sumKind } from './paper';

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

/** 一个空里的作答与标准答案是否一致：行尾空格与末尾空行不算差异；代码空再把空格与缩进深浅一并忽略 */
function sameBlank(mine: string, want: string, code: boolean): boolean {
  const fold = (s: string) => {
    const t = s
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/, ''))
      .join('\n')
      .replace(/\n+$/, '')
      .trim();
    return code ? t.replace(/[ \t]+/g, '') : t;
  };
  return fold(mine) === fold(want);
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

function pythonResult(q: PythonTask, ans: Answer | undefined, number: number, kind: SectionKind): ItemResult {
  const shape = { id: q.id, number, kind, type: 'python' as const, full: q.score, points: [] as Point[] };
  const blanks = q.blanks ?? [];
  const values = ans?.values ?? {};
  // 没有空的整题编写：写了程序或交了截图的都留给教师评定，不能当成 0 分
  if (!blanks.length) {
    const done = !!((ans?.code ?? '').trim() || (ans?.shots && ans.shots.length));
    return { ...shape, score: 0, state: done ? 'pending' : 'blank' };
  }

  let got = 0;
  const points: Point[] = blanks.map((b, i) => {
    const mine = (values[blankKey(i)] ?? '').trim();
    const ok = mine !== '' && [b.answer, ...(b.alts ?? [])].some((w) => sameBlank(mine, w, !!b.code));
    if (ok) got += b.score;
    return { label: b.label, ok, score: ok ? b.score : 0, full: b.score, got: mine };
  });
  const touched = points.some((p) => p.got);
  return {
    ...shape,
    points,
    score: got,
    state: !touched ? 'blank' : got === q.score ? 'right' : got > 0 ? 'partial' : 'wrong'
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

/** 判整卷。全部按卷面标准答案比对，交卷当场就能出分；编写题与表格题记为待教师评定 */
export async function gradePaper(paper: Paper, record: Record0): Promise<Grade> {
  const items: ItemResult[] = [];
  for (const e of entries(paper)) {
    const ans = record.answers[e.q.id];
    let r: ItemResult;
    if (e.q.type === 'single') r = choiceResult(e.q, ans, e.number, e.kind);
    else if (e.q.type === 'ip') r = ipResult(e.q, ans, e.number, e.kind);
    else if (e.q.type === 'python') r = pythonResult(e.q, ans, e.number, e.kind);
    else r = { id: e.q.id, number: e.number, kind: e.kind, type: 'sheet', full: e.q.score, score: 0, state: 'pending', points: [] };
    if (r.state === 'pending' && !isAnswered(e.q, ans)) r = { ...r, state: 'blank' };
    items.push(r);
  }
  return assemble(paper, items);
}

