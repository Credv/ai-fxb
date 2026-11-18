import type { ReactNode } from 'react';
import type { Level } from '../lib/types';

export const LEVEL_TEXT: Record<Level, string> = { have: '现成', rusty: '要捡', gap: '缺口' };

export function LevelTag({ v }: { v: Level }) {
  return <span className={'lvl lvl--' + v}>{LEVEL_TEXT[v]}</span>;
}

export function Block({ title, nav, n, lead, children }: { title: string; nav?: string; n?: string; lead?: string; children?: ReactNode }) {
  return (
    <section className="blk" data-sec={nav || title}>
      <h3>
        {n ? <span className="n">{n}</span> : null}
        {title}
      </h3>
      {lead ? <p className="lead">{lead}</p> : null}
      {children}
    </section>
  );
}

export function StatBar({ items }: { items: { label: string; value: string; hot?: boolean }[] }) {
  return (
    <div className="bar">
      {items.map((i) => (
        <div key={i.label} className={'bar__i' + (i.hot ? ' is-hot' : '')}>
          <b>{i.value}</b>
          <span>{i.label}</span>
        </div>
      ))}
    </div>
  );
}

/** 章节一多,逐个点开手酸;这两个按钮只动当前这一组。 */
export function OpenAll({ expand, collapse }: { expand: () => void; collapse: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <button type="button" className="btn btn--ghost" onClick={expand}>
        全部展开
      </button>
      <button type="button" className="btn btn--ghost" onClick={collapse}>
        全部收起
      </button>
    </div>
  );
}

/** 每个图解块顶上那一句「盯这里」:先说看哪儿,再说为什么。 */
export function Look({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="look">
      <span className="look__k">盯这里</span>
      {text}
    </p>
  );
}

/** 这一页怎么读:三步读法 + 符号图例 + 名词翻成大白话。三项都可缺。 */
export function Guide({ steps, legend, terms }: { steps?: { t: string; d: string }[]; legend?: { sym: string; means: string }[]; terms?: { t: string; say: string }[] }) {
  if (!steps?.length && !legend?.length && !terms?.length) return null;
  return (
    <section className="blk blk--lead guide" data-sec="这一页怎么读">
      <h3>这一页怎么读</h3>
      {steps?.length ? (
        <div className="guide__steps">
          {steps.map((s, i) => (
            <div key={s.t} className="guide__s">
              <i>{i + 1}</i>
              <div>
                <b>{s.t}</b>
                <p>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {legend?.length ? (
        <div className="guide__legend">
          {legend.map((g) => (
            <div key={g.sym} className="guide__lg">
              <code>{g.sym}</code>
              <span>{g.means}</span>
            </div>
          ))}
        </div>
      ) : null}
      {terms?.length ? (
        <table className="dtable guide__terms">
          <tbody>
            {terms.map((t) => (
              <tr key={t.t}>
                <td className="k">{t.t}</td>
                <td>{t.say}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
