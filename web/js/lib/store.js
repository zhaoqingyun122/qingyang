// 青养 · 应用状态（唯一数据源）+ 持久化编排
import { db } from './db.js';

const DEFAULT_SETTINGS = {
  activeVisitorId: 'me',
  cardDensity: 'comfortable', // comfortable | compact
  showTeenDose: true, // 物质详情默认展开青少年剂量
  homeSort: 'category', // category | pinyin
  safeNotice: true, // 详情页显示安全提示
  darkMode: false, // 深色模式（夜间护眼）
  textSize: 'std', // std | lg | xl 文字大小
};

class Store extends EventTarget {
  constructor() {
    super();
    this.substances = [];
    this.conditions = [];
    this.recipes = [];
    this.posts = [];
    this.visitors = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.identifications = [];
    this.ready = false;
    this.mode = 'indexeddb';
  }

  emit(type = 'change', detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  async load(seed) {
    this.substances = seed.SUBSTANCES;
    this.conditions = seed.CONDITIONS;
    this.recipes = seed.RECIPES;

    this.visitors = await db.getMeta('visitors', null);
    if (!Array.isArray(this.visitors) || !this.visitors.length) {
      this.visitors = seed.DEFAULT_VISITORS.slice();
      await db.setMeta('visitors', this.visitors);
    }
    const settings = await db.getMeta('settings', null);
    this.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };

    this.posts = (await db.all('posts')).sort((a, b) => b.createdAt - a.createdAt);
    this.identifications = (await db.all('identifications')).sort((a, b) => b.createdAt - a.createdAt);

    // 只在首次使用时写入示例帖子；用户把帖子全删光后不会再被塞回来
    const seeded = await db.getMeta('seeded', false);
    if (!seeded) {
      if (!this.posts.length) {
        this.posts = seed.seedPosts();
        for (const p of this.posts) await db.put('posts', p);
      }
      await db.setMeta('seeded', true);
    }
    this.ready = true;
    this.emit('loaded');
  }

  /* ---------- 查询 ---------- */
  substance(id) {
    return this.substances.find((s) => s.id === id);
  }
  condition(id) {
    return this.conditions.find((c) => c.id === id);
  }
  recipe(id) {
    return this.recipes.find((r) => r.id === id);
  }
  recipesOfSubstance(id) {
    return this.recipes.filter((r) => (r.substanceIds || []).includes(id));
  }
  conditionsOfSubstance(id) {
    const ids = new Set();
    for (const r of this.recipesOfSubstance(id)) (r.conditionIds || []).forEach((c) => ids.add(c));
    return [...ids].map((c) => this.condition(c)).filter(Boolean);
  }
  recipesOfCondition(id) {
    return this.recipes.filter((r) => (r.conditionIds || []).includes(id));
  }
  activeVisitor() {
    return this.visitors.find((v) => v.id === this.settings.activeVisitorId) || this.visitors[0];
  }
  visitor(id) {
    return this.visitors.find((v) => v.id === id);
  }

  /* ---------- 设置 ---------- */
  async updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    await db.setMeta('settings', this.settings);
    this.emit('settings');
  }

  /* ---------- 访客 ---------- */
  async addVisitor(name, avatar) {
    const v = {
      id: 'v_' + Date.now().toString(36),
      name,
      avatar,
      isDefault: false,
      createdAt: Date.now(),
    };
    this.visitors = [...this.visitors, v];
    await db.setMeta('visitors', this.visitors);
    this.emit('visitors');
    return v;
  }
  async removeVisitor(id) {
    this.visitors = this.visitors.filter((v) => v.id !== id);
    if (this.settings.activeVisitorId === id) {
      await this.updateSettings({ activeVisitorId: this.visitors[0]?.id || 'me' });
    }
    await db.setMeta('visitors', this.visitors);
    this.emit('visitors');
  }

  /* ---------- 帖子 ---------- */
  async addPost(post) {
    this.posts = [post, ...this.posts].sort((a, b) => b.createdAt - a.createdAt);
    await db.put('posts', post);
    this.emit('posts');
  }
  async updatePost(id, patch) {
    const p = this.posts.find((x) => x.id === id);
    if (!p) return;
    Object.assign(p, patch);
    await db.put('posts', p);
    this.emit('posts');
  }
  async removePost(id) {
    this.posts = this.posts.filter((p) => p.id !== id);
    await db.remove('posts', id);
    this.emit('posts');
  }
  async toggleLike(id) {
    const uidNow = this.settings.activeVisitorId;
    const p = this.posts.find((x) => x.id === id);
    if (!p) return;
    p.likes = p.likes || [];
    p.likes = p.likes.includes(uidNow) ? p.likes.filter((u) => u !== uidNow) : [...p.likes, uidNow];
    await db.put('posts', p);
    this.emit('posts');
    return p.likes.includes(uidNow);
  }
  async toggleFavorite(id) {
    const p = this.posts.find((x) => x.id === id);
    if (!p) return;
    p.favorites = p.favorites || [];
    const on = !p.favorites.includes(this.settings.activeVisitorId);
    p.favorites = on ? [...p.favorites, this.settings.activeVisitorId] : p.favorites.filter((u) => u !== this.settings.activeVisitorId);
    await db.put('posts', p);
    this.emit('posts');
    return on;
  }

  /* ---------- 识别记录 ---------- */
  async addIdentification(rec) {
    this.identifications = [rec, ...this.identifications].sort((a, b) => b.createdAt - a.createdAt);
    await db.put('identifications', rec);
    this.emit('identifications');
  }
  async removeIdentification(id) {
    this.identifications = this.identifications.filter((r) => r.id !== id);
    await db.remove('identifications', id);
    this.emit('identifications');
  }

  /* ---------- 备份 / 恢复 / 重置 ---------- */
  async exportBackup() {
    return {
      app: 'qingyang',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.settings,
      visitors: this.visitors,
      posts: this.posts,
      identifications: this.identifications,
    };
  }

  /* ---------- 手动保存 ----------
   * 数据平时已自动落盘；此方法在“立即保存”按钮被点击时调用，
   * 显式把当前状态整体写回一遍并记录保存时间，给用户明确反馈。 */
  async saveNow() {
    await db.setMeta('visitors', this.visitors);
    await db.setMeta('settings', this.settings);
    for (const p of this.posts) await db.put('posts', p);
    for (const r of this.identifications) await db.put('identifications', r);
    const at = Date.now();
    await db.setMeta('lastSavedAt', at);
    this.emit('saved');
    return at;
  }
  async lastSavedAt() {
    return (await db.getMeta('lastSavedAt', 0)) || 0;
  }

  async importBackup(data) {
    if (!data || data.app !== 'qingyang') throw new Error('不是青养导出的备份文件');    if (Array.isArray(data.visitors) && data.visitors.length) {
      this.visitors = data.visitors;
      await db.setMeta('visitors', this.visitors);
    }
    if (data.settings) await this.updateSettings(data.settings);
    if (Array.isArray(data.posts)) {
      for (const p of this.posts) await db.remove('posts', p.id);
      this.posts = data.posts.slice().sort((a, b) => b.createdAt - a.createdAt);
      for (const p of this.posts) await db.put('posts', p);
    }
    if (Array.isArray(data.identifications)) {
      for (const r of this.identifications) await db.remove('identifications', r.id);
      this.identifications = data.identifications.slice().sort((a, b) => b.createdAt - a.createdAt);
      for (const r of this.identifications) await db.put('identifications', r);
    }
    this.emit('change');
  }

  async resetAll(seed) {
    for (const p of this.posts) await db.remove('posts', p.id);
    for (const r of this.identifications) await db.remove('identifications', r.id);
    this.visitors = seed.DEFAULT_VISITORS.slice();
    this.settings = { ...DEFAULT_SETTINGS };
    this.posts = seed.seedPosts();
    this.identifications = [];
    await db.setMeta('visitors', this.visitors);
    await db.setMeta('settings', this.settings);
    await db.setMeta('seeded', true);
    for (const p of this.posts) await db.put('posts', p);
    this.emit('change');
  }
}

export const store = new Store();
