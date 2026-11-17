import { CJKTrap, Drill, FlowStages, GridTable, SpecAnatomy, Tips } from '../components/diagrams';
import { Lab } from '../components/Lab';
import { Block, Collapsible, Guide, StatBar } from '../components/ui';
import { chapterOf } from '../lib/courseware';
import { hashFor } from '../lib/store';
import type { Lesson } from '../lib/types';

const BOARD = 'course:board:';

export function CourseView({ lesson: l }: { lesson: Lesson }) {
  const ch = chapterOf(l.id);
  const py = l.py;
  return (
    <>
      <div className="lhead">
        <div>
          <p className="tiny">{ch ? ch.no + ' · ' + ch.title : '课件'}</p>
          <h2>{l.title}</h2>
          <p className="lead">{l.summary}</p>
        </div>
        <div className="lhead__go">
          <a className="btn btn--primary" href={hashFor('student', l.id)}>
            学生版
          </a>
          <a className="btn btn--ghost" href={hashFor('catalog')}>
            章节目录
          </a>
        </div>
      </div>

      <StatBar
        items={[
          { label: '课时', value: l.minutes + ' 分钟' },
          { label: '课堂环节', value: String(l.plan.flow.length) },
          { label: '可拖参数的实验', value: String(py.lab.length) }
        ]}
      />

      <Guide {...(l.guide || {})} />

      <Block title="教学设计" n="01" lead={l.plan.standard}>
        <div className="mini" style={{ marginBottom: 14 }}>
          <h4>学情</h4>
          <p>{l.plan.learners}</p>
        </div>
        <div className="grid2" style={{ marginBottom: 14 }}>
          {l.plan.goals.map((g) => (
            <div key={g.dim} className="mini">
              <h4>{g.dim}</h4>
              <p>{g.t}</p>
            </div>
          ))}
        </div>
        <div className="grid2" style={{ marginBottom: 16 }}>
          <div className="mini mini--have">
            <h4>重点</h4>
            <Tips items={l.plan.key} />
          </div>
          <div className="mini mini--gap">
            <h4>难点</h4>
            <Tips items={l.plan.hard} />
          </div>
        </div>
        <div className="tl">
          {l.plan.flow.map((f) => (
            <div key={f.min} className="tl__row">
              <div className="tl__min">{f.min}</div>
              <div>
                <div className="tl__stage">{f.stage}</div>
                <ul className="tl__do">
                  {f.do.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
                {f.say ? <div className="tl__say">{f.say}</div> : null}
              </div>
            </div>
          ))}
        </div>
      </Block>

      <Block title="板书与课后" n="02">
        <Collapsible id={BOARD + l.id} no="稿" title="板书草稿" defaultOpen>
          <pre className="board">{l.plan.board}</pre>
        </Collapsible>
        <div className="grid2" style={{ marginTop: 12 }}>
          {l.plan.homework.map((h) => (
            <div key={h.t} className="mini">
              <h4>{h.t}</h4>
              <p>{h.d}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block title="三种写法，一回事" n="03" lead={py.note}>
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

      <Block title="先猜再看" n="04" lead="课堂提问直接用这几条：先让两个人说答案，再按下运行。">
        {py.drills.map((x) => (
          <Drill key={x.title} {...x} />
        ))}
      </Block>

      <Block title="中文列为什么会歪" n="05" lead="这一条不用讲给全班，但学生一定会撞上来，撞上来时你能一句话说清，课就站住了。">
        {py.trap.map((t) => (
          <CJKTrap key={t.text} {...t} />
        ))}
      </Block>

      <div className="grid2">
        <Block title="一页速查" n="06">
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
        <Block title="学生可能会问" n="07">
          <table className="dtable">
            <tbody>
              {l.ask.map((a) => (
                <tr key={a.q}>
                  <td style={{ width: '38%' }}>{a.q}</td>
                  <td>
                    {a.a}
                    {a.note ? (
                      <div className="small" style={{ margin: '6px 0 0' }}>
                        {a.note}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      </div>
    </>
  );
}
