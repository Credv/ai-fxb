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

export function StatBar({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="bar">
      {items.map((i) => (
        <div key={i.label} className="bar__i">
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

/** 一组要点,不带折叠:试讲要带什么、下一步要问什么这类。 */
export function Tips({ items }: { items: ReactNode[] }) {
  return (
    <ul className="tips">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}
