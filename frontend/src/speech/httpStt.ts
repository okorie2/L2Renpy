import { backendError, logError, newRequestId } from "../diagnostics/log";
import type { AudioClip, SpeechToTextProvider } from "./types";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Raised with a status so callers can tell "try again" from "this will not work". */
export class RecognitionRequestError extends Error {
  constructor(readonly status: number) {
    super(`Speech recognition failed with status ${status}`);
  }
}

const EXTENSIONS: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav" };

/**
 * Speech recognition through the application backend. The client uploads one short
 * recording and gets words back; which engine heard it is the backend's business.
 */
export function createHttpSpeechToText(baseUrl: string, fetchImpl: Fetch = (input, init) => fetch(input, init)): SpeechToTextProvider {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/speech/transcribe`;
  return {
    async transcribe({ audio, languageCode, signal }) {
      const form = new FormData();
      const extension = EXTENSIONS[audio.mimeType.split(";")[0]] ?? "audio";
      form.append("audio", audio.data, `answer.${extension}`);
      form.append("languageCode", languageCode);
      const requestId = newRequestId();
      const response = await fetchImpl(endpoint, { method: "POST", body: form, signal, headers: { "X-Request-Id": requestId } });
      if (!response.ok) {
        logError("speech", "Your answer could not be turned into words", (await backendError("/speech/transcribe", response, requestId)).detail);
        throw new RecognitionRequestError(response.status);
      }
      const body = await response.json() as { transcript?: string; speechDetected?: boolean; confidence?: number };
      return {
        transcript: (body.transcript ?? "").trim(),
        speechDetected: Boolean(body.speechDetected) && Boolean(body.transcript?.trim()),
        confidence: typeof body.confidence === "number" ? body.confidence : undefined
      };
    }
  };
}

/** What the backend can do right now. Any failure reads as "nothing", never as an error. */
export async function fetchSpeechCapabilities(baseUrl: string, fetchImpl: Fetch = (input, init) => fetch(input, init)): Promise<{ synthesis: boolean; recognition: boolean; pronunciation: boolean }> {
  const none = { synthesis: false, recognition: false, pronunciation: false };
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/speech/capabilities`);
    if (!response.ok) return none;
    const body = await response.json() as { synthesis?: boolean; recognition?: boolean; pronunciation?: boolean };
    return { synthesis: body.synthesis === true, recognition: body.recognition === true, pronunciation: body.pronunciation === true };
  } catch {
    return none;
  }
}

export type { AudioClip };
