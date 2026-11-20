// 青养 · DOM / 字符串工具

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * HTML 模板：只做字符串拼接，不对插值做转义。
 * 所有动态文本必须在拼接时调用 esc()（或由调用方给出安全的 HTML 片段）。
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    out += Array.isArray(v) ? v.join('') : v == null ? '' : String(v);
    out += strings[i + 1];
  }
  return out;
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function on(root, sel, event, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(sel);
    if (target && root.contains(target)) handler(e, target);
  });
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function fmtDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDay(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function relTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return fmtDay(ts);
}

export function debounce(fn, wait = 220) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function toast(message, kind = 'info') {
  const root = qs('#toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

/** 极简弹窗：返回 Promise，confirm 型返回 true/false，form 型返回表单数据对象或 null */
export function modal({ title, body = '', okText = '确定', cancelText = '取消', mode = 'confirm', wide = false }) {
  const root = qs('#modal-root');
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-mask';
    wrap.innerHTML = `
      <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn" data-close aria-label="关闭">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">
          <button class="btn btn-ghost" data-close>${esc(cancelText)}</button>
          <button class="btn btn-primary" data-ok>${esc(okText)}</button>
        </div>
      </div>`;
    root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));

    const close = (value) => {
      wrap.classList.remove('show');
      setTimeout(() => wrap.remove(), 180);
      resolve(value);
    };
    const ok = () => {
      if (mode === 'confirm') return close(true);
      const form = wrap.querySelector('form');
      const data = {};
      if (form) {
        for (const [k, v] of new FormData(form).entries()) data[k] = typeof v === 'string' ? v.trim() : v;
      }
      close(data);
    };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) return close(mode === 'confirm' ? false : null);
      if (e.target.closest('[data-close]')) return close(mode === 'confirm' ? false : null);
      if (e.target.closest('[data-ok]')) return ok();
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(mode === 'confirm' ? false : null);
      if (e.key === 'Enter' && mode === 'confirm') {
        e.preventDefault();
        ok();
      }
    });
    const first = wrap.querySelector('input, textarea, select');
    if (first) setTimeout(() => first.focus(), 60);
  });
}

export function confirmDialog(title, text, okText = '确定') {
  return modal({ title, body: `<p class="muted">${esc(text)}</p>`, okText });
}

/** 把文件读成 dataURL */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function downloadBlob(filename, blob) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadText(filename, text, mime = 'application/json') {
  downloadBlob(filename, new Blob([text], { type: `${mime};charset=utf-8` }));
}

export async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}
