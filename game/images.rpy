# Sophie uses complete standalone sprites in the opening scene. The full-body
# images below are for movement/navigation; Scene 1's close conversation images
# are declared separately so their poses do not depend on the old layered
# expression system.

image bg park_day:
    "images/backgrounds/park/park_day.jpg"
    xysize layout_viewport
    fit "cover"
    align (0.5, 0.5)

image sophie casual = "images/characters/sophie/casual.png"

image sophie walk_a = "images/characters/sophie/walking/walking-frontpose-a.png"
image sophie walk_b = "images/characters/sophie/walking/walking-frontpose-b.png"
image sophie walk_c = "images/characters/sophie/walking/walking-frontpose-c.png"
image sophie wave = "images/characters/sophie/action/waving.png"

# The walking images share the same full-body canvas, so the animation can
# change poses without applying per-frame transforms or scaling.
image sophie walk:
    "sophie walk_a"
    pause 0.16
    "sophie walk_b"
    pause 0.16
    "sophie walk_c"
    pause 0.16
    "sophie walk_b"
    pause 0.16
    repeat


# Close conversation sprites. Each pose has a closed-mouth image and an
# open-mouth image. The "speaking" versions only move their mouth while
# Sophie's voice is actually playing, in sync with the line (see
# systems/sophie_lipsync.rpy); otherwise they show the closed mouth. The
# semantic image names keep Scene 1 independent from the asset filenames.

image sophie conversation neutral closed = "images/characters/sophie/scene_1/neutral_closed.png"

image sophie conversation neutral speaking = SophieTalking(
    "images/characters/sophie/scene_1/neutral_closed.png",
    "images/characters/sophie/scene_1/neutral_speaking.png",
)

image sophie conversation question closed = "images/characters/sophie/scene_1/question_closed.png"

image sophie conversation question speaking = SophieTalking(
    "images/characters/sophie/scene_1/question_closed.png",
    "images/characters/sophie/scene_1/question_opened.png",
)

image sophie conversation explain closed = "images/characters/sophie/scene_1/explain_closed.png"

image sophie conversation explain speaking = SophieTalking(
    "images/characters/sophie/scene_1/explain_closed.png",
    "images/characters/sophie/scene_1/explain_speaking.png",
)

image sophie conversation encouraging closed = "images/characters/sophie/scene_1/encouraging_closed.png"

image sophie conversation encouraging speaking = SophieTalking(
    "images/characters/sophie/scene_1/encouraging_closed.png",
    "images/characters/sophie/scene_1/encouraging_opened.png",
)
