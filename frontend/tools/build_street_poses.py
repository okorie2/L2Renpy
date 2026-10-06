#!/usr/bin/env python3
"""Sophie's standing poses for the street, on the walk cycle's canvas and scale.

When she stops walking to talk she must stay exactly where she was, the same size,
so these poses are cut out and placed like the walk frames (tools/build_walk_cycle.py):
683x1024 canvas, head on the centre line, feet on the same baseline, and the same
scale as the walk cycle, measured from its first frame (whose source image must sit beside the pose images). Written as
public/assets/scenes/walk-to-cafe/sophie_street_<pose>.webp.

Usage (needs Pillow and numpy), from frontend/:
    python tools/build_street_poses.py glance=~/Downloads/sophie_glance.png greeting=~/Downloads/sophie_greet_side.png ...
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from build_world_sprites import HAZE, figure_columns, measure

OUT = Path("public/assets/scenes/walk-to-cafe")
CANVAS = (683, 1024)
FEET_LINE = 0.985


def cut(path: Path) -> np.ndarray:
    pixels = np.asarray(Image.open(path).convert("RGBA")).copy()
    pixels[pixels[..., 3] <= HAZE] = 0
    columns = figure_columns(pixels[..., 3])
    start, end = columns[0][0], columns[-1][1]
    pose = np.zeros_like(pixels)
    pose[:, start:end] = pixels[:, start:end]
    return pose


def main():
    # The walk cycle's own scale: its first frame's figure against its source's figure.
    walk = np.asarray(Image.open(OUT / "sophie_walk_back_1.webp").convert("RGBA"))
    walk_top, walk_bottom, _ = measure(walk[..., 3])
    reference = cut(Path(sys.argv[1].split("=", 1)[1]).expanduser().parent / "ChatGPT Image Oct 4, 2026, 12_24_35 PM-5.png")
    ref_top, ref_bottom, _ = measure(reference[..., 3])
    scale = (walk_bottom - walk_top) / (ref_bottom - ref_top)
    width, height = CANVAS
    for item in sys.argv[1:]:
        name, source = item.split("=", 1)
        pose = cut(Path(source).expanduser())
        top, bottom, head_x = measure(pose[..., 3])
        image = Image.fromarray(pose, "RGBA").convert("RGBa")
        scaled = image.resize((round(pose.shape[1] * scale), round(pose.shape[0] * scale)), Image.LANCZOS).convert("RGBA")
        frame = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        frame.alpha_composite(scaled, (round(width / 2 - head_x * scale), round(height * FEET_LINE - bottom * scale)))
        path = OUT / f"sophie_street_{name}.webp"
        frame.save(path, "WEBP", quality=90, method=6)
        print(f"{path}: {bottom - top}px tall -> {round((bottom - top) * scale)}px")


if __name__ == "__main__":
    main()
