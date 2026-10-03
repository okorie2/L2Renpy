import assert from "node:assert/strict";
import test from "node:test";
import type { DialogueSession, DialogueStep } from "../src/dialogue/engine";
import {
  afterLiveStep, afterReplayStep, canGoBack, canGoForward, currentCard, goBack, goForward, isReplaying, startTrail, TRAIL_LIMIT, type Trail
} from "../src/dialogue/trail";

const card = (nodeId: string, extra: Partial<DialogueSession> = {}): DialogueSession => ({
  dialogueId: "meet", nodeId, status: "active", failedAttempts: {}, history: [], ...extra
});
const step = (session: DialogueSession, result: DialogueStep["result"] = "advanced"): DialogueStep => ({ session, result, save: {} as DialogueStep["save"] });
const walk = (...ids: string[]): Trail => ids.slice(1).reduce((trail, id) => afterLiveStep(trail, step(card(id))), startTrail(card(ids[0])));
const on = (trail: Trail) => currentCard(trail).nodeId;

test("back and forward move through the cards reached, never past the furthest", () => {
  let trail = walk("hello", "name", "level");
  assert.equal(on(trail), "level");
  assert.equal(canGoForward(trail), false, "nothing new can be skipped");
  assert.equal(isReplaying(trail), false);

  trail = goBack(goBack(trail));
  assert.equal(on(trail), "hello");
  assert.equal(canGoBack(trail), false);
  assert.equal(goBack(trail), trail, "nothing before the first card");
  assert.equal(isReplaying(trail), true);

  trail = goForward(goForward(trail));
  assert.equal(on(trail), "level");
  assert.equal(goForward(trail), trail);
  assert.equal(isReplaying(trail), false);
});

test("a replayed card moves on to the card that came next the first time", () => {
  let trail = goBack(goBack(walk("hello", "name", "level")));
  trail = afterReplayStep(trail, step(card("name")));
  assert.equal(on(trail), "name");
  assert.equal(trail.cards.length, 3, "the trail is as it was");
  // Even if the replayed answer would have gone another way, the replay follows the first time.
  trail = afterReplayStep(trail, step(card("somewhere-else")));
  assert.equal(on(trail), "level");
  assert.equal(isReplaying(trail), false);
});

test("a miss during a replay gets its repair line, then the question again, then moves on", () => {
  let trail = goBack(walk("question", "after"));
  trail = afterReplayStep(trail, step(card("repair", { returnNodeId: "question" }), "repair"));
  assert.equal(on(trail), "repair");
  assert.equal(canGoBack(trail), true, "back from the repair line is the question");
  assert.equal(on(goBack(trail)), "question");

  trail = afterReplayStep(trail, step(card("question", { failedAttempts: { question: 1 } })));
  assert.equal(on(trail), "question");
  assert.equal(currentCard(trail).failedAttempts.question, 1, "the miss counts within the replay");
  trail = afterReplayStep(trail, step(card("after")));
  assert.equal(on(trail), "after");
  assert.equal(trail.detour, undefined);
});

test("the first time's misses are passed over when a replayed question is answered", () => {
  let trail = walk("question", "repair", "question", "after", "end");
  trail.cards[1] = card("repair", { returnNodeId: "question" });
  trail = { cards: trail.cards, at: 0 };
  trail = afterReplayStep(trail, step(card("after")));
  assert.equal(on(trail), "after");

  // Still at the question the first time round: the replay ends there, to be answered for real.
  let live = walk("question", "repair", "question");
  live.cards[1] = card("repair", { returnNodeId: "question" });
  live = afterReplayStep({ cards: live.cards, at: 0 }, step(card("after")));
  assert.equal(live.at, 2);
  assert.equal(isReplaying(live), false);
});

test("an answer that is not taken changes nothing, and the trail keeps a limit", () => {
  const trail = goBack(walk("a", "b"));
  assert.equal(afterReplayStep(trail, step(card("a"), "ignored")), trail);
  let long = startTrail(card("0"));
  for (let index = 1; index < TRAIL_LIMIT + 10; index++) long = afterLiveStep(long, step(card(String(index))));
  assert.equal(long.cards.length, TRAIL_LIMIT);
  assert.equal(long.at, TRAIL_LIMIT - 1);
});
