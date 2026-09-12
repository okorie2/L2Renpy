# Opening scene and onboarding story logic.


transform sophie_park_position:
    # Preserve the sprite's aspect ratio while keeping Sophie centre-left.
    xalign 0.30
    yalign 0.80
    zoom 0.45


transform sophie_walk_to_park_position:
    # Sophie approaches along the park path: mostly toward the camera, with
    # only a small horizontal correction into her conversation position.
    xalign 0.40
    yalign 0.55
    zoom 0.18
    linear 1.80 xalign 0.30 yalign 0.80 zoom 0.45


label opening_scene:
    scene bg park_day
    with dissolve

    # Let the park establish itself before Sophie enters.
    pause 0.25

    # The animated walk cycle loops while this transform makes Sophie approach
    # the camera by growing and moving downward along the path.
    show sophie walk at sophie_walk_to_park_position
    pause 1.80

    # All three states use the same canvas, anchors, and scale. Replacing the
    # tagged sprite directly avoids a dissolve or a position jump.
    show sophie wave at sophie_park_position
    pause 0.90

    show sophie casual at sophie_park_position

    Sophie "Hi! I'm Sophie."
    Sophie "It's really nice to meet you."
    Sophie "Why don't you introduce yourself?"

    call screen introduction_controls


label type_introduction:
    $ player_name = renpy.input("What's your name?").strip()

    if player_name:
        show sophie wave at sophie_park_position
        Sophie "Nice to meet you, [player_name]!"
        pause 0.75
        show sophie casual at sophie_park_position

    jump after_introduction


label speak_introduction:
    Sophie "Speech input will be added here."
    call screen introduction_controls


label after_introduction:
    Sophie "First, how much French do you already know?"
    call screen onboarding_choice("Which level fits you best?", [("Beginner", "beginner"), ("Intermediate", "intermediate"), ("Expert", "expert")], "french_level")
    jump ask_learning_goal


label ask_learning_goal:
    Sophie "And why do you want to learn French?"
    call screen onboarding_choice("Which reason fits you best?", [("Education", "education"), ("Career", "career"), ("Tourism", "tourism"), ("Relationship", "relationship"), ("General Purpose", "general")], "learning_goal")

    # TODO: Use learning_goal with future onboarding answers to select a
    # learning world. For now, every choice follows the same General Purpose flow.
    jump ask_age_range


label ask_age_range:
    Sophie "One last thing — how old are you?"
    call screen onboarding_choice("Which age range fits you?", [("Under 18", "under_18"), ("18–24", "18_24"), ("25–34", "25_34"), ("35–44", "35_44"), ("45+", "45_plus")], "age_range")
    jump onboarding_questions_complete


label onboarding_questions_complete:
    # TODO: Sophie explains how the learning world works here.
    # Next phase will add bilingual French/English dialogue and Sophie voice audio.
    return
