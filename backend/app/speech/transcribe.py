"""Provider-neutral speech-to-text boundary for learner recordings."""

import logging
import os
from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


# Keep the backend's existing local configuration convention. Exported
# environment variables take precedence because load_dotenv does not override
# them by default.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


logger = logging.getLogger(__name__)


LANGUAGE_CODES = {
    "en": "en",
    "english": "en",
    "fr": "fr",
    "french": "fr",
}


class STTConfigurationError(RuntimeError):
    """Raised when the speech-to-text provider is not configured."""


class STTProviderError(RuntimeError):
    """Raised when the speech-to-text provider cannot process a request."""


class STTTranscriptionError(ValueError):
    """Raised when a recording produces no usable transcript."""


def normalize_language(language: str) -> str:
    """Return the application's normalized language code."""

    code = language.strip().lower()
    try:
        return LANGUAGE_CODES[code]
    except KeyError as exc:
        raise ValueError("Unsupported transcription language.") from exc


class ElevenLabsSTTProvider:
    """ElevenLabs Scribe v2 implementation of the STT boundary."""

    model_id = "scribe_v2"

    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        if not self.api_key:
            raise STTConfigurationError(
                "Speech-to-text is not configured. Set ELEVENLABS_API_KEY."
            )

        try:
            from elevenlabs.client import ElevenLabs
        except ImportError as exc:
            raise STTConfigurationError(
                "The ElevenLabs SDK is not installed. Install the backend "
                "requirements before starting the speech service."
            ) from exc

        try:
            self.client = ElevenLabs(api_key=self.api_key)
        except Exception as exc:
            raise STTProviderError(
                "Could not initialize the ElevenLabs speech-to-text provider."
            ) from exc

    @staticmethod
    def _response_text(response) -> str:
        """Extract the plain transcript returned by Scribe."""

        if isinstance(response, Mapping):
            text = response.get("text", "")
        else:
            text = getattr(response, "text", "")

        if not isinstance(text, str):
            return ""
        return text.strip()

    def transcribe(self, path: str | Path, language: str) -> str:
        """Transcribe one recording with ElevenLabs Scribe v2."""

        audio_path = Path(path)
        try:
            if not audio_path.is_file() or audio_path.stat().st_size == 0:
                raise STTTranscriptionError("The audio file is empty or unavailable.")
        except OSError as exc:
            raise STTTranscriptionError(
                "The audio file could not be read."
            ) from exc

        try:
            with audio_path.open("rb") as audio_file:
                response = self.client.speech_to_text.convert(
                    file=audio_file,
                    model_id=self.model_id,
                    language_code=language,
                    tag_audio_events=False,
                    diarize=False,
                )
        except STTTranscriptionError:
            raise
        except Exception as exc:
            raise STTProviderError(
                "ElevenLabs speech-to-text failed."
            ) from exc

        transcript = self._response_text(response)
        if not transcript:
            raise STTTranscriptionError(
                "The audio did not produce a usable transcript."
            )

        return transcript


@lru_cache(maxsize=1)
def _load_whisper_model(model_name: str, device: str, compute_type: str):
    """Load a faster-whisper model once per process (it is large)."""

    from faster_whisper import WhisperModel

    return WhisperModel(model_name, device=device, compute_type=compute_type)


WHISPER_SAMPLE_RATE = 16000


def _load_audio_for_whisper(path: str):
    """Decode audio to 16 kHz mono float32 with librosa (already installed).

    faster-whisper's own decoder relies on PyAV, whose newer releases changed
    their API (faster-whisper 1.2.1 + av 19 fails with "unexpected keyword
    argument 'metadata_errors'"). Passing samples avoids that dependency.
    """

    import librosa

    samples, _ = librosa.load(path, sr=WHISPER_SAMPLE_RATE, mono=True)
    return samples


class FasterWhisperSTTProvider:
    """Local Whisper transcription through faster-whisper (no API costs).

    Settings: FASTER_WHISPER_MODEL (default large-v3-turbo),
    FASTER_WHISPER_DEVICE (default auto: CUDA if available, else CPU) and
    FASTER_WHISPER_COMPUTE_TYPE (default auto). The model downloads on first
    use and is then kept in memory.
    """

    def __init__(self):
        self.model_name = os.getenv("FASTER_WHISPER_MODEL", "large-v3-turbo").strip()
        self.device = os.getenv("FASTER_WHISPER_DEVICE", "auto").strip()
        self.compute_type = os.getenv("FASTER_WHISPER_COMPUTE_TYPE", "auto").strip()
        # 1 = greedy decoding: much faster on CPU and plenty for short clips.
        # Raise (e.g. 5) for a little more accuracy at the cost of speed.
        self.beam_size = int(os.getenv("FASTER_WHISPER_BEAM_SIZE", "1"))

        try:
            self.model = _load_whisper_model(
                self.model_name, self.device, self.compute_type
            )
        except ImportError as exc:
            raise STTConfigurationError(
                "faster-whisper is not installed. Install the backend "
                "requirements before starting the speech service."
            ) from exc
        except Exception as exc:
            logger.exception("Could not load faster-whisper model")
            raise STTProviderError(
                "Could not load the faster-whisper model '{}': {}".format(
                    self.model_name, exc
                )
            ) from exc

    def transcribe(self, path: str | Path, language: str) -> str:
        audio_path = Path(path)
        try:
            if not audio_path.is_file() or audio_path.stat().st_size == 0:
                raise STTTranscriptionError("The audio file is empty or unavailable.")
        except OSError as exc:
            raise STTTranscriptionError(
                "The audio file could not be read."
            ) from exc

        import time

        started = time.perf_counter()
        try:
            samples = _load_audio_for_whisper(str(audio_path))
            segments, _info = self.model.transcribe(
                samples,
                language=language,
                task="transcribe",
                beam_size=self.beam_size,
                # Short learner clips: skip silence, don't carry context.
                vad_filter=True,
                condition_on_previous_text=False,
            )
            transcript = " ".join(segment.text.strip() for segment in segments)
        except Exception as exc:
            # Log the real cause; the API response only says it failed.
            logger.exception("faster-whisper transcription failed")
            raise STTProviderError(
                "faster-whisper transcription failed: {}".format(exc)
            ) from exc

        transcript = " ".join(transcript.split())
        print(
            "faster-whisper ({}): {:.1f} s of audio transcribed in {:.2f} s".format(
                self.model_name,
                len(samples) / WHISPER_SAMPLE_RATE,
                time.perf_counter() - started,
            )
        )
        if not transcript:
            raise STTTranscriptionError(
                "The audio did not produce a usable transcript."
            )

        return transcript


def preload_stt_model() -> None:
    """Load the local Whisper model at startup instead of on the first request."""

    provider_name = os.getenv("LANGUAGE_APP_STT_PROVIDER", "elevenlabs").strip().lower()
    if provider_name not in ("faster-whisper", "faster_whisper", "whisper"):
        return
    try:
        FasterWhisperSTTProvider()
        print("faster-whisper model loaded")
    except Exception:
        logger.exception("Could not preload the faster-whisper model")


def get_stt_provider():
    """Return the provider chosen by LANGUAGE_APP_STT_PROVIDER.

    "faster-whisper" runs locally; "elevenlabs" (the default, for backwards
    compatibility) uses the ElevenLabs Scribe API.
    """

    provider_name = (
        os.getenv("LANGUAGE_APP_STT_PROVIDER", "elevenlabs").strip().lower()
    )

    if provider_name in ("faster-whisper", "faster_whisper", "whisper"):
        return FasterWhisperSTTProvider()

    if provider_name == "elevenlabs":
        return ElevenLabsSTTProvider()

    raise STTConfigurationError(
        "Unsupported speech-to-text provider '{}'.".format(provider_name)
    )


def transcribe_audio(path: str, language: str = "fr") -> str:
    """Transcribe speech without translating it to another language."""

    language_code = normalize_language(language)
    provider = get_stt_provider()
    return provider.transcribe(path, language_code)
