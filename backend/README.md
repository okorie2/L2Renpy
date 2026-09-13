## Install

From the repository root:

```bash
uv pip install --python backend/.venv/bin/python -r backend/requirements.txt
```

The speech models are downloaded by Transformers the first time the backend
starts, then reused for every request in that process.

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
