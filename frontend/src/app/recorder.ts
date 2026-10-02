import type { AudioClip, SpeechErrorKind } from "../speech/types";

/** Why a recording could not be made, in the terms the speech UI understands. */
export class RecordingError extends Error {
  constructor(readonly kind: SpeechErrorKind) {
    super(kind);
  }
}

export interface Recording {
  /** Finish and hand over what was recorded. */
  stop(): Promise<AudioClip>;
  /** Abandon the recording and release the microphone. */
  cancel(): void;
}

/** An answer is one short sentence; recording stops by itself after this. */
export const MAX_RECORDING_MS = 12_000;
const MIN_RECORDING_MS = 350;
const FORMATS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** Whether this browser or web view can record at all. Pages not served securely cannot. */
export function canRecord(): boolean {
  return typeof navigator !== "undefined"
    && typeof navigator.mediaDevices?.getUserMedia === "function"
    && typeof MediaRecorder !== "undefined";
}

function toRecordingError(error: unknown): RecordingError {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return new RecordingError("permission-denied");
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") return new RecordingError("no-microphone");
  return new RecordingError("unavailable");
}

/**
 * Start recording from the microphone. Asking for the microphone is what triggers the
 * permission prompt, so call this from a tap. `onLimit` fires if the learner
 * talks past the maximum length; the caller should then stop as if they had tapped.
 */
export async function startRecording(onLimit: () => void): Promise<Recording> {
  if (!canRecord()) throw new RecordingError("unavailable");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (error) {
    throw toRecordingError(error);
  }

  const mimeType = FORMATS.find((format) => MediaRecorder.isTypeSupported(format));
  const release = () => stream.getTracks().forEach((track) => track.stop());
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
  } catch {
    release();
    throw new RecordingError("unavailable");
  }

  const chunks: Blob[] = [];
  const startedAt = performance.now();
  recorder.addEventListener("dataavailable", (event) => { if (event.data.size > 0) chunks.push(event.data); });
  recorder.start();
  const limit = window.setTimeout(onLimit, MAX_RECORDING_MS);

  return {
    stop: () => new Promise<AudioClip>((resolve, reject) => {
      window.clearTimeout(limit);
      const durationMs = performance.now() - startedAt;
      recorder.addEventListener("stop", () => {
        release();
        const type = recorder.mimeType || mimeType || "audio/webm";
        const data = new Blob(chunks, { type });
        // A tap that was released at once holds no answer.
        if (durationMs < MIN_RECORDING_MS || data.size === 0) reject(new RecordingError("no-speech"));
        else resolve({ data, mimeType: type, durationMs });
      }, { once: true });
      if (recorder.state === "inactive") {
        release();
        reject(new RecordingError("no-speech"));
      } else {
        recorder.stop();
      }
    }),
    cancel: () => {
      window.clearTimeout(limit);
      if (recorder.state !== "inactive") recorder.stop();
      release();
    }
  };
}
