import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { chapterOneNpcs } from "../src/content/chapter1";
import { characterVisuals } from "../src/characters/catalog";
import { listCharacterAssetPaths, resolveConversationVisual, resolveWorldVisual, worldFrames } from "../src/characters/resolve";
import { chapterOneLocations } from "../src/content/chapter1";
import { CHARACTER_EXPRESSIONS, WORLD_POSES } from "../src/characters/types";

const assetRoot = join("public", "assets");

/** Width and height from a PNG's header. */
const pngSize = (path: string) => {
  const header = readFileSync(join(assetRoot, path)).subarray(16, 24);
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
};

/** Width and height of a PNG or WebP file. */
const imageSize = (path: string) => {
  if (path.endsWith(".png")) return pngSize(path);
  const data = readFileSync(join(assetRoot, path));
  const kind = data.toString("ascii", 12, 16);
  if (kind === "VP8X") return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
  if (kind === "VP8L") {
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
};

test("game code asks for Sophie by character, expression and activity", () => {
  const visual = resolveConversationVisual({ character: "sophie", expression: "question", activity: "speaking" });
  assert.ok(visual);
  assert.equal(visual.expression, "question");
  assert.equal(visual.activity, "speaking");
  assert.equal(visual.path, "characters/sophie/conversation/question/closed.png");
  assert.equal(visual.mouthOverlay?.path, "characters/sophie/conversation/question/mouth-open.png");
});

test("speaking changes only the mouth: one master portrait plus a small patch", () => {
  const { canvas, mouthRect, expressions } = characterVisuals.sophie.conversation!;
  assert.ok(mouthRect);
  // Turned away, she is shown as drawn: there is no mouth to move.
  const turnedAway = new Set(["inviting", "goodbye"]);
  for (const expression of CHARACTER_EXPRESSIONS) {
    const closed = resolveConversationVisual({ character: "sophie", expression, activity: "closed" });
    const speaking = resolveConversationVisual({ character: "sophie", expression, activity: "speaking" });
    assert.ok(closed && speaking, expression);
    assert.equal(closed.requestedExpression, expression);
    assert.equal(closed.mouthOverlay, undefined);
    // The same base image in both states is what keeps the rest of her still.
    assert.equal(speaking.path, closed.path, expression);
    assert.deepEqual(imageSize(closed.path), canvas, closed.path);
    if (turnedAway.has(expression)) {
      assert.equal(speaking.mouthOverlay, undefined, expression);
      continue;
    }

    const mouth = speaking.mouthOverlay;
    const rect = expressions[speaking.expression]?.mouthRect ?? mouthRect;
    assert.ok(mouth, `${expression} has a mouth patch`);
    assert.deepEqual(pngSize(mouth.path), { width: rect.width, height: rect.height }, mouth.path);
    assert.equal(mouth.left, rect.x / canvas.width, `${expression}'s patch sits on its own mouth`);
    assert.ok(mouth.left >= 0 && mouth.top >= 0 && mouth.left + mouth.width <= 1 && mouth.top + mouth.height <= 1);
    // A patch, not a second portrait: it covers a small fraction of the canvas.
    assert.ok(mouth.width * mouth.height < 0.02, expression);
  }
});

test("expressions without dedicated art borrow the nearest approved pose", () => {
  assert.equal(resolveConversationVisual({ character: "sophie", expression: "happy" })?.expression, "pleased");
  assert.equal(resolveConversationVisual({ character: "sophie", expression: "confused" })?.expression, "question");
  assert.equal(resolveConversationVisual({ character: "sophie" })?.expression, "neutral");
  assert.equal(resolveConversationVisual({ character: "sophie" })?.activity, "closed");
});

test("characters without art resolve to nothing instead of a broken image", () => {
  assert.equal(resolveConversationVisual({ character: "stranger", expression: "neutral" }), undefined);
  assert.equal(resolveWorldVisual("stranger"), undefined);
  assert.deepEqual(listCharacterAssetPaths("stranger"), []);
});

test("everyone you talk to has four close-ups on one canvas", () => {
  for (const npc of chapterOneNpcs) {
    const canvas = characterVisuals[npc.appearanceId].conversation!.canvas;
    for (const expression of CHARACTER_EXPRESSIONS) {
      const visual = resolveConversationVisual({ character: npc.appearanceId, expression, activity: "speaking" });
      assert.ok(visual, `${npc.id} ${expression}`);
      assert.deepEqual(imageSize(visual.path), canvas, visual.path);
    }
    assert.equal(resolveConversationVisual({ character: npc.appearanceId })?.expression, "neutral");
  }
  // A close-up without a mouth patch simply keeps its mouth closed while speaking.
  const nadia = resolveConversationVisual({ character: "barista", expression: "question", activity: "speaking" })!;
  assert.deepEqual([nadia.activity, nadia.mouthOverlay], ["closed", undefined]);
});

test("Sophie's world poses all have frames on disk", () => {
  const visual = resolveWorldVisual("sophie");
  assert.ok(visual);
  for (const pose of WORLD_POSES) {
    assert.ok(visual.poses[pose].frames.length > 0, pose);
    for (const frame of visual.poses[pose].frames) assert.ok(existsSync(join(assetRoot, frame)), frame);
  }
  assert.ok(visual.poses.walking.frames.length > 1);
  assert.ok(visual.poses.walking.frameDurationMs > 0);
  // Poses swap in place, so every frame must share one canvas.
  const sizes = new Set(WORLD_POSES.flatMap((pose) => visual.poses[pose].frames).map((frame) => JSON.stringify(pngSize(frame))));
  assert.equal(sizes.size, 1);
});

test("a character faces the way it walks when it has art for that, and the camera when it does not", () => {
  const front = { frames: ["f1", "f2"], frameDurationMs: 100 };
  for (const direction of ["up", "down", "left", "right"] as const) {
    assert.deepEqual(worldFrames(front, direction), { frames: front.frames, mirrored: false }, direction);
  }
  const full = { ...front, back: ["b1"], side: ["s1", "s2"] };
  assert.deepEqual(worldFrames(full, "down"), { frames: full.frames, mirrored: false });
  assert.deepEqual(worldFrames(full, "up"), { frames: full.back, mirrored: false });
  assert.deepEqual(worldFrames(full, "right"), { frames: full.side, mirrored: false });
  assert.deepEqual(worldFrames(full, "left"), { frames: full.side, mirrored: true }, "side art is drawn once and mirrored");
  assert.deepEqual(worldFrames({ ...front, back: [], side: [] }, "up").frames, front.frames);

  // A character with no close-up, such as the player, still has a world figure.
  const worldOnly = { walker: { id: "walker", world: { displayHeight: 96, aspectRatio: 2 / 3, footAnchorY: 1, poses: { idle: full, walking: full, waving: front } } } };
  assert.equal(resolveConversationVisual({ character: "walker" }, worldOnly), undefined);
  assert.ok(resolveWorldVisual("walker", worldOnly));
  assert.deepEqual(listCharacterAssetPaths("walker", worldOnly).sort(), ["b1", "f1", "f2", "s1", "s2"]);
});

test("every piece of art the game refers to is on disk", () => {
  for (const id of Object.keys(characterVisuals)) {
    const paths = listCharacterAssetPaths(id);
    assert.ok(paths.length > 0, id);
    for (const path of paths) assert.ok(existsSync(join(assetRoot, path)), path);
    // Poses swap in place, so one character's world frames share one canvas.
    const visual = resolveWorldVisual(id)!;
    const frames = WORLD_POSES.flatMap((pose) => [...visual.poses[pose].frames, ...(visual.poses[pose].back ?? []), ...(visual.poses[pose].side ?? [])]);
    assert.equal(new Set(frames.map((frame) => JSON.stringify(pngSize(frame)))).size, 1, id);
  }
  for (const location of chapterOneLocations) {
    if (!location.backdrop) continue;
    assert.ok(existsSync(join(assetRoot, location.backdrop)), location.backdrop);
    const size = imageSize(location.backdrop);
    assert.ok(Math.abs(size.width / size.height - location.size.width / location.size.height) < 0.01, `${location.id}: backdrop must have the location's proportions`);
    for (const prop of location.props ?? []) {
      assert.ok(existsSync(join(assetRoot, prop.image)), prop.image);
      // A cut-out is the painting's own pixels, so it must be the size of the area it covers.
      const cut = imageSize(prop.image);
      assert.ok(Math.abs(cut.width - prop.rect.width * size.width) <= 1 && Math.abs(cut.height - prop.rect.height * size.height) <= 1, prop.image);
      assert.ok(prop.base >= prop.rect.y && prop.base <= prop.rect.y + prop.rect.height + 0.01, `${prop.image}: base inside the cut-out`);
    }
  }
});

test("the player has a world figure of their own", () => {
  const visual = resolveWorldVisual("player");
  assert.ok(visual);
  assert.equal(visual.poses.walking.frames.length, 6);
  assert.equal(resolveConversationVisual({ character: "player" }), undefined, "the player is never shown in close-up");
  // Everyone in the world is drawn to one scale.
  assert.equal(visual.displayHeight, resolveWorldVisual("sophie")!.displayHeight);
});

test("everyone in Chapter 1 has a figure in the world, drawn to one scale", () => {
  const heights = new Set<number>();
  for (const id of ["player", ...chapterOneNpcs.map((npc) => npc.appearanceId)]) {
    const visual = resolveWorldVisual(id);
    assert.ok(visual, id);
    heights.add(visual.displayHeight);
  }
  assert.equal(heights.size, 1);
  // The two who walk have a real cycle; the player also turns the way they walk.
  assert.equal(resolveWorldVisual("sophie")!.poses.walking.frames.length, 6);
  const walking = resolveWorldVisual("player")!.poses.walking;
  assert.deepEqual([walking.frames.length, walking.side?.length, walking.back?.length], [6, 6, 6]);
});

test("Sophie is the guide NPC and can be shown in both presentations", () => {
  const sophie = chapterOneNpcs.find((npc) => npc.id === "sophie");
  assert.ok(sophie);
  assert.equal(sophie.name, "Sophie");
  assert.ok(resolveWorldVisual(sophie.appearanceId));
  assert.ok(resolveConversationVisual({ character: sophie.appearanceId }));
});

test("no source file refers to assets by Ren'Py names or to the previous guide", () => {
  const offenders: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) visit(path);
      else if (/\.(ts|tsx|css|html)$/.test(entry) && /camille|scene_1|frontpose/i.test(readFileSync(path, "utf8"))) offenders.push(path);
    }
  };
  visit("src");
  assert.deepEqual(offenders, []);
});

test("Sophie blinks now and then in her standing poses, and the patch matches its place", () => {
  for (const expression of ["neutral", "talking"] as const) {
    const visual = resolveConversationVisual({ character: "sophie", expression })!;
    const blink = characterVisuals.sophie.conversation!.expressions[expression]!.blink!;
    assert.ok(visual.blinkOverlay, expression);
    assert.deepEqual(pngSize(blink.path), { width: blink.rect.width, height: blink.rect.height });
  }
  assert.ok(listCharacterAssetPaths("sophie").includes("characters/sophie/conversation/neutral/blink.png"));
  assert.equal(resolveConversationVisual({ character: "sophie", expression: "excellent" })?.blinkOverlay, undefined);
});
