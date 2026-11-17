import { useState } from 'react';
import { cellSpans, fmtValue, pad } from '../lib/text';
import type { LabField } from '../lib/types';
import { Code } from './Code';

const AL: { v: LabField['align']; t: string }[] = [
  { v: 'l', t: '< 左' },
  { v: 'c', t: '^ 中' },
  { v: 'r', t: '> 右' }
];
/** 界面里用 l/c/r 记，写进代码必须是 Python 认的那三个符号——'l8' 是会直接报错的。 */
const ALCH: Record<LabField['align'], string> = { l: '<', c: '^', r: '>' };

/** Python 的格式说明符:[: [[fill]align][width][.precision[TYPE]]] */
function tail(f: LabField): string {
  const parts: string[] = [];
  // 宽度是「不设」时连对齐符一起不写：没有要摆的余地，写了等于没写。
  if (f.w > 0) parts.push(ALCH[f.align] + f.w);
  if (f.type === 'num' && f.prec > 0) parts.push('.' + f.prec + 'f');
  return parts.length ? ':' + parts.join('') : '';
}

/** 表头那一行也是文字：带上 .Nf 就是给字符串套数字格式，Python 直接 ValueError。 */
function headTail(f: LabField): string {
  return f.w > 0 ? ':' + ALCH[f.align] + f.w : '';
}

/** 改一个参数，屏幕上的列就跟着抖一格——课堂上最能留住学生的那个交互。 */
export function Lab({ title, intro, sep, fields: init }: { title: string; intro: string; sep: string; fields: LabField[] }) {
  const [fs, setFs] = useState<LabField[]>(() => init.map((f) => ({ ...f })));
  const set = (i: number, patch: Partial<LabField>) => setFs((old) => old.map((f, n) => (n === i ? { ...f, ...patch } : f)));

  const disp = (f: LabField) => fmtValue(f.value, f.type, f.prec);
  // 宽度填 0 就是「不设宽度」：Python 这时一个空格也不补，所以这里也必须补 0——
  // 之前按「这一列最宽的内容」补齐，屏幕上摆齐了，代码其实打不出那一行。
  const wOf = (f: LabField) => f.w;
  const spans = (text: string, f: LabField, cls: string) => {
    const s = cellSpans(text, wOf(f), f.align);
    return (
      <span key={f.key} className={'cell cell--' + cls}>
        {s.left ? <span className="cell__dot">{s.left}</span> : null}
        {s.body}
        {s.right ? <span className="cell__dot">{s.right}</span> : null}
      </span>
    );
  };
  const real = (text: string, f: LabField) => {
    const p = pad(text, wOf(f), f.align);
    return ' '.repeat(p.left) + text + ' '.repeat(p.right);
  };

  const q = (s: string) => "'" + s.replace(/'/g, "\\'") + "'";
  const sepSrc = sep.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const fLine = 'f"' + fs.map((f) => '{' + f.key + tail(f) + '}').join(sepSrc) + '"';
  const hLine = 'f"' + fs.map((f) => '{' + q(f.label) + headTail(f) + '}').join(sepSrc) + '"';
  const posLine = '"' + fs.map((f) => '{' + tail(f) + '}').join(sepSrc) + '".format(' + fs.map((f) => literal(f)).join(', ') + ')';
  const hPosLine = '"' + fs.map((f) => '{' + headTail(f) + '}').join(sepSrc) + '".format(' + fs.map((f) => q(f.label)).join(', ') + ')';
  const decl = fs.map((f) => f.key + ' = ' + literal(f)).join('\n');
  const output = [fs.map((f) => real(f.label, f)).join(sep), fs.map((f) => real(disp(f), f)).join(sep)].join('\n');

  return (
    <div className="blk">
      <h3>{title}</h3>
      <p className="lead">{intro}</p>
      <div className="lab">
        <div className="lab__fields">
          {fs.map((f, i) => (
            <div key={f.key} className="lab__f">
              <label>
                {f.label} <code>{f.key}</code>
              </label>
              <input
                type={f.type === 'num' ? 'number' : 'text'}
                value={f.value}
                step={f.type === 'num' ? 0.1 : undefined}
                onChange={(e) => set(i, { value: e.target.value })}
              />
              <div className="lab__range">
                <span>宽度</span>
                <input type="range" min={0} max={16} value={f.w} onChange={(e) => set(i, { w: Number(e.target.value) })} />
                <code>{f.w > 0 ? f.w : '不设'}</code>
              </div>
              {f.type === 'num' ? (
                <div className="lab__range">
                  <span>小数</span>
                  <input type="range" min={0} max={4} value={f.prec} onChange={(e) => set(i, { prec: Number(e.target.value) })} />
                  <code>{f.prec > 0 ? f.prec : '不管'}</code>
                </div>
              ) : null}
              <div className="lab__al">
                {AL.map((a) => (
                  <button key={a.v} type="button" className={f.align === a.v ? 'is-on' : ''} onClick={() => set(i, { align: a.v })}>
                    {a.t}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="small" style={{ marginTop: 0 }}>现在这份参数写出来的代码</p>
          <Code>{decl + '\n\nprint(' + hLine + ')\nprint(' + fLine + ')'}</Code>
          <p className="small">同一份输出的另一种写法（旧代码、老教材里会遇到，含义完全一样）：</p>
          <Code>{'print(' + hPosLine + ')\nprint(' + posLine + ')'}</Code>
        </div>

        <div>
          <p className="small" style={{ marginTop: 0 }}>屏幕上真实的列</p>
          <div className="cells">{fs.map((f) => spans(f.label, f, 'lit'))}</div>
          <div className="cells">{fs.map((f) => spans(disp(f), f, 'val'))}</div>
          <p className="small">
            补出来的空格画成 <code>·</code>。把「宽度」拖到 <b>不设</b>，列就散了——那正是没做格式化的周报长什么样。
          </p>
          <pre className="code">{output.replace(/ /g, '␣')}</pre>
        </div>
      </div>
    </div>
  );
}

function literal(f: LabField): string {
  return f.type === 'num' ? String(Number(f.value) || 0) : "'" + f.value.replace(/'/g, "\\'") + "'";
}
