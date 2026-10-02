import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, loadConfig } from "./config";
import { ConversationModule } from "./conversation/conversation.module";
import { HealthController } from "./health/health.controller";
import { SpeechModule } from "./speech/speech.module";

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG]
})
class ConfigModule {}

@Module({
  imports: [ConfigModule, SpeechModule, ConversationModule],
  controllers: [HealthController]
})
export class AppModule {}
