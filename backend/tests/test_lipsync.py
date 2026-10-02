import re
import unittest

import numpy as np

from app.speech.lipsync import FRAMES_PER_SECOND, mouth_timeline

SR = 16000


def tone(seconds, amplitude=0.5, syllables_per_second=4.0):
    t = np.arange(int(SR * seconds)) / SR
    envelope = 0.5 + 0.5 * np.sin(2 * np.pi * syllables_per_second * t)
    return (amplitude * envelope * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


class MouthTimelineTests(unittest.TestCase):
    def test_one_value_per_twentieth_of_a_second(self):
        timeline = mouth_timeline(tone(2.0), SR)
        self.assertEqual(len(timeline), 2 * FRAMES_PER_SECOND)
        self.assertTrue(set(timeline) <= {"0", "1"})

    def test_silence_keeps_mouth_closed(self):
        self.assertEqual(set(mouth_timeline(np.zeros(SR), SR)), {"0"})

    def test_speech_flaps_instead_of_staying_open(self):
        timeline = mouth_timeline(tone(3.0), SR)
        open_runs = [len(run) for run in re.findall(r"1+", timeline)]
        self.assertGreaterEqual(len(open_runs), 6)  # several mouth movements
        self.assertLessEqual(max(open_runs), 4)  # never open > 0.2 s

    def test_mouth_closed_during_pause_between_phrases(self):
        audio = np.concatenate([tone(1.0), np.zeros(SR), tone(1.0)])
        timeline = mouth_timeline(audio, SR)
        self.assertEqual(set(timeline[24:36]), {"0"})  # middle of the pause


if __name__ == "__main__":
    unittest.main()
