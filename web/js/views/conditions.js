// 青养 · 身体状况 → 适用物质 → 药膳（含成人 / 青少年分龄剂量）
import { store } from '../lib/store.js';
import { esc, html, qs, qsa, toast, modal, debounce } from '../lib/dom.js';
import { recipeCard } from './home.js';
import { MEDICAL_GUIDE } from '../data/medical.js';
import { TEAS } from '../data/teas.js';
import { imageHtml } from '../lib/images.js';
import { searchFreeText } from '../lib/freetext.js';
import { refsFor } from '../data/literature.js';

function teaCard(t) {
  const on = store.isBookmarked('tea', t.id);
  return `<div class="tea-card">
    ${imageHtml('tea', t.id, t.name, 'tea-pic')}
    <div class="tea-head"><b>🍵 ${esc(t.name)}</b><button class="fav-btn fav-sm ${on ? 'on' : ''}" data-fav-type="tea" data-fav-id="${t.id}" title="收藏到食谱本">${on ? '♥' : '＋'}</button></div>
    <p class="tea-ing">配料：${esc((t.ingredients || []).join('、'))}</p>
    <p class="small muted">${esc(t.method || '')}</p>
    <div class="dose-line">
      <span class="dose adult">成人 ${esc(t.adultPortion)}</span>
      <span class="dose teen">青少年 ${esc(t.teenPortion)}</span>
    </div>
    ${(t.cautions || []).length ? `<p class="small muted tea-caution">宜忌：${esc(t.cautions.join('；'))}</p>` : ''}
  </div>`;
}

let current = null;
// 记住用户最近一次的自述，用于在状况详情里说明“为什么推荐它”
let lastQuery = '';

function matchedConditions(q) {
  const n = String(q || '').trim();
  if (!n) return [];
  return store.conditions
    .map((c) => {
      const hits = (c.keywords || []).filter((k) => n.includes(k) || k.includes(n));
      return { c, hits };
    })
    .filter((x) => x.hits.length)
    .sort((a, b) => b.hits.length - a.hits.length);
}

function conditionOptions() {
  const all = new Set();
  for (const c of store.conditions) (c.keywords || []).forEach((k) => all.add(k));
  return [...all];
}

export function renderConditions(view, { query }) {
  const wantId = query?.get('c');
  if (wantId) current = wantId;
  const active = current ? store.condition(current) : null;

  view.innerHTML = html`
    <section class="cond-hero">
      <h1>你最近身体有这些小信号吗？</h1>
      <p class="muted">先选一个最贴近的状况，或把自己不舒服的地方写下来。下面会列出<b>适用的药食同源物质</b>和<b>能做的药膳</b>，并把成人、青少年的参考量分开写。</p>
      <div class="self-check">
        <input class="input big" id="sym-input" placeholder="例：吃一点就饱、大便稀、容易疲乏…（写你的感受即可）" />
        <button class="btn btn-primary" id="sym-btn">对照筛选用法</button>
      </div>
      <div id="sym-result" class="sym-result"></div>
      <datalist id="sym-names">
        ${conditionOptions().map((k) => `<option value="${esc(k)}"></option>`).join('')}
      </datalist>
    </section>

    <section class="panel free-search">
      <div class="panel-head">
        <h2>按你的情况搜药膳</h2>
        <span class="muted small">不必对着上面的症状找，用自己的话说也行</span>
      </div>
      <div class="self-check">
        <input class="input big" id="free-q" placeholder="例：最近总是失眠、口也干，想找安神润燥的药膳" />
        <button class="btn btn-primary" id="free-btn">搜索</button>
      </div>
      <div class="free-tags">
        <span class="muted small">试试：</span>
        ${['失眠', '口干咽燥', '怕冷', '胃口差', '上火', '便秘', '湿气重', '眼睛干'].map((k) => `<button class="chip" data-free="${k}">${k}</button>`).join('')}
      </div>
      <div id="free-result" class="free-result"></div>
    </section>

    <section class="cond-grid">
      ${store.conditions
        .map((c) => {
          const nSub = new Set(store.recipesOfCondition(c.id).flatMap((r) => r.substanceIds || [])).size;
          return `<button class="cond-card ${current === c.id ? 'on' : ''}" data-cond="${c.id}">
            <b>${esc(c.name)}</b>
            <span>${esc(c.summary)}</span>
            <em>${nSub} 种物质 · ${store.recipesOfCondition(c.id).length} 道药膳</em>
          </button>`;
        })
        .join('')}
    </section>

    <section id="cond-detail" class="cond-detail"></section>`;

  qs('#sym-input', view).addEventListener('input', (e) => {
    const found = matchedConditions(e.target.value);
    const box = qs('#sym-result', view);
    if (!e.target.value.trim()) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = found.length
      ? `<p class="small muted">根据你写的内容，比较接近：</p>
        <div class="tagbox">${found
          .map((f) => `<button class="tag" data-jump="${f.c.id}">你提到「${f.hits.slice(0, 3).map((h) => esc(h)).join('、')}」→ ${esc(f.c.name)}</button>`)
          .join('')}</div>`
      : '<p class="small muted">没有匹配到已收录的状况，可以浏览上方状况卡片，或到「药膳社区」看看大家的经验。</p>';
  });
  qs('#sym-btn', view).addEventListener('click', () => {
    const q = qs('#sym-input', view).value;
    const first = matchedConditions(q)[0];
    if (first) selectCondition(first.c.id, view, q);
    else toast('没找到相近状况，请用上面的卡片选择', 'warn');
  });

  const bind = () => {
    qsa('[data-cond]', view).forEach((b) => b.addEventListener('click', () => selectCondition(b.dataset.cond, view, '')));
    qsa('[data-jump]', view).forEach((b) => b.addEventListener('click', () => selectCondition(b.dataset.jump, view, qs('#sym-input', view).value)));
  };
  bind();

  // 自由搜索：用户用自己的话找药膳（同义词 → 主题 → 状况/药膳）
  const freeInput = qs('#free-q', view);
  const freeBox = qs('#free-result', view);
  const doFree = debounce(() => renderFreeResults(freeBox, freeInput.value), 180);
  freeInput.addEventListener('input', doFree);
  freeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') renderFreeResults(freeBox, freeInput.value);
  });
  qs('#free-btn', view).addEventListener('click', () => renderFreeResults(freeBox, freeInput.value));
  qsa('[data-free]', view).forEach((b) =>
    b.addEventListener('click', () => {
      freeInput.value = b.dataset.free;
      renderFreeResults(freeBox, b.dataset.free);
      freeInput.focus();
    })
  );
  const wantQ = query?.get('q');
  if (wantQ) {
    freeInput.value = wantQ;
    renderFreeResults(freeBox, wantQ);
  }

  if (active) renderConditionDetail(view, active);
}

/** 自由搜索结果显示：药膳优先，其次物质、状况；每条给「为什么推荐」与文献出处 */
function renderFreeResults(box, q) {
  if (!box) return;
  const res = searchFreeText(q);
  if (!String(q || '').trim()) {
    box.innerHTML = '';
    return;
  }
  if (res.tooShort) {
    box.innerHTML = '<p class="small muted">再多写两个字试试，比如「失眠」「口干」「怕冷」。</p>';
    return;
  }
  const total = res.recipes.length + res.substances.length + res.conditions.length;
  if (!total) {
    box.innerHTML = `<p class="muted">没找到「${esc(res.query)}」相关的药膳。换个说法，或点上面的常用词试试；也可以直接选上面的状况卡片。</p>`;
    return;
  }
  box.innerHTML = `
    <p class="small muted result-line">
      ${res.topics.length ? `识别到：<b>${res.topics.map((t) => esc(t)).join('、')}</b> · ` : ''}
      找到 ${res.recipes.length} 道药膳、${res.substances.length} 种物质、${res.conditions.length} 个相近状况
    </p>
    ${
      res.recipes.length
        ? `<div class="free-list">${res.recipes
            .map(
              ({ r, why }) => `<a class="free-item" data-link href="/recipe/${r.id}">
                ${imageHtml('dish', r.id, r.name, 'free-pic')}
                <div class="free-body">
                  <div class="free-head"><b>${esc(r.name)}</b><span class="chip soft">${esc(why.join(' · '))}</span></div>
                  <p class="small muted">${esc(r.fit || '')}</p>
                  <div class="dose-line">
                    <span class="dose adult">成人 ${esc(r.adultPortion || '')}</span>
                    <span class="dose teen">青少年 ${esc(r.teenPortion || '')}</span>
                  </div>
                  <p class="small muted">📖 ${refsFor('dish', r.id).map((x) => esc(x)).join(' ')}</p>
                </div>
              </a>`
            )
            .join('')}</div>`
        : ''
    }
    ${
      res.substances.length
        ? `<h4 class="free-sub">相关物质</h4><div class="tagbox">${res.substances
            .map(({ s, why }) => `<a class="tag" data-link href="/substance/${s.id}" title="${esc(why.join(' · '))}">🌿 ${esc(s.name)}</a>`)
            .join('')}</div>`
        : ''
    }
    ${
      res.conditions.length
        ? `<h4 class="free-sub">相近状况</h4><div class="tagbox">${res.conditions
            .map(({ c }) => `<button class="tag cond" data-jump2="${c.id}">${esc(c.name)}</button>`)
            .join('')}</div>`
        : ''
    }
    <p class="small muted free-note">以上为中医食疗文献中的常见搭配整理，仅供日常饮食参考，不替代医生诊断与处方。</p>`;

  qsa('[data-jump2]', box).forEach((b) =>
    b.addEventListener('click', () => {
      const view = box.closest('#view') || document;
      selectCondition(b.dataset.jump2, view, qs('#free-q', view)?.value || '');
    })
  );
}

function selectCondition(id, view, query) {
  current = id;
  lastQuery = String(query || '').trim();
  qsa('[data-cond]', view).forEach((b) => b.classList.toggle('on', b.dataset.cond === id));
  renderConditionDetail(view, store.condition(id));
  const el = qs('#cond-detail', view);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderConditionDetail(view, c) {
  const el = qs('#cond-detail', view);
  if (!el || !c) return;
  const recipes = store.recipesOfCondition(c.id);
  const subIds = [...new Set(recipes.flatMap((r) => r.substanceIds || []))];
  const subs = subIds.map((id) => store.substance(id)).filter(Boolean);

  el.innerHTML = html`
    <div class="cond-head">
      <div>
        <h2>${esc(c.name)}</h2>
        ${
          lastQuery
            ? `<p class="small muted" style="color:var(--green-d)">✓ 因为你提到「${esc(lastQuery)}」，所以为你对照这个状况。</p>`
            : ''
        }
        <p class="muted">${esc(c.summary)}</p>
        <div class="tagbox">${(c.keywords || []).map((k) => `<span class="tag soft">${esc(k)}</span>`).join('')}</div>
      </div>
      <div class="cond-tips">
        <b>日常调理提示</b>
        <ul>${(c.tips || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    </div>

    <h3 class="sec-title">① 适用的药食同源物质 · 成人 / 青少年用量的区别</h3>
    <div class="dose-table-wrap">
      <table class="dose-table">
        <thead>
          <tr><th>物质</th><th>性味归经</th><th>成人参考量</th><th>青少年参考量</th><th>宜忌</th></tr>
        </thead>
        <tbody>
          ${subs
            .map(
              (s) => `<tr>
                <td><a class="link" data-link href="/substance/${s.id}">${esc(s.name)}</a></td>
                <td class="small">${esc(s.nature)}</td>
                <td><span class="dose adult">${esc(s.adultDose)}</span></td>
                <td><span class="dose teen">${esc(s.teenDose)}</span></td>
                <td class="small muted">${esc((s.cautions || []).join('；') || '—')}</td>
              </tr>`
            )
            .join('') || '<tr><td colspan="5" class="muted">暂无数据</td></tr>'}
        </tbody>
      </table>
    </div>

    <h3 class="sec-title">② 能做的药膳（${recipes.length} 道）</h3>
    <div class="recipe-list">${recipes.map(recipeCard).join('') || '<p class="muted small">暂无药膳。</p>'}</div>

    ${(function () {
      const teas = TEAS.filter((t) => (t.conditionIds || []).includes(c.id));
      if (!teas.length) return '';
      return `
      <h3 class="sec-title">③ 适合的泡茶（${teas.length} 款）</h3>
      <div class="tea-list">${teas.map(teaCard).join('')}</div>
      <p class="small muted tea-note">茶饮为家庭日常参考量：青少年指 12–18 岁左右，更小儿童需再减半并咨询医师；标注的“连饮不超过”请务必遵守，必要时就医。</p>`;
    })()}

    ${(function () {
      const guide = MEDICAL_GUIDE.departments[c.id];
      if (!guide) return '';
      return `
      <h3 class="sec-title">④ 就医导航（什么情况该去看医生）</h3>
      <div class="medical-card">
        <p class="medical-dept">🏥 <b>建议就诊科室：</b>${esc(guide.dept)}</p>
        <p class="medical-sub"><b>出现以下情况，请尽快就医：</b></p>
        <ul>${guide.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <p class="medical-sub"><b>就诊前准备：</b></p>
        <ul>${MEDICAL_GUIDE.prep.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <details class="medical-more">
          <summary>所有状况通用的就医警示</summary>
          <ul>${MEDICAL_GUIDE.globalRedFlags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        </details>
        <p class="small muted medical-footer">${esc(MEDICAL_GUIDE.footer)}</p>
      </div>`;
    })()}

    <div class="safety big">
      <b>阅读提示</b>
      <p>青少年指 12–18 岁左右；更小的儿童需在此基础上再减半，并咨询医师。以上均为<b>家庭日常参考量</b>，不替代处方剂量。</p>
      <p>同一天不要叠加多种作用相近的物质；服用中药、降糖降压药期间请先咨询医师。</p>
    </div>`;

  // 茶饮收藏按钮（收藏到「我的食谱本」）
  qsa('[data-fav-type="tea"]', el).forEach((btn) =>
    btn.addEventListener('click', async () => {
      const on = await store.toggleBookmark('tea', btn.dataset.favId);
      btn.classList.toggle('on', on);
      btn.textContent = on ? '♥' : '＋';
      const t = TEAS.find((x) => x.id === btn.dataset.favId);
      toast(on ? `已把「${t?.name || ''}」收藏到食谱本` : '已取消收藏', 'ok');
    })
  );
}
