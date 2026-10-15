// 本地静态服务器(纯本地个人使用,无后端逻辑)
// 用法: node server.mjs   本机 http://127.0.0.1:5178,手机用日志里的局域网地址
// 只监听本机: set HOST=127.0.0.1 && node server.mjs
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'web');
const PORT = process.env.PORT ? Number(process.env.PORT) : 5178;
const HOST = process.env.HOST || '0.0.0.0';

function lanIPs() {
  return Object.values(os.networkInterfaces()).flat().filter(function (i) {
    return i && i.family === 'IPv4' && !i.internal;
  }).map(function (i) { return i.address; });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, path.normalize(urlPath));
  // 防目录穿越
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

server.listen(PORT, HOST, () => {
  console.log('AI 窗口 已启动');
  console.log('  本机    →  http://127.0.0.1:' + PORT);
  lanIPs().forEach(function (ip) {
    console.log('  手机/平板 →  http://' + ip + ':' + PORT + '   (需同一 WiFi)');
  });
  console.log('API Key 只存在各设备自己的浏览器里,手机上需重新填一次。按 Ctrl+C 停止。');
});
