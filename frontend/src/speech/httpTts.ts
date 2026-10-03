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
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: request.text,
          languageCode: request.languageCode,
          speakerId: request.speakerId,
          rate: request.rate ?? "normal",
          ...(request.context ? { context: request.context } : {})
        }),
        signal: request.signal
      });
      if (!response.ok) throw new Error(`Speech synthesis failed with status ${response.status}`);

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
