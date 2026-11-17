import { createContext, useContext, useState, type ReactNode } from 'react';
import { cellSpans, dw, pad, plen } from '../lib/text';
import type { Cell, SpecToken } from '../lib/types';

/** 学生版只留图解本身：教师向的旁白（为什么这么讲、课堂上怎么处理）在这一档里一律不出现。 */
export const PlainCtx = createContext(false);

/** 把一行格式说明符拆成可以点的小块:哪一段管什么,点一下才说得清。 */
export function SpecAnatomy({ spec, title, why, tokens }: { spec: string; title: string; why: string; tokens: SpecToken[] }) {
  const [sel, setSel] = useState<number>(-1);
  const stu = useContext(PlainCtx);
  return (
    <div className="blk">
      <h3>{title}</h3>
      {stu ? null : <p className="lead">{why}</p>}
      <div className="anat">
        {tokens.map((t, i) => (
          <button
            key={i}
            type="button"
            className={'anat__t' + (t.hot ? ' is-hot' : '') + (sel === i ? ' is-sel' : '')}
            onClick={() => setSel(sel === i ? -1 : i)}
          >
            <span className="anat__c">{t.t}</span>
            <span className="anat__l">{t.label}</span>
          </button>
        ))}
      </div>
      {sel >= 0 ? <p className="lead" style={{ color: 'var(--txt)' }}>「{tokens[sel].t}」{tokens[sel].desc}</p> : null}
      <table className="dtable">
        <tbody>
          {tokens.map((t, i) => (
            <tr key={i}>
              <td className="k"><code>{t.t}</code></td>
              <td style={{ width: 76, color: 'var(--acc)' }}>{t.label}</td>
              <td>{t.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">整行拼起来就是：<code>{spec}</code></p>
    </div>
  );
}

function CellSpan({ c, i }: { c: Cell; i: number }) {
  const s = cellSpans(c.text, c.w, c.align);
  const kind = c.kind || 'val';
  return (
    <span key={i} className={'cell cell--' + kind}>
      {s.left ? <span className="cell__dot">{s.left}</span> : null}
      {s.body}
      {s.right ? <span className="cell__dot">{s.right}</span> : null}
    </span>
  );
}

export function CellRow({ cells }: { cells: Cell[] }) {
  return (
    <div className="cells">
      {cells.map((c, i) => <CellSpan key={i} c={c} i={i} />)}
    </div>
  );
}

export function GridTable({ title, code, note, head, rows }: { title: string; code: string; note: string; head: Cell[]; rows: Cell[][] }) {
  const stu = useContext(PlainCtx);
  // 表头和竖线本身也是格子:代码里那行 print 打出来的就是它们,少算一格这一列的宽度就对不上。
  const want = (c: Cell) => (c.w > 0 ? c.w : plen(c.text));
  const all = [...(head.length ? [head] : []), ...rows];
  const colW = Array.from({ length: Math.max(...all.map((r) => r.length)) }, (_, j) =>
    Math.max(...all.map((r) => (r[j] ? want(r[j]) : 0)))
  );
  const fill = (text: string, w: number, align: Cell['align']) => {
    const p = pad(text, w, align);
    return ' '.repeat(p.left) + text + ' '.repeat(p.right);
  };
  const laid = all.map((r) => r.map((c, j) => ({ ...c, text: c.kind === 'pad' ? '' : c.text, w: c.w > 0 ? c.w : colW[j] })));
  const plain = laid.map((row) => row.map((c) => fill(c.text, c.w, c.align)).join(''));
  return (
    <div className="blk">
      <h3>{title}</h3>
      <pre className="code" style={{ marginBottom: 12 }}>{code}</pre>
      <div style={{ marginBottom: 10 }}>
        {laid.map((row, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <CellRow cells={row} />
          </div>
        ))}
      </div>
      <p className="small">上面把补出来的空格画成了 <code>·</code>；打印到屏幕上其实长这样（空格用 <code>␣</code> 标出）：</p>
      <pre className="code">{plain.map((l) => l.replace(/ /g, '␣')).join('\n')}</pre>
      {stu ? null : <p className="small">{note}</p>}
    </div>
  );
}

export function FlowStages({ title, desc, list }: { title: string; desc: string; list: { name: string; data: string; hint: string }[] }) {
  const stu = useContext(PlainCtx);
  return (
    <div className="blk">
      <h3>{title}</h3>
      {stu ? null : <p className="lead">{desc}</p>}
      <div className="flow">
        {list.map((s, i) => (
          <div key={i} className="flow__s">
            <div className="flow__n">
              <i>{i + 1}</i>
              {s.name}
            </div>
            <div className="flow__d">{s.data}</div>
            {stu ? null : <div className="flow__h">{s.hint}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 先猜再看:课堂可以直接拿去问学生。 */
export function Drill({ title, code, guess, out, note }: { title: string; code: string; guess: string; out: string; note: string }) {
  const [shown, setShown] = useState(false);
  const stu = useContext(PlainCtx);
  return (
    <div className="drill">
      <h4>{title}</h4>
      <pre className="code">{code}</pre>
      <p className="small" style={{ marginTop: 8 }}>先自己猜：<span style={{ color: 'var(--txt-2)' }}>{guess}</span></p>
      <div className="drill__row">
        <button type="button" className="drill__ans" onClick={() => setShown(!shown)}>{shown ? '收回答案' : '看输出'}</button>
        {shown ? <span className="drill__got">{out.replace(/ /g, '␣')}</span> : null}
      </div>
      {shown && !stu ? <p className="drill__note">{note}</p> : null}
    </div>
  );
}

export function Tips({ items }: { items: string[] }) {
  return (
    <ul className="tips">
      {items.map((t, i) => <li key={i}>{t as ReactNode}</li>)}
    </ul>
  );
}

/** Python 补的是"字符个数"，终端量的是"显示列数"；中文一多，两张尺就对不上了。 */
export function CJKTrap({ text, w, note }: { text: string; w: number; note: string }) {
  const stu = useContext(PlainCtx);
  const py = pad(text, w, 'l');
  const cols = dw(text);
  const need = Math.max(0, w - cols);
  const s = cellSpans(text, w, 'l');
  return (
    <div className="drill">
      <h4>
        <code>{'{:' + w + '}'}</code> 套在 <code>{'"' + text + '"'}</code> 上
      </h4>
      <div className="cells" style={{ marginTop: 9 }}>
        <span className="cell cell--val">
          {s.left ? <span className="cell__dot">{s.left}</span> : null}
          {s.body}
          {s.right ? <span className="cell__dot">{s.right}</span> : null}
        </span>
      </div>
      <table className="dtable">
        <tbody>
          <tr>
            <td className="k">len()</td>
            <td>{plen(text)} 个字符 —— Python 就按这个数补 {py.right} 个空格</td>
          </tr>
          <tr>
            <td className="k">占几列</td>
            <td>{cols} 列（一个中文占两列）—— 所以它其实比同行别的数据宽了 {cols - plen(text)} 列</td>
          </tr>
          <tr>
            <td className="k">想真对齐</td>
            <td>得按列数补，也就是再补 {need} 个空格；这一层 Python 不替你算。</td>
          </tr>
        </tbody>
      </table>
      {stu ? null : <p className="drill__note">{note}</p>}
    </div>
  );
}
