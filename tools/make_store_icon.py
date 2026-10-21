# -*- coding: utf-8 -*-
"""生成商店列表用的大图标，复用 make_icon 的绘制逻辑。纯标准库。

- store-icon-128.png      128×128，内含 96×96 图形 + 16px 透明边距（Chrome 商店规范）
- store-icon-128-full.png 128×128 满幅（备用 / Edge 也接受）
- store-icon-300.png      300×300 满幅（Edge 加载项商店要求）

用法：python tools/make_store_icon.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_icon

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'docs', 'store', 'screenshots')


def _pad(rows, canvas, offset):
    """把 rows 贴到 canvas×canvas 的透明画布中央，offset 为左上角坐标。"""
    blank = [(0, 0, 0, 0)] * canvas
    out = [list(blank) for _ in range(canvas)]
    for y, row in enumerate(rows):
        out[offset + y][offset:offset + len(row)] = row
    return out


def build():
    os.makedirs(OUT, exist_ok=True)
    made = []

    # Chrome 商店图标：96 图形 + 16 边距
    p = os.path.join(OUT, 'store-icon-128.png')
    make_icon._png(p, _pad(make_icon._render(96, ss=4), 128, 16))
    made.append(p)

    # 满幅 128
    p = os.path.join(OUT, 'store-icon-128-full.png')
    make_icon._png(p, make_icon._render(128, ss=4))
    made.append(p)

    # Edge 商店图标 300
    p = os.path.join(OUT, 'store-icon-300.png')
    make_icon._png(p, make_icon._render(300, ss=3))
    made.append(p)
    return made


if __name__ == '__main__':
    for p in build():
        print(p, os.path.getsize(p), 'bytes')
