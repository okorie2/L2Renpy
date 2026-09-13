"""Load the local speech models once for the lifetime of the process."""

from transformers import AutoModelForCTC, AutoProcessor, pipeline


PHONEMIZER_MODEL_ID = "Cnam-LMSSC/wav2vec2-french-phonemizer-v2"
WHISPER_MODEL_ID = "openai/whisper-small"


# These module-level objects are intentionally initialized once when the
# backend imports this module. Request handlers reuse the same objects.
phoneme_processor = AutoProcessor.from_pretrained(PHONEMIZER_MODEL_ID)
phoneme_model = AutoModelForCTC.from_pretrained(PHONEMIZER_MODEL_ID)
phoneme_model.eval()

whisper = pipeline(
    "automatic-speech-recognition",
    model=WHISPER_MODEL_ID,
)
