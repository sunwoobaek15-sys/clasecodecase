#!/usr/bin/env python3
"""Phase 4-1: icons and attack effects for the four new weapons.

The reference sheets show only the hero's sword, so the greatsword, dual
blades, staff and spear have no pictures. Their 24px item icons and the
attack effects (heavy arc, twin slashes, thrust line, magic bolt) are drawn
here. The hero keeps his sword animation frames for every weapon; weapons
differ in reach, speed, combo, effects and skill (see docs/PHASE4_REPORT.md).

Outputs: assets/ui/items/{greatsword,dual_blades,staff,spear}.png
         assets/effects/weapons/{arc_heavy,slash_twin,thrust,magic_bolt}.png
Usage: python3 tools/build_weapons.py
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from build_clock_city import outline

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "assets" / "ui" / "items"
FX = ROOT / "assets" / "effects" / "weapons"


def icon(draw_fn, name: str, line=(14, 12, 26, 255)) -> None:
    im = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(im))
    outline(im, line).save(ITEMS / f"{name}.png", optimize=True)


def greatsword(d):
    d.polygon([(4, 20), (16, 4), (21, 3), (20, 8), (8, 22)], fill=(200, 110, 70, 255))
    d.polygon([(6, 19), (17, 5), (19, 5), (9, 19)], fill=(250, 190, 120, 255))
    d.line([(2, 16), (10, 23)], fill=(214, 176, 92, 255), width=3)
    d.line([(1, 23), (4, 20)], fill=(90, 60, 40, 255), width=3)


def dual(d):
    for (x0, y0, x1, y1, c) in ((4, 19, 16, 7, (140, 230, 255, 255)), (8, 7, 20, 19, (100, 200, 240, 255))):
        d.line([(x0, y0), (x1, y1)], fill=c, width=2)
    d.line([(2, 21), (5, 18)], fill=(214, 176, 92, 255), width=2)
    d.line([(19, 21), (22, 18)], fill=(214, 176, 92, 255), width=2)


def staff(d):
    d.line([(5, 22), (15, 8)], fill=(120, 80, 50, 255), width=2)
    d.ellipse([12, 2, 21, 11], fill=(170, 110, 250, 255))
    d.ellipse([14, 4, 17, 7], fill=(240, 220, 255, 255))
    d.arc([10, 0, 23, 13], 200, 340, fill=(214, 176, 92, 255), width=1)


def spear(d):
    d.line([(3, 22), (17, 6)], fill=(130, 90, 60, 255), width=2)
    d.polygon([(16, 7), (21, 2), (19, 9)], fill=(240, 210, 110, 255))
    d.polygon([(15, 9), (12, 9), (14, 12)], fill=(210, 60, 60, 255))


def arc(w, h, r0, r1, a0, a1, col, glow) -> Image.Image:
    """Crescent slash: ring sector with a bright inner edge, fading ends."""
    im = np.zeros((h, w, 4), np.float32)
    cx, cy = w * 0.25, h / 2.0
    ys, xs = np.mgrid[0:h, 0:w]
    dx, dy = xs - cx, ys - cy
    r = np.hypot(dx, dy)
    ang = np.degrees(np.arctan2(dy, dx))
    m = (r >= r0) & (r <= r1) & (ang >= a0) & (ang <= a1)
    t = np.clip((ang - a0) / (a1 - a0), 0, 1)
    fade = np.sin(t * math.pi)
    edge = np.clip(1 - (r1 - r) / max(1, (r1 - r0)), 0, 1)
    for i in range(3):
        im[..., i] = np.where(m, col[i] * (1 - edge) + glow[i] * edge, 0)
    im[..., 3] = np.where(m, np.clip(fade * (0.4 + 0.6 * edge), 0, 1) * 255, 0)
    a = im[..., 3]
    im[..., 3] = np.where(a > 160, 255, np.where(a > 80, 170, np.where(a > 25, 90, 0)))
    return Image.fromarray(im.astype(np.uint8), "RGBA")


def build_fx() -> None:
    FX.mkdir(parents=True, exist_ok=True)
    arc(72, 72, 22, 34, -80, 80, (230, 110, 50), (255, 230, 170)).save(FX / "arc_heavy.png")
    twin = Image.new("RGBA", (52, 44), (0, 0, 0, 0))
    twin.alpha_composite(arc(48, 40, 13, 18, -70, 70, (90, 200, 255), (230, 250, 255)), (0, 0))
    twin.alpha_composite(arc(48, 40, 13, 18, -70, 70, (90, 200, 255), (230, 250, 255)), (6, 4))
    twin.save(FX / "slash_twin.png")
    im = Image.new("RGBA", (72, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, (a, w) in enumerate(((90, 6), (170, 4), (255, 2))):
        d.line([(2, 7), (60, 7)], fill=(255, 220, 120, a), width=w)
    d.polygon([(58, 2), (71, 7), (58, 12)], fill=(255, 245, 200, 255))
    im.save(FX / "thrust.png")
    im = Image.new("RGBA", (22, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(0, 7), (12, 3), (12, 11)], fill=(150, 90, 240, 120))
    d.ellipse([8, 1, 20, 13], fill=(180, 120, 255, 255))
    d.ellipse([11, 4, 16, 9], fill=(245, 230, 255, 255))
    im.save(FX / "magic_bolt.png")


def main() -> None:
    icon(greatsword, "greatsword")
    icon(dual, "dual_blades")
    icon(staff, "staff")
    icon(spear, "spear")
    build_fx()
    print("weapon icons and effects written")


if __name__ == "__main__":
    main()
