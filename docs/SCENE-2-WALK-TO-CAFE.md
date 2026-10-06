# Goal 1, Scene 2 — Walk to the Café

How the scene design ("Goal_1_Scene_2_Walk_to_Cafe") is built in the game.

## Flow

1. **Scene 1 (`meetSophie`)** now asks the learner's age right after their name
   (`askAge`, a number pad, saved on the device like the name), then "Great! And how
   much French do you already know?" and "And why do you want to learn French?". After the
   introduction practice, the old French exchange ("Salut ! Je m'appelle Sophie…",
   "Enchantée", "Allez, viens !") is gone. Sophie instead turns toward the park gate,
   framed wider so more of the park shows: *"Ready? Let's go get something to drink."*
   The learner taps **Let's go**.
2. **Scene 2 (`walkToCafe`)** starts straight away, still inside the opening (no street
   yet). It follows the design document beat by beat: leaving the park, "Comment tu
   t'appelles ?", the passer-by and the shopkeeper, "Ça va ?", the age, the mixed
   mini-conversation, and the café. It ends on *"Ready?"* and a **Let's go in** tap.
3. The opening then fades into the street, with the player at the café door and
   Sophie beside it. The café quest takes over from there (Scene 3 is not written yet).

If the learner closes the conversation mid-walk, the park shows a **Continue with
Sophie** button that resumes the walk from its start.

## Quests

- `meetSophie` — name, practise the introduction, hear the plan.
- `walkToCafe` ("En route", new) — greet the shopkeeper, answer "Ça va ?", answer the
  age question, answer the name question (in the mini-conversation), arrive. The café quest now follows it.

## Presentation, per line (`presentation` in the dialogue)

- `framing: "wide"` — the camera steps back. Full-body art is used when it exists;
  otherwise the portrait is shown smaller so more of the place is visible.
- `scene` — the painting behind the conversation (`park-exit`, `lyon-route`,
  `cafe-exterior`; see `src/content/scenes.ts`). It stays until a line names another,
  and crossfades. Walking scenes drift slowly across the painting.
- `focus` — whose portrait is shown (the shopkeeper while the learner answers them).
- `translation: "delayed"` — a new question is heard in French first, then the English
  appears. `"on-request"` — a question met before: English only behind a tap.
- Walking poses (`walk-side`, `walk-away`) bob gently, so a still picture reads as moving.

## Art: where to put it

All Scene 2 art is in `frontend/public/assets/scenes/walk-to-cafe/`, named as briefed
and converted to WebP (`bg_park_exit.webp`, `sophie_ask.webp`, …). If a file is ever
missing, the game shows the stand-in listed below instead of a broken image.

| File (.webp) | Used for | Stand-in if missing |
| --- | --- | --- |
| `bg_park_exit` | Beat 1 | the park painting |
| `bg_lyon_route` | Beats 2–7 | the street painting |
| `bg_cafe_exterior` | Beat 8 | the street painting, centred on the café |
| `sophie_walk_away` | `walk-away` | turning-away portrait |
| `sophie_walk_side` | `walk-side` | talking portrait |
| `sophie_ask` | `question` | question portrait |
| `sophie_listen` | `listening` | listening portrait |
| `sophie_pleased` | `pleased` | pleased portrait |
| `sophie_encourage` | `encouraging` | encouraging portrait |
| `sophie_explain` | `explaining` | explaining portrait |
| `sophie_greet_side` | `greeting` | waving-goodbye portrait |
| `sophie_glance` | `glance` | playful portrait |
| `sophie_proud` | `proud` | excellent portrait |
| `sophie_playful` | `playful` | playful portrait |
| `npc_passerby` | passer-by | Malik's close-up |
| `npc_shopkeeper` | shopkeeper | Luc's close-up |

Full-body images are drawn whole (no moving mouth), anchored at the bottom and fitted
into a 2:3 box, so a 1024×1536 transparent PNG matches Sophie's other art best.

## Decisions taken while building it

- **Age.** Scene 1 asks it after the name and its model introduction now includes
  "J'ai … ans." with the age written out in words, as in the Ren'Py version
  ("J'ai vingt-neuf ans."). In Scene 2 any age is accepted and the number is not graded.
- **No pick-an-answer card for the name.** After "Comment tu t'appelles ?" Sophie goes
  straight to "Comment tu t'appelles ? — Je m'appelle …". The answer card (two options,
  one right) and its lines ("You already know the answer", "Almost…", "Exactly.") are
  kept in the dialogue but nothing leads to them; point `askName` at `knowAnswer` to
  bring them back. The learner first answers the name question in the mini-conversation.
- **"Prêt ? / Prête ?"** needs the learner's gender, so Sophie says "Ready?" in English,
  as the design document allows.
- **Mixed lines** such as "Exactly. Je m'appelle …" are split into an English line and a
  French line, so each is voiced in the right language.
- **Voices.** The passer-by and the shopkeeper use the backend's default voice unless
  `ELEVENLABS_VOICES` maps `passerby` / `shopkeeper`. The new lines are not in the voice
  pack yet; rerun the voice-pack tools to ship them pre-generated.

## Walking with Sophie

The whole scene is one continuous shot on the street (`staging: "street"` on the
dialogue). Between the beats the cards give way to short walks (`interlude` on a
dialogue node, drawn by `WalkInterlude.tsx`): the camera follows just behind Sophie,
who keeps her size in the middle of the frame while the painting comes toward the
camera; that push in is the ground she covers. Each walk is a list of stretches
(`segments`: a scene and the camera zoom it goes from and to); a walk through two
places dissolves from one into the next. The first walk starts with her already
walking on the street (no pull back from the close-up). She walks a little to the left
of the camera (30% across), as if alongside the learner on this side of the street.

When she talks, the shot the last walk ended on is held (`StreetStage`): she stops
where she is and looks back over her shoulder (`sophie_street_glance`); the next walk
starts from the same zoom. The passer-by and the shopkeeper appear in the street with
her (`presentation.street.with`; placed in `STREET_PEOPLE` in `src/content/scenes.ts`).
She waves to the passer-by (`greeting`), and at the café she turns round to face the
learner (`playful`, `explaining`, `pleased`). These standing poses are cut to the walk
cycle's canvas and scale by `tools/build_street_poses.py`, so she doesn't jump when she
stops. Her mouth moves while she speaks on the look-back pose: `sophie_street_glance_talking.webp`
is the same picture with only the mouth taken from `sophie_glance_talking.png` (lined up
on her face and blended in a small oval), so nothing else shifts when it shows.

Camera zoom along the way: park 1 → 1.3, park exit 1 → 1.3 → 1.7, street 1 → 1.2 →
1.45 → 1.65 → 1.85 → 2.05, café 1 → 1.25.

**Walk cycle art (walk fix B, in use).** Her walk-away cycle is ten frames,
`scenes/walk-to-cafe/sophie_walk_back_1.webp` … `_10.webp` (683×1024, head and feet
aligned), 130 ms each, so each step takes 650 ms (an unhurried stroll). Frames 1–5 are her left foot's step
(heel lifts, pushes off, passes, reaches ahead) from these images in Downloads:

1. ChatGPT Image Oct 4, 2026, 12_24_35 PM-5.png
2. ChatGPT Image Oct 4, 2026, 12_24_39 PM-8.png
3. ChatGPT Image Oct 4, 2026, 12_24_34 PM-4.png
4. ChatGPT Image Oct 4, 2026, 12_24_38 PM-7.png
5. Walking Away with Shoulder Bag.png

Frames 6–10 are the same with the legs flipped below the hips (bag, arms and body as
drawn), for her right foot's step. Preview: `docs/walk-previews/walk_fix_B_left_step_mirrored.gif`.
To rebuild:

    python tools/build_walk_cycle.py --count 5 --mirror-legs --frames <the five images above, in order>

The other generated frames (right-foot steps from the 12:24/12:38 batches, the Cozy
Denim and Anime Sprite images) are not used; an earlier nine-frame version used some
of them but showed more right steps than left.

If the frames are ever missing, her single `sophie_walk_away` pose is moved in step instead.

## Speaking cards

Every answer in Scene 2 is a speaking card (`speakOnly` on a `say` response). The
question is asked aloud on the card itself (`question`: its text, English and who asks
it; the English follows `presentation.translation`), and the learner answers into the
microphone. Assist has Sophie say the answer (the node's model answer) to repeat. The
card only moves on once the answer is understood; a miss gets "Almost. Listen once
more." (`tryAgain`), or "Pardon ?" (`pardon`) in the mini-conversation, and the same
card again. Each spoken answer is also sent to the pronunciation check with the same
recording, and kept with the attempt (`said.pronunciation` in the history, `pronunciation` in the
learning evidence), ready for a per-phrase progress store. Typing appears only when
the microphone can't be used ("Can't speak right now? Type it instead"); it is
recorded as typed, not spoken.

Layout: the question's French sits right on its English, the Assist answer's French
right on its English, with a clear gap between the two pairs. "Answer out loud." sits
centred above the microphone, as "Tap and say it in French." sits below it.

Feedback, as in Scene 1: the answer is checked first (the rules, then the second
opinion if needed, via `checkSaid`) while the card stays up. If it was understood,
Sophie says a phrase from `PRACTICE_PHRASES` (picked by `answerFeedbackKind` from the
pronunciation score: excellent / clear / close / good try; never discouraging, since
the answer moves the conversation on), shown large on the card with "You said …" and
the pronunciation note, and the card only goes once she has finished (at least 1.6 s
on screen). If not understood, "You said …" shows briefly and the repair follows.
Phrases added since the voice pack was built are voiced live until it is rebuilt.

Removed from the design document's script, as asked: "You already know the answer",
the separate "Comment tu t'appelles ?" card, "Exactly. Je m'appelle …", the
question-and-answer pair and "Keep those two together in your head". The age now
follows the same shape (the question on the speaking card; "You already know how to
answer this one too" is gone), but its "Exactly." and pair lines after the answer stay.

In the park, Sophie walks right of centre (`walkX` on the scene), where the path is;
elsewhere 30% across.

## People on the street

After the name, Sophie says "There are people on the street. Let's interact with
them." (`peopleOnStreet`), and the walk on starts from there. The passer-by and the
shopkeeper are in the shot from the moment the walk reaches the Lyon street
(`walkIntoTown`), far off, and never fade or slide in:

- They stand in the painting (inside the camera's zoom), so they come closer as the
  camera does. Their places are in `STREET_PEOPLE` (`far`, `near`, `passed`); a
  place on the pavement is worked out from the person's height and the street's
  horizon, so their feet stay on the ground.
- The passer-by walks up the street toward Sophie during `walkToShops` (`far` →
  `near`, growing as someone coming closer does, bobbing in step), waves on
  "Bonjour !", and walks on past the camera on "Your turn next time." (`near` →
  `passed`).
- A short walk (`walkToShopkeeper`, zoom 1.45 → 1.7) brings the shopkeeper closer
  before the learner greets her; she waves on her "Bonjour !" and is passed during
  `walkOn`. The later walks moved along to keep the camera continuous
  (`walkOn` 1.7 → 1.85, `walkNearer` 1.85 → 2, café door 2 → 2.15).
- A line or walk says who is there (`street.people`, or `people` on a walk's
  stretch); lines that don't say keep whoever was there (`streetPeople()`).
- Mouths move while they speak and hands go up for a wave when the art is there:
  `npc_<id>_wave`, `npc_<id>_talking`, `npc_<id>_wave_talking` (same canvas and
  placement as `npc_<id>`). Until then their plain picture is used.

Voices: the passer-by speaks with the neighbour's ElevenLabs voice and the shopkeeper
with the baker's (`VOICE_STAND_INS` in the backend's tts.py), until they have their own.

Passer-by walk frames (`npc_passerby_walk_1..8`): the generated frames all stepped
with his right foot, so four of them (ordered by how high the back foot is lifted)
make the right-foot step, and the same four with the legs mirrored below the hips make
the left-foot step, as for Sophie. Every frame is lined up on his standing picture:
head on the same centre line, planted foot on the same baseline.
