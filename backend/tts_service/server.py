"""Chatterbox text-to-speech service for Sophie's voice.

Runs in its own virtualenv (see README) because Chatterbox pins library
versions that clash with the main backend. The main backend talks to it over
HTTP through ChatterboxTTSProvider (app/speech/tts.py).

Settings (environment variables or backend/.env):
  CHATTERBOX_VOICE_PROMPT  Path to a ~10 s reference recording of Sophie's
                           voice (WAV/MP3). Unset = Chatterbox's built-in voice.
  CHATTERBOX_DEVICE        auto (default), cuda, mps or cpu.
  CHATTERBOX_CFG_WEIGHT    Default 0.5. Lower (e.g. 0.0) if a French line picks
                           up the reference clip's English accent.
  CHATTERBOX_EXAGGERATION  Expressiveness, default 0.5.
"""

import io
import logging
import os
import threading
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

logger = logging.getLogger("chatterbox_service")

# Reuse the main backend's .env so all settings live in one file.
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:
    pass

VOICE_PROMPT = os.getenv("CHATTERBOX_VOICE_PROMPT", "").strip() or None
DEVICE = os.getenv("CHATTERBOX_DEVICE", "auto").strip().lower()
CFG_WEIGHT = float(os.getenv("CHATTERBOX_CFG_WEIGHT", "0.5"))
EXAGGERATION = float(os.getenv("CHATTERBOX_EXAGGERATION", "0.5"))

# Languages the app uses; Chatterbox itself supports 23.
SUPPORTED_LANGUAGES = {"en", "fr"}

# Generation isn't safe to run concurrently on one model; queue requests.
_generate_lock = threading.Lock()


def _pick_device() -> str:
    if DEVICE != "auto":
        return DEVICE

    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


@lru_cache(maxsize=1)
def get_model():
    """Load Chatterbox once and prepare Sophie's voice once."""

    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    device = _pick_device()
    logger.info("Loading Chatterbox Multilingual on %s", device)
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)

    if VOICE_PROMPT:
        if not Path(VOICE_PROMPT).is_file():
            raise RuntimeError(
                "CHATTERBOX_VOICE_PROMPT does not exist: {}".format(VOICE_PROMPT)
            )
        # Computing the voice conditioning is expensive; do it once rather
        # than passing audio_prompt_path on every request.
        model.prepare_conditionals(VOICE_PROMPT, exaggeration=EXAGGERATION)
        logger.info("Using voice prompt %s", VOICE_PROMPT)

    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load at startup so the first player request isn't slow.
    get_model()
    yield


app = FastAPI(title="Sophie TTS (Chatterbox)", lifespan=lifespan)


class SynthesizeRequest(BaseModel):
    text: str
    language: str = "fr"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/synthesize")
def synthesize(request: SynthesizeRequest) -> Response:
    text = request.text.strip()
    language = request.language.strip().lower()

    if not text:
        raise HTTPException(status_code=400, detail="text is required.")
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported language '{}'.".format(language),
        )

    try:
        import soundfile

        model = get_model()
        with _generate_lock:
            wav = model.generate(
                text,
                language_id=language,
                exaggeration=EXAGGERATION,
                cfg_weight=CFG_WEIGHT,
            )

        samples = wav.squeeze(0).detach().cpu().numpy()
        buffer = io.BytesIO()
        soundfile.write(buffer, samples, model.sr, format="WAV", subtype="PCM_16")
    except Exception as exc:
        logger.exception("Chatterbox synthesis failed")
        raise HTTPException(status_code=500, detail="Synthesis failed.") from exc

    return Response(content=buffer.getvalue(), media_type="audio/wav")
