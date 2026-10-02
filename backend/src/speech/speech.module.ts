import { Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config";
import { SpeechServiceSttProvider } from "./providers/speech-service-stt.provider";
import { SystemVoiceProvider } from "./providers/system-voice.provider";
import { RecognitionService } from "./recognition.service";
import { STT_PROVIDER, type SttProvider } from "./stt.provider";
import { SpeechController } from "./speech.controller";
import { SpeechService } from "./speech.service";
import { TTS_PROVIDER, type TtsProvider } from "./tts.provider";

/** The one place a provider name becomes an adapter. Add hosted providers here. */
export function createTtsProvider(config: AppConfig): TtsProvider {
  switch (config.tts.provider) {
    case "system":
      return new SystemVoiceProvider();
    default:
      throw new Error(`Unknown TTS_PROVIDER "${config.tts.provider}"`);
  }
}

/** Recognition runs in the project's own speech service; a hosted engine would be another adapter. */
export function createSttProvider(config: AppConfig): SttProvider {
  return new SpeechServiceSttProvider(config.speech.serviceUrl);
}

@Module({
  controllers: [SpeechController],
  providers: [
    { provide: TTS_PROVIDER, useFactory: createTtsProvider, inject: [APP_CONFIG] },
    { provide: STT_PROVIDER, useFactory: createSttProvider, inject: [APP_CONFIG] },
    SpeechService,
    RecognitionService
  ],
  exports: [SpeechService, RecognitionService]
})
export class SpeechModule {}
