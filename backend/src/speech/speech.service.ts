import { BadRequestException, Inject, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config";
import { ttsCacheKey } from "./cache-key";
import { mouthTimeline } from "./mouth-timeline";
import { TtsCache, type CachedSpeech } from "./tts-cache";
import { TTS_PROVIDER, type TtsProvider } from "./tts.provider";

export const MAX_TEXT_LENGTH = 300;

export interface SynthesisRequest {
  text: string;
  languageCode: string;
  /** Who is speaking, as a game ID. The server maps it to a provider voice. */
  speakerId?: string;
  rate?: "normal" | "slow";
}

export interface SynthesisResult extends CachedSpeech {
  cacheKey: string;
  cached: boolean;
}

@Injectable()
export class SpeechService implements OnModuleInit {
  private readonly logger = new Logger(SpeechService.name);
  private readonly cache: TtsCache;
  /** Identical requests arriving together share one synthesis. */
  private readonly inFlight = new Map<string, Promise<CachedSpeech>>();
  /** language -> speakerId -> the voice chosen from the configured preferences. */
  private voices: Record<string, Record<string, string>> = {};
  private ready = false;
  private notReadyReason = "warming up";

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(TTS_PROVIDER) private readonly provider: TtsProvider
  ) {
    this.cache = new TtsCache(config.tts.cacheDir);
  }

  /** Warm the provider at startup, so the first learner does not pay for model loading. */
  async onModuleInit(): Promise<void> {
    try {
      await this.provider.warmUp();
      const missing: string[] = [];
      for (const [language, speakers] of Object.entries(this.config.tts.voices)) {
        this.voices[language] = {};
        for (const [speakerId, preferred] of Object.entries(speakers)) {
          const options = Array.isArray(preferred) ? preferred : [preferred];
          const voice = options.find((option) => this.provider.hasVoice(option));
          if (voice) this.voices[language][speakerId] = voice;
          else missing.push(`${language}/${speakerId} (${options.join(" or ")})`);
        }
      }
      if (missing.length) throw new Error(`voices not available: ${missing.join("; ")}`);
      this.ready = true;
      const chosen = Object.entries(this.voices).map(([language, speakers]) => `${language}: ${[...new Set(Object.values(speakers))].join(", ")}`);
      this.logger.log(`Text-to-speech ready (${this.provider.id}/${this.provider.model}); voices ${chosen.join(" | ")}`);
    } catch (error) {
      // Stay alive but not ready: the rest of the API still works and the game falls back to text.
      this.notReadyReason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Text-to-speech is not ready: ${this.notReadyReason}`);
    }
  }

  readiness(): { ready: boolean; provider: string; reason?: string } {
    return { ready: this.ready, provider: this.provider.id, ...(this.ready ? {} : { reason: this.notReadyReason }) };
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const text = typeof request.text === "string" ? request.text.trim() : "";
    if (!text) throw new BadRequestException("text is required");
    if (text.length > MAX_TEXT_LENGTH) throw new BadRequestException(`text must be at most ${MAX_TEXT_LENGTH} characters`);
    if (!this.config.tts.voices[request.languageCode]) throw new BadRequestException(`unsupported languageCode "${request.languageCode}"`);
    const rate = request.rate ?? "normal";
    if (rate !== "normal" && rate !== "slow") throw new BadRequestException('rate must be "normal" or "slow"');
    if (!this.ready) throw new ServiceUnavailableException(`text-to-speech is not ready: ${this.notReadyReason}`);

    // An unknown speaker is not an error: they simply get the language's default voice.
    const speakers = this.voices[request.languageCode] ?? {};
    const voice = speakers[request.speakerId ?? "default"] ?? speakers.default;
    if (!voice) throw new BadRequestException(`no voice is configured for "${request.languageCode}"`);

    const cacheKey = ttsCacheKey({ provider: this.provider.id, model: this.provider.model, voice, language: request.languageCode, text, rate });
    const cached = await this.cache.get(cacheKey);
    if (cached) return { ...cached, cacheKey, cached: true };

    let pending = this.inFlight.get(cacheKey);
    if (!pending) {
      pending = this.generate(cacheKey, { text, languageCode: request.languageCode, voice, rate });
      this.inFlight.set(cacheKey, pending);
      pending.finally(() => this.inFlight.delete(cacheKey)).catch(() => undefined);
    }
    return { ...(await pending), cacheKey, cached: false };
  }

  private async generate(cacheKey: string, input: { text: string; languageCode: string; voice: string; rate: "normal" | "slow" }): Promise<CachedSpeech> {
    const started = Date.now();
    const output = await this.provider.synthesize(input);
    const speech: CachedSpeech = { ...output, mouthTimeline: mouthTimeline(output.audio, output.mimeType) };
    await this.cache.set(cacheKey, speech);
    this.logger.log(`Synthesized ${input.text.length} characters in ${Date.now() - started} ms`);
    return speech;
  }
}
