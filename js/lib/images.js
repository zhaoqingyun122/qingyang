// 青养 · 图片命名约定与缺图回退
// 约定：assets/herbs/<物质id>.jpg | assets/dishes/<药膳id>.jpg | assets/teas/<茶饮id>.jpg
// 图片由 scripts/fetch-images.mjs 下载、scripts/finalize-images.py 统一转码；缺图时显示文字占位块。
import { esc } from './dom.js';

const DIR = { herb: 'herbs', dish: 'dishes', tea: 'teas' };

export function imgUrl(kind, id) {
  return `assets/${DIR[kind] || kind}/${id}.jpg`;
}

/** 返回带占位回退的图片块：图片加载失败时移除 img，露出首字占位 */
export function imageHtml(kind, id, name, cls = '') {
  const ch = [...String(name || '')][0] || '青';
  return `<div class="pic-wrap ${cls}" data-txt="${esc(ch)}">
    <img src="${imgUrl(kind, id)}" alt="${esc(name || '')}" loading="lazy" onerror="this.parentElement.classList.add('noimg');this.remove()" />
  </div>`;
}