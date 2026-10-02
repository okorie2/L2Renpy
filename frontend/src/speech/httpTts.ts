import type { SynthesisRequest, SynthesizedSpeech, TextToSpeechProvider } from "./types";

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
          rate: request.rate ?? "normal"
        }),
        signal: request.signal
      });
      if (!response.ok) throw new Error(`Speech synthesis failed with status ${response.status}`);

      const data = await response.blob();
      const frames = response.headers.get("X-Mouth-Timeline");
      const framesPerSecond = Number(response.headers.get("X-Mouth-Fps"));
      return {
        audio: { data, mimeType: response.headers.get("Content-Type") ?? data.type },
        mouthTimeline: frames && /^[01]+$/.test(frames) && framesPerSecond > 0 ? { frames, framesPerSecond } : undefined
      };
    }
  };
}
