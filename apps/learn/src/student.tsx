import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CJKTrap, Drill, FlowStages, GridTable, PlainCtx, SpecAnatomy } from './components/diagrams';
import { Lab } from './components/Lab';
import { BackToTop, SectionRail } from './components/Rail';
import { Block, Guide } from './components/ui';
import { COURSEWARE, LESSONS, chapterOf, findLesson, neighbors, shortTitle } from './lib/courseware';
import type { Lesson } from './lib/types';
import './styles/learn.css';

/** 学生手里那一张，单独一个网页(/learn/student/)。
 *  这里只渲染图和能拖参数的部分：不放目录、不放教案板书，也没有任何回到课件的入口——
 *  连路由都不共用一套 hash，所以它的包里既没有备课台的字样，也不需要密码。 */

function currentId(): string {
  const m = /^#\/l\/([^/?]+)/.exec(location.hash);
  return m ? m[1] : '';
}

function href(id: string) {
  return '#/l/' + id;
}

/** 没有 id、或者 id 认不出来时给的一张单子：只有学生版这一侧的链接。 */
function Pick({ bad }: { bad?: string }) {
  return (
    <div className="stu">
      {bad ? (
        <p className="lead">
          链接里的课号是 <code>{bad}</code>，这一张上没有它。下面是现在有的几课，直接点进去：
        </p>
      ) : (
        <p className="lead">老师发给你的应该是某一课的链接，直接点下面任意一课：</p>
      )}
      <div className="stupick">
        {LESSONS.map((l) => {
          const ch = chapterOf(l.id);
          return (
            <a key={l.id} className="stupick__i" href={href(l.id)}>
              <b>{l.title}</b>
              <span>{ch ? ch.no + ' · ' + ch.title : ''}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function LessonPage({ lesson: l }: { lesson: Lesson }) {
  const py = l.py;
  const ch = chapterOf(l.id);
  const { prev, next } = neighbors(l.id);
  return (
    <PlainCtx.Provider value={true}>
      <div className="stu">
        <div className="lhead">
          <div>
            <p className="tiny">{ch ? ch.no + ' · ' + ch.title : '图解'}</p>
            <h2>{l.title}</h2>
            <p className="lead">{l.summary}</p>
          </div>
        </div>

        <Guide {...(l.guide || {})} />

        <Block title="三种写法，写的是同一件事" nav="填值的三种写法">
          <table className="dtable">
            <thead>
              <tr>
                {py.compare.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {py.compare.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={j === 0 ? 'k' : ''}>
                      {j > 0 ? <code>{c}</code> : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Block>

        <div className="grid2">
          {py.anatomy.map((a) => (
            <SpecAnatomy key={a.spec} {...a} />
          ))}
        </div>

        {py.grid.map((g) => (
          <GridTable key={g.title} {...g} />
        ))}
        {py.stages.map((s) => (
          <FlowStages key={s.title} {...s} />
        ))}
        {py.lab.map((x) => (
          <Lab key={x.title} {...x} />
        ))}

        <Block title="先猜再看" nav="先猜再看这几题">
          {py.drills.map((x) => (
            <Drill key={x.title} {...x} />
          ))}
        </Block>

        <Block title="名字是中文，表格为什么会歪" nav="为什么中文会歪">
          {py.trap.map((t) => (
            <CJKTrap key={t.text} {...t} />
          ))}
        </Block>

        <Block title="全部写法，一张表查完" nav="全部写法一张表查完">
          <table className="dtable">
            <tbody>
              {py.cheats.map((c) => (
                <tr key={c.k}>
                  <td className="k">
                    <code>{c.k}</code>
                  </td>
                  <td>{c.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>

        <div className="lfoot">
          {prev ? <a className="btn btn--ghost" href={href(prev.id)}>‹ {shortTitle(prev)}</a> : null}
          {next ? <a className="btn btn--ghost" href={href(next.id)}>{shortTitle(next)} ›</a> : null}
        </div>
      </div>
    </PlainCtx.Provider>
  );
}

function App() {
  const [id, setId] = useState(currentId);
  useEffect(() => {
    const onHash = () => {
      setId(currentId());
      scrollTo({ top: 0 });
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const lesson = id ? findLesson(id) : null;
  return (
    <>
      <div className="bg-grid" />
      <div className="bg-glow bg-glow--a" />
      <div className="bg-glow bg-glow--b" />
      <div className="shell">
        <header className="masthead">
          <div className="brand">
            <div className="logo">▤</div>
            <div>
              <h1>{COURSEWARE.course}</h1>
              <p>图在这里，参数自己拖</p>
            </div>
          </div>
        </header>
        <SectionRail key={'stu:' + id} pageId="page" />
        <div id="page">{lesson ? <LessonPage lesson={lesson} /> : <Pick bad={id} />}</div>
      </div>
      <BackToTop />
    </>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
