import { CHARACTER_EXPRESSIONS } from "../characters/types";
import { assessUtterance } from "../learning/assessment";
import type { ConversationIntent } from "../learning/models";
import { PLAYER_SPEAKER_ID, type Dialogue } from "./models";
import { resolveTemplate, templateSlots } from "./template";

export interface DialogueReferences {
  speakerIds: string[];
  /** Slot name to a sample target-language value, used to check assessed lines. */
  slotSamples: Record<string, string>;
  intents: Record<string, ConversationIntent>;
  itemIds: string[];
}

/** Content checks that types cannot express. Returns human-readable problems. */
export function validateDialogue(dialogue: Dialogue, references: DialogueReferences): string[] {
  const problems: string[] = [];
  const at = (nodeId: string) => `${dialogue.id}.${nodeId}`;
  const slotNames = Object.keys(references.slotSamples);
  const hasNode = (id: string | undefined) => id !== undefined && dialogue.nodes[id] !== undefined;
  if (!hasNode(dialogue.startNodeId)) problems.push(`${dialogue.id}: start node "${dialogue.startNodeId}" is missing`);

  for (const [key, node] of Object.entries(dialogue.nodes)) {
    if (node.id !== key) problems.push(`${at(key)}: node id "${node.id}" does not match its key`);
    if (!references.speakerIds.includes(node.speakerId)) problems.push(`${at(key)}: unknown speaker "${node.speakerId}"`);
    if (node.nextNodeId && !hasNode(node.nextNodeId)) problems.push(`${at(key)}: next node "${node.nextNodeId}" is missing`);
    for (const branch of node.branches ?? []) {
      if (!hasNode(branch.nextNodeId)) problems.push(`${at(key)}: branch target "${branch.nextNodeId}" is missing`);
    }
    for (const effect of node.effects ?? []) {
      if (!references.itemIds.includes(effect.itemId)) problems.push(`${at(key)}: unknown item "${effect.itemId}"`);
    }

    const targetSlots = templateSlots(node.targetText);
    for (const slot of [...targetSlots, ...templateSlots(node.translation ?? "")]) {
      if (!slotNames.includes(slot)) problems.push(`${at(key)}: undefined slot "{${slot}}"`);
    }
    for (const slot of node.assessment?.excludedSpans ?? []) {
      if (!targetSlots.includes(slot)) problems.push(`${at(key)}: excluded span "${slot}" is not in the target text`);
    }

    const alongside = node.presentation?.street?.with;
    if (alongside && !references.speakerIds.includes(alongside)) problems.push(`${at(key)}: unknown person "${alongside}"`);
    const onStreet = [...(node.presentation?.street?.people ?? []), ...(node.interlude?.segments ?? []).flatMap((segment) => segment.people ?? [])];
    for (const person of onStreet) {
      if (!references.speakerIds.includes(person.id)) problems.push(`${at(key)}: unknown person "${person.id}" on the street`);
    }

    const focus = node.presentation?.focus;
    if (focus && !references.speakerIds.includes(focus)) problems.push(`${at(key)}: unknown focus "${focus}"`);

    const expression = node.presentation?.expression;
    if (expression && !CHARACTER_EXPRESSIONS.includes(expression)) problems.push(`${at(key)}: unknown expression "${expression}"`);

    if (node.language === "interface" && node.translation) problems.push(`${at(key)}: a line in the learner's language has no translation`);

    if (node.interlude) {
      if (!node.interlude.segments.length) problems.push(`${at(key)}: a walk needs at least one stretch`);
      if (node.response || node.targetText) problems.push(`${at(key)}: a walk has no words and asks for nothing`);
    }

    const response = node.response;
    if (!response) continue;
    if (response.kind === "choice") {
      if (response.options.length < 2) problems.push(`${at(key)}: a choice needs at least two options`);
      for (const option of response.options) {
        if (option.nextNodeId && !hasNode(option.nextNodeId)) problems.push(`${at(key)}: option target "${option.nextNodeId}" is missing`);
      }
    }
    if (response.kind === "say" && response.question?.speakerId && !references.speakerIds.includes(response.question.speakerId)) {
      problems.push(`${at(key)}: unknown asker "${response.question.speakerId}"`);
    }
    if ((response.kind === "say" || response.kind === "act") && response.repairNodeId && !hasNode(response.repairNodeId)) {
      problems.push(`${at(key)}: repair node "${response.repairNodeId}" is missing`);
    }
    if (response.kind === "practice") {
      if (!response.lines.length) problems.push(`${at(key)}: practice needs at least one line`);
      for (const line of response.lines) {
        for (const slot of [...templateSlots(line.text), ...templateSlots(line.translation ?? "")]) {
          if (!slotNames.includes(slot)) problems.push(`${at(key)}: undefined slot "{${slot}}" in practice`);
        }
      }
    }
    if (response.kind === "act" && response.options.filter((option) => option.correct).length !== 1) {
      problems.push(`${at(key)}: an action needs exactly one correct option`);
    }
    if (response.kind === "say") {
      const intent = references.intents[response.intentId];
      if (node.speakerId !== PLAYER_SPEAKER_ID) problems.push(`${at(key)}: only the player can have a "say" response`);
      if (!intent) {
        problems.push(`${at(key)}: unknown intent "${response.intentId}"`);
        continue;
      }
      // The model answer must itself pass assessment, and at least one suggestion must fit.
      const fits = (template: string) => assessUtterance(resolveTemplate(template, references.slotSamples).text, intent).communicated;
      if (!fits(node.targetText)) problems.push(`${at(key)}: the model answer does not communicate "${intent.id}"`);
      if (response.options && !response.options.some((option) => fits(option.text))) {
        problems.push(`${at(key)}: no suggestion communicates "${intent.id}"`);
      }
    }
  }
  return problems;
}
