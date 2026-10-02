"""Speech and ML service. Called only by the application backend, never by the game client."""

import logging
import os
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile

from . import config
from .recognizer import AudioTooLong, Recognizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("speech")

recognizer = Recognizer()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Models load here, before the service accepts work.
    recognizer.warm_up()
    yield


app = FastAPI(title="Second Language speech service", lifespan=lifespan)


@app.get("/health")
def live():
    """Liveness: the process is up."""
    return {"status": "ok"}


@app.get("/health/ready")
def ready(response: Response):
    """Readiness: the model is loaded and warmed. 503 until then."""
    if not recognizer.ready:
        response.status_code = 503
        return {"status": "not-ready", "reason": recognizer.error, "model": config.WHISPER_MODEL}
    return {"status": "ready", "model": config.WHISPER_MODEL}


@app.post("/transcribe")
def transcribe(audio: UploadFile = File(...), language: str = Form(...)):
    """What was said in a short recording. Returns the words and whether any speech was found."""
    if language not in config.LANGUAGES:
        raise HTTPException(status_code=400, detail=f'unsupported language "{language}"')
    if not recognizer.ready:
        raise HTTPException(status_code=503, detail=f"speech recognition is not ready: {recognizer.error}")

    data = audio.file.read(config.MAX_AUDIO_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="audio is empty")
    if len(data) > config.MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail=f"audio is larger than {config.MAX_AUDIO_BYTES} bytes")

    # The decoder reads from a file; the recording is deleted as soon as it has been heard.
    handle, path = tempfile.mkstemp(suffix=".audio")
    try:
        with os.fdopen(handle, "wb") as file:
            file.write(data)
        result = recognizer.transcribe(path, language)
    except AudioTooLong as error:
        raise HTTPException(status_code=413, detail=str(error)) from error
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001 - undecodable audio is the caller's problem, not a crash
        logger.warning("Could not transcribe %d bytes: %s", len(data), error)
        raise HTTPException(status_code=422, detail="the audio could not be decoded") from error
    finally:
        os.unlink(path)

    logger.info("Transcribed %.1f s of audio in %d ms (speech: %s)", result.audio_seconds, result.processing_ms, result.speech_detected)
    return {
        "transcript": result.transcript,
        "speechDetected": result.speech_detected,
        "confidence": result.confidence,
        "language": language,
    }
