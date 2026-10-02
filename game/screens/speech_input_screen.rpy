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
    evaluation_exclusions=None,
):
    default session = SpeechInputSession(
        mode=mode,
        language=language,
        prompt=prompt,
        reference_text=reference_text,
        reference_audio_path=reference_audio_path,
        reference_tts_session=reference_tts_session,
        practice_mode=practice_mode,
        evaluation_exclusions=evaluation_exclusions,
    )

    modal True
    zorder 100
    style_prefix "mobile_speech"

    on "hide" action Function(session.dispose)

    if reference_tts_session is not None:
        timer 0.1 repeat True action Function(reference_tts_session.tick)

    # Replay Sophie's reference audio, only while waiting for the player to
    # speak (never while recording, so the mic doesn't pick it up).
    $ replay_action = (
        Function(reference_tts_session.replay)
        if reference_tts_session is not None and session.status == SPEECH_IDLE
        else None
    )

    use mobile_pronunciation_card(
        placement=UI_LAYOUT_BOTTOM,
        show_speaker=mode == "pronunciation",
        speaker_action=replay_action,
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

            frame:
                background None
                padding (0, 0)
                xfill True
                yminimum speech_action_min_height

                vbox:
                    xfill True
                    yalign 0.5
                    spacing ui_card_gap

                    # Fixed-minimum action area: the mic states and the result states
                    # share this space, so the card keeps its height as the attempt
                    # moves from listening to recording to feedback (no jumping).
                    # No "preparing / processing" messages: the service is meant to be
                    # fast enough that waits aren't noticeable.
                    $ tts_busy = (
                        mode == "pronunciation"
                        and reference_tts_session is not None
                        and reference_tts_session.status not in (TTS_FINISHED, TTS_ERROR)
                    )

                    if (
                        mode == "pronunciation"
                        and reference_tts_session is not None
                        and reference_tts_session.status == TTS_ERROR
                    ):
                        text "Sophie could not demonstrate this line.":
                            style "mobile_center_status_text"
                            color ui_error

                        textbutton "Continue":
                            style "mobile_primary_button"
                            action Return("tts_error")

                    elif tts_busy or session.status in (SPEECH_IDLE, SPEECH_RECORDING, SPEECH_PROCESSING):
                        if session.status == SPEECH_RECORDING:
                            $ mic_hint = "Tap again when you're done"
                        elif session.status == SPEECH_IDLE and not tts_busy:
                            $ mic_hint = "Tap to speak"
                        else:
                            $ mic_hint = " "

                        text mic_hint:
                            style "mobile_center_status_text"

                        if session.status == SPEECH_RECORDING:
                            use mobile_microphone_button(Function(session.stop), recording=True)
                        else:
                            use mobile_microphone_button(
                                Function(session.start),
                                sensitive=(session.status == SPEECH_IDLE and not tts_busy),
                            )

                    elif session.status == SPEECH_RESULT:
                        if mode == "pronunciation":
                            if session.pronunciation_percent is not None:
                                text "Pronunciation: [session.pronunciation_percent]%":
                                    style "mobile_center_status_text"
                                    xalign 0.5

                            if practice_mode == "phrase":
                                if phrase_pronunciation_passes(session.evaluation):
                                    text "Great!":
                                        style "mobile_center_status_text"
                                        xalign 0.5
                                        text_align 0.5
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

                                    textbutton "Continue":
                                        style "mobile_primary_button"
                                        action Function(session.confirm_result_and_close)
                                elif session.evaluation.get("weakest_word"):
                                    text "Let's work on this part.":
                                        style "mobile_center_status_text"
                                        xalign 0.5
                                        text_align 0.5

                                    text session.evaluation.get("weakest_word", {}).get("word", ""):
                                        style "mobile_french_text"
                                        xalign 0.5
                                        text_align 0.5

                                    textbutton "Practice this word":
                                        style "mobile_primary_button"
                                        action Function(session.remediation_result_and_close)
                                else:
                                    text "Let's keep going.":
                                        style "mobile_center_status_text"
                                        xalign 0.5
                                        text_align 0.5

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

                                text "Much better. Let's try the whole sentence again.":
                                    style "mobile_center_status_text"
                                    xalign 0.5
                                    text_align 0.5

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

                                textbutton "Continue":
                                    style "mobile_primary_button"
                                    action Function(session.confirm_result_and_close)
                            else:
                                text "Let's try it once more.":
                                    style "mobile_center_status_text"
                                    xalign 0.5
                                    text_align 0.5

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

                                use mobile_button_row([
                                    (
                                        "Try Again",
                                        Function(
                                            record_practice_evaluation_and_close,
                                            practice_state,
                                            practice_mode,
                                            session.evaluation,
                                            "retry",
                                        ),
                                        "secondary",
                                    ),
                                    (
                                        "Try Full Phrase",
                                        Function(
                                            record_practice_evaluation_and_close,
                                            practice_state,
                                            practice_mode,
                                            session.evaluation,
                                            "full_phrase",
                                        ),
                                        "primary",
                                    ),
                                ])
                        else:
                            text "I heard: [session.transcript]":
                                style "mobile_center_status_text"
                                xalign 0.5
                                text_align 0.5

                            use mobile_button_row([
                                ("Try again", Function(session.retry), "secondary"),
                                ("That's right", Function(session.confirm_result), "primary"),
                            ])

                            textbutton "Type instead":
                                style "mobile_secondary_button"
                                action Function(session.type_result)

                    elif session.status == SPEECH_ERROR:
                        text session.error:
                            style "mobile_center_status_text"
                            xalign 0.5
                            text_align 0.5
                            color ui_error

                        if mode == "pronunciation":
                            use mobile_button_row([
                                ("Try Again", Return("retry"), "secondary"),
                                ("Continue", Return("error"), "primary"),
                            ])
                        else:
                            use mobile_button_row([
                                ("Try again", Function(session.retry), "secondary"),
                                ("Type instead", Function(session.type_result), "secondary"),
                            ])
