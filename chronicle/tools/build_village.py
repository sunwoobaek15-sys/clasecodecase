#!/usr/bin/env python3
"""Procedural pixel art for the village (Phase 3).

The reference sheets contain the village NPCs and a few props (market stall,
signs, banner, notice board, lamp, barrel) but no buildings, ground or sky.
Those are generated here in the same palette family as the rest of the game:

  assets/environments/village/ground.png        64x48 tileable street + soil
  assets/environments/village/bg_{sky,far,mid}.png  640x360 parallax layers
  assets/environments/village/gate.png          village gate (to the world map)
  assets/environments/village/building_<id>_{ruined,restored}.png
        shop, smithy, library, lab, farm, training (128x112, ground at bottom)
  assets/environments/village/farm_plot_{empty,growing,ripe}.png

Placeholder art for the graphics pass (Phase 4), like build_environment.py.
Usage: python3 tools/build_village.py
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from build_environment import fbm, value_noise

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "environments" / "village"
W, H = 640, 360
OUTLINE = (20, 14, 30, 255)

STONE = [(52, 54, 72), (78, 80, 98), (108, 110, 126), (146, 146, 158)]
PLASTER = [(150, 128, 104), (186, 164, 132), (214, 196, 160), (234, 222, 190)]
BEAM = [(44, 28, 24), (70, 46, 34), (98, 66, 44)]
ROOFS = {
    "shop": [(28, 44, 92), (44, 70, 140), (72, 104, 184), (120, 150, 220)],
    "smithy": [(70, 28, 26), (104, 44, 34), (140, 66, 44), (178, 100, 62)],
    "library": [(24, 60, 46), (36, 88, 62), (56, 120, 80), (96, 160, 104)],
    "lab": [(46, 28, 82), (70, 44, 120), (100, 66, 160), (146, 104, 204)],
    "farm": [(96, 64, 26), (136, 96, 40), (176, 132, 60), (214, 176, 96)],
    "training": [(40, 48, 66), (60, 72, 96), (84, 100, 128), (124, 140, 166)],
}
GLOW = (255, 214, 120)


def shade(c, k):
    return tuple(int(max(0, min(255, v * k))) for v in c[:3])


def outline(img: Image.Image, col=OUTLINE) -> Image.Image:
    a = np.asarray(img).copy()
    al = a[..., 3] > 0
    n = np.zeros_like(al)
    n[1:] |= al[:-1]
    n[:-1] |= al[1:]
    n[:, 1:] |= al[:, :-1]
    n[:, :-1] |= al[:, 1:]
    edge = n & ~al
    a[edge] = col
    return Image.fromarray(a, "RGBA")


def textured_rect(img, box, pal, rng, cell=6, strength=1.0):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    n = value_noise(max(w, 2), max(h, 2), cell, rng, wrap=False)
    idx = np.clip((n * len(pal) * strength + (1 - strength) * len(pal) / 2), 0, len(pal) - 1).astype(int)
    arr = np.asarray(img).copy()
    for i, c in enumerate(pal):
        m = idx == i
        sub = arr[y0:y1, x0:x1]
        sub[m[:h, :w]] = (*c[:3], 255)
    return Image.fromarray(arr, "RGBA")


def stone_wall(img, box, rng):
    x0, y0, x1, y1 = box
    img = textured_rect(img, box, STONE[1:3], rng, cell=5)
    d = ImageDraw.Draw(img)
    y = y0
    row = 0
    while y < y1:
        bh = 6
        off = 0 if row % 2 == 0 else 5
        d.line([(x0, y), (x1 - 1, y)], fill=(*STONE[0], 255))
        for x in range(x0 + off, x1, 10):
            d.line([(x, y), (x, min(y1 - 1, y + bh))], fill=(*STONE[0], 255))
            d.point((x + 1, y + 1), fill=(*STONE[3], 255))
        y += bh
        row += 1
    return img


def timber_wall(img, box, rng):
    x0, y0, x1, y1 = box
    img = textured_rect(img, box, PLASTER[1:4], rng, cell=7)
    d = ImageDraw.Draw(img)
    for x in (x0, x1 - 3):
        d.rectangle([x, y0, x + 2, y1 - 1], fill=(*BEAM[1], 255))
    d.rectangle([x0, y0, x1 - 1, y0 + 2], fill=(*BEAM[1], 255))
    mid = (y0 + y1) // 2
    d.rectangle([x0, mid, x1 - 1, mid + 2], fill=(*BEAM[1], 255))
    for x in range(x0 + 22, x1 - 10, 26):
        d.rectangle([x, y0, x + 2, y1 - 1], fill=(*BEAM[0], 255))
        d.line([(x + 3, y0 + 3), (x + 13, mid - 1)], fill=(*BEAM[2], 255), width=2)
    return img


def roof(img, box, pal, rng, style="gable"):
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(img)
    cx = (x0 + x1) // 2
    if style == "gable":
        poly = [(x0, y1), (cx, y0), (x1, y1)]
    else:  # hip / mansard
        poly = [(x0, y1), (x0 + 14, y0), (x1 - 14, y0), (x1, y1)]
    d.polygon(poly, fill=(*pal[1], 255))
    arr = np.asarray(img).copy()
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    m = np.asarray(mask) > 0
    # shingle rows
    for y in range(y0, y1 + 1):
        r = (y - y0) % 6
        for x in range(x0, x1 + 1):
            if not m[y, x]:
                continue
            col = pal[1]
            if r == 0:
                col = pal[0]
            elif ((x + (3 if ((y - y0) // 6) % 2 else 0)) % 8) == 0:
                col = pal[0]
            elif r == 1:
                col = pal[2]
            if x < cx and style == "gable":
                col = shade(col, 1.08)
            arr[y, x] = (*col[:3], 255)
    img = Image.fromarray(arr, "RGBA")
    d = ImageDraw.Draw(img)
    d.line(poly + [poly[0]] if style != "gable" else poly, fill=(*pal[3], 255), width=1)
    return img


def window(d, x, y, w=12, h=14, lit=True, broken=False):
    d.rectangle([x - 1, y - 1, x + w, y + h], fill=(*BEAM[0], 255))
    if broken:
        d.rectangle([x, y, x + w - 1, y + h - 1], fill=(18, 16, 24, 255))
        d.line([(x, y + 2), (x + w - 1, y + h - 3)], fill=(*BEAM[2], 255), width=2)
        d.line([(x, y + h - 3), (x + w - 1, y + 2)], fill=(*BEAM[1], 255), width=2)
        return
    fill = GLOW if lit else (40, 52, 74)
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=(*fill, 255))
    if lit:
        d.rectangle([x + 1, y + 1, x + w // 2 - 2, y + h // 2 - 2], fill=(255, 240, 190, 255))
    d.line([(x + w // 2, y), (x + w // 2, y + h - 1)], fill=(*BEAM[0], 255))
    d.line([(x, y + h // 2), (x + w - 1, y + h // 2)], fill=(*BEAM[0], 255))


def door(d, x, y, w=18, h=26, boarded=False):
    d.rectangle([x - 2, y - 2, x + w + 1, y + h], fill=(*STONE[0], 255))
    d.rectangle([x, y, x + w - 1, y + h], fill=(*BEAM[1], 255))
    for xx in range(x + 4, x + w - 1, 5):
        d.line([(xx, y + 1), (xx, y + h)], fill=(*BEAM[0], 255))
    d.point((x + w - 4, y + h // 2), fill=(230, 196, 90, 255))
    if boarded:
        d.line([(x - 3, y + 6), (x + w + 2, y + 12)], fill=(*BEAM[2], 255), width=3)
        d.line([(x - 3, y + 18), (x + w + 2, y + 14)], fill=(*BEAM[2], 255), width=3)


def emblem(d, kind, x, y):
    """12x10 icon on a hanging sign board."""
    d.rectangle([x - 3, y - 3, x + 16, y + 13], fill=(*BEAM[1], 255))
    d.rectangle([x - 2, y - 2, x + 15, y + 12], fill=(*BEAM[2], 255))
    d.line([(x + 1, y - 8), (x + 1, y - 3)], fill=(*BEAM[0], 255))
    d.line([(x + 12, y - 8), (x + 12, y - 3)], fill=(*BEAM[0], 255))
    g = (240, 206, 110, 255)
    if kind == "shop":  # coin bag
        d.ellipse([x + 2, y + 2, x + 11, y + 11], fill=g)
        d.rectangle([x + 5, y, x + 8, y + 2], fill=g)
    elif kind == "smithy":  # anvil
        d.rectangle([x + 1, y + 3, x + 12, y + 5], fill=(200, 204, 214, 255))
        d.rectangle([x + 4, y + 6, x + 9, y + 8], fill=(150, 154, 168, 255))
        d.rectangle([x + 2, y + 9, x + 11, y + 10], fill=(150, 154, 168, 255))
    elif kind == "library":  # open book
        d.rectangle([x + 1, y + 2, x + 6, y + 10], fill=(236, 230, 210, 255))
        d.rectangle([x + 7, y + 2, x + 12, y + 10], fill=(236, 230, 210, 255))
        d.line([(x + 6, y + 2), (x + 6, y + 10)], fill=(120, 60, 50, 255))
    elif kind == "lab":  # flask
        d.rectangle([x + 5, y, x + 8, y + 4], fill=(200, 220, 240, 255))
        d.polygon([(x + 3, y + 10), (x + 5, y + 4), (x + 8, y + 4), (x + 10, y + 10)], fill=(170, 110, 240, 255))
    elif kind == "farm":  # wheat
        for i in range(3):
            d.line([(x + 3 + i * 3, y + 10), (x + 4 + i * 3, y + 1)], fill=g)
            d.point((x + 3 + i * 3, y + 3), fill=g)
    elif kind == "training":  # crossed swords
        d.line([(x + 1, y + 1), (x + 12, y + 10)], fill=(220, 224, 236, 255), width=2)
        d.line([(x + 12, y + 1), (x + 1, y + 10)], fill=(220, 224, 236, 255), width=2)


def building(kind: str, ruined: bool, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    bw, bh = 128, 112
    img = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    stone_kinds = ("smithy", "lab", "training")
    wall_box = (14, 52, 114, 106)
    if kind in stone_kinds:
        img = stone_wall(img, wall_box, rng)
    else:
        img = timber_wall(img, wall_box, rng)
    d = ImageDraw.Draw(img)
    # extras behind the roof
    if kind == "smithy":
        d.rectangle([88, 10, 100, 40], fill=(*STONE[1], 255))
        d.rectangle([86, 8, 102, 12], fill=(*STONE[2], 255))
    if kind == "lab":
        d.rectangle([90, 6, 108, 52], fill=(*STONE[1], 255))
        d.polygon([(88, 8), (99, -6), (110, 8)], fill=(*ROOFS["lab"][2], 255))
    img = roof(img, (6, 14, 122, 54), ROOFS[kind], rng, "hip" if kind in ("library", "training") else "gable")
    d = ImageDraw.Draw(img)
    if kind == "lab":
        d.rectangle([94, 18, 104, 30], fill=(*STONE[2], 255))
        d.ellipse([95, 19, 103, 27], fill=((60, 40, 90) if ruined else (190, 140, 255)) + (255,))
    # foundation
    d.rectangle([10, 104, 118, 111], fill=(*STONE[1], 255))
    d.line([(10, 104), (118, 104)], fill=(*STONE[3], 255))
    # front
    door(d, 55, 80, boarded=ruined)
    lit = not ruined
    window(d, 26, 66, lit=lit, broken=ruined)
    window(d, 90, 66, lit=lit, broken=ruined)
    if kind == "library":
        d.ellipse([56, 56, 72, 72], fill=(*BEAM[0], 255))
        d.ellipse([58, 58, 70, 70], fill=((40, 52, 74) if ruined else GLOW) + (255,))
    emblem(d, kind, 30, 92 - 40 if False else 44)
    if kind == "farm":
        d.rectangle([92, 86, 120, 106], fill=(214, 186, 92, 255))  # hay bales
        d.line([(92, 92), (120, 92)], fill=(170, 136, 60, 255))
    if kind == "training":
        d.rectangle([116, 70, 118, 106], fill=(*BEAM[1], 255))  # dummy post
        d.ellipse([111, 62, 123, 74], fill=(200, 170, 110, 255))
        d.rectangle([110, 76, 124, 79], fill=(*BEAM[2], 255))
    if kind == "smithy" and not ruined:
        d.rectangle([10, 92, 22, 104], fill=(*STONE[0], 255))  # forge mouth
        d.rectangle([12, 95, 20, 103], fill=(255, 140, 60, 255))
    img = outline(img)

    if ruined:
        arr = np.asarray(img).astype(np.float32)
        # desaturate + darken
        g = arr[..., :3].mean(axis=2, keepdims=True)
        arr[..., :3] = (arr[..., :3] * 0.45 + g * 0.55) * 0.78
        arr = arr.astype(np.uint8)
        # holes in the roof
        hole = Image.new("L", (bw, bh), 0)
        hd = ImageDraw.Draw(hole)
        for _ in range(3):
            cx, cy = rng.integers(26, 104), rng.integers(22, 44)
            pts = [(cx + math.cos(t) * rng.uniform(5, 13), cy + math.sin(t) * rng.uniform(4, 9))
                   for t in np.linspace(0, math.tau, 9, endpoint=False)]
            hd.polygon(pts, fill=255)
        hm = np.asarray(hole) > 0
        arr[hm] = 0
        img = outline(Image.fromarray(arr, "RGBA"), (14, 12, 18, 255))
        d = ImageDraw.Draw(img)
        # exposed rafters
        for x in range(24, 108, 14):
            d.line([(x, 54), (64, 16)], fill=(70, 52, 40, 255))
        # cracks
        for _ in range(4):
            x, y = int(rng.integers(18, 110)), int(rng.integers(58, 100))
            for _ in range(6):
                nx, ny = x + int(rng.integers(-2, 3)), y + int(rng.integers(1, 4))
                d.line([(x, y), (nx, ny)], fill=(24, 22, 28, 255))
                x, y = nx, ny
        # vines
        for vx in (18, 108):
            y = 56
            while y < 104:
                d.point((vx + int(rng.integers(-1, 2)), y), fill=(52, 104, 48, 255))
                if rng.random() < 0.35:
                    d.point((vx + 1, y), fill=(84, 148, 64, 255))
                y += 1
        # rubble
        for _ in range(14):
            rx, ry = int(rng.integers(8, 120)), int(rng.integers(100, 108))
            r = int(rng.integers(2, 5))
            col = STONE[int(rng.integers(0, 3))]
            d.ellipse([rx - r, ry - r, rx + r, ry + 2], fill=(*shade(col, 0.8), 255))
    return img


def farm_plot(stage: str) -> Image.Image:
    rng = np.random.default_rng({"empty": 1, "growing": 2, "ripe": 3}[stage])
    img = Image.new("RGBA", (96, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 14, 95, 23], fill=(72, 48, 36, 255))
    for x in range(2, 94, 8):
        d.line([(x, 15), (x + 4, 15)], fill=(98, 68, 48, 255))
    for x in range(4, 94, 12):
        if stage == "empty":
            if rng.random() < 0.5:
                d.line([(x, 14), (x + 1, 10)], fill=(110, 110, 60, 255))
        elif stage == "growing":
            d.line([(x + 2, 14), (x + 2, 8)], fill=(70, 150, 60, 255))
            d.point((x + 1, 9), fill=(110, 200, 80, 255))
            d.point((x + 3, 10), fill=(110, 200, 80, 255))
        else:
            d.line([(x + 2, 14), (x + 2, 4)], fill=(80, 150, 60, 255))
            d.ellipse([x, 2, x + 4, 7], fill=(240, 200, 90, 255))
            d.point((x + 1, 3), fill=(255, 240, 170, 255))
    return outline(img)


def gate() -> Image.Image:
    rng = np.random.default_rng(77)
    img = Image.new("RGBA", (96, 120), (0, 0, 0, 0))
    img = stone_wall(img, (0, 20, 18, 118), rng)
    img = stone_wall(img, (78, 20, 96, 118), rng)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 14, 95, 26], fill=(*BEAM[1], 255))
    d.rectangle([0, 14, 95, 15], fill=(*BEAM[2], 255))
    d.rectangle([-2, 8, 20, 14], fill=(*STONE[2], 255))
    d.rectangle([76, 8, 98, 14], fill=(*STONE[2], 255))
    # banner
    d.rectangle([40, 26, 56, 52], fill=(44, 70, 140, 255))
    d.polygon([(40, 52), (48, 46), (56, 52), (56, 58), (48, 52), (40, 58)], fill=(44, 70, 140, 255))
    d.line([(44, 34), (52, 42)], fill=(240, 206, 110, 255))
    d.line([(52, 34), (44, 42)], fill=(240, 206, 110, 255))
    return outline(img)


def ground() -> Image.Image:
    rng = np.random.default_rng(5)
    w, h = 64, 48
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    arr = np.zeros((h, w, 4), np.uint8)
    n = fbm(w, h, rng, cells=(16, 8, 4))
    soil = np.array([(46, 32, 34), (62, 44, 42), (80, 58, 50)])
    idx = np.clip((n * 3).astype(int), 0, 2)
    arr[..., :3] = soil[idx]
    arr[..., 3] = 255
    img = Image.fromarray(arr, "RGBA")
    d = ImageDraw.Draw(img)
    # cobblestones (top 10 px)
    d.rectangle([0, 0, w - 1, 10], fill=(*STONE[0], 255))
    x = 0
    row_y = [(1, 4), (6, 9)]
    for ri, (ya, yb) in enumerate(row_y):
        x = -3 if ri else 0
        while x < w:
            sw = int(rng.integers(6, 10))
            col = STONE[int(rng.integers(1, 4))]
            d.rounded_rectangle([x, ya, min(w - 1, x + sw - 2), yb], radius=1, fill=(*col, 255))
            d.point((x + 1, ya), fill=(*shade(col, 1.15), 255))
            x += sw
    d.line([(0, 11), (w - 1, 11)], fill=(30, 22, 26, 255))
    # grass tufts at the stone edge
    for gx in range(0, w, 5):
        if rng.random() < 0.6:
            d.point((gx, 0), fill=(98, 180, 70, 255))
    return img


def gradient(top, bottom, h=H, w=W):
    t = np.linspace(0, 1, h)[:, None]
    col = (np.array(top)[None, :] * (1 - t) + np.array(bottom)[None, :] * t)
    img = np.zeros((h, w, 4), np.uint8)
    img[..., :3] = col[:, None, :].astype(np.uint8)
    img[..., 3] = 255
    return img


def backgrounds() -> None:
    rng = np.random.default_rng(31)
    sky = Image.fromarray(gradient((58, 96, 160), (236, 186, 150)), "RGBA")
    d = ImageDraw.Draw(sky)
    # soft clouds
    for _ in range(9):
        cx, cy = rng.uniform(0, W), rng.uniform(40, 200)
        for _ in range(6):
            rx, ry = rng.uniform(14, 34), rng.uniform(5, 10)
            ox, oy = rng.uniform(-30, 30), rng.uniform(-6, 6)
            for wrap in (-W, 0, W):
                d.ellipse([cx + ox - rx + wrap, cy + oy - ry, cx + ox + rx + wrap, cy + oy + ry],
                          fill=(250, 226, 214, 255))
    sky.save(OUT / "bg_sky.png", optimize=True)

    far = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(far)
    for (ix, iy, iw) in ((80, 150, 120), (300, 110, 70), (470, 170, 150), (600, 120, 50)):
        top = (120, 136, 176, 255)
        d.ellipse([ix - iw / 2, iy - 8, ix + iw / 2, iy + 8], fill=top)
        d.polygon([(ix - iw / 2, iy), (ix + iw / 2, iy), (ix + iw * 0.1, iy + iw * 0.55), (ix - iw * 0.15, iy + iw * 0.4)],
                  fill=(100, 112, 150, 255))
        # waterfall
        d.rectangle([ix + iw * 0.2, iy + 4, ix + iw * 0.2 + 2, iy + iw * 0.7], fill=(190, 210, 236, 200))
        # tiny trees on top
        for t in range(int(iw / 18)):
            tx = ix - iw / 2 + 8 + t * 16
            d.ellipse([tx - 5, iy - 16, tx + 5, iy - 4], fill=(96, 120, 140, 255))
    far.save(OUT / "bg_far.png", optimize=True)

    mid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(mid)
    base = 300
    # hills
    pts = [(0, H)]
    for x in range(0, W + 1, 8):
        y = base - 26 - 14 * math.sin(x / W * math.tau * 2) - 8 * math.sin(x / W * math.tau * 5 + 1)
        pts.append((x, y))
    pts.append((W, H))
    d.polygon(pts, fill=(70, 98, 104, 255))
    # distant roofs
    x = 10
    while x < W - 40:
        hw = int(rng.integers(20, 34))
        hh = int(rng.integers(16, 26))
        top = base - 30 - int(rng.integers(0, 12))
        d.rectangle([x, top, x + hw, base], fill=(84, 92, 118, 255))
        d.polygon([(x - 3, top), (x + hw // 2, top - hh), (x + hw + 3, top)], fill=(104, 82, 108, 255))
        d.rectangle([x + 5, top + 6, x + 9, top + 11], fill=(250, 210, 140, 255))
        x += hw + int(rng.integers(20, 60))
    for x in range(0, W, 46):
        tx = x + int(rng.integers(0, 20))
        d.ellipse([tx - 12, base - 46, tx + 12, base - 14], fill=(58, 86, 84, 255))
    d.rectangle([0, base - 2, W, H], fill=(58, 80, 86, 255))
    mid.save(OUT / "bg_mid.png", optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for i, kind in enumerate(ROOFS):
        for ruined in (True, False):
            img = building(kind, ruined, 100 + i)
            img.save(OUT / f"building_{kind}_{'ruined' if ruined else 'restored'}.png", optimize=True)
    for st in ("empty", "growing", "ripe"):
        farm_plot(st).save(OUT / f"farm_plot_{st}.png", optimize=True)
    gate().save(OUT / "gate.png", optimize=True)
    ground().save(OUT / "ground.png", optimize=True)
    backgrounds()
    print("village art ->", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
