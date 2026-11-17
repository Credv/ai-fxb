import { daysLeft, setGroup } from '../lib/store';
import type { Python, Trial } from '../lib/types';
import { CJKTrap, Drill, FlowStages, GridTable, SpecAnatomy, Tips } from '../components/diagrams';
import { Lab } from '../components/Lab';
import { Block, Collapsible, OpenAll, StatBar } from '../components/ui';

const SCENE = 'trial:scene:';
const BOARD = 'trial:board';

export function TrialView({ d, py }: { d: Trial; py: Python }) {
  const left = daysLeft(d.date);
  const when = left > 1 ? '还有 ' + left + ' 天' : left === 1 ? '明天' : left === 0 ? '今天' : '已过 ' + -left + ' 天';
  const sceneIds = d.script.map((_, i) => SCENE + i);

  return (
    <>
      <StatBar
        items={[
          { label: '距离试讲', value: when, hot: left <= 3 },
          { label: '课时长度', value: d.minutes + ' 分钟' },
          { label: '学校', value: d.school },
          { label: '课题', value: d.lesson }
        ]}
      />

      <Block title="去之前先问清楚的几件事" n="00" lead="这几条不问，教案写得再细也可能对不上现场。">
        <div className="grid2">
          {d.verify.map((v) => (
            <div key={v.t} className="mini">
              <h4>{v.t}</h4>
              <p>{v.d}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block title="教学设计" n="01" lead={d.plan.standard}>
        <div className="mini" style={{ marginBottom: 14 }}>
          <h4>学情</h4>
          <p>{d.plan.learners}</p>
        </div>
        <div className="grid2" style={{ marginBottom: 14 }}>
          {d.plan.goals.map((g) => (
            <div key={g.dim} className="mini">
              <h4>{g.dim}</h4>
              <p>{g.t}</p>
            </div>
          ))}
        </div>
        <div className="grid2" style={{ marginBottom: 16 }}>
          <div className="mini mini--have">
            <h4>重点</h4>
            <Tips items={d.plan.key} />
          </div>
          <div className="mini mini--gap">
            <h4>难点</h4>
            <Tips items={d.plan.hard} />
          </div>
        </div>
        <div className="tl">
          {d.plan.flow.map((f) => (
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
        <Collapsible id={BOARD} no="稿" title="板书草稿" defaultOpen>
          <pre className="board">{d.plan.board}</pre>
        </Collapsible>
        <div className="grid2" style={{ marginTop: 12 }}>
          {d.plan.homework.map((h) => (
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
      {py.lab.map((l) => (
        <Lab key={l.title} {...l} />
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
        <Block title="可能被挑出来的刺" n="07">
          {d.risk.map((r) => (
            <div key={r.r} className="mini mini--gap" style={{ marginBottom: 9 }}>
              <h4>{r.r}</h4>
              <p>{r.fix}</p>
            </div>
          ))}
        </Block>
      </div>

      <Block title="关键片段的话术" n="08" lead="不是背稿，是把最容易卡壳的几处说顺。">
        <OpenAll expand={() => setGroup(sceneIds, true)} collapse={() => setGroup(sceneIds, false)} />
        {d.script.map((s, i) => (
          <Collapsible key={s.scene} id={SCENE + i} no={String(i + 1)} title={s.scene} meta={s.lines.length + ' 句'}>
            <div className="tl__say" style={{ borderLeftColor: 'var(--acc-2)' }}>
              {s.lines.map((l, n) => (
                <div key={n} style={{ marginBottom: n === s.lines.length - 1 ? 0 : 6 }}>
                  {l}
                </div>
              ))}
            </div>
          </Collapsible>
        ))}
      </Block>

      <Block title="学生可能会问" n="09">
        <table className="dtable">
          <tbody>
            {d.ask.map((a) => (
              <tr key={a.q}>
                <td style={{ width: '34%' }}>{a.q}</td>
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

      <Block title="当天要带的" n="10">
        <Tips items={d.pack} />
      </Block>
    </>
  );
}
