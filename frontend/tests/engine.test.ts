import assert from "node:assert/strict";
import test from "node:test";
import { chapterOneQuests, createStartingPlayer } from "../src/content/chapter1";
import type { GameSave } from "../src/core/models";
import { createInitialSave } from "../src/core/quests";
import {
  ATTEMPTS_BEFORE_SUGGESTIONS, resolveSayOptions, startDialogue, stepDialogue, suggestionsUnlocked,
  type DialogueInput, type DialogueSession
} from "../src/dialogue/engine";
import { PLAYER_SPEAKER_ID, type Dialogue } from "../src/dialogue/models";
import { french } from "../src/languages/fr";
import { assessUtterance, normalizeUtterance, placeWords } from "../src/learning/assessment";
import { vocabularySpans } from "../src/learning/vocabulary";

const context = { quests: chapterOneQuests, intents: french.intents, slots: french.slots, vocabulary: french.vocabulary, now: "2026-10-02T10:00:00.000Z" };
const newSave = (): GameSave => {
  const save = createInitialSave(createStartingPlayer("fr"), chapterOneQuests);
  // Standing in the café with the café quest under way.
  return {
    ...save,
    player: { ...save.player, locationId: "cafe", profile: { displayName: "Samuel" } },
    questProgress: {
      ...save.questProgress,
      meetSophie: { ...save.questProgress.meetSophie, status: "completed" },
      cafe: { status: "active", completedObjectiveIds: ["enterCafe"], objectiveCounts: {} }
    }
  };
};
const cafe = french.dialogues.cafeOrder;
const go = (state: { session: DialogueSession; save: GameSave }, dialogue: Dialogue, input: DialogueInput) => stepDialogue(state.session, dialogue, input, state.save, context);
const next: DialogueInput = { type: "CONTINUE", assistance: [] };
const say = (text: string, mode: "typed" | "selected" = "typed"): DialogueInput => ({ type: "SAY", text, mode, assistance: [] });

test("any valid wording communicates the intent; exact sentences are not required", () => {
  const order = french.intents.orderDrink;
  for (const text of ["Je voudrais un café.", "Un café, s'il vous plaît.", "un cafe svp", "UN CAFÉ !", "Bonjour, je voudrais un petit café s’il vous plaît"]) {
    assert.equal(assessUtterance(text, order).communicated, true, text);
  }
  for (const text of ["", "Merci, au revoir !", "Bonjour !", "Un croissant, s'il vous plaît."]) {
    assert.equal(assessUtterance(text, order).communicated, false, text);
  }
  assert.equal(assessUtterance("Moi, c'est Léa", french.intents.introduceSelf).communicated, true);
  assert.equal(assessUtterance("Je m’appelle Zoë", french.intents.introduceSelf).communicated, true);
  assert.equal(assessUtterance("un croisant s'il vous plait", french.intents.orderPastry).communicated, true, "one slip in a long word");
  assert.equal(assessUtterance("mercy", french.intents.thankPerson).communicated, true);
  assert.equal(assessUtterance("mer", french.intents.thankPerson).communicated, false);
  assert.deepEqual(normalizeUtterance("Ça va, l’Été ?"), ["ca", "va", "l'ete"]);
});

test("a miss gets an in-scene repair line, then returns to the same question", () => {
  let state = go({ session: startDialogue(cafe, "barista"), save: newSave() }, cafe, next);
  assert.equal(state.session.nodeId, "greet");
  assert.equal(go(state, cafe, next).result, "ignored", "a spoken turn cannot be skipped");

  state = go(state, cafe, say("Au revoir !"));
  assert.equal(state.result, "repair");
  assert.equal(state.session.nodeId, "pardon");
  assert.equal(state.save.questProgress.cafe.completedObjectiveIds.includes("greetBarista"), false);
  assert.equal(state.save.conceptMastery.GREETING.byModality.writing?.successfulAttempts, 0);

  state = go(state, cafe, next);
  assert.equal(state.session.nodeId, "greet");
  assert.equal(state.session.returnNodeId, undefined);

  state = go(state, cafe, say("Bonjour madame"));
  assert.equal(state.result, "advanced");
  assert.equal(state.session.nodeId, "ask");
  assert.ok(state.save.questProgress.cafe.completedObjectiveIds.includes("greetBarista"));
  // The second try succeeded, so it is not counted as an independent success.
  assert.deepEqual(state.save.conceptMastery.GREETING.byModality.writing, {
    encounters: 2, attempts: 2, successfulAttempts: 1, unsuccessfulAttempts: 1, independentSuccesses: 0, assistedEncounters: 0
  });
  // Only the words the player actually used are credited as produced.
  assert.equal(state.save.vocabularyMastery["fr.bonjour"].byModality.writing?.successfulAttempts, 1);
  assert.equal(state.save.vocabularyMastery["fr.aurevoir"], undefined);
});

test("retries are finite: after repeated misses the fitting answers are offered", () => {
  let state = go({ session: startDialogue(cafe, "barista"), save: newSave() }, cafe, next);
  for (let attempt = 0; attempt < ATTEMPTS_BEFORE_SUGGESTIONS; attempt++) {
    assert.equal(suggestionsUnlocked(state.session, "greet"), false);
    state = go(go(state, cafe, say("euh")), cafe, next);
  }
  assert.equal(state.session.nodeId, "greet");
  assert.equal(suggestionsUnlocked(state.session, "greet"), true);
  const fitting = resolveSayOptions(cafe.nodes.greet, state.save, context).filter((option) => option.fits);
  assert.deepEqual(fitting.map((option) => option.text), ["Bonjour !"]);
  state = go(state, cafe, { type: "SAY", text: fitting[0].text, mode: "selected", assistance: ["suggested-answer"] });
  assert.equal(state.result, "advanced");
  assert.equal(state.save.conceptMastery.GREETING.byModality.reading?.independentSuccesses, 0);
});

test("understanding is shown by acting, and effects apply once", () => {
  let state = { session: { ...startDialogue(cafe, "barista"), nodeId: "price" }, save: newSave(), result: "advanced" as string };
  state = go(state, cafe, { type: "ACT", optionId: "thirteen", assistance: [] });
  assert.equal(state.session.nodeId, "repairPrice");
  assert.equal(state.save.inventory.coffee, undefined);
  state = go(go(state, cafe, next), cafe, { type: "ACT", optionId: "three", assistance: [] });
  assert.equal(state.session.nodeId, "thanks");
  assert.equal(state.save.inventory.coffee, 1);
  assert.equal(state.save.conceptMastery.UNDERSTAND_PRICE.byModality.reading?.successfulAttempts, 1);

  const again = go({ session: { ...state.session, nodeId: "price" }, save: state.save }, cafe, { type: "ACT", optionId: "three", assistance: [] });
  assert.equal(again.save.inventory.coffee, 1, "restarting the conversation cannot duplicate the coffee");
});

test("branches follow game state and choices; history records what was said", () => {
  const meet = french.dialogues.meetSophie;
  const street = (): GameSave => ({ ...newSave(), player: { ...newSave().player, locationId: "neighborhood", profile: {} } });
  const until = (state: { session: DialogueSession; save: GameSave }, nodeId: string, experience: string) => {
    let current = state;
    for (let guard = 0; current.session.nodeId !== nodeId && guard < 20; guard++) {
      const response = meet.nodes[current.session.nodeId].response;
      current = go(current, meet, !response ? next
        : response.kind === "text" ? { type: "ANSWER", value: "  Léa  ", assistance: [] }
        : { type: "ANSWER", value: current.session.nodeId === "askExperience" ? experience : "travel", assistance: [] });
    }
    return current;
  };
  const gentle = until({ session: startDialogue(meet, "sophie"), save: street() }, "askMotivation", "new");
  const together = until({ session: startDialogue(meet, "sophie"), save: street() }, "askMotivation", "some");
  assert.ok(gentle.session.history.some((line) => line.nodeId === "paceGentle"));
  assert.ok(together.session.history.some((line) => line.nodeId === "paceTogether"));
  assert.ok(!together.session.history.some((line) => line.nodeId === "paceGentle"));
  assert.equal(gentle.save.player.profile.displayName, "Léa");

  let state = until(gentle, "yourTurn", "new");
  assert.deepEqual(resolveSayOptions(meet.nodes.yourTurn, state.save, context).map((option) => [option.text, option.fits]), [
    ["Je m'appelle Léa.", true], ["Merci, au revoir !", false]
  ]);
  state = go(state, meet, say("moi c'est Léa !"));
  assert.equal(state.session.nodeId, "invitation");
  const last = state.session.history.at(-1)!;
  assert.deepEqual([last.speakerId, last.text], [PLAYER_SPEAKER_ID, "moi c'est Léa !"]);
  assert.equal(state.session.history[0].translation, "Hi! My name is Sophie.");

  state = go(state, meet, next);
  assert.equal(state.result, "completed");
  assert.equal(state.session.status, "completed");
  assert.deepEqual(state.save.completedDialogueIds, ["meetSophie"]);
  assert.equal(go(state, meet, next).result, "ignored");
});

test("each answer is kept with how it went, and which of its words were recognised", () => {
  const marked = (line: { text: string; said?: { usedWords: Array<{ start: number; end: number }> } }) => line.said!.usedWords.map((span) => line.text.slice(span.start, span.end));
  const at = (nodeId: string) => ({ session: { ...startDialogue(cafe, "barista"), nodeId }, save: newSave() });

  // Words keep their place in what was actually typed: accents, capitals and punctuation included.
  const text = "  Bonjour ! Je voudrais un CAFÉ, s’il vous plaît…";
  let state = go(at("order"), cafe, say(text));
  let line = state.session.history.at(-1)!;
  assert.equal(line.text, text.trim());
  assert.deepEqual(marked(line), ["Bonjour", "Je voudrais", "CAFÉ", "s’il vous plaît"]);
  assert.deepEqual({ ...line.said, usedWords: [] }, { mode: "typed", communicated: true, attempt: 1, helped: false, usedWords: [] });

  // A miss is kept too, with nothing credited.
  state = go(at("order"), cafe, say("Bonjour, un thé"));
  line = state.session.history.at(-1)!;
  assert.deepEqual(line.said, { mode: "typed", communicated: false, attempt: 1, helped: false, usedWords: [] });

  // The next try says which try it was; a spoken answer says it was spoken.
  state = go(go(state, cafe, next), cafe, { type: "SAY", text: "un cafe svp", mode: "speech", assistance: ["hint"] });
  line = state.session.history.at(-1)!;
  assert.deepEqual(marked(line), ["cafe", "svp"]);
  assert.deepEqual({ ...line.said, usedWords: [] }, { mode: "speech", communicated: true, attempt: 2, helped: true, usedWords: [] });

  // Typing instead of speaking is not help; picking a suggestion is.
  state = go(at("order"), cafe, { type: "SAY", text: "Un café, s'il vous plaît.", mode: "selected", assistance: ["suggested-answer"] });
  assert.deepEqual([state.session.history.at(-1)!.said!.mode, state.session.history.at(-1)!.said!.helped], ["selected", true]);

  // The placed words are exactly the words the assessor sees.
  for (const sample of [text, "Ça va, l’Été ?", "un  croisant…svp", "été chaud", ""]) {
    assert.deepEqual(placeWords(sample).map((item) => item.word), normalizeUtterance(sample), sample);
  }
  assert.deepEqual(vocabularySpans("au revoir, au revoir !", french.vocabulary, ["fr.aurevoir"]), [{ start: 0, end: 9 }, { start: 11, end: 20 }]);
  assert.deepEqual(vocabularySpans("Merci", french.vocabulary, []), []);
});
