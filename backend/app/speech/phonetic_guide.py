"""Deterministic beginner-facing respelling for French IPA."""

from __future__ import annotations

import unicodedata


# These are intentionally approximate learner hints, not a second phonetic
# transcription system.
IPA_GUIDE_MAP = {
    "ɑ\u0303": "ahn",
    "ɔ\u0303": "ohn",
    "ɛ\u0303": "ehn",
    "œ\u0303": "uhn",
    "ʃ": "sh",
    "ʒ": "zh",
    "ɲ": "ny",
    "ʁ": "r",
    "ʀ": "r",
    "ɥ": "w",
    "a": "ah",
    "ɑ": "ah",
    "e": "ay",
    "ɛ": "eh",
    "ə": "uh",
    "i": "ee",
    "o": "oh",
    "ɔ": "aw",
    "u": "oo",
    "y": "ee",
    "ø": "uh",
    "œ": "uh",
    "j": "y",
}

IPA_VOWELS = {
    "ɑ\u0303",
    "ɔ\u0303",
    "ɛ\u0303",
    "œ\u0303",
    "a",
    "ɑ",
    "e",
    "ɛ",
    "ə",
    "i",
    "o",
    "ɔ",
    "u",
    "y",
    "ø",
    "œ",
}


def _tokenize_ipa(phonemes: str) -> list[str]:
    """Split IPA into symbols while keeping combining marks attached."""

    normalized = unicodedata.normalize("NFC", phonemes or "")
    units: list[str] = []

    for char in normalized:
        if unicodedata.combining(char):
            if units:
                units[-1] += char
            else:
                units.append(char)
        else:
            units.append(char)

    return units


def phonetic_guide_from_ipa(phonemes: str) -> str:
    """Return a stable, approximate learner guide for an IPA sequence.

    Consonants before a vowel are grouped with that vowel to produce readable
    chunks such as ``ah-prahn-dr`` for ``apʀɑ̃dʀ``. Unknown symbols remain in
    the output so guide generation never hides or crashes on new IPA output.
    """

    units = _tokenize_ipa(phonemes)
    if not units:
        return ""

    groups: list[str] = []
    pending_consonants: list[str] = []

    def flush_pending() -> None:
        if pending_consonants:
            groups.append("".join(pending_consonants))
            pending_consonants.clear()

    for unit in units:
        if unit.isspace() or unit in {"-", "'", "’"}:
            flush_pending()
            continue

        mapped = IPA_GUIDE_MAP.get(unit, unit)
        if unit in IPA_VOWELS:
            groups.append("".join(pending_consonants) + mapped)
            pending_consonants.clear()
        else:
            pending_consonants.append(mapped)

    flush_pending()
    return "-".join(group for group in groups if group)
