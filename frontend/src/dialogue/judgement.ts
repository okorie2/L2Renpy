/**
 * A second opinion on something the learner said, from outside the rule-based
 * assessor (today: a language model behind the backend). It is advice. The
 * dialogue engine accepts it only for the intent the current line expects, and
 * only above a confidence threshold; it can never name a reward, an item or a
 * quest step.
 */
export interface UtteranceJudgement {
  /** The intent the learner was understood to express, or null. */
  intentId: string | null;
  confidence: number;
  /** What the other speaker says next when the meaning did not come across. */
  reply?: { text: string; translation?: string };
  /** Another way to say what the learner said, usually with a mistake fixed. */
  rewording?: string;
}

/** Below this the opinion is not sure enough to count as communication. */
export const JUDGEMENT_CONFIDENCE_NEEDED = 0.7;
export const JUDGED_LINE_MAX_LENGTH = 120;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A short single line with nothing that could act as markup or a template slot, or undefined. */
function line(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  return text && text.length <= JUDGED_LINE_MAX_LENGTH && !/[<>{}]/.test(text) ? text : undefined;
}

/**
 * Read a judgement that arrived from outside. Anything that is not the agreed
 * shape gives undefined, which the game treats as "no second opinion".
 */
export function readJudgement(raw: unknown, offeredIntentIds: string[]): UtteranceJudgement | undefined {
  if (!isRecord(raw)) return undefined;
  const { detectedIntent, confidence } = raw;
  if (detectedIntent !== null && !(typeof detectedIntent === "string" && offeredIntentIds.includes(detectedIntent))) return undefined;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return undefined;

  const judgement: UtteranceJudgement = { intentId: detectedIntent, confidence };
  if (detectedIntent === null && isRecord(raw.npcResponse)) {
    const text = line(raw.npcResponse.text);
    const translation = line(raw.npcResponse.translation);
    if (text) judgement.reply = { text, ...(translation ? { translation } : {}) };
  }
  const rewording = detectedIntent === null ? undefined : line(raw.correction);
  if (rewording) judgement.rewording = rewording;
  return judgement;
}
