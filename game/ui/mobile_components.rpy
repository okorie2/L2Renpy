# Reusable presentation components for the mobile learning UI.


init python:
    class MobileFieldValue(ScreenVariableInputValue):
        """A screen-variable input whose keyboard Return key submits.

        on_submit(text) is called with the current text; if it returns a
        non-None value the screen closes and returns it (like a Continue
        button), otherwise the field stays open (e.g. validation failed).
        """

        def __init__(self, variable, on_submit=None):
            super(MobileFieldValue, self).__init__(variable, returnable=False)
            self.on_submit = on_submit

        def enter(self):
            if self.on_submit is None:
                return None
            return self.on_submit(self.get_text())


    def mobile_submit_text(text):
        """Return stripped text, or None (stay open) when it is empty."""

        text = (text or "").strip()
        return text or None

#
# These screens render content supplied by their callers. They do not own story
# state, speech state, API calls, or navigation decisions.

style mobile_card_frame is default:
    xfill True
    xmaximum ui_panel_width
    xpadding ui_card_padding
    ypadding ui_card_vertical_padding
    background Frame("gui/mobile/card.svg", ui_card_borders, tile=False)


style mobile_sheet_frame is default:
    xfill True
    left_padding sheet_padding_x
    right_padding sheet_padding_x
    top_padding sheet_shadow_top + sheet_padding_top
    bottom_padding sheet_padding_bottom
    background Frame("gui/mobile/bottom_sheet.svg", sheet_borders, tile=False)


# Floating card variant of the sheet (dock="top"): same card as the dialogue.
style mobile_top_card_frame is mobile_pronunciation_frame


style mobile_sheet_title is default:
    xmaximum sheet_title_width
    color ui_navy
    size sheet_title_size
    bold True
    line_spacing ui_px(4)
    text_align 0.0


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
    size dialogue_name_chip_text_size
    bold True
    xalign 0.5
    yalign 0.5


style mobile_dialogue_secondary_text is default:
    xfill True
    xmaximum dialogue_card_text_width
    color ui_secondary_text
    size dialogue_secondary_size
    text_align 0.0


style mobile_dialogue_speaker_button is button:
    xsize dialogue_speaker_size
    ysize dialogue_speaker_size
    padding (0, 0)
    background "gui/mobile/dialogue_speaker_button.svg"
    hover_background At("gui/mobile/dialogue_speaker_button.svg", mobile_dialogue_button_pressed)
    insensitive_background "gui/mobile/dialogue_speaker_button.svg"


style mobile_dialogue_next_button is button:
    xsize dialogue_next_size
    ysize dialogue_next_size
    padding (0, 0)
    background "gui/mobile/dialogue_next_button.svg"
    hover_background At("gui/mobile/dialogue_next_button.svg", mobile_dialogue_button_pressed)


# Same white shadow card and inner spacing as the dialogue card, but with
# symmetric side padding so centred content (mic, status, buttons) is centred.
style mobile_pronunciation_frame is default:
    xfill True
    left_padding dialogue_card_shadow_x + dialogue_card_padding_left
    right_padding dialogue_card_shadow_x + dialogue_card_padding_left
    top_padding dialogue_card_shadow_top + dialogue_card_padding_top
    bottom_padding dialogue_card_shadow_bottom + dialogue_card_padding_bottom
    background Frame("gui/mobile/dialogue_card.svg", dialogue_card_borders, tile=False)


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
    xpadding ui_px(28)
    ypadding ui_px(16)
    background Frame("gui/mobile/button_primary.svg", ui_button_borders, tile=False)
    hover_background Frame("gui/mobile/button_primary_pressed.svg", ui_button_borders, tile=False)
    selected_background Frame("gui/mobile/button_primary_pressed.svg", ui_button_borders, tile=False)
    insensitive_background Frame("gui/mobile/button_primary_disabled.svg", ui_button_borders, tile=False)


style mobile_primary_button_text is button_text:
    xalign 0.5
    yalign 0.5
    color ui_white
    hover_color ui_white
    insensitive_color ui_white
    size ui_button_text_size
    bold True


style mobile_secondary_button is button:
    xfill True
    yminimum ui_primary_height
    xpadding ui_px(28)
    ypadding ui_px(16)
    background Frame("gui/mobile/button_secondary.svg", ui_button_borders, tile=False)
    hover_background Frame("gui/mobile/button_secondary_pressed.svg", ui_button_borders, tile=False)
    selected_background Frame("gui/mobile/button_secondary_pressed.svg", ui_button_borders, tile=False)


style mobile_secondary_button_text is button_text:
    xalign 0.5
    yalign 0.5
    color ui_navy
    hover_color ui_navy
    size ui_button_text_size
    bold True


style mobile_choice_button is button:
    xfill True
    yminimum choice_pill_height
    left_padding choice_pill_padding_x
    right_padding choice_pill_padding_x
    ypadding ui_px(14)
    background Frame("gui/mobile/choice_pill_idle.svg", choice_pill_borders, tile=False)
    hover_background Frame("gui/mobile/choice_pill_hover.svg", choice_pill_borders, tile=False)
    selected_background Frame("gui/mobile/choice_pill_pressed.svg", choice_pill_borders, tile=False)


style mobile_choice_button_text is button_text:
    xalign 0.0
    yalign 0.5
    color ui_navy
    hover_color ui_navy
    selected_color ui_navy
    insensitive_color ui_secondary_text
    size choice_text_size


# Full-width text field: a framed box containing an `input`.
style mobile_text_field is default:
    xfill True
    ysize text_field_height
    left_padding text_field_padding_x
    right_padding text_field_padding_x
    background Frame("gui/mobile/text_field.svg", text_field_borders, tile=False)


style mobile_text_field_input is input:
    xfill True
    yalign 0.5
    color ui_navy
    size text_field_text_size


# Kept for older callers; new screens use mobile_text_field + _input.
style mobile_input is mobile_text_field_input


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


transform mobile_sheet_position:
    xalign 0.5
    yalign 1.0


transform mobile_top_card_position:
    xalign 0.5
    yanchor 0.0
    ypos ui_safe_top + dialogue_name_chip_overlap_y


# Shared bottom sheet (inspo #2): full-width white sheet anchored to the bottom
# edge with a grab handle, the speaker's name chip on the top-left edge, an
# optional replay button on the top-right edge, an optional title (usually the
# speaker's question), then the caller's content.
#
# voice: audio file for the question. The caller queues it with the `voice`
# statement just before `call screen` (not `play voice`, which Ren'Py's voice
# system cuts off); the replay button plays it again.
#
# dock: "bottom" (default) or "top". Text-input screens use "top" on phones so
# the on-screen keyboard, which Ren'Py does not move the game for, never
# covers the question or the field. Docked at the top it becomes a floating
# card below the notch / Dynamic Island.
screen mobile_sheet(title=None, speaker="Sophie", voice=None, dock="bottom"):
    fixed:
        fit_first True
        xsize (dialogue_card_outer_width if dock == "top" else layout_viewport[0])
        at (mobile_top_card_position if dock == "top" else mobile_sheet_position)

        frame:
            style ("mobile_top_card_frame" if dock == "top" else "mobile_sheet_frame")

            vbox:
                xfill True
                spacing sheet_content_gap

                if title:
                    text title:
                        style "mobile_sheet_title"

                transclude

        if dock == "top":
            $ edge_x = dialogue_card_shadow_x + dialogue_name_chip_left_inset
            $ edge_y = dialogue_card_shadow_top
            $ button_x = dialogue_card_shadow_x + dialogue_speaker_right_inset
        else:
            $ edge_x = sheet_padding_x
            $ edge_y = sheet_shadow_top
            $ button_x = sheet_padding_x

            add "gui/mobile/sheet_handle.svg":
                xalign 0.5
                ypos sheet_shadow_top + sheet_handle_top
                xsize sheet_handle_width
                ysize sheet_handle_height

        if speaker:
            frame:
                style "mobile_dialogue_name_chip_frame"
                xpos edge_x
                ypos edge_y - dialogue_name_chip_overlap_y
                text speaker:
                    style "mobile_dialogue_name_chip_text"

        if voice:
            button:
                style "mobile_dialogue_speaker_button"
                xalign 1.0
                xoffset -button_x
                ypos edge_y - (dialogue_speaker_size // 2)
                action Play("voice", voice)
                alt "Replay audio"

                add "gui/mobile/dialogue_speaker_icon.svg":
                    xalign 0.5
                    yalign 0.5
                    xsize dialogue_speaker_icon_size
                    ysize dialogue_speaker_icon_size


# Named variants kept for existing callers. `placement` is accepted for
# compatibility but sheets always dock to the bottom edge.
screen mobile_bottom_sheet(placement=UI_LAYOUT_BOTTOM_SHEET, title=None, speaker="Sophie", voice=None):
    use mobile_sheet(title=title, speaker=speaker, voice=voice):
        transclude


screen mobile_choice_sheet(placement=UI_LAYOUT_BOTTOM_SHEET, title=None, speaker="Sophie", voice=None):
    use mobile_sheet(title=title, speaker=speaker, voice=voice):
        transclude


# On phones, input sheets dock to the top so the keyboard can't cover them.
screen mobile_input_sheet(placement=UI_LAYOUT_BOTTOM_SHEET, title=None, speaker="Sophie", voice=None):
    use mobile_sheet(
        title=title,
        speaker=speaker,
        voice=voice,
        dock=("top" if renpy.variant("mobile") else "bottom"),
    ):
        transclude


transform mobile_dialogue_position:
    xalign 0.5
    yalign 1.0
    yoffset -dialogue_card_bottom_margin


transform mobile_dialogue_button_pressed:
    matrixcolor BrightnessMatrix(-0.06)


# Standard dialogue card (inspo #1): white rounded card with a soft shadow,
# pink name chip on the top-left edge, speaker button on the top-right edge,
# French (primary, bold) + optional English (secondary, grey), and a navy
# "next" button on the bottom-right edge.
#
# Coordinates inside the fixed are measured from the shadow image's outer box,
# so the visible card starts at (dialogue_card_shadow_x, dialogue_card_shadow_top).
screen mobile_dialogue_card(
    speaker,
    primary_text,
    secondary_text=None,
    show_speaker=True,
    show_next=True,
    speaker_action=VoiceReplay(),
    next_action=Return(True),
):
    fixed:
        fit_first True
        xsize dialogue_card_outer_width
        at mobile_dialogue_position

        frame:
            id "window"
            style "window"
            xfill True

            # Grows with the text up to dialogue_card_text_max_height, then
            # scrolls (drag or mouse wheel) instead of growing further.
            viewport:
                xfill True
                yfill False
                ymaximum dialogue_card_text_max_height
                draggable True
                mousewheel True

                vbox:
                    xfill True
                    spacing dialogue_line_gap

                    text primary_text:
                        id "what"
                        style "say_dialogue"

                    if secondary_text:
                        text secondary_text:
                            style "mobile_dialogue_secondary_text"

        if speaker is not None:
            frame:
                style "mobile_dialogue_name_chip_frame"
                xpos dialogue_card_shadow_x + dialogue_name_chip_left_inset
                ypos dialogue_card_shadow_top - dialogue_name_chip_overlap_y
                text speaker:
                    id "who"
                    style "mobile_dialogue_name_chip_text"
                    xalign 0.5
                    yalign 0.5

        if show_speaker:
            button:
                style "mobile_dialogue_speaker_button"
                xalign 1.0
                xoffset -(dialogue_card_shadow_x + dialogue_speaker_right_inset)
                ypos dialogue_card_shadow_top - (dialogue_speaker_size // 2)
                action speaker_action
                alt "Replay audio"

                add "gui/mobile/dialogue_speaker_icon.svg":
                    xalign 0.5
                    yalign 0.5
                    xsize dialogue_speaker_icon_size
                    ysize dialogue_speaker_icon_size

        if show_next:
            button:
                style "mobile_dialogue_next_button"
                xalign 1.0
                yalign 1.0
                xoffset -(dialogue_card_shadow_x + dialogue_next_right_inset)
                yoffset (dialogue_next_size // 2) - dialogue_card_shadow_bottom
                action next_action
                alt "Continue"

                add "gui/mobile/dialogue_chevron.svg":
                    xalign 0.5
                    yalign 0.5
                    xoffset ui_px(2)
                    xsize dialogue_next_icon_size
                    ysize dialogue_next_icon_size


# Pronunciation / speech card (inspo #4). Shares the dialogue card's look:
# white shadow card, name chip on the top-left edge and a replay button on the
# top-right edge. `placement` is accepted for compatibility; the card docks
# above the bottom edge like the dialogue card.
screen mobile_pronunciation_card(
    placement=UI_LAYOUT_BOTTOM,
    speaker_name="Sophie",
    show_speaker=True,
    speaker_action=None,
):
    fixed:
        fit_first True
        xsize dialogue_card_outer_width
        at mobile_dialogue_position

        frame:
            style "mobile_pronunciation_frame"
            transclude

        if speaker_name:
            frame:
                style "mobile_dialogue_name_chip_frame"
                xpos dialogue_card_shadow_x + dialogue_name_chip_left_inset
                ypos dialogue_card_shadow_top - dialogue_name_chip_overlap_y
                text speaker_name:
                    style "mobile_dialogue_name_chip_text"

        if show_speaker:
            button:
                style "mobile_dialogue_speaker_button"
                xalign 1.0
                xoffset -(dialogue_card_shadow_x + dialogue_speaker_right_inset)
                ypos dialogue_card_shadow_top - (dialogue_speaker_size // 2)
                action speaker_action
                alt "Replay audio"

                add "gui/mobile/dialogue_speaker_icon.svg":
                    xalign 0.5
                    yalign 0.5
                    xsize dialogue_speaker_icon_size
                    ysize dialogue_speaker_icon_size


# A single text field in a Sophie sheet/card with Back and Continue. The
# keyboard's Return key also submits. Returns the stripped text, or None when
# the player taps Back. Continue is disabled until something is typed.
screen mobile_text_input(question, voice=None, length=30):
    default text_value = ""

    modal True
    zorder 90

    use mobile_input_sheet(title=question, voice=voice):
        vbox:
            xfill True
            spacing ui_card_gap_large

            frame:
                style "mobile_text_field"

                input:
                    style "mobile_text_field_input"
                    value MobileFieldValue("text_value", on_submit=mobile_submit_text)
                    length length

            use mobile_button_row([
                ("Back", Return(None), "secondary"),
                (
                    "Continue",
                    If(
                        text_value.strip(),
                        Function(mobile_submit_text, text_value),
                        None,
                    ),
                    "primary",
                ),
            ])


# A row of equal-width, equal-height buttons that fills the card's width.
# buttons: list of (label, action, kind) where kind is "primary" or "secondary".
screen mobile_button_row(buttons):
    grid len(buttons) 1:
        xfill True
        spacing ui_card_gap_small

        for label, action, kind in buttons:
            textbutton label:
                style ("mobile_primary_button" if kind == "primary" else "mobile_secondary_button")
                action action


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
            yalign 0.5
            spacing choice_icon_gap

            if icon is not None:
                add icon:
                    xsize choice_icon_size
                    ysize choice_icon_size
                    yalign 0.5

            text label style "mobile_choice_button_text"


# A vertical list of choice pills. Each option is (label, action) or
# (label, action, icon).
screen mobile_choice_list(options):
    vbox:
        xfill True
        spacing choice_pill_gap

        for option in options:
            use mobile_choice_button(
                option[0],
                option[1],
                icon=option[2] if len(option) > 2 else None,
            )


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
                # Always keep exactly one status line so the card never changes
                # height between states (it used to vanish for a tick between
                # "preparing" and "playing", making the whole card jump twice).
                # TTS_READY is the brief moment before playback starts.
                $ tts_status = tts_session.status
                $ tts_status_text = {
                    TTS_PREPARING: "Preparing Sophie's voice...",
                    TTS_READY: "Sophie is speaking...",
                    TTS_PLAYING: "Sophie is speaking...",
                    TTS_ERROR: "Voice unavailable — the text is still available.",
                }.get(tts_status, "")

                text (tts_status_text or " "):
                    style "mobile_status_text"
                    color (ui_error if tts_status == TTS_ERROR else ui_secondary_text)

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
