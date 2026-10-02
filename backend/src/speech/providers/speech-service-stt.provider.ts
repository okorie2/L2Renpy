import type { RecognitionInput, RecognitionOutput, SttProvider } from "../stt.provider";

const READY_TIMEOUT_MS = 1500;
const TRANSCRIBE_TIMEOUT_MS = 30_000;

export class RecognitionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Recognition by the project's own speech service (FastAPI, local Whisper model).
 * The model lives there, loaded and warmed at its startup; this adapter only forwards.
 */
export class SpeechServiceSttProvider implements SttProvider {
  readonly id = "speech-service";

  constructor(private readonly baseUrl: string) {}

  async isReady(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health/ready`, { signal: AbortSignal.timeout(READY_TIMEOUT_MS) });
      return response.ok;
    } catch {
      return false;
    }
  }

  async transcribe(input: RecognitionInput): Promise<RecognitionOutput> {
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(input.audio)], { type: input.mimeType }), "answer");
    form.append("language", input.languageCode);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/transcribe`, { method: "POST", body: form, signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS) });
    } catch {
      throw new RecognitionError("the speech service is not reachable", 503);
    }
    if (!response.ok) {
      const detail = await response.json().then((body: { detail?: unknown }) => String(body.detail ?? ""), () => "");
      throw new RecognitionError(detail || "speech recognition failed", response.status);
    }
    const body = await response.json() as { transcript?: string; speechDetected?: boolean; confidence?: number | null };
    return {
      transcript: body.transcript ?? "",
      speechDetected: Boolean(body.speechDetected),
      confidence: typeof body.confidence === "number" ? body.confidence : undefined
    };
  }
}
