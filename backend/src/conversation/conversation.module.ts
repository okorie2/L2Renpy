import { Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config";
import { CHAT_MODEL, NoChatModel, type ChatModel } from "./chat-model";
import { ConversationController } from "./conversation.controller";
import { ConversationService } from "./conversation.service";
import { OpenRouterProvider } from "./providers/openrouter.provider";

/** The one place a provider name becomes an adapter. Without credentials the layer is simply off. */
export function createChatModel(config: AppConfig): ChatModel {
  switch (config.ai.provider) {
    case "none":
      return new NoChatModel();
    case "openrouter":
      return config.ai.apiKey
        ? new OpenRouterProvider({ apiKey: config.ai.apiKey, model: config.ai.model, baseUrl: config.ai.baseUrl })
        : new NoChatModel();
    default:
      throw new Error(`Unknown AI_PROVIDER "${config.ai.provider}"`);
  }
}

@Module({
  controllers: [ConversationController],
  providers: [{ provide: CHAT_MODEL, useFactory: createChatModel, inject: [APP_CONFIG] }, ConversationService]
})
export class ConversationModule {}
