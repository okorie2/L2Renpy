import type { GameSave } from "../core/models";
import type { LearningSupport, LoggedEvidence, SupportLevel } from "./models";
import { helpUsed } from "./progress";

/** Ordered from most to least scaffolding. */
const LEVELS: SupportLevel[] = ["full", "guided", "independent"];

export interface SupportPolicy {
  /**
   * `visible`: shown with the line. `on-request`: one tap reveals it.
   * `on-help`: not offered up front; still reachable through the help control.
   */
  translation: "visible" | "on-request" | "on-help";
  hints: "offered" | "on-help";
}

const POLICIES: Record<SupportLevel, SupportPolicy> = {
  full: { translation: "visible", hints: "offered" },
  guided: { translation: "on-request", hints: "offered" },
  independent: { translation: "on-help", hints: "on-help" }
};

export function supportPolicy(level: SupportLevel): SupportPolicy {
  return POLICIES[level];
}

export const DEFAULT_LEARNING_SUPPORT: LearningSupport = { level: "full", basis: "default" };

/** Self-reported experience is only a starting hint; behaviour refines it later. */
export function initialSupportLevel(experience: "new" | "some" | "conversational" | undefined): SupportLevel {
  if (experience === "conversational") return "independent";
  if (experience === "some") return "guided";
  return "full";
}

/** Support changes one level at a time so difficulty never jumps abruptly. */
export function stepSupportLevel(level: SupportLevel, direction: "more-support" | "less-support"): SupportLevel {
  const index = LEVELS.indexOf(level) + (direction === "less-support" ? 1 : -1);
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
}

/** How many recent answered questions are weighed, and how many must agree. */
export const SUPPORT_WINDOW = 6;
const SMOOTH_NEEDED = 5;
const STRUGGLE_NEEDED = 3;
const PRODUCED_NEEDED = 3;

/** A question answered on the first try, without asking for anything beyond what the level shows anyway. */
function wasSmooth(entry: LoggedEvidence): boolean {
  if (entry.attempts > 1) return false;
  return entry.supportLevel === "full" || helpUsed(entry.assistance).length === 0;
}

/** A question that took more than one try, or that needed the answer or a hint to be revealed. */
function wasStruggle(entry: LoggedEvidence): boolean {
  if (entry.attempts > 1) return true;
  return entry.supportLevel !== "full" && entry.assistance.some((kind) => kind === "suggested-answer" || kind === "hint");
}

/**
 * Move the support level from what the learner has actually been doing. It looks
 * at the last few answered questions since the level last changed: mostly smooth
 * means less scaffolding, repeated struggle means more. One step at most, and a
 * fresh window is needed before the next change.
 */
export function adaptSupport(save: GameSave): GameSave {
  const since = save.learningSupport.evidenceCountAtChange ?? 0;
  const answered = save.evidenceLog.filter((entry) => entry.seq > since && entry.outcome === "successful");
  if (answered.length < SUPPORT_WINDOW) return save;

  const recent = answered.slice(-SUPPORT_WINDOW);
  const level = save.learningSupport.level;
  const smooth = recent.filter(wasSmooth).length;
  const struggles = recent.filter(wasStruggle).length;
  // Leaving full support takes real production, not just picking the offered sentence.
  const produced = recent.filter((entry) => entry.modality === "speaking" || entry.modality === "writing").length;

  let next = level;
  if (struggles >= STRUGGLE_NEEDED) next = stepSupportLevel(level, "more-support");
  else if (smooth >= SMOOTH_NEEDED && (level !== "full" || produced >= PRODUCED_NEEDED)) next = stepSupportLevel(level, "less-support");
  if (next === level) return save;

  return { ...save, learningSupport: { level: next, basis: "observed", evidenceCountAtChange: save.evidenceCount } };
}
