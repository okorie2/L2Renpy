import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { RecognitionService } from "../speech/recognition.service";
import { SpeechService } from "../speech/speech.service";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(SpeechService) private readonly speech: SpeechService,
    @Inject(RecognitionService) private readonly recognition: RecognitionService
  ) {}

  /** Liveness: the process is up. */
  @Get()
  live() {
    return { status: "ok" };
  }

  /**
   * Readiness: dependencies are warmed and requests can be served. 503 until voices
   * are ready. Recognition is reported but optional: without it the game falls back to typing.
   */
  @Get("ready")
  async ready(@Res({ passthrough: true }) response: Response) {
    const speech = this.speech.readiness();
    if (!speech.ready) response.status(503);
    return { status: speech.ready ? "ready" : "not-ready", speech, recognition: { ready: await this.recognition.ready() } };
  }
}
