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


def normalize_evaluation_exclusions(
    reference_text: str,
    evaluation_exclusions: list[dict] | None = None,
) -> set[int]:
    """Expand reference-word spans into the indexes they exclude from scoring.

    Spans use a zero-based, end-exclusive ``start``/``end`` pair. They refer
    to the tokenization of the complete learner-facing reference text, so
    punctuation and repeated words cannot cause an unrelated replacement.
    """

    if not evaluation_exclusions:
        return set()

    word_count = len(tokenize_reference_words(reference_text))
    excluded_word_indexes = set()

    if not isinstance(evaluation_exclusions, list):
        raise ValueError("evaluation_exclusions must be a list of spans.")

    for span in evaluation_exclusions:
        if not isinstance(span, dict):
            raise ValueError("Each evaluation exclusion must be an object.")

        try:
            start = int(span["start"])
            end = int(span["end"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(
                "Each evaluation exclusion needs integer start and end values."
            ) from exc

        if start < 0 or end <= start or end > word_count:
            raise ValueError("An evaluation exclusion is outside reference_text.")

        excluded_word_indexes.update(range(start, end))

    return excluded_word_indexes


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


def _insertion_is_excluded(
    expected_position: int,
    expected_length: int,
    excluded_expected_indexes: set[int],
) -> bool:
    """Return whether an insertion is adjacent to an excluded span."""

    return (
        (
            expected_position > 0
            and expected_position - 1 in excluded_expected_indexes
        )
        or (
            expected_position < expected_length
            and expected_position in excluded_expected_indexes
        )
    )


def _align_sequences_with_exclusions(
    expected: list[str],
    actual: list[str],
    excluded_expected_indexes: set[int],
) -> list[dict]:
    """Align sequences while making an excluded expected span cost-free.

    Excluded expected tokens may be substituted or deleted without cost, and
    actual tokens at the span's boundaries may be inserted without cost. This
    keeps a differently pronounced excluded name from charging edits to the
    fixed words before or after it.
    """

    if not excluded_expected_indexes:
        return _align_sequences_with_indices(expected, actual)

    n = len(expected)
    m = len(actual)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        expected_index = i - 1
        dp[i][0] = dp[i - 1][0] + (
            0 if expected_index in excluded_expected_indexes else 1
        )

    for j in range(1, m + 1):
        dp[0][j] = dp[0][j - 1] + (
            0
            if _insertion_is_excluded(0, n, excluded_expected_indexes)
            else 1
        )

    for i in range(1, n + 1):
        expected_index = i - 1
        excluded = expected_index in excluded_expected_indexes
        deletion_cost = 0 if excluded else 1

        for j in range(1, m + 1):
            substitution_cost = 0 if expected[i - 1] == actual[j - 1] else 1
            if excluded:
                substitution_cost = 0

            insertion_cost = (
                0
                if _insertion_is_excluded(i, n, excluded_expected_indexes)
                else 1
            )
            dp[i][j] = min(
                dp[i - 1][j] + deletion_cost,
                dp[i][j - 1] + insertion_cost,
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
            expected_index = i - 1
            alignment.append(
                {
                    "expected": expected[expected_index],
                    "actual": actual[j - 1],
                    "type": "match",
                    "expected_index": expected_index,
                    "actual_index": j - 1,
                    "excluded": expected_index in excluded_expected_indexes,
                }
            )
            i -= 1
            j -= 1
            continue
        elif i > 0 and j > 0:
            expected_index = i - 1
            substitution_cost = 0 if expected_index in excluded_expected_indexes else 1
            if expected[i - 1] == actual[j - 1]:
                substitution_cost = 0
            if dp[i][j] == dp[i - 1][j - 1] + substitution_cost:
                alignment.append(
                    {
                        "expected": expected[expected_index],
                        "actual": actual[j - 1],
                        "type": "substitution",
                        "expected_index": expected_index,
                        "actual_index": j - 1,
                        "excluded": expected_index in excluded_expected_indexes,
                    }
                )
                i -= 1
                j -= 1
                continue

        if i > 0:
            expected_index = i - 1
            deletion_cost = 0 if expected_index in excluded_expected_indexes else 1
            if dp[i][j] == dp[i - 1][j] + deletion_cost:
                alignment.append(
                    {
                        "expected": expected[expected_index],
                        "actual": None,
                        "type": "deletion",
                        "expected_index": expected_index,
                        "actual_index": None,
                        "excluded": expected_index in excluded_expected_indexes,
                    }
                )
                i -= 1
                continue

        insertion_cost = (
            0
            if _insertion_is_excluded(i, n, excluded_expected_indexes)
            else 1
        )
        if j > 0 and dp[i][j] == dp[i][j - 1] + insertion_cost:
            alignment.append(
                {
                    "expected": None,
                    "actual": actual[j - 1],
                    "type": "insertion",
                    "expected_index": None,
                    "actual_index": j - 1,
                    "excluded": _insertion_is_excluded(
                        i,
                        n,
                        excluded_expected_indexes,
                    ),
                }
            )
            j -= 1
            continue

        raise RuntimeError("Could not reconstruct pronunciation alignment.")

    alignment.reverse()
    return alignment


def build_expected_word_phonemes(
    reference_text: str,
    excluded_word_indexes: set[int] | None = None,
) -> list[dict]:
    """Build text-derived IPA for each learner-facing reference word."""

    excluded_word_indexes = excluded_word_indexes or set()
    word_entries = tokenize_reference_words(reference_text)
    results = []
    for entry in word_entries:
        expected_phonemes = phonemize_french_word(entry["text"])
        results.append(
            {
                **entry,
                "expected_phonemes": expected_phonemes,
                "phonetic_guide": phonetic_guide_from_ipa(expected_phonemes),
                "scorable": entry["index"] not in excluded_word_indexes,
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


def _reference_audio_excluded_indexes(
    reference_text: str,
    reference_phonemes: str,
    excluded_word_indexes: set[int],
) -> set[int]:
    """Map excluded reference-text words onto reference-audio phonemes."""

    if not excluded_word_indexes:
        return set()

    expected_words = build_expected_word_phonemes(reference_text)
    text_expected_tokens = []
    text_expected_word_indexes = []

    for word_index, word in enumerate(expected_words):
        word_tokens = tokenize_phonemes(word["expected_phonemes"])
        text_expected_tokens.extend(word_tokens)
        text_expected_word_indexes.extend([word_index] * len(word_tokens))

    reference_tokens = tokenize_phonemes(reference_phonemes)
    text_audio_alignment = _align_sequences_with_indices(
        text_expected_tokens,
        reference_tokens,
    )
    excluded_reference_indexes = set()

    for position, operation in enumerate(text_audio_alignment):
        expected_index = operation["expected_index"]
        if expected_index is None:
            word_index = _insertion_word_index(
                text_audio_alignment,
                position,
                text_expected_word_indexes,
            )
        else:
            word_index = text_expected_word_indexes[expected_index]

        if (
            word_index in excluded_word_indexes
            and operation["actual_index"] is not None
        ):
            excluded_reference_indexes.add(operation["actual_index"])

    return excluded_reference_indexes


def analyze_word_pronunciation(
    reference_text: str,
    learner_phonemes: str,
    evaluation_exclusions: list[dict] | None = None,
) -> list[dict]:
    """Score learner phonemes against text-derived, word-labelled IPA."""

    excluded_word_indexes = normalize_evaluation_exclusions(
        reference_text,
        evaluation_exclusions,
    )
    expected_words = build_expected_word_phonemes(
        reference_text,
        excluded_word_indexes,
    )
    expected_tokens = []
    expected_word_indexes = []
    excluded_expected_indexes = set()

    for word_index, word in enumerate(expected_words):
        word_tokens = tokenize_phonemes(word["expected_phonemes"])
        expected_tokens.extend(word_tokens)
        expected_word_indexes.extend([word_index] * len(word_tokens))
        if not word["scorable"]:
            first_token = len(expected_tokens) - len(word_tokens)
            excluded_expected_indexes.update(
                range(first_token, len(expected_tokens))
            )

    learner_tokens = tokenize_phonemes(learner_phonemes)
    alignment = _align_sequences_with_exclusions(
        expected_tokens,
        learner_tokens,
        excluded_expected_indexes,
    )
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

        if (
            word_index is not None
            and not operation.get("excluded", False)
        ):
            operations_by_word[word_index].append(operation)

    word_results = []
    for word_index, (word, operations) in enumerate(
        zip(expected_words, operations_by_word)
    ):
        if not word["scorable"]:
            word_results.append(
                {
                    "index": word_index,
                    "word": word["text"],
                    "expected_phonemes": word["expected_phonemes"],
                    "phonetic_guide": word["phonetic_guide"],
                    "learner_phonemes": "".join(
                        item["actual"]
                        for item in operations
                        if item["actual"] is not None
                    ),
                    "score": None,
                    "differences": [],
                    "scorable": False,
                    "evaluated": False,
                }
            )
            continue

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
    evaluation_exclusions: list[dict] | None = None,
) -> dict:
    """Evaluate learner audio against the supplied reference audio/text."""
    print("Evaluating pronunciation...")
    expected_phonemes = phonemize_audio(reference_audio_path)
    learner_phonemes = phonemize_audio(learner_audio_path)
    print(f"Reference text: {reference_text}")

    excluded_word_indexes = normalize_evaluation_exclusions(
        reference_text,
        evaluation_exclusions,
    )
    expected = tokenize_phonemes(expected_phonemes)
    learner = tokenize_phonemes(learner_phonemes)
    excluded_reference_indexes = _reference_audio_excluded_indexes(
        reference_text,
        expected_phonemes,
        excluded_word_indexes,
    )

    if excluded_reference_indexes:
        alignment = _align_sequences_with_exclusions(
            expected,
            learner,
            excluded_reference_indexes,
        )
        scored_alignment = [
            item for item in alignment if not item.get("excluded", False)
        ]
    else:
        # Preserve the existing no-exclusions alignment and score exactly.
        alignment = align_sequences(expected, learner)
        scored_alignment = alignment

    differences = [item for item in scored_alignment if item["type"] != "match"]
    matches = sum(1 for item in scored_alignment if item["type"] == "match")
    pronunciation_similarity = (
        matches / len(scored_alignment) if scored_alignment else 1.0
    )
    pronunciation_similarity = round(pronunciation_similarity, 3)
    word_results = analyze_word_pronunciation(
        reference_text,
        learner_phonemes,
        evaluation_exclusions=evaluation_exclusions,
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
