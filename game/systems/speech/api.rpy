# Speech backend configuration. Keep platform/environment choices here so
# scene files and the speech state machine do not need platform branches.
define speech_api_environment = "development"
define speech_api_desktop_base_url = "http://127.0.0.1:8000"

# Set this to the Mac's LAN URL when running on a physical iPhone, for example
# "http://192.168.x.x:8000". It is intentionally empty until configured.
define speech_api_ios_base_url = ""

# For a production build, set speech_api_environment to "production" and set
# this to the HTTPS backend URL.
define speech_api_production_base_url = ""


init -10 python:
    import os
    import re
    from collections.abc import Mapping


    class SpeechAPIError(Exception):
        pass


    def _speech_api_base_url():
        if speech_api_environment == "production":
            base_url = speech_api_production_base_url
            if not base_url:
                raise SpeechAPIError(
                    "The production speech backend URL is not configured."
                )
            if not base_url.lower().startswith("https://"):
                raise SpeechAPIError(
                    "The production speech backend must use HTTPS."
                )
        elif getattr(renpy, "ios", False) and not _is_ios_simulator():
            base_url = speech_api_ios_base_url
            if not base_url:
                raise SpeechAPIError(
                    "The iPhone speech backend URL is not configured. Set "
                    "speech_api_ios_base_url to the Mac LAN URL."
                )
        else:
            base_url = speech_api_desktop_base_url

        return base_url.rstrip("/")


    def clean_speech_transcript(transcript):
        """Apply only conservative cleanup before showing recognized speech."""

        cleaned = (transcript or "").strip()
        cleaned = re.sub(r"[.!?]+$", "", cleaned).strip()
        return cleaned


    def transcribe_recording(audio_path, language="en"):
        import requests

        url = _speech_api_base_url() + "/speech/transcribe"

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

        url = _speech_api_base_url() + "/speech/pronunciation"
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

        renpy.log(
            "Speech API: pronunciation response status={} content_type={} body={!r}".format(
                response.status_code,
                response.headers.get("content-type", ""),
                response.text[:2000],
            )
        )

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
            "word_results",
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
