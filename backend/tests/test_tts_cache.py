import io
import math
import os
import struct
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from app.speech import tts as tts_module
from app.speech.tts import SynthesizedAudio, synthesize_speech


def spoken_wav(seconds=1.0, rate=16000) -> bytes:
    """A short 'voice': a tone that swells four times a second."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(rate)
        frames = []
        for index in range(int(seconds * rate)):
            t = index / rate
            envelope = 0.5 + 0.5 * math.sin(2 * math.pi * 4 * t)
            frames.append(struct.pack("<h", int(12000 * envelope * math.sin(2 * math.pi * 220 * t))))
        file.writeframes(b"".join(frames))
    return buffer.getvalue()


class FakeProvider:
    provider_name = "fake"

    def __init__(self, identity="fake:model-a", audio=None):
        self.cache_identity = identity
        self.calls = []
        self.audio = audio

    def check(self):
        return None

    def voice_for(self, language, speaker_id):
        return {"baker": "voice-b"}.get(speaker_id, "voice-a")

    def synthesize(self, text, language, voice, rate):
        self.calls.append((text, language, voice, rate))
        if self.audio is not None:
            return SynthesizedAudio(self.audio, "audio/wav", ".wav")
        return SynthesizedAudio("{}|{}|{}".format(text, voice, rate).encode(), "audio/mpeg", ".mp3")


class TTSCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        env = patch.dict(os.environ, {"LANGUAGE_APP_TTS_CACHE_DIR": self.temp_dir.name, "SPEECH_LANGUAGES": "fr,en"})
        env.start()
        self.addCleanup(env.stop)

    def _synthesize(self, provider, text, language="fr", speaker=None, rate="normal"):
        with patch.object(tts_module, "get_tts_provider", return_value=provider):
            return synthesize_speech(text, language, speaker, rate)

    def test_same_line_is_generated_once_then_served_from_cache(self):
        provider = FakeProvider()

        first = self._synthesize(provider, "Bonjour.")
        second = self._synthesize(provider, "Bonjour.")

        self.assertEqual(len(provider.calls), 1)
        self.assertFalse(first.cached)
        self.assertTrue(second.cached)
        self.assertEqual(first.audio.content, second.audio.content)
        self.assertEqual(first.cache_key, second.cache_key)
        self.assertEqual(second.audio.media_type, "audio/mpeg")

    def test_text_language_voice_speed_and_model_are_cached_separately(self):
        provider = FakeProvider()
        self._synthesize(provider, "Bonjour.", "fr")
        self._synthesize(provider, "Bonjour!", "fr")
        self._synthesize(provider, "Bonjour.", "en")
        self._synthesize(provider, "Bonjour.", "fr", speaker="baker")
        self._synthesize(provider, "Bonjour.", "fr", rate="slow")
        self.assertEqual(len(provider.calls), 5)

        other_model = FakeProvider(identity="fake:model-b")
        self._synthesize(other_model, "Bonjour.", "fr")
        self.assertEqual(len(other_model.calls), 1)

    def test_the_mouth_timeline_is_made_once_and_kept_with_the_line(self):
        provider = FakeProvider(audio=spoken_wav())
        first = self._synthesize(provider, "Salut !")
        second = self._synthesize(provider, "Salut !")

        self.assertRegex(first.mouth_timeline, r"^[01]+$")
        self.assertIn("1", first.mouth_timeline)
        self.assertEqual(len(first.mouth_timeline), 20)
        self.assertEqual(second.mouth_timeline, first.mouth_timeline)
        self.assertTrue(second.cached)

    def test_unreadable_audio_has_no_timeline_but_still_plays(self):
        result = self._synthesize(FakeProvider(), "Merci.")
        self.assertIsNone(result.mouth_timeline)
        self.assertTrue(result.audio.content)

    def test_cache_can_be_disabled(self):
        provider = FakeProvider()
        with patch.dict(os.environ, {"LANGUAGE_APP_TTS_CACHE_DIR": "off"}):
            self._synthesize(provider, "Salut.")
            self._synthesize(provider, "Salut.")

        self.assertEqual(len(provider.calls), 2)
        self.assertEqual(list(Path(self.temp_dir.name).iterdir()), [])

    def test_provider_errors_are_not_cached(self):
        provider = FakeProvider()
        provider.synthesize = lambda *args: (_ for _ in ()).throw(tts_module.TTSSynthesisError("boom"))

        with self.assertRaises(tts_module.TTSSynthesisError):
            self._synthesize(provider, "Merci.")

        self.assertEqual(list(Path(self.temp_dir.name).iterdir()), [])

    def test_a_word_in_another_sentence_is_another_line(self):
        calls = []

        class WithContext(FakeProvider):
            def synthesize(self, text, language, voice, rate, context=None):
                calls.append((text, context))
                return super().synthesize(text, language, voice, rate)

        provider = WithContext()
        with patch.object(tts_module, "get_tts_provider", return_value=provider):
            synthesize_speech("Je", "fr", None, "normal", ("", "m'appelle Ella."))
            synthesize_speech("Je", "fr", None, "normal", ("", "m'appelle Ella."))
            synthesize_speech("Je", "fr", None, "normal", ("", "voudrais un café."))
            synthesize_speech("Je", "fr", None, "normal", ("  ", ""))
        self.assertEqual(calls, [("Je", ("", "m'appelle Ella.")), ("Je", ("", "voudrais un café.")), ("Je", None)])

    def test_requests_are_checked_before_anything_is_generated(self):
        provider = FakeProvider()
        for text, language, rate in [("", "fr", "normal"), ("x" * 301, "fr", "normal"), ("Bonjour.", "de", "normal"), ("Bonjour.", "fr", "fast")]:
            with self.assertRaises(ValueError):
                self._synthesize(provider, text, language, rate=rate)
        self.assertEqual(provider.calls, [])


if __name__ == "__main__":
    unittest.main()
