"""Settings for the speech service. Every value has a development default."""

import os

# Whisper model. "small" is quick on a laptop CPU; "large-v3-turbo" is more accurate
# with learner accents and needs about 1.6 GB.
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
# "auto" uses a GPU when one is available, otherwise the CPU.
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")
# int8 is the sensible choice on CPU.
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "5"))

LANGUAGES = {code.strip() for code in os.getenv("SPEECH_LANGUAGES", "fr,en").split(",") if code.strip()}

# A learner's answer is one short sentence. Anything much larger is not an answer.
MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(3 * 1024 * 1024)))
MAX_AUDIO_SECONDS = float(os.getenv("MAX_AUDIO_SECONDS", "20"))
