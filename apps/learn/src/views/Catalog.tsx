import { Collapsible } from '../components/Accordion';
import { OpenAll, StatBar } from '../components/ui';
import { COURSEWARE, stats } from '../lib/courseware';
import { hashFor, setGroup, studentHref } from '../lib/store';
import type { Chapter, Lesson } from '../lib/types';

const KEY = 'cat:';

function LessonRow({ l }: { l: Lesson }) {
  return (
    <div className="lsn">
      <div className="lsn__t">
        <h4>{l.title}</h4>
        <p>{l.summary}</p>
        <p className="small">
          {l.minutes} 分钟 · {l.textbook}
        </p>
      </div>
      <div className="lsn__go">
        <a className="btn btn--primary" href={hashFor('course', l.id)}>
          课件
        </a>
        <a className="btn btn--ghost" href={studentHref(l.id)} target="_blank" rel="noopener">
          学生版
        </a>
      </div>
    </div>
  );
}

function ChapterBlock({ c }: { c: Chapter }) {
  return (
    <Collapsible
      id={KEY + c.id}
      no={c.no}
      title={c.title}
      defaultOpen={c.lessons.length > 0}
      meta={c.lessons.length ? c.lessons.length + ' 课' : '未备课件'}
    >
      <p className="lead" style={{ marginBottom: 13 }}>
        {c.lead}
      </p>
      {c.lessons.length ? c.lessons.map((l) => <LessonRow key={l.id} l={l} />) : <p className="small">这一章还没有课件。</p>}
    </Collapsible>
  );
}

export function CatalogView() {
  const ids = COURSEWARE.chapters.map((c) => KEY + c.id);
  return (
    <>
      <StatBar items={stats()} />
      <p className="lead">
        每一课两张网页：<b>课件</b>是给老师看的，教案、板书、图解都在；<b>学生版</b>是另建的一张，只剩下图和能自己动手拖的那部分。学生那一侧看不到这里，所以链接可以直接发出去。
      </p>
      <p className="small" style={{ marginBottom: 16 }}>
        {COURSEWARE.basis}
      </p>
      <OpenAll expand={() => setGroup(ids, true)} collapse={() => setGroup(ids, false)} />
      {COURSEWARE.chapters.map((c) => (
        <ChapterBlock key={c.id} c={c} />
      ))}
    </>
  );
}
