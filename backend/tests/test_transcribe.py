import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.speech.transcribe import (
    ElevenLabsSTTProvider,
    STTConfigurationError,
    STTProviderError,
    STTTranscriptionError,
    normalize_language,
    transcribe_audio,
)


ENVIRONMENT = {"ELEVENLABS_API_KEY": "test-api-key"}


class ElevenLabsSTTTests(unittest.TestCase):
    def setUp(self):
        self.audio_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        self.audio_file.write(b"test audio")
        self.audio_file.close()
        self.addCleanup(Path(self.audio_file.name).unlink, missing_ok=True)

    def test_english_language_alias_normalizes_to_en(self):
        self.assertEqual(normalize_language(" English "), "en")

    def test_french_language_alias_normalizes_to_fr(self):
        self.assertEqual(normalize_language("FRENCH"), "fr")

    def test_unsupported_language_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported transcription language"):
            normalize_language("es")

    def test_successful_scribe_response_returns_stripped_transcript(self):
        client = Mock()
        client.speech_to_text.convert.return_value = SimpleNamespace(
            text="  Emmanuella  "
        )

        with patch.dict(os.environ, ENVIRONMENT, clear=False), patch(
            "elevenlabs.client.ElevenLabs", return_value=client
        ):
            transcript = transcribe_audio(self.audio_file.name, "english")

        self.assertEqual(transcript, "Emmanuella")
        request = client.speech_to_text.convert.call_args.kwargs
        self.assertEqual(request["model_id"], "scribe_v2")
        self.assertEqual(request["language_code"], "en")
        self.assertFalse(request["tag_audio_events"])
        self.assertFalse(request["diarize"])
        self.assertTrue(request["file"].closed)

    def test_empty_scribe_response_is_rejected(self):
        client = Mock()
        client.speech_to_text.convert.return_value = SimpleNamespace(text="  ")

        with patch.dict(os.environ, ENVIRONMENT, clear=False), patch(
            "elevenlabs.client.ElevenLabs", return_value=client
        ):
            with self.assertRaisesRegex(
                STTTranscriptionError,
                "usable transcript",
            ):
                transcribe_audio(self.audio_file.name, "fr")

    def test_missing_api_key_is_configuration_error(self):
        with patch.dict(os.environ, {"ELEVENLABS_API_KEY": ""}, clear=False):
            with self.assertRaisesRegex(
                STTConfigurationError,
                "ELEVENLABS_API_KEY",
            ):
                ElevenLabsSTTProvider()

    def test_provider_exception_is_wrapped(self):
        client = Mock()
        client.speech_to_text.convert.side_effect = RuntimeError("provider detail")

        with patch.dict(os.environ, ENVIRONMENT, clear=False), patch(
            "elevenlabs.client.ElevenLabs", return_value=client
        ):
            with self.assertRaisesRegex(
                STTProviderError,
                "ElevenLabs speech-to-text failed",
            ):
                transcribe_audio(self.audio_file.name, "en")


if __name__ == "__main__":
    unittest.main()
