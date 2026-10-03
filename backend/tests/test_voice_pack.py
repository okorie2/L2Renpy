"""The voice pack tool: lines in, audio files and a manifest out, nothing paid for twice."""

import importlib.util
import json
import os
from unittest.mock import patch

from app.speech import tts
from tests.test_tts_cache import FakeProvider, spoken_wav

spec = importlib.util.spec_from_file_location("build_voice_pack", os.path.join(os.path.dirname(__file__), "..", "tools", "build_voice_pack.py"))
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class Timed(FakeProvider):
    def synthesize(self, text, language, voice, rate):
        self.calls.append((text, rate))
        return tts.SynthesizedAudio(spoken_wav(0.5), "audio/wav", ".wav", words=[(0, len(text), 0.0, 0.4)])


def run(tmp_path, *args):
    with patch.object(tool, "LINES", tmp_path / "lines.json"), patch.object(tool, "PACK", tmp_path / "pack"), patch.object(tool, "REPO", tmp_path), \
            patch("sys.argv", ["build_voice_pack.py", *args]):
        return tool.main()


def test_the_pack_is_made_once_and_lists_everything_the_game_needs(tmp_path):
    (tmp_path / "lines.json").write_text(json.dumps([
        {"speakerId": "sophie", "languageCode": "fr", "text": "Salut !", "rate": "normal"},
        {"speakerId": "sophie", "languageCode": "fr", "text": "Salut !", "rate": "slow"},
        {"languageCode": "fr", "text": "bonjour", "rate": "normal"},
    ]))
    provider = Timed()
    with patch.dict(os.environ, {"LANGUAGE_APP_TTS_CACHE_DIR": str(tmp_path / "cache"), "SPEECH_LANGUAGES": "fr"}), \
            patch.object(tts, "get_tts_provider", return_value=provider):
        assert run(tmp_path, "--dry-run") == 0
        assert provider.calls == [], "a dry run costs nothing"
        assert run(tmp_path) == 0
        assert run(tmp_path) == 0

    assert len(provider.calls) == 3, "each line is generated once, however often the tool runs"
    manifest = json.loads((tmp_path / "pack" / "manifest.json").read_text())
    assert [(entry.get("speakerId"), entry["text"], entry["rate"]) for entry in manifest] == [
        ("sophie", "Salut !", "normal"), ("sophie", "Salut !", "slow"), (None, "bonjour", "normal"),
    ]
    assert manifest[0]["words"] == [[0, 7, 0, 400]]
    assert set(manifest[0]["mouth"]) <= {"0", "1"}
    assert all((tmp_path / "pack" / entry["file"]).read_bytes()[:4] == b"RIFF" for entry in manifest)


def test_files_are_only_removed_on_request(tmp_path):
    (tmp_path / "lines.json").write_text(json.dumps([{"speakerId": "sophie", "languageCode": "fr", "text": "Salut !", "rate": "normal"}]))
    (tmp_path / "pack").mkdir()
    (tmp_path / "pack" / "old-line.mp3").write_bytes(b"x")
    with patch.dict(os.environ, {"LANGUAGE_APP_TTS_CACHE_DIR": str(tmp_path / "cache"), "SPEECH_LANGUAGES": "fr"}), \
            patch.object(tts, "get_tts_provider", return_value=Timed()):
        run(tmp_path)
        assert (tmp_path / "pack" / "old-line.mp3").exists()
        run(tmp_path, "--prune")
        assert not (tmp_path / "pack" / "old-line.mp3").exists()


def test_words_are_generated_in_their_sentence_and_recordings_are_timed(tmp_path):
    from types import SimpleNamespace

    (tmp_path / "lines.json").write_text(json.dumps([
        {"speakerId": "sophie", "languageCode": "fr", "text": "m'appelle", "rate": "normal", "context": {"before": "Je", "after": "Marie."}},
    ]))
    (tmp_path / "recorded.json").write_text(json.dumps([{"path": "voices/hi.mp3", "text": "Hi! I'm Sophie."}]))
    (tmp_path / "assets" / "voices").mkdir(parents=True)
    (tmp_path / "assets" / "voices" / "hi.mp3").write_bytes(b"mp3")
    contexts = []

    class Aligning(Timed):
        def __init__(self):
            super().__init__()
            self.client = SimpleNamespace(forced_alignment=SimpleNamespace(create=lambda file, text: SimpleNamespace(words=[
                SimpleNamespace(text="Hi!", start=0.0, end=0.3), SimpleNamespace(text=" ", start=0.3, end=0.35),
                SimpleNamespace(text="I'm", start=0.35, end=0.6), SimpleNamespace(text="Sophie.", start=0.6, end=1.1),
            ])))

        def synthesize(self, text, language, voice, rate, context=None):
            contexts.append(context)
            return super().synthesize(text, language, voice, rate)

    with patch.dict(os.environ, {"LANGUAGE_APP_TTS_CACHE_DIR": str(tmp_path / "cache"), "SPEECH_LANGUAGES": "fr"}), \
            patch.object(tts, "get_tts_provider", return_value=Aligning()), \
            patch.object(tool, "RECORDED", tmp_path / "recorded.json"), patch.object(tool, "ASSETS", tmp_path / "assets"):
        run(tmp_path)

    assert contexts == [("Je", "Marie.")]
    manifest = json.loads((tmp_path / "pack" / "manifest.json").read_text())
    assert manifest[0]["text"] == "m'appelle" and "context" not in manifest[0], "the game finds the word by itself"
    timings = json.loads((tmp_path / "pack" / "recordings.json").read_text())
    assert timings == {"voices/hi.mp3": [[0, 3, 0, 300], [4, 7, 350, 600], [8, 15, 600, 1100]]}
