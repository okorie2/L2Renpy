#!/usr/bin/env python3
"""Build Sophie's open-mouth overlays from the L2Renpy source portraits.

Each expression's closed-mouth portrait is the master image. The separately
generated open-mouth portrait is aligned to it around the mouth, colour-matched,
and only a feathered mouth patch is kept. Laying that patch over the master
changes nothing but the mouth, so speaking never makes the rest of her shimmer.

Usage (needs Pillow and numpy):
    python tools/build_mouth_overlays.py --l2renpy /path/to/L2Renpy [--preview out.png]

Writes public/assets/characters/sophie/conversation/<expression>/mouth-open.png
and prints the rectangle to record in src/characters/catalog.ts.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

SOURCE_DIR = "game/images/characters/sophie/scene_1"
PAIRS = {
    "neutral": ("neutral_closed.png", "neutral_speaking.png"),
    "question": ("question_closed.png", "question_opened.png"),
    "explaining": ("explain_closed.png", "explain_speaking.png"),
    "encouraging": ("encouraging_closed.png", "encouraging_opened.png"),
}

# Geometry in the shared 1024x1536 canvas. The closed mouth sits at the same
# place in every approved pose.
MOUTH_CENTER = (508, 404)
CORE_RADII = (60, 34)      # fully replaced
FEATHER = 14               # soft edge outside the core
OVERLAY_RECT = (428, 352, 160, 104)   # x, y, width, height
ALIGN_BOX = (398, 300, 618, 470)      # nose-to-chin area used to register the faces
SEARCH = 34                # pixels of translation searched each way
SCALES = (0.94, 0.96, 0.98, 1.0, 1.02, 1.04, 1.06)


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGBA"), dtype=np.float32)


def ellipse_distance(shape, center, radii):
    ys, xs = np.mgrid[0:shape[0], 0:shape[1]]
    return np.sqrt(((xs - center[0]) / radii[0]) ** 2 + ((ys - center[1]) / radii[1]) ** 2)


def mouth_mask(shape) -> np.ndarray:
    """1 inside the core ellipse, easing to 0 across the feather."""
    outer = (CORE_RADII[0] + FEATHER, CORE_RADII[1] + FEATHER)
    inner = ellipse_distance(shape, MOUTH_CENTER, CORE_RADII)
    edge = ellipse_distance(shape, MOUTH_CENTER, outer)
    # Position across the feather band: 0 at the core edge, 1 at the outer edge.
    band = (inner - 1) / np.maximum((inner - 1) + (1 - edge), 1e-6)
    t = np.where(inner <= 1, 0.0, np.where(edge >= 1, 1.0, band))
    return (0.5 + 0.5 * np.cos(np.pi * t)).astype(np.float32)


def scaled(image: np.ndarray, scale: float) -> np.ndarray:
    """Scale about the mouth centre so translation search stays small."""
    if scale == 1.0:
        return image
    cx, cy = MOUTH_CENTER
    height, width = image.shape[:2]
    inverse = 1 / scale
    matrix = (inverse, 0, cx - cx * inverse, 0, inverse, cy - cy * inverse)
    pil = Image.fromarray(image.astype(np.uint8), "RGBA")
    return np.asarray(pil.transform((width, height), Image.AFFINE, matrix, Image.BICUBIC), dtype=np.float32)


def register(closed: np.ndarray, speaking: np.ndarray):
    """Find the scale and shift that best lay the speaking face over the closed one."""
    x0, y0, x1, y1 = ALIGN_BOX
    # Compare the face around the mouth, not the mouth itself: that is what differs on purpose.
    weight = (ellipse_distance(closed.shape, MOUTH_CENTER, (CORE_RADII[0] + 6, CORE_RADII[1] + 6)) > 1)[y0:y1, x0:x1]
    target = closed[y0:y1, x0:x1, :3]
    best = (np.inf, 1.0, 0, 0)
    for scale in SCALES:
        candidate = scaled(speaking, scale)
        for dy in range(-SEARCH, SEARCH + 1, 2):
            for dx in range(-SEARCH, SEARCH + 1, 2):
                window = candidate[y0 - dy:y1 - dy, x0 - dx:x1 - dx, :3]
                error = float(np.abs(window - target).mean(axis=2)[weight].mean())
                if error < best[0]:
                    best = (error, scale, dx, dy)
    _, scale, cx, cy = best
    candidate = scaled(speaking, scale)
    for dy in range(cy - 1, cy + 2):
        for dx in range(cx - 1, cx + 2):
            window = candidate[y0 - dy:y1 - dy, x0 - dx:x1 - dx, :3]
            error = float(np.abs(window - target).mean(axis=2)[weight].mean())
            if error < best[0]:
                best = (error, scale, dx, dy)
    error, scale, dx, dy = best
    return np.roll(scaled(speaking, scale), (dy, dx), axis=(0, 1)), scale, dx, dy, error


def build(closed: np.ndarray, speaking: np.ndarray):
    aligned, scale, dx, dy, error = register(closed, speaking)
    mask = mouth_mask(closed.shape)
    # Match skin tone where the patch blends in, so no halo shows around the mouth.
    ring = (mask > 0.02) & (mask < 0.6)
    offset = (closed[..., :3][ring] - aligned[..., :3][ring]).mean(axis=0)
    patch = np.clip(aligned[..., :3] + offset, 0, 255)

    x, y, width, height = OVERLAY_RECT
    overlay = np.dstack([patch, mask * 255])[y:y + height, x:x + width]
    assert mask[:y].max() == 0 and mask[y + height:].max() == 0, "overlay rect clips the mask"
    assert mask[:, :x].max() == 0 and mask[:, x + width:].max() == 0, "overlay rect clips the mask"
    return overlay.round().astype(np.uint8), (scale, dx, dy, error, offset)


def composite(closed: np.ndarray, overlay: np.ndarray) -> np.ndarray:
    x, y, width, height = OVERLAY_RECT
    result = closed.copy()
    alpha = overlay[..., 3:4].astype(np.float32) / 255
    region = result[y:y + height, x:x + width, :3]
    result[y:y + height, x:x + width, :3] = region * (1 - alpha) + overlay[..., :3] * alpha
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--l2renpy", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=Path("public/assets/characters/sophie/conversation"))
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()

    previews = []
    for expression, (closed_name, speaking_name) in PAIRS.items():
        closed = load(args.l2renpy / SOURCE_DIR / closed_name)
        speaking = load(args.l2renpy / SOURCE_DIR / speaking_name)
        overlay, (scale, dx, dy, error, offset) = build(closed, speaking)
        target = args.out / expression / "mouth-open.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(overlay, "RGBA").save(target, optimize=True)
        print(f"{expression}: scale {scale:.2f} shift ({dx},{dy}) residual {error:.1f} tone {[round(float(v), 1) for v in offset]} -> {target}")
        if args.preview:
            box = (368, 300, 648, 500)
            crop = lambda image: image[box[1]:box[3], box[0]:box[2], :3]
            previews.append(np.vstack([crop(closed), crop(composite(closed, overlay)), crop(speaking)]))
    if args.preview:
        Image.fromarray(np.hstack(previews).astype(np.uint8), "RGB").save(args.preview)
    x, y, width, height = OVERLAY_RECT
    print(f"catalog rect: {{ x: {x}, y: {y}, width: {width}, height: {height} }} on a 1024x1536 canvas")


if __name__ == "__main__":
    main()
