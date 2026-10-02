import { createHash } from "node:crypto";
import { BadGatewayException, BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config";
import { CHAT_MODEL, type ChatModel } from "./chat-model";
import { buildTurnPrompt, InvalidTurnError, readTurnJudgement, readTurnRequest, turnSchema, type TurnJudgement } from "./turn";

/** A judgement is a few short fields; this leaves room without allowing an essay. */
const MAX_OUTPUT_TOKENS = 300;
const CACHE_ENTRIES = 300;
const WINDOW_MS = 60_000;

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly cache = new Map<string, TurnJudgement>();
  private calls: number[] = [];

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CHAT_MODEL) private readonly model: ChatModel
  ) {}

  /** Whether a second opinion can be asked for right now. */
  available(): boolean {
    return this.model.available;
  }

  /**
   * Ask the model what the learner meant. The answer is checked and returned as
   * advice; nothing here touches game state, and the game works without it.
   */
  async judgeTurn(body: unknown, now = Date.now()): Promise<TurnJudgement> {
    let request;
    try {
      request = readTurnRequest(body, this.config.speech.languages);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "invalid request");
    }
    if (!this.model.available) throw new ServiceUnavailableException("the AI conversation layer is not configured");

    const prompt = buildTurnPrompt(request);
    // The same words in the same scene get the same answer, and are paid for once.
    const key = createHash("sha256").update(`${this.model.id}\n${this.config.ai.model}\n${prompt.system}\n${prompt.user}`).digest("hex");
    const cached = this.cache.get(key);
    if (cached) return cached;

    this.calls = this.calls.filter((at) => now - at < WINDOW_MS);
    if (this.calls.length >= this.config.ai.requestsPerMinute) {
      throw new HttpException("the AI conversation layer is busy", HttpStatus.TOO_MANY_REQUESTS);
    }
    this.calls.push(now);

    const started = Date.now();
    const ask = async () => {
      const reply = await this.model.complete({
        ...prompt,
        schema: turnSchema(request),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        signal: AbortSignal.timeout(this.config.ai.timeoutMs)
      });
      return { reply, judgement: readTurnJudgement(reply.text, request) };
    };
    try {
      // Models occasionally return a malformed reply; one more try usually settles it.
      const { reply, judgement } = await ask().catch((error) => {
        if (!(error instanceof InvalidTurnError)) throw error;
        this.calls.push(now);
        return ask();
      });
      // Log sizes and timings only; never what the learner or the model said.
      this.logger.log(`Judged a turn in ${Date.now() - started} ms (${reply.inputTokens ?? "?"} in, ${reply.outputTokens ?? "?"} out, intent ${judgement.detectedIntent ? "detected" : "not detected"})`);
      if (this.cache.size >= CACHE_ENTRIES) this.cache.delete(this.cache.keys().next().value as string);
      this.cache.set(key, judgement);
      return judgement;
    } catch (error) {
      if (error instanceof InvalidTurnError) {
        this.logger.warn(`Discarded a model reply: ${error.message}`);
        throw new BadGatewayException("the language model gave an unusable answer");
      }
      this.logger.warn(`The language model failed after ${Date.now() - started} ms: ${error instanceof Error ? error.message : "unknown error"}`);
      throw new ServiceUnavailableException("the language model is not available");
    }
  }
}
