import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'apps/learn/content/private/cert.json');
let cert;
try {
  cert = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  console.error('cert.json 无法解析：' + String(error));
  process.exit(1);
}

const expected = {
  quality: { code: '301', counts: { single: 29, material: 3, writing: 1 }, chapters: 8 },
  pedagogy: { code: '302', counts: { single: 21, judge: 4, short: 4, material: 2 }, chapters: 8 },
  it: { code: '415', counts: { single: 15, short: 3, case: 2, design: 1 }, chapters: 10 }
};
const errors = [];
const check = (ok, message) => { if (!ok) errors.push(message); };
const questionIds = new Set();
const chapterIds = new Set();

check(Array.isArray(cert.subjects) && cert.subjects.length === 3, '必须有三科');
for (const [id, rule] of Object.entries(expected)) {
  const s = cert.subjects.find((x) => x.id === id);
  check(Boolean(s), `缺科目 ${id}`);
  if (!s) continue;
  check(s.code === rule.code, `${id} 代码应为 ${rule.code}`);
  check(s.chapters.length === rule.chapters, `${id} 章节数应为 ${rule.chapters}`);
  check(s.minutes === 120 && s.total === 150, `${id} 必须为120分钟、150分`);
  check(Array.isArray(s.strategy) && s.strategy.length === 3, `${id} 应有三条策略`);
  check(s.summary.trim().length > 30, `${id} summary 过短`);
  const counts = {};
  for (const q of s.questions) {
    check(!questionIds.has(q.id), `题目 ID 重复：${q.id}`);
    questionIds.add(q.id);
    counts[q.type] = (counts[q.type] || 0) + 1;
    const chapter = s.chapters.find((c) => c.id === q.chapterId);
    check(Boolean(chapter), `${q.id} 的 chapterId 不存在`);
    check(chapter?.questionIds.includes(q.id), `${q.id} 未挂到所属章节`);
    check(q.stem.trim().length >= 12, `${q.id} 题干过短`);
    check(s.format.some((f) => f.type === q.type), `${q.id} 题型未在 format 中声明`);
    if (q.type === 'single') {
      check(q.options.length === 4 && q.options.every((x) => typeof x === 'string' && x.trim()), `${q.id} 必须有四个选项`);
      check(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, `${q.id} 答案下标非法`);
      check(q.explain.trim().length >= 35, `${q.id} 解析过短`);
    } else {
      check(q.reference.trim().length >= 80, `${q.id} 参考答案过短`);
      check(Array.isArray(q.rubric) && q.rubric.length >= 3 && q.rubric.every((x) => x.trim()), `${q.id} 评分点不足`);
      const points = s.format.find((f) => f.type === q.type)?.points;
      check(points !== undefined, `${q.id} 题型未在 format 中声明`);
    }
  }
  for (const [type, count] of Object.entries(rule.counts)) {
    check(counts[type] === count, `${id} ${type} 应为 ${count} 题，实际 ${counts[type] || 0}`);
    const format = s.format.find((f) => f.type === type);
    check(format?.count === count, `${id} ${type} format.count 错误`);
  }
  check(s.questions.length === s.mockIds.length, `${id} mockIds 数量与题库不一致`);
  check(new Set(s.mockIds).size === s.mockIds.length, `${id} mockIds 有重复`);
  const subjectQuestionIds = new Set(s.questions.map((q) => q.id));
  check(s.mockIds.every((qid) => subjectQuestionIds.has(qid)), `${id} mockIds 引用了不存在或别科题目`);
  check(s.format.reduce((n, f) => n + f.count, 0) === s.questions.length, `${id} format 题量与题库不一致`);
  check(s.format.reduce((n, f) => n + f.count * f.points, 0) === s.total, `${id} format 总分不等于150`);
  const linked = s.chapters.flatMap((c) => c.questionIds);
  check(linked.length === s.questions.length && new Set(linked).size === linked.length, `${id} 章节题目引用不完整或有重复`);
  check(linked.every((qid) => subjectQuestionIds.has(qid)), `${id} 章节引用了不存在或别科题目`);
  for (const c of s.chapters) {
    check(!chapterIds.has(c.id), `章节 ID 重复：${c.id}`);
    chapterIds.add(c.id);
    check(c.minutes > 0 && c.summary.trim().length > 20, `${c.id} 章节简介或时长不足`);
    check(c.points.length >= 3 && c.points.every((p) => p.title.trim() && p.detail.trim().length >= 35), `${c.id} 讲义要点不足`);
  }
}

const writing = cert.subjects.find((s) => s.id === 'quality')?.questions.find((q) => q.type === 'writing');
check(Boolean(writing && /不少于\s*1000/.test(writing.stem)), '301 写作题干应明确不少于1000字');
check(Boolean(writing && (writing.reference.match(/[\u3400-\u9fff]/g) || []).length >= 1200), '301 写作参考答案应含不少于1000字范文');
check(Array.isArray(cert.plan) && cert.plan.length === 4, '冲刺计划应有四阶段');
check(cert.scheduleNote.includes('未公布') && cert.scheduleNote.includes('2027'), '必须提示2027日期未公布');
check(cert.sources.length >= 5 && cert.sources.every((s) => s.label && /^https:\/\//.test(s.url)), '官方来源不足或链接非法');

if (errors.length) {
  console.error(`校验失败，共 ${errors.length} 项：`);
  errors.forEach((x) => console.error(' - ' + x));
  process.exit(1);
}
const summary = cert.subjects.map((s) => `${s.code} ${s.chapters.length}章/${s.questions.length}题/${s.chapters.reduce((n, c) => n + c.minutes, 0)}分钟`);
console.log(`校验通过：${summary.join('；')}；共${questionIds.size}题、${chapterIds.size}章。`);
