# Speech system

Speaking is central to the product and strongly encouraged. It is also never a wall: the game stays playable when the microphone is denied, the room is noisy, the network or recognition fails, or an accessibility need prevents speaking.

**Status:** lines are voiced, and answers can be spoken. The learner taps the microphone, says the line, and the recording goes through the backend to a local Whisper model; the words come back and enter the dialogue engine exactly like a typed answer. Typing stays available on every turn. Pronunciation is not analysed yet.

## Spoken answers

```
tap ─▶ recorder (MediaRecorder) ─▶ backend /speech/transcribe ─▶ speech service (Whisper) ─▶ transcript
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
| `POST /speech/transcribe` | `backend/` | validates and forwards; returns only the words |
| speech service | `speech-service/` | FastAPI with a local Whisper model, warmed at startup |

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

Read from the L2Renpy prototype on 2026-10-02 (`backend/app/speech/pronunciation.py`, `phonemize.py`, `text_phonemize.py`, `phonetic_guide.py`, `game/systems/speech/practice.rpy`). Nothing was copied; this records the approach so the phase can start from it.

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

- **Speech service:** load the phoneme model beside Whisper at startup (`torch`, `transformers`, `epitran`; roughly 400 MB more memory and a first download), and add an endpoint that returns per-word results for an exercise.
- **Reference audio:** L2Renpy compares against recorded reference audio. Here lines are synthesized, so the reference is either the cached TTS clip or text-derived IPA alone. Text-derived IPA ignores liaison and elision, so it over-reports differences; this is the main accuracy question to settle.
- **Game side:** `PronunciationAssessor` and `PronunciationDiagnostics` already exist as contracts. The word marks would extend the answer feedback (`said`), in a different style from the "used" marks, and the practice loop would follow the diagram above.
- **Rules already fixed:** pronunciation never decides quest progress, numbers are never shown to the learner, retries are finite.

## Backend boundary

```
React + Phaser + Capacitor ──▶ NestJS ──▶ Postgres
                                  └────▶ Speech/ML service (FastAPI): STT, TTS, pronunciation
```

NestJS is the application API the client calls and the holder of provider credentials. A Python/FastAPI service is the planned home for ML and audio work: faster-whisper, torch models, librosa, phoneme analysis. Local models are loaded and warmed during service startup, and readiness is exposed separately from liveness, so the first learner's attempt does not pay the model-load latency.

### What exists

`backend/` is a first NestJS slice (see `backend/README.md`):

| Piece | State |
| --- | --- |
| `GET /health`, `GET /health/ready` | liveness, and readiness that is `503` until the speech provider is warmed and its voices exist |
| `POST /speech/synthesize` | text, language, speaker ID and rate in; audio out, with cache status and an optional mouth timeline in headers |
| Provider interface (`TtsProvider`) | one adapter so far: `system`, the voices built into macOS, for development |
| Cache | on disk, keyed by provider, model, voice, language, rate and exact text; simultaneous identical requests share one synthesis |
| Mouth timeline | computed from the audio's loudness, 20 frames per second |

The client sends who is speaking (`speakerId`), never a provider voice name; the server maps speakers to voices. The backend also exposes `GET /speech/capabilities` and `POST /speech/transcribe`, which forwards to the FastAPI speech service in `speech-service/` (local Whisper). Not built: a hosted voice provider, pronunciation assessment, authentication and rate limiting.

## What L2Renpy contributed

The state names, the bounded word-remediation flow, the cache-key composition, the exercise-ID direction, the warm-at-startup rule and the mouth-timeline format all come from the L2Renpy prototype, re-expressed for this architecture. Its Ren'Py screens, Python recorder and backend code were not copied.
