import sys
import types
import unittest
from unittest.mock import call, patch


# Import the evaluator without loading the heavyweight phonemizer model.
phonemize_module = types.ModuleType("app.speech.phonemize")
phonemize_module.phonemize_audio = None
real_phonemize_module = sys.modules.get("app.speech.phonemize")
sys.modules["app.speech.phonemize"] = phonemize_module

try:
    from app.speech.pronunciation import (
        evaluate_pronunciation,
        select_weakest_word,
        tokenize_reference_words,
    )
finally:
    if real_phonemize_module is None:
        sys.modules.pop("app.speech.phonemize", None)
    else:
        sys.modules["app.speech.phonemize"] = real_phonemize_module


class PronunciationEvaluationTests(unittest.TestCase):
    def evaluate(self, reference_text, learner_audio, word_phonemes):
        with patch(
            "app.speech.pronunciation.phonemize_audio",
            side_effect=["ʒə mapɛl ɛla", learner_audio],
        ) as phonemize, patch(
            "app.speech.pronunciation.phonemize_french_word",
            side_effect=word_phonemes,
        ) as phonemize_word:
            result = evaluate_pronunciation(
                reference_text=reference_text,
                reference_audio_path="reference.mp3",
                learner_audio_path="learner.wav",
            )

        phonemize.assert_has_calls(
            [call("reference.mp3"), call("learner.wav")]
        )
        self.assertEqual(phonemize_word.call_count, len(word_phonemes))
        return result

    def test_perfect_phrase_has_perfect_words_and_no_weakest_word(self):
        result = self.evaluate(
            "Je m'appelle Ella.",
            "ʒə mapɛl ɛla",
            ["ʒə", "mapɛl", "ɛla"],
        )

        self.assertEqual(
            set(result),
            {
                "reference_text",
                "expected_phonemes",
                "learner_phonemes",
                "pronunciation_similarity",
                "differences",
                "word_results",
                "weakest_word",
            },
        )
        self.assertEqual(result["pronunciation_similarity"], 1.0)
        self.assertIsNone(result["weakest_word"])
        self.assertEqual(
            [word["score"] for word in result["word_results"]],
            [1.0, 1.0, 1.0],
        )
        self.assertNotIn("transcript", result)
        self.assertNotIn("text_similarity", result)

    def test_middle_word_is_selected_as_weakest(self):
        result = self.evaluate(
            "Je m'appelle Ella.",
            "ʒə matɛl ɛla",
            ["ʒə", "mapɛl", "ɛla"],
        )

        self.assertEqual(result["weakest_word"]["word"], "m'appelle")
        self.assertEqual(result["weakest_word"]["index"], 1)
        self.assertEqual(result["word_results"][1]["score"], 0.8)

    def test_first_word_is_selected_when_it_has_the_error(self):
        result = self.evaluate(
            "Je m'appelle Ella.",
            "tɛ mapɛl ɛla",
            ["ʒə", "mapɛl", "ɛla"],
        )

        self.assertEqual(result["weakest_word"]["word"], "Je")
        self.assertEqual(result["weakest_word"]["index"], 0)

    def test_final_word_is_selected_when_it_has_the_error(self):
        result = self.evaluate(
            "Je m'appelle Ella.",
            "ʒə mapɛl ɛt",
            ["ʒə", "mapɛl", "ɛla"],
        )

        self.assertEqual(result["weakest_word"]["word"], "Ella")
        self.assertEqual(result["weakest_word"]["index"], 2)

    def test_insertion_is_assigned_to_the_preceding_word(self):
        result = self.evaluate(
            "Je m'appelle Ella.",
            "ʒə mapɛl x ɛla",
            ["ʒə", "mapɛl", "ɛla"],
        )

        middle_word = result["word_results"][1]
        self.assertEqual(middle_word["learner_phonemes"], "mapɛlx")
        self.assertEqual(middle_word["differences"][0]["type"], "insertion")

    def test_apostrophe_and_hyphen_are_preserved_as_words(self):
        with patch(
            "app.speech.pronunciation.phonemize_french_word",
            side_effect=["m", "v", "k"],
        ):
            words = tokenize_reference_words(
                "m'appelle vingt-quatre, aujourd'hui."
            )

        self.assertEqual(
            [word["text"] for word in words],
            ["m'appelle", "vingt-quatre", "aujourd'hui"],
        )

    def test_ties_select_the_earliest_word(self):
        word_results = [
            {"index": 0, "word": "Je", "score": 0.5, "scorable": True},
            {"index": 1, "word": "Ella", "score": 0.5, "scorable": True},
        ]

        weakest = select_weakest_word(word_results, 0.5)

        self.assertEqual(weakest["word"], "Je")

    def test_word_results_include_expected_phonetic_guide(self):
        result = self.evaluate(
            "apprendre",
            "apʀɑ̃dʀ",
            ["apʀɑ̃dʀ"],
        )

        self.assertEqual(
            result["word_results"][0]["phonetic_guide"],
            "ah-prahn-dr",
        )
        self.assertEqual(
            result["weakest_word"]["phonetic_guide"],
            "ah-prahn-dr",
        )


if __name__ == "__main__":
    unittest.main()
