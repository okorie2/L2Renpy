# Reusable, touch-friendly choice screen for onboarding questions.

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
