# iOS and Android

The game is one web app. Capacitor wraps it in a native shell for each platform: `frontend/ios` (an Xcode project) and `frontend/android` (a Gradle project). The app is **Second Language**, bundle ID `com.psami.secondlanguage`, portrait only.

## What you need

| | iOS | Android |
| --- | --- | --- |
| Tools | Xcode | Android Studio |
| Simulator or emulator | nothing more | nothing more |
| Your own device | an Apple ID (free: the app expires after 7 days) | nothing; allow USB debugging |
| Store or testers | Apple Developer Program | Google Play developer account |

No CocoaPods: the iOS project uses Swift packages.

## Build and run

One-time: copy `frontend/.env.mobile.example` to `frontend/.env.mobile.local` and set `VITE_API_URL` (see below).

Every time the game changes, from `frontend/`:

```bash
npm run cap:sync
```

That builds the web app in `mobile` mode and copies it into both native projects. Then open one and press Run:

```bash
npm run ios
```

```bash
npm run android
```

From the command line instead:

```bash
cd ios/App && xcodebuild -project App.xcodeproj -scheme App -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath ../DerivedData build
```

```bash
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```

The Android command names Android Studio's own Java because the build expects Java 21, and a newer system Java makes Gradle fail. Building inside Android Studio needs no such step. The debug app lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

## The backend address

In the browser the game talks to `http://localhost:3000`. On a phone, "localhost" is the phone, so a mobile build is given the backend's real address through `VITE_API_URL` in `.env.mobile.local`:

- **Testing at home:** the computer's address on the Wi-Fi the phone is also on, for example `http://192.168.0.121:3000`. The simulator and emulator can use it too. It changes when the network does; update the file and run `npm run cap:sync` again.
- **Real distribution:** the HTTPS address of a hosted backend.
- **None:** the app is silent and typed-only, and otherwise the same.

The backend already accepts the apps: its default allowed origins include `capacitor://localhost` (iOS) and `https://localhost` (Android).

A backend on a home computer is plain HTTP, which both platforms block by default:

- **Android:** `capacitor.config.ts` allows it only when the mobile build points at an `http://` address. A build that points at HTTPS gets no exception.
- **iOS:** `Info.plist` allows plain HTTP to local-network addresses only (`NSAllowsLocalNetworking`). Internet addresses still need HTTPS. A real device also asks once for permission to find devices on the local network.

## Permissions

| Permission | Why | Where |
| --- | --- | --- |
| Microphone | Answering characters by voice. Asked the first time the microphone is tapped; declining leaves typing. | iOS `NSMicrophoneUsageDescription`; Android `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` |
| Local network (iOS) | Reaching a backend on the home network | `NSLocalNetworkUsageDescription` |

Android's automatic cloud backup is switched off (`allowBackup="false"`), so the saved game, which holds the player's name and learning record, stays on the device as `SAVE-SYSTEM.md` says. On iOS the save is part of the device's own backup like any app's data.

## What only works with your computer

- **Voices** use the voices built into macOS, so the backend must be the Mac. A hosted backend needs another voice provider (an open decision in `PLAN.md`).
- **Speech recognition** runs in `speech-service/` on the same computer.
- **The AI second opinion** needs the OpenRouter key in `backend/.env`.

## Status

- **iOS simulator (iPhone 17 Pro, iOS 26.2):** builds and runs. Walking by touch, the phone, a conversation with Sophie and her close-up were checked, and the app reached the backend for voices.
- **Android emulator (API 36):** builds, installs and launches, and the game draws correctly. Touch and the backend connection were not confirmed there: the emulator itself stopped responding on this machine while the simulator and the speech model were also running.
- **Not checked on either:** a real device, the microphone, sound through the device's speaker, the keyboard pushing the dialogue card up.

## Not done yet

- **App icon and launch screen** are Capacitor's defaults.
- **Signing for release**, store listings and a privacy policy.
- **A hosted backend with HTTPS and authentication.** The endpoints have none; they are safe only on a home network.
- **Native storage for the save.** It is in the web view's storage, which iOS may clear when the device is very short of space (`SAVE-SYSTEM.md`).
- **Higher-resolution paintings.** The current ones are soft on phone screens (`ART-BRIEF.md`).
