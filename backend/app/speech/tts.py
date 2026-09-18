"""Provider-neutral text-to-speech boundary for the speech API."""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from dotenv import load_dotenv

# The local backend owns this configuration file. Environment variables that
# are already exported take precedence because load_dotenv does not override
# them by default.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class TTSConfigurationError(RuntimeError):
    """Raised when no usable synthesis provider has been configured."""


class TTSSynthesisError(RuntimeError):
    """Raised when a configured provider cannot synthesize the request."""


@dataclass(frozen=True)
class SynthesizedAudio:
    """Audio returned by a provider in a format the API can stream."""

    content: bytes
    media_type: str
    file_extension: str


class TTSProvider(Protocol):
    """Interface implemented by a concrete synthesis provider."""

    def synthesize(self, text: str, language: str) -> SynthesizedAudio: ...


class UnconfiguredTTSProvider:
    """Placeholder provider used until the app is configured for synthesis."""

    def synthesize(self, text: str, language: str) -> SynthesizedAudio:
        raise TTSConfigurationError(
            "Text-to-speech is not configured. Set "
            "LANGUAGE_APP_TTS_PROVIDER to a supported provider."
        )


class ElevenLabsTTSProvider:
    """ElevenLabs implementation of the provider-neutral TTS interface."""

    provider_name = "ElevenLabs"
    output_format = "mp3_44100_128"

    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        self.voice_id = os.getenv("ELEVENLABS_VOICE_ID", "").strip()
        self.model_id = os.getenv("ELEVENLABS_MODEL_ID", "").strip()

        missing = [
            name
            for name, value in (
                ("ELEVENLABS_API_KEY", self.api_key),
                ("ELEVENLABS_VOICE_ID", self.voice_id),
                ("ELEVENLABS_MODEL_ID", self.model_id),
            )
            if not value
        ]
        if missing:
            raise TTSConfigurationError(
                "ElevenLabs TTS is not fully configured. Missing: {}.".format(
                    ", ".join(missing)
                )
            )

        try:
            from elevenlabs.client import ElevenLabs
        except ImportError as exc:
            raise TTSConfigurationError(
                "The ElevenLabs SDK is not installed. Install the backend "
                "requirements before starting the speech service."
            ) from exc

        try:
            self.client = ElevenLabs(api_key=self.api_key)
        except Exception as exc:
            raise TTSSynthesisError(
                "Could not initialize the ElevenLabs speech provider."
            ) from exc

    @staticmethod
    def _collect_audio_bytes(audio) -> bytes:
        """Normalize SDK bytes or streamed byte chunks into one MP3 payload."""

        if isinstance(audio, (bytes, bytearray, memoryview)):
            return bytes(audio)

        try:
            return b"".join(bytes(chunk) for chunk in audio if chunk)
        except (TypeError, ValueError) as exc:
            raise TTSSynthesisError(
                "ElevenLabs returned an invalid audio response."
            ) from exc

    def synthesize(self, text: str, language: str) -> SynthesizedAudio:
        """Generate Sophie speech using the configured persistent voice."""

        try:
            audio = self.client.text_to_speech.convert(
                text=text,
                voice_id=self.voice_id,
                model_id=self.model_id,
                output_format=self.output_format,
            )
            print(f"ElevenLabs TTS response: {type(audio)}")
            audio_bytes = self._collect_audio_bytes(audio)
        except TTSSynthesisError:
            raise
        except Exception as exc:
            raise TTSSynthesisError("ElevenLabs speech synthesis failed.") from exc

        if not audio_bytes:
            raise TTSSynthesisError("ElevenLabs returned no audio.")

        return SynthesizedAudio(
            content=audio_bytes,
            media_type="audio/mpeg",
            file_extension=".mp3",
        )


def get_tts_provider() -> TTSProvider:
    """Return the provider selected by environment configuration.

    Provider-specific construction belongs here, rather than in the FastAPI
    route. The default is deliberately unavailable until a provider adapter
    and its configuration are supplied.
    """

    provider_name = os.getenv("LANGUAGE_APP_TTS_PROVIDER", "none").strip().lower()

    if provider_name in ("", "none", "unconfigured"):
        return UnconfiguredTTSProvider()

    if provider_name == "elevenlabs":
        return ElevenLabsTTSProvider()

    raise TTSConfigurationError(
        "Unsupported text-to-speech provider '{}'.".format(provider_name)
    )


def synthesize_speech(text: str, language: str = "fr") -> SynthesizedAudio:
    """Synthesize text through the configured provider boundary."""

    if not text or not text.strip():
        raise ValueError("text is required.")

    if not language or not language.strip():
        raise ValueError("language is required.")

    provider = get_tts_provider()
    print(f"Using TTS provider: {provider.__class__.__name__}")
    return provider.synthesize(text, language.strip().lower())
