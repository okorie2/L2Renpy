#!/usr/bin/env python3
"""Draw layout guides from the JSON written by export_layout_guides.mjs.

Each guide is the location at twice its world size, which is also the size a
painted backdrop should be. Colours:
    grey    ground the player can walk on
    brown   solid: must be painted as something that visibly blocks the way
    blue    a building front; the white bar is where the game writes its name
    yellow  a door or exit the player walks onto
    pink    where a character stands
    green   a figure showing how tall a person is here
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCALE = 2
PERSON_HEIGHT = 116  # world units; keep equal to WORLD_FIGURE_HEIGHT in src/characters/catalog.ts


# Fonts that have accented letters; Pillow's built-in one does not.
FONT_FILES = ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]


def font(size):
    for path in FONT_FILES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    layouts = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for layout in layouts:
        width, height = layout["size"]["width"], layout["size"]["height"]
        image = Image.new("RGB", (width * SCALE, height * SCALE), (214, 214, 208))
        draw = ImageDraw.Draw(image)
        small, large = font(11 * SCALE), font(16 * SCALE)

        def box(rect):
            x, y = rect["x"] * width * SCALE, rect["y"] * height * SCALE
            return [x, y, x + rect["width"] * width * SCALE, y + rect["height"] * height * SCALE]

        def point(position):
            return position["x"] * width * SCALE, position["y"] * height * SCALE

        building_boxes = [box(building["rect"]) for building in layout["buildings"]]
        for obstacle in layout["obstacles"]:
            area = box(obstacle)
            if area in building_boxes:
                continue
            draw.rectangle(area, fill=(150, 112, 86), outline=(84, 60, 44), width=2 * SCALE)
            draw.text((area[0] + 4 * SCALE, area[1] + 3 * SCALE), "solid", fill="white", font=small)

        for building, area in zip(layout["buildings"], building_boxes):
            draw.rectangle(area, fill=(196, 212, 232), outline=(52, 84, 130), width=3 * SCALE)
            centre = (area[0] + area[2]) / 2
            sign_y = area[1] + layout["signOffsetY"] * SCALE
            draw.rectangle([area[0] + 19 * SCALE, sign_y - 21 * SCALE, area[2] - 19 * SCALE, sign_y + 21 * SCALE], fill="white", outline=(52, 84, 130), width=SCALE)
            draw.text((centre, sign_y), f"blank sign ({building['label']})", fill=(52, 84, 130), font=small, anchor="mm")
            draw.text((centre, area[1] + 40 * SCALE), "building front", fill=(52, 84, 130), font=large, anchor="mm")

        for portal in layout["portals"]:
            x, y = point(portal["position"])
            draw.ellipse([x - 30 * SCALE, y - 12 * SCALE, x + 30 * SCALE, y + 12 * SCALE], fill=(248, 216, 131), outline=(125, 101, 68), width=SCALE)
            draw.text((x, y + 24 * SCALE), f"door: {portal['label']}", fill=(90, 70, 40), font=small, anchor="mm")

        for npc in layout["npcs"]:
            x, y = point(npc["position"])
            draw.ellipse([x - 16 * SCALE, y - 8 * SCALE, x + 16 * SCALE, y + 8 * SCALE], fill=(255, 183, 195), outline=(160, 80, 100), width=SCALE)
            draw.text((x, y + 20 * SCALE), f"{npc['name']} stands here", fill=(140, 60, 85), font=small, anchor="mm")

        # A person, to scale, at the first place the player can appear.
        if layout["spawnPoints"]:
            person = PERSON_HEIGHT * layout.get("figureScale", 1)
            x, y = point(layout["spawnPoints"][0])
            x += 110 * SCALE
            y += 40 * SCALE
            draw.rectangle([x - 14 * SCALE, y - person * SCALE, x + 14 * SCALE, y], outline=(46, 125, 70), width=2 * SCALE)
            draw.ellipse([x - 12 * SCALE, y - person * SCALE, x + 12 * SCALE, y - (person - 24) * SCALE], outline=(46, 125, 70), width=2 * SCALE)
            draw.text((x, y + 12 * SCALE), "a person is this tall", fill=(46, 125, 70), font=small, anchor="mm")

        draw.text((12 * SCALE, 8 * SCALE), f"{layout['name']}  {width * SCALE} x {height * SCALE} px", fill=(60, 60, 60), font=large)
        target = out / f"{layout['id']}.png"
        image.save(target, optimize=True)
        print(f"{target}: {image.width}x{image.height}")


if __name__ == "__main__":
    main()
