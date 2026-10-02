import assert from "node:assert/strict";
import test from "node:test";
import { chapterOneItems, chapterOneNpcs, chapterOneQuests, createStartingPlayer } from "../src/content/chapter1";
import { selectNpcDialogueId } from "../src/core/conditions";
import { updatePlayerProfile } from "../src/core/player";
import { applyGameEvent, createInitialSave } from "../src/core/quests";
import { PLAYER_SPEAKER_ID } from "../src/dialogue/models";
import { applyDialogueResponse } from "../src/dialogue/responses";
import { buildSlotValues, resolveDialogueLine, resolveTemplate, templateSlots } from "../src/dialogue/template";
import { validateDialogue } from "../src/dialogue/validate";
import { french } from "../src/languages/fr";

const newSave = () => createInitialSave(createStartingPlayer("fr"), chapterOneQuests);

const references = {
  speakerIds: [PLAYER_SPEAKER_ID, ...chapterOneNpcs.map((npc) => npc.id)],
  slotSamples: Object.fromEntries(
    Object.entries(buildSlotValues(french.slots, { displayName: "Samuel", motivation: "travel" })).map(([name, value]) => [name, value.target])
  ),
  intents: french.intents,
  itemIds: chapterOneItems.map((item) => item.id)
};

test("every French dialogue is internally consistent", () => {
  for (const dialogue of Object.values(french.dialogues)) {
    assert.deepEqual(validateDialogue(dialogue, references), [], dialogue.id);
  }
});

test("the validator reports broken references", () => {
  const problems = validateDialogue({
    id: "broken",
    startNodeId: "missing",
    nodes: {
      a: {
        id: "a", speakerId: "nobody", targetText: "Bonjour {who}.", nextNodeId: "gone", conceptIds: [],
        assessment: { excludedSpans: ["other"] },
        branches: [{ when: [], nextNodeId: "nowhere" }],
        effects: [{ type: "GIVE_ITEM", itemId: "ghost" }],
        response: { kind: "say", exerciseId: "x", intentId: "none", prompt: "", repairNodeId: "lost" }
      },
      b: {
        id: "b", speakerId: PLAYER_SPEAKER_ID, targetText: "Au revoir !", conceptIds: [],
        response: { kind: "say", exerciseId: "y", intentId: "greet", prompt: "", options: [{ id: "o", text: "Merci !" }] }
      }
    }
  }, { ...references, speakerIds: [PLAYER_SPEAKER_ID] });
  assert.equal(problems.length, 12, problems.join("\n"));
});

test("slots are filled and their positions reported", () => {
  const resolved = resolveTemplate("Je m'appelle {playerName}.", { playerName: "Marie Claire" }, ["playerName"]);
  assert.equal(resolved.text, "Je m'appelle Marie Claire.");
  assert.deepEqual(resolved.spans, [{ slot: "playerName", start: 13, end: 25, scored: false }]);
  assert.equal(resolved.text.slice(13, 25), "Marie Claire");
});

test("exclusion is generic: any named span can be left unscored", () => {
  const resolved = resolveTemplate(
    "{playerName} habite à {city}, près du {shop}.",
    { playerName: "Ana", city: "Lyon", shop: "Monoprix" },
    ["city", "shop"]
  );
  assert.equal(resolved.text, "Ana habite à Lyon, près du Monoprix.");
  assert.deepEqual(resolved.spans.map((span) => [span.slot, span.scored]), [
    ["playerName", true], ["city", false], ["shop", false]
  ]);
  for (const span of resolved.spans) assert.ok(span.end > span.start);
});

test("unknown slots stay visible and repeated slots are all replaced", () => {
  assert.equal(resolveTemplate("Salut {nobody} !", {}).text, "Salut {nobody} !");
  const repeated = resolveTemplate("{n}, {n} !", { n: "Léa" });
  assert.equal(repeated.text, "Léa, Léa !");
  assert.equal(repeated.spans.length, 2);
  assert.deepEqual(templateSlots("{a} {b} {a}"), ["a", "b"]);
});

test("personal values stay in the profile; canonical French stays in the pack", () => {
  const empty = buildSlotValues(french.slots, {});
  assert.equal(empty.playerName.target, "toi");
  assert.equal(empty.motivationPhrase.target, "pour le plaisir");

  const values = buildSlotValues(french.slots, { displayName: "Samuel", motivation: "travel" });
  const example = resolveDialogueLine(french.dialogues.meetSophie.nodes.example, values);
  assert.equal(example.target.text, "Je m'appelle Samuel.\nJe voudrais apprendre à parler français pour voyager.\nMon niveau actuel en français est débutant.");
  assert.equal(example.translation?.text, "My name is Samuel.\nI would like to learn French for travel.\nMy current French level is beginner.");
  const turn = resolveDialogueLine(french.dialogues.meetSophie.nodes.yourTurn, values);
  assert.equal(turn.target.text, "Je m'appelle Samuel.");
  assert.deepEqual(turn.target.spans.filter((span) => !span.scored).map((span) => span.slot), ["playerName"]);
  assert.ok(!JSON.stringify(french).includes("Samuel"));
});

test("profile answers are validated and never demand more than a nickname", () => {
  const save = newSave();
  assert.deepEqual(save.player.profile, {});
  assert.equal(updatePlayerProfile(save, "displayName", "   ").player.profile.displayName, undefined);
  assert.equal(updatePlayerProfile(save, "displayName", "  Sam {x} <b>  ").player.profile.displayName, "Sam x b");
  assert.equal(updatePlayerProfile(save, "displayName", "a".repeat(80)).player.profile.displayName?.length, 30);
  assert.equal(updatePlayerProfile(save, "motivation", "world-domination"), save);
  assert.equal(updatePlayerProfile(save, "motivation", "people").player.profile.motivation, "people");
});

test("self-reported experience only seeds the support level", () => {
  const node = french.dialogues.meetSophie.nodes.askExperience;
  assert.ok(node.response && node.response.kind === "choice");
  const save = newSave();
  assert.deepEqual(save.learningSupport, { level: "full", basis: "default" });

  const guided = applyDialogueResponse(save, node.response, "some");
  assert.deepEqual(guided.learningSupport, { level: "guided", basis: "self-reported" });
  assert.equal(guided.player.xp, save.player.xp);

  const observed = { ...save, learningSupport: { level: "full" as const, basis: "observed" as const } };
  assert.equal(applyDialogueResponse(observed, node.response, "conversational").learningSupport.level, "full");
  assert.equal(applyDialogueResponse(save, node.response, "expert"), save);
});

test("Sophie does not repeat her introduction after it is completed", () => {
  const sophie = chapterOneNpcs.find((npc) => npc.id === "sophie");
  assert.ok(sophie);
  const save = newSave();
  assert.equal(selectNpcDialogueId(sophie, save, chapterOneQuests), "meetSophie");
  const met = applyGameEvent(save, chapterOneQuests, { type: "DIALOGUE_COMPLETED", dialogueId: "meetSophie", npcId: "sophie" });
  assert.deepEqual(met.completedDialogueIds, ["meetSophie"]);
  assert.notEqual(selectNpcDialogueId(sophie, met, chapterOneQuests), "meetSophie");
});
