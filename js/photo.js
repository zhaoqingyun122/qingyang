// 青养 · 拍照鉴别页（模态）
import { store } from './lib/store.js';
import { esc, html, qs, toast, uid, downloadBlob, readFileAsDataURL } from './lib/dom.js';
import { recognizePhoto } from './lib/photo-id.js';

const compressImage = (dataUrl, maxSize = 640, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('图片读取失败'));
    img.src = dataUrl;
  });

const colorTextOf = (s) =>
  [...(s.features?.color || []), ...(s.features?.section || [])].join(' ');

export function openPhotoIdentify({ onPick }) {
  const root = qs('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-mask';
  wrap.innerHTML = html`
    <div class="modal modal-wide photo-modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3>拍照辅助鉴别</h3>
        <button class="icon-btn" data-close aria-label="关闭">✕</button>
      </div>
      <div class="modal-body">
        <p class="muted small">
          选择一张药食同源物质的实物照片。程序只在你本机浏览器里分析颜色，不上传、不联网。
          照片比对只能根据整体颜色缩小范围，请结合「外形特征逐项选择」与实物核对后确定。
        </p>
        <div class="photo-stage" id="photo-stage">
          <div class="photo-empty">
            <div class="photo-icon">📷</div>
            <p>还没有照片</p>
            <label class="btn btn-primary">选择照片<input type="file" accept="image/*" id="photo-input" hidden /></label>
            <button class="btn btn-ghost" id="photo-cam">用摄像头拍照</button>
          </div>
        </div>
        <div id="photo-result"></div>
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

  const stage = qs('#photo-stage', wrap);
  const resultEl = qs('#photo-result', wrap);
  let currentDataUrl = null;
  let lastRanked = [];

  const saveRecord = async (ranked) => {
    try {
      await store.addIdentification({
        id: uid('rec'),
        createdAt: Date.now(),
        image: await compressImage(currentDataUrl, 380, 0.68),
        method: 'photo',
        candidateIds: ranked.map((r) => r.id),
        chosenId: ranked[0]?.id || null,
        palette: (ranked.palette || []).slice(0, 4),
      });
    } catch (err) {
      console.warn('保存鉴别记录失败', err);
    }
  };

  const analyze = async () => {
    if (!currentDataUrl) return;
    resultEl.innerHTML = '<p class="muted small">正在分析颜色特征…</p>';
    try {
      const out = await recognizePhoto(currentDataUrl, store.substances, colorTextOf);
      lastRanked = out.ranked;
      const swatches = out.palette.top
        .map(
          (p) =>
            `<span class="swatch" title="占比约 ${Math.round(p.share * 100)}%"><i style="background:rgb(${p.rgb.join(',')})"></i>${esc(p.name)}</span>`
        )
        .join('');

      if (!out.ranked.length) {
        resultEl.innerHTML = html`<div class="notice">
          <b>颜色特征没有匹配到明显的候选</b>
          <p class="muted small">可能是光线、背景或摆盘影响了判断（主色：${swatches}）。建议换成纯色背景、自然光下再拍，或直接用外形特征逐项选择。</p>
          <button class="btn btn-primary" id="goto-feature">用外形特征逐项选择</button>
        </div>`;
      } else {
        resultEl.innerHTML = html`
          <div class="notice">
            <b>可能属于以下几种（按整体颜色相似度排序）</b>
            <p class="muted small">照片主色：${swatches}。这只是辅助线索，点候选前请再对照卡片里的特征与实物，拿不准就用「外形特征逐项选择」。</p>
          </div>
          <div class="cand-list">
            ${out.ranked
              .map((r) => {
                const s = store.substance(r.id);
                return html`<button class="cand" data-pick="${r.id}">
                  <span class="cand-score">${Math.round(r.score * 100)}%</span>
                  <span class="cand-name">${s.name}</span>
                  <span class="cand-desc">${s.nature}</span>
                  <span class="cand-hint">颜色：${(s.features?.color || []).join('、')}｜形状：${(s.features?.shape || []).join('、')}</span>
                  <span class="cand-go">就选这个 →</span>
                </button>`;
              })
              .join('')}
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost" id="goto-feature2">都不像？用外形特征逐项选择</button>
            <button class="btn btn-ghost" id="save-rec">保存这次鉴别记录</button>
          </div>`;
      }

      resultEl.querySelectorAll('[data-pick]').forEach((b) =>
        b.addEventListener('click', () => {
          const id = b.dataset.pick;
          close();
          onPick(id);
        })
      );
      const goFeature = () => {
        close();
        onPick(null);
      };
      qs('#goto-feature', resultEl)?.addEventListener('click', goFeature);
      qs('#goto-feature2', resultEl)?.addEventListener('click', goFeature);
      qs('#save-rec', resultEl)?.addEventListener('click', async () => {
        const btn = qs('#save-rec', resultEl);
        btn.disabled = true;
        btn.textContent = '已保存 ✓';
        await saveRecord({ ...out.ranked, palette: out.palette.top.map((p) => p.name) });
        toast('已保存到本机鉴别记录', 'ok');
      });
    } catch (err) {
      resultEl.innerHTML = html`<div class="notice danger"><b>分析失败</b><p class="muted small">${esc(err.message)}</p></div>`;
    }
  };

  const showImage = (dataUrl) => {
    currentDataUrl = dataUrl;
    stage.innerHTML = `<img src="${dataUrl}" alt="待鉴别的照片" /><div class="photo-tools">
      <label class="btn btn-sm btn-ghost">换一张<input type="file" accept="image/*" id="photo-input2" hidden /></label>
      <button class="btn btn-sm btn-primary" id="photo-again">重新分析</button>
    </div>`;
    qs('#photo-input2', stage)?.addEventListener('change', onFile);
    qs('#photo-again', stage)?.addEventListener('click', analyze);
    analyze();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('请选择图片文件', 'warn');
    if (file.size > 25 * 1024 * 1024) return toast('图片太大（超过 25MB），请先压缩', 'warn');
    try {
      const dataUrl = await readFileAsDataURL(file);
      const compressed = await compressImage(dataUrl, 900, 0.86);
      showImage(compressed);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  qs('#photo-input', wrap)?.addEventListener('change', onFile);
  qs('#photo-cam', wrap)?.addEventListener('click', () => {
    const cam = document.createElement('input');
    cam.type = 'file';
    cam.accept = 'image/*';
    cam.capture = 'environment';
    cam.addEventListener('change', () => onFile({ target: cam }));
    cam.click();
  });

  return { lastRanked: () => lastRanked, wrap };
}

/** 导出鉴别记录的缩略图 */
export async function exportIdentificationImage(rec) {
  const blob = await (await fetch(rec.image)).blob();
  downloadBlob(`青养-鉴别记录-${rec.id}.jpg`, blob);
}
