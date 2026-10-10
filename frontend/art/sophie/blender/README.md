# Sophie model study v2 — face and eyes

The app now uses the optimized user-supplied Meshy character. Its editable body
rig is `sophie-meshy-v2.blend`, built by `build_meshy.py`. See
`../meshy-review/README.md` for rebuild instructions and limitations. The study
below remains available with `VITE_SOPHIE_MODEL=study`.

Open `sophie-study-v2.blend` in Blender. The reference sheet is packed into the
project as an image empty beside the character. The original illustrated assets
remain authoritative; the generated turnaround supplies inferred side/back views.

This first pass changes the silhouette and outfit of the CC0 Quaternius proxy:
sculpted bun/fringe/cheek strands, long sleeves/cuffs, wider jeans, cream sneakers,
left shoulder bag and pendant. The face is now a new editable mesh with layered brown almond eyes, lashes, brows,
lips and authored facial shapes. The four skeletal clips remain. It is a rough
study, not the finished Sophie likeness. `sophie-study-v1.blend` preserves the
previous face and silhouette study.

## Editing

- Meshes starting `Sophie_` are the new editable hair/clothing/accessories.
- `Sophie_HeadSkin` is the new head; `Sophie_Eye*`, `Sophie_Iris*`, `Sophie_Pupil*`,
  `Sophie_Catchlight*`, `Sophie_Brow*`, `Sophie_Lips` and `Sophie_Mouth` form the face.
- Shape keys: `blink_L` / `blink_R` across the appropriate eye layers; `jawOpen`
  on skin and lip/cavity meshes; `smile` on lips/cavity. Keep names and neutral
  values (zero) on export. The app samples these from its story clock.
- Open the shape-key panel for a mesh and move the named key from 0 to 1 to inspect.
  These are basic expressions; phoneme visemes and audio alignment remain future work.
- `Casual_Body`, `Casual_Legs`, `Casual_Feet` are reshaped inherited geometry.
- `CharacterArmature` drives everything. Use Rest Position for mesh editing.
- In the NLA editor, unmute only one of Idle, Idle_Neutral, Walk or Wave to review
  that clip. All four tracks are retained. The saved project shows Idle_Neutral.
- Review cameras: Front, Profile, Back and Portrait. Studio/reference objects must
  stay out of the game export.

Next art pass: refine face proportions and iris/lid detail against the original, shoulder/sleeve transitions,
cable-knit detail, natural hair locks, bag shape and strap intersection checks
through the complete walk/wave cycle. Blink and mouth deformation now use authored shapes driven by procedural story cues;
they are not phoneme-aligned visemes. No physical-phone performance claim.

## Rebuild/export

Run from any working directory:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python "/Users/psami/Desktop/psami/Second Language/frontend/art/sophie/blender/build_sophie.py"
```

This rebuilds the study from the untouched original proxy, exports
`public/assets/3d/characters/sophie-study.glb`, saves the Blender project, and renders
four view PNGs plus blink/talk review PNGs. Rebuilding replaces the study files; save manual edits to a new
version before rerunning. It does not overwrite `sophie.glb` or illustrated assets.

For a manual export, select only the character meshes and armature, enable Selected
Objects and NLA Tracks animation export, and export glTF Binary. Unmute all four
NLA tracks for export. Preserve the animation and expression names. Runtime Sophie binding now uses the
authored shapes rather than the old proxy’s facial landmarks.

The app loads the study by default; `VITE_SOPHIE_PROXY=true` restores the original
proxy for comparison. Material colour overrides live in `world3d/characters.ts`;
match those when introducing new Blender materials.

The build script uses `face_authoring.py` for the face geometry and shape keys.
Both the original portrait and inferred turnaround are packed into the project.
Use the original portrait to resolve differences in the generated reference.
The preview offers **Inspect café → Inspect face**, plus pause/resume.
