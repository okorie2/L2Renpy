"""End-to-end checks against the real model. Speech comes from the macOS `say` command."""

import shutil
import subprocess
import wave

import pytest
from fastapi.testclient import TestClient

from app.main import app

needs_say = pytest.mark.skipif(shutil.which("say") is None, reason="needs the macOS say command")


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def spoken(tmp_path, text: str, voice: str = "Thomas") -> bytes:
    path = tmp_path / "line.wav"
    subprocess.run(["say", "-v", voice, "-o", str(path), "--data-format=LEI16@16000", "--", text], check=True)
    return path.read_bytes()


def silence(tmp_path, seconds: float = 1.5) -> bytes:
    path = tmp_path / "silence.wav"
    with wave.open(str(path), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(16000)
        file.writeframes(b"\x00\x00" * int(16000 * seconds))
    return path.read_bytes()


def post(client, data: bytes, language: str = "fr"):
    return client.post("/transcribe", files={"audio": ("line.wav", data, "audio/wav")}, data={"language": language})


def test_health_and_readiness(client):
    assert client.get("/health").json() == {"status": "ok"}
    ready = client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"


@needs_say
def test_french_speech_is_transcribed(client, tmp_path):
    response = post(client, spoken(tmp_path, "Bonjour ! Je voudrais un café, s'il vous plaît."))
    assert response.status_code == 200
    body = response.json()
    assert body["speechDetected"] is True
    words = body["transcript"].lower()
    assert "café" in words and "voudrais" in words
    assert 0 < body["confidence"] <= 1


def test_silence_is_not_speech(client, tmp_path):
    body = post(client, silence(tmp_path)).json()
    assert body == {"transcript": "", "speechDetected": False, "confidence": None, "language": "fr"}


def test_bad_requests_are_rejected(client, tmp_path):
    assert post(client, silence(tmp_path), language="xx").status_code == 400
    assert post(client, b"").status_code == 400
    assert post(client, b"this is not audio").status_code == 422
    assert post(client, b"\x00" * (3 * 1024 * 1024 + 1)).status_code == 413
    assert post(client, silence(tmp_path, seconds=25)).status_code == 413
