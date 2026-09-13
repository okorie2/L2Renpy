"""Pronunciation evaluation based on the working local prototype."""

import re
import unicodedata
from difflib import SequenceMatcher

from .phonemize import phonemize_audio
from .transcribe import transcribe_audio


def normalize_text(text: str) -> str:
    text = text.lower().strip()

    # Keep French letters/apostrophes, remove punctuation that should not
    # affect sentence matching.
    text = re.sub(r"[^\w\s'àâäéèêëîïôöùûüÿçœ-]", "", text)
    text = re.sub(r"\s+", " ", text)

    return text


def normalize_phonemes(phonemes: str) -> str:
    """Remove spaces for the prototype's character-level helper."""

    return phonemes.replace(" ", "").strip()


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def tokenize_phonemes(phonemes: str) -> list[str]:
    """Split IPA into approximate phoneme/grapheme tokens.

    Combining marks such as nasalization stay attached to the preceding IPA
    symbol. Spaces are ignored for pronunciation alignment.
    """

    phonemes = unicodedata.normalize("NFD", phonemes)
    tokens: list[str] = []

    for char in phonemes:
        if char.isspace():
            continue

        if unicodedata.combining(char):
            if tokens:
                tokens[-1] += char
        else:
            tokens.append(char)

    return tokens


def align_sequences(expected: list[str], actual: list[str]) -> list[dict]:
    """Return a minimum-edit alignment for two IPA token sequences."""

    n = len(expected)
    m = len(actual)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(n + 1):
        dp[i][0] = i

    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            substitution_cost = 0 if expected[i - 1] == actual[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + substitution_cost,
            )

    alignment: list[dict] = []
    i = n
    j = m

    while i > 0 or j > 0:
        if (
            i > 0
            and j > 0
            and expected[i - 1] == actual[j - 1]
            and dp[i][j] == dp[i - 1][j - 1]
        ):
            alignment.append(
                {
                    "expected": expected[i - 1],
                    "actual": actual[j - 1],
                    "type": "match",
                }
            )
            i -= 1
            j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
            alignment.append(
                {
                    "expected": expected[i - 1],
                    "actual": actual[j - 1],
                    "type": "substitution",
                }
            )
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            alignment.append(
                {
                    "expected": expected[i - 1],
                    "actual": None,
                    "type": "deletion",
                }
            )
            i -= 1
        else:
            alignment.append(
                {
                    "expected": None,
                    "actual": actual[j - 1],
                    "type": "insertion",
                }
            )
            j -= 1

    alignment.reverse()
    return alignment


def evaluate_pronunciation(
    reference_text: str,
    reference_audio_path: str,
    learner_audio_path: str,
) -> dict:
    """Evaluate learner audio against the supplied reference audio/text."""

    expected_phonemes = phonemize_audio(reference_audio_path)
    learner_phonemes = phonemize_audio(learner_audio_path)
    transcript = transcribe_audio(learner_audio_path)

    text_similarity = similarity(
        normalize_text(reference_text),
        normalize_text(transcript),
    )

    expected = tokenize_phonemes(expected_phonemes)
    learner = tokenize_phonemes(learner_phonemes)
    alignment = align_sequences(expected, learner)
    differences = [item for item in alignment if item["type"] != "match"]
    matches = sum(1 for item in alignment if item["type"] == "match")
    pronunciation_similarity = matches / len(alignment) if alignment else 0

    return {
        "reference_text": reference_text,
        "transcript": transcript,
        "expected_phonemes": expected_phonemes,
        "learner_phonemes": learner_phonemes,
        # These are engineering similarity values for the prototype, not
        # validated language-learning scores.
        "pronunciation_similarity": round(pronunciation_similarity, 3),
        "text_similarity": round(text_similarity, 3),
        "differences": differences,
    }
