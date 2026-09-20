"""French text-to-IPA conversion for word-level pronunciation diagnostics."""

from functools import lru_cache


@lru_cache(maxsize=1)
def _french_g2p():
    """Load the reusable French grapheme-to-phoneme converter."""

    try:
        import epitran
    except ImportError as exc:
        raise RuntimeError(
            "French word phonemization requires the 'epitran' package."
        ) from exc

    return epitran.Epitran("fra-Latn")


def phonemize_french_word(word: str) -> str:
    """Convert one French learner-facing word to an IPA string."""

    normalized_word = (word or "").strip().replace("’", "'")
    if not normalized_word:
        raise ValueError("Cannot phonemize an empty French word.")

    phonemes = _french_g2p().transliterate(normalized_word).strip()
    if not phonemes:
        raise ValueError(
            "French text-to-phoneme conversion returned no phonemes."
        )

    return phonemes
