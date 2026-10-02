import unittest

from app.text.names import extract_person_name


def fake_ner(entities_by_text):
    def ner(text):
        return entities_by_text.get(text, [])

    return ner


class ExtractPersonNameTests(unittest.TestCase):
    def test_returns_first_person_entity_from_original_text(self):
        text = "Well everyone around here knows me as Ella Okorie"
        start = text.index("Ella")
        ner = fake_ner({
            text: [
                {"entity_group": "PER", "score": 0.99, "start": start, "end": len(text)},
            ],
        })

        self.assertEqual(extract_person_name(text, ner=ner), "Ella Okorie")

    def test_tries_title_case_for_lowercase_input(self):
        ner = fake_ner({
            "people know me as ella": [],
            "People Know Me As Ella": [
                {"entity_group": "PER", "score": 0.95, "start": 18, "end": 22},
            ],
        })

        self.assertEqual(extract_person_name("people know me as ella", ner=ner), "Ella")

    def test_ignores_low_confidence_and_non_person_entities(self):
        ner = fake_ner({
            "I live in Paris": [
                {"entity_group": "LOC", "score": 0.99, "start": 10, "end": 15},
            ],
            "maybe Sam": [
                {"entity_group": "PER", "score": 0.30, "start": 6, "end": 9},
            ],
        })

        self.assertIsNone(extract_person_name("I live in Paris", ner=ner))
        self.assertIsNone(extract_person_name("maybe Sam", ner=ner))

    def test_empty_text_returns_none_without_calling_model(self):
        def ner(text):
            raise AssertionError("model should not be called")

        self.assertIsNone(extract_person_name("   ", ner=ner))


if __name__ == "__main__":
    unittest.main()
