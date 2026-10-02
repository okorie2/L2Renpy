import type { GameSave } from "../core/models";
import { updatePlayerProfile } from "../core/player";
import { initialSupportLevel } from "../learning/support";
import type { DialogueResponse } from "./models";

/**
 * Store a profile answer (`text` or `choice` responses). The node's data says where
 * the answer goes; core validates it. Other response kinds are assessed by the
 * dialogue engine and never pass through here.
 */
export function applyDialogueResponse(save: GameSave, response: DialogueResponse, value: string): GameSave {
  if (response.kind !== "text" && response.kind !== "choice") return save;

  const next = updatePlayerProfile(save, response.saveTo, value);
  if (next === save || response.saveTo !== "targetLanguageExperience") return next;

  // Self-report seeds support once; observed behaviour is never overwritten by it.
  if (next.learningSupport.basis === "observed") return next;
  return {
    ...next,
    learningSupport: { level: initialSupportLevel(next.player.profile.targetLanguageExperience), basis: "self-reported" }
  };
}
