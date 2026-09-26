# Bilingual introduction overlay for Chapter 1.

screen bilingual_introduction(french_text, english_text, tts_session=None):
    modal True
    zorder 90

    if tts_session is not None:
        timer 0.1 repeat True action Function(tts_session.tick)
        on "hide" action Function(tts_session.dispose)

    use app_card(layout=APP_LAYOUT_CENTER_FOCUS):
        vbox:
            xfill True
            spacing 18

            frame:
                style "app_name_pill_frame"
                xalign 0.0
                text "Sophie" style "app_name_pill_frame_text"

            text "FRANÇAIS":
                style "app_section_label"

            text french_text:
                style "app_french_text"

            null height 8

            text "ENGLISH":
                style "app_section_label"

            text english_text:
                style "app_english_text"

            if tts_session is not None:
                if tts_session.status == TTS_PREPARING:
                    text "Preparing Sophie's voice...":
                        style "app_status_text"
                elif tts_session.status == TTS_PLAYING:
                    text "Sophie is speaking...":
                        style "app_status_text"
                elif tts_session.status == TTS_ERROR:
                    text "Voice unavailable — the text is still available.":
                        style "app_status_text"
                        color "#ffb3b3"

            textbutton "Continue":
                style "app_primary_button"
                action Return()
                xalign 0.5
                sensitive tts_session is None or tts_session.can_continue()
