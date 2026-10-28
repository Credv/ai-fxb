/* 把两个 app 的构建产物拼成一份 Cloudflare Pages 输出:
 *   简历      apps/resume/dist   → dist/          (3ecat.me/)
 *   AI 窗口   apps/console/dist  → dist/ai-fxb/   (3ecat.me/ai-fxb/)
 * 产物目录不入库,只入库源码与 _headers;CF 云端构建跑同一个脚本。
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');

const jobs = [
  { name: '简历', src: join(root, 'apps', 'resume', 'dist'), dest: out },
  { name: 'AI 窗口', src: join(root, 'apps', 'console', 'dist'), dest: join(out, 'ai-fxb') }
];

const missing = jobs.filter((j) => !existsSync(join(j.src, 'index.html')));
if (missing.length) {
  console.error('构建产物缺失(先跑 npm run build,或单独构建对应 workspace):');
  missing.forEach((j) => console.error('  ' + j.name + ' → ' + j.src + ' 里没有 index.html'));
  process.exit(1);
}

const headersFile = join(root, '_headers');
if (!existsSync(headersFile)) {
  console.error('缺少 ' + headersFile + ':缓存策略是发布的一部分,不能省。');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
jobs.forEach((j) => cpSync(j.src, j.dest, { recursive: true }));
writeFileSync(join(out, '_headers'), readFileSync(headersFile));

function dirBytes(p) {
  return readdirSync(p).reduce((total, name) => {
    const st = statSync(join(p, name));
    return total + (st.isDirectory() ? dirBytes(join(p, name)) : st.size);
  }, 0);
}

jobs.forEach((j) => {
  console.log(j.name + ' → ' + j.dest.replace(root, '.') + '/  ' + Math.round(dirBytes(j.dest) / 1024) + ' KB');
});
console.log('发布目录:dist/');
