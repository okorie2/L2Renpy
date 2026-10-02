"""Text-to-speech: providers, voices per character, and the cache.

The game sends what is said, the language, who says it (``speakerId``) and the
speed. Which vendor, model and voice speak it is decided here, and credentials
never leave the server. Every distinct line is generated once and then served
from the cache, together with its mouth timeline for lip sync.
"""

import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .. import config

logger = logging.getLogger(__name__)

RATES = ("normal", "slow")


class TTSConfigurationError(RuntimeError):
    """Raised when no usable synthesis provider or voice has been configured."""


class TTSSynthesisError(RuntimeError):
    """Raised when a configured provider cannot synthesize the request."""


@dataclass(frozen=True)
class SynthesizedAudio:
    """Audio returned by a provider in a format the API can stream."""

    content: bytes
    media_type: str
    file_extension: str


@dataclass(frozen=True)
class SpeechResult:
    """One voiced line as the API returns it."""

    audio: SynthesizedAudio
    mouth_timeline: str | None
    cache_key: str
    cached: bool


class TTSProvider(Protocol):
    """Interface implemented by every synthesis provider."""

    provider_name: str

    @property
    def cache_identity(self) -> str: ...

    def check(self) -> None:
        """Raise TTSConfigurationError when the provider cannot speak right now."""

    def voice_for(self, language: str, speaker_id: str | None) -> str: ...

    def synthesize(self, text: str, language: str, voice: str, rate: str) -> SynthesizedAudio: ...


def _speaker_voice(voices: dict, speaker_id: str | None) -> object | None:
    """A speaker's configured voice, or the default one. Unknown speakers are not an error."""

    if speaker_id and speaker_id in voices:
        return voices[speaker_id]
    return voices.get("default")


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------


class UnconfiguredTTSProvider:
    """Used until a provider is chosen. The game then runs silently."""

    provider_name = "none"
    cache_identity = "none"

    def check(self) -> None:
        raise TTSConfigurationError(
            "Text-to-speech is not configured. Set LANGUAGE_APP_TTS_PROVIDER."
        )

    def voice_for(self, language: str, speaker_id: str | None) -> str:
        self.check()
        return ""

    def synthesize(self, text: str, language: str, voice: str, rate: str) -> SynthesizedAudio:
        self.check()
        raise AssertionError("unreachable")


class ElevenLabsTTSProvider:
    """ElevenLabs voices: one per character, multilingual.

    ELEVENLABS_VOICES maps game speaker IDs to voice IDs, for example
    {"sophie": "<id>", "barista": "<id>", "default": "<id>"}. ELEVENLABS_VOICE_ID
    is the fallback for any speaker not listed (and was Sophie's voice in the
    Ren'Py version, so an existing .env keeps working).
    """

    provider_name = "elevenlabs"
    output_format = "mp3_44100_128"
    # ElevenLabs accepts speeds from 0.7 to 1.2.
    slow_speed = 0.8

    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        self.model_id = os.getenv("ELEVENLABS_MODEL_ID", "").strip()
        self.voices = dict(config.json_setting("ELEVENLABS_VOICES", {}))
        fallback = os.getenv("ELEVENLABS_VOICE_ID", "").strip()
        if fallback and "default" not in self.voices:
            self.voices["default"] = fallback

        missing = [
            name
            for name, value in (
                ("ELEVENLABS_API_KEY", self.api_key),
                ("ELEVENLABS_MODEL_ID", self.model_id),
                ("ELEVENLABS_VOICE_ID or ELEVENLABS_VOICES", self.voices.get("default")),
            )
            if not value
        ]
        if missing:
            raise TTSConfigurationError(
                "ElevenLabs TTS is not fully configured. Missing: {}.".format(", ".join(missing))
            )

        try:
            from elevenlabs.client import ElevenLabs
        except ImportError as exc:
            raise TTSConfigurationError(
                "The ElevenLabs SDK is not installed. Install backend/requirements.txt."
            ) from exc

        try:
            self.client = ElevenLabs(api_key=self.api_key)
        except Exception as exc:
            raise TTSSynthesisError("Could not initialize the ElevenLabs speech provider.") from exc

    @property
    def cache_identity(self) -> str:
        # The voice ID is part of the cache key separately.
        return "elevenlabs:{}:{}".format(self.model_id, self.output_format)

    def check(self) -> None:
        return None

    def voice_for(self, language: str, speaker_id: str | None) -> str:
        voice = _speaker_voice(self.voices, speaker_id)
        if not isinstance(voice, str) or not voice:
            raise TTSConfigurationError("No ElevenLabs voice is configured.")
        return voice

    @staticmethod
    def _collect_audio_bytes(audio) -> bytes:
        """Normalize SDK bytes or streamed byte chunks into one MP3 payload."""

        if isinstance(audio, (bytes, bytearray, memoryview)):
            return bytes(audio)
        try:
            return b"".join(bytes(chunk) for chunk in audio if chunk)
        except (TypeError, ValueError) as exc:
            raise TTSSynthesisError("ElevenLabs returned an invalid audio response.") from exc

    def synthesize(self, text: str, language: str, voice: str, rate: str) -> SynthesizedAudio:
        options = {}
        if rate == "slow":
            from elevenlabs import VoiceSettings

            options["voice_settings"] = VoiceSettings(speed=self.slow_speed)
        try:
            audio = self.client.text_to_speech.convert(
                text=text,
                voice_id=voice,
                model_id=self.model_id,
                output_format=self.output_format,
                **options,
            )
            audio_bytes = self._collect_audio_bytes(audio)
        except TTSSynthesisError:
            raise
        except Exception as exc:
            raise TTSSynthesisError("ElevenLabs speech synthesis failed.") from exc

        if not audio_bytes:
            raise TTSSynthesisError("ElevenLabs returned no audio.")
        return SynthesizedAudio(content=audio_bytes, media_type="audio/mpeg", file_extension=".mp3")


# Development voices for macOS, best first. The plain names ship with macOS; the
# "Enhanced" and "Premium" ones are free downloads (System Settings →
# Accessibility → Spoken Content → Manage Voices) and are picked up automatically.
# Voices with a locale in brackets, such as "Flo (French (France))", are an old
# robotic synthesizer and are deliberately not used.
_FEMALE = ["Audrey (Premium)", "Audrey (Enhanced)", "Aurélie (Enhanced)", "Amélie (Premium)", "Amélie (Enhanced)", "Amélie"]
DEFAULT_SYSTEM_VOICES = {
    "fr": {
        "default": _FEMALE,
        "sophie": _FEMALE,
        "barista": ["Aurélie (Enhanced)", "Amélie (Enhanced)", "Amélie"],
        "baker": ["Thomas (Premium)", "Thomas (Enhanced)", "Thomas"],
        "neighbor": ["Jacques (Premium)", "Jacques (Enhanced)", "Jacques"],
    },
    # The learner's own language, for lines such as Sophie's welcome.
    "en": {
        "default": ["Samantha (Enhanced)", "Samantha"],
    },
}
_WORDS_PER_MINUTE = {"normal": 165, "slow": 115}
_SAY_VOICE_LINE = re.compile(r"^(.+?)\s+[a-z]{2}_[A-Z]{2}\s+#")


class SystemTTSProvider:
    """The voices built into macOS (``say``). Free, local, no key; development only.

    SYSTEM_VOICES overrides the voice table as JSON:
    {"<language>": {"<speakerId>": "<voice>" or ["<voice>", ...], "default": ...}}.
    A list is in order of preference; the first installed voice is used.
    """

    provider_name = "system"
    cache_identity = "system:macos-say"

    def __init__(self):
        self.voices = config.json_setting("SYSTEM_VOICES", DEFAULT_SYSTEM_VOICES)
        self._installed: set[str] | None = None

    def installed_voices(self) -> set[str]:
        if self._installed is None:
            if shutil.which("say") is None:
                raise TTSConfigurationError("The macOS 'say' command is not available on this machine.")
            output = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, check=True).stdout
            # Lines look like "Thomas              fr_FR    # Bonjour…".
            self._installed = {
                match.group(1)
                for match in (_SAY_VOICE_LINE.match(line) for line in output.splitlines())
                if match
            }
        return self._installed

    def check(self) -> None:
        for language in self.voices:
            self.voice_for(language, None)

    def voice_for(self, language: str, speaker_id: str | None) -> str:
        speakers = self.voices.get(language)
        if not speakers:
            raise TTSConfigurationError(f'No voices are configured for "{language}".')
        preferred = _speaker_voice(speakers, speaker_id)
        options = preferred if isinstance(preferred, list) else [preferred]
        installed = self.installed_voices()
        for option in options:
            if option in installed:
                return option
        if speaker_id:
            # A speaker whose voices are missing still gets the language's default.
            return self.voice_for(language, None)
        raise TTSConfigurationError(f"None of these voices is installed: {', '.join(map(str, options))}.")

    def synthesize(self, text: str, language: str, voice: str, rate: str) -> SynthesizedAudio:
        with tempfile.TemporaryDirectory(prefix="say-") as folder:
            path = Path(folder) / "line.wav"
            try:
                subprocess.run(
                    ["say", "-v", voice, "-r", str(_WORDS_PER_MINUTE[rate]), "-o", str(path),
                     "--data-format=LEI16@22050", "--", text],
                    check=True, capture_output=True, timeout=30,
                )
                content = path.read_bytes()
            except (OSError, subprocess.SubprocessError) as exc:
                raise TTSSynthesisError("The macOS voice could not speak the line.") from exc
        if not content:
            raise TTSSynthesisError("The macOS voice returned no audio.")
        return SynthesizedAudio(content=content, media_type="audio/wav", file_extension=".wav")


class ChatterboxTTSProvider:
    """A voice from the local Chatterbox service (backend/tts_service).

    Chatterbox runs as its own process because its pinned dependencies clash
    with the main backend. CHATTERBOX_URL points at it. It has one voice and
    one speed, so every character sounds the same.
    """

    provider_name = "chatterbox"

    def __init__(self):
        self.base_url = os.getenv("CHATTERBOX_URL", "http://127.0.0.1:8001").strip().rstrip("/")
        self.timeout = float(os.getenv("CHATTERBOX_TIMEOUT", "60"))

    @property
    def cache_identity(self) -> str:
        return "chatterbox:{}:{}:{}".format(
            os.getenv("CHATTERBOX_VOICE_PROMPT", ""),
            os.getenv("CHATTERBOX_CFG_WEIGHT", "0.5"),
            os.getenv("CHATTERBOX_EXAGGERATION", "0.5"),
        )

    def check(self) -> None:
        import urllib.request

        try:
            with urllib.request.urlopen(self.base_url + "/health", timeout=2):
                return None
        except Exception as exc:
            raise TTSConfigurationError(
                "The Chatterbox TTS service is not reachable at {}.".format(self.base_url)
            ) from exc

    def voice_for(self, language: str, speaker_id: str | None) -> str:
        return "chatterbox"

    def synthesize(self, text: str, language: str, voice: str, rate: str) -> SynthesizedAudio:
        import urllib.error
        import urllib.request

        request = urllib.request.Request(
            self.base_url + "/synthesize",
            data=json.dumps({"text": text, "language": language}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        not_reachable = "The Chatterbox TTS service is not reachable at {}. Start it (see backend/README.md).".format(self.base_url)
        too_slow = "Chatterbox did not finish within {:.0f} s (CHATTERBOX_TIMEOUT).".format(self.timeout)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                audio_bytes = response.read()
                media_type = response.headers.get("Content-Type", "audio/wav")
        except urllib.error.HTTPError as exc:
            raise TTSSynthesisError("Chatterbox could not synthesize the request ({}).".format(exc.code)) from exc
        except TimeoutError as exc:
            raise TTSSynthesisError(too_slow) from exc
        except urllib.error.URLError as exc:
            if isinstance(exc.reason, TimeoutError):
                raise TTSSynthesisError(too_slow) from exc
            raise TTSConfigurationError(not_reachable) from exc
        except OSError as exc:
            raise TTSConfigurationError(not_reachable) from exc

        if not audio_bytes:
            raise TTSSynthesisError("Chatterbox returned no audio.")
        return SynthesizedAudio(
            content=audio_bytes,
            media_type=media_type.split(";")[0].strip() or "audio/wav",
            file_extension=".wav",
        )


_PROVIDER_ENV = (
    "LANGUAGE_APP_TTS_PROVIDER", "ELEVENLABS_API_KEY", "ELEVENLABS_MODEL_ID", "ELEVENLABS_VOICE_ID",
    "ELEVENLABS_VOICES", "SYSTEM_VOICES", "CHATTERBOX_URL", "CHATTERBOX_TIMEOUT",
)
_provider_cache: dict[tuple, TTSProvider] = {}
_provider_lock = threading.Lock()


def provider_name() -> str:
    default = "system" if shutil.which("say") else "none"
    return os.getenv("LANGUAGE_APP_TTS_PROVIDER", default).strip().lower() or "none"


def get_tts_provider() -> TTSProvider:
    """The provider chosen by LANGUAGE_APP_TTS_PROVIDER, built once per configuration.

    "elevenlabs" (hosted), "system" (macOS voices; the default on a Mac),
    "chatterbox" (local service) or "none".
    """

    snapshot = tuple(os.getenv(name) for name in _PROVIDER_ENV) + (provider_name(),)
    with _provider_lock:
        cached = _provider_cache.get(snapshot)
        if cached is not None:
            return cached

        name = provider_name()
        if name in ("none", "unconfigured"):
            provider = UnconfiguredTTSProvider()
        elif name == "elevenlabs":
            provider = ElevenLabsTTSProvider()
        elif name == "system":
            provider = SystemTTSProvider()
        elif name == "chatterbox":
            provider = ChatterboxTTSProvider()
        else:
            raise TTSConfigurationError("Unsupported text-to-speech provider '{}'.".format(name))
        _provider_cache.clear()
        _provider_cache[snapshot] = provider
        return provider


# ---------------------------------------------------------------------------
# Readiness
# ---------------------------------------------------------------------------

_READY_CACHE_SECONDS = 5.0
_readiness: tuple[float, dict] | None = None


def tts_readiness(now: float | None = None) -> dict:
    """Whether lines can be voiced right now. Checked at most every few seconds."""

    global _readiness
    now = time.monotonic() if now is None else now
    if _readiness and now - _readiness[0] < _READY_CACHE_SECONDS:
        return _readiness[1]
    name = provider_name()
    try:
        get_tts_provider().check()
        result = {"ready": True, "provider": name}
    except Exception as exc:  # noqa: BLE001 - any failure means "not now", never a crash
        result = {"ready": False, "provider": name, "reason": str(exc)}
    _readiness = (now, result)
    return result


def reset_readiness() -> None:
    global _readiness
    _readiness = None


# ---------------------------------------------------------------------------
# Cache: each distinct line is generated (and paid for) once, then reused.
# Keyed by provider + model + voice + language + speed + exact text, so changing
# any of them never serves old audio. Delete the folder to clear it.
# LANGUAGE_APP_TTS_CACHE_DIR=off disables caching.
# ---------------------------------------------------------------------------

DEFAULT_TTS_CACHE_DIR = config.BACKEND_DIR / ".tts_cache"

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


def tts_cache_key(identity: str, voice: str, language: str, rate: str, text: str) -> str:
    """Stable name for one generated line. Fields are length-prefixed so distinct inputs never collide."""

    canonical = "|".join("{}:{}".format(len(part), part) for part in (identity, voice, language, rate, text))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _read_cached(cache_dir: Path, key: str) -> tuple[SynthesizedAudio, str | None] | None:
    try:
        meta = json.loads((cache_dir / (key + ".json")).read_text("utf-8"))
        extension = meta["extension"]
        content = (cache_dir / (key + extension)).read_bytes()
    except (OSError, ValueError, KeyError):
        return None
    if not content or extension not in _EXTENSION_MEDIA_TYPES:
        return None
    audio = SynthesizedAudio(content=content, media_type=_EXTENSION_MEDIA_TYPES[extension], file_extension=extension)
    return audio, meta.get("mouthTimeline")


def _write_cached(cache_dir: Path, key: str, audio: SynthesizedAudio, timeline: str | None) -> None:
    if audio.file_extension not in _EXTENSION_MEDIA_TYPES:
        return
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        # Audio first and metadata last, each through a rename, so a reader never
        # sees a half-written entry.
        audio_path = cache_dir / (key + audio.file_extension)
        temp = audio_path.with_suffix(audio_path.suffix + ".tmp")
        temp.write_bytes(audio.content)
        os.replace(temp, audio_path)
        meta_path = cache_dir / (key + ".json")
        temp = meta_path.with_suffix(".json.tmp")
        temp.write_text(json.dumps({"extension": audio.file_extension, "mouthTimeline": timeline}), "utf-8")
        os.replace(temp, meta_path)
    except OSError:
        logger.warning("Could not write a line to the speech cache", exc_info=True)


def _timeline(audio: SynthesizedAudio) -> str | None:
    """Lip-sync track for the line, or None (the game then uses a steady flap)."""

    try:
        from .lipsync import mouth_timeline_from_bytes

        return mouth_timeline_from_bytes(audio.content) or None
    except Exception:  # noqa: BLE001 - optional polish, never a failure
        logger.warning("Could not compute the mouth timeline", exc_info=True)
        return None


# Identical requests arriving together share one synthesis.
_key_locks: dict[str, threading.Lock] = {}
_key_locks_guard = threading.Lock()


def synthesize_speech(text: str, language: str = "fr", speaker_id: str | None = None, rate: str = "normal") -> SpeechResult:
    """Voice one line through the configured provider, using the cache."""

    text = (text or "").strip()
    if not text:
        raise ValueError("text is required.")
    if len(text) > config.MAX_SPEECH_TEXT:
        raise ValueError("text must be at most {} characters.".format(config.MAX_SPEECH_TEXT))
    language = (language or "").strip().lower()
    if language not in config.voice_languages():
        raise ValueError('Unsupported languageCode "{}".'.format(language))
    if rate not in RATES:
        raise ValueError('rate must be "normal" or "slow".')

    provider = get_tts_provider()
    voice = provider.voice_for(language, speaker_id)
    key = tts_cache_key(provider.cache_identity, voice, language, rate, text)
    cache_dir = _tts_cache_dir()

    with _key_locks_guard:
        lock = _key_locks.setdefault(key, threading.Lock())
    with lock:
        if cache_dir is not None:
            cached = _read_cached(cache_dir, key)
            if cached is not None:
                return SpeechResult(audio=cached[0], mouth_timeline=cached[1], cache_key=key, cached=True)

        started = time.perf_counter()
        audio = provider.synthesize(text, language, voice, rate)
        timeline = _timeline(audio)
        if cache_dir is not None:
            _write_cached(cache_dir, key, audio, timeline)
        # Log sizes and timings only.
        logger.info("Synthesized %d characters with %s in %.0f ms", len(text), provider.provider_name, (time.perf_counter() - started) * 1000)
    with _key_locks_guard:
        _key_locks.pop(key, None)
    return SpeechResult(audio=audio, mouth_timeline=timeline, cache_key=key, cached=False)
