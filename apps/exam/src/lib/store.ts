// 作答状态：每份卷子一条记录，边答边写本地存储。
// 交卷前刷新、断网、误关标签页都应当回到原处，这是考场里最常见的事故。
import type { Paper, Question } from './types';

export const STORE_VERSION = 'exam-ans-v1';

export type Shot = { name: string; data: string; kb: number };

export type Answer = {
  /** 单选：选项下标，未作答为空 */
  pick?: number;
  /** 程序题在代码框里写的程序 */
  code?: string;
  shots?: Shot[];
  note?: string;
  /** 网络参数题的每一项、程序题每一个空填的内容，都按名字存这里 */
  values?: Record<string, string>;
};

/** 交卷这一步实际走到了哪里，学生刷新后也要能知道自己那份该去哪里找 */
export type SubmitMark = {
  via: 'online' | 'file' | 'none';
  fileName?: string;
  bytes?: number;
  error?: string;
};

export type Record0 = {
  paper: string;
  name: string;
  className: string;
  examNo: string;
  answers: Record<string, Answer>;
  /** 开始作答的时刻；0 表示尚未开考 */
  startedAt: number;
  /** 交卷时刻，未交卷为空 */
  submittedAt?: number;
  /** 用时秒数 */
  elapsed?: number;
  submit?: SubmitMark;
};

function keyFor(paperId: string) {
  return STORE_VERSION + ':' + paperId;
}

export function blankRecord(paperId: string): Record0 {
  // startedAt 为 0 表示还没开考，计时从考生按下「开始作答」那一刻算
  return { paper: paperId, name: '', className: '', examNo: '', answers: {}, startedAt: 0 };
}

export function loadRecord(paperId: string): Record0 | null {
  try {
    const raw = localStorage.getItem(keyFor(paperId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Record0;
    if (!v || typeof v !== 'object' || v.paper !== paperId) return null;
    if (!v.answers || typeof v.answers !== 'object') v.answers = {};
    return v;
  } catch {
    return null;
  }
}

export function saveRecord(r: Record0): boolean {
  try {
    localStorage.setItem(keyFor(r.paper), JSON.stringify(r));
    return true;
  } catch {
    // 存满时不再塞图片，改存文字，宁可少留痕也不要整份丢掉
    try {
      const lean: Record0 = {
        ...r,
        answers: Object.fromEntries(
          Object.entries(r.answers).map(([k, a]) => [k, { ...a, shots: (a.shots || []).map((s) => ({ ...s, data: '', name: s.name + '（本机存储已满，请在交卷前下载答卷文件）' })) }])
        )
      };
      localStorage.setItem(keyFor(r.paper), JSON.stringify(lean));
      return false;
    } catch {
      return false;
    }
  }
}

export function clearRecord(paperId: string) {
  localStorage.removeItem(keyFor(paperId));
  localStorage.removeItem(gradeKey(paperId));
}

/**
 * 重考这张卷：作答、计时、成绩全部清掉，考生信息留着——模拟卷本来就是拿来反复做的，
 * 让学生把姓名班级考号再敲一遍没有意义。
 */
export function restartRecord(r: Record0): Record0 {
  const fresh: Record0 = {
    paper: r.paper,
    name: r.name,
    className: r.className,
    examNo: r.examNo,
    answers: {},
    startedAt: 0
  };
  localStorage.removeItem(gradeKey(r.paper));
  saveRecord(fresh);
  return fresh;
}

/**
 * 判分结果单独存一份。成绩页刷新时直接读，不再重跑一遍程序题——
 * 重跑要等解释器起来，教室里网络慢的时候成绩页会白屏几秒。
 */
function gradeKey(paperId: string) {
  return STORE_VERSION + ':grade:' + paperId;
}

export function saveGrade(paperId: string, g: unknown): boolean {
  try {
    localStorage.setItem(gradeKey(paperId), JSON.stringify(g));
    return true;
  } catch {
    return false;
  }
}

export function loadGrade<T>(paperId: string): T | null {
  try {
    const raw = localStorage.getItem(gradeKey(paperId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function answeredCount(paper: Paper, answers: Record<string, Answer>): number {
  let n = 0;
  for (const s of paper.sections) {
    for (const q of s.questions) if (isAnswered(q, answers[q.id])) n++;
  }
  return n;
}

export function totalQuestions(paper: Paper): number {
  return paper.sections.reduce((t, s) => t + s.questions.length, 0);
}

export function isAnswered(q: Question, a?: Answer): boolean {
  if (!a) return false;
  if (q.type === 'single') return typeof a.pick === 'number' && a.pick >= 0;
  if (q.type === 'python') {
    const filled = (q.blanks ?? []).some((_, i) => ((a.values ?? {})[blankKey(i)] ?? '').trim() !== '');
    return filled || !!(a.code && a.code.trim()) || !!(a.shots && a.shots.length);
  }
  if (q.type === 'ip') return !!(a.values && q.fields.some((f) => (a.values![f.key] || '').trim()));
  if (q.type === 'sheet') return !!(a.shots && a.shots.length) || !!(a.note && a.note.trim());
  return false;
}

/** 程序题每一空在作答记录里的键名，按卷面顺序编号 */
export function blankKey(i: number): string {
  return 'b' + i;
}

/** 截图压到最长边 1400 像素再存，教室屏幕原图是 PNG，原样存几条就把本地空间用光 */
export function shrinkImage(file: File, maxSide = 1400, quality = 0.72): Promise<Shot> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext('2d');
        if (!ctx) throw new Error('本机不支持图片处理');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const data = cv.toDataURL('image/jpeg', quality);
        resolve({ name: file.name, data, kb: Math.round(data.length * 0.75 / 1024) });
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('这张图片读不出来'));
    };
    img.src = url;
  });
}
