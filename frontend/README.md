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

Characters speak their lines when the backend is running (`cd ../backend && npm
run dev`); the game looks for it at `VITE_API_URL`, which defaults to
`http://localhost:3000` in development. Without it the game is silent and
otherwise the same. To answer by voice, also run the speech service (see
`../speech-service/README.md`); the microphone appears on your turn when it is
ready, and typing is always available. With an AI key in the backend's `.env`, a free answer the game's own rules do not recognise gets a second opinion from a language model (see `../docs/AI-CONVERSATION.md`); without one the game plays the same. 

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
