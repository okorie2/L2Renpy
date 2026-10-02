import type { GameSave, Location, NPC, Quest, QuestObjective } from "../core/models";
import { currentObjective } from "../core/quests";

/** The characters the player has finished at least one conversation with, in content order. */
export function metCharacters(save: GameSave, npcs: NPC[]): NPC[] {
  return npcs.filter((npc) => npc.dialogues.some((rule) => save.completedDialogueIds.includes(rule.dialogueId)));
}

/** Where an objective takes place, when that can be told from its definition. */
export function objectiveLocationId(objective: QuestObjective, npcs: NPC[]): string | undefined {
  if (objective.requires?.locationId) return objective.requires.locationId;
  const trigger = objective.trigger;
  if (trigger.type === "LOCATION_ENTERED") return trigger.locationId;
  if (trigger.type === "NPC_TALKED") return npcs.find((npc) => npc.id === trigger.npcId)?.locationId;
  if (trigger.type === "DIALOGUE_COMPLETED" || trigger.type === "DIALOGUE_LINE_COMPLETED") {
    return npcs.find((npc) => npc.dialogues.some((rule) => rule.dialogueId === trigger.dialogueId))?.locationId;
  }
  return undefined;
}

export interface MapPlace {
  location: Location;
  visited: boolean;
  here: boolean;
  /** The current objective of an active quest happens here. */
  objective?: string;
  /** Characters the player has met who are found here. */
  people: NPC[];
}

/** What the map shows: every place in the chapter, with only visited ones named. */
export function mapPlaces(save: GameSave, locations: Location[], npcs: NPC[], quests: Quest[]): MapPlace[] {
  const met = metCharacters(save, npcs);
  const objectives = quests.flatMap((quest) => {
    const objective = currentObjective(quest, save);
    const locationId = objective && objectiveLocationId(objective, npcs);
    return objective && locationId ? [{ locationId, description: objective.description }] : [];
  });
  return locations.map((location) => ({
    location,
    visited: save.visitedLocationIds.includes(location.id),
    here: save.player.locationId === location.id,
    objective: objectives.find((item) => item.locationId === location.id)?.description,
    people: met.filter((npc) => npc.locationId === location.id)
  }));
}
