# Content schema

TypeScript interfaces are the source of truth. Game/world models live in `frontend/src/core/models.ts`, dialogue models in `frontend/src/dialogue/models.ts`, slot and template types in `frontend/src/dialogue/template.ts`, learning models in `frontend/src/learning/models.ts`, character visuals in `frontend/src/characters/types.ts`, and `LanguagePack` in `frontend/src/languages/types.ts`. Chapter data is in `frontend/src/content/chapter1.ts`; the first pack is in `frontend/src/languages/fr/index.ts`.

## IDs and references

IDs are stable keys, not display copy. Every `NPC.dialogues[].dialogueId` resolves to `LanguagePack.dialogues`. `Dialogue.startNodeId` and every `nextNodeId` resolve to nodes in that dialogue. `DialogueNode.speakerId` resolves to an NPC ID, or to `player` (`PLAYER_SPEAKER_ID`) for a line the player says. `NPC.appearanceId` doubles as the character visual ID when the catalog has art for it. `Location.buildings[].labelKey` resolves to `LanguagePack.placeLabels`. `QuestObjective.trigger` and `Quest.start.trigger` refer to a dialogue, a dialogue line, an NPC, a location, an item, another quest, or a language-independent concept or intent. Vocabulary IDs are pack-scoped, such as `fr.bonjour`.

`validateDialogue` (`frontend/src/dialogue/validate.ts`) checks what types cannot: start and next nodes, speakers, slots used but not defined, excluded spans that are not in the line, expression names, and speech intents. Tests run it over every dialogue in the pack. `validateQuestContent` (`frontend/src/core/validate.ts`) does the same for quests and NPC dialogue rules.

## World and quest data

`Player` contains identity, target language, location, normalized position, XP and a `profile`. `NPC` contains identity, position, location, a `persona` (role and whether they address the player formally or informally, used when the character speaks beyond scripted lines), appearance ID, an ordered list of dialogue rules, interaction radius, an optional `noticeRadius` and `entrance`, and availability. Each rule is a dialogue ID plus optional conditions (`QUEST_STATUS`, `OBJECTIVE_CURRENT`, `DIALOGUE_COMPLETED`); the first rule whose conditions all hold is used, and the last rule has none. `Location` defines fixed world dimensions, visual kind, buildings, solid obstacles, portals and named spawn points. Positions and rectangles are fractions from 0 to 1 of that location's authored world size.

Each `Portal` has an interaction position and radius plus a destination location and spawn point. The core `travelThroughPortal` transition validates those references before moving the player.

`Quest` contains ID, chapter, title, summary, prerequisites, an optional start step, ordered objectives and rewards. Objectives may be `optional`, need a `count`, or require a location. `Reward` is XP or an item from the chapter's `Item` list. `GameSave` has a schema version (`SAVE_VERSION`; how it is stored and upgraded is in `SAVE-SYSTEM.md`), player, quest progress (status, completed objectives, counts), `completedDialogueIds`, `inventory`, separate concept/vocabulary mastery maps, the recent `evidenceLog` with a running `evidenceCount`, and `learningSupport`. The full model is described in `QUEST-SYSTEM.md`. `Location.backdrop` is an optional asset path to a painting of the location at its own proportions; `props` lists cut-outs of it that characters can walk behind (image, rectangle, and the `base` line where the thing meets the ground), and a building may give the centre of its painted name board as `sign`. `figureScale` says how much larger people stand there than on the street. With a painting, the location's obstacles, portals, spawn points and NPC positions are measured from the painting. `MessageThread` (ID, the NPC who writes, a dialogue ID and arrival conditions) puts a dialogue on the player's phone; see `PHONE.md`. The save also holds `messages` and `visitedLocationIds`.

```ts
{
  id: "orderDrink",
  description: "Order a coffee",
  trigger: { type: "DIALOGUE_LINE_COMPLETED", dialogueId: "cafeOrder", nodeId: "order" }
}
```

## Player profile

`PlayerProfile` holds only what makes early language personally meaningful: `displayName` (a name or nickname), `targetLanguageExperience` (`new`, `some`, `conversational`) and `motivation` (`travel`, `work`, `study`, `people`, `curiosity`). Every field is optional. Exact age is not collected. `updatePlayerProfile` validates values; display names are trimmed, stripped of markup-like characters and capped at 30 characters. Profile values are never written into language-pack content.

## Dialogue nodes

```ts
{
  id: "yourTurn",
  speakerId: "player",
  targetText: "Je m'appelle {playerName}.",
  translation: "My name is {playerName}.",
  presentation: { expression: "question" },
  hint: "Je m'appelle ____.",
  assessment: { excludedSpans: ["playerName"] },
  response: { kind: "say", exerciseId: "ch1-introduce-self-001", intentId: "introduceSelf", prompt: "Your turn. Introduce yourself.", repairNodeId: "repairIntroduction" },
  conceptIds: ["INTRODUCE_SELF"],
  nextNodeId: "invitation"
}
```

- `targetText` is canonical target-language text. `translation` is optional and its visibility is decided by the learner's support level, not by the node.
- `presentation.expression` is a semantic pose for the speaker, never a filename.
- `hint` is a target-language scaffold.
- `branches` and `nextNodeId` decide where the conversation goes; `effects` are one-time consequences such as `GIVE_ITEM`.
- `response` is what the player does before the dialogue continues:
  - `text`: free text saved to a profile field (currently `displayName`).
  - `choice`: options saved to `targetLanguageExperience` or `motivation`. `icon` is a semantic ID the UI maps to an image; an option may set its own `nextNodeId`.
  - `say`: the player's turn, assessed for an intent, with an `exerciseId`, optional suggestions and a `repairNodeId`. Only lines with `speakerId: "player"` may have it.
  - `act`: an in-scene action with exactly one correct option, showing a concept such as understanding a price.

The engine and the full node model are described in `DIALOGUE-SYSTEM.md`.

### Slots and personalised values

`{slot}` markers are filled at presentation time from `LanguagePack.slots`:

| Source | Meaning | Example |
| --- | --- | --- |
| `profile` | A personal value stored with the player, with a pack fallback | `playerName` |
| `profile-lookup` | Canonical pack text chosen by a profile answer | `motivationPhrase` → "pour voyager" |
| `literal` | A fixed named span, such as a brand or place | a café's name |

`resolveDialogueLine` returns the final text plus the character range of every slot. An undefined slot is left visible as `{slot}` and is reported by validation.

### Assessment exclusions

`assessment.excludedSpans` lists slot names that must not be graded as target-language production: personal names, place names, brands, foreign words, or any dynamic story value. It is generic; nothing is specific to `playerName`. Resolved spans carry `scored: false`, the conversation UI underlines them on spoken steps, and a future assessor receives the ranges (or, with server-owned exercises, derives them from the exercise definition).

## Character visuals

`CharacterVisualDefinition` lists world poses (`idle`, `walking`, `waving`: frames and frame duration, display height, foot anchor) and conversation expressions. The conversation block declares the shared `canvas` size, a shared `mouthRect` in canvas pixels, and per expression a `closed` master image plus an optional `mouthOpen` patch exactly the size of `mouthRect`; fallbacks cover expressions without art. Asset paths are relative to `frontend/public/assets/`. Assets are organised by meaning:

```
characters/sophie/
  world/         idle.png  walking-1.png  walking-2.png  walking-3.png  waving.png
  conversation/  neutral/  question/  explaining/  encouraging/   (closed.png, mouth-open.png)
```

## Learning and language data

`LanguageConcept` defines a language-independent goal, a short description that reads as "you can …", and its modalities. `ConversationIntent` links a concept to a modality, a prompt, a plain-English `meaning` (exactly what counts, read by the AI second opinion), example `acceptedExpressions`, and `match`: key-phrase groups for the rule-based assessor, where every phrase of any one group must appear. Neither is an exact-match list. `VocabularyItem` stores a `lemma`, every `surfaceForms` spelling that counts as it, a `gloss`, `partOfSpeech`, associated `conceptIds`, `examples`, and `introducedIn` (chapter and dialogue). Lines are not tagged with vocabulary by hand: items are detected in the text of each line and in what the player actually says. Tests check that every item appears in the dialogue it claims to be introduced in. Mastery records store progress separately for each modality.

The concept IDs in the initial scope are `GREETING`, `FAREWELL`, `INTRODUCE_SELF`, `BASIC_QUESTION`, `YES_NO`, `POLITE_REQUEST`, `THANK_PERSON`, `ORDER_ITEM`, `NUMBERS_1_10` and `UNDERSTAND_PRICE`. French words, phrases, prompts and place labels live in the French pack. A new pack maps the same concept IDs to its own expressions.
