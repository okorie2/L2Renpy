# Sophie asks the player's name; they choose to speak or type it.

screen introduction_controls(
    question="What's your name?",
    voice=None,
):
    modal True
    zorder 90

    use mobile_sheet(title=question, voice=voice):
        use mobile_choice_list([
            ("Speak", [Hide("introduction_controls"), Jump("speak_introduction")], "gui/mobile/icon_speak.svg"),
            ("Type", [Hide("introduction_controls"), Jump("type_introduction")], "gui/mobile/icon_type.svg"),
        ])
