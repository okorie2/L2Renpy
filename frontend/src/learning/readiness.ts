import type { GameSave } from "../core/models";
import { helpUsed } from "./progress";
import type { LanguageConceptId, LoggedEvidence } from "./models";

/**
 * How ready the learner is with something, worked out afresh from every attempt
 * kept, so a replay adds to the record instead of overwriting it. Recent attempts
 * count for more than old ones, and doing it alone, first time, counts for most:
 * needing the translation and three tries, then later answering straight away
 * unaided, reads as real progress.
 */

/** An attempt this many attempts old counts half as much as the newest. */
export const READINESS_HALF_LIFE = 3;

/** How much one attempt shows, from 0 (missed) to 1 (alone, first time). */
export function attemptScore(evidence: Pick<LoggedEvidence, "outcome" | "assistance" | "attempts">): number {
  if (evidence.outcome !== "successful") return 0;
  const helped = helpUsed(evidence.assistance).length > 0;
  const retries = Math.max(0, evidence.attempts - 1);
  if (!helped && retries === 0) return 1;
  // Got there with help or after tries: each extra try counts a little less.
  return Math.max(0.3, (helped ? 0.6 : 0.75) - 0.1 * retries);
}

/** Readiness with one concept from 0 to 1, or undefined before any assessed attempt. */
export function conceptReadiness(save: Pick<GameSave, "evidenceLog">, conceptId: LanguageConceptId): number | undefined {
  const attempts = save.evidenceLog
    .filter((entry) => entry.outcome !== "encountered" && entry.conceptIds.includes(conceptId))
    .sort((a, b) => a.seq - b.seq);
  if (!attempts.length) return undefined;
  let weighted = 0;
  let total = 0;
  attempts.forEach((entry, index) => {
    const age = attempts.length - 1 - index;
    const weight = 0.5 ** (age / READINESS_HALF_LIFE);
    weighted += weight * attemptScore(entry);
    total += weight;
  });
  return weighted / total;
}

/** Coarse on purpose, like the rest of the learning summary: never a percentage. */
export type Readiness = "not-started" | "getting-started" | "getting-there" | "ready";

export const READINESS_LABELS: Record<Readiness, string> = {
  "not-started": "Not started",
  "getting-started": "Just getting started",
  "getting-there": "Getting there",
  ready: "Ready"
};

/**
 * Readiness for a goal: its concepts taken together. Ready needs every concept
 * tried and the average high; one strong concept does not carry the rest.
 */
export function goalReadiness(save: Pick<GameSave, "evidenceLog">, conceptIds: LanguageConceptId[]): Readiness {
  const scores = conceptIds.map((id) => conceptReadiness(save, id));
  const tried = scores.filter((score): score is number => score !== undefined);
  if (!tried.length) return "not-started";
  const average = scores.reduce<number>((sum, score) => sum + (score ?? 0), 0) / scores.length;
  if (tried.length === scores.length && average >= 0.75) return "ready";
  return average >= 0.4 ? "getting-there" : "getting-started";
}
