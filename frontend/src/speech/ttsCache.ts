export interface TtsCacheKeyParts {
  provider: string;
  model: string;
  voice: string;
  language: string;
  /** The exact text: any difference in wording or punctuation is a different line. */
  text: string;
  rate?: string;
}

/**
 * Stable key for generated speech, so an identical line is synthesized once.
 * Fields are length-prefixed to keep distinct inputs from colliding.
 */
export function ttsCacheKey(parts: TtsCacheKeyParts): string {
  return [parts.provider, parts.model, parts.voice, parts.language, parts.rate ?? "normal", parts.text]
    .map((part) => `${part.length}:${part}`)
    .join("|");
}
