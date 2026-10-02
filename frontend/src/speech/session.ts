import type { SpeechErrorKind } from "./types";

/**
 * One spoken response as an explicit state machine:
 * idle -> recording -> processing -> result | error, with retry and cancel from
 * every state. It holds no audio and calls no provider, so it is fully testable.
 */
export type SpeechSessionState =
  | { status: "idle"; attempts: number }
  | { status: "recording"; attempts: number }
  | { status: "processing"; attempts: number }
  | { status: "result"; attempts: number; transcript: string }
  | { status: "error"; attempts: number; error: SpeechErrorKind };

export type SpeechSessionEvent =
  | { type: "START" }
  | { type: "STOP" }
  | { type: "RESULT"; transcript: string }
  | { type: "FAIL"; error: SpeechErrorKind }
  | { type: "RETRY" }
  | { type: "CANCEL" };

export const initialSpeechSession: SpeechSessionState = { status: "idle", attempts: 0 };

export function speechSessionReducer(state: SpeechSessionState, event: SpeechSessionEvent): SpeechSessionState {
  switch (event.type) {
    case "START":
      return state.status === "idle" ? { status: "recording", attempts: state.attempts + 1 } : state;
    case "STOP":
      return state.status === "recording" ? { status: "processing", attempts: state.attempts } : state;
    case "RESULT":
      return state.status === "processing" ? { status: "result", attempts: state.attempts, transcript: event.transcript } : state;
    case "FAIL":
      // Permission and device errors can arrive before recording ever starts.
      return state.status === "result" ? state : { status: "error", attempts: state.attempts, error: event.error };
    case "RETRY":
      return state.status === "result" || state.status === "error" ? { status: "idle", attempts: state.attempts } : state;
    case "CANCEL":
      return { status: "idle", attempts: state.attempts };
  }
}

export interface SpeechErrorRecovery {
  /** Trying again can plausibly succeed without the player changing anything else. */
  canRetry: boolean;
  /** A non-speech path must be offered so the game never becomes unplayable. */
  offerFallback: boolean;
}

export function speechErrorRecovery(error: SpeechErrorKind): SpeechErrorRecovery {
  switch (error) {
    case "no-speech":
    case "network":
    case "provider":
      return { canRetry: true, offerFallback: true };
    case "permission-denied":
    case "no-microphone":
    case "unavailable":
      return { canRetry: false, offerFallback: true };
  }
}
