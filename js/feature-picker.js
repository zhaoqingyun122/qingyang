// 青养 · 外形特征逐项选择（拍照识别的兜底路径）
import { store } from './lib/store.js';
import { esc, html, qs, toast, uid } from './lib/dom.js';

const DIMENSIONS = [
  { key: 'shape', label: '形状' },
  { key: 'color', label: '颜色' },
  { key: 'texture', label: '质地' },
  { key: 'smell', label: '气味' },
  { key: 'section', label: '断面/加工状态' },
];

function optionsFor(key) {
  const counter = new Map();
  for (const s of store.substances) {
    const arr = s.features?.[key] || [];
    for (const vRaw of arr) {
      // 把「椭圆形」「类球形」这类近义/异体写法归并，减少干扰项
      const v = canonical(vRaw);
      const item = counter.get(v) || { value: v, count: 0, ids: [] };
      item.count += 1;
      item.ids.push(s.id);
      counter.set(v, item);
    }
  }
  return [...counter.values()].sort((a, b) => b.count - a.count);
}

function canonical(v) {
  return String(v)
    .replace(/^类/, '')
    .replace(/形$/, '')
    .replace(/^略/, '')
    .trim();
}

function scoreSubstances(picked) {
  return store.substances
    .map((s) => {
      let score = 0;
      let matchedDims = 0;
      for (const dim of DIMENSIONS) {
        const want = picked[dim.key];
        if (!want?.length) continue;
        matchedDims += 1;
        const have = new Set((s.features?.[dim.key] || []).map(canonical));
        const hits = want.filter((w) => have.has(canonical(w))).length;
        score += hits / want.length;
      }
      // 匹配的维度越多越可信，避免只沾到一两个词就排第一
      const weighted = matchedDims ? score / matchedDims : 0;
      return { s, score: weighted, coverage: matchedDims };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.coverage - a.coverage);
}

export function openFeaturePicker({ onPick }) {
  const root = qs('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-mask';
  wrap.innerHTML = `<div class="modal modal-wide feature-modal" role="dialog" aria-modal="true">
    <div class="modal-head">
      <h3>外形特征逐项选择</h3>
      <button class="icon-btn" data-close aria-label="关闭">✕</button>
    </div>
    <div class="modal-body">
      <p class="muted small">看着手里的实物，按印象点选。点得越具体，候选越准；拿不准的项可以先不选。</p>
      <div id="feature-steps"></div>
      <div id="feature-result" class="feature-result"></div>
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

  const picked = {};
  const steps = qs('#feature-steps', wrap);
  const resEl = qs('#feature-result', wrap);

  const render = () => {
    steps.innerHTML = DIMENSIONS.map((dim) => {
      const opts = optionsFor(dim.key);
      const sel = picked[dim.key] || [];
      return `<div class="fstep">
        <div class="fstep-head"><b>${dim.label}</b><span class="muted small">${sel.length ? '已选 ' + sel.length + ' 项' : '未选'}</span></div>
        <div class="fchips">
          ${opts
            .map(
              (o) =>
                `<button class="fchip ${sel.includes(o.value) ? 'on' : ''}" data-dim="${dim.key}" data-val="${esc(o.value)}">${esc(o.value)}<small>${o.count}</small></button>`
            )
            .join('')}
        </div>
      </div>`;
    }).join('');

    const ranked = scoreSubstances(picked);
    const meaningful = Object.values(picked).some((v) => v?.length);
    if (!meaningful) {
      resEl.innerHTML = '<p class="muted small">先从上面选一两项特征，这里会实时给出候选。</p>';
    } else if (!ranked.length) {
      resEl.innerHTML = '<p class="muted small">没有物质同时符合这些特征，试着减少几项再选。</p>';
    } else {
      resEl.innerHTML = `<h4 class="res-title">实时候选</h4>
        <p class="muted small" style="margin:2px 0 8px">按特征覆盖度从高到低排序：点任意卡片，或直接用「就选第一个」进入详情后再核对。</p>
        <div class="cand-list">
          ${ranked
            .slice(0, 6)
            .map(
              (r) => `<button class="cand" data-pick="${r.s.id}">
                <span class="cand-score">${Math.round(r.score * 100)}%</span>
                <span class="cand-name">${esc(r.s.name)}</span>
                <span class="cand-desc">${esc(r.s.nature)}</span>
                <span class="cand-hint">${esc((r.s.effects || '').slice(0, 34))}…</span>
              </button>`
            )
            .join('')}
        </div>
        <button class="btn btn-primary" id="confirm-pick">就选第一个：${esc(ranked[0].s.name)}</button>`;
      qs('#confirm-pick', resEl).addEventListener('click', () => finish(ranked[0].s.id, ranked));
    }

    steps.querySelectorAll('.fchip').forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.dim;
        const val = b.dataset.val;
        const arr = new Set(picked[key] || []);
        if (arr.has(val)) arr.delete(val);
        else arr.add(val);
        picked[key] = [...arr];
        render();
      })
    );
    resEl.querySelectorAll('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => {
        const ranked2 = scoreSubstances(picked);
        finish(b.dataset.pick, ranked2);
      })
    );
  };

  const finish = async (id, ranked) => {
    await store.addIdentification({
      id: uid('rec'),
      createdAt: Date.now(),
      image: null,
      method: 'feature',
      features: JSON.parse(JSON.stringify(picked)),
      candidateIds: (ranked || []).slice(0, 6).map((r) => r.s.id),
      chosenId: id,
    });
    close();
    onPick(id);
  };

  render();
  return { wrap };
}
