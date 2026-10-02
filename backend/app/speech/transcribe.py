"""Speech-to-text for learner answers, behind one provider-neutral boundary.

This module answers one question: what was said. Whether that communicated
anything is decided by the game's dialogue engine, and how it was pronounced
by the pronunciation evaluator.
"""

import io
import logging
import math
import os
import threading
import time
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache

from .. import config
from .audio import SAMPLE_RATE, decode_audio

logger = logging.getLogger(__name__)


LANGUAGE_CODES = {
    "en": "en",
    "english": "en",
    "fr": "fr",
    "french": "fr",
}

# Whisper invents these on silence or noise; they are never a learner's answer.
HALLUCINATION_MARKERS = ("sous-titres", "sous-titrage", "amara.org")
# Above this the model itself thinks a segment held no speech.
NO_SPEECH_PROBABILITY = 0.6
# Below this average log-probability the words are a guess.
MIN_AVERAGE_LOG_PROBABILITY = -1.0


class STTConfigurationError(RuntimeError):
    """Raised when the speech-to-text provider is not configured or not ready."""


class STTProviderError(RuntimeError):
    """Raised when the speech-to-text provider cannot process a request."""


class AudioTooLong(ValueError):
    """Raised when a recording is longer than one answer can be."""


@dataclass(frozen=True)
class Transcription:
    transcript: str
    speech_detected: bool
    confidence: float | None


def normalize_language(language: str) -> str:
    """Return the application's normalized language code."""

    code = (language or "").strip().lower()
    try:
        return LANGUAGE_CODES[code]
    except KeyError as exc:
        raise ValueError("Unsupported transcription language.") from exc


def _no_speech() -> Transcription:
    return Transcription(transcript="", speech_detected=False, confidence=None)


class ElevenLabsSTTProvider:
    """ElevenLabs Scribe v2 (hosted; needs ELEVENLABS_API_KEY)."""

    provider_name = "elevenlabs"
    model_id = "scribe_v2"

    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        if not self.api_key:
            raise STTConfigurationError("Speech-to-text is not configured. Set ELEVENLABS_API_KEY.")
        try:
            from elevenlabs.client import ElevenLabs
        except ImportError as exc:
            raise STTConfigurationError(
                "The ElevenLabs SDK is not installed. Install backend/requirements.txt."
            ) from exc
        try:
            self.client = ElevenLabs(api_key=self.api_key)
        except Exception as exc:
            raise STTProviderError("Could not initialize the ElevenLabs speech-to-text provider.") from exc

    def ready(self) -> bool:
        return True

    @staticmethod
    def _response_text(response) -> str:
        text = response.get("text", "") if isinstance(response, Mapping) else getattr(response, "text", "")
        return text.strip() if isinstance(text, str) else ""

    def transcribe(self, audio: bytes, language: str) -> Transcription:
        try:
            response = self.client.speech_to_text.convert(
                file=io.BytesIO(audio),
                model_id=self.model_id,
                language_code=language,
                tag_audio_events=False,
                diarize=False,
            )
        except Exception as exc:
            raise STTProviderError("ElevenLabs speech-to-text failed.") from exc

        transcript = " ".join(self._response_text(response).split())
        if not transcript:
            return _no_speech()
        return Transcription(transcript=transcript, speech_detected=True, confidence=None)


@lru_cache(maxsize=1)
def _load_whisper_model(model_name: str, device: str, compute_type: str):
    """Load a faster-whisper model once per process (it is large)."""

    from faster_whisper import WhisperModel

    return WhisperModel(model_name, device=device, compute_type=compute_type)


class FasterWhisperSTTProvider:
    """Local Whisper through faster-whisper: no API costs, nothing leaves the Mac.

    Settings: FASTER_WHISPER_MODEL (default large-v3-turbo; "small" is quicker
    on a laptop CPU but hears accents less well), FASTER_WHISPER_DEVICE (default
    auto: CUDA if available, else CPU), FASTER_WHISPER_COMPUTE_TYPE (default
    auto) and FASTER_WHISPER_BEAM_SIZE (default 1). The model downloads on first
    start and is then kept in memory.
    """

    provider_name = "faster-whisper"

    def __init__(self):
        self.model_name = os.getenv("FASTER_WHISPER_MODEL", "large-v3-turbo").strip()
        self.device = os.getenv("FASTER_WHISPER_DEVICE", "auto").strip()
        self.compute_type = os.getenv("FASTER_WHISPER_COMPUTE_TYPE", "auto").strip()
        # 1 = greedy decoding: much faster on CPU and plenty for short clips.
        self.beam_size = int(os.getenv("FASTER_WHISPER_BEAM_SIZE", "1"))
        self._lock = threading.Lock()

        try:
            self.model = _load_whisper_model(self.model_name, self.device, self.compute_type)
        except ImportError as exc:
            raise STTConfigurationError(
                "faster-whisper is not installed. Install backend/requirements.txt."
            ) from exc
        except Exception as exc:
            logger.exception("Could not load faster-whisper model")
            raise STTProviderError(
                "Could not load the faster-whisper model '{}': {}".format(self.model_name, exc)
            ) from exc

    def ready(self) -> bool:
        return True

    def transcribe(self, audio: bytes, language: str) -> Transcription:
        started = time.perf_counter()
        samples = decode_audio(io.BytesIO(audio))
        seconds = len(samples) / SAMPLE_RATE
        if seconds > config.MAX_AUDIO_SECONDS:
            raise AudioTooLong(
                "audio is {:.0f} s; the limit is {:.0f} s".format(seconds, config.MAX_AUDIO_SECONDS)
            )
        if seconds == 0:
            return _no_speech()

        try:
            # One transcription at a time: answers are short and the model is
            # not safe to share between threads on every backend.
            with self._lock:
                segments, _info = self.model.transcribe(
                    samples,
                    language=language,
                    task="transcribe",
                    beam_size=self.beam_size,
                    # Short learner clips: skip silence (removes most invented
                    # text) and don't carry context between clips.
                    vad_filter=True,
                    condition_on_previous_text=False,
                    without_timestamps=True,
                )
                kept = [
                    segment
                    for segment in segments
                    if getattr(segment, "no_speech_prob", 0.0) < NO_SPEECH_PROBABILITY
                    and getattr(segment, "avg_logprob", 0.0) > MIN_AVERAGE_LOG_PROBABILITY
                ]
        except Exception as exc:
            logger.exception("faster-whisper transcription failed")
            raise STTProviderError("faster-whisper transcription failed: {}".format(exc)) from exc

        text = " ".join(" ".join(segment.text.strip() for segment in kept).split())
        if any(marker in text.lower() for marker in HALLUCINATION_MARKERS):
            text = ""
        # Log durations only; never what the learner said.
        logger.info(
            "faster-whisper (%s): %.1f s of audio in %.2f s",
            self.model_name, seconds, time.perf_counter() - started,
        )
        if not text:
            return _no_speech()
        confidence = round(math.exp(sum(getattr(s, "avg_logprob", 0.0) for s in kept) / len(kept)), 3)
        return Transcription(transcript=text, speech_detected=True, confidence=confidence)


def stt_provider_name() -> str:
    return os.getenv("LANGUAGE_APP_STT_PROVIDER", "faster-whisper").strip().lower()


def get_stt_provider():
    """The provider chosen by LANGUAGE_APP_STT_PROVIDER.

    "faster-whisper" (the default) runs locally; "elevenlabs" uses Scribe.
    """

    name = stt_provider_name()
    if name in ("faster-whisper", "faster_whisper", "whisper"):
        return FasterWhisperSTTProvider()
    if name == "elevenlabs":
        return ElevenLabsSTTProvider()
    if name in ("none", ""):
        raise STTConfigurationError("Speech-to-text is switched off (LANGUAGE_APP_STT_PROVIDER=none).")
    raise STTConfigurationError("Unsupported speech-to-text provider '{}'.".format(name))


# ---------------------------------------------------------------------------
# Startup and readiness. The local model is loaded and warmed in the
# background when the server starts, so the first learner does not wait for it.
# ---------------------------------------------------------------------------

_state = {"ready": False, "reason": "warming up"}


def warm_up() -> None:
    """Load the provider and, for a local model, run it once on silence."""

    started = time.monotonic()
    try:
        provider = get_stt_provider()
        if isinstance(provider, FasterWhisperSTTProvider):
            import numpy as np

            segments, _ = provider.model.transcribe(np.zeros(SAMPLE_RATE, dtype=np.float32), language="fr", beam_size=1)
            list(segments)
        _state.update(ready=True, reason=None)
        logger.info("Speech-to-text (%s) ready in %.1f s", stt_provider_name(), time.monotonic() - started)
    except Exception as exc:  # noqa: BLE001 - the backend stays up; the game falls back to typing
        _state.update(ready=False, reason=str(exc))
        logger.error("Speech-to-text is not ready: %s", exc)


def stt_readiness() -> dict:
    result = {"ready": bool(_state["ready"]), "provider": stt_provider_name()}
    if not result["ready"]:
        result["reason"] = _state["reason"]
    return result


def transcribe_audio(audio: bytes, language: str = "fr") -> Transcription:
    """Transcribe one recording in the given language (never translates)."""

    if not audio:
        raise ValueError("audio is required.")
    if len(audio) > config.MAX_AUDIO_BYTES:
        raise AudioTooLong("audio must be at most {} bytes".format(config.MAX_AUDIO_BYTES))
    language_code = normalize_language(language)
    if language_code not in config.speech_languages():
        raise ValueError('Unsupported languageCode "{}".'.format(language))
    if not _state["ready"]:
        raise STTConfigurationError("Speech recognition is not ready: {}".format(_state["reason"]))
    return get_stt_provider().transcribe(audio, language_code)
