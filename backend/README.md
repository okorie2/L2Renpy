## Install

From the repository root:

```bash
uv pip install --python backend/.venv/bin/python -r backend/requirements.txt
```

The speech models are downloaded by Transformers the first time the backend
starts, then reused for every request in that process.

The backend loads `backend/.env` at startup. Keep that file local and never
commit its secrets.

## Start the API

From the repository root:

```bash
backend/.venv/bin/uvicorn app.main:app --app-dir backend --reload
```

Health check:

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

The transcription endpoint reuses the Whisper instance already loaded for
pronunciation evaluation. It returns a compact response containing
`transcript` and the normalized language code.

## Text-to-speech boundary

The backend also exposes a provider-neutral synthesis contract:

Set the existing local variables without putting their values in source code:

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
