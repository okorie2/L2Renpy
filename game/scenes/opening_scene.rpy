# Opening scene and onboarding story logic.


# Keep the scene composition in normalized coordinates so future display-size
# variants can adjust these values without rewriting the scene sequence.
#
# Sophie's size is expressed as a share of the screen height rather than a raw
# zoom, so it stays correct if the design viewport changes (landscape, tablet
# variants). Zoom is derived from it and the sprite canvas height.
#
# At 0.60 of a 2340px screen she is ~1400px tall and her chin sits ~1100px
# down, above the tallest bottom sheet (~850px) and the dialogue card. Keep her
# rendered height <= the 1536px sprite canvas (0.65 here): above that the
# sprites are upscaled and start to look soft.
define sophie_sprite_height = 1536  # all Sophie sprites share this canvas
define sophie_screen_height = 0.60
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


# A calm beat between onboarding questions: the answered panel fades out, a
# short pause, then the next question fades in as Sophie starts speaking.
define onboarding_step_transition = Dissolve(0.25)
define onboarding_step_pause = 0.15

# Sophie's recorded "What's your name?" question (generated once with the
# backend TTS). If the file is missing the question is shown without voice.
define whats_your_name_voice = "audio/chapter1/scene1/sophie/whats_your_name.wav"

# Longest wait for a generated (text-to-speech) line before showing it
# without voice, and for the backend name model.
define generated_voice_timeout = 8.0
define name_lookup_timeout = 8.0


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


# Timed pauses below use renpy.pause(..., hard=True) so a tap can't cut them
# short (e.g. skipping Sophie's walk-in).
label opening_scene:
    scene bg park_day
    with dissolve
    play music "audio/chapter1/music/audio_1.mp3" loop fadein 2.0 volume 0.20

    # Let the park establish itself before Sophie enters.
    $ renpy.pause(0.25, hard=True)
    # The animated walk cycle loops while this transform makes Sophie approach
    # the camera by growing and moving downward along the path.
    show sophie walk at sophie_walk_to_park_position
    $ renpy.pause(1.80, hard=True)
    # All three states use the same canvas, anchors, and scale. Replacing the
    # tagged sprite directly avoids a dissolve or a position jump.
    show sophie wave at sophie_park_position
    $ renpy.pause(0.90, hard=True)
    show sophie casual at sophie_park_position

    voice "audio/chapter1/scene1/sophie/hi_im_sophie.mp3"
    Sophie "Hi! I'm Sophie."
    voice "audio/chapter1/scene1/sophie/nice_to_meet_you.mp3"
    Sophie "It's really nice to meet you."


label ask_introduction:
    # Sophie's question is shown inside the sheet itself (inspo #2), so it is
    # queued here instead of on a separate dialogue line. Use `voice`, not
    # `play voice`: Ren'Py's voice system stops the voice channel when a new
    # interaction (the `call screen`) starts unless the line was queued with
    # `voice`, which would cut the audio off after the first word.
    if renpy.loadable(whats_your_name_voice):
        $ voice(whats_your_name_voice)
        call screen introduction_controls(voice=whats_your_name_voice)
    else:
        call screen introduction_controls


label type_introduction:
    call screen mobile_text_input("What's your name?", length=30)

    # Back returns None: go back to the Speak / Type choice.
    if _return is None:
        jump ask_introduction

    # Anything that isn't text (shouldn't happen) means: ask again.
    if not isinstance(_return, str):
        jump type_introduction

    $ player_name_answer = _return

    jump resolve_player_name


label speak_introduction:
    # Reuse the existing Speak button route with the generic speech component.
    call screen speech_input(
        mode="transcription",
        language="en",
        prompt="Say your name.",
    )
    $ speech_result = _return

    if not speech_result or speech_result.get("status") != "confirmed":
        jump type_introduction

    $ player_name_answer = speech_result.get("transcript", "")
    jump resolve_player_name


label resolve_player_name:
    # Pull the name out of answers like "my name is Ella" (rules first, then
    # the backend name model only if the rules aren't sure).
    if not isinstance(player_name_answer, str) or not player_name_answer.strip():
        jump type_introduction

    $ name_lookup = PlayerNameLookup(player_name_answer)
    $ name_lookup_waited = 0.0
    while name_lookup.pending and name_lookup_waited < name_lookup_timeout:
        $ renpy.pause(0.1, hard=True)
        $ name_lookup_waited += 0.1
    $ player_name = name_lookup.name

    jump introduction_name_complete


label introduction_name_complete:
    if player_name:
        show sophie wave at sophie_park_position
        # Sophie says the player's name with the backend text-to-speech.
        call queue_generated_voice("Nice to meet you, {}!".format(player_name))
        $ name_line_voice = _return
        Sophie "Nice to meet you, [player_name]!"
        $ name_line_voice.dispose()
        $ renpy.pause(0.75, hard=True)
        show sophie casual at sophie_park_position

    jump after_introduction


label after_introduction:
    voice "audio/chapter1/scene1/sophie/french_level_question.mp3"
    $ renpy.transition(onboarding_step_transition)
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
    # Beat after the previous answer. Keep this before `voice`: the voice line
    # must be queued directly before `call screen` or Ren'Py cuts it off.
    with onboarding_step_transition
    $ renpy.pause(onboarding_step_pause, hard=True)
    voice "audio/chapter1/scene1/sophie/why_learn_french.mp3"
    $ renpy.transition(onboarding_step_transition)
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
    # Beat after the previous answer. Keep this before `voice`: the voice line
    # must be queued directly before `call screen` or Ren'Py cuts it off.
    with onboarding_step_transition
    $ renpy.pause(onboarding_step_pause, hard=True)
    voice "audio/chapter1/scene1/sophie/age_question.mp3"
    $ renpy.transition(onboarding_step_transition)
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


# Generate a Sophie line with text-to-speech and queue it as the voice of the
# next dialogue line. Waits (a hard pause, so the scene holds still) until the
# audio is ready or `timeout` passes; if it isn't ready the line is shown
# without voice. Returns the TTS session: dispose() it after the line.
label queue_generated_voice(text, language="en", timeout=generated_voice_timeout):
    $ generated_voice = FrenchTTSSession(text, language=language)
    $ generated_voice.start()
    $ generated_voice_waited = 0.0
    while generated_voice.status == TTS_PREPARING and generated_voice_waited < timeout:
        $ renpy.pause(0.1, hard=True)
        $ generated_voice_waited += 0.1

    if generated_voice.status == TTS_READY and generated_voice.audio_path:
        $ _register_tts_directory(generated_voice.audio_path)
        $ voice(os.path.basename(generated_voice.audio_path))

    return generated_voice
