# Speech system

Speaking is central to the product and strongly encouraged. It is also never a wall: the game stays playable when the microphone is denied, the room is noisy, the network or recognition fails, or an accessibility need prevents speaking.

**Status:** lines are voiced, and answers can be spoken. The learner taps the microphone, says the line, and the recording goes through the backend to a local Whisper model; the words come back and enter the dialogue engine exactly like a typed answer. Typing stays available on every turn. Pronunciation is not analysed yet.

## Spoken answers

```
tap ─▶ recorder (MediaRecorder) ─▶ backend /speech/transcribe (local Whisper) ─▶ transcript
                                                                                              │
                              dialogue engine: SAY, mode "speech" ◀─────────────────────────────┘
                              (intent assessed ─▶ quest event ─▶ speaking evidence, or an in-scene "Pardon ?")
```

| Piece | Where | Role |
| --- | --- | --- |
| `startRecording` | `frontend/src/app/recorder.ts` | microphone capture; maps browser errors to the speech error kinds; stops by itself after 12 s |
| `SpeechControl` | `frontend/src/app/components/SpeechControl.tsx` | the microphone button, rendered from the speech session state machine |
| `createHttpSpeechToText` | `frontend/src/speech/httpStt.ts` | uploads the recording to the backend |
| `fetchSpeechCapabilities` | same file | asks the backend whether recognition is available |
| `POST /speech/transcribe` | `backend/app/speech/transcribe.py` | validates, decodes the recording, runs a local Whisper model (warmed at startup); returns only the words |

Behaviour:

- **The microphone appears only when it will work:** the backend reports recognition ready and the device can record. Otherwise the turn shows the typed field alone.
- **Speaking is encouraged, never required.** The typed field sits under the microphone on every turn. Permission denied, no microphone, nothing heard, a dropped connection or a failing engine each show a plain message, offer another try where that can help, and leave typing as the way on.
- **The transcript is used as it is.** If Whisper mishears, the character reacts in the scene ("Pardon ?") and the reply line shows "You said: …", so the learner sees what was understood and can try again. After two misses the fitting answers are offered, as for typed answers.
- **Communication only.** The transcript is assessed for the intent. A spoken success is `speaking` evidence; nothing about pronunciation is inferred from it.
- **Privacy.** A recording exists for one request: uploaded, decoded, transcribed, deleted. Neither service stores audio, and logs hold sizes and timings, not words.
- **Devices.** Browsers allow the microphone only on secure pages (`localhost` counts). A phone build needs the backend on HTTPS, or native permission handling, which is part of the mobile pass.

## Voiced lines

```
Conversation ──▶ useLineVoice ──▶ VoiceLibrary ──▶ TextToSpeechProvider (HTTP) ──▶ backend /speech/synthesize
```

| Piece | Where | Role |
| --- | --- | --- |
| `TextToSpeechProvider` | `frontend/src/speech/types.ts` | the provider-neutral contract: text, language, speaker ID and rate in; audio and an optional mouth timeline out |
| `createHttpTextToSpeech` | `frontend/src/speech/httpTts.ts` | the adapter for the application backend |
| `VoiceLibrary` | `frontend/src/speech/voiceLibrary.ts` | fetches each line once, keeps recent lines in memory, pre-fetches, and backs off after a failure |
| `mouthOpenAt` | `frontend/src/speech/mouth.ts` | mouth open or closed at a playback time |
| `useLineVoice`, `useAudioSettings` | `frontend/src/app/voice.ts` | playback on one shared audio element, and per-device sound preferences |

Behaviour:

- **Text never waits for audio.** A line appears at once; its voice joins when ready. If the backend is unreachable or refuses, the line is simply silent, the library stops asking for 30 seconds, and the timed mouth flap stands in.
- **Character lines play as they appear.** The player's model answer is spoken only on request.
- **Replay and "Slower"** are learner-controlled and recorded as `replay` and `slow-playback` assistance.
- **The next character line is fetched ahead**, except after a question whose answer changes its words.
- **Sound settings** (in the conversation): speak lines aloud, volume, and whether the French text shows while listening. With the text off, a spoken line shows "Listen…" and a "Show text" button. Settings are per device and are not part of the save.
- **Browsers only play audio after a tap**, so playback is unlocked inside the tap that opens the conversation.
- **Configuration:** `VITE_API_URL` is the backend's base URL. In development it defaults to `http://localhost:3000`; in a production build without it the game runs silently.

### Listening evidence

| What happened | Evidence |
| --- | --- |
| line read, not heard | reading |
| line heard with its text on screen | reading, plus listening *exposure* |
| line heard with its text held back | listening |
| acting correctly on a line heard without its text (paying the price) | a listening success |

Listening and reading are never merged, and neither is ever counted as speaking.

## Pipeline

```
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
```

The game event depends only on communication. Pronunciation analysis comes afterwards and can only add evidence or suggest practice.

`SpeechAssessment` keeps the answers separate:

| Question | Field |
| --- | --- |
| Was usable speech detected? | `speechDetected` |
| What was transcribed? | `transcript` |
| What meaning did the player communicate? | `communication.intentId` |
| Did it satisfy the current objective? | `communication.satisfiesObjective` |
| Which concepts were demonstrated? | `communication.conceptIds` |
| Were there pronunciation problems worth practicing? | `pronunciation.wordsNeedingPractice` |
| How much assistance was used? | `assistance` |

Communication success and pronunciation quality are never merged into one pass/fail value. Exact-string matching is not the success criterion; valid alternative wordings satisfy the same intent.

## Interaction states

`speechSessionReducer` is a pure state machine:

```
idle ──START──▶ recording ──STOP──▶ processing ──RESULT──▶ result
  ▲                 │                    │                    │
  └──── CANCEL ─────┴──── CANCEL ────────┘                  RETRY
                                                              │
any state ──FAIL──▶ error ──RETRY──▶ idle ◀────────────────────┘
```

It supports start, stop, retry and cancel, counts attempts, and ignores out-of-order events. Errors are typed: `unavailable`, `permission-denied`, `no-microphone`, `no-speech`, `network`, `provider`. `speechErrorRecovery` says whether a retry can help and always offers a fallback. The UI shows a transcription preview and feedback in the `result` state, and offers typing or continuing as the node's `fallback` declares.

## Provider-neutral contracts

`frontend/src/speech/types.ts` defines `SpeechToTextProvider`, `TextToSpeechProvider` and `PronunciationAssessor`. Game and UI code depend only on these. No vendor or model is named in the frontend; an adapter is injected at the composition root, and in production that adapter calls the application backend, which holds the credentials.

### Text-to-speech and caching

Generated speech is cached twice: on the backend's disk, keyed by provider, model, voice, language, rate and the exact text, and in the client's memory for the session. An identical line is synthesized once. Pre-recorded canonical dialogue may be used where appropriate.

The backend returns a mouth timeline (one open/closed flag per frame) with the audio, computed from loudness. That is enough for simple lip movement on stylised 2D characters. No video generation.

### Exercise IDs

Pronunciation requests are shaped as an exercise ID plus the learner's audio:

```
exerciseId: cafe-order-001
learnerAudio: ...
```

The server and content system own the expected text, phonemes, canonical audio, unscored spans and assessment rules for that exercise. The client does not upload them with each attempt. Spoken dialogue responses already carry an `exerciseId` for this purpose.

### Unscored spans

Names, places, brands, foreign words and dynamic story values are excluded from pronunciation assessment through `assessment.excludedSpans` on the line (see `CONTENT-SCHEMA.md`).

## Word tracing, speed and flow (2026-10-02)

- **Tracing.** While a line plays, the word being said is highlighted, one word at a time, in whichever language Sophie is speaking. Generated lines carry word timings from ElevenLabs (`X-Word-Timings`); Sophie's recorded English lines are timed once by ElevenLabs forced alignment when the voice pack is built (`voices/pack/recordings.json`). The written translation is not spoken, so it is not highlighted.
- **Speed.** ElevenLabs speaks at 0.9 by default and 0.75 for "Slower" (`ELEVENLABS_SPEED`, `ELEVENLABS_SLOW_SPEED`). Changing a speed regenerates lines, because it is part of the cache key.
- **Flow.** Lines with nothing to answer move on by themselves 0.7 s after they have been heard, or after a reading pause in silence. There is no "Next" button (`SHOW_NEXT_BUTTON` in `frontend/src/app/flags.ts` brings it back); with it on, only dialogues marked `autoAdvance` move on by themselves.
- **The learner's pace.**
  - **Pause / play** sits on the card's lower edge. It holds everything: Sophie's voice stops mid-word, the word tracing freezes, her mouth closes and the card does not move on. Play carries on from the same point. Tapping Listen, Slower or the replay button also resumes. In practice, pause holds Sophie's prompts and feedback.
  - **Back** is the arrow at the top left, or a swipe in from the left edge of the screen (as in iOS). Only a 20 px strip at the edge listens, so taps and drags anywhere else stay with the scene. The previous card slides in from the left and plays again in full: voice, lip-sync, expression, word tracing and text.
  - **Forward** (the mirrored arrow) appears only when the learner is behind the furthest card they reached. It goes one card at a time and never past that card, so nothing new can be skipped.
  - **Replays record nothing.** Behind the furthest card a "Replay" tag shows. Answers there are practice: a miss still gets its repair line, but no learning evidence, profile answer or quest progress is written. Moving on from a replayed card goes to the card that came next the first time, passing over that first time's misses. Saved progress is never undone.
  - The rules live in `src/dialogue/trail.ts` (tested in `tests/trail.test.ts`): every card reached, up to 60, and which one is on screen. A new conversation starts a new trail.
- **"Slower"** is offered only on lines in the language being learned, not on English ones.
- **Speech-to-text** is ElevenLabs Scribe when an ElevenLabs key is set; local Whisper otherwise.
- **Voice pack.** Lines that are the same for everyone are shipped as files (`frontend/public/assets/voices/pack/`, listed by `frontend/src/speech/voicePack.ts`, built by `backend/tools/build_voice_pack.py`), with their lip-sync and word timings. The game plays recordings first, then the pack, and asks the backend only for lines with the player's name in them (or anything the pack lacks).

## Pronunciation practice in the opening

The first pronunciation practice is built: at the end of Sophie's welcome the learner practises the introduction she just taught, line by line (`meetSophie.practice`, a `practice` response).

- `frontend/src/speech/practice.ts` is the loop as pure functions, with the Ren'Py thresholds: a line is clear at 0.85; otherwise the weakest word is practised (clear at 0.80, at most three tries, a sound-it-out guide on the third), then the whole line once more, then on regardless.
- `POST /speech/practice` takes the learner's audio, the line, the speaker and the words not to grade (the learner's name). The server makes the reference from the speaker's cached voice for that line, so the learner is compared with exactly what they heard.
- Sophie talks the learner through it in her own voice: feedback, what to do next, then the French to copy. Feedback depends on how close the attempt was (`feedbackKind`: excellent at 0.95 and above, clear once it passes, close within 0.12 of passing, a good try from 0.45, tricky below), and each kind has several wordings (`PRACTICE_PHRASES`). She picks one at random without repeating herself (`createPhrasePicker`). All the phrases are in the voice pack.
- A single word to practise is voiced with its sentence around it as context (ElevenLabs `previous_text`/`next_text`), so it is said in French and as it sounds in the sentence, and the pronunciation reference is made the same way. Models that accept a language (v2.5 Flash/Turbo, v3) are also told to speak French.
- The learner sees words marked clear or worth practising, never a number. The attempts are finite, so the practice always ends; there is no skip button. Without a microphone or the pronunciation model, the lines are shown to listen to and repeat, with Continue.
- "Listen" and "Slower" show that they are playing while they play.
- Practice records no learning evidence yet and never affects quests.

Lines in the learner's own language (`language: "interface"` on a node, such as Sophie's welcome) are voiced in English: from a recording shipped with the game when there is one (`frontend/src/speech/recordings.ts`), otherwise by the backend, whose `VOICE_LANGUAGES` adds English to the voiced languages.

## Pronunciation remediation loop

```
full phrase → learner speaks → assess
  acceptable? ── yes → continue
              └─ no  → weakest useful word → word attempt 1 → word attempt 2
                       → phonetic/help hint if needed → final phrase attempt
                       → continue regardless, recording evidence
```

Retries are always finite. After the bounded attempts the player continues and the concept is recorded as needing future reinforcement. Numeric similarity may pick the weak word and the hint; it is never presented as "your pronunciation is 83% correct".

### How L2Renpy analyses pronunciation (reference for this phase)

Read from the L2Renpy prototype on 2026-10-02 (`backend/app/speech/pronunciation.py`, `phonemize.py`, `text_phonemize.py`, `phonetic_guide.py`, `game/systems/speech/practice.rpy`). The evaluator itself is now back in this project's backend as `POST /speech/pronunciation`, unchanged; the game-side practice loop is still to build.

| Step | What L2Renpy does |
| --- | --- |
| Hear sounds, not words | A phoneme-recognition model, `Cnam-LMSSC/wav2vec2-french-phonemizer-v2` (wav2vec2, about 94M parameters, MIT licence), turns audio straight into IPA. Unlike Whisper it does not "correct" what it hears into real words. |
| Phrase similarity | The same model is run on the learner's recording and on the approved reference audio of the line. The two IPA strings are aligned by edit distance; similarity is the share of matching symbols. |
| Per-word result | Expected IPA for each word comes from text (`epitran`, `fra-Latn`). The learner's IPA is aligned against it and each difference is charged to a word, giving a per-word share of matches and a list of differences. |
| Unscored spans | Names and other excluded words cost nothing in the alignment, including sounds inserted next to them. This matches `assessment.excludedSpans` here. |
| Weakest word | The earliest lowest-scoring scorable word, only when the phrase is not already near-perfect. |
| Hint | A beginner respelling built from the IPA by a fixed table ("ah-prahn-dr"), shown from the third word attempt. |
| Finite loop | Phrase passes at 0.85. Otherwise practise the weakest word (passes at 0.80, at most 3 tries), then one final phrase attempt, then continue regardless and record the outcome. |
| Honesty | The code calls its numbers "engineering similarity values for the prototype, not validated language-learning scores". |

What adopting it here needs:

- **Backend:** the evaluator and its model are in `backend/` (loaded on the first request, or at startup with `PRONUNCIATION_PRELOAD=true`; roughly 400 MB more memory and a first download). Still needed: an endpoint that takes an exercise ID plus the learner's audio, instead of the Ren'Py shape that uploads the reference with every attempt.
- **Reference audio:** L2Renpy compares against recorded reference audio. Here lines are synthesized, so the reference is either the cached TTS clip or text-derived IPA alone. Text-derived IPA ignores liaison and elision, so it over-reports differences; this is the main accuracy question to settle.
- **Game side:** `PronunciationAssessor` and `PronunciationDiagnostics` already exist as contracts. The word marks would extend the answer feedback (`said`), in a different style from the "used" marks, and the practice loop would follow the diagram above.
- **Rules already fixed:** pronunciation never decides quest progress, numbers are never shown to the learner, retries are finite.

## Backend boundary

```
React + Phaser + Capacitor ──▶ Python backend (FastAPI): TTS, STT, pronunciation, AI second opinion
                                     └────▶ Postgres (planned)
```

`backend/` is the application API the client calls and the holder of provider credentials (`PLAN.md` 4A.8). ML and audio work run inside it: faster-whisper, torch models, librosa, phoneme analysis. Local models are loaded and warmed at startup, in the background, and readiness is exposed separately from liveness, so the first learner's attempt does not pay the model-load latency. Full reference: `backend/README.md`.

### What exists

| Piece | State |
| --- | --- |
| `GET /health`, `GET /health/ready` | liveness, and readiness that is `503` until lines can be voiced; recognition, pronunciation and the AI layer are reported alongside |
| `GET /speech/capabilities` | `{ synthesis, recognition }`, so the game offers the microphone only when it will work |
| `POST /speech/synthesize` | text, language, speaker ID and rate in; audio out, with cache status and the mouth timeline in headers |
| Voice providers | `elevenlabs` (a voice per character, speed 0.8 for "Slower"), `system` (macOS voices, development), `chatterbox` (local model, one voice) |
| Cache | on disk, keyed by provider, model, voice, language, rate and exact text, with the mouth timeline stored beside the audio; simultaneous identical requests share one synthesis |
| Mouth timeline | 20 frames per second, opening on syllable peaks rather than staying open for whole sentences (L2Renpy's algorithm) |
| `POST /speech/transcribe` | local Whisper (`large-v3-turbo` by default) or ElevenLabs Scribe; PyAV decodes iPhone and browser recordings; Whisper's invented text on silence is dropped |
| `POST /speech/pronunciation` | L2Renpy's evaluator, not yet called by the game |

The client sends who is speaking (`speakerId`), never a provider voice name; the server maps speakers to voices. Not built: the exercise-ID pronunciation endpoint, authentication and rate limiting on the speech endpoints.

## What L2Renpy contributed

The state names, the bounded word-remediation flow, the cache-key composition, the exercise-ID direction, the warm-at-startup rule and the mouth-timeline format all come from the L2Renpy prototype, re-expressed for this architecture. Its Ren'Py screens and Python recorder were not copied; its backend became this project's backend (`L2RENPY-IMPORTS.md`).

## Sophie's poses

Each line names an expression (`presentation.expression`), which is a pose in `src/characters/catalog.ts`. Besides the original four (neutral, question, explaining, encouraging) she has gestures for particular moments: `talking`, `presenting`, `playful`, `pinching`, `speaking-french`, `listening`, `excellent`, `well-done`, `close`, `good-try`, `beckoning`, `pleased`, `inviting` and `goodbye`. `happy` borrows `pleased`.

- **Lip-sync on every pose.** `tools/build_pose_portraits.py --sources <folder with the pose PNGs>` turns each pose into a closed-mouth master (`closed.webp`) and its own open-mouth patch (`mouth-open.png`, with its own `mouthRect`, as her head moves a little with each gesture). A pose drawn with her mouth closed borrows the open mouth from `neutral_speaking`. A pose drawn mid-word keeps its own mouth as the patch and gets a closed mouth from `neutral_closed`. Turned away (`inviting`, `goodbye`), she is shown as drawn.
- **Blinking.** The neutral and talking poses have a shut-eyes patch (`neutral/blink.png`, cut from `blink_idle`), shown for 140 ms every 2.5 to 6 s. It is off when the device asks for reduced motion.
- **Never frozen.** A line left on `neutral` alternates with `talking` from card to card.
- **Practice.** Her gesture follows what she says (`practiceExpression` in `src/speech/practice.ts`): `excellent`, `well-done`, `close` or `good-try` for the feedback, `beckoning` for "say it again", `speaking-french` for the line itself, and `listening` (hand to her ear) while it is the learner's turn.

## Practising a short word

A word of four letters or fewer ("je", "mes", "pour") is one or two sounds: on its own there is too little for the phoneme model to hear, and a good retry can come back as a miss. So when the weak word is short, the learner practises it with its neighbour (`practiceChunk` in `src/speech/practice.ts`):

- The chunk is the weak word and the word after it, or the word before it at the end of a line. If that is still under six letters ("je ne"), one more word is added ("Je ne sais").
- Sophie says the chunk, with the rest of the sentence as context, and the weak word is underlined on the card.
- The attempt is judged by the weak word's own score within the chunk (`score`, now sent per word by `/speech/practice`), not by the chunk as a whole. Her feedback follows that word too.
- Longer words are still practised on their own. Change `SHORT_WORD_LETTERS` to adjust.
- The voice pack holds each word as it would be practised, so chunks are packed too.

