import assert from "node:assert/strict";
import test from "node:test";
import { chapterOneLocations, chapterOneNpcs, chapterOneQuests, createStartingPlayer } from "../src/content/chapter1";
import { buildTurnContext } from "../src/conversation/context";
import { createHttpTurnJudge } from "../src/conversation/httpJudge";
import type { GameSave } from "../src/core/models";
import { createInitialSave } from "../src/core/quests";
import { sessionLine, startDialogue, stepDialogue, type DialogueInput, type DialogueSession } from "../src/dialogue/engine";
import { JUDGEMENT_CONFIDENCE_NEEDED, readJudgement, type UtteranceJudgement } from "../src/dialogue/judgement";
import { PLAYER_SPEAKER_ID } from "../src/dialogue/models";
import { french } from "../src/languages/fr";

const context = { quests: chapterOneQuests, intents: french.intents, slots: french.slots, vocabulary: french.vocabulary, now: "2026-10-02T10:00:00.000Z" };
const cafe = french.dialogues.cafeOrder;
const barista = chapterOneNpcs.find((npc) => npc.id === "barista")!;
const inCafe = (): GameSave => {
  const save = createInitialSave(createStartingPlayer("fr"), chapterOneQuests);
  return {
    ...save,
    player: { ...save.player, locationId: "cafe", profile: { displayName: "Samuel" } },
    questProgress: {
      ...save.questProgress,
      meetSophie: { ...save.questProgress.meetSophie, status: "completed" },
      cafe: { status: "active", completedObjectiveIds: ["enterCafe", "greetBarista"], objectiveCounts: {} }
    }
  };
};
const atOrder = (): DialogueSession => ({ ...startDialogue(cafe, "barista"), nodeId: "order" });
const say = (text: string, judgement?: UtteranceJudgement): DialogueInput => ({ type: "SAY", text, mode: "typed", assistance: [], judgement });
const next: DialogueInput = { type: "CONTINUE", assistance: [] };

test("a sure second opinion lets a valid wording through that the rules did not know", () => {
  const save = inCafe();
  const alone = stepDialogue(atOrder(), cafe, say("Je prends un petit noir"), save, context);
  assert.equal(alone.result, "repair", "the rules alone do not recognise it");

  const judged = stepDialogue(atOrder(), cafe, say("Je prends un petit noir", { intentId: "orderDrink", confidence: 0.9, rewording: "Je prends un petit noir, s'il vous plaît." }), save, context);
  assert.equal(judged.result, "advanced");
  assert.ok(judged.save.questProgress.cafe.completedObjectiveIds.includes("orderDrink"), "the quest moved through the usual event");
  const evidence = judged.save.evidenceLog.at(-1)!;
  assert.deepEqual([evidence.outcome, evidence.modality, evidence.confidence], ["successful", "writing", 0.9]);
  assert.deepEqual(judged.session.history.at(-1), {
    nodeId: "order", speakerId: PLAYER_SPEAKER_ID, text: "Je prends un petit noir", rewording: "Je prends un petit noir, s'il vous plaît.",
    said: { mode: "typed", communicated: true, attempt: 1, helped: false, usedWords: [] }
  });
});

test("the opinion is advice: only this line's intent, only when sure, and nothing else", () => {
  const save = inCafe();
  const refused: UtteranceJudgement[] = [
    { intentId: "orderDrink", confidence: JUDGEMENT_CONFIDENCE_NEEDED - 0.01 },
    { intentId: "thankPerson", confidence: 1 },
    { intentId: "orderPastry", confidence: 1 },
    { intentId: null, confidence: 1 }
  ];
  for (const judgement of refused) {
    const step = stepDialogue(atOrder(), cafe, say("Je prends un petit noir", judgement), save, context);
    assert.equal(step.result, "repair", JSON.stringify(judgement));
    assert.equal(step.save.questProgress.cafe.completedObjectiveIds.includes("orderDrink"), false);
    assert.equal(step.save.evidenceLog.at(-1)!.outcome, "unsuccessful");
  }

  // Whatever else arrives with an opinion, the save only changes through the engine's own rules.
  const greedy = { intentId: "orderDrink", confidence: 1, xp: 5000, items: ["croissant"], completeQuest: "goodbye" } as UtteranceJudgement;
  const plain = stepDialogue(atOrder(), cafe, say("Je prends un petit noir", { intentId: "orderDrink", confidence: 1 }), save, context);
  assert.deepEqual(stepDialogue(atOrder(), cafe, say("Je prends un petit noir", greedy), save, context).save, plain.save);

  // When the rules are certain, a contrary opinion changes nothing.
  const certain = stepDialogue(atOrder(), cafe, say("Un café, s'il vous plaît.", { intentId: null, confidence: 1, reply: { text: "Non." } }), save, context);
  assert.equal(certain.result, "advanced");
  assert.equal(certain.session.lineOverride, undefined);
});

test("on a miss the other speaker can react to what was said, then the scripted question returns", () => {
  const reply = { text: "Je vais bien, merci. Vous désirez un café ?", translation: "I'm well, thanks. Would you like a coffee?" };
  let step = stepDialogue(atOrder(), cafe, say("Comment allez-vous ?", { intentId: null, confidence: 0.9, reply }), inCafe(), context);
  assert.equal(step.result, "repair");
  const repairNode = cafe.nodes[step.session.nodeId];
  assert.notEqual(repairNode.id, "order");
  assert.deepEqual(step.session.lineOverride, { nodeId: repairNode.id, ...reply });
  assert.equal(sessionLine(step.session, repairNode, {}).target.text, reply.text);
  assert.equal(sessionLine(step.session, repairNode, {}).translation?.text, reply.translation);
  assert.equal(sessionLine(step.session, cafe.nodes.order, {}).target.text, cafe.nodes.order.targetText, "other lines keep their own words");

  step = stepDialogue(step.session, cafe, next, step.save, context);
  assert.equal(step.session.nodeId, "order", "the reaction is still the repair step: it hands back to the question");
  assert.equal(step.session.lineOverride, undefined);
  assert.deepEqual(step.session.history.at(-1), { nodeId: repairNode.id, speakerId: repairNode.speakerId, text: reply.text, translation: reply.translation });
  assert.equal(step.session.failedAttempts.order, 1, "it still counts as a miss, so help still arrives after repeated ones");

  // Without a reply the scripted repair line is used as before.
  const scripted = stepDialogue(atOrder(), cafe, say("Comment allez-vous ?", { intentId: null, confidence: 0.9 }), inCafe(), context);
  assert.equal(scripted.session.lineOverride, undefined);
  assert.equal(sessionLine(scripted.session, repairNode, {}).target.text, repairNode.targetText);
});

test("an opinion from outside is read strictly", () => {
  const offered = ["orderDrink"];
  for (const raw of [
    undefined, null, "yes", [], {}, { detectedIntent: "orderDrink" }, { detectedIntent: "orderDrink", confidence: "1" },
    { detectedIntent: "orderDrink", confidence: 1.5 }, { detectedIntent: "unlockAll", confidence: 1 }, { detectedIntent: 4, confidence: 1 }
  ]) assert.equal(readJudgement(raw, offered), undefined, JSON.stringify(raw));

  assert.deepEqual(
    readJudgement({ detectedIntent: "orderDrink", confidence: 0.8, correction: " Je voudrais  un café. ", npcResponse: { text: "Ignored" }, reward: 100 }, offered),
    { intentId: "orderDrink", confidence: 0.8, rewording: "Je voudrais un café." }
  );
  assert.deepEqual(
    readJudgement({ detectedIntent: null, confidence: 0.2, npcResponse: { text: "Pardon ?", translation: "Sorry?" }, correction: "x" }, offered),
    { intentId: null, confidence: 0.2, reply: { text: "Pardon ?", translation: "Sorry?" } }
  );
  for (const text of ["", "x".repeat(121), "Salut {playerName}", "<img src=x>", 7]) {
    assert.deepEqual(readJudgement({ detectedIntent: null, confidence: 0.2, npcResponse: { text } }, offered), { intentId: null, confidence: 0.2 });
  }
});

test("the scene sent for an opinion is small and leaves the learner's name out", () => {
  const save = { ...inCafe(), vocabularyMastery: { "fr.bonjour": { vocabularyId: "fr.bonjour", byModality: {} } } };
  const session: DialogueSession = {
    ...atOrder(),
    failedAttempts: { order: 1 },
    history: Array.from({ length: 9 }, (_, index) => ({ nodeId: `n${index}`, speakerId: index % 2 ? PLAYER_SPEAKER_ID : "barista", text: `line ${index}` }))
  };
  const sent = buildTurnContext({
    languageCode: "fr", level: "A1", npc: barista, location: chapterOneLocations.find((item) => item.id === "cafe"), quests: chapterOneQuests,
    save, session, intent: french.intents.orderDrink, vocabulary: french.vocabulary, utterance: "  Un thé  "
  });
  assert.deepEqual(sent.npc, { name: "Nadia", ...barista.persona });
  assert.equal(sent.npc.register, "formal");
  assert.equal(sent.recentLines.length, 6);
  assert.deepEqual(sent.recentLines.at(-1), { speaker: "npc", text: "line 8" });
  assert.deepEqual(sent.intents, [{ id: "orderDrink", description: french.intents.orderDrink.meaning, examples: french.intents.orderDrink.acceptedExpressions }]);
  assert.deepEqual(sent.knownVocabulary, ["bonjour"]);
  assert.deepEqual([sent.utterance, sent.attempt, sent.place], ["Un thé", 2, "Café"]);
  assert.ok(sent.goal);
  assert.equal(JSON.stringify(sent).includes("Samuel"), false);
  assert.ok(Object.values(french.intents).every((intent) => intent.meaning), "every intent says in plain words what counts");
  assert.ok(chapterOneNpcs.every((npc) => npc.persona), "every character has a persona");
});

test("the backend's opinion is optional: failures give none and it is left alone for a while", async () => {
  const sent = buildTurnContext({
    languageCode: "fr", level: "A1", npc: barista, quests: chapterOneQuests, save: inCafe(), session: atOrder(),
    intent: french.intents.orderDrink, vocabulary: french.vocabulary, utterance: "Je prends un petit noir"
  });
  const calls: Array<{ url: string; body: unknown }> = [];
  let respond: () => Promise<Response> = async () => new Response(JSON.stringify({ detectedIntent: "orderDrink", confidence: 0.95 }));
  let clock = 0;
  const judge = createHttpTurnJudge("http://api.test/", (url, init) => {
    calls.push({ url, body: JSON.parse(init!.body as string) });
    return respond();
  }, { now: () => clock, backoffMs: 30_000, timeoutMs: 20 });

  assert.deepEqual(await judge.judge(sent), { intentId: "orderDrink", confidence: 0.95 });
  assert.equal(calls[0].url, "http://api.test/conversation/turn");
  assert.deepEqual(calls[0].body, sent);

  respond = async () => new Response(JSON.stringify({ detectedIntent: "somethingElse", confidence: 1 }));
  assert.equal(await judge.judge(sent), undefined, "an opinion about an intent that was not offered is discarded");

  respond = async () => new Response("bad request", { status: 400 });
  assert.equal(await judge.judge(sent), undefined);
  respond = async () => new Response(JSON.stringify({ detectedIntent: null, confidence: 0 }));
  assert.notEqual(await judge.judge(sent), undefined, "a rejected request does not mean the service is down");

  for (const failure of [
    async () => new Response("down", { status: 503 }),
    async () => new Response("busy", { status: 429 }),
    async () => { throw new TypeError("network"); },
    async () => new Response("not json")
  ]) {
    respond = failure;
    const before = calls.length;
    assert.equal(await judge.judge(sent), undefined);
    respond = async () => new Response(JSON.stringify({ detectedIntent: null, confidence: 0 }));
    assert.equal(await judge.judge(sent), undefined, "left alone after a failure");
    assert.equal(calls.length, before + 1);
    clock += 30_001;
    assert.notEqual(await judge.judge(sent), undefined, "asked again once the wait is over");
  }

  // A reply that takes too long is given up on, so the learner is not kept waiting.
  const slow = createHttpTurnJudge("http://api.test", (_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  }), { timeoutMs: 10 });
  assert.equal(await slow.judge(sent), undefined);
});
