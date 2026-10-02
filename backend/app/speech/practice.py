"""One pronunciation-practice attempt, the way the game asks for it.

The game sends the line the learner is practising and their recording. The
reference is made here, from the same voice the learner just heard (the cached
text-to-speech line), so nothing but the learner's audio travels with each
attempt. The answer says, per word, what may need practice; the similarity
number is for the game's practice loop only and is never shown to learners.
"""

import importlib.util
import io
import re
import tempfile
import wave
from collections.abc import Callable
from pathlib import Path

import numpy as np

from .. import config
from . import tts
from .audio import SAMPLE_RATE, AudioError, decode_audio

# A word below this share of matching sounds is marked as worth practising.
WORD_NEEDS_PRACTICE_BELOW = 0.80
MAX_PRACTICE_TEXT = 200

# Same tokenization as the evaluator (pronunciation.REFERENCE_WORD_PATTERN), kept
# here so working out excluded spans does not load the phoneme model.
_WORD = re.compile(r"[^\W_]+(?:['’][^\W_]+)*(?:-[^\W_]+(?:['’][^\W_]+)*)*", re.UNICODE)


def _words(text: str) -> list[str]:
    return [match.group(0).lower() for match in _WORD.finditer(text or "")]


def excluded_spans(text: str, excluded: list[str]) -> list[dict]:
    """Word-index spans for the parts of `text` that are not graded, such as the learner's name."""

    words = _words(text)
    spans = []
    for phrase in excluded:
        target = _words(phrase)
        if not target:
            continue
        for start in range(len(words) - len(target) + 1):
            if words[start:start + len(target)] == target:
                spans.append({"start": start, "end": start + len(target), "label": "excluded"})
    return spans


def available() -> bool:
    """Whether the pronunciation model can be loaded here at all."""
    return all(importlib.util.find_spec(name) is not None for name in ("torch", "transformers", "epitran"))


def _write_wav(samples: np.ndarray, path: Path) -> None:
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(SAMPLE_RATE)
        file.writeframes(pcm.tobytes())


def _default_evaluator():
    from .pronunciation import evaluate_pronunciation

    return evaluate_pronunciation


def evaluate_attempt(
    audio: bytes,
    text: str,
    language: str = "fr",
    speaker_id: str | None = None,
    excluded: list[str] | None = None,
    evaluate: Callable[..., dict] | None = None,
) -> dict:
    """Compare a learner's recording of `text` with the character's own voice saying it."""

    text = " ".join((text or "").split())
    if not text:
        raise ValueError("text is required.")
    if len(text) > MAX_PRACTICE_TEXT:
        raise ValueError("text must be at most {} characters.".format(MAX_PRACTICE_TEXT))
    if language not in config.speech_languages():
        raise ValueError('Unsupported languageCode "{}".'.format(language))
    if not audio:
        raise ValueError("audio is required.")
    if len(audio) > config.MAX_AUDIO_BYTES:
        raise ValueError("audio must be at most {} bytes".format(config.MAX_AUDIO_BYTES))

    learner = decode_audio(io.BytesIO(audio))
    if len(learner) == 0:
        raise AudioError("The recording is empty.")
    if len(learner) / SAMPLE_RATE > config.MAX_AUDIO_SECONDS:
        raise AudioError("The recording is too long.")
    # The reference is the line as the learner heard it, from the voice cache.
    reference = tts.synthesize_speech(text, language, speaker_id, "normal")
    reference_samples = decode_audio(io.BytesIO(reference.audio.content))

    evaluate = evaluate or _default_evaluator()
    with tempfile.TemporaryDirectory(prefix="practice-") as folder:
        reference_path = Path(folder) / "reference.wav"
        learner_path = Path(folder) / "learner.wav"
        _write_wav(reference_samples, reference_path)
        _write_wav(learner, learner_path)
        result = evaluate(
            reference_text=text,
            reference_audio_path=str(reference_path),
            learner_audio_path=str(learner_path),
            evaluation_exclusions=excluded_spans(text, excluded or []),
        )

    def word(entry: dict) -> dict:
        score = entry.get("score")
        scored = entry.get("scorable", True) and score is not None
        return {
            "index": entry.get("index"),
            "word": entry.get("word"),
            "scored": bool(scored),
            "needsPractice": bool(scored and score < WORD_NEEDS_PRACTICE_BELOW),
            "phoneticGuide": entry.get("phonetic_guide") or None,
        }

    weakest = result.get("weakest_word")
    return {
        # An engineering similarity for the practice loop, not a learner-facing score.
        "similarity": result.get("pronunciation_similarity"),
        "words": [word(entry) for entry in result.get("word_results") or []],
        "weakestWord": word(weakest) if weakest else None,
    }
