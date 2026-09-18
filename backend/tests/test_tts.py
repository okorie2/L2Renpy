import os
import unittest
from unittest.mock import Mock, patch

from app.speech.tts import (
    ElevenLabsTTSProvider,
    SynthesizedAudio,
    TTSConfigurationError,
    TTSSynthesisError,
    get_tts_provider,
)


ENVIRONMENT = {
    "LANGUAGE_APP_TTS_PROVIDER": "elevenlabs",
    "ELEVENLABS_API_KEY": "test-api-key",
    "ELEVENLABS_VOICE_ID": "sophie-test-voice",
    "ELEVENLABS_MODEL_ID": "sophie-test-model",
}


class ElevenLabsTTSProviderTests(unittest.TestCase):
    def test_provider_selection_uses_elevenlabs_only_when_configured(self):
        with patch.dict(os.environ, ENVIRONMENT, clear=False):
            with patch("elevenlabs.client.ElevenLabs"):
                provider = get_tts_provider()

        self.assertIsInstance(provider, ElevenLabsTTSProvider)

        with patch.dict(
            os.environ,
            {"LANGUAGE_APP_TTS_PROVIDER": "other-provider"},
            clear=False,
        ):
            with self.assertRaises(TTSConfigurationError):
                get_tts_provider()

    def test_synthesis_passes_exact_text_and_configured_voice_and_model(self):
        client = Mock()
        client.text_to_speech.convert.return_value = iter(
            [b"mp3-part-1", b"", b"mp3-part-2"]
        )

        with patch.dict(os.environ, ENVIRONMENT, clear=False):
            with patch(
                "elevenlabs.client.ElevenLabs",
                return_value=client,
            ) as factory:
                provider = ElevenLabsTTSProvider()
                text = "Je m'appelle Emma.\nJ'ai dix-sept ans."
                audio = provider.synthesize(text, "fr")

        factory.assert_called_once_with(api_key="test-api-key")
        client.text_to_speech.convert.assert_called_once_with(
            text=text,
            voice_id="sophie-test-voice",
            model_id="sophie-test-model",
            output_format="mp3_44100_128",
        )
        self.assertEqual(
            audio,
            SynthesizedAudio(
                b"mp3-part-1mp3-part-2",
                "audio/mpeg",
                ".mp3",
            ),
        )

    def test_missing_elevenlabs_configuration_is_provider_unavailable(self):
        missing_environment = dict(ENVIRONMENT)
        missing_environment["ELEVENLABS_API_KEY"] = ""

        with patch.dict(os.environ, missing_environment, clear=False):
            with self.assertRaisesRegex(
                TTSConfigurationError,
                "ELEVENLABS_API_KEY",
            ):
                ElevenLabsTTSProvider()

    def test_provider_failure_is_not_exposed_as_raw_sdk_exception(self):
        client = Mock()
        client.text_to_speech.convert.side_effect = RuntimeError("provider detail")

        with patch.dict(os.environ, ENVIRONMENT, clear=False):
            with patch("elevenlabs.client.ElevenLabs", return_value=client):
                provider = ElevenLabsTTSProvider()
                with self.assertRaisesRegex(
                    TTSSynthesisError,
                    "ElevenLabs speech synthesis failed",
                ):
                    provider.synthesize("Bonjour.", "fr")

    def test_empty_provider_audio_is_rejected(self):
        client = Mock()
        client.text_to_speech.convert.return_value = iter([b"", b""])

        with patch.dict(os.environ, ENVIRONMENT, clear=False):
            with patch("elevenlabs.client.ElevenLabs", return_value=client):
                provider = ElevenLabsTTSProvider()
                with self.assertRaisesRegex(
                    TTSSynthesisError,
                    "returned no audio",
                ):
                    provider.synthesize("Bonjour.", "fr")


if __name__ == "__main__":
    unittest.main()
