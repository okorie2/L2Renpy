# Sophie original appearance with the Meshy auto-rig

The comparison preview at `http://127.0.0.1:5188/?preview3d&model=meshy-rigged`
now uses the original optimized Sophie mesh, UV layout and colour texture with
Meshy's 23-joint skeleton and supplied walking animation. The colour image is
byte-for-byte identical to `public/assets/3d/characters/sophie-meshy.glb`, which
remains the normal lesson model. Both use the same material/shading code; the
preview's earlier colour-grade approximation has been removed.

Meshy's skin weights are interpolated onto the original surface using Blender's
closest-face transfer. The original mesh is scaled to match Meshy's 1.7 m rig;
UVs and the embedded colour image are preserved. The runtime model contains
112,392 triangles and is 8,918,988 bytes. `Walk` remains Meshy's animation;
`Idle_Neutral` is the local neutral breathing fallback because the supplied ZIP
only includes Walking and Running. Running is retained in the source ZIP.
Movement remains automatic and uses the story clock and distance.

Sources, both untouched:

- `/Users/psami/Downloads/Meshy_AI_SophieRigged_biped.zip`
- `/Users/psami/Downloads/Meshy_AI_SophieCharacterModel_1010133947_image-to-3d-texture.glb`

The ZIP's original rigged mesh has 220,097 triangles and a different 4K colour
atlas. It is preserved in `../blender/sophie-meshy-autorig.blend` and in the ZIP.
The final preview uses the original model's 2K colour atlas directly, preserving
its likeness without regenerating textures. No service credits were spent.

Editable final project: `../blender/sophie-meshy-original-appearance.blend`.
`original-appearance-neutral.png` and `original-appearance-walk.png` show the
transferred mesh. `original-appearance-report.json` records the final stats.
The older `neutral.png`, `walk.png`, `walk-profile.png` and `report.json` describe
the earlier Meshy mesh before restoring the original appearance.

## Rebuild

Run the preparation script first if the auto-rig Blender project is missing.
That preparation step exports the Meshy mesh; the second step restores the
original appearance and replaces the review GLB with the final version.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python frontend/art/sophie/blender/prepare_meshy_rigged.py -- /Users/psami/Downloads/Meshy_AI_SophieRigged_biped.zip
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python frontend/art/sophie/blender/restore_original_appearance.py
```

## Verification and limits

All 136 frontend tests pass, including exact embedded colour-image equality and
both rigs' animated knee ranges. The production web build passes with its existing
chunk-size warning. Blender review covers neutral and walking deformation.
The face and outfit have been inspected in the browser preview. Further cloth and
bag weight polish may be needed; no facial blendshapes or exported greeting clip
were added. No physical-phone performance measurement has been made.
