export type QuestionType = 'single' | 'judge' | 'material' | 'short' | 'writing' | 'case' | 'design';

export interface StudyPoint {
  title: string;
  detail: string;
}

export interface StudyChapter {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  points: StudyPoint[];
  questionIds: string[];
}

export interface SingleQuestion {
  id: string;
  chapterId: string;
  type: 'single';
  stem: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface OpenQuestion {
  id: string;
  chapterId: string;
  type: Exclude<QuestionType, 'single'>;
  stem: string;
  reference: string;
  rubric: string[];
}

export type ExamQuestion = SingleQuestion | OpenQuestion;

export interface ExamFormat {
  type: QuestionType;
  label: string;
  count: number;
  points: number;
}

export interface ExamSubject {
  id: string;
  no: string;
  name: string;
  code: string;
  minutes: number;
  total: number;
  pass: string;
  summary: string;
  strategy: string[];
  format: ExamFormat[];
  chapters: StudyChapter[];
  questions: ExamQuestion[];
  mockIds: string[];
}

export interface Cert {
  lead: string;
  target: string;
  scheduleNote: string;
  plan: { stage: string; weeks: string; focus: string; tasks: string[] }[];
  sources: { label: string; url: string }[];
  faq: { q: string; a: string }[];
  subjects: ExamSubject[];
}

export interface PrivateParts {
  cert: Cert;
}
