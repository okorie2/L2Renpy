import { DEFAULT_LEARNING_SUPPORT } from "../learning/support";
import { SAVE_VERSION, type GameSave, type ObjectiveTrigger, type Player, type Quest, type QuestObjective, type QuestProgress, type Reward } from "./models";

/**
 * Facts about what happened in the game. Quests never look at UI state; they
 * only react to these. `QUEST_COMPLETED` and `ITEM_ACQUIRED` are also raised by
 * the engine itself, which is how quests chain.
 */
export type GameEvent =
  | { type: "DIALOGUE_COMPLETED"; dialogueId: string; npcId?: string }
  | { type: "DIALOGUE_LINE_COMPLETED"; dialogueId: string; nodeId: string; npcId?: string }
  | { type: "LOCATION_ENTERED"; locationId: string }
  | { type: "ITEM_ACQUIRED"; itemId: string }
  | { type: "CONCEPT_DEMONSTRATED"; conceptId: string }
  | { type: "INTENT_COMMUNICATED"; intentId: string }
  | { type: "QUEST_COMPLETED"; questId: string };

const EMPTY_PROGRESS: QuestProgress = { status: "locked", completedObjectiveIds: [], objectiveCounts: {} };
// Far above any real chain length; only guards against a content loop.
const MAX_CASCADE = 200;

export function createInitialSave(player: Player, quests: Quest[]): GameSave {
  const save: GameSave = {
    version: SAVE_VERSION,
    player,
    questProgress: Object.fromEntries(quests.map((quest) => [quest.id, EMPTY_PROGRESS])),
    completedDialogueIds: [],
    visitedLocationIds: [player.locationId],
    messages: {},
    inventory: {},
    appliedEffects: [],
    conceptMastery: {},
    vocabularyMastery: {},
    evidenceLog: [],
    evidenceCount: 0,
    learningSupport: { ...DEFAULT_LEARNING_SUPPORT }
  };
  return unlockQuests(save, quests);
}

/**
 * Bring a save in line with the quests the game ships now: quests it has never
 * seen are added, and any whose prerequisites are already done open up. Progress
 * on quests the content no longer lists is kept untouched.
 */
export function syncQuestProgress(save: GameSave, quests: Quest[]): GameSave {
  const missing = quests.filter((quest) => !save.questProgress[quest.id]);
  const next = missing.length
    ? { ...save, questProgress: { ...save.questProgress, ...Object.fromEntries(missing.map((quest) => [quest.id, EMPTY_PROGRESS])) } }
    : save;
  return unlockQuests(next, quests);
}

function triggerMatches(trigger: ObjectiveTrigger, event: GameEvent): boolean {
  switch (trigger.type) {
    case "DIALOGUE_COMPLETED":
      return event.type === "DIALOGUE_COMPLETED" && event.dialogueId === trigger.dialogueId;
    case "DIALOGUE_LINE_COMPLETED":
      return event.type === "DIALOGUE_LINE_COMPLETED" && event.dialogueId === trigger.dialogueId && event.nodeId === trigger.nodeId;
    case "NPC_TALKED":
      return event.type === "DIALOGUE_COMPLETED" && event.npcId === trigger.npcId;
    case "LOCATION_ENTERED":
      return event.type === "LOCATION_ENTERED" && event.locationId === trigger.locationId;
    case "ITEM_ACQUIRED":
      return event.type === "ITEM_ACQUIRED" && event.itemId === trigger.itemId;
    case "CONCEPT_DEMONSTRATED":
      return event.type === "CONCEPT_DEMONSTRATED" && event.conceptId === trigger.conceptId;
    case "INTENT_COMMUNICATED":
      return event.type === "INTENT_COMMUNICATED" && event.intentId === trigger.intentId;
    case "QUEST_COMPLETED":
      return event.type === "QUEST_COMPLETED" && event.questId === trigger.questId;
  }
}

function setProgress(save: GameSave, questId: string, progress: QuestProgress): GameSave {
  return { ...save, questProgress: { ...save.questProgress, [questId]: progress } };
}

/** The required objective the player is on, or undefined when none remain or the quest is not active. */
export function currentObjective(quest: Quest, save: GameSave): QuestObjective | undefined {
  const progress = save.questProgress[quest.id];
  if (progress?.status !== "active") return undefined;
  return quest.objectives.find((objective) => !objective.optional && !progress.completedObjectiveIds.includes(objective.id));
}

/** Locked quests open once their prerequisites are done; quests without a start step begin at once. */
function unlockQuests(save: GameSave, quests: Quest[]): GameSave {
  let next = save;
  for (const quest of quests) {
    const progress = next.questProgress[quest.id];
    if (!progress) continue;
    let status = progress.status;
    if (status === "locked" && quest.prerequisites.every((id) => next.questProgress[id]?.status === "completed")) status = "available";
    if (status === "available" && !quest.start) status = "active";
    if (status !== progress.status) next = setProgress(next, quest.id, { ...progress, status });
  }
  return next;
}

function grantRewards(save: GameSave, rewards: Reward[], raised: GameEvent[]): GameSave {
  let next = save;
  for (const reward of rewards) {
    if (reward.type === "XP") {
      next = { ...next, player: { ...next.player, xp: next.player.xp + reward.amount } };
    } else {
      const quantity = reward.quantity ?? 1;
      next = { ...next, inventory: { ...next.inventory, [reward.itemId]: (next.inventory[reward.itemId] ?? 0) + quantity } };
      raised.push({ type: "ITEM_ACQUIRED", itemId: reward.itemId });
    }
  }
  return next;
}

function advanceQuest(save: GameSave, quest: Quest, event: GameEvent, raised: GameEvent[]): GameSave {
  const progress = save.questProgress[quest.id];
  if (!progress) return save;

  if (progress.status === "available") {
    return quest.start && triggerMatches(quest.start.trigger, event)
      ? setProgress(save, quest.id, { ...progress, status: "active" })
      : save;
  }
  if (progress.status !== "active") return save;

  // One event moves the current required objective at most one step, plus any open optional ones.
  const current = currentObjective(quest, save);
  const candidates = quest.objectives.filter((objective) => (
    !progress.completedObjectiveIds.includes(objective.id) && (objective.optional || objective.id === current?.id)
  ));
  const completedObjectiveIds = [...progress.completedObjectiveIds];
  const objectiveCounts = { ...progress.objectiveCounts };
  let changed = false;
  for (const objective of candidates) {
    if (!triggerMatches(objective.trigger, event)) continue;
    if (objective.requires?.locationId && objective.requires.locationId !== save.player.locationId) continue;
    changed = true;
    const count = (objectiveCounts[objective.id] ?? 0) + 1;
    objectiveCounts[objective.id] = count;
    if (count >= (objective.count ?? 1)) completedObjectiveIds.push(objective.id);
  }
  if (!changed) return save;

  const completed = quest.objectives.every((objective) => objective.optional || completedObjectiveIds.includes(objective.id));
  let next = setProgress(save, quest.id, { status: completed ? "completed" : "active", completedObjectiveIds, objectiveCounts });
  if (completed) {
    // Rewards are granted exactly once, at the transition into `completed`.
    next = grantRewards(next, quest.rewards, raised);
    raised.push({ type: "QUEST_COMPLETED", questId: quest.id });
  }
  return next;
}

/**
 * The single place quest state changes. Pure and idempotent: replaying an event
 * cannot grant a reward twice. Events raised by the engine (quest completed, item
 * acquired) are processed in the same call, so chains settle before it returns.
 */
export function applyGameEvent(save: GameSave, quests: Quest[], event: GameEvent): GameSave {
  let next = save;
  const queue: GameEvent[] = [event];

  for (let step = 0; queue.length > 0 && step < MAX_CASCADE; step++) {
    const current = queue.shift()!;
    const before = next.questProgress;

    if (current.type === "DIALOGUE_COMPLETED" && !next.completedDialogueIds.includes(current.dialogueId)) {
      next = { ...next, completedDialogueIds: [...next.completedDialogueIds, current.dialogueId] };
    }
    for (const quest of quests) next = advanceQuest(next, quest, current, queue);
    next = unlockQuests(next, quests);

    // A newly current objective may ask for the place the player is already standing in.
    const here = next.player.locationId;
    const alreadyQueued = queue.some((item) => item.type === "LOCATION_ENTERED" && item.locationId === here);
    if (next.questProgress !== before && !alreadyQueued) queue.push({ type: "LOCATION_ENTERED", locationId: here });
  }
  return next;
}

export type ObjectiveState = "completed" | "current" | "upcoming";

export interface QuestLogEntry {
  quest: Quest;
  status: "available" | "active" | "completed";
  objectives: Array<{ objective: QuestObjective; state: ObjectiveState; count: number; target: number }>;
}

/** Everything the quest log shows, in content order. Locked quests are left out. */
export function questLog(save: GameSave, quests: Quest[]): QuestLogEntry[] {
  const entries: QuestLogEntry[] = [];
  for (const quest of quests) {
    const progress = save.questProgress[quest.id];
    if (!progress || progress.status === "locked") continue;
    const current = currentObjective(quest, save);
    entries.push({
      quest,
      status: progress.status,
      objectives: quest.objectives.map((objective) => ({
        objective,
        state: progress.completedObjectiveIds.includes(objective.id)
          ? "completed"
          : objective.id === current?.id || (objective.optional && progress.status === "active") ? "current" : "upcoming",
        count: progress.objectiveCounts[objective.id] ?? 0,
        target: objective.count ?? 1
      }))
    });
  }
  return entries;
}

export interface QuestGuidance {
  quest: Quest;
  /** The one line worth showing on the HUD right now. */
  text: string;
  kind: "objective" | "start";
}

/** The most immediately useful thing to do: the first active quest's objective, else how to start the next one. */
export function questGuidance(save: GameSave, quests: Quest[]): QuestGuidance | undefined {
  for (const quest of quests) {
    const objective = currentObjective(quest, save);
    if (objective) return { quest, text: objective.description, kind: "objective" };
  }
  for (const quest of quests) {
    if (save.questProgress[quest.id]?.status === "available" && quest.start) {
      return { quest, text: quest.start.description, kind: "start" };
    }
  }
  return undefined;
}
