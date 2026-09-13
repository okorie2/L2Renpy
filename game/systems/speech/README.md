# Speech input system

The reusable speech flow is split into three Ren'Py files:

- `recorder.rpy` exposes the platform-neutral recorder interface.
- `api.rpy` owns the backend URL and multipart transcription request.
- `input.rpy` owns the idle/recording/processing/result/error state machine.
- `../../screens/speech_input_screen.rpy` renders the reusable UI.

## Current macOS adapter

Development recording uses the system-default microphone through FFmpeg's
AVFoundation input. The adapter writes temporary mono 16 kHz PCM WAV files
outside the packaged game assets, and removes them after confirmation, retry,
fallback, or screen dismissal.

The current Mac development environment already has FFmpeg at
`/opt/homebrew/bin/ffmpeg`, so no additional Python package is required.
If FFmpeg is missing, install it with:

```bash
brew install ffmpeg
```

macOS will require microphone access for the process launching the recorder.
For development, allow Microphone access in System Settings > Privacy &
Security > Microphone for the Ren'Py launcher or the terminal that launches
it, then restart the launcher if macOS asks for it.

The first version does not duck the park music while recording. The recorder
captures microphone input only, while music and voice playback remain on
their existing Ren'Py channels. Dynamic music ducking can be added later if
needed.

## Mobile follow-up

The shared UI, state machine, API wrapper, and recorder interface are already
platform-neutral. The current file contains explicit adapter TODOs:

- Android: add a Pyjnius `MediaRecorder` adapter, declare
  `android.permission.RECORD_AUDIO` with `build.android_permissions`, and
  request/check it with `renpy.request_permission()` and
  `renpy.check_permission()`.
- iOS: add a Pyobjus `AVAudioRecorder` adapter and configure
  `NSMicrophoneUsageDescription` in the generated Xcode project.

No speculative Android/iOS native code is included yet.
