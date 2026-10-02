"""Load the local pronunciation model once for the process lifetime."""

from transformers import AutoModelForCTC, AutoProcessor


PHONEMIZER_MODEL_ID = "Cnam-LMSSC/wav2vec2-french-phonemizer-v2"


# These module-level objects are intentionally initialized once when the
# backend imports this module. Request handlers reuse the same objects.
phoneme_processor = AutoProcessor.from_pretrained(PHONEMIZER_MODEL_ID)
phoneme_model = AutoModelForCTC.from_pretrained(PHONEMIZER_MODEL_ID)
phoneme_model.eval()
