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
    { label: '一共几章', value: String(COURSEWARE.chapters.length) },
    { label: '备好了几课', value: String(LESSONS.length) },
    { label: '能动手拖的实验', value: String(LESSONS.reduce((n, l) => n + l.py.lab.length, 0)) }
  ];
}

/** 导航那一行放不下整课标题:优先用数据里写好的 short,没有就取破折号前面那半句。 */
export function shortTitle(l: Lesson): string {
  return l.short || l.title.split(/[——(（]/)[0].trim() || l.title;
}

/** 上一课 / 下一课按 LESSONS 的顺序走(也就是上课的顺序),不按 id 字母序。 */
export function neighbors(id?: string): { prev: Lesson | null; next: Lesson | null } {
  const i = LESSONS.findIndex((l) => l.id === id);
  return {
    prev: i > 0 ? LESSONS[i - 1] : null,
    next: i >= 0 && i < LESSONS.length - 1 ? LESSONS[i + 1] : null
  };
}
