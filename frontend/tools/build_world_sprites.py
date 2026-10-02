#!/usr/bin/env python3
"""Turn a sheet of full-body poses into world frames for one character.

The sheet holds one or more figures side by side on a transparent background
(or on one flat colour, with --key-background). Each figure is cut out, cleaned
of faint background haze, and placed on a shared canvas with the head at the
same position and one shared scale, so swapping between frames never makes the
character jump or resize.

With a reference image (by default the character's world/idle.png, when it
exists) the frames match that image's canvas, height and head position. Without
one, the first run for a character sets them: the tallest figure fills the
canvas from HEAD_ROOM down to the feet line.

Usage (needs Pillow and numpy), from frontend/:
    python tools/build_world_sprites.py --character sophie --name walking --sheet tools/sources/sophie-walk-sheet.webp
    python tools/build_world_sprites.py --character player --name idle --sheet tools/sources/player-idle.png --canvas 320x480
    python tools/build_world_sprites.py --character player --name walking-side --sheet tools/sources/player-walk-side.png

One figure is written as <name>.png, several as <name>-1.png, <name>-2.png, ...
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ASSETS = Path("public/assets/characters")
SOLID = 60          # alpha above this counts as figure when measuring
HAZE = 24           # alpha at or below this is leftover background and is removed
HEAD_FRACTION = 0.14  # top share of a figure used to find the head's centre line
HEAD_ROOM = 0.04    # share of the canvas left empty above the head when there is no reference
FEET_LINE = 0.985   # where the feet sit on the canvas when there is no reference
KEY_TOLERANCE = 38  # how far a colour may be from the background and still be removed


def figure_columns(alpha: np.ndarray):
    """Column ranges that contain a figure, left to right."""
    filled = (alpha > SOLID).sum(axis=0) > 2
    runs, start = [], None
    for x, on in enumerate(filled):
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append((start, x))
            start = None
    if start is not None:
        runs.append((start, len(filled)))
    # A hand or a strand of hair can leave a sliver; a figure is wider than that.
    widest = max((end - start for start, end in runs), default=0)
    return [(start, end) for start, end in runs if end - start >= widest * 0.25]


def measure(alpha: np.ndarray):
    """Top, bottom and head centre of the figure in an alpha channel."""
    solid = alpha > SOLID
    rows = np.where(solid.any(axis=1))[0]
    top, bottom = int(rows.min()), int(rows.max())
    head_rows = solid[top:top + max(1, int((bottom - top) * HEAD_FRACTION))]
    head_x = float(np.where(head_rows.any(axis=0))[0].mean())
    return top, bottom, head_x


def key_out_background(pixels: np.ndarray) -> None:
    """Make a flat background transparent, judged from the four corners."""
    corners = np.array([pixels[0, 0, :3], pixels[0, -1, :3], pixels[-1, 0, :3], pixels[-1, -1, :3]], dtype=float)
    background = np.median(corners, axis=0)
    distance = np.abs(pixels[..., :3].astype(float) - background).max(axis=2)
    # Fully clear at the background colour, fading in over the tolerance for a clean edge.
    alpha = np.clip((distance - KEY_TOLERANCE / 2) / (KEY_TOLERANCE / 2), 0, 1)
    pixels[..., 3] = (pixels[..., 3] * alpha).astype(np.uint8)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--character", required=True, help="catalog ID, e.g. sophie or player")
    parser.add_argument("--name", required=True, help="output name: idle, walking, walking-side, walking-back, waving, ...")
    parser.add_argument("--sheet", type=Path, required=True)
    parser.add_argument("--reference", type=Path, help="image whose canvas, figure height and head position to match")
    parser.add_argument("--canvas", default="320x480", help="canvas for a character's first image, WIDTHxHEIGHT")
    parser.add_argument("--count", type=int, help="fail unless the sheet holds exactly this many figures")
    parser.add_argument("--key-background", action="store_true", help="remove a flat background colour first")
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()

    world_dir = ASSETS / args.character / "world"
    world_dir.mkdir(parents=True, exist_ok=True)
    reference_path = args.reference or world_dir / "idle.png"

    sheet = np.asarray(Image.open(args.sheet).convert("RGBA")).copy()
    if args.key_background:
        key_out_background(sheet)
    sheet[sheet[..., 3] <= HAZE] = 0
    columns = figure_columns(sheet[..., 3])
    assert columns, "no figure found: is the background transparent? (try --key-background)"
    assert args.count is None or len(columns) == args.count, f"expected {args.count} poses, found {len(columns)}"

    poses = []
    for start, end in columns:
        pose = sheet[:, max(0, start - 4):end + 4]
        top, bottom, head_x = measure(pose[..., 3])
        poses.append((pose, top, bottom, head_x))
    tallest = max(bottom - top for _, top, bottom, _ in poses)

    if reference_path.exists() and reference_path.resolve() != (world_dir / f"{args.name}.png").resolve():
        reference = Image.open(reference_path).convert("RGBA")
        canvas = reference.size
        ref_top, ref_bottom, ref_head_x = measure(np.asarray(reference)[..., 3])
        # One scale for every pose: the tallest reaches the reference figure's feet.
        scale = (ref_bottom - ref_top) / tallest
        print(f"matching {reference_path}: figure spans y={ref_top}..{ref_bottom} on {canvas[0]}x{canvas[1]}")
    else:
        width, height = (int(value) for value in args.canvas.lower().split("x"))
        canvas = (width, height)
        ref_top, ref_head_x = round(height * HEAD_ROOM), width / 2
        scale = (height * FEET_LINE - ref_top) / tallest
        print(f"no reference: setting the character's canvas to {width}x{height}")

    frames = []
    for index, (pose, top, bottom, head_x) in enumerate(poses, start=1):
        # Resize with premultiplied alpha so edges do not pick up a dark fringe.
        source = Image.fromarray(pose, "RGBA").convert("RGBa")
        size = (max(1, round(pose.shape[1] * scale)), max(1, round(pose.shape[0] * scale)))
        scaled = source.resize(size, Image.LANCZOS).convert("RGBA")
        frame = Image.new("RGBA", canvas, (0, 0, 0, 0))
        frame.alpha_composite(scaled, (round(ref_head_x - head_x * scale), round(ref_top - top * scale)))
        filename = f"{args.name}.png" if len(poses) == 1 else f"{args.name}-{index}.png"
        frame.save(world_dir / filename, optimize=True)
        frames.append(frame)
        print(f"{filename}: pose height {bottom - top}px -> {round((bottom - top) * scale)}px, head at x={ref_head_x:.1f}")
    print(f"scale {scale:.4f}; {len(frames)} frame(s) in {world_dir}")

    if args.preview:
        preview = Image.new("RGBA", (canvas[0] * len(frames), canvas[1]), (136, 170, 136, 255))
        for i, cell in enumerate(frames):
            preview.alpha_composite(cell, (i * canvas[0], 0))
        preview.convert("RGB").save(args.preview)


if __name__ == "__main__":
    main()
