#!/usr/bin/env python3
"""Step 2 of the asset pipeline: cut game-ready sprites out of the cleaned sheets.

Input : art_source/cleaned/*.png  (run tools/clean_sheets.py first)
        tools/sprite_defs.py      (which pixels form which frame/animation)
Output: <group out dir>/<name>_atlas.png   packed frames
        <group out dir>/<name>_sprites.json frame regions, offsets, animations
        <group out dir>/<frame>.png          (art groups: one PNG per image)
        art_source/preview/<name>_contact.png and <name>_<anim>.gif for review

Then run tools/build_sprite_frames.gd inside Godot to turn the JSON files into
SpriteFrames resources (.tres).

Processing per frame
  1. select the frame's pixels on the full-size sheet (component rule / crop)
  2. premultiplied area downscale of the *whole sheet* at the group scale, so
     every frame of a character sits on one shared pixel grid (no sub-pixel
     drift between frames)
  3. characters: alpha cut at 50% (crisp pixel edges); effects: 4 alpha steps
  4. one shared palette per group (no colour flicker between frames)
  5. characters/art: 1 px dark outline for contrast against the backgrounds
  6. anchor = ground point under the character; all frames of a group share
     one virtual cell so the anchor never moves between animations
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_defs as D  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CLEAN = ROOT / "art_source" / "cleaned"
PREVIEW = ROOT / "art_source" / "preview"

_sheet_cache: dict[str, np.ndarray] = {}
_label_cache: dict[tuple, tuple] = {}


def load_sheet(name: str) -> np.ndarray:
    if name not in _sheet_cache:
        img = Image.open(CLEAN / f"{name}.png").convert("RGBA")
        _sheet_cache[name] = np.asarray(img).astype(np.float32) / 255.0
    return _sheet_cache[name]


def labels_for(name: str, thr: int, dil: int):
    key = (name, thr, dil)
    if key not in _label_cache:
        a = load_sheet(name)[..., 3]
        mask = (a * 255 >= thr).astype(np.uint8)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * dil + 1, 2 * dil + 1))
        n, lab = cv2.connectedComponents(cv2.dilate(mask, k), connectivity=8)
        sizes = np.bincount(lab.ravel(), minlength=n)
        _label_cache[key] = (lab, sizes)
    return _label_cache[key]


def select_mask(sheet: np.ndarray, lab: np.ndarray, sizes: np.ndarray, fdef: dict, fname: str) -> np.ndarray:
    h, w = lab.shape
    x0, y0, x1, y1 = fdef["box"]
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
    mask = np.zeros((h, w), bool)
    if fdef.get("hard"):
        mask[y0:y1, x0:x1] = True
    elif "pick" in fdef:
        for (px, py) in fdef["pick"]:
            l = int(lab[py, px])
            if l == 0:
                raise RuntimeError(f"{fname}: pick point {(px, py)} is not on a sprite")
            mask |= lab == l
    else:
        ids, counts = np.unique(lab[y0:y1, x0:x1], return_counts=True)
        for l, c in zip(ids, counts):
            if l != 0 and c / float(sizes[l]) >= 0.6:
                mask |= lab == l
    for (ex0, ey0, ex1, ey1) in fdef.get("erase", []):
        mask[ey0:ey1, ex0:ex1] = False
    mask &= sheet[..., 3] > 0
    if fdef.get("hard"):
        # A hard cut leaves slivers of the neighbouring frame on the border:
        # drop small pieces that touch the crop edge.
        n, cl, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
        for i in range(1, n):
            cx, cy, cw, ch, area = st[i]
            touches = cx <= x0 or cy <= y0 or cx + cw >= x1 or cy + ch >= y1
            if touches and area < 160:
                mask[cl == i] = False
    if not mask.any():
        raise RuntimeError(f"{fname}: selection is empty")
    return mask


def compute_anchor(sheet: np.ndarray, mask: np.ndarray, lab: np.ndarray, method: str, fdef: dict):
    """Ground point (x, y) in sheet coordinates."""
    ys, xs = np.nonzero(mask)
    y_top, y_bot = ys.min(), ys.max()
    x_l, x_r = xs.min(), xs.max()
    if method == "center":
        ax, ay = (x_l + x_r + 1) / 2.0, (y_top + y_bot + 1) / 2.0
    elif method == "bottom":
        ax, ay = (x_l + x_r + 1) / 2.0, y_bot + 1.0
    else:
        # main body = the component under fdef["body"], else the largest one
        if "body" in fdef:
            bx, by = fdef["body"]
            body = mask & (lab == lab[by, bx])
        else:
            ids, counts = np.unique(lab[mask], return_counts=True)
            counts[ids == 0] = 0
            body = mask & (lab == ids[np.argmax(counts)])
        bys, bxs = np.nonzero(body)
        by_top, by_bot = bys.min(), bys.max()
        ay = by_bot + 1.0
        if method == "dark_head":
            # Hero: hair and boots are very dark and only slightly blue. The
            # cape, sword trails and magic are bright or strongly blue, so
            # they are excluded. Head = dark pixels in the upper 40% (x),
            # feet = lowest dark pixel (y).
            rgb = sheet[..., :3] * 255
            lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
            dark = body & (lum < 50) & ((rgb[..., 2] - rgb[..., 0]) < 45) & (sheet[..., 3] > 0.5)
            band = np.zeros_like(body)
            band[by_top:int(by_top + 0.4 * (by_bot - by_top)) + 1] = True
            sel = dark & band
            ax = float(np.nonzero(sel)[1].mean()) if sel.sum() > 30 else float(bxs.mean())
            if dark.sum() > 30:
                ay = float(np.nonzero(dark)[0].max()) + 1.0
        elif method == "mass_top":
            band = bys < by_top + 0.45 * (by_bot - by_top)
            ax = float(bxs[band].mean())
        else:  # "mass"
            ax = float(bxs.mean())
    if "ax" in fdef:
        ax = float(fdef["ax"])
    if "ay" in fdef:
        ay = float(fdef["ay"])
    return ax, ay


def downscale(sheet: np.ndarray, mask: np.ndarray, scale: float):
    """Premultiplied area downscale of the masked full sheet (shared grid)."""
    pm = sheet.copy()
    pm[..., :3] *= pm[..., 3:4]
    pm[~mask] = 0.0
    h, w = mask.shape
    small = cv2.resize(pm, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    a = small[..., 3:4]
    rgb = np.where(a > 1e-4, small[..., :3] / np.maximum(a, 1e-4), 0.0)
    return np.clip(rgb, 0, 1), a[..., 0]


def outline_rgba(img: np.ndarray, color) -> np.ndarray:
    op = img[..., 3] > 0
    nb = np.zeros_like(op)
    nb[1:, :] |= op[:-1, :]
    nb[:-1, :] |= op[1:, :]
    nb[:, 1:] |= op[:, :-1]
    nb[:, :-1] |= op[:, 1:]
    edge = nb & ~op
    out = img.copy()
    out[edge] = (*color, 255)
    return out


def build_palette(images: list[np.ndarray], colors: int) -> Image.Image:
    px = np.concatenate([im[..., :3][im[..., 3] > 0] for im in images], axis=0)
    if len(px) == 0:
        raise RuntimeError("no opaque pixels for palette")
    side = int(math.ceil(math.sqrt(len(px))))
    pad = np.zeros((side * side - len(px), 3), np.uint8) + px[0]
    mosaic = Image.fromarray(np.concatenate([px, pad]).reshape(side, side, 3), "RGB")
    return mosaic.quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def apply_palette(img: np.ndarray, pal: Image.Image) -> np.ndarray:
    rgb = Image.fromarray(np.ascontiguousarray(img[..., :3]), "RGB")
    q = np.asarray(rgb.quantize(palette=pal, dither=Image.Dither.NONE).convert("RGB"))
    out = np.concatenate([q, img[..., 3:4]], axis=2)
    out[img[..., 3] == 0] = 0
    return out


def pack(frames: dict[str, np.ndarray], max_w: int = 1024, pad: int = 2):
    order = sorted(frames, key=lambda k: (-frames[k].shape[0], k))
    x = y = shelf_h = 0
    pos = {}
    width = 0
    for k in order:
        h, w = frames[k].shape[:2]
        if x + w + pad > max_w and x > 0:
            x, y, shelf_h = 0, y + shelf_h + pad, 0
        pos[k] = (x, y)
        x += w + pad
        width = max(width, x)
        shelf_h = max(shelf_h, h)
    height = y + shelf_h
    atlas = np.zeros((height, width, 4), np.uint8)
    for k, (px, py) in pos.items():
        h, w = frames[k].shape[:2]
        atlas[py:py + h, px:px + w] = frames[k]
    return atlas, pos


def build_group(g: dict) -> dict:
    name, kind, scale = g["name"], g["kind"], g["scale"]
    sheet = load_sheet(g["sheet"])
    lab, sizes = labels_for(g["sheet"], g.get("thr", 100), g.get("dil", 2))
    raw: dict[str, np.ndarray] = {}
    anchors: dict[str, tuple[int, int]] = {}
    for fname, fdef in g["frames"].items():
        mask = select_mask(sheet, lab, sizes, fdef, f"{name}.{fname}")
        ax, ay = compute_anchor(sheet, mask, lab, g.get("anchor", "mass"), fdef)
        rgb, a = downscale(sheet, mask, scale)
        if kind == "fx":
            levels = np.array([0.0, 0.35, 0.7, 1.0])
            a_q = np.where(a < 0.12, 0.0, levels[np.clip(np.round(a * 3), 1, 3).astype(int)])
        else:
            a_q = (a >= 0.5).astype(np.float32)
        img = np.concatenate([rgb, a_q[..., None]], axis=2)
        img = (img * 255 + 0.5).astype(np.uint8)
        img[img[..., 3] == 0] = 0
        ys, xs = np.nonzero(img[..., 3])
        if len(ys) == 0:
            raise RuntimeError(f"{name}.{fname}: nothing left after downscale")
        # 1 px margin for the outline
        y0, y1 = max(0, ys.min() - 1), ys.max() + 2
        x0, x1 = max(0, xs.min() - 1), xs.max() + 2
        raw[fname] = img[y0:y1, x0:x1]
        anchors[fname] = (int(round(ax * scale)) - x0, int(round(ay * scale)) - y0)

    pal = build_palette(list(raw.values()), g.get("colors", 48))
    frames = {}
    for fname, img in raw.items():
        q = apply_palette(img, pal) if kind != "fx" else apply_palette_fx(img, pal)
        if g.get("outline") and kind != "fx":
            q = outline_rgba(q, g["outline"])
        # trim to content
        ys, xs = np.nonzero(q[..., 3])
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        frames[fname] = q[y0:y1, x0:x1]
        anchors[fname] = (anchors[fname][0] - x0, anchors[fname][1] - y0)

    # shared virtual cell: anchor fixed at (left, top) for every frame
    left = max(a[0] for a in anchors.values())
    top = max(a[1] for a in anchors.values())
    right = max(frames[f].shape[1] - anchors[f][0] for f in frames)
    bottom = max(frames[f].shape[0] - anchors[f][1] for f in frames)
    left, top = int(left), int(top)
    cell = (int(left + right), int(top + bottom))

    atlas, pos = pack(frames)
    out_dir = ROOT / g["out"]
    out_dir.mkdir(parents=True, exist_ok=True)
    atlas_path = out_dir / f"{name}_atlas.png"
    Image.fromarray(atlas, "RGBA").save(atlas_path, optimize=True)
    meta = {
        "name": name,
        "source_sheet": f"art_source/original/{g['sheet']}.png",
        "kind": kind,
        "scale": scale,
        "atlas": "res://" + str(atlas_path.relative_to(ROOT)).replace(os.sep, "/"),
        "cell": list(cell),
        "anchor": [left, top],
        "frames": {},
        "animations": {},
    }
    for fname, img in frames.items():
        px, py = pos[fname]
        h, w = img.shape[:2]
        meta["frames"][fname] = {
            "region": [px, py, w, h],
            "offset": [left - anchors[fname][0], top - anchors[fname][1]],
            "source_box": list(g["frames"][fname]["box"]),
        }
    for aname, (flist, fps, loop) in g.get("anims", {}).items():
        meta["animations"][aname] = {"frames": flist, "fps": fps, "loop": loop}
    if kind in ("fx", "art"):
        # each image is also its own one-frame animation / standalone PNG
        for fname, img in frames.items():
            meta["animations"].setdefault(fname, {"frames": [fname], "fps": 1, "loop": False})
            Image.fromarray(img, "RGBA").save(out_dir / f"{fname}.png", optimize=True)
    (out_dir / f"{name}_sprites.json").write_text(
        json.dumps(meta, indent=1, ensure_ascii=False, default=_json_num))
    write_previews(name, frames, meta)
    return meta


def _json_num(o):
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return float(o)
    raise TypeError(type(o))


def apply_palette_fx(img: np.ndarray, pal: Image.Image) -> np.ndarray:
    q = apply_palette(img, pal)
    q[..., 3] = img[..., 3]
    q[img[..., 3] == 0] = 0
    return q


def compose_cell(frames, meta, fname) -> Image.Image:
    cw, ch = meta["cell"]
    cell = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ox, oy = meta["frames"][fname]["offset"]
    cell.alpha_composite(Image.fromarray(frames[fname], "RGBA"), (ox, oy))
    return cell


def write_previews(name: str, frames: dict, meta: dict, zoom: int = 3) -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)
    cw, ch = meta["cell"]
    ax, ay = meta["anchor"]
    anims = meta["animations"] if meta["kind"] == "character" else {"all": {"frames": list(frames)}}
    rows = list(anims.items())
    cols = max(len(a["frames"]) for _, a in rows)
    if meta["kind"] != "character":
        cols = min(cols, 6)
        flat = rows[0][1]["frames"]
        rows = [(f"r{i}", {"frames": flat[i:i + cols]}) for i in range(0, len(flat), cols)]
    sheet = Image.new("RGBA", (cols * (cw + 4) + 4, len(rows) * (ch + 4) + 4), (52, 70, 58, 255))
    d = ImageDraw.Draw(sheet)
    for r, (_, a) in enumerate(rows):
        for c, f in enumerate(a["frames"]):
            x, y = 4 + c * (cw + 4), 4 + r * (ch + 4)
            d.rectangle([x - 1, y - 1, x + cw, y + ch], outline=(90, 110, 98, 255))
            sheet.alpha_composite(compose_cell(frames, meta, f), (x, y))
            if meta["kind"] == "character":
                d.line([(x + ax - 3, y + ay), (x + ax + 3, y + ay)], fill=(255, 60, 60, 255))
                d.line([(x + ax, y + ay - 3), (x + ax, y + ay)], fill=(255, 60, 60, 255))
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    sheet.convert("RGB").save(PREVIEW / f"{name}_contact.png")
    if meta["kind"] != "character":
        return
    for aname, a in meta["animations"].items():
        imgs = []
        for f in a["frames"]:
            bg = Image.new("RGBA", (cw + 8, ch + 8), (40, 56, 46, 255))
            dd = ImageDraw.Draw(bg)
            dd.line([(0, ay + 4), (cw + 8, ay + 4)], fill=(120, 90, 60, 255))
            bg.alpha_composite(compose_cell(frames, meta, f), (4, 4))
            imgs.append(bg.resize((bg.width * zoom, bg.height * zoom), Image.NEAREST).convert("RGB"))
        dur = int(1000 / max(1, a["fps"]))
        imgs[0].save(PREVIEW / f"{name}_{aname}.gif", save_all=True, append_images=imgs[1:],
                     duration=dur, loop=0)


def main(selected: list[str]) -> None:
    summary = {}
    for g in D.GROUPS:
        if selected and g["name"] not in selected:
            continue
        meta = build_group(g)
        summary[g["name"]] = {"frames": len(meta["frames"]), "cell": meta["cell"],
                              "animations": len(meta["animations"])}
        print(f"{g['name']:12s} frames={len(meta['frames']):3d} cell={meta['cell']} -> {g['out']}")
    (PREVIEW / "build_summary.json").write_text(json.dumps(summary, indent=1, default=_json_num))


if __name__ == "__main__":
    main(sys.argv[1:])
