import { useState } from 'react';
import type { ExamQuestion, QuestionType } from '../lib/types';
import { recordChoice, recordSelf, saveDraft, useCertProgress } from '../lib/progress';

const LABELS: Record<QuestionType, string> = {
  single: '单项选择题',
  judge: '辨析题',
  material: '材料分析题',
  short: '简答题',
  writing: '写作题',
  case: '案例分析题',
  design: '教学设计题'
};

export function QuestionCard({ q, no, points }: { q: ExamQuestion; no: number; points?: number }) {
  const progress = useCertProgress();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const choice = selected[q.id];
  const saved = progress.results[q.id];
  const graded = submitted[q.id] || (choice !== undefined && saved?.choice === choice);

  if (q.type === 'single') {
    return (
      <article className="quiz" id={q.id}>
        <div className="quiz__top">
          <span className="quiz__no">{String(no).padStart(2, '0')}</span>
          <span>{LABELS[q.type]}{points ? ` · ${points}分` : ''}</span>
        </div>
        <p className="quiz__stem">{q.stem}</p>
        <div className="quiz__options">
          {q.options.map((option, i) => (
            <button
              key={option}
              type="button"
              className={
                'quiz__opt' +
                (choice === i ? ' is-picked' : '') +
                (graded && choice === i ? (saved?.correct ? ' is-right' : ' is-wrong') : '')
              }
              onClick={() => setSelected((s) => ({ ...s, [q.id]: i }))}
            >
              <b>{String.fromCharCode(65 + i)}</b>
              <span>{option}</span>
            </button>
          ))}
        </div>
        <div className="quiz__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={choice === undefined}
            onClick={() => {
              recordChoice(q.id, choice, choice === q.answer);
              setSubmitted((s) => ({ ...s, [q.id]: true }));
            }}
          >
            {graded ? '确认本题' : '提交答案'}
          </button>
          {saved ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setSelected((s) => {
                  const next = { ...s };
                  delete next[q.id];
                  return next;
                });
                setSubmitted((s) => {
                  const next = { ...s };
                  delete next[q.id];
                  return next;
                });
              }}
            >
              重做
            </button>
          ) : null}
        </div>
        {graded ? (
          <div className={'quiz__explain' + (saved?.correct ? ' is-right' : ' is-wrong')}>
            <b>{saved?.correct ? '答对了' : '再想一想'}</b>
            <p>{q.explain}</p>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article className="quiz quiz--open" id={q.id}>
      <div className="quiz__top">
        <span className="quiz__no">{String(no).padStart(2, '0')}</span>
        <span>{LABELS[q.type]}{points ? ` · ${points}分` : ''}</span>
      </div>
      <p className="quiz__stem">{q.stem}</p>
      <label className="quiz__draft">
        <span>先写自己的答案</span>
        <textarea
          value={progress.drafts[q.id] || ''}
          onChange={(e) => saveDraft(q.id, e.target.value)}
          placeholder="按题目分点作答。草稿只保存在这台设备的浏览器里。"
          rows={q.type === 'writing' || q.type === 'design' ? 12 : 6}
        />
      </label>
      <div className="quiz__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            const box = document.getElementById(q.id + '-reference');
            if (box instanceof HTMLDetailsElement) box.open = !box.open;
          }}
        >
          参考答案与评分点
        </button>
      </div>
      <details className="quiz__reference" id={q.id + '-reference'}>
        <summary>展开答案</summary>
        <h4>参考答案</h4>
        <div className="quiz__prose">{q.reference}</div>
        <h4>评分点</h4>
        <ul>{q.rubric.map((x) => <li key={x}>{x}</li>)}</ul>
        <div className="quiz__self">
          <span>对照后，这题掌握得怎样？</span>
          <button type="button" onClick={() => recordSelf(q.id, 'again')}>还不会</button>
          <button type="button" onClick={() => recordSelf(q.id, 'mostly')}>基本会</button>
          <button type="button" className={saved?.self === 'mastered' ? 'is-on' : ''} onClick={() => recordSelf(q.id, 'mastered')}>掌握了</button>
        </div>
      </details>
    </article>
  );
}
