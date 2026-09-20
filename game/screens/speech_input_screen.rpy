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

    on "hide" action Function(session.dispose)

    if reference_tts_session is not None:
        timer 0.1 repeat True action Function(reference_tts_session.tick)

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

            if mode == "pronunciation":
                if reference_tts_session is None or reference_tts_session.status == TTS_FINISHED:
                    if practice_mode == "word":
                        text "Let's practise this word.":
                            xalign 0.5
                            text_align 0.5
                            size 30
                    else:
                        text "Now you try.":
                            xalign 0.5
                            text_align 0.5
                            size 30
                else:
                    text "Listen, then repeat":
                        xalign 0.5
                        text_align 0.5
                        size 30

                text reference_text:
                    xalign 0.5
                    text_align 0.5
                    size 28

                if translation:
                    text translation:
                        xalign 0.5
                        text_align 0.5
                        size 23

            elif session.prompt:
                text session.prompt:
                    xalign 0.5
                    text_align 0.5
                    size 30

            if (
                mode == "pronunciation"
                and reference_tts_session is not None
                and reference_tts_session.status != TTS_FINISHED
            ):
                if reference_tts_session.status == TTS_ERROR:
                    text "Sophie could not demonstrate this line.":
                        xalign 0.5
                        text_align 0.5
                        size 22
                        color "#ffb3b3"

                    textbutton "Continue":
                        action Return("tts_error")
                        xalign 0.5
                        xminimum 300
                        yminimum 68
                elif reference_tts_session.status == TTS_PREPARING:
                    text "Preparing Sophie's voice...":
                        xalign 0.5
                        size 22
                elif reference_tts_session.status == TTS_PLAYING:
                    text "Sophie is speaking...":
                        xalign 0.5
                        size 22

            elif session.status == SPEECH_IDLE:
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
                if mode == "pronunciation":
                    if session.pronunciation_percent is not None:
                        text "Pronunciation: [session.pronunciation_percent]%":
                            xalign 0.5
                            size 25

                    if pronunciation_similarity_is_perfect(session.evaluation):
                        hbox:
                            xalign 0.5
                            spacing 16

                            textbutton "Try Again":
                                action Return("retry")
                                xminimum 210
                                yminimum 68

                            textbutton "Continue":
                                action Function(session.confirm_result_and_close)
                                xminimum 210
                                yminimum 68
                    elif practice_mode == "phrase" and session.evaluation.get("weakest_word"):
                        text "Let's work on this part.":
                            xalign 0.5
                            text_align 0.5
                            size 24

                        text session.evaluation.get("weakest_word", {}).get("word", ""):
                            xalign 0.5
                            text_align 0.5
                            size 30

                        hbox:
                            xalign 0.5
                            spacing 16

                            textbutton "Practice this word":
                                action Function(session.remediation_result_and_close)
                                xminimum 250
                                yminimum 68

                            textbutton "Try Again":
                                action Return("retry")
                                xminimum 210
                                yminimum 68
                    else:
                        textbutton "Try Again":
                            action Return("retry")
                            xalign 0.5
                            xminimum 250
                            yminimum 68

                        if practice_mode == "word":
                            textbutton "Try Full Phrase":
                                action Return("full_phrase")
                                xalign 0.5
                                xminimum 250
                                yminimum 68
                else:
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

                if mode == "pronunciation":
                    hbox:
                        xalign 0.5
                        spacing 16

                        textbutton "Try Again":
                            action Return("retry")
                            xminimum 210
                            yminimum 68

                        textbutton "Continue":
                            action Return("error")
                            xminimum 210
                            yminimum 68
                else:
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
