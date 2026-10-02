import assert from "node:assert/strict";
import test from "node:test";
import {
  chapterOneConceptIds, chapterOneItems, chapterOneLocations, chapterOneMessages, chapterOneNpcs, chapterOneQuests, createStartingPlayer
} from "../src/content/chapter1";
import { deliverMessages, markThreadRead, saveThreadSession, unreadThreadIds } from "../src/phone/messages";
import { selectNpcDialogueId } from "../src/core/conditions";
import type { GameSave, Quest } from "../src/core/models";
import { applyGameEvent, createInitialSave, currentObjective, questGuidance, questLog, type GameEvent } from "../src/core/quests";
import { validateQuestContent } from "../src/core/validate";
import { travelThroughPortal } from "../src/core/world";
import { resolveSayOptions, startDialogue, stepDialogue, type DialogueInput } from "../src/dialogue/engine";
import { french } from "../src/languages/fr";
import { chapterOneConcepts } from "../src/learning/concepts";
import { summarizeLearning } from "../src/learning/summary";

const quest = (id: string, overrides: Partial<Quest> = {}): Quest => ({
  id, chapter: 1, title: id, summary: "", prerequisites: [], rewards: [],
  objectives: [{ id: "only", description: "Do it", trigger: { type: "LOCATION_ENTERED", locationId: "cafe" } }],
  ...overrides
});
const start = (quests: Quest[]) => createInitialSave(createStartingPlayer("fr"), quests);
const run = (save: GameSave, quests: Quest[], events: GameEvent[]) => events.reduce((state, event) => applyGameEvent(state, quests, event), save);
const status = (save: GameSave, id: string) => save.questProgress[id].status;
const talk = (dialogueId: string, npcId: string): GameEvent => ({ type: "DIALOGUE_COMPLETED", dialogueId, npcId });
const line = (dialogueId: string, nodeId: string): GameEvent => ({ type: "DIALOGUE_LINE_COMPLETED", dialogueId, nodeId });

test("quests move from locked to available to active to completed", () => {
  const quests = [
    quest("first"),
    quest("second", {
      prerequisites: ["first"],
      start: { trigger: { type: "NPC_TALKED", npcId: "sophie" }, description: "Talk to Sophie" },
      objectives: [{ id: "only", description: "Enter the bakery", trigger: { type: "LOCATION_ENTERED", locationId: "bakery" } }]
    })
  ];
  let save = start(quests);
  assert.equal(status(save, "first"), "active");
  assert.equal(status(save, "second"), "locked");

  save = applyGameEvent(save, quests, { type: "LOCATION_ENTERED", locationId: "cafe" });
  assert.equal(status(save, "first"), "completed");
  assert.equal(status(save, "second"), "available");
  assert.deepEqual(questGuidance(save, quests)?.kind, "start");

  // An available quest ignores its objectives until it has been started.
  save = applyGameEvent(save, quests, { type: "LOCATION_ENTERED", locationId: "bakery" });
  assert.equal(status(save, "second"), "available");
  save = applyGameEvent(save, quests, talk("anything", "sophie"));
  assert.equal(status(save, "second"), "active");
  save = applyGameEvent(save, quests, { type: "LOCATION_ENTERED", locationId: "bakery" });
  assert.equal(status(save, "second"), "completed");
});

test("required objectives are sequential; optional ones never block", () => {
  const quests = [quest("ordered", {
    objectives: [
      { id: "a", description: "A", trigger: { type: "LOCATION_ENTERED", locationId: "cafe" } },
      { id: "extra", description: "Extra", trigger: { type: "NPC_TALKED", npcId: "baker" }, optional: true },
      { id: "b", description: "B", trigger: { type: "INTENT_COMMUNICATED", intentId: "orderDrink" } }
    ]
  })];
  let save = start(quests);
  save = applyGameEvent(save, quests, { type: "INTENT_COMMUNICATED", intentId: "orderDrink" });
  assert.deepEqual(save.questProgress.ordered.completedObjectiveIds, [], "b cannot be done before a");
  save = applyGameEvent(save, quests, talk("x", "baker"));
  assert.deepEqual(save.questProgress.ordered.completedObjectiveIds, ["extra"]);
  save = applyGameEvent(save, quests, { type: "LOCATION_ENTERED", locationId: "cafe" });
  assert.equal(currentObjective(quests[0], save)?.id, "b");
  save = applyGameEvent(save, quests, { type: "INTENT_COMMUNICATED", intentId: "orderDrink" });
  assert.equal(status(save, "ordered"), "completed");

  const skipped = run(start(quests), quests, [
    { type: "LOCATION_ENTERED", locationId: "cafe" }, { type: "INTENT_COMMUNICATED", intentId: "orderDrink" }
  ]);
  assert.equal(status(skipped, "ordered"), "completed", "the optional objective was not needed");
});

test("counted objectives track progress and one event advances one step", () => {
  const quests = [quest("counted", {
    objectives: [
      { id: "twice", description: "Greet twice", trigger: { type: "CONCEPT_DEMONSTRATED", conceptId: "GREETING" }, count: 2 },
      { id: "again", description: "Greet once more", trigger: { type: "CONCEPT_DEMONSTRATED", conceptId: "GREETING" } }
    ]
  })];
  const event: GameEvent = { type: "CONCEPT_DEMONSTRATED", conceptId: "GREETING" };
  let save = applyGameEvent(start(quests), quests, event);
  assert.equal(save.questProgress.counted.objectiveCounts.twice, 1);
  assert.equal(questLog(save, quests)[0].objectives[0].state, "current");
  save = applyGameEvent(save, quests, event);
  assert.deepEqual(save.questProgress.counted.completedObjectiveIds, ["twice"]);
  save = applyGameEvent(save, quests, event);
  assert.equal(status(save, "counted"), "completed");
});

test("rewards are granted once, and items and completions chain as events", () => {
  const quests = [
    quest("buy", { rewards: [{ type: "XP", amount: 10 }, { type: "ITEM", itemId: "coffee" }] }),
    quest("carry", { objectives: [{ id: "has", description: "Have a coffee", trigger: { type: "ITEM_ACQUIRED", itemId: "coffee" } }], rewards: [{ type: "XP", amount: 5 }] }),
    quest("after", { objectives: [{ id: "done", description: "Finish the first", trigger: { type: "QUEST_COMPLETED", questId: "buy" } }] })
  ];
  const event: GameEvent = { type: "LOCATION_ENTERED", locationId: "cafe" };
  let save = applyGameEvent(start(quests), quests, event);
  assert.equal(save.inventory.coffee, 1);
  assert.equal(status(save, "carry"), "completed");
  assert.equal(status(save, "after"), "completed");
  assert.equal(save.player.xp, 15);
  save = run(save, quests, [event, event]);
  assert.equal(save.player.xp, 15);
  assert.equal(save.inventory.coffee, 1);
});

test("location requirements and presence are respected", () => {
  const quests = [
    quest("inCafe", {
      objectives: [{ id: "greet", description: "Greet in the café", trigger: { type: "CONCEPT_DEMONSTRATED", conceptId: "GREETING" }, requires: { locationId: "cafe" } }]
    }),
    quest("home", { prerequisites: ["inCafe"], objectives: [{ id: "be", description: "Be in the café", trigger: { type: "LOCATION_ENTERED", locationId: "cafe" } }] })
  ];
  const greet: GameEvent = { type: "CONCEPT_DEMONSTRATED", conceptId: "GREETING" };
  let save = applyGameEvent(start(quests), quests, greet);
  assert.equal(status(save, "inCafe"), "active", "greeting in the apartment does not count");
  save = { ...save, player: { ...save.player, locationId: "cafe" } };
  save = applyGameEvent(save, quests, greet);
  assert.equal(status(save, "inCafe"), "completed");
  // The next quest asks for the place the player is already standing in.
  assert.equal(status(save, "home"), "completed");
});

test("Chapter 1 content references resolve", () => {
  const problems = validateQuestContent(chapterOneQuests, {
    locations: chapterOneLocations,
    npcs: chapterOneNpcs,
    items: chapterOneItems,
    dialogueNodes: Object.fromEntries(Object.values(french.dialogues).map((dialogue) => [dialogue.id, Object.keys(dialogue.nodes)])),
    intentIds: Object.keys(french.intents),
    conceptIds: chapterOneConceptIds
  });
  assert.deepEqual(problems, []);
  assert.ok(chapterOneQuests.length >= 3 && chapterOneQuests.length <= 5);
});

test("the validator catches broken quest content", () => {
  const problems = validateQuestContent([
    quest("a", { prerequisites: ["later"], rewards: [{ type: "ITEM", itemId: "ghost" }], objectives: [
      { id: "x", description: "", trigger: { type: "DIALOGUE_LINE_COMPLETED", dialogueId: "nope", nodeId: "n" }, optional: true }
    ] }),
    quest("later")
  ], { locations: [], npcs: [], items: [], dialogueNodes: {}, intentIds: [], conceptIds: [] });
  assert.equal(problems.length, 5);
});

test("Chapter 1 can be played from start to finish through game events alone", () => {
  const quests = chapterOneQuests;
  const sophie = chapterOneNpcs.find((npc) => npc.id === "sophie")!;
  const barista = chapterOneNpcs.find((npc) => npc.id === "barista")!;
  const baker = chapterOneNpcs.find((npc) => npc.id === "baker")!;
  const neighbor = chapterOneNpcs.find((npc) => npc.id === "neighbor")!;
  const travel = (save: GameSave, portalId: string) => travelThroughPortal(save, chapterOneLocations, portalId, quests);
  const context = { quests, intents: french.intents, slots: french.slots, vocabulary: french.vocabulary, now: "2026-10-02T10:00:00.000Z" };
  /** Hold the whole conversation an NPC currently offers, answering each line the way a player could. */
  const converse = (save: GameSave, npc: typeof sophie, expected: string) => {
    assert.equal(selectNpcDialogueId(npc, save, quests), expected);
    return talk(save, expected, startDialogue(french.dialogues[expected], npc.id)).save;
  };
  const talk = (save: GameSave, expected: string, session: ReturnType<typeof startDialogue>) => {
    const dialogue = french.dialogues[expected];
    let state = { session, save };
    for (let guard = 0; state.session.status === "active"; guard++) {
      assert.ok(guard < 40, "conversation did not end");
      const node = dialogue.nodes[state.session.nodeId];
      const response = node.response;
      const input: DialogueInput = !response ? { type: "CONTINUE", assistance: [] }
        : response.kind === "text" ? { type: "ANSWER", value: "Samuel", assistance: [] }
        : response.kind === "choice" ? { type: "ANSWER", value: response.options[0].value, assistance: [] }
        : response.kind === "act" ? { type: "ACT", optionId: response.options.find((option) => option.correct)!.id, assistance: [] }
        : response.kind === "practice" ? { type: "PRACTICED", assistance: [] }
        : { type: "SAY", text: resolveSayOptions(node, state.save, context).find((option) => option.fits)!.text, mode: "typed", assistance: [] };
      const step = stepDialogue(state.session, dialogue, input, state.save, context);
      assert.notEqual(step.result, "ignored", `${expected}.${node.id}`);
      state = step;
    }
    return state;
  };
  const deliver = (save: GameSave) => deliverMessages(save, chapterOneMessages, french.dialogues, quests, context.now);

  // The game opens on the street, where Sophie comes out to welcome the player.
  let save = start(quests);
  assert.equal(save.player.locationId, "neighborhood");
  assert.equal(questGuidance(save, quests)?.text, "Tell Sophie your name");
  assert.equal(status(save, "cafe"), "locked");
  save = converse(save, sophie, "meetSophie");
  assert.equal(status(save, "meetSophie"), "completed");
  assert.equal(questGuidance(save, quests)?.text, "Go into the café");
  save = converse(save, sophie, "sophieToCafe");

  // Before the café quest the barista only says hello; during it she takes an order.
  save = travel(save, "enterCafe");
  assert.equal(questGuidance(save, quests)?.text, "Greet the barista");
  save = converse(save, barista, "cafeOrder");
  assert.equal(status(save, "cafe"), "completed");
  assert.equal(save.inventory.coffee, 1);
  assert.equal(selectNpcDialogueId(barista, save, quests), "meetBarista");

  save = travel(save, "leaveCafe");
  save = converse(save, sophie, "sophieToBakery");
  save = travel(save, "enterBakery");
  save = converse(save, baker, "bakeryOrder");
  assert.equal(status(save, "bakery"), "completed");
  assert.equal(save.inventory.croissant, 1);

  // "Le quartier" waits to be started by talking to Sophie.
  save = travel(save, "leaveBakery");
  assert.equal(status(save, "neighborhood"), "available");
  assert.deepEqual(questGuidance(save, quests), { quest: quests[3], text: "Talk to Sophie", kind: "start" });
  save = converse(save, sophie, "sophieToSquare");
  assert.equal(status(save, "neighborhood"), "active");
  save = converse(save, neighbor, "meetNeighbor");
  assert.equal(questGuidance(save, quests)?.text, "Go back to Sophie");
  save = converse(save, sophie, "sophieAfterErrands");
  assert.equal(status(save, "neighborhood"), "completed");
  assert.ok(!save.questProgress.neighborhood.completedObjectiveIds.includes("greetNadiaAgain"));

  assert.equal(questGuidance(save, quests)?.text, "Go home");
  save = converse(save, sophie, "sophieGoodbye");
  assert.deepEqual(deliver(save).messages, {}, "no message before its moment");
  save = travel(save, "enterApartment");

  // Home: the last quest continues on the phone.
  assert.equal(status(save, "goodbye"), "active");
  assert.equal(questGuidance(save, quests)?.text, "Read Sophie's message on your phone");
  save = deliver(save);
  assert.deepEqual(unreadThreadIds(save), ["sophieEvening"]);
  assert.equal(deliver(save), save, "a message arrives once");
  save = markThreadRead(save, "sophieEvening");
  const thread = talk(save, "sophieMessage", save.messages.sophieEvening.session);
  save = saveThreadSession(thread.save, "sophieEvening", thread.session);
  assert.equal(save.messages.sophieEvening.session.status, "completed");
  assert.deepEqual(save.messages.sophieEvening.session.history.map((line) => line.speakerId), ["sophie", "player", "sophie", "player", "sophie"]);
  assert.deepEqual(unreadThreadIds(save), []);
  assert.equal(deliver(save), save, "and stays after the quest that brought it is over");
  assert.deepEqual(save.visitedLocationIds, ["neighborhood", "cafe", "bakery", "apartment"]);

  for (const item of quests) assert.equal(status(save, item.id), "completed", item.id);
  assert.equal(questGuidance(save, quests), undefined);
  assert.equal(save.player.xp, 130);
  assert.equal(questLog(save, quests).length, 5);

  // After the chapter the game can explain what was met, understood and produced.
  const summary = summarizeLearning(save, chapterOneConcepts, french.vocabulary);
  const standing = Object.fromEntries(summary.concepts.map((entry) => [entry.concept.id, entry.standing]));
  assert.equal(summary.concepts.some((entry) => entry.standing === "not-met"), false, "every Chapter 1 concept was at least met");
  assert.equal(standing.ORDER_ITEM, "independent");
  assert.equal(standing.UNDERSTAND_PRICE, "independent");
  assert.equal(standing.INTRODUCE_SELF, "with-support", "one success is not mastery");
  assert.equal(standing.BASIC_QUESTION, "with-support", "answered once, in Sophie's message");
  assert.equal(standing.YES_NO, "with-support");
  assert.equal(summary.concepts.some((entry) => entry.producedBySpeaking > 0), false, "typing is never credited as speaking");
  assert.equal(summary.concepts.some((entry) => entry.needsPractice), false);
  const used = summary.vocabulary.filter((entry) => entry.produced > 0).map((entry) => entry.item.id);
  for (const id of ["fr.sappeler", "fr.bonjour", "fr.cafe", "fr.croissant", "fr.merci"]) assert.ok(used.includes(id), id);
  assert.ok(summary.vocabulary.length >= 15);
  // The player said they were new (full support), then answered eight questions first try:
  // support has stepped down once, from behaviour, and not jumped further.
  assert.deepEqual([save.learningSupport.level, save.learningSupport.basis], ["guided", "observed"]);
});
