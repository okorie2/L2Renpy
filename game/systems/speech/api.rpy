# Development URL for the local FastAPI speech service. Keep this in one
# place so desktop testing and a future mobile configuration can diverge
# without changing scene files.
define speech_api_base_url = "http://127.0.0.1:8000"


init -10 python:
    import os
    import re
    from collections.abc import Mapping


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


    def evaluate_pronunciation_recording(
        reference_text,
        reference_audio_path,
        learner_audio_path,
        language="fr",
    ):
        """Evaluate one learner recording against a generated Sophie sample."""

        import requests

        if not (reference_text or "").strip():
            raise SpeechAPIError("The pronunciation reference text is empty.")

        if not reference_audio_path or not os.path.isfile(reference_audio_path):
            raise SpeechAPIError("The pronunciation reference audio is unavailable.")

        if not learner_audio_path or not os.path.isfile(learner_audio_path):
            raise SpeechAPIError("The learner recording is unavailable.")

        url = speech_api_base_url.rstrip("/") + "/speech/pronunciation"
        renpy.log(
            "Speech API: POST {} for pronunciation".format(url)
        )   
        reference_filename = os.path.basename(reference_audio_path)
        reference_content_type = (
            "audio/mpeg"
            if reference_audio_path.lower().endswith(".mp3")
            else "audio/wav"
        )

        try:
            with open(reference_audio_path, "rb") as reference_file:
                with open(learner_audio_path, "rb") as learner_file:
                    response = requests.post(
                        url,
                        data={
                            "reference_text": reference_text,
                        },
                        files={
                            "reference_audio": (
                                reference_filename,
                                reference_file,
                                reference_content_type,
                            ),
                            "learner_audio": (
                                "recording.wav",
                                learner_file,
                                "audio/wav",
                            ),
                        },
                        timeout=(5, 120),
                    )
        except (OSError, requests.RequestException) as exc:
            renpy.log(
                "Speech API: pronunciation request failed {!r}".format(exc)
            )
            raise SpeechAPIError(
                "Could not connect to the local speech backend."
            ) from exc


        if response.status_code >= 400:
            try:
                payload = response.json()
                detail = payload.get(
                    "detail",
                    "The speech backend rejected the pronunciation request.",
                )
            except ValueError:
                detail = "The speech backend rejected the pronunciation request."
            raise SpeechAPIError(detail)

        try:
            payload = response.json()
        except ValueError as exc:
            raise SpeechAPIError(
                "The speech backend returned invalid pronunciation JSON."
            ) from exc

        if not isinstance(payload, Mapping):
            raise SpeechAPIError(
                "The speech backend returned an invalid pronunciation result."
            )

        result = dict(payload)
        required_fields = (
            "reference_text",
            "expected_phonemes",
            "learner_phonemes",
            "pronunciation_similarity",
            "differences",
        )
        missing_fields = [
            field for field in required_fields if field not in result
        ]
        if missing_fields:
            raise SpeechAPIError(
                "The speech backend returned an incomplete pronunciation result."
            )

        result["status"] = "success"
        result["audio_path"] = learner_audio_path
        result["reference_audio_path"] = reference_audio_path
        return result
