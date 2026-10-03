#!/usr/bin/env python3
"""Generate the voice pack: every line that is the same for every player, as
audio files shipped with the game, so they are never generated again.

    cd frontend && npm run voices:list          # which lines (tools/voice-lines.json)
    cd backend && .venv/bin/python tools/build_voice_pack.py --dry-run   # what it would cost
    cd backend && .venv/bin/python tools/build_voice_pack.py             # make them

Lines go through the normal speech path, so anything already in .tts_cache is
reused and costs nothing. Each line is written to
frontend/public/assets/voices/pack/ with its lip-sync track and word timings in
manifest.json. Commit that folder. Files are never deleted by this tool;
--prune removes only files for lines the game no longer has.

Lines with the player's name in them are not in the list; the backend makes
those live. Re-run after changing dialogue, the voices or the speed.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
sys.path.insert(0, str(BACKEND))

from app.speech import tts  # noqa: E402

LINES = REPO / "frontend" / "tools" / "voice-lines.json"
RECORDED = REPO / "frontend" / "tools" / "recorded-lines.json"
ASSETS = REPO / "frontend" / "public" / "assets"
PACK = REPO / "frontend" / "public" / "assets" / "voices" / "pack"


def word_spans(text: str, words: list) -> list[list[int]]:
    """Place aligned words back in the text: [start, end, fromMs, toMs] for each."""

    spans, cursor = [], 0
    for word in words:
        token = (getattr(word, "text", "") or "").strip()
        if not token:
            continue
        start = text.find(token, cursor)
        if start < 0:
            continue
        spans.append([start, start + len(token), round(float(word.start) * 1000), round(float(word.end) * 1000)])
        cursor = start + len(token)
    return spans


def align_recordings(provider) -> None:
    """Word timings for the recorded lines (Sophie's welcome), so they are traced too.

    Uses ElevenLabs forced alignment once per recording; results are kept in
    voices/pack/recordings.json and not asked for again.
    """

    if not RECORDED.exists() or not hasattr(provider, "client"):
        return
    path = PACK / "recordings.json"
    known = json.loads(path.read_text("utf-8")) if path.exists() else {}
    for line in json.loads(RECORDED.read_text("utf-8")):
        if line["path"] in known:
            continue
        audio = ASSETS / line["path"]
        try:
            with audio.open("rb") as file:
                result = provider.client.forced_alignment.create(file=file, text=line["text"])
        except Exception as exc:  # noqa: BLE001 - a recording without timings is simply not traced
            print(f"  could not align {line['path']}: {exc}")
            continue
        known[line["path"]] = word_spans(line["text"], result.words or [])
        print(f"  aligned {line['path']}")
    path.write_text(json.dumps(known, ensure_ascii=False, indent=1) + "\n", "utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="say what would be generated, and how many characters, without calling the voice provider")
    parser.add_argument("--prune", action="store_true", help="remove pack files for lines the game no longer has")
    args = parser.parse_args()

    lines = json.loads(LINES.read_text("utf-8"))
    provider = tts.get_tts_provider()
    print(f"{len(lines)} lines in {LINES.relative_to(REPO)}; voice provider: {tts.provider_name()}")

    cache_dir = tts._tts_cache_dir()
    to_generate = []
    for line in lines:
        voice = provider.voice_for(line["languageCode"], line.get("speakerId"))
        context = line.get("context")
        spoken = line["text"] if not context else "{}\u241e{}\u241e{}".format(context.get("before", ""), line["text"], context.get("after", ""))
        key = tts.tts_cache_key(provider.cache_identity, voice, line["languageCode"], line["rate"], spoken)
        cached = cache_dir is not None and tts._read_cached(cache_dir, key) is not None
        if not cached:
            to_generate.append(line)
    characters = sum(len(line["text"]) for line in to_generate)
    print(f"{len(lines) - len(to_generate)} already made (free); {len(to_generate)} to generate, {characters} characters")
    if args.dry_run:
        return 0

    PACK.mkdir(parents=True, exist_ok=True)
    manifest = []
    for number, line in enumerate(lines, start=1):
        context = line.get("context")
        result = tts.synthesize_speech(
            line["text"], line["languageCode"], line.get("speakerId"), line["rate"],
            (context.get("before", ""), context.get("after", "")) if context else None,
        )
        file = result.cache_key + result.audio.file_extension
        target = PACK / file
        if not target.exists():
            target.write_bytes(result.audio.content)
        entry = {
            "languageCode": line["languageCode"],
            "text": line["text"],
            "rate": line["rate"],
            "file": file,
        }
        if line.get("speakerId"):
            entry["speakerId"] = line["speakerId"]
        if result.mouth_timeline:
            entry["mouth"] = result.mouth_timeline
        if result.audio.words:
            entry["words"] = [[start, end, round(t0 * 1000), round(t1 * 1000)] for start, end, t0, t1 in result.audio.words]
        manifest.append(entry)
        if number % 20 == 0:
            print(f"  {number}/{len(lines)}")

    (PACK / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", "utf-8")
    align_recordings(provider)
    if args.prune:
        keep = {entry["file"] for entry in manifest} | {"manifest.json", "recordings.json"}
        for path in PACK.iterdir():
            if path.name not in keep:
                path.unlink()
                print(f"  removed {path.name}")
    size = sum(path.stat().st_size for path in PACK.iterdir()) / 1_000_000
    print(f"Wrote {len(manifest)} lines to {PACK.relative_to(REPO)} ({size:.1f} MB). Commit it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
