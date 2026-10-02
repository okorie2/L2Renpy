# Dialogue system

Conversations are data run by a pure engine. Dialogue content lives in the language pack (`frontend/src/languages/fr/index.ts`), the models in `frontend/src/dialogue/models.ts`, and the engine in `frontend/src/dialogue/engine.ts`. The React `Conversation` component renders the engine's session and reports inputs; it decides nothing.

## The engine

```ts
const session = startDialogue(dialogue, npcId);
const step = stepDialogue(session, dialogue, input, save, context);
// step.session, step.save, step.result: "advanced" | "completed" | "repair" | "ignored"
```

`stepDialogue` is pure. One call takes one player input and returns the new session and the new save, with everything that line caused already applied: learning evidence, profile answers, one-time effects, and quest events (through `applyGameEvent`). The session is plain data: current node, failed attempts per question, the question to return to after a repair, and the history of lines passed.

| Input | Fits | What happens |
| --- | --- | --- |
| `CONTINUE` | a plain line | exposure is recorded and the line is completed |
| `ANSWER` | `text` or `choice` | the profile answer is validated and stored |
| `SAY` (text, mode, optional `judgement`) | `say` | the utterance is assessed against the intent |
| `ACT` (option) | `act` | the action is checked |

An input that does not fit the current line is ignored, so a spoken turn cannot be skipped with "continue".

## Node capabilities

| Capability | How it is authored |
| --- | --- |
| NPC utterance, translation | `targetText`, optional `translation`; visibility follows the support level |
| Player's line | `speakerId: "player"`; `targetText` is the model answer |
| Branching | `branches` (first whose conditions hold) before `nextNodeId`; a `choice` option may set its own `nextNodeId` |
| Conditions | the core `Condition` type: quest status, current objective, completed dialogue, profile value, item held |
| Effects | `effects`, applied once per save (`GIVE_ITEM`) |
| Hints | `hint`, a target-language scaffold |
| Concepts and vocabulary | `conceptIds`, `vocabularyIds` |
| Speaker pose | `presentation.expression` for the conversation partner |
| Unscored spans | `assessment.excludedSpans` |
| Completion | a line with no next node ends the dialogue and raises `DIALOGUE_COMPLETED` |

Replay and slower playback are on the card whenever voices are available; both are recorded as assistance. Every input also says whether the line was heard and whether its text was on screen, which is how the engine tells listening from reading.

## The player's turn

A `say` response is the player's turn to speak. The microphone is offered when recognition is available, with the typed field always beneath it. Speaking, typing and picking a suggestion all produce an utterance, and the same assessment judges each one for the **intent**, never for exact wording and never for pronunciation.

```ts
response: {
  kind: "say",
  exerciseId: "ch1-cafe-order-001",
  intentId: "orderDrink",
  prompt: "Your turn. Order a coffee.",
  options: [
    { id: "polite", text: "Je voudrais un café, s'il vous plaît." },
    { id: "short", text: "Un café, s'il vous plaît." },
    { id: "thanks", text: "Merci, au revoir !" }   // does not fit; telling it apart is part of the support
  ],
  repairNodeId: "repairOrder"
}
```

What the player sees depends on the support level:

| Level | Model answer | Suggestions | Typing |
| --- | --- | --- | --- |
| `full` | shown | shown | always |
| `guided` | behind "Show an answer"; "Hint" shows the scaffold | after two misses | always |
| `independent` | behind "Need help?" | after two misses | always |

An `act` response is an in-scene action that shows understanding, such as paying the price the barista just said. It raises `CONCEPT_DEMONSTRATED`.

### When the meaning does not come across

The engine moves to the response's `repairNodeId`: the other speaker reacts in character ("Pardon ? Un café ? Un thé ?"), and that line shows "You said: …" so the learner sees what was understood, which matters most when speech was misheard. A repair line with no next node hands back to the question it interrupted. This is the believable-feedback rule from `PLAN.md`: the learner repairs the exchange inside the scene instead of being told "wrong".

Retries are finite. After `ATTEMPTS_BEFORE_SUGGESTIONS` (2) misses on a question, only the answers that fit are offered, so one tap always moves the conversation on. The player is never trapped, and the evidence records the misses and the help.

### Evidence written

| Input | Modality | Notes |
| --- | --- | --- |
| spoken | speaking | the transcript from speech recognition |
| typed | writing | marked `typed-fallback` |
| picked suggestion | reading | marked `suggested-answer` |
| action | reading, or listening when the line was heard without its text | |

A model answer that was visible also marks `suggested-answer`. A success after a miss, or with any help, is not an independent success. Typing never counts as speaking. A successful turn also credits the vocabulary the player actually used, and after every answered question the support level is re-evaluated from recent behaviour (see `LEARNING-SYSTEM.md`).

## Communication assessment

`assessUtterance` (`frontend/src/learning/assessment.ts`) answers one question: was this intent conveyed? Each intent lists key-phrase groups (`match`); the intent is communicated when every phrase of any group appears. Matching ignores case, accents and punctuation and forgives one slip in a longer word, so "Un café, s'il vous plaît.", "Je voudrais un café." and "un cafe svp" all order a coffee.

The rules are certain when they match, and they are always asked first. Known limit: they look for key phrases, so "Je n'aime pas le café" would also pass as an order.

When the rules do not match a typed or spoken answer, the app may attach a second opinion from a language model to the same input (`SAY.judgement`). The engine accepts it only if it names this line's intent with confidence of at least 0.7; then the line succeeds through the normal path. On a miss, an opinion may carry a reply, which stands in for the repair node's words through `session.lineOverride` (read with `sessionLine`); the node, and so the flow, is still the scripted one. The opinion can change nothing else. See `AI-CONVERSATION.md`.

## Feedback on the player's answers

Every spoken, typed or picked answer is kept in the history with a `said` record: how it was given (`speech`, `typed`, `selected`), whether it communicated, which try it was, whether help was used, and `usedWords`, the stretches of the answer that were credited as vocabulary (`vocabularySpans`, positions in the learner's own text). The engine writes it; the UI only draws it.

The line that follows an answer shows it back: "You said / You wrote / You chose: …" with the credited words marked, one plain sentence on how it went ("Understood first time, on your own.", "Understood on try 2.", "That didn't come across."), and, when a second opinion offered one, "You could also say: …". The same appears in the history sheet.

This is feedback on communication only. It never mentions pronunciation, and it shows no score or percentage. Typed answers are labelled as written, so typing is never presented as speaking.

## History

The session keeps every line passed, including what the player actually said and how it went. A button in the conversation opens it. Translations appear there only at full support, so looking back cannot bypass assistance tracking.

## Validation

`validateDialogue` checks start, next, branch, option and repair targets, speakers, slots, expressions, effect items, that an action has exactly one correct option, and, for every `say` line, that the model answer and at least one suggestion pass the assessor. Tests run it over every dialogue.
