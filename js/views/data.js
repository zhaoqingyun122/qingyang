// 青养 · 数据与设置：统计、内容管理、备份导出 / 恢复、偏好、重置
import { store } from '../lib/store.js';
import { estimateStorage, getStorageMode } from '../lib/db.js';
import { buildBackup, validateBackup, summarizeBackup } from '../lib/backup.js';
import { statsSummary } from '../lib/repo.js';
import { esc, html, qs, toast, confirmDialog, downloadText, modal, fmtDay, fmtDate } from '../lib/dom.js';
import { fmtBytes } from '../lib/utils.js';

let pendingRestore = null;

export async function renderData(view) {
  const me = store.settings.activeVisitorId;
  const stats = statsSummary(me);
  const photos = store.posts.reduce((n, p) => n + (p.images || []).length, 0);
  const { usage } = await estimateStorage();
  const mode = getStorageMode();
  const lastBackup = await getLastBackupTime();
  const lastSaved = await store.lastSavedAt();

  const days = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = fmtDay(d.getTime());
    days.push({ key, n: store.posts.filter((p) => fmtDay(p.createdAt) === key).length });
  }
  const maxN = Math.max(1, ...days.map((d) => d.n));

  view.innerHTML = html`
    <h1 class="page-title">数据与设置</h1>
    <p class="muted">所有内容只保存在你这台电脑的浏览器里。这里可以看使用情况、管理内容、备份或清理数据。</p>

    <section class="stat-grid">
      <div class="stat"><span>已收录物质</span><b>${store.substances.length}</b><small>种 · ${store.recipes.length} 道药膳 · ${store.conditions.length} 种状况</small></div>
      <div class="stat"><span>我的帖子</span><b>${stats.posts}</b><small>全站共 ${store.posts.length} 帖（含其他访客）</small></div>
      <div class="stat"><span>我的收藏</span><b>${stats.favorites}</b><small>点赞过 ${stats.likesGiven} 帖</small></div>
      <div class="stat"><span>鉴别记录</span><b>${store.identifications.length}</b><small>照片 ${store.identifications.filter((r) => r.method === 'photo').length} · 特征 ${store.identifications.filter((r) => r.method === 'feature').length}</small></div>
      <div class="stat"><span>照片</span><b>${photos}</b><small>张（发帖时已压缩）</small></div>
      <div class="stat"><span>本地占用</span><b>${fmtBytes(usage)}</b><small>${mode === 'indexeddb' ? 'IndexedDB 存储' : 'localStorage 降级模式'}</small></div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>最近 14 天发帖</h2><span class="muted small">每天发布条数</span></div>
      <div class="bars">
        ${days
          .map(
            (d) => `<div class="bar-wrap" title="${d.key}：${d.n} 帖">
              <div class="bar" style="height:${Math.max(3, Math.round((d.n / maxN) * 100))}%"></div>
              <span>${d.key.slice(5)}</span>
            </div>`
          )
          .join('')}
      </div>
    </section>

    <section class="panel save-panel">
      <div class="panel-head"><h2>💾 数据保存</h2><span class="muted small">自动保存已开启</span></div>
      <p class="muted small">你的每一步操作（发帖、点赞、收藏、评论、鉴别、偏好）都会<b>即时自动保存</b>到本机浏览器（IndexedDB），刷新、关闭、重启都不丢；这里也可以随时再手动保存一次。</p>
      <div class="stack row save-row">
        <button class="btn btn-primary" id="save-now">💾 立即保存</button>
        <span class="muted small" id="saved-at">上次保存：${lastSaved ? fmtAt(lastSaved) : '—（暂无记录）'}</span>
      </div>
    </section>

    <div class="two-col">
      <section class="panel">
        <h2>内容管理</h2>
        <div class="list-rows">
          <div class="row">
            <div><b>帖子</b><span class="muted small">${store.posts.length} 条（含示例帖）</span></div>
            <button class="btn btn-sm btn-ghost" data-manage="posts">查看与删除</button>
          </div>
          <div class="row">
            <div><b>鉴别记录</b><span class="muted small">${store.identifications.length} 条</span></div>
            <button class="btn btn-sm btn-ghost" data-manage="recs">查看与删除</button>
          </div>
          <div class="row">
            <div><b>访客身份</b><span class="muted small">${store.visitors.length} 个</span></div>
            <button class="btn btn-sm btn-ghost" data-manage="visitors">管理</button>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>本地备份</h2>
        <p class="muted small">
          备份是一个 .json 文件，包含帖子、收藏、鉴别记录、访客与设置。换电脑、清理浏览器缓存或重装前，请先导出。
          ${lastBackup ? `<br />上次导出：${esc(fmtDate(lastBackup))}` : ''}
        </p>
        <div class="stack">
          <button class="btn btn-primary" id="backup-btn">⤓ 导出完整备份</button>
          <label class="btn btn-ghost">⤒ 从备份文件恢复<input type="file" id="restore-file" accept=".json,application/json" hidden /></label>
          <button class="btn btn-ghost" id="export-md">导出全部帖子为 Markdown</button>
        </div>
        <div id="restore-preview"></div>
      </section>
    </div>

    <section class="panel">
      <h2>偏好设置</h2>
      <div class="settings">
        <label class="field inline">
          <span>当前访客身份</span>
          <select class="select" id="set-visitor">
            ${store.visitors.map((v) => `<option value="${v.id}" ${v.id === me ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field inline">
          <span>物质卡片密度</span>
          <select class="select" id="set-density">
            <option value="comfortable" ${store.settings.cardDensity === 'comfortable' ? 'selected' : ''}>标准</option>
            <option value="compact" ${store.settings.cardDensity === 'compact' ? 'selected' : ''}>紧凑</option>
          </select>
        </label>
        <label class="field inline">
          <span>文字大小</span>
          <select class="select" id="set-text-size">
            <option value="std" ${store.settings.textSize === 'std' ? 'selected' : ''}>标准</option>
            <option value="lg" ${store.settings.textSize === 'lg' ? 'selected' : ''}>大</option>
            <option value="xl" ${store.settings.textSize === 'xl' ? 'selected' : ''}>特大</option>
          </select>
        </label>
        <label class="field inline">
          <span>详情页突出显示青少年剂量</span>
          <input type="checkbox" id="set-teen" ${store.settings.showTeenDose ? 'checked' : ''} />
        </label>
        <label class="field inline">
          <span>始终显示安全提示</span>
          <input type="checkbox" id="set-safe" ${store.settings.safeNotice ? 'checked' : ''} />
        </label>
        <label class="field inline">
          <span>深色模式（夜间护眼）</span>
          <input type="checkbox" id="set-dark" ${store.settings.darkMode ? 'checked' : ''} />
        </label>
      </div>
    </section>

    <section class="panel danger-zone">
      <h2>清空与重置</h2>
      <p class="muted small">重置会清空帖子、收藏、鉴别记录和设置，恢复成初始示例数据，且不可撤销。建议先导出备份。</p>
      <button class="btn btn-danger" id="reset-btn">清空并重置为初始数据</button>
    </section>`;

  bind(view, { stats });
}

async function getLastBackupTime() {
  try {
    return await (await import('../lib/db.js')).db.getMeta('lastBackupAt', null);
  } catch {
    return null;
  }
}

function fmtAt(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function bind(view) {
  qs('#save-now', view).addEventListener('click', async () => {
    const at = await store.saveNow();
    const el = qs('#saved-at', view);
    if (el) el.textContent = `上次保存：${fmtAt(at)}`;
    toast('已保存到本机浏览器', 'ok');
  });

  qs('#backup-btn', view).addEventListener('click', async () => {
    const data = await buildBackup(store);
    downloadText(`青养备份-${fmtDay(Date.now())}.json`, JSON.stringify(data, null, 2));
    const { db } = await import('../lib/db.js');
    await db.setMeta('lastBackupAt', Date.now());
    toast('备份已导出到下载文件夹', 'ok');
    renderData(view);
  });

  qs('#restore-file', view).addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      const b = validateBackup(raw);
      pendingRestore = b;
      qs('#restore-preview', view).innerHTML = html`
        <div class="notice">
          <b>已读取备份，请确认</b>
          <p class="small">${esc(summarizeBackup(b)).replace(/\n/g, '<br />')}</p>
          <p class="small muted">恢复会用备份内容<b>覆盖</b>当前全部帖子、收藏与鉴别记录。要不要先导出一次当前数据？</p>
          <div class="row-actions">
            <button class="btn btn-sm btn-ghost" id="restore-cancel">取消</button>
            <button class="btn btn-sm btn-primary" id="restore-confirm">确认覆盖恢复</button>
          </div>
        </div>`;
      qs('#restore-cancel', view).addEventListener('click', () => {
        pendingRestore = null;
        qs('#restore-preview', view).innerHTML = '';
      });
      qs('#restore-confirm', view).addEventListener('click', async () => {
        if (!pendingRestore) return;
        await store.importBackup({
          app: 'qingyang',
          visitors: pendingRestore.visitors,
          settings: pendingRestore.settings,
          posts: pendingRestore.posts,
          identifications: pendingRestore.identifications,
          favorites: pendingRestore.favorites,
        });
        pendingRestore = null;
        toast('已从备份恢复', 'ok');
        renderData(view);
      });
    } catch (err) {
      toast('恢复失败：' + err.message, 'error');
    }
  });

  qs('#export-md', view).addEventListener('click', () => {
    const md = store.posts
      .map((p) => {
        const a = store.visitor(p.authorId)?.name || '访客';
        const r = store.recipe(p.recipeId);
        return [
          `## ${new Date(p.createdAt).toLocaleString('zh-CN')} · ${a}`,
          '',
          p.text || '',
          '',
          r ? `> 关联药膳：${r.name}（成人 ${r.adultPortion} / 青少年 ${r.teenPortion}）` : '',
          (p.tags || []).length ? `标签：${p.tags.map((t) => '#' + t).join(' ')}` : '',
          '',
        ]
          .filter((x) => x !== '')
          .join('\n');
      })
      .join('\n---\n\n');
    downloadText(`青养帖子-${fmtDay(Date.now())}.md`, `# 青养 · 药膳社区帖子导出\n\n${md}`, 'text/markdown');
  });

  qs('[data-manage="posts"]', view).addEventListener('click', () => openPostsManager(view));
  qs('[data-manage="recs"]', view).addEventListener('click', () => openRecsManager(view));
  qs('[data-manage="visitors"]', view).addEventListener('click', () => openVisitorsManager(view));

  qs('#set-visitor', view).addEventListener('change', async (e) => {
    await store.updateSettings({ activeVisitorId: e.target.value });
    toast('已切换身份', 'ok');
    renderData(view);
  });
  qs('#set-density', view).addEventListener('change', async (e) => {
    await store.updateSettings({ cardDensity: e.target.value });
    toast('已保存偏好');
  });
  qs('#set-text-size', view).addEventListener('change', async (e) => {
    await store.updateSettings({ textSize: e.target.value });
    toast('已保存偏好');
  });
  qs('#set-teen', view).addEventListener('change', async (e) => {
    await store.updateSettings({ showTeenDose: e.target.checked });
    toast('已保存偏好');
  });
  qs('#set-safe', view).addEventListener('change', async (e) => {
    await store.updateSettings({ safeNotice: e.target.checked });
    toast('已保存偏好');
  });
  qs('#set-dark', view).addEventListener('change', async (e) => {
    // body.dark 由 main.js 监听 settings 事件统一切换，这里只需持久化
    await store.updateSettings({ darkMode: e.target.checked });
    toast(e.target.checked ? '已开启深色模式' : '已开启浅色模式', 'ok');
  });

  qs('#reset-btn', view).addEventListener('click', async () => {
    if (!(await confirmDialog('清空并重置', '这会删除全部帖子、收藏、鉴别记录和设置，并恢复初始示例数据。确定吗？', '确认重置'))) return;
    await store.resetAll(window.qy.seed());
    toast('已重置', 'ok');
    renderData(view);
  });
}

/* ---------- 管理器 ---------- */
function closeTopModal() {
  const masks = qs('#modal-root').querySelectorAll('.modal-mask');
  const last = masks[masks.length - 1];
  if (!last) return;
  last.classList.remove('show');
  setTimeout(() => last.remove(), 180);
}

function bindModalDeletes(selector, handler) {
  qs('#modal-root')
    .querySelectorAll(selector)
    .forEach((b) => b.addEventListener('click', () => handler(b)));
}

function openPostsManager(view) {
  const body = `<div class="manage-list">${
    store.posts.length
      ? store.posts
          .map(
            (p) => `<div class="manage-row">
              <div><b>${esc((p.text || '（仅图片）').slice(0, 42))}</b>
              <span class="muted small">${fmtDate(p.createdAt)} · ${esc(store.visitor(p.authorId)?.name || '访客')}</span></div>
              <button class="btn btn-sm btn-danger" data-del="${p.id}">删除</button>
            </div>`
          )
          .join('')
      : '<p class="muted small">还没有帖子</p>'
  }</div>`;
  modal({ title: '帖子管理', body, okText: '关闭', cancelText: '返回' });
  bindModalDeletes('[data-del]', async (b) => {
    if (!(await confirmDialog('删除帖子', '删除后无法恢复，确定删除这条？', '删除'))) return;
    await store.removePost(b.dataset.del);
    closeTopModal();
    closeTopModal();
    toast('已删除');
    renderData(view);
  });
}

function openRecsManager(view) {
  const body = `<div class="manage-list">${
    store.identifications.length
      ? store.identifications
          .map(
            (r) => `<div class="manage-row">
              <div class="rec-line">
                ${r.image ? `<img class="thumb" src="${r.image}" alt="" />` : '<span class="thumb noimg">特征</span>'}
                <div>
                  <b>${esc(store.substance(r.chosenId)?.name || '未确定')}</b>
                  <span class="muted small">${r.method === 'photo' ? '照片比对' : '特征选择'} · ${fmtDate(r.createdAt)}</span>
                </div>
              </div>
              <button class="btn btn-sm btn-danger" data-del="${r.id}">删除</button>
            </div>`
          )
          .join('')
      : '<p class="muted small">还没有鉴别记录</p>'
  }</div>`;
  modal({ title: '鉴别记录', body, okText: '关闭', cancelText: '返回' });
  bindModalDeletes('[data-del]', async (b) => {
    await store.removeIdentification(b.dataset.del);
    closeTopModal();
    closeTopModal();
    renderData(view);
  });
}

function openVisitorsManager(view) {
  const body = `<div class="manage-list">${store.visitors
    .map(
      (v) => `<div class="manage-row">
        <div><b>${esc(v.name)}</b><span class="muted small">${store.posts.filter((p) => p.authorId === v.id).length} 帖${v.isDefault ? ' · 内置访客' : ''}</span></div>
        ${v.isDefault ? '' : `<button class="btn btn-sm btn-danger" data-delvis="${v.id}">删除</button>`}
      </div>`
    )
    .join('')}</div>
    <p class="muted small">内置访客用于展示分享内容，不能删除。新增访客请到「药膳社区」右侧的「新增访客身份」。</p>`;
  modal({ title: '访客身份', body, okText: '关闭', cancelText: '返回' });
  bindModalDeletes('[data-delvis]', async (b) => {
    await store.removeVisitor(b.dataset.delvis);
    closeTopModal();
    closeTopModal();
    renderData(view);
  });
}
