export type Level = 'have' | 'rusty' | 'gap';

export interface LessonFlow {
  min: string;
  stage: string;
  do: string[];
  say?: string;
}

export interface Trial {
  lesson: string;
  textbook: string;
  school: string;
  date: string;
  minutes: number;
  verify: { t: string; d: string }[];
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
  script: { scene: string; lines: string[] }[];
  ask: { q: string; a: string; note?: string }[];
  risk: { r: string; fix: string }[];
  pack: string[];
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

export interface Python {
  note: string;
  compare: { head: string[]; rows: string[][] };
  anatomy: { spec: string; title: string; why: string; tokens: SpecToken[] }[];
  grid: { title: string; code: string; note: string; cols: string[]; rows: Cell[][] }[];
  stages: { title: string; desc: string; list: { name: string; data: string; hint: string }[] }[];
  lab: { title: string; intro: string; sep: string; fields: LabField[] }[];
  drills: { title: string; code: string; guess: string; out: string; note: string }[];
  trap: { text: string; w: number; note: string }[];
  cheats: { k: string; v: string }[];
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

export interface Parts {
  trial: Trial;
  python: Python;
  students: Students;
  map: KnowledgeMap;
  cert: Cert;
}
