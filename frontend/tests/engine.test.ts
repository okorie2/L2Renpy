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
import { buildSlotValues, resolveDialogueLine } from "../src/dialogue/template";
import { french } from "../src/languages/fr";
import { streetPeople } from "../src/content/scenes";
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

test("Sophie's welcome: English questions, a French model, practice, then the player speaks", () => {
  const meet = french.dialogues.meetSophie;
  const street = (): GameSave => ({ ...newSave(), player: { ...newSave().player, locationId: "neighborhood", profile: {} } });
  const until = (state: { session: DialogueSession; save: GameSave }, nodeId: string, experience: string) => {
    let current = state;
    for (let guard = 0; current.session.nodeId !== nodeId && guard < 30; guard++) {
      const response = meet.nodes[current.session.nodeId].response;
      current = go(current, meet, !response ? next
        : response.kind === "text" ? { type: "ANSWER", value: response.saveTo === "age" ? " 27 " : "  Léa  ", assistance: [] }
        : response.kind === "practice" ? { type: "PRACTICED", assistance: [] }
        : { type: "ANSWER", value: current.session.nodeId === "askExperience" ? experience : "travel", assistance: [] });
    }
    return current;
  };

  // The welcome is in the learner's own language and is not evidence of learning French.
  const welcomed = until({ session: startDialogue(meet, "sophie"), save: street() }, "example", "new");
  assert.equal(welcomed.save.player.profile.displayName, "Léa");
  assert.equal(welcomed.save.player.profile.targetLanguageExperience, "new");
  assert.equal(welcomed.save.evidenceLog.length, 0, "English lines teach no French");
  assert.equal(welcomed.save.player.profile.age, 27);
  assert.deepEqual(welcomed.session.history.map((line) => line.nodeId), ["hello", "niceToMeetYou", "askName", "greetName", "askAge", "askExperience", "askMotivation", "great", "model"]);
  assert.equal(meet.nodes.askExperience.targetText, "Great! And how much French do you already know?");
  // The introduction includes the age, written out as it is said.
  assert.equal(
    resolveDialogueLine(meet.nodes.example, buildSlotValues(french.slots, welcomed.save.player.profile)).target.text.split("\n")[1],
    "J'ai vingt-sept ans."
  );

  // The model introduction is French, and is evidence.
  let state = go(welcomed, meet, next);
  assert.ok(state.save.evidenceLog.length > 0);

  // Practice is finished whenever the player moves on; only that input fits it.
  state = until(state, "practice", "new");
  assert.equal(go(state, meet, next).result, "ignored");
  state = go(state, meet, { type: "PRACTICED", assistance: [] });
  assert.equal(state.session.nodeId, "letsGo");

  // Sophie turns toward the gate; the welcome ends on the learner's tap, not by itself.
  assert.equal(meet.nodes.letsGo.presentation?.framing, "wide");
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

test("the walk to the café: Sophie's questions, a greeting in passing, and any age will do", () => {
  const walk = french.dialogues.walkToCafe;
  const fresh = createInitialSave(createStartingPlayer("fr"), chapterOneQuests);
  const met: GameSave = {
    ...fresh,
    player: { ...fresh.player, profile: { displayName: "Léa", age: 27 } },
    questProgress: {
      ...fresh.questProgress,
      meetSophie: { status: "completed", completedObjectiveIds: [], objectiveCounts: {} },
      walkToCafe: { status: "active", completedObjectiveIds: [], objectiveCounts: {} }
    }
  };
  let state = { session: startDialogue(walk, "sophie"), save: met };
  const continueTo = (nodeId: string) => {
    for (let guard = 0; state.session.nodeId !== nodeId; guard++) {
      assert.ok(guard < 60, `never reached ${nodeId}`);
      assert.equal(walk.nodes[state.session.nodeId].response, undefined, `${state.session.nodeId} needs an answer`);
      state = go(state, walk, next);
    }
  };

  // One speaking card: Sophie's question is asked on it, and the learner answers out loud.
  continueTo("nameAnswer");
  const card = walk.nodes.nameAnswer.response!;
  assert.ok(card.kind === "say" && card.speakOnly && card.question?.text === "Comment tu t'appelles ?");
  assert.equal(walk.nodes.nameAnswer.presentation?.translation, "delayed", "a new question is heard before it is translated");
  // Nothing moves on until the answer is understood: a miss gets encouragement and the same card again.
  state = go(state, walk, say("euh…"));
  assert.equal(state.session.nodeId, "tryAgain");
  state = go(state, walk, next);
  assert.equal(state.session.nodeId, "nameAnswer");
  // The pronunciation check rides along with the answer and is kept with it.
  const pronunciation = { wordsNeedingPractice: [{ word: "appelle" }], phraseRelativeSimilarity: 0.7 };
  state = go(state, walk, { type: "SAY", text: "Je m'appelle Léa", mode: "speech", assistance: [], pronunciation });
  assert.equal(state.session.nodeId, "peopleOnStreet");
  assert.deepEqual(state.session.history.at(-1)?.said?.pronunciation, pronunciation);
  assert.deepEqual(state.save.evidenceLog.at(-1)?.pronunciation, pronunciation);

  // A passer-by and a shopkeeper say bonjour; the learner answers the shopkeeper.
  // They are on the street from afar, before anyone speaks, and come closer as Sophie walks.
  const onStreet = () => streetPeople(walk, [...state.session.history.map((entry) => entry.nodeId), state.session.nodeId]);
  assert.deepEqual(onStreet(), [{ id: "passerby", at: "far" }, { id: "shopkeeper", at: undefined }]);
  continueTo("yourTurnNext");
  assert.deepEqual(onStreet().find((person) => person.id === "passerby"), { id: "passerby", at: "near", to: "passed" }, "the passer-by walks on past");
  continueTo("greetShopkeeper");
  assert.deepEqual(onStreet().map((person) => person.id), ["shopkeeper"], "and has gone");
  assert.equal(walk.nodes.greetShopkeeper.presentation?.focus, "shopkeeper");
  assert.equal(walk.nodes.passerbyHello.translation, "Hello!", "every card shows its English");
  assert.ok(walk.nodes.greetShopkeeper.presentation?.exercise, "answering the shopkeeper is a test: the English waits for a tap");
  state = go(state, walk, say("bonjour"));

  continueTo("caVaAnswer");
  state = go(state, walk, say("ça va bien"));
  continueTo("caVaCheckAnswer");
  assert.ok(!walk.nodes.caVaCheckAnswer.presentation?.exercise, "not marked as a test, so its English shows");
  state = go(state, walk, say("ça va"));

  // The number is the learner's own: any age in « J'ai … ans » communicates.
  continueTo("ageAnswer");
  assert.equal(resolveDialogueLine(walk.nodes.ageAnswer, buildSlotValues(french.slots, state.save.player.profile)).target.text, "J'ai vingt-sept ans.");
  state = go(state, walk, say("j'ai trente ans"));
  assert.equal(state.session.nodeId, "ageExactly");

  // The mixed mini-conversation, then the café.
  for (const [nodeId, answer] of [["miniHelloAnswer", "Bonjour"], ["miniCaVaAnswer", "Ça va bien"], ["miniNameAnswer", "Je m'appelle Léa"], ["miniAgeAnswer", "J'ai 27 ans"]]) {
    continueTo(nodeId);
    state = go(state, walk, say(answer));
  }
  continueTo("ready");
  assert.equal(walk.nodes.weAreHere.presentation?.scene, "cafe-exterior");
  assert.equal(go(state, walk, say("oui")).result, "ignored", "the last card only waits for the tap");
  state = go(state, walk, next);
  assert.equal(state.result, "completed");
  assert.equal(state.save.questProgress.walkToCafe.status, "completed");
  assert.equal(state.save.questProgress.cafe.status, "active");
});
