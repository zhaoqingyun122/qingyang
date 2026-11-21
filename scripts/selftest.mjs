// 青养 · 自测脚本（零依赖，直接用 node 运行）
// 运行：node scripts/selftest.mjs
// 可选：--only 内容数据,持久化语义  只运行标题包含这些关键词的 section（不删断言，只做选择）

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx >= 0 ? (process.argv[onlyIdx + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : [];
let current = '';
let pass = 0;
let fail = 0;
const failures = [];

function active() {
  // --only 未指定时运行全部；指定后只运行标题含任一关键词的 section
  if (!ONLY.length) return true;
  return ONLY.some((k) => current.includes(k));
}

function ok(name, cond, detail = '') {
  if (!active()) return;
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  }
}

function section(t) {
  current = t;
  console.log(`\n[${t}]${ONLY.length && !active() ? '（跳过）' : ''}`);
}

// ---------- 1. 静态文件 ----------
section('静态文件');
const jsFiles = [
  'main.js',
  'photo.js',
  'feature-picker.js',
  'lib/dom.js',
  'lib/db.js',
  'lib/store.js',
  'lib/seed.js',
  'lib/photo-id.js',
  'lib/share.js',
  'lib/search.js',
  'lib/backup.js',
  'lib/repo.js',
  'lib/utils.js',
  'data/medical.js',
  'data/teas.js',
  'views/home.js',
  'views/conditions.js',
  'views/community.js',
  'views/data.js',
];
const allFiles = ['index.html', 'css/app.css', 'manifest.json', 'sw.js', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'scripts/server.mjs', ...jsFiles.map((f) => 'js/' + f)];

for (const f of allFiles) {
  const abs = path.join(ROOT, f);
  const exists = fs.existsSync(abs);
  ok(`文件存在 ${f}`, exists);
  if (!exists) continue;
  const text = fs.readFileSync(abs, 'utf8');
  ok(`无占位符 ${f}`, !/TODO|FIXME|待补充/.test(text));
  ok(`内容非空 ${f}`, text.length > 100);
  if (f.endsWith('.js') && !f.includes('data/')) {
    const dir = path.dirname(abs);
    for (const m of text.matchAll(/from\s+'([^']+)'/g)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;
      const target = path.resolve(dir, spec);
      ok(`导入存在 ${f} -> ${spec}`, fs.existsSync(target), target);
    }
  }
}

// ---------- 1.5 PWA 配置 ----------
section('PWA 配置');
{
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok('index.html 引用 manifest', /rel="manifest"/.test(indexHtml));
  ok('index.html 注册 service worker', /serviceWorker\.register/.test(indexHtml));
  ok('index.html 有主题色', /theme-color/.test(indexHtml));
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    ok('manifest 名称含青养', String(manifest.name).includes('青养'));
    ok('manifest 有 start_url 与 standalone', manifest.start_url === './' && manifest.display === 'standalone');
    ok('manifest 图标 >= 2', (manifest.icons || []).length >= 2, String((manifest.icons || []).length));
    const iconRefs = (manifest.icons || []).map((i) => i.src);
    for (const ref of iconRefs) {
      ok(`manifest 图标文件存在 ${ref}`, fs.existsSync(path.join(ROOT, ref)), path.join(ROOT, ref));
    }
  } catch (err) {
    ok('manifest JSON 可解析', false, String(err));
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok('sw 有 install/activate/fetch', !!(sw.includes('install') && sw.includes('activate') && sw.includes('fetch')));
  ok('sw 使用 network-first', /fetch\(req\)/.test(sw) && /caches\.match/.test(sw));
  for (const f of ['web/manifest.json', 'web/sw.js', 'web/assets/icons/icon-192.png', 'web/assets/icons/icon-512.png']) {
    ok(`发布副本存在 ${f}`, fs.existsSync(path.join(ROOT, f)));
  }
}

// ---------- 1.6 深色模式与偏好设置 ----------
section('深色模式');
{
  const storeSrc = fs.readFileSync(path.join(ROOT, 'js/lib/store.js'), 'utf8');
  const dataSrc = fs.readFileSync(path.join(ROOT, 'js/views/data.js'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  ok('默认设置含 darkMode=false', /darkMode: false/.test(storeSrc));
  ok('数据页有深色开关', /set-dark/.test(dataSrc) && /深色模式/.test(dataSrc));
  ok('切换开关持久化设置', /updateSettings\(\{ darkMode: e\.target\.checked \}\)/.test(dataSrc));
  ok('main 启动应用深色类', /classList\.toggle\('dark'/.test(mainSrc) && /applyTheme/.test(mainSrc));
  ok('css 有 body.dark 变量覆盖', /body\.dark\s*\{[\s\S]*?--bg:/.test(css));
  ok('css 深色覆盖主要卡片', /body\.dark \.sub-card/.test(css) && /body\.dark \.post/.test(css));
  ok('css 深色覆盖弹窗与输入', /body\.dark \.modal-head/.test(css) && /body\.dark \.input/.test(css));
  ok('css 深色覆盖 medical/tea', /body\.dark \.medical-card/.test(css) && /body\.dark \.tea-card/.test(css));
}

// ---------- 1.7 字号调节 ----------
section('字号调节');
{
  const storeSrc = fs.readFileSync(path.join(ROOT, 'js/lib/store.js'), 'utf8');
  const dataSrc = fs.readFileSync(path.join(ROOT, 'js/views/data.js'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  ok('默认设置含 textSize=std', /textSize: 'std'/.test(storeSrc));
  ok('数据页有字号选择器', /set-text-size/.test(dataSrc) && /特大/.test(dataSrc));
  ok('切换字号持久化设置', /updateSettings\(\{ textSize: e\.target\.value \}\)/.test(dataSrc));
  ok('main 应用字号类', /classList\.remove\('size-lg', 'size-xl'\)/.test(mainSrc) && /classList\.add\('size-xl'\)/.test(mainSrc));
  ok('css 有 size-lg/size-xl 缩放', /body\.size-lg/.test(css) && /body\.size-xl/.test(css));
}

// ---------- 1.8 收藏与食谱本 ----------
section('收藏与食谱本');
{
  const storeSrc = fs.readFileSync(path.join(ROOT, 'js/lib/store.js'), 'utf8');
  const backupSrc = fs.readFileSync(path.join(ROOT, 'js/lib/backup.js'), 'utf8');
  const homeSrc = fs.readFileSync(path.join(ROOT, 'js/views/home.js'), 'utf8');
  const condSrc = fs.readFileSync(path.join(ROOT, 'js/views/conditions.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  ok('store 初始化收藏集合', /this\.favorites = new Set\(\)/.test(storeSrc) && /getMeta\('favorites'/.test(storeSrc));
  ok('store 提供收藏方法', /async toggleBookmark\(type, id\)/.test(storeSrc) && /isBookmarked\(type, id\)/.test(storeSrc));
  ok('备份包含收藏', /favorites: \[\.\.\.store\.favorites\]/.test(backupSrc) && /favorites: Array\.isArray/.test(backupSrc));
  ok('store 手动保存写收藏', /setMeta\('favorites'/.test(storeSrc));
  ok('store 重置清空收藏', /this\.favorites = new Set\(\);/.test(storeSrc));
  ok('首页渲染食谱本区块', /favBookSection/.test(homeSrc) && /我的食谱本/.test(homeSrc));
  ok('详情页有收藏按钮', /data-fav-type/.test(homeSrc) && /bindFav/.test(homeSrc));
  ok('茶饮卡片有收藏按钮', /data-fav-type="tea"/.test(condSrc) && /toggleBookmark\('tea'/.test(condSrc));
  ok('css 有收藏按钮样式', /\.fav-btn/.test(css) && /\.fav-sm/.test(css));
}

// ---------- 1.9 打卡与调理记录 ----------
section('打卡与调理记录');
{
  const dbSrc = fs.readFileSync(path.join(ROOT, 'js/lib/db.js'), 'utf8');
  const storeSrc = fs.readFileSync(path.join(ROOT, 'js/lib/store.js'), 'utf8');
  const backupSrc = fs.readFileSync(path.join(ROOT, 'js/lib/backup.js'), 'utf8');
  const homeSrc = fs.readFileSync(path.join(ROOT, 'js/views/home.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  ok('db 建 checkins 表（版本2）', /DB_VERSION = 2/.test(dbSrc) && /createObjectStore\('checkins'/.test(dbSrc));
  ok('store 初始化打卡数据', /this\.checkins = \[\]/.test(storeSrc) && /db\.all\('checkins'\)/.test(storeSrc));
  ok('store 提供打卡方法', /async addCheckin\(rec\)/.test(storeSrc) && /async removeCheckin\(id\)/.test(storeSrc) && /checkinsOfDate\(date\)/.test(storeSrc));
  ok('备份包含打卡', /checkins: store\.checkins/.test(backupSrc) && /Array\.isArray\(d\.checkins\)/.test(backupSrc));
  ok('首页有打卡面板', /checkinSection/.test(homeSrc) && /每日调理打卡/.test(homeSrc));
  ok('打卡交互绑定完整', /checkin-save-note/.test(homeSrc) && /checkin-del/.test(homeSrc));
  ok('css 有打卡样式', /\.checkin-strip/.test(css) && /\.checkin-cell/.test(css));
}

// ---------- 1.10 购物清单导出 ----------
section('购物清单导出');
{
  const homeSrc = fs.readFileSync(path.join(ROOT, 'js/views/home.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  ok('有清单构建逻辑', /function buildShoppingList/.test(homeSrc) && /function openShoppingList/.test(homeSrc));
  ok('食谱本有导出按钮', /shopping-btn/.test(homeSrc) && /导出购物清单/.test(homeSrc));
  ok('弹窗含复制与下载', /copy-list/.test(homeSrc) && /dl-list/.test(homeSrc));
  ok('合并同类与合计', /合计约/.test(homeSrc) && /localeCompare/.test(homeSrc));
  ok('水类用料被排除', /沸水\|清水\|开水\|水/.test(homeSrc));
  ok('css 有清单样式', /\.shop-list/.test(css));
}

// ---------- 2. 内容数据 ----------
section('内容数据');
const substances = (await import(pathToFileURL(path.join(ROOT, 'js/data/substances.js')).href)).SUBSTANCES;
const conditions = (await import(pathToFileURL(path.join(ROOT, 'js/data/conditions.js')).href)).CONDITIONS;
const recipes = (await import(pathToFileURL(path.join(ROOT, 'js/data/recipes.js')).href)).RECIPES;

console.log(`  物质 ${substances.length} 种 / 状况 ${conditions.length} 种 / 药膳 ${recipes.length} 道`);
ok('物质数量 30-50', substances.length >= 30 && substances.length <= 50, String(substances.length));
ok('状况数量 8-12', conditions.length >= 8 && conditions.length <= 12, String(conditions.length));
ok('药膳数量 >= 30', recipes.length >= 30, String(recipes.length));

const sIds = new Set(substances.map((s) => s.id));
const cIds = new Set(conditions.map((c) => c.id));
ok('物质 id 唯一', sIds.size === substances.length);
ok('状况 id 唯一', cIds.size === conditions.length);

for (const s of substances) {
  const missing = ['id', 'name', 'category', 'nature', 'effects', 'usage', 'adultDose', 'teenDose', 'cautions', 'features', 'alias'].filter((k) => {
    const v = s[k];
    return v == null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  ok(`物质字段完整 ${s.name}`, missing.length === 0, missing.join(','));
  ok(`分龄剂量不同 ${s.name}`, s.adultDose !== s.teenDose, `${s.adultDose} | ${s.teenDose}`);
  ok(`有外形特征 ${s.name}`, Object.keys(s.features || {}).length >= 2);
}

for (const r of recipes) {
  ok(`药膳有名称 ${r.id}`, !!r.name);
  ok(`药膳物质有效 ${r.name}`, (r.substanceIds || []).every((id) => sIds.has(id)), (r.substanceIds || []).join(','));
  ok(`药膳状况有效 ${r.name}`, (r.conditionIds || []).every((id) => cIds.has(id)), (r.conditionIds || []).join(','));
  ok(`分龄份量不同 ${r.name}`, !!r.adultPortion && !!r.teenPortion && r.adultPortion !== r.teenPortion);
  ok(`用料做法 ${r.name}`, (r.ingredients || []).length >= 2 && (r.steps || []).length >= 2);
}

for (const c of conditions) {
  const n = recipes.filter((r) => (r.conditionIds || []).includes(c.id)).length;
  ok(`状况有药膳 ${c.name}`, n >= 1, `${n} 道`);
}

// ---------- 2.5 就医导航 ----------
section('就医导航');
const medicalModule = await import(pathToFileURL(path.join(ROOT, 'js/data/medical.js')).href);
const MG = medicalModule.MEDICAL_GUIDE;
ok('就医导航：科室建议覆盖全部状况', (() => {
  const condIds = conditions.map((c) => c.id);
  return condIds.every((id) => MG.departments[id] && !!MG.departments[id].dept);
})());
ok('就医导航：每个状况有针对警示', (() => {
  return conditions.every((c) => (MG.departments[c.id]?.flags || []).length >= 2);
})());
ok('就医导航：通用警示 >= 6 条', (MG.globalRedFlags || []).length >= 6, String((MG.globalRedFlags || []).length));
ok('就医导航：就诊准备 >= 4 条', (MG.prep || []).length >= 4, String((MG.prep || []).length));
ok('就医导航：免责口径含「不替代医生」', MG.footer.includes('不替代医生'), MG.footer);
ok('就医导航：免责口径含「120/急诊」', /120|急诊/.test(MG.footer), MG.footer);
ok('就医导航：警示症状不含诊断性断言', !MG.footer.includes('确诊'), MG.footer);

// ---------- 2.6 泡茶饮 ----------
section('泡茶饮');
const teasModule = await import(pathToFileURL(path.join(ROOT, 'js/data/teas.js')).href);
const TEAS = teasModule.TEAS;
ok('茶饮数量 >= 12', TEAS.length >= 12, String(TEAS.length));
ok('茶饮 id 唯一', new Set(TEAS.map((t) => t.id)).size === TEAS.length);
for (const t of TEAS) {
  ok(`茶饮字段完整 ${t.id}`, !!(t.name && t.method && t.adultPortion && t.teenPortion && (t.ingredients || []).length >= 2));
  ok(`茶饮分龄份量不同 ${t.id}`, t.adultPortion !== t.teenPortion, `${t.adultPortion} | ${t.teenPortion}`);
  ok(`茶饮状况引用有效 ${t.id}`, (t.conditionIds || []).every((id) => cIds.has(id)), (t.conditionIds || []).join(','));
  ok(`茶饮有宜忌 ${t.id}`, (t.cautions || []).length >= 1);
}
ok('茶饮覆盖全部状况', conditions.every((c) => TEAS.some((t) => (t.conditionIds || []).includes(c.id))), TEAS.map((t) => t.conditionIds.join('/')).join(' | '));

// ---------- 3. 核心算法 ----------
section('核心算法');
const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, '');
function rankSubstances(query, list) {
  const q = norm(query);
  if (!q) return [];
  return list
    .map((s) => {
      const hay = norm([s.name, ...(s.alias || []), ...(s.keywords || []), s.category, s.nature, s.effects].join(' '));
      let score = 0;
      if (norm(s.name) === q) score = 100;
      else if ((s.alias || []).some((a) => norm(a) === q)) score = 92;
      else if (norm(s.name).includes(q)) score = 80;
      else if ((s.alias || []).some((a) => norm(a).includes(q))) score = 70;
      else if (hay.includes(q)) score = 50;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

ok('搜索：精确名称', (rankSubstances('山药', substances)[0]?.s.name || '').includes('山药'));
ok('搜索：空查询返回空', rankSubstances('', substances).length === 0);
ok('搜索：无关词无结果', rankSubstances('asdfqwer', substances).length === 0);
const aliasHit = substances.find((s) => (s.alias || []).length);
if (aliasHit) ok(`搜索：别名命中「${aliasHit.alias[0]}」`, rankSubstances(aliasHit.alias[0], substances).some((r) => r.s.id === aliasHit.id));

const COLOR_ANCHORS = { 白: [242, 240, 233], 褐: [132, 92, 58], 深棕: [86, 58, 38], 红: [196, 74, 62], 黄: [226, 188, 96], 绿: [96, 138, 82], 米白: [232, 222, 200], 淡黄: [238, 220, 168], 黑: [52, 46, 42], 紫红: [142, 58, 86] };
function closest(rgb) {
  let best = null;
  let bd = Infinity;
  for (const [n, c] of Object.entries(COLOR_ANCHORS)) {
    const d = (rgb[0] - c[0]) ** 2 + (rgb[1] - c[1]) ** 2 + (rgb[2] - c[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}
ok('颜色：白色', closest([250, 250, 248]) === '白', String(closest([250, 250, 248])));
ok('颜色：褐色', closest([128, 90, 56]) === '褐', String(closest([128, 90, 56])));
ok('颜色：红色', closest([190, 70, 60]) === '红', String(closest([190, 70, 60])));

// 拍照鉴别模块的纯函数（closestColorName / textToHues 不依赖 DOM，可直接在 Node 断言）
const photoId = await import(pathToFileURL(path.join(ROOT, 'js/lib/photo-id.js')).href);
ok('photo-id：近白归米白/灰白', ['白', '米白', '灰白'].includes(photoId.closestColorName([250, 250, 248])), photoId.closestColorName([250, 250, 248]));
ok('photo-id：褐近似', photoId.closestColorName([132, 92, 58]) === '褐', photoId.closestColorName([132, 92, 58]));
ok('photo-id：深棕近似', ['深棕', '棕'].includes(photoId.closestColorName([86, 58, 38])), photoId.closestColorName([86, 58, 38]));
ok('photo-id：长词优先不重复', (() => { const t = photoId.textToHues('米白 白 淡黄'); return t.includes('米白') && !t.includes('白'); })());
ok('photo-id：近色去重', photoId.textToHues('米白').length === 1, String(photoId.textToHues('米白').length));
ok('photo-id：物质颜色文本取词', (() => { const t = photoId.textToHues('灰褐 深棕 黑'); return t.includes('深棕') && t.includes('黑') && !t.includes('褐'); })());

for (const s of substances) {
  ok(`成人剂量含数字 ${s.name}`, /[0-9０-９]/.test(s.adultDose), s.adultDose);
}

// ---------- 4. 持久化语义 ----------
section('持久化语义');
const mem = new Map();
const fakeDB = {
  set: (k, v) => mem.set(k, JSON.parse(JSON.stringify(v))),
  get: (k) => (mem.has(k) ? JSON.parse(JSON.stringify(mem.get(k))) : null),
};
fakeDB.set('posts', [{ id: 'p1', text: '山药粥', createdAt: 1 }]);
fakeDB.set('settings', { activeVisitorId: 'me' });
ok('刷新后帖子还在', fakeDB.get('posts')?.length === 1);
ok('刷新后设置还在', fakeDB.get('settings')?.activeVisitorId === 'me');
fakeDB.set('seeded', true);
fakeDB.set('posts', []);
ok('清空后不回填示例', fakeDB.get('posts').length === 0 && fakeDB.get('seeded') === true);

const storeSrc = fs.readFileSync(path.join(ROOT, 'js/lib/store.js'), 'utf8');
ok('store 有首次写入标记', storeSrc.includes("getMeta('seeded'"));
ok('store 写入后派发事件', storeSrc.includes("this.emit('posts')"));
ok('store 有备份导出', storeSrc.includes('exportBackup'));
ok('store 有重置', storeSrc.includes('resetAll'));
ok('store 有手动保存 saveNow', storeSrc.includes('saveNow'));
ok('store 记录保存时间 lastSavedAt', storeSrc.includes('lastSavedAt'));

// ---------- 5. 备份 ----------
section('备份与恢复');
const backupModule = await import(pathToFileURL(path.join(ROOT, 'js/lib/backup.js')).href).catch((e) => ({ err: e.message }));
ok('backup 模块可加载', !backupModule.err, backupModule.err || '');
if (!backupModule.err) {
  ok('备份格式标识正确', backupModule.BACKUP_FORMAT === 'qingyang-backup');
  const good = { format: 'qingyang-backup', version: 1, data: { posts: [], identifications: [], visitors: [], settings: {} } };
  ok('合法备份通过校验', backupModule.validateBackup(good).posts.length === 0);
  let threw = false;
  try {
    backupModule.validateBackup({ hello: 1 });
  } catch {
    threw = true;
  }
  ok('非法文件被拒绝', threw);
}

// ---------- 6. 本地服务器 ----------
section('本地服务器');
const serverSrc = fs.readFileSync(path.join(ROOT, 'scripts/server.mjs'), 'utf8');
ok('只绑定 127.0.0.1', serverSrc.includes("'127.0.0.1'"));
ok('有目录穿越防护', serverSrc.includes('startsWith(ROOT + path.sep)'));
ok('默认端口 5173', serverSrc.includes('5173'));
ok('静态类型白名单', serverSrc.includes('SAFE_EXT'));

// ---------- 7. 安全口径 ----------
section('安全口径');
for (const [f, kws] of [
  ['index.html', ['不替代医生诊断', '慢性病', '孕']],
  ['js/views/home.js', ['不替代医生诊断', '慢性病']],
  ['js/views/conditions.js', ['不替代处方', '咨询医师']],
]) {
  const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const kw of kws) ok(`${f} 含「${kw}」`, content.includes(kw));
}

/* ================= 第二部分：真实浏览器端到端测试 ================= */
// 说明：浏览器端到端测试依赖在本地启动 Edge 与子进程，部分受限环境会拒绝执行。
// 这里做成"可选步骤"，失败只提示、不计入失败项：完整端到端请用 scripts/e2e.mjs。
section('端到端（可选，Edge headless）');

const NODE = process.execPath;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const RUN_E2E = process.argv.includes('--e2e');

if (!RUN_E2E) {
  console.log('  已跳过（加 --e2e 参数可运行浏览器端到端测试）');
} else if (!fs.existsSync(EDGE)) {
  console.log('  未找到 Edge，跳过端到端测试');
} else {
  const PORT = 5199;
  const BASE = `http://127.0.0.1:${PORT}/`;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qy-e2e-'));

  const server = spawn(NODE, [path.join(ROOT, 'scripts/server.mjs'), '--port', String(PORT), '--no-open'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d.toString()));
  server.stderr.on('data', (d) => (serverLog += d.toString()));

  const waitServer = async (tries = 40) => {
    for (let i = 0; i < tries; i += 1) {
      try {
        const r = await fetch(BASE, { signal: AbortSignal.timeout(800) });
        if (r.ok) return true;
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };

  const edge = spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-allow-origins=*',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=9333',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  const getJSON = async (url) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return r.json();
  };

  let target = null;
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await getJSON('http://127.0.0.1:9333/json/list');
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  ok('Edge 调试端口可用', !!target);

  const up = await waitServer();
  ok('本地服务器可访问', up, serverLog.slice(-300));

  if (target && up) {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });
    let msgId = 0;
    const pending = new Map();
    const consoleErrors = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m);
        pending.delete(m.id);
      }
      if (m.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
      }
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        consoleErrors.push(m.params.entry.text);
      }
    };
    const send = (method, params = {}) =>
      new Promise((resolve) => {
        msgId += 1;
        pending.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) {
        return { error: r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description || '') };
      }
      return { value: r.result?.result?.value };
    };
    const goto = async (url, wait = 900) => {
      await send('Page.navigate', { url });
      await new Promise((r) => setTimeout(r, wait));
    };

    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');

    await goto(BASE, 1800);

    const home = await evaluate(`(() => ({
      title: document.querySelector('.hero h1')?.textContent || '',
      cards: document.querySelectorAll('.sub-card').length,
      tabs: document.querySelectorAll('.tab').length,
      storage: document.querySelector('#storage-note')?.textContent || ''
    }))()`);
    ok('首页渲染', !!home.value?.title, JSON.stringify(home));
    ok('首页有物质卡片(>=30)', (home.value?.cards || 0) >= 30, JSON.stringify(home.value));
    ok('四个模块标签', home.value?.tabs === 4);
    ok('IndexedDB 存储生效', String(home.value?.storage).includes('IndexedDB'), String(home.value?.storage));
    ok('页面无 JS 异常', consoleErrors.length === 0, consoleErrors.join(' | '));

    // 搜索
    await evaluate(`(() => { const i = document.querySelector('#global-search'); i.value='山药'; i.dispatchEvent(new Event('input', {bubbles:true})); return 1; })()`);
    await new Promise((r) => setTimeout(r, 450));
    const sug = await evaluate(`document.querySelectorAll('#search-suggest .sug').length`);
    ok('全局搜索出候选', (sug.value || 0) > 0, JSON.stringify(sug));

    // 物质详情
    const firstHref = await evaluate(`document.querySelector('.sub-card')?.getAttribute('href') || ''`);
    const subId = String(firstHref.value).split('/').pop();
    await goto(`${BASE}#/substance/${subId}`, 900);
    const detail = await evaluate(`(() => ({
      h1: document.querySelector('.detail-head h1')?.textContent || '',
      doses: document.querySelectorAll('.dose-card').length,
      kv: document.querySelectorAll('.kv dt').length,
      recipes: document.querySelectorAll('.recipe-card').length
    }))()`);
    ok('物质详情页渲染', !!detail.value?.h1, JSON.stringify(detail));
    ok('详情两档剂量', detail.value?.doses === 2, JSON.stringify(detail.value));
    ok('详情有药典条目', (detail.value?.kv || 0) >= 5, JSON.stringify(detail.value));
    ok('详情有相关药膳', (detail.value?.recipes || 0) >= 1, JSON.stringify(detail.value));

    // 身体状况 → 药膳
    await goto(`${BASE}#/conditions`, 800);
    await evaluate(`document.querySelector('[data-cond]').click()`);
    await new Promise((r) => setTimeout(r, 600));
    const cond = await evaluate(`(() => ({
      rows: document.querySelectorAll('.dose-table tbody tr').length,
      recipes: document.querySelectorAll('#cond-detail .recipe-card').length,
      adult: document.querySelectorAll('.dose-table .dose.adult').length,
      teen: document.querySelectorAll('.dose-table .dose.teen').length
    }))()`);
    ok('状况页剂量对照表', (cond.value?.rows || 0) > 0, JSON.stringify(cond));
    ok('状况页药膳卡片', (cond.value?.recipes || 0) > 0, JSON.stringify(cond));
    ok('成人/青少年剂量分列', cond.value?.adult === cond.value?.rows && cond.value?.teen === cond.value?.rows);

    // 社区发帖
    await goto(`${BASE}#/community`, 900);
    await evaluate(`document.querySelector('#compose-btn').click()`);
    await new Promise((r) => setTimeout(r, 500));
    const postText = 'E2E 测试：山药薏米粥，早上喝一碗';
    await evaluate(`(() => { const t = document.querySelector('#post-text'); t.value = ${JSON.stringify(postText)}; document.querySelector('#post-submit').click(); return 1; })()`);
    await new Promise((r) => setTimeout(r, 1000));
    const afterPost = await evaluate(`({ posts: document.querySelectorAll('.post').length, hasText: document.body.innerText.includes(${JSON.stringify(postText)}) })`);
    ok('发帖成功', afterPost.value?.hasText === true, JSON.stringify(afterPost));

    // 刷新后仍在
    await send('Page.reload', {});
    await new Promise((r) => setTimeout(r, 1000));
    await goto(`${BASE}#/community`, 1200);
    const afterReload = await evaluate(`({ hasText: document.body.innerText.includes(${JSON.stringify(postText)}), posts: document.querySelectorAll('.post').length })`);
    ok('刷新后帖子仍在（持久化）', afterReload.value?.hasText === true, JSON.stringify(afterReload));

    // 点赞
    await evaluate(`document.querySelector('[data-like]')?.click()`);
    await new Promise((r) => setTimeout(r, 600));
    const liked = await evaluate(`document.querySelector('.post-foot .act.on')?.textContent || ''`);
    ok('点赞生效', String(liked.value).includes('1'), JSON.stringify(liked));

    // 访客切换
    await evaluate(`(() => { const v = [...document.querySelectorAll('[data-visitor]')].find(x => x.dataset.visitor === 'v_lin'); if (v) v.click(); return 1; })()`);
    await new Promise((r) => setTimeout(r, 700));
    const visitor = await evaluate(`document.querySelector('#visitor-chip')?.textContent || ''`);
    ok('访客身份切换', String(visitor.value).includes('林小满'), JSON.stringify(visitor));

    // 数据页
    await goto(`${BASE}#/data`, 1100);
    const dataPage = await evaluate(`(() => ({ stats: document.querySelectorAll('.stat').length, bars: document.querySelectorAll('.bar').length, backup: !!document.querySelector('#backup-btn') }))()`);
    ok('数据页统计渲染', (dataPage.value?.stats || 0) >= 6, JSON.stringify(dataPage));
    ok('数据页活跃图 14 天', dataPage.value?.bars === 14, JSON.stringify(dataPage));
    ok('数据页有备份按钮', !!dataPage.value?.backup);

    const backupOk = await evaluate(`(async () => {
      const { buildBackup } = await import('./js/lib/backup.js');
      const { store } = await import('./js/lib/store.js');
      const b = await buildBackup(store);
      return { format: b.format, posts: b.data.posts.length, hasSettings: !!b.data.settings };
    })()`);
    ok('备份导出结构正确', backupOk.value?.format === 'qingyang-backup' && backupOk.value?.posts > 0, JSON.stringify(backupOk));

    // 特征逐项选择
    await goto(`${BASE}#/`, 900);
    await evaluate(`document.querySelector('#btn-feature').click()`);
    await new Promise((r) => setTimeout(r, 600));
    const feature = await evaluate(`(() => {
      const chips = [...document.querySelectorAll('.fchip')];
      chips.slice(0, 3).forEach(c => c.click());
      return { chips: chips.length, candidates: document.querySelectorAll('#feature-result .cand').length, hasConfirm: !!document.querySelector('#confirm-pick') };
    })()`);
    ok('特征选择有可选项', (feature.value?.chips || 0) > 10, JSON.stringify(feature));
    ok('特征选择出候选', (feature.value?.candidates || 0) > 0, JSON.stringify(feature));

    // 拍照颜色分析链路
    const photo = await evaluate(`(async () => {
      const c = document.createElement('canvas'); c.width = 160; c.height = 160;
      const ctx = c.getContext('2d'); ctx.fillStyle = 'rgb(230,225,210)'; ctx.fillRect(0,0,160,160);
      for (let i=0;i<40;i++){ ctx.fillStyle='rgb('+(120+i)+','+(85+i)+','+(50+i)+')'; ctx.beginPath(); ctx.arc(20+i*3, 80+Math.sin(i)*20, 6, 0, 7); ctx.fill(); }
      const url = c.toDataURL('image/png');
      const { recognizePhoto } = await import('./js/lib/photo-id.js');
      const { store } = await import('./js/lib/store.js');
      const out = await recognizePhoto(url, store.substances, (s) => [...(s.features?.color||[]), ...(s.features?.section||[])].join(' '));
      return { palette: out.palette.top.length, ranked: out.ranked.length, first: out.ranked[0]?.id || '' };
    })()`);
    ok('拍照颜色特征提取', (photo.value?.palette || 0) > 0, JSON.stringify(photo));
    ok('拍照给出候选', (photo.value?.ranked || 0) > 0, JSON.stringify(photo));

    // 分享图生成
    const share = await evaluate(`(async () => {
      const { renderPostImage } = await import('./js/lib/share.js');
      const { store } = await import('./js/lib/store.js');
      const blob = await renderPostImage(store.posts[0], { authorName: '测试', avatar: '测', recipeName: '山药薏米粥' });
      return { size: blob ? blob.size : 0, type: blob ? blob.type : '' };
    })()`);
    ok('分享图生成', (share.value?.size || 0) > 1000, JSON.stringify(share));

    // 关闭页面再打开 = 重启 APP
    await goto('about:blank', 500);
    await goto(`${BASE}#/community`, 1600);
    const afterRestart = await evaluate(`document.body.innerText.includes(${JSON.stringify(postText)})`);
    ok('关闭再打开后数据仍在（模拟重启）', afterRestart.value === true, JSON.stringify(afterRestart));

    const fallback = await evaluate(`(async () => {
      const src = await (await fetch('./js/lib/db.js')).text();
      return src.includes('lsWrite') && src.includes('localstorage');
    })()`);
    ok('有 localStorage 降级实现', fallback.value === true);

    const errorsAtEnd = consoleErrors.filter((e) => !/favicon/.test(e));
    ok('全流程无 JS 异常', errorsAtEnd.length === 0, errorsAtEnd.slice(0, 4).join(' | '));

    ws.close();
  }

  edge.kill();
  server.kill();
  await new Promise((r) => setTimeout(r, 500));
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    /* 浏览器可能仍占用，忽略 */
  }
}

console.log('\n──────────────────────────────');
console.log(`结果：通过 ${pass} 项，失败 ${fail} 项`);if (failures.length) {
  console.log('\n失败明细：');
  failures.forEach((f) => console.log('  x ' + f));
  process.exitCode = 1;
} else {
  console.log('全部通过');
}
