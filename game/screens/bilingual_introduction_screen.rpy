# Bilingual introduction overlay for Chapter 1.

screen bilingual_introduction(french_text, english_text, tts_session=None):
    modal True
    zorder 90

    if tts_session is not None:
        timer 0.1 repeat True action Function(tts_session.tick)
        on "hide" action Function(tts_session.dispose)

    frame:
        xalign 0.70
        yalign 0.46
        xmaximum 1000
        xpadding 36
        ypadding 28
        background Solid("#14241dec")

        vbox:
            xalign 0.5
            spacing 18

            text "FRANÇAIS":
                xalign 0.5
                size 28

            text french_text:
                xalign 0.5
                xmaximum 780
                text_align 0.5
                size 25

            null height 8

            text "ENGLISH":
                xalign 0.5
                size 28

            text english_text:
                xalign 0.5
                xmaximum 780
                text_align 0.5
                size 23

            if tts_session is not None:
                if tts_session.status == TTS_PREPARING:
                    text "Preparing Sophie's voice...":
                        xalign 0.5
                        size 21
                elif tts_session.status == TTS_PLAYING:
                    text "Sophie is speaking...":
                        xalign 0.5
                        size 21
                elif tts_session.status == TTS_ERROR:
                    text "Voice unavailable — the text is still available.":
                        xalign 0.5
                        text_align 0.5
                        size 21
                        color "#ffb3b3"

            textbutton "Continue":
                action Return()
                xalign 0.5
                xminimum 300
                yminimum 68
                sensitive tts_session is None or tts_session.can_continue()
