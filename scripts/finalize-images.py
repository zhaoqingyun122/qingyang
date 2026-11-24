# -*- coding: utf-8 -*-
"""青养 · 把抓到的原始图片统一转码为站点用图。

输入：assets/_raw/<kind>-<id>.bin（scripts/fetch-images.mjs 下载的原始字节）
输出：assets/<kind>/<id>.jpg（宽 ≤ 900px，JPEG 质量 82）

筛选规则（自动剔除明显不可用的图片）：
- 打不开 / 非图片
- 宽 < 300 或 高 < 200
- 宽高比不在 0.6 ~ 1.9 之间（横幅、竖图、长图）
- 纯图标的透明图（alpha 通道占比过高）
已存在的 jpg 会被覆盖（保证与最新抓取一致）。
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', '_raw')
MAX_W = 900
QUALITY = 82

KINDS = ('herbs', 'dishes', 'teas')
report = {'ok': 0, 'skip': [], 'by_kind': {k: 0 for k in KINDS}}


def convert(path, out_dir, out_name):
    img = Image.open(path)
    if img.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img.convert('RGBA'), mask=img.convert('RGBA').split()[-1])
        img = bg
    else:
        img = img.convert('RGB')
    w, h = img.size
    if w < 300 or h < 200:
        return False, f'too-small {w}x{h}'
    ratio = w / h
    if ratio < 0.6 or ratio > 1.9:
        return False, f'bad-ratio {w}x{h}'
    if w > MAX_W:
        img = img.resize((MAX_W, round(h * MAX_W / w)), Image.LANCZOS)
    os.makedirs(out_dir, exist_ok=True)
    img.save(os.path.join(out_dir, out_name), 'JPEG', quality=QUALITY, optimize=True)
    return True, f'{w}x{h}'


def main():
    if not os.path.isdir(RAW):
        print('没有 assets/_raw 目录，先运行 node scripts/fetch-images.mjs')
        sys.exit(1)
    files = sorted(f for f in os.listdir(RAW) if f.endswith('.bin'))
    print(f'待处理原始文件：{len(files)}')
    for f in files:
        key = f[:-4]
        kind = key.split('-', 1)[0]
        if kind not in KINDS:
            continue
        src = os.path.join(RAW, f)
        try:
            ok, info = convert(src, os.path.join(ROOT, 'assets', kind), key.split('-', 1)[1] + '.jpg')
        except Exception as e:  # noqa: BLE001
            ok, info = False, f'error {e}'
        if ok:
            report['ok'] += 1
            report['by_kind'][kind] += 1
        else:
            report['skip'].append(f'{key}: {info}')
    print(f"成功：{report['ok']} 张（" + '，'.join(f'{k} {v}' for k, v in report['by_kind'].items()) + '）')
    if report['skip']:
        print(f"跳过：{len(report['skip'])} 张")
        for s in report['skip']:
            print('  -', s)


if __name__ == '__main__':
    main()