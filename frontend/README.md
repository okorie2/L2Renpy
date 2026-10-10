# Second Language Starter

A small vertical-slice starter for a mobile-first language-learning RPG.

## Current prototype

- React + TypeScript application shell
- Phaser game scene
- Portrait/mobile-first layout
- Tap/click to move
- Four NPCs using shared character rendering
- Apartment, neighborhood, café, and bakery with door transitions
- Tap movement with obstacle avoidance, collision, camera follow, and cancellation
- Proximity-based NPC and door interaction
- Sophie as the guide: animated world sprite and a close-up conversation portrait
- Mobile conversation card over the live world, with translation and hints governed by a support level
- Personalised introduction (name or nickname, experience, motivation) kept apart from canonical French
- French expressions, vocabulary, slots, and dialogue isolated in a language pack
- Event-driven quest engine and the five-quest Chapter 1 chain, with a quest log
- Native projects for iOS and Android (Capacitor); see `../docs/MOBILE.md`

## Run

```bash
npm install
npm run dev
```

## iOS and Android

Set the backend address in `.env.mobile.local` first (copy `.env.mobile.example`), then build, sync and open the native project. Full instructions are in [`docs/MOBILE.md`](../docs/MOBILE.md).

```bash
npm run ios        # or: npm run android
```

## Intended first vertical slice

1. Meet Sophie.
2. Greet her in French.
3. Follow her to the cafe.
4. Speak to the barista.
5. Order a drink in French.
6. Understand the price.
7. Pay and complete the quest.
8. Award XP and record encountered vocabulary.

The neighborhood is playable and the five-quest Chapter 1 chain runs end to end:
meet Sophie, order a coffee, buy a croissant, meet Malik, go home. Quest progress
is driven only by game events, and conversations run on a pure dialogue engine.
On the player's turn the answer is typed or picked and checked for meaning, not
exact wording; a miss gets an in-scene "Pardon ?" and another try. The game
tracks what you have met, understood and written (open the phone, top right,
for Progress and the Phrasebook) and adjusts how much help it shows from how you get on.

Characters speak their lines when the backend is running (see
`../backend/README.md`); the game looks for it at `VITE_API_URL`, which defaults
to `http://localhost:3000` in development. Without it the game is silent and
otherwise the same. The microphone appears on your turn once the backend's
Whisper model is ready, and typing is always available. With an AI key in the backend's `.env`, a free answer the game's own rules do not recognise gets a second opinion from a language model (see `../docs/AI-CONVERSATION.md`); without one the game plays the same. 

The game saves itself in the browser's local storage as you play and resumes
where you left it. To begin again, open the phone (top right), then Settings, and choose "Start over…".
See `../docs/SAVE-SYSTEM.md`.

Run `npm test` for the deterministic checks (every `tests/*.test.ts`) and
`npm run build` for TypeScript and production bundling.

Character art lives in `public/assets/characters/` and is referenced only through
the catalog in `src/characters/`. Each conversation expression is one master
portrait plus a small open-mouth patch, rebuilt from the source art with
`tools/build_mouth_overlays.py`. The world walk frames are sliced from
`tools/sources/sophie-walk-sheet.webp` by `tools/build_world_sprites.py`, which
aligns them to the idle sprite. Its provenance is recorded in
[`docs/L2RENPY-IMPORTS.md`](../docs/L2RENPY-IMPORTS.md).

Architecture and content plans are documented in the workspace-level [`docs`](../docs/ARCHITECTURE.md)
folder. The main code boundaries are `src/app`, `src/world`, `src/core`,
`src/characters`, `src/dialogue`, `src/learning`, `src/speech`, `src/content`,
and `src/languages`. Dialogue is documented in
[`docs/DIALOGUE-SYSTEM.md`](../docs/DIALOGUE-SYSTEM.md).

## 3D story prototype

The opening and the automatic walk to the café now share a Babylon.js 3D stage.
Story nodes still decide when to walk, stop, talk and continue; there are no manual
movement controls. The React dialogue cards, speech, lessons and saves are unchanged.
Other locations retain their existing renderer while this first route is evaluated.

The stage prefers WebGPU and uses WebGL when WebGPU initialization is unavailable.
Havok physics runs through a locally bundled WASM file, including in mobile builds.
If the stage cannot initialize, the illustrated story remains available. Set
`VITE_STORY_3D=false` in `.env.local` to select that version explicitly.

`src/world3d/story.ts` maps existing story cues to continuous positions on one route.
`src/world3d/renderer.ts` builds the street and directed camera, with a Havok
character controller for Sophie. `src/world3d/characters.ts` loads locally packaged
the optimized Meshy Sophie and Quaternius CC0 supporting actors, with skeletal walking, idle and waving clips. Animation
poses blend using story time, and Sophie's stride follows distance travelled. Route
movement eases at departure and arrival; pause freezes both movement and poses.
Models and WASM ship with the app; no runtime asset service is needed. Credits and
source links are in `public/assets/3d/characters/CREDITS.md`. The scenery and character
art remain stylized prototype assets. The Meshy Sophie currently has a body rig and
subtle head motion, but no facial shapes or finger articulation. `faces.ts` binds the
previous Blender study’s authored blink, jawOpen and smile shapes when selected,
with procedural facial targets for the other CC0 rigs
and subtle head motion. These follow the
speaking cue and story clock, rather than an audio waveform or phoneme timings.
`surfaces.ts` draws repeatable plaster, stone, roof and shop-window material maps
locally. Street props and hilltop scenery use merged reusable geometry.

Validate with `npm test`, `npm run build`, and `npm run build:mobile`. Test GPU support,
frame rate, memory, and the movement feel on physical iOS and Android devices before
expanding the route to the rest of the game.

Open `/?preview3d` to watch the authored arrival and café walks without changing any
lesson progress. It includes pause/resume, replay and a silent café conversation
inspection view with **Inspect face** for a close-up. For fallback QA, start
Vite with `VITE_STORY_RENDERER=webgl` to force WebGL on a WebGPU-capable computer.

### Sophie anime character direction

`art/sophie/sophie-turnaround-v1.png` is a front/profile/back and facial-expression
reference generated from the existing Sophie artwork. `MODELLING-BRIEF.md` in that
folder documents likeness, rigging, expression and export requirements; the exact
built-in image-generation prompt is saved beside it. These source references are
not included in the runtime public assets.

`src/world3d/toon.ts` adds soft lighting bands in GLSL and WGSL, with gentler
contrast for Sophie's facial skin. Character silhouettes use fine warm outlines;
tiny eye/lip layers keep their authored contours without shell outlines or shadow
artifacts. Set `VITE_STORY_TOON=false` to compare smooth lighting.

`art/sophie/blender/sophie-study-v2.blend` preserves the previous study, with both
references packed, review cameras and all four skeletal clips. A new mesh face
has layered brown almond eyes, brows, lips, and blink_L/blink_R, jawOpen and smile
shapes. The v1 bun, fringe, long sleeves, wider jeans and shoulder bag remain.
`build_sophie.py` and `face_authoring.py` rebuild the study from the original proxy;
see the adjacent README before rebuilding over manual edits. Set
`VITE_SOPHIE_MODEL=study` to load `sophie-study.glb`, or `VITE_SOPHIE_PROXY=true` to compare the untouched original.
This remains prototype art. Face likeness, hair/clothing detail, a complete viseme
set and phone performance still need refinement and validation.

The app now loads `sophie-meshy.glb`: the user-supplied Meshy character, reduced
from 750,866 to 112,392 triangles and about 30 MB to 8.9 MB. Its embedded colour
atlas is preserved by the runtime's diffuse material conversion. Textures are
resized and JPEG-compressed, and material gloss is reduced. The new 22-bone A-pose
rig has local Idle, Idle_Neutral, Walk and Wave clips, sampled by the same story
clock and distance-driven stride as before. These are first-pass procedural body
motions, not motion capture or a finished character animation pass. No facial
shapes, fingers, cloth simulation or physical-device performance claims.
Editable source: `art/sophie/blender/sophie-meshy-v2.blend`; reproducible builder:
`art/sophie/blender/build_meshy.py`. See `art/sophie/meshy-review/README.md` for
source, rebuild instructions, pose previews and limitations. The downloaded
Meshy source and previous studies are not overwritten.

The Meshy walk v2 uses foot-target two-bone IK baked into the same Walk clip,
correct forward knee folding, localized trouser/knee weights and grounded stance
feet in the Blender checks. `walk_cycle.py` and `test_walk_cycle.py` document and
verify the solver; `meshy-review/walk-knee-profile.png` is the side-view review.
The runtime still samples the walk from travelled distance; no manual movement
control or runtime IK has been added.
