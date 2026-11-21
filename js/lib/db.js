// 青养 · 本地数据库（IndexedDB，带 localStorage 降级）
// 所有数据都在本机浏览器内，不联网。

const DB_NAME = 'qingyang';
const DB_VERSION = 2;
const STORES = ['meta', 'posts', 'identifications', 'checkins'];

let dbPromise = null;
let usingFallback = false;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('当前浏览器不支持 IndexedDB'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('posts')) {
        const s = db.createObjectStore('posts', { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('identifications')) {
        const s = db.createObjectStore('identifications', { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('checkins')) {
        const s = db.createObjectStore('checkins', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('无法打开本地数据库'));
    req.onblocked = () => reject(new Error('数据库被其他标签页占用，请关闭其他青养标签页后刷新'));
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORES, mode === 'readwrite' ? 'readwrite' : 'readonly');
        let result;
        const store = (name) => t.objectStore(name);
        Promise.resolve(fn(store)).then((r) => (result = r));
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error('事务被中止'));
      })
  );
}

function reqP(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* eslint-disable no-unused-vars */
// localStorage 降级（少数浏览器禁用 IndexedDB 时使用）
const LS_KEY = 'qingyang_fallback_v1';
function lsRead() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{"meta":{},"posts":[],"identifications":[]}');
  } catch {
    return { meta: {}, posts: [], identifications: [] };
  }
}
function lsWrite(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function fallbackWrap(name) {
  return {
    getMeta: async () => lsRead().meta[name] ?? null,
    setMeta: async (value) => {
      const d = lsRead();
      d.meta[name] = value;
      lsWrite(d);
    },
    all: async (store) => lsRead()[store] || [],
    put: async (store, value) => {
      const d = lsRead();
      const arr = d[store] || [];
      const i = arr.findIndex((x) => x.id === value.id);
      if (i >= 0) arr[i] = value;
      else arr.push(value);
      d[store] = arr;
      lsWrite(d);
    },
    remove: async (store, id) => {
      const d = lsRead();
      d[store] = (d[store] || []).filter((x) => x.id !== id);
      lsWrite(d);
    },
  };
}

export async function initDB() {
  try {
    await openDB();
    // 探测一次读写，确认可用
    await tx('readwrite', (s) => reqP(s('meta').put(1, '__alive__')));
    usingFallback = false;
    return { ok: true, mode: 'indexeddb' };
  } catch (err) {
    try {
      lsRead();
      localStorage.setItem(LS_KEY + '_probe', '1');
      localStorage.removeItem(LS_KEY + '_probe');
      usingFallback = true;
      return { ok: true, mode: 'localstorage', error: err.message };
    } catch {
      return { ok: false, mode: 'none', error: err.message };
    }
  }
}

export function getStorageMode() {
  return usingFallback ? 'localstorage' : 'indexeddb';
}

const fb = fallbackWrap();

export const db = {
  async getMeta(key, def = null) {
    if (usingFallback) return fb.getMeta(key) ?? def;
    const v = await tx('readonly', (s) => reqP(s('meta').get(key)));
    return v === undefined ? def : v;
  },
  async setMeta(key, value) {
    if (usingFallback) return fb.setMeta(key, value);
    return tx('readwrite', (s) => reqP(s('meta').put(value, key)));
  },
  async all(store) {
    if (usingFallback) return fb.all(store);
    return tx('readonly', (s) => reqP(s(store).getAll()));
  },
  async put(store, value) {
    if (usingFallback) return fb.put(store, value);
    return tx('readwrite', (s) => reqP(s(store).put(value)));
  },
  async remove(store, id) {
    if (usingFallback) return fb.remove(store, id);
    return tx('readwrite', (s) => reqP(s(store).delete(id)));
  },
  async clear(store) {
    if (usingFallback) {
      const d = lsRead();
      d[store] = [];
      lsWrite(d);
      return;
    }
    return tx('readwrite', (s) => reqP(s(store).clear()));
  },
};

/** 估算占用空间（浏览器支持时） */
export async function estimateStorage() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch {
    /* ignore */
  }
  return { usage: 0, quota: 0 };
}
