import { useEffect, useReducer, useRef } from "react";
import { RecognitionRequestError } from "../../speech/httpStt";
import { initialSpeechSession, speechErrorRecovery, speechSessionReducer } from "../../speech/session";
import type { AudioClip, SpeechErrorKind } from "../../speech/types";
import { icons } from "../icons";
import { RecordingError, startRecording, type Recording } from "../recorder";
import { stopVoice } from "../voice";

type Props = {
  /** Turn a recording into words. Injected, so this control knows no provider. */
  transcribe: (clip: AudioClip, signal: AbortSignal) => Promise<{ transcript: string; speechDetected: boolean }>;
  /** The learner said this. What it means is for the dialogue engine to judge. */
  onSaid: (transcript: string) => void;
};

const ERROR_MESSAGES: Record<SpeechErrorKind, string> = {
  unavailable: "The microphone can't be used here. You can type your answer instead.",
  "permission-denied": "The microphone is blocked. Allow it in your browser or device settings, or type your answer.",
  "no-microphone": "No microphone was found. You can type your answer instead.",
  "no-speech": "I didn't catch that. Try again, a little closer to the microphone.",
  network: "The connection dropped. Try again, or type your answer.",
  provider: "Listening isn't working right now. Try again, or type your answer."
};

/**
 * The spoken-response control, rendered from the speech session state machine:
 * tap to record, tap to finish, wait while it is heard. Every failure leaves the
 * typed answer below as a way forward, so speaking is encouraged but never required.
 */
export function SpeechControl({ transcribe, onSaid }: Props) {
  const [session, dispatch] = useReducer(speechSessionReducer, initialSpeechSession);
  const recording = useRef<Recording | undefined>(undefined);
  const request = useRef<AbortController | undefined>(undefined);
  /** Guards against results from a recording that was cancelled or replaced. */
  const turn = useRef(0);

  const abandon = () => {
    turn.current++;
    recording.current?.cancel();
    recording.current = undefined;
    request.current?.abort();
    request.current = undefined;
  };
  // Leaving the line (answered another way, or the conversation closed) frees the microphone.
  useEffect(() => abandon, []);

  const finish = async () => {
    const active = recording.current;
    if (!active) return;
    recording.current = undefined;
    const current = turn.current;
    dispatch({ type: "STOP" });
    try {
      const clip = await active.stop();
      const controller = new AbortController();
      request.current = controller;
      const heard = await transcribe(clip, controller.signal);
      if (current !== turn.current) return;
      if (!heard.speechDetected) {
        dispatch({ type: "FAIL", error: "no-speech" });
        return;
      }
      dispatch({ type: "RESULT", transcript: heard.transcript });
      onSaid(heard.transcript);
    } catch (error) {
      if (current !== turn.current) return;
      const kind: SpeechErrorKind = error instanceof RecordingError ? error.kind
        : error instanceof RecognitionRequestError && error.status < 500 ? "no-speech"
        : error instanceof RecognitionRequestError ? "provider"
        : "network";
      dispatch({ type: "FAIL", error: kind });
    }
  };

  const begin = async () => {
    const current = ++turn.current;
    // Sophie should not be talking over the learner's answer.
    stopVoice();
    try {
      const started = await startRecording(() => void finish());
      if (current !== turn.current) {
        started.cancel();
        return;
      }
      recording.current = started;
      dispatch({ type: "START" });
    } catch (error) {
      if (current === turn.current) dispatch({ type: "FAIL", error: error instanceof RecordingError ? error.kind : "unavailable" });
    }
  };

  if (session.status === "error") {
    const recovery = speechErrorRecovery(session.error);
    return (
      <div className="speech-control" role="group" aria-label="Spoken answer">
        <p className="speech-status" role="status">{ERROR_MESSAGES[session.error]}</p>
        {recovery.canRetry && (
          <button className="secondary-pill" onClick={() => dispatch({ type: "RETRY" })}>Try speaking again</button>
        )}
      </div>
    );
  }

  const isRecording = session.status === "recording";
  const busy = session.status === "processing" || session.status === "result";
  return (
    <div className="speech-control" role="group" aria-label="Spoken answer">
      <button
        className={`mic-button${isRecording ? " recording" : ""}`}
        onClick={() => (isRecording ? void finish() : void begin())}
        disabled={busy}
        aria-label={isRecording ? "Finish speaking" : "Speak your answer"}
      >
        <img src={isRecording ? icons.stop : icons.microphone} alt="" />
      </button>
      <p className="speech-status" role="status">
        {isRecording ? "Listening… tap when you've finished." : busy ? "Just a moment…" : "Tap and say it in French."}
      </p>
      {(isRecording || session.status === "processing") && (
        <button className="text-button" onClick={() => { abandon(); dispatch({ type: "CANCEL" }); }}>Cancel</button>
      )}
    </div>
  );
}
