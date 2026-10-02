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


def decode_audio(source) -> np.ndarray:
    """Decode what a phone or browser recorded (WebM/Opus, MP4/AAC, MP3, WAV…).

    ``source`` is a path or a binary file object. Returns 16 kHz mono float32.
    PyAV is used instead of librosa here because librosa cannot open the MP4
    and WebM recordings that iOS and browsers produce without a system ffmpeg.
    """

    import av

    resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
    chunks: list[np.ndarray] = []
    try:
        with av.open(source, mode="r") as container:
            for frame in container.decode(audio=0):
                for resampled in resampler.resample(frame):
                    chunks.append(resampled.to_ndarray().reshape(-1))
            # Flush what the resampler is still holding.
            for resampled in resampler.resample(None):
                chunks.append(resampled.to_ndarray().reshape(-1))
    except Exception as exc:
        raise AudioError("The audio could not be decoded.") from exc
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks).astype(np.float32) / 32768.0
