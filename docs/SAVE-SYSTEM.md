# Save System

The game is saved on the device as the player goes and resumes where it was left. There is no account and no cloud save yet; nothing about the player's progress leaves the device.

## What is saved

One `GameSave` (`frontend/src/core/models.ts`):

| Part | Fields |
| --- | --- |
| Player | location and position, XP, profile (name or nickname, approximate experience, motivation) |
| Quests | status, completed objectives and counts for every quest |
| Dialogue | completed dialogues, one-time effects already applied |
| Phone | message threads received, each with whether it is unread and how far the exchange has gone; the locations visited |
| Inventory | item counts |
| Learning | concept and vocabulary mastery per modality, the recent evidence log and its running count, the support level and how it was set |

Not saved:

- **A conversation in progress.** Reopening the game puts the player back in the world beside whoever they were talking to; the conversation starts again. Answers already given (a name, a completed objective, an item received) are kept, because the dialogue engine writes them to the save line by line and effects apply once.
- **Sound settings.** They are per-device preferences, stored separately under `second-language.audio`, and survive "Start over".
- **Currency and relationships.** PLAN lists them, but the game has neither yet. They join the save when their phases add them.
- **Recordings and transcripts.** Never stored anywhere.

## Layers

| Piece | File | Job |
| --- | --- | --- |
| `SaveStorage` | `frontend/src/save/storage.ts` | Three methods: read, write, remove text by key. The browser's local storage today (also what the Capacitor web view uses); an in-memory version for tests. |
| Codec | `frontend/src/save/codec.ts` | `encodeSave`, `decodeSave`: JSON, version check, migrations, and a full structural check of everything the game relies on. |
| Store | `frontend/src/save/store.ts` | `load`, `write`, `clear` over a storage, plus `reconcileSave` against today's content. |
| Autosave | `frontend/src/save/autosave.ts` | Decides *when* to write. |
| `useSavedGame` | `frontend/src/app/savedGame.ts` | The only React code that knows the save lives on the device. |

`frontend/src/save` is framework-independent and tested in plain Node. The engines (`applyGameEvent`, `stepDialogue`, `travelThroughPortal`) are unchanged: they still take a save and return a save, and know nothing about storage.

## Stored format

Key `second-language.save`:

```json
{ "savedAt": "2026-10-02T12:00:00.000Z", "save": { "version": 2, "player": { }, "questProgress": { } } }
```

`savedAt` is there for the future cloud save, which will need to tell which copy is newer.

## When it is written

- **At once** on anything that is progress: a dialogue line, a quest step, an item, a change of location, a profile answer.
- **At most once every 1.5 seconds** while the only thing changing is where the player stands.
- **Immediately** when the app is hidden or closed (`visibilitychange`, `pagehide`), which is the last moment a mobile browser guarantees code will run.

## Versions and migrations

`SAVE_VERSION` (in `core/models.ts`) is 2.

| Version | Change | Upgrade |
| --- | --- | --- |
| 1 | The first shape ever written to a device. | |
| 2 | The phone: `messages` and `visitedLocationIds`. | No messages yet; visited is the location the player is standing in. |

To change the shape of the save:

1. Raise `SAVE_VERSION`.
2. Add a step to `SAVE_MIGRATIONS` in `codec.ts`, keyed by the version it upgrades *from*. It receives the stored object and returns the next version's shape.
3. Update the checks in `readSave`.
4. Add a migration test with a stored example of the old version.

`decodeSave` runs the steps one version at a time, then checks the result. If a step is missing or throws, the save is treated as unreadable rather than guessed at.

## Loading rules

| Stored save | What happens |
| --- | --- |
| None | New game. |
| Current or older version, valid | Upgraded if needed, reconciled with content, resumed. |
| Unreadable (not JSON, missing or malformed parts, no upgrade path) | The original text is copied to `second-language.save.unreadable`, a new game starts and the player is told. If the copy cannot be made, the original is left in place and nothing is written over it. |
| Newer version than this build | Left exactly as it is. The game runs but writes nothing, and the player is told to update. |
| Storage unavailable or full | The game runs in memory and the player is told progress cannot be saved. |

The check is strict on purpose: a save is either fully usable or set aside. The one lenient part is the profile, which is passed through the same sanitising as a live answer (`updatePlayerProfile`), so unexpected fields or values are dropped.

`reconcileSave` then brings a valid save in line with the content the game ships now, without removing progress:

- quests the save has never seen are added, and open up if their prerequisites are already done;
- progress on quests the content no longer lists is kept;
- a player standing in a location that no longer exists wakes up at the start; a position outside the location is clamped;
- a message thread left on a line its dialogue no longer has starts again as unread.

## Start over

The phone's Settings app has a "Saved game" section with "Start over…", which asks for confirmation and then erases both stored keys and starts a new game. It is the only way progress is ever deleted, and it is also how a player removes their name and learning record from the device.

## Not built yet

- **Cloud save and accounts.** They wait for the rest of the backend phase. The rules are already fixed by PLAN: handle versions, resolve conflicts conservatively, never silently destroy newer progress.
- **Native storage.** On iOS the system may clear a web view's local storage when the device is very short of space. A native adapter (for example Capacitor Preferences) is a new `SaveStorage` and nothing else.
- **Several tabs.** Two tabs of the game open at once each write their own state; the last write wins.
- **Recovering a set-aside save.** The copy is kept but there is no screen to restore or export it.
