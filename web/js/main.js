// 青养 · 应用入口：先初始化数据，再挂载路由并渲染
import { initDB } from './lib/db.js';
import { store } from './lib/store.js';
import * as seed from './lib/seed.js';
import { SUBSTANCES } from './data/substances.js';
import { CONDITIONS } from './data/conditions.js';
import { RECIPES } from './data/recipes.js';
import { esc, qs } from './lib/dom.js';
import { render, mountRouter } from './router.js';

const view = qs('#view');

const seedData = () => ({
  SUBSTANCES,
  CONDITIONS,
  RECIPES,
  DEFAULT_VISITORS: seed.DEFAULT_VISITORS,
  seedPosts: seed.seedPosts,
});

function flashSaveState() {
  const el = qs('#save-state');
  if (!el) return;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 900);
}

async function boot() {
  const info = await initDB();
  if (!info.ok) {
    view.innerHTML = `<div class="empty danger">无法初始化本地存储：${esc(info.error)}<br />请检查浏览器是否禁用了本地存储，或换用 Edge / Chrome 打开。</div>`;
    return;
  }

  await store.load(seedData());

  // 供设置页与测试脚本使用（挂在 window.qy 上，路由模块也会补充导航等入口）
  window.qy = window.qy || {};
  window.qy.seed = seedData;
  window.qy.status = () => ({
    ready: store.ready,
    mode: info.mode,
    substances: store.substances.length,
    recipes: store.recipes.length,
    conditions: store.conditions.length,
    posts: store.posts.length,
  });

  qs('#storage-note').textContent = info.mode === 'indexeddb' ? '数据已保存在本机浏览器 · IndexedDB' : '数据已保存在本机浏览器 · localStorage';
  const chip = qs('#visitor-chip');
  const syncChip = () => {
    chip.textContent = `👤 ${store.activeVisitor().name}`;
  };
  syncChip();
  store.addEventListener('settings', syncChip);
  store.addEventListener('posts', flashSaveState);
  store.addEventListener('settings', flashSaveState);

  // 外观偏好：深色模式 + 文字大小（设置页改动后经 settings 事件即时生效）
  const applyTheme = () => {
    document.body.classList.toggle('dark', !!store.settings.darkMode);
    document.body.classList.remove('size-lg', 'size-xl');
    if (store.settings.textSize === 'lg') document.body.classList.add('size-lg');
    else if (store.settings.textSize === 'xl') document.body.classList.add('size-xl');
  };
  applyTheme();
  store.addEventListener('settings', applyTheme);

  mountRouter();
  window.addEventListener('hashchange', render);
  render();
}

boot();
