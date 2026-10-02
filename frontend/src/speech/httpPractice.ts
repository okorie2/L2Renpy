import type { PracticeResult, PracticeWord } from "./practice";
import type { AudioClip } from "./types";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface PracticeAttempt {
  audio: AudioClip;
  /** What the learner was asked to say. */
  text: string;
  languageCode: string;
  /** Whose voice the attempt is compared with: the character who said it first. */
  speakerId?: string;
  /** Words that are not graded, such as the learner's own name. */
  excluded: string[];
  signal?: AbortSignal;
}

export interface PracticeClient {
  attempt(request: PracticeAttempt): Promise<PracticeResult>;
}

export class PracticeRequestError extends Error {
  constructor(readonly status: number) {
    super(`Pronunciation practice failed with status ${status}`);
  }
}

const EXTENSIONS: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav" };

function readWord(value: unknown): PracticeWord | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.word !== "string") return null;
  return {
    index: typeof item.index === "number" ? item.index : 0,
    word: item.word,
    scored: item.scored === true,
    needsPractice: item.needsPractice === true,
    phoneticGuide: typeof item.phoneticGuide === "string" ? item.phoneticGuide : null
  };
}

/** Practice attempts through the application backend, which makes the reference itself. */
export function createHttpPractice(baseUrl: string, fetchImpl: Fetch = (input, init) => fetch(input, init)): PracticeClient {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/speech/practice`;
  return {
    async attempt({ audio, text, languageCode, speakerId, excluded, signal }) {
      const form = new FormData();
      form.append("audio", audio.data, `attempt.${EXTENSIONS[audio.mimeType.split(";")[0]] ?? "audio"}`);
      form.append("text", text);
      form.append("languageCode", languageCode);
      if (speakerId) form.append("speakerId", speakerId);
      form.append("excluded", JSON.stringify(excluded));
      const response = await fetchImpl(endpoint, { method: "POST", body: form, signal });
      if (!response.ok) throw new PracticeRequestError(response.status);
      const body = await response.json() as Record<string, unknown>;
      return {
        similarity: typeof body.similarity === "number" ? body.similarity : null,
        words: Array.isArray(body.words) ? body.words.map(readWord).filter((word): word is PracticeWord => word !== null) : [],
        weakestWord: readWord(body.weakestWord)
      };
    }
  };
}
