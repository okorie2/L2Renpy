"""Mouth timelines for Sophie's talking animation ("lip-flap").

Each voiced line gets a timeline: one character per 1/20 s, "1" = mouth
open, "0" = closed. The game opens and closes the speaker's mouth patch along
it while the line plays. The mouth opens on syllables (where the voice gets louder than its
surroundings) rather than staying open for whole sentences, and very short
flickers are removed so it looks natural.

Used by the /speech/synthesize endpoint, which returns it with the audio.
"""

import numpy as np

FRAMES_PER_SECOND = 20

# Quieter than this (relative to the clip's loud parts) is treated as silence.
_SILENCE_LEVEL = 0.12
# Window for "louder than its surroundings", in frames (0.25 s).
_LOCAL_WINDOW = 5
# Shortest open/closed run kept, in frames (0.1 s).
_MIN_RUN = 2
# Pauses in speech shorter than this (frames) don't count as silence.
_MAX_SPEECH_GAP = 3
# While speaking: open at most 0.2 s and closed at most 0.15 s at a time;
# longer stretches become a syllable-like rhythm (open 0.15 s, closed 0.1 s).
_MAX_OPEN_RUN = 4
_MAX_CLOSED_RUN = 3
_CHATTER = (1, 1, 1, 0, 0)


def _runs(states):
    """Yield (start, end, value) for each run of equal values."""

    count = len(states)
    start = 0
    while start < count:
        end = start
        while end < count and states[end] == states[start]:
            end += 1
        yield start, end, int(states[start])
        start = end


def _remove_short_runs(states: np.ndarray, min_run: int) -> np.ndarray:
    """Merge runs shorter than min_run into the run before them."""

    states = states.copy()
    for start, end, _value in list(_runs(states)):
        if end - start < min_run and start > 0:
            states[start:end] = states[start - 1]
    return states


def _speech_mask(level: np.ndarray) -> np.ndarray:
    speech = (level > _SILENCE_LEVEL).astype(np.int8)
    for start, end, value in list(_runs(speech)):
        if value == 0 and start > 0 and end < len(speech) and end - start <= _MAX_SPEECH_GAP:
            speech[start:end] = 1  # brief dip between words
    return _remove_short_runs(speech, _MIN_RUN)


def mouth_timeline(samples, sample_rate: int) -> str:
    """Return the open/closed timeline for mono audio samples."""

    samples = np.asarray(samples, dtype=np.float32)
    hop = max(1, int(sample_rate / FRAMES_PER_SECOND))
    frame_count = len(samples) // hop
    if frame_count == 0:
        return ""

    frames = samples[: frame_count * hop].reshape(frame_count, hop)
    rms = np.sqrt(np.mean(frames ** 2, axis=1))

    peak = float(np.percentile(rms, 95))
    if peak <= 1e-4:
        return "0" * frame_count

    level = rms / peak
    local = np.convolve(
        level, np.ones(_LOCAL_WINDOW) / _LOCAL_WINDOW, mode="same"
    )

    speech = _speech_mask(level)
    states = np.zeros(frame_count, dtype=np.int8)

    for seg_start, seg_end, is_speech in _runs(speech):
        if not is_speech:
            continue
        # Mouth opens on syllable peaks within this stretch of speech.
        segment = (
            level[seg_start:seg_end] >= local[seg_start:seg_end] * 0.85
        ).astype(np.int8)
        segment = _remove_short_runs(segment, _MIN_RUN)

        # Too long open or closed while talking looks frozen: use a rhythm.
        for start, end, value in list(_runs(segment)):
            limit = _MAX_OPEN_RUN if value else _MAX_CLOSED_RUN
            if end - start > limit:
                offset = 0 if value else 3  # start the rhythm in the same state
                for index in range(start, end):
                    segment[index] = _CHATTER[(index - start + offset) % len(_CHATTER)]

        segment[0] = 1  # speech starts with the mouth opening
        states[seg_start:seg_end] = segment

    states = _remove_short_runs(states, _MIN_RUN)
    return "".join("1" if state else "0" for state in states)


def mouth_timeline_from_bytes(audio_bytes: bytes) -> str:
    """Decode encoded audio (mp3/wav/…) and return its timeline."""

    import io

    from .audio import SAMPLE_RATE, decode_audio

    return mouth_timeline(decode_audio(io.BytesIO(audio_bytes)), SAMPLE_RATE)
