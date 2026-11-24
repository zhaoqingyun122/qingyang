// 青养 · 天气：浏览器定位 + 实时天气（wttr.in）+ 天气→药膳推荐
// 说明：页面以 http://127.0.0.1 打开时走 HTTP 接口；若以 HTTPS 托管（如 GitHub Pages）则改走 HTTPS。
// 网络不可达 / 未授权定位时返回失败原因，由界面降级为「按时令推荐」，不阻塞页面。
import { WEATHER_RULES } from '../data/almanac.js';

const POS_KEY = 'qy_pos';
const CACHE_KEY = 'qy_weather';

export function savedPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Date.now() - p.at < 1000 * 60 * 60 * 24 * 30) return p;
  } catch {
    /* ignore */
  }
  return null;
}

function savePos(pos) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

export function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    const w = raw ? JSON.parse(raw) : null;
    if (w && w.ok && Date.now() - w.at < 1000 * 60 * 30) return w;
  } catch {
    /* ignore */
  }
  return null;
}

/** 请求定位；用户拒绝或超时返回 {ok:false, reason} */
export function locate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ ok: false, reason: 'unsupported' });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0), at: Date.now() };
        savePos(pos);
        return resolve({ ok: true, ...pos });
      },
      (e) => resolve({ ok: false, reason: e && e.code === 1 ? 'denied' : 'error' }),
      { timeout: 9000, maximumAge: 1000 * 60 * 10 }
    );
  });
}

/** 拉取实时天气；成功返回 {ok:true, temp, humidity, text, city, at} */
export async function fetchWeather(lat, lon) {
  const proto = location.protocol === 'https:' ? 'https' : 'http';
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 9000) : null;
  try {
    const url = `${proto}://wttr.in/${lat.toFixed(3)},${lon.toFixed(3)}?format=j1&lang=zh`;
    const res = await fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
    if (!res.ok) throw new Error('status-' + res.status);
    const j = await res.json();
    const cur = (j.current_condition || [])[0] || {};
    const area = (j.nearest_area || [])[0] || {};
    const w = {
      ok: true,
      temp: Number(cur.temp_C),
      feels: Number(cur.FeelsLikeC),
      humidity: Number(cur.humidity),
      text: (cur.lang_zh || [])[0]?.value || (cur.weatherDesc || [])[0]?.value || '',
      city: (area.areaName || [])[0]?.value || '',
      at: Date.now(),
    };
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(w));
    } catch {
      /* ignore */
    }
    return w;
  } catch (e) {
    return { ok: false, reason: e && e.name === 'AbortError' ? 'timeout' : 'error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 按天气挑选推荐规则（第一条命中的生效） */
export function adviceFor(w) {
  const safe = { temp: Number.isFinite(w?.temp) ? w.temp : 20, humidity: Number.isFinite(w?.humidity) ? w.humidity : 60, text: String(w?.text || '') };
  return WEATHER_RULES.find((r) => {
    try {
      return r.match(safe);
    } catch {
      return false;
    }
  });
}