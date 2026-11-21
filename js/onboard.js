// 青养 · 新用户引导：首次打开时介绍四大模块，看过一次后不再显示
import { db } from './lib/db.js';
import { esc, qs } from './lib/dom.js';

const MODULES = [
  { icon: '🏔', name: '首页 · 鉴别与百科', desc: '拍照或按外形特征鉴别药食同源物质，查看性味归经、分龄参考量与安全提示。' },
  { icon: '🩺', name: '身体状况', desc: '选一个身体小信号，或写一句话描述感受，就能得到对症的药膳与泡茶。' },
  { icon: '💬', name: '药膳社区', desc: '记录自己做了哪道药膳、感觉如何，也看看其他病友的经验。' },
  { icon: '🗂', name: '数据管理', desc: '全部数据保存在本机浏览器里，不出门不上传；支持备份导出与恢复。' },
];

export async function maybeShowOnboard() {
  try {
    const done = await db.getMeta('onboarded', false);
    if (done) return;
  } catch {
    return; // 数据库异常时不打扰用户，直接跳过引导
  }
  const root = document.createElement('div');
  root.className = 'onboard-mask';
  root.innerHTML = `
    <div class="onboard" role="dialog" aria-modal="true">
      <h2>欢迎使用 青养 🌿</h2>
      <p class="muted">一个完全离线运行、数据只保存在本机的食疗健康小助手。它分四个模块：</p>
      <div class="onboard-grid">
        ${MODULES.map((m) => `
          <div class="onboard-item">
            <b>${m.icon} ${esc(m.name)}</b>
            <span>${esc(m.desc)}</span>
          </div>`).join('')}
      </div>
      <button class="btn btn-primary" id="onboard-close">知道了，开始使用 →</button>
      <p class="small muted">提示仅显示这一次；之后可在「数据管理 → 重新初始化」时再次看到。</p>
    </div>`;
  document.body.appendChild(root);
  const close = () => {
    root.remove();
    db.setMeta('onboarded', true).catch(() => {});
  };
  root.addEventListener('click', (e) => {
    if (e.target === root || e.target.closest('#onboard-close')) close();
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  qs('#onboard-close', root)?.focus();
}