# Opening scene and onboarding story logic.


transform sophie_park_position:
    # Preserve the sprite's aspect ratio while keeping Sophie centre-left.
    xalign 0.30
    yalign 0.80
    zoom 0.45


label opening_scene:
    scene bg park_day
    with dissolve

    show sophie casual at sophie_park_position
    with dissolve

    # TODO: Replace this dissolve with genuine assets for:
    # walk into scene -> stop -> wave -> conversational pose.

    Sophie "Hi! I'm Sophie."
    Sophie "It's really nice to meet you."
    Sophie "Why don't you introduce yourself?"

    call screen introduction_controls


label type_introduction:
    $ player_name = renpy.input("What's your name?").strip()

    if player_name:
        Sophie "Nice to meet you, [player_name]!"

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
