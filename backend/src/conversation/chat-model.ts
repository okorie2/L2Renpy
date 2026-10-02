export const CHAT_MODEL = Symbol("CHAT_MODEL");

export interface ChatRequest {
  system: string;
  user: string;
  /** JSON Schema the reply must follow. */
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  signal: AbortSignal;
}

export interface ChatReply {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * The only thing the rest of the backend knows about a language model: text in,
 * structured text out. Which company or model answers is an adapter's business.
 * What the reply means for the game is decided elsewhere, after validation.
 */
export interface ChatModel {
  readonly id: string;
  /** False when no model is configured; callers then go without. */
  readonly available: boolean;
  complete(request: ChatRequest): Promise<ChatReply>;
}

/** Used when the AI layer is switched off or has no credentials. */
export class NoChatModel implements ChatModel {
  readonly id = "none";
  readonly available = false;
  complete(): Promise<ChatReply> {
    return Promise.reject(new Error("no language model is configured"));
  }
}
