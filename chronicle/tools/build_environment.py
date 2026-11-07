#!/usr/bin/env python3
"""Procedural pixel art for things the reference sheets do not contain.

The six reference images only show characters, monsters and effects. The
Phase 1 stage still needs ground tiles, a parallax forest, an arena wall and
UI icons, so they are generated here from the reference palettes (slime lime
glow, Verdan bark/moss/emerald, hero navy/blue/gold). This is placeholder art
meant to be replaced or painted over in the graphics pass (Phase 4).

Outputs
  assets/environments/forgotten_forest/tiles.png          16px tile atlas (8x4)
  assets/environments/forgotten_forest/bg_{sky,far,mid,near}.png  640x360 layers
  assets/environments/forgotten_forest/fg_vines.png       foreground overlay
  assets/environments/forgotten_forest/arena_wall.png     boss arena gate
  assets/environments/forgotten_forest/{sign,heal_orb,firefly,pedestal}.png
  assets/ui/icons/*.png                                   touch button icons
  assets/ui/app_icon_{192,512}.png, icon.png              launcher icon

Usage: python3 tools/build_environment.py   (after build_sprites.py)
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / "assets" / "environments" / "forgotten_forest"
ICONS = ROOT / "assets" / "ui" / "icons"
UI = ROOT / "assets" / "ui"

T = 16  # tile size

DIRT = np.array([(30, 21, 26), (44, 31, 34), (60, 43, 42), (80, 58, 50)], np.uint8)
GRASS = np.array([(16, 50, 34), (28, 82, 44), (48, 124, 56), (98, 180, 70), (170, 238, 106)], np.uint8)
STONE = np.array([(40, 46, 56), (60, 68, 78), (86, 96, 104), (122, 132, 134)], np.uint8)
ROOTC = np.array([(50, 35, 27), (78, 56, 39), (104, 76, 52)], np.uint8)
WOOD = np.array([(46, 30, 24), (74, 50, 34), (104, 72, 46), (136, 98, 62)], np.uint8)
OUTLINE = np.array((14, 12, 20), np.uint8)


def value_noise(w: int, h: int, cell: int, rng, wrap: bool = True) -> np.ndarray:
    """Smooth value noise in [0,1], periodic in both axes when wrap=True."""
    gw, gh = max(1, w // cell), max(1, h // cell)
    grid = rng.random((gh + 1, gw + 1))
    if wrap:
        grid[-1, :] = grid[0, :]
        grid[:, -1] = grid[:, 0]
    ys = np.linspace(0, gh, h, endpoint=False)
    xs = np.linspace(0, gw, w, endpoint=False)
    y0, x0 = ys.astype(int), xs.astype(int)
    fy, fx = ys - y0, xs - x0
    fy = fy * fy * (3 - 2 * fy)
    fx = fx * fx * (3 - 2 * fx)
    a = grid[y0][:, x0]
    b = grid[y0][:, x0 + 1]
    c = grid[y0 + 1][:, x0]
    d = grid[y0 + 1][:, x0 + 1]
    top = a + (b - a) * fx[None, :]
    bot = c + (d - c) * fx[None, :]
    return top + (bot - top) * fy[:, None]


def fbm(w, h, rng, cells=(8, 4, 2), weights=(0.6, 0.3, 0.1)):
    n = sum(wt * value_noise(w, h, c, rng) for c, wt in zip(cells, weights))
    return (n - n.min()) / max(1e-6, n.max() - n.min())


def rgba(h, w):
    return np.zeros((h, w, 4), np.uint8)


def put(img, x, y, col, a=255):
    h, w = img.shape[:2]
    if 0 <= x < w and 0 <= y < h:
        img[y, x, :3] = col
        img[y, x, 3] = a


# ---------------------------------------------------------------- tiles ---
def dirt_tile(rng, deep=False) -> np.ndarray:
    t = rgba(T, T)
    n = fbm(T, T, rng, cells=(8, 4), weights=(0.7, 0.3))
    pal = DIRT[[0, 0, 1, 2]] if deep else DIRT
    idx = np.clip((n * 3.6).astype(int), 0, 3)
    t[..., :3] = pal[idx]
    t[..., 3] = 255
    for _ in range(rng.integers(1, 3)):  # pebbles
        px, py = rng.integers(1, T - 3), rng.integers(2, T - 2)
        for dx, dy, c in ((0, 0, 1), (1, 0, 1), (2, 0, 1), (0, 1, 1), (1, 1, 1), (2, 1, 0)):
            put(t, (px + dx) % T, py + dy, STONE[c])
        put(t, px, py, STONE[2 if deep else 3])
    if rng.random() < 0.35 and not deep:  # thin root
        x = rng.integers(2, T - 2)
        for y in range(rng.integers(0, 6), T):
            x = (x + rng.integers(-1, 2)) % T
            put(t, x, y, ROOTC[0 if y % 3 else 1])
    return t


def add_grass_top(t: np.ndarray, rng, left=False, right=False) -> np.ndarray:
    depth = 5 + np.round(1.2 * np.sin(np.arange(T) / T * 2 * math.pi * 2 + rng.random() * 6)).astype(int)
    n = value_noise(T, 8, 4, rng)
    for x in range(T):
        d = depth[x] + (1 if rng.random() < 0.18 else 0)
        for y in range(d + 1):
            if y == 0:
                c = GRASS[4] if rng.random() < 0.12 else GRASS[3]
            elif y >= d:
                c = GRASS[0]
            else:
                c = GRASS[2] if n[min(y, 7), x] > 0.45 else GRASS[1]
            put(t, x, y, c)
        if rng.random() < 0.22:  # drip
            for y in range(d + 1, d + 1 + rng.integers(1, 3)):
                put(t, x, y, GRASS[0])
    if left:
        for y in range(T):
            put(t, 0, y, OUTLINE)
            put(t, 1, y, DIRT[0] if y > 6 else GRASS[0])
        t[0, 0, 3] = 0
        t[0, 1] = (*GRASS[2], 255)
    if right:
        for y in range(T):
            put(t, T - 1, y, OUTLINE)
            put(t, T - 2, y, DIRT[0] if y > 6 else GRASS[0])
        t[0, T - 1, 3] = 0
    return t


def side_edge(t, left=False, right=False):
    for y in range(T):
        if left:
            put(t, 0, y, OUTLINE)
            put(t, 1, y, DIRT[0])
        if right:
            put(t, T - 1, y, OUTLINE)
            put(t, T - 2, y, DIRT[0])
    return t


def bottom_edge(t, rng, left=False, right=False):
    for x in range(T):
        put(t, x, T - 1, OUTLINE)
        put(t, x, T - 2, DIRT[0])
    for _ in range(rng.integers(1, 3)):  # hanging root nubs (stay inside tile)
        x = rng.integers(2, T - 2)
        for y in range(T - 6, T - 1):
            put(t, x, y, ROOTC[1])
    side_edge(t, left, right)
    if left:
        t[T - 1, 0, 3] = 0
    if right:
        t[T - 1, T - 1, 3] = 0
    return t


def platform_tile(rng, kind: str) -> np.ndarray:
    """One-way ledge: mossy wooden plank, 7 px tall at the top of the tile."""
    t = rgba(T, T)
    for y in range(7):
        for x in range(T):
            c = WOOD[2] if y in (1, 2) else WOOD[1]
            if y == 6:
                c = OUTLINE
            if x % 8 == 7 and 1 <= y <= 5:
                c = WOOD[0]
            put(t, x, y, c)
    for x in range(T):  # moss on top
        put(t, x, 0, GRASS[3] if rng.random() < 0.7 else GRASS[2])
        if rng.random() < 0.3:
            put(t, x, 1, GRASS[1])
    if kind in ("left", "single"):
        for y in range(7):
            put(t, 0, y, OUTLINE)
        t[0, 0, 3] = 0
        t[6, 0, 3] = 0
    if kind in ("right", "single"):
        for y in range(7):
            put(t, T - 1, y, OUTLINE)
        t[0, T - 1, 3] = 0
        t[6, T - 1, 3] = 0
    # little supports
    if kind in ("left", "single"):
        for y in range(7, 11):
            put(t, 3, y, WOOD[0])
    if kind in ("right", "single"):
        for y in range(7, 11):
            put(t, T - 4, y, WOOD[0])
    return t


def stone_tile(rng, mossy=False) -> np.ndarray:
    t = rgba(T, T)
    n = fbm(T, T, rng, cells=(8, 4), weights=(0.6, 0.4))
    t[..., :3] = STONE[np.clip((n * 2.5 + 0.6).astype(int), 0, 3)]
    t[..., 3] = 255
    for x in range(T):
        put(t, x, 0, STONE[3])
        put(t, x, T - 1, STONE[0])
        put(t, x, 8, STONE[0])
    for y in range(T):
        put(t, 0 if y < 8 else 8, y, STONE[0])
    if mossy:
        for x in range(T):
            for y in range(rng.integers(1, 4)):
                put(t, x, y, GRASS[2] if y == 0 else GRASS[1])
    return t


def deco_tile(kind: str, rng) -> np.ndarray:
    """Decorations drawn on the bottom of the cell above a grass tile."""
    t = rgba(T, T)
    if kind == "tuft":
        for x0 in (3, 6, 9, 12):
            h = rng.integers(3, 7)
            for y in range(h):
                put(t, x0 + (1 if y > h - 3 and x0 > 8 else 0), T - 1 - y, GRASS[3] if y > h - 2 else GRASS[2])
    elif kind == "flowers":
        for x0 in (4, 10):
            for y in range(4):
                put(t, x0, T - 1 - y, GRASS[1])
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                put(t, x0 + dx, T - 6 + dy, (232, 214, 120))
            put(t, x0, T - 6, (255, 246, 196))
    elif kind == "mushroom":
        cap = (196, 120, 60)
        for x in range(5, 11):
            put(t, x, T - 6, cap)
        for x in range(6, 10):
            put(t, x, T - 7, cap)
        put(t, 7, T - 7, (240, 196, 120))
        for y in range(T - 5, T):
            put(t, 7, y, (220, 210, 190))
            put(t, 8, y, (190, 178, 160))
        for x in range(5, 11):
            put(t, x, T - 5, OUTLINE)
    elif kind == "glowplant":
        for y in range(7):
            put(t, 8, T - 1 - y, GRASS[1])
        for (x, y) in ((6, T - 8), (10, T - 9), (8, T - 10), (7, T - 6), (9, T - 7)):
            put(t, x, y, GRASS[4])
            put(t, x, y - 1, (220, 255, 170))
    elif kind == "rock":
        for y in range(T - 5, T):
            for x in range(4, 12):
                if (x - 8) ** 2 / 16 + (y - T + 1) ** 2 / 20 <= 1.05:
                    put(t, x, y, STONE[2] if y < T - 3 and x < 8 else STONE[1])
        put(t, 6, T - 4, STONE[3])
    elif kind == "crystal":
        em = [(20, 90, 60), (40, 170, 110), (120, 240, 180)]
        for y in range(8):
            w = max(0, 2 - abs(y - 4) // 2)
            for x in range(8 - w, 9 + w):
                put(t, x, T - 1 - y, em[1] if x <= 8 else em[0])
        put(t, 7, T - 5, em[2])
    elif kind == "blades":
        for x in range(0, T, 2):
            h = rng.integers(1, 4)
            for y in range(h):
                put(t, x + (x // 2) % 2 * 0, T - 1 - y, GRASS[3] if y == h - 1 else GRASS[2])
    return t


def build_tiles() -> None:
    rng = np.random.default_rng(1101)
    atlas = rgba(T * 4, T * 8)

    def place(col, row, tile):
        atlas[row * T:(row + 1) * T, col * T:(col + 1) * T] = tile

    # row 0: grass tops + one-way platform pieces
    place(0, 0, add_grass_top(dirt_tile(rng), rng))
    place(1, 0, add_grass_top(dirt_tile(rng), rng))
    place(2, 0, add_grass_top(side_edge(dirt_tile(rng), left=True), rng, left=True))
    place(3, 0, add_grass_top(side_edge(dirt_tile(rng), right=True), rng, right=True))
    place(4, 0, platform_tile(rng, "left"))
    place(5, 0, platform_tile(rng, "mid"))
    place(6, 0, platform_tile(rng, "right"))
    place(7, 0, platform_tile(rng, "single"))
    # row 1: dirt fill, edges, deep dirt
    place(0, 1, dirt_tile(rng))
    place(1, 1, dirt_tile(rng))
    place(2, 1, side_edge(dirt_tile(rng), left=True))
    place(3, 1, side_edge(dirt_tile(rng), right=True))
    place(4, 1, dirt_tile(rng))
    place(5, 1, dirt_tile(rng))
    place(6, 1, dirt_tile(rng, deep=True))
    place(7, 1, dirt_tile(rng, deep=True))
    # row 2: bottoms + stone
    place(0, 2, bottom_edge(dirt_tile(rng), rng))
    place(1, 2, bottom_edge(dirt_tile(rng), rng))
    place(2, 2, bottom_edge(dirt_tile(rng), rng, left=True))
    place(3, 2, bottom_edge(dirt_tile(rng), rng, right=True))
    place(4, 2, stone_tile(rng))
    place(5, 2, stone_tile(rng))
    place(6, 2, stone_tile(rng, mossy=True))
    place(7, 2, add_grass_top(side_edge(side_edge(dirt_tile(rng), left=True), right=True), rng,
                              left=True, right=True))
    # row 3: decorations (no collision)
    for i, k in enumerate(("tuft", "flowers", "mushroom", "glowplant", "rock", "crystal", "blades", "tuft")):
        place(i, 3, deco_tile(k, rng))
    Image.fromarray(atlas, "RGBA").save(ENV / "tiles.png")


# ----------------------------------------------------------- backgrounds ---
W, H = 640, 360


def gradient(top, bottom, h=H, w=W):
    t = np.linspace(0, 1, h)[:, None]
    col = (np.array(top)[None, :] * (1 - t) + np.array(bottom)[None, :] * t)
    img = np.zeros((h, w, 4), np.uint8)
    img[..., :3] = col[:, None, :].astype(np.uint8)
    img[..., 3] = 255
    return img


def dither_alpha(a: np.ndarray, rng) -> np.ndarray:
    """Pixel-art friendly alpha: ordered 4x4 Bayer dither to 0/255."""
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
    h, w = a.shape
    thr = np.tile(bayer, (h // 4 + 1, w // 4 + 1))[:h, :w]
    return ((a / 255.0) > thr).astype(np.uint8) * 255


def blob_canopy(draw: ImageDraw.ImageDraw, cx, cy, r, fill, rng, wrap_w=W):
    for _ in range(int(r * 0.9)):
        ang = rng.random() * math.tau
        dist = rng.random() ** 0.6 * r
        x, y = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist * 0.7
        rr = rng.integers(max(3, r // 5), max(4, r // 2.5))
        for ox in (-wrap_w, 0, wrap_w):
            draw.ellipse([x - rr + ox, y - rr, x + rr + ox, y + rr], fill=fill)


def tree_layer(rng, count, trunk_w, base_y, top_y, canopy_r, cols, rim=None, roots=False):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    xs = np.linspace(0, W, count, endpoint=False) + rng.uniform(-W / count * 0.35, W / count * 0.35, count)
    for x in xs:
        tw = trunk_w * rng.uniform(0.7, 1.3)
        ty = top_y + rng.uniform(-20, 30)
        lean = rng.uniform(-10, 10)
        pts = [(x - tw / 2, base_y), (x + tw / 2, base_y), (x + tw * 0.32 + lean, ty), (x - tw * 0.32 + lean, ty)]
        for ox in (-W, 0, W):
            d.polygon([(px + ox, py) for px, py in pts], fill=cols[0])
            if rim:
                d.line([(x - tw / 2 + ox + 1, base_y), (x - tw * 0.32 + lean + ox + 1, ty)], fill=rim, width=1)
            if roots:
                for s in (-1, 1):
                    d.polygon([(x + ox + s * tw * 0.3, base_y - 18), (x + ox + s * tw * 1.4, base_y),
                               (x + ox + s * tw * 0.2, base_y)], fill=cols[0])
        blob_canopy(d, x + lean, ty, canopy_r * rng.uniform(0.8, 1.2), cols[1], rng)
        blob_canopy(d, x + lean - canopy_r * 0.2, ty - canopy_r * 0.25, canopy_r * 0.6, cols[2], rng)
    return img


def build_backgrounds() -> None:
    rng = np.random.default_rng(2024)
    # sky: teal dusk + light shafts + distant floating islands
    sky = gradient((10, 26, 36), (58, 104, 98))
    shafts = np.zeros((H, W), np.float32)
    for sx in rng.uniform(0, W, 5):
        wdt = rng.uniform(18, 46)
        for y in range(H):
            x0 = sx + y * 0.45
            for ox in (-W, 0, W):
                a, b = int(x0 - wdt / 2 + ox), int(x0 + wdt / 2 + ox)
                a, b = max(0, a), min(W, b)
                if a < b:
                    shafts[y, a:b] = np.maximum(shafts[y, a:b], 0.10 * (1 - y / H))
    sky[..., :3] = np.clip(sky[..., :3] + (shafts[..., None] * np.array([150, 220, 190])), 0, 255).astype(np.uint8)
    skyimg = Image.fromarray(sky, "RGBA")
    d = ImageDraw.Draw(skyimg)
    for (ix, iy, iw) in ((90, 120, 70), (330, 80, 46), (520, 140, 90), (250, 170, 30)):
        col = (34, 64, 70, 255)
        d.ellipse([ix - iw / 2, iy - 6, ix + iw / 2, iy + 6], fill=col)
        d.polygon([(ix - iw / 2, iy), (ix + iw / 2, iy), (ix + iw * 0.1, iy + iw * 0.55), (ix - iw * 0.15, iy + iw * 0.45)], fill=col)
        blob_canopy(d, ix, iy - 6, iw * 0.28, (30, 70, 64, 255), rng)
        for k in range(3):  # hanging roots
            rx = ix + rng.uniform(-iw * 0.25, iw * 0.25)
            d.line([(rx, iy + 4), (rx + rng.uniform(-3, 3), iy + iw * 0.5 + rng.uniform(0, 14))], fill=col, width=1)
    for _ in range(40):  # faint motes
        x, y = rng.integers(0, W), rng.integers(0, int(H * 0.7))
        skyimg.putpixel((int(x), int(y)), (150, 220, 190, 255))
    skyimg.save(ENV / "bg_sky.png")

    far = tree_layer(rng, 11, 14, H, 120, 34, [(30, 62, 66, 255), (34, 72, 70, 255), (40, 82, 76, 255)])
    fa = np.asarray(far).copy()
    fog = np.linspace(0, 1, H)[:, None] ** 2  # fog brightens the base
    fa[..., :3] = np.clip(fa[..., :3] + fog[..., None] * 40, 0, 255).astype(np.uint8)
    Image.fromarray(fa, "RGBA").save(ENV / "bg_far.png")

    mid = tree_layer(rng, 6, 26, H, 70, 52, [(22, 40, 40, 255), (24, 52, 44, 255), (30, 64, 50, 255)],
                     rim=(46, 86, 66, 255), roots=True)
    md = ImageDraw.Draw(mid)
    for _ in range(26):  # glowing mushrooms / motes on the mid layer
        x, y = rng.integers(0, W), rng.integers(int(H * 0.55), H - 4)
        md.rectangle([x, y, x + 1, y + 1], fill=(150, 236, 100, 255))
    mid.save(ENV / "bg_mid.png")

    # near: dark bush band along the bottom
    near = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    nd = ImageDraw.Draw(near)
    for x in np.arange(0, W, 22):
        blob_canopy(nd, x + rng.uniform(-6, 6), H - 34 + rng.uniform(-10, 8), 26, (14, 32, 28, 255), rng)
        blob_canopy(nd, x + rng.uniform(-6, 6), H - 40 + rng.uniform(-10, 8), 14, (20, 44, 34, 255), rng)
    nd.rectangle([0, H - 26, W, H], fill=(14, 32, 28, 255))
    near.save(ENV / "bg_near.png")

    # foreground: hanging vines/leaves at the top edge (drawn in front)
    fg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(fg)
    for x in rng.uniform(0, W, 9):
        length = rng.uniform(30, 90)
        for ox in (-W, 0, W):
            gd.line([(x + ox, 0), (x + ox + rng.uniform(-6, 6), length)], fill=(10, 24, 20, 255), width=2)
        for k in range(int(length // 9)):
            ly = k * 9 + rng.uniform(0, 4)
            for ox in (-W, 0, W):
                gd.ellipse([x + ox - 4, ly, x + ox + 3, ly + 4], fill=(12, 30, 24, 255))
    blob_canopy(gd, W * 0.2, -10, 40, (10, 24, 20, 255), rng)
    blob_canopy(gd, W * 0.75, -14, 50, (10, 24, 20, 255), rng)
    fg.save(ENV / "fg_vines.png")


# ---------------------------------------------------------------- props ---
def build_props() -> None:
    rng = np.random.default_rng(77)
    # arena gate: wall of twisted roots, 32x224
    wall = Image.new("RGBA", (32, 224), (0, 0, 0, 0))
    d = ImageDraw.Draw(wall)
    for k in range(5):
        x = 6 + k * 5
        pts = [(x + 4 * math.sin(y / 14 + k), y) for y in range(0, 225, 4)]
        d.line(pts, fill=tuple(ROOTC[k % 2]) + (255,), width=5)
        d.line([(px - 1, py) for px, py in pts], fill=tuple(ROOTC[2]) + (255,), width=1)
    for _ in range(40):
        x, y = rng.integers(2, 30), rng.integers(0, 220)
        d.ellipse([x - 3, y - 2, x + 3, y + 2], fill=tuple(GRASS[rng.integers(1, 4)]) + (255,))
    for _ in range(10):
        x, y = rng.integers(4, 28), rng.integers(0, 220)
        d.rectangle([x, y, x + 1, y + 1], fill=(170, 240, 110, 255))
    a = np.asarray(wall).copy()
    op = a[..., 3] > 0
    nb = np.zeros_like(op)
    nb[1:] |= op[:-1]; nb[:-1] |= op[1:]; nb[:, 1:] |= op[:, :-1]; nb[:, :-1] |= op[:, 1:]
    a[nb & ~op] = (*OUTLINE, 255)
    Image.fromarray(a, "RGBA").save(ENV / "arena_wall.png")

    # wooden tutorial sign 24x24
    sign = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(sign)
    d.rectangle([10, 12, 13, 23], fill=tuple(WOOD[1]) + (255,), outline=tuple(OUTLINE) + (255,))
    d.rectangle([2, 3, 21, 13], fill=tuple(WOOD[2]) + (255,), outline=tuple(OUTLINE) + (255,))
    d.line([(4, 6), (19, 6)], fill=tuple(WOOD[3]) + (255,))
    d.line([(4, 9), (16, 9)], fill=tuple(WOOD[1]) + (255,))
    d.rectangle([3, 3, 20, 4], fill=tuple(GRASS[2]) + (255,))
    sign.save(ENV / "sign.png")

    # stone pedestal for the checkpoint crystal 28x14
    ped = Image.new("RGBA", (28, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(ped)
    d.polygon([(3, 2), (24, 2), (27, 13), (0, 13)], fill=tuple(STONE[1]) + (255,), outline=tuple(OUTLINE) + (255,))
    d.line([(4, 3), (23, 3)], fill=tuple(STONE[3]) + (255,))
    d.line([(6, 8), (20, 8)], fill=(80, 220, 160, 255))
    ped.save(ENV / "pedestal.png")

    # heal orb 10x10 and firefly 3x3
    orb = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(orb)
    d.ellipse([0, 0, 9, 9], fill=(60, 200, 90, 255), outline=(16, 60, 30, 255))
    d.ellipse([2, 2, 6, 6], fill=(150, 250, 140, 255))
    d.point((3, 3), fill=(255, 255, 255, 255))
    orb.save(ENV / "heal_orb.png")
    ff = Image.new("RGBA", (3, 3), (0, 0, 0, 0))
    for (x, y, c) in ((1, 0, 160), (0, 1, 160), (1, 1, 255), (2, 1, 160), (1, 2, 160)):
        ff.putpixel((x, y), (190, 255, 120, c))
    ff.save(ENV / "firefly.png")
    leaf = Image.new("RGBA", (4, 3), (0, 0, 0, 0))
    for (x, y) in ((1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (1, 2)):
        leaf.putpixel((x, y), tuple(GRASS[2]) + (255,))
    leaf.putpixel((2, 1), tuple(GRASS[3]) + (255,))
    leaf.save(ENV / "leaf.png")


# ---------------------------------------------------------------- icons ---
def icon_canvas(s=32):
    return Image.new("RGBA", (s, s), (0, 0, 0, 0))


def finish_icon(img: Image.Image, name: str) -> None:
    a = np.asarray(img).copy()
    op = a[..., 3] > 0
    nb = np.zeros_like(op)
    nb[1:] |= op[:-1]; nb[:-1] |= op[1:]; nb[:, 1:] |= op[:, :-1]; nb[:, :-1] |= op[:, 1:]
    a[nb & ~op] = (12, 14, 30, 255)
    Image.fromarray(a, "RGBA").save(ICONS / f"{name}.png")


def build_icons() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    W_ = (236, 242, 255, 255)
    B_ = (110, 170, 255, 255)
    G_ = (230, 196, 100, 255)
    # attack: diagonal sword
    im = icon_canvas(); d = ImageDraw.Draw(im)
    d.line([(8, 24), (25, 7)], fill=W_, width=3)
    d.line([(9, 23), (24, 8)], fill=B_, width=1)
    d.line([(6, 18), (14, 26)], fill=G_, width=3)
    d.line([(4, 28), (8, 24)], fill=(120, 80, 50, 255), width=3)
    finish_icon(im, "attack")
    # jump: double chevron
    im = icon_canvas(); d = ImageDraw.Draw(im)
    for y in (6, 15):
        d.line([(7, y + 9), (16, y), (25, y + 9)], fill=W_, width=3)
    finish_icon(im, "jump")
    # dodge: dash arrow with speed lines
    im = icon_canvas(); d = ImageDraw.Draw(im)
    d.polygon([(14, 9), (27, 16), (14, 23)], fill=W_)
    d.line([(10, 16), (16, 16)], fill=W_, width=3)
    for y, x0 in ((10, 3), (16, 2), (22, 3)):
        d.line([(x0, y), (x0 + 6, y)], fill=B_, width=2)
    finish_icon(im, "dodge")
    # skill: crescent wave
    im = icon_canvas(); d = ImageDraw.Draw(im)
    d.ellipse([5, 4, 27, 28], fill=B_)
    d.ellipse([1, 2, 21, 28], fill=(0, 0, 0, 0))
    d.arc([5, 4, 27, 28], 290, 70, fill=W_, width=2)
    finish_icon(im, "skill")
    # ultimate: eight-point star
    im = icon_canvas(); d = ImageDraw.Draw(im)
    pts = []
    for k in range(16):
        r = 13 if k % 2 == 0 else 5
        ang = -math.pi / 2 + k * math.pi / 8
        pts.append((16 + r * math.cos(ang), 16 + r * math.sin(ang)))
    d.polygon(pts, fill=G_)
    d.ellipse([12, 12, 20, 20], fill=W_)
    finish_icon(im, "ultimate")
    # pause
    im = icon_canvas(24); d = ImageDraw.Draw(im)
    d.rectangle([6, 5, 9, 18], fill=W_)
    d.rectangle([14, 5, 17, 18], fill=W_)
    finish_icon(im, "pause")


# ------------------------------------------------------------ item icons ---
ITEMS = ROOT / "assets" / "ui" / "items"


def _save_item(img: Image.Image, name: str) -> None:
    a = np.asarray(img).copy()
    op = a[..., 3] > 0
    nb = np.zeros_like(op)
    nb[1:] |= op[:-1]; nb[:-1] |= op[1:]; nb[:, 1:] |= op[:, :-1]; nb[:, :-1] |= op[:, 1:]
    a[nb & ~op] = (12, 12, 24, 255)
    Image.fromarray(a, "RGBA").save(ITEMS / f"{name}.png")


def build_item_icons() -> None:
    """24x24 inventory icons in the reference palettes (Phase 2)."""
    ITEMS.mkdir(parents=True, exist_ok=True)
    S = 24
    def canvas():
        im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        return im, ImageDraw.Draw(im)
    # potion (red) / ether (blue crystal)
    for name, body, hi in (("potion_small", (210, 50, 60, 255), (255, 150, 150, 255)),):
        im, d = canvas()
        d.rectangle([10, 3, 13, 6], fill=(150, 110, 70, 255))
        d.rectangle([9, 6, 14, 8], fill=(200, 210, 230, 255))
        d.ellipse([5, 8, 18, 21], fill=(200, 210, 230, 255))
        d.ellipse([6, 10, 17, 20], fill=body)
        d.rectangle([8, 12, 9, 15], fill=hi)
        _save_item(im, name)
    im, d = canvas()
    d.polygon([(12, 2), (19, 10), (12, 21), (5, 10)], fill=(60, 120, 230, 255))
    d.polygon([(12, 2), (12, 21), (5, 10)], fill=(110, 170, 255, 255))
    d.line([(9, 8), (11, 5)], fill=(230, 245, 255, 255))
    _save_item(im, "ether")
    # swords
    for name, blade, glow in (("sword_cheongwol", (200, 215, 240, 255), (90, 150, 255, 255)),
                              ("sword_forest", (190, 220, 170, 255), (120, 230, 90, 255))):
        im, d = canvas()
        d.line([(5, 19), (19, 5)], fill=blade, width=3)
        d.line([(6, 18), (18, 6)], fill=glow, width=1)
        d.line([(3, 15), (9, 21)], fill=(214, 176, 92, 255), width=2)
        d.line([(2, 22), (5, 19)], fill=(110, 75, 45, 255), width=2)
        _save_item(im, name)
    # cloak
    im, d = canvas()
    d.polygon([(8, 3), (16, 3), (21, 21), (3, 21)], fill=(40, 80, 190, 255))
    d.polygon([(10, 3), (14, 3), (15, 21), (9, 21)], fill=(70, 120, 230, 255))
    d.rectangle([8, 3, 16, 5], fill=(214, 176, 92, 255))
    _save_item(im, "cloak_traveler")
    # bark armour
    im, d = canvas()
    d.polygon([(5, 4), (19, 4), (20, 12), (17, 21), (7, 21), (4, 12)], fill=(96, 68, 44, 255))
    d.line([(12, 4), (12, 21)], fill=(70, 48, 32, 255))
    d.rectangle([9, 9, 15, 13], fill=(70, 200, 120, 255))
    d.line([(6, 6), (9, 9)], fill=(140, 200, 90, 255))
    _save_item(im, "armor_guardian")
    # ring
    im, d = canvas()
    d.ellipse([5, 8, 19, 22], outline=(214, 176, 92, 255), width=3)
    d.polygon([(12, 2), (16, 7), (12, 11), (8, 7)], fill=(80, 220, 170, 255))
    _save_item(im, "ring_time")
    # slime gel
    im, d = canvas()
    d.ellipse([4, 9, 20, 21], fill=(80, 200, 70, 255))
    d.ellipse([7, 11, 12, 15], fill=(170, 245, 120, 255))
    _save_item(im, "slime_gel")
    # vitality icon for the skill tree (32px like the button icons)
    im = icon_canvas(); d = ImageDraw.Draw(im)
    d.ellipse([5, 7, 16, 18], fill=(230, 80, 90, 255))
    d.ellipse([15, 7, 26, 18], fill=(230, 80, 90, 255))
    d.polygon([(5, 14), (26, 14), (16, 27)], fill=(230, 80, 90, 255))
    d.rectangle([9, 10, 11, 12], fill=(255, 190, 190, 255))
    finish_icon(im, "vitality")
    im = icon_canvas(24); d = ImageDraw.Draw(im)
    d.rectangle([10, 2, 13, 5], fill=(150, 110, 70, 255))
    d.ellipse([5, 6, 18, 20], fill=(210, 50, 60, 255))
    d.rectangle([8, 10, 9, 13], fill=(255, 150, 150, 255))
    finish_icon(im, "potion")


def build_app_icon() -> None:
    portrait = Image.open(ROOT / "assets/characters/hero/art/portrait_neutral.png").convert("RGBA")
    for size in (192, 512):
        k = 3 if size == 192 else 8
        bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(bg)
        r = size // 6
        d.rounded_rectangle([0, 0, size - 1, size - 1], r, fill=(16, 22, 52, 255))
        d.rounded_rectangle([size // 32, size // 32, size - 1 - size // 32, size - 1 - size // 32], r,
                            outline=(214, 176, 92, 255), width=max(2, size // 48))
        p = portrait.resize((portrait.width * k, portrait.height * k), Image.NEAREST)
        scale = min((size * 0.78) / p.width, (size * 0.78) / p.height, 1.0)
        if scale < 1.0:
            p = p.resize((int(p.width * scale), int(p.height * scale)), Image.NEAREST)
        bg.alpha_composite(p, ((size - p.width) // 2, (size - p.height) // 2))
        bg.save(UI / f"app_icon_{size}.png")
    Image.open(UI / "app_icon_192.png").save(ROOT / "icon.png")


def main() -> None:
    ENV.mkdir(parents=True, exist_ok=True)
    build_tiles()
    build_backgrounds()
    build_props()
    build_icons()
    build_item_icons()
    build_app_icon()
    print("environment art written to", ENV.relative_to(ROOT), "and", ICONS.relative_to(ROOT))


if __name__ == "__main__":
    main()
