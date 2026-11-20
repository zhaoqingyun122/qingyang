// 青养 · 数据仓库访问层（对内置内容与用户数据做统一查询）
import { store } from './store.js';

/** 关键字检索：物质名 / 别名 / 关键词 / 药膳 / 状况 */
export function findSubstances(q) {
  const n = String(q || '').trim().toLowerCase();
  if (!n) return store.substances.slice();
  return store.substances.filter((s) =>
    [s.name, ...(s.alias || []), ...(s.keywords || []), s.category, s.effects]
      .join(' ')
      .toLowerCase()
      .includes(n)
  );
}

/** 根据状况返回「物质 + 剂量 + 药膳」的完整推荐结构 */
export function recommendForCondition(conditionId) {
  const recipes = store.recipesOfCondition(conditionId);
  const subIds = [];
  for (const r of recipes) for (const id of r.substanceIds || []) if (!subIds.includes(id)) subIds.push(id);
  return {
    condition: store.condition(conditionId),
    substances: subIds.map((id) => store.substance(id)).filter(Boolean),
    recipes,
  };
}

export function statsSummary(visitorId) {
  const mine = store.posts.filter((p) => p.authorId === visitorId);
  return {
    posts: mine.length,
    favorites: store.posts.filter((p) => (p.favorites || []).includes(visitorId)).length,
    likesGiven: store.posts.filter((p) => (p.likes || []).includes(visitorId)).length,
    identifications: store.identifications.length,
  };
}
