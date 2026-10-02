# Quest system

Quest progression is data plus one pure reducer. Quest definitions live in `frontend/src/content/chapter1.ts`; the engine is `frontend/src/core/quests.ts`. React reports what happened and renders what the engine returns. No component decides whether a quest or objective is complete.

## Lifecycle

```
locked ──prerequisites completed──▶ available ──start step (if any)──▶ active ──all required objectives──▶ completed
```

- **locked**: a prerequisite quest is not completed. Not shown in the log.
- **available**: can be started. A quest without `start` becomes active immediately; a quest with `start` waits for that trigger and tells the player what to do (`start.description`).
- **active**: objectives can progress.
- **completed**: rewards were granted, once, at this transition.

## Quest definition

```ts
{
  id: "neighborhood",
  chapter: 1,
  title: "Le quartier",
  summary: "Meet someone new in the square, then tell Sophie how it went.",
  prerequisites: ["bakery"],
  start: { trigger: { type: "DIALOGUE_COMPLETED", dialogueId: "sophieToSquare" }, description: "Talk to Sophie" },
  objectives: [
    { id: "meetMalik", description: "Meet Malik in the square", trigger: { type: "NPC_TALKED", npcId: "neighbor" } },
    { id: "greetNadiaAgain", description: "Say hello to Nadia again", trigger: { type: "NPC_TALKED", npcId: "barista" }, optional: true },
    { id: "returnToSophie", description: "Go back to Sophie", trigger: { type: "DIALOGUE_COMPLETED", dialogueId: "sophieAfterErrands" } }
  ],
  rewards: [{ type: "XP", amount: 30 }]
}
```

- **Sequential objectives.** Required objectives complete in order; only the current one can progress. One event advances a quest by at most one required objective.
- **Optional objectives** (`optional: true`) can be completed at any point while the quest is active and never block completion.
- **Progress** (`count`) asks for several matching events; the count so far is stored in `QuestProgress.objectiveCounts`.
- **Location requirement** (`requires.locationId`) makes an event count only while the player is in that location.
- **Rewards** are `XP` or `ITEM`. Items go into `GameSave.inventory`.

## Events and triggers

`applyGameEvent(save, quests, event)` is the only place quest state changes. It is pure and idempotent: replaying an event cannot grant a reward twice.

| Event | Raised when | Triggers it can satisfy |
| --- | --- | --- |
| `DIALOGUE_COMPLETED` (dialogue, NPC) | a conversation reaches its last line | `DIALOGUE_COMPLETED`, `NPC_TALKED` |
| `DIALOGUE_LINE_COMPLETED` (dialogue, line) | the player gets past a line | `DIALOGUE_LINE_COMPLETED` |
| `LOCATION_ENTERED` | `travelThroughPortal` moves the player | `LOCATION_ENTERED` |
| `ITEM_ACQUIRED` | a quest reward or a dialogue effect gives an item | `ITEM_ACQUIRED` |
| `QUEST_COMPLETED` | the engine completes a quest | `QUEST_COMPLETED` |
| `CONCEPT_DEMONSTRATED` | the player shows understanding through an in-scene action | `CONCEPT_DEMONSTRATED` |
| `INTENT_COMMUNICATED` | the player's answer conveys an intent, however it is worded | `INTENT_COMMUNICATED` |

Events the engine raises itself are processed in the same call, so quest chains settle before it returns: completing one quest can unlock, start and even advance the next. When quest state changes, the engine also re-announces the player's current location, so a new objective that asks for the place the player is already standing in completes without a pointless round trip.

## Who decides what an NPC says

NPCs carry an ordered list of dialogue rules (`NPC.dialogues`). `selectNpcDialogueId` in `frontend/src/core/conditions.ts` returns the first rule whose conditions hold; the last rule is unconditional. Conditions test quest status, the current objective, or a completed dialogue. This is how the barista greets you before the café quest, takes your order during it, and goes back to greeting you afterwards, without any branch in the UI.

## Selectors for the UI

- `questGuidance` returns the single most useful line for the HUD: the first active quest's current objective, otherwise how to start an available quest.
- `questLog` returns available, active and completed quests with each objective's state. The log hides upcoming objectives so it guides without spoiling.
- `currentObjective` returns the required objective a quest is on.

The HUD's quest summary opens the log. A short notice appears when a quest completes; it is derived from state, not from a decision in the component.

## Chapter 1 chain

| # | Quest | Starts | Objectives | Rewards |
| --- | --- | --- | --- | --- |
| 1 | Bonjour, Sophie | at once | go outside → tell Sophie your name → introduce yourself (intent) → hear her plan | 20 XP |
| 2 | Un café | after 1 | enter the café → greet (intent) → order a coffee (intent) → pay the right price (concept) → say thank you | 30 XP |
| 3 | À la boulangerie | after 2 | enter the bakery → ask for a croissant (intent) → pay the right price (concept) → thank and goodbye | 30 XP |
| 4 | Le quartier | after 3, by talking to Sophie | meet Malik → (optional: greet Nadia again) → go back to Sophie | 30 XP |
| 5 | À bientôt | after 4 | go home | 20 XP |

Language objectives use `INTENT_COMMUNICATED` or `CONCEPT_DEMONSTRATED` with a location requirement, so a general intent such as greeting counts only in the place the quest means. The coffee and the croissant are handed over by the conversation itself (a one-time dialogue effect), not as quest rewards.

`tests/quests.test.ts` plays this chain from start to finish through the dialogue engine.

### What is not real yet

- **Speech.** Answers are typed or picked. The same intents will be satisfied by spoken answers once speech input exists; quest data does not change.
- **Assessment depth.** Communication is judged by key phrases (see `DIALOGUE-SYSTEM.md`). Pronunciation is not assessed and never gates a quest.
- **Sophie's message** is part of quest 5: after going home, the player reads it on the phone (`DIALOGUE_LINE_COMPLETED`) and finishes the exchange (`DIALOGUE_COMPLETED`). See `PHONE.md`.
- **Items** are recorded in the inventory but there is no currency or inventory screen.

## Rules

- **Communication gates quests; pronunciation never does.** A language objective is satisfied by the meaning the player conveyed. Pronunciation quality is learning evidence only.
- **Any valid wording counts.** Objectives name concepts or intents, not sentences.
- **Game rewards are not language progress.** XP, items and unlocks come from quests; mastery comes from learning evidence.
- **AI cannot complete quests.** A model may suggest a structured game event; `applyGameEvent` decides.
- **Profile answers are not quest events.** The dialogue engine stores them in the profile.

## Content validation

`validateQuestContent` (`frontend/src/core/validate.ts`) checks quest and NPC data against the locations, NPCs, items, dialogues, intents and concepts they reference, that prerequisites point to earlier quests, that each quest has a required objective, and that every NPC ends with an unconditional dialogue rule. Tests run it over Chapter 1.
