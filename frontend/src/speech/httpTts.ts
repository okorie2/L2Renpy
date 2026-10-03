import { backendError, newRequestId } from "../diagnostics/log";
import type { SynthesisRequest, SynthesizedSpeech, TextToSpeechProvider, WordTiming } from "./types";

/** "start:end:fromMs:toMs;..." from the backend, or undefined when absent or malformed. */
export function readWordTimings(header: string | null, textLength: number): WordTiming[] | undefined {
  if (!header) return undefined;
  const words: WordTiming[] = [];
  for (const part of header.split(";")) {
    const [start, end, from, to] = part.split(":").map(Number);
    if (![start, end, from, to].every(Number.isFinite) || start < 0 || end <= start || end > textLength || to < from) return undefined;
    words.push({ start, end, from: from / 1000, to: to / 1000 });
  }
  return words.length ? words : undefined;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Text-to-speech through the application backend. The client says what is spoken
 * and by whom; the backend owns the vendor, model, voice and credentials.
 */
export function createHttpTextToSpeech(baseUrl: string, fetchImpl: Fetch = (input, init) => fetch(input, init)): TextToSpeechProvider {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/speech/synthesize`;
  return {
    providerId: "backend",
    async synthesize(request: SynthesisRequest): Promise<SynthesizedSpeech> {
      const send = (requestId: string) => fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
        body: JSON.stringify({
          text: request.text,
          languageCode: request.languageCode,
          speakerId: request.speakerId,
          rate: request.rate ?? "normal",
          ...(request.context ? { context: request.context } : {})
        }),
        signal: request.signal
      });
      let requestId = newRequestId();
      let response = await send(requestId);
      // Busy (the voice service limits how many lines it makes at once): one more go, after the wait it asked for.
      if (response.status === 503 || response.status === 429) {
        const retryAfter = Math.min(3, Number(response.headers.get("Retry-After")) || 1);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        if (!request.signal?.aborted) {
          requestId = newRequestId();
          response = await send(requestId);
        }
      }
      if (!response.ok) throw await backendError("/speech/synthesize", response, requestId);

      const data = await response.blob();
      const frames = response.headers.get("X-Mouth-Timeline");
      const framesPerSecond = Number(response.headers.get("X-Mouth-Fps"));
      return {
        audio: { data, mimeType: response.headers.get("Content-Type") ?? data.type },
        mouthTimeline: frames && /^[01]+$/.test(frames) && framesPerSecond > 0 ? { frames, framesPerSecond } : undefined,
        words: readWordTimings(response.headers.get("X-Word-Timings"), request.text.length)
      };
    }
  };
}
