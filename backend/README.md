# Second Language backend

One Python (FastAPI) service, and the only server the game talks to. It voices character lines, turns spoken answers into words, gives a second opinion on answers the game's own rules do not recognise, and evaluates pronunciation.

The game never needs it. Without it the game is silent and typed-only, and otherwise the same. Progress and saves stay on the device.

This backend started as the Ren'Py version's speech backend (`renpy-final` tag). It was extended to serve the Phaser game: voices per character, slower playback, lip-sync timelines in the response, readiness checks, CORS for the installed apps, and the AI conversation layer ported from the earlier NestJS slice.

| Service | Port | What it does | Needed? |
| --- | --- | --- | --- |
| Main backend (`backend/app`) | 3000 | Everything the game calls | For voices, the microphone and the AI second opinion |
| Chatterbox (`backend/tts_service`) | 8001 | A local voice model | Only with `LANGUAGE_APP_TTS_PROVIDER=chatterbox` |

## One-time setup

Run from `backend/`. Use **uv's own Python**, not Homebrew's: Homebrew's `python@3.12` 3.12.14 is broken on macOS 26.2 (its XML module fails to load, which breaks pip).

```bash
uv python install 3.12
uv venv --python 3.12 --python-preference only-managed .venv
uv pip install --python .venv/bin/python -r requirements.txt -r requirements-dev.txt
cp .env.example .env    # then fill in what you use; see "Settings"
```

Models download on first use and are cached afterwards: Whisper `large-v3-turbo` (about 1.6 GB, at startup), the pronunciation model (about 400 MB, on the first pronunciation request) and the name model (about 430 MB, only if `/text/extract-name` is called).

## Run

```bash
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 3000
```

- **`--host 0.0.0.0`** lets a phone on the same Wi-Fi reach it. Without it only the Mac can.
- **Port 3000** is where the game looks by default (`VITE_API_URL`).
- Add `--reload` while editing the code.

The server answers at once and loads Whisper in the background. Recognition is ready when the log says `Speech-to-text (faster-whisper) ready`. Until then the game shows the typed field only.

Check it:

```bash
curl http://127.0.0.1:3000/health/ready
```

```bash
.venv/bin/python -m pytest
```

The tests fake every provider and model, so they run offline in about a second.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness: the process is up. |
| GET | `/health/ready` | Readiness: `200` once lines can be voiced, `503` before. Also reports recognition, pronunciation and the AI layer. |
| GET | `/speech/capabilities` | `{ synthesis, recognition }`. The game shows the microphone only when `recognition` is true. |
| POST | `/speech/synthesize` | JSON `{ text, languageCode, speakerId?, rate? }` → audio. Headers: `X-Mouth-Timeline` (one `0`/`1` per frame), `X-Mouth-Fps` (20), `X-Speech-Cache` (`hit`/`miss`), `X-Speech-Key`. |
| POST | `/speech/transcribe` | Multipart `audio` + `languageCode` → `{ transcript, speechDetected, confidence, language }`. Silence is `speechDetected: false`, not an error. |
| POST | `/speech/practice` | Multipart `audio`, `text`, `languageCode`, `speakerId`, `excluded` (JSON list of words not graded) → `{ similarity, words, weakestWord }`. The reference is the speaker's own cached voice for `text`. Used by the opening's practice. |
| POST | `/speech/pronunciation` | Multipart `reference_text`, `reference_audio`, `learner_audio`, optional `evaluation_exclusions` → per-word results and the weakest word. From the Ren'Py version. **The game does not call it yet.** |
| POST | `/text/extract-name` | `{ text }` → `{ name }`. A name-finding model, from the Ren'Py version. The game uses its own rules today. |
| GET | `/conversation/capabilities` | `{ judgement }`: whether the AI second opinion is switched on. |
| POST | `/conversation/turn` | A second opinion on one learner turn. See `../docs/AI-CONVERSATION.md`. |

Status codes the game relies on:

- **`400`**: the request itself is wrong. The game does not back off.
- **`413`**: a recording over 3 MB or 20 s.
- **`422`**: audio that cannot be decoded.
- **`429`**: the AI per-minute cap is reached.
- **`502`**: a provider gave an unusable answer.
- **`503`**: not configured, not ready or not reachable.

## Settings

Everything lives in `backend/.env` (never committed). Every value has a default. `.env.example` lists them all.

### Voices

`LANGUAGE_APP_TTS_PROVIDER` picks the voice:

| Value | What it is | Notes |
| --- | --- | --- |
| `elevenlabs` | Hosted voices | Needs `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL_ID` and a voice. The production choice. |
| `system` | The voices built into macOS (`say`) | Free and local. The default on a Mac. Development only. |
| `chatterbox` | A local model in `tts_service/` | One voice for everyone, and slow on a laptop. |
| `none` | Off | The game runs silently. |

**ElevenLabs voices per character.** `ELEVENLABS_VOICES` maps the game's speaker IDs to voice IDs:

```dotenv
ELEVENLABS_VOICES={"sophie":"<voice-id>","barista":"<voice-id>","baker":"<voice-id>","neighbor":"<voice-id>"}
```

Anyone not listed, including the player's model answers, uses `ELEVENLABS_VOICE_ID`, which was Sophie's voice in the Ren'Py `.env`. With only that set, everyone sounds like Sophie.

**Speed.** Characters speak a little slower than natural (`ELEVENLABS_SPEED`, default 0.9) and "Slower" slower still (`ELEVENLABS_SLOW_SPEED`, 0.75). The voice's own saved settings (stability, similarity) are read once and kept; only the speed changes.

**Voice pack.** Every line that is the same for every player is generated once and shipped with the game in `frontend/public/assets/voices/pack/`, so it is never generated again and survives any cache being cleared. That covers what characters say in every dialogue (and their "Slower" versions), the player's model answers, the practice lines for every level and reason, each word that may be practised on its own, Sophie's practice prompts and the phrasebook words. Lines containing the player's name are left out and made live. To (re)build it, after changing dialogue, voices or speed:

```bash
cd frontend && npm run voices:list
cd ../backend && .venv/bin/python tools/build_voice_pack.py --dry-run   # how many characters it will cost
.venv/bin/python tools/build_voice_pack.py                              # then commit frontend/public/assets/voices/pack
```

Lines already in `.tts_cache` are reused for free. The tool never deletes pack files unless given `--prune`.

**Word tracing.** ElevenLabs lines are made with per-character timing, turned into word timings and sent as `X-Word-Timings` (`start:end:fromMs:toMs` per word, `;`-separated), so the game lights the words up as they are said. The macOS and Chatterbox voices have no timings, so their lines are not traced.

**macOS voices.** Out of the box the female voice is `Amélie`, which has a Canadian accent. For a France-French voice, download `Audrey` (free): **System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → French**. Restart the backend and it is picked up. `SYSTEM_VOICES` overrides the whole table as JSON.

**Cache.** Every line is stored in `.tts_cache/` with its lip-sync timeline and reused. The key covers the provider, model, voice, language, speed and exact text, so changing any of them never plays stale audio. ElevenLabs is paid for once per line. Delete the folder to clear it, or set `LANGUAGE_APP_TTS_CACHE_DIR=off`.

### Speech recognition

| Setting | Default | Meaning |
| --- | --- | --- |
| `LANGUAGE_APP_STT_PROVIDER` | `elevenlabs` when `ELEVENLABS_API_KEY` is set, else `faster-whisper` | `elevenlabs` (Scribe), `faster-whisper` (local Whisper) or `none` |
| `FASTER_WHISPER_MODEL` | `large-v3-turbo` | `small` is quicker on a laptop (about 1 s an answer) but copes less well with accents |
| `FASTER_WHISPER_DEVICE` | `auto` | GPU when there is one, else CPU |
| `FASTER_WHISPER_COMPUTE_TYPE` | `auto` | `int8` is a good choice on CPU |
| `FASTER_WHISPER_BEAM_SIZE` | `1` | Higher is slightly more accurate and slower |

Recordings are decoded with PyAV, which reads what iPhones (MP4/AAC) and browsers (WebM/Opus) record. Whisper's invented subtitles on silence ("Sous-titres réalisés par…") and low-confidence guesses are dropped. A recording is used for one request and deleted; logs hold sizes and timings, never words.

### AI second opinion

| Setting | Default | Meaning |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | none | Without it the layer is off and the game uses its own rules only |
| `AI_PROVIDER` | `openrouter` with a key, else `none` | `none` switches it off |
| `AI_MODEL` | `google/gemini-3.1-flash-lite` | Any OpenRouter model with structured output |
| `AI_TIMEOUT_MS` | `8000` | Per model call |
| `AI_REQUESTS_PER_MINUTE` | `60` | Cap across all players |

### Pronunciation

The phoneme model is loaded at startup, in the background, because the game's opening uses it. `PRONUNCIATION_PRELOAD=false` loads it on the first request instead. `VOICE_LANGUAGES` (default `en`) adds languages that characters may be voiced in without learners answering in them, such as Sophie's English welcome.

### Access

| Setting | Default | Meaning |
| --- | --- | --- |
| `CORS_ORIGINS` | the dev page plus the iOS and Android app origins | Which web pages may call the API |
| `SPEECH_LANGUAGES` | `fr` | Languages characters speak and learners may answer in |

**There is no authentication.** Anyone who can reach the backend can use your ElevenLabs and OpenRouter keys, up to the AI per-minute cap. It is safe on a home network only. Set spending limits on both keys.

## Chatterbox (optional)

Chatterbox has its own environment because it pins torch/transformers/librosa versions that clash with the pronunciation model's.

```bash
uv venv --python 3.12 --python-preference only-managed tts_service/.venv
uv pip install --python tts_service/.venv/bin/python -r tts_service/requirements.txt
tts_service/.venv/bin/uvicorn server:app --app-dir tts_service --port 8001
```

Then set `LANGUAGE_APP_TTS_PROVIDER=chatterbox` and restart the main backend.

## Pronunciation by hand

The fixtures from the Ren'Py version are still here:

```bash
curl -X POST http://127.0.0.1:3000/speech/pronunciation \
  -F "reference_text=Bonjour, je m'appelle Sophie." \
  -F "reference_audio=@test.wav" \
  -F "learner_audio=@learner.wav"
```

`evaluate_pronunciation.py` runs the same evaluation from the command line. How it works is described in `../docs/SPEECH-SYSTEM.md`.

## Layout

```
app/
  main.py                  routes, CORS, startup
  config.py                shared settings
  speech/
    tts.py                 voice providers, voices per speaker, cache, readiness
    lipsync.py             mouth timeline from audio
    transcribe.py          recognition providers, warm-up, readiness
    audio.py               decoding (PyAV for recordings, librosa for the phoneme model)
    pronunciation.py …     phoneme alignment, weakest word, phonetic guide
  conversation/
    turn.py                request limits, prompt, reply checks (pure)
    service.py             model adapter (OpenRouter), cache, per-minute cap
  text/names.py            name extraction
tts_service/               optional Chatterbox server
tests/                     pytest; everything external is faked
```

## Logs and errors

Every request gets one line in the terminal and in `backend/logs/backend.log` (rotated at 2 MB, five old files kept):

```
14:02:11 INFO    [k3f9a1c2] backend.requests: POST /speech/synthesize -> 200 in 812 ms
14:02:15 WARNING [p0w8x4d1] app.speech.tts: ElevenLabs refused a line (attempt 1 of 3): status=429 code=too_many_concurrent_requests: ... - trying again
14:02:17 ERROR   [m2c7b9e5] backend: POST /speech/synthesize failed (502): ElevenLabs refused the request (401, quota_exceeded): ...
```

The id in brackets is the request's. The game sends it (`X-Request-Id`) and shows it next to each problem in **phone > Settings > Problems**, so a problem seen in the game can be found here with a search. Error responses are `{ "detail": "<the reason>", "requestId": "<id>" }`.

- `/speech/synthesize` answers **502** when ElevenLabs refused the line (the reason says why: quota, voice, bad request), and **503** with `Retry-After` when it was busy or down even after retries. The game tries a 503 once more by itself.
- At most `ELEVENLABS_MAX_CONCURRENCY` lines (default 2) are requested from ElevenLabs at once; the rest queue. Busy answers (429), server errors and timeouts are retried `ELEVENLABS_RETRIES` times (default 2), with growing waits.
- `LOG_LEVEL=DEBUG` adds more detail; `LOG_FILE=off` writes to the terminal only.
