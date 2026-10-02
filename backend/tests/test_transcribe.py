import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np

from app.speech import transcribe as transcribe_module
from app.speech.transcribe import (
    AudioTooLong,
    ElevenLabsSTTProvider,
    FasterWhisperSTTProvider,
    STTConfigurationError,
    STTProviderError,
    Transcription,
    get_stt_provider,
    normalize_language,
    transcribe_audio,
)


class Ready:
    """Pretend the provider finished warming up."""

    def __enter__(self):
        self.patch = patch.dict(transcribe_module._state, {"ready": True, "reason": None})
        self.patch.start()

    def __exit__(self, *exc):
        self.patch.stop()


ELEVENLABS = {"ELEVENLABS_API_KEY": "test-api-key", "LANGUAGE_APP_STT_PROVIDER": "elevenlabs", "SPEECH_LANGUAGES": "fr,en"}


class LanguageTests(unittest.TestCase):
    def test_aliases_normalize(self):
        self.assertEqual(normalize_language(" English "), "en")
        self.assertEqual(normalize_language("FRENCH"), "fr")

    def test_unsupported_language_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported transcription language"):
            normalize_language("es")

    def test_a_language_the_game_does_not_offer_is_rejected(self):
        with patch.dict(os.environ, {"SPEECH_LANGUAGES": "fr"}), Ready():
            with self.assertRaises(ValueError):
                transcribe_audio(b"audio", "en")


class ElevenLabsSTTTests(unittest.TestCase):
    def test_scribe_transcript_is_returned_tidied(self):
        client = Mock()
        client.speech_to_text.convert.return_value = SimpleNamespace(text="  Je  voudrais un café  ")

        with patch.dict(os.environ, ELEVENLABS), patch("elevenlabs.client.ElevenLabs", return_value=client), Ready():
            result = transcribe_audio(b"recording", "french")

        self.assertEqual(result, Transcription("Je voudrais un café", True, None))
        request = client.speech_to_text.convert.call_args.kwargs
        self.assertEqual(request["model_id"], "scribe_v2")
        self.assertEqual(request["language_code"], "fr")
        self.assertFalse(request["tag_audio_events"])
        self.assertFalse(request["diarize"])

    def test_nothing_heard_is_not_an_error(self):
        client = Mock()
        client.speech_to_text.convert.return_value = SimpleNamespace(text="  ")
        with patch.dict(os.environ, ELEVENLABS), patch("elevenlabs.client.ElevenLabs", return_value=client), Ready():
            self.assertEqual(transcribe_audio(b"recording", "fr"), Transcription("", False, None))

    def test_missing_api_key_is_configuration_error(self):
        with patch.dict(os.environ, {"ELEVENLABS_API_KEY": ""}):
            with self.assertRaisesRegex(STTConfigurationError, "ELEVENLABS_API_KEY"):
                ElevenLabsSTTProvider()

    def test_provider_exception_is_wrapped(self):
        client = Mock()
        client.speech_to_text.convert.side_effect = RuntimeError("provider detail")
        with patch.dict(os.environ, ELEVENLABS), patch("elevenlabs.client.ElevenLabs", return_value=client), Ready():
            with self.assertRaisesRegex(STTProviderError, "ElevenLabs speech-to-text failed"):
                transcribe_audio(b"recording", "fr")


def segment(text, no_speech_prob=0.01, avg_logprob=-0.2):
    return SimpleNamespace(text=text, no_speech_prob=no_speech_prob, avg_logprob=avg_logprob)


class FasterWhisperSTTProviderTests(unittest.TestCase):
    def setUp(self):
        transcribe_module._load_whisper_model.cache_clear()
        decode = patch.object(transcribe_module, "decode_audio", return_value=np.zeros(16000, dtype=np.float32))
        self.decode = decode.start()
        self.addCleanup(decode.stop)
        env = patch.dict(os.environ, {"LANGUAGE_APP_STT_PROVIDER": "faster-whisper", "SPEECH_LANGUAGES": "fr,en"})
        env.start()
        self.addCleanup(env.stop)

    def _model(self, *segments):
        model = Mock()
        model.transcribe.return_value = (iter(segments), SimpleNamespace(language="fr"))
        return model

    def _transcribe(self, model, language="fr"):
        with patch.object(transcribe_module, "_load_whisper_model", return_value=model), Ready():
            return transcribe_audio(b"recording", language)

    def test_provider_selected_by_environment(self):
        with patch.object(transcribe_module, "_load_whisper_model", return_value=Mock()):
            self.assertIsInstance(get_stt_provider(), FasterWhisperSTTProvider)

    def test_unknown_provider_is_rejected(self):
        with patch.dict(os.environ, {"LANGUAGE_APP_STT_PROVIDER": "other"}):
            with self.assertRaises(STTConfigurationError):
                get_stt_provider()

    def test_joins_segments_passes_language_and_reports_confidence(self):
        model = self._model(segment("  Je voudrais "), segment(" un café. "))
        result = self._transcribe(model)

        self.assertEqual(result.transcript, "Je voudrais un café.")
        self.assertTrue(result.speech_detected)
        self.assertAlmostEqual(result.confidence, round(np.exp(-0.2), 3))
        kwargs = model.transcribe.call_args.kwargs
        self.assertEqual(kwargs["language"], "fr")
        self.assertEqual(kwargs["task"], "transcribe")
        self.assertTrue(kwargs["vad_filter"])

    def test_silence_and_guesses_are_not_speech(self):
        self.assertEqual(self._transcribe(self._model(segment("   "))), Transcription("", False, None))
        self.assertFalse(self._transcribe(self._model(segment("Merci.", no_speech_prob=0.9))).speech_detected)
        self.assertFalse(self._transcribe(self._model(segment("Bonjour", avg_logprob=-2.0))).speech_detected)

    def test_whispers_invented_subtitles_are_dropped(self):
        result = self._transcribe(self._model(segment("Sous-titres réalisés par la communauté d'Amara.org")))
        self.assertEqual(result, Transcription("", False, None))

    def test_a_recording_longer_than_an_answer_is_refused(self):
        self.decode.return_value = np.zeros(16000 * 30, dtype=np.float32)
        with self.assertRaises(AudioTooLong):
            self._transcribe(self._model(segment("Bonjour")))

    def test_requests_wait_for_the_model_to_be_ready(self):
        with patch.dict(transcribe_module._state, {"ready": False, "reason": "warming up"}):
            with self.assertRaisesRegex(STTConfigurationError, "warming up"):
                transcribe_audio(b"recording", "fr")

    def test_warm_up_reports_readiness(self):
        model = self._model()
        model.transcribe.return_value = (iter([]), None)
        with patch.object(transcribe_module, "_load_whisper_model", return_value=model), patch.dict(transcribe_module._state, {}):
            transcribe_module.warm_up()
            self.assertTrue(transcribe_module.stt_readiness()["ready"])

        with patch.object(transcribe_module, "_load_whisper_model", side_effect=RuntimeError("no model")), patch.dict(transcribe_module._state, {}):
            transcribe_module.warm_up()
            status = transcribe_module.stt_readiness()
            self.assertFalse(status["ready"])
            self.assertIn("no model", status["reason"])


if __name__ == "__main__":
    unittest.main()
