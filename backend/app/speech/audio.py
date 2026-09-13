"""Audio loading and validation for speech inference."""

from pathlib import Path

import librosa
import numpy as np


SAMPLE_RATE = 16000


class AudioError(ValueError):
    """Raised when an uploaded audio file cannot be decoded or is empty."""


def load_audio(path: str | Path) -> tuple[np.ndarray, int]:
    """Load audio as mono 16 kHz samples using the prototype's loader."""

    try:
        audio, sample_rate = librosa.load(
            str(path),
            sr=SAMPLE_RATE,
            mono=True,
        )
    except Exception as exc:
        raise AudioError("The audio file could not be decoded.") from exc

    if audio.size == 0:
        raise AudioError("The audio file is empty.")

    if not np.isfinite(audio).all():
        raise AudioError("The audio file contains invalid sample values.")

    return audio, sample_rate
