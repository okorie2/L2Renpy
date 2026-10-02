import { BadRequestException, HttpException, Inject, Injectable, Logger, PayloadTooLargeException, ServiceUnavailableException } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config";
import { RecognitionError } from "./providers/speech-service-stt.provider";
import { STT_PROVIDER, type RecognitionOutput, type SttProvider } from "./stt.provider";

/** A learner's answer is one short sentence; a few seconds of compressed audio. */
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const READY_CACHE_MS = 5000;

export interface RecognitionRequest {
  audio?: Buffer;
  mimeType?: string;
  languageCode?: string;
}

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);
  private readyCheck: { at: number; value: Promise<boolean> } | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(STT_PROVIDER) private readonly provider: SttProvider
  ) {}

  /** Whether spoken answers can be taken right now. Cached briefly so clients can ask freely. */
  ready(now = Date.now()): Promise<boolean> {
    if (!this.readyCheck || now - this.readyCheck.at > READY_CACHE_MS) {
      this.readyCheck = { at: now, value: this.provider.isReady().catch(() => false) };
    }
    return this.readyCheck.value;
  }

  /**
   * What the learner said. The recording is used for this one answer and is not kept.
   * Deciding whether it communicated anything is not this service's job.
   */
  async transcribe(request: RecognitionRequest): Promise<RecognitionOutput> {
    if (!request.audio || request.audio.length === 0) throw new BadRequestException("audio is required");
    if (request.audio.length > MAX_AUDIO_BYTES) throw new PayloadTooLargeException(`audio must be at most ${MAX_AUDIO_BYTES} bytes`);
    const languageCode = request.languageCode ?? "";
    if (!this.config.speech.languages.includes(languageCode)) throw new BadRequestException(`unsupported languageCode "${languageCode}"`);

    const started = Date.now();
    try {
      const result = await this.provider.transcribe({ audio: request.audio, mimeType: request.mimeType ?? "application/octet-stream", languageCode });
      // Log sizes and timings only; never what the learner said.
      this.logger.log(`Recognised ${request.audio.length} bytes in ${Date.now() - started} ms (speech: ${result.speechDetected})`);
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.readyCheck = undefined;
      const status = error instanceof RecognitionError ? error.status : 503;
      const message = error instanceof Error ? error.message : "speech recognition failed";
      if (status === 413) throw new PayloadTooLargeException(message);
      if (status >= 400 && status < 500) throw new BadRequestException(message);
      throw new ServiceUnavailableException(message);
    }
  }
}
