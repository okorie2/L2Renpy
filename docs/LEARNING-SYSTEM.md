# Learning system

The engine's shared meaning lives in `frontend/src/learning`. A concept ID names what the player is trying to do, independent of language. The target-language pack supplies expressions, vocabulary, prompts and dialogue lines. `GREETING` is the same goal in every pack; `Salut !` belongs only to French content.

## Two kinds of progress

Game progression and language progression are separate and are never converted into each other.

| Game | Language |
| --- | --- |
| XP, currency, inventory | encountered, understood and spoken vocabulary |
| quests, story, unlocks | concepts, listening comprehension |
| relationships | pronunciation evidence, assistance dependence, review needs |

XP is not French proficiency, and no CEFR claim is made from XP.

## Communication and pronunciation are separate

Whether the learner communicated the required meaning and how well they pronounced it are two different results. If "Je voudrais un café." clearly conveys an order, `ORDER_ITEM` succeeds and the quest may progress; the engine may separately record that "voudrais" needs practice. An imperfect accent never blocks gameplay when communication succeeded. Valid alternatives ("Un café, s'il vous plaît.") satisfy the same intent; exact-string matching is not the success criterion.

Numeric similarity from an assessor is an engineering signal. It may rank weak words, choose hints or show relative improvement. It is not shown to learners as an objective score.

## Evidence

`recordLearningEvidence` is a pure update. One record describes one meaningful interaction:

| Field | Meaning |
| --- | --- |
| `conceptIds`, `vocabularyIds` | what was involved |
| `modality` | `listening`, `speaking`, `reading` or `writing` |
| `outcome` | `encountered` (exposure), `successful` or `unsuccessful` (assessed) |
| `assistance` | `translation`, `hint`, `suggested-answer`, `replay`, `slow-playback`, `typed-fallback` |
| `attempts` | which try this was at the same question |
| `at` | timestamp |
| `confidence`, `pronunciation` | optional assessor confidence and pronunciation diagnostics |

Each record does two things. It updates per-modality counts for every concept and vocabulary item involved: `encounters`, `attempts`, `successfulAttempts`, `unsuccessfulAttempts`, `independentSuccesses`, `assistedEncounters`. And it is appended to `GameSave.evidenceLog`, a bounded list of the most recent interactions with their order and the support level in force, which is what adaptation reads.

Assistance matters. A first-try success with no help is independent; a success after a translation, a revealed answer or a retry is not. Typing instead of speaking (`typed-fallback`) is a change of modality, not help. A spoken answer is `speaking` evidence and a typed one is `writing`; listening evidence is kept apart from both. Speaking evidence says the meaning came across by voice; it says nothing about pronunciation, which is not analysed yet.

The dialogue engine writes the evidence:

- A plain line records exposure for its concepts and for the vocabulary found in its text: as reading, as listening when it was heard with its text held back, or as both (kept apart) when it was read and heard.
- Replay and slower playback are recorded as assistance.
- The player's turn records a success or a miss for the intent's concept. On a success it also credits the words the player actually used, and the concepts those words carry, so saying "s'il vous plaît" while ordering is evidence of asking politely.
- Acting correctly on a line (paying the price that was said) records understanding of that line, by ear when it was only heard.

## Vocabulary

Vocabulary items live in the language pack with a lemma, surface forms, gloss, part of speech, concepts, examples and where they are introduced. `vocabularyInText` finds them in any text, tolerant of accents, punctuation and a slip in longer words, so both the lines the learner meets and what they say are tracked without hand tagging.

## Where the learner stands

`summarizeLearning` turns the counts into something the game can say. It never produces a percentage.

| Standing | Meaning |
| --- | --- |
| `not-met` | never encountered |
| `met` | encountered, never used or shown to be understood |
| `with-support` | at least one success |
| `independent` | at least two unaided first-try successes |

One good attempt is not mastery, so a single success is `with-support`. A concept is flagged `needsPractice` when misses match or outnumber successes, or when there are repeated misses and no unaided success. The summary also reports, per concept, how often it was understood, written and spoken, and per vocabulary item, how often it was met and produced.

The phone's Progress app shows this summary: "On your own", "With some help", "Needs more practice", "Met so far", and the current support level with the reason for it. Its Phrasebook app shows the words and phrases met and used (`PHONE.md`). The chapter summary will reuse the same summary. `needsPractice` and the low-production items are the review needs later scenes can draw on.

## Support levels

Dialogue scaffolding is governed by `GameSave.learningSupport`, not by individual components.

| Level | Translation | Hints and model answers |
| --- | --- | --- |
| `full` | shown with the line | shown |
| `guided` | one tap to reveal | one tap to reveal |
| `independent` | behind a "Need help?" step | behind the same step |

Help is never removed, only moved further away.

### Following behaviour

Self-reported experience from Sophie's first conversation only seeds the level (`new` → `full`, `some` → `guided`, `conversational` → `independent`). After that `adaptSupport` runs whenever a question is answered. It looks at the last six answered questions since the level last changed:

- **Less support** when at least five were answered on the first try without asking for anything beyond what the level shows anyway. Leaving `full` also needs at least three of them typed or spoken, because tapping the offered sentence is not production.
- **More support** when at least three took more than one try, or (above `full`) needed the answer or a hint revealed.

A change moves one level, marks the basis as `observed`, and starts a fresh window, so difficulty never jumps. A later self-report cannot override an observed level. Raising dialogue complexity and reusing known vocabulary for struggling learners are content decisions for later chapters; the signal they need is already here.

## Personalised language

Sophie learns a name or nickname, approximate experience and a motivation, then teaches lines built from them ("Je m'appelle Samuel. J'apprends le français pour voyager."). Personal values stay in the player profile; canonical French stays in the pack; `{slot}` templates join them at presentation time. Spans that should not be graded, such as the player's name, are declared with `assessment.excludedSpans`. See `CONTENT-SCHEMA.md`.

## Pronunciation remediation (planned)

When practice is appropriate, the loop is finite:

```
phrase attempt → weakest useful word identified → word attempt 1 → word attempt 2
  → phonetic/help hint if needed → final phrase attempt → continue regardless
```

The player is never trapped. After the bounded attempts they continue, and the concept is recorded as needing reinforcement.

## Feedback and reinforcement (planned)

Mistakes are met with believable social feedback first: an NPC says "Pardon ?" or "Un café ?" so the learner can repair the exchange inside the scene. This is implemented as repair lines in the dialogue engine. Explicit teaching feedback may follow later.

Weak material returns through gameplay rather than a flashcard screen. A learner who struggles with numbers later meets prices, quantities, apartment numbers, times and addresses. The world is the review mechanism. The in-game phone (Messages, Map, Contacts, Phrasebook, Quests, Progress) adds further practice, especially through messages the player must understand and answer.

## Chapter 1 progression

1. Meet Sophie; exchange names; introduce yourself. *(assessed for communication)*
2. Greet the barista, order a coffee, pay the price you heard, say thank you. *(assessed)*
3. Ask for a croissant at the bakery, pay the price, say goodbye. *(assessed)*
4. Meet Malik; report back to Sophie. *(exposure only)*
5. Read and answer a message from Sophie on the phone: say how you are, accept or decline an invitation. *(assessed, in writing)*

"Assessed" means communication is checked by the rule-based assessor, with a language model's second opinion on typed or spoken answers the rules do not recognise (`AI-CONVERSATION.md`). Evidence from such an answer carries the model's confidence. Pronunciation is not assessed.

Future checks emit `CONCEPT_DEMONSTRATED` only after a validated response, and quests consume that event. This keeps learning evidence separate from story completion.
