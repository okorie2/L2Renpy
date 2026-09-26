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

# options: (label, value) or (label, value, icon_path).
screen onboarding_choice(question, options, result_variable, voice=None):
    modal True
    zorder 90

    use mobile_choice_sheet(title=question, voice=voice):
        use mobile_choice_list([
            (
                option[0],
                [SetVariable(result_variable, option[1]), Return()],
                option[2] if len(option) > 2 else None,
            )
            for option in options
        ])


screen onboarding_age_input(question="Enter your age", voice=None):
    default age_text = ""
    default age_error = ""

    modal True
    zorder 90

    use mobile_input_sheet(title=question, voice=voice):
        vbox:
            xfill True
            spacing ui_card_gap

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
