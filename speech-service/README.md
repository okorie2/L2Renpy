# Second Language speech service

Speech and ML work that fits Python better than Node. Today that is speech recognition with a local Whisper model. Only the application backend (`../backend`) calls this service; the game client never does.

## Run

Uses [uv](https://docs.astral.sh/uv/) and Python 3.12.

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

The model downloads on first start and is cached by Hugging Face afterwards. The service is ready when the log says `Whisper … ready`.

```bash
uv pip install --python .venv/bin/python -r requirements-dev.txt
.venv/bin/python -m pytest
```

The tests run against the real model and use the macOS `say` command to make speech.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness. |
| GET | `/health/ready` | Readiness: the model is loaded and warmed. `503` until then. |
| POST | `/transcribe` | Multipart `audio` and `language`. Returns `transcript`, `speechDetected`, `confidence`, `language`. |

`/transcribe` accepts what browsers and phones record (WebM/Opus, MP4/AAC, WAV). The recording is written to a temporary file for decoding and deleted straight away. Limits: 3 MB and 20 seconds, because an answer is one short sentence.

This service answers only "what was said". Whether it communicated the intent is judged by the game's dialogue engine, and pronunciation is a separate, later analysis.

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `WHISPER_MODEL` | `small` | `small` is quick on a laptop CPU (about 1 s per answer on an M-series Mac). `large-v3-turbo` copes better with learner accents and needs about 1.6 GB. |
| `WHISPER_DEVICE` | `auto` | GPU when available, otherwise CPU. |
| `WHISPER_COMPUTE_TYPE` | `int8` | Good on CPU. |
| `WHISPER_BEAM_SIZE` | `5` | `1` is fastest. |
| `SPEECH_LANGUAGES` | `fr,en` | Languages that may be transcribed. |
| `MAX_AUDIO_BYTES`, `MAX_AUDIO_SECONDS` | 3 MB, 20 | Upload limits. |

## Guarding against invented text

Whisper can produce words from silence or noise. The service removes silence before decoding (voice activity detection), drops segments the model itself marks as non-speech or low-confidence, and discards known subtitle-credit phrases. Anything left empty is reported as `speechDetected: false`, and the game asks the learner to try again.

## Model warmup

The model is loaded and run once on silence at startup, before the service accepts work, so the first learner does not wait for it. If loading fails the service stays up and `/health/ready` explains why.

## Not here yet

Pronunciation analysis (phoneme-level comparison) and any text-to-speech model. Voices are still produced by the backend's provider.
