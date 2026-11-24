// 青养 · 节气计算（离线，不依赖网络）
// 采用 21 世纪通用近似公式计算节气日期，误差约 ±1 天；仅用于时令推荐，不作历法依据。
import { SOLAR_TERMS } from '../data/almanac.js';

function termDate(year, def) {
  const y = year % 100;
  const day = Math.floor(y * 0.2422 + def.c) - Math.floor(y / 4);
  return new Date(year, def.month - 1, Math.max(1, Math.min(28, day)));
}

/** 返回当前所处节气及距下一个节气的信息 */
export function currentTerm(date = new Date()) {
  const year = date.getFullYear();
  const list = [];
  for (const y of [year - 1, year, year + 1]) {
    for (const def of SOLAR_TERMS) list.push({ def, at: termDate(y, def) });
  }
  list.sort((a, b) => a.at - b.at);
  let idx = 0;
  for (let k = 0; k < list.length; k++) if (list[k].at <= date) idx = k;
  const cur = list[idx];
  const nxt = list[idx + 1] || list[list.length - 1];
  const dayIndex = Math.floor((date - cur.at) / 86400000) + 1;
  const nextIn = Math.max(1, Math.round((nxt.at - date) / 86400000));
  return { term: cur.def, at: cur.at, dayIndex, next: nxt.def, nextAt: nxt.at, nextIn };
}

const fmt = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;

/** 格式化：例如「立冬 · 第 3 天（11月7日 起，21 天后 小雪）」 */
export function termLabel(info = currentTerm()) {
  return `${info.term.name} · 第 ${info.dayIndex} 天（${fmt(info.at)} 起，${info.nextIn} 天后 ${info.next.name}）`;
}