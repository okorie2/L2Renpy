#!/usr/bin/env python3
"""Build a character's conversation portraits so the head never moves between them.

The first image given is the base (usually `neutral`): it sets the canvas and
where the head is. Every other expression is cut from its own image (or from one
figure of a sheet holding several people), then scaled and placed so that its
head has the same size and position as the base's. Expressions made separately
never line up by themselves; this is what makes swapping between them steady.

Head size is measured from the top of the hair to the narrowest point of the
neck, which works for any hairstyle as long as it is the same person.

Usage (needs Pillow and numpy), from frontend/:
    python tools/build_portraits.py --character barista \\
        --base neutral=tools/sources/nadia-portrait-neutral.webp \\
        --expression explaining=tools/sources/portraits-explaining.webp#2 \\
        --expression question=tools/sources/portraits-question.webp#1

`#N` picks the Nth figure from the left in a sheet (1-based). Writes
public/assets/characters/<character>/conversation/<expression>/closed.webp.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ASSETS = Path("public/assets/characters")
CANVAS = (1024, 1536)
SOLID = 60
HAZE = 24
DRIFT = 0.05  # how far one expression's scale may differ from the others before it is evened out


def figures(pixels: np.ndarray):
    """Each figure of a sheet as its own image, left to right."""
    filled = (pixels[..., 3] > SOLID).sum(axis=0) > 2
    runs, start = [], None
    for x, on in enumerate(filled):
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append((start, x))
            start = None
    if start is not None:
        runs.append((start, len(filled)))
    widest = max(end - start for start, end in runs)
    return [pixels[:, max(0, start - 2):end + 2] for start, end in runs if end - start >= widest * 0.25]


def head(alpha: np.ndarray):
    """Top of the head, its centre line, and the row of the narrowest point of the neck."""
    solid = alpha > SOLID
    rows = np.where(solid.any(axis=1))[0]
    top, bottom = int(rows.min()), int(rows.max())
    height = bottom - top
    crown = solid[top:top + max(4, int(height * 0.07))]
    centre = int(round(np.where(crown.any(axis=0))[0].mean()))

    def width_at(y):
        row = solid[y]
        if not row[centre]:
            return 0
        left = centre
        while left > 0 and row[left - 1]:
            left -= 1
        right = centre
        while right < len(row) - 1 and row[right + 1]:
            right += 1
        return right - left + 1

    span = range(top, top + int(height * 0.5))
    widths = np.array([width_at(y) for y in span], dtype=float)
    widths = np.convolve(widths, np.ones(9) / 9, mode="same")
    # The head is the first wide part; the neck is the narrowest row before the shoulders spread out.
    head_end = int(len(widths) * 0.25)
    widest = int(np.argmax(widths[:max(head_end, 10)]))
    shoulders = next((i for i in range(widest, len(widths)) if widths[i] > widths[widest] * 1.35), len(widths) - 1)
    neck = widest + int(np.argmin(widths[widest:shoulders + 1]))
    return top, centre, top + neck


def load(spec: str) -> np.ndarray:
    path, _, index = spec.partition("#")
    pixels = np.asarray(Image.open(path).convert("RGBA")).copy()
    pixels[pixels[..., 3] <= HAZE] = 0
    if index:
        found = figures(pixels)
        assert 1 <= int(index) <= len(found), f"{path} holds {len(found)} figures"
        return found[int(index) - 1]
    return pixels


def save(image: Image.Image, character: str, expression: str):
    target = ASSETS / character / "conversation" / expression
    target.mkdir(parents=True, exist_ok=True)
    image.save(target / "closed.webp", quality=92, method=6)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--character", required=True)
    parser.add_argument("--base", required=True, help="expression=image, the portrait that sets the head position")
    parser.add_argument("--expression", action="append", default=[], help="expression=image or expression=sheet#N")
    args = parser.parse_args()

    base_name, base_spec = args.base.split("=", 1)
    base = Image.fromarray(load(base_spec), "RGBA")
    if base.size != CANVAS:
        base = base.convert("RGBa").resize(CANVAS, Image.LANCZOS).convert("RGBA")
    base_top, base_centre, base_neck = head(np.asarray(base)[..., 3])
    save(base, args.character, base_name)
    print(f"{base_name}: head top y={base_top}, centre x={base_centre}, neck y={base_neck}")

    loaded = []
    for item in args.expression:
        name, spec = item.split("=", 1)
        pixels = load(spec)
        top, centre, neck = head(pixels[..., 3])
        loaded.append((name, pixels, top, centre, (base_neck - base_top) / (neck - top)))
    usual = float(np.median([scale for *_, scale in loaded])) if loaded else 1.0

    for name, pixels, top, centre, scale in loaded:
        # A figure drawn with a larger head for its body cannot match both. Matching
        # the head alone would shrink the body visibly, so split the difference.
        if abs(scale / usual - 1) > DRIFT:
            print(f"{name}: drawn to different proportions (head scale {scale:.3f}, the others {usual:.3f}); using the midpoint")
            scale = (scale + usual) / 2
        source = Image.fromarray(pixels, "RGBA").convert("RGBa")
        size = (round(pixels.shape[1] * scale), round(pixels.shape[0] * scale))
        scaled = source.resize(size, Image.LANCZOS).convert("RGBA")
        left, upper = round(base_centre - centre * scale), round(base_top - top * scale)
        canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        canvas.alpha_composite(scaled, (max(0, left), max(0, upper)), (max(0, -left), max(0, -upper)))
        save(canvas, args.character, name)
        gap = CANVAS[1] - (upper + size[1])
        cut = max(0, -left) + max(0, left + size[0] - CANVAS[0])
        print(f"{name}: scale {scale:.3f}" + (f", ends {gap}px above the bottom" if gap > 0 else "") + (f", {cut}px cut off at the sides" if cut else ""))


if __name__ == "__main__":
    main()
