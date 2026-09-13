# Reusable speech-input state machine.

init python:

    import os

    SPEECH_IDLE = "idle"
    SPEECH_RECORDING = "recording"
    SPEECH_PROCESSING = "processing"
    SPEECH_RESULT = "result"
    SPEECH_ERROR = "error"


    class SpeechInputSession(object):
        """Connect a recorder to a speech processor without knowing the scene."""

        def __init__(self, mode="transcription", language="en", prompt=""):
            self.mode = mode
            self.language = language
            self.prompt = prompt
            self.status = SPEECH_IDLE
            self.transcript = ""
            self.error = ""
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
            self.audio_path = None
            renpy.restart_interaction()

        def confirm_result(self):
            if not self.transcript:
                return None

            result = {
                "status": "confirmed",
                "transcript": self.transcript,
                "language": self.language,
                "audio_path": self.audio_path,
            }
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

                if self.mode != "transcription":
                    raise SpeechAPIError(
                        "Speech mode '{}' is not configured yet.".format(
                            self.mode
                        )
                    )

                renpy.log("SpeechInput: calling transcription API")

                result = transcribe_recording(
                    audio_path,
                    language=self.language,
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
            self.transcript = result.get("transcript", "")
            self.error = ""

            if self.transcript:
                self.status = SPEECH_RESULT
            else:
                self.status = SPEECH_ERROR
                self.error = "I couldn't hear a name. Please try again."

            renpy.restart_interaction()


        def _set_error(self, message):
            self.status = SPEECH_ERROR
            self.error = message or "Something went wrong. Please try again."

            renpy.restart_interaction()

