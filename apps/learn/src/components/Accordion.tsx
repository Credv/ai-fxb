import type { ReactNode } from 'react';
import { isOpen, toggle } from '../lib/store';

/** 折叠块单独一个文件:它要记开合状态,状态在 store 里,而 store 连着加密那套。
 *  学生版那一页不折叠,所以也不该把私密区的字样带进它的包里。 */
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
