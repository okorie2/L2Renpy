import assert from "node:assert/strict";
import test from "node:test";
import { STORY, goalConcepts, partStates } from "../src/content/story";
import { french } from "../src/languages/fr";
import { CONCEPT_IDS, type LoggedEvidence } from "../src/learning/models";
import { attemptScore, conceptReadiness, goalReadiness } from "../src/learning/readiness";

const attempt = (seq: number, outcome: LoggedEvidence["outcome"], attempts: number, assistance: LoggedEvidence["assistance"] = []): LoggedEvidence => ({
  seq, conceptIds: [CONCEPT_IDS.INTRODUCE_SELF], vocabularyIds: [], modality: "speaking", outcome, assistance, attempts,
  at: "2026-10-06T00:00:00Z", supportLevel: "full"
});

test("an answer alone, first time, shows the most; help and retries show less; a miss shows nothing", () => {
  assert.equal(attemptScore({ outcome: "successful", assistance: [], attempts: 1 }), 1);
  assert.ok(attemptScore({ outcome: "successful", assistance: ["translation"], attempts: 3 }) < 0.6);
  assert.equal(attemptScore({ outcome: "successful", assistance: ["typed-fallback"], attempts: 1 }), 1, "typing instead of speaking isn't help");
  assert.equal(attemptScore({ outcome: "unsuccessful", assistance: [], attempts: 1 }), 0);
});

test("a replay adds to the record, and doing better recently raises readiness", () => {
  // First play: needed the translation and three tries.
  const first = [attempt(1, "unsuccessful", 1, ["translation"]), attempt(2, "unsuccessful", 2, ["translation"]), attempt(3, "successful", 3, ["translation"])];
  const before = conceptReadiness({ evidenceLog: first }, CONCEPT_IDS.INTRODUCE_SELF)!;
  // Replay: understood straight away, right first time.
  const after = conceptReadiness({ evidenceLog: [...first, attempt(4, "successful", 1)] }, CONCEPT_IDS.INTRODUCE_SELF)!;
  assert.ok(after > before * 2, `${before} → ${after}`);
  // The old attempts still count: one good answer isn't the same as a clean record.
  assert.ok(after < conceptReadiness({ evidenceLog: [attempt(4, "successful", 1)] }, CONCEPT_IDS.INTRODUCE_SELF)!);
  assert.equal(conceptReadiness({ evidenceLog: [] }, CONCEPT_IDS.INTRODUCE_SELF), undefined);
});

test("Goal 1 has three parts: the meeting, the walk, and the café still to come", () => {
  const goal = STORY[0];
  assert.deepEqual(goal.parts.map((part) => part.dialogueId), ["meetSophie", "walkToCafe", undefined]);
  assert.deepEqual(partStates({ completedDialogueIds: [] }, goal), ["current", "locked", "coming-soon"]);
  assert.deepEqual(partStates({ completedDialogueIds: ["meetSophie"] }, goal), ["done", "current", "coming-soon"]);
  assert.deepEqual(partStates({ completedDialogueIds: ["meetSophie", "walkToCafe"] }, goal), ["done", "done", "coming-soon"]);
  const concepts = goalConcepts(french, goal);
  assert.ok(concepts.includes(CONCEPT_IDS.INTRODUCE_SELF) && concepts.includes(CONCEPT_IDS.GREETING));
  assert.equal(goalReadiness({ evidenceLog: [] }, concepts), "not-started");
});
