"""Pronunciation evaluation based on the working local prototype."""

import re
import unicodedata

from .phonemize import phonemize_audio
from .phonetic_guide import phonetic_guide_from_ipa
from .text_phonemize import phonemize_french_word

REFERENCE_WORD_PATTERN = re.compile(
    r"[^\W_]+(?:['’][^\W_]+)*(?:-[^\W_]+(?:['’][^\W_]+)*)*",
    re.UNICODE,
)


def tokenize_reference_words(reference_text: str) -> list[dict]:
    """Return learner-facing words without splitting apostrophes or hyphens."""

    return [
        {"index": index, "text": match.group(0)}
        for index, match in enumerate(
            REFERENCE_WORD_PATTERN.finditer(reference_text or "")
        )
    ]


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
    """Return a minimum-edit alignment without internal index metadata."""

    return [
        {
            "expected": item["expected"],
            "actual": item["actual"],
            "type": item["type"],
        }
        for item in _align_sequences_with_indices(expected, actual)
    ]


def _align_sequences_with_indices(
    expected: list[str],
    actual: list[str],
) -> list[dict]:
    """Return alignment operations while retaining source sequence indexes."""

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
                    "expected_index": i - 1,
                    "actual_index": j - 1,
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
                    "expected_index": i - 1,
                    "actual_index": j - 1,
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
                    "expected_index": i - 1,
                    "actual_index": None,
                }
            )
            i -= 1
        else:
            alignment.append(
                {
                    "expected": None,
                    "actual": actual[j - 1],
                    "type": "insertion",
                    "expected_index": None,
                    "actual_index": j - 1,
                }
            )
            j -= 1

    alignment.reverse()
    return alignment


def build_expected_word_phonemes(reference_text: str) -> list[dict]:
    """Build text-derived IPA for each learner-facing reference word."""

    word_entries = tokenize_reference_words(reference_text)
    results = []
    for entry in word_entries:
        expected_phonemes = phonemize_french_word(entry["text"])
        results.append(
            {
                **entry,
                "expected_phonemes": expected_phonemes,
                "phonetic_guide": phonetic_guide_from_ipa(expected_phonemes),
                "scorable": True,
            }
        )
    return results


def _insertion_word_index(
    alignment: list[dict],
    alignment_position: int,
    expected_word_indexes: list[int],
) -> int | None:
    """Assign an insertion to the nearest expected word deterministically.

    The preceding expected word wins when both sides are equally near; this
    keeps insertions at a boundary stable without pretending to know exact
    acoustic word timing.
    """

    for position in range(alignment_position - 1, -1, -1):
        expected_index = alignment[position]["expected_index"]
        if expected_index is not None:
            return expected_word_indexes[expected_index]

    for position in range(alignment_position + 1, len(alignment)):
        expected_index = alignment[position]["expected_index"]
        if expected_index is not None:
            return expected_word_indexes[expected_index]

    return None


def analyze_word_pronunciation(
    reference_text: str,
    learner_phonemes: str,
) -> list[dict]:
    """Score learner phonemes against text-derived, word-labelled IPA."""

    expected_words = build_expected_word_phonemes(reference_text)
    expected_tokens = []
    expected_word_indexes = []

    for word_index, word in enumerate(expected_words):
        word_tokens = tokenize_phonemes(word["expected_phonemes"])
        expected_tokens.extend(word_tokens)
        expected_word_indexes.extend([word_index] * len(word_tokens))

    learner_tokens = tokenize_phonemes(learner_phonemes)
    alignment = _align_sequences_with_indices(expected_tokens, learner_tokens)
    operations_by_word = [[] for _ in expected_words]

    for position, operation in enumerate(alignment):
        expected_index = operation["expected_index"]
        if expected_index is None:
            word_index = _insertion_word_index(
                alignment,
                position,
                expected_word_indexes,
            )
        else:
            word_index = expected_word_indexes[expected_index]

        if word_index is not None:
            operations_by_word[word_index].append(operation)

    word_results = []
    for word_index, (word, operations) in enumerate(
        zip(expected_words, operations_by_word)
    ):
        matches = sum(1 for item in operations if item["type"] == "match")
        score = matches / len(operations) if operations else 0
        word_results.append(
            {
                "index": word_index,
                "word": word["text"],
                "expected_phonemes": word["expected_phonemes"],
                "phonetic_guide": word["phonetic_guide"],
                "learner_phonemes": "".join(
                    item["actual"] for item in operations if item["actual"] is not None
                ),
                "score": round(score, 3),
                "differences": [
                    {
                        "expected": item["expected"],
                        "actual": item["actual"],
                        "type": item["type"],
                    }
                    for item in operations
                    if item["type"] != "match"
                ],
                "scorable": word["scorable"],
            }
        )

    return word_results


def select_weakest_word(
    word_results: list[dict],
    pronunciation_similarity: float,
) -> dict | None:
    """Select the earliest lowest-scoring word only for an imperfect phrase."""

    if pronunciation_similarity >= 0.999:
        return None

    candidates = [result for result in word_results if result.get("scorable", True)]
    if not candidates:
        return None

    weakest = min(
        candidates,
        key=lambda result: (result["score"], result["index"]),
    )
    return dict(weakest)


def evaluate_pronunciation(
    reference_text: str,
    reference_audio_path: str,
    learner_audio_path: str,
) -> dict:
    """Evaluate learner audio against the supplied reference audio/text."""
    print("Evaluating pronunciation...")
    expected_phonemes = phonemize_audio(reference_audio_path)
    learner_phonemes = phonemize_audio(learner_audio_path)
    print(f"Reference text: {reference_text}")

    expected = tokenize_phonemes(expected_phonemes)
    learner = tokenize_phonemes(learner_phonemes)
    alignment = align_sequences(expected, learner)
    differences = [item for item in alignment if item["type"] != "match"]
    matches = sum(1 for item in alignment if item["type"] == "match")
    pronunciation_similarity = matches / len(alignment) if alignment else 0
    pronunciation_similarity = round(pronunciation_similarity, 3)
    word_results = analyze_word_pronunciation(
        reference_text,
        learner_phonemes,
    )
    weakest_word = select_weakest_word(
        word_results,
        pronunciation_similarity,
    )
    # log the output
    print(f"Expected phonemes: {expected_phonemes}")
    print(f"Learner phonemes: {learner_phonemes}")
    print(f"Pronunciation similarity: {pronunciation_similarity}")
    print(f"Weakest word: {weakest_word}")
    return {
        "reference_text": reference_text,
        "expected_phonemes": expected_phonemes,
        "learner_phonemes": learner_phonemes,
        # These are engineering similarity values for the prototype, not
        # validated language-learning scores.
        "pronunciation_similarity": pronunciation_similarity,
        "differences": differences,
        "word_results": word_results,
        "weakest_word": weakest_word,
    }
