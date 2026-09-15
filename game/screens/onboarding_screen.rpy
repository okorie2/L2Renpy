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
    frame:
        xalign 0.70
        yalign 0.46
        xpadding 36
        ypadding 28
        background Solid("#14241dcc")

        vbox:
            xalign 0.5
            spacing 20

            text question:
                xalign 0.5
                text_align 0.5
                size 30

            vbox:
                xalign 0.5
                spacing 14

                for option_label, option_value in options:
                    textbutton option_label:
                        action [SetVariable(result_variable, option_value), Return()]
                        xalign 0.5
                        xminimum 360
                        yminimum 68


screen onboarding_age_input():
    default age_text = ""
    default age_error = ""

    frame:
        xalign 0.70
        yalign 0.46
        xpadding 36
        ypadding 28
        background Solid("#14241dcc")

        vbox:
            xalign 0.5
            spacing 18

            text "Enter your age":
                xalign 0.5
                text_align 0.5
                size 30

            input:
                value ScreenVariableInputValue("age_text")
                length 3
                pixel_width 260
                xalign 0.5

            text "Numbers only (1–120).":
                xalign 0.5
                size 22

            if age_error:
                text age_error:
                    xalign 0.5
                    text_align 0.5
                    size 22
                    color "#ffb3b3"

            textbutton "Continue":
                action Function(_validate_age_input, age_text)
                xalign 0.5
                xminimum 300
                yminimum 68
