#!/usr/bin/env python3
"""Procedural pixel art for region 2 'Fallen Clock City' (Phase 3-2).

Sheet 06 only contains the boss Chronos and his effects, so the stage art
and the two new region monsters are made here, in Chronos' palette (navy,
royal blue glow, brass/gold, dark steel):

  assets/environments/clock_city/tiles.png       16px atlas, same layout as the forest
  assets/environments/clock_city/bg_{sky,far,mid,near}.png, fg_chains.png
  assets/environments/clock_city/arena_wall.png  iron gate of the boss hall
  assets/environments/clock_city/{gear_big,gear_small,clock_pole,pipe}.png  props
  assets/environments/clock_city/saw_gear.png    spinning gear hazard
  assets/enemies/gear_sentinel/{ring,core,core_charge,shard}.png   flying gear monster
  assets/enemies/clockwork_slime/  bronze recolour of the forest slime atlases

Placeholder art for the graphics pass (Phase 4), like build_environment.py.
Usage: python3 tools/build_clock_city.py  (after build_sprites.py)
"""
from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from build_environment import value_noise

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "environments" / "clock_city"
T = 16
W, H = 640, 360
OUTLINE = (12, 10, 24, 255)

BRICK = [(34, 32, 54), (48, 46, 74), (64, 62, 94), (86, 84, 118)]
MORTAR = (22, 20, 36)
BRASS = [(110, 74, 34), (164, 116, 52), (214, 168, 80), (250, 222, 140)]
STEEL = [(36, 40, 56), (58, 64, 84), (88, 96, 120), (132, 140, 164)]
GLOW = [(40, 90, 220), (80, 150, 255), (170, 210, 255)]


def outline(img: Image.Image, col=OUTLINE) -> Image.Image:
    a = np.asarray(img).copy()
    al = a[..., 3] > 0
    n = np.zeros_like(al)
    n[1:] |= al[:-1]
    n[:-1] |= al[1:]
    n[:, 1:] |= al[:, :-1]
    n[:, :-1] |= al[:, 1:]
    a[n & ~al] = col
    return Image.fromarray(a, "RGBA")


# ------------------------------------------------------------------ tiles ---
def brick_tile(rng, deep=False) -> Image.Image:
    im = Image.new("RGBA", (T, T), (*MORTAR, 255))
    d = ImageDraw.Draw(im)
    pal = BRICK[:3] if not deep else BRICK[:2]
    for row, y in enumerate((0, 5, 10)):
        off = 0 if row % 2 == 0 else -4
        for x in range(off, T, 8):
            c = pal[int(rng.integers(0, len(pal)))]
            if deep:
                c = tuple(int(v * 0.8) for v in c)
            d.rectangle([x + 1, y + 1, x + 7, y + 4], fill=(*c, 255))
            d.point((x + 2, y + 1), fill=(*BRICK[3], 255) if not deep else (*BRICK[2], 255))
    if rng.random() < 0.25 and not deep:
        x, y = int(rng.integers(3, 12)), int(rng.integers(3, 12))
        d.point((x, y), fill=(*GLOW[0], 255))
    return im


def brass_top(im: Image.Image, left=False, right=False) -> Image.Image:
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, T - 1, 3], fill=(*BRASS[1], 255))
    d.line([(0, 0), (T - 1, 0)], fill=(*BRASS[3], 255))
    d.line([(0, 4), (T - 1, 4)], fill=(*BRASS[0], 255))
    for x in (3, 11):
        d.point((x, 2), fill=(*BRASS[2], 255))
    if left:
        d.line([(0, 0), (0, T - 1)], fill=OUTLINE)
    if right:
        d.line([(T - 1, 0), (T - 1, T - 1)], fill=OUTLINE)
    return im


def side(im: Image.Image, left=False, right=False) -> Image.Image:
    d = ImageDraw.Draw(im)
    if left:
        d.line([(0, 0), (0, T - 1)], fill=OUTLINE)
        d.line([(1, 0), (1, T - 1)], fill=(*BRICK[3], 255))
    if right:
        d.line([(T - 1, 0), (T - 1, T - 1)], fill=OUTLINE)
        d.line([(T - 2, 0), (T - 2, T - 1)], fill=(*BRICK[0], 255))
    return im


def bottom(im: Image.Image, left=False, right=False) -> Image.Image:
    d = ImageDraw.Draw(im)
    d.line([(0, T - 1), (T - 1, T - 1)], fill=OUTLINE)
    d.line([(0, T - 2), (T - 1, T - 2)], fill=(*BRICK[0], 255))
    return side(im, left, right)


def girder(kind: str) -> Image.Image:
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0 = 2 if kind in ("left", "single") else 0
    x1 = T - 3 if kind in ("right", "single") else T - 1
    d.rectangle([x0, 0, x1, 5], fill=(*STEEL[1], 255))
    d.line([(x0, 0), (x1, 0)], fill=(*STEEL[3], 255))
    d.line([(x0, 5), (x1, 5)], fill=(*STEEL[0], 255))
    for x in range(x0 + 2, x1, 5):
        d.point((x, 2), fill=(*BRASS[2], 255))
    # truss under the beam
    for x in range(x0, x1, 6):
        d.line([(x, 6), (x + 3, 9)], fill=(*STEEL[0], 255))
        d.line([(x + 3, 9), (x + 6, 6)], fill=(*STEEL[0], 255))
    return outline(im)


def plate(rng, trim=False) -> Image.Image:
    im = Image.new("RGBA", (T, T), (*STEEL[1], 255))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, T - 1, T - 1], outline=(*STEEL[0], 255))
    d.line([(1, 1), (T - 2, 1)], fill=(*STEEL[2], 255))
    for (x, y) in ((2, 2), (13, 2), (2, 13), (13, 13)):
        d.point((x, y), fill=(*STEEL[3], 255))
    if trim:
        d.rectangle([0, 0, T - 1, 2], fill=(*BRASS[1], 255))
        d.line([(0, 0), (T - 1, 0)], fill=(*BRASS[3], 255))
    return im


def gear_shape(d: ImageDraw.ImageDraw, cx, cy, r, teeth, col, hole_col=None, inner=None, rot=0.0):
    pts = []
    for i in range(teeth * 2):
        a = rot + i * math.pi / teeth
        rr = r if i % 2 == 0 else r * 0.78
        a2 = a + math.pi / teeth
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        pts.append((cx + math.cos(a2 - 0.08) * rr, cy + math.sin(a2 - 0.08) * rr))
    d.polygon(pts, fill=col)
    if inner:
        ir = r * 0.55
        d.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=inner)
    if hole_col:
        hr = max(1.0, r * 0.2)
        d.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=hole_col)


def decor(kind: str, rng) -> Image.Image:
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if kind == "gear":
        gear_shape(d, 8, 11, 5, 6, (*BRASS[1], 255), (0, 0, 0, 0))
    elif kind == "bolt":
        d.rectangle([6, 12, 9, 15], fill=(*STEEL[2], 255))
        d.rectangle([7, 9, 8, 12], fill=(*STEEL[3], 255))
    elif kind == "pipe":
        d.rectangle([3, 10, 12, 15], fill=(*BRASS[0], 255))
        d.rectangle([3, 10, 12, 11], fill=(*BRASS[2], 255))
        d.rectangle([10, 6, 12, 10], fill=(*BRASS[1], 255))
    elif kind == "hand":
        d.line([(3, 15), (12, 9)], fill=(*BRASS[2], 255), width=2)
        d.polygon([(12, 9), (14, 7), (13, 10)], fill=(*BRASS[3], 255))
    elif kind == "crystal":
        d.polygon([(8, 7), (11, 15), (5, 15)], fill=(*GLOW[1], 255))
        d.line([(8, 8), (7, 14)], fill=(*GLOW[2], 255))
    elif kind == "rubble":
        for (x, y, r) in ((5, 14, 2), (10, 13, 3)):
            d.ellipse([x - r, y - r, x + r, y + 2], fill=(*BRICK[2], 255))
    elif kind == "gears2":
        gear_shape(d, 5, 12, 4, 5, (*STEEL[2], 255), (0, 0, 0, 0))
        gear_shape(d, 11, 11, 4, 6, (*BRASS[2], 255), (0, 0, 0, 0))
    else:  # vent
        d.rectangle([4, 12, 11, 15], fill=(*STEEL[1], 255))
        for x in (5, 7, 9):
            d.line([(x, 13), (x, 14)], fill=(*STEEL[0], 255))
        d.point((8, 9), fill=(200, 210, 230, 160))
        d.point((7, 7), fill=(200, 210, 230, 110))
    return outline(im)


def build_tiles() -> None:
    rng = np.random.default_rng(32)
    atlas = Image.new("RGBA", (T * 8, T * 4), (0, 0, 0, 0))

    def put(cx, cy, im):
        atlas.alpha_composite(im, (cx * T, cy * T))

    put(0, 0, brass_top(brick_tile(rng)))
    put(1, 0, brass_top(brick_tile(rng)))
    put(2, 0, brass_top(side(brick_tile(rng), left=True), left=True))
    put(3, 0, brass_top(side(brick_tile(rng), right=True), right=True))
    for i, k in enumerate(("left", "mid", "right", "single")):
        put(4 + i, 0, girder(k))
    put(0, 1, brick_tile(rng))
    put(1, 1, brick_tile(rng))
    put(2, 1, side(brick_tile(rng), left=True))
    put(3, 1, side(brick_tile(rng), right=True))
    put(4, 1, brick_tile(rng))
    put(5, 1, brick_tile(rng))
    put(6, 1, brick_tile(rng, deep=True))
    put(7, 1, brick_tile(rng, deep=True))
    put(0, 2, bottom(brick_tile(rng)))
    put(1, 2, bottom(brick_tile(rng)))
    put(2, 2, bottom(brick_tile(rng), left=True))
    put(3, 2, bottom(brick_tile(rng), right=True))
    put(4, 2, plate(rng))
    put(5, 2, plate(rng))
    put(6, 2, plate(rng, trim=True))
    put(7, 2, brass_top(side(side(brick_tile(rng), left=True), right=True), left=True, right=True))
    for i, k in enumerate(("gear", "bolt", "pipe", "hand", "crystal", "rubble", "gears2", "vent")):
        put(i, 3, decor(k, rng))
    atlas.save(OUT / "tiles.png", optimize=True)


# ------------------------------------------------------------ backgrounds ---
def gradient(top, bottom_c, h=H, w=W) -> Image.Image:
    t = np.linspace(0, 1, h)[:, None]
    col = (np.array(top)[None, :] * (1 - t) + np.array(bottom_c)[None, :] * t)
    img = np.zeros((h, w, 4), np.uint8)
    img[..., :3] = col[:, None, :].astype(np.uint8)
    img[..., 3] = 255
    return Image.fromarray(img, "RGBA")


def clock_face(d: ImageDraw.ImageDraw, cx, cy, r, rim, face, marks, broken=False):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rim)
    d.ellipse([cx - r * 0.86, cy - r * 0.86, cx + r * 0.86, cy + r * 0.86], fill=face)
    for i in range(12):
        a = i * math.tau / 12
        x0, y0 = cx + math.cos(a) * r * 0.7, cy + math.sin(a) * r * 0.7
        x1, y1 = cx + math.cos(a) * r * 0.8, cy + math.sin(a) * r * 0.8
        d.line([(x0, y0), (x1, y1)], fill=marks, width=2)
    d.line([(cx, cy), (cx + r * 0.1, cy - r * 0.55)], fill=marks, width=3)
    d.line([(cx, cy), (cx + r * 0.45, cy + r * 0.15)], fill=marks, width=2)
    if broken:
        d.polygon([(cx + r * 0.3, cy - r), (cx + r * 0.9, cy - r * 0.6), (cx + r, cy - r * 0.1),
                   (cx + r * 0.5, cy - r * 0.2)], fill=(0, 0, 0, 0))


def build_backgrounds() -> None:
    rng = np.random.default_rng(66)
    sky = gradient((26, 24, 66), (118, 90, 156))
    d = ImageDraw.Draw(sky)
    for _ in range(90):
        x, y = rng.uniform(0, W), rng.uniform(0, H * 0.6)
        d.point((x, y), fill=(200, 210, 255, int(rng.uniform(90, 230))))
    # giant broken clock in the sky (like a moon)
    clock_face(d, 470, 110, 70, (150, 120, 70, 255), (40, 60, 120, 255), (190, 210, 255, 255))
    d.polygon([(500, 40), (545, 70), (536, 98), (510, 80)], fill=(30, 26, 62, 255))
    sky.save(OUT / "bg_sky.png", optimize=True)

    far = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(far)
    base = 320
    x = 0
    while x < W:
        w = int(rng.integers(26, 54))
        h = int(rng.integers(70, 170))
        col = (66, 60, 112, 255)
        d.rectangle([x, base - h, x + w, base + 40], fill=col)
        if rng.random() < 0.45:  # clock tower top
            d.polygon([(x - 2, base - h), (x + w // 2, base - h - 26), (x + w + 2, base - h)], fill=col)
            r = w * 0.32
            d.ellipse([x + w / 2 - r, base - h + 8, x + w / 2 + r, base - h + 8 + 2 * r], fill=(120, 140, 200, 255))
        for wy in range(base - h + 30, base, 16):
            for wx in range(x + 5, x + w - 4, 9):
                if rng.random() < 0.3:
                    d.rectangle([wx, wy, wx + 3, wy + 5], fill=(110, 150, 240, 255))
        x += w + int(rng.integers(4, 18))
    # floating gears
    for (gx, gy, gr) in ((90, 90, 22), (250, 60, 14), (600, 170, 18)):
        gear_shape(d, gx, gy, gr, 10, (92, 84, 140, 255), (0, 0, 0, 0), (76, 70, 124, 255))
    far.save(OUT / "bg_far.png", optimize=True)

    mid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(mid)
    base = 330
    x = 0
    while x < W:
        w = int(rng.integers(50, 90))
        h = int(rng.integers(60, 120))
        col = (46, 42, 80, 255)
        d.rectangle([x, base - h, x + w, base + 40], fill=col)
        # arches
        for ax in range(x + 6, x + w - 14, 20):
            d.rectangle([ax, base - h + 20, ax + 12, base - h + 44], fill=(32, 28, 58, 255))
            d.ellipse([ax, base - h + 14, ax + 12, base - h + 26], fill=(32, 28, 58, 255))
            if rng.random() < 0.5:
                d.rectangle([ax + 3, base - h + 28, ax + 9, base - h + 40], fill=(90, 130, 230, 255))
        x += w + int(rng.integers(10, 40))
    for (gx, gy, gr) in ((140, 250, 40), (430, 230, 54)):
        gear_shape(d, gx, gy, gr, 12, (70, 62, 110, 255), (46, 42, 80, 255), (60, 54, 98, 255))
    mid.save(OUT / "bg_mid.png", optimize=True)

    near = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(near)
    base = 344
    d.rectangle([0, base - 6, W, base - 3], fill=(26, 22, 44, 255))
    for x in range(0, W, 22):
        d.rectangle([x, base - 30, x + 2, base], fill=(26, 22, 44, 255))
        d.ellipse([x - 3, base - 34, x + 5, base - 26], fill=(26, 22, 44, 255))
    for (px, ph) in ((60, 150), (330, 190), (520, 130)):
        d.rectangle([px, base - ph, px + 10, base], fill=(22, 18, 38, 255))
        d.rectangle([px - 6, base - ph, px + 16, base - ph + 6], fill=(22, 18, 38, 255))
        clock_face(d, px + 5, base - ph - 14, 14, (24, 20, 40, 255), (60, 80, 150, 255), (150, 180, 240, 255))
    near.save(OUT / "bg_near.png", optimize=True)

    fg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(fg)
    for (cx, length) in ((40, 70), (200, 44), (380, 90), (560, 56)):
        for y in range(0, length, 6):
            d.ellipse([cx - 2, y, cx + 2, y + 6], outline=(16, 14, 30, 255))
        gear_shape(d, cx, length + 8, 9, 8, (16, 14, 30, 255), (0, 0, 0, 0))
    fg.save(OUT / "fg_chains.png", optimize=True)


# ------------------------------------------------------------ props etc. ---
def build_props() -> None:
    # boss hall gate (same size as the forest one: 32x224)
    im = Image.new("RGBA", (32, 224), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for x in range(3, 32, 7):
        d.rectangle([x, 0, x + 2, 223], fill=(*STEEL[1], 255))
        d.line([(x, 0), (x, 223)], fill=(*STEEL[3], 255))
    for y in range(10, 224, 26):
        d.rectangle([0, y, 31, y + 3], fill=(*BRASS[1], 255))
        d.line([(0, y), (31, y)], fill=(*BRASS[3], 255))
    for x in range(3, 32, 7):
        d.polygon([(x - 1, 223), (x + 1, 216), (x + 3, 223)], fill=(*STEEL[3], 255))
    outline(im).save(OUT / "arena_wall.png", optimize=True)

    for name, r, teeth, col, inner in (("gear_big", 26, 12, BRASS[1], BRASS[0]), ("gear_small", 13, 8, STEEL[2], STEEL[1])):
        im = Image.new("RGBA", (r * 2 + 4, r * 2 + 4), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        gear_shape(d, r + 2, r + 2, r, teeth, (*col, 255), (0, 0, 0, 0), (*inner, 255))
        outline(im).save(OUT / f"{name}.png", optimize=True)

    im = Image.new("RGBA", (24, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([10, 18, 13, 63], fill=(*STEEL[1], 255))
    d.rectangle([7, 58, 16, 63], fill=(*STEEL[2], 255))
    clock_face(d, 12, 11, 10, (*BRASS[1], 255), (30, 50, 110, 255), (*GLOW[2], 255))
    outline(im).save(OUT / "clock_pole.png", optimize=True)

    im = Image.new("RGBA", (40, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 10, 39, 18], fill=(*BRASS[0], 255))
    d.rectangle([0, 10, 39, 11], fill=(*BRASS[2], 255))
    d.rectangle([26, 2, 32, 10], fill=(*BRASS[1], 255))
    d.rectangle([24, 0, 34, 3], fill=(*BRASS[2], 255))
    outline(im).save(OUT / "pipe.png", optimize=True)

    # spinning saw gear hazard (rotated in game)
    im = Image.new("RGBA", (34, 34), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    gear_shape(d, 17, 17, 15, 10, (*STEEL[3], 255), (*STEEL[0], 255), (*STEEL[1], 255))
    for i in range(10):
        a = i * math.tau / 10
        d.line([(17 + math.cos(a) * 9, 17 + math.sin(a) * 9), (17 + math.cos(a) * 13, 17 + math.sin(a) * 13)],
               fill=(220, 90, 70, 255))
    outline(im).save(OUT / "saw_gear.png", optimize=True)

    # time core pedestal for the checkpoint already exists (forest); time
    # crystal checkpoint is reused.


# --------------------------------------------------------- gear sentinel ---
def build_gear_sentinel() -> None:
    out = ROOT / "assets" / "enemies" / "gear_sentinel"
    out.mkdir(parents=True, exist_ok=True)
    im = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    gear_shape(d, 20, 20, 18, 12, (*BRASS[1], 255), (0, 0, 0, 0), (*BRASS[0], 255))
    d.ellipse([7, 7, 33, 33], outline=(*BRASS[2], 255), width=1)
    for i in range(6):
        a = i * math.tau / 6
        d.point((20 + math.cos(a) * 14, 20 + math.sin(a) * 14), fill=(*BRASS[3], 255))
    d.ellipse([12, 12, 28, 28], fill=(0, 0, 0, 0))
    outline(im).save(out / "ring.png", optimize=True)
    for name, iris, glow in (("core", GLOW[1], GLOW[2]), ("core_charge", (240, 90, 80), (255, 210, 170))):
        im = Image.new("RGBA", (18, 18), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.ellipse([1, 1, 16, 16], fill=(*STEEL[0], 255))
        d.ellipse([3, 3, 14, 14], fill=(*STEEL[2], 255))
        d.ellipse([5, 5, 12, 12], fill=(*iris, 255))
        d.ellipse([7, 6, 9, 8], fill=(*glow, 255))
        outline(im).save(out / f"{name}.png", optimize=True)
    im = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    gear_shape(d, 6, 6, 5, 6, (*GLOW[1], 255), (0, 0, 0, 0), (*GLOW[0], 255))
    outline(im, (10, 20, 60, 255)).save(out / "shard.png", optimize=True)


# -------------------------------------------------------- clockwork slime ---
def recolor_slime() -> None:
    """Bronze clockwork slime: hue-shift of the forest slime atlases."""
    for src_dir, name in (("forest_slime", "slime"), ("forest_slime_small", "slime_small")):
        src = ROOT / "assets" / "enemies" / src_dir
        dst = ROOT / "assets" / "enemies" / ("clockwork_" + name)
        dst.mkdir(parents=True, exist_ok=True)
        img = Image.open(src / f"{name}_atlas.png").convert("RGBA")
        a = np.asarray(img).copy()
        rgb = Image.fromarray(a[..., :3]).convert("HSV")
        hsv = np.asarray(rgb).astype(np.float32)
        h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        green = (h > 40) & (h < 120) & (s > 50)
        # body green -> bronze, glow highlights -> blue
        bright = green & (v > 200)
        h2 = np.where(bright, 150.0, np.where(green, 22.0, h))
        s2 = np.where(green, np.clip(s * 0.85, 0, 255), s)
        v2 = np.where(green & ~bright, np.clip(v * 0.92, 0, 255), v)
        out = np.stack([h2, s2, v2], axis=2).astype(np.uint8)
        rgb2 = np.asarray(Image.fromarray(out, "HSV").convert("RGB"))
        a[..., :3] = np.where(a[..., 3:4] > 0, rgb2, a[..., :3])
        Image.fromarray(a, "RGBA").save(dst / f"clockwork_{name}_atlas.png", optimize=True)
        meta = json.loads((src / f"{name}_sprites.json").read_text())
        meta["name"] = "clockwork_" + name
        meta["atlas"] = meta["atlas"].replace(f"{src_dir}/{name}_atlas", f"clockwork_{name}/clockwork_{name}_atlas")
        (dst / f"clockwork_{name}_sprites.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


def build_item_icons() -> None:
    items = ROOT / "assets" / "ui" / "items"
    im = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    gear_shape(d, 12, 12, 10, 8, (*BRASS[1], 255), (0, 0, 0, 0), (*BRASS[0], 255))
    d.ellipse([9, 9, 15, 15], fill=(0, 0, 0, 0))
    d.point((8, 6), fill=(*BRASS[3], 255))
    outline(im).save(items / "clock_cog.png", optimize=True)
    # Chronos' pocket watch: the sheet art, reduced to an icon
    src = Image.open(ROOT / "assets" / "bosses" / "chronos" / "art" / "pocket_watch.png").convert("RGBA")
    k = 22.0 / max(src.size)
    small = src.resize((max(1, round(src.width * k)), max(1, round(src.height * k))), Image.LANCZOS)
    a = np.asarray(small).copy()
    a[..., 3] = np.where(a[..., 3] > 110, 255, 0)
    icon = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    icon.alpha_composite(Image.fromarray(a, "RGBA"), ((24 - small.width) // 2, (24 - small.height) // 2))
    outline(icon).save(items / "chronos_watch.png", optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    build_item_icons()
    build_tiles()
    build_backgrounds()
    build_props()
    build_gear_sentinel()
    recolor_slime()
    print("clock city art ->", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
