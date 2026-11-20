// 青养 · 首页：药食同源物质鉴别与百科
import { store } from '../lib/store.js';
import { esc, html, qs, qsa, toast } from '../lib/dom.js';
import { CATEGORY_META } from '../lib/seed.js';
import { searchAll } from '../lib/search.js';

let state = {
  q: '',
  category: '全部',
  sort: 'name',
  view: 'grid',
};

const page = (id) => `/substance/${id}`;

function card(s, compact) {
  const meta = CATEGORY_META[s.category] || CATEGORY_META['其他'];
  const recipeCount = store.recipesOfSubstance(s.id).length;
  return `<a class="sub-card ${compact ? 'compact' : ''}" data-link href="${page(s.id)}">
    <div class="sub-top">
      <span class="sub-cat" style="--tone:${meta.tone}">${esc(s.category)}</span>
      <span class="sub-recipe">${recipeCount} 道药膳</span>
    </div>
    <div class="sub-name">${esc(s.name)}</div>
    <div class="sub-alias">${esc((s.alias || []).slice(0, 3).join(' / '))}</div>
    <div class="sub-nature">${esc(s.nature)}</div>
    ${compact ? '' : `<div class="sub-effects">${esc((s.effects || '').slice(0, 56))}…</div>`}
    <div class="sub-doses">
      <span class="dose adult">成人 ${esc(s.adultDose)}</span>
      <span class="dose teen">青少年 ${esc(s.teenDose)}</span>
    </div>
  </a>`;
}

function filterList() {
  let list = store.substances.slice();
  if (state.category !== '全部') list = list.filter((s) => s.category === state.category);
  if (state.q.trim()) {
    const ids = new Set(searchAll(state.q).map((r) => r.id));
    list = list.filter((s) => ids.has(s.id));
  }
  if (state.sort === 'pinyin') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  } else {
    const order = Object.keys(CATEGORY_META);
    list.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }
  return list;
}

/**
 * 首页「常翻的物质」：按“社区帖子被收藏的次数 + 鉴别记录确认次数”综合热度取前 6。
 * 没有收藏/鉴别记录时返回空数组，界面给引导文案。
 */
function favoriteSubstances() {
  const favMap = new Map();
  for (const p of store.posts) {
    if (!(p.favorites || []).length) continue;
    const ids = new Set([...(p.substanceIds || []), ...(store.recipe(p.recipeId)?.substanceIds || [])]);
    for (const id of ids) favMap.set(id, (favMap.get(id) || 0) + 1);
  }
  const recMap = new Map();
  for (const r of store.identifications) {
    if (r.chosenId) recMap.set(r.chosenId, (recMap.get(r.chosenId) || 0) + 1);
  }
  return store.substances
    .map((s) => ({ s, fav: favMap.get(s.id) || 0, rec: recMap.get(s.id) || 0 }))
    .filter((x) => x.fav > 0 || x.rec > 0)
    .sort((a, b) => b.fav - a.fav || b.rec - a.rec || a.s.name.localeCompare(b.s.name, 'zh-Hans-CN'))
    .slice(0, 6);
}

export function renderHome(view, { query }) {
  if (query?.get('q') != null) state.q = query.get('q');
  if (query?.get('cat')) state.category = query.get('cat');

  const categories = Object.keys(CATEGORY_META).filter((c) => store.substances.some((s) => s.category === c));
  const list = filterList();
  const totalSubs = store.substances.length;
  const totalRecipes = store.recipes.length;

  view.innerHTML = html`
    <section class="hero">
      <div class="hero-main">
        <p class="eyebrow">药食同源 · 药典条目 · 本机运行</p>
        <h1>先认清这是什么，再想怎么吃</h1>
        <p class="hero-sub">
          收录 ${totalSubs} 种药食同源物质、${totalRecipes} 道家常药膳。找到一种物质，就能看到它的性味归经、药理功效、外形特征，以及成人 / 青少年的分龄参考量。
        </p>
        <div class="hero-actions">
          <button class="btn btn-primary" id="btn-photo">📷 拍照辅助鉴别</button>
          <button class="btn btn-ghost" id="btn-feature">按外形特征逐项选</button>
          <a class="btn btn-ghost" data-link href="/conditions">我不知道吃啥 → 看身体状况</a>
        </div>
      </div>
      <div class="hero-side">
        <div class="hero-tip">
          <b>为什么先鉴别？</b>
          <p>药食同源物质很多长得像，比如怀山药与普通菜山药、杭白菊与野菊花。认错品种，性味和用量都会偏。照片只能看颜色，最终请对照外形特征与实物。</p>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>物质库</h2>
        <div class="panel-tools">
          <input id="sub-q" class="input" type="search" placeholder="在本页筛选：名称 / 别名 / 功效" value="${esc(state.q)}" />
          <select id="sub-sort" class="select">
            <option value="category" ${state.sort === 'category' ? 'selected' : ''}>按类别分组</option>
            <option value="pinyin" ${state.sort === 'pinyin' ? 'selected' : ''}>按名称排序</option>
          </select>
          <button class="btn btn-sm ${state.view === 'grid' ? 'btn-primary' : 'btn-ghost'}" id="view-grid">卡片</button>
          <button class="btn btn-sm ${state.view === 'list' ? 'btn-primary' : 'btn-ghost'}" id="view-list">列表</button>
        </div>
      </div>

      <div class="cat-row">
        <button class="chip ${state.category === '全部' ? 'on' : ''}" data-cat="全部">全部 <small>${totalSubs}</small></button>
        ${categories
          .map((c) => {
            const n = store.substances.filter((s) => s.category === c).length;
            const meta = CATEGORY_META[c];
            return `<button class="chip ${state.category === c ? 'on' : ''}" data-cat="${esc(c)}" title="${esc(meta.desc)}">${esc(c)} <small>${n}</small></button>`;
          })
          .join('')}
      </div>

      <div class="result-line muted small">共 ${list.length} 种${state.q ? ` · 关键词「${esc(state.q)}」` : ''}</div>
      <div class="sub-grid ${state.view === 'list' ? 'as-list' : ''}">
        ${list.length ? list.map((s) => card(s, state.view === 'list')).join('') : '<div class="empty">没有匹配的物质，换个关键词或类别试试。</div>'}
      </div>
    </section>

    <section class="panel two-col">
      <div>
        <div class="panel-head"><h2>按身体状况找物质</h2><a class="link" data-link href="/conditions">全部状况 →</a></div>
        <div class="cond-mini">
          ${store.conditions
            .slice(0, 6)
            .map(
              (c) => `<a class="mini-cond" data-link href="/conditions?c=${c.id}">
                <b>${esc(c.name)}</b>
                <span>${esc(c.summary)}</span>
                <em>${store.recipesOfCondition(c.id).length} 道药膳</em>
              </a>`
            )
            .join('')}
        </div>
      </div>
      <div>
        <div class="panel-head"><h2>常翻的物质</h2><a class="link" data-link href="/">物质库 →</a></div>
        <div class="rec-list">
          ${
            favoriteSubstances().length
              ? favoriteSubstances()
                  .map(
                    (x) =>
                      `<a class="rec-item" data-link href="${page(x.s.id)}">
                        <span class="rec-noimg">${esc(x.s.category.slice(0, 2))}</span>
                        <div>
                          <b>${esc(x.s.name)}</b>
                          <span class="small muted">${x.fav > 0 ? `社区收藏 ${x.fav} 次` : `鉴别确认 ${x.rec} 次`} · ${esc(x.s.nature.split('，')[0])}</span>
                        </div>
                      </a>`
                  )
                  .join('')
              : '<p class="muted small">收藏过社区帖子、或用鉴别确认过的物质会排在这里，方便回看。</p>'
          }
        </div>
        <hr style="border:none;border-top:1px dashed var(--line);margin:16px 0" />
        <div class="panel-head"><h2>本机鉴别记录</h2><a class="link" data-link href="/data">数据管理 →</a></div>
        <div class="rec-list">
          ${
            store.identifications.length
              ? store.identifications
                  .slice(0, 4)
                  .map(
                    (r) =>
                      `<a class="rec-item" data-link href="${r.chosenId ? page(r.chosenId) : '/substance'}">
                        ${r.image ? `<img src="${r.image}" alt="" />` : '<span class="rec-noimg">特征</span>'}
                        <div>
                          <b>${esc(store.substance(r.chosenId)?.name || '未确定')}</b>
                          <span class="small muted">${r.method === 'photo' ? '照片比对' : '特征选择'} · ${new Date(r.createdAt).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </a>`
                  )
                  .join('')
              : '<p class="muted small">还没有鉴别记录。用一次「拍照辅助鉴别」或「特征逐项选择」后会留在这里。</p>'
          }
        </div>
      </div>
    </section>`;

  // 交互
  qs('#btn-photo', view).addEventListener('click', () => window.qy.openPhoto());
  qs('#btn-feature', view).addEventListener('click', () => window.qy.openFeature());
  qs('#sub-q', view).addEventListener('input', (e) => {
    state.q = e.target.value;
    renderHome(view, {});
    const input = qs('#sub-q', view);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
  qs('#sub-sort', view).addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderHome(view, {});
  });
  qs('#view-grid', view).addEventListener('click', () => {
    state.view = 'grid';
    renderHome(view, {});
  });
  qs('#view-list', view).addEventListener('click', () => {
    state.view = 'list';
    renderHome(view, {});
  });
  qsa('[data-cat]', view).forEach((b) =>
    b.addEventListener('click', () => {
      state.category = b.dataset.cat;
      renderHome(view, {});
    })
  );
}

export function setHomeQuery(q) {
  state.q = q;
}

export function renderSubstancePage(view, id) {
  const s = store.substance(id);
  if (!s) {
    view.innerHTML = `<div class="empty">没有找到这个物质。<a class="link" data-link href="/">回首页</a></div>`;
    return;
  }
  const meta = CATEGORY_META[s.category] || CATEGORY_META['其他'];
  const recipes = store.recipesOfSubstance(s.id);
  const conds = store.conditionsOfSubstance(s.id);
  const feats = s.features || {};

  view.innerHTML = html`
    <div class="crumb"><a data-link href="/">首页</a> / <a data-link href="/?cat=${esc(encodeURIComponent(s.category))}">${esc(s.category)}</a> / <b>${esc(s.name)}</b></div>

    <section class="detail-head">
      <div>
        <div class="sub-cat" style="--tone:${meta.tone}">${esc(s.category)}</div>
        <h1>${esc(s.name)}</h1>
        <p class="alias-line">别名：${esc((s.alias || []).join('、') || '—')}</p>
        <p class="nature-line">${esc(s.nature)}</p>
      </div>
      <div class="detail-quick">
        <div class="dose-card adult"><span>成人参考量</span><b>${esc(s.adultDose)}</b></div>
        <div class="dose-card teen"><span>青少年参考量</span><b>${esc(s.teenDose)}</b></div>
      </div>
    </section>

    <div class="detail-grid">
      <div class="detail-main">
        <section class="panel">
          <h2>药典条目</h2>
          <dl class="kv">
            <dt>正名</dt><dd>${esc(s.name)}</dd>
            <dt>别名</dt><dd>${esc((s.alias || []).join('、') || '—')}</dd>
            <dt>性味归经</dt><dd>${esc(s.nature)}</dd>
            <dt>功效</dt><dd>${esc(s.effects || '暂无')}</dd>
            <dt>用量</dt><dd>${esc(s.usage || '暂无')} <span class="muted small">（药典用法用量原文）</span></dd>
            <dt>用药禁忌</dt><dd>${(s.cautions || []).length ? s.cautions.map((c) => `<span class="tag-warn">${esc(c)}</span>`).join(' ') : '暂无'}</dd>
          </dl>
        </section>

        <section class="panel">
          <h2>外形鉴别特征</h2>
          <div class="feat-grid">
            ${[
              ['形状', feats.shape],
              ['颜色', feats.color],
              ['质地', feats.texture],
              ['气味', feats.smell],
              ['断面/加工状态', feats.section],
            ]
              .filter(([, v]) => v?.length)
              .map(([k, v]) => `<div><span class="muted small">${esc(k)}</span><p>${v.map((x) => esc(x)).join('、')}</p></div>`)
              .join('')}
          </div>
        </section>

        <section class="panel">
          <h2>能做的药膳（${recipes.length}）</h2>
          ${recipes.length ? `<div class="recipe-list">${recipes.map(recipeCard).join('')}</div>` : '<p class="muted small">暂未收录该物质的药膳。</p>'}
        </section>
      </div>

      <aside class="detail-side">
        <section class="panel">
          <h2>适用身体状况</h2>
          ${
            conds.length
              ? `<div class="tagbox">${conds.map((c) => `<a class="tag" data-link href="/conditions?c=${c.id}">${esc(c.name)}</a>`).join('')}</div>`
              : '<p class="muted small">暂无关联状况。</p>'
          }
        </section>
        <section class="panel">
          <h2>安全提示</h2>
          <div class="safety">
            <p>以上参考量适用于一般成年人与青少年日常食用；<b>不替代医生诊断与药物治疗</b>。</p>
            <p>慢性病服药中、孕产妇、婴幼儿、过敏体质请先咨询医师或药师。</p>
            <p>出现不适立即停用并就医。</p>
          </div>
        </section>
        <section class="panel">
          <h2>相关操作</h2>
          <div class="stack">
            <button class="btn btn-ghost" id="go-photo">📷 再鉴别一次</button>
            <a class="btn btn-ghost" data-link href="/community?compose=1&substance=${s.id}">分享它的药膳日常</a>
          </div>
        </section>
      </aside>
    </div>`;

  qs('#go-photo', view).addEventListener('click', () => window.qy.openPhoto());
}

export function recipeCard(r) {
  const subs = (r.substanceIds || []).map((id) => store.substance(id)).filter(Boolean);
  return `<a class="recipe-card" data-link href="/recipe/${r.id}">
    <div class="rc-head"><b>${esc(r.name)}</b><span class="small muted">${subs.map((s) => esc(s.name)).join(' + ')}</span></div>
    <p class="rc-fit">${esc(r.fit || '')}</p>
    <div class="rc-portions">
      <span class="dose adult">成人：${esc(r.adultPortion || '')}</span>
      <span class="dose teen">青少年：${esc(r.teenPortion || '')}</span>
    </div>
  </a>`;
}

export function renderRecipePage(view, id) {
  const r = store.recipe(id);
  if (!r) {
    view.innerHTML = '<div class="empty">没有找到这道药膳。<a class="link" data-link href="/conditions">去看看身体状况</a></div>';
    return;
  }
  const subs = (r.substanceIds || []).map((sid) => store.substance(sid)).filter(Boolean);
  const conds = (r.conditionIds || []).map((cid) => store.condition(cid)).filter(Boolean);

  view.innerHTML = html`
    <div class="crumb"><a data-link href="/">首页</a> / <a data-link href="/conditions">身体状况</a> / <b>${esc(r.name)}</b></div>
    <section class="panel recipe-detail">
      <h1>${esc(r.name)}</h1>
      <div class="tagbox">
        ${subs.map((s) => `<a class="tag" data-link href="${page(s.id)}">${esc(s.name)}</a>`).join('')}
        ${conds.map((c) => `<a class="tag cond" data-link href="/conditions?c=${c.id}">${esc(c.name)}</a>`).join('')}
      </div>
      <div class="two-dose">
        <div class="dose-box adult">
          <h3>成人参考份量</h3>
          <p>${esc(r.adultPortion)}</p>
          ${subs.map((s) => `<p class="small muted">${esc(s.name)}：${esc(s.adultDose)}</p>`).join('')}
        </div>
        <div class="dose-box teen">
          <h3>青少年参考份量</h3>
          <p>${esc(r.teenPortion)}</p>
          ${subs.map((s) => `<p class="small muted">${esc(s.name)}：${esc(s.teenDose)}</p>`).join('')}
        </div>
      </div>
      <h2>用料</h2>
      <ul class="ing-list">${(r.ingredients || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <h2>做法</h2>
      <ol class="steps">${(r.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <h2>适用人群</h2>
      <p>${esc(r.fit || '')}</p>
      <h2>注意事项</h2>
      <div class="safety">
        ${(r.cautions || []).map((c) => `<p>· ${esc(c)}</p>`).join('') || '<p>· 按参考量食用，出现不适请停用。</p>'}
        <p>· 不替代药物治疗；慢性病患者及孕期请遵医嘱。</p>
      </div>
      <div class="row-actions">
        <a class="btn btn-primary" data-link href="/community?compose=1&recipe=${r.id}">分享这道药膳的日常</a>
        <a class="btn btn-ghost" data-link href="/community?filter=recipe:${r.id}">看看别人怎么吃</a>
      </div>
    </section>`;
}
