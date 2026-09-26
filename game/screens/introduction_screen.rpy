# Sophie asks the player to introduce themselves; they choose to speak or type.

screen introduction_controls(
    question="Why don't you introduce yourself?",
    voice="audio/chapter1/scene1/sophie/introduce_yourself.mp3",
):
    modal True
    zorder 90

    use mobile_sheet(title=question, voice=voice):
        use mobile_choice_list([
            ("Speak", [Hide("introduction_controls"), Jump("speak_introduction")], "gui/mobile/icon_speak.svg"),
            ("Type", [Hide("introduction_controls"), Jump("type_introduction")], "gui/mobile/icon_type.svg"),
        ])
