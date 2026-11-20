// 青养 · 拍照辅助鉴别
// 无联网、无预置图库：从照片中提取全局颜色特征，与物质「断面/外观颜色」描述做匹配，给出候选清单。
// 结果只作辅助参考，最终以「外形特征逐项选择」和实物核对为准。
import { loadImage } from './dom.js';

const COLOR_ANCHORS = {
  白: [242, 240, 233],
  米白: [232, 222, 200],
  淡黄: [238, 220, 168],
  黄: [226, 188, 96],
  金黄: [222, 172, 62],
  橘黄: [228, 150, 66],
  橙: [232, 138, 52],
  红: [196, 74, 62],
  紫红: [142, 58, 86],
  深红: [128, 48, 44],
  紫: [122, 88, 146],
  褐: [132, 92, 58],
  棕: [112, 78, 48],
  深棕: [86, 58, 38],
  黑: [52, 46, 42],
  青: [102, 150, 116],
  绿: [96, 138, 82],
  灰白: [206, 202, 194],
  灰褐: [150, 132, 112],
};

const BROWN_GREY_THRESHOLD = 6; // 彩度过低时视为灰白/灰褐

function textToHues(text = '') {
  const found = [];
  for (const key of Object.keys(COLOR_ANCHORS)) {
    if (text.includes(key)) found.push(key);
  }
  // 避免「米白」里同时匹配「白」造成重复，长词优先
  found.sort((a, b) => b.length - a.length);
  const pruned = [];
  for (const k of found) {
    if (!pruned.some((p) => p.includes(k))) pruned.push(k);
  }
  return pruned;
}

function closestColorName([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  let best = '米白';
  let bestDist = Infinity;
  for (const [name, c] of Object.entries(COLOR_ANCHORS)) {
    let d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
    if (sat < BROWN_GREY_THRESHOLD && name !== '灰白' && name !== '白' && name !== '米白' && name !== '灰褐') d *= 1.6;
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

/** 提取 6 种主色（跳过背景/极亮极暗区域） */
async function extractPalette(src) {
  const img = await loadImage(src);
  const W = 64;
  const H = Math.max(1, Math.round((img.height / img.width) * W));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  const buckets = new Map();
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const bright = (r + g + b) / 3;
    if (bright > 246 || bright < 22) continue; // 过曝与阴影不参与
    const rq = Math.round(r / 24) * 24;
    const gq = Math.round(g / 24) * 24;
    const bq = Math.round(b / 24) * 24;
    const key = `${rq},${gq},${bq}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
    rSum += r;
    gSum += g;
    bSum += b;
    n++;
  }
  const total = Math.max(1, n);
  const avg = [Math.round(rSum / total), Math.round(gSum / total), Math.round(bSum / total)];
  const top = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, count]) => ({
      rgb: k.split(',').map(Number),
      share: count / total,
      name: closestColorName(k.split(',').map(Number)),
    }));
  return { avg, top, brightness: total / (W * H) };
}

/**
 * 返回候选物质列表
 * @param {string} dataUrl 图片 dataURL
 * @param {Array} substances 物质全集
 * @param {(s: any) => string} colorTextOf 提取某种物质的颜色描述文本
 */
export async function recognizePhoto(dataUrl, substances, colorTextOf) {
  const palette = await extractPalette(dataUrl);
  const avgName = closestColorName(palette.avg);
  const observed = new Set([avgName, ...palette.top.filter((p) => p.share > 0.06).map((p) => p.name)]);

  const scored = substances.map((s) => {
    const describe = colorTextOf(s) || '';
    const hues = textToHues(describe);
    let hit = 0;
    for (const h of hues) {
      if (observed.has(h)) hit += 1;
      else {
        // 近色宽容：白-米白-淡黄、褐-棕-深棕 视为相近
        const near = {
          白: ['米白', '灰白'],
          米白: ['白', '淡黄', '灰白'],
          淡黄: ['米白', '黄'],
          黄: ['淡黄', '金黄', '橘黄'],
          金黄: ['黄', '橘黄'],
          橘黄: ['黄', '橙', '金黄'],
          橙: ['橘黄', '红'],
          红: ['橙', '紫红', '深红'],
          紫红: ['红', '紫', '深红'],
          深红: ['红', '紫红'],
          紫: ['紫红', '红'],
          褐: ['棕', '深棕', '灰褐'],
          棕: ['褐', '深棕'],
          深棕: ['棕', '褐'],
          黑: ['深棕', '深红'],
          青: ['绿'],
          绿: ['青'],
          灰白: ['白', '米白', '灰褐'],
          灰褐: ['褐', '灰白'],
        }[h] || [];
        const seen = (palette.top.some((p) => near.includes(p.name)) || near.includes(avgName));
        if (seen) hit += 0.5;
      }
    }
    const score = hues.length ? hit / hues.length : 0;
    return { s, score, hues, describe };
  });

  return {
    palette,
    avgName,
    ranked: scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => ({ id: x.s.id, score: x.score, hues: x.hues })),
    fallbackNote: '照片比对只根据整体颜色给出可能范围，请结合下面的「外形特征」确认。',
  };
}

export { closestColorName, textToHues, COLOR_ANCHORS };
