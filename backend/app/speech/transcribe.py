"""Provider-neutral speech-to-text boundary for learner recordings."""

import os
from collections.abc import Mapping
from pathlib import Path

from dotenv import load_dotenv


# Keep the backend's existing local configuration convention. Exported
# environment variables take precedence because load_dotenv does not override
# them by default.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


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


def transcribe_audio(path: str, language: str = "fr") -> str:
    """Transcribe speech without translating it to another language."""

    language_code = normalize_language(language)
    provider = ElevenLabsSTTProvider()
    return provider.transcribe(path, language_code)
