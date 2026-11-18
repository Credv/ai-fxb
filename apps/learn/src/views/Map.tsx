import { setGroup } from '../lib/store';
import type { KnowledgeMap } from '../lib/types';
import { Tips } from '../components/diagrams';
import { Block, LevelTag, OpenAll } from '../components/ui';
import { Collapsible } from '../components/Accordion';

const CH = 'map:ch:';
const JD = 'map:jd:';

export function MapView({ d }: { d: KnowledgeMap }) {
  const chIds = d.chapters.map((_, i) => CH + i);
  const jdIds = d.jd.map((_, i) => JD + i);
  const gapCount = d.jd.filter((j) => j.mine === 'gap').length + d.chapters.reduce((n, c) => n + c.items.filter((it) => it.level === 'gap').length, 0);
  const rustyCount = d.jd.filter((j) => j.mine === 'rusty').length + d.chapters.reduce((n, c) => n + c.items.filter((it) => it.level === 'rusty').length, 0);

  return (
    <>
      <Block title="任职要求逐条对上我自己的底" n="00" lead={d.note}>
        <div className="bar" style={{ marginBottom: 14 }}>
          <div className="bar__i">
            <b>{d.jd.length}</b>
            <span>任职要求的条数</span>
          </div>
          <div className="bar__i is-hot">
            <b>{gapCount}</b>
            <span>要补的缺口</span>
          </div>
          <div className="bar__i">
            <b>{rustyCount}</b>
            <span>能用但要重新捡起来</span>
          </div>
        </div>
        <OpenAll expand={() => setGroup(jdIds, true)} collapse={() => setGroup(jdIds, false)} />
        {d.jd.map((j, i) => (
          <Collapsible
            key={j.req}
            id={JD + i}
            no={String(i + 1)}
            title={j.req}
            meta={
              <>
                <LevelTag v={j.mine} /> <span> {j.where}</span>
              </>
            }
          >
            <div className="mini mini--gap" style={{ marginBottom: 10 }}>
              <h4>差在哪</h4>
              <p>{j.gap}</p>
            </div>
            <p className="lead">
              <b style={{ color: 'var(--acc)' }}>怎么补 · </b>
              {j.how}
            </p>
          </Collapsible>
        ))}
      </Block>

      <Block title="按章节排的知识地图" n="01" lead="必修一册 + 选择性必修两册，按上课的顺序排。每一节里写我会什么、讲这节课要用的新东西是什么、以及从前端过来最容易踩的空档。">
        <OpenAll expand={() => setGroup(chIds, true)} collapse={() => setGroup(chIds, false)} />
        {d.chapters.map((c, i) => (
          <Collapsible key={c.no} id={CH + i} no={c.no} title={c.title} meta={c.items.length + ' 项'} defaultOpen={i === 0}>
            <p className="lead" style={{ marginTop: 0, marginBottom: 12 }}>{c.summary}</p>
            {c.items.map((it) => (
              <div key={it.t} className={'mini mini--' + it.level} style={{ marginBottom: 9 }}>
                <h4>
                  {it.t} <LevelTag v={it.level} />
                </h4>
                <p style={{ marginBottom: 5 }}>{it.d}</p>
                <p style={{ color: 'var(--txt-3)' }}>
                  <b style={{ color: 'var(--acc)' }}>补法 · </b>
                  {it.fix}
                </p>
              </div>
            ))}
          </Collapsible>
        ))}
      </Block>

      <Block title="面试时要主动问的" n="02">
        <Tips items={d.ask} />
      </Block>
    </>
  );
}
