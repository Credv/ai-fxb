import { CJKTrap, Drill, FlowStages, GridTable, SpecAnatomy, Tips } from '../components/diagrams';
import { Lab } from '../components/Lab';
import { Block, Guide, StatBar } from '../components/ui';
import { Collapsible } from '../components/Accordion';
import { chapterOf } from '../lib/courseware';
import { hashFor, studentHref } from '../lib/store';
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
          <a className="btn btn--primary" href={studentHref(l.id)} target="_blank" rel="noopener">
            学生版 ↗
          </a>
          <a className="btn btn--ghost" href={hashFor('catalog')}>
            章节目录
          </a>
        </div>
      </div>

      <StatBar
        items={[
          { label: '这节课多长', value: l.minutes + ' 分钟' },
          { label: '上课分成几段', value: String(l.plan.flow.length) },
          { label: '自己动手的实验', value: String(py.lab.length) }
        ]}
      />

      <Guide {...(l.guide || {})} />

      <Block title="教学设计" nav="教学设计" n="01" lead={l.plan.standard}>
        {l.plan.textbookRef ? (
          <div className="mini mini--book" style={{ marginBottom: 14 }}>
            <h4>教材对照</h4>
            <p className="small">
              {l.plan.textbookRef.edition} · {l.plan.textbookRef.book} · {l.plan.textbookRef.pub} · ISBN{' '}
              {l.plan.textbookRef.isbn} · {l.plan.textbookRef.issued}
              {l.plan.textbookRef.pages ? ' · ' + l.plan.textbookRef.pages : ''}
              {l.plan.textbookRef.editor ? ' · 主编 ' + l.plan.textbookRef.editor : ''}
            </p>
            <table className="dtable">
              <tbody>
                <tr>
                  <td className="k">课本里的位置</td>
                  <td>
                    <ul className="tbr__at">
                      {l.plan.textbookRef.at.map((s) => (
                        <li key={s.no}>
                          <b>{s.no}</b> {s.title}
                          {s.note ? <span className="tbr__note">{s.note}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td className="k">课本已经讲到</td>
                  <td>{l.plan.textbookRef.before}</td>
                </tr>
                <tr>
                  <td className="k">这一课补上去的</td>
                  <td>{l.plan.textbookRef.beyond}</td>
                </tr>
                <tr>
                  <td className="k">电子课本</td>
                  <td>
                    {l.plan.textbookRef.links.map((k) => (
                      <span key={k.u} className="tbr__link">
                        <a className="tbr__a" href={k.u} target="_blank" rel="noopener">
                          {k.t} ↗
                        </a>
                        {k.note ? <span className="tbr__note">{k.note}</span> : null}
                      </span>
                    ))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
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

      <Block title="从开课到下课，每一分钟说什么" nav="从开课到下课说什么" n="02" lead="左边是第几分钟，「课前」那几拍是铃响之前。灰字那一行是你的动作，竖线旁边的可以直接念出口。「他们」和「你接」成对出现，一节课只会走到其中一种；带「备」的最浅一行是这一拍的应变。">
        <div className="scr">
          {(l.plan.script || []).map((b, i) => (
            <div key={i} className="scr__b">
              {b.stage ? <div className="scr__stage">{b.stage}</div> : null}
              <div className="scr__row">
                <div className="scr__min">{b.min}</div>
                <div>
                  <p className="scr__cue">{b.cue}</p>
                  {b.say.length ? (
                    <ul className="scr__say">
                      {b.say.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>
                  ) : null}
                  {b.back && b.back.length ? (
                    <ul className="scr__back">
                      {b.back.map((x, j) => (
                        <li key={j}>
                          <p className="scr__s">{x.s}</p>
                          <p className="scr__y">{x.you}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {b.note ? <p className="scr__note">{b.note}</p> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Block>

      <Block title="板书和作业" nav="板书和留什么作业" n="03">
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

      <Block title="三种写法，写的是同一件事" nav="填值的三种写法" n="04" lead={py.note}>
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

      <Block title="先猜再看" nav="先猜再看这几题" n="05" lead="课堂上直接拿这几条提问：先让两个人说出答案，再按下运行。">
        {py.drills.map((x) => (
          <Drill key={x.title} {...x} />
        ))}
      </Block>

      <Block title="名字是中文，表格为什么会歪" nav="为什么中文会歪" n="06" lead="这一条不用讲给全班，但学生一定会撞上来。撞上来时你能一句话说清，就不会被问住。">
        {py.trap.map((t) => (
          <CJKTrap key={t.text} {...t} />
        ))}
      </Block>

      <div className="grid2">
        <Block title="全部写法，一张表查完" nav="全部写法一张表查完" n="07">
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
        <Block title="学生可能会问" nav="学生可能会问什么" n="08">
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
