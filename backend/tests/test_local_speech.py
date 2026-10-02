import io
import os
import tempfile
import unittest
import urllib.error
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.speech import transcribe as transcribe_module
from app.speech.transcribe import (
    FasterWhisperSTTProvider,
    STTConfigurationError,
    STTTranscriptionError,
    get_stt_provider,
    transcribe_audio,
)
from app.speech.tts import (
    ChatterboxTTSProvider,
    TTSConfigurationError,
    TTSSynthesisError,
    get_tts_provider,
)


class FakeHTTPResponse(io.BytesIO):
    def __init__(self, body, content_type="audio/wav"):
        super().__init__(body)
        self.headers = {"Content-Type": content_type}

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


class ChatterboxTTSProviderTests(unittest.TestCase):
    def test_provider_selected_by_environment(self):
        with patch.dict(os.environ, {"LANGUAGE_APP_TTS_PROVIDER": "chatterbox"}):
            self.assertIsInstance(get_tts_provider(), ChatterboxTTSProvider)

    def test_posts_text_and_language_and_returns_wav(self):
        with patch.dict(os.environ, {"CHATTERBOX_URL": "http://tts.local:9000/"}):
            provider = ChatterboxTTSProvider()

        with patch(
            "urllib.request.urlopen",
            return_value=FakeHTTPResponse(b"RIFFdata"),
        ) as urlopen:
            audio = provider.synthesize("Bonjour.", "fr")

        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "http://tts.local:9000/synthesize")
        self.assertEqual(
            request.data,
            b'{"text": "Bonjour.", "language": "fr"}',
        )
        self.assertEqual(audio.content, b"RIFFdata")
        self.assertEqual(audio.media_type, "audio/wav")
        self.assertEqual(audio.file_extension, ".wav")

    def test_unreachable_service_is_reported_as_unavailable(self):
        provider = ChatterboxTTSProvider()
        with patch(
            "urllib.request.urlopen",
            side_effect=urllib.error.URLError("refused"),
        ):
            with self.assertRaisesRegex(TTSConfigurationError, "not reachable"):
                provider.synthesize("Hello.", "en")

    def test_empty_audio_is_rejected(self):
        provider = ChatterboxTTSProvider()
        with patch("urllib.request.urlopen", return_value=FakeHTTPResponse(b"")):
            with self.assertRaisesRegex(TTSSynthesisError, "no audio"):
                provider.synthesize("Hello.", "en")


class FasterWhisperSTTProviderTests(unittest.TestCase):
    def setUp(self):
        transcribe_module._load_whisper_model.cache_clear()
        self.audio_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        self.audio_file.write(b"test audio")
        self.audio_file.close()
        self.addCleanup(Path(self.audio_file.name).unlink, missing_ok=True)

    def run(self, result=None):
        # Real decoding isn't under test; the fixture file isn't real audio.
        with patch.object(
            transcribe_module, "_load_audio_for_whisper", return_value=[0.0] * 16000
        ):
            return super().run(result)

    def _fake_model(self, *texts):
        model = Mock()
        model.transcribe.return_value = (
            iter(SimpleNamespace(text=t) for t in texts),
            SimpleNamespace(language="en"),
        )
        return model

    def test_provider_selected_by_environment(self):
        with patch.dict(
            os.environ, {"LANGUAGE_APP_STT_PROVIDER": "faster-whisper"}
        ), patch.object(
            transcribe_module, "_load_whisper_model", return_value=Mock()
        ):
            self.assertIsInstance(get_stt_provider(), FasterWhisperSTTProvider)

    def test_unknown_provider_is_rejected(self):
        with patch.dict(os.environ, {"LANGUAGE_APP_STT_PROVIDER": "other"}):
            with self.assertRaises(STTConfigurationError):
                get_stt_provider()

    def test_joins_segments_and_passes_language(self):
        model = self._fake_model("  My name is ", " Ella. ")
        with patch.dict(
            os.environ, {"LANGUAGE_APP_STT_PROVIDER": "faster-whisper"}
        ), patch.object(transcribe_module, "_load_whisper_model", return_value=model):
            transcript = transcribe_audio(self.audio_file.name, "english")

        self.assertEqual(transcript, "My name is Ella.")
        kwargs = model.transcribe.call_args.kwargs
        self.assertEqual(kwargs["language"], "en")
        self.assertEqual(kwargs["task"], "transcribe")
        self.assertTrue(kwargs["vad_filter"])

    def test_empty_transcript_is_rejected(self):
        model = self._fake_model("   ")
        with patch.object(transcribe_module, "_load_whisper_model", return_value=model):
            provider = FasterWhisperSTTProvider()
            with self.assertRaises(STTTranscriptionError):
                provider.transcribe(self.audio_file.name, "fr")


if __name__ == "__main__":
    unittest.main()
