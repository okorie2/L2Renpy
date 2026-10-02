import { Body, Controller, Get, Header, HttpCode, Inject, Post } from "@nestjs/common";
import { ConversationService } from "./conversation.service";

@Controller("conversation")
export class ConversationController {
  constructor(@Inject(ConversationService) private readonly conversation: ConversationService) {}

  @Get("capabilities")
  capabilities() {
    return { judgement: this.conversation.available() };
  }

  /**
   * A second opinion on one learner turn: which expected intent, if any, came
   * across, and what the character might say when it did not. The game's own
   * rules decide what happens next.
   */
  @Post("turn")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  turn(@Body() body: unknown) {
    return this.conversation.judgeTurn(body);
  }
}
