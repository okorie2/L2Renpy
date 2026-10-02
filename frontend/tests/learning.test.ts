import assert from "node:assert/strict";
import test from "node:test";
import { chapterOneQuests, createStartingPlayer } from "../src/content/chapter1";
import { createInitialSave } from "../src/core/quests";
import { recordLineEncounter } from "../src/dialogue/evidence";
import { french } from "../src/languages/fr";
import { chapterOneConcepts } from "../src/learning/concepts";
import type { LearningEvidence, SupportLevel } from "../src/learning/models";
import { EVIDENCE_LOG_LIMIT, recordLearningEvidence } from "../src/learning/progress";
import { summarizeLearning } from "../src/learning/summary";
import { vocabularyInText } from "../src/learning/vocabulary";
import { SUPPORT_WINDOW, adaptSupport, initialSupportLevel, stepSupportLevel, supportPolicy } from "../src/learning/support";
import { initialSpeechSession, speechErrorRecovery, speechSessionReducer, type SpeechSessionEvent } from "../src/speech/session";
import { ttsCacheKey } from "../src/speech/ttsCache";
import type { SpeechErrorKind } from "../src/speech/types";

const newSave = () => createInitialSave(createStartingPlayer("fr"), chapterOneQuests);
const at = "2026-10-02T10:00:00.000Z";

test("translation fades as support decreases but help is never removed", () => {
  assert.equal(supportPolicy("full").translation, "visible");
  assert.equal(supportPolicy("guided").translation, "on-request");
  assert.equal(supportPolicy("independent").translation, "on-help");
  assert.equal(initialSupportLevel(undefined), "full");
  assert.equal(initialSupportLevel("new"), "full");
  assert.equal(initialSupportLevel("some"), "guided");
  assert.equal(initialSupportLevel("conversational"), "independent");
});

test("support moves one step at a time", () => {
  assert.equal(stepSupportLevel("full", "less-support"), "guided");
  assert.equal(stepSupportLevel("guided", "less-support"), "independent");
  assert.equal(stepSupportLevel("independent", "less-support"), "independent");
  assert.equal(stepSupportLevel("independent", "more-support"), "guided");
  assert.equal(stepSupportLevel("full", "more-support"), "full");
});

test("independent success is stronger evidence than assisted success", () => {
  let save = newSave();
  save = recordLearningEvidence(save, { conceptIds: ["ORDER_ITEM"], vocabularyIds: [], modality: "speaking", outcome: "successful", assistance: [], attempts: 1, at });
  save = recordLearningEvidence(save, { conceptIds: ["ORDER_ITEM"], vocabularyIds: [], modality: "speaking", outcome: "successful", assistance: ["translation", "hint"], attempts: 1, at });
  save = recordLearningEvidence(save, { conceptIds: ["ORDER_ITEM"], vocabularyIds: [], modality: "speaking", outcome: "successful", assistance: [], attempts: 3, at });
  save = recordLearningEvidence(save, { conceptIds: ["ORDER_ITEM"], vocabularyIds: [], modality: "speaking", outcome: "unsuccessful", assistance: [], attempts: 1, at });
  assert.deepEqual(save.conceptMastery.ORDER_ITEM.byModality.speaking, {
    encounters: 4, attempts: 4, successfulAttempts: 3, unsuccessfulAttempts: 1, independentSuccesses: 1, assistedEncounters: 1
  });
  assert.equal(save.conceptMastery.ORDER_ITEM.byModality.listening, undefined);
});

test("pronunciation diagnostics ride along without changing the communication outcome", () => {
  const save = recordLearningEvidence(newSave(), {
    conceptIds: ["ORDER_ITEM"], vocabularyIds: [], modality: "speaking", outcome: "successful", assistance: [], attempts: 1, at,
    pronunciation: { wordsNeedingPractice: [{ word: "voudrais" }] }
  });
  assert.equal(save.conceptMastery.ORDER_ITEM.byModality.speaking?.successfulAttempts, 1);
});

test("reading a line is exposure, not success, and never touches game progression", () => {
  const save = newSave();
  const node = french.dialogues.meetSophie.nodes.hello;
  const next = recordLineEncounter(save, node, vocabularyInText(node.targetText, french.vocabulary), "reading", ["translation"], at);
  assert.deepEqual(next.conceptMastery.GREETING.byModality.reading, {
    encounters: 1, attempts: 0, successfulAttempts: 0, unsuccessfulAttempts: 0, independentSuccesses: 0, assistedEncounters: 1
  });
  assert.equal(next.vocabularyMastery["fr.salut"].byModality.reading?.encounters, 1);
  assert.equal(next.vocabularyMastery["fr.sappeler"].byModality.reading?.encounters, 1);
  assert.equal(next.evidenceLog.length, 1, "one line is one logged interaction");
  assert.equal(next.player.xp, save.player.xp);
  assert.deepEqual(next.questProgress, save.questProgress);
});

const attempt = (overrides: Partial<LearningEvidence> = {}): LearningEvidence => ({
  conceptIds: ["ORDER_ITEM"], vocabularyIds: [], modality: "writing", outcome: "successful", assistance: ["typed-fallback"], attempts: 1, at, ...overrides
});
const withLevel = (level: SupportLevel) => ({ ...newSave(), learningSupport: { level, basis: "self-reported" as const } });
const record = (save: ReturnType<typeof newSave>, entries: LearningEvidence[]) => entries.reduce((state, entry) => adaptSupport(recordLearningEvidence(state, entry)), save);

test("typing instead of speaking is not help, and one success is not mastery", () => {
  const once = recordLearningEvidence(newSave(), attempt());
  assert.equal(once.conceptMastery.ORDER_ITEM.byModality.writing?.independentSuccesses, 1);
  const order = (save: ReturnType<typeof newSave>) => summarizeLearning(save, chapterOneConcepts, french.vocabulary).concepts.find((entry) => entry.concept.id === "ORDER_ITEM")!;
  assert.equal(order(newSave()).standing, "not-met");
  assert.equal(order(recordLineEncounter(newSave(), french.dialogues.cafeOrder.nodes.ask, [], "reading", [], at)).standing, "met");
  assert.equal(order(once).standing, "with-support");
  assert.equal(order(recordLearningEvidence(once, attempt())).standing, "independent");
  assert.equal(order(recordLearningEvidence(once, attempt({ assistance: ["hint"] }))).standing, "with-support");
});

test("the summary separates understanding, writing and speaking, and flags what needs practice", () => {
  let save = newSave();
  save = recordLearningEvidence(save, attempt({ conceptIds: ["UNDERSTAND_PRICE"], modality: "reading", outcome: "unsuccessful", assistance: [] }));
  save = recordLearningEvidence(save, attempt({ conceptIds: ["UNDERSTAND_PRICE"], modality: "reading", attempts: 2, assistance: [] }));
  save = recordLearningEvidence(save, attempt({ conceptIds: ["THANK_PERSON"], vocabularyIds: ["fr.merci"] }));
  save = recordLearningEvidence(save, attempt({ conceptIds: ["THANK_PERSON"], vocabularyIds: ["fr.merci"], modality: "speaking", assistance: [] }));
  const summary = summarizeLearning(save, chapterOneConcepts, french.vocabulary);
  const price = summary.concepts.find((entry) => entry.concept.id === "UNDERSTAND_PRICE")!;
  assert.deepEqual([price.standing, price.needsPractice, price.understood, price.misses], ["with-support", true, 1, 1]);
  const thanks = summary.concepts.find((entry) => entry.concept.id === "THANK_PERSON")!;
  assert.deepEqual([thanks.standing, thanks.needsPractice, thanks.producedByWriting, thanks.producedBySpeaking], ["independent", false, 1, 1]);
  assert.deepEqual(summary.vocabulary.map((entry) => [entry.item.id, entry.produced]), [["fr.merci", 2]]);
  assert.equal(save.player.xp, 0, "language progress never touches XP");
});

test("support follows behaviour: smooth answers lower it, struggle raises it, one step at a time", () => {
  const smooth = Array.from({ length: SUPPORT_WINDOW }, () => attempt({ assistance: ["typed-fallback", "suggested-answer", "translation"] }));
  // Too few answers to judge yet.
  assert.equal(record(withLevel("full"), smooth.slice(0, SUPPORT_WINDOW - 1)).learningSupport.level, "full");
  const lowered = record(withLevel("full"), smooth);
  assert.deepEqual([lowered.learningSupport.level, lowered.learningSupport.basis], ["guided", "observed"]);
  // A fresh window is needed before the next change; it never jumps two levels.
  assert.equal(record(lowered, smooth.slice(0, 2)).learningSupport.level, "guided");

  // Tapping the offered sentence is not enough to leave full support.
  const picked = smooth.map((entry) => ({ ...entry, modality: "reading" as const, assistance: ["suggested-answer" as const] }));
  assert.equal(record(withLevel("full"), picked).learningSupport.level, "full");

  // At guided, revealing the answer each time is not smooth; unaided answers are.
  const revealed = smooth.map((entry) => ({ ...entry, assistance: ["typed-fallback" as const, "suggested-answer" as const] }));
  assert.equal(record(withLevel("guided"), revealed).learningSupport.level, "full");
  const unaided = smooth.map((entry) => ({ ...entry, assistance: ["typed-fallback" as const] }));
  assert.equal(record(withLevel("guided"), unaided).learningSupport.level, "independent");

  const retries = [attempt(), attempt({ attempts: 2 }), attempt(), attempt({ attempts: 3 }), attempt({ attempts: 2 }), attempt()];
  assert.equal(record(withLevel("independent"), retries).learningSupport.level, "guided");
  assert.equal(record(withLevel("full"), retries).learningSupport.level, "full", "already at the most support");
});

test("words are found in text in any of their forms, and the log stays bounded", () => {
  assert.deepEqual(vocabularyInText("Bonjour ! Un café, s’il te plaît.", french.vocabulary).sort(), ["fr.bonjour", "fr.cafe", "fr.silvousplait"]);
  assert.deepEqual(vocabularyInText("Enchantée, Samuel !", french.vocabulary), ["fr.enchante"]);
  assert.deepEqual(vocabularyInText("Hello there", french.vocabulary), []);
  let save = newSave();
  for (let i = 0; i < EVIDENCE_LOG_LIMIT + 25; i++) save = recordLearningEvidence(save, attempt());
  assert.equal(save.evidenceLog.length, EVIDENCE_LOG_LIMIT);
  assert.equal(save.evidenceCount, EVIDENCE_LOG_LIMIT + 25);
  assert.equal(save.evidenceLog.at(-1)?.seq, EVIDENCE_LOG_LIMIT + 25);
  assert.equal(recordLearningEvidence(save, attempt({ conceptIds: [] })), save, "nothing to record");
});

test("every vocabulary item is real content: it appears where it says, and its example contains it", () => {
  for (const item of french.vocabulary) {
    const dialogue = french.dialogues[item.introducedIn.dialogueId];
    assert.ok(dialogue, `${item.id}: unknown dialogue`);
    const text = Object.values(dialogue.nodes).map((node) => node.targetText).join(" ");
    assert.ok(vocabularyInText(text, [item]).length === 1, `${item.id} does not appear in ${dialogue.id}`);
    assert.ok(item.surfaceForms.length > 0 && item.examples.length > 0, item.id);
    for (const example of item.examples) assert.ok(vocabularyInText(example.target, [item]).length === 1, `${item.id}: example without the word`);
    assert.ok(item.conceptIds.length > 0, item.id);
  }
  assert.equal(new Set(french.vocabulary.map((item) => item.id)).size, french.vocabulary.length);
});

const transcript = "un café s'il vous plaît";
const run = (events: SpeechSessionEvent[]) => events.reduce(speechSessionReducer, initialSpeechSession);

test("a spoken attempt moves through explicit states", () => {
  assert.equal(run([{ type: "START" }]).status, "recording");
  assert.equal(run([{ type: "START" }, { type: "STOP" }]).status, "processing");
  const result = run([{ type: "START" }, { type: "STOP" }, { type: "RESULT", transcript }]);
  assert.equal(result.status, "result");
  assert.equal(result.attempts, 1);
  const retried = speechSessionReducer(speechSessionReducer(result, { type: "RETRY" }), { type: "START" });
  assert.equal(retried.status, "recording");
  assert.equal(retried.attempts, 2);
});

test("out-of-order events are ignored and cancel always returns to idle", () => {
  assert.equal(run([{ type: "STOP" }]).status, "idle");
  assert.equal(run([{ type: "RESULT", transcript }]).status, "idle");
  assert.equal(run([{ type: "START" }, { type: "START" }]).attempts, 1);
  assert.equal(run([{ type: "START" }, { type: "CANCEL" }]).status, "idle");
  assert.equal(run([{ type: "START" }, { type: "STOP" }, { type: "CANCEL" }]).status, "idle");
});

test("every failure offers a way to keep playing", () => {
  const kinds: SpeechErrorKind[] = ["unavailable", "permission-denied", "no-microphone", "no-speech", "network", "provider"];
  for (const error of kinds) {
    const failed = run([{ type: "FAIL", error }]);
    assert.equal(failed.status, "error");
    assert.equal(speechErrorRecovery(error).offerFallback, true, error);
  }
  assert.equal(speechErrorRecovery("permission-denied").canRetry, false);
  assert.equal(speechErrorRecovery("network").canRetry, true);
  assert.equal(run([{ type: "START" }, { type: "STOP" }, { type: "FAIL", error: "network" }, { type: "RETRY" }]).status, "idle");
});

test("generated speech is cached by provider, model, voice, language and exact text", () => {
  const base = { provider: "p", model: "m", voice: "v", language: "fr", text: "Bonjour !" };
  assert.equal(ttsCacheKey(base), ttsCacheKey({ ...base }));
  for (const change of [{ provider: "q" }, { model: "n" }, { voice: "w" }, { language: "en" }, { text: "Bonjour!" }, { rate: "slow" }]) {
    assert.notEqual(ttsCacheKey(base), ttsCacheKey({ ...base, ...change }), JSON.stringify(change));
  }
  assert.notEqual(ttsCacheKey({ ...base, provider: "a|b", model: "c" }), ttsCacheKey({ ...base, provider: "a", model: "b|c" }));
});
