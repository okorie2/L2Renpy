# Meshy Sophie — first optimized body rig

Source supplied by the user on 10 October 2026:
`/Users/psami/Downloads/Meshy_AI_SophieCharacterModel_1010133947_image-to-3d-texture.glb`.
The source is untouched. Meshy output is not covered by the supporting actors'
Quaternius CC0 notice. No external service was used for this processing.

The default app character is now `public/assets/3d/characters/sophie-meshy.glb`.
Previous study: `VITE_SOPHIE_MODEL=study`; original proxy: `VITE_SOPHIE_PROXY=true`.

## Outputs

- Editable project: `../blender/sophie-meshy-v2.blend`, with packed resized textures,
  the body rig, four animation tracks and studio camera/lights. Studio objects must
  not be included in a manual game export. Export only Sophie_Meshy and Sophie_Meshy_Rig.
- Runtime GLB: 112,392 triangles (source 750,866), about 8.9 MB (source about 30 MB),
  with embedded colour and normal textures; no remote resources.
- 22-bone A-pose body rig with normalized analytic skin weights, rigid head/hair
  and texture-assisted torso binding for the brown shoulder bag.
- Four looped procedural clips: Idle_Neutral, Idle, Walk, Wave. Runtime samples
  these against the story clock, so pause freezes the poses and distance drives
  the walk cycle. The user still does not control movement manually.
- `optimized-neutral.png`, `optimized-walk.png`, `optimized-wave.png` and
  `optimized-face.png`: offline Blender review renders. `report.json`: build stats.
- The earlier `meshy-sophie-*.png` renders show the unmodified source for comparison.

The face and hands receive higher geometry budgets than the clothing. Region
boundaries are held in place during reduction, then rewelded. UVs are retained.
The original PBR metallic/roughness connections are replaced with metallic 0,
roughness .82; normal strength .3. The app uses the colour atlas in a soft diffuse
material with low specular response and skips shell outlines on the textured mesh.

## Rebuild

Save manual edits under a new filename before rebuilding. Rebuilding replaces
this generated GLB, v1 Blender project, report and optimized review renders.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python "/Users/psami/Desktop/psami/Second Language/frontend/art/sophie/blender/build_meshy.py" -- "/Users/psami/Downloads/Meshy_AI_SophieCharacterModel_1010133947_image-to-3d-texture.glb"
```

Requires Blender 5.2. This is a first body-rig pass: further weight painting and
animation polish may be needed at sleeves, shoulders, trouser folds and the bag
strap. Generated cloth topology is not production animation topology. There is
no facial rig, blink/mouth shape key, finger articulation, phoneme sync, hair or
cloth simulation. Do not claim physical-phone performance from desktop checks.
For expressions, preserve the current likeness and author separate lid/eye/mouth
geometry and suitable facial topology before adding shape keys.

## Verification (10 October 2026)

- 134 tests pass, including local GLB resources, the four clip names, mesh/download
  budgets, embedded colour texture, and normalized finite weights on every vertex.
- Web and mobile builds pass. Existing bundle-size warning remains.
- Blender review of neutral, walking, waving and portrait poses; wave build check
  prevents denim vertices from being pulled by arm animation.
- Desktop in-app browser: actual conversation renders the new Sophie; isolated
  automatic preview completes the route. WebGPU and forced WebGL2 both render the
  textured face without model/shader errors. Two paused walking screenshots are
  byte-identical; resume proceeds. No physical iOS/Android test has been performed.


## Knee correction — v2

The previous v1 project is retained for comparison. `walk_cycle.py` now solves
hip, knee and ankle rotations from a ground-level stance foot and a raised swing
foot. The heel folds backward with positive knee flexion; the earlier negative,
shallow knee rotation was anatomically wrong. Knee/ankle weights now follow
localized height bands instead of broadly blended distance-to-bone weights.
Body translation is converted to bone-local space explicitly before baking.
The cycle still represents 1.2 m of travel and uses the existing automatic story
clock, pause and distance-driven animation sampling.

`walk-knee-profile.png` shows the updated mesh during mid-swing. Four standalone
Python checks cover IK reach, correct bend direction, swing clearance, grounded
stance, loop symmetry and localized normalized weights:

```sh
python3 frontend/art/sophie/blender/test_walk_cycle.py
```

The Blender builder checks the evaluated ankle positions across all 41 frames
against the solver and checks stance shoe soles stay on the ground; results are
in `report.json`. The JavaScript asset regression also requires both exported
knees to rotate through more than 50 degrees across the walk (peak flexion exceeds
60 degrees, with a nonzero stance bend). These checks do not measure foot sliding
or physical-device performance. Further cloth/topology and gait polish remain.

The chosen quality direction is balanced: sharper face/clothing while retaining
mobile performance. The supplied source has 2K maps; no paid retexture or purchase
has been made. A genuine 4K source retexture is an optional later step, with runtime
texture size chosen after visual and device checks.
