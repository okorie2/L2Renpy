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

    use app_bottom_sheet:
        vbox:
            xfill True
            spacing 18

            text question:
                style "app_question_text"

            vbox:
                xfill True
                spacing 12

                for option_label, option_value in options:
                    textbutton option_label:
                        style "app_choice_button"
                        action [SetVariable(result_variable, option_value), Return()]
                        xfill True


screen onboarding_age_input():
    default age_text = ""
    default age_error = ""

    modal True
    zorder 90

    use app_bottom_sheet:
        vbox:
            xfill True
            spacing 18

            text "Enter your age":
                style "app_question_text"

            input:
                style "app_input"
                value ScreenVariableInputValue("age_text")
                length 3
                pixel_width 260

            text "Numbers only (1–120).":
                xalign 0.5
                style "app_status_text"

            if age_error:
                text age_error:
                    style "app_status_text"
                    color "#ffb3b3"

            textbutton "Continue":
                style "app_primary_button"
                action Function(_validate_age_input, age_text)
                xalign 0.5
