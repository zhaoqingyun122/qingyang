# -*- coding: utf-8 -*-
"""青养 · 生成图片对照页 assets/_review.html。

用途：把所有配图按「药材 / 药膳 / 茶饮」列成网格，带上条目名称、id、来源标题，
方便人工快速核对「图是否对得上名」，把不对的 id 反馈后重新抓取。
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
OUT = os.path.join(ASSETS, '_review.html')

KINDS = {
    'herbs': ('js/data/substances.js', r'"id":\s*"([^"]+)",\s*"name":\s*"([^"]+)"', '药材'),
    'dishes': ('js/data/recipes.js', r'"id":\s*"([^"]+)",\s*"name":\s*"([^"]+)"', '药膳'),
    'teas': ('js/data/teas.js', r"id:\s*'([^']+)',\s*name:\s*'([^']+)'", '茶饮'),
}


def main():
    sources = {}
    sp = os.path.join(ASSETS, '_sources.json')
    if os.path.exists(sp):
        sources = json.load(open(sp, encoding='utf-8')).get('items', {})

    sections = []
    total = 0
    for kind, (file, pattern, label) in KINDS.items():
        src = open(os.path.join(ROOT, file), encoding='utf-8').read()
        entries = re.findall(pattern, src)
        cards = []
        for eid, name in entries:
            path = os.path.join(ASSETS, kind, eid + '.jpg')
            if not os.path.exists(path):
                continue
            total += 1
            meta = sources.get(f'{kind}-{eid}', {})
            title = meta.get('title') or ''
            placeholder = not meta.get('ok')
            tag = '<span class="ph">示意图</span>' if placeholder else ''
            cards.append(
                f'<figure><a href="{kind}/{eid}.jpg" target="_blank"><img loading="lazy" src="{kind}/{eid}.jpg" alt="{name}"></a>'
                f'<figcaption><b>{name}</b> {tag}<br><code>{kind}/{eid}.jpg</code>'
                f'<br><small>{title[:46]}</small></figcaption></figure>'
            )
        sections.append(f'<h2>{label}（{len(cards)} 张）</h2><div class="grid">{"".join(cards)}</div>')

    html = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>青养 · 图片对照检查</title>
<style>
body{{font-family:"Microsoft YaHei",system-ui,sans-serif;margin:24px;background:#f6f8f4;color:#22302a}}
h1{{margin:0 0 6px}} h2{{margin:28px 0 10px;color:#2e6e49}}
.note{{background:#fff;border:1px solid #d8e3d4;border-left:4px solid #2e6e49;padding:10px 14px;border-radius:8px;line-height:1.7}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:12px}}
figure{{margin:0;background:#fff;border:1px solid #e2e9de;border-radius:10px;overflow:hidden}}
figure img{{width:100%;height:130px;object-fit:cover;display:block;background:#eef3ea}}
figcaption{{padding:6px 8px;font-size:12px;line-height:1.5}}
figcaption b{{font-size:14px}} code{{color:#7a8c80}}
.ph{{color:#b45;font-size:11px;border:1px solid #e7c;border-radius:4px;padding:0 4px}}
</style></head><body>
<h1>青养 · 图片对照检查</h1>
<p class="note">共 {total} 张。请快速扫一遍：<b>哪些图明显不是这个药材/药膳</b>，把名称或文件名（如 <code>herbs/shan-yao.jpg</code>）发给我，我针对性重抓或手工指定图源。
标「示意图」的是没抓到合适实拍图时程序生成的占位图，不代表实物。</p>
{''.join(sections)}
</body></html>'''
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    print('已生成', OUT, '共', total, '张')


if __name__ == '__main__':
    main()