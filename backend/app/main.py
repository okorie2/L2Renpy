"""FastAPI application for local speech processing."""

import logging
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from .speech.audio import AudioError
from .speech.pronunciation import evaluate_pronunciation
from .speech.transcribe import normalize_language, transcribe_audio
from .speech.tts import TTSConfigurationError, TTSSynthesisError, synthesize_speech

logger = logging.getLogger(__name__)
app = FastAPI(title="Language App Speech Backend")


class SynthesizeRequest(BaseModel):
    """Provider-neutral request body for generated speech."""

    text: str
    language: str = "fr"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


async def _save_upload(upload: UploadFile, destination: Path) -> None:
    """Stream one uploaded file to a temporary path and reject empty files."""

    bytes_written = 0
    try:
        with destination.open("wb") as output:
            while chunk := await upload.read(1024 * 1024):
                output.write(chunk)
                bytes_written += len(chunk)
    finally:
        await upload.close()

    if bytes_written == 0:
        raise AudioError("The uploaded audio file is empty.")


# Evaluates pronunciation of learner speech against reference text and audio.
@app.post("/speech/pronunciation")
async def pronunciation(
    reference_text: str = Form(...),
    reference_audio: UploadFile | None = File(None),
    learner_audio: UploadFile | None = File(None),
) -> dict:
    """Evaluate an uploaded learner recording against reference audio/text.

    Temporary upload fields are an MVP API shape. A future exercise-ID API
    can resolve reference text/audio server-side and accept only learner audio.
    """

    if not reference_text.strip():
        raise HTTPException(status_code=400, detail="reference_text is required.")

    if reference_audio is None or learner_audio is None:
        raise HTTPException(
            status_code=400,
            detail="reference_audio and learner_audio are required.",
        )

    try:
        with TemporaryDirectory(prefix="pronunciation-") as temp_dir:
            temp_path = Path(temp_dir)
            reference_path = temp_path / "reference_audio"
            learner_path = temp_path / "learner_audio"

            await _save_upload(reference_audio, reference_path)
            await _save_upload(learner_audio, learner_path)

            return evaluate_pronunciation(
                reference_text=reference_text,
                reference_audio_path=str(reference_path),
                learner_audio_path=str(learner_path),
            )
    except AudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid audio input.") from exc
    except Exception as exc:
        logger.exception("Pronunciation inference failed")
        raise HTTPException(
            status_code=500,
            detail="Pronunciation inference failed.",
        ) from exc


# Transform speech to text from recorded audio
@app.post("/speech/transcribe")
async def transcribe(
    learner_audio: UploadFile | None = File(None),
    language: str = Form("en"),
) -> dict[str, str]:
    """Transcribe one learner recording with the already-loaded Whisper model."""

    if learner_audio is None:
        raise HTTPException(status_code=400, detail="learner_audio is required.")

    try:
        language_code, _ = normalize_language(language)
        print(f"Transcribing audio with language code: {language_code}")

        with TemporaryDirectory(prefix="speech-transcription-") as temp_dir:
            audio_path = Path(temp_dir) / "learner_audio"
            await _save_upload(learner_audio, audio_path)
            transcript = transcribe_audio(
                str(audio_path),
                language=language_code,
            )
        print(f"Transcription result: {transcript}")
        return {
            "transcript": transcript,
            "language": language_code,
        }
    except AudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Speech transcription failed")
        raise HTTPException(
            status_code=500,
            detail="Speech transcription failed.",
        ) from exc


# Text to speech synthesis with a POST request to /speech/synthesize with JSON body:
@app.post("/speech/synthesize")
async def synthesize(request: SynthesizeRequest) -> Response:
    """Return generated speech audio for one text/language request.

    The route deliberately returns audio bytes instead of a backend-local
    filesystem path. Provider selection and synthesis stay behind the speech
    service boundary.
    """

    if not request.text.strip():
        raise HTTPException(status_code=400, detail="text is required.")

    if not request.language.strip():
        raise HTTPException(status_code=400, detail="language is required.")

    try:
        audio = synthesize_speech(
            text=request.text,
            language=request.language,
        )

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TTSConfigurationError as exc:
        logger.warning("Speech synthesis is unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TTSSynthesisError as exc:
        logger.error("Configured speech synthesis provider failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Speech synthesis failed")
        raise HTTPException(
            status_code=500,
            detail="Speech synthesis failed.",
        ) from exc

    return Response(
        content=audio.content,
        media_type=audio.media_type,
        headers={
            "Content-Disposition": (
                'inline; filename="sophie-introduction{}"'.format(audio.file_extension)
            )
        },
    )
