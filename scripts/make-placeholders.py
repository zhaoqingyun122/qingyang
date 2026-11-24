# -*- coding: utf-8 -*-
"""青养 · 为缺少实拍图的条目生成「示意图」占位图（720x540 JPEG）。

命名与实拍图一致：assets/<kind>/<id>.jpg
这些图片是程序绘制的示意图（渐变底色 + 条目名称 + "示意图"标注），
不代表实物外观；用于保证卡片视觉统一、避免 404。后续抓到实拍图覆盖同名文件即可。
"""
import os
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(ROOT, 'assets')
FONT = 'C:/Windows/Fonts/msyh.ttc'
W, H = 720, 540

KINDS = {
    'herbs': ('js/data/substances.js', r'"id":\s*"([^"]+)",\s*"name":\s*"([^"]+)"'),
    'dishes': ('js/data/recipes.js', r'"id":\s*"([^"]+)",\s*"name":\s*"([^"]+)"'),
    'teas': ('js/data/teas.js', r"id:\s*'([^']+)',\s*name:\s*'([^']+)'"),
}


def gradient(kind='herbs'):
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    top, bottom = (233, 241, 228), (198, 222, 192)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([W - 220, -120, W + 60, 160], fill=(255, 255, 255, 46))
    od.ellipse([-90, H - 150, 130, H + 70], fill=(255, 255, 255, 38))
    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')

    # 简单的碗 + 热气插画（药膳/茶饮），或叶片（药材）
    d = ImageDraw.Draw(img)
    cx, cy = W / 2, H * 0.62
    ink = (70, 110, 82)
    if kind in ('dishes', 'teas'):
        # 热气
        for dx in (-70, 0, 70):
            d.arc([cx + dx - 26, cy - 190, cx + dx + 26, cy - 80], 250, 290, fill=ink, width=5)
            d.arc([cx + dx - 26, cy - 150, cx + dx + 26, cy - 40], 70, 110, fill=ink, width=5)
        # 碗
        d.chord([cx - 170, cy - 70, cx + 170, cy + 150], 0, 180, outline=ink, width=6)
        d.arc([cx - 170, cy + 20, cx + 170, cy + 210], 0, 180, fill=ink, width=6)
        d.line([cx - 168, cy + 4, cx + 168, cy + 4], fill=ink, width=6)
    else:
        # 叶片
        d.arc([cx - 120, cy - 130, cx + 40, cy + 110], 200, 340, fill=ink, width=6)
        d.arc([cx - 40, cy - 110, cx + 120, cy + 90], 20, 160, fill=ink, width=6)
        d.line([cx - 100, cy + 90, cx + 100, cy - 90], fill=ink, width=5)
    return img


def main():
    made = []
    for kind, (file, pattern) in KINDS.items():
        src = open(os.path.join(ROOT, file), encoding='utf-8').read()
        entries = re.findall(pattern, src)
        out_dir = os.path.join(ROOT, 'assets', kind)
        os.makedirs(out_dir, exist_ok=True)
        big = ImageFont.truetype(FONT, 58)
        small = ImageFont.truetype(FONT, 24)
        for eid, name in entries:
            path = os.path.join(out_dir, eid + '.jpg')
            if os.path.exists(path):
                continue
            img = gradient(kind)
            d = ImageDraw.Draw(img)
            d.text((W / 2, H * 0.30), name, font=big, fill=(38, 84, 56), anchor='mm')
            d.text((W / 2, H - 42), '示意图 · 实拍图筹备中', font=small, fill=(84, 120, 96), anchor='mm')
            img.save(path, 'JPEG', quality=86, optimize=True)
            made.append(kind + '-' + eid)
            print('新增示意图:', kind + '/' + eid + '.jpg', name)
    # 记录哪些是示意图（供对照页标注）
    if made:
        import json
        p = os.path.join(ASSETS_DIR, '_placeholders.json')
        old = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else []
        json.dump(sorted(set(old) | set(made)), open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('共生成', len(made), '张示意图')


if __name__ == '__main__':
    main()