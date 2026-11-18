import { setGroup } from '../lib/store';
import type { Cert } from '../lib/types';
import { Tips } from '../components/diagrams';
import { Block, OpenAll } from '../components/ui';
import { Collapsible } from '../components/Accordion';

const FAQ = 'cert:faq:';
const ST: Record<Cert['calendar'][number]['st'], string> = { past: '已过', next: '最近的一班', later: '在后面' };

export function CertView({ d }: { d: Cert }) {
  const faqIds = d.faq.map((_, i) => FAQ + i);
  return (
    <>
      <Block title="我现在的位子" n="00" lead={d.lead}>
        <p className="lead" style={{ marginTop: 12 }}>
          <b style={{ color: 'var(--acc)' }}>路线 · </b>
          {d.route}
        </p>
      </Block>

      <Block title="日历" n="01" lead="日子是按官方公告抄的，不是估的；每年略有前后，报名前再看一次公告。">
        <div className="tl">
          {d.calendar.map((c) => (
            <div key={c.when + c.what} className="tl__row">
              <div className="tl__min">{c.when}</div>
              <div>
                <div className="tl__stage">
                  {c.what} <span className={'lvl ' + (c.st === 'past' ? 'lvl--have' : c.st === 'next' ? 'lvl--gap' : 'lvl--rusty')}>{ST[c.st]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Block>

      <Block title="笔试三科" n="02" lead="中学信息技术：科目一 + 科目二 + 科目三（信息技术学科知识与教学能力）。">
        {d.papers.map((p) => (
          <div key={p.no} className="mini" style={{ marginBottom: 10 }}>
            <h4>
              {p.no} {p.name}
            </h4>
            <p style={{ marginBottom: 6 }}>
              <b style={{ color: 'var(--txt-3)' }}>合格线 · </b>
              {p.score}
            </p>
            <p style={{ marginBottom: 6 }}>
              <b style={{ color: 'var(--acc)' }}>抓什么 · </b>
              {p.focus.join('；')}
            </p>
            <p>
              <b style={{ color: 'var(--txt-3)' }}>怎么过 · </b>
              {p.how}
            </p>
          </div>
        ))}
      </Block>

      <div className="grid2">
        <Block title="面试怎么考" n="03">
          <table className="dtable">
            <thead>
              <tr>
                <th>环节</th>
                <th>时长</th>
                <th>考什么</th>
              </tr>
            </thead>
            <tbody>
              {d.interview.map((i) => (
                <tr key={i.stage}>
                  <td className="k">{i.stage}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{i.min}</td>
                  <td>{i.do}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
        <Block title="考完之后还要走的手续" n="04">
          <Tips items={d.after} />
        </Block>
      </div>

      <Block title="容易搞错的地方" n="05">
        <OpenAll expand={() => setGroup(faqIds, true)} collapse={() => setGroup(faqIds, false)} />
        {d.faq.map((f, i) => (
          <Collapsible key={f.q} id={FAQ + i} no="?" title={f.q} defaultOpen={i === 0}>
            <p className="lead">{f.a}</p>
          </Collapsible>
        ))}
      </Block>
    </>
  );
}
