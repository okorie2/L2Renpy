import type { Condition, Item, Location, NPC, ObjectiveTrigger, Quest } from "./models";

export interface QuestReferences {
  locations: Location[];
  npcs: NPC[];
  items: Item[];
  /** Node IDs by dialogue ID, from the language pack. */
  dialogueNodes: Record<string, string[]>;
  intentIds: string[];
  conceptIds: string[];
}

/** Content checks for the quest chain and NPC dialogue rules. Returns human-readable problems. */
export function validateQuestContent(quests: Quest[], references: QuestReferences): string[] {
  const problems: string[] = [];
  const questIds = quests.map((quest) => quest.id);

  const checkTrigger = (where: string, trigger: ObjectiveTrigger) => {
    switch (trigger.type) {
      case "DIALOGUE_COMPLETED":
        if (!references.dialogueNodes[trigger.dialogueId]) problems.push(`${where}: unknown dialogue "${trigger.dialogueId}"`);
        break;
      case "DIALOGUE_LINE_COMPLETED":
        if (!references.dialogueNodes[trigger.dialogueId]?.includes(trigger.nodeId)) {
          problems.push(`${where}: unknown line "${trigger.dialogueId}.${trigger.nodeId}"`);
        }
        break;
      case "NPC_TALKED":
        if (!references.npcs.some((npc) => npc.id === trigger.npcId)) problems.push(`${where}: unknown NPC "${trigger.npcId}"`);
        break;
      case "LOCATION_ENTERED":
        if (!references.locations.some((location) => location.id === trigger.locationId)) problems.push(`${where}: unknown location "${trigger.locationId}"`);
        break;
      case "ITEM_ACQUIRED":
        if (!references.items.some((item) => item.id === trigger.itemId)) problems.push(`${where}: unknown item "${trigger.itemId}"`);
        break;
      case "CONCEPT_DEMONSTRATED":
        if (!references.conceptIds.includes(trigger.conceptId)) problems.push(`${where}: unknown concept "${trigger.conceptId}"`);
        break;
      case "INTENT_COMMUNICATED":
        if (!references.intentIds.includes(trigger.intentId)) problems.push(`${where}: unknown intent "${trigger.intentId}"`);
        break;
      case "QUEST_COMPLETED":
        if (!questIds.includes(trigger.questId)) problems.push(`${where}: unknown quest "${trigger.questId}"`);
        break;
    }
  };

  const checkCondition = (where: string, condition: Condition) => {
    if (condition.type === "DIALOGUE_COMPLETED") {
      if (!references.dialogueNodes[condition.dialogueId]) problems.push(`${where}: unknown dialogue "${condition.dialogueId}"`);
      return;
    }
    if (condition.type === "PROFILE_EQUALS") return;
    if (condition.type === "HAS_ITEM") {
      if (!references.items.some((item) => item.id === condition.itemId)) problems.push(`${where}: unknown item "${condition.itemId}"`);
      return;
    }
    const quest = quests.find((item) => item.id === condition.questId);
    if (!quest) problems.push(`${where}: unknown quest "${condition.questId}"`);
    else if (condition.type === "OBJECTIVE_CURRENT" && !quest.objectives.some((objective) => objective.id === condition.objectiveId)) {
      problems.push(`${where}: unknown objective "${condition.questId}.${condition.objectiveId}"`);
    }
  };

  if (new Set(questIds).size !== questIds.length) problems.push("quest IDs are not unique");
  quests.forEach((quest, index) => {
    for (const prerequisite of quest.prerequisites) {
      // Prerequisites must come earlier, which also rules out cycles.
      if (!questIds.slice(0, index).includes(prerequisite)) problems.push(`${quest.id}: prerequisite "${prerequisite}" is not an earlier quest`);
    }
    if (quest.start) checkTrigger(`${quest.id}.start`, quest.start.trigger);
    if (!quest.objectives.some((objective) => !objective.optional)) problems.push(`${quest.id}: needs at least one required objective`);
    const objectiveIds = quest.objectives.map((objective) => objective.id);
    if (new Set(objectiveIds).size !== objectiveIds.length) problems.push(`${quest.id}: objective IDs are not unique`);
    for (const objective of quest.objectives) {
      const where = `${quest.id}.${objective.id}`;
      checkTrigger(where, objective.trigger);
      if (objective.count !== undefined && objective.count < 1) problems.push(`${where}: count must be at least 1`);
      const required = objective.requires?.locationId;
      if (required && !references.locations.some((location) => location.id === required)) problems.push(`${where}: unknown location "${required}"`);
    }
    for (const reward of quest.rewards) {
      if (reward.type === "ITEM" && !references.items.some((item) => item.id === reward.itemId)) {
        problems.push(`${quest.id}: unknown reward item "${reward.itemId}"`);
      }
    }
  });

  for (const npc of references.npcs) {
    if ((npc.dialogues.at(-1)?.when ?? []).length > 0) problems.push(`${npc.id}: the last dialogue rule must be unconditional`);
    if (npc.dialogues.length === 0) problems.push(`${npc.id}: has no dialogue`);
    for (const rule of npc.dialogues) {
      if (!references.dialogueNodes[rule.dialogueId]) problems.push(`${npc.id}: unknown dialogue "${rule.dialogueId}"`);
      for (const condition of rule.when ?? []) checkCondition(`${npc.id} → ${rule.dialogueId}`, condition);
    }
  }
  return problems;
}
