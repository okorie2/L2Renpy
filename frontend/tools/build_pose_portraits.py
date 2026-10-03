#!/usr/bin/env python3
"""Build Sophie's extra conversation poses, with a moving mouth and a blink.

Each pose image (1024x1536, same canvas as her other portraits) becomes:
  closed.webp      the master portrait, mouth closed
  mouth-open.png   a feathered mouth patch laid over it while she speaks

A pose drawn with her mouth closed keeps its image as the master, and borrows
an open mouth from neutral_speaking, aligned and colour-matched to the face.
A pose drawn with her mouth open keeps its own open mouth as the patch, and its
master gets a closed mouth from neutral_closed. Poses whose head is turned
(`still`) have no patch: they are shown as drawn.

The blink is the eye region of blink_idle, which is neutral_closed with the
eyes shut, cut out as a patch for the neutral portrait.

Usage (needs Pillow and numpy):
    python tools/build_pose_portraits.py --sources ~/Downloads [--preview preview.png]
Prints the entries to keep in src/characters/catalog.ts.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

import build_mouth_overlays as mouth

OUT = Path("public/assets/characters/sophie/conversation")

# expression id: (source file, how the mouth is drawn)
POSES = {
    "presenting": ("presenting.png", "closed"),
    "playful": ("playful_i_know.png", "open"),
    "pinching": ("pinching_gesture.png", "closed"),
    "speaking-french": ("speaking_french.png", "open"),
    "listening": ("point_to_ear.png", "closed"),
    "excellent": ("excellent.png", "open"),
    "well-done": ("well_done.png", "open"),
    "close": ("close.png", "closed"),
    "good-try": ("good_try.png", "closed"),
    "beckoning": ("encouraging.png", "open"),
    "pleased": ("pleased.png", "closed"),
    "talking": ("talking_idlw.png", "open"),
    "inviting": ("turning_away.png", "still"),
    "goodbye": ("waving_goodbye.png", "still"),
}

BASE = (mouth.MOUTH_CENTER, mouth.OVERLAY_RECT, mouth.ALIGN_BOX)
EYES = (400, 260, 624, 350)  # x0, y0, x1, y1 around both eyes on the neutral face


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGBA"), dtype=np.float32)


def face_shift(reference: np.ndarray, image: np.ndarray):
    """Where this pose's face sits relative to the neutral one, from the eyes and nose."""
    x0, y0, x1, y1 = 420, 250, 600, 380
    template = reference[y0:y1, x0:x1, :3]
    best = (np.inf, 0, 0)
    for dy in range(-40, 41):
        for dx in range(-40, 41):
            error = float(np.abs(image[y0 + dy:y1 + dy, x0 + dx:x1 + dx, :3] - template).mean())
            if error < best[0]:
                best = (error, dx, dy)
    return best[1], best[2]


def place(dx: int, dy: int):
    """Move the mouth geometry with the face."""
    (cx, cy), (x, y, w, h), (ax0, ay0, ax1, ay1) = BASE
    mouth.MOUTH_CENTER = (cx + dx, cy + dy)
    mouth.OVERLAY_RECT = (x + dx, y + dy, w, h)
    mouth.ALIGN_BOX = (ax0 + dx, ay0 + dy, ax1 + dx, ay1 + dy)


def own_mouth(image: np.ndarray) -> np.ndarray:
    """The pose's own mouth, cut out with the same feathered mask."""
    mask = mouth.mouth_mask(image.shape)
    x, y, w, h = mouth.OVERLAY_RECT
    return np.dstack([image[..., :3], mask * 255])[y:y + h, x:x + w].round().astype(np.uint8)


def blink_patch(neutral: np.ndarray, blink: np.ndarray) -> np.ndarray:
    """The shut eyes, feathered where they differ from the open ones."""
    x0, y0, x1, y1 = EYES
    diff = np.abs(blink[y0:y1, x0:x1, :3] - neutral[y0:y1, x0:x1, :3]).mean(axis=2)
    from PIL import ImageFilter
    mask = Image.fromarray(np.clip(diff * 8, 0, 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(5))
    alpha = np.asarray(mask, dtype=np.float32)
    return np.dstack([blink[y0:y1, x0:x1, :3], alpha]).round().astype(np.uint8)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=OUT)
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()

    neutral = load(args.sources / "neutral_closed.png")
    speaking = load(args.sources / "neutral_speajing.png")
    catalog = {}
    previews = []
    for expression, (name, kind) in POSES.items():
        image = load(args.sources / name)
        folder = args.out / expression
        folder.mkdir(parents=True, exist_ok=True)
        entry = {"closed": f"characters/sophie/conversation/{expression}/closed.webp"}
        master = image
        if kind != "still":
            dx, dy = face_shift(neutral, image)
            place(dx, dy)
            if kind == "closed":
                overlay, (scale, sx, sy, error, _) = mouth.build(image, speaking)
            else:
                closer, (scale, sx, sy, error, _) = mouth.build(image, neutral)
                master = mouth.composite(image, closer)
                overlay = own_mouth(image)
            Image.fromarray(overlay, "RGBA").save(folder / "mouth-open.png", optimize=True)
            x, y, w, h = mouth.OVERLAY_RECT
            entry["mouthOpen"] = f"characters/sophie/conversation/{expression}/mouth-open.png"
            entry["mouthRect"] = {"x": x, "y": y, "width": w, "height": h}
            print(f"{expression:16s} {kind:6s} face ({dx},{dy}) donor scale {scale:.2f} shift ({sx},{sy}) residual {error:.1f}")
            if args.preview:
                box = (x - 60, y - 60, x + w + 60, y + h + 50)
                crop = lambda im: im[box[1]:box[3], box[0]:box[2], :3]
                previews.append(np.vstack([crop(image), crop(master), crop(mouth.composite(master, overlay))]))
        else:
            print(f"{expression:16s} still")
        Image.fromarray(master.astype(np.uint8), "RGBA").save(folder / "closed.webp", quality=88, method=6)
        catalog[expression] = entry
    place(0, 0)

    blink = blink_patch(neutral, load(args.sources / "blink_idle.png"))
    Image.fromarray(blink, "RGBA").save(args.out / "neutral" / "blink.png", optimize=True)
    x0, y0, x1, y1 = EYES
    catalog["blink"] = {"path": "characters/sophie/conversation/neutral/blink.png", "rect": {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}}
    if args.preview and previews:
        height = max(p.shape[0] for p in previews)
        padded = [np.pad(p, ((0, height - p.shape[0]), (0, 0), (0, 0)), constant_values=255) for p in previews]
        Image.fromarray(np.hstack(padded).astype(np.uint8), "RGB").save(args.preview)
    print(json.dumps(catalog, indent=1))


if __name__ == "__main__":
    main()
