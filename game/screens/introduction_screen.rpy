# Minimal controls for introducing the player.

screen introduction_controls():
    modal True
    zorder 90

    use mobile_bottom_sheet:
        vbox:
            xfill True
            spacing ui_card_gap

            use mobile_name_chip(label="Sophie")

            text "Introduce yourself":
                style "mobile_question_text"

            hbox:
                xfill True
                spacing ui_card_gap_small

                textbutton "Speak":
                    style "mobile_primary_button"
                    action [Hide("introduction_controls"), Jump("speak_introduction")]
                    xminimum ui_button_min_width

                textbutton "Type":
                    style "mobile_secondary_button"
                    action [Hide("introduction_controls"), Jump("type_introduction")]
                    xminimum ui_button_min_width
