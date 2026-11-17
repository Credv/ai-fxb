import { setGroup } from '../lib/store';
import type { Students } from '../lib/types';
import { Block, Collapsible, OpenAll } from '../components/ui';

const RULE = 'stu:rule:';

export function StudentsView({ d }: { d: Students }) {
  const ruleIds = d.rules.map((_, i) => RULE + i);
  return (
    <>
      <Block title="先说清楚一件事" n="00" lead={d.lead} />

      <Block title="能把课带下去的几条" n="01">
        <OpenAll expand={() => setGroup(ruleIds, true)} collapse={() => setGroup(ruleIds, false)} />
        {d.rules.map((r, i) => (
          <Collapsible key={r.t} id={RULE + i} no={String(i + 1)} title={r.t} meta={r.d.length + ' 条'} defaultOpen={i === 0}>
            <ul className="tips">
              {r.d.map((x, n) => (
                <li key={n}>{x}</li>
              ))}
            </ul>
          </Collapsible>
        ))}
      </Block>

      <Block title="场景：话到嘴边该怎么说" n="02" lead="左边是学生会怎么做，中间是那一下真正在发生什么，右边是你开口的第一句。">
        {d.scenes.map((s) => (
          <div key={s.s} className="mini" style={{ marginBottom: 10 }}>
            <h4>{s.s}</h4>
            <p style={{ marginBottom: 7 }}>
              <b style={{ color: 'var(--txt-3)' }}>背后 · </b>
              {s.under}
            </p>
            <p style={{ marginBottom: 7 }}>
              <b style={{ color: 'var(--acc)' }}>你说 · </b>
              {s.say}
            </p>
            <p>
              <b style={{ color: 'var(--txt-3)' }}>之后 · </b>
              {s.after}
            </p>
          </div>
        ))}
      </Block>

      <div className="grid2">
        <Block title="这几件事别做" n="03">
          <ul className="tips">
            {d.no.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Block>
        <Block title="第一周" n="04" lead="第一周不赶进度，先把规矩和脸认全。">
          <div className="tl">
            {d.firstWeek.map((f) => (
              <div key={f.day} className="tl__row">
                <div className="tl__min">{f.day}</div>
                <div>
                  <div className="tl__stage" style={{ fontSize: 13 }}>{f.t}</div>
                </div>
              </div>
            ))}
          </div>
        </Block>
      </div>

      <Block title="换成学生的说法" n="05" lead="同一句话，术语版他们走神，说法版他们听懂了。">
        <table className="dtable">
          <tbody>
            {d.talk.map((t) => (
              <tr key={t.k}>
                <td className="k" style={{ width: '34%' }}>
                  {t.k}
                </td>
                <td>{t.v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>
    </>
  );
}
