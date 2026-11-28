import { useSyncExternalStore } from 'react';

const KEY = 'learn-cert-progress-v1';

export type SelfRating = 'again' | 'mostly' | 'mastered';

export interface QuestionResult {
  correct: boolean;
  choice?: number;
  self?: SelfRating;
}

export interface MockResult {
  at: string;
  autoScore: number;
  answered: number;
  total: number;
}

export interface CertProgress {
  completedLessons: string[];
  results: Record<string, QuestionResult>;
  drafts: Record<string, string>;
  mocks: Record<string, MockResult[]>;
}

const empty = (): CertProgress => ({ completedLessons: [], results: {}, drafts: {}, mocks: {} });

function read(): CertProgress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<CertProgress> | null;
    if (!raw || typeof raw !== 'object') return empty();
    return {
      completedLessons: Array.isArray(raw.completedLessons) ? raw.completedLessons.filter((x) => typeof x === 'string') : [],
      results: raw.results && typeof raw.results === 'object' ? raw.results : {},
      drafts: raw.drafts && typeof raw.drafts === 'object' ? raw.drafts : {},
      mocks: raw.mocks && typeof raw.mocks === 'object' ? raw.mocks : {},
    };
  } catch {
    return empty();
  }
}

let progress = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function update(fn: (p: CertProgress) => void) {
  const next: CertProgress = {
    completedLessons: [...progress.completedLessons],
    results: { ...progress.results },
    drafts: { ...progress.drafts },
    mocks: { ...progress.mocks },
  };
  fn(next);
  progress = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 隐私模式或空间不足时，本次使用仍以内存中的进度为准。
  }
  emit();
}

export function useCertProgress() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => progress,
  );
}

export function toggleLesson(id: string) {
  update((p) => {
    p.completedLessons = p.completedLessons.includes(id)
      ? p.completedLessons.filter((x) => x !== id)
      : [...p.completedLessons, id];
  });
}

export function recordChoice(id: string, choice: number, correct: boolean) {
  update((p) => {
    p.results[id] = { choice, correct };
  });
}

export function recordSelf(id: string, self: SelfRating) {
  update((p) => {
    p.results[id] = { ...p.results[id], correct: self === 'mastered', self };
  });
}

export function saveDraft(id: string, draft: string) {
  update((p) => {
    p.drafts[id] = draft;
  });
}

export function clearDrafts(ids: string[]) {
  update((p) => {
    ids.forEach((id) => {
      delete p.drafts[id];
    });
  });
}

export function recordMock(subjectId: string, result: MockResult) {
  update((p) => {
    p.mocks[subjectId] = [...(p.mocks[subjectId] || []), result].slice(-20);
  });
}

export function resetProgress() {
  progress = empty();
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 删除失败不阻止本次清空。
  }
  emit();
}
