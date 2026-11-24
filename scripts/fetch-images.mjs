// 青养 · 课程演示图片抓取脚本（v2：多查询词 + URL 过滤 + 哈希去重）
// 说明：本机 HTTPS(443) 不可达、HTTP(80) 可用，因此使用 Bing 图片搜索（HTTP）抓取公开图片，
// 原始字节保存到 assets/_raw/<kind>-<id>.bin，随后由 scripts/finalize-images.py 统一转码压缩为
// assets/<kind>/<id>.jpg（前端按 id 引用，缺图自动回退文字占位）。
//
// 用法：
//   node scripts/fetch-images.mjs                      # 只补缺失项
//   node scripts/fetch-images.mjs --kinds dishes,teas  # 只处理指定类别
//   node scripts/fetch-images.mjs --refresh            # 强制重抓（并清掉旧文件）
//
// 命名约定：assets/herbs/<物质id>.jpg | assets/dishes/<药膳id>.jpg | assets/teas/<茶饮id>.jpg

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'assets', '_raw');
const SOURCES = path.join(ROOT, 'assets', '_sources.json');
fs.mkdirSync(RAW, { recursive: true });

const args = process.argv.slice(2);
const ONLY_KINDS = (() => {
  const i = args.indexOf('--kinds');
  return i >= 0 ? new Set(String(args[i + 1] || '').split(',').map((s) => s.trim()).filter(Boolean)) : null;
})();
const REFRESH = args.includes('--refresh');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(url, { timeout = 9000, redirects = 2 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      url,
      {
        headers: { 'User-Agent': UA, Accept: 'text/html,image/*,*/*', 'Accept-Language': 'zh-CN,zh;q=0.9' },
        timeout,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          let next;
          try {
            next = new URL(res.headers.location, url).toString();
          } catch {
            return reject(new Error('bad-redirect'));
          }
          if (next.startsWith('https://')) return reject(new Error('https-redirect'));
          return get(next, { timeout, redirects: redirects - 1 }).then(resolve, reject);
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, type: String(res.headers['content-type'] || ''), body: Buffer.concat(chunks) })
        );
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function parseEntities(file, quote) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const re =
    quote === 'double' ? /"id":\s*"([^"]+)",\s*"name":\s*"([^"]+)"/g : /id:\s*'([^']+)',\s*name:\s*'([^']+)'/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push({ id: m[1], name: m[2] });
  return out;
}

const KINDS = [
  { kind: 'herbs', file: 'js/data/substances.js', quote: 'double', queries: (n) => [`${n} 中药材`, `${n} 饮片`] },
  { kind: 'dishes', file: 'js/data/recipes.js', quote: 'double', queries: (n) => [`${n} 做法`, `${n}`, `${n} 食谱`] },
  { kind: 'teas', file: 'js/data/teas.js', quote: 'single', queries: (n) => [`${n} 茶饮`, `${n}`] },
];

const BAD_URL = /logo|icon|avatar|sprite|banner|qrcode|advert|\/ad\/|sobaidu|(^|\/)(ad|ads|gg)\//i;

function candidatesFrom(html) {
  const urls = [];
  for (const re of [/murl&quot;:&quot;(http[^&]+?)&quot;/g, /"murl":"(http[^"]+)"/g]) {
    let m;
    while ((m = re.exec(html))) {
      let u = m[1].replace(/&amp;/g, '&');
      if (u.startsWith('//')) u = 'http:' + u;
      urls.push(u);
    }
  }
  return [...new Set(urls)].filter((u) => /^http:\/\//.test(u) && !/\.(gif|svg)(\?|$)/i.test(u) && !BAD_URL.test(u));
}

async function searchImageUrls(query) {
  const url = `http://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  const res = await get(url, { timeout: 14000 });
  if (res.status !== 200) throw new Error('search-status-' + res.status);
  return candidatesFrom(res.body.toString('utf8'));
}

function looksLikeImage(res) {
  if (res.status !== 200 || !/^image\//i.test(res.type)) return false;
  const size = res.body.length;
  return size >= 25 * 1024 && size <= 3.5 * 1024 * 1024;
}

async function tryDownload(url) {
  for (const alt of url.startsWith('https://') ? ['http://' + url.slice(8), url] : [url]) {
    try {
      const res = await get(alt, { timeout: 9000 });
      if (looksLikeImage(res)) return { url: alt, body: res.body };
    } catch {
      /* 下一个候选 */
    }
  }
  return null;
}

const manifest = fs.existsSync(SOURCES)
  ? JSON.parse(fs.readFileSync(SOURCES, 'utf8'))
  : { generatedAt: '', note: '', items: {} };
manifest.items = manifest.items || {};

function md5(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

function loadUsedHashes(exceptKey) {
  const used = new Map();
  for (const f of fs.readdirSync(RAW)) {
    if (!f.endsWith('.bin')) continue;
    const key = f.slice(0, -4);
    if (key === exceptKey) continue;
    try {
      used.set(md5(fs.readFileSync(path.join(RAW, f))), key);
    } catch {
      /* ignore */
    }
  }
  return used;
}

async function run() {
  manifest.generatedAt = new Date().toISOString();
  manifest.note = '图片来自 Bing 图片搜索的公开网页图片，仅用于课程演示与学习，版权归原作者所有。';
  const all = [];
  for (const k of KINDS) {
    if (ONLY_KINDS && !ONLY_KINDS.has(k.kind)) continue;
    for (const e of parseEntities(k.file, k.quote)) all.push({ ...k, ...e });
  }
  console.log(`待处理条目: ${all.length}${ONLY_KINDS ? '（类别：' + [...ONLY_KINDS].join(',') + '）' : ''}`);

  let okCount = 0;
  let done = 0;
  for (const e of all) {
    const key = `${e.kind}-${e.id}`;
    const rawPath = path.join(RAW, key + '.bin');
    done++;
    if (!REFRESH && fs.existsSync(rawPath) && manifest.items[key]?.ok) {
      okCount++;
      continue;
    }
    if (REFRESH && fs.existsSync(rawPath)) {
      try {
        fs.unlinkSync(rawPath);
      } catch {
        /* ignore */
      }
    }
    const used = loadUsedHashes(key);
    let picked = null;
    let tried = 0;
    const variants = e.queries(e.name);
    for (const q of variants) {
      if (picked) break;
      let urls = [];
      try {
        urls = await searchImageUrls(q);
      } catch (err) {
        console.log(`[${done}/${all.length}] 搜索失败 ${q}: ${err.message}`);
        continue;
      }
      for (const u of urls.slice(0, 10)) {
        tried++;
        const got = await tryDownload(u);
        if (!got) continue;
        const h = md5(got.body);
        if (used.has(h)) continue; // 与别的条目重复 → 继续找
        picked = got;
        used.set(h, key);
        break;
      }
    }
    if (picked) {
      fs.writeFileSync(rawPath, picked.body);
      manifest.items[key] = { kind: e.kind, id: e.id, name: e.name, source: picked.url, bytes: picked.body.length, ok: true };
      okCount++;
      console.log(`[${done}/${all.length}] OK ${key} ${(picked.body.length / 1024).toFixed(0)}KB (试${tried})`);
    } else {
      manifest.items[key] = { kind: e.kind, id: e.id, name: e.name, source: '', bytes: 0, ok: false };
      console.log(`[${done}/${all.length}] 失败 ${key}（试${tried}）`);
    }
    fs.writeFileSync(SOURCES, JSON.stringify(manifest, null, 2));
    await sleep(220);
  }
  console.log(`完成：成功 ${okCount}/${all.length}`);
}

run().catch((e) => {
  console.error('抓取脚本异常：', e);
  process.exit(1);
});