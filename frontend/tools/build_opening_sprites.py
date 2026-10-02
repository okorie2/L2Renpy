#!/usr/bin/env python3
"""Large full-body frames of Sophie for the opening in the park.

The world frames (characters/sophie/world, 320x480) are drawn small on the
street. In the opening she walks up to the camera and fills much of the
screen, so she needs bigger art: the original Ren'Py full-body images
(sources/sophie-casual.png, sources/sophie-waving.png, 1024x1536) and the
six-pose walk sheet, put on one canvas with one scale and the head in one
place, so swapping frames never makes her jump.

Usage (needs Pillow and numpy), from frontend/:
    python tools/build_opening_sprites.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

from build_world_sprites import HAZE, figure_columns, measure

SOURCES = Path("tools/sources")
OUT = Path("public/assets/characters/sophie/opening")
CANVAS = (683, 1024)


def resize(pose: np.ndarray, scale: float) -> Image.Image:
    # Premultiplied alpha, so edges do not pick up a dark fringe.
    source = Image.fromarray(pose, "RGBA").convert("RGBa")
    size = (max(1, round(pose.shape[1] * scale)), max(1, round(pose.shape[0] * scale)))
    return source.resize(size, Image.LANCZOS).convert("RGBA")


def place(pose: np.ndarray, scale: float, top: int, head_x: float, ref_top: float, ref_head_x: float) -> Image.Image:
    frame = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    frame.alpha_composite(resize(pose, scale), (round(ref_head_x - head_x * scale), round(ref_top - top * scale)))
    return frame


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # The standing image sets the canvas: it is scaled to fit, and the others match it.
    idle = np.asarray(Image.open(SOURCES / "sophie-casual.png").convert("RGBA")).copy()
    idle[idle[..., 3] <= HAZE] = 0
    base = CANVAS[1] / idle.shape[0]
    top, bottom, head_x = measure(idle[..., 3])
    ref_top, ref_head_x, ref_height = top * base, head_x * base, (bottom - top) * base
    place(idle, base, top, head_x, ref_top, ref_head_x).save(OUT / "idle.webp", quality=88)

    waving = np.asarray(Image.open(SOURCES / "sophie-waving.png").convert("RGBA")).copy()
    waving[waving[..., 3] <= HAZE] = 0
    w_top, w_bottom, w_head = measure(waving[..., 3])
    place(waving, base, w_top, w_head, ref_top, ref_head_x).save(OUT / "waving.webp", quality=88)

    sheet = np.asarray(Image.open(SOURCES / "sophie-walk-front.webp").convert("RGBA")).copy()
    sheet[sheet[..., 3] <= HAZE] = 0
    poses = []
    for start, end in figure_columns(sheet[..., 3]):
        pose = sheet[:, max(0, start - 4):end + 4]
        p_top, p_bottom, p_head = measure(pose[..., 3])
        poses.append((pose, p_top, p_bottom, p_head))
    tallest = max(p_bottom - p_top for _, p_top, p_bottom, _ in poses)
    scale = ref_height / tallest
    for index, (pose, p_top, _, p_head) in enumerate(poses, start=1):
        place(pose, scale, p_top, p_head, ref_top, ref_head_x).save(OUT / f"walking-{index}.webp", quality=88)
    print(f"{len(poses)} walking frames, idle and waving on {CANVAS[0]}x{CANVAS[1]} in {OUT}")


if __name__ == "__main__":
    main()
