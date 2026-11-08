#!/usr/bin/env python3
"""Pixel art for region 3 'Sky Ruins' (Phase 3-3).

None of the reference sheets shows this region or its boss, so:
  * the boss reuses the baby dragon design of sheet 05 at boss size
    (tools/sprite_defs.py, group "sky_dragon") and is recoloured here from
    fire to storm colours (stand-in until an official design exists);
  * the cloud slime is a recolour of the forest slime;
  * the wind wisp, the ruin guardian, tiles, sky layers and props are
    generated procedurally in a white marble / gold / sky blue palette.

Outputs
  assets/bosses/sky_dragon/*  (recoloured in place)   assets/effects/sky/*.png
  assets/enemies/cloud_slime*/  assets/enemies/wind_wisp/  assets/enemies/ruin_guardian/
  assets/environments/sky_ruins/{tiles,bg_*,fg_clouds,arena_wall,props...}.png
  assets/ui/items/{sky_feather,storm_armor}.png

Run after build_sprites.py:  python3 tools/build_sky_ruins.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from build_clock_city import gear_shape, outline

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "environments" / "sky_ruins"
T = 16
W, H = 640, 360
MARBLE = [(150, 156, 178), (190, 196, 214), (222, 226, 238), (246, 248, 252)]
MOSS = [(52, 110, 76), (86, 156, 92), (140, 206, 120)]
GOLD = [(150, 110, 40), (206, 164, 70), (246, 214, 120)]
SKYB = [(70, 130, 210), (120, 180, 240), (190, 226, 255)]
STONE = [(70, 72, 92), (100, 104, 124), (136, 140, 160), (176, 180, 196)]


def hsv_map(img: Image.Image, fn) -> Image.Image:
    a = np.asarray(img.convert("RGBA")).copy()
    hsv = np.asarray(Image.fromarray(a[..., :3]).convert("HSV")).astype(np.float32)
    h, s, v = fn(hsv[..., 0], hsv[..., 1], hsv[..., 2])
    out = np.stack([h, s, v], axis=2).clip(0, 255).astype(np.uint8)
    rgb = np.asarray(Image.fromarray(out, "HSV").convert("RGB"))
    a[..., :3] = np.where(a[..., 3:4] > 0, rgb, a[..., :3])
    return Image.fromarray(a, "RGBA")


def storm(h, s, v):
    """Fire -> storm: orange/red glow becomes electric cyan, the dark body
    turns slate blue."""
    fire = ((h < 32) | (h > 235)) & (s > 70)
    bright = fire & (v > 150)
    h2 = np.where(fire, 138.0, np.where(v < 90, 165.0, h))
    s2 = np.where(bright, s * 0.55, np.where(fire, s * 0.8, np.where(v < 90, np.maximum(s, 70), s)))
    v2 = np.where(bright, np.minimum(255, v * 1.08), np.where(v < 90, v * 1.1 + 6, v))
    return h2, s2, v2


def cloud(h, s, v):
    """Green slime -> white/sky blue cloud slime with a golden core."""
    green = (h > 40) & (h < 120) & (s > 50)
    bright = green & (v > 200)
    h2 = np.where(bright, 30.0, np.where(green, 145.0, h))
    s2 = np.where(bright, s * 0.7, np.where(green, s * 0.35, s))
    v2 = np.where(green & ~bright, np.minimum(255, v * 1.25 + 30), v)
    return h2, s2, v2


def recolor_assets() -> None:
    d = ROOT / "assets" / "bosses" / "sky_dragon"
    for p in [d / "sky_dragon_atlas.png", d / "art" / "full_art.png", d / "art" / "sky_dragon_art_atlas.png"]:
        if p.exists():
            hsv_map(Image.open(p), storm).save(p, optimize=True)
    fx = ROOT / "assets" / "effects" / "sky"
    fx.mkdir(parents=True, exist_ok=True)
    hsv_map(Image.open(ROOT / "assets" / "effects" / "pets" / "pet_fireball.png"), storm).save(fx / "storm_orb.png")
    for src_dir, name in (("forest_slime", "slime"), ("forest_slime_small", "slime_small")):
        src = ROOT / "assets" / "enemies" / src_dir
        dst = ROOT / "assets" / "enemies" / ("cloud_" + name)
        dst.mkdir(parents=True, exist_ok=True)
        hsv_map(Image.open(src / f"{name}_atlas.png"), cloud).save(dst / f"cloud_{name}_atlas.png", optimize=True)
        meta = json.loads((src / f"{name}_sprites.json").read_text())
        meta["name"] = "cloud_" + name
        meta["atlas"] = meta["atlas"].replace(f"{src_dir}/{name}_atlas", f"cloud_{name}/cloud_{name}_atlas")
        (dst / f"cloud_{name}_sprites.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


# ------------------------------------------------------- sprite sheets ---
def write_sheet(name: str, out_dir: Path, frames: dict[str, Image.Image], anchor: tuple[int, int],
                anims: dict[str, tuple[list[str], float, bool]]) -> None:
    """Atlas + JSON in the format of build_sprites.py (all frames one cell)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    cw = max(f.width for f in frames.values())
    ch = max(f.height for f in frames.values())
    atlas = Image.new("RGBA", (cw * len(frames), ch), (0, 0, 0, 0))
    meta = {"name": name, "kind": "character", "scale": 1.0,
            "atlas": "res://" + str((out_dir / f"{name}_atlas.png").relative_to(ROOT)).replace("\\", "/"),
            "cell": [cw, ch], "anchor": list(anchor), "frames": {}, "animations": {}}
    for i, (fname, img) in enumerate(frames.items()):
        atlas.alpha_composite(img, (i * cw, 0))
        meta["frames"][fname] = {"region": [i * cw, 0, img.width, img.height], "offset": [0, 0]}
    for a, (fl, fps, loop) in anims.items():
        meta["animations"][a] = {"frames": fl, "fps": fps, "loop": loop}
    atlas.save(out_dir / f"{name}_atlas.png", optimize=True)
    (out_dir / f"{name}_sprites.json").write_text(json.dumps(meta, indent=1))


def wisp_frame(phase: float, dash: bool = False, angry: bool = False) -> Image.Image:
    im = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = 20, 22
    for k in range(3):  # swirling tail
        a0 = phase + k * 2.1
        pts = []
        for i in range(10):
            a = a0 + i * 0.32
            r = 15 - i * 1.2
            pts.append((cx + math.cos(a) * r - (i * 1.2 if dash else 0), cy + math.sin(a) * r * 0.7))
        d.line(pts, fill=(*SKYB[1], 255), width=3)
        d.line(pts[:5], fill=(*SKYB[2], 255), width=1)
    d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=(230, 244, 255, 255))
    d.ellipse([cx - 7, cy - 8, cx + 5, cy + 4], fill=(250, 252, 255, 255))
    eye = (240, 90, 80, 255) if angry else (40, 80, 160, 255)
    d.rectangle([cx - 4, cy - 2, cx - 2, cy + 1], fill=eye)
    d.rectangle([cx + 2, cy - 2, cx + 4, cy + 1], fill=eye)
    return outline(im, (30, 60, 110, 255))


def build_wisp() -> None:
    frames = {f"spin{i}": wisp_frame(i * math.pi / 2) for i in range(4)}
    frames["charge"] = wisp_frame(0.3, angry=True)
    frames["dash"] = wisp_frame(0.0, dash=True, angry=True)
    write_sheet("wind_wisp", ROOT / "assets" / "enemies" / "wind_wisp", frames, (20, 22), {
        "idle": (["spin0", "spin1", "spin2", "spin3"], 10, True),
        "charge": (["charge", "spin1"], 12, True),
        "dash": (["dash"], 1, True),
        "hurt": (["charge"], 1, False),
    })


def guardian_frame(pose: str) -> Image.Image:
    im = Image.new("RGBA", (64, 68), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    base = 66
    lit = pose != "dormant"
    rune = (*GOLD[2], 255) if lit else (*STONE[1], 255)
    # legs
    for x in (22, 36):
        d.rectangle([x, base - 16, x + 7, base - 1], fill=(*STONE[1], 255))
        d.rectangle([x - 1, base - 4, x + 8, base - 1], fill=(*STONE[0], 255))
    # body
    d.rectangle([18, base - 42, 46, base - 15], fill=(*STONE[2], 255))
    d.rectangle([18, base - 42, 46, base - 39], fill=(*STONE[3], 255))
    d.line([(22, base - 34), (42, base - 34)], fill=(*STONE[1], 255))
    d.rectangle([29, base - 31, 35, base - 24], fill=rune)
    # head
    d.rectangle([24, base - 54, 40, base - 42], fill=(*STONE[2], 255))
    d.rectangle([24, base - 54, 40, base - 52], fill=(*STONE[3], 255))
    d.rectangle([28, base - 49, 36, base - 47], fill=rune)
    # moss
    for (x, y) in ((19, base - 40), (44, base - 30), (25, base - 53), (38, base - 20)):
        d.point((x, y), fill=(*MOSS[1], 255))
        d.point((x + 1, y), fill=(*MOSS[0], 255))
    # arms
    if pose in ("dormant", "idle"):
        for x in (10, 47):
            d.rectangle([x, base - 40, x + 7, base - 18], fill=(*STONE[1], 255))
            d.rectangle([x - 1, base - 20, x + 8, base - 13], fill=(*STONE[2], 255))
    elif pose == "windup":
        for x in (12, 45):
            d.rectangle([x, base - 64, x + 7, base - 40], fill=(*STONE[1], 255))
            d.rectangle([x - 1, base - 67, x + 8, base - 60], fill=(*STONE[2], 255))
    else:  # slam
        d.rectangle([4, base - 14, 60, base - 6], fill=(*STONE[1], 255))
        d.rectangle([2, base - 10, 14, base - 1], fill=(*STONE[2], 255))
        d.rectangle([50, base - 10, 62, base - 1], fill=(*STONE[2], 255))
    return outline(im, (20, 20, 34, 255))


def build_guardian() -> None:
    frames = {p: guardian_frame(p) for p in ("dormant", "idle", "windup", "slam")}
    write_sheet("ruin_guardian", ROOT / "assets" / "enemies" / "ruin_guardian", frames, (32, 66), {
        "dormant": (["dormant"], 1, True),
        "idle": (["idle"], 1, True),
        "walk": (["idle", "dormant"], 3, True),
        "windup": (["windup"], 1, False),
        "slam": (["slam"], 1, False),
        "hurt": (["idle"], 1, False),
    })


# --------------------------------------------------------------- tiles ---
def marble_tile(rng, deep=False) -> Image.Image:
    im = Image.new("RGBA", (T, T), (*MARBLE[1], 255))
    d = ImageDraw.Draw(im)
    pal = MARBLE if not deep else [tuple(int(c * 0.82) for c in m) for m in MARBLE]
    d.rectangle([0, 0, T - 1, T - 1], fill=(*pal[1], 255))
    for row, y in enumerate((0, 8)):
        off = 0 if row == 0 else 8
        d.line([(0, y), (T - 1, y)], fill=(*pal[0], 255))
        d.line([(off, y), (off, y + 7)], fill=(*pal[0], 255))
        d.point((off + 2, y + 2), fill=(*pal[3], 255))
    if rng.random() < 0.4:  # veins
        x = int(rng.integers(2, 13))
        for y in range(int(rng.integers(1, 6)), int(rng.integers(9, 15))):
            x = max(1, min(14, x + int(rng.integers(-1, 2))))
            d.point((x, y), fill=(*pal[2], 255))
    return im


def moss_top(im: Image.Image, rng, left=False, right=False) -> Image.Image:
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, T - 1, 2], fill=(*GOLD[1], 255))
    d.line([(0, 0), (T - 1, 0)], fill=(*GOLD[2], 255))
    for x in range(T):
        if rng.random() < 0.55:
            h = int(rng.integers(1, 4))
            for y in range(h):
                d.point((x, 3 + y), fill=(*MOSS[1 if y == 0 else 0], 255))
    if left:
        d.line([(0, 0), (0, T - 1)], fill=(40, 42, 70, 255))
    if right:
        d.line([(T - 1, 0), (T - 1, T - 1)], fill=(40, 42, 70, 255))
    return im


def edge(im: Image.Image, left=False, right=False, bottom=False) -> Image.Image:
    d = ImageDraw.Draw(im)
    c = (40, 42, 70, 255)
    if left:
        d.line([(0, 0), (0, T - 1)], fill=c)
    if right:
        d.line([(T - 1, 0), (T - 1, T - 1)], fill=c)
    if bottom:
        d.line([(0, T - 1), (T - 1, T - 1)], fill=c)
        for x in range(1, T - 1, 3):
            d.point((x, T - 2), fill=(*MARBLE[0], 255))
    return im


def cloud_ledge(kind: str) -> Image.Image:
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0 = 2 if kind in ("left", "single") else -2
    x1 = 13 if kind in ("right", "single") else T + 1
    d.rounded_rectangle([x0, 0, x1, 6], radius=3, fill=(*MARBLE[3], 255))
    d.rectangle([x0 + 2, 5, x1 - 2, 7], fill=(*MARBLE[1], 255))
    d.line([(max(0, x0 + 2), 1), (min(T - 1, x1 - 2), 1)], fill=(255, 255, 255, 255))
    return outline(im, (60, 80, 130, 255))


def decor(kind: str, rng) -> Image.Image:
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if kind == "flower":
        d.line([(8, 15), (8, 9)], fill=(*MOSS[0], 255))
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            d.point((8 + dx, 8 + dy), fill=(250, 240, 255, 255))
        d.point((8, 8), fill=(*GOLD[2], 255))
    elif kind == "grass":
        for x in (4, 7, 10):
            d.line([(x, 15), (x + (1 if x > 7 else 0), 11)], fill=(*MOSS[1], 255))
    elif kind == "shard":
        d.polygon([(8, 7), (11, 15), (5, 15)], fill=(*SKYB[1], 255))
        d.line([(8, 8), (7, 14)], fill=(*SKYB[2], 255))
    elif kind == "rubble":
        for (x, y, r) in ((5, 14, 2), (10, 13, 3)):
            d.ellipse([x - r, y - r, x + r, y + 2], fill=(*MARBLE[0], 255))
    elif kind == "feather":
        d.line([(5, 15), (11, 8)], fill=(250, 250, 255, 255), width=2)
        d.point((11, 7), fill=(*SKYB[1], 255))
    elif kind == "vine":
        for y in range(9, 16):
            d.point((7 + (y % 2), y), fill=(*MOSS[0], 255))
    elif kind == "pillar":
        d.rectangle([5, 9, 10, 15], fill=(*MARBLE[2], 255))
        d.rectangle([4, 8, 11, 9], fill=(*MARBLE[3], 255))
    else:  # mushroom-like cloud puff
        d.ellipse([4, 10, 12, 15], fill=(240, 246, 255, 255))
    return outline(im, (60, 70, 110, 255))


def build_tiles() -> None:
    rng = np.random.default_rng(91)
    atlas = Image.new("RGBA", (T * 8, T * 4), (0, 0, 0, 0))

    def put(cx, cy, im):
        atlas.alpha_composite(im, (cx * T, cy * T))

    put(0, 0, moss_top(marble_tile(rng), rng))
    put(1, 0, moss_top(marble_tile(rng), rng))
    put(2, 0, moss_top(edge(marble_tile(rng), left=True), rng, left=True))
    put(3, 0, moss_top(edge(marble_tile(rng), right=True), rng, right=True))
    for i, k in enumerate(("left", "mid", "right", "single")):
        put(4 + i, 0, cloud_ledge(k))
    put(0, 1, marble_tile(rng))
    put(1, 1, marble_tile(rng))
    put(2, 1, edge(marble_tile(rng), left=True))
    put(3, 1, edge(marble_tile(rng), right=True))
    put(4, 1, marble_tile(rng))
    put(5, 1, marble_tile(rng))
    put(6, 1, marble_tile(rng, deep=True))
    put(7, 1, marble_tile(rng, deep=True))
    put(0, 2, edge(marble_tile(rng), bottom=True))
    put(1, 2, edge(marble_tile(rng), bottom=True))
    put(2, 2, edge(marble_tile(rng), left=True, bottom=True))
    put(3, 2, edge(marble_tile(rng), right=True, bottom=True))
    put(4, 2, marble_tile(rng, deep=True))
    put(5, 2, marble_tile(rng, deep=True))
    put(6, 2, moss_top(marble_tile(rng, deep=True), rng))
    put(7, 2, moss_top(edge(edge(marble_tile(rng), left=True), right=True), rng, True, True))
    for i, k in enumerate(("flower", "grass", "shard", "rubble", "feather", "vine", "pillar", "puff")):
        put(i, 3, decor(k, rng))
    atlas.save(OUT / "tiles.png", optimize=True)


# ---------------------------------------------------------- backgrounds ---
def gradient(top, bottom, h=H, w=W) -> Image.Image:
    t = np.linspace(0, 1, h)[:, None]
    col = (np.array(top)[None, :] * (1 - t) + np.array(bottom)[None, :] * t)
    img = np.zeros((h, w, 4), np.uint8)
    img[..., :3] = col[:, None, :].astype(np.uint8)
    img[..., 3] = 255
    return Image.fromarray(img, "RGBA")


def puff(d: ImageDraw.ImageDraw, cx, cy, w, col, rng, wrap=True):
    for _ in range(int(w / 6)):
        rx = rng.uniform(w * 0.12, w * 0.3)
        ox = rng.uniform(-w / 2, w / 2)
        oy = rng.uniform(-w * 0.08, w * 0.05)
        for k in ((-W, 0, W) if wrap else (0,)):
            d.ellipse([cx + ox - rx + k, cy + oy - rx * 0.55, cx + ox + rx + k, cy + oy + rx * 0.55], fill=col)


def temple(d: ImageDraw.ImageDraw, x, y, w, col, roof):
    d.polygon([(x - 4, y), (x + w / 2, y - w * 0.28), (x + w + 4, y)], fill=roof)
    for cx in range(int(x + 3), int(x + w - 2), 9):
        d.rectangle([cx, y, cx + 4, y + w * 0.45], fill=col)
    d.rectangle([x - 2, y + w * 0.45, x + w + 2, y + w * 0.5], fill=roof)


def build_backgrounds() -> None:
    rng = np.random.default_rng(13)
    sky = gradient((110, 170, 236), (232, 238, 250))
    d = ImageDraw.Draw(sky)
    d.ellipse([480, 40, 540, 100], fill=(255, 250, 230, 255))
    for _ in range(8):
        puff(d, rng.uniform(0, W), rng.uniform(60, 220), rng.uniform(60, 140), (250, 252, 255, 255), rng)
    sky.save(OUT / "bg_sky.png", optimize=True)

    far = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(far)
    for (ix, iy, iw) in ((90, 170, 110), (330, 120, 80), (520, 190, 130)):
        d.ellipse([ix - iw / 2, iy - 7, ix + iw / 2, iy + 7], fill=(150, 176, 210, 255))
        d.polygon([(ix - iw / 2, iy), (ix + iw / 2, iy), (ix + iw * 0.1, iy + iw * 0.5), (ix - iw * 0.2, iy + iw * 0.35)],
                  fill=(128, 150, 190, 255))
        temple(d, ix - iw * 0.25, iy - iw * 0.32, iw * 0.5, (170, 190, 220, 255), (150, 172, 206, 255))
    far.save(OUT / "bg_far.png", optimize=True)

    mid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(mid)
    for x in range(0, W, 70):
        cx = x + int(rng.integers(0, 30))
        h = int(rng.integers(60, 150))
        broken = rng.random() < 0.5
        top = 320 - h
        d.rectangle([cx, top, cx + 14, 340], fill=(178, 190, 214, 255))
        d.rectangle([cx - 3, top - 4, cx + 17, top], fill=(196, 206, 226, 255))
        if broken:
            d.polygon([(cx - 3, top - 4), (cx + 6, top - 12), (cx + 17, top - 4)], fill=(0, 0, 0, 0))
    for _ in range(6):
        puff(d, rng.uniform(0, W), rng.uniform(300, 345), rng.uniform(80, 160), (236, 242, 252, 255), rng)
    mid.save(OUT / "bg_mid.png", optimize=True)

    near = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(near)
    for _ in range(7):
        puff(d, rng.uniform(0, W), rng.uniform(338, 360), rng.uniform(90, 180), (255, 255, 255, 255), rng)
    near.save(OUT / "bg_near.png", optimize=True)

    fg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(fg)
    for _ in range(4):
        puff(d, rng.uniform(0, W), rng.uniform(-10, 14), rng.uniform(70, 140), (255, 255, 255, 200), rng)
    fg.save(OUT / "fg_clouds.png", optimize=True)


def build_props() -> None:
    im = Image.new("RGBA", (32, 224), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([4, 0, 27, 223], fill=(*MARBLE[2], 255))
    for y in range(0, 224, 24):
        d.rectangle([2, y, 29, y + 4], fill=(*GOLD[1], 255))
        d.line([(2, y), (29, y)], fill=(*GOLD[2], 255))
    for x in (9, 15, 21):
        d.line([(x, 0), (x, 223)], fill=(*MARBLE[1], 255))
    for y in range(10, 220, 18):
        d.point((5 + (y % 4), y), fill=(*MOSS[1], 255))
    outline(im, (60, 70, 110, 255)).save(OUT / "arena_wall.png", optimize=True)

    im = Image.new("RGBA", (22, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([5, 10, 16, 47], fill=(*MARBLE[2], 255))
    d.rectangle([3, 42, 18, 47], fill=(*MARBLE[3], 255))
    d.polygon([(5, 10), (9, 4), (12, 9), (16, 2), (16, 10)], fill=(*MARBLE[2], 255))
    for x in (8, 11, 14):
        d.line([(x, 12), (x, 41)], fill=(*MARBLE[1], 255))
    outline(im, (60, 70, 110, 255)).save(OUT / "broken_column.png", optimize=True)

    im = Image.new("RGBA", (20, 22), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([3, 6, 16, 21], fill=(*SKYB[0], 255))
    d.rectangle([6, 2, 13, 7], fill=(*SKYB[1], 255))
    d.line([(5, 12), (14, 12)], fill=(*GOLD[2], 255))
    outline(im, (40, 50, 90, 255)).save(OUT / "vase.png", optimize=True)

    im = Image.new("RGBA", (30, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([7, 56, 22, 63], fill=(*MARBLE[2], 255))
    d.rectangle([10, 22, 19, 56], fill=(*MARBLE[3], 255))
    d.ellipse([9, 10, 20, 22], fill=(*MARBLE[3], 255))
    d.polygon([(10, 26), (0, 18), (2, 30), (10, 34)], fill=(*MARBLE[2], 255))  # wings
    d.polygon([(19, 26), (29, 18), (27, 30), (19, 34)], fill=(*MARBLE[2], 255))
    outline(im, (60, 70, 110, 255)).save(OUT / "angel_statue.png", optimize=True)

    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 15, 9], fill=(*MARBLE[1], 255))
    d.line([(0, 0), (15, 0)], fill=(*MARBLE[3], 255))
    d.line([(4, 1), (6, 5), (5, 9)], fill=(*MARBLE[0], 255))
    d.line([(11, 2), (9, 6)], fill=(*MARBLE[0], 255))
    outline(im, (60, 70, 110, 255)).save(OUT / "crumble.png", optimize=True)

    im = Image.new("RGBA", (6, 22), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y in range(22):
        a = int(200 * (1 - abs(y - 11) / 11))
        d.point((2, y), fill=(230, 245, 255, a))
        d.point((3, y), fill=(255, 255, 255, a))
    im.save(OUT / "wind_streak.png", optimize=True)


def build_item_icons() -> None:
    items = ROOT / "assets" / "ui" / "items"
    im = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(4, 21), (17, 4), (20, 6), (8, 21)], fill=(244, 248, 255, 255))
    d.line([(5, 20), (18, 5)], fill=(*SKYB[1], 255))
    d.line([(3, 22), (6, 19)], fill=(*GOLD[1], 255), width=2)
    outline(im, (40, 60, 110, 255)).save(items / "sky_feather.png", optimize=True)
    im = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(5, 4), (19, 4), (20, 12), (17, 21), (7, 21), (4, 12)], fill=(60, 80, 140, 255))
    for y in range(7, 20, 4):
        for x in range(7, 18, 4):
            d.arc([x - 2, y - 2, x + 2, y + 2], 0, 180, fill=(*SKYB[2], 255))
    d.line([(12, 4), (12, 21)], fill=(40, 56, 110, 255))
    outline(im, (16, 20, 44, 255)).save(items / "storm_armor.png", optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    recolor_assets()
    build_wisp()
    build_guardian()
    build_tiles()
    build_backgrounds()
    build_props()
    build_item_icons()
    print("sky ruins art ->", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
