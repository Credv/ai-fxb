import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExamQuestion, ExamSubject } from '../lib/types';
import { clearDrafts, recordChoice, recordMock, saveDraft, useCertProgress } from '../lib/progress';

const TYPE_NAMES: Record<ExamQuestion['type'], string> = {
  single: '单项选择', judge: '辨析题', material: '材料分析', short: '简答题', writing: '写作题', case: '案例分析', design: '教学设计'
};

function clock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function MockExam({ subject }: { subject: ExamSubject }) {
  const progress = useCertProgress();
  const questions = useMemo(() => {
    const byId = new Map(subject.questions.map((q) => [q.id, q]));
    return subject.mockIds.map((id) => byId.get(id)).filter((q): q is ExamQuestion => q !== undefined);
  }, [subject]);
  const points = useMemo(() => new Map(subject.format.map((f) => [f.type, f.points])), [subject.format]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(subject.minutes * 60);
  const [finished, setFinished] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [autoScore, setAutoScore] = useState(0);
  const done = useRef(false);
  const deadline = useRef(Date.now() + subject.minutes * 60_000);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    let score = 0;
    questions.forEach((q) => {
      if (q.type !== 'single') return;
      const choice = answers[q.id];
      if (choice !== undefined) recordChoice(q.id, choice, choice === q.answer);
      if (choice === q.answer) score += points.get(q.type) || 0;
    });
    const answered = questions.filter((q) => q.type === 'single' ? answers[q.id] !== undefined : Boolean((progress.drafts[q.id] || '').trim())).length;
    setAutoScore(score);
    setConfirming(false);
    setFinished(true);
    recordMock(subject.id, { at: new Date().toISOString(), autoScore: score, answered, total: questions.length });
  }, [answers, points, progress.drafts, questions, subject.id]);

  useEffect(() => {
    if (finished) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [finished]);

  useEffect(() => {
    if (remaining === 0 && !finished) finish();
  }, [finish, finished, remaining]);

  const q = questions[current];
  const answered = questions.filter((x) => x.type === 'single' ? answers[x.id] !== undefined : Boolean((progress.drafts[x.id] || '').trim())).length;

  if (!q) return <div className="err">这份模拟卷没有题目，请检查内容数据。</div>;

  return (
    <section className="mock">
      <div className="mock__bar">
        <div><b>{subject.code}</b><span>{subject.name}</span></div>
        <div className={'mock__clock' + (remaining < 600 ? ' is-low' : '')}>
          <span>{finished ? '已交卷' : '剩余时间'}</span>
          <b>{finished ? '—' : clock(remaining)}</b>
        </div>
        <div className="mock__count"><b>{answered}/{questions.length}</b><span>已作答</span></div>
      </div>

      {finished ? (
        <div className="mock__result">
          <span className="eyebrow">本次成绩</span>
          <strong>{autoScore}<small> / {subject.total}</small></strong>
          <p>这是客观题自动得分；主观题需按参考答案与评分点自评。选择题已同步到错题记录。</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            clearDrafts(subject.mockIds);
            setAnswers({});
            setCurrent(0);
            setAutoScore(0);
            setConfirming(false);
            setFinished(false);
            done.current = false;
            deadline.current = Date.now() + subject.minutes * 60_000;
            setRemaining(subject.minutes * 60);
          }}>重新开始</button>
        </div>
      ) : null}

      <div className="mock__sheet" aria-label="答题卡">
        {questions.map((x, i) => (
          <button
            type="button"
            key={x.id}
            className={current === i ? 'is-on' : ''}
            onClick={() => setCurrent(i)}
            aria-label={`第${i + 1}题 ${TYPE_NAMES[x.type]}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <article className="quiz quiz--mock">
        <div className="quiz__top">
          <span className="quiz__no">{String(current + 1).padStart(2, '0')}</span>
          <span>{TYPE_NAMES[q.type]} · {(points.get(q.type) || 0)}分</span>
        </div>
        <p className="quiz__stem">{q.stem}</p>
        {q.type === 'single' ? (
          <div className="quiz__options">
            {q.options.map((option, i) => (
              <button
                type="button"
                key={option}
                disabled={finished}
                className={'quiz__opt' + (answers[q.id] === i ? ' is-picked' : '') + (finished && i === q.answer ? ' is-right' : '') + (finished && answers[q.id] === i && i !== q.answer ? ' is-wrong' : '')}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
              >
                <b>{String.fromCharCode(65 + i)}</b><span>{option}</span>
              </button>
            ))}
          </div>
        ) : (
          <label className="quiz__draft">
            <span>作答区</span>
            <textarea
              rows={q.type === 'writing' || q.type === 'design' ? 18 : 8}
              disabled={finished}
              value={progress.drafts[q.id] || ''}
              onChange={(e) => saveDraft(q.id, e.target.value)}
              placeholder="在这里作答；交卷前请确认所有主观题已经写完。"
            />
          </label>
        )}
        {finished ? (
          <div className="quiz__explain">
            {q.type === 'single' ? <><b>答案：{String.fromCharCode(65 + q.answer)}</b><p>{q.explain}</p></> : null}
          </div>
        ) : null}
        {finished && q.type !== 'single' ? (
          <details className="quiz__reference" open>
            <summary>参考答案与评分点</summary>
            <h4>参考答案</h4><div className="quiz__prose">{q.reference}</div>
            <h4>评分点</h4><ul>{q.rubric.map((x) => <li key={x}>{x}</li>)}</ul>
          </details>
        ) : null}
      </article>

      <div className="mock__nav">
        <button type="button" className="btn btn--ghost" disabled={current === 0 || finished} onClick={() => setCurrent((n) => n - 1)}>上一题</button>
        {current < questions.length - 1 && !finished ? (
          <button type="button" className="btn" onClick={() => setCurrent((n) => n + 1)}>下一题</button>
        ) : null}
        {!finished ? (
          <button type="button" className="btn btn--primary" onClick={() => setConfirming(true)}>交卷</button>
        ) : null}
      </div>
      {confirming && !finished ? (
        <div className="notice confirm" role="group" aria-label="确认交卷">
          <span>还有 {questions.length - answered} 题未作答，确定交卷吗？</span>
          <div className="confirm__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>继续答题</button>
            <button type="button" className="btn btn--primary" onClick={finish}>确认交卷</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
