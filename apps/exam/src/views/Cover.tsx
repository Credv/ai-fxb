import { useState } from 'react';
import type { Record0 } from '../lib/store';
import type { Paper } from '../lib/types';
import { paperScore } from '../lib/types';
import { paperCounts } from '../lib/paper';
import { clockText } from '../lib/submit';

type Props = {
  paper: Paper;
  record: Record0;
  onInfo: (patch: Partial<Pick<Record0, 'name' | 'className' | 'examNo'>>) => void;
  onStart: () => void;
  onRestart: () => void;
};

const CLASSES = ['一班', '二班', '三班', '四班', '五班', '六班', '七班', '八班', '九班', '十班'];

export default function CoverView({ paper, record, onInfo, onStart, onRestart }: Props) {
  const score = paperScore(paper);
  const counts = paperCounts(paper);
  const filled = record.name.trim() && record.className.trim();
  const resuming = record.startedAt > 0 && !record.submittedAt;
  const submitted = !!record.submittedAt;
  const [asking, setAsking] = useState(false);

  return (
    <main className="sheet">
      <div className="page">
        <div className="cover">
          <div className="cover-kicker">普通高中学业水平合格性考试 · 信息技术</div>
          <h2>{paper.name}</h2>
          <p className="cover-sub">{paper.subtitle}</p>

          <div className="cover-meta">
            <div>
              <dt>卷面满分</dt>
              <dd>{score.total} 分</dd>
            </div>
            <div>
              <dt>考试时长</dt>
              <dd>{paper.minutes} 分钟</dd>
            </div>
            <div>
              <dt>第一部分</dt>
              <dd>
                {counts.theory} 题 {score.theory} 分
              </dd>
            </div>
            <div>
              <dt>第二部分</dt>
              <dd>
                {counts.practice} 题 {score.practice} 分
              </dd>
            </div>
          </div>

          <h3 className="h3" style={{ margin: '26px 0 0' }}>
            考生须知
          </h3>
          <ol className="notice">
            {paper.notice.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="page">
        <div className="section-pad">
          <h3 className="h3">考生信息</h3>
          <div className="field-grid">
            <Field label="姓名" required value={record.name} onChange={(v) => onInfo({ name: v })} />
            <ClassField label="班级" value={record.className} onChange={(v) => onInfo({ className: v })} />
            <Field label="考号" hint="选填" value={record.examNo} onChange={(v) => onInfo({ examNo: v })} numeric />
          </div>

          <div className="btn-row" style={{ marginTop: 20 }}>
            {submitted ? (
              <>
                <button className="btn btn--primary" onClick={() => (location.hash = '#/result/' + paper.id)}>
                  查看这次的成绩
                </button>
                <button className="btn" onClick={() => setAsking(true)}>
                  重新作答这张卷
                </button>
              </>
            ) : (
              <button className="btn btn--primary" disabled={!filled} onClick={onStart}>
                {resuming ? '继续作答' : '开始作答'}
              </button>
            )}
            <button className="btn btn--ghost" onClick={() => (location.hash = '#/list')}>
              返回考卷
            </button>
            {!filled && !submitted ? <span className="muted">姓名与班级选好后可以开始</span> : null}
          </div>

          {submitted ? (
            <p className="note-strip" style={{ marginTop: 16 }}>
              这张卷已在 {clockText(record.submittedAt ?? 0)} 交卷。
            </p>
          ) : null}

          {submitted && asking ? (
            <div className="retake">
              <p>重新作答会把这张卷的作答和成绩清掉，从计时第一步重新做起。姓名、班级、考号留着，不必重填。</p>
              <div className="btn-row">
                <button className="btn btn--sm btn--warn" onClick={onRestart}>
                  确认重考
                </button>
                <button className="btn btn--sm" onClick={() => setAsking(false)}>
                  先不重考
                </button>
              </div>
            </div>
          ) : null}

          {resuming ? (
            <p className="note-strip" style={{ marginTop: 16 }}>
              本次考试已计时开始，剩余时间以答卷上方的计时为准。
            </p>
          ) : null}

          <h3 className="h3" style={{ marginTop: 28 }}>
            命题说明
          </h3>
          <p className="muted">{paper.source}</p>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  hint,
  numeric
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
  numeric?: boolean;
}) {
  return (
    <div>
      <label className="fl">
        {label}
        {required ? <span className="req">*</span> : null}
        {hint ? <span className="fl-hint">{hint}</span> : null}
      </label>
      <input
        className="tt"
        value={value}
        autoComplete="off"
        inputMode={numeric ? 'numeric' : undefined}
        maxLength={numeric ? 20 : 40}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** 班级从预设的十个班里选，不让考生手打，收上来的答卷才好按班归类 */
function ClassField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const opts = value && !CLASSES.includes(value) ? [...CLASSES, value] : CLASSES;
  return (
    <div>
      <label className="fl">
        {label}
        <span className="req">*</span>
      </label>
      <select className="tt" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">请选择</option>
        {opts.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
