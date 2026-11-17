import raw from '../../content/courseware.json';
import type { Chapter, Courseware, Lesson } from './types';

export const COURSEWARE = raw as unknown as Courseware;

export const LESSONS: Lesson[] = COURSEWARE.chapters.flatMap((c) => c.lessons);

export function findLesson(id?: string): Lesson | null {
  return LESSONS.find((l) => l.id === id) || null;
}

export function chapterOf(lessonId?: string): Chapter | null {
  return COURSEWARE.chapters.find((c) => c.lessons.some((l) => l.id === lessonId)) || null;
}

/** 章节目录顶上那三个数:全部现算,不写死,加一课就自己变。 */
export function stats() {
  return [
    { label: '章节', value: String(COURSEWARE.chapters.length) },
    { label: '已备课件', value: String(LESSONS.length) },
    { label: '可拖参数的实验', value: String(LESSONS.reduce((n, l) => n + l.py.lab.length, 0)) }
  ];
}
