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
define dialogue_card_width = ui_px(900)
define dialogue_card_padding_left = ui_px(42)
define dialogue_card_padding_right = ui_px(42)
define dialogue_card_padding_top = ui_px(50)
define dialogue_card_padding_bottom = ui_px(32)
define dialogue_card_radius = ui_px(32)
define dialogue_card_bottom_margin = ui_px(130)
define dialogue_name_chip_height = ui_px(46)
define dialogue_name_chip_padding_x = ui_px(20)
define dialogue_name_chip_overlap_y = ui_px(24)
define dialogue_name_chip_left_inset = ui_px(28)
define dialogue_speaker_size = ui_px(64)
define dialogue_speaker_outset_x = ui_px(6)
define dialogue_speaker_overlap_y = ui_px(20)
define dialogue_next_size = ui_px(64)
define dialogue_next_outset_x = ui_px(6)
define dialogue_next_overlap_y = ui_px(20)
define dialogue_primary_size = ui_px(30)
define dialogue_secondary_size = ui_px(24)
define dialogue_line_gap = ui_px(10)
define dialogue_card_text_width = min(
    dialogue_card_width
    - dialogue_card_padding_left
    - dialogue_card_padding_right,
    layout_content_width,
)


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
