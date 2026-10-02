"""Pronunciation practice as the game asks for it. The phoneme model is faked."""

import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app import main
from app.speech import practice, tts
from app.speech.audio import AudioError
from tests.test_tts_cache import FakeProvider, spoken_wav

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def isolated(tmp_path):
    with patch.dict(os.environ, {"LANGUAGE_APP_TTS_CACHE_DIR": str(tmp_path), "SPEECH_LANGUAGES": "fr"}):
        tts.reset_readiness()
        yield


def fake_evaluation(**kwargs):
    fake_evaluation.calls.append(kwargs)
    with open(kwargs["reference_audio_path"], "rb") as reference, open(kwargs["learner_audio_path"], "rb") as learner:
        assert reference.read(4) == b"RIFF" and learner.read(4) == b"RIFF", "the evaluator is given plain WAV files"
    return {
        "pronunciation_similarity": 0.62,
        "word_results": [
            {"index": 0, "word": "Je", "score": 1.0, "scorable": True, "phonetic_guide": "zhuh"},
            {"index": 1, "word": "m'appelle", "score": 0.5, "scorable": True, "phonetic_guide": "mah-pehl"},
            {"index": 2, "word": "Ella", "score": None, "scorable": False, "phonetic_guide": "eh-lah"},
        ],
        "weakest_word": {"index": 1, "word": "m'appelle", "score": 0.5, "scorable": True, "phonetic_guide": "mah-pehl"},
    }


fake_evaluation.calls = []


def test_excluded_words_become_word_spans():
    assert practice.excluded_spans("Je m'appelle Anne Marie.", ["Anne Marie"]) == [{"start": 2, "end": 4, "label": "excluded"}]
    assert practice.excluded_spans("Je m'appelle Ella.", ["ella"]) == [{"start": 2, "end": 3, "label": "excluded"}]
    assert practice.excluded_spans("Je m'appelle Ella.", ["Zoé", ""]) == []


def test_an_attempt_is_compared_with_the_characters_own_voice():
    fake_evaluation.calls.clear()
    provider = FakeProvider(audio=spoken_wav())
    with patch.object(tts, "get_tts_provider", return_value=provider):
        result = practice.evaluate_attempt(spoken_wav(), " Je  m'appelle Ella. ", "fr", "sophie", ["Ella"], evaluate=fake_evaluation)

    assert provider.calls == [("Je m'appelle Ella.", "fr", "voice-a", "normal")], "the reference is the line as Sophie says it"
    call = fake_evaluation.calls[0]
    assert call["reference_text"] == "Je m'appelle Ella."
    assert call["evaluation_exclusions"] == [{"start": 2, "end": 3, "label": "excluded"}]
    assert result["similarity"] == 0.62
    assert [(w["word"], w["scored"], w["needsPractice"]) for w in result["words"]] == [
        ("Je", True, False), ("m'appelle", True, True), ("Ella", False, False),
    ]
    assert result["weakestWord"]["word"] == "m'appelle"
    assert result["weakestWord"]["phoneticGuide"] == "mah-pehl"


def test_bad_attempts_are_refused_before_any_work():
    for args in [(b"", "Bonjour"), (spoken_wav(), ""), (spoken_wav(), "x" * 201)]:
        with pytest.raises(ValueError):
            practice.evaluate_attempt(*args, evaluate=fake_evaluation)
    with pytest.raises(ValueError):
        practice.evaluate_attempt(spoken_wav(), "Hello", "en", evaluate=fake_evaluation)
    with pytest.raises(AudioError):
        practice.evaluate_attempt(b"not audio", "Bonjour", evaluate=fake_evaluation)


def post(**data):
    files = {"audio": ("attempt.m4a", data.pop("audio", spoken_wav()), "audio/mp4")}
    return client.post("/speech/practice", files=files, data={"languageCode": "fr", **data})


def test_the_practice_endpoint():
    with patch.object(tts, "get_tts_provider", return_value=FakeProvider(audio=spoken_wav())), patch.object(
        practice, "available", return_value=True
    ), patch.object(practice, "_default_evaluator", return_value=fake_evaluation):
        response = post(text="Je m'appelle Ella.", speakerId="sophie", excluded='["Ella"]')
        assert response.status_code == 200
        assert response.json()["weakestWord"]["word"] == "m'appelle"
        assert post(text="Bonjour", excluded="not json").status_code == 400
        assert post(text="").status_code == 400
        assert post(text="Bonjour", audio=b"garbage").status_code == 422

    with patch.object(practice, "available", return_value=False):
        assert post(text="Bonjour").status_code == 503


def test_capabilities_say_whether_practice_is_possible():
    with patch.object(tts, "get_tts_provider", return_value=FakeProvider()), patch.object(practice, "available", return_value=True):
        assert client.get("/speech/capabilities").json()["pronunciation"] is True
    with patch.object(practice, "available", return_value=False):
        assert client.get("/speech/capabilities").json()["pronunciation"] is False


def test_welcome_lines_can_be_voiced_in_english():
    with patch.object(tts, "get_tts_provider", return_value=FakeProvider()):
        response = client.post("/speech/synthesize", json={"text": "Nice to meet you, Ella!", "languageCode": "en", "speakerId": "sophie"})
    assert response.status_code == 200
