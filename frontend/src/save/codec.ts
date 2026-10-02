import { SAVE_VERSION, type GameSave, type MessageThreadState, type Player, type PlayerProfile, type QuestProgress, type QuestStatus } from "../core/models";
import type { DialogueSession, HistoryLine, SaidResult, SayMode } from "../dialogue/engine";
import { updatePlayerProfile } from "../core/player";
import type {
  AssistanceKind, LearningEvidence, LearningModality, LearningSupport, LoggedEvidence, ModalityProgress,
  PlayerConceptMastery, PlayerVocabularyMastery, SupportLevel
} from "../learning/models";

/** Turns a stored save of one version into the next version's shape. */
export type SaveMigration = (save: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the version a step upgrades *from*. Version 1 is the first shape that was ever written to a device. */
export const SAVE_MIGRATIONS: Record<number, SaveMigration> = {
  // Version 2 added the phone: messages received and the places visited so far.
  1: (save) => {
    const player = save.player as { locationId?: unknown } | undefined;
    return { ...save, messages: {}, visitedLocationIds: typeof player?.locationId === "string" ? [player.locationId] : [] };
  }
};

export type DecodedSave =
  | { status: "ok"; save: GameSave; savedAt?: string; migratedFrom?: number }
  /** Not a save this game can read. */
  | { status: "unreadable" }
  /** Written by a later version of the game; it must not be overwritten. */
  | { status: "newer"; version: number };

export function encodeSave(save: GameSave, savedAt: string): string {
  return JSON.stringify({ savedAt, save });
}

// Each list is checked by the compiler against its type, so a new value cannot be forgotten here.
const keysOf = <T extends string>(record: Record<T, true>) => Object.keys(record) as T[];
const QUEST_STATUSES = keysOf<QuestStatus>({ locked: true, available: true, active: true, completed: true });
const MODALITIES = keysOf<LearningModality>({ listening: true, speaking: true, reading: true, writing: true });
const SUPPORT_LEVELS = keysOf<SupportLevel>({ full: true, guided: true, independent: true });
const SUPPORT_BASES = keysOf<LearningSupport["basis"]>({ default: true, "self-reported": true, observed: true });
const OUTCOMES = keysOf<LearningEvidence["outcome"]>({ encountered: true, successful: true, unsuccessful: true });
const ASSISTANCE = keysOf<AssistanceKind>({
  translation: true, hint: true, "suggested-answer": true, replay: true, "slow-playback": true, "typed-fallback": true
});
const SAY_MODES = keysOf<SayMode>({ speech: true, typed: true, selected: true });
const SESSION_STATUSES = keysOf<DialogueSession["status"]>({ active: true, completed: true });
const PROGRESS_FIELDS = keysOf<keyof ModalityProgress>({
  encounters: true, attempts: true, successfulAttempts: true, unsuccessfulAttempts: true, independentSuccesses: true, assistedEncounters: true
});

type Guard<T> = (value: unknown) => value is T;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isOptional = <T>(guard: Guard<T>) => (value: unknown): value is T | undefined => value === undefined || guard(value);
const isOneOf = <T extends string>(options: T[]): Guard<T> => (value): value is T => options.includes(value as T);
const isArrayOf = <T>(guard: Guard<T>): Guard<T[]> => (value): value is T[] => Array.isArray(value) && value.every(guard);
const isRecordOf = <T>(guard: Guard<T>): Guard<Record<string, T>> => (value): value is Record<string, T> => isRecord(value) && Object.values(value).every(guard);
const isStrings = isArrayOf(isString);

const isQuestProgress: Guard<QuestProgress> = (value): value is QuestProgress => (
  isRecord(value) && isOneOf(QUEST_STATUSES)(value.status) && isStrings(value.completedObjectiveIds) && isRecordOf(isCount)(value.objectiveCounts)
);

const isModalityProgress: Guard<ModalityProgress> = (value): value is ModalityProgress => (
  isRecord(value) && PROGRESS_FIELDS.every((field) => isCount(value[field]))
);

const isByModality = (value: unknown): value is Partial<Record<LearningModality, ModalityProgress>> => (
  isRecord(value) && Object.entries(value).every(([modality, progress]) => isOneOf(MODALITIES)(modality) && isModalityProgress(progress))
);

const isMastery = (idField: "conceptId" | "vocabularyId") => (value: unknown): value is PlayerConceptMastery & PlayerVocabularyMastery => (
  isRecord(value) && isString(value[idField]) && isByModality(value.byModality) && isOptional(isString)(value.lastPracticedAt)
);

const isEvidence: Guard<LoggedEvidence> = (value): value is LoggedEvidence => (
  isRecord(value)
  && isStrings(value.conceptIds)
  && isStrings(value.vocabularyIds)
  && isOneOf(MODALITIES)(value.modality)
  && isOneOf(OUTCOMES)(value.outcome)
  && isArrayOf(isOneOf(ASSISTANCE))(value.assistance)
  && isCount(value.attempts)
  && isString(value.at)
  && isOptional(isCount)(value.confidence)
  && isOptional(isRecord)(value.pronunciation)
  && isCount(value.seq)
  && isOneOf(SUPPORT_LEVELS)(value.supportLevel)
);

const isSupport: Guard<LearningSupport> = (value): value is LearningSupport => (
  isRecord(value) && isOneOf(SUPPORT_LEVELS)(value.level) && isOneOf(SUPPORT_BASES)(value.basis) && isOptional(isCount)(value.evidenceCountAtChange)
);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isSaidResult: Guard<SaidResult> = (value): value is SaidResult => (
  isRecord(value)
  && isOneOf(SAY_MODES)(value.mode)
  && isBoolean(value.communicated)
  && isCount(value.attempt)
  && isBoolean(value.helped)
  && isArrayOf((span): span is { start: number; end: number } => isRecord(span) && isCount(span.start) && isCount(span.end) && span.start <= span.end)(value.usedWords)
);

const isHistoryLine: Guard<HistoryLine> = (value): value is HistoryLine => (
  isRecord(value)
  && isString(value.nodeId)
  && isString(value.speakerId)
  && isString(value.text)
  && isOptional(isString)(value.translation)
  && isOptional(isString)(value.rewording)
  && isOptional(isSaidResult)(value.said)
  // Marks must fall inside the text they mark.
  && (!isSaidResult(value.said) || value.said.usedWords.every((span) => span.end <= (value.text as string).length))
);

const isSession: Guard<DialogueSession> = (value): value is DialogueSession => (
  isRecord(value)
  && isString(value.dialogueId)
  && isOptional(isString)(value.npcId)
  && isString(value.nodeId)
  && isOneOf(SESSION_STATUSES)(value.status)
  && isOptional(isString)(value.returnNodeId)
  && isRecordOf(isCount)(value.failedAttempts)
  && isOptional((override): override is NonNullable<DialogueSession["lineOverride"]> => (
    isRecord(override) && isString(override.nodeId) && isString(override.text) && isOptional(isString)(override.translation)
  ))(value.lineOverride)
  && isArrayOf(isHistoryLine)(value.history)
);

const isThreadState: Guard<MessageThreadState> = (value): value is MessageThreadState => (
  isRecord(value) && isString(value.receivedAt) && isBoolean(value.unread) && isSession(value.session)
);

function readPlayer(value: unknown): Player | undefined {
  if (!isRecord(value) || !isRecord(value.position)) return undefined;
  const { id, name, targetLanguageCode, locationId, position, xp } = value;
  if (!isString(id) || !isString(name) || !isString(targetLanguageCode) || !isString(locationId) || !isCount(xp)) return undefined;
  if (!isCount(position.x) || !isCount(position.y)) return undefined;
  return { id, name, targetLanguageCode, locationId, position: { x: position.x, y: position.y }, xp, profile: {} };
}

/** A save of the current version, or undefined when anything the game relies on is missing or malformed. */
function readSave(value: Record<string, unknown>): GameSave | undefined {
  const player = readPlayer(value.player);
  if (!player) return undefined;
  const {
    questProgress, completedDialogueIds, visitedLocationIds, messages, inventory, appliedEffects, conceptMastery, vocabularyMastery, evidenceLog, evidenceCount, learningSupport
  } = value;
  if (
    !isRecordOf(isQuestProgress)(questProgress)
    || !isStrings(completedDialogueIds)
    || !isStrings(visitedLocationIds)
    || !isRecordOf(isThreadState)(messages)
    || !isRecordOf(isCount)(inventory)
    || !isStrings(appliedEffects)
    || !isRecordOf(isMastery("conceptId"))(conceptMastery)
    || !isRecordOf(isMastery("vocabularyId"))(vocabularyMastery)
    || !isArrayOf(isEvidence)(evidenceLog)
    || !isCount(evidenceCount)
    || !isSupport(learningSupport)
  ) return undefined;

  let save: GameSave = {
    version: SAVE_VERSION,
    player, questProgress, completedDialogueIds, visitedLocationIds, messages, inventory, appliedEffects,
    conceptMastery: conceptMastery as Record<string, PlayerConceptMastery>,
    vocabularyMastery: vocabularyMastery as Record<string, PlayerVocabularyMastery>,
    evidenceLog, evidenceCount, learningSupport
  };
  // The profile goes through the same checks as a live answer; anything unexpected is dropped.
  const profile = isRecord(value.player) && isRecord(value.player.profile) ? value.player.profile : {};
  for (const field of ["displayName", "targetLanguageExperience", "motivation"] satisfies Array<keyof PlayerProfile>) {
    const answer = profile[field];
    if (isString(answer)) save = updatePlayerProfile(save, field, answer);
  }
  return save;
}

/**
 * Read stored save text. Older versions are upgraded one step at a time; anything
 * that cannot be trusted is reported rather than half-loaded.
 */
export function decodeSave(text: string, migrations: Record<number, SaveMigration> = SAVE_MIGRATIONS): DecodedSave {
  let stored: unknown;
  try {
    stored = JSON.parse(text);
  } catch {
    return { status: "unreadable" };
  }
  if (!isRecord(stored) || !isRecord(stored.save)) return { status: "unreadable" };

  let data = stored.save;
  const storedVersion = data.version;
  if (typeof storedVersion !== "number" || !Number.isInteger(storedVersion) || storedVersion < 0) return { status: "unreadable" };
  if (storedVersion > SAVE_VERSION) return { status: "newer", version: storedVersion };

  try {
    for (let version = storedVersion; version < SAVE_VERSION; version++) {
      const migrate = migrations[version];
      if (!migrate) return { status: "unreadable" };
      data = { ...migrate(data), version: version + 1 };
    }
  } catch {
    return { status: "unreadable" };
  }

  const save = readSave(data);
  if (!save) return { status: "unreadable" };
  return {
    status: "ok",
    save,
    ...(isString(stored.savedAt) ? { savedAt: stored.savedAt } : {}),
    ...(storedVersion < SAVE_VERSION ? { migratedFrom: storedVersion } : {})
  };
}
