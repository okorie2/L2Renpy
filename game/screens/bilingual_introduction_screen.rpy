# Bilingual introduction overlay for Chapter 1.

screen bilingual_introduction(french_text, english_text, tts_session=None):
    modal True
    zorder 90

    if tts_session is not None:
        timer 0.1 repeat True action Function(tts_session.tick)
        on "hide" action Function(tts_session.dispose)

    # Like dialogue lines: once Sophie has finished reading the French (or the
    # voice failed), wait long enough to read the English, then move on.
    if dialogue_auto_advance and (tts_session is None or tts_session.can_continue()):
        timer mobile_auto_advance_wait(english_text) action Return()

    use mobile_bilingual_card(
        french_text,
        english_text,
        tts_session,
        placement=UI_LAYOUT_BOTTOM,
    )
