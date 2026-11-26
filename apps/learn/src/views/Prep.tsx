import { Block, OpenAll, StatBar, Tips } from '../components/ui';
import { Collapsible } from '../components/Accordion';
import { daysLeft, setGroup } from '../lib/store';
import type { Prep } from '../lib/types';
const SCENE = 'prep:scene:';

export function PrepView({ d }: { d: Prep }) {
  const left = daysLeft(d.date);
  const when = left > 1 ? '还有 ' + left + ' 天' : left === 1 ? '明天' : left === 0 ? '今天' : '已过 ' + -left + ' 天';
  const sceneIds = d.script.map((_, i) => SCENE + i);

  return (
    <>
      <div className="lhead">
        <div>
          <p className="tiny">{d.date} · {d.school}</p>
          <h2>{d.subject}</h2>
          <p className="lead">{d.lesson} —— {d.minutes} 分钟</p>
        </div>
      </div>

      <StatBar
        items={[
          { label: '距离试课', value: when, hot: left <= 3 },
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

      <Block title="关键片段的话术" n="01" lead="不是背稿，是把最容易卡壳的几处说顺。">
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

      <Block title="可能被挑出来的刺" n="02">
        {d.risk.map((r) => (
          <div key={r.r} className="mini mini--gap" style={{ marginBottom: 9 }}>
            <h4>{r.r}</h4>
            <p>{r.fix}</p>
          </div>
        ))}
      </Block>

      <Block title="当天要带的" n="03">
        <Tips items={d.pack} />
      </Block>
    </>
  );
}
