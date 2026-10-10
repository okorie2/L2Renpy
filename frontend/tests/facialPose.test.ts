import assert from "node:assert/strict";
import test from "node:test";
import { facialPose } from "../src/world3d/facialPose";

test("facial motion is deterministic at a held story time", () => {
  assert.deepEqual(facialPose(12.3, 0.6, 1.3), facialPose(12.3, 0.6, 1.3));
});

test("silent characters keep a closed mouth and speech fades with its cue", () => {
  for (const time of [0, 0.2, 1, 5, 10]) {
    assert.equal(facialPose(time, 0).mouth, 0);
    assert.equal(Math.abs(facialPose(time, 0).nod), 0);
    assert.ok(facialPose(time, 1).mouth > 0);
    assert.equal(facialPose(time, 0.5).mouth, facialPose(time, 1).mouth * 0.5);
    assert.equal(facialPose(time, -1).mouth, 0);
  }
});

test("blinks are brief, staggered between actors, and all expression weights stay bounded", () => {
  assert.ok(facialPose(0.095, 0).blink > 0.99);
  assert.equal(facialPose(0.3, 0).blink, 0);
  assert.equal(facialPose(0.095, 0, 1.3).blink, 0);
  for (let time = 0; time < 20; time += 0.01) {
    const pose = facialPose(time, 2);
    assert.ok(pose.blink >= 0 && pose.blink <= 1);
    assert.ok(pose.mouth >= 0 && pose.mouth <= 1);
    assert.ok(Math.abs(pose.nod) <= 0.025);
  }
});
