import { go } from '../App';
import { loadGrade, loadRecord, type Record0 } from '../lib/store';
import type { Grade } from '../lib/grade';
import type { Paper } from '../lib/types';
import { paperScore } from '../lib/types';

export default function ListView({ papers }: { papers: Paper[] }) {
  return (
    <main className="sheet">
      <div className="page">
        <div className="cover">
          <div className="cover-kicker">普通高中学业水平合格性考试</div>
          <h2>信息技术 · 模拟试卷</h2>
          <p className="cover-sub">
            按合格性考试的卷面规格编制：第一部分基础理论 40 题，第二部分操作技能 6 题，理论题与程序题当场给分，
            表格题随卷附素材，完成后截图记入答卷。选择一份开始。
          </p>
          <p className="muted" style={{ marginTop: 10 }}>
            本卷为模拟练习卷，不等同于正式考试试题；正式考试为全省统一机房环境，软件版本以考点当场为准。
          </p>
          <div className="print-entries">
            <div className="print-entries-title">打印复习资料</div>
            <div className="btn-row">
              {papers.length ? (
                <a className="btn btn--sm" href={`#/print/${papers[papers.length - 1].id}`} title="打印最新一份理论卷，也可在下方选择其他试卷">
                  打印理论卷
                </a>
              ) : null}
              <a className="btn btn--sm" href="#/print">
                打印知识点
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="page">
        <div className="paper-list">
          {[...papers].reverse().map((p) => (
            <PaperCard key={p.id} paper={p} />
          ))}
        </div>
      </div>
    </main>
  );
}

function PaperCard({ paper }: { paper: Paper }) {
  const rec: Record0 | null = loadRecord(paper.id);
  const score = paperScore(paper);
  const g = rec?.submittedAt ? loadGrade<Grade>(paper.id) : null;

  let status = <span className="muted">尚未作答</span>;
  if (rec?.submittedAt) {
    status = (
      <span className="pc-done">
        已交卷{g ? `　当场评定 ${g.got} / ${score.total} 分` : ''}
      </span>
    );
  } else if (rec && answeredSome(rec)) {
    status = <span className="pc-done">作答中</span>;
  }

  return (
    <article className="paper-card-shell">
      <button
        className="paper-card"
        onClick={() => go(`#/${rec?.submittedAt ? 'result' : rec && answeredSome(rec) ? 'exam' : 'cover'}/${paper.id}`)}
      >
        <h3>{paper.name}</h3>
        <p>{paper.subtitle}</p>
        <div className="pc-meta">
          <em>满分 {score.total} 分</em>
          <em>
            理论 {score.theory} 分 · 操作 {score.practice} 分
          </em>
          <em>{paper.minutes} 分钟</em>
        </div>
        <div style={{ marginTop: 10 }}>{status}</div>
      </button>
      <div className="paper-card-print">
        <a className="btn btn--sm btn--ghost" href={`#/print/${paper.id}`}>
          打印理论卷
        </a>
      </div>
    </article>
  );
}

function answeredSome(r: Record0): boolean {
  return Object.values(r.answers).some(
    (a) =>
      (a.pick !== undefined && a.pick >= 0) ||
      (a.code && a.code.trim()) ||
      (a.shots && a.shots.length) ||
      (a.note && a.note.trim()) ||
      (a.values && Object.values(a.values).some((v) => v.trim()))
  );
}
