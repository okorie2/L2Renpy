# Story character assets

Author: Quaternius. Licence: CC0 1.0 Universal (public domain dedication).
https://creativecommons.org/publicdomain/zero/1.0/

- `sophie.glb`: Casual.gltf from Ultimate Modular Women Pack.
  https://quaternius.com/packs/ultimatemodularwomen.html
  Original file: https://drive.google.com/file/d/18b3WwlrwrFYWAM7BcnjWeIxKJyxAQiGh/view
- `player.glb`: Casual_2.gltf from Ultimate Modular Men Pack. Also reused for background actors.
  https://quaternius.com/packs/ultimatemodularcharacters.html
  Original file: https://drive.google.com/file/d/1Jn7kULNmrtqP8BUUL19h8MhbdOnwPFhv/view

Changes: retained Idle, Idle_Neutral, Walk and Wave clips, removed unused animation
accessors/buffer views, and converted embedded glTF into self-contained GLB. Runtime
materials use the street's diffuse lighting. Original geometry and skeletal clips
are preserved in the packaged files. Runtime facial morph targets add eyelid/jaw
motion and a small skinned mouth mesh; these are cue-driven, not phoneme-aligned. These models are prototype character art, not final Sophie likeness.

Downloaded 10 October 2026. Combined GLB size: approximately 1.76 MB uncompressed.

`sophie-study.glb` is a first Blender adaptation of `sophie.glb`, retaining its
CC0 face and humanoid rig plus all four skeletal clips. New geometry: scalp,
bun, fringe, cheek strands, sleeves/cuffs, shoulder bag/strap, necklace and pendant.
The inherited sweater torso and jeans are reshaped and recoloured. This is a
silhouette study, not a finished likeness or production character. Editable source
and rebuild script: `frontend/art/sophie/blender/`. Original proxy is preserved.

Face study v2 replaces the inherited face with a new skinned mesh, layered almond
eyes/irises/catchlights, brows, ears, lips and mouth. Authored blink_L, blink_R,
jawOpen and smile shapes are exported from Blender. The runtime drives these with
story cues; it does not synchronise phonemes to audio. The original rig and four
clips remain CC0 Quaternius. Current GLB is approximately 1.3 MB.

`sophie-meshy.glb` is derived from the user's Meshy-generated
`Meshy_AI_SophieCharacterModel_1010133947_image-to-3d-texture.glb`, supplied on
10 October 2026. It is separate from the Quaternius CC0 assets above; no CC0 licence
is asserted for the Meshy output. Changes: welded geometry, regional reduction
retaining more head/hand detail, resized/compressed embedded textures, reduced
material gloss, a new 22-bone body rig and procedural Idle, Idle_Neutral, Walk and
Wave animations. Approximately 112,392 triangles and 8.9 MB. Facial expressions
and finger articulation are not authored. Source project and builder are in
`frontend/art/sophie/blender/`; source/provenance notes in `meshy-review/README.md`.
