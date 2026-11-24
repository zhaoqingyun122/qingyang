// 青养 · 课程演示图片抓取脚本（v3：按标题/来源页相关性筛选，尽量保证"图对得上名"）
//
// 原理：本机 HTTPS(443) 不可达、HTTP(80) 可用，因此走 Bing 图片搜索（HTTP）。
// Bing 结果页每条结果都有一个 m="{...}" 属性，内含 murl（图片地址）、t（图片标题）、purl（来源页）。
// 本脚本解析这些元数据，只保留「标题或来源页包含条目名称」的图片，并优先中药/药材/药典类来源，
// 其余无关图一律丢弃（宁可缺图用示意图占位，也不要张冠李戴）。
//
// 用法：
//   node scripts/fetch-images.mjs                      # 只补缺失项
//   node scripts/fetch-images.mjs --kinds herbs        # 只处理指定类别
//   node scripts/fetch-images.mjs --refresh            # 清空重抓
//   node scripts/fetch-images.mjs --refresh --kinds herbs
//
// 人工指定查询：assets/image-queries.json，形如 { "herbs-shan-yao": "山药 中国药典 饮片" }
//   （用于某一条老是抓不对时，手工指定更精确的搜索词）
//
// 输出：原始字节 assets/_raw/<kind>-<id>.bin，来源记录 assets/_sources.json
// 命名约定：assets/herbs/<物质id>.jpg | assets/dishes/<药膳id>.jpg | assets/teas/<茶饮id>.jpg

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'assets', '_raw');
const SOURCES = path.join(ROOT, 'assets', '_sources.json');
const OVERRIDES = path.join(ROOT, 'assets', 'image-queries.json');
fs.mkdirSync(RAW, { recursive: true });

const args = process.argv.slice(2);
const ONLY_KINDS = (() => {
  const i = args.indexOf('--kinds');
  return i >= 0 ? new Set(String(args[i + 1] || '').split(',').map((s) => s.trim()).filter(Boolean)) : null;
})();
const REFRESH = args.includes('--refresh');
// --shopping：改用购物图源（淘宝/1688/京东商品主图，实物拍摄），主要给药材用
const SHOP_MODE = args.includes('--shopping');
// --only herbs-shan-yao,dishes-si-shen-tang：只处理指定条目（配合 --refresh 可单条重抓）
const ONLY_KEYS = (() => {
  const i = args.indexOf('--only');
  return i >= 0 ? new Set(String(args[i + 1] || '').split(',').map((s) => s.trim()).filter(Boolean)) : null;
})();
const overrides = fs.existsSync(OVERRIDES) ? JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')) : {};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(url, { timeout = 9000, redirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      url,
      { headers: { 'User-Agent': UA, Accept: 'text/html,image/*,*/*', 'Accept-Language': 'zh-CN,zh;q=0.9' }, timeout },
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
        res.on('end', () => resolve({ status: res.statusCode, type: String(res.headers['content-type'] || ''), body: Buffer.concat(chunks) }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function parseEntities(file, quote) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const re = quote === 'double' ? /"id":\s*"([^"]+)",\s*"name":\s*"([^"]+)"/g : /id:\s*'([^']+)',\s*name:\s*'([^']+)'/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push({ id: m[1], name: m[2] });
  // 药材补充别名（如 山药/怀山、龙眼肉/桂圆），便于标题匹配
  if (file.includes('substances')) {
    const blocks = src.split(/\n  \{\n/).slice(1);
    for (const b of blocks) {
      const idm = b.match(/"id":\s*"([^"]+)"/);
      const am = b.match(/"alias":\s*\[([\s\S]*?)\]/);
      if (!idm) continue;
      const rec = out.find((x) => x.id === idm[1]);
      if (rec && am) {
        rec.aliases = [...am[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
      }
    }
  }
  return out;
}

// 购物模式下给容易混淆的条目更精确的搜词（如 小米 → 黄小米杂粮，而不是小米手机）
const SHOP_HINT = {
  'xiao-mi': '黄小米 五谷杂粮 真空',
  'yan-mai': '燕麦片 即食 杂粮',
  'hei-zhi-ma': '黑芝麻 生 杂粮',
  'chi-xiao-dou': '赤小豆 长粒 杂粮',
  'bai-bian-dou': '白扁豆 杂粮 干货',
  'long-yan-rou': '桂圆肉 无核 干货',
  'ju-hua': '杭白菊 胎菊 干货',
  'ge-gen': '葛根片 干货 中药材',
  'lv-dou': '绿豆 杂粮 干货',
  'hei-dou': '黑豆 杂粮 干货',
  'huang-qi': '黄芪片 中药材 干货',
};

const KINDS = [
  {
    kind: 'herbs',
    file: 'js/data/substances.js',
    quote: 'double',
    // 药材用「名称 + 中药材」最准；再试中药饮片与别名（如 龙眼肉/桂圆）
    queries: (e) => {
      if (SHOP_MODE) {
        const hint = SHOP_HINT[e.id];
        const list = hint ? [`${hint} 淘宝`, hint, `${hint} 1688`] : [];
        // 通用商品词兜底（1688 商品图通常带「干货/中药材/500g」字样）
        list.push(`${e.name} 干货 中药材 淘宝`, `${e.name} 500g`, `${e.name} 中药材 1688`);
        return list;
      }
      const list = [`${e.name} 中药材`, `${e.name} 药材图谱`, `${e.name} 中药大全`, `${e.name} 360百科`];
      for (const a of (e.aliases || []).slice(0, 2)) list.push(`${a} 中药材`);
      return list;
    },
  },
  {
    kind: 'dishes',
    // 经验：菜名后面追加词会被 Bing 拆词、退回成单味食材图；菜名单独查反而能命中菜谱页
    file: 'js/data/recipes.js',
    quote: 'double',
    queries: (e) => [e.name, `${e.name} 图片`],
  },
  // 茶饮同理，名字单独查
  { kind: 'teas', file: 'js/data/teas.js', quote: 'single', queries: (e) => [e.name, `${e.name} 茶`] },
];

/** 形近但不同种的药材：标题里出现这些名字时降权（如 土茯苓 ≠ 茯苓、野菊花 ≠ 菊花） */
const CONFUSABLE = {
  茯苓: ['土茯苓', '茯苓皮'],
  菊花: ['野菊花', '雪菊', '昆仑雪菊'],
  山药: ['木薯', '淮山粉'],
  葛根: ['葛花'],
  肉桂: ['桂枝', '桂皮'],
  麦冬: ['土麦冬'],
  小米: ['小米手机', '小米椒', '小米电视', '小米笔记本', '小米粥', '小米饭', '小米空气'],
  百合: ['百合花', '百合网'],
  莲子: ['莲子心', '莲子羹'],
  山楂: ['山楂片', '山楂糕', '糖葫芦'],
  生姜: ['生姜洗发', '生姜红糖'],
};

// 购物平台图片 CDN（商品主图基本都是实物拍摄，且这些域名走 HTTP 可达）
const SHOP_HOSTS = ['alicdn.com', 'taobao.com', 'tmall.com', '1688.com', '360buyimg.com', 'jd.com', 'suning.com', 'yhd.com'];
const SHOP_WORDS = ['中药材', '中药', '药材', '饮片', '干货', '杂粮', '五谷', '正宗', '农家', '原产地', '野生', '无硫', '散装'];

/** 从结果页解析 [{murl, t, purl}] */
function parseResults(html) {
  const items = [];
  for (const m of html.matchAll(/ m="([^"]+)"/g)) {
    try {
      const o = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      if (o.murl) items.push({ murl: String(o.murl), turl: String(o.turl || ''), t: String(o.t || ''), purl: String(o.purl || '') });
    } catch {
      /* 忽略坏数据 */
    }
  }
  return items;
}

const GOOD_HERB = ['中药材', '中药', '药材', '药典', '饮片', '本草', '性状', '图谱', '中药大全', '中药网', '植物志', '药用'];
// 权威参考图（药典/图谱/百科类）显著加权，优先于普通网络图
const REF_HERB = /药材图谱|中华药典|中药大全|360百科|百度百科|中华康网|中药图谱|中国药典/;
const GOOD_DISH = ['做法', '食谱', '家常', '汤', '粥', '羹', '饮', '药膳', '蒸', '炖'];
const GOOD_TEA = ['茶', '饮', '配方', '泡'];
const TRUSTED = ['zhongyao360.com', 'cnkang.com', 'zhongyoo.com', '39.net', 'xywy.com', 'yiyao', 'baike', 'dayi.org.cn', 'tcm', 'herb', 'yaocai', 'zhongcao'];

/** 把条目名切成 2 字词（去掉汤/粥/茶等通用字），用于匹配标题里的菜名 */
function tokens(name) {
  const cleaned = name.replace(/[汤粥羹茶饮糊水炒蒸炖膏露]/g, '');
  const parts = [];
  for (let i = 0; i + 2 <= cleaned.length; i += 2) parts.push(cleaned.slice(i, i + 2));
  if (cleaned.length % 2 === 1) parts.push(cleaned.slice(-2));
  return parts.filter((p) => p.length === 2);
}

/** 相关性打分：药材要求名称/别名出现；药膳与茶饮用分词匹配（-99 淘汰） */
function score(item, e, kind) {
  const t = item.t;
  let p = item.purl;
  try {
    p = decodeURIComponent(p);
  } catch {
    /* ignore */
  }
  if (/\.(gif|svg)(\?|$)/i.test(item.murl)) return -99;

  if (kind === 'herbs') {
    const names = [e.name, ...(e.aliases || [])].filter(Boolean);
    const alt = e.name.replace(/[子仁叶皮花根茎段]$/, '');
    const hit = names.some((n) => t.includes(n) || p.includes(n)) || (alt.length >= 2 && (t.includes(alt) || p.includes(alt)));
    if (!hit) return -99;
    let s = 3;
    if (GOOD_HERB.some((w) => t.includes(w) || p.includes(w))) s += 2;
    if (REF_HERB.test(t) || REF_HERB.test(p)) s += 4;
    if (/药典/.test(t) || /药典/.test(p)) s += 2;
    let host = '';
    try {
      host = new URL(p).hostname;
    } catch {
      /* ignore */
    }
    // 购物图源模式：收商品图（来源页或图片本身在购物平台 CDN 即可，比价站也算）
    if (SHOP_MODE) {
      let mhost = '';
      try {
        mhost = new URL(item.murl).hostname;
      } catch {
        /* ignore */
      }
      if (!SHOP_HOSTS.some((d) => host.includes(d) || mhost.includes(d))) return -99;
      let shopScore = 4;
      if (SHOP_WORDS.some((w) => t.includes(w) || p.includes(w))) shopScore += 2;
      if (/淘宝|天猫|1688|京东/.test(t)) shopScore += 1;
      const conf = CONFUSABLE[e.name] || [];
      if (conf.some((c) => t.includes(c) || p.includes(c))) shopScore -= 8;
      return shopScore;
    }
    // 商品/包装页与菜谱页降权
    if (/(菜谱|美食|好吃|价格|优惠|批发|加盟|旗舰店|多少|禁忌|副作用|袋装|瓶装|包邮|现货|土特产|\d+\s*(g|克|斤|kg))/.test(t)) s -= 3;
    // 形近但不同种：出现"土茯苓""野菊花"等直接重罚
    const confusable = CONFUSABLE[e.name] || [];
    if (confusable.some((c) => t.includes(c) || p.includes(c))) s -= 6;
    if (TRUSTED.some((d) => host.includes(d))) s += 2;
    return s;
  }

  // 药膳 / 茶饮：分词命中 ≥1，且标题要像"吃/喝"的内容；商品/广告页直接淘汰
  const SPAM = /(价格|优惠|批发|加盟|旗舰店|外卖|团购|现货|包邮|袋装|瓶装|多少钱|淘宝|天猫|京东自营|\d+\s*(g|克|斤|kg))/;
  if (SPAM.test(t) || SPAM.test(p)) return -99;
  const toks = tokens(e.name);
  const hitToks = toks.filter((x) => t.includes(x) || p.includes(x));
  if (!hitToks.length) return -99;
  const words = kind === 'dishes' ? GOOD_DISH : GOOD_TEA;
  if (!words.some((w) => t.includes(w) || p.includes(w))) return -99;
  let s = 2 + Math.min(3, hitToks.length);
  if (hitToks.length >= 2) s += 1;
  if (/做法|食谱|家常|教程|步骤/.test(t)) s += 2;
  let host = '';
  try {
    host = new URL(p).hostname;
  } catch {
    /* ignore */
  }
  if (TRUSTED.some((d) => host.includes(d))) s += 1;
  return s;
}

async function searchCandidates(query, e, kind) {
  const url = `http://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await get(url, { timeout: 15000 });
      if (res.status !== 200) {
        await sleep(1500 + attempt * 2000);
        continue;
      }
      const items = parseResults(res.body.toString('utf8'));
      if (!items.length) {
        // 空结果常见于限流：等一会儿再试
        await sleep(2000 + attempt * 2500);
        continue;
      }
      const scored = items
        .map((it) => ({ ...it, score: score(it, e, kind) }))
        .filter((it) => it.score > 0)
        .sort((a, b) => b.score - a.score);
      if (scored.length) return scored;
      await sleep(1200);
    } catch {
      await sleep(1500 + attempt * 2000);
    }
  }
  return [];
}

function looksLikeImage(res, min = 25 * 1024) {
  if (res.status !== 200 || !/^image\//i.test(res.type)) return false;
  return res.body.length >= min && res.body.length <= 3.5 * 1024 * 1024;
}

async function tryDownload(url, min = 25 * 1024) {
  for (const alt of url.startsWith('https://') ? ['http://' + url.slice(8), url] : [url]) {
    try {
      const res = await get(alt, { timeout: 9000 });
      if (looksLikeImage(res, min)) return { url: alt, body: res.body };
    } catch {
      /* 下一个候选 */
    }
  }
  return null;
}

/** 先试原图（清晰），失败再退 Bing 缩略图（ts*.mm.bing.net 走 HTTP 稳定可达） */
async function downloadBest(item) {
  const orig = await tryDownload(item.murl, 25 * 1024);
  if (orig) return { ...orig, via: 'origin' };
  if (item.turl) {
    const thumb = await tryDownload(String(item.turl).replace(/^https:/, 'http:'), 8 * 1024);
    if (thumb) return { ...thumb, via: 'thumb' };
  }
  return null;
}

const manifest = fs.existsSync(SOURCES) ? JSON.parse(fs.readFileSync(SOURCES, 'utf8')) : { items: {} };
manifest.items = manifest.items || {};
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

function usedHashes(exceptKey) {
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
  manifest.note = '图片来自 Bing 图片搜索的公开网页图片（按标题关联筛选），仅用于课程演示与学习，版权归原作者所有。';
  const all = [];
  for (const k of KINDS) {
    if (ONLY_KINDS && !ONLY_KINDS.has(k.kind)) continue;
    for (const e of parseEntities(k.file, k.quote)) {
      const key = `${k.kind}-${e.id}`;
      if (ONLY_KEYS && !ONLY_KEYS.has(key) && !ONLY_KEYS.has(e.id)) continue;
      all.push({ ...k, ...e });
    }
  }
  console.log(`待处理 ${all.length} 条`);

  let ok = 0;
  let done = 0;
  for (const e of all) {
    const key = `${e.kind}-${e.id}`;
    const rawPath = path.join(RAW, key + '.bin');
    done++;
    if (!REFRESH && fs.existsSync(rawPath) && manifest.items[key]?.ok) {
      ok++;
      continue;
    }
    if (fs.existsSync(rawPath)) {
      try {
        fs.unlinkSync(rawPath);
      } catch {
        /* ignore */
      }
    }
    const used = usedHashes(key);
    const custom = overrides[key] || overrides[e.id];
    const queries = custom ? [custom] : e.queries(e);
    let picked = null;
    let best = null;
    for (const q of queries) {
      if (picked) break;
      let cands = [];
      try {
        cands = await searchCandidates(q, e, e.kind);
      } catch (err) {
        console.log(`  [${done}/${all.length}] 搜索失败 ${q}: ${err.message}`);
        continue;
      }
      if (process.env.QY_DEBUG) console.log(`    debug「${q}」候选 ${cands.length} 条` + (cands[0] ? ` 最高「${cands[0].t.slice(0, 30)}」s=${cands[0].score}` : ''));
      if (!best && cands.length) best = cands[0];
      for (const c of cands.slice(0, 8)) {
        const got = await downloadBest(c);
        if (!got) continue;
        const h = md5(got.body);
        if (used.has(h)) continue;
        used.set(h, key);
        picked = { ...got, title: c.t, page: c.purl, score: c.score, query: q };
        break;
      }
    }
    if (picked) {
      fs.writeFileSync(rawPath, picked.body);
      manifest.items[key] = {
        kind: e.kind,
        id: e.id,
        name: e.name,
        source: picked.url,
        page: picked.page,
        title: picked.title,
        score: picked.score,
        query: picked.query,
        via: picked.via,
        bytes: picked.body.length,
        ok: true,
      };
      ok++;
      console.log(`[${done}/${all.length}] OK ${key} s=${picked.score} 「${picked.title.slice(0, 30)}」`);
    } else {
      manifest.items[key] = { kind: e.kind, id: e.id, name: e.name, source: '', ok: false };
      console.log(`[${done}/${all.length}] 无合格图片 ${key}${best ? `（最高分候选：「${best.t.slice(0, 26)}」s=${best.score}）` : ''}`);
    }
    fs.writeFileSync(SOURCES, JSON.stringify(manifest, null, 2));
    await sleep(700);
    if (done % 12 === 0) {
      console.log('  …… 已处理 ' + done + ' 条，暂停 15 秒避免被限流');
      await sleep(15000);
    }
  }
  console.log(`完成：成功 ${ok}/${all.length}`);
}

run().catch((e) => {
  console.error('抓取异常：', e);
  process.exit(1);
});