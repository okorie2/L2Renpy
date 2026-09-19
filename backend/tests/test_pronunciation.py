import sys
import types
import unittest
from unittest.mock import call, patch


# Import the evaluator without loading the heavyweight phonemizer model.
phonemize_module = types.ModuleType("app.speech.phonemize")
phonemize_module.phonemize_audio = None
sys.modules["app.speech.phonemize"] = phonemize_module

from app.speech.pronunciation import evaluate_pronunciation


class PronunciationEvaluationTests(unittest.TestCase):
    @patch("app.speech.pronunciation.phonemize_audio")
    def test_result_contains_only_phoneme_pronunciation_fields(self, phonemize):
        phonemize.side_effect = ["a b", "a c"]

        result = evaluate_pronunciation(
            reference_text="Je m'appelle Ella.",
            reference_audio_path="reference.mp3",
            learner_audio_path="learner.wav",
        )

        self.assertEqual(
            set(result),
            {
                "reference_text",
                "expected_phonemes",
                "learner_phonemes",
                "pronunciation_similarity",
                "differences",
            },
        )
        self.assertEqual(result["reference_text"], "Je m'appelle Ella.")
        self.assertEqual(result["expected_phonemes"], "a b")
        self.assertEqual(result["learner_phonemes"], "a c")
        self.assertEqual(result["pronunciation_similarity"], 0.5)
        self.assertNotIn("transcript", result)
        self.assertNotIn("text_similarity", result)
        phonemize.assert_has_calls(
            [call("reference.mp3"), call("learner.wav")]
        )


if __name__ == "__main__":
    unittest.main()
