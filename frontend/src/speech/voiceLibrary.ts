import { ttsCacheKey } from "./ttsCache";
import type { SynthesisRequest, SynthesizedSpeech, TextToSpeechProvider } from "./types";

export interface VoiceLibraryOptions {
  /** Lines kept in memory before the least recently used is dropped. */
  capacity?: number;
  /** After a failure, how long to stop asking, so a dead backend never slows the game. */
  retryAfterMs?: number;
  now?: () => number;
  onEvict?: (speech: SynthesizedSpeech) => void;
  /** Lines that never depend on the backend, such as recordings shipped with the game: never held back. */
  isLocal?: (request: Omit<SynthesisRequest, "signal">) => boolean;
}

/**
 * The game's voiced lines, fetched once each. Callers ask for a line and get audio
 * or `undefined`; a provider that is down or slow never throws into gameplay.
 */
export class VoiceLibrary {
  private readonly lines = new Map<string, Promise<SynthesizedSpeech | undefined>>();
  private readonly capacity: number;
  private readonly retryAfterMs: number;
  private readonly now: () => number;
  private unavailableUntil = 0;

  constructor(private readonly provider: TextToSpeechProvider, private readonly options: VoiceLibraryOptions = {}) {
    this.capacity = options.capacity ?? 60;
    this.retryAfterMs = options.retryAfterMs ?? 30_000;
    this.now = options.now ?? (() => Date.now());
  }

  /** False while backing off after a failure. */
  get available(): boolean {
    return this.now() >= this.unavailableUntil;
  }

  get(request: Omit<SynthesisRequest, "signal">): Promise<SynthesizedSpeech | undefined> {
    const key = ttsCacheKey({
      provider: this.provider.providerId,
      model: "",
      voice: request.speakerId ?? "",
      language: request.languageCode,
      text: request.text,
      rate: request.rate ?? "normal"
    });
    const known = this.lines.get(key);
    if (known) {
      // Refresh its place: most recently used last.
      this.lines.delete(key);
      this.lines.set(key, known);
      return known;
    }
    const local = this.options.isLocal?.(request) ?? false;
    if (!local && !this.available) return Promise.resolve(undefined);

    const pending = this.provider.synthesize(request).catch(() => {
      if (!local) this.unavailableUntil = this.now() + this.retryAfterMs;
      // A failure is not remembered for the line, so it can be tried again later.
      this.lines.delete(key);
      return undefined;
    });
    this.lines.set(key, pending);
    this.trim();
    return pending;
  }

  /** Fetch ahead of need; the result is simply waiting when the line is reached. */
  prefetch(request: Omit<SynthesisRequest, "signal">): void {
    void this.get(request);
  }

  private trim() {
    while (this.lines.size > this.capacity) {
      const [oldest, line] = this.lines.entries().next().value as [string, Promise<SynthesizedSpeech | undefined>];
      this.lines.delete(oldest);
      void line.then((speech) => { if (speech) this.options.onEvict?.(speech); });
    }
  }
}
