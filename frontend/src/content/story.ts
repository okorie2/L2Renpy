import type { GameSave } from "../core/models";
import type { LanguagePack } from "../languages/types";
import type { LanguageConceptId } from "../learning/models";

/**
 * The story as the learner can revisit it: goals, each told in parts. A part is a
 * dialogue that plays from its start; a part not built yet is listed as coming soon.
 */
export interface StoryPart {
  id: string;
  title: string;
  /** The dialogue that tells it; none while it is still to be made. */
  dialogueId?: string;
}

export interface StoryGoal {
  id: string;
  title: string;
  parts: StoryPart[];
}

export const STORY: StoryGoal[] = [
  {
    id: "goal1",
    title: "Goal 1",
    parts: [
      { id: "goal1-part1", title: "Meeting Sophie", dialogueId: "meetSophie" },
      { id: "goal1-part2", title: "The walk to the café", dialogueId: "walkToCafe" },
      { id: "goal1-part3", title: "At the café" }
    ]
  }
];

export type PartState = "done" | "current" | "locked" | "coming-soon";

/**
 * Where the learner is with each part: finished, the one they're on, not reached
 * yet, or not made yet. Parts play in order, so the first unfinished one is current.
 */
export function partStates(save: Pick<GameSave, "completedDialogueIds">, goal: StoryGoal): PartState[] {
  let reachedNext = true;
  return goal.parts.map((part) => {
    if (!part.dialogueId) return "coming-soon";
    if (save.completedDialogueIds.includes(part.dialogueId)) return "done";
    if (reachedNext) {
      reachedNext = false;
      return "current";
    }
    return "locked";
  });
}

/** The concepts a goal asks the learner to use: those its answers are judged on. */
export function goalConcepts(pack: Pick<LanguagePack, "dialogues" | "intents">, goal: StoryGoal): LanguageConceptId[] {
  const concepts = new Set<LanguageConceptId>();
  for (const part of goal.parts) {
    const dialogue = part.dialogueId ? pack.dialogues[part.dialogueId] : undefined;
    for (const node of Object.values(dialogue?.nodes ?? {})) {
      const intent = node.response?.kind === "say" ? pack.intents[node.response.intentId] : undefined;
      if (intent) concepts.add(intent.conceptId);
    }
  }
  return [...concepts];
}
