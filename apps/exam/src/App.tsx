import { useCallback, useEffect, useRef, useState } from 'react';
import { PAPERS } from './data/papers';
import { gradePaper, pendingGrade, type Grade } from './lib/grade';
import { blankRecord, loadGrade, loadRecord, restartRecord, saveGrade, saveRecord, type Answer, type Record0 } from './lib/store';
import { markOf, submitPaper } from './lib/submit';
import type { Paper } from './lib/types';
import CoverView from './views/Cover';
import ExamView from './views/Exam';
import ListView from './views/List';
import PrintView from './views/Print';
import ResultView from './views/Result';

export type Route =
  | { view: 'list' }
  | { view: 'cover' | 'exam' | 'result'; paper: Paper }
  | { view: 'print'; paper: Paper | null; paperId: string };

/** 站点挂在 /exam/ 子路径下，服务器不会把未知路径送回 index.html，所以路由一律走 # */
function parse(hash: string): Route {
  const printing = /^#\/print(?:\/([^/]+))?$/.exec(hash);
  if (printing) {
    const paperId = printing[1] ?? '';
    return { view: 'print', paperId, paper: paperId ? PAPERS.find((p) => p.id === paperId) ?? null : null };
  }

  const m = /^#\/(cover|exam|result)\/([\w-]+)$/.exec(hash);
  if (m) {
    const paper = PAPERS.find((p) => p.id === m[2]);
    if (paper) return { view: m[1] as 'cover' | 'exam' | 'result', paper };
  }
  return { view: 'list' };
}

export function go(view: string) {
  location.hash = view;
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  const [rec, setRec] = useState<Record0 | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const submitting = useRef(false);
  const onPaper = useRef('');

  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // 每份卷各自一份作答，切卷不能串；同一份卷内部翻页要保留刚判出的成绩
  useEffect(() => {
    const pid = route.view === 'list' || route.view === 'print' ? '' : route.paper.id;
    const changed = pid !== onPaper.current;
    onPaper.current = pid;
    submitting.current = false;
    if (changed) setGrade(null);
    if (route.view === 'list' || route.view === 'print') {
      setRec(null);
      return;
    }
    const saved = loadRecord(route.paper.id) ?? blankRecord(route.paper.id);
    setRec(saved);
    // 没按「开始作答」就没有计时起点，直接进答题页要退回卷首页
    if (route.view === 'exam' && !saved.startedAt) go('#/cover/' + route.paper.id);
    // 已经交出去的卷子不再进答题页，回看成绩只走成绩页
    if (route.view === 'exam' && saved.submittedAt) go('#/result/' + route.paper.id);
    if (route.view === 'result' && !saved.submittedAt) go('#/cover/' + route.paper.id);
  }, [route]);

  /**
   * 成绩优先读本机存下的判分结果。换浏览器或清过记录时没有存卷，就照原答卷重判一次。
   */
  useEffect(() => {
    if (route.view !== 'result' || !rec?.submittedAt || grade) return;
    const stored = loadGrade<Grade>(route.paper.id);
    if (stored) {
      setGrade(stored);
      return;
    }
    let alive = true;
    void gradePaper(route.paper, rec)
      .catch(() => pendingGrade(route.paper, rec))
      .then((g) => {
        if (alive) setGrade(g);
      });
    return () => {
      alive = false;
    };
  }, [route, rec, grade]);

  useEffect(() => {
    if (route.view !== 'exam') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [route]);

  // 作答即时保存：浏览器里考试，误关标签页、断网、停电都要能回到原处
  useEffect(() => {
    if (!rec || route.view !== 'exam') return;
    const t = setTimeout(() => saveRecord(rec), 350);
    return () => clearTimeout(t);
  }, [rec, route.view]);

  const patch = useCallback((id: string, p: Answer) => {
    setRec((r) => (r ? { ...r, answers: { ...r.answers, [id]: { ...r.answers[id], ...p } } } : r));
  }, []);

  /** 重考：这张卷的作答、计时与成绩清掉，考生信息留着，回到卷首页从头开始 */
  function restart(paper: Paper, record: Record0) {
    setRec(restartRecord(record));
    setGrade(null);
    submitting.current = false;
    go('#/cover/' + paper.id);
  }

  const remaining = useCallback(() => {
    if (route.view !== 'exam' || !rec) return 0;
    return route.paper.minutes * 60 - Math.floor((now - rec.startedAt) / 1000);
  }, [route, rec, now]);

  async function finish(paper: Paper, record: Record0) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy('正在核对作答，请稍候');
    const at = Date.now();
    const done: Record0 = {
      ...record,
      submittedAt: at,
      elapsed: Math.max(0, Math.round((at - record.startedAt) / 1000))
    };
    const g = await gradePaper(paper, done).catch(() => pendingGrade(paper, done));
    const out = await submitPaper(paper, done, g);
    const final: Record0 = { ...done, submit: markOf(out) };
    saveGrade(paper.id, g);
    saveRecord(final);
    setRec(final);
    setGrade(g);
    setBusy('');
    go('#/result/' + paper.id);
  }

  // 时间到系统收卷，和学生点交卷走同一条路
  useEffect(() => {
    if (route.view !== 'exam' || !rec || rec.submittedAt) return;
    if (remaining() > 0) return;
    void finish(route.paper, rec);
  }, [remaining, route, rec]);

  const title =
    route.view === 'print'
      ? route.paper?.name ?? '打印复习资料'
      : route.view === 'list'
        ? '信息技术 · 模拟试卷'
        : `${route.paper.name}`;
  const sub = route.view === 'print'
    ? route.paper ? '理论卷打印预览' : route.paperId ? '未找到试卷' : '知识点汇总打印预览'
    : 'paper' in route ? route.paper.subtitle : '理论卷与操作卷 · 程序题按卷面作答判分';

  return (
    <>
      {route.view !== 'print' ? (
        <header className="topbar">
          <div className="topbar-in">
            <div>
              <h1>{title}</h1>
              <div className="sub">{sub}</div>
            </div>
            <div className="topbar-right">
              {route.view === 'exam' && rec ? <Clock sec={remaining()} /> : null}
              {route.view === 'result' ? (
                <button className="btn btn--sm btn--ghost" onClick={() => go('#/list')}>
                  返回考卷
                </button>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}

      {busy ? (
        <div className="sheet">
          <div className="page">
            <div className="section-pad">
              <span className="spin" /> {busy}
            </div>
          </div>
        </div>
      ) : null}

      {route.view === 'list' ? <ListView papers={PAPERS} /> : null}
      {route.view === 'print' ? <PrintView paper={route.paper} paperId={route.paperId} /> : null}

      {route.view === 'cover' && rec ? (
        <CoverView
          paper={route.paper}
          record={rec}
          onInfo={(p) => setRec({ ...rec, ...p })}
          onRestart={() => restart(route.paper, rec)}
          onStart={() => {
            const started = { ...rec, startedAt: Date.now() };
            saveRecord(started);
            setRec(started);
            go('#/exam/' + route.paper.id);
          }}
        />
      ) : null}

      {route.view === 'exam' && rec ? (
        <ExamView
          paper={route.paper}
          record={rec}
          over={remaining() <= 0}
          onEdit={patch}
          onSubmit={() => void finish(route.paper, rec)}
        />
      ) : null}

      {route.view === 'result' && rec && grade ? (
        <ResultView paper={route.paper} record={rec} grade={grade} onRestart={() => restart(route.paper, rec)} />
      ) : null}

      {route.view === 'result' && rec && !grade && !busy ? (
        <div className="sheet">
          <div className="page">
            <div className="section-pad">
              <span className="spin" /> 正在按本次答卷核对成绩
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Clock({ sec }: { sec: number }) {
  const abs = Math.abs(sec);
  const mm = Math.floor(abs / 60);
  const ss = abs % 60;
  const text = (sec < 0 ? '超时 ' : '') + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  const cls = sec < 0 ? 'clock clock--over' : sec <= 300 ? 'clock clock--low' : 'clock';
  return (
    <span className={cls} title="剩余时间">
      {text}
    </span>
  );
}
