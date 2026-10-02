import type { GameSave } from "../core/models";
import type { AssistanceKind, LearningEvidence, LearningModality, ModalityProgress } from "./models";

export type { LearningEvidence } from "./models";

/** Enough to explain recent behaviour and adapt support; older entries live on in the mastery counts. */
export const EVIDENCE_LOG_LIMIT = 300;

/** Help that actually made the task easier. Typing instead of speaking is not help. */
export function helpUsed(assistance: AssistanceKind[]): AssistanceKind[] {
  return assistance.filter((kind) => kind !== "typed-fallback");
}

function advance(previous: ModalityProgress | undefined, evidence: LearningEvidence): ModalityProgress {
  const assessed = evidence.outcome !== "encountered";
  const successful = evidence.outcome === "successful";
  const helped = helpUsed(evidence.assistance).length > 0;
  return {
    encounters: (previous?.encounters ?? 0) + 1,
    attempts: (previous?.attempts ?? 0) + (assessed ? 1 : 0),
    successfulAttempts: (previous?.successfulAttempts ?? 0) + (successful ? 1 : 0),
    unsuccessfulAttempts: (previous?.unsuccessfulAttempts ?? 0) + (assessed && !successful ? 1 : 0),
    independentSuccesses: (previous?.independentSuccesses ?? 0) + (successful && !helped && evidence.attempts <= 1 ? 1 : 0),
    assistedEncounters: (previous?.assistedEncounters ?? 0) + (helped ? 1 : 0)
  };
}

function bump<T extends { byModality: Partial<Record<LearningModality, ModalityProgress>> }>(
  previous: T | undefined,
  evidence: LearningEvidence
): Pick<T, "byModality"> & { lastPracticedAt: string } {
  return {
    byModality: { ...previous?.byModality, [evidence.modality]: advance(previous?.byModality[evidence.modality], evidence) },
    lastPracticedAt: evidence.at
  };
}

/**
 * Record one language interaction: update the per-modality counts for its concepts
 * and vocabulary, and append it to the log. Exposure and demonstrated success are
 * distinct; showing a line never proves anything. Game progression is untouched.
 */
export function recordLearningEvidence(save: GameSave, evidence: LearningEvidence): GameSave {
  if (evidence.conceptIds.length === 0 && evidence.vocabularyIds.length === 0) return save;

  const conceptMastery = { ...save.conceptMastery };
  for (const conceptId of new Set(evidence.conceptIds)) {
    conceptMastery[conceptId] = { conceptId, ...bump(conceptMastery[conceptId], evidence) };
  }
  const vocabularyMastery = { ...save.vocabularyMastery };
  for (const vocabularyId of new Set(evidence.vocabularyIds)) {
    vocabularyMastery[vocabularyId] = { vocabularyId, ...bump(vocabularyMastery[vocabularyId], evidence) };
  }

  const evidenceCount = save.evidenceCount + 1;
  const logged = { ...evidence, seq: evidenceCount, supportLevel: save.learningSupport.level };
  return {
    ...save,
    conceptMastery,
    vocabularyMastery,
    evidenceCount,
    evidenceLog: [...save.evidenceLog, logged].slice(-EVIDENCE_LOG_LIMIT)
  };
}
