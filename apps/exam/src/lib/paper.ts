// 卷面的公共读法。题号、查题、题量都在这里现算，卷面文件里不写死编号，
// 增删题目时不会出现两张卷子的第 17 题对不上的情况。
import type { Paper, Question, Section, SectionKind } from './types';

export type Entry = {
  q: Question;
  number: number;
  kind: SectionKind;
  section: Section;
};

export function entries(paper: Paper): Entry[] {
  const out: Entry[] = [];
  let n = 0;
  for (const section of paper.sections) {
    for (const q of section.questions) out.push({ q, number: ++n, kind: section.kind, section });
  }
  return out;
}

export function findQuestion(paper: Paper, id: string): Question | undefined {
  for (const s of paper.sections) {
    const q = s.questions.find((x) => x.id === id);
    if (q) return q;
  }
  return undefined;
}

export function paperCounts(paper: Paper): { theory: number; practice: number; total: number } {
  let theory = 0;
  let practice = 0;
  for (const s of paper.sections) {
    if (s.kind === 'theory') theory += s.questions.length;
    else practice += s.questions.length;
  }
  return { theory, practice, total: theory + practice };
}

export function sumKind(paper: Paper, kind: SectionKind): number {
  return paper.sections
    .filter((s) => s.kind === kind)
    .reduce((t, s) => t + s.questions.reduce((x, q) => x + q.score, 0), 0);
}
