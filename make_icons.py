# -*- coding: utf-8 -*-
"""生成青养 PWA 图标（绿色圆底 + 叶片）"""
from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = size * 0.06
    # 圆角方形底（绿色渐变近似）
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=size * 0.22, fill=(95, 143, 91, 255))
    # 三片叶子（浅色）
    cx, cy = size * 0.50, size * 0.52
    leaf = (size * 0.30, size * 0.18)
    colors = [(234, 242, 230, 255), (210, 226, 200, 255), (178, 205, 165, 255)]
    for i, (dx, dy) in enumerate([(-0.16, -0.06), (0.16, -0.06), (0.0, 0.12)]):
        r = size * 0.16
        d.ellipse([cx + dx * size - r, cy + dy * size - r, cx + dx * size + r, cy + dy * size + r], fill=colors[i])
    # 中央碗/圆点
    d.ellipse([cx - size * 0.075, cy - size * 0.075, cx + size * 0.075, cy + size * 0.075], fill=(74, 116, 71, 255))
    img.save(path, "PNG")

base = r"C:\Users\小新AIR\Documents\qingyunapp\assets\icons"
import os
os.makedirs(base, exist_ok=True)
make_icon(192, os.path.join(base, "icon-192.png"))
make_icon(512, os.path.join(base, "icon-512.png"))
make_icon(192, os.path.join(base, "maskable-192.png"))
make_icon(512, os.path.join(base, "maskable-512.png"))
print("icons generated")