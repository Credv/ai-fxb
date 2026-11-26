// 卷面数据结构。四份卷子都按这份结构写在 data/papers.ts 里，页面只认结构不认题。
// 分值一律是「分」，理论合计与操作合计由页面现算，卷面上写的合计只作校验用。

export type SectionKind = 'theory' | 'practice';

export type BaseQuestion = {
  id: string;
  score: number;
  /** 考点，出现在成绩页的逐题解析里，例如「sequence: 分支结构」 */
  topic?: string;
};

/** 单选题；answer 是 options 里的下标 */
export type SingleChoice = BaseQuestion & {
  type: 'single';
  stem: string;
  options: string[];
  answer: number;
  explain: string;
};

/** 一组自动核对：给定输入，比对输出。分值合计须等于本题 score */
export type PyCheck = {
  /** 卷面上写的评分点，例如「输入 20，输出闰年」 */
  label: string;
  stdin: string;
  /** 逐字符比对前会去掉每行行尾空格与末尾空行 */
  expect: string;
  score: number;
};

/** Python 程序题。内置 Python 环境可直接运行；无内置环境时按题面在本地完成并截图 */
export type PythonTask = BaseQuestion & {
  type: 'python';
  stem: string;
  /** 程序要求，逐条列在代码框上方 */
  requirements?: string[];
  /** 给出的起始代码，学生在此基础上改 */
  starter?: string;
  /** 需要随卷下发的数据文件，例如程序要读取的 csv */
  assets?: Asset[];
  /** 有这些评分点就当场判分；没有就只记作答，成绩等你人工看 */
  checks?: PyCheck[];
  /** 参考答案，成绩页在解析之后给出 */
  answer?: string;
  explain: string;
};

/** 电子表格操作题。素材下载后在表格软件里完成，成果以截图留痕 */
export type SheetTask = BaseQuestion & {
  type: 'sheet';
  stem: string;
  /** 操作步骤，逐条列出，学生照着做 */
  steps: string[];
  assets: Asset[];
  /** 该操作完成后应得到的结果，写清楚数值，便于核对 */
  expected?: string;
  explain: string;
};

export type Asset = {
  /** 相对 exam 资产目录的文件名 */
  file: string;
  label: string;
  /** 素材在表格软件里应该看到的样子，一句话 */
  note?: string;
};

/** 网络设置题：给出同办公室已配好的机器参数，考生填出本机四项。填值可当场判分 */
export type IpTask = BaseQuestion & {
  type: 'ip';
  stem: string;
  /** 已配好的机器，作为推断依据，按表格印在题面上 */
  given: { name: string; ip: string; mask: string; gateway: string; dns: string }[];
  /** 待填的四个框，顺序即卷面顺序 */
  fields: { key: string; label: string }[];
  /** 每个框的正确答案与分值 */
  answers: { key: string; value: string; score: number }[];
  explain: string;
};

export type Question = SingleChoice | PythonTask | SheetTask | IpTask;

export type Section = {
  id: string;
  /** 卷面大写号次，例如「第一部分 基础理论」 */
  name: string;
  kind: SectionKind;
  /** 这一部分的作答说明，印在部分标题下方 */
  instruction: string;
  questions: Question[];
};

export type Paper = {
  id: string;
  /** 卷名，例如「模拟试卷（一）」 */
  name: string;
  /** 副标题，说明对口的考试与用途 */
  subtitle: string;
  /** 建议时长，分钟 */
  minutes: number;
  /** 卷面满分 */
  fullMark: number;
  /** 考生须知，逐条印在开考前 */
  notice: string[];
  sections: Section[];
  /** 命题依据说明：题目来自哪里、按什么规格编，公开写在卷首 */
  source: string;
};

export function sectionScore(s: Section): number {
  return s.questions.reduce((t, q) => t + q.score, 0);
}

export function paperScore(p: Paper): { theory: number; practice: number; total: number } {
  let theory = 0;
  let practice = 0;
  for (const s of p.sections) {
    const v = sectionScore(s);
    if (s.kind === 'theory') theory += v;
    else practice += v;
  }
  return { theory, practice, total: theory + practice };
}
