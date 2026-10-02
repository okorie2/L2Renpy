import assert from "node:assert/strict";
import test from "node:test";
import { chapterOneLocations, chapterOneQuests, createStartingPlayer } from "../src/content/chapter1";
import { SAVE_VERSION, type GameSave, type Quest } from "../src/core/models";
import { createInitialSave, questGuidance } from "../src/core/quests";
import { travelThroughPortal, updatePlayerPosition } from "../src/core/world";
import { startDialogue, stepDialogue, type DialogueInput } from "../src/dialogue/engine";
import { french } from "../src/languages/fr";
import { createAutosave } from "../src/save/autosave";
import { decodeSave, encodeSave } from "../src/save/codec";
import { createMemoryStorage } from "../src/save/storage";
import { createSaveStore, reconcileSave, SAVE_KEY } from "../src/save/store";

const content = { quests: chapterOneQuests, locations: chapterOneLocations, startingPlayer: createStartingPlayer("fr") };
const context = { quests: chapterOneQuests, intents: french.intents, slots: french.slots, vocabulary: french.vocabulary, now: "2026-10-02T10:00:00.000Z" };
const SAVED_AT = "2026-10-02T12:00:00.000Z";
const newSave = () => createInitialSave(createStartingPlayer("fr"), chapterOneQuests);
const store = (storage = createMemoryStorage()) => ({ storage, store: createSaveStore(storage, content, { now: () => SAVED_AT }) });

/** A save with real progress in every part: profile, quests, dialogue, learning evidence and support. */
function playedSave(): GameSave {
  // The game opens on the street, where Sophie welcomes the player.
  let save = newSave();
  const meet = french.dialogues.meetSophie;
  let session = startDialogue(meet, "sophie");
  for (let guard = 0; session.status !== "completed" && guard < 40; guard++) {
    const response = meet.nodes[session.nodeId].response;
    const input: DialogueInput = !response ? { type: "CONTINUE", assistance: [] }
      : response.kind === "text" ? { type: "ANSWER", value: "Léa", assistance: [] }
      : response.kind === "choice" ? { type: "ANSWER", value: session.nodeId === "askExperience" ? "some" : "travel", assistance: [] }
      : response.kind === "practice" ? { type: "PRACTICED", assistance: [] }
      : { type: "SAY", text: "Je m'appelle Léa.", mode: "speech", assistance: [] };
    ({ session, save } = stepDialogue(session, meet, input, save, context));
  }
  assert.equal(session.status, "completed");
  return save;
}

test("a played game comes back exactly as it was left", () => {
  const save = playedSave();
  assert.equal(save.player.profile.displayName, "Léa");
  assert.ok(save.evidenceLog.length > 0 && save.completedDialogueIds.includes("meetSophie"));

  const { storage, store: first } = store();
  assert.deepEqual(first.load(), { status: "none" });
  assert.equal(first.write(save), "saved");

  // A new store over the same storage stands for the app being closed and reopened.
  const loaded = createSaveStore(storage, content).load();
  assert.deepEqual(loaded, { status: "loaded", save, savedAt: SAVED_AT });
  assert.equal(loaded.status === "loaded" && questGuidance(loaded.save, chapterOneQuests)?.text, questGuidance(save, chapterOneQuests)?.text);
});

test("a save that cannot be trusted is set aside, never half-loaded", () => {
  const good = JSON.parse(encodeSave(playedSave(), SAVED_AT)) as { save: Record<string, unknown> };
  const broken = (change: (save: Record<string, any>) => void) => {
    const copy = structuredClone(good);
    change(copy.save);
    return JSON.stringify(copy);
  };
  const unreadable = [
    "not json", "null", "{}", JSON.stringify({ save: { version: "1" } }),
    broken((save) => { delete save.questProgress; }),
    broken((save) => { save.player.position = { x: "left", y: 0 }; }),
    broken((save) => { save.player.xp = -5; }),
    broken((save) => { save.questProgress.cafe.status = "won"; }),
    broken((save) => { save.inventory.coffee = "many"; }),
    broken((save) => { save.evidenceLog[0].modality = "telepathy"; }),
    broken((save) => { save.learningSupport.level = "max"; }),
    broken((save) => { Object.values<any>(save.conceptMastery)[0].byModality.reading.attempts = null; })
  ];
  for (const text of unreadable) assert.deepEqual(decodeSave(text), { status: "unreadable" }, text.slice(0, 60));

  const { storage, store: opened } = store(createMemoryStorage({ [SAVE_KEY]: "not json" }));
  assert.deepEqual(opened.load(), { status: "unreadable" });
  assert.equal(storage.entries.get(`${SAVE_KEY}.unreadable`), "not json", "the original is kept");
  assert.equal(opened.write(newSave()), "saved", "a new game can then be saved");

  opened.clear();
  assert.equal(storage.entries.size, 0, "starting over erases everything stored");
});

test("the profile is cleaned on the way in like any other answer", () => {
  const stored = JSON.parse(encodeSave(playedSave(), SAVED_AT));
  stored.save.player.profile = { displayName: "  <b>Léa</b> {x} ", motivation: "fame", targetLanguageExperience: "some", age: 31 };
  const decoded = decodeSave(JSON.stringify(stored));
  assert.equal(decoded.status, "ok");
  assert.deepEqual(decoded.status === "ok" && decoded.save.player.profile, { displayName: "bLéa/b x", targetLanguageExperience: "some" });
});

test("a save from a newer version is left alone and never overwritten", () => {
  const newer = JSON.stringify({ savedAt: SAVED_AT, save: { ...playedSave(), version: SAVE_VERSION + 1, somethingNew: true } });
  const { storage, store: opened } = store(createMemoryStorage({ [SAVE_KEY]: newer }));
  assert.deepEqual(opened.load(), { status: "newer" });
  assert.equal(opened.write(newSave()), "protected");
  assert.equal(storage.entries.get(SAVE_KEY), newer);

  // Only the player's own decision to start over removes it.
  opened.clear();
  assert.equal(opened.write(newSave()), "saved");
});

test("older saves are upgraded one version at a time", () => {
  const current = JSON.parse(encodeSave(playedSave(), SAVED_AT)).save as Record<string, unknown>;
  // An imagined earlier shape: no inventory, and dialogues under an old name.
  const { inventory, completedDialogueIds, ...rest } = current;
  const old = JSON.stringify({ savedAt: SAVED_AT, save: { ...rest, finishedDialogues: completedDialogueIds, version: SAVE_VERSION - 1 } });
  const migrations = {
    [SAVE_VERSION - 1]: ({ finishedDialogues, ...save }: Record<string, unknown>) => ({ ...save, completedDialogueIds: finishedDialogues, inventory: {} })
  };

  const decoded = decodeSave(old, migrations);
  assert.equal(decoded.status, "ok");
  if (decoded.status !== "ok") return;
  assert.equal(decoded.migratedFrom, SAVE_VERSION - 1);
  assert.equal(decoded.save.version, SAVE_VERSION);
  assert.deepEqual(decoded.save.completedDialogueIds, completedDialogueIds);
  assert.deepEqual(decoded.save.inventory, {});
  assert.notEqual(inventory, undefined);

  assert.deepEqual(decodeSave(old, {}), { status: "unreadable" }, "no upgrade path means it is not guessed at");
  assert.deepEqual(decodeSave(old, { [SAVE_VERSION - 1]: () => { throw new Error("bad step"); } }), { status: "unreadable" });
});

test("a loaded save is brought in line with the content the game ships now", () => {
  const save = playedSave();
  const epilogue: Quest = { id: "epilogue", chapter: 1, title: "Épilogue", summary: "", prerequisites: ["meetSophie"], objectives: [], rewards: [] };
  const later: Quest = { ...epilogue, id: "later", prerequisites: ["goodbye"] };
  const grown = reconcileSave(save, { ...content, quests: [...chapterOneQuests, epilogue, later] });
  assert.equal(grown.questProgress.epilogue.status, "active", "its prerequisite was already done");
  assert.equal(grown.questProgress.later.status, "locked");
  assert.deepEqual(grown.questProgress.meetSophie, save.questProgress.meetSophie);

  const shrunk = reconcileSave(save, { ...content, quests: chapterOneQuests.slice(0, 2) });
  assert.deepEqual(shrunk.questProgress, save.questProgress, "progress on removed quests is kept");

  const lost = reconcileSave({ ...save, player: { ...save.player, locationId: "moon", position: { x: 0.9, y: 0.9 } } }, content);
  assert.deepEqual([lost.player.locationId, lost.player.position], [content.startingPlayer.locationId, content.startingPlayer.position]);
  assert.equal(lost.player.xp, save.player.xp);

  const outside = reconcileSave(updatePlayerPosition(save, { x: 4, y: 0.5 }), content);
  assert.deepEqual(outside.player.position, { x: 1, y: 0.5 });
  assert.equal(reconcileSave(save, content).questProgress, save.questProgress, "an up-to-date save is not rewritten");
});

test("progress is written at once; walking around is written sparingly", () => {
  const written: GameSave[] = [];
  const pending: Array<() => void> = [];
  const autosave = createAutosave((save) => written.push(save), {
    timers: { set: (callback) => pending.push(callback), clear: () => { pending.length = 0; } }
  });

  const start = newSave();
  autosave.update(start);
  autosave.update(start);
  assert.equal(written.length, 1, "the same state is not written twice");

  let save = start;
  for (let step = 1; step <= 5; step++) {
    save = updatePlayerPosition(save, { x: step / 10, y: 0.5 });
    autosave.update(save);
  }
  assert.equal(written.length, 1);
  assert.equal(pending.length, 1, "one write is waiting, however many steps were taken");
  pending.pop()!();
  assert.deepEqual(written.at(-1)!.player.position, { x: 0.5, y: 0.5 });

  save = updatePlayerPosition(save, { x: 0.6, y: 0.5 });
  autosave.update(save);
  const travelled = travelThroughPortal(save, chapterOneLocations, chapterOneLocations.find((item) => item.id === save.player.locationId)!.portals[0].id, chapterOneQuests);
  autosave.update(travelled);
  assert.equal(written.at(-1), travelled, "a change of place is progress");
  assert.equal(pending.length, 0);

  autosave.update(updatePlayerPosition(travelled, { x: 0.2, y: 0.2 }));
  autosave.flush();
  assert.equal(written.length, 4, "going to the background writes what is waiting");
  autosave.flush();
  assert.equal(written.length, 4);

  autosave.update(updatePlayerPosition(travelled, { x: 0.3, y: 0.3 }));
  autosave.reset();
  autosave.flush();
  assert.equal(written.length, 4, "starting over drops what was waiting");
});

test("a device that cannot store anything still runs the game", () => {
  const blocked = {
    read: () => { throw new Error("blocked"); },
    write: () => { throw new Error("full"); },
    remove: () => { throw new Error("blocked"); }
  };
  const opened = createSaveStore(blocked, content);
  assert.deepEqual(opened.load(), { status: "none" });
  assert.equal(opened.write(newSave()), "failed");
  assert.doesNotThrow(() => opened.clear());

  // Unreadable and no room for a copy: the original must not be overwritten.
  const full = createMemoryStorage({ [SAVE_KEY]: "not json" });
  const noRoom = createSaveStore({ ...full, write: () => { throw new Error("full"); } }, content);
  assert.deepEqual(noRoom.load(), { status: "unreadable" });
  assert.equal(noRoom.write(newSave()), "protected");
  assert.equal(full.entries.get(SAVE_KEY), "not json");
});
