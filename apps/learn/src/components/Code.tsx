import { Fragment, type ReactNode } from 'react';

const KW = new Set([
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or', 'import', 'from', 'as',
  'with', 'try', 'except', 'finally', 'class', 'lambda', 'None', 'True', 'False', 'pass', 'break', 'continue',
  'global', 'nonlocal', 'yield', 'raise', 'del', 'assert', 'async', 'await'
]);
const BI = new Set(['print', 'len', 'range', 'open', 'round', 'str', 'int', 'float', 'sum', 'max', 'min', 'sorted', 'zip', 'enumerate', 'dict', 'list', 'set', 'abs', 'input', 'format']);

type Tok = { k: string; v: string };

function scan(src: string): Tok[] {
  const out: Tok[] = [];
  const push = (k: string, v: string) => {
    if (v) out.push({ k, v });
  };
  let i = 0;
  let plain = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '#') {
      let j = src.indexOf('\n', i);
      if (j < 0) j = src.length;
      push('p', plain);
      plain = '';
      push('c-cm', src.slice(i, j));
      i = j;
      continue;
    }
    const q = /^([rRbBuUfF]{0,2})('''|"""|'|")/.exec(src.slice(i));
    if (q) {
      const quote = q[2];
      let j = i + q[1].length + quote.length;
      while (j < src.length) {
        if (src[j] === '\\') {
          j += 2;
          continue;
        }
        if (src.startsWith(quote, j)) {
          j += quote.length;
          break;
        }
        j++;
      }
      push('p', plain);
      plain = '';
      push('c-st', src.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      push('p', plain);
      plain = '';
      push(KW.has(word) ? 'c-kw' : BI.has(word) ? 'c-fn' : 'p', word);
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      push('p', plain);
      plain = '';
      push('c-num', src.slice(i, j));
      i = j;
      continue;
    }
    plain += ch;
    i++;
  }
  push('p', plain);
  return out;
}

/** 刚被拖的那个旋钮，对应格式串里的哪一段——把它点亮，学生才知道滑块和代码是同一件事。 */
function markSeg(src: string, mark?: string): ReactNode {
  if (!mark || !src.includes(mark)) return src;
  const out: ReactNode[] = [];
  let i = 0;
  for (;;) {
    const j = src.indexOf(mark, i);
    if (j < 0) break;
    if (j > i) out.push(src.slice(i, j));
    out.push(<span key={'h' + j} className="c-hot">{mark}</span>);
    i = j + mark.length;
  }
  if (i < src.length) out.push(src.slice(i));
  return out;
}

/** 字符串里的 {…} 才是这节课的主角,单独点出来。 */
function renderString(tok: Tok, key: string, mark?: string) {
  const parts = tok.v.split(/(\{[^{}]*\})/g);
  return (
    <span key={key} className="c-st">
      {parts.map((p, n) => (p.startsWith('{') ? <span key={n} className="c-fs">{markSeg(p, mark)}</span> : <Fragment key={n}>{p}</Fragment>))}
    </span>
  );
}

export function Code({ children, mark }: { children: string; mark?: string | null }) {
  const toks = scan(children);
  return <pre className="code">{toks.map((t, i) => (t.k === 'c-st' ? renderString(t, 's' + i, mark || undefined) : t.k === 'p' ? <Fragment key={'p' + i}>{t.v}</Fragment> : <span key={'k' + i} className={t.k}>{t.v}</span>))}</pre>;
}
