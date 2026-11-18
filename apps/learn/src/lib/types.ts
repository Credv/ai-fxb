export type Level = 'have' | 'rusty' | 'gap';

export interface LessonFlow {
  min: string;
  stage: string;
  do: string[];
  say?: string;
}

/** 讲台脚本:一拍一条,时间从 0 一路接到 minutes,中间不许留空。
 *  cue 是你要做的事(投影/板书/走位/等谁答),say 是照着念出口的话。
 *  back 是学生可能的答法,以及那一种答法出来以后你怎么接 —— 一次课只会走到其中一条,不是全都要说。
 *  note 是应变:这一拍冷场了怎么办、时间不够先砍哪、哪些事先要问清楚。 */
export interface ScriptBack {
  /** 学生那边会出现什么(答对/答错/报错原文/卡住的样子) */
  s: string;
  /** 你接的那一句 */
  you: string;
}

export interface ScriptBeat {
  /** 「课前」或 0–1 这样的分钟区间 */
  min: string;
  stage?: string;
  cue: string;
  say: string[];
  back?: ScriptBack[];
  note?: string;
}

/** 教材对照:这一课挂在书的哪一节、书里已经讲到哪、哪部分是这一课自己补的。
 *  只写查得到的 —— 节名照书抄,页码没在原文里核到就不写。 */
export interface TextbookRef {
  edition: string;
  book: string;
  pub: string;
  isbn: string;
  issued: string;
  pages?: string;
  editor?: string;
  /** 从章到节,照教材自己的编号排 */
  at: { no: string; title: string; note?: string }[];
  before: string;
  beyond: string;
  links: { t: string; u: string; note?: string }[];
}

export interface SpecToken {
  t: string;
  label: string;
  desc: string;
  hot?: boolean;
}

export interface Cell {
  text: string;
  w: number;
  align: 'l' | 'r' | 'c';
  kind?: 'lit' | 'val' | 'pad';
}

export interface LabField {
  key: string;
  label: string;
  type: 'text' | 'num';
  value: string;
  w: number;
  align: 'l' | 'r' | 'c';
  prec: number;
  min?: number;
  max?: number;
}

/** 一节课的可交互图解部分:学生版只渲染这一块,所以里面的文字必须学生也能看。
 *  nav 是右侧快速导航用的短名;没写就从 title 截。 */
export interface PyBlock {
  note: string;
  compare: { head: string[]; rows: string[][] };
  anatomy: { spec: string; title: string; nav?: string; why: string; look?: string; tokens: SpecToken[] }[];
  grid: { title: string; nav?: string; code: string; note: string; look?: string; head: Cell[]; rows: Cell[][] }[];
  stages: { title: string; nav?: string; desc: string; look?: string; list: { name: string; data: string; hint: string }[] }[];
  lab: { title: string; nav?: string; intro: string; look?: string; sep: string; fields: LabField[] }[];
  drills: { title: string; code: string; guess: string; out: string; note: string }[];
  trap: { text: string; w: number; note: string; look?: string }[];
  cheats: { k: string; v: string }[];
}

/** 这一页怎么读:三步 + 符号图例 + 名词翻成大白话。缺任何一项都不影响渲染。 */
export interface ReadGuide {
  steps: { t: string; d: string }[];
  legend: { sym: string; means: string }[];
  terms: { t: string; say: string }[];
}

export interface Lesson {
  id: string;
  title: string;
  /** 导航那一行用的短标题;没写就从 title 里取破折号前那半句。 */
  short?: string;
  minutes: number;
  textbook: string;
  summary: string;
  guide?: ReadGuide;
  plan: {
    standard: string;
    textbookRef?: TextbookRef;
    learners: string;
    goals: { dim: string; t: string }[];
    key: string[];
    hard: string[];
    flow: LessonFlow[];
    script?: ScriptBeat[];
    board: string;
    homework: { t: string; d: string }[];
  };
  ask: { q: string; a: string; note?: string }[];
  py: PyBlock;
}

export interface Chapter {
  id: string;
  no: string;
  title: string;
  lead: string;
  /** 这一章对应教材里的哪几节;查不到对应章就留空,不硬凑 */
  textbook?: string;
  lessons: Lesson[];
}

/** 公开课件:直接 import 进 bundle,不加密 —— 它本来就要发给其他老师和学生。 */
export interface Courseware {
  course: string;
  basis: string;
  chapters: Chapter[];
}

/* ---- 以下都在加密区(content/private/),浏览器里要靠密码才解得开 ---- */

export interface Prep {
  subject: string;
  school: string;
  date: string;
  lesson: string;
  minutes: number;
  verify: { t: string; d: string }[];
  script: { scene: string; lines: string[] }[];
  risk: { r: string; fix: string }[];
  pack: string[];
}

export interface Students {
  lead: string;
  rules: { t: string; d: string[] }[];
  scenes: { s: string; under: string; say: string; after: string }[];
  no: string[];
  firstWeek: { day: string; t: string }[];
  talk: { k: string; v: string }[];
}

export interface MapItem {
  t: string;
  level: Level;
  d: string;
  fix: string;
}

export interface KnowledgeMap {
  note: string;
  ask: string[];
  jd: { req: string; where: string; mine: Level; gap: string; how: string }[];
  chapters: { no: string; title: string; summary: string; items: MapItem[] }[];
}

export interface Cert {
  lead: string;
  route: string;
  calendar: { when: string; what: string; st: 'past' | 'next' | 'later' }[];
  papers: { no: string; name: string; score: string; focus: string[]; how: string }[];
  interview: { stage: string; min: string; do: string }[];
  after: string[];
  faq: { q: string; a: string }[];
}

export interface PrivateParts {
  prep: Prep;
  students: Students;
  map: KnowledgeMap;
  cert: Cert;
}
