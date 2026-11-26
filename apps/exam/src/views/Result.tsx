import { useState } from 'react';
import QuestionView from '../components/Question';
import type { Grade } from '../lib/grade';
import { entries } from '../lib/paper';
import type { Record0, SubmitMark } from '../lib/store';
import type { Paper } from '../lib/types';
import { clockText, durationText, fileNameFor, reportHtml, download } from '../lib/submit';

type Props = {
  paper: Paper;
  record: Record0;
  grade: Grade;
};

export default function ResultView({ paper, record, grade }: Props) {
  const [onlyWrong, setOnlyWrong] = useState(false);
  const all = entries(paper);
  const items = onlyWrong ? grade.items.filter((i) => i.state !== 'right') : grade.items;
  const wrongCount = grade.items.filter((i) => i.state !== 'right').length;
  const passLine = Math.round(grade.full * 0.6);
  const decided = grade.pending === 0;
  const passed = decided && grade.got >= passLine;

  function again() {
    download(fileNameFor(paper, record), reportHtml(paper, record, grade));
  }

  return (
    <main className="sheet">
      <div className="page">
        <div className="score-hero">
          <div className={'score-num ' + (passed ? 'score-num--pass' : decided ? 'score-num--fail' : '')}>{grade.got}</div>
          <div className="score-of">当场评定 / 满分 {grade.full} 分</div>
          <div className="score-of" style={{ marginTop: 8 }}>
            {record.name}　{record.className}　考号 {record.examNo}
          </div>
          <div className="score-bars">
            <div className="score-bar">
              <span>第一部分 基础理论</span>
              <b>
                {grade.theory.got} / {grade.theory.full}
              </b>
            </div>
            <div className="score-bar">
              <span>第二部分 操作技能</span>
              <b>
                {grade.practice.got} / {grade.practice.full}
              </b>
            </div>
            <div className="score-bar">
              <span>用时</span>
              <b>{durationText(record.elapsed ?? 0)}</b>
            </div>
          </div>
          {decided ? (
            <p className="muted" style={{ marginTop: 14 }}>
              {passed ? '达到合格标准（' + passLine + ' 分）' : '未达合格标准（' + passLine + ' 分）'}
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 14 }}>
              另有 {grade.pending} 分由教师根据上交的操作结果评定。
            </p>
          )}
        </div>

        <div className="section-pad">
          <p className="muted">交卷时间 {clockText(record.submittedAt ?? Date.now())}</p>
          {record.submit ? (
            <Outcome o={record.submit} at={record.submittedAt ?? Date.now()} onAgain={again} />
          ) : (
            <DownloadAgain again={again} />
          )}
        </div>
      </div>

      <div className="page">
        <div className="part">
          <h2 className="part-name">逐题讲评</h2>
          <p className="part-note">每题给出对错、正确选项与选择该选项的依据。</p>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className={'btn btn--sm' + (onlyWrong ? ' btn--primary' : '')} onClick={() => setOnlyWrong((v) => !v)}>
              {onlyWrong ? '显示全部题目' : `只看未得分的 ${wrongCount} 题`}
            </button>
          </div>
        </div>
        {items.map((it) => {
          const e = all.find((x) => x.q.id === it.id)!;
          return (
            <QuestionView
              key={it.id}
              q={e.q}
              number={it.number}
              mode="review"
              ans={record.answers[it.id]}
              result={it}
              onEdit={() => undefined}
            />
          );
        })}
        {!items.length ? <div className="section-pad">全部题目均已完成。</div> : null}
      </div>
    </main>
  );
}

function sizeText(n: number) {
  return n >= 1024 * 1024 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
}

function Outcome({ o, at, onAgain }: { o: SubmitMark; at: number; onAgain: () => void }) {
  if (o.via === 'online') {
    return (
      <p className="note-strip" style={{ background: 'var(--ok-soft)', borderColor: '#bfe6c9', color: 'var(--ok)' }}>
        答卷已提交，提交时间 {clockText(at)}。
      </p>
    );
  }
  if (o.via === 'file') {
    return (
      <>
        <p className="note-strip">
          答卷已保存为文件 <b>{o.fileName}</b>（{sizeText(o.bytes ?? 0)}），请到下载文件夹找到它，用课堂传输软件发给任课教师。
        </p>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn--sm" onClick={onAgain}>
            再次保存答卷
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="err-tip">答卷未能保存：{o.error}</div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn--sm" onClick={onAgain}>
          重试保存答卷
        </button>
      </div>
    </>
  );
}

function DownloadAgain({ again }: { again: () => void }) {
  return (
    <div className="btn-row">
      <button className="btn btn--sm" onClick={again}>
        保存答卷文件
      </button>
      <span className="muted">如已上交过，不需要重复保存。</span>
    </div>
  );
}
