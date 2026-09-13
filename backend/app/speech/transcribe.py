"""French speech transcription."""

from .audio import load_audio
from .models import whisper


def transcribe_audio(path: str) -> str:
    """Transcribe French speech without translating it to English."""

    audio, sample_rate = load_audio(path)

    result = whisper(
        {
            "array": audio,
            "sampling_rate": sample_rate,
        },
        generate_kwargs={
            "language": "french",
            "task": "transcribe",
        },
    )

    transcript = result["text"].strip()
    if not transcript:
        raise ValueError("The audio did not produce a transcript.")

    return transcript
