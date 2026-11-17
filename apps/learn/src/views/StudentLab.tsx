import { CJKTrap, Drill, FlowStages, GridTable, PlainCtx, SpecAnatomy } from '../components/diagrams';
import { Lab } from '../components/Lab';
import { Block, Guide } from '../components/ui';
import { hashFor } from '../lib/store';
import type { Lesson } from '../lib/types';

/** 学生版：只剩图解和能拖的参数。教师向的旁白由 PlainCtx 在各图里收掉。 */
export function StudentLab({ lesson: l }: { lesson: Lesson }) {
  const py = l.py;
  return (
    <PlainCtx.Provider value={true}>
      <div className="stu">
        <div className="lhead">
          <div>
            <h2>{l.title}</h2>
            <p className="lead">{l.summary}</p>
          </div>
          <div className="lhead__go">
            <a className="btn btn--ghost" href={hashFor('catalog')}>
              目录
            </a>
          </div>
        </div>

        <Guide {...(l.guide || {})} />

        <Block title="三种写法，写的是同一件事" nav="三种写法">
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

        <Block title="先猜再看" nav="先猜再看">
          {py.drills.map((x) => (
            <Drill key={x.title} {...x} />
          ))}
        </Block>

        <Block title="名字是中文，表格为什么会歪" nav="中文为什么歪">
          {py.trap.map((t) => (
            <CJKTrap key={t.text} {...t} />
          ))}
        </Block>

        <Block title="全部写法，一张表查完" nav="速查表">
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
      </div>
    </PlainCtx.Provider>
  );
}
