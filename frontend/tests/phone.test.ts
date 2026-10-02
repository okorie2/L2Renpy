import assert from "node:assert/strict";
import test from "node:test";
import { chapterOneLocations, chapterOneMessages, chapterOneNpcs, chapterOneQuests, createStartingPlayer } from "../src/content/chapter1";
import type { GameSave, MessageThread } from "../src/core/models";
import { SAVE_VERSION } from "../src/core/models";
import { createInitialSave, questGuidance } from "../src/core/quests";
import { travelThroughPortal } from "../src/core/world";
import { startDialogue, stepDialogue } from "../src/dialogue/engine";
import { validateDialogue } from "../src/dialogue/validate";
import { french } from "../src/languages/fr";
import { mapPlaces, metCharacters, objectiveLocationId } from "../src/phone/directory";
import { deliverMessages, markThreadRead, saveThreadSession, threadAwaitsPlayer, unreadThreadIds } from "../src/phone/messages";
import { decodeSave, encodeSave } from "../src/save/codec";
import { createMemoryStorage } from "../src/save/storage";
import { createSaveStore, reconcileSave, SAVE_KEY } from "../src/save/store";

const now = "2026-10-02T18:00:00.000Z";
const context = { quests: chapterOneQuests, intents: french.intents, slots: french.slots, vocabulary: french.vocabulary, now };
const content = { quests: chapterOneQuests, locations: chapterOneLocations, startingPlayer: createStartingPlayer("fr"), dialogues: french.dialogues };
const newSave = () => createInitialSave(createStartingPlayer("fr"), chapterOneQuests);
const deliver = (save: GameSave, threads: MessageThread[] = chapterOneMessages) => deliverMessages(save, threads, french.dialogues, chapterOneQuests, now);
/** At home with only Sophie's message left to do. */
const evening = (): GameSave => {
  const save = newSave();
  const done = { status: "completed" as const, completedObjectiveIds: [], objectiveCounts: {} };
  return {
    ...save,
    questProgress: {
      meetSophie: done, cafe: done, bakery: done, neighborhood: done,
      goodbye: { status: "active", completedObjectiveIds: ["goHome"], objectiveCounts: {} }
    }
  };
};

test("a message arrives once, when its moment comes, and is never taken back", () => {
  const early = newSave();
  assert.equal(deliver(early), early, "nothing before its conditions hold");

  let save = deliver(evening());
  const state = save.messages.sophieEvening;
  assert.deepEqual([state.receivedAt, state.unread, state.session.nodeId, state.session.npcId], [now, true, "hi", "sophie"]);
  assert.deepEqual(unreadThreadIds(save), ["sophieEvening"]);
  assert.equal(threadAwaitsPlayer(state), true);
  assert.equal(deliver(save), save, "not delivered twice");

  save = markThreadRead(save, "sophieEvening");
  assert.deepEqual(unreadThreadIds(save), []);
  assert.equal(markThreadRead(save, "sophieEvening"), save);
  assert.equal(markThreadRead(save, "nobody"), save);

  // Threads for dialogues the game does not have are simply not delivered.
  assert.deepEqual(deliver(evening(), [{ id: "ghost", contactId: "sophie", dialogueId: "missing", when: [] }]).messages, {});
});

test("a thread is an ordinary dialogue whose place is kept in the save", () => {
  let save = markThreadRead(deliver(evening()), "sophieEvening");
  const dialogue = french.dialogues.sophieMessage;
  const step = (input: Parameters<typeof stepDialogue>[2]) => {
    const result = stepDialogue(save.messages.sophieEvening.session, dialogue, input, save, context);
    save = saveThreadSession(result.save, "sophieEvening", result.session);
    return result.result;
  };

  assert.equal(step({ type: "CONTINUE", assistance: [] }), "advanced");
  assert.equal(questGuidance(save, chapterOneQuests)?.text, "Answer Sophie", "reading the first message is a quest step");
  assert.equal(step({ type: "SAY", text: "Un café", mode: "typed", assistance: [] }), "repair");
  assert.equal(save.messages.sophieEvening.session.nodeId, "repairFine");
  assert.equal(step({ type: "CONTINUE", assistance: [] }), "advanced");
  assert.equal(step({ type: "SAY", text: "ça va bien merci", mode: "typed", assistance: [] }), "advanced");
  assert.equal(step({ type: "CONTINUE", assistance: [] }), "advanced");
  // Declining is as good an answer as accepting.
  assert.equal(step({ type: "SAY", text: "Non, merci.", mode: "typed", assistance: [] }), "advanced");
  assert.equal(step({ type: "CONTINUE", assistance: [] }), "completed");

  assert.equal(save.questProgress.goodbye.status, "completed");
  assert.equal(threadAwaitsPlayer(save.messages.sophieEvening), false);
  assert.equal(save.messages.sophieEvening.session.history.length, 7, "the whole exchange stays readable, misses included");
  assert.equal(save.evidenceLog.at(-2)!.modality, "writing", "messages are written, never credited as speaking");
  assert.equal(saveThreadSession(save, "nobody", startDialogue(dialogue)), save);

  assert.deepEqual(validateDialogue(dialogue, {
    speakerIds: ["player", ...chapterOneNpcs.map((npc) => npc.id)], slotSamples: { playerName: "Léa" }, intents: french.intents, itemIds: []
  }), []);
  for (const thread of chapterOneMessages) {
    assert.ok(french.dialogues[thread.dialogueId] && chapterOneNpcs.some((npc) => npc.id === thread.contactId), thread.id);
  }
});

test("the phone survives a restart, and older saves gain one", () => {
  let save = markThreadRead(deliver(evening()), "sophieEvening");
  const first = stepDialogue(save.messages.sophieEvening.session, french.dialogues.sophieMessage, { type: "CONTINUE", assistance: [] }, save, context);
  const second = stepDialogue(first.session, french.dialogues.sophieMessage, { type: "SAY", text: "Ça va bien, merci !", mode: "typed", assistance: [] }, first.save, context);
  save = saveThreadSession(second.save, "sophieEvening", second.session);

  const storage = createMemoryStorage();
  createSaveStore(storage, content).write(save);
  const loaded = createSaveStore(storage, content).load();
  // Stored as JSON, so "absent" and "undefined" are the same thing.
  assert.deepEqual(loaded.status === "loaded" && loaded.save, JSON.parse(JSON.stringify(save)));
  assert.equal(JSON.parse(storage.entries.get(SAVE_KEY)!).save.version, SAVE_VERSION);

  // A stored thread is checked as strictly as the rest of the save.
  const stored = () => JSON.parse(encodeSave(save, now));
  for (const spoil of [
    (data: any) => { data.save.messages.sophieEvening.unread = "yes"; },
    (data: any) => { data.save.messages.sophieEvening.session.status = "paused"; },
    (data: any) => { data.save.messages.sophieEvening.session.history[1].said.mode = "telepathy"; },
    (data: any) => { data.save.messages.sophieEvening.session.history[1].said.usedWords = [{ start: 0, end: 999 }]; },
    (data: any) => { delete data.save.visitedLocationIds; }
  ]) {
    const data = stored();
    spoil(data);
    assert.deepEqual(decodeSave(JSON.stringify(data)), { status: "unreadable" });
  }

  // Version 1 had no phone. It is upgraded, not rejected.
  const { messages, visitedLocationIds, ...versionOne } = JSON.parse(encodeSave(evening(), now)).save;
  const upgraded = decodeSave(JSON.stringify({ savedAt: now, save: { ...versionOne, version: 1 } }));
  assert.equal(upgraded.status, "ok");
  if (upgraded.status !== "ok") return;
  assert.deepEqual([upgraded.migratedFrom, upgraded.save.version, upgraded.save.messages, upgraded.save.visitedLocationIds], [1, SAVE_VERSION, {}, [upgraded.save.player.locationId]]);
  assert.ok(messages && visitedLocationIds);
  // The message it never received arrives as soon as the game looks.
  assert.deepEqual(unreadThreadIds(deliver(upgraded.save)), ["sophieEvening"]);

  // A thread left on a line the dialogue no longer has starts again; nothing else is touched.
  const moved = saveThreadSession(save, "sophieEvening", { ...save.messages.sophieEvening.session, nodeId: "removedLine" });
  const repaired = reconcileSave(moved, content);
  assert.deepEqual([repaired.messages.sophieEvening.session.nodeId, repaired.messages.sophieEvening.unread], ["hi", true]);
  assert.equal(reconcileSave(save, content).messages, save.messages);
});

test("contacts and the map show only what the player has found", () => {
  let save = newSave();
  assert.deepEqual(metCharacters(save, chapterOneNpcs), []);
  assert.deepEqual(mapPlaces(save, chapterOneLocations, chapterOneNpcs, chapterOneQuests).filter((place) => place.visited).map((place) => place.location.id), ["neighborhood"]);

  save = { ...save, completedDialogueIds: ["meetSophie"] };
  assert.deepEqual(metCharacters(save, chapterOneNpcs).map((npc) => npc.id), ["sophie"]);
  const places = Object.fromEntries(mapPlaces(save, chapterOneLocations, chapterOneNpcs, chapterOneQuests).map((place) => [place.location.id, place]));
  assert.deepEqual([places.neighborhood.here, places.neighborhood.visited, places.cafe.visited], [true, true, false]);
  assert.deepEqual(places.neighborhood.people.map((npc) => npc.id), ["sophie"]);
  assert.equal(places.neighborhood.objective, "Tell Sophie your name", "the next step is marked where it happens");
  assert.deepEqual(places.cafe.people, [], "nobody is shown before they are met");

  const objectives = Object.fromEntries(chapterOneQuests.flatMap((quest) => quest.objectives.map((objective) => [`${quest.id}.${objective.id}`, objectiveLocationId(objective, chapterOneNpcs)])));
  assert.equal(objectives["cafe.enterCafe"], "cafe");
  assert.equal(objectives["cafe.orderDrink"], "cafe");
  assert.equal(objectives["goodbye.goHome"], "apartment");
  assert.equal(objectives["goodbye.answerSophie"], undefined, "a message can be answered anywhere");
});
