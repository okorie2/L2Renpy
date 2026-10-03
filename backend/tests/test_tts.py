import os
import subprocess
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from app.speech import tts as tts_module
from app.speech.tts import (
    ElevenLabsTTSProvider,
    SynthesizedAudio,
    SystemTTSProvider,
    TTSConfigurationError,
    TTSSynthesisError,
    get_tts_provider,
)


ENVIRONMENT = {
    "LANGUAGE_APP_TTS_PROVIDER": "elevenlabs",
    "ELEVENLABS_API_KEY": "test-api-key",
    "ELEVENLABS_VOICE_ID": "sophie-test-voice",
    "ELEVENLABS_MODEL_ID": "sophie-test-model",
    "ELEVENLABS_VOICES": "",
}


class ElevenLabsTTSProviderTests(unittest.TestCase):
    def test_provider_selection_uses_elevenlabs_only_when_configured(self):
        with patch.dict(os.environ, ENVIRONMENT, clear=False):
            with patch("elevenlabs.client.ElevenLabs"):
                provider = get_tts_provider()

        self.assertIsInstance(provider, ElevenLabsTTSProvider)

        with patch.dict(os.environ, {"LANGUAGE_APP_TTS_PROVIDER": "other-provider"}, clear=False):
            with self.assertRaises(TTSConfigurationError):
                get_tts_provider()

    def client(self, audio=b"mp3-bytes", text=None):
        import base64
        from types import SimpleNamespace

        client = Mock()
        alignment = None
        if text is not None:
            starts = [index * 0.1 for index in range(len(text))]
            alignment = SimpleNamespace(characters=list(text), character_start_times_seconds=starts, character_end_times_seconds=[t + 0.1 for t in starts])
        client.text_to_speech.convert_with_timestamps.return_value = SimpleNamespace(
            audio_base_64=base64.b64encode(audio).decode(), alignment=alignment
        )
        client.voices.settings.get.return_value = __import__("elevenlabs").VoiceSettings(stability=0.4, similarity_boost=0.8, speed=1.0)
        return client

    def test_synthesis_passes_exact_text_and_the_speakers_voice_and_model(self):
        client = self.client()
        with patch.dict(os.environ, ENVIRONMENT, clear=False):
            with patch("elevenlabs.client.ElevenLabs", return_value=client) as factory:
                provider = ElevenLabsTTSProvider()
                text = "Je m'appelle Emma.\nJ'apprends le français."
                voice = provider.voice_for("fr", "sophie")
                audio = provider.synthesize(text, "fr", voice, "normal")

        factory.assert_called_once_with(api_key="test-api-key")
        call = client.text_to_speech.convert_with_timestamps.call_args
        self.assertEqual(call.args, ("sophie-test-voice",))
        self.assertEqual(call.kwargs["text"], text)
        self.assertEqual(call.kwargs["model_id"], "sophie-test-model")
        self.assertEqual(call.kwargs["output_format"], "mp3_44100_128")
        self.assertEqual(audio.content, b"mp3-bytes")
        self.assertEqual(audio.media_type, "audio/mpeg")

    def test_each_character_can_have_their_own_voice(self):
        environment = dict(ENVIRONMENT, ELEVENLABS_VOICES='{"sophie": "voice-s", "baker": "voice-b"}')
        with patch.dict(os.environ, environment, clear=False), patch("elevenlabs.client.ElevenLabs"):
            provider = ElevenLabsTTSProvider()

        self.assertEqual(provider.voice_for("fr", "sophie"), "voice-s")
        self.assertEqual(provider.voice_for("fr", "baker"), "voice-b")
        # Anyone not listed falls back to ELEVENLABS_VOICE_ID.
        self.assertEqual(provider.voice_for("fr", "neighbor"), "sophie-test-voice")
        self.assertEqual(provider.voice_for("fr", None), "sophie-test-voice")

    def test_speed_is_slower_than_natural_and_keeps_the_voices_own_settings(self):
        client = self.client()
        with patch.dict(os.environ, ENVIRONMENT, clear=False), patch("elevenlabs.client.ElevenLabs", return_value=client):
            provider = ElevenLabsTTSProvider()
            provider.synthesize("Bonjour.", "fr", "v", "normal")
            normal = client.text_to_speech.convert_with_timestamps.call_args.kwargs["voice_settings"]
            provider.synthesize("Bonjour.", "fr", "v", "slow")
            slow = client.text_to_speech.convert_with_timestamps.call_args.kwargs["voice_settings"]

        self.assertEqual(normal.speed, 0.9)
        self.assertEqual(slow.speed, 0.75)
        self.assertEqual((normal.stability, normal.similarity_boost), (0.4, 0.8), "the voice's saved settings are kept")
        client.voices.settings.get.assert_called_once_with("v")

        with patch.dict(os.environ, dict(ENVIRONMENT, ELEVENLABS_SPEED="2"), clear=False), patch("elevenlabs.client.ElevenLabs", return_value=client):
            self.assertEqual(ElevenLabsTTSProvider().speeds["normal"], 1.2, "speeds stay within what ElevenLabs accepts")

    def test_words_are_timed_so_the_game_can_trace_them(self):
        text = "Je m'appelle Ella."
        client = self.client(text=text)
        with patch.dict(os.environ, ENVIRONMENT, clear=False), patch("elevenlabs.client.ElevenLabs", return_value=client):
            audio = ElevenLabsTTSProvider().synthesize(text, "fr", "v", "normal")

        self.assertEqual([text[start:end] for start, end, _, _ in audio.words], ["Je", "m'appelle", "Ella"])
        self.assertEqual(audio.words[1], (3, 12, 0.3, 1.2))

    def test_a_single_word_is_said_with_its_sentence_around_it(self):
        client = self.client()
        with patch.dict(os.environ, ENVIRONMENT, clear=False), patch("elevenlabs.client.ElevenLabs", return_value=client):
            provider = ElevenLabsTTSProvider()
            provider.synthesize("m'appelle", "fr", "v", "normal", ("Je", "Ella."))
            with_context = client.text_to_speech.convert_with_timestamps.call_args.kwargs
            provider.synthesize("Bonjour.", "fr", "v", "normal")
            plain = client.text_to_speech.convert_with_timestamps.call_args.kwargs

        self.assertEqual((with_context["text"], with_context["previous_text"], with_context["next_text"]), ("m'appelle", "Je", "Ella."))
        self.assertNotIn("previous_text", plain)
        self.assertNotIn("language_code", plain, "multilingual v2 works the language out itself")

    def test_models_that_accept_a_language_are_told_it(self):
        client = self.client()
        with patch.dict(os.environ, dict(ENVIRONMENT, ELEVENLABS_MODEL_ID="eleven_flash_v2_5"), clear=False), patch("elevenlabs.client.ElevenLabs", return_value=client):
            ElevenLabsTTSProvider().synthesize("Je", "fr", "v", "normal")
        self.assertEqual(client.text_to_speech.convert_with_timestamps.call_args.kwargs["language_code"], "fr")

    def test_missing_elevenlabs_configuration_is_provider_unavailable(self):
        with patch.dict(os.environ, dict(ENVIRONMENT, ELEVENLABS_API_KEY=""), clear=False):
            with self.assertRaisesRegex(TTSConfigurationError, "ELEVENLABS_API_KEY"):
                ElevenLabsTTSProvider()

    def api_error(self, status, code=None, message="nope", headers=None):
        from elevenlabs.core.api_error import ApiError

        return ApiError(status_code=status, headers=headers or {}, body={"detail": {"status": code, "message": message}})

    def provider(self, client, **env):
        with patch.dict(os.environ, dict(ENVIRONMENT, **env), clear=False), patch("elevenlabs.client.ElevenLabs", return_value=client):
            return ElevenLabsTTSProvider()

    def test_a_provider_failure_says_what_went_wrong(self):
        client = self.client()
        client.text_to_speech.convert_with_timestamps.side_effect = self.api_error(400, "invalid_request", "text is too long")
        provider = self.provider(client)
        with self.assertRaises(TTSSynthesisError) as caught, self.assertLogs("app.speech.tts", "WARNING") as logged:
            provider.synthesize("Bonjour.", "fr", "v", "normal")
        self.assertIn("400", str(caught.exception))
        self.assertIn("invalid_request", str(caught.exception))
        self.assertIn("text is too long", str(caught.exception))
        self.assertEqual((caught.exception.status, caught.exception.code, caught.exception.retryable), (400, "invalid_request", False))
        self.assertEqual(client.text_to_speech.convert_with_timestamps.call_count, 1, "a bad request is not repeated")
        self.assertIn("text is too long", "\n".join(logged.output))

    def test_busy_or_failing_provider_is_tried_again_then_reported(self):
        import base64
        from types import SimpleNamespace

        client = self.client()
        ok = SimpleNamespace(audio_base_64=base64.b64encode(b"mp3").decode(), alignment=None)
        calls = client.text_to_speech.convert_with_timestamps
        calls.side_effect = [self.api_error(429, "too_many_concurrent_requests", "busy", {"retry-after": "1"}), ok]
        provider = self.provider(client)
        with patch("app.speech.tts.time.sleep") as sleep:
            audio = provider.synthesize("Bonjour.", "fr", "v", "normal")
        self.assertEqual(audio.content, b"mp3")
        self.assertEqual(calls.call_count, 2)
        sleep.assert_called_once_with(1.0)
        self.assertEqual(calls.call_args.kwargs["request_options"]["max_retries"], 0, "the SDK does not retry on its own as well")

        calls.reset_mock()
        calls.side_effect = RuntimeError("connection reset")
        with patch("app.speech.tts.time.sleep"), self.assertRaises(TTSSynthesisError) as caught:
            provider.synthesize("Merci.", "fr", "v", "normal")
        self.assertEqual(calls.call_count, 3, "the first try and two more")
        self.assertTrue(caught.exception.retryable)
        self.assertIn("connection reset", str(caught.exception))

    def test_an_exhausted_quota_is_not_retried(self):
        client = self.client()
        client.text_to_speech.convert_with_timestamps.side_effect = self.api_error(401, "quota_exceeded", "You have 0 credits left")
        provider = self.provider(client)
        with patch("app.speech.tts.time.sleep") as sleep, self.assertRaises(TTSSynthesisError) as caught:
            provider.synthesize("Bonjour.", "fr", "v", "normal")
        sleep.assert_not_called()
        self.assertFalse(caught.exception.retryable)
        self.assertIn("quota_exceeded", str(caught.exception))

    def test_only_a_few_requests_go_to_elevenlabs_at_once(self):
        import base64
        import threading
        import time as clock
        from types import SimpleNamespace

        client = self.client()
        running, peak, guard = [0], [0], threading.Lock()

        def slow(*_, **__):
            with guard:
                running[0] += 1
                peak[0] = max(peak[0], running[0])
            clock.sleep(0.05)
            with guard:
                running[0] -= 1
            return SimpleNamespace(audio_base_64=base64.b64encode(b"mp3").decode(), alignment=None)

        client.text_to_speech.convert_with_timestamps.side_effect = slow
        provider = self.provider(client, ELEVENLABS_MAX_CONCURRENCY="2")
        threads = [threading.Thread(target=provider.synthesize, args=(f"Ligne {n}.", "fr", "v", "normal")) for n in range(6)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(peak[0], 2)

    def test_empty_provider_audio_is_rejected(self):
        client = self.client(audio=b"")
        with patch.dict(os.environ, ENVIRONMENT, clear=False):
            with patch("elevenlabs.client.ElevenLabs", return_value=client):
                provider = ElevenLabsTTSProvider()
                with self.assertRaisesRegex(TTSSynthesisError, "returned no audio"):
                    provider.synthesize("Bonjour.", "fr", "v", "normal")


SAY_VOICES = """Amélie              fr_CA    # Bonjour, je m’appelle Amélie.
Thomas              fr_FR    # Bonjour, je m’appelle Thomas.
Audrey (Enhanced)   fr_FR    # Bonjour, je m’appelle Audrey.
Flo (French (France)) fr_FR    # Bonjour, je m’appelle Flo.
"""


class SystemTTSProviderTests(unittest.TestCase):
    def provider(self):
        with patch.dict(os.environ, {"SYSTEM_VOICES": ""}):
            provider = SystemTTSProvider()
        with patch.object(tts_module.shutil, "which", return_value="/usr/bin/say"), patch.object(
            tts_module.subprocess, "run", return_value=Mock(stdout=SAY_VOICES)
        ):
            provider.installed_voices()
        return provider

    def test_voices_are_chosen_per_speaker_best_installed_first(self):
        provider = self.provider()
        self.assertEqual(provider.voice_for("fr", "sophie"), "Audrey (Enhanced)")
        self.assertEqual(provider.voice_for("fr", "baker"), "Thomas")
        # Jacques is not installed here, so the neighbour gets the default voice.
        self.assertEqual(provider.voice_for("fr", "neighbor"), "Audrey (Enhanced)")
        self.assertEqual(provider.voice_for("fr", "someone-new"), "Audrey (Enhanced)")
        with self.assertRaises(TTSConfigurationError):
            provider.voice_for("de", "sophie")

    def test_say_is_asked_for_a_wav_at_the_requested_speed(self):
        provider = self.provider()

        def fake_say(command, **_):
            Path(command[command.index("-o") + 1]).write_bytes(b"RIFFwav")
            return Mock()

        with patch.object(tts_module.subprocess, "run", side_effect=fake_say) as run:
            audio = provider.synthesize("Bonjour.", "fr", "Thomas", "slow")
        command = run.call_args.args[0]
        self.assertEqual(command[:3], ["say", "-v", "Thomas"])
        self.assertEqual(command[command.index("-r") + 1], "115")
        self.assertEqual(command[-1], "Bonjour.")
        self.assertEqual(audio, SynthesizedAudio(b"RIFFwav", "audio/wav", ".wav"))

    def test_a_failing_say_is_a_synthesis_error(self):
        provider = self.provider()
        with patch.object(tts_module.subprocess, "run", side_effect=subprocess.CalledProcessError(1, "say")):
            with self.assertRaises(TTSSynthesisError):
                provider.synthesize("Bonjour.", "fr", "Thomas", "normal")

    def test_without_say_the_provider_is_not_ready(self):
        with patch.dict(os.environ, {"SYSTEM_VOICES": ""}):
            provider = SystemTTSProvider()
        with patch.object(tts_module.shutil, "which", return_value=None):
            with self.assertRaisesRegex(TTSConfigurationError, "say"):
                provider.check()


if __name__ == "__main__":
    unittest.main()
