import type { Condition, GameSave, NPC, Quest } from "./models";
import { currentObjective } from "./quests";

export function conditionHolds(condition: Condition, save: GameSave, quests: Quest[]): boolean {
  switch (condition.type) {
    case "QUEST_STATUS":
      return save.questProgress[condition.questId]?.status === condition.status;
    case "OBJECTIVE_CURRENT": {
      const quest = quests.find((item) => item.id === condition.questId);
      return quest !== undefined && currentObjective(quest, save)?.id === condition.objectiveId;
    }
    case "DIALOGUE_COMPLETED":
      return save.completedDialogueIds.includes(condition.dialogueId);
    case "PROFILE_EQUALS":
      return save.player.profile[condition.field] === condition.value;
    case "HAS_ITEM":
      return (save.inventory[condition.itemId] ?? 0) > 0;
  }
}

/**
 * What an NPC says is decided by game state, not by the UI: the first rule whose
 * conditions hold wins. Returns undefined only if content has no unconditional rule.
 */
export function selectNpcDialogueId(npc: NPC, save: GameSave, quests: Quest[]): string | undefined {
  return npc.dialogues.find((rule) => (rule.when ?? []).every((condition) => conditionHolds(condition, save, quests)))?.dialogueId;
}
