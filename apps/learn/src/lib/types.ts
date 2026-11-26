export type Level = 'have' | 'rusty' | 'gap';

/* 这一半全在加密区(content/private/),浏览器里要靠密码才解得开。
   公开课件那半已经拆掉,类型只剩这四页要用的。 */

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
