import { conditionHolds } from "../core/conditions";
import type { GameSave } from "../core/models";
import { applyGameEvent } from "../core/quests";
import type { DialogueContext, DialogueSession, DialogueStep, HistoryLine } from "./engine";
import { sessionLine } from "./engine";
import { PLAYER_SPEAKER_ID, type Dialogue } from "./models";
import { applyDialogueResponse } from "./responses";
import { buildSlotValues } from "./template";

/** What a skipped question about the player fills in, when nothing was given before. */
export const SKIP_DEFAULTS = { displayName: "Alex", age: "25" };

/**
 * For building only: move past the current line without answering it. Nothing is
 * recorded as learning (no evidence, no readiness change); story progress still
 * moves, so quests and the next scene follow as they would. A question about the
 * player keeps what they said before, or takes a placeholder, so later lines that
 * use it still read properly.
 */
export function skipLine(session: DialogueSession, dialogue: Dialogue, save: GameSave, context: Pick<DialogueContext, "quests" | "slots">): DialogueStep {
  const node = dialogue.nodes[session.nodeId];
  if (session.status !== "active" || !node) return { session, save, result: "ignored" };
  let next = save;
  let override: string | undefined;
  const response = node.response;
  if (response?.kind === "text") {
    const known = response.saveTo === "age" ? save.player.profile.age : save.player.profile.displayName;
    next = applyDialogueResponse(next, response, known === undefined || known === "" ? SKIP_DEFAULTS[response.saveTo] : String(known));
  } else if (response?.kind === "choice" && response.options[0]) {
    next = applyDialogueResponse(next, response, response.options[0].value);
    override = response.options[0].nextNodeId;
  }

  const line = sessionLine(session, node, buildSlotValues(context.slots, next.player.profile));
  const history: HistoryLine[] = [
    ...session.history,
    node.speakerId === PLAYER_SPEAKER_ID
      ? { nodeId: node.id, speakerId: PLAYER_SPEAKER_ID, text: line.target.text }
      : { nodeId: node.id, speakerId: node.speakerId, text: line.target.text, translation: line.translation?.text }
  ];
  next = applyGameEvent(next, context.quests, { type: "DIALOGUE_LINE_COMPLETED", dialogueId: dialogue.id, nodeId: node.id, npcId: session.npcId });

  const branch = node.branches?.find((item) => item.when.every((condition) => conditionHolds(condition, next, context.quests)));
  const target = override ?? branch?.nextNodeId ?? node.nextNodeId ?? session.returnNodeId;
  if (target && dialogue.nodes[target]) {
    return {
      save: next,
      result: "advanced",
      session: { ...session, nodeId: target, returnNodeId: target === session.returnNodeId ? undefined : session.returnNodeId, lineOverride: undefined, history }
    };
  }
  next = applyGameEvent(next, context.quests, { type: "DIALOGUE_COMPLETED", dialogueId: dialogue.id, npcId: session.npcId });
  return { save: next, result: "completed", session: { ...session, status: "completed", returnNodeId: undefined, lineOverride: undefined, history } };
}
