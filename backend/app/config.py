"""Settings shared by every part of the backend.

Values come from the environment, with ``backend/.env`` loaded first (variables
already exported take precedence). Every value has a development default, so no
``.env`` is needed to start. Settings are read on each call, so tests can patch
the environment.
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

# Who may call the API from a web view: the development page, and the installed
# app, whose pages are served from these fixed local origins on iOS and Android.
DEFAULT_ORIGINS = "http://localhost:5173,capacitor://localhost,https://localhost,http://localhost"

# A learner's answer is one short sentence: a few seconds of compressed audio.
MAX_AUDIO_BYTES = 3 * 1024 * 1024
MAX_AUDIO_SECONDS = 20.0
# Longest line the game may ask to have spoken.
MAX_SPEECH_TEXT = 300


def _list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


def _json(name: str, default):
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{name} must be valid JSON") from exc


def cors_origins() -> list[str]:
    return _list("CORS_ORIGINS", DEFAULT_ORIGINS)


def speech_languages() -> list[str]:
    """Languages learners may speak and characters may be voiced in."""
    return _list("SPEECH_LANGUAGES", "fr")


def voice_languages() -> list[str]:
    """Languages characters may be voiced in: the target languages, plus the
    learner's own language for lines such as Sophie's welcome (VOICE_LANGUAGES)."""
    extra = _list("VOICE_LANGUAGES", "en")
    return list(dict.fromkeys(speech_languages() + extra))


def json_setting(name: str, default):
    return _json(name, default)
