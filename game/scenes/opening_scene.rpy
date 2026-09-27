# Opening scene and onboarding story logic.


# Keep the scene composition in normalized coordinates so future display-size
# variants can adjust these values without rewriting the scene sequence.
#
# Sophie's size is expressed as a share of the screen height rather than a raw
# zoom, so it stays correct if the design viewport changes (landscape, tablet
# variants). Zoom is derived from it and the sprite canvas height.
#
# At 0.68 her chin sits ~790px down a 1920px screen, above the tallest bottom
# sheet (~820px) and the dialogue card. Keep it <= 0.80: above that the
# 1536px sprites are upscaled and start to look soft.
define sophie_sprite_height = 1536  # all Sophie sprites share this canvas
define sophie_screen_height = 0.68
define sophie_park_zoom = (
    sophie_screen_height * layout_viewport[1] / float(sophie_sprite_height)
)
define sophie_park_xalign = 0.30
define sophie_ground_yalign = 0.94

# The walk-in starts further down the path at 40% of her final size (the same
# proportion as before), so the entrance keeps its feel at any final size.
define sophie_walk_start_xalign = 0.40
define sophie_walk_start_yalign = 0.62
define sophie_walk_start_zoom = sophie_park_zoom * 0.40


transform sophie_park_position:
    # Preserve the sprite's aspect ratio while keeping Sophie centre-left.
    xalign sophie_park_xalign
    yalign sophie_ground_yalign
    zoom sophie_park_zoom


transform sophie_walk_to_park_position:
    # Sophie approaches along the park path: mostly toward the camera, with
    # only a small horizontal correction into her conversation position.
    xalign sophie_walk_start_xalign
    yalign sophie_walk_start_yalign
    zoom sophie_walk_start_zoom
    linear 1.80 xalign sophie_park_xalign yalign sophie_ground_yalign zoom sophie_park_zoom


label opening_scene:
    scene bg park_day
    with dissolve
    play music "audio/chapter1/music/audio_1.mp3" loop fadein 2.0 volume 0.20

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
    # Sophie's question is shown inside the sheet itself (inspo #2), so it is
    # queued here instead of on a separate dialogue line. Use `voice`, not
    # `play voice`: Ren'Py's voice system stops the voice channel when a new
    # interaction (the `call screen`) starts unless the line was queued with
    # `voice`, which would cut the audio off after the first word.
    voice "audio/chapter1/scene1/sophie/introduce_yourself.mp3"
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
    call screen onboarding_choice(
        "First, how much French do you already know?",
        [
            ("Beginner", "beginner", "gui/mobile/icon_level_1.svg"),
            ("Intermediate", "intermediate", "gui/mobile/icon_level_2.svg"),
            ("Expert", "expert", "gui/mobile/icon_level_3.svg"),
        ],
        "french_level",
        voice="audio/chapter1/scene1/sophie/french_level_question.mp3",
    )
    jump ask_learning_goal


label ask_learning_goal:
    voice "audio/chapter1/scene1/sophie/why_learn_french.mp3"
    call screen onboarding_choice(
        "And why do you want to learn French?",
        [
            ("Education", "education", "gui/mobile/icon_education.svg"),
            ("Career", "career", "gui/mobile/icon_career.svg"),
            ("Tourism", "tourism", "gui/mobile/icon_tourism.svg"),
            ("Relationship", "relationship", "gui/mobile/icon_relationship.svg"),
            ("General purpose", "general", "gui/mobile/icon_general.svg"),
        ],
        "learning_goal",
        voice="audio/chapter1/scene1/sophie/why_learn_french.mp3",
    )

    # TODO: Use learning_goal with future onboarding answers to select a
    # learning world. For now, every choice follows the same General Purpose flow.
    jump ask_age


label ask_age:
    voice "audio/chapter1/scene1/sophie/age_question.mp3"
    call screen onboarding_age_input(
        "One last thing — how old are you?",
        voice="audio/chapter1/scene1/sophie/age_question.mp3",
    )
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
    $ practice_mode = "phrase"
    $ original_reference_text = ""
    $ remediation_word = None
    $ practice_state = PronunciationPracticeState()
    $ practice_reference_cache = PronunciationReferenceCache()
    call pronunciation_practice_loop

    stop music fadeout 1.5
    return


label pronunciation_practice_loop:
    if practice_mode == "phrase":
        if practice_index >= len(personalized_introduction["french_lines"]):
            $ practice_reference_cache.dispose_all()
            return

        $ practice_target = personalized_introduction["french_lines"][practice_index]
        $ practice_translation = personalized_introduction["english_lines"][practice_index]
        $ original_reference_text = practice_target
        $ practice_state.start_phrase_attempt(
            final_phrase=practice_state.final_phrase_attempt
        )
        $ practice_mode = practice_state.practice_mode
    elif practice_mode == "word":
        if not remediation_word or not remediation_word.get("word"):
            $ practice_state.prepare_final_phrase_attempt()
            $ practice_mode = practice_state.practice_mode
            jump pronunciation_practice_loop

        $ practice_target = remediation_word["word"]
        $ practice_translation = ""
        $ practice_state.start_word_attempt()
        $ practice_mode = practice_state.practice_mode
    else:
        $ practice_reference_cache.dispose_all()
        return

    $ practice_tts_session = practice_reference_cache.get_or_create(
        practice_target,
        practice_mode,
    )
    call screen speech_input(
        mode="pronunciation",
        language="fr",
        reference_text=practice_target,
        reference_tts_session=practice_tts_session,
        translation=practice_translation,
        practice_mode=practice_mode,
        practice_state=practice_state,
    )
    $ practice_result = _return

    if practice_result == "retry":
        jump pronunciation_practice_loop

    if practice_result == "full_phrase":
        $ practice_reference_cache.release(practice_target, "word")
        $ practice_state.prepare_final_phrase_attempt()
        $ practice_mode = "phrase"
        $ remediation_word = None
        jump pronunciation_practice_loop

    if not practice_result or not isinstance(practice_result, dict):
        $ practice_reference_cache.dispose_all()
        return

    if practice_result.get("status") == "remediate":
        $ practice_evaluation = practice_result.get("evaluation", {})
        $ practice_state.record_evaluation("phrase", practice_evaluation)
        $ remediation_word = practice_result.get("evaluation", {}).get(
            "weakest_word"
        )
        if not remediation_word:
            $ practice_result.update(
                practice_state.phrase_outcome(practice_evaluation)
            )
            $ practice_results.append(practice_result)
            $ practice_reference_cache.release(practice_target, "phrase")
            $ practice_state.reset_for_new_phrase()
            $ practice_mode = practice_state.practice_mode
            $ practice_index += 1
            jump pronunciation_practice_loop
        $ practice_state.begin_word_remediation(remediation_word)
        $ practice_mode = "word"
        jump pronunciation_practice_loop

    if practice_result.get("status") != "confirmed":
        $ practice_reference_cache.dispose_all()
        return

    $ practice_evaluation = practice_result.get("evaluation", {})
    $ practice_state.record_evaluation(practice_mode, practice_evaluation)

    if practice_mode == "word":
        if (
            word_pronunciation_passes(practice_evaluation)
            or practice_state.word_attempts >= MAX_WORD_ATTEMPTS
        ):
            $ practice_reference_cache.release(practice_target, "word")
            $ practice_state.prepare_final_phrase_attempt()
            $ practice_mode = "phrase"
            $ remediation_word = None
            jump pronunciation_practice_loop
        jump pronunciation_practice_loop

    if phrase_pronunciation_passes(practice_evaluation):
        $ practice_result.update(
            practice_state.phrase_outcome(practice_evaluation)
        )
        $ practice_results.append(practice_result)
        $ practice_reference_cache.release(practice_target, "phrase")
        $ practice_state.reset_for_new_phrase()
        $ practice_mode = practice_state.practice_mode
        $ remediation_word = None
        $ practice_index += 1
        jump pronunciation_practice_loop

    if practice_state.final_phrase_attempt:
        $ practice_result.update(
            practice_state.phrase_outcome(practice_evaluation)
        )
        $ practice_results.append(practice_result)
        $ practice_reference_cache.release(practice_target, "phrase")
        $ practice_state.reset_for_new_phrase()
        $ practice_mode = practice_state.practice_mode
        $ remediation_word = None
        $ practice_index += 1
        jump pronunciation_practice_loop

    $ remediation_word = practice_evaluation.get("weakest_word")
    if remediation_word:
        $ practice_state.begin_word_remediation(remediation_word)
        $ practice_mode = practice_state.practice_mode
        jump pronunciation_practice_loop

    $ practice_result.update(
        practice_state.phrase_outcome(practice_evaluation)
    )
    $ practice_results.append(practice_result)
    $ practice_reference_cache.release(practice_target, "phrase")
    $ practice_state.reset_for_new_phrase()
    $ practice_mode = practice_state.practice_mode
    $ practice_index += 1
    jump pronunciation_practice_loop
