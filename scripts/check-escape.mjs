// 青养 · 检查 html`` 模板中未经 esc() 的文本插值（防止 XSS 与误渲染）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.js')) files.push(p);
  }
})(path.join(ROOT, 'js'));

const SAFE = /esc\(|\.join\(|swatches|styles|line|contentW|recipeH|tagH|tagLines|bytes|HTML/i;
let problems = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  // 找到所有 html`...` 模板（支持嵌套 ${} 的简易扫描）
  let idx = 0;
  while ((idx = src.indexOf('html`', idx)) !== -1) {
    let i = idx + 5;
    let depth = 0;
    let inExpr = false;
    let end = -1;
    for (; i < src.length; i += 1) {
      const ch = src[i];
      if (inExpr) {
        if (ch === '{') depth += 1;
        else if (ch === '}') {
          depth -= 1;
          if (depth === 0) inExpr = false;
        }
      } else if (ch === '$' && src[i + 1] === '{') {
        inExpr = true;
        depth = 1;
        i += 1;
        const start = i + 1;
        // 找到本表达式的结束位置
        let d = 1;
        let j = start;
        for (; j < src.length; j += 1) {
          if (src[j] === '{') d += 1;
          else if (src[j] === '}') {
            d -= 1;
            if (d === 0) break;
          }
        }
        const expr = src.slice(start, j).trim();
        const line = src.slice(0, idx).split('\n').length;
        if (expr && !SAFE.test(expr)) {
          // 允许安全常量：数字、布尔、模板字面量中的简单插值
          const isConst = /^[\w$.]+$/.test(expr) && !/(name|text|summary|effects|usage|alias)/i.test(expr);
          if (!isConst) {
            problems += 1;
            console.log(`  ? ${path.relative(ROOT, file)}:${line}  未转义插值：\${${expr.slice(0, 70)}}`);
          }
        }
        i = j;
        continue;
      } else if (ch === '`') {
        end = i;
        break;
      }
    }
    idx = end > 0 ? end : idx + 5;
  }
}

console.log(problems ? `\n共 ${problems} 处需要人工确认` : '\n未发现未转义插值');
