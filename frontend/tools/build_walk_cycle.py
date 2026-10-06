#!/usr/bin/env python3
"""Cut Sophie's walk-away cycle out of a sheet, for the walks in Scene 2.

The sheet holds the six poses side by side (transparent, or on one flat colour with
--key-background). Each is cut out and placed on one shared canvas, with one shared
scale, the head on the same centre line and the feet on the same baseline, so the
frames can swap in place without her jumping. Written as WebP to
public/assets/scenes/walk-to-cafe/sophie_walk_back_1.webp ... _6.webp.

The poses can also come as separate images, one per frame (--frames), put in stride
order with --order. Generated frames often show only one leg stepping; --mirror-legs
then adds the other stride by mirroring each frame below the hips (the bag and arms
stay where they are), so the cycle alternates feet.

Usage (needs Pillow and numpy), from frontend/:
    python tools/build_walk_cycle.py --sheet ~/Downloads/sophie_walk_back_sheet.png --key-background --preview /tmp/walk.png
    python tools/build_walk_cycle.py --frames ~/Downloads/sophie_walk_away_frame_{1,2,3,4,5,6}_transparent.png \
        --order 4,6,2,5,3,1 --mirror-legs
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from build_world_sprites import HAZE, figure_columns, key_out_background, measure

OUT = Path("public/assets/scenes/walk-to-cafe")
CANVAS = (683, 1024)
HEAD_ROOM = 0.03   # share of the canvas above the tallest head
FEET_LINE = 0.985  # where the feet stand


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--sheet", type=Path, help="one image with every pose side by side")
    source.add_argument("--frames", type=Path, nargs="+", help="one image per pose, in order")
    parser.add_argument("--count", type=int, default=6)
    parser.add_argument("--order", help="stride order of the poses, 1-based, e.g. 4,6,2,5,3,1")
    parser.add_argument("--mirror-legs", action="store_true", help="add the other leg's stride by mirroring below the hips")
    parser.add_argument("--hips", type=float, default=0.6, help="where the mirroring starts, as a share of the canvas height")
    parser.add_argument("--key-background", action="store_true", help="remove a flat background colour first")
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()

    def load(path: Path) -> np.ndarray:
        pixels = np.asarray(Image.open(path).convert("RGBA")).copy()
        if args.key_background:
            key_out_background(pixels)
        pixels[pixels[..., 3] <= HAZE] = 0
        return pixels

    cuts = []
    if args.sheet:
        sheet = load(args.sheet)
        columns = figure_columns(sheet[..., 3])
        assert len(columns) == args.count, f"expected {args.count} poses, found {len(columns)} (try --key-background)"
        cuts = [sheet[:, max(0, start - 4):end + 4] for start, end in columns]
    else:
        assert len(args.frames) == args.count, f"expected {args.count} frames, got {len(args.frames)}"
        for path in args.frames:
            image = load(path)
            # One figure per image: keep its columns, dropping any stray specks beside it.
            columns = figure_columns(image[..., 3])
            start, end = columns[0][0], columns[-1][1]
            pose = np.zeros_like(image)
            pose[:, start:end] = image[:, start:end]
            cuts.append(pose[:, max(0, start - 4):end + 4])

    poses = []
    for pose in cuts:
        top, bottom, head_x = measure(pose[..., 3])
        poses.append((pose, top, bottom, head_x))
    # One scale for all: the tallest pose fills the canvas from HEAD_ROOM to FEET_LINE.
    tallest = max(bottom - top for _, top, bottom, _ in poses)
    width, height = CANVAS
    scale = (height * (FEET_LINE - HEAD_ROOM)) / tallest

    if args.order:
        poses = [poses[int(item) - 1] for item in args.order.split(",")]

    OUT.mkdir(parents=True, exist_ok=True)
    frames = []
    placed = []
    for pose, top, bottom, head_x in poses:
        source = Image.fromarray(pose, "RGBA").convert("RGBa")
        size = (max(1, round(pose.shape[1] * scale)), max(1, round(pose.shape[0] * scale)))
        scaled = source.resize(size, Image.LANCZOS).convert("RGBA")
        frame = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        # Feet on the baseline (a raised foot is a step, not a hop), head on the centre line.
        frame.alpha_composite(scaled, (round(width / 2 - head_x * scale), round(height * FEET_LINE - bottom * scale)))
        placed.append(frame)

    if args.mirror_legs:
        # Below the hips, mirrored about the centre line; a soft band blends the join.
        hips, band = round(height * args.hips), 20
        weight = np.clip((np.arange(height) - (hips - band / 2)) / band, 0, 1)[:, None, None]
        for frame in list(placed):
            pixels = np.asarray(frame, dtype=np.float32)
            # Mirror about the middle of the legs themselves (at the hips), not the canvas,
            # so the mirrored legs meet the body where the real ones do.
            row = np.where(pixels[hips, :, 3] > 60)[0]
            centre = (row.min() + row.max()) / 2
            source_x = np.clip(np.round(2 * centre - np.arange(width)).astype(int), 0, width - 1)
            mirrored = pixels[:, source_x]
            # Premultiplied, so the transparent surround blends cleanly.
            def pre(image):
                return np.concatenate([image[..., :3] * image[..., 3:] / 255, image[..., 3:]], axis=2)
            mixed = pre(pixels) * (1 - weight) + pre(mirrored) * weight
            alpha = mixed[..., 3:]
            rgb = np.where(alpha > 0, mixed[..., :3] * 255 / np.maximum(alpha, 1e-6), 0)
            placed.append(Image.fromarray(np.concatenate([rgb, alpha], axis=2).clip(0, 255).astype(np.uint8), "RGBA"))

    for old in OUT.glob("sophie_walk_back_*.webp"):
        old.unlink()
    for index, frame in enumerate(placed, start=1):
        path = OUT / f"sophie_walk_back_{index}.webp"
        frame.save(path, "WEBP", quality=90, method=6)
        frames.append(frame)
    print(f"{len(frames)} frames in {OUT}, scale {scale:.4f}")

    if args.preview:
        preview = Image.new("RGBA", (width * len(frames), height), (136, 170, 136, 255))
        for i, frame in enumerate(frames):
            preview.alpha_composite(frame, (i * width, 0))
        preview.convert("RGB").save(args.preview)


if __name__ == "__main__":
    main()
