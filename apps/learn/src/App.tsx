import { useEffect } from 'react';
import { Gate } from './components/Gate';
import { LessonNav, PageFoot } from './components/Nav';
import { COURSEWARE, LESSONS, findLesson } from './lib/courseware';
import { applyRoute, boot, daysLeft, go, hashFor, leave, parseHash, PRIVATE_VIEWS, state, useVersion } from './lib/store';
import { CatalogView } from './views/Catalog';
import { CertView } from './views/Cert';
import { CourseView } from './views/Course';
import { MapView } from './views/Map';
import { PrepView } from './views/Prep';
import { StudentLab } from './views/StudentLab';
import { StudentsView } from './views/Students';

function Bg() {
  return (
    <>
      <div className="bg-grid" />
      <div className="bg-glow bg-glow--a" />
      <div className="bg-glow bg-glow--b" />
    </>
  );
}

function Masthead({ title, sub, right }: { title: string; sub: string; right?: React.ReactNode }) {
  return (
    <header className="masthead">
      <div className="brand">
        <div className="logo">▤</div>
        <div>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
      </div>
      <div className="mh-right">{right}</div>
    </header>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="err">
      <h3>这一课不在这儿</h3>
      <p>链接里的课件编号是 <code>{id || '（空）'}</code>，当前章节里没有它——可能这一课还没备好，也可能链接少了一位。</p>
      <p className="small" style={{ marginTop: 14 }}>现在备好的课件一共 {LESSONS.length} 课，直接点进去：</p>
      <div className="err__list">
        {LESSONS.map((l) => (
          <div key={l.id} className="err__row">
            <span className="err__t">{l.title}</span>
            <span className="err__go">
              <a href={hashFor('course', l.id)}>课件</a>
              <a href={hashFor('student', l.id)}>学生版</a>
            </span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 12 }}>
        <button type="button" className="btn btn--ghost" onClick={() => go('catalog')}>
          回章节目录
        </button>
      </p>
    </div>
  );
}

function PublicShell() {
  const lesson = state.sec === 'course' || state.sec === 'student' ? findLesson(state.id) : null;
  return (
    <div className="shell">
      <Masthead
        title={COURSEWARE.course}
        sub={state.sec === 'student' ? '图解和参数，自己动手看' : '教案 · 板书 · 图解 —— 按章节存放'}
        right={
          <a className="chip-i" href="/ai-fxb/">
            AI 窗口 ↗
          </a>
        }
      />
      <LessonNav sec={state.sec} lesson={lesson} />
      {state.sec === 'catalog' ? <CatalogView /> : null}
      {state.sec === 'course' ? (lesson ? <CourseView lesson={lesson} /> : <NotFound id={state.id} />) : null}
      {state.sec === 'student' ? (lesson ? <StudentLab lesson={lesson} /> : <NotFound id={state.id} />) : null}
      <PageFoot lesson={lesson} />
      <footer className="foot">
        <div>
          <a href="/">← 3ecat.me</a>
        </div>
      </footer>
    </div>
  );
}

function PrivateShell() {
  if (state.gate === 'loading') {
    return (
      <div className="gate">
        <p className="chip-i">读内容…</p>
      </div>
    );
  }
  if (state.gate === 'error') {
    return (
      <div className="shell">
        <div className="err">
          <h3>打不开</h3>
          <p>{state.error}</p>
        </div>
      </div>
    );
  }
  if (state.gate !== 'open' || !state.parts) {
    return <Gate />;
  }

  const p = state.parts;
  const left = daysLeft(p.prep.date);
  const hot = left >= 0 && left <= 7;
  const v = (state.id || 'prep') as (typeof PRIVATE_VIEWS)[number]['id'];

  return (
    <div className="shell">
      <Masthead
        title="备课台"
        sub="我自己看的那几页"
        right={
          <>
            <span className={'chip-i' + (hot ? ' chip-i--hot' : '')}>
              试讲{left > 1 ? '还有 ' + left + ' 天' : left === 1 ? '就在明天' : left === 0 ? '就是今天' : '已经过了'}
            </span>
            <a className="chip-i" href="#/">
              课件
            </a>
            <button type="button" className="btn btn--ghost" onClick={leave}>
              退出
            </button>
          </>
        }
      />
      <nav className="tabs">
        {PRIVATE_VIEWS.map((x) => (
          <button
            key={x.id}
            type="button"
            className={'tab' + (v === x.id ? ' is-active' : '')}
            onClick={() => go('private', x.id)}
            title={x.hint}
          >
            <span className="tab__ico">{x.ico}</span>
            {x.label}
          </button>
        ))}
      </nav>
      {v === 'prep' ? <PrepView d={p.prep} /> : null}
      {v === 'students' ? <StudentsView d={p.students} /> : null}
      {v === 'map' ? <MapView d={p.map} /> : null}
      {v === 'cert' ? <CertView d={p.cert} /> : null}
    </div>
  );
}

export default function App() {
  useVersion();
  useEffect(() => {
    boot();
    const onHash = () => {
      const r = parseHash();
      if (r.sec !== state.sec || r.id !== state.id) applyRoute(r.sec, r.id);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  // 公开页面前面的 <a href="#/"> 只是改了 hash；hashchange 会把它落到 state.sec。
  const isPrivate = state.sec === 'private';
  return (
    <>
      <Bg />
      {isPrivate ? <PrivateShell /> : <PublicShell />}
    </>
  );
}
