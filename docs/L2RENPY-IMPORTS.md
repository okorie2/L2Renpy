# L2Renpy imports

Material reused from https://github.com/okorie2/L2Renpy, with the explicit permission of that repository's owner. Inspected at commit `473cd59a` ("feat: add more sophie states and animate lip sync", 2026-10-02).

That permission covers material the owner has the right to authorise. It does not override third-party licences, so each category below records what was checked. Anything not listed here was not imported.

## Provenance notes

- **Sophie artwork.** L2Renpy has no licence file. The PNGs carry C2PA content credentials naming OpenAI's media service, so they are AI-generated images produced by the repository owner, who approved them for this project. Confirm the generating account's terms allow commercial use before a public release.
- **UI icons.** Simple hand-authored SVG primitives in L2Renpy's `game/gui/mobile/`; no third-party source.
- **Semantic names.** Ren'Py filenames were not kept. `explain` became `explaining`, and `opened`/`speaking` both became `speaking`.

## Character art

All sprites share a 1024×1536 (2:3) canvas. Destination paths are under `frontend/public/assets/characters/sophie/`.

| L2Renpy path (`game/images/characters/sophie/`) | Destination | Copied or adapted | Purpose |
| --- | --- | --- | --- |
| `scene_1/neutral_closed.png` | `conversation/neutral/closed.png` | Copied, byte-identical | Conversation portrait: neutral, mouth closed |
| `scene_1/neutral_speaking.png` | `conversation/neutral/mouth-open.png` | **Adapted**: mouth patch only | Neutral, open mouth laid over the closed master |
| `scene_1/question_closed.png` | `conversation/question/closed.png` | Copied, byte-identical | Asking a question, mouth closed |
| `scene_1/question_opened.png` | `conversation/question/mouth-open.png` | **Adapted**: mouth patch only | Asking a question, open mouth laid over the closed master |
| `scene_1/explain_closed.png` | `conversation/explaining/closed.png` | Copied, byte-identical | Explaining, mouth closed |
| `scene_1/explain_speaking.png` | `conversation/explaining/mouth-open.png` | **Adapted**: mouth patch only | Explaining, open mouth laid over the closed master |
| `scene_1/encouraging_closed.png` | `conversation/encouraging/closed.png` | Copied, byte-identical | Encouraging, mouth closed |
| `scene_1/encouraging_opened.png` | `conversation/encouraging/mouth-open.png` | **Adapted**: mouth patch only | Encouraging, open mouth laid over the closed master |
| `casual.png` | `world/idle.png` | **Adapted**: scaled to 320×480 | World sprite, standing |
| `action/waving.png` | `world/waving.png` | **Adapted**: scaled to 320×480 | World sprite, greeting |

### Why two kinds of adaptation were needed

- **Mouth patches instead of full speaking portraits.** Each open-mouth source image was generated separately from its closed-mouth partner, and the two differ across the whole figure (about 12% of pixels for `neutral`, about 2% for the others), not only at the mouth. Swapping them made Sophie shimmer when she spoke. The closed image is now the master for each expression. `frontend/tools/build_mouth_overlays.py` registers the open-mouth source to it around the mouth (only `neutral` needed a shift, 13px by 4px), matches skin tone at the blend edge, and writes a 160×104 feathered patch for the rectangle at (428, 352) on the 1024×1536 canvas. The full open-mouth portraits are no longer shipped, which also halves the portrait payload. This also sidesteps a defect in the source `encouraging_opened.png`, which has opaque black patches left in its background matte; that file should still be fixed in L2Renpy.

  ```bash
  python frontend/tools/build_mouth_overlays.py --l2renpy /path/to/L2Renpy   # needs Pillow and numpy; run from frontend/
  ```

- **World sprite scaling.** In the Phaser world Sophie is 116 world units tall. Drawing a 1536px-tall texture that small aliases badly and wastes texture memory, so the idle and waving poses are downscaled copies at 320×480, the same canvas as every other character (resized with Pillow, premultiplied alpha). The full-resolution originals stay in L2Renpy.

### Walk frames are no longer from L2Renpy

L2Renpy's `walking/walking-frontpose-a/b/c.png` were dropped: they were generated separately, without Sophie's bag, and did not match the idle sprite. `world/walking-1.png` to `walking-6.png` come from a single six-pose sheet the project owner generated on 2026-10-02 (`frontend/tools/sources/sophie-walk-front.webp`), cut and aligned to the idle sprite by `tools/build_world_sprites.py`. It replaced an earlier three-pose sheet (`sophie-walk-sheet.webp`, kept as the style reference in `ART-BRIEF.md`).

### Not imported

| L2Renpy path | Reason |
| --- | --- |
| `archive/*.png`, `expressions/*.png`, `outfits/casual.png` | The older layered expression system; not declared in `game/images.rpy`, and framed differently from the approved close-ups. `happy` and `confused` therefore have no dedicated art and fall back to `encouraging` and `question` in the catalog. |
| `images/backgrounds/park/park_day.jpg` | The Phaser world draws its own locations. |

## UI icons

Copied byte-identical from `game/gui/mobile/` to `frontend/src/app/icons/`, renamed by meaning.

| L2Renpy file | Destination | Purpose |
| --- | --- | --- |
| `dialogue_speaker_icon.svg` | `replay-audio.svg` | Replay button on the dialogue card |
| `dialogue_chevron.svg` | `next.svg` | Continue button |
| `microphone.svg` | `microphone.svg` | Spoken-response button |
| `stop.svg` | `stop.svg` | Stop recording |
| `icon_type.svg` | `keyboard.svg` | Typed fallback (reserved) |
| `icon_level_1.svg`, `icon_level_2.svg`, `icon_level_3.svg` | `level-1.svg`, `level-2.svg`, `level-3.svg` | Experience choices |
| `icon_tourism.svg`, `icon_career.svg`, `icon_education.svg`, `icon_relationship.svg`, `icon_general.svg` | `travel.svg`, `work.svg`, `study.svg`, `people.svg`, `curiosity.svg` | Motivation choices |

The card, sheet, name-chip, button and field SVGs were **not** imported. They are nine-slice backgrounds for Ren'Py frames; in React the same shapes are plain CSS (border radius and shadow), which scales better.

## Concepts reimplemented, not copied

| L2Renpy source | This project | Notes |
| --- | --- | --- |
| `game/images.rpy` (`sophie conversation <pose> <closed/speaking>`) | `frontend/src/characters/` | Semantic character/expression/activity catalog and resolver |
| `game/systems/sophie_lipsync.rpy` | `useSpeakingPulse` in `frontend/src/app/hooks.ts`; `mouthTimeline` in `frontend/src/speech/types.ts` | Only the closed/open idea and the timeline format; the fallback steady flap is what runs today |
| `game/ui/mobile_theme.rpy` | `frontend/src/styles.css` | Colour palette and proportions of the card, name chip and round buttons |
| `game/ui/mobile_components.rpy` (`mobile_dialogue_card`, `mobile_sheet`, choice pills, text input) | `frontend/src/app/components/Conversation.tsx` | Original React/CSS implementation of the same layout ideas |
| `game/screens/speech_input_screen.rpy`, `game/systems/speech/input.rpy` | `frontend/src/speech/session.ts`, `SpeechControl.tsx` | State names idle/recording/processing/result/error as a pure reducer |
| `game/systems/speech/practice.rpy` | `docs/SPEECH-SYSTEM.md`, `docs/LEARNING-SYSTEM.md` | Finite remediation loop, documented only. Its numeric pass thresholds were not adopted as learner-facing scores. |
| `game/systems/chapter1_introduction.rpy` | `frontend/src/dialogue/template.ts`, French pack `slots` | Personalised introduction and name exclusion, generalised to named unscored spans. The age sentence was dropped; age is not collected. |
| `game/scenes/opening_scene.rpy` | `meetSophie` dialogue in `frontend/src/languages/fr/index.ts` | Walk in, wave, ask name, level and motivation, as data. Sophie's lines were rewritten in French. |
| `backend/README.md` | `docs/SPEECH-SYSTEM.md`, `PLAN.md` Phase 7 | Cache key composition, exercise-ID direction, warm models at startup |

## Studied, not yet used

- **Pronunciation analysis** (`backend/app/speech/pronunciation.py` and its helpers, `game/systems/speech/practice.rpy`). The approach is summarised in `SPEECH-SYSTEM.md` for the future pronunciation phase. No code was copied. Its third-party parts were checked: the phoneme model `Cnam-LMSSC/wav2vec2-french-phonemizer-v2` is MIT-licensed; `epitran`, `torch` and `transformers` are open-source packages whose licences must be re-checked when they are added.

## Deliberately left behind

| Material | Reason |
| --- | --- |
| `game/audio/chapter1/scene1/sophie/*` (voice lines and `.lipsync` timelines) | **Brought back on 2026-10-02** for the opening; see "The opening" below. `age_question`, `introduce_yourself` and `nice_to_meet_you_ella` were left out: age is not collected, and the last names one player. |
| `game/audio/chapter1/music/*` | No provenance or licence information in the repository. Do not import until the source and licence are known. |
| `DejaVuSans.ttf` and other Ren'Py GUI defaults | Third-party, shipped with Ren'Py. The app uses the system font stack. |
| `backend/` (FastAPI speech service, faster-whisper, Chatterbox, ElevenLabs adapters) | Left behind at first; **brought back on 2026-10-02** as this project's backend. See "Backend" below. |
| Ren'Py scripts (`*.rpy`) | Framework-specific; reimplemented as listed above. |

## Backend

On 2026-10-02 L2Renpy's `backend/` (tag `renpy-final`) became this project's only backend, replacing the NestJS service and the separate speech service (`PLAN.md` 4A.8). It is the same repository, so this is a restore rather than an import.

| Kept as it was | Changed for this game |
| --- | --- |
| Pronunciation evaluation (`pronunciation.py`, `phonemize.py`, `text_phonemize.py`, `phonetic_guide.py`, `models.py`) | `/speech/synthesize` takes `languageCode`, `speakerId` and `rate`, picks a voice per character, and returns the mouth timeline in `X-Mouth-Timeline` |
| Name extraction (`text/names.py`) | `/speech/transcribe` takes `audio` and `languageCode`, decodes phone recordings with PyAV, drops Whisper's invented text, and reports `speechDetected` and `confidence` |
| ElevenLabs and Chatterbox voice adapters, the TTS cache | The cache key includes voice and speed, and the cache keeps the lip-sync timeline |
| The lip-sync algorithm (`lipsync.py`) | New: macOS voice provider, readiness checks, `/speech/capabilities`, CORS, the AI conversation layer (ported from NestJS) |
| The Chatterbox server (`tts_service/`) and the WAV fixtures | Removed: `tools/build_lipsync.py`, which read Ren'Py's `game/audio` |

Licences to check before a public release: the phoneme model `Cnam-LMSSC/wav2vec2-french-phonemizer-v2` is MIT; the name model `dslim/bert-base-NER` and Chatterbox need checking, as do ElevenLabs' terms for generated audio.

## The opening (2026-10-02)

The Ren'Py opening is the game's first scene again: the park, Sophie walking up the path toward the camera, a wave, her welcome in English with her recorded voice, the personalised French introduction, and pronunciation practice on it.

| Material | Destination | Notes |
| --- | --- | --- |
| Nine of Sophie's recorded lines (`hi_im_sophie`, `nice_to_meet_you`, `whats_your_name`, `french_level_question`, `why_learn_french`, `great`, `how_i_would_introduce_myself`, `mouthful`, `bit_by_bit`) | `frontend/public/assets/voices/sophie/en/` | Generated by the owner with ElevenLabs. Their `.lipsync` tracks are inlined in `frontend/src/speech/recordings.ts`, which plays a recording whenever its exact line is on screen. |
| `casual.png`, `action/waving.png` (1024x1536) | `frontend/tools/sources/sophie-casual.png`, `sophie-waving.png` | Built with the six-pose walk sheet into `characters/sophie/opening/` (683x1024) by `frontend/tools/build_opening_sprites.py`. |
| The opening sequence (`game/scenes/opening_scene.rpy`) | `frontend/src/app/components/OpeningScene.tsx`, `meetSophie` in the French pack | Walk 1.8 s, wave 0.9 s, then the conversation, as in Ren'Py. The age question is not asked. |
| `_LEARNING_GOAL_SENTENCES`, `_FRENCH_LEVEL_SENTENCES` (`game/systems/chapter1_introduction.rpy`) | `motivationSentence` and `levelSentence` slots in the French pack | The introduction Sophie teaches. |
| The practice loop (`game/systems/speech/practice.rpy`) | `frontend/src/speech/practice.ts`, `frontend/src/app/components/Practice.tsx`, `POST /speech/practice` | Same thresholds and limits. The reference is made on the server from Sophie's cached voice for the line, so only the learner's audio is uploaded. |

The park painting (`frontend/public/assets/locations/park.webp`) is new art from the owner, not from L2Renpy.
