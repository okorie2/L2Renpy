# Shared mobile-first presentation components.
#
# These screens own visual treatment and placement only. Callers continue to
# own interaction state, actions, and return values.

define APP_LAYOUT_BOTTOM = "bottom"
define APP_LAYOUT_BOTTOM_SHEET = "bottom_sheet"
define APP_LAYOUT_SIDE_LEFT = "side_left"
define APP_LAYOUT_SIDE_RIGHT = "side_right"
define APP_LAYOUT_CENTER_FOCUS = "center_focus"

define app_panel_max_width = min(layout_content_width, 1200)
define app_card_padding = 36
define app_text_max_width = min(layout_content_width - (app_card_padding * 2), 900)
define app_card_borders = Borders(28, 28, 28, 28)
define app_sheet_borders = Borders(28, 28, 28, 28)
define app_button_borders = Borders(22, 22, 22, 22)
define app_tag_borders = Borders(24, 24, 24, 24)

define app_cream = "#fff9f5"
define app_navy = "#14244a"
define app_secondary = "#687280"
define app_blue = "#4f8cff"
define app_blue_dark = "#2866d8"
define app_blush = "#ffb7c3"


init python:
    def app_layout_xalign(layout):
        return {
            APP_LAYOUT_BOTTOM: 0.5,
            APP_LAYOUT_BOTTOM_SHEET: 0.5,
            APP_LAYOUT_SIDE_LEFT: 0.08,
            APP_LAYOUT_SIDE_RIGHT: 0.92,
            APP_LAYOUT_CENTER_FOCUS: 0.5,
        }.get(layout, 0.5)

    def app_layout_yalign(layout):
        return {
            APP_LAYOUT_BOTTOM: 0.88,
            APP_LAYOUT_BOTTOM_SHEET: 1.0,
            APP_LAYOUT_SIDE_LEFT: 0.5,
            APP_LAYOUT_SIDE_RIGHT: 0.5,
            APP_LAYOUT_CENTER_FOCUS: 0.46,
        }.get(layout, 0.46)


transform app_panel_position(xalign_value, yalign_value):
    # These are normalized anchors. A future scene can select a different
    # presentation mode without changing the content screen.
    xalign xalign_value
    yalign yalign_value


style app_card_frame is default:
    xfill True
    xmaximum app_panel_max_width
    xpadding app_card_padding
    ypadding 40
    background Frame("gui/mobile/card.svg", app_card_borders, tile=False)


style app_sheet_frame is app_card_frame:
    xmargin layout_safe_margin
    xmaximum app_panel_max_width
    ypadding 38
    background Frame("gui/mobile/sheet.svg", app_sheet_borders, tile=False)


style app_question_text is default:
    xalign 0.5
    xmaximum app_text_max_width
    text_align 0.5
    color app_navy
    size 32
    bold True


style app_section_label is default:
    xalign 0.5
    color app_blue_dark
    size 18
    bold True


style app_french_text is default:
    xalign 0.5
    xmaximum app_text_max_width
    text_align 0.5
    color app_navy
    size 31
    bold True


style app_english_text is default:
    xalign 0.5
    xmaximum app_text_max_width
    text_align 0.5
    color app_secondary
    size 24


style app_status_text is default:
    xalign 0.5
    xmaximum app_text_max_width
    text_align 0.5
    color app_secondary
    size 21


style app_name_pill_frame is default:
    xpadding 22
    ypadding 8
    background Frame("gui/mobile/tag.svg", app_tag_borders, tile=False)


style app_name_pill_frame_text is default:
    color app_navy
    size 22
    bold True


style app_choice_button is button:
    xfill True
    yminimum 70
    xpadding 24
    ypadding 14
    background Frame("gui/mobile/choice.svg", app_button_borders, tile=False)
    hover_background Frame(
        "gui/mobile/choice_hover.svg",
        app_button_borders,
        tile=False,
    )


style app_choice_button_text is button_text:
    xalign 0.0
    color app_navy
    hover_color "#ffffff"
    size 25
    bold True


style app_primary_button is app_choice_button:
    xminimum 260
    background Frame(
        "gui/mobile/choice_hover.svg",
        app_button_borders,
        tile=False,
    )


style app_primary_button_text is app_choice_button_text:
    xalign 0.5
    color "#ffffff"
    hover_color "#ffffff"


style app_input is input:
    xalign 0.5
    xmaximum 320
    xpadding 22
    ypadding 14
    color app_navy
    size 28
    background Frame("gui/mobile/choice.svg", app_button_borders, tile=False)


screen app_card(layout=APP_LAYOUT_BOTTOM):
    frame:
        style "app_card_frame"
        at app_panel_position(app_layout_xalign(layout), app_layout_yalign(layout))
        transclude


screen app_bottom_sheet(layout=APP_LAYOUT_BOTTOM_SHEET):
    frame:
        style "app_sheet_frame"
        at app_panel_position(app_layout_xalign(layout), app_layout_yalign(layout))
        transclude
