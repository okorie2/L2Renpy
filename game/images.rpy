# Sophie uses complete standalone sprites in the opening scene. The experimental
# layered assets remain in the project for future work.

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
