# Second Language backend

The application API. The game client talks only to this service; provider keys, models and voices stay here.

This is a deliberately small first slice: health checks, text-to-speech, speech recognition and the AI conversation layer. The game uses it to voice character lines, to hear spoken answers, and to get a second opinion on what a learner meant. Accounts, saves, progression, content APIs, speech recognition and the database come in later phases (see `../PLAN.md`).

## Run

```bash
npm install
npm run dev
```

It listens on port 3000. Settings come from `.env` (copy `.env.example`); every value has a development default, so no `.env` is needed to start.

```bash
npm test
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness: the process is up. |
| GET | `/health/ready` | Readiness: the speech provider is warmed and its voices exist. `503` until then. |
| GET | `/speech/capabilities` | What works right now: `{ synthesis, recognition }`. The game offers the microphone only when recognition is true. |
| POST | `/speech/synthesize` | Voice one line. |
| POST | `/speech/transcribe` | Turn a short recording into words. |
| GET | `/conversation/capabilities` | `{ judgement }`: whether a language model is configured. |
| POST | `/conversation/turn` | A second opinion on one learner turn. |

### `POST /speech/synthesize`

```json
{ "text": "Salut ! Je m'appelle Sophie.", "languageCode": "fr", "speakerId": "sophie", "rate": "normal" }
```

- `text`: up to 300 characters.
- `languageCode`: a language that has voices configured.
- `speakerId` (optional): who is speaking, as a game ID. The server maps it to a voice; an unknown speaker gets the language's default voice.
- `rate` (optional): `normal` or `slow`.

The response body is the audio. Headers:

| Header | Meaning |
| --- | --- |
| `Content-Type` | the audio format (`audio/wav` from the system provider) |
| `X-Speech-Cache` | `hit` or `miss` |
| `X-Speech-Key` | the cache key of this line |
| `X-Mouth-Timeline`, `X-Mouth-Fps` | optional lip-sync track: one `0` (closed) or `1` (open) per frame |

Try it:

```bash
curl -X POST http://localhost:3000/speech/synthesize -H 'Content-Type: application/json' -d '{"text":"Bonjour ! Vous désirez ?","languageCode":"fr","speakerId":"barista"}' --output line.wav
```

### `POST /speech/transcribe`

Multipart form: `audio` (the recording, up to 3 MB) and `languageCode`.

```json
{ "transcript": "Je voudrais un café, s'il vous plaît.", "speechDetected": true, "confidence": 0.94 }
```

The backend forwards the recording to the speech service (`../speech-service`, local Whisper) and returns only the words. It does not decide whether they answered anything; the game's dialogue engine does. Recordings are held in memory for the request and never stored, and logs record sizes and timings, never what was said.

```bash
curl -X POST http://localhost:3000/speech/transcribe -F audio=@answer.wav -F languageCode=fr
```

Recognition needs the speech service running (`SPEECH_SERVICE_URL`, default `http://127.0.0.1:8000`). Without it `/speech/capabilities` reports `recognition: false`, voices still work, and the game falls back to typed answers.

### `POST /conversation/turn`

Asks the configured language model which expected intent, if any, the learner expressed, and what the character might say if none. The answer is advice; the game's dialogue engine decides what happens. Full description in `../docs/AI-CONVERSATION.md`.

```json
{
  "languageCode": "fr", "level": "A1",
  "npc": { "name": "Nadia", "role": "the barista of the neighbourhood café", "register": "formal" },
  "place": "Café", "goal": "Order a coffee",
  "recentLines": [{ "speaker": "npc", "text": "Vous désirez ?" }],
  "intents": [{ "id": "orderDrink", "description": "Order a coffee (any kind of coffee, but not another drink).", "examples": ["Un café, s'il vous plaît."] }],
  "knownVocabulary": ["bonjour", "café"],
  "utterance": "Je prends un petit noir", "attempt": 1
}
```

```json
{ "detectedIntent": "orderDrink", "confidence": 1 }
```

On a miss: `{ "detectedIntent": null, "confidence": 0, "npcResponse": { "text": "…", "translation": "…" } }`. An accepted answer may carry `correction`, another way to say it.

| Status | Meaning |
| --- | --- |
| `400` | The request is missing something or is over a limit. |
| `429` | The per-minute cap (`AI_REQUESTS_PER_MINUTE`) is reached. |
| `502` | The model's reply was unusable, twice. |
| `503` | No model is configured, or it could not be reached in time. |

Put `OPENROUTER_API_KEY` in `.env` to switch it on; `AI_MODEL` chooses the model. `npm run eval` runs a set of Chapter 1 turns through the live model and prints what it decided.

## Providers

Speech vendors sit behind one interface, `TtsProvider` (`src/speech/tts.provider.ts`). `TTS_PROVIDER` chooses the adapter in `createTtsProvider` (`src/speech/speech.module.ts`).

| Provider | Status | Notes |
| --- | --- | --- |
| `system` | implemented | The voices built into macOS (`say`). Free and local, for development only: it does not exist on Linux servers and is not a production voice. See "Better development voices" below. |
| a hosted provider | not chosen yet | Needs an account and key. Adding one is a new adapter file plus one line in `createTtsProvider`; nothing else changes. |

Voices are configured per language and speaker with `TTS_VOICES`. A speaker's value may be a list in order of preference; the first voice the provider has is used, and the startup log says which were chosen. Voice names belong to the provider and never appear in the client.

### Better development voices

macOS has two kinds of French voice. `Thomas`, `Jacques` and `Amélie` sound natural. The ones with a locale in brackets, such as `Flo (French (France))`, are an old robotic synthesizer that speaks syllable by syllable; they are not used.

Out of the box the female voice is `Amélie`, which has a Canadian accent. For a France-French female voice and better quality all round, download an enhanced voice (free): **System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → French**, then pick `Audrey` (Premium or Enhanced) and, if you like, the enhanced `Thomas`. Restart the backend; they are picked up automatically, and because the voice is part of the cache key, lines are regenerated with the new voice.

## Caching

Every generated line is stored in `TTS_CACHE_DIR` (default `.tts-cache/`) and reused. The key is built from provider, model, voice, language, rate and the exact text, so changing any of them never plays stale audio, and an identical line is synthesized only once. Simultaneous requests for the same line share one synthesis. Delete the folder to clear it, or set `TTS_CACHE_DIR=off`.

## Startup and readiness

The provider is warmed when the service starts: models load, credentials are checked, and every configured voice must exist. If that fails the service stays up but reports not-ready, and synthesis returns `503`; the game then shows lines without voice. The first learner never pays the model-loading time.

## Not here yet

- A hosted voice provider (a decision and a key are needed).
- Pronunciation assessment.
- Accounts, saves, progression, content/exercise APIs, Postgres/Prisma.
- Authentication. Until accounts exist, anything that can reach the service can ask it to synthesize or transcribe speech, or to spend the AI key up to its per-minute cap; with a paid provider, or on a public address, that must be closed first.
