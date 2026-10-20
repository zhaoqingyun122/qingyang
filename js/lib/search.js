// 青养 · 站内检索（物质 / 药膳 / 状况 / 帖子）
import { store } from './store.js';

const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, '');

export function searchAll(qRaw) {
  const q = norm(qRaw);
  if (!q) return [];
  const out = [];

  for (const s of store.substances) {
    const hay = norm([s.name, ...(s.alias || []), ...(s.keywords || []), s.category, s.nature, s.effects, ...(s.features?.color || []), ...(s.features?.shape || [])].join(' '));
    let score = 0;
    if (norm(s.name) === q) score = 100;
    else if ((s.alias || []).some((a) => norm(a) === q)) score = 92;
    else if (norm(s.name).includes(q)) score = 80;
    else if ((s.alias || []).some((a) => norm(a).includes(q))) score = 70;
    else if (hay.includes(q)) score = 50;
    if (score) out.push({ type: 'substance', id: s.id, title: s.name, sub: `${s.category} · ${s.nature}`, score });
  }

  for (const r of store.recipes) {
    const hay = norm([r.name, r.fit, ...(r.ingredients || []), ...(r.substanceIds || []).map((i) => store.substance(i)?.name || '')].join(' '));
    let score = 0;
    if (norm(r.name).includes(q)) score = 75;
    else if (hay.includes(q)) score = 46;
    if (score) out.push({ type: 'recipe', id: r.id, title: r.name, sub: '药膳', score });
  }

  for (const c of store.conditions) {
    const hay = norm([c.name, c.summary, ...(c.keywords || []), ...(c.tips || [])].join(' '));
    let score = 0;
    if (norm(c.name).includes(q)) score = 60;
    else if (hay.includes(q)) score = 44;
    if (score) out.push({ type: 'condition', id: c.id, title: c.name, sub: '身体状况', score });
  }

  for (const p of store.posts) {
    const hay = norm([p.text, ...(p.tags || [])].join(' '));
    if (hay.includes(q)) out.push({ type: 'post', id: p.id, title: (p.text || '').slice(0, 24) || '帖子', sub: '社区', score: 30 });
  }

  return out.sort((a, b) => b.score - a.score);
}

export function routeFor(item) {
  switch (item.type) {
    case 'substance':
      return `/substance/${item.id}`;
    case 'recipe':
      return `/recipe/${item.id}`;
    case 'condition':
      return `/conditions?c=${item.id}`;
    case 'post':
      return `/community?post=${item.id}`;
    default:
      return '/';
  }
}

export function typeLabel(type) {
  return { substance: '物质', recipe: '药膳', condition: '状况', post: '社区' }[type] || '';
}
