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

## iOS recorder

On a physical iOS build, `IOSAudioRecorder` uses the Ren'Py-provided Pyobjus
bridge to load AVFoundation, configure `AVAudioSession` for recording, and
write a temporary mono 16 kHz, 16-bit linear PCM WAV through
`AVAudioRecorder`. The shared `SpeechRecorder` methods and speech state
machine do not change. The file is checked after stopping for a valid,
non-empty WAV data chunk and is removed when the session is cancelled or
disposed.

The first recording attempt can cause iOS to show its native microphone
permission prompt. A denied or unavailable microphone becomes a
`RecordingError` with a Settings-oriented message instead of being treated as
a successful recording.

Before building the generated Xcode project, add this entry to that project's
`Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Microphone access is used to practise and evaluate your French pronunciation.</string>
```

Without this key, iOS terminates the app when it attempts to access the
microphone. The Ren'Py project does not currently have an iOS plist override
hook, so this is an Xcode/native build step that must be preserved when the
Xcode project is regenerated.

## Speech backend URLs

`game/systems/speech/api.rpy` keeps the backend URL selection in one place:

- macOS development uses `speech_api_desktop_base_url`, defaulting to
  `http://127.0.0.1:8000`.
- Ren'Py's desktop iPhone/iPad emulator uses the macOS URL and macOS recorder,
  identified by its `RENPY_EMULATOR=ios...` marker.
- Physical iPhone development requires setting
  `speech_api_ios_base_url` to the Mac's LAN URL, such as
  `http://192.168.x.x:8000`. No LAN IP is committed to the project.
- Production requires setting `speech_api_environment` to `"production"` and
  `speech_api_production_base_url` to an HTTPS URL.

For a physical iPhone using an HTTP LAN URL, the generated Xcode project's
`Info.plist` may also need an App Transport Security local-network exception
and, depending on the iOS version and networking path,
`NSLocalNetworkUsageDescription`. A production HTTPS URL does not need an
HTTP exception. The Mac backend must also listen on the LAN interface and be
reachable through the Mac firewall.

Android remains an explicit unsupported placeholder until its native recorder
and permission flow are implemented.
