#!/usr/bin/env python3
"""Phase 4-2: icons for the 30 relics and the 3 job emblems.

The reference sheets have no relics or class emblems, so these 24px relic
icons and 32px job emblems are drawn here as placeholder pixel art in the
style of the other item icons (dark outline, 3-4 tones). See
docs/PHASE4_2_REPORT.md.

Outputs: assets/ui/relics/<name>.png (24x24)
         assets/ui/jobs/<name>.png (32x32)
Usage: python3 tools/build_relics.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

from build_clock_city import outline

ROOT = Path(__file__).resolve().parent.parent
RELICS = ROOT / "assets" / "ui" / "relics"
JOBS = ROOT / "assets" / "ui" / "jobs"
LINE = (14, 12, 26, 255)

GOLD = (226, 184, 92, 255)
GOLD_D = (160, 116, 52, 255)
GOLD_L = (255, 236, 170, 255)
WHITE = (245, 245, 255, 255)
BROWN = (130, 86, 54, 255)
BROWN_D = (92, 58, 38, 255)
GREEN = (96, 196, 92, 255)
GREEN_D = (52, 128, 64, 255)
GREEN_L = (178, 240, 150, 255)
CYAN = (110, 220, 255, 255)
BLUE = (70, 120, 230, 255)
PURPLE = (160, 100, 240, 255)
PURPLE_L = (220, 190, 255, 255)
RED = (220, 60, 60, 255)
ORANGE = (250, 140, 50, 255)
YELLOW = (255, 220, 80, 255)
GREY = (140, 140, 160, 255)
GREY_D = (96, 96, 116, 255)
GREY_L = (200, 200, 216, 255)
PINK = (250, 130, 170, 255)
TEAL = (60, 180, 170, 255)


def gear(d, cx, cy, r, teeth, body, hole=None, tooth=2):
    for i in range(teeth):
        a = i * 2 * math.pi / teeth
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        d.rectangle([x - tooth / 2, y - tooth / 2, x + tooth / 2, y + tooth / 2], fill=body)
    d.ellipse([cx - r + 1, cy - r + 1, cx + r - 1, cy + r - 1], fill=body)
    if hole:
        hr = max(1, r // 3)
        d.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=hole)


def feather(d, col, hi, spine, tip=None):
    d.polygon([(4, 21), (9, 11), (15, 5), (20, 3), (18, 9), (12, 16), (6, 21)], fill=col)
    d.polygon([(8, 15), (14, 7), (18, 4), (15, 9)], fill=hi)
    if tip:
        d.polygon([(15, 5), (20, 3), (18, 8)], fill=tip)
    d.line([(3, 22), (18, 5)], fill=spine, width=1)


def cord(d, col=BROWN):
    d.arc([6, 0, 18, 12], 200, 340, fill=col, width=1)


# ------------------------------------------------------------ relic icons ---
def slime_core(d):
    d.ellipse([4, 7, 20, 21], fill=(110, 210, 110, 255))
    d.ellipse([6, 9, 18, 19], fill=(140, 230, 130, 255))
    d.ellipse([9, 11, 15, 17], fill=GREEN_D)
    d.ellipse([7, 9, 9, 11], fill=WHITE)
    d.polygon([(12, 7), (15, 3), (17, 6)], fill=GREEN_D)


def leaf_charm(d):
    cord(d)
    d.ellipse([10, 9, 14, 13], fill=GOLD)
    d.polygon([(12, 12), (5, 18), (8, 22), (12, 22), (17, 18)], fill=GREEN)
    d.line([(12, 13), (10, 21)], fill=GREEN_D)
    d.point((9, 17), fill=GREEN_L)


def amethyst(d):
    d.polygon([(12, 2), (18, 8), (16, 21), (8, 21), (6, 8)], fill=PURPLE)
    d.polygon([(12, 2), (14, 8), (12, 21), (8, 21), (6, 8)], fill=(190, 140, 250, 255))
    d.line([(9, 6), (9, 12)], fill=PURPLE_L)
    d.point((10, 4), fill=WHITE)


def verdan_seed(d):
    d.ellipse([5, 5, 19, 21], fill=BROWN)
    d.ellipse([7, 7, 15, 17], fill=(160, 112, 70, 255))
    d.line([(12, 6), (10, 11), (13, 15), (11, 20)], fill=CYAN, width=2)
    d.point((11, 11), fill=WHITE)
    d.polygon([(12, 5), (15, 1), (17, 4)], fill=GREEN)


def forest_charm(d):
    cord(d)
    d.ellipse([4, 7, 20, 23], fill=BROWN)
    d.ellipse([6, 9, 18, 21], fill=(176, 126, 80, 255))
    d.polygon([(12, 10), (8, 15), (12, 20), (16, 15)], fill=GREEN)
    d.line([(12, 11), (12, 19)], fill=GREEN_D)


def brass_spring(d):
    d.rectangle([10, 1, 14, 3], fill=GOLD_D)
    for i in range(5):
        y = 5 + i * 3
        d.line([(6, y + 2), (18, y)], fill=GOLD, width=1)
        d.point((6, y + 2), fill=GOLD_L)
    d.line([(6, 7), (6, 19)], fill=GOLD_D)
    d.line([(18, 5), (18, 17)], fill=GOLD_D)
    d.rectangle([10, 20, 14, 22], fill=GOLD_D)


def tiny_cog(d):
    gear(d, 12, 12, 8, 8, (200, 150, 80, 255), BROWN_D, 3)
    d.arc([6, 6, 18, 18], 200, 290, fill=GOLD_L)


def sentinel_eye(d):
    gear(d, 12, 12, 9, 10, GREY, None, 3)
    d.ellipse([6, 7, 18, 17], fill=WHITE)
    d.ellipse([9, 8, 15, 16], fill=RED)
    d.ellipse([11, 10, 13, 13], fill=(60, 10, 20, 255))


def clock_hand(d):
    d.ellipse([2, 2, 22, 22], fill=(230, 220, 190, 255))
    d.ellipse([4, 4, 20, 20], fill=(250, 245, 225, 255))
    for i in range(12):
        a = i * math.pi / 6
        d.point((12 + math.cos(a) * 7, 12 + math.sin(a) * 7), fill=GREY_D)
    d.line([(12, 12), (17, 6)], fill=BROWN_D, width=2)
    d.line([(12, 12), (8, 15)], fill=GREY_D, width=1)
    d.ellipse([11, 11, 13, 13], fill=GOLD)


def chronos_gear(d):
    gear(d, 12, 12, 10, 12, (90, 110, 210, 255), None, 3)
    d.ellipse([5, 5, 19, 19], fill=(150, 120, 240, 255))
    d.ellipse([7, 7, 17, 17], fill=(210, 220, 255, 255))
    d.line([(12, 12), (12, 8)], fill=PURPLE, width=1)
    d.line([(12, 12), (15, 13)], fill=PURPLE, width=1)


def cloud_drop(d):
    d.polygon([(12, 2), (18, 12), (6, 12)], fill=(190, 225, 255, 255))
    d.ellipse([5, 8, 19, 22], fill=(190, 225, 255, 255))
    d.ellipse([8, 11, 14, 17], fill=WHITE)
    d.point((9, 12), fill=CYAN)


def puff_tuft(d):
    for (x, y, r) in ((8, 13, 5), (15, 11, 6), (12, 16, 5), (17, 16, 4)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=(230, 236, 255, 255))
    d.ellipse([12, 7, 17, 11], fill=WHITE)
    d.point((7, 16), fill=(180, 190, 230, 255))


def wind_core(d):
    for i in range(36):
        t = i / 35
        a = t * 3.6 * math.pi
        r = 2 + t * 8
        d.point((12 + math.cos(a) * r, 12 + math.sin(a) * r), fill=CYAN if i % 3 else WHITE)
    d.ellipse([10, 10, 14, 14], fill=WHITE)


def guardian_rune(d):
    d.polygon([(5, 4), (19, 3), (20, 21), (4, 21)], fill=GREY)
    d.polygon([(6, 5), (18, 4), (18, 10), (6, 11)], fill=GREY_L)
    d.line([(9, 8), (12, 15), (15, 8)], fill=CYAN, width=1)
    d.line([(12, 15), (12, 19)], fill=CYAN, width=1)


def storm_feather(d):
    feather(d, (90, 150, 230, 255), (170, 210, 255, 255), (40, 60, 120, 255))
    d.line([(16, 12), (13, 16), (17, 16), (13, 21)], fill=YELLOW, width=1)


def storm_scale(d):
    d.polygon([(12, 2), (20, 7), (20, 17), (12, 22), (4, 17), (4, 7)], fill=TEAL)
    d.polygon([(12, 5), (17, 8), (17, 15), (12, 18), (7, 15), (7, 8)], fill=(110, 220, 210, 255))
    d.line([(9, 8), (9, 13)], fill=WHITE)
    d.line([(14, 9), (11, 13), (14, 13), (11, 17)], fill=YELLOW)


def mia_ribbon(d):
    d.polygon([(12, 10), (3, 4), (3, 16)], fill=PINK)
    d.polygon([(12, 10), (21, 4), (21, 16)], fill=PINK)
    d.polygon([(11, 11), (7, 21), (10, 20)], fill=(220, 90, 130, 255))
    d.polygon([(13, 11), (17, 21), (14, 20)], fill=(220, 90, 130, 255))
    d.ellipse([10, 8, 14, 12], fill=(255, 190, 210, 255))
    d.point((5, 8), fill=(255, 210, 225, 255))


def traveler_coin(d):
    d.ellipse([3, 3, 21, 21], fill=GOLD_D)
    d.ellipse([4, 4, 20, 20], fill=GOLD)
    d.rectangle([10, 10, 13, 13], fill=(0, 0, 0, 0))
    d.arc([6, 6, 18, 18], 190, 260, fill=GOLD_L)


def bron_hammer(d):
    d.line([(5, 21), (14, 10)], fill=BROWN, width=2)
    d.polygon([(10, 4), (19, 11), (16, 15), (7, 8)], fill=GREY)
    d.polygon([(10, 4), (19, 11), (18, 12), (9, 5)], fill=GREY_L)
    d.point((4, 22), fill=GOLD)


def phoenix_feather(d):
    feather(d, ORANGE, YELLOW, (150, 40, 30, 255), RED)
    d.point((8, 18), fill=(255, 250, 200, 255))
    d.point((19, 6), fill=WHITE)


def time_hourglass(d):
    d.rectangle([5, 2, 19, 4], fill=GOLD)
    d.rectangle([5, 19, 19, 21], fill=GOLD)
    d.polygon([(7, 5), (17, 5), (12, 12), (17, 18), (7, 18), (12, 12)], fill=(210, 230, 255, 180))
    d.polygon([(9, 7), (15, 7), (12, 11)], fill=CYAN)
    d.polygon([(8, 18), (16, 18), (12, 15)], fill=CYAN)
    d.line([(6, 5), (6, 18)], fill=GOLD_D)
    d.line([(18, 5), (18, 18)], fill=GOLD_D)


def hunter_fang(d):
    cord(d)
    d.polygon([(9, 9), (15, 9), (14, 15), (11, 22), (10, 15)], fill=(245, 238, 215, 255))
    d.line([(14, 10), (13, 16)], fill=(200, 190, 160, 255))
    d.rectangle([9, 8, 15, 9], fill=BROWN)


def first_victory(d):
    d.polygon([(7, 1), (11, 1), (13, 10), (9, 10)], fill=RED)
    d.polygon([(17, 1), (13, 1), (11, 10), (15, 10)], fill=BLUE)
    d.ellipse([5, 9, 19, 23], fill=GOLD)
    d.ellipse([8, 12, 16, 20], fill=GOLD_L)
    d.polygon([(12, 13), (13, 16), (12, 19), (11, 16)], fill=GOLD_D)


def pet_bell(d):
    d.polygon([(12, 4), (17, 9), (19, 18), (5, 18), (7, 9)], fill=GOLD)
    d.polygon([(12, 4), (14, 9), (14, 18), (8, 18), (9, 9)], fill=GOLD_L)
    d.rectangle([4, 18, 20, 19], fill=GOLD_D)
    d.ellipse([10, 19, 14, 23], fill=GOLD_D)
    d.polygon([(12, 4), (7, 1), (7, 6)], fill=RED)
    d.polygon([(12, 4), (17, 1), (17, 6)], fill=RED)


def librarian_quill(d):
    feather(d, WHITE, (210, 220, 245, 255), GREY_D)
    d.line([(2, 23), (5, 20)], fill=(40, 40, 70, 255), width=2)
    d.point((3, 21), fill=BLUE)


def village_key(d):
    d.ellipse([3, 3, 11, 11], fill=GOLD)
    d.ellipse([5, 5, 9, 9], fill=(0, 0, 0, 0))
    d.line([(10, 10), (20, 20)], fill=GOLD, width=2)
    d.line([(17, 17), (14, 20)], fill=GOLD, width=2)
    d.line([(19, 19), (17, 21)], fill=GOLD, width=2)
    d.point((4, 5), fill=GOLD_L)


def treasure_map(d):
    d.polygon([(3, 5), (9, 3), (15, 5), (21, 3), (21, 19), (15, 21), (9, 19), (3, 21)], fill=(236, 214, 160, 255))
    d.line([(9, 3), (9, 19)], fill=(200, 170, 110, 255))
    d.line([(15, 5), (15, 21)], fill=(200, 170, 110, 255))
    d.line([(5, 15), (8, 12), (11, 14), (14, 9)], fill=(150, 110, 70, 255))
    d.line([(15, 8), (19, 12)], fill=RED, width=2)
    d.line([(19, 8), (15, 12)], fill=RED, width=2)


def star_compass(d):
    d.ellipse([2, 2, 22, 22], fill=GOLD_D)
    d.ellipse([4, 4, 20, 20], fill=(30, 40, 90, 255))
    d.polygon([(12, 4), (14, 11), (12, 12), (10, 11)], fill=YELLOW)
    d.polygon([(12, 20), (14, 13), (12, 12), (10, 13)], fill=GREY_L)
    d.polygon([(4, 12), (11, 10), (12, 12), (11, 14)], fill=(200, 200, 255, 255))
    d.polygon([(20, 12), (13, 10), (12, 12), (13, 14)], fill=(200, 200, 255, 255))
    d.point((7, 6), fill=WHITE)
    d.point((17, 18), fill=WHITE)


def vampire_ring(d):
    d.ellipse([4, 8, 20, 22], fill=GREY_L)
    d.ellipse([7, 11, 17, 19], fill=(0, 0, 0, 0))
    d.polygon([(12, 2), (17, 7), (12, 12), (7, 7)], fill=(170, 20, 40, 255))
    d.polygon([(12, 3), (14, 7), (12, 9), (9, 7)], fill=(240, 80, 100, 255))


def herb_pouch(d):
    d.polygon([(6, 9), (18, 9), (21, 18), (17, 22), (7, 22), (3, 18)], fill=BROWN)
    d.polygon([(7, 11), (15, 11), (17, 18), (8, 19)], fill=(166, 116, 72, 255))
    d.rectangle([7, 7, 17, 9], fill=BROWN_D)
    d.polygon([(10, 7), (8, 1), (12, 4)], fill=GREEN)
    d.polygon([(13, 7), (17, 2), (15, 6)], fill=GREEN_L)


RELIC_ICONS = {
    "slime_core": slime_core, "leaf_charm": leaf_charm, "amethyst": amethyst,
    "verdan_seed": verdan_seed, "forest_charm": forest_charm, "brass_spring": brass_spring,
    "tiny_cog": tiny_cog, "sentinel_eye": sentinel_eye, "clock_hand": clock_hand,
    "chronos_gear": chronos_gear, "cloud_drop": cloud_drop, "puff_tuft": puff_tuft,
    "wind_core": wind_core, "guardian_rune": guardian_rune, "storm_feather": storm_feather,
    "storm_scale": storm_scale, "mia_ribbon": mia_ribbon, "traveler_coin": traveler_coin,
    "bron_hammer": bron_hammer, "phoenix_feather": phoenix_feather, "time_hourglass": time_hourglass,
    "hunter_fang": hunter_fang, "first_victory": first_victory, "pet_bell": pet_bell,
    "librarian_quill": librarian_quill, "village_key": village_key, "treasure_map": treasure_map,
    "star_compass": star_compass, "vampire_ring": vampire_ring, "herb_pouch": herb_pouch,
}


# ------------------------------------------------------------ job emblems ---
def shield_base(d, rim, face):
    d.polygon([(4, 3), (28, 3), (28, 15), (16, 29), (4, 15)], fill=rim)
    d.polygon([(7, 6), (25, 6), (25, 15), (16, 26), (7, 15)], fill=face)


def blade_master(d):
    shield_base(d, GOLD_D, (40, 50, 110, 255))
    for flip in (False, True):
        a, b = ((8, 24), (24, 8)) if not flip else ((24, 24), (8, 8))
        d.line([a, b], fill=(150, 220, 255, 255), width=3)
        d.line([a, b], fill=WHITE, width=1)
    d.line([(6, 20), (12, 26)], fill=GOLD, width=2)
    d.line([(26, 20), (20, 26)], fill=GOLD, width=2)


def guardian_knight(d):
    shield_base(d, GREY_L, (60, 90, 170, 255))
    d.polygon([(16, 8), (22, 11), (21, 18), (16, 23), (11, 18), (10, 11)], fill=GREY_L)
    d.polygon([(16, 10), (20, 12), (19, 17), (16, 20)], fill=WHITE)
    d.line([(16, 8), (16, 23)], fill=GOLD, width=1)


def chronomancer(d):
    shield_base(d, (110, 70, 180, 255), (34, 20, 70, 255))
    d.ellipse([8, 7, 24, 23], fill=(150, 110, 240, 255))
    d.ellipse([10, 9, 22, 21], fill=(220, 210, 255, 255))
    d.line([(16, 15), (16, 10)], fill=PURPLE, width=1)
    d.line([(16, 15), (20, 17)], fill=PURPLE, width=1)
    for (x, y) in ((6, 6), (26, 7), (25, 21)):
        d.point((x, y), fill=YELLOW)


JOB_ICONS = {"blade_master": blade_master, "guardian_knight": guardian_knight, "chronomancer": chronomancer}


def main() -> None:
    RELICS.mkdir(parents=True, exist_ok=True)
    JOBS.mkdir(parents=True, exist_ok=True)
    for name, fn in RELIC_ICONS.items():
        im = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
        fn(ImageDraw.Draw(im))
        outline(im, LINE).save(RELICS / f"{name}.png", optimize=True)
    for name, fn in JOB_ICONS.items():
        im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        fn(ImageDraw.Draw(im))
        outline(im, LINE).save(JOBS / f"{name}.png", optimize=True)
    print("%d relic icons and %d job emblems written" % (len(RELIC_ICONS), len(JOB_ICONS)))


if __name__ == "__main__":
    main()
