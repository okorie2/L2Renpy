# Minimal controls for introducing the player.

screen introduction_controls():
    frame:
        xalign 0.5
        yalign 0.86
        xpadding 36
        ypadding 18
        background Solid("#14241dcc")

        vbox:
            xalign 0.5
            spacing 14

            text "Introduce yourself":
                xalign 0.5
                size 30

            hbox:
                xalign 0.5
                spacing 18

                textbutton "Speak":
                    action [Hide("introduction_controls"), Jump("speak_introduction")]
                    xminimum 180
                    yminimum 64

                textbutton "Type":
                    action [Hide("introduction_controls"), Jump("type_introduction")]
                    xminimum 180
                    yminimum 64
