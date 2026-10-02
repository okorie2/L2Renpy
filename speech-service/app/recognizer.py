"""Speech recognition with a local Whisper model.

The model is loaded and warmed once, at startup, so the first learner does not
wait for it. This module answers one question only: what was said. Whether that
communicated anything, and how it was pronounced, are decided elsewhere.
"""

import logging
import math
import threading
import time
from dataclasses import dataclass

import numpy as np
from faster_whisper import WhisperModel

from . import config
from .audio import SAMPLE_RATE, decode_audio

logger = logging.getLogger("speech.recognizer")

# Whisper invents these on silence or noise; they are never a learner's answer.
HALLUCINATION_MARKERS = ("sous-titres", "sous-titrage", "amara.org")
# Above this the model itself thinks the audio held no speech.
NO_SPEECH_PROBABILITY = 0.6
# Below this average log-probability the words are a guess.
MIN_AVERAGE_LOG_PROBABILITY = -1.0


@dataclass
class Transcription:
    transcript: str
    speech_detected: bool
    confidence: float | None
    audio_seconds: float
    processing_ms: int


class AudioTooLong(Exception):
    pass


class Recognizer:
    def __init__(self) -> None:
        self._model: WhisperModel | None = None
        self._lock = threading.Lock()
        self.error: str | None = "warming up"

    @property
    def ready(self) -> bool:
        return self._model is not None

    def warm_up(self) -> None:
        """Load the model and run it once on silence, so the first real request is fast."""
        started = time.monotonic()
        try:
            model = WhisperModel(config.WHISPER_MODEL, device=config.WHISPER_DEVICE, compute_type=config.WHISPER_COMPUTE_TYPE)
            segments, _ = model.transcribe(np.zeros(16000, dtype=np.float32), language="fr", beam_size=1)
            list(segments)
            self._model = model
            self.error = None
            logger.info("Whisper %s ready in %.1f s", config.WHISPER_MODEL, time.monotonic() - started)
        except Exception as error:  # noqa: BLE001 - any failure leaves the service up but not ready
            self.error = str(error)
            logger.error("Whisper %s could not be loaded: %s", config.WHISPER_MODEL, error)

    def transcribe(self, path: str, language: str) -> Transcription:
        if self._model is None:
            raise RuntimeError(self.error or "not ready")
        started = time.monotonic()
        samples = decode_audio(path)
        seconds = len(samples) / SAMPLE_RATE
        if seconds > config.MAX_AUDIO_SECONDS:
            raise AudioTooLong(f"audio is {seconds:.0f} s; the limit is {config.MAX_AUDIO_SECONDS:.0f} s")
        # One transcription at a time: answers are short and the model is not re-entrant-safe on every backend.
        with self._lock:
            segments, _ = self._model.transcribe(
                samples,
                language=language,
                beam_size=config.WHISPER_BEAM_SIZE,
                # Drop silence before decoding, which removes most invented text.
                vad_filter=True,
                condition_on_previous_text=False,
                without_timestamps=True,
            )
            kept = [
                segment
                for segment in segments
                if segment.no_speech_prob < NO_SPEECH_PROBABILITY and segment.avg_logprob > MIN_AVERAGE_LOG_PROBABILITY
            ]
        text = " ".join(segment.text.strip() for segment in kept).strip()
        if any(marker in text.lower() for marker in HALLUCINATION_MARKERS):
            text = ""
        confidence = None
        if kept and text:
            confidence = round(math.exp(sum(segment.avg_logprob for segment in kept) / len(kept)), 3)
        return Transcription(
            transcript=text,
            speech_detected=bool(text),
            confidence=confidence,
            audio_seconds=round(seconds, 2),
            processing_ms=int((time.monotonic() - started) * 1000),
        )
