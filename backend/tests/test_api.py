"""The HTTP contract the game relies on (frontend/src/speech/http*.ts, conversation/httpJudge.ts).

Providers are faked; models are never loaded. The client is used without its
context manager, so the startup warm-up does not run.
"""

import io
import json
import os
import tempfile
import wave
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app import main
from app.conversation.service import ChatReply, ConversationService
from app.speech import transcribe as stt
from app.speech import tts
from tests.test_conversation import FakeModel, body
from tests.test_tts_cache import FakeProvider, spoken_wav

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def isolated(tmp_path):
    with patch.dict(os.environ, {"LANGUAGE_APP_TTS_CACHE_DIR": str(tmp_path), "SPEECH_LANGUAGES": "fr"}):
        tts.reset_readiness()
        yield
        tts.reset_readiness()


def with_voice(provider):
    return patch.object(tts, "get_tts_provider", return_value=provider)


def test_liveness():
    assert client.get("/health").json() == {"status": "ok"}


def test_readiness_follows_the_voice_and_reports_the_rest():
    with patch.dict(os.environ, {"LANGUAGE_APP_TTS_PROVIDER": "none"}):
        response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["status"] == "not-ready"

    tts.reset_readiness()
    with with_voice(FakeProvider()), patch.dict(stt._state, {"ready": False, "reason": "warming up"}):
        response = client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["speech"]["ready"] is True
    assert data["recognition"]["ready"] is False
    assert set(data) >= {"pronunciation", "conversation"}


def test_capabilities_tell_the_game_what_to_offer():
    with with_voice(FakeProvider()), patch.dict(stt._state, {"ready": True, "reason": None}):
        capabilities = client.get("/speech/capabilities").json()
        assert (capabilities["synthesis"], capabilities["recognition"]) == (True, True)
    tts.reset_readiness()
    with patch.dict(os.environ, {"LANGUAGE_APP_TTS_PROVIDER": "none"}), patch.dict(stt._state, {"ready": False, "reason": "x"}):
        assert client.get("/speech/capabilities").json() == {"synthesis": False, "recognition": False, "pronunciation": False}


def test_a_line_comes_back_as_audio_with_its_mouth_timeline():
    provider = FakeProvider(audio=spoken_wav())
    with with_voice(provider):
        first = client.post("/speech/synthesize", json={"text": "Bonjour !", "languageCode": "fr", "speakerId": "baker", "rate": "slow"})
        second = client.post("/speech/synthesize", json={"text": "Bonjour !", "languageCode": "fr", "speakerId": "baker", "rate": "slow"})

    assert first.status_code == 200
    assert first.headers["content-type"] == "audio/wav"
    assert first.content == spoken_wav()
    assert first.headers["x-speech-cache"] == "miss"
    assert second.headers["x-speech-cache"] == "hit"
    assert first.headers["x-mouth-fps"] == "20"
    assert set(first.headers["x-mouth-timeline"]) <= {"0", "1"}
    assert provider.calls == [("Bonjour !", "fr", "voice-b", "slow")], "the speaker picks the voice; the client never names one"


def test_bad_synthesis_requests_are_400_and_a_missing_voice_is_503():
    with with_voice(FakeProvider()):
        for request in [{"text": ""}, {"text": "x" * 400}, {"text": "Bonjour", "languageCode": "de"}, {"text": "Bonjour", "rate": "fast"}]:
            assert client.post("/speech/synthesize", json=request).status_code == 400
    with patch.dict(os.environ, {"LANGUAGE_APP_TTS_PROVIDER": "none"}):
        assert client.post("/speech/synthesize", json={"text": "Bonjour", "languageCode": "fr"}).status_code == 503


def test_the_installed_app_may_call_the_api_and_read_the_lip_sync_headers():
    response = client.options(
        "/speech/synthesize",
        headers={"Origin": "capacitor://localhost", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "capacitor://localhost"

    with with_voice(FakeProvider(audio=spoken_wav())):
        response = client.post("/speech/synthesize", json={"text": "Salut", "languageCode": "fr"}, headers={"Origin": "capacitor://localhost"})
    exposed = response.headers["access-control-expose-headers"].lower()
    assert "x-mouth-timeline" in exposed and "x-mouth-fps" in exposed

    other = client.options(
        "/speech/synthesize",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in other.headers


def silence_wav(seconds=0.5) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(16000)
        file.writeframes(b"\x00\x00" * int(16000 * seconds))
    return buffer.getvalue()


class FakeRecognizer:
    def __init__(self):
        self.calls = []

    def transcribe(self, audio, language):
        self.calls.append((audio, language))
        return stt.Transcription("Je voudrais un café", True, 0.82)


def post_answer(data, language="fr", filename="answer.m4a", content_type="audio/mp4"):
    return client.post("/speech/transcribe", files={"audio": (filename, data, content_type)}, data={"languageCode": language})


def test_a_spoken_answer_comes_back_as_words():
    recognizer = FakeRecognizer()
    with patch.object(stt, "get_stt_provider", return_value=recognizer), patch.dict(stt._state, {"ready": True, "reason": None}):
        response = post_answer(b"recording")
    assert response.status_code == 200
    assert response.json() == {"transcript": "Je voudrais un café", "speechDetected": True, "confidence": 0.82, "language": "fr"}
    assert recognizer.calls == [(b"recording", "fr")]


def test_recognition_failures_have_statuses_the_game_understands():
    with patch.dict(stt._state, {"ready": False, "reason": "warming up"}):
        assert post_answer(b"recording").status_code == 503
    with patch.dict(stt._state, {"ready": True, "reason": None}):
        assert post_answer(b"").status_code == 400
        assert post_answer(b"recording", language="de").status_code == 400
        assert post_answer(b"x" * (3 * 1024 * 1024 + 1)).status_code == 413
        assert client.post("/speech/transcribe", data={"languageCode": "fr"}).status_code == 400


def test_real_recordings_are_decoded_before_whisper_hears_them():
    """The local provider decodes with PyAV; garbage is 422, silence is 'nothing heard'."""
    heard = []

    class Model:
        def transcribe(self, samples, **kwargs):
            heard.append(len(samples))
            return iter([]), None

    with patch.dict(os.environ, {"LANGUAGE_APP_STT_PROVIDER": "faster-whisper"}), patch.object(
        stt, "_load_whisper_model", return_value=Model()
    ), patch.dict(stt._state, {"ready": True, "reason": None}):
        response = post_answer(silence_wav(0.5), filename="answer.wav", content_type="audio/wav")
        assert response.status_code == 200
        assert response.json()["speechDetected"] is False
        assert heard == [8000]
        assert post_answer(b"not audio at all").status_code == 422


def test_a_second_opinion_is_advice_with_clear_failure_statuses():
    model = FakeModel()
    with patch.object(main, "conversation", ConversationService(model, use_configured_model=False)):
        assert client.get("/conversation/capabilities").json() == {"judgement": True}
        response = client.post("/conversation/turn", json=body())
        assert response.status_code == 200
        assert response.json() == {"detectedIntent": "orderDrink", "confidence": 0.9}
        assert client.post("/conversation/turn", json=body(utterance="")).status_code == 400
        bad_json = client.post("/conversation/turn", content=b"{not json", headers={"Content-Type": "application/json"})
        assert bad_json.status_code == 400, "the game treats 400 as 'not this request', not 'service down'"

    with patch.object(main, "conversation", ConversationService(None, use_configured_model=False)):
        assert client.get("/conversation/capabilities").json() == {"judgement": False}
        assert client.post("/conversation/turn", json=body()).status_code == 503


def test_pronunciation_needs_both_recordings_and_reference_text():
    response = client.post("/speech/pronunciation", data={"reference_text": "Bonjour"})
    assert response.status_code == 400
    response = client.post("/speech/pronunciation", data={"reference_text": " "}, files={"learner_audio": ("a.wav", b"x")})
    assert response.status_code == 400
