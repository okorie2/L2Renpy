import unittest

from app.speech.phonetic_guide import phonetic_guide_from_ipa


class PhoneticGuideTests(unittest.TestCase):
    def test_output_is_deterministic(self):
        phonemes = "apʀɑ̃dʀ"

        self.assertEqual(
            phonetic_guide_from_ipa(phonemes),
            phonetic_guide_from_ipa(phonemes),
        )

    def test_french_nasal_vowels_are_mapped(self):
        self.assertEqual(phonetic_guide_from_ipa("ɑ̃"), "ahn")
        self.assertEqual(phonetic_guide_from_ipa("ɔ̃"), "ohn")

    def test_common_french_consonants_and_schwa_are_mapped(self):
        self.assertEqual(phonetic_guide_from_ipa("ʒə"), "zhuh")
        self.assertEqual(phonetic_guide_from_ipa("ʁ"), "r")
        self.assertEqual(phonetic_guide_from_ipa("ə"), "uh")

    def test_apprendre_has_a_readable_approximation(self):
        self.assertEqual(phonetic_guide_from_ipa("apʀɑ̃dʀ"), "ah-prahn-dr")

    def test_unknown_symbols_are_preserved(self):
        self.assertEqual(phonetic_guide_from_ipa("x"), "x")
        self.assertEqual(phonetic_guide_from_ipa("aɸ"), "ah-ɸ")


if __name__ == "__main__":
    unittest.main()
