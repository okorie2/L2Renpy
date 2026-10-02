import { conditionHolds } from "../core/conditions";
import type { GameSave, MessageThread, MessageThreadState, Quest } from "../core/models";
import { startDialogue, type DialogueSession } from "../dialogue/engine";
import type { Dialogue } from "../dialogue/models";

/**
 * Hand over every thread whose moment has come. A thread arrives once and stays;
 * later changes to the conditions that brought it do not take it away.
 */
export function deliverMessages(save: GameSave, threads: MessageThread[], dialogues: Record<string, Dialogue>, quests: Quest[], now: string): GameSave {
  let messages = save.messages;
  for (const thread of threads) {
    const dialogue = dialogues[thread.dialogueId];
    if (messages[thread.id] || !dialogue) continue;
    if (!thread.when.every((condition) => conditionHolds(condition, save, quests))) continue;
    messages = { ...messages, [thread.id]: { receivedAt: now, unread: true, session: startDialogue(dialogue, thread.contactId) } };
  }
  return messages === save.messages ? save : { ...save, messages };
}

export function unreadThreadIds(save: GameSave): string[] {
  return Object.entries(save.messages).filter(([, state]) => state.unread).map(([id]) => id);
}

/** The player has the thread open and has seen what is in it. */
export function markThreadRead(save: GameSave, threadId: string): GameSave {
  const state = save.messages[threadId];
  if (!state?.unread) return save;
  return { ...save, messages: { ...save.messages, [threadId]: { ...state, unread: false } } };
}

/** Store where a thread's exchange has got to, on top of whatever else that step changed. */
export function saveThreadSession(save: GameSave, threadId: string, session: DialogueSession, options: { unread?: boolean } = {}): GameSave {
  const state: MessageThreadState | undefined = save.messages[threadId];
  if (!state) return save;
  return { ...save, messages: { ...save.messages, [threadId]: { ...state, session, unread: options.unread ?? state.unread } } };
}

/** The player's turn, or more to read: the thread wants attention. */
export function threadAwaitsPlayer(state: MessageThreadState): boolean {
  return state.session.status === "active";
}
