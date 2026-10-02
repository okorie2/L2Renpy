import io
import os
import unittest
import urllib.error
from unittest.mock import patch

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

        with patch("urllib.request.urlopen", return_value=FakeHTTPResponse(b"RIFFdata")) as urlopen:
            audio = provider.synthesize("Bonjour.", "fr", provider.voice_for("fr", "sophie"), "normal")

        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "http://tts.local:9000/synthesize")
        self.assertEqual(request.data, b'{"text": "Bonjour.", "language": "fr"}')
        self.assertEqual(audio.content, b"RIFFdata")
        self.assertEqual(audio.media_type, "audio/wav")
        self.assertEqual(audio.file_extension, ".wav")

    def test_unreachable_service_is_reported_as_unavailable(self):
        provider = ChatterboxTTSProvider()
        with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("refused")):
            with self.assertRaisesRegex(TTSConfigurationError, "not reachable"):
                provider.synthesize("Hello.", "en", "chatterbox", "normal")
            with self.assertRaises(TTSConfigurationError):
                provider.check()

    def test_empty_audio_is_rejected(self):
        provider = ChatterboxTTSProvider()
        with patch("urllib.request.urlopen", return_value=FakeHTTPResponse(b"")):
            with self.assertRaisesRegex(TTSSynthesisError, "no audio"):
                provider.synthesize("Hello.", "en", "chatterbox", "normal")


if __name__ == "__main__":
    unittest.main()
