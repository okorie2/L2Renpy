# Reusable speech-input UI. Scene-specific code decides what to do with the
# returned result; this screen never writes player_name or other story state.

screen speech_input(
    mode="transcription",
    language="en",
    prompt="",
    reference_text="",
    reference_audio_path=None,
    reference_tts_session=None,
    translation="",
    practice_mode="phrase",
    practice_state=None,
):
    default session = SpeechInputSession(
        mode=mode,
        language=language,
        prompt=prompt,
        reference_text=reference_text,
        reference_audio_path=reference_audio_path,
        reference_tts_session=reference_tts_session,
        practice_mode=practice_mode,
    )

    modal True
    zorder 100
    style_prefix "mobile_speech"

    on "hide" action Function(session.dispose)

    if reference_tts_session is not None:
        timer 0.1 repeat True action Function(reference_tts_session.tick)

    use mobile_pronunciation_card(
        placement=UI_LAYOUT_BOTTOM,
        show_speaker=mode == "pronunciation",
    ):
        vbox:
            xfill True
            spacing ui_card_gap

            if mode == "pronunciation":
                if reference_tts_session is None or reference_tts_session.status == TTS_FINISHED:
                    if practice_mode == "word":
                        text "Let's practise this word.":
                            style "mobile_question_text"
                    else:
                        text "Now you try.":
                            style "mobile_question_text"
                else:
                    text "Listen, then repeat":
                        style "mobile_question_text"

                text reference_text:
                    style "mobile_french_text"

                if translation:
                    text translation:
                        style "mobile_english_text"

            elif session.prompt:
                text session.prompt:
                    style "mobile_question_text"

            if (
                mode == "pronunciation"
                and reference_tts_session is not None
                and reference_tts_session.status != TTS_FINISHED
            ):
                if reference_tts_session.status == TTS_ERROR:
                    text "Sophie could not demonstrate this line.":
                        style "mobile_center_status_text"
                        color ui_error

                    textbutton "Continue":
                        style "mobile_primary_button"
                        action Return("tts_error")
                elif reference_tts_session.status == TTS_PREPARING:
                    text "Preparing Sophie's voice...":
                        style "mobile_center_status_text"
                elif reference_tts_session.status == TTS_PLAYING:
                    text "Sophie is speaking...":
                        style "mobile_center_status_text"

            elif session.status == SPEECH_IDLE:
                text "Tap to speak":
                    style "mobile_center_status_text"

                use mobile_microphone_button(Function(session.start))

            elif session.status == SPEECH_RECORDING:
                text "Listening...":
                    style "mobile_center_status_text"

                use mobile_microphone_button(
                    Function(session.stop),
                    recording=True,
                )

                text "Tap again when you are finished.":
                    style "mobile_center_status_text"

            elif session.status == SPEECH_PROCESSING:
                text "Processing...":
                    style "mobile_center_status_text"
                text "Please wait.":
                    style "mobile_center_status_text"

            elif session.status == SPEECH_RESULT:
                if mode == "pronunciation":
                    if session.pronunciation_percent is not None:
                        text "Pronunciation: [session.pronunciation_percent]%":
                            style "mobile_center_status_text"
                            xalign 0.5
                            size ui_px(22)

                    if practice_mode == "phrase":
                        if phrase_pronunciation_passes(session.evaluation):
                            text "Great!":
                                style "mobile_center_status_text"
                                xalign 0.5
                                text_align 0.5
                                size ui_px(32)
                                color ui_success

                            textbutton "Continue":
                                style "mobile_primary_button"
                                action Function(session.confirm_result_and_close)
                        elif (
                            practice_state is not None
                            and practice_state.final_phrase_attempt
                        ):
                            text "Nice try. We'll come back to this one.":
                                style "mobile_center_status_text"
                                xalign 0.5
                                text_align 0.5
                                size ui_px(24)

                            textbutton "Continue":
                                style "mobile_primary_button"
                                action Function(session.confirm_result_and_close)
                        elif session.evaluation.get("weakest_word"):
                            text "Let's work on this part.":
                                style "mobile_center_status_text"
                                xalign 0.5
                                text_align 0.5
                                size ui_px(24)

                            text session.evaluation.get("weakest_word", {}).get("word", ""):
                                style "mobile_french_text"
                                xalign 0.5
                                text_align 0.5
                                size ui_px(32)

                            textbutton "Practice this word":
                                style "mobile_primary_button"
                                action Function(session.remediation_result_and_close)
                        else:
                            text "Let's keep going.":
                                style "mobile_center_status_text"
                                xalign 0.5
                                text_align 0.5
                                size ui_px(24)

                            textbutton "Continue":
                                style "mobile_primary_button"
                                action Function(session.confirm_result_and_close)
                    elif word_pronunciation_passes(session.evaluation):
                        if (
                            practice_state is not None
                            and practice_state.phonetic_guide_visible
                            and practice_state.current_weakest_word
                            and practice_state.current_weakest_word.get(
                                "phonetic_guide"
                            )
                        ):
                            text "Hint: [practice_state.current_weakest_word.get('phonetic_guide', '')]":
                                style "mobile_center_status_text"
                                xalign 0.5
                                text_align 0.5
                                size ui_px(23)

                        text "Much better. Let's try the whole sentence again.":
                            style "mobile_center_status_text"
                            xalign 0.5
                            text_align 0.5
                            size ui_px(24)

                        textbutton "Continue":
                            style "mobile_primary_button"
                            action Function(session.confirm_result_and_close)
                    elif (
                        practice_state is not None
                        and practice_state.word_attempts >= MAX_WORD_ATTEMPTS
                    ):
                        text "Let's try the whole sentence again.":
                            style "mobile_center_status_text"
                            xalign 0.5
                            text_align 0.5
                            size ui_px(24)

                        if (
                            practice_state.phonetic_guide_visible
                            and practice_state.current_weakest_word
                            and practice_state.current_weakest_word.get(
                                "phonetic_guide"
                            )
                        ):
                            text "Hint: [practice_state.current_weakest_word.get('phonetic_guide', '')]":
                                style "mobile_center_status_text"
                                xalign 0.5
                                text_align 0.5
                                size ui_px(23)

                        textbutton "Continue":
                            style "mobile_primary_button"
                            action Function(session.confirm_result_and_close)
                    else:
                        text "Let's try it once more.":
                            style "mobile_center_status_text"
                            xalign 0.5
                            text_align 0.5
                            size ui_px(24)

                        if (
                            practice_state is not None
                            and practice_state.phonetic_guide_visible
                            and practice_state.current_weakest_word
                            and practice_state.current_weakest_word.get(
                                "phonetic_guide"
                            )
                        ):
                            text "Hint: [practice_state.current_weakest_word.get('phonetic_guide', '')]":
                                style "mobile_center_status_text"
                                xalign 0.5
                                text_align 0.5
                                size ui_px(23)

                        hbox:
                            xalign 0.5
                            spacing ui_card_gap_small

                            textbutton "Try Again":
                                style "mobile_secondary_button"
                                action Function(
                                    record_practice_evaluation_and_close,
                                    practice_state,
                                    practice_mode,
                                    session.evaluation,
                                    "retry",
                                )
                                xminimum ui_button_min_width

                            textbutton "Try Full Phrase":
                                style "mobile_primary_button"
                                action Function(
                                    record_practice_evaluation_and_close,
                                    practice_state,
                                    practice_mode,
                                    session.evaluation,
                                    "full_phrase",
                                )
                                xminimum ui_button_min_width
                else:
                    text "I heard: [session.transcript]":
                        style "mobile_center_status_text"
                        xalign 0.5
                        text_align 0.5
                        size ui_px(28)

                    hbox:
                        xalign 0.5
                        spacing ui_card_gap_small

                        textbutton "That's right":
                            style "mobile_primary_button"
                            action Function(session.confirm_result)
                            xminimum ui_button_min_width

                        textbutton "Try again":
                            style "mobile_secondary_button"
                            action Function(session.retry)
                            xminimum ui_button_min_width

                    textbutton "Type instead":
                        style "mobile_secondary_button"
                        action Function(session.type_result)
                        xalign 0.5
                        xminimum ui_button_min_width

            elif session.status == SPEECH_ERROR:
                text session.error:
                    style "mobile_center_status_text"
                    xalign 0.5
                    text_align 0.5
                    size ui_px(24)
                    color ui_error

                if mode == "pronunciation":
                    hbox:
                        xalign 0.5
                        spacing ui_card_gap_small

                        textbutton "Try Again":
                            style "mobile_secondary_button"
                            action Return("retry")
                            xminimum ui_button_min_width

                        textbutton "Continue":
                            style "mobile_primary_button"
                            action Return("error")
                            xminimum ui_button_min_width
                else:
                    hbox:
                        xalign 0.5
                        spacing ui_card_gap_small

                        textbutton "Try again":
                            style "mobile_secondary_button"
                            action Function(session.retry)
                            xminimum ui_button_min_width

                        textbutton "Type instead":
                            style "mobile_secondary_button"
                            action Function(session.type_result)
                            xminimum ui_button_min_width
