#!/usr/bin/env python3
"""Cut the things a character can walk behind out of a location painting.

A painting is flat, so a character is always drawn on top of it. For something
that stands up from the ground (a fountain, a bench), the same pixels are cut
out as a separate image that the game draws again at the depth of the thing's
base: whoever stands behind it is hidden by it, whoever stands in front is not.

The spec lists each prop as simple shapes in the painting's own pixels.

Usage (needs Pillow), from frontend/:
    python tools/cut_props.py --image tools/sources/street.webp --spec tools/sources/street-props.json

Writes public/assets/locations/<location>-<name>.png and prints the entries to
put in the location's `props`.
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path("public/assets/locations")
FEATHER = 1.2  # pixels of softening, so the cut edge never shows as a line


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--spec", type=Path, required=True)
    args = parser.parse_args()

    painting = Image.open(args.image).convert("RGBA")
    spec = json.loads(args.spec.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    width, height = painting.size

    for prop in spec["props"]:
        mask = Image.new("L", painting.size, 0)
        draw = ImageDraw.Draw(mask)
        for shape in prop["shapes"]:
            if "ellipse" in shape:
                draw.ellipse(shape["ellipse"], fill=255)
            elif "rect" in shape:
                draw.rectangle(shape["rect"], fill=255)
            else:
                draw.polygon([tuple(point) for point in shape["polygon"]], fill=255)
        left, top, right, bottom = mask.getbbox()
        mask = mask.filter(ImageFilter.GaussianBlur(FEATHER))
        cut = painting.copy()
        cut.putalpha(mask)
        cut = cut.crop((left, top, right, bottom))
        name = f"{spec['location']}-{prop['name']}.png"
        cut.save(OUT / name, optimize=True)
        rect = { "x": left / width, "y": top / height, "width": (right - left) / width, "height": (bottom - top) / height }
        print(f'{{ image: "locations/{name}", rect: {{ x: {rect["x"]:.4f}, y: {rect["y"]:.4f}, width: {rect["width"]:.4f}, height: {rect["height"]:.4f} }}, base: {prop["baseY"] / height:.4f} }},')


if __name__ == "__main__":
    main()
