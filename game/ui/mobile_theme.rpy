# Shared mobile-first design tokens and responsive layout helpers.
#
# These values describe the presentation system only. Story state, actions,
# and speech behavior stay in their owning screens and scenes.

define UI_LAYOUT_BOTTOM = "bottom"
define UI_LAYOUT_BOTTOM_SHEET = "bottom_sheet"
define UI_LAYOUT_CENTER_FOCUS = "center_focus"
define UI_LAYOUT_SIDE_LEFT = "side_left"
define UI_LAYOUT_SIDE_RIGHT = "side_right"

init python:
    def ui_px(value):
        """Scale a design-space dimension from the 1080px base width."""

        scale = float(config.screen_width) / 1080.0
        return int(round(float(value) * scale))

    def ui_layout_xalign(layout):
        return {
            UI_LAYOUT_BOTTOM: 0.5,
            UI_LAYOUT_BOTTOM_SHEET: 0.5,
            UI_LAYOUT_CENTER_FOCUS: 0.5,
            UI_LAYOUT_SIDE_LEFT: 0.08,
            UI_LAYOUT_SIDE_RIGHT: 0.92,
        }.get(layout, 0.5)

    def ui_layout_yalign(layout):
        return {
            UI_LAYOUT_BOTTOM: 0.88,
            UI_LAYOUT_BOTTOM_SHEET: 1.0,
            UI_LAYOUT_CENTER_FOCUS: 0.46,
            UI_LAYOUT_SIDE_LEFT: 0.5,
            UI_LAYOUT_SIDE_RIGHT: 0.5,
        }.get(layout, 0.46)

    def ui_layout_width(layout):
        if layout in (UI_LAYOUT_SIDE_LEFT, UI_LAYOUT_SIDE_RIGHT):
            return min(ui_panel_width, ui_px(540))

        return ui_panel_width


define ui_primary_blue = "#4F8CFF"
define ui_primary_blue_pressed = "#3977E8"
define ui_primary_blue_soft = "#EEF4FF"
define ui_cream = "#FFF9F5"
define ui_cream_secondary = "#FFF4EF"
define ui_blush = "#FFB7C3"
define ui_blush_pressed = "#FFA6B6"
define ui_navy = "#1F2A44"
define ui_secondary_text = "#6B7280"
define ui_muted_text = "#9CA3AF"
define ui_border = "#E4E8F1"
define ui_soft_border = "#EDF0F5"
define ui_success = "#22C55E"
define ui_error = "#E85D68"
define ui_white = "#FFFFFF"


define ui_card_padding = ui_px(44)
define ui_card_vertical_padding = ui_px(38)
define ui_card_gap_large = ui_px(28)
define ui_card_gap = ui_px(20)
define ui_card_gap_small = ui_px(14)
define ui_card_borders = Borders(ui_px(38), ui_px(38), ui_px(38), ui_px(38))
define ui_control_borders = Borders(ui_px(30), ui_px(30), ui_px(30), ui_px(30))
define ui_pill_borders = Borders(ui_px(40), ui_px(40), ui_px(40), ui_px(40))
define ui_panel_width = min(layout_content_width, ui_px(960))
define ui_text_width = min(
    max(layout_content_width - (ui_card_padding * 2), 1),
    ui_px(900),
)
define ui_choice_height = ui_px(88)
define ui_primary_height = ui_px(92)
define ui_touch_minimum = ui_px(76)
define ui_button_min_width = ui_px(240)
define ui_mic_size = ui_px(190)


# Standard mobile dialogue card tokens. These are intentionally separate from
# the generic card/sheet tokens so this component can be tuned independently.
#
# dialogue_card.svg bakes a soft drop shadow around a white card, so the frame
# image is larger than the visible card. These values describe that SVG's
# geometry (shadow margins + corner radius, in the SVG's own pixels). Frame
# draws its corners at the image's native size, so they are deliberately NOT
# passed through ui_px(): layout offsets and Frame borders both come from this
# one set of numbers and always agree. Update them if the SVG changes.
define dialogue_card_shadow_x = 18
define dialogue_card_shadow_top = 10
define dialogue_card_shadow_bottom = 28
define dialogue_card_corner_radius = 40
define dialogue_card_borders = Borders(
    dialogue_card_shadow_x + dialogue_card_corner_radius,
    dialogue_card_shadow_top + dialogue_card_corner_radius,
    dialogue_card_shadow_x + dialogue_card_corner_radius,
    dialogue_card_shadow_bottom + dialogue_card_corner_radius,
)

# Visible card size and inner spacing.
define dialogue_card_width = min(ui_px(960), layout_viewport[0] - ui_px(80))
define dialogue_card_outer_width = dialogue_card_width + (dialogue_card_shadow_x * 2)
define dialogue_card_padding_left = ui_px(52)
define dialogue_card_padding_right = ui_px(104)
define dialogue_card_padding_top = ui_px(54)
define dialogue_card_padding_bottom = ui_px(46)
define dialogue_card_bottom_margin = ui_px(150)

# Name chip (pink pill straddling the top-left edge).
define dialogue_name_chip_height = ui_px(56)
define dialogue_name_chip_padding_x = ui_px(28)
define dialogue_name_chip_overlap_y = ui_px(28)
define dialogue_name_chip_left_inset = ui_px(34)
define dialogue_name_chip_text_size = ui_px(28)

# Round controls: speaker straddles the top-right edge, next straddles the
# bottom-right edge. Insets are measured from the visible card's right edge.
define dialogue_speaker_size = ui_px(90)
define dialogue_speaker_icon_size = ui_px(40)
define dialogue_speaker_right_inset = ui_px(30)
define dialogue_next_size = ui_px(94)
define dialogue_next_icon_size = ui_px(40)
define dialogue_next_right_inset = ui_px(26)

# Text: French (primary) bold navy, English (secondary) regular grey.
define dialogue_primary_size = ui_px(40)
define dialogue_secondary_size = ui_px(33)
define dialogue_line_gap = ui_px(16)
# Longest text area before the card scrolls, as a share of screen height, so a
# long line can never push the card up over Sophie's face on any viewport.
define dialogue_card_text_max_height = int(layout_viewport[1] * 0.22)
define dialogue_card_text_width = (
    dialogue_card_width
    - dialogue_card_padding_left
    - dialogue_card_padding_right
)


# Bottom sheet tokens (inspo #2). The sheet spans the full screen width and is
# anchored to the bottom edge; only its top corners are rounded.
#
# bottom_sheet.svg geometry (SVG pixels, not ui_px - see dialogue card notes):
# a soft upward shadow in the top margin, then a white sheet with r=56 corners.
define sheet_shadow_top = 24
define sheet_corner_radius = 56
define sheet_borders = Borders(
    sheet_corner_radius,
    sheet_shadow_top + sheet_corner_radius,
    sheet_corner_radius,
    8,
)
define sheet_padding_x = layout_safe_margin
define sheet_padding_top = ui_px(76)
# Keeps controls clear of the home indicator / gesture area on phones.
define sheet_padding_bottom = ui_px(84)
define sheet_content_gap = ui_px(30)
define sheet_handle_width = ui_px(80)
define sheet_handle_height = ui_px(10)
define sheet_handle_top = ui_px(20)
define sheet_title_size = ui_px(40)
# The replay button sits on the sheet's top edge, above the title, so the
# title can use the full content width.
define sheet_title_width = layout_viewport[0] - (sheet_padding_x * 2)

# Choice pills inside sheets.
define choice_pill_height = ui_px(96)
define choice_pill_borders = Borders(48, 48, 48, 48)
define choice_pill_padding_x = ui_px(36)
define choice_pill_gap = ui_px(18)
define choice_icon_size = ui_px(40)
define choice_icon_gap = ui_px(24)
define choice_text_size = ui_px(31)


# Compatibility names for the first mobile UI pass. New screens should use the
# UI_* and ui_* tokens above so theme changes remain centralized.
define APP_LAYOUT_BOTTOM = UI_LAYOUT_BOTTOM
define APP_LAYOUT_BOTTOM_SHEET = UI_LAYOUT_BOTTOM_SHEET
define APP_LAYOUT_CENTER_FOCUS = UI_LAYOUT_CENTER_FOCUS
define APP_LAYOUT_SIDE_LEFT = UI_LAYOUT_SIDE_LEFT
define APP_LAYOUT_SIDE_RIGHT = UI_LAYOUT_SIDE_RIGHT


transform mobile_panel_position(xalign_value, yalign_value):
    xalign xalign_value
    yalign yalign_value
