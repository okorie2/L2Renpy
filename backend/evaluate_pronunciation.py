import argparse
import json
import re
import unicodedata
from difflib import SequenceMatcher

import librosa
import torch
from transformers import (
    AutoModelForCTC,
    AutoProcessor,
    pipeline,
)


PHONEMIZER_MODEL = "Cnam-LMSSC/wav2vec2-french-phonemizer-v2"
WHISPER_MODEL = "openai/whisper-small"


print("Loading French phonemizer...")
phoneme_processor = AutoProcessor.from_pretrained(PHONEMIZER_MODEL)
phoneme_model = AutoModelForCTC.from_pretrained(PHONEMIZER_MODEL)

print("Loading Whisper...")
whisper = pipeline(
    "automatic-speech-recognition",
    model=WHISPER_MODEL,
)


def load_audio(path: str):
    audio, sample_rate = librosa.load(
        path,
        sr=16000,
        mono=True,
    )

    return audio, sample_rate


def phonemize_audio(path: str) -> str:
    audio, sample_rate = load_audio(path)

    inputs = phoneme_processor(
        audio,
        sampling_rate=sample_rate,
        return_tensors="pt",
    )

    with torch.no_grad():
        logits = phoneme_model(**inputs).logits

    predicted_ids = torch.argmax(logits, dim=-1)

    phonemes = phoneme_processor.batch_decode(predicted_ids)[0]

    return phonemes.strip()


def transcribe_audio(path: str) -> str:
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

    return result["text"].strip()


def normalize_text(text: str) -> str:
    text = text.lower().strip()

    # Keep French letters/apostrophes, remove punctuation that
    # should not affect sentence matching.
    text = re.sub(r"[^\w\s'àâäéèêëîïôöùûüÿçœ-]", "", text)

    text = re.sub(r"\s+", " ", text)

    return text


def normalize_phonemes(phonemes: str) -> str:
    # For our first similarity calculation, ignore spaces.
    # We care about the detected speech sounds themselves.
    return phonemes.replace(" ", "").strip()


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def align_sequences(expected, actual):
    """
    Levenshtein alignment.

    Returns a sequence of:
    {
        "expected": str | None,
        "actual": str | None,
        "type": "match" | "substitution" | "deletion" | "insertion"
    }
    """

    n = len(expected)
    m = len(actual)

    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(n + 1):
        dp[i][0] = i

    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):

            substitution_cost = (
                0 if expected[i - 1] == actual[j - 1] else 1
            )

            dp[i][j] = min(
                dp[i - 1][j] + 1,                    # deletion
                dp[i][j - 1] + 1,                    # insertion
                dp[i - 1][j - 1] + substitution_cost
            )

    alignment = []

    i = n
    j = m

    while i > 0 or j > 0:

        if (
            i > 0
            and j > 0
            and expected[i - 1] == actual[j - 1]
            and dp[i][j] == dp[i - 1][j - 1]
        ):
            alignment.append({
                "expected": expected[i - 1],
                "actual": actual[j - 1],
                "type": "match"
            })

            i -= 1
            j -= 1

        elif (
            i > 0
            and j > 0
            and dp[i][j] == dp[i - 1][j - 1] + 1
        ):
            alignment.append({
                "expected": expected[i - 1],
                "actual": actual[j - 1],
                "type": "substitution"
            })

            i -= 1
            j -= 1

        elif (
            i > 0
            and dp[i][j] == dp[i - 1][j] + 1
        ):
            alignment.append({
                "expected": expected[i - 1],
                "actual": None,
                "type": "deletion"
            })

            i -= 1

        else:
            alignment.append({
                "expected": None,
                "actual": actual[j - 1],
                "type": "insertion"
            })

            j -= 1

    alignment.reverse()

    return alignment


def evaluate_pronunciation(
    reference_text: str,
    reference_audio_path: str,
    learner_audio_path: str,
):
    print("Analysing reference pronunciation...")
    expected_phonemes = phonemize_audio(reference_audio_path)

    print("Analysing learner pronunciation...")
    learner_phonemes = phonemize_audio(learner_audio_path)

    print("Transcribing learner speech...")
    transcript = transcribe_audio(learner_audio_path)

    # expected_phonemes_normalized = normalize_phonemes(expected_phonemes)
    # learner_phonemes_normalized = normalize_phonemes(learner_phonemes)

    # pronunciation_similarity = similarity(
    #     expected_phonemes_normalized,
    #     learner_phonemes_normalized,
    # )

    text_similarity = similarity(
        normalize_text(reference_text),
        normalize_text(transcript),
    )

    expected = tokenize_phonemes(expected_phonemes)
    learner = tokenize_phonemes(learner_phonemes)

    alignment = align_sequences(expected, learner)

    differences = [
        item
        for item in alignment
        if item["type"] != "match"
    ]

    matches = sum(
        1 for item in alignment
        if item["type"] == "match"
    )

    pronunciation_similarity = (
        matches / len(alignment)
        if alignment
        else 0
    )

    return {
        "reference_text": reference_text,
        "transcript": transcript,

        "expected_phonemes": expected_phonemes,
        "learner_phonemes": learner_phonemes,

        # IMPORTANT:
        # These are engineering similarity values for our prototype.
        # They are NOT validated language-learning scores.
        "pronunciation_similarity": round(
            pronunciation_similarity,
            3,
        ),

        "text_similarity": round(
            text_similarity,
            3,
        ),
        "differences": differences,
    }




def tokenize_phonemes(phonemes: str) -> list[str]:
    """
    Split IPA into approximate phoneme/grapheme tokens.

    Combining marks such as nasalization stay attached
    to the preceding IPA symbol.

    Spaces are ignored for pronunciation alignment.
    """

    phonemes = unicodedata.normalize("NFD", phonemes)

    tokens = []

    for char in phonemes:
        if char.isspace():
            continue

        if unicodedata.combining(char):
            if tokens:
                tokens[-1] += char
        else:
            tokens.append(char)

    return tokens

if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--reference-text",
        required=True,
    )

    parser.add_argument(
        "--reference-audio",
        required=True,
    )

    parser.add_argument(
        "--learner-audio",
        required=True,
    )

    args = parser.parse_args()

    result = evaluate_pronunciation(
        reference_text=args.reference_text,
        reference_audio_path=args.reference_audio,
        learner_audio_path=args.learner_audio,
    )

    print("\nRESULT")
    print(json.dumps(result, indent=2, ensure_ascii=False))