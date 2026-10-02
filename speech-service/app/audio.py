"""Decode whatever a browser or phone recorded into what Whisper expects."""

import av
import numpy as np

SAMPLE_RATE = 16000


def decode_audio(path: str) -> np.ndarray:
    """Read any common audio container (WebM/Opus, MP4/AAC, WAV…) as 16 kHz mono float32."""
    resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
    chunks: list[np.ndarray] = []
    with av.open(path, mode="r") as container:
        for frame in container.decode(audio=0):
            for resampled in resampler.resample(frame):
                chunks.append(resampled.to_ndarray().reshape(-1))
        # Flush what the resampler is still holding.
        for resampled in resampler.resample(None):
            chunks.append(resampled.to_ndarray().reshape(-1))
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks).astype(np.float32) / 32768.0
