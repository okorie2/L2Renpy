import type { GameSave } from "../core/models";
import type { AssistanceKind, LearningModality } from "../learning/models";
import { recordLearningEvidence } from "../learning/progress";
import type { DialogueNode } from "./models";

/**
 * Record that the learner met a line. This is exposure only: it never counts as a
 * success, and the assistance in use is kept so later evidence can be weighed.
 */
export function recordLineEncounter(
  save: GameSave,
  node: DialogueNode,
  vocabularyIds: string[],
  modality: LearningModality,
  assistance: AssistanceKind[],
  at: string
): GameSave {
  return recordLearningEvidence(save, {
    conceptIds: node.conceptIds,
    vocabularyIds,
    modality,
    outcome: "encountered",
    assistance,
    attempts: 1,
    at
  });
}
