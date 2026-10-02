# In-Game Phone

The phone is where everything that is not the world itself lives: messages, the map, contacts, the phrasebook, quests, progress and settings. The HUD keeps only two things: the current quest step (tap it to open Quests) and the phone button, which carries a badge when a message is unread.

Like the conversation view, the phone decides nothing. It draws what the save and the content say and reports what the player writes or taps.

## Apps

| App | Shows | Built from |
| --- | --- | --- |
| Messages | Threads with characters; the player reads and writes in French | `GameSave.messages`, the dialogue engine |
| Map | The street with its buildings, where the player is, the next step, people already met. Places not yet visited appear as "?" | `mapPlaces` |
| Contacts | Characters the player has finished a conversation with: who they are, whether to say *tu* or *vous*, where they usually are, a link to their thread | `metCharacters`, `NPC.persona` |
| Phrasebook | Words met, each with its meaning, an example, "Met" or "Used", and a button to hear it; then useful expressions for the concepts met | `summarizeLearning`, `conceptExpressions` |
| Quests | Current, available and completed quests | `questLog` |
| Progress | What the learner can do on their own, with help, or needs to practise; the support level | `summarizeLearning` |
| Settings | Sound settings, and "Start over" | per-device settings, the save store |

No app shows a score or a percentage. Familiarity in the phrasebook is "Met" or "Used".

## Messages

A message thread is an ordinary dialogue from the language pack, presented as messages. The same engine (`stepDialogue`) runs it, so branching, repair lines, finite retries, learning evidence, quest events and the AI second opinion all work as they do face to face.

```ts
interface MessageThread { id: string; contactId: string; dialogueId: string; when: Condition[] }
```

- **Arrival.** `deliverMessages` (`frontend/src/phone/messages.ts`) hands over every thread whose conditions hold. It runs whenever the save changes. A thread arrives once and stays, even after the conditions that brought it stop holding. The player sees a "New message" notice and a badge.
- **State.** `GameSave.messages[threadId]` holds `receivedAt`, `unread` and the dialogue `session`, including its history. A thread can be left and resumed, and survives a restart.
- **Reading.** Opening a thread marks it read. The other person's lines arrive one after another about a second apart; each is a `CONTINUE` to the engine, so reading is recorded as reading evidence and can complete a quest step.
- **Writing.** On the player's turn a composer appears: a text field, and suggestions, a hint and translations according to the support level, as in conversations. Answers are `typed` or `selected`, so they are writing or reading evidence and never speaking.
- **Feedback.** The player's own messages show the recognised words and how the answer went, as in conversations (`DIALOGUE-SYSTEM.md`).
- **Hearing.** Each received message has a button to hear it in the sender's voice, when voices are available.

Chapter 1 has one thread. In the last quest, after the player gets home, Sophie writes: "Salut ! Ça va ?", then invites them to the café tomorrow. The quest's last two steps are reading her first message and finishing the exchange. Saying no to the invitation is as valid as saying yes.

## Map and contacts

`frontend/src/phone/directory.ts`:

- `metCharacters(save, npcs)`: characters with at least one completed dialogue.
- `objectiveLocationId(objective, npcs)`: where a quest step happens, when its definition says (a required location, a location to enter, or the place of the character whose dialogue it needs). A message can be answered anywhere, so it has none.
- `mapPlaces(save, locations, npcs, quests)`: every location with whether it was visited (`GameSave.visitedLocationIds`), whether the player is there, the next step that happens there, and the met characters found there.

The map is drawn from the street location's own building rectangles, so it stays true to the world without separate map art.

## Start over

Settings has a "Saved game" section with "Start over…". It asks for confirmation, then erases the stored save and begins a new game. Sound settings are kept. See `SAVE-SYSTEM.md`.

## Not built yet

- **More threads and unprompted messages.** Only Sophie's Chapter 1 thread exists.
- **Voice notes.** Message answers are typed; speaking stays in face-to-face conversations.
- **Relationships.** Contacts show who someone is, not how well the player knows them.
- **Inventory and currency.** The phone has no app for them; they wait for their phases.
- **Fast travel.** The map shows; it does not move the player.
- **App icons** are emoji placeholders, to be replaced with artwork in the polish pass.
