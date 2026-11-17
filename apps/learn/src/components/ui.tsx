import type { ReactNode } from 'react';
import { isOpen, toggle } from '../lib/store';
import type { Level } from '../lib/types';

export const LEVEL_TEXT: Record<Level, string> = { have: '现成', rusty: '要捡', gap: '缺口' };

export function LevelTag({ v }: { v: Level }) {
  return <span className={'lvl lvl--' + v}>{LEVEL_TEXT[v]}</span>;
}

export function Collapsible({
  id, no, title, meta, defaultOpen = false, children
}: { id: string; no?: string; title: string; meta?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const on = isOpen(id, defaultOpen);
  return (
    <div className={'acc' + (on ? ' is-on' : '')}>
      <button type="button" className="acc__head" onClick={() => toggle(id, defaultOpen)}>
        {no ? <span className="acc__no">{no}</span> : null}
        <span className="acc__title">{title}</span>
        {meta ? <span className="acc__meta">{meta}</span> : null}
        <span className="acc__caret">▶</span>
      </button>
      {on ? <div className="acc__body">{children}</div> : null}
    </div>
  );
}

export function Block({ title, n, lead, children }: { title: string; n?: string; lead?: string; children?: ReactNode }) {
  return (
    <section className="blk">
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
