// 青养 · 导出分享图（Canvas 绘制，纯本地，无需截图库）

const W = 1080;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text || '').split('\n')) {
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

function loadImg(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fmtTime(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * @param {object} post
 * @param {object} ctxData { authorName, avatar, recipeName, substanceNames, adultPortion, teenPortion }
 */
export async function renderPostImage(post, { authorName, avatar, recipeName, substanceNames, adultPortion, teenPortion }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 先量高度
  const pad = 64;
  const contentW = W - pad * 2;
  ctx.font = '30px "Microsoft YaHei", "PingFang SC", sans-serif';
  const textLines = wrapLines(ctx, post.text, contentW);
  const textH = textLines.length * 46;
  const images = await Promise.all((post.images || []).slice(0, 3).map(loadImg));
  const imgH = images.length ? images.map((im) => (im ? Math.min(560, (contentW / im.width) * im.height) : 0)).reduce((a, b) => a + b + 18, 0) : 0;
  const tagH = (post.tags || []).length ? 56 : 0;
  const recipeH = recipeName ? 88 : 0;
  const portionH = recipeName && (adultPortion || teenPortion) ? 72 : 0;
  const headH = 150;
  const footH = 130;
  const H = Math.round(pad * 2 + headH + imgH + tagH + textH + recipeH + portionH + footH);

  canvas.width = W;
  canvas.height = H;

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#fbf8f1');
  bg.addColorStop(1, '#eef4ec');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 顶部装饰
  ctx.fillStyle = 'rgba(143,185,139,0.16)';
  ctx.beginPath();
  ctx.arc(W - 40, 40, 180, 0, Math.PI * 2);
  ctx.fill();

  let y = pad;

  // 头部：头像 + 昵称 + 时间
  ctx.fillStyle = '#5f8f5b';
  ctx.beginPath();
  ctx.arc(pad + 46, y + 46, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(avatar || authorName || '青').slice(0, 1), pad + 46, y + 48);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#33402f';
  ctx.font = 'bold 36px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText(authorName || '匿名访客', pad + 112, y + 34);
  ctx.fillStyle = '#8a9585';
  ctx.font = '26px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText(`${fmtTime(post.createdAt)} · 青养 · 药膳社区`, pad + 112, y + 74);
  y += headH;

  // 图片
  for (const im of images) {
    if (!im) continue;
    const h = Math.min(560, (contentW / im.width) * im.height);
    ctx.save();
    roundRect(ctx, pad, y, contentW, h, 24);
    ctx.clip();
    ctx.drawImage(im, pad, y, contentW, h);
    ctx.restore();
    y += h + 18;
  }

  // 标签
  if ((post.tags || []).length) {
    let x = pad;
    ctx.font = '26px "Microsoft YaHei", "PingFang SC", sans-serif';
    for (const t of post.tags) {
      const label = `# ${t}`;
      const w = ctx.measureText(label).width + 36;
      if (x + w > W - pad) break;
      ctx.fillStyle = 'rgba(143,185,139,0.22)';
      roundRect(ctx, x, y, w, 44, 22);
      ctx.fill();
      ctx.fillStyle = '#4e7a4b';
      ctx.fillText(label, x + 18, y + 29);
      x += w + 14;
    }
    y += tagH;
  }

  // 正文
  ctx.fillStyle = '#3a4036';
  ctx.font = '30px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let ty = y + 36;
  for (const line of textLines) {
    ctx.fillText(line, pad, ty);
    ty += 46;
  }
  y += textH;

  // 关联药膳
  if (recipeName) {
    y += 20;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    roundRect(ctx, pad, y, contentW, 76, 18);
    ctx.fill();
    ctx.fillStyle = '#7a6a4a';
    ctx.font = '28px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText(`🍲 关联药膳：${recipeName}${substanceNames ? ' · ' + substanceNames : ''}`, pad + 24, y + 48);
    y += recipeH;
  }

  // 成人 / 青少年参考份量（小字两行）
  if (recipeName && (adultPortion || teenPortion)) {
    ctx.fillStyle = '#8a9585';
    ctx.font = '24px "Microsoft YaHei", "PingFang SC", sans-serif';
    let px = pad + 24;
    if (adultPortion) {
      ctx.fillText(`成人份量：${adultPortion}`, px, y + 26);
      px += ctx.measureText(`成人份量：${adultPortion}`).width + 40;
    }
    if (teenPortion) {
      ctx.fillText(`青少年份量：${teenPortion}`, px, y + 26);
    }
    y += portionH;
  }

  // 底部
  y = H - pad - 70;
  ctx.strokeStyle = 'rgba(95,143,91,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  ctx.fillStyle = '#7b8a75';
  ctx.font = '24px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText('青养 · 食疗健康生活｜仅作日常食疗参考，不替代医生诊断', pad, y + 46);

  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
}
