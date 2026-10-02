import type { ChatModel, ChatReply, ChatRequest } from "../chat-model";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class ChatModelError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * OpenRouter, which speaks the OpenAI chat-completions format and routes to the
 * configured model. Learner text is only sent to providers that do not keep it
 * for training (`data_collection: "deny"`).
 */
export class OpenRouterProvider implements ChatModel {
  readonly id = "openrouter";
  readonly available = true;

  constructor(
    private readonly options: { apiKey: string; model: string; baseUrl: string },
    private readonly fetchImpl: Fetch = (input, init) => fetch(input, init)
  ) {}

  async complete(request: ChatRequest): Promise<ChatReply> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.baseUrl}/chat/completions`, {
        method: "POST",
        signal: request.signal,
        headers: { Authorization: `Bearer ${this.options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.options.model,
          max_tokens: request.maxOutputTokens,
          temperature: 0.2,
          provider: { data_collection: "deny" },
          response_format: { type: "json_schema", json_schema: { name: "turn", strict: true, schema: request.schema } },
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user }
          ]
        })
      });
    } catch {
      throw new ChatModelError("the language model is not reachable", 503);
    }
    if (!response.ok) throw new ChatModelError(`the language model answered ${response.status}`, response.status);

    const body = await response.json() as {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new ChatModelError("the language model returned no text", 502);
    return { text, inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens };
  }
}
