import assert from "node:assert/strict";
import test from "node:test";
import { chapterOneQuests, createStartingPlayer } from "../src/content/chapter1";
import { createInitialSave } from "../src/core/quests";
import { startDialogue } from "../src/dialogue/engine";
import { skipLine } from "../src/dialogue/skip";
import { french } from "../src/languages/fr";

test("builder mode skips every card of both scenes, answering nothing and recording no learning", () => {
  const context = { quests: chapterOneQuests, slots: french.slots };
  let save = createInitialSave(createStartingPlayer("fr"), chapterOneQuests);
  for (const id of ["meetSophie", "walkToCafe"]) {
    const dialogue = french.dialogues[id];
    let session = startDialogue(dialogue, "sophie");
    for (let guard = 0; session.status === "active"; guard++) {
      assert.ok(guard < 200, `${id} never ends`);
      const step = skipLine(session, dialogue, save, context);
      assert.notEqual(step.result, "ignored", `${id}: stuck at ${session.nodeId}`);
      session = step.session;
      save = step.save;
    }
    assert.ok(save.completedDialogueIds.includes(id), `${id} counts as done, so the next part follows`);
  }
  assert.equal(save.evidenceLog.length, 0, "nothing is recorded as learning");
  assert.ok(save.player.profile.displayName, "a name is filled in for the lines that use it");
});
