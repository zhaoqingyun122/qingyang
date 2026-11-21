// 青养 · 本地服务器（零依赖，仅绑定 127.0.0.1，供本机浏览器使用）
// 用法：双击「启动青养.cmd」，或 node scripts/server.mjs [--port 5173] [--no-open]

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

// 只对外提供网页运行所需的静态资源类型
const SAFE_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.md', '.txt', '.png', '.webp', '.ico']);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const port = Number(argValue('--port') || process.env.QINGYANG_PORT || 5173);
const shouldOpen = !process.argv.includes('--no-open');

function safeResolve(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const abs = path.resolve(ROOT, '.' + rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null; // 防目录穿越
  return abs;
}

async function sendFile(req, res, abs) {
  const ext = path.extname(abs).toLowerCase();
  // 先做类型白名单：脚本、配置、隐藏文件一律不对外提供（只服务网页运行所需的静态资源）
  if (!SAFE_EXT.has(ext)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 未找到');
    return;
  }
  let stat;
  try {
    stat = await fsp.stat(abs);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 未找到：' + path.relative(ROOT, abs));
    return;
  }
  if (stat.isDirectory()) {
    return sendFile(req, res, path.join(abs, 'index.html'));
  }
  const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { etag });
    res.end();
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': 'no-store, must-revalidate',
    etag,
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(abs).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      return res.end('Method Not Allowed');
    }
    const abs = safeResolve(req.url || '/');
    if (!abs) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('403 禁止访问');
    }
    // 兼容 history 路由：无扩展名的路径回退到 index.html
    if (!path.extname(abs)) return sendFile(req, res, path.join(ROOT, 'index.html'));
    await sendFile(req, res, abs);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('500 服务器错误：' + err.message);
  }
});

function openBrowser(url) {
  const cmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  try {
    exec(cmd, (err) => {
      if (err) console.log(`  （未能自动打开浏览器，请手动访问 ${url}）`);
    });
  } catch {
    // 受限环境/无默认浏览器：spawn 同步失败时不崩溃，提示手动访问
    console.log(`  （未能自动打开浏览器，请手动访问 ${url}）`);
  }
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n端口 ${port} 已被占用。可能青养已经在运行：http://${HOST}:${port}/\n也可以换端口启动：node scripts/server.mjs --port 5174\n`);
    if (shouldOpen) openBrowser(`http://${HOST}:${port}/`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

server.listen(port, HOST, () => {
  const url = `http://${HOST}:${port}/`;
  console.log('');
  console.log('  🌿 青养 · 食疗健康生活 已启动');
  console.log('  ───────────────────────────────');
  console.log(`  浏览器地址：${url}`);
  console.log('  数据保存在本机浏览器（IndexedDB），关闭页面不会丢失。');
  console.log('  关闭本窗口即停止服务；需要时重新双击「启动青养.cmd」。');
  console.log('');
  if (shouldOpen) openBrowser(url);
});
