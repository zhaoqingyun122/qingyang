// 青养 · 用法说明（人类可读）与可携带备份的备份/恢复逻辑
import { db } from './db.js';

export const BACKUP_FORMAT = 'qingyang-backup';
export const BACKUP_VERSION = 1;

/**
 * 导出完整备份对象：
 * - 内容类数据（帖子、鉴别记录、访客、设置）放在 data 里
 * - 物质、药膳、状况等内置资料不重复存放（版本升级时由程序内置），但记录当前版本号
 */
export async function buildBackup(store) {
  const payload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: '青养 · 食疗健康生活',
    data: {
      settings: store.settings,
      visitors: store.visitors,
      posts: store.posts,
      identifications: store.identifications.map((r) => ({ ...r })),
      checkins: store.checkins,
      favorites: [...store.favorites],
    },
  };
  return payload;
}

export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('文件内容不是有效的 JSON 对象');
  if (obj.format !== BACKUP_FORMAT) throw new Error('这不是青养的备份文件（缺少 format 标识）');
  if (!obj.data || typeof obj.data !== 'object') throw new Error('备份文件缺少 data 部分');
  const d = obj.data;
  if (d.posts && !Array.isArray(d.posts)) throw new Error('posts 字段格式错误');
  if (d.identifications && !Array.isArray(d.identifications)) throw new Error('identifications 字段格式错误');
  if (d.visitors && !Array.isArray(d.visitors)) throw new Error('visitors 字段格式错误');
  if (d.checkins && !Array.isArray(d.checkins)) throw new Error('checkins 字段格式错误');
  return {
    posts: d.posts || [],
    identifications: d.identifications || [],
    visitors: d.visitors || [],
    settings: d.settings && typeof d.settings === 'object' ? d.settings : null,
    checkins: Array.isArray(d.checkins) ? d.checkins : [],
    favorites: Array.isArray(d.favorites) ? d.favorites : [],
    exportedAt: obj.exportedAt,
  };
}

/** 备份摘要（用于恢复前向用户说明） */
export function summarizeBackup(b) {
  return `导出时间：${b.exportedAt ? new Date(b.exportedAt).toLocaleString('zh-CN') : '未知'}
帖子 ${b.posts.length} 条、鉴别记录 ${b.identifications.length} 条、访客身份 ${b.visitors.length} 个、打卡 ${b.checkins.length} 条、收藏 ${b.favorites.length} 项`;
}

export async function fileCounts() {
  const [posts, recs] = await Promise.all([db.all('posts'), db.all('identifications')]);
  return { posts: posts.length, recs: recs.length };
}
