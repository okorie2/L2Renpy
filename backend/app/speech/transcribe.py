"""Local Whisper transcription with a small language interface."""

from .audio import load_audio
from .models import whisper


LANGUAGE_NAMES = {
    "en": "english",
    "english": "english",
    "fr": "french",
    "french": "french",
}


def normalize_language(language: str) -> tuple[str, str]:
    """Return a supported language code and Whisper language name."""

    code = language.strip().lower()
    try:
        return ("en" if code in ("en", "english") else "fr", LANGUAGE_NAMES[code])
    except KeyError as exc:
        raise ValueError("Unsupported transcription language.") from exc


def transcribe_audio(path: str, language: str = "fr") -> str:
    """Transcribe speech without translating it to another language."""

    audio, sample_rate = load_audio(path)
    _, whisper_language = normalize_language(language)

    result = whisper(
        {
            "array": audio,
            "sampling_rate": sample_rate,
        },
        generate_kwargs={
            "language": whisper_language,
            "task": "transcribe",
        },
    )

    transcript = result["text"].strip()
    if not transcript:
        raise ValueError("The audio did not produce a transcript.")

    return transcript
