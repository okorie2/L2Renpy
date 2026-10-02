export const CONCEPT_IDS = {
  GREETING: "GREETING",
  FAREWELL: "FAREWELL",
  INTRODUCE_SELF: "INTRODUCE_SELF",
  BASIC_QUESTION: "BASIC_QUESTION",
  YES_NO: "YES_NO",
  POLITE_REQUEST: "POLITE_REQUEST",
  THANK_PERSON: "THANK_PERSON",
  ORDER_ITEM: "ORDER_ITEM",
  NUMBERS_1_10: "NUMBERS_1_10",
  UNDERSTAND_PRICE: "UNDERSTAND_PRICE"
} as const;

export type LanguageConceptId = (typeof CONCEPT_IDS)[keyof typeof CONCEPT_IDS];

/** Evidence is kept per modality: hearing a phrase is not the same skill as saying it. */
export type LearningModality = "listening" | "speaking" | "reading" | "writing";

export interface LanguageConcept {
  id: LanguageConceptId;
  description: string;
  modalities: LearningModality[];
}

export type PartOfSpeech = "noun" | "verb" | "adjective" | "number" | "interjection" | "phrase";

export interface VocabularyItem {
  id: string;
  /** Dictionary form. */
  lemma: string;
  /** Every written form that counts as this item, including the lemma. */
  surfaceForms: string[];
  gloss: string;
  partOfSpeech: PartOfSpeech;
  conceptIds: LanguageConceptId[];
  examples: Array<{ target: string; translation: string }>;
  /** Where the learner first meets it. */
  introducedIn: { chapter: number; dialogueId: string };
}

/**
 * A meaning the player can communicate. Assessment asks whether this intent was
 * conveyed, never whether one exact sentence was produced; `acceptedExpressions`
 * are examples of valid wordings, not an exhaustive match list.
 */
export interface ConversationIntent {
  id: string;
  conceptId: LanguageConceptId;
  modality: LearningModality;
  prompt: string;
  /** In plain English, exactly what counts as expressing this intent. Read by the AI second opinion. */
  meaning?: string;
  acceptedExpressions?: string[];
  /**
   * Key phrases for the rule-based assessor: the intent is communicated when every
   * phrase of any one group appears. Each group is one way of saying it.
   */
  match: string[][];
}

/** Help the learner drew on while handling a line; weaker evidence the more is used. */
export type AssistanceKind =
  | "translation"
  | "hint"
  | "suggested-answer"
  | "replay"
  | "slow-playback"
  /** Typed because speaking was unavailable. A change of modality, not help. */
  | "typed-fallback";

/**
 * How much scaffolding dialogue offers by default. Self-report only seeds this;
 * observed behaviour moves it one step at a time.
 */
export type SupportLevel = "full" | "guided" | "independent";

export interface LearningSupport {
  level: SupportLevel;
  basis: "default" | "self-reported" | "observed";
  /** Evidence count when the level last changed; later behaviour is judged from here. */
  evidenceCountAtChange?: number;
}

/** Relative, unvalidated engineering signals. Never shown to learners as a proficiency score. */
export interface PronunciationDiagnostics {
  wordsNeedingPractice: Array<{ word: string; relativeSimilarity?: number }>;
  phraseRelativeSimilarity?: number;
}

/**
 * One meaningful language interaction. `encountered` is exposure only; `successful`
 * and `unsuccessful` require an assessed response. Communication outcome and
 * pronunciation diagnostics are separate fields and are never merged into one score.
 */
export interface LearningEvidence {
  conceptIds: LanguageConceptId[];
  vocabularyIds: string[];
  modality: LearningModality;
  outcome: "encountered" | "successful" | "unsuccessful";
  assistance: AssistanceKind[];
  /** Which try this was at the same question; 1 for exposure. */
  attempts: number;
  at: string;
  /** Assessor confidence from 0 to 1, when one exists. */
  confidence?: number;
  pronunciation?: PronunciationDiagnostics;
}

/** Evidence as kept in the save, with its order and the support in force at the time. */
export interface LoggedEvidence extends LearningEvidence {
  seq: number;
  supportLevel: SupportLevel;
}

export interface ModalityProgress {
  /** Every interaction, including plain exposure. */
  encounters: number;
  /** Assessed tries, successful or not. */
  attempts: number;
  successfulAttempts: number;
  unsuccessfulAttempts: number;
  /** Successes on the first try with no help. */
  independentSuccesses: number;
  /** Interactions where any help was used. */
  assistedEncounters: number;
}

export interface PlayerConceptMastery {
  conceptId: LanguageConceptId;
  byModality: Partial<Record<LearningModality, ModalityProgress>>;
  lastPracticedAt?: string;
}

export interface PlayerVocabularyMastery {
  vocabularyId: string;
  byModality: Partial<Record<LearningModality, ModalityProgress>>;
  lastPracticedAt?: string;
}
