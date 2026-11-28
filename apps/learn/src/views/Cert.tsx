import { useMemo, useState } from 'react';
import type { Cert, ExamQuestion, ExamSubject } from '../lib/types';
import { resetProgress, toggleLesson, useCertProgress } from '../lib/progress';
import { QuestionCard } from '../components/Quiz';
import { MockExam } from '../components/MockExam';

type Section = 'overview' | 'study' | 'practice' | 'wrong' | 'mock';
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: '冲刺总览' },
  { id: 'study', label: '学习讲义' },
  { id: 'practice', label: '分章练习' },
  { id: 'wrong', label: '错题本' },
  { id: 'mock', label: '限时模拟' }
];

function minutes(n: number) {
  return n >= 60 ? `${Math.floor(n / 60)}小时${n % 60 ? n % 60 + '分' : ''}` : `${n}分`;
}

export function CertView({ d }: { d: Cert }) {
  const progress = useCertProgress();
  const [subjectId, setSubjectId] = useState(d.subjects[0]?.id || '');
  const [section, setSection] = useState<Section>('overview');
  const [chapterId, setChapterId] = useState(d.subjects[0]?.chapters[0]?.id || '');
  const [mocking, setMocking] = useState(false);
  const [resetting, setResetting] = useState(false);
  const subject = d.subjects.find((x) => x.id === subjectId) || d.subjects[0];
  const chapter = subject?.chapters.find((x) => x.id === chapterId) || subject?.chapters[0];
  const totalLessons = d.subjects.reduce((n, s) => n + s.chapters.length, 0);
  const totalMinutes = d.subjects.reduce((n, s) => n + s.chapters.reduce((m, c) => m + c.minutes, 0), 0);

  const wrong = useMemo(
    () => d.subjects.flatMap((s) => s.questions.filter((q) => progress.results[q.id] && !progress.results[q.id].correct)),
    [d.subjects, progress.results]
  );

  function chooseSubject(id: string) {
    const next = d.subjects.find((x) => x.id === id);
    setSubjectId(id);
    setChapterId(next?.chapters[0]?.id || '');
    setMocking(false);
  }

  function goSection(next: Section) {
    setSection(next);
    setMocking(false);
  }

  if (!subject) return <div className="err"><h3>没有科目内容</h3><p>请重新生成并提交加密内容。</p></div>;

  return (
    <>
      <section className="cert-hero">
        <div>
          <span className="eyebrow">漳州 · 高中信息技术</span>
          <h2>三科笔试，一起冲。</h2>
          <p>{d.lead}</p>
        </div>
        <div className="cert-hero__target"><span>备考目标</span><b>{d.target}</b><small>{d.scheduleNote}</small></div>
      </section>

      <div className="cert-stats">
        <div><b>{progress.completedLessons.length}<small> / {totalLessons}</small></b><span>已学章节</span></div>
        <div><b>{minutes(totalMinutes)}</b><span>讲义建议用时</span></div>
        <div><b>{wrong.length}</b><span>待巩固题目</span></div>
        <div><b>{d.subjects.reduce((n, s) => n + s.questions.length, 0)}</b><span>配套练习</span></div>
      </div>

      <nav className="cert-nav" aria-label="备考功能">
        {SECTIONS.map((x) => (
          <button type="button" key={x.id} className={section === x.id ? 'is-on' : ''} onClick={() => goSection(x.id)}>{x.label}</button>
        ))}
      </nav>

      <div className="cert-subjects">
        {d.subjects.map((s) => (
          <button type="button" key={s.id} className={subject.id === s.id ? 'is-on' : ''} onClick={() => chooseSubject(s.id)}>
            <span>{s.no} · {s.code}</span><b>{s.name}</b>
            <small>{s.chapters.filter((c) => progress.completedLessons.includes(c.id)).length}/{s.chapters.length} 章 · {s.questions.length} 题</small>
          </button>
        ))}
      </div>

      {section === 'overview' ? (
        <Overview cert={d} progress={progress} subject={subject} chooseSubject={chooseSubject} goSection={goSection} />
      ) : null}

      {section === 'study' && chapter ? (
        <section className="study">
          <aside className="study__nav">
            {subject.chapters.map((c, i) => (
              <button type="button" key={c.id} className={chapter.id === c.id ? 'is-on' : ''} onClick={() => setChapterId(c.id)}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <b>{c.title}</b>
                <small>{minutes(c.minutes)}{progress.completedLessons.includes(c.id) ? ' · 已学' : ''}</small>
              </button>
            ))}
          </aside>
          <article className="study__body blk">
            <span className="eyebrow">{subject.code} · 学习讲义</span>
            <h3>{chapter.title}</h3>
            <p className="lead">{chapter.summary}</p>
            <div className="study__points">
              {chapter.points.map((p, i) => (
                <section key={p.title}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <div><h4>{p.title}</h4><p>{p.detail}</p></div>
                </section>
              ))}
            </div>
            <div className="study__foot">
              <button type="button" className="btn btn--ghost" onClick={() => {
                const first = subject.questions.find((q) => q.id === chapter.questionIds[0]);
                if (first) {
                  goSection('practice');
                  window.setTimeout(() => document.getElementById(first.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                }
              }}>练本章题</button>
              <button type="button" className={'btn ' + (progress.completedLessons.includes(chapter.id) ? '' : 'btn--primary')} onClick={() => toggleLesson(chapter.id)}>
                {progress.completedLessons.includes(chapter.id) ? '取消已学' : '标记已学'}
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {section === 'practice' ? (
        <section>
          <div className="section-head"><div><span className="eyebrow">{subject.code}</span><h3>{subject.name} · 分章练习</h3></div><p>先独立作答，再对照解析。选择结果与开放题自评会进入错题本。</p></div>
          <div className="practice">
            {subject.chapters.map((c) => {
              const qs = c.questionIds.map((id) => subject.questions.find((q) => q.id === id)).filter((q): q is ExamQuestion => Boolean(q));
              return (
                <section key={c.id} className="practice__chapter">
                  <h4>{c.title}<small>{qs.length} 题</small></h4>
                  {qs.map((q) => <QuestionCard key={q.id} q={q} no={subject.questions.indexOf(q) + 1} points={subject.format.find((f) => f.type === q.type)?.points} />)}
                </section>
              );
            })}
          </div>
        </section>
      ) : null}

      {section === 'wrong' ? (
        <section>
          <div className="section-head"><div><span className="eyebrow">三科汇总</span><h3>错题本</h3></div><p>答错的选择题和自评“还不会 / 基本会”的主观题会留在这里。</p></div>
          {wrong.length ? wrong.map((q, i) => <QuestionCard key={q.id} q={q} no={i + 1} />) : (
            <div className="empty"><b>还没有待巩固的题</b><p>去做一组练习；答错或自评未掌握的题会自动收进来。</p><button type="button" className="btn btn--primary" onClick={() => goSection('practice')}>开始练习</button></div>
          )}
        </section>
      ) : null}

      {section === 'mock' ? (
        mocking ? <MockExam key={subject.id} subject={subject} /> : (
          <MockStart subject={subject} progress={progress} start={() => setMocking(true)} />
        )
      ) : null}

      <footer className="foot cert-foot">
        <div>学习记录只保存在当前浏览器；清除浏览器数据会一并清除。不是真题，题量按近年常见结构编排。</div>
        {resetting ? (
          <div className="notice confirm" role="group" aria-label="确认清空学习记录">
            <span>确定清空全部章节进度、答题结果、草稿和模拟成绩吗？</span>
            <div className="confirm__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setResetting(false)}>取消</button>
              <button type="button" className="btn btn--primary" onClick={() => { resetProgress(); setResetting(false); setMocking(false); }}>确认清空</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={() => setResetting(true)}>清空学习记录</button>
        )}
      </footer>
    </>
  );
}

function Overview({ cert, progress, subject, chooseSubject, goSection }: {
  cert: Cert;
  progress: ReturnType<typeof useCertProgress>;
  subject: ExamSubject;
  chooseSubject: (id: string) => void;
  goSection: (section: Section) => void;
}) {
  return (
    <div className="overview">
      <div className="grid2">
        <section className="blk"><span className="eyebrow">当前科目</span><h3>{subject.name}</h3><p className="lead">{subject.summary}</p><ul className="tips">{subject.strategy.map((x) => <li key={x}>{x}</li>)}</ul></section>
        <section className="blk"><span className="eyebrow">冲刺顺序</span><h3>先拿大题，再补零碎</h3><ol className="plan">{cert.plan.map((p, i) => <li key={p.stage}><span>{i + 1}</span><div><b>{p.stage}<small>{p.weeks}</small></b><p>{p.focus}</p><ul>{p.tasks.map((x) => <li key={x}>{x}</li>)}</ul></div></li>)}</ol></section>
      </div>
      <section className="blk"><span className="eyebrow">三科策略</span><h3>每一科怎么拿分</h3><div className="subject-grid">{cert.subjects.map((s) => <article key={s.id}><div><span>{s.code}</span><b>{s.name}</b></div><p>{s.summary}</p><ul className="tips">{s.strategy.map((x) => <li key={x}>{x}</li>)}</ul><button type="button" className="btn btn--ghost" onClick={() => { chooseSubject(s.id); goSection('study'); }}>进入学习</button></article>)}</div></section>
      <section className="blk"><span className="eyebrow">模拟记录</span><h3>最近成绩</h3>{cert.subjects.some((s) => (progress.mocks[s.id] || []).length) ? <div className="mock-history">{cert.subjects.map((s) => <div key={s.id}><b>{s.code}</b>{(progress.mocks[s.id] || []).slice().reverse().slice(0, 3).map((r, i) => <span key={r.at + i}>客观题 {r.autoScore} / {s.total} · 作答 {r.answered}/{r.total} · {new Date(r.at).toLocaleString('zh-CN', { hour12: false })}</span>)}</div>)}</div> : <div className="empty"><b>还没有模拟成绩</b><p>建议完成一轮学习后，按 120 分钟真实节奏考一次。</p><button type="button" className="btn btn--primary" onClick={() => goSection('mock')}>去模拟</button></div>}</section>
      <section className="blk"><span className="eyebrow">官方来源</span><h3>大纲与报名</h3><div className="source-grid">{cert.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.label}<span>↗</span></a>)}</div><p className="notice">2027 年福建报名、漳州考区及笔试日期尚未公布。以下链接用于核对最新公告；在公告出来前，不把某个月份当作已确认考试日期。</p></section>
      <section className="blk"><span className="eyebrow">报考前再确认</span><h3>容易漏掉的事</h3><div className="faq">{cert.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div></section>
    </div>
  );
}

function MockStart({ subject, progress, start }: { subject: ExamSubject; progress: ReturnType<typeof useCertProgress>; start: () => void }) {
  return (
    <section className="blk mock-start">
      <span className="eyebrow">{subject.code} · 全真节奏</span>
      <h3>{subject.name}</h3>
      <p className="lead">共 {subject.mockIds.length} 题，{subject.minutes} 分钟，满分 {subject.total} 分。时间到自动交卷；选择题自动判分，主观题对照参考答案自评。</p>
      <p className="tiny">{subject.pass}</p>
      <div className="format">{subject.format.map((f) => <div key={f.type}><b>{f.count}<small> 题</small></b><span>{f.label}</span><small>每题 {f.points} 分</small></div>)}</div>
      <div className="notice">题量与分值按近年常见卷面结构编排，不是 2027 年官方承诺。本卷为模拟练习，不是真题。</div>
      {(progress.mocks[subject.id] || []).length ? <div className="mock-history"><b>最近记录</b>{progress.mocks[subject.id].slice().reverse().slice(0, 3).map((r, i) => <span key={r.at + i}>客观题 {r.autoScore} / {subject.total} · 作答 {r.answered}/{r.total} · {new Date(r.at).toLocaleString('zh-CN', { hour12: false })}</span>)}</div> : null}
      <button type="button" className="btn btn--primary" onClick={start}>开始 {subject.minutes} 分钟模拟</button>
    </section>
  );
}
