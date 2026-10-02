import type { GameSave } from "../core/models";
import type { LanguageConcept, LearningModality, LearningSupport, ModalityProgress, VocabularyItem } from "./models";

/**
 * Where the learner stands with something. Deliberately coarse and never a
 * percentage: `independent` needs repeated unaided success, because one good
 * attempt is not mastery.
 */
export type Standing = "not-met" | "met" | "with-support" | "independent";

const INDEPENDENT_SUCCESSES_NEEDED = 2;

export interface ConceptSummary {
  concept: LanguageConcept;
  standing: Standing;
  needsPractice: boolean;
  encounters: number;
  /** Successes by understanding: reading, and listening once lines are voiced. */
  understood: number;
  producedBySpeaking: number;
  producedByWriting: number;
  misses: number;
}

export interface VocabularySummary {
  item: VocabularyItem;
  encounters: number;
  /** Times the learner used it themselves, spoken or written. */
  produced: number;
}

export interface LearningSummary {
  concepts: ConceptSummary[];
  /** Vocabulary the learner has met, most used first. */
  vocabulary: VocabularySummary[];
  support: LearningSupport;
}

const count = (progress: Partial<Record<LearningModality, ModalityProgress>> | undefined, key: keyof ModalityProgress, modalities?: LearningModality[]) => (
  Object.entries(progress ?? {})
    .filter(([modality]) => !modalities || modalities.includes(modality as LearningModality))
    .reduce((total, [, value]) => total + (value?.[key] ?? 0), 0)
);

/**
 * What the game can say about the learner's language: what they have met, what
 * they understand, what they have produced and how, and what needs more practice.
 * It reads only learning evidence; XP and quests play no part.
 */
export function summarizeLearning(save: GameSave, concepts: LanguageConcept[], vocabulary: VocabularyItem[]): LearningSummary {
  const conceptSummaries = concepts.map((concept): ConceptSummary => {
    const progress = save.conceptMastery[concept.id]?.byModality;
    const encounters = count(progress, "encounters");
    const successes = count(progress, "successfulAttempts");
    const independent = count(progress, "independentSuccesses");
    const misses = count(progress, "unsuccessfulAttempts");
    const standing: Standing = encounters === 0 ? "not-met"
      : successes === 0 ? "met"
      : independent >= INDEPENDENT_SUCCESSES_NEEDED ? "independent"
      : "with-support";
    return {
      concept,
      standing,
      needsPractice: misses > 0 && (misses >= successes || (misses >= 2 && independent === 0)),
      encounters,
      understood: count(progress, "successfulAttempts", ["reading", "listening"]),
      producedBySpeaking: count(progress, "successfulAttempts", ["speaking"]),
      producedByWriting: count(progress, "successfulAttempts", ["writing"]),
      misses
    };
  });

  const vocabularySummaries = vocabulary
    .map((item): VocabularySummary => {
      const progress = save.vocabularyMastery[item.id]?.byModality;
      return { item, encounters: count(progress, "encounters"), produced: count(progress, "successfulAttempts", ["speaking", "writing"]) };
    })
    .filter((entry) => entry.encounters > 0)
    .sort((a, b) => b.produced - a.produced || b.encounters - a.encounters);

  return { concepts: conceptSummaries, vocabulary: vocabularySummaries, support: save.learningSupport };
}
