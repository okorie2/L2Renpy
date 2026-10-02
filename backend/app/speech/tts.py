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

    @property
    def cache_identity(self) -> str:
        # Changing the voice or model produces different audio, so it must
        # not reuse cached lines from the old one.
        return "elevenlabs:{}:{}:{}".format(
            self.voice_id, self.model_id, self.output_format
        )

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


class ChatterboxTTSProvider:
    """Sophie's voice from the local Chatterbox service (backend/tts_service).

    Chatterbox runs as its own process because its pinned dependencies clash
    with the main backend. CHATTERBOX_URL points at it.
    """

    provider_name = "Chatterbox"

    @property
    def cache_identity(self) -> str:
        return "chatterbox:{}:{}:{}".format(
            os.getenv("CHATTERBOX_VOICE_PROMPT", ""),
            os.getenv("CHATTERBOX_CFG_WEIGHT", "0.5"),
            os.getenv("CHATTERBOX_EXAGGERATION", "0.5"),
        )

    def __init__(self):
        self.base_url = (
            os.getenv("CHATTERBOX_URL", "http://127.0.0.1:8001").strip().rstrip("/")
        )
        self.timeout = float(os.getenv("CHATTERBOX_TIMEOUT", "60"))

    def synthesize(self, text: str, language: str) -> SynthesizedAudio:
        import json
        import urllib.error
        import urllib.request

        request = urllib.request.Request(
            self.base_url + "/synthesize",
            data=json.dumps({"text": text, "language": language}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                audio_bytes = response.read()
                media_type = response.headers.get("Content-Type", "audio/wav")
        except urllib.error.HTTPError as exc:
            raise TTSSynthesisError(
                "Chatterbox could not synthesize the request ({}).".format(exc.code)
            ) from exc
        except TimeoutError as exc:
            raise TTSSynthesisError(
                "Chatterbox did not finish within {:.0f} s (CHATTERBOX_TIMEOUT).".format(
                    self.timeout
                )
            ) from exc
        except urllib.error.URLError as exc:
            if isinstance(exc.reason, TimeoutError):
                raise TTSSynthesisError(
                    "Chatterbox did not finish within {:.0f} s (CHATTERBOX_TIMEOUT).".format(
                        self.timeout
                    )
                ) from exc
            raise TTSConfigurationError(
                "The Chatterbox TTS service is not reachable at {}. Start it "
                "(see backend/README.md).".format(self.base_url)
            ) from exc
        except OSError as exc:
            raise TTSConfigurationError(
                "The Chatterbox TTS service is not reachable at {}. Start it "
                "(see backend/README.md).".format(self.base_url)
            ) from exc

        if not audio_bytes:
            raise TTSSynthesisError("Chatterbox returned no audio.")

        return SynthesizedAudio(
            content=audio_bytes,
            media_type=media_type.split(";")[0].strip() or "audio/wav",
            file_extension=".wav",
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

    if provider_name == "chatterbox":
        return ChatterboxTTSProvider()

    raise TTSConfigurationError(
        "Unsupported text-to-speech provider '{}'.".format(provider_name)
    )


# ---------------------------------------------------------------------------
# Cache: each distinct line is generated (and paid for) once, then reused.
# Keyed by provider + voice/model settings + language + exact text, so
# changing the voice never serves old audio. Delete the folder to clear it.
# LANGUAGE_APP_TTS_CACHE_DIR=off disables caching.
# ---------------------------------------------------------------------------

DEFAULT_TTS_CACHE_DIR = Path(__file__).resolve().parents[2] / ".tts_cache"

_EXTENSION_MEDIA_TYPES = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
}


def _tts_cache_dir() -> Path | None:
    configured = os.getenv("LANGUAGE_APP_TTS_CACHE_DIR", "").strip()
    if configured.lower() in ("off", "none", "false", "0"):
        return None
    return Path(configured) if configured else DEFAULT_TTS_CACHE_DIR


def _tts_cache_key(provider: TTSProvider, text: str, language: str) -> str:
    import hashlib

    identity = getattr(provider, "cache_identity", provider.__class__.__name__)
    payload = "\n".join([identity, language, text]).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _read_cached_audio(cache_dir: Path, key: str) -> SynthesizedAudio | None:
    for extension, media_type in _EXTENSION_MEDIA_TYPES.items():
        path = cache_dir / (key + extension)
        try:
            content = path.read_bytes()
        except OSError:
            continue
        if content:
            return SynthesizedAudio(
                content=content,
                media_type=media_type,
                file_extension=extension,
            )
    return None


def _write_cached_audio(cache_dir: Path, key: str, audio: SynthesizedAudio) -> None:
    if audio.file_extension not in _EXTENSION_MEDIA_TYPES:
        return
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        final_path = cache_dir / (key + audio.file_extension)
        temp_path = final_path.with_suffix(final_path.suffix + ".tmp")
        temp_path.write_bytes(audio.content)
        os.replace(temp_path, final_path)  # never leave a half-written file
    except OSError:
        pass  # caching is best-effort; synthesis already succeeded


def synthesize_speech(text: str, language: str = "fr") -> SynthesizedAudio:
    """Synthesize text through the configured provider boundary."""

    if not text or not text.strip():
        raise ValueError("text is required.")

    if not language or not language.strip():
        raise ValueError("language is required.")

    language = language.strip().lower()
    provider = get_tts_provider()

    cache_dir = _tts_cache_dir()
    key = _tts_cache_key(provider, text, language) if cache_dir else None

    if cache_dir is not None:
        cached = _read_cached_audio(cache_dir, key)
        if cached is not None:
            print(f"TTS cache hit ({provider.__class__.__name__})")
            return cached

    print(f"Using TTS provider: {provider.__class__.__name__}")
    audio = provider.synthesize(text, language)

    if cache_dir is not None:
        _write_cached_audio(cache_dir, key, audio)

    return audio
