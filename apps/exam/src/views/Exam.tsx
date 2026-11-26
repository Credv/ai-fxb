import { useState } from 'react';
import QuestionView from '../components/Question';
import { entries } from '../lib/paper';
import { answeredCount, totalQuestions, type Answer, type Record0 } from '../lib/store';
import type { Paper } from '../lib/types';

type Props = {
  paper: Paper;
  record: Record0;
  /** 时间到：作答入口全部关闭，等系统收卷 */
  over: boolean;
  onEdit: (id: string, patch: Answer) => void;
  onSubmit: () => void;
};

export default function ExamView({ paper, record, over, onEdit, onSubmit }: Props) {
  const [confirming, setConfirming] = useState(false);
  const all = entries(paper);
  const done = answeredCount(paper, record.answers);
  const total = totalQuestions(paper);
  const missing = all.filter((e) => !isDone(e.q.id));

  function isDone(id: string) {
    const a = record.answers[id];
    if (!a) return false;
    return (
      (a.pick !== undefined && a.pick >= 0) ||
      !!a.code?.trim() ||
      (a.shots?.length ?? 0) > 0 ||
      !!a.note?.trim() ||
      Object.values(a.values ?? {}).some((v) => v.trim())
    );
  }

  function jump(number: number) {
    document.getElementById('q-' + number)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="sheet">
      {paper.sections.map((section) => (
        <div className="page" key={section.id} style={{ marginBottom: 16 }}>
          <div className="part">
            <h2 className="part-name">
              {section.name}
              <span className={'part-tag' + (section.kind === 'practice' ? ' part-tag--practice' : '')}>
                {section.questions.reduce((t, q) => t + q.score, 0)} 分
              </span>
            </h2>
            <p className="part-note">{section.instruction}</p>
          </div>
          {section.questions.map((q) => {
            const e = all.find((x) => x.q.id === q.id)!;
            return (
              <QuestionView
                key={q.id}
                q={q}
                number={e.number}
                mode="edit"
                ans={record.answers[q.id]}
                locked={over}
                onEdit={onEdit}
              />
            );
          })}
        </div>
      ))}

      <div className="tray">
        <span className="tray-stat">
          已作答 <b>{done}</b> / {total}
        </span>
        <div className="tray-nums">
          {all.map((e) => (
            <button
              key={e.q.id}
              className={[
                'cell',
                e.kind === 'practice' ? 'cell--prac' : '',
                isDone(e.q.id) ? 'cell--done' : ''
              ].join(' ')}
              title={`${e.number} ${sectionName(paper, e.q.id)}`}
              onClick={() => jump(e.number)}
            >
              {e.number}
            </button>
          ))}
        </div>
        <button className="btn btn--primary" onClick={() => setConfirming(true)} disabled={over}>
          交卷
        </button>
      </div>

      {over ? <p className="note-strip" style={{ marginTop: 12 }}>考试时间已到，答卷正在提交。</p> : null}

      {confirming ? (
        <div className="mask" onClick={() => setConfirming(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>确认交卷？</h3>
            {missing.length ? (
              <>
                <p>
                  还有 <b>{missing.length}</b> 题没有作答：
                </p>
                <p className="muted">{missing.map((m) => m.number).join('、')}</p>
              </>
            ) : (
              <p>全部 {total} 题均已作答。</p>
            )}
            <p className="muted">交卷后本次作答不能再修改，成绩与讲评会立即给出。</p>
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setConfirming(false)}>
                继续作答
              </button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  setConfirming(false);
                  onSubmit();
                }}
              >
                确认交卷
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function sectionName(paper: Paper, id: string) {
  const s = paper.sections.find((x) => x.questions.some((q) => q.id === id));
  return s ? s.name : '';
}
