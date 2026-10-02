"""French audio-to-IPA phonemization."""

import torch

from .audio import load_audio
from .models import phoneme_model, phoneme_processor


def phonemize_audio(path: str) -> str:
    """Convert French speech to IPA using the local phonemizer model."""

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

    phonemes = phonemes.strip()
    if not phonemes:
        raise ValueError("The audio did not produce any phonemes.")

    return phonemes
