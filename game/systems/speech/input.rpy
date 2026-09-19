# Reusable speech-input state machine.

init python:

    import os

    SPEECH_IDLE = "idle"
    SPEECH_RECORDING = "recording"
    SPEECH_PROCESSING = "processing"
    SPEECH_RESULT = "result"
    SPEECH_ERROR = "error"


    def pronunciation_similarity_is_perfect(evaluation):
        """Return whether a pronunciation result passes this prototype gate."""

        try:
            return float(
                (evaluation or {}).get("pronunciation_similarity")
            ) >= 0.999
        except (TypeError, ValueError):
            return False


    class SpeechInputSession(object):
        """Connect a recorder to a speech processor without knowing the scene."""

        def __init__(
            self,
            mode="transcription",
            language="en",
            prompt="",
            reference_text="",
            reference_audio_path=None,
            reference_tts_session=None,
        ):
            self.mode = mode
            self.language = language
            self.prompt = prompt
            self.reference_text = reference_text
            self.reference_audio_path = reference_audio_path
            self.reference_tts_session = reference_tts_session
            self.status = SPEECH_IDLE
            self.transcript = ""
            self.error = ""
            self.evaluation = {}
            self.pronunciation_percent = None
            self.recorder = create_speech_recorder()
            self.audio_path = None

        def start(self):
            if self.status != SPEECH_IDLE:
                return

            try:
                self.recorder.start_recording()
                self.status = SPEECH_RECORDING
                self.error = ""
            except Exception as exc:
                self._set_error(str(exc))

            renpy.restart_interaction()

        def stop(self):
            if self.status != SPEECH_RECORDING:
                return

            try:
                self.audio_path = self.recorder.stop_recording()

                renpy.log(
                    "SpeechInput: recording stopped: {}".format(
                        self.audio_path
                    )
                )

                renpy.log(
                    "SpeechInput: recording size: {} bytes".format(
                        os.path.getsize(self.audio_path)
                    )
                )

                self.status = SPEECH_PROCESSING

                renpy.invoke_in_thread(
                    self._process_recording,
                    self.audio_path,
                )

            except Exception as exc:
                renpy.log(
                    "SpeechInput: stop failed: {!r}".format(exc)
                )
                self._set_error(str(exc))

            renpy.restart_interaction()

        def retry(self):
            self.dispose()
            self.recorder = create_speech_recorder()
            self.status = SPEECH_IDLE
            self.transcript = ""
            self.error = ""
            self.evaluation = {}
            self.pronunciation_percent = None
            self.audio_path = None
            renpy.restart_interaction()

        def confirm_result(self):
            if self.mode == "pronunciation":
                if not pronunciation_similarity_is_perfect(self.evaluation):
                    return None
            elif not self.transcript:
                return None

            result = {
                "status": "confirmed",
                "language": self.language,
                "audio_path": self.audio_path,
                "evaluation": self.evaluation,
            }
            if self.mode != "pronunciation":
                result["transcript"] = self.transcript

            self.dispose()
            return result

        def type_result(self):
            self.dispose()
            return {
                "status": "type",
                "transcript": "",
                "language": self.language,
                "audio_path": None,
            }

        def dispose(self):
            try:
                self.recorder.cancel_recording()
            except Exception:
                pass

        def _process_recording(self, audio_path):
            try:
                renpy.log("SpeechInput: processing thread started")

                if self.mode == "transcription":
                    renpy.log("SpeechInput: calling transcription API")

                    result = transcribe_recording(
                        audio_path,
                        language=self.language,
                    )
                elif self.mode == "pronunciation":
                    reference_audio_path = self.reference_audio_path
                    if self.reference_tts_session is not None:
                        reference_audio_path = (
                            self.reference_tts_session.audio_path
                            or reference_audio_path
                        )

                    if not self.reference_text:
                        raise SpeechAPIError(
                            "The pronunciation reference text is missing."
                        )

                    if not reference_audio_path:
                        raise SpeechAPIError(
                            "The pronunciation reference audio is missing."
                        )

                    renpy.log("SpeechInput: calling pronunciation API")
                    # log payload
                    renpy.log(
                        "SpeechInput: pronunciation payload = {{"
                        "reference_text={!r}, "
                        "reference_audio_path={!r}, "
                        "learner_audio_path={!r}, "
                        "language={!r}"
                        "}}".format(
                            self.reference_text,
                            reference_audio_path,
                            audio_path,
                            self.language,
                        )
                    )

                    result = evaluate_pronunciation_recording(
                        reference_text=self.reference_text,
                        reference_audio_path=reference_audio_path,
                        learner_audio_path=audio_path,
                        language=self.language,
                    )
                else:
                    raise SpeechAPIError(
                        "Speech mode '{}' is not configured yet.".format(
                            self.mode
                        )
                    )

                renpy.log(
                    "SpeechInput: API result = {!r}".format(result)
                )

                renpy.invoke_in_main_thread(
                    self._set_result,
                    result,
                )

            except Exception as exc:
                renpy.log(
                    "SpeechInput: processing failed = {!r}".format(exc)
                )

                renpy.invoke_in_main_thread(
                    self._set_error,
                    str(exc),
                )

        def _set_result(self, result):
            self.evaluation = result or {}
            self.error = ""

            pronunciation_similarity = self.evaluation.get(
                "pronunciation_similarity"
            )
            try:
                self.pronunciation_percent = round(
                    float(pronunciation_similarity) * 100
                )
            except (TypeError, ValueError):
                self.pronunciation_percent = None

            if self.mode == "pronunciation":
                self.transcript = ""
                if "pronunciation_similarity" in self.evaluation:
                    self.status = SPEECH_RESULT
                else:
                    self.status = SPEECH_ERROR
                    self.error = (
                        "The speech backend returned an incomplete "
                        "pronunciation result."
                    )
            else:
                self.transcript = self.evaluation.get("transcript", "")
                if self.transcript:
                    self.status = SPEECH_RESULT
                else:
                    self.status = SPEECH_ERROR
                    self.error = "I couldn't hear a name. Please try again."

            if self.status == SPEECH_RESULT:
                renpy.restart_interaction()
                return

            if self.status == SPEECH_ERROR:
                renpy.restart_interaction()
                return

            renpy.restart_interaction()


        def _set_error(self, message):
            self.status = SPEECH_ERROR
            self.error = message or "Something went wrong. Please try again."

            renpy.restart_interaction()
