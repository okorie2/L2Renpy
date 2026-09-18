# Reusable asynchronous client for generated Sophie speech.

init -10 python:

    import os
    import tempfile


    TTS_IDLE = "idle"
    TTS_PREPARING = "preparing"
    TTS_READY = "ready"
    TTS_PLAYING = "playing"
    TTS_FINISHED = "finished"
    TTS_ERROR = "error"
    TTS_DISPOSED = "disposed"


    class TTSError(Exception):
        """Raised when generated speech cannot be requested or saved."""


    def _tts_file_extension(content_type):
        content_type = (content_type or "").lower()
        if "wav" in content_type or "wave" in content_type:
            return ".wav"
        if "opus" in content_type:
            return ".opus"
        if "ogg" in content_type:
            return ".ogg"
        return ".mp3"


    def _remove_tts_file(audio_path, unregister=True):
        """Remove one generated file and its empty private temp directory."""

        if not audio_path:
            return

        try:
            if os.path.isfile(audio_path):
                os.remove(audio_path)

            temp_dir = os.path.dirname(audio_path)
            if unregister and temp_dir in config.searchpath:
                config.searchpath.remove(temp_dir)
            if os.path.basename(temp_dir).startswith("language-app-tts-"):
                os.rmdir(temp_dir)
        except OSError as exc:
            renpy.log("TTS: temporary audio cleanup failed = {!r}".format(exc))


    def _register_tts_directory(audio_path):
        """Make one generated temp directory visible to Ren'Py's loader."""

        temp_dir = os.path.dirname(audio_path)
        if temp_dir not in config.searchpath:
            config.searchpath.insert(0, temp_dir)


    def synthesize_speech(text, language="fr"):
        """Request speech and return a local runtime-only audio path."""

        import requests

        request_text = text or ""
        if not request_text.strip():
            raise TTSError("There is no text to synthesize.")

        url = speech_api_base_url.rstrip("/") + "/speech/synthesize"
        renpy.log("Speech API: POST {}".format(url))

        try:
            response = requests.post(
                url,
                json={
                    "text": request_text,
                    "language": language,
                },
                timeout=(5, 60),
            )
        except (OSError, requests.RequestException) as exc:
            renpy.log("Speech TTS API: request failed {!r}".format(exc))
            raise TTSError(
                "Could not connect to the local speech backend."
            ) from exc

        renpy.log(
            "Speech TTS API: response {} content-type={} bytes={}".format(
                response.status_code,
                response.headers.get("content-type", ""),
                len(response.content),
            )
        )

        if response.status_code >= 400:
            detail = "The speech backend rejected the synthesis request."
            try:
                payload = response.json()
                detail = payload.get("detail") or detail
            except ValueError:
                if response.text:
                    detail = response.text[:300]
            raise TTSError(detail)

        if not response.content:
            raise TTSError("The speech backend returned empty audio.")

        temp_dir = tempfile.mkdtemp(prefix="language-app-tts-")
        audio_path = os.path.join(
            temp_dir,
            "sophie-introduction" + _tts_file_extension(
                response.headers.get("content-type", "")
            ),
        )

        try:
            with open(audio_path, "wb") as audio_file:
                audio_file.write(response.content)
        except OSError as exc:
            _remove_tts_file(audio_path, unregister=False)
            raise TTSError("Could not save generated Sophie audio.") from exc

        return audio_path


    class FrenchTTSSession(object):
        """Generate and play one French introduction without blocking Ren'Py."""

        def __init__(self, text):
            self.text = text
            self.status = TTS_IDLE
            self.error = ""
            self.audio_path = None
            self._disposed = False

        def start(self):
            if self.status != TTS_IDLE or self._disposed:
                return

            self.status = TTS_PREPARING
            self.error = ""
            renpy.invoke_in_thread(self._generate_audio)
            renpy.restart_interaction()

        def _generate_audio(self):
            try:
                audio_path = synthesize_speech(self.text, language="fr")
                renpy.invoke_in_main_thread(self._set_ready, audio_path)
            except Exception as exc:
                renpy.log("Speech TTS: synthesis failed = {!r}".format(exc))
                renpy.invoke_in_main_thread(self._set_error, str(exc))

        def _set_ready(self, audio_path):
            if self._disposed:
                _remove_tts_file(audio_path)
                return

            self.audio_path = audio_path
            self.status = TTS_READY
            self.error = ""
            renpy.restart_interaction()

        def _set_error(self, message):
            if self._disposed:
                return

            self.status = TTS_ERROR
            self.error = message or "Sophie could not prepare a voice recording."
            renpy.restart_interaction()

        def tick(self):
            """Start ready audio and detect completion from the voice channel."""

            if self._disposed:
                return

            if self.status == TTS_READY:
                self._start_playback()
            elif self.status == TTS_PLAYING:
                if not renpy.music.is_playing(channel="voice"):
                    self.status = TTS_FINISHED
                    renpy.restart_interaction()

        def _start_playback(self):
            if not self.audio_path:
                self._set_error("Sophie could not find the generated audio.")
                return

            try:
                _register_tts_directory(self.audio_path)
                renpy.music.play(
                    os.path.basename(self.audio_path),
                    channel="voice",
                    loop=False,
                )
                self.status = TTS_PLAYING
            except Exception as exc:
                renpy.log("Speech TTS: playback failed = {!r}".format(exc))
                self._set_error("Sophie could not play the generated audio.")

        def can_continue(self):
            return self.status in (TTS_FINISHED, TTS_ERROR)

        def dispose(self):
            if self._disposed:
                return

            self._disposed = True

            if self.status == TTS_PLAYING and renpy.music.is_playing(
                channel="voice"
            ):
                renpy.music.stop(channel="voice", fadeout=0.0)

            _remove_tts_file(self.audio_path)
            self.audio_path = None
            self.status = TTS_DISPOSED
