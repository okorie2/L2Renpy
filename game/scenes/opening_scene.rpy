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
    play music "audio/chapter1/music/sophie_park_upbeat_loop.mp3" loop fadein 2.0 volume 0.20

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

    voice "audio/chapter1/scene1/sophie/hi_im_sophie.mp3"
    Sophie "Hi! I'm Sophie."
    voice "audio/chapter1/scene1/sophie/nice_to_meet_you.mp3"
    Sophie "It's really nice to meet you."
    voice "audio/chapter1/scene1/sophie/introduce_yourself.mp3"
    Sophie "Why don't you introduce yourself?"

    call screen introduction_controls


label type_introduction:
    $ player_name = renpy.input("What's your name?").strip()

    jump introduction_name_complete


label speak_introduction:
    # Reuse the existing Speak button route with the generic speech component.
    call screen speech_input(
        mode="transcription",
        language="en",
        prompt="Say your name.",
    )
    $ speech_result = _return

    if speech_result and speech_result.get("status") == "confirmed":
        $ player_name = speech_result.get("transcript", "")

    if not speech_result or speech_result.get("status") != "confirmed":
        jump type_introduction

    jump introduction_name_complete


label introduction_name_complete:
    if player_name:
        show sophie wave at sophie_park_position
        if player_name == "Ella":
            voice "audio/chapter1/scene1/sophie/nice_to_meet_you_ella.mp3"
        Sophie "Nice to meet you, [player_name]!"
        pause 0.75
        show sophie casual at sophie_park_position

    jump after_introduction


label after_introduction:
    voice "audio/chapter1/scene1/sophie/french_level_question.mp3"
    Sophie "First, how much French do you already know?"
    call screen onboarding_choice("Which level fits you best?", [("Beginner", "beginner"), ("Intermediate", "intermediate"), ("Expert", "expert")], "french_level")
    jump ask_learning_goal


label ask_learning_goal:
    voice "audio/chapter1/scene1/sophie/why_learn_french.mp3"
    Sophie "And why do you want to learn French?"
    call screen onboarding_choice("Which reason fits you best?", [("Education", "education"), ("Career", "career"), ("Tourism", "tourism"), ("Relationship", "relationship"), ("General Purpose", "general")], "learning_goal")

    # TODO: Use learning_goal with future onboarding answers to select a
    # learning world. For now, every choice follows the same General Purpose flow.
    jump ask_age


label ask_age:
    voice "audio/chapter1/scene1/sophie/age_question.mp3"
    Sophie "One last thing — how old are you?"
    call screen onboarding_age_input
    $ player_age = _return
    jump onboarding_questions_complete


label onboarding_questions_complete:
    voice "audio/chapter1/scene1/sophie/great.mp3"
    Sophie "Great."
    voice "audio/chapter1/scene1/sophie/how_i_would_introduce_myself.mp3"
    Sophie "With the details you've given me, this is how you could introduce yourself in French."

    $ personalized_introduction = build_personalized_introduction(
        player_name,
        player_age,
        learning_goal,
        french_level,
    )
    $ french_tts_session = FrenchTTSSession(
        personalized_introduction["french_text"]
    )
    $ french_tts_session.start()
    call screen bilingual_introduction(
        personalized_introduction["french_text"],
        personalized_introduction["english_text"],
        french_tts_session,
    )
    $ french_tts_session.dispose()

    voice "audio/chapter1/scene1/sophie/mouthful.mp3"
    Sophie "I know, it's a mouthful!"
    voice "audio/chapter1/scene1/sophie/bit_by_bit.mp3"
    Sophie "So we'll take it bit by bit."

    $ practice_index = 0
    $ practice_results = []
    call pronunciation_practice_loop

    stop music fadeout 1.5
    return


label pronunciation_practice_loop:
    if practice_index >= len(personalized_introduction["french_lines"]):
        return

    $ practice_target = personalized_introduction["french_lines"][practice_index]
    $ practice_translation = personalized_introduction["english_lines"][practice_index]
    $ practice_tts_session = FrenchTTSSession(practice_target)
    $ practice_tts_session.start()
    call screen speech_input(
        mode="pronunciation",
        language="fr",
        reference_text=practice_target,
        reference_tts_session=practice_tts_session,
        translation=practice_translation,
    )
    $ practice_result = _return
    $ practice_tts_session.dispose()

    if not practice_result or practice_result.get("status") != "confirmed":
        return

    $ practice_evaluation = practice_result.get("evaluation", {})
    if pronunciation_similarity_is_perfect(practice_evaluation):
        $ practice_results.append(practice_result)
        $ practice_index += 1
        jump pronunciation_practice_loop

    # The pronunciation screen does not offer Continue for a non-perfect
    # result. Keep this guard so an unexpected return cannot advance the index.
    return
