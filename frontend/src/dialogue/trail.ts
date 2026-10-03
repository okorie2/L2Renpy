import type { DialogueSession, DialogueStep } from "./engine";

/**
 * Every card reached in a conversation, in order, and where the learner is
 * among them. The learner can go back to any card and move forward again up to
 * the furthest one reached, never beyond: nothing new can be skipped.
 *
 * Behind the furthest card the conversation is a replay. A replayed card plays
 * as it did, and anything answered there is practice: it is checked, and a miss
 * still gets its repair line, but nothing is recorded and the saved answers
 * stay as they were. Moving on from a replayed card goes to the card that came
 * next the first time.
 */
export interface Trail {
  cards: DialogueSession[];
  /** Index of the card on screen. */
  at: number;
  /** During a replay: a repair line, or the question it returned to, shown in place of `cards[at]`. */
  detour?: DialogueSession;
}

/** The most cards kept. The oldest are dropped first. */
export const TRAIL_LIMIT = 60;

export function startTrail(session: DialogueSession): Trail {
  return { cards: [session], at: 0 };
}

/** The card on screen. */
export function currentCard(trail: Trail): DialogueSession {
  return trail.detour ?? trail.cards[trail.at];
}

/** Behind the furthest card reached: answers are practice and nothing is recorded. */
export function isReplaying(trail: Trail): boolean {
  return trail.at < trail.cards.length - 1;
}

export function canGoBack(trail: Trail): boolean {
  return trail.at > 0 || Boolean(trail.detour);
}

export function canGoForward(trail: Trail): boolean {
  return isReplaying(trail);
}

/** Back one card. From a repair line met during a replay, back to its question. */
export function goBack(trail: Trail): Trail {
  if (trail.detour) return { cards: trail.cards, at: trail.at };
  return trail.at > 0 ? { cards: trail.cards, at: trail.at - 1 } : trail;
}

/** Forward one card, as far as the furthest reached. */
export function goForward(trail: Trail): Trail {
  return canGoForward(trail) ? { cards: trail.cards, at: trail.at + 1 } : trail;
}

/** After a step at the furthest card: the conversation really moved, so the new card joins the trail. */
export function afterLiveStep(trail: Trail, step: DialogueStep): Trail {
  if (step.result === "ignored" || step.session.status !== "active") return trail;
  const cards = [...trail.cards, step.session].slice(-TRAIL_LIMIT);
  return { cards, at: cards.length - 1 };
}

/** After a step on a replayed card. Only the card on screen changes; the trail is as it was. */
export function afterReplayStep(trail: Trail, step: DialogueStep): Trail {
  if (step.result === "ignored") return trail;
  const card = trail.cards[trail.at];
  // A miss, or a repair line handing back to the question: stay with this card.
  if (step.result === "repair" || step.session.nodeId === card.nodeId) return { ...trail, detour: step.session };
  // Moved on. Pass over the first time's misses at this card, then the next card.
  let index = trail.at;
  while (index + 1 < trail.cards.length - 1 && belongsTo(trail.cards[index + 1], card.nodeId)) index++;
  return { cards: trail.cards, at: Math.min(index + 1, trail.cards.length - 1) };
}

/** The question itself again, or a repair line that returns to it. */
const belongsTo = (session: DialogueSession, nodeId: string) => session.nodeId === nodeId || session.returnNodeId === nodeId;
