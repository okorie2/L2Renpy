"""FastAPI application for local pronunciation evaluation."""

import logging
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .speech.audio import AudioError
from .speech.pronunciation import evaluate_pronunciation


logger = logging.getLogger(__name__)
app = FastAPI(title="Language App Speech Backend")


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
