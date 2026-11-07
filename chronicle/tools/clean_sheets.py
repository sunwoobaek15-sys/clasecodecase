#!/usr/bin/env python3
"""Step 1 of the asset pipeline: clean the six reference sheets.

The originals in art_source/original/ are never modified. This script writes
full-size cleaned copies to art_source/cleaned/ and debug overlays to
art_source/preview/.

What it fixes (found during the image analysis, see docs/ASSET_ANALYSIS.md):
  * Sheets 01-05 are real RGBA images, but the "transparent" pixels still carry
    the old background colour in RGB and there is a faint haze (alpha 1-23)
    left over from the glow background. Opaque pixels stop at alpha 254.
  * Sheets 02, 04 and 05 contain caption labels ("Idle", "Move (이동)", ...)
    drawn as dark rounded rectangles with white text. They are part of the
    alpha mask, so they must be cut out or they would end up in sprites.
  * Sheet 06 (Chronos) is plain RGB with a painted grey/white checkerboard
    ("fake transparency"). The checkerboard is removed with a flood fill from
    the image border and the anti-aliased rim gets an estimated alpha.

Usage:  python3 -I tools/clean_sheets.py
"""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ORIG = ROOT / "art_source" / "original"
CLEAN = ROOT / "art_source" / "cleaned"
PREVIEW = ROOT / "art_source" / "preview"

# label_color: caption box colour measured on the sheet (mean of ~2k pixels,
#   std ~6-12 per channel). Sheets 02/04 use blue-grey, sheet 05 uses navy.
# label_hints: rough boxes (x, y, w, h) of captions that touch a sprite, so
#   the automatic rectangle test misses them. Each hint is refined to the real
#   caption bounds by refine_label_box(). Verified on art_source/preview/.
SHEETS = {
    "01_hero_cheongwol": {"fake_bg": False},
    "02_forest_slime": {
        "fake_bg": False,
        "label_color": (30, 36, 41),
        "label_hints": [(1232, 178, 86, 32), (352, 822, 128, 34), (584, 822, 122, 34)],
    },
    "03_village_npcs": {"fake_bg": False},
    "04_boss_verdan": {"fake_bg": False, "label_color": (30, 36, 41), "label_hints": []},
    "05_pets": {
        "fake_bg": False,
        "label_color": (15, 23, 55),
        "label_hints": [(246, 262, 122, 40), (246, 574, 126, 40), (246, 692, 118, 38),
                        (12, 820, 160, 38), (524, 826, 156, 38), (1004, 826, 152, 38)],
    },
    "06_boss_chronos": {"fake_bg": True},
}

HAZE_ALPHA = 24  # alpha below this is leftover glow haze -> fully transparent


def _label_mask(rgba: np.ndarray, color, tol: int) -> np.ndarray:
    rgb = rgba[..., :3].astype(np.int32)
    diff = np.abs(rgb - np.array(color)).max(axis=2)
    # Caption colours are blue-ish (B > R); the brown/green sprites are not.
    bluish = (rgb[..., 2] - rgb[..., 0]) >= 4
    return ((diff <= tol) & bluish & (rgba[..., 3] >= 180)).astype(np.uint8)


def detect_labels(rgba: np.ndarray, color) -> list[tuple[int, int, int, int]]:
    """Find caption labels: solid dark rounded boxes with white text."""
    rgb = rgba[..., :3].astype(np.int32)
    cand = _label_mask(rgba, color, 16)
    # Close the holes left by the white glyphs, then open to cut thin bridges
    # to neighbouring dark sprite pixels.
    closed = cv2.morphologyEx(cand, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)))
    opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    n, _lab, stats, _ = cv2.connectedComponentsWithStats(opened, connectivity=8)
    boxes = []
    for i in range(1, n):
        x, y, w, h, area = (int(v) for v in stats[i])
        if not (16 <= h <= 44 and w >= 28 and w / h >= 1.4):
            continue
        if area / float(w * h) < 0.70:
            continue
        sub = rgb[y:y + h, x:x + w]
        white = float((sub.min(axis=2) >= 185).mean())
        if not (0.02 <= white <= 0.45):
            continue
        boxes.append((x, y, w, h))
    return boxes


def refine_label_box(rgba: np.ndarray, hint, color):
    """Shrink a rough hint box to the rows/columns that are mostly caption colour."""
    hx, hy, hw, hh = hint
    sub = _label_mask(rgba[hy:hy + hh, hx:hx + hw], color, 22)
    sub = cv2.morphologyEx(sub, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)))
    rows = np.where(sub.mean(axis=1) > 0.45)[0]
    cols = np.where(sub.mean(axis=0) > 0.45)[0]
    if len(rows) < 8 or len(cols) < 20:
        raise RuntimeError(f"label hint {hint} does not contain a caption box")
    return (hx + int(cols[0]), hy + int(rows[0]), int(cols[-1] - cols[0] + 1), int(rows[-1] - rows[0] + 1))


def _overlaps(a, b) -> bool:
    return not (a[0] + a[2] <= b[0] or b[0] + b[2] <= a[0] or a[1] + a[3] <= b[1] or b[1] + b[3] <= a[1])


def clear_labels(rgba: np.ndarray, boxes, pad: int = 3) -> None:
    """Erase the label box plus its anti-aliased rim, but keep sprite pixels.

    Inside the padded rectangle only pixels that look like label material are
    erased: the label grey, the white/grey glyph pixels (low saturation) and
    the semi-transparent rim. Saturated sprite pixels (green slime, leaves...)
    that touch the label are kept.
    """
    h_img, w_img = rgba.shape[:2]
    for (x, y, w, h) in boxes:
        x0, y0 = max(0, x - pad), max(0, y - pad)
        x1, y1 = min(w_img, x + w + pad), min(h_img, y + h + pad)
        sub = rgba[y0:y1, x0:x1]
        rgb = sub[..., :3].astype(np.int32)
        sat = rgb.max(axis=2) - rgb.min(axis=2)
        inner = np.zeros(sub.shape[:2], bool)
        inner[(y - y0):(y - y0 + h), (x - x0):(x - x0 + w)] = True
        label_like = (sat <= 40) | (sub[..., 3] < 200)
        # Everything strictly inside the box is label; on the padded rim only
        # the label-like pixels go.
        kill = inner | label_like
        sub[kill] = 0


def reconstruct_checker(rgb: np.ndarray):
    """Estimate the painted checkerboard: 12px squares, two colours."""
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    parity = ((xx // 12) + (yy // 12)) % 2
    mn = rgb.min(axis=2)
    sat = rgb.max(axis=2) - mn
    plain = (mn >= 200) & (sat <= 30)
    light = np.median(rgb[plain & (parity == 0)], axis=0)
    dark = np.median(rgb[plain & (parity == 1)], axis=0)
    expected = np.where(parity[..., None] == 0, light, dark)
    return expected, light, dark


def remove_fake_background(rgb: np.ndarray) -> np.ndarray:
    """Turn the painted checkerboard into real transparency. Returns RGBA."""
    rgb_i = rgb.astype(np.int32)
    expected, light, dark = reconstruct_checker(rgb_i)
    dist = np.abs(rgb_i - expected).max(axis=2)
    mn = rgb_i.min(axis=2)
    sat = rgb_i.max(axis=2) - mn
    # Background-ish: close to the expected checker colour, or any very light
    # unsaturated pixel (the AI checker is noisy and drifts in places).
    bgish = (dist <= 30) | ((mn >= 205) & (sat <= 28))
    n, lab = cv2.connectedComponents(bgish.astype(np.uint8), connectivity=4)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border != 0]
    bg = np.isin(lab, border)

    # Checker trapped inside closed shapes (clock faces, rings, hourglass) is
    # not reachable from the border. Remove an enclosed patch only when it
    # really shows the alternating 12px pattern: both square colours must be
    # present and match. Real white cloth matches at most one of the two.
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    parity = ((xx // 12) + (yy // 12)) % 2
    strict = (dist <= 22) & ~bg
    n2, lab2, stats2, _ = cv2.connectedComponentsWithStats(strict.astype(np.uint8), connectivity=4)
    for i in range(1, n2):
        if stats2[i, cv2.CC_STAT_AREA] < 60:
            continue
        comp = lab2 == i
        p1 = float(parity[comp].mean())
        if 0.25 <= p1 <= 0.75:
            bg |= comp
    # Remove isolated specks of checker trapped between sprites.
    bg = cv2.morphologyEx(bg.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)).astype(bool)

    alpha = np.full(rgb.shape[:2], 255, np.float32)
    alpha[bg] = 0
    # Soft rim: pixels next to the removed background get an alpha estimated
    # from how far they are from the checker colour, then are un-blended.
    near = cv2.dilate(bg.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & ~bg
    a_est = np.clip((dist.astype(np.float32) - 20.0) / 90.0, 0.0, 1.0)
    alpha[near] = np.minimum(255.0, a_est[near] * 255.0)
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    a = (alpha / 255.0)[..., None]
    with np.errstate(divide="ignore", invalid="ignore"):
        unblended = np.where(a > 0.05, (rgb_i - (1.0 - a) * expected) / np.maximum(a, 1e-3), rgb_i)
    out[..., :3] = np.clip(unblended, 0, 255).astype(np.uint8)
    out[..., 3] = alpha.astype(np.uint8)
    return out


def tidy_alpha(rgba: np.ndarray) -> None:
    a = rgba[..., 3]
    a[a < HAZE_ALPHA] = 0
    a[a >= 250] = 255
    rgba[a == 0] = 0  # drop hidden background colours under transparent pixels


def main() -> None:
    CLEAN.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    report = {}
    for name, opts in SHEETS.items():
        src = Image.open(ORIG / f"{name}.png")
        info = {"mode": src.mode, "size": list(src.size)}
        if opts["fake_bg"]:
            rgba = remove_fake_background(np.asarray(src.convert("RGB")))
            info["fake_background_removed"] = True
        else:
            rgba = np.array(src.convert("RGBA"))
        boxes = []
        if "label_color" in opts:
            boxes = detect_labels(rgba, opts["label_color"])
            for hint in opts.get("label_hints", []):
                refined = refine_label_box(rgba, hint, opts["label_color"])
                if not any(_overlaps(refined, b) for b in boxes):
                    boxes.append(refined)
        if boxes:
            clear_labels(rgba, boxes)
        info["labels_removed"] = [list(b) for b in boxes]
        tidy_alpha(rgba)
        Image.fromarray(rgba, "RGBA").save(CLEAN / f"{name}.png", optimize=True)

        # Debug overlay: cleaned sheet on magenta with removed label boxes.
        prev = Image.new("RGBA", src.size, (255, 0, 255, 255))
        prev.alpha_composite(Image.fromarray(rgba, "RGBA"))
        d = ImageDraw.Draw(prev)
        for (x, y, w, h) in boxes:
            d.rectangle([x - 3, y - 3, x + w + 2, y + h + 2], outline=(255, 255, 0, 255), width=2)
        half = (src.size[0] // 2, src.size[1] // 2)
        prev.convert("RGB").resize(half, Image.LANCZOS).save(PREVIEW / f"{name}_cleaned.jpg", quality=88)
        report[name] = info
        print(f"{name}: labels removed={len(boxes)} fake_bg={opts['fake_bg']}")
    (CLEAN / "clean_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
