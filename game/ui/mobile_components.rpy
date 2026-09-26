# Reusable presentation components for the mobile learning UI.
#
# These screens render content supplied by their callers. They do not own story
# state, speech state, API calls, or navigation decisions.

style mobile_card_frame is default:
    xfill True
    xmaximum ui_panel_width
    xpadding ui_card_padding
    ypadding ui_card_vertical_padding
    background Frame("gui/mobile/card.svg", ui_card_borders, tile=False)


style mobile_sheet_frame is mobile_card_frame:
    background Frame("gui/mobile/card.svg", ui_card_borders, tile=False)


style mobile_dialogue_name_chip_frame is default:
    ysize dialogue_name_chip_height
    left_padding dialogue_name_chip_padding_x
    right_padding dialogue_name_chip_padding_x
    top_padding 0
    bottom_padding 0
    background Frame(
        "gui/mobile/name_chip.svg",
        Borders(23, 0, 23, 0),
        tile=False,
    )


style mobile_dialogue_name_chip_text is default:
    color ui_navy
    size ui_px(22)
    bold True
    xalign 0.5
    yalign 0.5


style mobile_dialogue_secondary_text is default:
    xfill True
    xmaximum dialogue_card_text_width
    color ui_secondary_text
    size dialogue_secondary_size
    text_align 0.0


style mobile_dialogue_speaker_frame is default:
    xsize dialogue_speaker_size
    ysize dialogue_speaker_size
    background "gui/mobile/dialogue_speaker_circle.svg"


style mobile_dialogue_next_frame is default:
    xsize dialogue_next_size
    ysize dialogue_next_size
    background "gui/mobile/dialogue_next_circle.svg"


style mobile_pronunciation_frame is mobile_card_frame:
    ypadding ui_px(40)


style mobile_name_chip_frame is default:
    xpadding ui_px(22)
    ypadding ui_px(8)
    yoffset -ui_px(12)
    background Frame("gui/mobile/name_chip.svg", ui_pill_borders, tile=False)


style mobile_name_chip_text is default:
    color ui_navy
    size ui_px(25)
    bold True


style mobile_question_text is default:
    xmaximum ui_text_width
    color ui_navy
    size ui_px(38)
    bold True
    text_align 0.0


style mobile_section_label is default:
    color ui_primary_blue
    size ui_px(23)
    bold True


style mobile_french_text is default:
    xmaximum ui_text_width
    color ui_navy
    size ui_px(34)
    bold True
    text_align 0.0


style mobile_english_text is default:
    xmaximum ui_text_width
    color ui_secondary_text
    size ui_px(27)
    text_align 0.0


style mobile_body_text is default:
    xmaximum ui_text_width
    color ui_navy
    size ui_px(28)
    text_align 0.0


style mobile_say_dialogue is mobile_body_text:
    size ui_px(33)
    bold True


style mobile_status_text is default:
    xmaximum ui_text_width
    color ui_secondary_text
    size ui_px(23)
    text_align 0.0


style mobile_center_status_text is mobile_status_text:
    xalign 0.5
    text_align 0.5


style mobile_primary_button is button:
    xfill True
    yminimum ui_primary_height
    xpadding ui_px(24)
    ypadding ui_px(16)
    background Frame("gui/mobile/primary_button.svg", ui_control_borders, tile=False)
    hover_background Frame(
        "gui/mobile/primary_button_pressed.svg",
        ui_control_borders,
        tile=False,
    )
    selected_background Frame(
        "gui/mobile/primary_button_pressed.svg",
        ui_control_borders,
        tile=False,
    )
    insensitive_background Frame(
        "gui/mobile/primary_button_disabled.svg",
        ui_control_borders,
        tile=False,
    )


style mobile_primary_button_text is button_text:
    xalign 0.5
    color ui_white
    hover_color ui_white
    insensitive_color ui_white
    size ui_px(31)
    bold True


style mobile_secondary_button is button:
    xfill True
    yminimum ui_choice_height
    xpadding ui_px(24)
    ypadding ui_px(14)
    background Frame("gui/mobile/secondary_button.svg", ui_control_borders, tile=False)
    hover_background Frame("gui/mobile/choice_hover.svg", ui_control_borders, tile=False)
    selected_background Frame("gui/mobile/choice_pressed.svg", ui_control_borders, tile=False)


style mobile_secondary_button_text is button_text:
    xalign 0.5
    color ui_navy
    hover_color ui_navy
    size ui_px(29)
    bold True


style mobile_choice_button is mobile_secondary_button:
    background Frame("gui/mobile/choice_idle.svg", ui_control_borders, tile=False)


style mobile_choice_button_text is mobile_secondary_button_text:
    xalign 0.0
    color ui_navy
    hover_color ui_navy
    size ui_px(29)


style mobile_input is input:
    xalign 0.5
    xmaximum ui_px(360)
    xpadding ui_px(22)
    ypadding ui_px(14)
    color ui_navy
    size ui_px(29)
    background Frame("gui/mobile/secondary_button.svg", ui_control_borders, tile=False)


style mobile_mic_button is button:
    xsize ui_mic_size
    ysize ui_mic_size
    xminimum ui_mic_size
    yminimum ui_mic_size
    background None
    hover_background None
    selected_background None
    insensitive_background None


style mobile_speech_button is mobile_secondary_button
style mobile_speech_button_text is mobile_secondary_button_text
style mobile_speech_text is mobile_body_text


screen mobile_card(placement=UI_LAYOUT_BOTTOM):
    frame:
        style "mobile_card_frame"
        xmaximum ui_layout_width(placement)
        at mobile_panel_position(
            ui_layout_xalign(placement),
            ui_layout_yalign(placement),
        )
        transclude


screen mobile_bottom_sheet(placement=UI_LAYOUT_BOTTOM_SHEET):
    frame:
        style "mobile_sheet_frame"
        xmaximum ui_layout_width(placement)
        at mobile_panel_position(
            ui_layout_xalign(placement),
            ui_layout_yalign(placement),
        )
        transclude


screen mobile_choice_sheet(placement=UI_LAYOUT_BOTTOM_SHEET):
    frame:
        style "mobile_sheet_frame"
        xmaximum ui_layout_width(placement)
        at mobile_panel_position(
            ui_layout_xalign(placement),
            ui_layout_yalign(placement),
        )
        transclude


screen mobile_input_sheet(placement=UI_LAYOUT_BOTTOM_SHEET):
    frame:
        style "mobile_sheet_frame"
        xmaximum ui_layout_width(placement)
        at mobile_panel_position(
            ui_layout_xalign(placement),
            ui_layout_yalign(placement),
        )
        transclude


transform mobile_dialogue_position:
    xalign 0.5
    yalign 1.0
    yoffset -dialogue_card_bottom_margin


screen mobile_dialogue_card(
    speaker,
    primary_text,
    secondary_text=None,
    show_speaker=True,
    show_next=True,
):
    fixed:
        fit_first True
        xsize min(dialogue_card_width, layout_content_width)
        at mobile_dialogue_position

        frame:
            id "window"
            style "window"
            xfill True

            vbox:
                xfill True
                spacing dialogue_line_gap

                text primary_text:
                    id "what"
                    style "say_dialogue"

                if secondary_text is not None and secondary_text:
                    text secondary_text:
                        style "mobile_dialogue_secondary_text"

        if speaker is not None:
            frame:
                style "mobile_dialogue_name_chip_frame"
                xpos dialogue_name_chip_left_inset
                ypos -dialogue_name_chip_overlap_y
                text speaker:
                    id "who"
                    style "mobile_dialogue_name_chip_text"
                    xalign 0.5
                    yalign 0.5

        if show_speaker:
            frame:
                style "mobile_dialogue_speaker_frame"
                xalign 1.0
                xoffset dialogue_speaker_size // 2
                yoffset -(dialogue_speaker_size // 2)

                add "gui/mobile/speaker.svg":
                    xpos 0.5
                    xanchor 0.5
                    ypos 0.5
                    yanchor 0.5
                    xsize ui_px(32)
                    ysize ui_px(32)

        if show_next:
            frame:
                style "mobile_dialogue_next_frame"
                xalign 1.0
                yalign 1.0
                xoffset dialogue_next_size // 2
                yoffset dialogue_next_size // 2

                add "gui/mobile/arrow_right.svg":
                    xpos 0.5
                    xanchor 0.5
                    ypos 0.5
                    yanchor 0.5
                    xsize ui_px(30)
                    ysize ui_px(30)


screen mobile_pronunciation_card(
    placement=UI_LAYOUT_BOTTOM,
    speaker_name="Sophie",
    show_speaker=True,
):
    frame:
        style "mobile_pronunciation_frame"
        xmaximum ui_layout_width(placement)
        at mobile_panel_position(
            ui_layout_xalign(placement),
            ui_layout_yalign(placement),
        )

        vbox:
            xfill True
            spacing ui_card_gap

            fixed:
                xfill True
                ysize ui_px(56)

                use mobile_name_chip(label=speaker_name)

                if show_speaker:
                    add "gui/mobile/speaker.svg":
                        xalign 1.0
                        yalign 0.5
                        xsize ui_px(42)
                        ysize ui_px(42)

            transclude


screen mobile_name_chip(label="Sophie"):
    frame:
        style "mobile_name_chip_frame"
        text label style "mobile_name_chip_text"


screen mobile_primary_button(label, action, sensitive=True):
    textbutton label:
        style "mobile_primary_button"
        action action
        sensitive sensitive


screen mobile_secondary_button(label, action, sensitive=True):
    textbutton label:
        style "mobile_secondary_button"
        action action
        sensitive sensitive


screen mobile_choice_button(label, action, icon=None):
    button:
        style "mobile_choice_button"
        action action

        hbox:
            xfill True
            spacing ui_card_gap_small

            if icon is not None:
                add icon:
                    xsize ui_px(36)
                    ysize ui_px(36)
                    yalign 0.5

            text label style "mobile_choice_button_text"


screen mobile_language_block(language_label, content, primary=True):
    vbox:
        xfill True
        spacing ui_card_gap_small

        text language_label:
            style "mobile_section_label"

        if primary:
            text content:
                style "mobile_french_text"
        else:
            text content:
                style "mobile_english_text"


screen mobile_speaker_header(label="Sophie", show_speaker=False):
    fixed:
        xfill True
        ysize ui_px(56)

        use mobile_name_chip(label=label)

        if show_speaker:
            add "gui/mobile/speaker.svg":
                xalign 1.0
                yalign 0.5
                xsize ui_px(42)
                ysize ui_px(42)


screen mobile_bilingual_card(
    french_text,
    english_text,
    tts_session=None,
    placement=UI_LAYOUT_BOTTOM,
):
    use mobile_card(placement=placement):
        vbox:
            xfill True
            spacing ui_card_gap

            use mobile_speaker_header(
                label="Sophie",
                show_speaker=tts_session is not None,
            )

            use mobile_language_block(
                "FRANÇAIS",
                french_text,
                primary=True,
            )

            use mobile_language_block(
                "ENGLISH",
                english_text,
                primary=False,
            )

            if tts_session is not None:
                if tts_session.status == TTS_PREPARING:
                    text "Preparing Sophie's voice...":
                        style "mobile_status_text"
                elif tts_session.status == TTS_PLAYING:
                    text "Sophie is speaking...":
                        style "mobile_status_text"
                elif tts_session.status == TTS_ERROR:
                    text "Voice unavailable — the text is still available.":
                        style "mobile_status_text"
                        color ui_error

            use mobile_primary_button(
                "Continue",
                Return(),
                sensitive=tts_session is None or tts_session.can_continue(),
            )


screen mobile_microphone_button(action, recording=False, sensitive=True):
    button:
        style "mobile_mic_button"
        action action
        sensitive sensitive

        if recording:
            add "gui/mobile/mic_circle_recording.svg":
                xalign 0.5
                yalign 0.5
                xsize ui_mic_size
                ysize ui_mic_size
        else:
            add "gui/mobile/mic_circle.svg":
                xalign 0.5
                yalign 0.5
                xsize ui_mic_size
                ysize ui_mic_size
