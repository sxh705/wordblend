# -*- coding: utf-8 -*-
"""生成扩展图标（纯标准库，不依赖 PIL）。
设计：深色圆角方块 + 绿色字母 F（用矩形拼，4x4 超采样做抗锯齿）。
"""
import os, zlib, struct

BG = (15, 19, 23)
FG = (61, 220, 151)

# 相对坐标系（0~1）下的 F：一根竖 + 两根横
BARS = [
    (0.295, 0.240, 0.420, 0.780),   # 竖
    (0.295, 0.240, 0.725, 0.360),   # 上横
    (0.295, 0.455, 0.625, 0.565),   # 中横
]
RADIUS = 0.225


def _in_round_rect(x, y, r):
    if x < 0.0 or x > 1.0 or y < 0.0 or y > 1.0:
        return False
    cx = min(max(x, r), 1.0 - r)
    cy = min(max(y, r), 1.0 - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def _in_f(x, y):
    for x0, y0, x1, y1 in BARS:
        if x0 <= x <= x1 and y0 <= y <= y1:
            return True
    return False


def _render(size, ss=4):
    """返回 rows: [[(r,g,b,a), ...], ...]"""
    rows = []
    inv = 1.0 / (size * ss)
    for py in range(size):
        row = []
        for px in range(size):
            cov = 0
            fr = fg = fb = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px * ss + sx + 0.5) * inv
                    y = (py * ss + sy + 0.5) * inv
                    if not _in_round_rect(x, y, RADIUS):
                        continue
                    cov += 1
                    if _in_f(x, y):
                        fr += FG[0]; fg += FG[1]; fb += FG[2]
                    else:
                        fr += BG[0]; fg += BG[1]; fb += BG[2]
            total = ss * ss
            if cov == 0:
                row.append((0, 0, 0, 0))
            else:
                a = int(round(255 * cov / total))
                row.append((int(round(fr / cov)), int(round(fg / cov)), int(round(fb / cov)), a))
        rows.append(row)
    return rows


def _png(path, rows):
    h = len(rows)
    w = len(rows[0])
    raw = bytearray()
    for row in rows:
        raw.append(0)
        for p in row:
            raw.extend(p)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    blob = (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
            + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(blob)


def build(outdir):
    made = []
    for size in (16, 32, 48, 128):
        p = os.path.join(outdir, 'icon%d.png' % size)
        _png(p, _render(size))
        made.append(p)
    return made


if __name__ == '__main__':
    import sys
    d = sys.argv[1] if len(sys.argv) > 1 else '.'
    for p in build(d):
        print(p, os.path.getsize(p), 'bytes')
