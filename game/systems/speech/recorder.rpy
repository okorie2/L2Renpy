# Platform-neutral recording interface.
#
# The scene and speech screen only use SpeechRecorder.start_recording(),
# stop_recording(), cancel_recording(), and get_recording_path(). Platform
# adapters stay here so Android/iOS implementations can be added later.

init -20 python:
    import os
    import shutil
    import signal
    import subprocess
    import sys
    import tempfile


    # Development microphone index from the macOS AVFoundation device list.
    # Change this value if the preferred input device changes.
    MACOS_AUDIO_DEVICE = "1"


    class RecordingError(Exception):
        pass


    class SpeechRecorder(object):
        """Interface shared by desktop and future mobile recorders."""

        def start_recording(self):
            raise NotImplementedError

        def stop_recording(self):
            raise NotImplementedError

        def cancel_recording(self):
            raise NotImplementedError

        def get_recording_path(self):
            raise NotImplementedError


    def _find_ffmpeg():
        """Find FFmpeg in PATH or common macOS package-manager locations."""

        candidates = [
            shutil.which("ffmpeg"),
            "/opt/homebrew/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
            "/usr/bin/ffmpeg",
        ]

        for candidate in candidates:
            if candidate and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                return candidate

        return None


    class MacOSFFmpegRecorder(SpeechRecorder):
        """Record the configured macOS microphone through FFmpeg/AVFoundation."""

        def __init__(self):
            self.ffmpeg_path = _find_ffmpeg()
            self.process = None
            self.temp_dir = None
            self.recording_path = None

        def start_recording(self):
            if self.process is not None:
                raise RecordingError("A recording is already in progress.")

            if self.ffmpeg_path is None:
                raise RecordingError(
                    "FFmpeg is required for macOS microphone recording. "
                    "Install it with Homebrew: brew install ffmpeg."
                )

            self._remove_recording()
            self.temp_dir = tempfile.mkdtemp(prefix="language-app-speech-")
            self.recording_path = os.path.join(self.temp_dir, "recording.wav")

            command = [
                self.ffmpeg_path,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-f",
                "avfoundation",
                "-i",
                ":" + MACOS_AUDIO_DEVICE,
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                "-f",
                "wav",
                self.recording_path,
            ]

            try:
                self.process = subprocess.Popen(
                    command,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                )
            except OSError as exc:
                self._remove_recording()
                raise RecordingError("Could not start the macOS microphone recorder.") from exc

            if self.process.poll() is not None:
                _, stderr = self.process.communicate()
                message = stderr.decode("utf-8", "replace").strip()
                self.process = None
                self._remove_recording()
                raise RecordingError(message or "The macOS microphone recorder stopped immediately.")

        def stop_recording(self):
            if self.process is None:
                raise RecordingError("There is no active recording.")

            process = self.process
            self.process = None

            try:
                process.send_signal(signal.SIGINT)
                _, stderr = process.communicate(timeout=5.0)
            except subprocess.TimeoutExpired:
                process.kill()
                _, stderr = process.communicate()
                self._remove_recording()
                raise RecordingError("The microphone recorder did not stop cleanly.")

            if (
                not self.recording_path
                or not os.path.isfile(self.recording_path)
                or os.path.getsize(self.recording_path) <= 44
            ):
                message = stderr.decode("utf-8", "replace").strip()
                self._remove_recording()
                raise RecordingError(message or "No microphone audio was captured.")
            
            debug_path = os.path.expanduser(
                "~/Desktop/renpy_mic_debug.wav"
            )

            shutil.copy2(
                self.recording_path,
                debug_path,
            )

            renpy.log(
                "SpeechRecorder: debug recording saved to {}".format(
                    debug_path
                )
            )

            return self.recording_path

        def cancel_recording(self):
            if self.process is not None:
                process = self.process
                self.process = None
                try:
                    process.terminate()
                    process.communicate(timeout=2.0)
                except (OSError, subprocess.TimeoutExpired):
                    try:
                        process.kill()
                        process.communicate()
                    except OSError:
                        pass

            self._remove_recording()

        def get_recording_path(self):
            if self.recording_path and os.path.isfile(self.recording_path):
                return self.recording_path
            return None

        def _remove_recording(self):
            if self.temp_dir and os.path.isdir(self.temp_dir):
                shutil.rmtree(self.temp_dir, ignore_errors=True)
            self.temp_dir = None
            self.recording_path = None


    class UnsupportedSpeechRecorder(SpeechRecorder):
        """Placeholder adapter until the platform-native mobile recorders exist."""

        def __init__(self, platform_name):
            self.platform_name = platform_name

        def start_recording(self):
            raise RecordingError(
                "Microphone recording is not configured for {} yet.".format(
                    self.platform_name
                )
            )

        def stop_recording(self):
            raise RecordingError("There is no active recording.")

        def cancel_recording(self):
            return None

        def get_recording_path(self):
            return None


    def create_speech_recorder():
        if sys.platform == "darwin":
            return MacOSFFmpegRecorder()

        if getattr(renpy, "android", False):
            # TODO: Add a Pyjnius MediaRecorder adapter and request
            # android.permission.RECORD_AUDIO before starting it.
            return UnsupportedSpeechRecorder("Android")

        if getattr(renpy, "ios", False):
            # TODO: Add a Pyobjus AVAudioRecorder adapter and configure
            # NSMicrophoneUsageDescription in the generated Xcode project.
            return UnsupportedSpeechRecorder("iOS")

        return UnsupportedSpeechRecorder("this platform")
