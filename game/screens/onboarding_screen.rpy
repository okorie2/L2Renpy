# Reusable, touch-friendly choice screen for onboarding questions.

init python:
    def _validate_age_input(age_text):
        """Return an integer age or keep the age screen open with an error."""

        value = (age_text or "").strip()

        if not value.isdigit():
            renpy.set_screen_variable(
                "age_error",
                "Please enter a valid age between 1 and 120.",
            )
            return None

        age = int(value)
        if age < 1 or age > 120:
            renpy.set_screen_variable(
                "age_error",
                "Please enter a valid age between 1 and 120.",
            )
            return None

        return age

screen onboarding_choice(question, options, result_variable):
    modal True
    zorder 90

    use mobile_choice_sheet:
        vbox:
            xfill True
            spacing ui_card_gap

            use mobile_name_chip(label="Sophie")

            text question:
                style "mobile_question_text"

            vbox:
                xfill True
                spacing ui_card_gap_small

                for option_label, option_value in options:
                    use mobile_choice_button(
                        option_label,
                        [SetVariable(result_variable, option_value), Return()],
                    )


screen onboarding_age_input():
    default age_text = ""
    default age_error = ""

    modal True
    zorder 90

    use mobile_input_sheet:
        vbox:
            xfill True
            spacing ui_card_gap

            use mobile_name_chip(label="Sophie")

            text "Enter your age":
                style "mobile_question_text"

            input:
                style "mobile_input"
                value ScreenVariableInputValue("age_text")
                length 3
                pixel_width ui_px(260)

            text "Numbers only (1–120).":
                xalign 0.5
                style "mobile_center_status_text"

            if age_error:
                text age_error:
                    style "mobile_center_status_text"
                    color ui_error

            use mobile_primary_button(
                "Continue",
                Function(_validate_age_input, age_text),
            )
