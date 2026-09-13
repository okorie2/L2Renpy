# Reusable speech-input UI. Scene-specific code decides what to do with the
# returned result; this screen never writes player_name or other story state.

screen speech_input(mode="transcription", language="en", prompt=""):
    default session = SpeechInputSession(
        mode=mode,
        language=language,
        prompt=prompt,
    )

    modal True
    zorder 100

    on "hide" action Function(session.dispose)

    frame:
        # Keep the interaction panel on the same side as the existing
        # onboarding choices so it does not cover Sophie on the left.
        xalign 0.70
        yalign 0.72
        xmaximum 1100
        xpadding 36
        ypadding 28
        background Solid("#14241dec")

        vbox:
            xalign 0.5
            spacing 18

            if session.prompt:
                text session.prompt:
                    xalign 0.5
                    text_align 0.5
                    size 30

            if session.status == SPEECH_IDLE:
                text "Tap to speak":
                    xalign 0.5
                    size 24

                textbutton "MIC":
                    action Function(session.start)
                    xalign 0.5
                    xminimum 280
                    yminimum 112
                    text_size 38

            elif session.status == SPEECH_RECORDING:
                text "Listening...":
                    xalign 0.5
                    size 28

                textbutton "STOP":
                    action Function(session.stop)
                    xalign 0.5
                    xminimum 280
                    yminimum 112
                    text_size 38

                text "Tap again when you are finished.":
                    xalign 0.5
                    size 22

            elif session.status == SPEECH_PROCESSING:
                text "Processing...":
                    xalign 0.5
                    size 28
                text "Please wait.":
                    xalign 0.5
                    size 22

            elif session.status == SPEECH_RESULT:
                text "I heard: [session.transcript]":
                    xalign 0.5
                    text_align 0.5
                    size 28

                hbox:
                    xalign 0.5
                    spacing 16

                    textbutton "That's right":
                        action Function(session.confirm_result)
                        xminimum 210
                        yminimum 68

                    textbutton "Try again":
                        action Function(session.retry)
                        xminimum 210
                        yminimum 68

                textbutton "Type instead":
                    action Function(session.type_result)
                    xalign 0.5
                    xminimum 250
                    yminimum 64

            elif session.status == SPEECH_ERROR:
                text session.error:
                    xalign 0.5
                    text_align 0.5
                    size 24

                hbox:
                    xalign 0.5
                    spacing 16

                    textbutton "Try again":
                        action Function(session.retry)
                        xminimum 210
                        yminimum 68

                    textbutton "Type instead":
                        action Function(session.type_result)
                        xminimum 210
                        yminimum 68
