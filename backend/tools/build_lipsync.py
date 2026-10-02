"""Write mouth timelines for Sophie's pre-recorded voice lines.

For every .mp3/.wav in the given folders (default: Scene 1's Sophie audio),
writes "<audio file>.lipsync" next to it: one "0"/"1" per 1/20 s (mouth
closed/open). The game uses it to animate Sophie's mouth in sync with the
line. Re-run after adding or replacing voice lines:

    backend/.venv/bin/python backend/tools/build_lipsync.py
    backend/.venv/bin/python backend/tools/build_lipsync.py game/audio/chapter2/sophie
"""

import subprocess
import sys
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.speech.lipsync import mouth_timeline  # noqa: E402

DEFAULT_FOLDERS = [REPO_ROOT / "game/audio/chapter1/scene1/sophie"]
AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg"}
SAMPLE_RATE = 16000


def load_samples(path: Path) -> np.ndarray:
    try:
        import librosa

        samples, _ = librosa.load(str(path), sr=SAMPLE_RATE, mono=True)
        return samples
    except ImportError:
        raw = subprocess.run(
            ["ffmpeg", "-v", "quiet", "-i", str(path), "-ac", "1",
             "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"],
            capture_output=True,
            check=True,
        ).stdout
        return np.frombuffer(raw, dtype=np.float32)


def main(folders):
    written = 0
    for folder in folders:
        for path in sorted(Path(folder).iterdir()):
            if path.suffix.lower() not in AUDIO_EXTENSIONS:
                continue
            timeline = mouth_timeline(load_samples(path), SAMPLE_RATE)
            path.with_name(path.name + ".lipsync").write_text(timeline + "\n")
            written += 1
            print("{}: {:.1f} s".format(path.name, len(timeline) / 20))
    print("Wrote {} timeline(s).".format(written))


if __name__ == "__main__":
    main([Path(arg) for arg in sys.argv[1:]] or DEFAULT_FOLDERS)
