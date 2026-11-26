import type { Record0 } from '../lib/store';
import type { Paper } from '../lib/types';
import { paperScore } from '../lib/types';
import { paperCounts } from '../lib/paper';

type Props = {
  paper: Paper;
  record: Record0;
  onInfo: (patch: Partial<Pick<Record0, 'name' | 'className' | 'examNo'>>) => void;
  onStart: () => void;
};

export default function CoverView({ paper, record, onInfo, onStart }: Props) {
  const score = paperScore(paper);
  const counts = paperCounts(paper);
  const filled = record.name.trim() && record.className.trim() && record.examNo.trim();
  const resuming = record.startedAt > 0 && !record.submittedAt;

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
            <Field label="班级" required value={record.className} onChange={(v) => onInfo({ className: v })} />
            <Field label="考号" required value={record.examNo} onChange={(v) => onInfo({ examNo: v })} numeric />
          </div>

          <div className="btn-row" style={{ marginTop: 20 }}>
            <button className="btn btn--primary" disabled={!filled} onClick={onStart}>
              {resuming ? '继续作答' : '开始作答'}
            </button>
            <button className="btn btn--ghost" onClick={() => (location.hash = '#/list')}>
              返回考卷
            </button>
            {!filled ? <span className="muted">姓名、班级、考号填写完整后可以开始</span> : null}
          </div>

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
  numeric
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  numeric?: boolean;
}) {
  return (
    <div>
      <label className="fl">
        {label}
        {required ? <span className="req">*</span> : null}
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
