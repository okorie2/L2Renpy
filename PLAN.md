# Second Language — Master Implementation Plan

## 1. Product Vision

Second Language is a mobile-first language-learning RPG.

Players learn a target language by living inside an interactive game world rather
than completing conventional lessons.

The fundamental product principle is:

> Language is a gameplay mechanic.

The player explores locations, meets recurring characters, develops relationships,
completes quests, purchases items, receives messages, and progresses through a
story.

Language is required to accomplish those things.

The first supported learning configuration is:

- Interface/native language: English
- Target language: French
- Initial learner level: complete beginner / CEFR A1
- Initial platform: mobile
- Initial chapter: approximately 30–45 minutes

The architecture must allow additional target languages later without modifying
the core game systems.

---

# 2. Current State

Phase 0 (Architectural Foundation), Phase 1 (Playable Neighborhood), Phase 2
(Production Quest Engine), Phase 3 (Dialogue Engine), Phase 4 (Learning
Engine), Phase 5 (speech input), Phase 6 (voiced lines), the speech half of
Phase 7, the local half of Phase 8 (Save System), Phase 9 (AI Conversation
Layer) and Phase 10 (In-Game Phone) are complete. A foundation pass after Phase 1 replaced the original
guide character with **Sophie** and prepared the character, dialogue and speech
architecture described in section 4A.

Open on purpose: communication is judged by a rule-based key-phrase assessor
first, with a language model's second opinion only when the rules do not
recognise an answer; pronunciation is not analysed (the owner chose to leave it for now); the save lives on the
device only, and cloud save waits for accounts (Phase 7).

Existing architecture includes:

- React
- TypeScript
- Phaser
- Capacitor
- Framework-independent game models
- Quest models/transitions
- Learning models/evidence tracking (per modality, with assistance)
- Data-driven Chapter 1 content
- Event-driven quest engine: states, prerequisites, sequential/optional/counted
  objectives, item and XP rewards, chaining
- The five-quest Chapter 1 chain, quest log and HUD guidance
- NPC dialogue selected from quest state
- Pure dialogue engine: branching, conditions, effects, repair lines, history
- Communication assessment of the player's turn (typed or picked), finite retries
- Learning engine: per-modality evidence and log, vocabulary detection, standings
  without percentages, support that follows behaviour, a Progress sheet
- Backend (`backend/`): one Python/FastAPI service with health checks, cached,
  provider-neutral text-to-speech with a voice per character, local Whisper
  recognition, the AI second opinion and pronunciation evaluation (section 4A.8)
- Voiced lines: replay, slower playback, mouth timeline, sound settings,
  listening evidence, silent fallback
- Spoken answers: microphone capture, backend transcription through a local
  Whisper model in `backend/`, typed fallback on every turn
- Initial French language pack
- Four-location neighborhood with tap movement, collision and portals
- Sophie as the guide: world sprite (idle/walking/waving) and conversation portrait
- Semantic character visual catalog (`character` + `expression` + `activity`)
- Mobile conversation presentation over the live world
- Dialogue templates with personal slots and unscored spans
- Privacy-conscious player profile captured in Sophie's first conversation
- Support levels controlling translation and hint visibility
- Provider-neutral speech contracts and the speech session state machine
  (no recorder or provider yet)
- Architecture documentation

Existing documentation:

- docs/ARCHITECTURE.md
- docs/CONTENT-SCHEMA.md
- docs/QUEST-SYSTEM.md
- docs/DIALOGUE-SYSTEM.md
- docs/LEARNING-SYSTEM.md
- backend/README.md
- docs/SPEECH-SYSTEM.md
- docs/SAVE-SYSTEM.md
- docs/AI-CONVERSATION.md
- docs/PHONE.md
- docs/ART-BRIEF.md
- docs/MOBILE.md
- docs/L2RENPY-IMPORTS.md
- docs/ROADMAP.md

Documentation is authoritative. When a product or architecture decision
changes, the relevant documents change in the same piece of work.

Before implementing anything in this plan, read those documents.

Do not replace their architectural decisions without a documented reason.

---

# 3. Ultimate Vertical-Slice Goal

The implementation described by this plan should result in a polished,
approximately 30–45 minute playable Chapter 1.

Working chapter title:

# Chapter 1 — Bienvenue

The player:

1. Arrives at their apartment.
2. Learns basic movement/interactions.
3. Meets Sophie.
4. Learns to greet someone.
5. Introduces themselves.
6. Explores the neighborhood with Sophie.
7. Goes to a café.
8. Greets the barista.
9. Understands a simple question.
10. Orders a drink using spoken French.
11. Understands a simple price.
12. Uses polite expressions.
13. Visits a bakery.
14. Purchases an item.
15. Encounters another recurring NPC.
16. Has another short conversation with Sophie.
17. Receives/replies to an in-game message.
18. Returns to the apartment.
19. Receives a chapter summary.
20. Can review what they learned.

The player should finish Chapter 1 feeling that they actually used French to
accomplish things rather than completed a disguised language lesson.

---

# 4. Engineering Principles

These principles apply throughout implementation.

## 4.1 Keep systems independent

Maintain separation between:

- React UI
- Phaser world
- game core
- quest system
- dialogue system
- learning system
- language content
- world/story content
- external AI/speech services

Do not place gameplay state inside React components when it belongs in the core.

Do not place French-specific language inside Phaser/game systems.

---

## 4.2 Content must remain data-driven

Do not implement individual quests through hard-coded component conditionals.

Prefer definitions such as:

Quest → objectives → conditions → events → rewards.

The same applies to dialogue where practical.

---

## 4.3 Language-independent concepts

Game systems operate on concepts such as:

- GREETING
- INTRODUCE_SELF
- POLITE_REQUEST
- THANK_PERSON
- ORDER_ITEM
- UNDERSTAND_PRICE

French content maps those concepts to French expressions.

Do not make core systems depend on strings such as "Bonjour".

---

## 4.4 Communication over exact sentences

When assessing spoken language, determine whether the player successfully
communicated the required meaning.

For example:

"Je voudrais un café."

and

"Un café, s'il vous plaît."

may both satisfy ORDER_ITEM depending on context.

Do not use exact-string matching as the primary assessment mechanism.

---

## 4.5 AI must not control authoritative game state

An LLM may:

- produce dialogue
- rephrase dialogue
- respond naturally
- provide hints
- classify meaning
- suggest feedback

An LLM must NOT independently:

- complete quests
- award currency
- award XP
- unlock locations
- modify inventory
- change relationship state
- modify authoritative progress

AI may suggest structured game events. The deterministic game engine validates
them before anything changes.

---

## 4.6 Build vertically

Every phase should leave the application runnable.

Do not build ten incomplete systems simultaneously.

Implement → test → verify → document → continue.

---

# 4A. Cross-Cutting Decisions

These decisions apply to every later phase. They were added after Phase 1 and
take precedence where an older phase description is less specific.

## 4A.1 Sophie is the guide

Sophie is the primary recurring guide and friend for Chapter 1. She exists as an
NPC inside the Phaser world, where she can idle, walk and wave. Important
dialogue moves into a focused conversation presentation in which she is shown
larger, above a bottom dialogue card, with the environment still visible behind
her. A conversation must never feel like leaving the game for a lesson screen.

Game code never names an image file. It asks for a semantic visual:

    character: "sophie", expression: "question", activity: "speaking"

Expressions: neutral, question, explaining, encouraging, happy, confused.
Activities: closed, speaking. World poses: idle, walking, waving. The catalog
maps these to art and falls back to the nearest approved pose when dedicated
art does not exist yet. Approved Sophie art comes from the L2Renpy project with
its owner's permission; provenance is recorded in docs/L2RENPY-IMPORTS.md.

Lip sync is not a priority. The closed/speaking pair is enough for a simple
audio-derived mouth timeline later. No video generation.

## 4A.2 Communication success and pronunciation quality are separate

They are never combined into one pass/fail score.

If the learner says "Je voudrais un café." and the meaning is clear, ORDER_ITEM
succeeds and the quest may progress, even if pronunciation needs work.
Separately, the learning engine may record that "voudrais" needs practice.
Gameplay is never locked because of an accent when communication succeeded.

One spoken attempt answers these questions separately:

1. Was usable speech detected?
2. What was transcribed?
3. What meaning or intent did the player communicate?
4. Did that satisfy the current game objective?
5. Which learning concepts were demonstrated?
6. Were there pronunciation problems worth practicing?
7. How much assistance was used?

Internal numeric similarity may rank weak words, choose hints or show relative
improvement. It is never presented to learners as an objective score such as
"your pronunciation is 83% correct" without a validated assessment basis.

## 4A.3 Unscored spans

Any part of a line can be excluded from assessment: personal names, place names,
brands, foreign words and other dynamic story values. Lines declare this
generically:

    text: "Je m'appelle {playerName}."
    assessment: { excludedSpans: ["playerName"] }

## 4A.4 Personalisation with minimal data

Early in Chapter 1 Sophie learns a preferred name or nickname, approximate
French experience and a motivation for learning. Nothing else is required, and
exact age is not collected. She then teaches language that is personally
meaningful ("Je m'appelle Samuel. J'apprends le français pour voyager.").
Personal values live in the player profile, never in canonical French content.

## 4A.5 Support adapts to behaviour

Self-reported ability is only an initial hint. Translation is configurable and
not always visible; it recedes as support decreases, while staying reachable.
The game infers appropriate support from behaviour: repeated success without
translation, hints or retries lowers assistance and gradually raises dialogue
complexity; repeated struggle raises hints, eases access to translation and
reuses known vocabulary. Changes are gradual, one step at a time.

## 4A.6 Believable NPC feedback first

When a learner makes a mistake, prefer in-world social feedback ("Pardon ?",
"Un café ?") that lets them repair the exchange inside the scene. Explicit
teaching feedback may follow where useful. Do not lead with a "WRONG" banner.

## 4A.7 Speech is central, never a wall

Speaking is strongly encouraged. The game must still be playable when the
microphone is denied, the room is noisy, the network or recognition fails, or an
accessibility need prevents speaking. Every spoken step offers a fallback such
as typing. Pronunciation practice is finite: retries are bounded, the player can
always continue, and the concept is recorded for later reinforcement.

## 4A.8 Provider-neutral speech and backend boundary

The game depends on interfaces for speech-to-text, text-to-speech and
pronunciation assessment, never on a named vendor. The application backend is
one Python/FastAPI service (`backend/`), and the only server the client talks
to. See Phase 7 and docs/SPEECH-SYSTEM.md.

Decision (owner, 2026-10-02): the NestJS application backend and the separate
Python speech service were replaced by a single Python backend, starting from the
Ren'Py version's speech backend (tag `renpy-final`). Reasons: nearly all of the
backend's work is speech and ML, which lives in Python; that backend already had
pronunciation analysis and hosted voices; one service is simpler to run and to
maintain. Accounts, cloud save and the database will be built in the same
service when their phases come.

## 4A.9 Portrait-first mobile

Design for phones before desktop: safe areas, notches, home indicators, touch
target sizes, varied aspect ratios, keyboard appearance and microphone
permission flows. Desktop is a development environment.

## 4A.10 Reusing L2Renpy

The owner of https://github.com/okorie2/L2Renpy has given permission to reuse
its project-owned material. Concepts are translated into this architecture
rather than ported. Every imported asset is recorded in docs/L2RENPY-IMPORTS.md.
The permission does not override third-party licences: fonts, music, libraries
and other externally sourced files are checked before they are copied.

---

# 5. Phase 1 — Playable Neighborhood

## Goal

Turn the prototype scene into a small but believable game environment.

## Required world

Create one compact neighborhood containing:

- Player apartment
- Street
- Café
- Bakery
- Small public/social area
- Appropriate entrances/interiors

Do NOT build a large city.

## Player

Implement:

- player entity
- idle state
- walking
- facing direction
- movement animation
- tap-to-move
- path/movement cancellation
- collision
- interaction radius
- spawn points
- scene transitions

Movement must work comfortably on mobile.

## Camera

Implement:

- player tracking
- world boundaries
- sensible zoom
- mobile portrait behavior

## NPC system

Create reusable NPC entities.

NPC definitions should contain at minimum:

- id
- display name
- location
- sprite/appearance reference
- dialogue reference
- interaction configuration
- current state

Initial recurring NPCs:

- Sophie
- Café barista
- Bakery employee
- One additional neighborhood character

## Interactions

Player should be able to:

- approach NPC
- receive interaction indicator
- tap interaction
- enter dialogue
- exit dialogue
- resume movement

## Acceptance criteria

Phase is complete when:

- Player can explore neighborhood.
- Collision works.
- Player can enter required locations.
- Camera behaves correctly.
- Four NPCs can exist using the same NPC system.
- Sophie interaction still works.
- Desktop development and mobile viewport both work.
- Build passes.

---

# 6. Phase 2 — Production Quest Engine

## Goal

Make Chapter 1 progression completely data-driven.

Extend the existing quest architecture where necessary.

## Required capabilities

Support:

- quest IDs
- quest status
- prerequisites
- sequential objectives
- optional objectives
- objective progress
- event-based completion
- quest rewards
- quest chains
- location requirements
- NPC requirements
- language-intent requirements
- item requirements
- quest completion events

Suggested states:

- locked
- available
- active
- completed

## Quest log UI

Add an in-game quest interface showing:

- current quest
- current objective
- completed objectives
- available quests

HUD should only show the most immediately useful objective.

## Chapter 1 quest chain

Create approximately 3–5 connected quests.

Example:

### Quest 1 — Bonjour, Sophie

- Find Sophie.
- Greet Sophie.
- Introduce yourself.

### Quest 2 — Un café

- Follow/go with Sophie to café.
- Enter café.
- Greet barista.
- Order a drink.
- Understand the price.
- Thank barista.

### Quest 3 — À la boulangerie

- Find bakery.
- Ask for item.
- Understand quantity/price.
- Purchase item.

### Quest 4 — Le quartier

- Meet another NPC.
- Exchange basic information.
- Return to Sophie.

### Quest 5 — À bientôt

- Receive Sophie's message.
- Understand/respond.
- Return home.
- Finish chapter.

Exact naming/content may evolve, but learning progression must remain coherent.

## Acceptance criteria

Chapter can be progressed entirely through game events without React components
manually deciding quest progression.

---

# 7. Phase 3 — Dialogue Engine

## Goal

Create reusable interactive conversations.

## Already in place

The dialogue data model and presentation foundation exist: nodes carry a
semantic speaker expression, optional translation and hint, `{slot}` templates,
`assessment.excludedSpans`, and a response (`text`, `choice` or `speech`). The
conversation UI shows the speaker's portrait over the world, a name chip, the
target language as primary text, translation governed by the support level, a
hint action, a continue control, an optional replay control and the spoken
response control with its fallback. Phase 3 builds the engine on top of this:
branching, conditions, game events from responses, history and assessed answers.

## Dialogue node capabilities

Support:

- NPC utterance
- translation
- optional translation
- player response
- selectable response
- typed response
- spoken response
- branching
- conditions
- actions/events
- hints
- concept association
- vocabulary association
- repeat
- slower playback
- dialogue completion

## Beginner assistance

At early A1, dialogue may display:

French:

"Bonjour ! Comment tu t'appelles ?"

Optional English:

"Hello! What's your name?"

Hint:

"Je m'appelle \_\_\_\_."

As progression increases, assistance must be configurable.

Do not assume translations will always be visible.

## Dialogue history

Allow player to inspect recent lines during the current conversation.

## Acceptance criteria

The Sophie and café conversations run through the generic dialogue engine.

---

# 8. Phase 4 — Learning Engine

## Goal

Track what the player is actually learning independently from game XP.

## Track concepts

Examples:

- GREETING
- INTRODUCE_SELF
- POLITE_REQUEST
- ORDER_ITEM
- THANK_PERSON
- NUMBERS_1_10
- UNDERSTAND_PRICE
- YES_NO
- BASIC_QUESTION
- FAREWELL

## Track vocabulary

Each vocabulary item should support appropriate metadata such as:

- language
- lemma
- surface forms
- translation/gloss
- part of speech
- associated concepts
- examples
- introduction point

## Player mastery

Track evidence separately for:

- encountered
- understood
- recognized through listening
- produced through speaking
- produced through writing

Avoid pretending one successful attempt means mastery.

## Evidence

Record learning evidence such as:

- concept
- activity
- timestamp
- result
- assistance used
- attempts
- confidence where available

Evidence for every meaningful language interaction supports: concept ID,
vocabulary IDs, modality (listening, speaking, reading, writing), success,
assistance used, attempts, timestamp, optional pronunciation diagnostics and
confidence where appropriate. Listening evidence is recorded separately from
speaking evidence.

## Support adaptation

Infer the support level from behaviour, as described in section 4A.5. The
self-reported experience from Sophie's first conversation only seeds it.

## Assistance levels

Track whether the player succeeded:

- independently
- with translation
- with hint
- with suggested response
- after retry

Independent success should provide stronger mastery evidence.

## Acceptance criteria

After Chapter 1, the game can explain what the player encountered and what they
appear to understand/use.

---

# 9. Phase 5 — Speech System

## Goal

Allow the player to actually speak French.

Abstract speech providers behind interfaces.

Do not tightly couple game code to one vendor.

## Pipeline

    player audio
        ↓
    speech-to-text
        ↓
    communication / intent assessment
        ↓
    quest/game event
        ↓
    pronunciation analysis
        ↓
    learning evidence / optional practice

The game event depends only on communication. Pronunciation analysis runs
afterwards and can only add evidence or suggest practice.

## Speech interaction states

Speech interactions are an explicit state machine: idle, recording, processing,
result, error. It supports start, stop, retry, cancel, permission errors,
network errors, a transcription preview, feedback and a typed fallback. The
pure reducer and the UI control already exist; this phase connects a recorder
and providers to them.

## Pronunciation remediation loop

When practice is appropriate:

    phrase attempt
        ↓
    weak word identified
        ↓
    word attempt 1
        ↓
    word attempt 2
        ↓
    phonetic/help hint if necessary
        ↓
    final phrase attempt
        ↓
    continue regardless, while recording evidence

Retries are always finite. The player is never trapped in an exercise.

## Exercise IDs

Pronunciation requests identify an exercise (`exerciseId: cafe-order-001` plus
the learner's audio). The server and content system own the expected text,
phonemes, canonical audio, unscored spans and assessment rules. The client does
not upload them with every attempt.

## UX

Implement:

- microphone permission
- press/tap to speak
- listening state
- processing state
- transcription display
- retry
- cancel
- microphone failure
- network failure
- graceful fallback

## Assessment

Assess:

1. Was understandable speech detected?
2. What was transcribed?
3. Did it communicate the required intent?
4. Were required concepts present where applicable?
5. How much assistance was used?
6. Should the player retry?
7. What useful feedback should be shown?

Pronunciation scoring should remain distinct from meaning.

A learner should not fail a quest merely because pronunciation is imperfect if
the communication was understandable.

## Development fallback

Maintain a developer/mock speech provider so gameplay can be tested without
incurring API costs.

## Acceptance criteria

The café order can be completed by speaking valid French rather than selecting a
prewritten answer.

---

# 10. Phase 6 — Audio / Listening

## Goal

Make French something the player hears, not only reads.

Implement a TTS/audio abstraction.

NPC dialogue should support:

- normal playback
- replay
- slower playback
- subtitles
- volume control

Do not automatically reveal English translations unless assistance settings say
to do so.

Generated speech is cached with a key made of provider, model, voice, language
and the exact text, so an identical line is never synthesized twice.
Pre-recorded canonical dialogue may be used where appropriate. Learners control
replay, slower playback, subtitles and translation.

Voiced lines may drive a simple two-state mouth (closed/open) from a lightweight
audio-derived timeline. This is optional polish, not a requirement of the phase.

Track listening evidence where meaningful.

Provide mock/development support where practical.

---

# 11. Phase 7 — Backend

Only introduce the backend once the local gameplay loop is functioning.

The backend is one Python/FastAPI service in `backend/` (decision in section
4A.8). Persistence, when it comes, is PostgreSQL behind it.

## Architecture

    React + Phaser + Capacitor
               |
               v
      Python backend (FastAPI)
      main application API
       /     |       |       \
     STT    TTS   Pronunc.   AI conversation
               |
           Postgres (planned)

The backend is the only service the client talks to. Speech and ML run inside
it (faster-whisper, torch models, librosa/audio processing, phoneme analysis).
A model with dependencies that clash with the rest may run as a separate local
process behind it, as the optional Chatterbox voice does.

## Responsibilities

The backend should eventually handle:

- accounts
- cloud save
- game state and player progression persistence
- authoritative rewards
- content/version APIs, including canonical exercise definitions
- AI conversation orchestration
- provider credentials and speech/AI-provider proxying
- assessment requests

Never expose provider secrets inside the mobile client.

## Model warmup

When local ML models are introduced, load and warm them during service startup
and expose readiness separately from liveness, so the first learner's speech
attempt does not pay the model-load latency.

## API design

Define APIs before implementation.

Potential domains:

/auth
/player
/save
/progress
/speech
/conversations
/assessment
/content

Do not blindly implement these exact routes if better domain boundaries emerge.

---

# 12. Phase 8 — Save System

## Local save first

Implement versioned local persistence.

Persist at minimum:

- player state
- quest state
- world state where necessary
- inventory
- currency
- relationships
- learning mastery
- vocabulary progress
- settings

Save should survive application restart.

## Cloud save later

Once accounts/backend exist:

- synchronize saves
- handle versioning
- handle conflicts conservatively
- never silently destroy newer progress

---

# 13. Phase 9 — AI Conversation Layer

## Goal

Allow conversations to feel less scripted while retaining pedagogical control.

Do not replace the deterministic dialogue system.

Use AI as an enhancement layer.

## AI context

Provide controlled context including:

- NPC identity/personality
- relationship
- current location
- current quest
- learner level
- target concepts
- known vocabulary
- weak vocabulary
- recent conversation
- allowed complexity
- language rules

Example:

NPC: Sophie
Relationship: friend
Learner level: A1
Current situation: café
Target concepts:

- ORDER_ITEM
- POLITE_REQUEST

Instructions:

- Primarily use beginner French.
- Keep responses short.
- Avoid unnecessary vocabulary.
- Rephrase when learner struggles.
- Stay in character.

## Structured responses

Prefer structured AI output containing fields such as:

- npcResponse
- detectedIntent
- confidence
- conceptsDetected
- correction
- suggestedGameEvents

Validate everything.

Suggested game events are not authoritative until game rules validate them.

## Safety

Prevent:

- prompt injection affecting game authority
- AI-generated arbitrary rewards
- malformed structured responses
- runaway token usage
- excessively difficult language

---

# 14. Phase 10 — In-Game Phone

Create a phone interface that becomes the primary meta-game navigation.

Applications:

## Messages

NPC conversations/messages.

Sophie can send messages such as:

"Salut ! Tu veux aller au café demain ?"

Player can respond.

## Map

Show:

- discovered locations
- useful NPC/location markers
- current objective

## Contacts

Show characters met and basic relationship/context.

## Phrasebook

Show:

- encountered vocabulary
- expressions
- examples
- audio
- familiarity/mastery

## Quests

Current/completed quests.

## Progress

Language-learning progress.

Do NOT clutter the main game HUD with these systems.

---

# 15. Phase 11 — Review / Reinforcement

## Goal

Reintroduce weak material naturally.

Create a lightweight review scheduler.

Consider:

- time since last successful use
- number of successes
- number of failures
- assistance used
- listening vs speaking ability
- importance of concept

Weak concepts should influence future encounters.

Example:

If player struggles with numbers, later NPCs may naturally ask about:

- prices
- apartment number
- quantities
- time

Avoid turning the game into a flashcard app.

Review should primarily happen through gameplay.

---

# 16. Phase 12 — Progression

Separate:

## Game progression

- XP
- chapter progress
- currency
- inventory
- relationships
- location/story unlocks

from:

## Language progression

- vocabulary
- concepts
- listening
- speaking
- reading
- writing where applicable
- independence/assistance

Do not equate game level directly with CEFR level.

CEFR claims must not be made solely from XP.

---

# 17. Phase 13 — Inventory and Simple Economy

Implement only what Chapter 1 requires.

Support:

- currency
- items
- item acquisition
- purchases
- inventory

Examples:

- coffee
- croissant/baguette
- apartment-related item if story requires it

Economy should support language interactions rather than become a management game.

---

# 18. Phase 14 — NPC Relationships and Memory

Track deterministic relationship state.

Potential fields:

- met
- relationship level
- relevant completed interactions
- story flags

NPCs should remember important events.

Sophie should not repeatedly introduce herself after the player has met her.

AI may receive this memory as context but must not be the authoritative memory
store.

---

# 19. Phase 15 — Chapter Completion

Implement the end-of-chapter experience.

Show:

- quests completed
- expressions encountered
- vocabulary encountered
- concepts practiced
- speaking attempts
- areas needing practice

Avoid simplistic percentages implying fluency.

Example:

Chapter 1 Complete

You can now practice:
✓ Greeting someone
✓ Introducing yourself
✓ Ordering a drink
✓ Saying please and thank you

Needs more practice:
• Understanding spoken prices
• Numbers

Allow player to continue exploring after chapter completion.

---

# 20. Phase 16 — Mobile Production Pass

The game must feel designed for a phone rather than a website inside a wrapper.

Test:

- Android
- portrait layout
- multiple screen sizes
- safe areas
- keyboard behavior
- microphone permissions
- audio routing
- touch targets
- app pause/resume
- background/foreground transitions
- network loss
- orientation policy
- performance

Optimize Phaser rendering and assets.

Investigate bundle splitting if appropriate.

Address Vite's bundle warning where meaningful, but do not prematurely optimize.

---

# 21. Phase 17 — Accessibility and Learning Settings

Implement settings such as:

- translation assistance
- subtitles
- text size
- dialogue speed
- TTS speed
- sound/music
- vibration
- reduced motion where applicable

Learning assistance should be configurable.

Do not require one difficulty mode for every learner.

---

# 22. Phase 18 — Content Validation

Before considering Chapter 1 finished, review all French content.

Check:

- grammatical correctness
- naturalness
- appropriateness for beginner French
- vocabulary difficulty
- consistency
- cultural context
- translations
- progression

AI-generated French must not automatically become canonical learning content
without review.

Structure content so corrections do not require game-code changes.

---

# 23. Phase 19 — Testing

Maintain tests as systems are introduced.

Prioritize deterministic systems.

Test:

- quest transitions
- objective completion
- rewards cannot duplicate
- language-pack resolution
- dialogue branching
- mastery evidence
- save/load
- migrations/versioning
- assessment parsing
- AI structured-response validation
- inventory transactions

Add end-to-end tests for the Chapter 1 critical path where practical.

---

# 24. Phase 20 — Analytics / Playtesting Instrumentation

Before real playtesting, record privacy-conscious gameplay events.

Useful measurements:

- quest started/completed
- objective failure/retry
- dialogue abandonment
- hints requested
- translations revealed
- speech attempts
- assessment retries
- location where players stop playing

Do not collect raw microphone audio by default.

Avoid unnecessary personal data.

The purpose is to answer:

"Where does learning/gameplay stop being enjoyable or understandable?"

---

# 25. Phase 21 — Vertical Slice Polish

Stop adding systems.

Play Chapter 1 repeatedly.

Improve:

- pacing
- movement
- dialogue
- French progression
- onboarding
- animations
- feedback
- transitions
- audio
- environment
- UI
- bugs
- performance

The vertical slice should feel like a small game, not a technology demonstration.

---

# 26. Definition of Done — Initial Vertical Slice

The milestone is complete when a new player can:

1. Install/open the mobile app.
2. Enter the game.
3. Understand basic controls.
4. Explore a small neighborhood.
5. Meet recurring NPCs.
6. Complete multiple connected quests.
7. Hear French spoken.
8. Speak French using their microphone.
9. Have valid alternative wording accepted.
10. Receive useful feedback after mistakes.
11. Use translations/hints when necessary.
12. Learn vocabulary through gameplay.
13. Have progress tracked.
14. Purchase something through a French interaction.
15. Receive/respond to an NPC message.
16. Review vocabulary in their phone.
17. Close/reopen the game without losing progress.
18. Finish Chapter 1.
19. See a meaningful learning summary.
20. Continue exploring afterward.

Most importantly:

A player should be able to explain:

> "I needed French to play the game, and I learned some French because I wanted
> to progress."

If it instead feels like:

> "I completed French exercises while a character walked around in the
> background,"

the product has failed its core design goal.

---

# 27. Explicitly Out of Scope for Initial Vertical Slice

Do NOT implement unless this plan is explicitly updated:

- multiplayer
- PvP
- guilds
- social feed
- user-generated quests
- giant open world
- procedural city
- dozens of languages
- complete A1–C2 curriculum
- advanced character creator
- player trading
- marketplace
- complex economy
- crafting
- combat
- subscription/payment system
- leaderboards
- achievements beyond what is needed for testing
- web social platform

---

# 28. Coding Agent Operating Procedure

When implementing this plan:

## Before each phase

1. Read this PLAN.md.
2. Read relevant `/docs` documents.
3. Inspect current implementation.
4. Identify what already exists.
5. Produce a concise implementation plan.
6. Identify architectural risks.

Do not rewrite working systems merely because another implementation is preferred.

## During implementation

Work incrementally.

After meaningful changes:

- typecheck
- run tests
- build
- inspect errors
- fix regressions

Keep commits/changes conceptually focused.

## After each phase

Run all relevant validation.

Report:

### Completed

What was implemented.

### Files

Important files created/modified.

### Architecture

Any architectural decisions made.

### Tests

Commands executed and results.

### Manual verification

What was manually tested.

### Deferred

Anything intentionally left for later.

### Risks / technical debt

Anything the next phase should know.

### Next phase

State the next recommended phase.

Do not silently proceed through major architectural changes.

---

# 29. Autonomy Rules

The coding agent may autonomously:

- fix bugs
- add tests
- refactor locally where necessary
- improve types
- improve naming
- remove genuinely dead code
- create reusable components
- update documentation
- make small UX improvements required by the current phase

The coding agent should stop and document the decision before making changes that:

- fundamentally change the architecture
- replace Phaser
- replace React
- replace Capacitor
- abandon the language-pack architecture
- significantly alter Chapter 1's product direction
- introduce a major paid external dependency
- introduce a new backend architecture
- require irreversible data migrations
- significantly expand scope

---

# 30. Product Priority Order

When tradeoffs occur, optimize in this order:

1. Learning usefulness
2. Fun / player motivation
3. Natural language interaction
4. Reliability
5. Mobile usability
6. Maintainable architecture
7. Visual polish
8. Feature quantity

Do not sacrifice the learning loop to add more game features.

---

# 31. Immediate Next Task

Current milestone:

Phases 0 to 6, the Sophie foundation pass, the speech half of Phase 7, the
local save of Phase 8, the AI conversation layer of Phase 9 and the in-game
phone of Phase 10 are complete.

## Audio route, as built

Real speech providers need credentials or models that cannot ship inside the
app, so audio was built in this order rather than by phase number:

1. **Backend slice for speech.** `backend/`: liveness and readiness, and a
   provider-neutral, cached `POST /speech/synthesize`. First built in NestJS,
   now the Python backend (section 4A.8).
2. **Phase 6 — voiced lines.** Replay, slower playback, a mouth that follows the
   audio, sound settings, listening evidence, silent fallback.
3. **Phase 5 — speech input.** A local Whisper model in the backend, warmed at
   startup, behind `POST /speech/transcribe`. In the game the learner taps,
   speaks, and the transcript enters the dialogue engine as a spoken answer.
   Typing remains on every turn.

Two processes run in development: the frontend (5173) and the backend (3000).
Without the backend the game is silent and typed, and otherwise the same.

Still open from the speech plan:

- **Pronunciation analysis and the word-practice loop** (section 4A.7). Speech is
  assessed for communication only in the game. The Ren'Py evaluator (a French
  phoneme model, word-by-word alignment, weakest word) is back in the backend as
  `POST /speech/pronunciation`, still in its Ren'Py shape (reference audio
  uploaded with each attempt). Next: an exercise-ID endpoint, and the practice
  loop in the game (`docs/SPEECH-SYSTEM.md`).
- **A production voice.** ElevenLabs is wired in, with a voice per character
  (`ELEVENLABS_VOICES`); the macOS voices remain for development. Choosing the
  voices for Nadia, Luc and Malik is the owner's.
- **Authentication or rate limiting** on the speech endpoints, required before
  the backend is reachable from outside a developer machine.
- **Recognition accuracy** has been checked with synthesized speech only. The
  backend now defaults to `large-v3-turbo`, as the Ren'Py version did;
  `FASTER_WHISPER_MODEL=small` is quicker if answers feel slow.

## Local save, as built

The game saves itself on the device as the player goes and resumes where it was
left: location and position, quests, profile, inventory and the whole learning
record. See `docs/SAVE-SYSTEM.md`.

- `frontend/src/save`: a three-method storage interface, a versioned codec with
  migrations and a strict structural check, a store, and an autosave that writes
  progress at once and movement sparingly.
- A save that cannot be read is set aside, never half-loaded; a save from a
  newer version is never overwritten; a device that cannot store anything still
  runs the game.
- "Start over" in the quest log is the only way progress is erased.
- Currency and relationships are listed in section 12 but do not exist in the
  game yet; they join the save with their own phases. Sound settings stay
  per device, outside the save.

Still open from the save plan: cloud save (needs accounts), a native storage
adapter for iOS, and a way to recover a set-aside save.

## AI conversation layer, as built

A language model gives the game a second opinion on what the learner said. See
`docs/AI-CONVERSATION.md`.

- The rule-based assessor is always asked first. Only a typed or spoken answer
  it does not recognise is sent to the backend (`POST /conversation/turn`).
- The opinion is advice. The engine accepts it only for the current line's
  intent and only above a confidence threshold. On a miss the character may
  react to what was said, in place of the scripted repair words; the node and
  the flow stay scripted.
- Section 13's structured fields were narrowed on purpose: there is no
  `suggestedGameEvents` and no `conceptsDetected`. The only consequence an
  opinion can have is the `INTENT_COMMUNICATED` event the line already raises.
- Provider: OpenRouter, model `google/gemini-3.1-flash-lite` (the owner asked
  for "3.2", which OpenRouter does not list), changeable with `AI_MODEL`. The
  key lives in `backend/.env` only.
- The game plays the same with the layer off.

## Answer feedback, as built

After every answer the next line shows it back: what was said, written or
chosen, the words that were credited as used (marked), one sentence on how it
went, and another way to say it when the AI layer offered one. The history
sheet shows the same. It reports communication only; pronunciation is not
judged yet. See `docs/DIALOGUE-SYSTEM.md`.

Still open from the AI plan: open-ended conversation with a character, a
vocabulary check on generated replies, authentication on the endpoint, and
building the scene on the server once the backend owns game state.

## In-game phone, as built

One phone button on the HUD opens Messages, Map, Contacts, Phrasebook, Quests,
Progress and Settings. See `docs/PHONE.md`.

- A message thread is an ordinary dialogue shown as messages and run by the
  same engine, so evidence, quest events, repair and the AI second opinion all
  apply. Threads arrive from game state (`deliverMessages`) and are stored in
  the save with their progress.
- Sophie's message completes the last quest: read it, say how you are, accept
  or decline her invitation.
- The quest log and progress sheets moved into the phone; the HUD keeps the
  current step and the phone button only.
- The save is version 2 (`messages`, `visitedLocationIds`), with an upgrade
  from version 1.
- "Start over" is in the phone's Settings.

Still open from the phone plan: more threads, voice notes, relationship
context in Contacts, and artwork for the app icons.

## Art direction (owner decision, 2026-10-02)

The whole world is to be brought up to Sophie's illustrated style: illustrated
sprites for every character, the player included, and a painted backdrop for
every location. The owner generates the art; `docs/ART-BRIEF.md` says what to
make and in what order, starting with a pilot (the player's front sprites and
the street).

The game is ready for it: sprites may have front, side and back frames, any
character in the catalog is a sprite, a location may have a `backdrop`, and
`frontend/tools` cuts sheets into frames and draws a layout guide for each
location. Until art arrives, the drawn shapes remain.

Done (2026-10-02): every Chapter 1 character and location is illustrated. The
player walks toward, away from and across the camera; Sophie has a six-pose
walk; Malik, Nadia and Luc stand; the street and the three rooms are paintings,
with their solid areas, doors and standing spots measured from them, larger
figures indoors, and cut-outs so people can stand behind the fountain and the
counters. Nadia, Luc and Malik have four close-up expressions each, and their
lines now name the expression to show. Still to make: open-mouth versions of
those close-ups, Sophie's side walk, and larger versions of the paintings. `docs/ART-BRIEF.md` has the list.

## iOS and Android builds (2026-10-02)

The app is named Second Language (`com.psami.secondlanguage`) and has native
projects for both platforms under `frontend/ios` and `frontend/android`. It
builds and runs in the iOS simulator. A mobile build takes its backend address
from `frontend/.env.mobile.local`; plain HTTP is allowed only for a backend on
the local network. Microphone permission and portrait lock are set on both.
See `docs/MOBILE.md`. This is the first part of the Mobile Production Pass
(section 20); icons, signing, a hosted backend and real-device checks remain.

Next:

# Phase 11 — Review / Reinforcement

Bring weak material back through gameplay. The evidence it needs is already
recorded: per-modality counts, misses, help used, `needsPractice`, and when
each concept was last practised.

Before implementation:

- read all `/docs`
- preserve the boundaries and the decisions in section 4A
- review happens through gameplay and the phone, never a flashcard screen
- anything new the player keeps goes into `GameSave` with a version bump and a
  migration (`docs/SAVE-SYSTEM.md`)

Implement one phase and stop at its acceptance criteria.
