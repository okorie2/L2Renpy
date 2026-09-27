# Bilingual introduction overlay for Chapter 1.

screen bilingual_introduction(french_text, english_text, tts_session=None):
    modal True
    zorder 90

    if tts_session is not None:
        timer 0.1 repeat True action Function(tts_session.tick)
        on "hide" action Function(tts_session.dispose)

    use mobile_bilingual_card(
        french_text,
        english_text,
        tts_session,
        placement=UI_LAYOUT_BOTTOM,
    )
