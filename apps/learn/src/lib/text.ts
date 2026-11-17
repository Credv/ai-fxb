/** Python 的 len() 数的是字符个数，一个中文算 1；屏幕上中文占 2 列。
 *  这两件事不一样，而"格式化的表为什么歪了"正是从这里来的。
 *  所以补位一律按 Python 的规则（plen），显示列（dw）只在讲这个坑的时候用。 */
export function plen(s: string): number {
  return [...s].length;
}

export function dw(s: string): number {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) || 0;
    n += c > 0x1100 && (c < 0x2e80 || (c > 0x303f && c < 0x4e00) || (c > 0xa4cf && c < 0x11000) || c >= 0x1f300) ? 2 : 1;
  }
  return n;
}

export type Align = 'l' | 'r' | 'c';

export function pad(text: string, w: number, align: Align): { left: number; right: number } {
  const need = Math.max(0, w - plen(text));
  if (align === 'l') return { left: 0, right: need };
  if (align === 'r') return { left: need, right: 0 };
  return { left: Math.floor(need / 2), right: need - Math.floor(need / 2) };
}

export function cellSpans(text: string, w: number, align: Align): { left: string; body: string; right: string } {
  const p = pad(text, w, align);
  return { left: '·'.repeat(p.left), body: text, right: '·'.repeat(p.right) };
}

export function fmtValue(v: string, type: 'text' | 'num', prec: number): string {
  if (type !== 'num') return v;
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return prec > 0 ? n.toFixed(prec) : String(n);
}
