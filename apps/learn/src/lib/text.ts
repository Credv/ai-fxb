/** Python 的 len() 数的是字符个数，一个中文算 1；屏幕上中文占 2 列。
 *  这两件事不一样，而"格式化的表为什么歪了"正是从这里来的。
 *  所以补位一律按 Python 的规则（plen），显示列（dw）只在讲这个坑的时候用。 */
export function plen(s: string): number {
  return [...s].length;
}

/** 屏幕上占几格。中文、日文、全角标点一个占 2 格，其余占 1 格。
 *  注意 U+4E00–U+9FFF（常用汉字整段）必须在里面，否则「张伟」会被数成 2 格，这一课的例子就演示不出来了。 */
function isWide(c: number): boolean {
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0x303e) ||
    (c >= 0x3041 && c <= 0x33ff) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0xa000 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe6b) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1f64f) ||
    (c >= 0x1f900 && c <= 0x1f9ff) ||
    c >= 0x20000
  );
}

export function dw(s: string): number {
  let n = 0;
  for (const ch of s) {
    n += isWide(ch.codePointAt(0) || 0) ? 2 : 1;
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

function bump(digits: string): string {
  const a = digits.split('');
  let i = a.length - 1;
  while (i >= 0) {
    if (a[i] === '9') {
      a[i] = '0';
      i--;
    } else {
      a[i] = String(Number(a[i]) + 1);
      break;
    }
  }
  if (i < 0) a.unshift('1');
  return a.join('');
}

/** Python 的舍入是「四舍六入五成双」，JS 的 toFixed 是「五入」——1.25 留一位小数正好落在中间，
 *  Python 给 1.2，toFixed 给 1.3，而这个值是学生在参数面板里敲得出来的。
 *  toFixed 本身按二进制的精确值舍入，所以多取 20 位就能看出这一位是不是正中间，再手动成双。 */
function pyFixed(n: number, prec: number): string {
  const neg = n < 0 || Object.is(n, -0);
  const s = Math.abs(n).toFixed(prec + 20);
  if (s.indexOf('.') < 0) return (neg ? '-' : '') + n.toFixed(prec);
  const dot = s.indexOf('.');
  const ip = s.slice(0, dot);
  const keep = s.slice(dot + 1, dot + 1 + prec);
  const rest = s.slice(dot + 1 + prec);
  const first = rest.charCodeAt(0) - 48;
  const tie = first === 5 && /^0+$/.test(rest.slice(1));
  const lastKept = prec > 0 ? keep.charCodeAt(prec - 1) - 48 : ip.charCodeAt(ip.length - 1) - 48;
  const up = first > 5 || (first === 5 && (!tie || lastKept % 2 === 1));
  const digits = up ? bump(ip + keep) : ip + keep;
  const intPart = digits.slice(0, digits.length - prec) || '0';
  return (neg ? '-' : '') + intPart + (prec > 0 ? '.' + digits.slice(digits.length - prec) : '');
}

export function fmtValue(v: string, type: 'text' | 'num', prec: number): string {
  if (type !== 'num') return v;
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return prec > 0 ? pyFixed(n, prec) : String(n);
}
