# Sophie's talking animation ("lip-flap"), driven by her actual voice.
#
# Each speaking pose has a closed-mouth and an open-mouth image. The mouth
# only moves while something is playing on the voice channel, and follows a
# precomputed mouth timeline for that clip ("0"/"1" per 1/20 s, see
# backend/app/speech/lipsync.py):
#   - pre-recorded lines: "<audio file>.lipsync" next to the audio
#     (generate with backend/tools/build_lipsync.py);
#   - generated lines: sent by the backend with the audio (X-Sophie-Mouth).
# Clips without a timeline fall back to a simple steady flap while playing.
# When nothing is playing, the mouth stays closed, whatever pose is shown.

init -5 python:
    SOPHIE_MOUTH_FPS = 20
    SOPHIE_FALLBACK_FLAPS_PER_SECOND = 3.0

    # filename (as played on the voice channel) -> timeline, or None if the
    # clip has none. Generated lines are registered by synthesize_speech().
    _sophie_mouth_timelines = {}


    def register_sophie_mouth_timeline(filename, timeline):
        timeline = (timeline or "").strip()
        if timeline and set(timeline) <= {"0", "1"}:
            _sophie_mouth_timelines[filename] = timeline


    def _sophie_mouth_timeline(filename):
        if filename in _sophie_mouth_timelines:
            return _sophie_mouth_timelines[filename]

        timeline = None
        path = filename + ".lipsync"
        try:
            if renpy.loadable(path):
                with renpy.open_file(path) as timeline_file:
                    timeline = timeline_file.read().decode("utf-8").strip() or None
        except Exception as exc:
            renpy.log("Lip-sync: could not read {}: {!r}".format(path, exc))

        _sophie_mouth_timelines[filename] = timeline
        return timeline


    def sophie_mouth_open():
        """True when Sophie's mouth should be open right now."""

        if not renpy.music.is_playing(channel="voice"):
            return False

        filename = renpy.music.get_playing(channel="voice")
        position = renpy.music.get_pos(channel="voice")
        if not filename or position is None:
            return False

        timeline = _sophie_mouth_timeline(filename)
        if timeline:
            index = int(position * SOPHIE_MOUTH_FPS)
            return index < len(timeline) and timeline[index] == "1"

        return int(position * SOPHIE_FALLBACK_FLAPS_PER_SECOND * 2) % 2 == 0


    def _sophie_talking(st, at, closed, opened):
        return (opened if sophie_mouth_open() else closed), 1.0 / 30


    def SophieTalking(closed, opened):
        """A pose whose mouth moves in sync with Sophie's voice."""

        return DynamicDisplayable(
            _sophie_talking,
            closed=renpy.displayable(closed),
            opened=renpy.displayable(opened),
        )
