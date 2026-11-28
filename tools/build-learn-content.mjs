/* 把 apps/learn/content/private/cert.json 的明文加密成 apps/learn/public/data/content.json。
 *
 * 私密区只保留教资备考:三科讲义、练习、参考答案、冲刺计划与官方来源。
 *
 * 为什么要绕这一圈:仓库是 public 的,而前端没有后端,把密码判断写进 JS 等于没锁。
 * 明文只留本机(content/private/ 已 gitignore),入库的只有 AES-256-GCM 密文;
 * 浏览器里用输入的密码 PBKDF2 派生同一把密钥去解,密码错了 GCM 校验直接失败。
 *
 * 用法(密码只出现在这一行命令里,不写进任何文件):
 *   AIFXB_LEARN_PASSWORD=xxxxxxxx npm run learn:data
 *
 * 构建产物 content.json 需要跟着提交(CF 云端构建不会再跑这个脚本,它只拷 public/)。
 */
import { webcrypto as crypto } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'apps', 'learn', 'content', 'private');
const outFile = join(root, 'apps', 'learn', 'public', 'data', 'content.json');

const ITERATIONS = 210000;
const HASH = 'SHA-256';

const password = process.env.AIFXB_LEARN_PASSWORD || '';
if (!password) {
  console.error('没拿到密码:这条命令必须显式给一次,它不会存进仓库任何文件。');
  console.error('  AIFXB_LEARN_PASSWORD=<备课台密码> npm run learn:data');
  console.error('忘了密码就去问站长本人;线上访客用的也是同一个。');
  process.exit(1);
}
if (password.length < 6) {
  console.error('密码太短(' + password.length + ' 位):这是仓库里唯一的内容闸门,别用 4 位数字糊它。');
  process.exit(1);
}

if (!existsSync(contentDir)) {
  console.error('私密内容目录不存在:' + contentDir);
  console.error('私密区的明文只在本机、不入库;丢了就只剩旧密文,写不进新东西。');
  process.exit(1);
}

const files = readdirSync(contentDir).filter((f) => f.endsWith('.json')).sort();
if (files.length !== 1 || files[0] !== 'cert.json') {
  console.error('私密区只保留 cert.json;当前文件:' + (files.join('、') || '空'));
  process.exit(1);
}

const parts = {};
for (const f of files) {
  const id = f.replace(/\.json$/, '');
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(contentDir, f), 'utf8'));
  } catch (e) {
    console.error('内容文件不是合法 JSON:' + f);
    console.error(String(e && e.message ? e.message : e));
    process.exit(1);
  }
  parts[id] = parsed;
  console.log('  · ' + id.padEnd(10) + ' ' + String(files.length ? countBlocks(parsed) : '').padStart(3) + ' 个顶层字段');
}

const plaintext = JSON.stringify({ builtAt: stamp(), parts });
const plainBytes = new TextEncoder().encode(plaintext);

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH },
  baseKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt']
);
const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBytes);
const ct = new Uint8Array(ctBuf);

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify({
    v: 1,
    kdf: { name: 'PBKDF2', hash: HASH, iterations: ITERATIONS },
    cipher: 'AES-256-GCM',
    salt: b64(salt),
    iv: b64(iv),
    ct: b64(ct),
    builtAt: stamp(),
    parts: Object.keys(parts).sort(),
    plainBytes: plainBytes.length,
    cipherBytes: ct.length
  })
);

function countBlocks(o) {
  return o && typeof o === 'object' ? Object.keys(o).length : 0;
}

console.log('密文 → ' + outFile.replace(root, '.'));
console.log(
  '明文 ' + kb(plainBytes.length) + ' → 密文 ' + kb(ct.length) +
  ' · ' + ITERATIONS + ' 轮 PBKDF2-' + HASH + ' · 内容片段 ' + Object.keys(parts).join('/')
);
console.log('下一步:content/private/ 的明文别提交(已在 .gitignore),把 ' + outFile.replace(root, '.') + ' 一起提交上去。');
console.log('改内容就改 content/private/cert.json,重跑这一脚本,再把 content.json 提交。');

function kb(n) {
  return (n / 1024).toFixed(1) + ' KB';
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function b64(u8) {
  return Buffer.from(u8).toString('base64');
}
