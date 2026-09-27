# Platform-neutral recording interface.
#
# The scene and speech screen only use SpeechRecorder.start_recording(),
# stop_recording(), cancel_recording(), and get_recording_path(). Platform
# adapters stay here so Android/iOS implementations can be added later.

init -20 python:
    import os
    import shutil
    import signal
    import struct
    import subprocess
    import sys
    import tempfile


    # Development microphone index from the macOS AVFoundation device list.
    # Change this value if the preferred input device changes.
    MACOS_AUDIO_DEVICE = "1"


    class RecordingError(Exception):
        pass


    IOS_RECORD_PERMISSION_DENIED = 1684369017


    def _is_ios_simulator():
        """Return True for Ren'Py's desktop iPhone/iPad emulation."""

        return os.environ.get("RENPY_EMULATOR", "").startswith("ios")


    def _wav_has_audio_data(path):
        """Return True when a WAV file contains a non-empty data chunk."""

        try:
            with open(path, "rb") as audio_file:
                if audio_file.read(4) != b"RIFF":
                    return False

                audio_file.seek(4, os.SEEK_CUR)
                if audio_file.read(4) != b"WAVE":
                    return False

                while True:
                    chunk_header = audio_file.read(8)
                    if len(chunk_header) != 8:
                        return False

                    chunk_name, chunk_size = struct.unpack(
                        "<4sI",
                        chunk_header,
                    )
                    if chunk_name == b"data":
                        return chunk_size > 0

                    audio_file.seek(
                        chunk_size + (chunk_size & 1),
                        os.SEEK_CUR,
                    )
        except (OSError, struct.error):
            return False


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

            renpy.log(
                "SpeechRecorder: stopped path={} size={} bytes".format(
                    self.recording_path,
                    os.path.getsize(self.recording_path),
                )
            )

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


    class IOSAudioRecorder(SpeechRecorder):
        """Record a temporary mono 16 kHz PCM WAV through AVAudioRecorder."""

        def __init__(self):
            self.audio_session = None
            self.native_recorder = None
            self.temp_dir = None
            self.recording_path = None

        def start_recording(self):
            if self.native_recorder is not None:
                raise RecordingError("A recording is already in progress.")

            self._remove_recording()

            try:
                from pyobjus import (
                    autoclass,
                    objc_b,
                    objc_d,
                    objc_dict,
                    objc_i,
                    objc_str,
                )
                from pyobjus.dylib_manager import load_framework

                load_framework(
                    "/System/Library/Frameworks/AVFoundation.framework"
                )

                AVAudioSession = autoclass("AVAudioSession")
                AVAudioRecorder = autoclass("AVAudioRecorder")
                NSURL = autoclass("NSURL")

                self.audio_session = AVAudioSession.sharedInstance()
                self._raise_if_permission_denied()

                if not self.audio_session.setCategory_error_(
                    objc_str("record"),
                    None,
                ):
                    raise RecordingError(
                        "The iOS audio session could not enable microphone recording."
                    )

                if not self.audio_session.setActive_error_(True, None):
                    raise RecordingError(
                        "The iOS audio session could not become active."
                    )

                self.temp_dir = tempfile.mkdtemp(
                    prefix="language-app-speech-"
                )
                self.recording_path = os.path.join(
                    self.temp_dir,
                    "recording.wav",
                )

                settings = objc_dict(
                    {
                        objc_str("AVFormatIDKey"): objc_i(1819304813),
                        objc_str("AVSampleRateKey"): objc_d(16000.0),
                        objc_str("AVNumberOfChannelsKey"): objc_i(1),
                        objc_str("AVLinearPCMBitDepthKey"): objc_i(16),
                        objc_str("AVLinearPCMIsFloatKey"): objc_b(False),
                        objc_str("AVLinearPCMIsBigEndianKey"): objc_b(False),
                    }
                )
                recording_url = NSURL.fileURLWithPath_(
                    objc_str(self.recording_path)
                )
                self.native_recorder = (
                    AVAudioRecorder.alloc().initWithURL_settings_error_(
                        recording_url,
                        settings,
                        None,
                    )
                )

                if self.native_recorder is None:
                    raise RecordingError(
                        "The iOS microphone recorder could not be created."
                    )

                if not self.native_recorder.prepareToRecord():
                    raise RecordingError(
                        "The iOS microphone recorder could not prepare an audio file."
                    )

                # When permission is undetermined, iOS presents its native
                # prompt when AVAudioRecorder first attempts to record.
                if not self.native_recorder.record():
                    self.native_recorder = None
                    self._remove_recording()
                    raise RecordingError(
                        "Microphone recording was unavailable. Check microphone "
                        "permission in the iPhone Settings app."
                    )

            except RecordingError:
                self._cancel_native_recording()
                self._deactivate_audio_session()
                self._remove_recording()
                raise
            except Exception as exc:
                self._cancel_native_recording()
                self._deactivate_audio_session()
                self._remove_recording()
                raise RecordingError(
                    "Could not start the iOS microphone recorder: {}".format(
                        exc
                    )
                ) from exc

        def stop_recording(self):
            if self.native_recorder is None:
                raise RecordingError("There is no active recording.")

            native_recorder = self.native_recorder
            self.native_recorder = None

            try:
                native_recorder.stop()
                self._raise_if_permission_denied()
                self._deactivate_audio_session()
            except RecordingError:
                self._deactivate_audio_session()
                self._remove_recording()
                raise
            except Exception as exc:
                self._deactivate_audio_session()
                self._remove_recording()
                raise RecordingError(
                    "The iOS microphone recorder did not stop cleanly: {}".format(
                        exc
                    )
                ) from exc

            if (
                not self.recording_path
                or not os.path.isfile(self.recording_path)
                or os.path.getsize(self.recording_path) <= 44
                or not _wav_has_audio_data(self.recording_path)
            ):
                self._remove_recording()
                raise RecordingError("No microphone audio was captured on iOS.")

            file_size = os.path.getsize(self.recording_path)
            renpy.log(
                "SpeechRecorder: stopped path={} size={} bytes".format(
                    self.recording_path,
                    file_size,
                )
            )
            return self.recording_path

        def cancel_recording(self):
            self._cancel_native_recording()
            self._deactivate_audio_session()
            self._remove_recording()

        def get_recording_path(self):
            if self.recording_path and os.path.isfile(self.recording_path):
                return self.recording_path
            return None

        def _raise_if_permission_denied(self):
            if self.audio_session is None:
                return

            permission = self.audio_session.recordPermission()
            try:
                permission = int(permission)
            except (TypeError, ValueError):
                return

            if permission == IOS_RECORD_PERMISSION_DENIED:
                raise RecordingError(
                    "Microphone access is denied. Enable microphone access for "
                    "Language_app in iPhone Settings and try again."
                )

        def _cancel_native_recording(self):
            if self.native_recorder is None:
                return

            native_recorder = self.native_recorder
            self.native_recorder = None
            try:
                if native_recorder.isRecording():
                    native_recorder.stop()
            except Exception:
                pass

        def _deactivate_audio_session(self):
            if self.audio_session is None:
                return

            try:
                self.audio_session.setActive_error_(False, None)
            except Exception:
                pass
            self.audio_session = None

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
        if getattr(renpy, "ios", False) and not _is_ios_simulator():
            renpy.log("SpeechRecorder: selected iOS recorder")
            return IOSAudioRecorder()

        if getattr(renpy, "android", False):
            # TODO: Add a Pyjnius MediaRecorder adapter and request
            # android.permission.RECORD_AUDIO before starting it.
            renpy.log("SpeechRecorder: selected Android placeholder")
            return UnsupportedSpeechRecorder("Android")

        if sys.platform == "darwin":
            renpy.log("SpeechRecorder: selected macOS recorder")
            return MacOSFFmpegRecorder()

        renpy.log("SpeechRecorder: selected unsupported-platform placeholder")
        return UnsupportedSpeechRecorder("this platform")
