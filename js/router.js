// 青养 · 路由初始化（不依赖顺序的挂载与事件绑定）
import { store } from './lib/store.js';
import { esc, debounce, qs, qsa } from './lib/dom.js';
import { searchAll, routeFor, typeLabel } from './lib/search.js';
import { openPhotoIdentify } from './photo.js';
import { openFeaturePicker } from './feature-picker.js';
import { renderHome, renderSubstancePage, renderRecipePage } from './views/home.js';
import { renderConditions } from './views/conditions.js';
import { renderCommunity } from './views/community.js';
import { renderData } from './views/data.js';

const view = qs('#view');

function currentPath() {
  return location.hash.replace(/^#/, '') || '/';
}

function parseRoute(path) {
  const [p, qsStr] = path.split('?');
  return { parts: p.split('/').filter(Boolean), query: new URLSearchParams(qsStr || '') };
}

export function render() {
  if (!store.ready) return;
  const { parts, query } = parseRoute(currentPath());

  qsa('.tab').forEach((t) => {
    const r = t.dataset.route;
    const match =
      (r === 'home' && (parts.length === 0 || parts[0] === 'substance' || parts[0] === 'recipe')) ||
      (r === 'conditions' && parts[0] === 'conditions') ||
      (r === 'community' && parts[0] === 'community') ||
      (r === 'data' && parts[0] === 'data');
    t.classList.toggle('active', match);
  });

  window.scrollTo({ top: 0 });

  // 任何视图渲染失败都不应让整页「白屏」：捕获异常并给出可读的错误信息
  try {
    if (parts.length === 0) return renderHome(view, { query });
    if (parts[0] === 'substance' && parts[1]) return renderSubstancePage(view, parts[1]);
    if (parts[0] === 'substance') return renderHome(view, { query });
    if (parts[0] === 'recipe' && parts[1]) return renderRecipePage(view, parts[1]);
    if (parts[0] === 'conditions') return renderConditions(view, { query });
    if (parts[0] === 'community') return renderCommunity(view, { query });
    if (parts[0] === 'data') return renderData(view, { query });

    view.innerHTML = '<div class="empty">页面不存在。<a class="link" data-link href="/">回首页</a></div>';
    return undefined;
  } catch (err) {
    console.error('[青养] 页面渲染失败：', err);
    if (view.children.length === 0) {
      view.innerHTML = `<div class="empty danger"><b>这个页面加载失败了</b><p class="small">${esc(err?.message || err)}</p>
        <p class="small muted">可以点「回首页」重试；如果反复出现，请把这段提示告诉我。</p>
        <a class="link" data-link href="/">回首页</a></div>`;
    }
    return undefined;
  }
}

export function navigate(to) {
  const target = String(to || '/');
  if (currentPath() === target) render();
  else location.hash = target;
}

let mounted = false;

/** 初始化所有全局交互（可重复调用，只挂载一次） */
export function mountRouter() {
  if (mounted) return;
  mounted = true;

  // 链接拦截：所有 a[data-link] 走 hash 路由
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    e.preventDefault();
    navigate(href);
  });

  const searchInput = qs('#global-search');
  const suggest = qs('#search-suggest');

  const renderSuggest = debounce(() => {
    const q = searchInput.value.trim();
    if (!q) {
      suggest.hidden = true;
      suggest.innerHTML = '';
      return;
    }
    const all = searchAll(q);
    const items = [...all.filter((r) => r.type !== 'post').slice(0, 7), ...all.filter((r) => r.type === 'post').slice(0, 3)];
    suggest.hidden = false;
    suggest.innerHTML = items.length
      ? items
          .map(
            (r) => `<a class="sug" data-sug="${esc(routeFor(r))}">
              <span class="sug-type">${typeLabel(r.type)}</span>
              <b>${esc(r.title)}</b>
              <small>${esc(r.sub || '')}</small>
            </a>`
          )
          .join('') + '<div class="sug-foot">按 Enter 在首页查看全部结果</div>'
      : '<div class="sug-empty">没有匹配结果。试试物质名、别名或身体状况，如「山药」「健脾」。</div>';
  }, 160);

  searchInput.addEventListener('input', renderSuggest);
  searchInput.addEventListener('focus', renderSuggest);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (!q) return;
      suggest.hidden = true;
      navigate(`/?q=${encodeURIComponent(q)}`);
    }
    if (e.key === 'Escape') {
      suggest.hidden = true;
      searchInput.blur();
    }
  });
  suggest.addEventListener('click', (e) => {
    const a = e.target.closest('[data-sug]');
    if (!a) return;
    suggest.hidden = true;
    navigate(a.dataset.sug);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) suggest.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  qs('#brand').addEventListener('click', () => navigate('/'));
  qsa('.tab').forEach((t) => t.addEventListener('click', () => navigate(t.dataset.route === 'home' ? '/' : `/${t.dataset.route}`)));

  window.qy = {
    navigate,
    openPhoto() {
      openPhotoIdentify({
        onPick: (id) => {
          if (id) navigate(`/substance/${id}`);
          else openFeaturePicker({ onPick: (id2) => navigate(`/substance/${id2}`) });
        },
      });
    },
    openFeature() {
      openFeaturePicker({ onPick: (id) => navigate(`/substance/${id}`) });
    },
  };
}
