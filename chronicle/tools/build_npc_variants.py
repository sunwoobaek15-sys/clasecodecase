"""Phase 3: NPC variants that the reference sheets do not contain.

The spec asks for a village guard, but sheet 03 has no guard design. The
guard is made from the hero-style NPC in column 1 of that sheet (same art,
same palette rules) by recolouring it: the blue cape becomes crimson and the
black hair becomes a steel helmet tone, so it reads as a different character
in the same style. This is a stand-in until a real guard design exists.

Run after build_sprites.py:  python3 tools/build_npc_variants.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def recolor_guard(src: Path, dst: Path, head_frac: float, cape_from: float) -> None:
    img = np.asarray(Image.open(src).convert("RGBA")).astype(np.float32) / 255.0
    rgb, a = img[..., :3], img[..., 3]
    hsv = np.asarray(Image.fromarray((rgb * 255).astype(np.uint8)).convert("HSV")).astype(np.float32) / 255.0
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    out = hsv.copy()
    rows = np.nonzero(a.max(axis=1) > 0)[0]
    top, bot = rows.min(), rows.max()
    yy = (np.arange(a.shape[0])[:, None] - top) / float(bot - top) + np.zeros_like(a)
    # cape: blue pixels below cape_from (the eyes keep their colour)
    blue = (h > 0.52) & (h < 0.72) & (s > 0.25) & (a > 0) & (yy > cape_from)
    out[..., 0] = np.where(blue, 0.985, h)          # crimson
    out[..., 2] = np.where(blue, np.clip(v * 0.92, 0, 1), v)
    # hair -> steel helmet: dark pixels at the top, fading out towards the face
    w = np.clip((head_frac - yy) / (0.35 * head_frac), 0.0, 1.0)
    hair = (v < 0.55) & (a > 0) & (w > 0) & ~blue
    gray_v = np.clip(0.2 + v * 1.25, 0, 0.78)
    out[..., 0] = np.where(hair, 0.6, out[..., 0])
    out[..., 1] = np.where(hair, s * (1 - w) + 0.10 * w, out[..., 1])
    out[..., 2] = np.where(hair, v * (1 - w) + gray_v * w, out[..., 2])
    rgb2 = np.asarray(Image.fromarray((out * 255).astype(np.uint8), "HSV").convert("RGB")).astype(np.float32) / 255.0
    res = np.concatenate([rgb2, a[..., None]], axis=2)
    dst.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray((res * 255 + 0.5).astype(np.uint8), "RGBA").save(dst, optimize=True)


def main() -> None:
    base = ROOT / "assets" / "npcs"
    recolor_guard(base / "hero_npc" / "full.png", base / "guard" / "full.png", 0.2, 0.2)
    recolor_guard(base / "hero_npc" / "portrait.png", base / "guard" / "portrait.png", 0.45, 0.62)
    print("guard variant -> assets/npcs/guard/")


if __name__ == "__main__":
    main()
