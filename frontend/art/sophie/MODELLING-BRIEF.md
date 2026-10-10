# Sophie — anime 3D character brief

## Art direction

Use `sophie-turnaround-v1.png` as the working turnaround and expression reference.
The original app artwork is authoritative for likeness:

- `../../public/assets/characters/sophie/conversation/encouraging/closed.png`
- `../../public/assets/characters/sophie/opening/idle.webp`

Preserve the young adult face, warm brown eyes, chestnut/ash-brown loose high bun,
side-swept fringe, cheek strands, cream cable-knit sweater, light-blue high-waisted
wide-leg jeans, white lace-up sneakers, fine gold pendant and dark brown leather
bag. The bag hangs from her left shoulder at her left hip. The generated side/back
views are inferred; resolve any inconsistencies against the original artwork.

Aim for a premium anime game character with clean sculpted hair locks, painted
highlights, simplified facial planes and soft cel-shadow bands. Genshin Impact is
an example of the rendering approach, not a character or costume to reproduce.
Keep Sophie's everyday outfit and friendly civilian identity.

## Deliverable

An authored, textured and rigged glTF 2.0 binary (`.glb`), approximately 1.8 metres
tall, Y-up, feet at ground level. Match the current renderer's +Z facing convention
and verify it through the glTF coordinate conversion before export. Supply an
editable modelling source alongside the game export. Suggested mobile budget:
20–35k triangles, two or three material groups, 1–2k texture atlases; validate these
budgets on the target phones before treating them as final limits. Prefer opaque
hair locks or alpha-tested hair cards over layered transparent hair.

Retain a compatible humanoid rig or provide retargeted Idle, Idle_Neutral, Walk and
Wave animation clips. Walking must be in place with a measured stride length so the
existing automatic route can drive it without foot sliding. Maintain the outfit,
bag strap and pendant through turns and arm movement; avoid intersections.

Add blink_L/R, jawOpen, smile and brow expression shapes plus useful speech shapes
(A/I/U/E/O, closed lips and F/V). Keep expression names documented. The current
proxy's procedural facial targets use fixed landmarks and must be replaced by the
new model's authored shapes rather than reused blindly.

## Integration and acceptance

The current `public/assets/3d/characters/sophie.glb` remains a CC0 proxy. Its meshes
have been recoloured for a palette study; it has not become the Sophie character.
Do not overwrite the existing illustrated portraits or use the turnaround image as
a face decal. Preserve the approved original image assets.

Before switching the game asset, update `src/world3d/characters.ts` material mapping
and `faces.ts` expression binding, then check: front/profile/back likeness, hair and
bag silhouettes, facial expressions, animation retargeting, measured stride, foot
contact, pause/replay, both WebGPU and WebGL, and physical phone performance.

## Reference provenance

`turnaround-v1` was generated with Codex's built-in image generation tool using the
two existing Sophie images as references, on 10 October 2026. The exact prompt is
in `generation-prompt.txt`. This PNG is a modelling reference, not a 3D mesh, UV
texture atlas or finished game character.

## First editable study

`blender/sophie-study-v1.blend` and `sophie-study.glb` now provide a first adaptation
of the proxy with hair/outfit silhouette changes. This is the current app study;
`sophie.glb` remains unchanged. Face likeness, authored expressions, finer clothing
and hair details and production validation remain outstanding. See
`blender/README.md` for editing and export instructions.

The second study, `blender/sophie-study-v2.blend`, replaces the proxy head with
editable geometry and authored blink_L/blink_R, jawOpen and smile shapes. The
app binds these by name; the preserved male/proxy actors still use procedural
landmarks. This provides a basis for refinement, not a final likeness or a full
phoneme/viseme set. The previous v1 Blender source is preserved.
