# Helpers for the first personalized French introduction.
#
# This keeps story-state formatting out of scene labels and screen layout. The
# returned french_text is the future TTS boundary: it is one complete string,
# while french_lines and english_lines remain available for presentation or
# later audio timing.

init python:
    _FRENCH_NUMBERS_UNDER_20 = {
        1: "un",
        2: "deux",
        3: "trois",
        4: "quatre",
        5: "cinq",
        6: "six",
        7: "sept",
        8: "huit",
        9: "neuf",
        10: "dix",
        11: "onze",
        12: "douze",
        13: "treize",
        14: "quatorze",
        15: "quinze",
        16: "seize",
        17: "dix-sept",
        18: "dix-huit",
        19: "dix-neuf",
    }

    _FRENCH_TENS = {
        20: "vingt",
        30: "trente",
        40: "quarante",
        50: "cinquante",
        60: "soixante",
    }

    _ENGLISH_NUMBERS_UNDER_20 = {
        1: "one",
        2: "two",
        3: "three",
        4: "four",
        5: "five",
        6: "six",
        7: "seven",
        8: "eight",
        9: "nine",
        10: "ten",
        11: "eleven",
        12: "twelve",
        13: "thirteen",
        14: "fourteen",
        15: "fifteen",
        16: "sixteen",
        17: "seventeen",
        18: "eighteen",
        19: "nineteen",
    }

    _ENGLISH_TENS = {
        20: "twenty",
        30: "thirty",
        40: "forty",
        50: "fifty",
        60: "sixty",
        70: "seventy",
        80: "eighty",
        90: "ninety",
    }

    _LEARNING_GOAL_SENTENCES = {
        "education": (
            "Je voudrais apprendre à parler français pour mes études.",
            "I would like to learn French for my studies.",
        ),
        "career": (
            "Je voudrais apprendre à parler français pour ma carrière.",
            "I would like to learn French for my career.",
        ),
        "tourism": (
            "Je voudrais apprendre à parler français pour voyager.",
            "I would like to learn French for travel.",
        ),
        "relationship": (
            "Je voudrais apprendre à parler français pour communiquer avec une personne qui compte pour moi.",
            "I would like to learn French to communicate with someone important to me.",
        ),
        "general": (
            "Je voudrais apprendre à parler français pour communiquer au quotidien.",
            "I would like to learn French for everyday communication.",
        ),
    }

    _FRENCH_LEVEL_SENTENCES = {
        "beginner": (
            "Mon niveau actuel en français est débutant.",
            "My current French level is beginner.",
        ),
        "intermediate": (
            "Mon niveau actuel en français est intermédiaire.",
            "My current French level is intermediate.",
        ),
        "expert": (
            "Mon niveau actuel en français est avancé.",
            "My current French level is advanced.",
        ),
    }


    def _french_number(number):
        if number in _FRENCH_NUMBERS_UNDER_20:
            return _FRENCH_NUMBERS_UNDER_20[number]

        if number < 70:
            tens = (number // 10) * 10
            remainder = number % 10
            if remainder == 0:
                return _FRENCH_TENS[tens]
            if remainder == 1:
                return _FRENCH_TENS[tens] + " et un"
            return _FRENCH_TENS[tens] + "-" + _french_number(remainder)

        if number < 80:
            remainder = number - 60
            if remainder == 10:
                return "soixante-dix"
            if remainder == 11:
                return "soixante et onze"
            return "soixante-" + _french_number(remainder)

        if number < 100:
            remainder = number - 80
            if remainder == 0:
                return "quatre-vingts"
            if remainder == 1:
                return "quatre-vingt-un"
            return "quatre-vingt-" + _french_number(remainder)

        if number == 100:
            return "cent"

        return "cent " + _french_number(number - 100)


    def _english_number(number):
        if number in _ENGLISH_NUMBERS_UNDER_20:
            return _ENGLISH_NUMBERS_UNDER_20[number]

        if number < 100:
            tens = (number // 10) * 10
            remainder = number % 10
            if remainder == 0:
                return _ENGLISH_TENS[tens]
            return _ENGLISH_TENS[tens] + "-" + _english_number(remainder)

        if number == 100:
            return "one hundred"

        return "one hundred and " + _english_number(number - 100)


    def _age_sentences(player_age):
        if player_age is None:
            return ("J'ai ... ans.", "I am ... years old.")

        age = int(player_age)
        french_number = _french_number(age)
        english_number = _english_number(age)

        if age == 1:
            return ("J'ai un an.", "I am one year old.")

        return (
            "J'ai " + french_number + " ans.",
            "I am " + english_number + " years old.",
        )


    def build_personalized_introduction(
        player_name,
        player_age,
        learning_goal,
        french_level,
    ):
        """Build the bilingual introduction from the current onboarding state."""

        name = (player_name or "...").strip()
        age_french, age_english = _age_sentences(player_age)
        goal_french, goal_english = _LEARNING_GOAL_SENTENCES.get(
            learning_goal,
            _LEARNING_GOAL_SENTENCES["general"],
        )
        level_french, level_english = _FRENCH_LEVEL_SENTENCES.get(
            french_level,
            _FRENCH_LEVEL_SENTENCES["beginner"],
        )

        french_lines = [
            "Je m'appelle " + name + ".",
            age_french,
            goal_french,
            level_french,
        ]
        english_lines = [
            "My name is " + name + ".",
            age_english,
            goal_english,
            level_english,
        ]

        return {
            "french_lines": french_lines,
            "english_lines": english_lines,
            "french_text": "\n".join(french_lines),
            "english_text": "\n".join(english_lines),
        }
