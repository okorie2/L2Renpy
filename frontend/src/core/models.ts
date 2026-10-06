import type { DialogueSession } from "../dialogue/engine";
import type { LearningSupport, LoggedEvidence, PlayerConceptMastery, PlayerVocabularyMastery } from "../learning/models";

/** Positions are fractions of an authored location's world dimensions. */
export interface WorldPosition {
  x: number;
  y: number;
}

export interface WorldRect extends WorldPosition {
  width: number;
  height: number;
}

export type TargetLanguageExperience = "new" | "some" | "conversational";
export type LearningMotivation = "travel" | "work" | "study" | "people" | "curiosity";

/**
 * The little the game knows about the learner, kept apart from canonical language
 * content. Everything is optional and deliberately coarse: no real name required. The
 * age is only a number to practise "J'ai … ans." with; it is never checked or shared.
 */
export interface PlayerProfile {
  displayName?: string;
  age?: number;
  targetLanguageExperience?: TargetLanguageExperience;
  motivation?: LearningMotivation;
}

export interface Player {
  id: string;
  name: string;
  targetLanguageCode: string;
  locationId: string;
  position: WorldPosition;
  xp: number;
  profile: PlayerProfile;
}

/** A fact about the save that content can test, such as which dialogue an NPC should use. */
export type Condition =
  | { type: "QUEST_STATUS"; questId: string; status: QuestStatus }
  | { type: "OBJECTIVE_CURRENT"; questId: string; objectiveId: string }
  | { type: "DIALOGUE_COMPLETED"; dialogueId: string }
  | { type: "PROFILE_EQUALS"; field: keyof PlayerProfile; value: string }
  | { type: "HAS_ITEM"; itemId: string };

export interface NpcDialogueRule {
  dialogueId: string;
  /** All must hold. A rule without conditions always applies, so it belongs last. */
  when?: Condition[];
}

export interface NPC {
  id: string;
  name: string;
  locationId: string;
  position: WorldPosition;
  /**
   * Who this person is to the player, for anything that speaks in their voice
   * beyond the scripted lines. `register` is how they address the player.
   */
  persona?: { role: string; register: "informal" | "formal" };
  /** Also the character visual ID when the catalog has art for this NPC. */
  appearanceId: string;
  /** Ordered: the first rule whose conditions hold decides what the NPC says. */
  dialogues: NpcDialogueRule[];
  interaction: {
    radius: number;
    /** Distance at which the NPC acknowledges the player, if it has a greeting pose. */
    noticeRadius?: number;
  };
  /** Optional walk-in played the first time the NPC's location is shown in a session. */
  entrance?: { from: WorldPosition; durationMs: number };
  state: "available" | "busy";
}

export interface Portal {
  id: string;
  position: WorldPosition;
  destination: { locationId: string; spawnId: string };
  label: string;
  interactionRadius: number;
}

export interface Location {
  id: string;
  name: string;
  kind: "neighborhood" | "apartment" | "cafe" | "bakery";
  size: { width: number; height: number };
  /** A painted picture of the location, as an asset path. Without one it is drawn from shapes. */
  backdrop?: string;
  /**
   * How much larger people stand here than on the street. A painting made from
   * closer up needs larger figures to look right beside its furniture. Default 1.
   */
  figureScale?: number;
  /**
   * Parts of the painting a character can walk behind, each cut out as its own
   * image. `base` is where the thing meets the ground: anyone standing above
   * that line is drawn behind it.
   */
  props?: Array<{ image: string; rect: WorldRect; base: number }>;
  /** `sign` is the centre of the building's name board, when a painting has one. */
  buildings: Array<{ id: string; labelKey: string; rect: WorldRect; sign?: WorldPosition }>;
  obstacles: WorldRect[];
  portals: Portal[];
  spawnPoints: Record<string, WorldPosition>;
}

export interface Item {
  id: string;
  name: string;
}

export type Reward =
  | { type: "XP"; amount: number }
  | { type: "ITEM"; itemId: string; quantity?: number };

/**
 * What must happen for an objective to progress or a quest to start. Language
 * triggers name a concept or intent, never a sentence: any valid wording counts.
 */
export type ObjectiveTrigger =
  | { type: "DIALOGUE_COMPLETED"; dialogueId: string }
  | { type: "DIALOGUE_LINE_COMPLETED"; dialogueId: string; nodeId: string }
  | { type: "NPC_TALKED"; npcId: string }
  | { type: "LOCATION_ENTERED"; locationId: string }
  | { type: "ITEM_ACQUIRED"; itemId: string }
  | { type: "CONCEPT_DEMONSTRATED"; conceptId: string }
  | { type: "INTENT_COMMUNICATED"; intentId: string }
  | { type: "QUEST_COMPLETED"; questId: string };

export interface QuestObjective {
  id: string;
  description: string;
  trigger: ObjectiveTrigger;
  /** Optional objectives can be done at any point while the quest is active and never block it. */
  optional?: boolean;
  /** How many matching events are needed; defaults to 1. */
  count?: number;
  /** The event only counts while the player is in this location. */
  requires?: { locationId?: string };
}

export type QuestStatus = "locked" | "available" | "active" | "completed";

export interface Quest {
  id: string;
  chapter: number;
  title: string;
  summary: string;
  /** Quests that must be completed before this one becomes available. */
  prerequisites: string[];
  /**
   * How an available quest becomes active. Without it the quest starts as soon as
   * it is available; with it the player must do something first.
   */
  start?: { trigger: ObjectiveTrigger; description: string };
  /** Required objectives are completed in order. */
  objectives: QuestObjective[];
  rewards: Reward[];
}

export interface QuestProgress {
  status: QuestStatus;
  completedObjectiveIds: string[];
  /** Matching events seen so far for objectives that need more than one. */
  objectiveCounts: Record<string, number>;
}

/**
 * The shape of the save. Raise it whenever a stored save would no longer load
 * as-is, and add the matching step to the save migrations.
 */
export const SAVE_VERSION = 2;

/**
 * A conversation that reaches the player on their phone. It is an ordinary
 * dialogue, shown as messages; it arrives once, when all its conditions hold.
 */
export interface MessageThread {
  id: string;
  /** The NPC who writes. */
  contactId: string;
  dialogueId: string;
  when: Condition[];
}

/** A thread the player has received, with how far the exchange has gone. */
export interface MessageThreadState {
  receivedAt: string;
  /** Something in it has not been looked at yet. */
  unread: boolean;
  session: DialogueSession;
}

/** Game progression (XP, quests) and language progression (mastery, support) stay separate. */
export interface GameSave {
  version: typeof SAVE_VERSION;
  player: Player;
  questProgress: Record<string, QuestProgress>;
  completedDialogueIds: string[];
  /** Every location the player has been in, in order of first visit. */
  visitedLocationIds: string[];
  /** Phone messages received, by thread ID. */
  messages: Record<string, MessageThreadState>;
  inventory: Record<string, number>;
  /** One-time dialogue effects already applied, as "dialogueId.nodeId". */
  appliedEffects: string[];
  conceptMastery: Record<string, PlayerConceptMastery>;
  vocabularyMastery: Record<string, PlayerVocabularyMastery>;
  /** The most recent language interactions, oldest first. */
  evidenceLog: LoggedEvidence[];
  /** Total interactions ever recorded; the log keeps only the latest. */
  evidenceCount: number;
  learningSupport: LearningSupport;
}
