// 青养 · 端到端测试客户端（连接已启动的 headless Edge 调试端口 + 本地服务器）
// 用法：node scripts/e2e.mjs [--port 5199] [--cdp 9333] [--base http://127.0.0.1:5199/] [--out 截图目录]
// 前置：本机已有 Edge headless 运行并开放 CDP 端口，且青养本地服务器在运行。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (f, d) => {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : d;
};
const BASE = arg('--base', 'http://127.0.0.1:5199/');
const CDP = Number(arg('--cdp', '9333'));
const OUT = arg('--out', path.join(ROOT, 'scripts', 'e2e'));
const WAIT_PAGE = Number(arg('--wait', '0')); // 若浏览器已打开别的页，先导航
// --groups <关键词1,关键词2>：只运行标题包含关键词的断言组（不删断言，只做选择）；缺省运行全部
const ONLY_GROUPS = (arg('--groups', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const want = (name) => ONLY_GROUPS.length === 0 || ONLY_GROUPS.some((g) => name.includes(g));

let pass = 0;
let fail = 0;
const failures = [];
const results = [];

function ok(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  if (cond) pass += 1;
  else {
    fail += 1;
    failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  }
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && detail ? '  >> ' + detail : ''}`);
}

async function getTargets() {
  const r = await fetch(`http://127.0.0.1:${CDP}/json/list`, { signal: AbortSignal.timeout(3000) });
  return r.json();
}

async function main() {
  let target = null;
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await getTargets();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!target) {
    console.error('无法连接 Edge 调试端口 ' + CDP);
    process.exit(2);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('CDP WebSocket 连接失败'));
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
  // 导航后轮询等待应用就绪（首次渲染含 IndexedDB 初始化，时间不固定）
  const waitReady = async (hashPart, timeout = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const r = await evaluate(`(() => {
        const want = ${JSON.stringify(hashPart)};
        const cur = location.hash.replace(/^#/, '') || '/';
        if (cur !== want) return false;
        const v = document.querySelector('#view');
        return !!(v && v.children.length > 0);
      })()`);
      if (r.value === true) return true;
      await new Promise((res) => setTimeout(res, 150));
    }
    return false;
  };
  // hashPart 形如 "/" 或 "/conditions" 或 "/substance/shan-yao"
  const goto = async (hashPart, wait = 1000) => {
    const hp = hashPart || '/';
    // 先收起所有弹窗，避免遮住操作目标
    await evaluate(`document.querySelectorAll('#modal-root .modal-mask').forEach(m => m.remove()); 1`);
    const sameDoc = await evaluate(`location.href.split('#')[0] === ${JSON.stringify(BASE)}`);
    if (sameDoc.value === true) {
      await evaluate(`(location.hash = ${JSON.stringify(hp)}, 1)`);
    } else {
      await send('Page.navigate', { url: `${BASE}#${hp}` });
    }
    const ready = await waitReady(hp, Math.max(3000, wait + 5000));
    await new Promise((r) => setTimeout(r, 350));
    return ready;
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    if (r.result?.data) {
      fs.mkdirSync(OUT, { recursive: true });
      const p = path.join(OUT, name + '.png');
      fs.writeFileSync(p, Buffer.from(r.result.data, 'base64'));
      return p;
    }
    return null;
  };
  // 社区组生成的测试帖文本；后续「刷新持久化」「数据与设置」组会用到。
  // 单独只跑这两个组时（--groups），先用 selfPost 自备一条测试帖，保证依赖不断。
  let postText = '';
  const selfPost = async () => {
    await goto('/community', 900);
    postText = 'E2E 独立测试帖：' + Date.now() + ' 山药小米粥早餐记录';
    await evaluate(`document.querySelector('#compose-btn').click()`);
    await new Promise((r) => setTimeout(r, 400));
    await evaluate(`(() => {
      const t = document.querySelector('#post-text');
      if (!t) return 'no-input';
      t.value = ${JSON.stringify(postText)};
      document.querySelector('#post-submit')?.click();
      return 1;
    })()`);
    await new Promise((r) => setTimeout(r, 1100));
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  // 每次运行先整页强制刷新，确保加载最新模块代码（ES 模块只在页面加载时拉取一次，hash 导航不会重载）
  await send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 1500));

  if (want('首页')) {
  console.log('\n[首页]');
  await goto('/', 1200);
  const home = await evaluate(`(() => ({
    title: document.querySelector('.hero h1')?.textContent || '',
    cards: document.querySelectorAll('.sub-card').length,
    cats: document.querySelectorAll('[data-cat]').length,
    tabs: document.querySelectorAll('.tab').length,
    storage: document.querySelector('#storage-note')?.textContent || '',
    heroBtns: [...document.querySelectorAll('.hero-actions .btn')].map(b => b.textContent.trim())
  }))()`);
  ok('首页渲染标题', !!home.value?.title, JSON.stringify(home));
  ok('首页物质卡片 ≥ 30', (home.value?.cards || 0) >= 30, JSON.stringify(home.value));
  ok('首页分类筛选按钮', (home.value?.cats || 0) >= 5);
  ok('四个模块标签', home.value?.tabs === 4);
  ok('IndexedDB 存储生效', String(home.value?.storage).includes('IndexedDB'), String(home.value?.storage));
  ok('首页有拍照/特征两个鉴别入口', (home.value?.heroBtns || []).length >= 2, JSON.stringify(home.value?.heroBtns));
  await shot('01-home');
  }

  if (want('全局搜索')) {
  console.log('\n[全局搜索]');
  await evaluate(`(() => { const i = document.querySelector('#global-search'); i.focus(); i.value='山药'; i.dispatchEvent(new Event('input', {bubbles:true})); return 1; })()`);
  await new Promise((r) => setTimeout(r, 500));
  const sug = await evaluate(`(() => ({ n: document.querySelectorAll('#search-suggest .sug').length, first: document.querySelector('#search-suggest .sug b')?.textContent || '' }))()`);
  ok('搜索下拉有候选', (sug.value?.n || 0) > 0, JSON.stringify(sug));
  await shot('02-search');
  await evaluate(`(() => { const i=document.querySelector('#global-search'); i.value='健脾'; i.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);
  await new Promise((r) => setTimeout(r, 500));
  const sug2 = await evaluate(`document.querySelectorAll('#search-suggest .sug').length`);
  ok('按体质/功效关键词也能搜到', (sug2.value || 0) > 0, JSON.stringify(sug2));
  await evaluate(`(() => { document.querySelector('#global-search').value='山药'; document.querySelector('#global-search').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return 1; })()`);
  await new Promise((r) => setTimeout(r, 900));
  const filtered = await evaluate(`document.querySelectorAll('.sub-card').length`);
  ok('回车后首页按关键词过滤', (filtered.value || 0) > 0 && (filtered.value || 0) < 30, JSON.stringify(filtered));
  }

  if (want('物质详情')) {
  console.log('\n[物质详情]');
  const href = await evaluate(`document.querySelector('.sub-card')?.getAttribute('href') || ''`);
  await goto(String(href.value) || '/', 900);
  const detail = await evaluate(`(() => ({
    h1: document.querySelector('.detail-head h1')?.textContent || '',
    doses: document.querySelectorAll('.dose-card').length,
    kv: document.querySelectorAll('.kv dt').length,
    feat: document.querySelectorAll('.feat-grid > div').length,
    recipes: document.querySelectorAll('.recipe-card').length,
    safety: !!document.querySelector('.safety')
  }))()`);
  ok('详情页标题', !!detail.value?.h1, JSON.stringify(detail));
  ok('详情页成人/青少年两档剂量', detail.value?.doses === 2, JSON.stringify(detail.value));
  ok('详情页药典条目 ≥ 5 项', (detail.value?.kv || 0) >= 5, JSON.stringify(detail.value));
  ok('详情页外形特征', (detail.value?.feat || 0) >= 3, JSON.stringify(detail.value));
  ok('详情页安全提示', detail.value?.safety === true);
  await shot('03-substance');
  }

  if (want('身体状况')) {
  console.log('\n[身体状况 → 药膳]');
  await goto('/conditions', 900);
  const condList = await evaluate(`document.querySelectorAll('[data-cond]').length`);
  ok('状况卡片 ≥ 8', (condList.value || 0) >= 8, JSON.stringify(condList));
  await evaluate(`document.querySelector('[data-cond]').click()`);
  await new Promise((r) => setTimeout(r, 700));
  const cond = await evaluate(`(() => ({
    rows: document.querySelectorAll('.dose-table tbody tr').length,
    adult: document.querySelectorAll('.dose-table .dose.adult').length,
    teen: document.querySelectorAll('.dose-table .dose.teen').length,
    recipes: document.querySelectorAll('#cond-detail .recipe-card').length
  }))()`);
  ok('对照表按物质列出', (cond.value?.rows || 0) > 0, JSON.stringify(cond));
  ok('对照表成人/青少年剂量逐行区分', cond.value?.adult === cond.value?.rows && cond.value?.teen === cond.value?.rows, JSON.stringify(cond.value));
  ok('对应药膳列出', (cond.value?.recipes || 0) > 0, JSON.stringify(cond.value));
  await shot('04-conditions');

  // 自述症状筛选
  await goto('/conditions', 900);
  await evaluate(`(() => { const i=document.querySelector('#sym-input'); i.value='吃一点就饱、大便稀'; i.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);
  await new Promise((r) => setTimeout(r, 400));
  const sym = await evaluate(`document.querySelectorAll('#sym-result [data-jump]').length`);
  ok('自述症状能匹配状况', (sym.value || 0) > 0, JSON.stringify(sym));
  await shot('05-symptom');
  }

  if (want('药膳详情')) {
  console.log('\n[药膳详情]');
  await evaluate(`document.querySelector('[data-cond]').click()`);
  await new Promise((r) => setTimeout(r, 600));
  const rHref = await evaluate(`document.querySelector('#cond-detail .recipe-card')?.getAttribute('href') || ''`);
  await goto(String(rHref.value) || '/', 900);
  const rec = await evaluate(`(() => ({
    h1: document.querySelector('.recipe-detail h1')?.textContent || '',
    twoDose: document.querySelectorAll('.dose-box').length,
    ing: document.querySelectorAll('.ing-list li').length,
    steps: document.querySelectorAll('.steps li').length
  }))()`);
  ok('药膳详情：标题', !!rec.value?.h1, JSON.stringify(rec));
  ok('药膳详情：成人/青少年份量分栏', rec.value?.twoDose === 2, JSON.stringify(rec.value));
  ok('药膳详情：用料与做法', (rec.value?.ing || 0) >= 2 && (rec.value?.steps || 0) >= 2, JSON.stringify(rec.value));
  await shot('06-recipe');
  }

  if (want('就医')) {
  console.log('\n[就医导航]');
  await goto('/conditions', 900);
  await evaluate(`document.querySelector('[data-cond]').click()`);
  await new Promise((r) => setTimeout(r, 700));
  const med = await evaluate(`(() => {
    const card = document.querySelector('#cond-detail .medical-card');
    if (!card) return null;
    const uls = [...card.querySelectorAll('ul')];
    return {
      dept: (card.querySelector('.medical-dept')?.textContent || '').includes('建议就诊科室'),
      flagLi: uls[0] ? uls[0].querySelectorAll('li').length : 0,
      prepLi: uls[1] ? uls[1].querySelectorAll('li').length : 0,
      footer: (card.querySelector('.medical-footer')?.textContent || '').includes('不替代医生'),
    };
  })()`);
  ok('就医导航：状况详情显示建议科室', !!med.value?.dept, JSON.stringify(med));
  ok('就医导航：有针对性警示症状', (med.value?.flagLi || 0) >= 2, JSON.stringify(med));
  ok('就医导航：有就诊前准备清单', (med.value?.prepLi || 0) >= 4, JSON.stringify(med));
  ok('就医导航：免责口径', med.value?.footer === true, JSON.stringify(med));
  await shot('12-medical');
  }

  if (want('泡茶')) {
  console.log('\n[泡茶饮]');
  await goto('/conditions', 900);
  await evaluate(`document.querySelector('[data-cond]').click()`);
  await new Promise((r) => setTimeout(r, 700));
  const tea = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('#cond-detail .tea-card')];
    return {
      n: cards.length,
      title: (document.querySelector('#cond-detail .sec-title')?.textContent || '') || '',
      hasTeaTitle: document.body.innerText.includes('适合的泡茶'),
      adult: cards.some((c) => !!c.querySelector('.dose.adult')),
      teen: cards.some((c) => !!c.querySelector('.dose.teen')),
    };
  })()`);
  ok('泡茶饮：状况详情显示茶饮', (tea.value?.n || 0) >= 1, JSON.stringify(tea));
  ok('泡茶饮：区块标题存在', tea.value?.hasTeaTitle === true, JSON.stringify(tea));
  ok('泡茶饮：含成人/青少年双份量', tea.value?.adult === true && tea.value?.teen === true, JSON.stringify(tea));
  await shot('13-tea');
  }

  if (want('社区')) {
  console.log('\n[社区]');
  await goto('/community', 900);
  const feed0 = await evaluate(`document.querySelectorAll('.post').length`);
  ok('社区信息流有内容', (feed0.value || 0) > 0, JSON.stringify(feed0));
  postText = 'E2E 测试帖：' + Date.now() + ' 山药薏米粥早上喝一碗';
  await evaluate(`document.querySelector('#compose-btn').click()`);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`(() => {
    const t = document.querySelector('#post-text'); t.value = ${JSON.stringify(postText)};
    const tag = document.querySelector('[data-ptag]'); if (tag) tag.click();
    const sub = document.querySelector('#post-substance'); if (sub.options.length > 1) sub.selectedIndex = 1;
    return 1; })()`);
  await shot('07-composer');
  await evaluate(`document.querySelector('#post-submit').click()`);
  await new Promise((r) => setTimeout(r, 1100));
  const afterPost = await evaluate(`({ n: document.querySelectorAll('.post').length, has: document.body.innerText.includes(${JSON.stringify(postText)}) })`);
  ok('发帖成功', afterPost.value?.has === true, JSON.stringify(afterPost));

  // 点赞 / 收藏（每次重绘后重新定位元素，避免操作到已脱离文档的旧节点）
  const clickIn = async (selector) => {
    const r = await evaluate(`(() => {
      const targetText = ${JSON.stringify(postText)};
      const posts = [...document.querySelectorAll('.post')];
      const p = posts.find(x => (x.querySelector('.post-text')?.textContent || '').includes(targetText))
        || posts.find(x => x.innerText.includes(targetText));
      if (!p) return 'post-missing';
      const b = p.querySelector(${JSON.stringify(selector)});
      if (!b) return 'btn-missing';
      b.click();
      return 'clicked';
    })()`);
    await new Promise((res) => setTimeout(res, 900));
    return r.value;
  };
  const stateOf = () =>
    evaluate(`(() => {
      const targetText = ${JSON.stringify(postText)};
      const posts = [...document.querySelectorAll('.post')];
      const p = posts.find(x => (x.querySelector('.post-text')?.textContent || '').includes(targetText))
        || posts.find(x => x.innerText.includes(targetText));
      if (!p) return null;
      return { like: p.querySelector('[data-like]').textContent, fav: p.querySelector('[data-fav]').textContent };
    })()`);
  const r1 = await clickIn('[data-like]');
  const afterLike = await stateOf();
  const r2 = await clickIn('[data-fav]');
  const favState = await stateOf();
  ok('点赞计数 +1', /1/.test(String(favState.value?.like)) || /1/.test(String(afterLike.value?.like)), JSON.stringify({ r1, r2, afterLike, favState }));
  ok('收藏状态切换', String(favState.value?.fav).includes('已收藏'), JSON.stringify({ favState }));

  // 评论
  const c1 = await clickIn('[data-comment]');
  const c2 = await evaluate(`(() => {
    const targetText = ${JSON.stringify(postText)};
    const posts = [...document.querySelectorAll('.post')];
    const p = posts.find(x => (x.querySelector('.post-text')?.textContent || '').includes(targetText));
    if (!p) return 'post-missing';
    const i = p.querySelector('[data-c-input]');
    if (!i) return 'input-missing';
    i.value = '我也做过，很香';
    p.querySelector('[data-c-send]').click();
    return 'sent';
  })()`);
  await new Promise((r) => setTimeout(r, 900));
  const commented = await evaluate(`document.body.innerText.includes('我也做过，很香')`);
  ok('评论发布', commented.value === true, JSON.stringify({ c1, c2, commented }));

  // 收藏筛选
  await evaluate(`document.querySelector('[data-filter="fav"]').click()`);
  await new Promise((r) => setTimeout(r, 700));
  const favFilter = await evaluate(`document.querySelectorAll('.post').length`);
  ok('收藏页签可用', (favFilter.value || 0) >= 1, JSON.stringify(favFilter));
  await evaluate(`document.querySelector('[data-filter="all"]').click()`);
  await new Promise((r) => setTimeout(r, 600));
  await shot('08-community');

  // 访客切换
  await evaluate(`(() => { const v=[...document.querySelectorAll('[data-visitor]')].find(x=>x.dataset.visitor==='v_lin'); if(v) v.click(); return 1; })()`);
  await new Promise((r) => setTimeout(r, 800));
  const visitor = await evaluate(`document.querySelector('#visitor-chip')?.textContent || ''`);
  ok('访客身份切换生效', String(visitor.value).includes('林小满'), JSON.stringify(visitor));

  // 分享图生成（Canvas 绘制，必须在浏览器环境调用 renderPostImage）
  const share = await evaluate(`(async () => {
    const { renderPostImage } = await import('./js/lib/share.js');
    const { store } = await import('./js/lib/store.js');
    const p = store.posts.find(x => (x.text || '').includes(${JSON.stringify(postText)})) || store.posts[0];
    if (!p) return { size: 0, type: '' };
    const blob = await renderPostImage(p, { authorName: '测试', avatar: '测', recipeName: '山药粥', substanceNames: '山药', adultPortion: '1 碗', teenPortion: '半碗' });
    return { size: blob.size, type: blob.type };
  })()`);
  ok('分享图可生成（PNG）', (share.value?.size || 0) > 1000 && share.value?.type === 'image/png', JSON.stringify(share));
  }

  if (want('刷新')) {
  console.log('\n[刷新 / 重启持久化]');
  if (!postText) await selfPost();
  await send('Page.reload', {});
  await new Promise((r) => setTimeout(r, 1200));
  await goto('/community', 900);
  const afterReload = await evaluate(`(() => {
    const p = [...document.querySelectorAll('.post')].find(x => (x.querySelector('.post-text')?.textContent || '').includes(${JSON.stringify(postText)}));
    if (!p) return { has: false, commentInStore: false };
    p.querySelector('[data-comment]').click();
    return { has: true, lastId: p.dataset.post };
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  const commentInUI = await evaluate(`document.body.innerText.includes('我也做过，很香')`);
  const commentInStore = await evaluate(`(async () => {
    const { store } = await import('./js/lib/store.js');
    const p = store.posts.find(x => (x.text || '').includes(${JSON.stringify(postText)}));
    return !!(p && (p.comments || []).some(c => c.text === '我也做过，很香'));
  })()`);
  ok('刷新后帖子仍在', afterReload.value?.has === true, JSON.stringify(afterReload));
  ok('刷新后评论仍在（数据层）', commentInStore.value === true, JSON.stringify({ afterReload, commentInUI, commentInStore }));
  ok('刷新后评论可见（展开后）', commentInUI.value === true, JSON.stringify(commentInUI));

  await send('Page.navigate', { url: 'about:blank' });
  await new Promise((r) => setTimeout(r, 700));
  await goto('/community', 900);
  const afterRestart = await evaluate(`document.body.innerText.includes(${JSON.stringify(postText)})`);
  ok('关闭页面再打开（模拟重启 APP）后数据仍在', afterRestart.value === true, JSON.stringify(afterRestart));
  }

  if (want('特征')) {
  console.log('\n[特征逐项选择]');
  await goto('/', 900);
  await evaluate(`document.querySelector('#btn-feature').click()`);
  await new Promise((r) => setTimeout(r, 600));
  const feat = await evaluate(`(() => {
    const chips = [...document.querySelectorAll('.fchip')];
    chips.slice(0, 2).forEach(c => c.click());
    return { chips: chips.length, cand: document.querySelectorAll('#feature-result .cand').length, confirm: !!document.querySelector('#confirm-pick') };
  })()`);
  ok('特征选项丰富', (feat.value?.chips || 0) > 10, JSON.stringify(feat));
  ok('选择特征后给出候选', (feat.value?.cand || 0) > 0, JSON.stringify(feat));
  ok('有「就选第一个」确认按钮', feat.value?.confirm === true);
  await shot('09-feature');
  await evaluate(`document.querySelector('#confirm-pick')?.click()`);
  await new Promise((r) => setTimeout(r, 1000));
  const jumped = await evaluate(`location.hash.startsWith('#/substance/') && !!document.querySelector('.detail-head h1')`);
  ok('确认后进入物质详情', jumped.value === true);
  }

  if (want('拍照')) {
  console.log('\n[拍照鉴别链路]');
  await goto('/', 900);
  await evaluate(`document.querySelector('#btn-photo').click()`);
  await new Promise((r) => setTimeout(r, 600));
  const photoModal = await evaluate(`!!document.querySelector('.photo-modal')`);
  ok('拍照模态打开', photoModal.value === true);
  await shot('10-photo-empty');
  const photo = await evaluate(`(async () => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const ctx = c.getContext('2d'); ctx.fillStyle = 'rgb(232,226,212)'; ctx.fillRect(0,0,200,200);
    for (let i=0;i<50;i++){ ctx.fillStyle='rgb('+(130+i)+','+(92+i)+','+(58+i)+')'; ctx.beginPath(); ctx.arc(20+i*3, 100+Math.sin(i)*30, 8, 0, 7); ctx.fill(); }
    const url = c.toDataURL('image/jpeg', 0.9);
    const { recognizePhoto } = await import('./js/lib/photo-id.js');
    const { store } = await import('./js/lib/store.js');
    const out = await recognizePhoto(url, store.substances, (s) => [...(s.features?.color||[]), ...(s.features?.section||[])].join(' '));
    return { palette: out.palette.top.length, ranked: out.ranked.length, first: out.ranked[0]?.id || '' };
  })()`);
  ok('照片主色提取', (photo.value?.palette || 0) > 0, JSON.stringify(photo));
  ok('照片比对给出候选', (photo.value?.ranked || 0) > 0, JSON.stringify(photo));
  await evaluate(`document.querySelector('.photo-modal [data-close]').click()`);
  await new Promise((r) => setTimeout(r, 400));
  }

  if (want('数据')) {
  console.log('\n[数据与设置]');
  if (!postText) await selfPost();
  await goto('/data', 900);
  const dataPage = await evaluate(`(() => ({
    stats: document.querySelectorAll('.stat').length,
    bars: document.querySelectorAll('.bar').length,
    backup: !!document.querySelector('#backup-btn'),
    restore: !!document.querySelector('#restore-file'),
    manage: document.querySelectorAll('[data-manage]').length
  }))()`);
  ok('统计卡片 ≥ 6', (dataPage.value?.stats || 0) >= 6, JSON.stringify(dataPage));
  ok('14 天活跃图', dataPage.value?.bars === 14, JSON.stringify(dataPage));
  ok('备份/恢复入口', dataPage.value?.backup && dataPage.value?.restore);
  ok('内容管理入口', (dataPage.value?.manage || 0) >= 3);
  await shot('11-data');

  // 手动保存按钮：点击后显示保存时间，且落盘后元数据可读
  const saveUI = await evaluate(`(() => {
    const btn = document.querySelector('#save-now');
    if (!btn) return { has: false };
    btn.click();
    return { has: true };
  })()`);
  await new Promise((r) => setTimeout(r, 700));
  const saveAfter = await evaluate(`(() => {
    const t = document.querySelector('#saved-at')?.textContent || '';
    return { hasStamp: t.includes('上次保存：') && !t.includes('暂无记录') };
  })()`);
  const saveMeta = await evaluate(`(async () => {
    const { store } = await import('./js/lib/store.js');
    return (await store.lastSavedAt()) > 0;
  })()`);
  ok('手动保存：有「立即保存」按钮', saveUI.value?.has === true, JSON.stringify(saveUI));
  ok('手动保存：点击后显示保存时间', saveAfter.value?.hasStamp === true, JSON.stringify(saveAfter));
  ok('手动保存：保存时间已落盘', saveMeta.value === true);

  const backup = await evaluate(`(async () => {
    const { buildBackup } = await import('./js/lib/backup.js');
    const { store } = await import('./js/lib/store.js');
    const b = await buildBackup(store);
    const okPosts = Array.isArray(b.data.posts) && b.data.posts.some(p => (p.text||'').includes(${JSON.stringify(postText)}));
    return { format: b.format, posts: b.data.posts.length, ident: b.data.identifications.length, okPosts };
  })()`);
  ok('备份包含新帖与格式标识', backup.value?.format === 'qingyang-backup' && backup.value?.okPosts === true, JSON.stringify(backup));

  // 备份 → 重置 → 恢复 全链路（种子数据直接从模块获取，不依赖 window.qy 的挂载时机）
  const roundtrip = await evaluate(`(async () => {
    const { buildBackup } = await import('./js/lib/backup.js');
    const { store } = await import('./js/lib/store.js');
    const seedMod = await import('./js/lib/seed.js');
    const { SUBSTANCES } = await import('./js/data/substances.js');
    const { CONDITIONS } = await import('./js/data/conditions.js');
    const { RECIPES } = await import('./js/data/recipes.js');
    const seed = { SUBSTANCES, CONDITIONS, RECIPES, DEFAULT_VISITORS: seedMod.DEFAULT_VISITORS, seedPosts: seedMod.seedPosts };
    const b = await buildBackup(store);
    const before = store.posts.length;
    await store.resetAll(seed);
    const afterReset = store.posts.length;
    const lost = !store.posts.some(p => (p.text||'').includes(${JSON.stringify(postText)}));
    await store.importBackup({ app: 'qingyang', visitors: b.data.visitors, settings: b.data.settings, posts: b.data.posts, identifications: b.data.identifications });
    const afterRestore = store.posts.length;
    const back = store.posts.some(p => (p.text||'').includes(${JSON.stringify(postText)}));
    return { before, afterReset, lost, afterRestore, back };
  })()`);
  ok('重置清空了我的帖子', roundtrip.value?.lost === true, JSON.stringify(roundtrip));
  ok('从备份恢复后帖子回来', roundtrip.value?.back === true && roundtrip.value?.afterRestore === roundtrip.value?.before, JSON.stringify(roundtrip));

  // 偏好设置持久化
  await goto('/data', 900);
  await evaluate(`(() => { const s=document.querySelector('#set-density'); s.value='compact'; s.dispatchEvent(new Event('change',{bubbles:true})); return 1; })()`);
  await new Promise((r) => setTimeout(r, 600));
  await send('Page.navigate', { url: 'about:blank' });
  await new Promise((r) => setTimeout(r, 700));
  await goto('/data', 900);
  const persisted = await evaluate(`document.querySelector('#set-density')?.value`);
  ok('偏好设置刷新后保留', persisted.value === 'compact', JSON.stringify(persisted));
  await evaluate(`(() => { const s=document.querySelector('#set-density'); s.value='comfortable'; s.dispatchEvent(new Event('change',{bubbles:true})); return 1; })()`);
  }

  console.log('\n[错误检查]');
  const errs = consoleErrors.filter((e) => !/favicon|Download the React/i.test(e));
  ok('全流程无 JS 运行时异常', errs.length === 0, errs.slice(0, 5).join(' | '));

  ws.close();

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ pass, fail, failures, results, at: new Date().toISOString() }, null, 2));
  console.log('\n──────────────────────────────');
  console.log(`端到端结果：通过 ${pass} 项，失败 ${fail} 项`);
  if (failures.length) {
    console.log('失败明细：');
    failures.forEach((f) => console.log('  x ' + f));
    process.exitCode = 1;
  }
  if (WAIT_PAGE) console.log('wait flag:', WAIT_PAGE);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

