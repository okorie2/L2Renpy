# Language App speech backend

Two local services:

| Service | Port | What it does | Environment |
|---|---|---|---|
| Main backend (`backend/app`) | 8000 | Transcription (faster-whisper), pronunciation scoring, name extraction, and the `/speech/synthesize` endpoint the game calls | `backend/.venv` |
| Chatterbox TTS (`backend/tts_service`) | 8001 | Generates Sophie's voice; the main backend forwards synthesis requests to it | `backend/tts_service/.venv` |

Chatterbox has its own environment because it pins torch/transformers/librosa
versions that clash with the pronunciation model's.

## One-time setup

Run everything from the repository root (`Language_app/`).

Use **uv's own Python**, not Homebrew's: Homebrew's `python@3.12` 3.12.14 is
broken on macOS 26.2 (its XML module fails to load, which breaks pip and makes
`platform.mac_ver()` return an empty version).

```bash
uv python install 3.12

# Main backend
uv venv --python 3.12 --python-preference only-managed backend/.venv
uv pip install --python backend/.venv/bin/python -r backend/requirements.txt

# Chatterbox TTS
uv venv --python 3.12 --python-preference only-managed backend/tts_service/.venv
uv pip install --python backend/tts_service/.venv/bin/python -r backend/tts_service/requirements.txt
```

Check that an environment uses uv's Python (the path should be under
`~/.local/share/uv/python/`, and the version should not be empty):

```bash
backend/.venv/bin/python -c "import sys, platform; print(sys.executable); print(platform.mac_ver())"
```

Configuration lives in `backend/.env`, which both services read. Keep it
local and never commit it. For the free local models:

```dotenv
LANGUAGE_APP_STT_PROVIDER=faster-whisper
LANGUAGE_APP_TTS_PROVIDER=chatterbox
```

Models download on first use and are cached afterwards: the pronunciation
model (Transformers), Whisper `large-v3-turbo` (~1.6 GB), Chatterbox (~2 GB)
and, only if the name rules are unsure, the name model (~430 MB).

## Start the services

Use two Terminal tabs, both from the repository root.

**Tab 1: Chatterbox** (start it first; loading the model takes a little while,
it's ready at `Application startup complete`):

```bash
backend/tts_service/.venv/bin/uvicorn server:app --app-dir backend/tts_service --port 8001
```

**Tab 2: main backend:**

```bash
backend/.venv/bin/uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0
```

`--host 0.0.0.0` lets the iPhone reach the backend over Wi-Fi; without it the
backend only accepts connections from the Mac itself and the phone shows
"Could not connect to the local speech backend". The phone uses
`speech_api_ios_base_url` in `game/systems/speech/api.rpy`, which must be the
Mac's current Wi-Fi address (`ipconfig getifaddr en0`) with port 8000. Mac and
phone must be on the same network. Chatterbox can stay on the default
localhost: only the main backend talks to it.

Stop either with Ctrl+C. Restart the main backend after editing `.env`.
If Chatterbox isn't running, synthesis requests fail with "not reachable" and
the game shows those lines without voice.

### Check they're working

Chatterbox directly (plays a French test line):

```bash
curl --fail -X POST http://127.0.0.1:8001/synthesize \
  -H 'Content-Type: application/json' \
  -d '{"text":"Bonjour, je m\u0027appelle Sophie.","language":"fr"}' \
  --output /tmp/chatterbox-test.wav && open /tmp/chatterbox-test.wav
```

Main backend health check:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

Pronunciation evaluation using the preserved repository fixtures:

```bash
curl -X POST http://127.0.0.1:8000/speech/pronunciation \
  -F "reference_text=Bonjour, je m'appelle Sophie." \
  -F "reference_audio=@backend/test.wav" \
  -F "learner_audio=@backend/learner.wav"
```

Standalone transcription test using the preserved learner WAV:

```bash
curl -X POST http://127.0.0.1:8000/speech/transcribe \
  -F "language=en" \
  -F "learner_audio=@backend/learner.wav"
```

The transcription endpoint uses the provider set by
`LANGUAGE_APP_STT_PROVIDER`: local faster-whisper, or ElevenLabs Scribe v2
(`elevenlabs`, needs `ELEVENLABS_API_KEY`). It returns a compact response
containing `transcript` and the normalized language code.

## Text-to-speech boundary

The backend also exposes a provider-neutral synthesis contract. The provider
is set by `LANGUAGE_APP_TTS_PROVIDER`: `chatterbox` (local, see below) or
`elevenlabs`, which needs these variables:

```dotenv
LANGUAGE_APP_TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=<your-local-key>
ELEVENLABS_VOICE_ID=<Sophie's-local-voice-id>
ELEVENLABS_MODEL_ID=<your-local-model-id>
```

The endpoint returns ElevenLabs MP3 bytes as `audio/mpeg`. The API key, voice
ID, and model ID remain backend-only; Ren'Py only sends text and `language`.

Manual local synthesis check:

```bash
TMP_DIR="$(mktemp -d)"
TMP_MP3="$TMP_DIR/sophie-introduction.mp3"
curl --fail -X POST http://127.0.0.1:8000/speech/synthesize \
  -H 'Content-Type: application/json' \
  -d '{"text":"Je m\u0027appelle Emma.","language":"fr"}' \
  --output "$TMP_MP3"
file "$TMP_MP3"
echo "$TMP_MP3"
```

The original CLI remains available:

```bash
cd backend
.venv/bin/python evaluate_pronunciation.py \
  --reference-text "Bonjour, je m'appelle Sophie." \
  --reference-audio test.wav \
  --learner-audio learner.wav
```

The API's upload-based request shape is temporary. A later exercise-ID API
can resolve reference text, expected phonemes, and approved Sophie audio on
the server, leaving Ren'Py to send an exercise ID and learner recording.

### Caching generated speech

Every generated line is saved in `backend/.tts_cache/` and reused, so each
distinct sentence is only generated (and paid for) once. The cache key is the
provider, its voice/model settings, the language and the exact text, so
switching voice never plays old audio. Delete the folder to clear it; set
`LANGUAGE_APP_TTS_CACHE_DIR=off` to disable caching, or a path to move it.
A cache hit is logged as `TTS cache hit` in the backend terminal.

## Name extraction

`POST /text/extract-name` with `{"text": "..."}` returns `{"name": "Ella"}` or
`{"name": null}`. The app only calls it when its own rules
(`game/systems/player_name.rpy`) can't find a clear name in the player's
answer, e.g. an unusual phrasing.

It uses a small named-entity recognition model through `transformers`
(`dslim/bert-base-NER` by default, ~430 MB, downloaded on first use). Set
`LANGUAGE_APP_NAME_MODEL` in `backend/.env` to use a different model.

```bash
curl -X POST http://127.0.0.1:8000/text/extract-name \
  -H 'Content-Type: application/json' \
  -d '{"text":"everyone around here knows me as Ella"}'
```

## Local speech models (no API costs)

Speech-to-text and text-to-speech can run locally instead of ElevenLabs.
Each is chosen in `backend/.env`; the ElevenLabs code stays available.

```dotenv
LANGUAGE_APP_STT_PROVIDER=faster-whisper
LANGUAGE_APP_TTS_PROVIDER=chatterbox
```

### Speech-to-text: faster-whisper

Installed with the main backend requirements (`faster-whisper`). The model
(`large-v3-turbo` by default, ~1.6 GB) downloads on first use, is loaded
when the backend starts, and stays in memory. Each transcription logs how long
it took. Optional settings:

```dotenv
FASTER_WHISPER_MODEL=large-v3-turbo   # or small / medium for less memory
FASTER_WHISPER_DEVICE=auto            # cuda on a GPU server, else cpu
FASTER_WHISPER_COMPUTE_TYPE=auto      # int8 is a good choice on CPU
FASTER_WHISPER_BEAM_SIZE=1            # 1 = fastest; 5 = slightly more accurate, slower
```

### Text-to-speech: Chatterbox (separate service)

Chatterbox Multilingual (MIT licence, English + French, voice cloning) runs
as its own small service in its own virtualenv, because it pins torch,
transformers and librosa versions that differ from the main backend's. The
main backend calls it at `CHATTERBOX_URL` (default `http://127.0.0.1:8001`).

Setup and start commands are under "One-time setup" and "Start the services" above.

Sophie's voice: set `CHATTERBOX_VOICE_PROMPT` to a clean ~10 s recording of
the voice to clone (one you have the rights to). Without it, Chatterbox's
built-in voice is used. Other settings:

```dotenv
CHATTERBOX_VOICE_PROMPT=/absolute/path/to/sophie_reference.wav
CHATTERBOX_DEVICE=auto          # mps on Apple Silicon, cuda on a GPU server
CHATTERBOX_CFG_WEIGHT=0.5       # try 0.0 if French lines take on an English accent
CHATTERBOX_EXAGGERATION=0.5     # expressiveness
```

Chatterbox returns WAV audio and adds an inaudible watermark to everything it
generates.
