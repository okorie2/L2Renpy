import { Body, Controller, Get, Header, HttpCode, Inject, Post, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { MOUTH_FPS } from "./mouth-timeline";
import { MAX_AUDIO_BYTES, RecognitionService } from "./recognition.service";
import { SpeechService, type SynthesisRequest } from "./speech.service";

@Controller("speech")
export class SpeechController {
  constructor(
    @Inject(SpeechService) private readonly speech: SpeechService,
    @Inject(RecognitionService) private readonly recognition: RecognitionService
  ) {}

  /** What the game can use right now, so it can offer the microphone only when it will work. */
  @Get("capabilities")
  async capabilities() {
    return { synthesis: this.speech.readiness().ready, recognition: await this.recognition.ready() };
  }

  /**
   * Voice one line. The client sends what is said and who says it; the provider,
   * model, voice and credentials are the server's business. Returns the audio with
   * an optional mouth timeline for lip sync in the headers.
   */
  @Post("synthesize")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async synthesize(@Body() body: SynthesisRequest, @Res() response: Response): Promise<void> {
    const result = await this.speech.synthesize(body ?? ({} as SynthesisRequest));
    response.setHeader("Content-Type", result.mimeType);
    response.setHeader("X-Speech-Cache", result.cached ? "hit" : "miss");
    response.setHeader("X-Speech-Key", result.cacheKey);
    if (result.mouthTimeline) {
      response.setHeader("X-Mouth-Timeline", result.mouthTimeline);
      response.setHeader("X-Mouth-Fps", String(MOUTH_FPS));
    }
    response.end(result.audio);
  }

  /**
   * Turn a short recording into the words that were said. Multipart: `audio` and
   * `languageCode`. The recording is held in memory for this request and discarded.
   */
  @Post("transcribe")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseInterceptors(FileInterceptor("audio", { limits: { fileSize: MAX_AUDIO_BYTES, files: 1 } }))
  transcribe(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: { languageCode?: string }) {
    return this.recognition.transcribe({ audio: file?.buffer, mimeType: file?.mimetype, languageCode: body?.languageCode });
  }
}
