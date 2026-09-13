# Development URL for the local FastAPI speech service. Keep this in one
# place so desktop testing and a future mobile configuration can diverge
# without changing scene files.
define speech_api_base_url = "http://127.0.0.1:8000"


init -10 python:
    import re


    class SpeechAPIError(Exception):
        pass


    def clean_speech_transcript(transcript):
        """Apply only conservative cleanup before showing recognized speech."""

        cleaned = (transcript or "").strip()
        cleaned = re.sub(r"[.!?]+$", "", cleaned).strip()
        return cleaned


    def transcribe_recording(audio_path, language="en"):
        import requests

        url = (
            speech_api_base_url.rstrip("/")
            + "/speech/transcribe"
        )

        renpy.log(
            "Speech API: POST {}".format(url)
        )

        try:
            with open(audio_path, "rb") as audio_file:

                renpy.log("Speech API: recording opened")

                response = requests.post(
                    url,
                    data={"language": language},
                    files={
                        "learner_audio": (
                            "recording.wav",
                            audio_file,
                            "audio/wav",
                        )
                    },
                    timeout=(5, 30),
                )

        except (OSError, requests.RequestException) as exc:
            renpy.log(
                "Speech API: request failed {!r}".format(exc)
            )

            raise SpeechAPIError(
                "Could not connect to the local speech backend."
            ) from exc

        renpy.log(
            "Speech API: response {} {}".format(
                response.status_code,
                response.text[:500],
            )
        )


        if response.status_code >= 400:
            raise SpeechAPIError("The speech backend rejected the recording.")

        try:
            payload = response.json()
        except ValueError as exc:
            raise SpeechAPIError("The speech backend returned invalid JSON.") from exc

        transcript = clean_speech_transcript(payload.get("transcript", ""))
        if not transcript:
            raise SpeechAPIError("The speech backend did not recognize any speech.")

        return {
            "status": "success",
            "transcript": transcript,
            "language": payload.get("language", language),
            "audio_path": audio_path,
        }
