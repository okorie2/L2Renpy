# Finite pronunciation-practice thresholds and lesson-flow state.

init python:

    PHRASE_PASS_THRESHOLD = 0.85
    WORD_PASS_THRESHOLD = 0.80
    MAX_WORD_ATTEMPTS = 3
    PHONETIC_GUIDE_ATTEMPT = 3


    def pronunciation_score(evaluation):
        """Read the backend's numeric engineering score without re-rounding."""

        try:
            return float((evaluation or {}).get("pronunciation_similarity"))
        except (TypeError, ValueError):
            return None


    def phrase_pronunciation_passes(evaluation):
        score = pronunciation_score(evaluation)
        return score is not None and score >= PHRASE_PASS_THRESHOLD


    def word_pronunciation_passes(evaluation):
        score = pronunciation_score(evaluation)
        return score is not None and score >= WORD_PASS_THRESHOLD


    def record_practice_evaluation_and_close(
        practice_state,
        practice_mode,
        evaluation,
        result,
    ):
        """Record an attempt before returning a retry/escape action."""

        practice_state.record_evaluation(practice_mode, evaluation)
        renpy.end_interaction(result)


    class PronunciationPracticeState(object):
        """Own finite attempt and remediation state for one phrase."""

        def __init__(self):
            self.reset_for_new_phrase()

        def reset_for_new_phrase(self):
            self.practice_mode = "phrase"
            self.phrase_attempts = 0
            self.word_attempts = 0
            self.best_phrase_score = None
            self.best_word_score = None
            self.current_weakest_word = None
            self.phonetic_guide_visible = False
            self.final_phrase_attempt = False

        def start_phrase_attempt(self, final_phrase=False):
            self.practice_mode = "phrase"
            self.phrase_attempts += 1
            self.final_phrase_attempt = bool(final_phrase)

        def begin_word_remediation(self, weakest_word):
            self.practice_mode = "word"
            self.word_attempts = 0
            self.best_word_score = None
            self.current_weakest_word = dict(weakest_word or {})
            self.phonetic_guide_visible = False

        def start_word_attempt(self):
            self.practice_mode = "word"
            self.word_attempts += 1
            if self.word_attempts >= PHONETIC_GUIDE_ATTEMPT:
                self.phonetic_guide_visible = True

        def prepare_final_phrase_attempt(self):
            self.practice_mode = "phrase"
            self.final_phrase_attempt = True

        def record_evaluation(self, practice_mode, evaluation):
            score = pronunciation_score(evaluation)
            if score is None:
                return

            if practice_mode == "word":
                if (
                    self.best_word_score is None
                    or score > self.best_word_score
                ):
                    self.best_word_score = score
            elif (
                self.best_phrase_score is None
                or score > self.best_phrase_score
            ):
                self.best_phrase_score = score

        def phrase_outcome(self, evaluation):
            """Return review metadata for the completed phrase attempt."""

            mastered = phrase_pronunciation_passes(evaluation)
            return {
                "mastered": mastered,
                "continued_after_practice": (
                    self.final_phrase_attempt and not mastered
                ),
                "best_phrase_score": self.best_phrase_score,
                "best_word_score": self.best_word_score,
                "weakest_word": self.current_weakest_word,
                "phrase_attempts": self.phrase_attempts,
                "word_attempts": self.word_attempts,
            }
