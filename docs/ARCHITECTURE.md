# Architecture

## Product rule

Language is a gameplay mechanic. World actions lead to conversations, and quest gates depend on the player communicating a meaning or showing understanding. Answers can be spoken, typed or picked.

## Boundaries

| Layer | Directory | Owns | May depend on |
| --- | --- | --- | --- |
| React application/UI | `frontend/src/app` | HUD, interaction buttons, conversation presentation, session state, opening and autosaving the stored game, asset URLs | everything below |
| Phaser world | `frontend/src/world` | location rendering, animated characters, tap pathing/collision, camera, proximity events | core world models, character visual types; receives data through `WorldSceneConfig` |
| Game core | `frontend/src/core` | player, profile, world, quest, inventory and save models; the quest engine, conditions, content validation; pure transitions | learning types and support defaults; the dialogue session type, for stored message threads |
| Characters | `frontend/src/characters` | semantic visual types, the art catalog, the resolver | nothing |
| Dialogue | `frontend/src/dialogue` | dialogue models, the dialogue engine (branching, effects, repair, history), `{slot}` templates and unscored spans, content validation | core, learning, character types |
| Learning engine | `frontend/src/learning` | language-independent concepts, intents, communication assessment, vocabulary detection, evidence and its log, support adaptation, the learning summary | core save type only |
| Speech | `frontend/src/speech` | provider-neutral STT/TTS/pronunciation contracts, the backend TTS and STT adapters, the voice library (cache, pre-fetch, back-off), the mouth timeline, the speech session state machine | learning types |
| Save | `frontend/src/save` | the storage interface, the versioned codec and migrations, the store, reconciliation with current content, autosave timing | core models, quest sync, profile sanitising |
| Conversation | `frontend/src/conversation` | the scene sent for a second opinion on a learner turn, and the backend client that asks for one | core, dialogue and learning models |
| Phone | `frontend/src/phone` | message delivery and thread state, who has been met, where objectives happen, what the map shows | core, dialogue |
| Game content | `frontend/src/content` | Chapter 1 locations, NPC placement, quest definitions, learning scope | core and learning models |
| Language packs | `frontend/src/languages` | target-language expressions, dialogue text, vocabulary, slots, place labels | dialogue and learning models |

Everything except `app` and `world` is framework-independent and runs in plain Node tests.

`frontend/src/app/App.tsx` is the composition root. It selects a pack, opens the stored game through `useSavedGame` (or creates a new one), turns catalog asset paths into URLs, passes world data into Phaser, and routes what happened to pure functions (`stepDialogue`, `travelThroughPortal`). It reports inputs and events; it never decides dialogue or quest progress. Phaser reports NPC/portal proximity, movement state and player position through the event bridge in `world/events.ts`. The world scene has no quest rules and no French strings.

Phase 1 authored four bounded locations: the neighborhood, apartment, café and bakery. Content coordinates are fractions of a location's fixed world dimensions, which keeps content independent of device size while allowing camera tracking and collision. `navigation.ts` finds tap routes around authored obstacles and NPC collision circles; a tap on somewhere unreachable, such as a shopkeeper behind a counter, leads to the nearest reachable spot. While walking, a step that would clip a corner is steered around it (`advanceToward`), and a route that still cannot progress is replanned once along grid cells, so a walk cannot jam in place. React holds the versioned save and reports every change to the autosave; Phaser owns only transient movement, animation and camera state.

## Character visual system

Game and dialogue code describe what a character is doing, never which file shows it:

```ts
resolveConversationVisual({ character: "sophie", expression: "question", activity: "speaking" });
resolveWorldVisual("sophie"); // poses: idle, walking, waving
```

- **Expressions** (conversation close-ups): `neutral`, `question`, `explaining`, `encouraging`, `happy`, `confused`.
- **Activities**: `closed`, `speaking`. Each expression has one master portrait (mouth closed) and an optional small open-mouth patch that is laid over it while speaking.
- **World poses**: `idle`, `walking`, `waving`, each a list of front-view frames with a frame duration, and optionally `back` and `side` frames. `worldFrames(pose, direction)` picks them: a character with only front art keeps facing the camera, and side art is drawn facing right and mirrored for left.
- **Close-ups are optional.** A character never shown in close-up, such as the player, has world art only. Everyone the player talks to has four expressions on one canvas with the head in one place (`tools/build_portraits.py` lines them up); only Sophie has mouth patches so far, and the others keep their mouths closed while speaking. While a close-up is on screen the player's small figure fades out, as the speaker's does.

`characters/catalog.ts` is the only place that knows asset paths. Paths are relative to `frontend/public/assets/`; the app layer converts them to URLs with `assetUrl`. Missing art degrades instead of breaking: an expression without art uses its declared fallback (`happy` → `encouraging`, `confused` → `question`), an expression without a mouth patch simply stays closed, and a character with no catalog entry resolves to `undefined`, so it is drawn as a simple figure in the world and shown without a portrait in conversation. Adding a character or a pose is a catalog change only.

In the world, `SpriteCharacter` and the drawn `Character` implement one `WorldCharacter` interface, so the scene treats them alike. Any character with art in the catalog is a sprite, the player included (catalog ID `player`); the rest are drawn from shapes. A location with a `backdrop` is shown as that painting, with place names from the language pack laid over its blank signs (`buildings[].sign`); without one it is drawn from shapes. A painting is flat, so anything a character can walk behind is listed in the location's `props`: the same pixels cut out as a separate image and drawn again at the depth of the thing's base. A location may also set `figureScale`, because a room painted from close up needs larger figures than the street; the player's footprint for collision grows with it. Every Chapter 1 character and location is now illustrated; the shapes drawn by code remain only as the fallback. The art direction and the list of art to make are in `ART-BRIEF.md`. Optional NPC data drives behaviour: `entrance` plays a one-time walk-in, and `interaction.noticeRadius` makes an NPC with a greeting pose wave when the player comes near.

**Consistency rule: derive, don't regenerate.** Separately generated images of the same pose never match exactly, so swapping whole portraits to move the mouth made hair, clothes and outline shimmer. Each expression therefore has a single master image, and the open mouth is a feathered patch cut from the source art, registered to the master and colour-matched by `frontend/tools/build_mouth_overlays.py`. The resolver returns the same base `path` for both activities plus a `mouthOverlay` placed by fractions of the canvas; `CharacterPortrait` fades only that patch. Anything outside the mouth rectangle is identical by construction, and tests enforce the shared base image, the patch size and the shared canvas of the world frames. New poses should follow the same rule: one master, then masked edits or patches derived from it. The world walk cycle follows it too: its three frames come from one sheet generated against the idle image, and `frontend/tools/build_walk_frames.py` puts them on the idle sprite's canvas with a shared scale and head position.

The `speaking` activity follows the voice: while a line's audio plays, the mouth opens and closes from the clip's timeline (one flag per frame, returned with the audio). When there is no sound (voices off, or the backend away) a timed flap (`useSpeakingPulse`) stands in. Nothing more elaborate than two mouth shapes is planned.

## Conversation presentation

A conversation is an overlay on the live world, not a separate screen.

1. React emits `conversation-focus` with the NPC. The scene eases the camera in on the pair and, when a portrait will stand in for the NPC, fades the NPC's world sprite. Movement is locked.
2. `Conversation` renders a soft scrim, the speaker's portrait, and a bottom dialogue card. The HUD fades out; the scene stays visible.
3. On exit or completion the camera eases back and follows the player again.

The card follows the approved L2Renpy mobile layout, reimplemented in React/CSS: a name chip on the top-left edge, an optional replay button on the top-right edge, the target language as primary text, the translation as secondary text, assistance chips, and a continue button on the bottom-right edge. Responses render inside the same card: choice pills, a text field, action buttons, or the player's turn (a French text field, suggestions, and the microphone once speech is available). A history button shows earlier lines. All controls are at least 44px, the layout respects safe-area insets, and the card lifts above the on-screen keyboard.

Translation visibility is not a property of the component. It comes from the learner's support level (see `LEARNING-SYSTEM.md`). When a backend is configured, lines are spoken as they appear and the card offers replay and "Slower"; a sound button opens the listening settings. Without one the conversation is silent and otherwise identical. See `SPEECH-SYSTEM.md`.

## Current event path

1. Phaser detects proximity to an NPC ID from Chapter 1 data.
2. React asks core which dialogue applies (`selectNpcDialogueId`): the NPC's ordered rules are tested against quest state, so what an NPC says follows the story.
3. `startDialogue` opens a session; the pack supplies the nodes and slots are filled from the player profile.
4. Each player input goes to `stepDialogue`, which assesses answers (a free answer the rules do not recognise is first put to the backend for a second opinion, then stepped again with it; see `AI-CONVERSATION.md`), writes evidence, applies effects, and raises `DIALOGUE_LINE_COMPLETED`, `INTENT_COMMUNICATED` or `CONCEPT_DEMONSTRATED`. See `DIALOGUE-SYSTEM.md`.
5. The last line raises `DIALOGUE_COMPLETED`. Using a portal raises `LOCATION_ENTERED` from inside `travelThroughPortal`.
6. `applyGameEvent` advances objectives, completes quests, grants rewards once, and processes the `QUEST_COMPLETED` and `ITEM_ACQUIRED` events it raises, so chains settle in one call.
7. The HUD shows `questGuidance` and the phone button. The phone's apps show `questLog`, `summarizeLearning`, `mapPlaces`, `metCharacters` and the message threads. All are selectors over the save; a message thread is stepped by the same `stepDialogue` (`PHONE.md`).

Quest rules are described in `QUEST-SYSTEM.md`.

The save is versioned and stored on the device (`SAVE-SYSTEM.md`); reopening the game resumes it. The pure engines know nothing about storage: they take a save and return a save, and `app/savedGame.ts` is the only code that writes it. Capacitor wraps the same frontend. The game talks to the backend only for voices, spoken answers and second opinions on what the learner said; progress never leaves the device.

## Backend boundary

```
React + Phaser + Capacitor
           |
           v
  Python backend (FastAPI)        backend/, the only server the game calls
   /     |        |        \
 STT    TTS   Pronunciation  AI conversation
           |
       Postgres (planned)
```

`backend/` is one Python/FastAPI service (decision in `PLAN.md` section 4A.8). It has liveness and readiness checks; text-to-speech with a voice per character, cached with its lip-sync timeline (ElevenLabs, or the macOS voices for development); recognition with a local Whisper model warmed at startup; the AI conversation endpoint (`POST /conversation/turn`) behind a provider-neutral model interface with an OpenRouter adapter; and pronunciation evaluation, which the game does not call yet. Accounts, cloud saves, the database and authoritative rewards are still planned, in the same service. Provider credentials stay in it. The frontend depends only on the provider-neutral contracts in `frontend/src/speech`. Details are in `SPEECH-SYSTEM.md` and `backend/README.md`.

AI-driven NPC dialogue stays constrained, and the first layer of it is built (`AI-CONVERSATION.md`). A model may generate, paraphrase, hint, classify meaning and respond in character. It may only *suggest* structured game events; the deterministic core validates them. It never completes quests, awards XP or currency, unlocks locations, or changes inventory or relationship state.

## Adding another target language

Create a pack matching `LanguagePack` under `frontend/src/languages/<code>/`, register it in `frontend/src/languages/index.ts`, and select it at the composition root. The pack provides dialogues, slots, place labels and concept expressions for the shared Chapter 1 content. Neither `core` nor `world` needs edits.

The abstractions deliberately stop at this game's needs. There is no generic entity/component system or content scripting runtime.
