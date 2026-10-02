"""The Second Language backend: one FastAPI service the game talks to.

It voices character lines, turns spoken answers into words, gives a second
opinion on answers the game's rules do not recognise, and evaluates
pronunciation. The game never needs it: without it the game is silent and
typed, and otherwise the same. Progress and saves never leave the device.

Run (from backend/):  .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 3000
"""

import json
import logging
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config
from .conversation.service import ConversationService, TurnError
from .speech import practice
from .speech import transcribe as stt
from .speech import tts
from .speech.audio import AudioError
from .speech.lipsync import FRAMES_PER_SECOND

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("backend")

conversation = ConversationService()
_pronunciation = {"loaded": False, "reason": "loading"}


def _load_pronunciation() -> None:
    """Import the pronunciation evaluator, which loads the phoneme model (~400 MB)."""

    try:
        from .speech import pronunciation  # noqa: F401

        _pronunciation.update(loaded=True, reason=None)
        logger.info("Pronunciation model ready")
    except Exception as exc:  # noqa: BLE001
        _pronunciation.update(loaded=False, reason=str(exc))
        logger.error("Pronunciation model could not be loaded: %s", exc)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Load the speech-to-text model in the background, so the server answers
    # straight away and the first recording isn't slowed down by loading it.
    threading.Thread(target=stt.warm_up, daemon=True).start()
    # The game practises pronunciation in its opening, so the phoneme model is
    # loaded up front. PRONUNCIATION_PRELOAD=false loads it on first use instead.
    if not practice.available():
        _pronunciation.update(loaded=False, reason="torch, transformers or epitran is not installed")
    elif os.getenv("PRONUNCIATION_PRELOAD", "true").strip().lower() not in ("0", "false", "no"):
        threading.Thread(target=_load_pronunciation, daemon=True).start()
    else:
        _pronunciation.update(reason="loads on first use")
    status = tts.tts_readiness()
    if status["ready"]:
        logger.info("Text-to-speech ready (%s)", status["provider"])
    else:
        logger.warning("Text-to-speech is not ready: %s", status.get("reason"))
    yield


app = FastAPI(title="Second Language backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    # The client reads the lip-sync track and cache status from these.
    expose_headers=["X-Speech-Cache", "X-Speech-Key", "X-Mouth-Timeline", "X-Mouth-Fps"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health")
def live() -> dict:
    """Liveness: the process is up."""
    return {"status": "ok"}


@app.get("/health/ready")
def ready(response: Response) -> dict:
    """Readiness: lines can be voiced. 503 until then.

    Recognition, pronunciation and the AI layer are reported but optional:
    without them the game falls back to typing and its own rules.
    """

    speech = tts.tts_readiness()
    if not speech["ready"]:
        response.status_code = 503
    return {
        "status": "ready" if speech["ready"] else "not-ready",
        "speech": speech,
        "recognition": stt.stt_readiness(),
        "pronunciation": dict(_pronunciation),
        "conversation": {"ready": conversation.available()},
    }


# ---------------------------------------------------------------------------
# Speech
# ---------------------------------------------------------------------------


@app.get("/speech/capabilities")
def speech_capabilities() -> dict:
    """What the game can use right now, so it offers the microphone only when it will work."""
    return {
        "synthesis": tts.tts_readiness()["ready"],
        "recognition": stt.stt_readiness()["ready"],
        # Practice also needs a voice: the reference is the character saying the line.
        "pronunciation": practice.available() and tts.tts_readiness()["ready"],
    }


class SynthesizeRequest(BaseModel):
    """What is said and who says it. Vendor, model, voice and credentials are the server's business."""

    text: str
    languageCode: str = "fr"
    speakerId: str | None = None
    rate: str = "normal"


@app.post("/speech/synthesize")
def synthesize(request: SynthesizeRequest) -> Response:
    """Voice one line. Returns the audio, with a mouth timeline for lip sync in the headers."""

    try:
        result = tts.synthesize_speech(request.text, request.languageCode, request.speakerId, request.rate)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except tts.TTSConfigurationError as exc:
        tts.reset_readiness()
        logger.warning("Speech synthesis is unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except tts.TTSSynthesisError as exc:
        logger.error("Speech synthesis failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    headers = {
        "Cache-Control": "no-store",
        "X-Speech-Cache": "hit" if result.cached else "miss",
        "X-Speech-Key": result.cache_key,
    }
    if result.mouth_timeline:
        headers["X-Mouth-Timeline"] = result.mouth_timeline
        headers["X-Mouth-Fps"] = str(FRAMES_PER_SECOND)
    return Response(content=result.audio.content, media_type=result.audio.media_type, headers=headers)


@app.post("/speech/transcribe")
def transcribe(
    response: Response,
    audio: UploadFile | None = File(None),
    languageCode: str = Form("fr"),
) -> dict:
    """The words in one short recording. The recording is used for this answer and not kept."""

    response.headers["Cache-Control"] = "no-store"
    if audio is None:
        raise HTTPException(status_code=400, detail="audio is required.")
    data = audio.file.read(config.MAX_AUDIO_BYTES + 1)
    if len(data) > config.MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio must be at most {} bytes".format(config.MAX_AUDIO_BYTES))
    try:
        result = stt.transcribe_audio(data, languageCode)
    except stt.AudioTooLong as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except AudioError as exc:
        raise HTTPException(status_code=422, detail="the audio could not be decoded") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except stt.STTConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except stt.STTProviderError as exc:
        logger.error("Speech recognition failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # Log sizes only; never what the learner said.
    logger.info("Recognised %d bytes (speech: %s)", len(data), result.speech_detected)
    return {
        "transcript": result.transcript,
        "speechDetected": result.speech_detected,
        "confidence": result.confidence,
        "language": stt.normalize_language(languageCode),
    }


@app.post("/speech/practice")
def practice_attempt(
    response: Response,
    audio: UploadFile | None = File(None),
    text: str = Form(""),
    languageCode: str = Form("fr"),
    speakerId: str | None = Form(None),
    excluded: str = Form("[]"),
) -> dict:
    """One pronunciation-practice attempt: the learner's recording of `text`,
    compared with the character's own voice saying it. Returns which words may
    need practice. Pronunciation never decides game progress.
    """

    response.headers["Cache-Control"] = "no-store"
    if audio is None:
        raise HTTPException(status_code=400, detail="audio is required.")
    try:
        excluded_words = json.loads(excluded or "[]")
        if not isinstance(excluded_words, list) or not all(isinstance(item, str) for item in excluded_words):
            raise ValueError
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="excluded must be a JSON list of words.") from exc
    if not practice.available():
        raise HTTPException(status_code=503, detail="Pronunciation practice is not installed on this server.")

    data = audio.file.read(config.MAX_AUDIO_BYTES + 1)
    if len(data) > config.MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio must be at most {} bytes".format(config.MAX_AUDIO_BYTES))
    try:
        result = practice.evaluate_attempt(data, text, languageCode, speakerId, excluded_words)
        _pronunciation.update(loaded=True, reason=None)
        return result
    except AudioError as exc:
        raise HTTPException(status_code=422, detail="the audio could not be decoded") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except tts.TTSConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except tts.TTSSynthesisError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ImportError as exc:
        _pronunciation.update(loaded=False, reason=str(exc))
        raise HTTPException(status_code=503, detail="Pronunciation practice is not available.") from exc
    except Exception as exc:
        logger.exception("Pronunciation practice failed")
        raise HTTPException(status_code=500, detail="Pronunciation practice failed.") from exc


def _parse_evaluation_exclusions(raw_exclusions: str) -> list[dict]:
    """Parse optional pronunciation metadata from its multipart form field."""

    try:
        exclusions = json.loads(raw_exclusions or "[]")
    except json.JSONDecodeError as exc:
        raise ValueError("evaluation_exclusions must be valid JSON.") from exc
    if not isinstance(exclusions, list):
        raise ValueError("evaluation_exclusions must be a JSON list.")
    return exclusions


def _save_upload(upload: UploadFile, destination: Path) -> None:
    data = upload.file.read(config.MAX_AUDIO_BYTES + 1)
    if not data:
        raise AudioError("The uploaded audio file is empty.")
    if len(data) > config.MAX_AUDIO_BYTES:
        raise AudioError("The uploaded audio file is too large.")
    destination.write_bytes(data)


@app.post("/speech/pronunciation")
def pronunciation(
    reference_text: str = Form(...),
    evaluation_exclusions: str = Form("[]"),
    reference_audio: UploadFile | None = File(None),
    learner_audio: UploadFile | None = File(None),
) -> dict:
    """Evaluate a learner recording against reference audio and text.

    Carried over from the Ren'Py version, where the game uploaded the reference
    with every attempt. The game does not call it yet; the planned shape is an
    exercise ID plus the learner's audio (docs/SPEECH-SYSTEM.md).
    """

    if not reference_text.strip():
        raise HTTPException(status_code=400, detail="reference_text is required.")
    if reference_audio is None or learner_audio is None:
        raise HTTPException(status_code=400, detail="reference_audio and learner_audio are required.")
    try:
        exclusions = _parse_evaluation_exclusions(evaluation_exclusions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        from .speech.pronunciation import evaluate_pronunciation

        _pronunciation.update(loaded=True, reason=None)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Pronunciation model could not be loaded")
        raise HTTPException(status_code=503, detail="Pronunciation evaluation is not available.") from exc

    try:
        with TemporaryDirectory(prefix="pronunciation-") as temp_dir:
            reference_path = Path(temp_dir) / "reference_audio"
            learner_path = Path(temp_dir) / "learner_audio"
            _save_upload(reference_audio, reference_path)
            _save_upload(learner_audio, learner_path)
            return evaluate_pronunciation(
                reference_text=reference_text,
                reference_audio_path=str(reference_path),
                learner_audio_path=str(learner_path),
                evaluation_exclusions=exclusions,
            )
    except AudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid audio input.") from exc
    except Exception as exc:
        logger.exception("Pronunciation inference failed")
        raise HTTPException(status_code=500, detail="Pronunciation inference failed.") from exc


# ---------------------------------------------------------------------------
# Text
# ---------------------------------------------------------------------------


class ExtractNameRequest(BaseModel):
    """An answer to "What's your name?", typed or transcribed."""

    text: str


@app.post("/text/extract-name")
def extract_name(request: ExtractNameRequest) -> dict:
    """Find a person's name in free text: {"name": "<name>"} or {"name": null}.

    Carried over from the Ren'Py version; the game uses its own rules today.
    """

    if not request.text.strip():
        raise HTTPException(status_code=400, detail="text is required.")
    try:
        from .text.names import extract_person_name

        return {"name": extract_person_name(request.text)}
    except Exception as exc:
        logger.exception("Name extraction failed")
        raise HTTPException(status_code=500, detail="Name extraction failed.") from exc


# ---------------------------------------------------------------------------
# AI conversation layer
# ---------------------------------------------------------------------------


@app.get("/conversation/capabilities")
def conversation_capabilities() -> dict:
    return {"judgement": conversation.available()}


@app.post("/conversation/turn")
async def conversation_turn(request: Request) -> dict:
    """A second opinion on one learner turn: which expected intent, if any, came
    across, and what the character might say when it did not. The game's own
    rules decide what happens next.
    """

    try:
        body = await request.json()
    except ValueError:
        body = None  # rejected as a bad request below
    try:
        return await run_in_threadpool(conversation.judge_turn, body)
    except TurnError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc
