// 青养 · 共享工具（数值格式化等）
export function fmtBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function fmtCN(ts) {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { hour12: false });
}
