# Roadmap

## Phase 0 — Foundation (complete)

- Separate React, Phaser, game core, learning engine, game content, and language packs.
- Define the requested models and stable language-independent concept IDs.
- Drive Sophie's introduction and the first quest from content; keep the mobile prototype runnable.
- Document content references, quest transitions, and learning evidence.

## Phase 1 — Playable neighborhood (complete)

- Four compact locations with entrances, interiors, fixed world bounds, and a public square.
- Shared animated character entity for the player and four NPCs.
- Tap pathing, solid obstacles, cancellation, camera follow, and portrait/desktop layouts.
- Generic proximity actions, dialogue exit/resume, and validated portal transitions.

## Sophie and conversation foundation (complete)

- Sophie replaces the original guide everywhere: content, IDs, dialogue, tests and docs.
- Semantic character visuals (`character` + `expression` + `activity`; world poses idle/walking/waving) with approved art imported from L2Renpy.
- Conversation presentation over the live world: portrait, name chip, target language first, translation by support level, hint, continue, choice/text/speech responses, safe areas.
- Personalised introduction with a minimal player profile, `{slot}` templates and generic unscored spans.
- Learning evidence per modality with assistance; support levels seeded by self-report.
- Provider-neutral speech contracts and the speech session state machine, without a recorder or provider.

## Phase 2 — Production quest engine (complete)

- Quest states (locked, available, active, completed), prerequisites, start steps, sequential and optional objectives, counted progress, location requirements, XP and item rewards.
- Event-driven progression: dialogue, dialogue line, NPC, location, item, quest-completed, and the language triggers that assessment will emit later.
- NPC dialogue chosen from quest state by ordered rules.
- The five-quest Chapter 1 chain as data, playable end to end; language steps are not assessed yet.
- Quest log sheet, HUD guidance and a quest-complete notice, all derived from the save.

## Phase 3 — Dialogue engine (complete)

- Pure dialogue engine: branching, conditions, one-time effects, history, completion events.
- The player's turn is assessed for the intent, with typed or picked answers; any valid wording counts.
- In-scene repair lines ("Pardon ?") and finite retries that end in offered answers.
- In-scene actions show understanding (paying the price that was said).
- Chapter 1 language objectives now require communicated intents.

## Phase 4 — Learning engine (complete)

- Ten Chapter 1 concepts and a proper vocabulary model, detected in lines and in what the player says.
- Evidence per modality with attempts, misses and help, plus a bounded log of recent interactions.
- A summary of what was met, understood and produced, with coarse standings and no percentages.
- Support level that follows behaviour, one step at a time.
- A Progress view that shows it (now an app on the phone).

## Backend slice for speech (complete)

- `backend/`: NestJS service with liveness and readiness, and a provider-neutral, cached text-to-speech endpoint.
- A free local development provider (macOS system voices); a hosted provider is one adapter away and needs a decision and a key.
- This is the part of Phase 7 that audio needs. Accounts, saves, database and the rest of Phase 7 remain.

## Phase 6 — Voiced lines (complete)

- Character lines are spoken through the backend as they appear, with replay and slower playback.
- The mouth follows the audio; sound settings cover voices, volume and listen-first.
- Listening evidence is recorded separately from reading.
- The game stays fully playable in silence when the backend is away.

## Phase 5 — Speech input (complete)

- Tap, speak, and the answer goes through the backend to a local Whisper model.
- The transcript enters the dialogue engine like a typed answer: intent assessed, quest advanced, speaking evidence recorded.
- Typing stays on every turn; every microphone or network failure leaves a way forward.
- Not included: pronunciation analysis and the word-practice loop.

## Phase 8 — Local save (complete)

- The game saves on the device as you play and resumes where it was left: place, quests, profile, inventory, learning record.
- Versioned format with migrations; unreadable saves are set aside, newer ones are never overwritten.
- "Start over" (now in the phone's Settings) erases stored progress after confirmation.
- Not included: cloud save, native storage on iOS, recovering a set-aside save. See `SAVE-SYSTEM.md`.

## Phase 9 — AI conversation layer (complete)

- A language model gives a second opinion on free answers the rules do not recognise, and can have the character react to what was said.
- The scripted engine stays in charge: the model can only name the current line's intent; it cannot grant, unlock or skip anything.
- Provider-neutral backend endpoint with an OpenRouter adapter (`google/gemini-3.1-flash-lite`), bounded inputs, validated output, caching and a per-minute cap.
- The game plays the same without it.
- Not included: open-ended chat, vocabulary checks on replies, authentication. See `AI-CONVERSATION.md`.

## Answer feedback (complete)

- Each answer is shown back on the next line with the credited words marked and one sentence on how it went; the history sheet shows the same.
- Communication only. Pronunciation marks wait for the pronunciation phase; L2Renpy's approach is recorded in `SPEECH-SYSTEM.md`.

## Phase 10 — In-game phone (complete)

- One phone button on the HUD opens Messages, Map, Contacts, Phrasebook, Quests, Progress and Settings.
- Message threads are ordinary dialogues run by the same engine; Sophie's message completes the last quest.
- The save is version 2 (messages, places visited) with an upgrade from version 1.
- "Start over" lives in Settings.
- Not included: more threads, voice notes, relationships, inventory, fast travel, real app icons. See `PHONE.md`.

## Next: Phase 11 — Review and reinforcement

- Bring weak material back through gameplay, using the evidence already recorded.

## Later playable learning slice

- Add a simple assessed greeting/response interaction that works without speech recognition.
- Emit concept success only when an answer is validated, and show learning progress in UI.

## Complete Chapter 1

- Author the cafe and barista, the order and price conversations, quest prerequisites, and rewards.
- Add practice/retry feedback for polite requests, ordering, and understanding price.
- Validate content references and pack completeness as content volume grows.

## Later

- Add reading/writing interactions, more target-language packs, and accessibility/polish for mobile.
- Connect a recorder and speech providers to the existing speech session, behind the backend, once the assessed non-speech loop is playable.
- Voice dialogue (TTS with caching, replay, slower playback) and record listening evidence.
- Infer the support level from behaviour; return weak material through gameplay and the in-game phone.

Accounts, the database, cloud save, LLM dialogue and pronunciation analysis are intentionally not built yet. See `PLAN.md` for the phase order.
