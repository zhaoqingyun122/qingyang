// 青养 · 单机社区：发布药膳日常、浏览、筛选、收藏、点赞、导出、访客切换
import { store } from '../lib/store.js';
import { esc, html, qs, qsa, toast, uid, modal, confirmDialog, readFileAsDataURL, downloadBlob, downloadText, relTime } from '../lib/dom.js';
import { POST_TAGS } from '../lib/seed.js';
import { renderPostImage } from '../lib/share.js';

// 调试开关：在浏览器控制台执行 localStorage.setItem('qy-debug','1') 后刷新可看到点击日志
const DEBUG = (() => {
  try {
    return localStorage.getItem('qy-debug') === '1';
  } catch {
    return false;
  }
})();

let state = {
  filter: 'all', // all | mine | fav | liked
  tag: '',
  recipeId: '',
  substanceId: '',
  expandComments: new Set(),
  images: [],
};

function authorOf(p) {
  return store.visitor(p.authorId) || { name: '匿名访客', avatar: '匿' };
}

function passesFilter(p) {
  const me = store.settings.activeVisitorId;
  if (state.filter === 'mine' && p.authorId !== me) return false;
  if (state.filter === 'fav' && !(p.favorites || []).includes(me)) return false;
  if (state.filter === 'liked' && !(p.likes || []).includes(me)) return false;
  if (state.tag && !(p.tags || []).includes(state.tag)) return false;
  if (state.recipeId && p.recipeId !== state.recipeId) return false;
  if (state.substanceId) {
    const viaRecipe = store.recipe(p.recipeId);
    const ok = (p.substanceIds || []).includes(state.substanceId) || (viaRecipe?.substanceIds || []).includes(state.substanceId);
    if (!ok) return false;
  }
  return true;
}

function postCard(p) {
  const a = authorOf(p);
  const me = store.settings.activeVisitorId;
  const liked = (p.likes || []).includes(me);
  const faved = (p.favorites || []).includes(me);
  const recipe = store.recipe(p.recipeId);
  const subs = [
    ...new Set([...(p.substanceIds || []), ...((recipe?.substanceIds) || [])]),
  ]
    .map((id) => store.substance(id))
    .filter(Boolean);

  return `<article class="post" data-post="${p.id}">
    <header class="post-head">
      <span class="avatar">${esc(a.avatar || a.name[0])}</span>
      <div class="post-meta">
        <b>${esc(a.name)}</b>
        <span class="small muted">${relTime(p.createdAt)} · ${p.authorId === me ? '我的帖子' : '本机访客'}</span>
        ${recipe ? `<span class="post-recipe-name">🍲 关联药膳：<b>${esc(recipe.name)}</b></span>` : ''}
      </div>
      ${p.authorId === me ? `<button class="icon-btn" data-del="${p.id}" title="删除">🗑</button>` : ''}
    </header>

    ${(p.tags || []).length ? `<div class="post-tags">${(p.tags || []).map((t) => `<button class="tag soft tiny" data-tagjump="${esc(t)}" type="button">#${esc(t)}</button>`).join('')}</div>` : ''}

    ${(p.images || []).length ? `<div class="post-imgs i${Math.min(3, p.images.length)}">${p.images.map((src) => `<img src="${src}" alt="药膳照片" loading="lazy" />`).join('')}</div>` : ''}

    <p class="post-text">${esc(p.text).replace(/\n/g, '<br />')}</p>

    ${
      recipe
        ? `<a class="post-recipe" data-link href="/recipe/${recipe.id}">
            <span>🍲 关联药膳</span><b>${esc(recipe.name)}</b>
            <small>${subs.map((s) => esc(s.name)).join(' + ')}</small>
          </a>`
        : ''
    }

    ${
      subs.length
        ? `<div class="post-subs">${subs.map((s) => `<a class="tag tiny" data-link href="/substance/${s.id}">${esc(s.name)}</a>`).join('')}</div>`
        : ''
    }

    <footer class="post-foot">
      <button class="act ${liked ? 'on' : ''}" data-like="${p.id}" type="button">♡ ${(p.likes || []).length}</button>
      <button class="act" data-comment="${p.id}" type="button">💬 ${(p.comments || []).length}</button>
      <button class="act ${faved ? 'on' : ''}" data-fav="${p.id}" type="button">${faved ? '★ 已收藏' : '☆ 收藏'}</button>
      <button class="act" data-export="${p.id}" type="button">⤓ 导出图片</button>
      <button class="act" data-export-txt="${p.id}" type="button">导出文本</button>
    </footer>

    ${
      state.expandComments.has(p.id)
        ? `<div class="comments">
            ${(p.comments || []).map((c) => `<div class="comment"><b>${esc(store.visitor(c.authorId)?.name || '访客')}</b><span>${esc(c.text)}</span></div>`).join('')}
            <div class="comment-input">
              <input class="input" data-c-input="${p.id}" placeholder="以「${esc(store.activeVisitor().name)}」的身份说一句…" />
              <button class="btn btn-sm btn-primary" data-c-send="${p.id}" type="button">发送</button>
            </div>
          </div>`
        : ''
    }
  </article>`;
}

export function renderCommunity(view, { query }) {
  const compose = query?.get('compose');
  if (query?.get('recipe')) state.recipeId = query.get('recipe');
  if (query?.get('substance')) state.substanceId = query.get('substance');

  const allTags = [...new Set(store.posts.flatMap((p) => p.tags || []))].sort();
  const me = store.activeVisitor();
  const list = store.posts.filter(passesFilter);

  view.innerHTML = html`
    <div class="community-layout">
      <section class="feed-col">
        <div class="feed-head">
          <h1>药膳社区</h1>
          <button class="btn btn-primary" id="compose-btn">＋ 分享我的药膳日常</button>
        </div>
        <p class="muted small tip">
          这是本机社区：帖子保存在你这台电脑上，可以切换「访客身份」模拟不同人的分享，也可以把喜欢的帖子导出图片发给朋友。
        </p>

        <div class="feed-tabs">
          ${[['all', '全部'], ['mine', '我的'], ['fav', '收藏'], ['liked', '点赞过']]
            .map(([k, label]) => `<button class="chip ${state.filter === k ? 'on' : ''}" data-filter="${k}" type="button">${label}</button>`)
            .join('')}
        </div>

        ${
          state.recipeId || state.substanceId
            ? `<div class="filter-line">
                <span>当前筛选：${esc(store.recipe(state.recipeId)?.name || store.substance(state.substanceId)?.name || '')}</span>
                <button class="chip tiny" id="clear-filter">清除筛选 ✕</button>
              </div>`
            : ''
        }
        ${
          state.tag
            ? `<div class="filter-line"><span>标签：#${esc(state.tag)}</span><button class="chip tiny" id="clear-tag">清除 ✕</button></div>`
            : ''
        }

        <div class="feed">
          ${list.length ? list.map(postCard).join('') : '<div class="empty">还没有符合条件的帖子。点右上角分享第一条吧。</div>'}
        </div>
      </section>

      <aside class="side-col">
        <section class="panel">
          <h2>我的身份</h2>
          <div class="visitor-list">
            ${store.visitors
              .map(
                (v) => `<button class="visitor ${v.id === me.id ? 'on' : ''}" data-visitor="${v.id}" type="button">
                  <span class="avatar sm">${esc(v.avatar || v.name[0])}</span>
                  <span>${esc(v.name)}</span>
                  <small>${store.posts.filter((p) => p.authorId === v.id).length} 帖</small>
                </button>`
              )
              .join('')}
          </div>
          <div class="stack">
            <button class="btn btn-sm btn-ghost" id="add-visitor">＋ 新增访客身份</button>
            ${me.isDefault ? '' : `<button class="btn btn-sm btn-ghost" id="del-visitor">删除当前访客</button>`}
          </div>
        </section>

        <section class="panel">
          <h2>热门标签</h2>
          <div class="tagbox">
            ${
              allTags.length
                ? allTags.map((t) => `<button class="tag tiny" data-tagjump="${esc(t)}" type="button">#${esc(t)}</button>`).join('')
                : '<span class="muted small">暂无标签</span>'
            }
          </div>
        </section>

        <section class="panel">
          <h2>社区小规矩</h2>
          <ul class="small muted">
            <li>药膳是日常调养，不能替代看病吃药。</li>
            <li>分享时带上剂量和适用人群，方便后来人参考。</li>
            <li>内容只保存在本机，导出的图片不含你的电脑信息。</li>
          </ul>
        </section>
      </aside>
    </div>`;

  bindCommunity(view);
  applyTextToggles(view);
  if (compose) openComposer(view);
}

/**
 * 正文超出 4 行时给出「展开全文 / 收起」切换。
 * 只做视觉截断（-webkit-line-clamp），不影响 innerText 与数据层。
 */
function applyTextToggles(view) {
  qsa('.post-text', view).forEach((el) => {
    if (el.scrollHeight <= el.clientHeight + 2) return;
    if (el.nextElementSibling?.classList.contains('text-toggle')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'text-toggle';
    btn.textContent = '展开全文';
    el.insertAdjacentElement('afterend', btn);
    btn.addEventListener('click', () => {
      const expanded = el.classList.toggle('expanded');
      btn.textContent = expanded ? '收起' : '展开全文';
    });
  });
}

function bindCommunity(view) {
  // 视图容器 #view 会被反复重写内容，但元素本身始终存在，事件委托监听必须
  // 先撤销再挂载，否则同一次点击会被处理多次（点赞=切换，两次就抵消了）。
  // 这里每次渲染都会调用一次，所以要用具名函数才能正确去重。
  view.removeEventListener('click', communityClick);
  view.addEventListener('click', communityClick);

  qs('#compose-btn', view).addEventListener('click', () => openComposer(view));

  qsa('[data-filter]', view).forEach((b) =>
    b.addEventListener('click', () => {
      state.filter = b.dataset.filter;
      renderCommunity(view, {});
    })
  );
  qs('#clear-filter', view)?.addEventListener('click', () => {
    state.recipeId = '';
    state.substanceId = '';
    renderCommunity(view, {});
  });
  qs('#clear-tag', view)?.addEventListener('click', () => {
    state.tag = '';
    renderCommunity(view, {});
  });
  qsa('[data-tagjump]', view).forEach((b) =>
    b.addEventListener('click', () => {
      state.tag = b.dataset.tagjump;
      renderCommunity(view, {});
    })
  );

  qsa('[data-visitor]', view).forEach((b) =>
    b.addEventListener('click', async () => {
      await store.updateSettings({ activeVisitorId: b.dataset.visitor });
      renderCommunity(view, {});
    })
  );
  qs('#add-visitor', view)?.addEventListener('click', async () => {
    const data = await modal({
      title: '新增访客身份',
      mode: 'form',
      okText: '创建',
      body: `<form><label class="field"><span>昵称</span><input name="name" maxlength="12" required placeholder="例如：周末下厨的爸爸" /></label>
             <label class="field"><span>头像文字（1 个字）</span><input name="avatar" maxlength="2" placeholder="默认取昵称首字" /></label>
             <p class="muted small">访客身份只在本机有效，用来模拟不同人的帖子；不需要手机号或密码。</p></form>`,
    });
    if (!data?.name) return;
    const v = await store.addVisitor(data.name, (data.avatar || data.name[0]).slice(0, 1));
    await store.updateSettings({ activeVisitorId: v.id });
    renderCommunity(view, {});
  });
  qs('#del-visitor', view)?.addEventListener('click', async () => {
    const me = store.activeVisitor();
    if (!(await confirmDialog('删除访客', `删除「${me.name}」后，其发布的帖子仍会保留，但署名会显示为已移除。确定删除吗？`))) return;
    await store.removeVisitor(me.id);
    renderCommunity(view, {});
  });

  // 点击委托统一由 communityClick 处理（在 bindCommunity 开头挂载）
}

/**
 * 社区点击委托（具名函数：每次渲染前先撤销旧引用，避免同一次点击被处理多次）。
 * 注意：id 必须在任何 await 之前同步取出，因为重渲染会让原按钮脱离文档。
 */
async function communityClick(e) {
  const view = e.currentTarget;
  const like = e.target.closest('[data-like]');
  const fav = e.target.closest('[data-fav]');
  const del = e.target.closest('[data-del]');
  const comment = e.target.closest('[data-comment]');
  const send = e.target.closest('[data-c-send]');
  const exp = e.target.closest('[data-export]');
  const expTxt = e.target.closest('[data-export-txt]');
  const likeId = like?.dataset.like;
  const favId = fav?.dataset.fav;
  const delId = del?.dataset.del;
  const commentId = comment?.dataset.comment;
  const sendId = send?.dataset.cSend;
  const sendText = sendId ? (qs(`[data-c-input="${sendId}"]`, view)?.value || '').trim() : '';
  const expId = exp?.dataset.export;
  const expTxtId = expTxt?.dataset.exportTxt;
  if (DEBUG) console.log('[qy] click', { likeId, favId, commentId, sendId });

  if (likeId) {
    const on = await store.toggleLike(likeId);
    toast(on ? '已点赞' : '已取消点赞');
    renderCommunity(view, {});
  } else if (favId) {
    const on = await store.toggleFavorite(favId);
    toast(on ? '已收藏' : '已取消收藏');
    renderCommunity(view, {});
  } else if (commentId) {
    if (state.expandComments.has(commentId)) state.expandComments.delete(commentId);
    else state.expandComments.add(commentId);
    renderCommunity(view, {});
  } else if (sendId) {
    if (!sendText) return;
    const p = store.posts.find((x) => x.id === sendId);
    if (!p) return;
    p.comments = [...(p.comments || []), { id: uid('c'), authorId: store.settings.activeVisitorId, text: sendText, createdAt: Date.now() }];
    await store.updatePost(sendId, { comments: p.comments });
    // 发完评论保持在展开状态
    state.expandComments.add(sendId);
    renderCommunity(view, {});
  } else if (delId) {
    const ok = await confirmDialog('删除帖子', '删除后不可恢复（备份文件里仍保留旧数据，除非重新备份）。确定删除？', '删除');
    if (!ok) return;
    await store.removePost(delId);
    toast('已删除');
    renderCommunity(view, {});
  } else if (expId) {
    const p = store.posts.find((x) => x.id === expId);
    if (!p) return;
    const a = authorOf(p);
    const recipe = store.recipe(p.recipeId);
    toast('正在生成分享图片…');
    const blob = await renderPostImage(p, {
      authorName: a.name,
      avatar: a.avatar,
      recipeName: recipe?.name,
      substanceNames: (p.substanceIds || []).map((sid) => store.substance(sid)?.name).filter(Boolean).join('、'),
      adultPortion: recipe?.adultPortion,
      teenPortion: recipe?.teenPortion,
    });
    downloadBlob(`青养分享-${a.name}-${Date.now()}.png`, blob);
  } else if (expTxtId) {
    const p = store.posts.find((x) => x.id === expTxtId);
    if (!p) return;
    const a = authorOf(p);
    const recipe = store.recipe(p.recipeId);
    const text = [
      `【${a.name} 的药膳日常】`,
      new Date(p.createdAt).toLocaleString('zh-CN'),
      '',
      p.text,
      '',
      recipe ? `关联药膳：${recipe.name}` : '',
      recipe ? `用料：${(recipe.ingredients || []).join('、')}` : '',
      recipe ? `成人份量：${recipe.adultPortion}` : '',
      recipe ? `青少年份量：${recipe.teenPortion}` : '',
      (p.tags || []).length ? `标签：${p.tags.map((t) => '#' + t).join(' ')}` : '',
      '',
      '— 来自「青养 · 食疗健康生活」（仅作日常食疗参考，不替代医生诊断）',
    ]
      .filter(Boolean)
      .join('\n');
    downloadText(`青养帖文-${Date.now()}.txt`, text, 'text/plain');
  }
}

async function openComposer(view) {
  state.images = [];
  const root = qs('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-mask';
  wrap.innerHTML = html`
    <div class="modal modal-wide composer" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>分享药膳日常</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="modal-body">
        <div class="who">以 <b>${esc(store.activeVisitor().name)}</b> 的身份发布（可在右侧切换访客）</div>
        <textarea class="input textarea" id="post-text" rows="5" maxlength="800" placeholder="今天做了什么药膳？吃了之后感觉怎样？用了多少量？适合谁吃？"></textarea>
        <div class="compose-row">
          <label class="btn btn-sm btn-ghost">＋ 添加照片<input type="file" id="post-files" accept="image/*" multiple hidden /></label>
          <button class="btn btn-sm btn-ghost" id="post-camera">📷 拍照</button>
          <span class="muted small" id="file-hint">图片会压缩后存在本机（最多 4 张）</span>
        </div>
        <div class="preview-imgs" id="preview-imgs"></div>

        <div class="compose-grid">
          <label class="field">
            <span>关联药膳</span>
            <select class="select" id="post-recipe">
              <option value="">不关联</option>
              ${store.recipes.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>关联物质</span>
            <select class="select" id="post-substance">
              <option value="">不关联</option>
              ${store.substances.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="field">
          <span>标签（可多选，最多 4 个）</span>
          <div class="tagbox" id="tag-picker">
            ${POST_TAGS.map((t) => `<button class="tag tiny" data-ptag="${esc(t)}" type="button">#${esc(t)}</button>`).join('')}
          </div>
        </div>

        <p class="muted small">发送前请确认：用的是日常参考量，没有把药膳当药吃；涉及疾病或孕期内容会提醒对方咨询医生。</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-close>取消</button>
        <button class="btn btn-primary" id="post-submit">发布</button>
      </div>
    </div>`;
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));

  const close = () => {
    wrap.classList.remove('show');
    setTimeout(() => wrap.remove(), 180);
  };
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) close();
  });

  const presetSubstance = state.substanceId;
  const presetRecipe = state.recipeId;
  if (presetRecipe) qs('#post-recipe', wrap).value = presetRecipe;
  if (presetSubstance) qs('#post-substance', wrap).value = presetSubstance;
  qs('#post-text', wrap).value = '';

  if (presetRecipe) {
    const r = store.recipe(presetRecipe);
    const firstSub = r.substanceIds?.[0];
    if (firstSub) qs('#post-substance', wrap).value = firstSub;
    qs('#post-text', wrap).value = `今天做了「${r.name}」。\n${(r.ingredients || []).join('、')}\n成人按 ${r.adultPortion}，青少年按 ${r.teenPortion}。`;
  }

  const pickedTags = new Set();
  qsa('[data-ptag]', wrap).forEach((b) =>
    b.addEventListener('click', () => {
      const t = b.dataset.ptag;
      if (pickedTags.has(t)) pickedTags.delete(t);
      else if (pickedTags.size >= 4) return toast('最多选 4 个标签', 'warn');
      else pickedTags.add(t);
      b.classList.toggle('on', pickedTags.has(t));
    })
  );

  const renderImgs = () => {
    qs('#preview-imgs', wrap).innerHTML = state.images
      .map((src, i) => `<div class="preview"><img src="${src}" alt="" /><button class="preview-del" data-rm="${i}">✕</button></div>`)
      .join('');
    qsa('[data-rm]', wrap).forEach((b) =>
      b.addEventListener('click', () => {
        state.images.splice(Number(b.dataset.rm), 1);
        renderImgs();
      })
    );
  };

  const addFiles = async (files) => {
    for (const f of files) {
      if (state.images.length >= 4) return toast('最多 4 张图片', 'warn');
      if (!f.type.startsWith('image/')) continue;
      const dataUrl = await readFileAsDataURL(f);
      const compressed = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.8));
        };
        img.src = dataUrl;
      });
      state.images.push(compressed);
    }
    renderImgs();
  };

  qs('#post-files', wrap).addEventListener('change', (e) => {
    addFiles([...e.target.files]);
    e.target.value = '';
  });
  qs('#post-camera', wrap).addEventListener('click', () => {
    const cam = document.createElement('input');
    cam.type = 'file';
    cam.accept = 'image/*';
    cam.capture = 'environment';
    cam.addEventListener('change', () => addFiles([...cam.files]));
    cam.click();
  });

  qs('#post-submit', wrap).addEventListener('click', async () => {
    const text = qs('#post-text', wrap).value.trim();
    if (!text && !state.images.length) return toast('写点文字或放张照片吧', 'warn');
    const post = {
      id: uid('post'),
      authorId: store.settings.activeVisitorId,
      createdAt: Date.now(),
      text,
      images: state.images.slice(),
      recipeId: qs('#post-recipe', wrap).value || '',
      substanceIds: qs('#post-substance', wrap).value ? [qs('#post-substance', wrap).value] : [],
      tags: [...pickedTags],
      likes: [],
      favorites: [],
      comments: [],
    };
    await store.addPost(post);
    close();
    toast('已发布，保存在本机', 'ok');
    state.recipeId = '';
    state.substanceId = '';
    renderCommunity(view, {});
  });
}

export function openComposerFromRoute(view) {
  openComposer(view);
}

