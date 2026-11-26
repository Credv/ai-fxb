// 本地预览构建产物:与线上一样的三条路由(简历在 /,AI 窗口在 /ai-fxb,教案与课件在 /learn)。
// 用法: npm run build && npm run preview
// 手机/平板用日志里的局域网地址(需同一 WiFi);只监听本机: set HOST=127.0.0.1 && npm run preview
// 注意:/learn 的公开课件区局域网地址能看;私密区要 WebCrypto,只有 https 或 127.0.0.1 才开放。
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(root, 'dist');
const PORT = process.env.PORT ? Number(process.env.PORT) : 5178;
const HOST = process.env.HOST || '0.0.0.0';

// 子路径路由:前缀命中就用那一格的 index.html 兜底,根路由是简历。
const SUBS = [
  { prefix: '/ai-fxb', dir: path.join(ROOT, 'ai-fxb') },
  { prefix: '/learn', dir: path.join(ROOT, 'learn') },
  { prefix: '/exam', dir: path.join(ROOT, 'exam') }
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8'
};

function isFile(p) {
  return p.startsWith(ROOT) && fs.existsSync(p) && fs.statSync(p).isFile();
}

// 无扩展名的路径当作导航:落到所属路由的 index.html;带扩展名的找不到就是 404
function resolveFile(urlPath) {
  const rel = path.join(ROOT, path.normalize(urlPath));
  if (isFile(rel)) return rel;
  // 目录里带 index.html 的先照线上那样给那一份:学生版是 /learn/student/index.html 这个二级入口,
  // 少了这一层它会被当成导航,兜底到 /learn/index.html,本地预览就看到教师版了。
  const idx = path.join(rel, 'index.html');
  if (isFile(idx)) return idx;
  if (/\.[a-z0-9]+$/i.test(urlPath)) return null;
  const sub = SUBS.filter((s) => urlPath === s.prefix || urlPath.startsWith(s.prefix + '/'))[0];
  const html = path.join(sub ? sub.dir : ROOT, 'index.html');
  return isFile(html) ? html : null;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = resolveFile(urlPath);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + urlPath);
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('dist/ 里没有 index.html:先跑 npm run build(会依次构建 core、简历、控制台并拼装)。');
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log('站点预览已启动(产物来自 dist/)');
  console.log('  本机      →  http://127.0.0.1:' + PORT + '/         简历');
  console.log('  本机      →  http://127.0.0.1:' + PORT + '/ai-fxb/  AI 窗口');
  console.log('  本机      →  http://127.0.0.1:' + PORT + '/learn/   教案与课件(公开课件免密码;私密区 #/private 要密码,只能用 127.0.0.1)');
  console.log('  本机      →  http://127.0.0.1:' + PORT + '/exam/    模拟试卷(理论卷自动判分;操作卷需下载表格素材)');
  os.networkInterfaces && Object.values(os.networkInterfaces()).flat().forEach((i) => {
    if (i && i.family === 'IPv4' && !i.internal) {
      console.log('  手机/平板 →  http://' + i.address + ':' + PORT + '/ai-fxb/   (需同一 WiFi)');
      console.log('  手机/平板 →  http://' + i.address + ':' + PORT + '/learn/    公开课件(免密码;私密区只能 127.0.0.1 或线上 https)');
    }
  });
  console.log('API Key 只存在各设备自己的浏览器里,手机上需重新填一次。按 Ctrl+C 停止。');
});
