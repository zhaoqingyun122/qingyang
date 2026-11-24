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
FONT = 'C:/Windows/Fonts/msyh.ttc'
W, H = 720, 540

KINDS = {
    'herbs': ('js/data/substances.js', r'"id":\s*"([^"]+)",\s*"name":\s*"([^"]+)"'),
    'dishes': ('js/data/recipes.js', r'"id":\s*"([^"]+)",\s*"name":\s*"([^"]+)"'),
    'teas': ('js/data/teas.js', r"id:\s*'([^']+)',\s*name:\s*'([^']+)'"),
}


def gradient():
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    top, bottom = (233, 241, 228), (198, 222, 192)
    for y in range(H):
        t = y / (H - 1)
        d.line(
            [(0, y), (W, y)],
            fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)),
        )
    # 柔和的顶部半透明圆形装饰
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([W - 220, -120, W + 60, 160], fill=(255, 255, 255, 46))
    od.ellipse([-90, H - 150, 130, H + 70], fill=(255, 255, 255, 38))
    return Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')


def main():
    made = 0
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
            img = gradient()
            d = ImageDraw.Draw(img)
            d.text((W / 2, H / 2 - 26), name, font=big, fill=(38, 84, 56), anchor='mm')
            d.text((W / 2, H / 2 + 46), '示意图 · 实拍图筹备中', font=small, fill=(84, 120, 96), anchor='mm')
            img.save(path, 'JPEG', quality=86, optimize=True)
            made += 1
            print('新增示意图:', kind + '/' + eid + '.jpg', name)
    print('共生成', made, '张示意图')


if __name__ == '__main__':
    main()