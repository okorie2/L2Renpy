import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.speech import tts as tts_module
from app.speech.tts import SynthesizedAudio, synthesize_speech


class FakeProvider:
    def __init__(self, identity="fake:voice-a"):
        self.cache_identity = identity
        self.calls = []

    def synthesize(self, text, language):
        self.calls.append((text, language))
        return SynthesizedAudio(
            content="{}|{}".format(text, language).encode(),
            media_type="audio/mpeg",
            file_extension=".mp3",
        )


class TTSCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        env = patch.dict(
            os.environ, {"LANGUAGE_APP_TTS_CACHE_DIR": self.temp_dir.name}
        )
        env.start()
        self.addCleanup(env.stop)

    def _synthesize(self, provider, text, language="fr"):
        with patch.object(tts_module, "get_tts_provider", return_value=provider):
            return synthesize_speech(text, language)

    def test_same_line_is_generated_once_then_served_from_cache(self):
        provider = FakeProvider()

        first = self._synthesize(provider, "Bonjour.")
        second = self._synthesize(provider, "Bonjour.")

        self.assertEqual(provider.calls, [("Bonjour.", "fr")])
        self.assertEqual(first.content, second.content)
        self.assertEqual(second.media_type, "audio/mpeg")
        self.assertEqual(second.file_extension, ".mp3")

    def test_different_text_language_or_voice_are_cached_separately(self):
        provider = FakeProvider()
        self._synthesize(provider, "Bonjour.", "fr")
        self._synthesize(provider, "Bonjour!", "fr")
        self._synthesize(provider, "Bonjour.", "en")

        other_voice = FakeProvider(identity="fake:voice-b")
        self._synthesize(other_voice, "Bonjour.", "fr")

        self.assertEqual(len(provider.calls), 3)
        self.assertEqual(len(other_voice.calls), 1)

    def test_cache_can_be_disabled(self):
        provider = FakeProvider()
        with patch.dict(os.environ, {"LANGUAGE_APP_TTS_CACHE_DIR": "off"}):
            self._synthesize(provider, "Salut.")
            self._synthesize(provider, "Salut.")

        self.assertEqual(len(provider.calls), 2)
        self.assertEqual(list(Path(self.temp_dir.name).iterdir()), [])

    def test_provider_errors_are_not_cached(self):
        provider = FakeProvider()
        provider.synthesize = lambda text, language: (_ for _ in ()).throw(
            tts_module.TTSSynthesisError("boom")
        )

        with self.assertRaises(tts_module.TTSSynthesisError):
            self._synthesize(provider, "Merci.")

        self.assertEqual(list(Path(self.temp_dir.name).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
