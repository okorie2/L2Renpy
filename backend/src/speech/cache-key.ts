import { createHash } from "node:crypto";

export interface TtsCacheKeyParts {
  provider: string;
  model: string;
  voice: string;
  language: string;
  /** The exact text: any difference in wording or punctuation is a different line. */
  text: string;
  rate: string;
}

/**
 * Stable identity of one generated line, so identical speech is synthesized once.
 * Fields are length-prefixed to keep distinct inputs from colliding, then hashed
 * into a name that is safe to use as a file name.
 */
export function ttsCacheKey(parts: TtsCacheKeyParts): string {
  const canonical = [parts.provider, parts.model, parts.voice, parts.language, parts.rate, parts.text]
    .map((part) => `${part.length}:${part}`)
    .join("|");
  return createHash("sha256").update(canonical).digest("hex");
}
