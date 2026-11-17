export type Level = 'have' | 'rusty' | 'gap';

export interface LessonFlow {
  min: string;
  stage: string;
  do: string[];
  say?: string;
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

/** 一节课的可交互图解部分:学生版只渲染这一块,所以里面的文字必须学生也能看。 */
export interface PyBlock {
  note: string;
  compare: { head: string[]; rows: string[][] };
  anatomy: { spec: string; title: string; why: string; tokens: SpecToken[] }[];
  grid: { title: string; code: string; note: string; head: Cell[]; rows: Cell[][] }[];
  stages: { title: string; desc: string; list: { name: string; data: string; hint: string }[] }[];
  lab: { title: string; intro: string; sep: string; fields: LabField[] }[];
  drills: { title: string; code: string; guess: string; out: string; note: string }[];
  trap: { text: string; w: number; note: string }[];
  cheats: { k: string; v: string }[];
}

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  textbook: string;
  summary: string;
  plan: {
    standard: string;
    learners: string;
    goals: { dim: string; t: string }[];
    key: string[];
    hard: string[];
    flow: LessonFlow[];
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
