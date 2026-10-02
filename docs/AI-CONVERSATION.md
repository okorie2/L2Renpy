# AI Conversation Layer

A language model gives the game a **second opinion** on what the learner said. It makes conversations less rigid in two places and nowhere else:

1. **A valid answer the rules did not know.** "Je prends un petit noir" orders a coffee, but the key-phrase rules only know "café". The model can recognise it, and the line then succeeds exactly as if the rules had.
2. **A reaction to what was actually said.** When the meaning did not come across, the character can answer the learner's words in simple French and lead back to the question, instead of the same scripted "Pardon ?".

The scripted dialogue engine stays in charge. Lines, branches, quests, items, XP and learning evidence are all still decided by `stepDialogue` and `applyGameEvent`. Without the model (no key, backend away, slow, over its limit) the game plays exactly as it did before.

## What the model may and may not do

| The model may | The model may not |
| --- | --- |
| say which *expected* intent, if any, the learner expressed | name any other intent, event, item, reward or quest step |
| say how sure it is | decide that the line succeeded: the engine applies a threshold |
| write one short line for the character to say on a miss | change which node the conversation is on, or where it goes next |
| offer another way to say what the learner said | be shown as marking a fault: it is labelled "You could also say" |

There is no "suggested game events" field. The only thing an opinion can lead to is the `INTENT_COMMUNICATED` event the line already raises on success, and the engine raises it, not the model.

## Flow of one turn

1. The learner types or speaks an answer on a `say` line.
2. `stepDialogue` runs with the rule-based assessor, as always. If the rules recognise the answer, that is the result: no model call, no wait, no cost.
3. If the rules say "repair", the app asks the backend for an opinion (`POST /conversation/turn`) and shows "*Name* is thinking…". Answers picked from the suggestion list are never sent; the rules are certain about those.
4. The opinion comes back as a `UtteranceJudgement` and `stepDialogue` runs again with it attached to the same input. The engine accepts it only if it names **this line's intent** with confidence of at least `JUDGEMENT_CONFIDENCE_NEEDED` (0.7).
   - Accepted: the line succeeds through the normal path. Evidence records the model's confidence; a rewording, if any, is kept on the player's history line and shown on the next line as "You could also say: …".
   - Not accepted: it is a miss as before (attempt counted, unsuccessful evidence, suggestions after two misses). If the opinion carried a reply, the session's `lineOverride` puts those words on the repair node, which is still the scripted node: it is spoken in the character's voice, recorded in the history, and hands back to the question.
5. No opinion (any failure, or 6 seconds without an answer): the first result stands.

## Where things live

| Piece | File | Job |
| --- | --- | --- |
| `UtteranceJudgement`, `readJudgement` | `frontend/src/dialogue/judgement.ts` | The opinion's shape, the confidence threshold, and a strict reader for anything arriving from outside |
| Engine support | `frontend/src/dialogue/engine.ts` | `SAY.judgement`, `session.lineOverride`, `sessionLine`, `HistoryLine.rewording` |
| `buildTurnContext` | `frontend/src/conversation/context.ts` | The scene sent for an opinion |
| `createHttpTurnJudge` | `frontend/src/conversation/httpJudge.ts` | Asks the backend; never throws; leaves it alone for 30 s after a failure |
| Request limits, prompt, reply checks | `backend/src/conversation/turn.ts` | Pure functions |
| `ConversationService` | `backend/src/conversation/conversation.service.ts` | Cache, calls-per-minute cap, timeout, one retry, error statuses |
| `ChatModel`, `OpenRouterProvider` | `backend/src/conversation/chat-model.ts`, `providers/` | The provider-neutral interface and its one adapter |

## What is sent

The game sends a small description of the scene: the character's name, persona and register (`NPC.persona`), the place, the current quest objective, up to six recent lines, the line's expected intent with its plain-English `meaning` and example wordings, up to forty words the learner has met, the utterance, and which attempt this is.

- The learner's name and profile are not sent. A name appears only if the learner says it ("Je m'appelle Léa").
- The backend builds the prompt. Its instructions are fixed on the server; scene details fill named places in them; the learner's words travel separately as data.
- OpenRouter is called with `data_collection: "deny"`, so the turn is only routed to providers that do not keep it for training.
- Logs record timings and token counts, never what was said.

Today the client describes the scene because the content lives in the client. When accounts make the backend authoritative, the scene should be built on the server from the content and the stored save.

## Safety

| Risk (PLAN section 13) | Guard |
| --- | --- |
| Prompt injection affecting game authority | The learner's words are a separate data message. The reply schema only allows the offered intent IDs or null. The server re-checks it, the client re-checks it, and the engine accepts only the current line's intent. Nothing in a reply can name a reward. |
| AI-generated arbitrary rewards | No field for them exists; unknown fields are never read. |
| Malformed structured responses | Strict JSON schema on the request; the server validates every field and retries once; an unusable reply becomes `502` and the game goes without. |
| Runaway token usage | Model calls only on rule misses; identical turns cached; `AI_REQUESTS_PER_MINUTE` (default 60) across all players; 300 output tokens at most; bounded inputs (utterance 200 characters, six lines, forty words); 8 s server timeout. |
| Excessively difficult language | The prompt fixes the level and prefers known words; a reply over 120 characters or 16 words, or with markup or links, is dropped and the scripted line is used. This limits length, not vocabulary: see below. |
| Wrong language accepted | The model must state `inTargetLanguage`; the server forces "not communicated" when it is false. |

## Configuration (backend `.env`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | none | The key. Server only. Without it the layer is off. |
| `AI_PROVIDER` | `openrouter` if a key is present, else `none` | `none` switches the layer off. |
| `AI_MODEL` | `google/gemini-3.1-flash-lite` | Any model on the provider with structured output. |
| `AI_TIMEOUT_MS` | `8000` | Per model call. |
| `AI_REQUESTS_PER_MINUTE` | `60` | Cap across all players. |

Adding a provider is one adapter implementing `ChatModel` and one case in `createChatModel`.

## Checking a model

`npm run eval` in `backend/` runs 18 Chapter 1 turns through the configured model and prints verdicts, replies and timings (`AI_MODEL=<id> npm run eval` to compare another). It needs the key, costs a fraction of a cent, and is not part of `npm test` because answers can vary. On 2026-10-02 `google/gemini-3.1-flash-lite` gave the expected verdict on 17 of 18 with a median of about 1.1 s; the other was a malformed reply, which the service now retries once.

## Known limits

- **Vocabulary of replies is not checked.** Only length is enforced; staying at A1 relies on the prompt.
- **Rewordings come only with a second opinion.** An answer the rules accept is never sent, so "je veux café" passes without a suggestion. A rewording that merely adds words to a correct sentence is dropped, but one that swaps a valid wording for another can still appear, which is why it is labelled as an alternative and not a correction.
- **The rules can still be wrong in the other direction.** "Je n'aime pas le café" passes the key-phrase rules, and the model is not asked.
- **No free conversation.** The model reacts within a scripted turn; open-ended chat with a character is not built.
- **No authentication.** Anyone who can reach the backend can spend the key, up to the per-minute cap. Set a spending limit on the key.
- **Spoken answers wait twice:** once for recognition, once for the opinion, only when the rules miss.
