import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { french } from "../src/languages/fr";
import { personPosition, routePosition, walkFrame } from "../src/world3d/story";
import type { WalkInterlude } from "../src/dialogue/models";

const walk: WalkInterlude = { kind: "walk", durationMs: 2000, segments: [
  { scene: "park", zoom: [1, 1.3] },
  { scene: "lyon-route", zoom: [1, 1.2], people: [{ id: "passerby", at: "far", to: "near" }] }
] };

test("the 3D walk follows the story clock, clamps completion and can replay from the beginning", () => {
  assert.equal(walkFrame(walk, -20).z, routePosition("park", 1));
  assert.equal(walkFrame(walk, 2000).z, routePosition("lyon-route", 1.2));
  assert.deepEqual(walkFrame(walk, 5000), walkFrame(walk, 2000));
  assert.equal(walkFrame(walk, 0).progress, 0);
});

test("changing street segments keeps the modeled route continuous", () => {
  const before = walkFrame(walk, 999.99).z;
  const after = walkFrame(walk, 1000.01).z;
  assert.ok(Math.abs(after - before) < 0.001);
});

test("every authored walk ends at the same 3D position as the following conversation", () => {
  for (const dialogue of Object.values(french.dialogues)) for (const node of Object.values(dialogue.nodes)) {
    if (!node.interlude) continue;
    const last = node.interlude.segments.at(-1)!;
    assert.equal(walkFrame(node.interlude, node.interlude.durationMs).z, routePosition(last.scene, last.zoom[1]));
  }
});

test("a passerby approaches and leaves along the street instead of scaling an image", () => {
  const person = { id: "passerby", at: "far", to: "near", start: 0.25 } as const;
  assert.equal(personPosition(person, 0, 4).z, personPosition(person, 0.25, 4).z);
  assert.ok(personPosition(person, 0.5, 4).z > personPosition(person, 1, 4).z);
  assert.equal(personPosition(person, 1, 4).moving, false);
  assert.ok(personPosition({ id: "passerby", to: "passed" }, 1, 4).z < 4);
});

test("an empty or zero duration walk is safe and deterministic", () => {
  assert.deepEqual(walkFrame({ ...walk, segments: [] }, 0), { z: 0, progress: 1, people: [] });
  assert.equal(walkFrame({ ...walk, durationMs: 0 }, 10).progress, 1);
});

test("the route eases departure and arrival while preserving authored duration", () => {
  const straight: WalkInterlude = { kind: "walk", durationMs: 2000, segments: [{ scene: "park", zoom: [1, 2] }] };
  const startStep = walkFrame(straight, 100).z - walkFrame(straight, 0).z;
  const middleStep = walkFrame(straight, 1000).z - walkFrame(straight, 900).z;
  const endStep = walkFrame(straight, 2000).z - walkFrame(straight, 1900).z;
  assert.ok(startStep < middleStep / 3);
  assert.ok(endStep < middleStep / 3);
  assert.equal(walkFrame(straight, 2000).z, 5);
});


test("story characters ship with local skeletal clips and no external asset references", () => {
  for (const id of ["sophie", "sophie-study", "player"]) {
    const bytes = readFileSync(`public/assets/3d/characters/${id}.glb`);
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.deepEqual(gltf.animations.map((clip: { name: string }) => clip.name).sort(), ["Idle", "Idle_Neutral", "Walk", "Wave"]);
    assert.ok(gltf.skins[0].joints.length > 20);
    assert.ok(gltf.buffers.every((buffer: { uri?: string }) => !buffer.uri));
    assert.equal(gltf.images?.length ?? 0, 0);
    assert.ok(bytes.length < (id === "sophie-study" ? 2_000_000 : 1_000_000));
  }
});

test("Sophie exports neutral, skinned facial shapes for blinking and speech", () => {
  const bytes = readFileSync("public/assets/3d/characters/sophie-study.glb");
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binaryStart = 20 + jsonLength + 8;
  const authored = new Set<string>();
  for (const mesh of gltf.meshes) {
    const names: string[] = mesh.extras?.targetNames ?? [];
    if (!names.length) continue;
    names.forEach(name => authored.add(name));
    assert.ok(mesh.weights.every((weight: number) => weight === 0), `${mesh.name} must start neutral`);
    assert.ok(gltf.nodes.some((node: { mesh?: number; skin?: number }) => node.mesh === gltf.meshes.indexOf(mesh) && node.skin !== undefined), `${mesh.name} must follow the head rig`);
    for (const primitive of mesh.primitives) {
      assert.equal(primitive.targets.length, names.length);
      for (const target of primitive.targets) {
        const accessor = gltf.accessors[target.POSITION];
        assert.equal(accessor.count, gltf.accessors[primitive.attributes.POSITION].count);
        assert.equal(accessor.componentType, 5126);
        const deltas = new Float32Array(accessor.count * 3);
        if (accessor.bufferView !== undefined) {
          const view = gltf.bufferViews[accessor.bufferView];
          const offset = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
          for (let i = 0; i < accessor.count; i++) for (let axis = 0; axis < 3; axis++) {
            deltas[i * 3 + axis] = bytes.readFloatLE(offset + i * (view.byteStride ?? 12) + axis * 4);
          }
        }
        // Blender uses sparse glTF accessors for shapes affecting only a few vertices.
        if (accessor.sparse) {
          const { indices, values, count } = accessor.sparse;
          const indexView = gltf.bufferViews[indices.bufferView], valueView = gltf.bufferViews[values.bufferView];
          const indexOffset = binaryStart + (indexView.byteOffset ?? 0) + (indices.byteOffset ?? 0);
          const valueOffset = binaryStart + (valueView.byteOffset ?? 0) + (values.byteOffset ?? 0);
          const indexSize = ({ 5121: 1, 5123: 2, 5125: 4 } as Record<number, number>)[indices.componentType];
          assert.ok(indexSize);
          for (let i = 0; i < count; i++) {
            const index = bytes.readUIntLE(indexOffset + i * indexSize, indexSize);
            assert.ok(index < accessor.count);
            for (let axis = 0; axis < 3; axis++) deltas[index * 3 + axis] = bytes.readFloatLE(valueOffset + i * 12 + axis * 4);
          }
        }
        let moved = false;
        for (const delta of deltas) {
          assert.ok(Number.isFinite(delta) && Math.abs(delta) < 0.03, `${mesh.name}: bounded expression deformation`);
          moved ||= Math.abs(delta) > 0.00001;
        }
        assert.ok(moved, `${mesh.name}: shape must actually deform`);
      }
    }
  }
  assert.deepEqual([...authored].sort(), ["blink_L", "blink_R", "jawOpen", "smile"]);
});

test("Meshy Sophie is self-contained, reduced and skinned for the story clips", () => {
  const bytes = readFileSync("public/assets/3d/characters/sophie-meshy.glb");
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < 10_000_000, "character download budget");
  const length = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + length).toString());
  assert.deepEqual(gltf.animations.map((a: { name: string }) => a.name).sort(), ["Idle", "Idle_Neutral", "Walk", "Wave"]);
  assert.ok(gltf.skins[0].joints.length >= 20);
  assert.ok(gltf.buffers.every((b: { uri?: string }) => !b.uri));
  assert.ok(gltf.images.length > 0 && gltf.images.every((i: { bufferView?: number; uri?: string }) => i.bufferView !== undefined && !i.uri));
  assert.ok(gltf.materials.some((m: { pbrMetallicRoughness?: { baseColorTexture?: unknown } }) => m.pbrMetallicRoughness?.baseColorTexture));
  let triangles = 0;
  const binaryStart = 20 + length + 8;
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    triangles += gltf.accessors[primitive.indices].count / 3;
    assert.ok(primitive.attributes.JOINTS_0 !== undefined);
    const a = gltf.accessors[primitive.attributes.WEIGHTS_0];
    assert.equal(a.componentType, 5126);
    const view = gltf.bufferViews[a.bufferView];
    const offset = binaryStart + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    for (let i = 0; i < a.count; i++) {
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        const w = bytes.readFloatLE(offset + i * (view.byteStride ?? 16) + j * 4);
        assert.ok(Number.isFinite(w) && w >= 0 && w <= 1);
        sum += w;
      }
      assert.ok(Math.abs(sum - 1) < 0.0001, "every vertex has normalized body weights");
    }
  }
  assert.ok(triangles < 120_000, `web mesh budget: ${triangles}`);
});

test("Meshy auto-rig uses the original Sophie's colour texture without a colour approximation", () => {
  const colourTexture = (asset: string) => {
    const bytes = readFileSync(`public/assets/3d/characters/${asset}.glb`);
    const length = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + length).toString());
    const pbr = gltf.materials[0].pbrMetallicRoughness;
    const image = gltf.images[gltf.textures[pbr.baseColorTexture.index].source];
    const view = gltf.bufferViews[image.bufferView];
    const offset = 28 + length + (view.byteOffset ?? 0);
    return { pixels: bytes.subarray(offset, offset + view.byteLength), tint: pbr.baseColorFactor ?? [1, 1, 1, 1] };
  };
  const original = colourTexture("sophie-meshy"), rigged = colourTexture("sophie-meshy-rigged");
  assert.ok(original.pixels.equals(rigged.pixels), "both models embed the exact same colour image");
  assert.deepEqual(rigged.tint, original.tint);
});

for (const [asset, knees, minimum] of [
  ["sophie-meshy", ["LowerLeg.L", "LowerLeg.R"], 50],
  ["sophie-meshy-rigged", ["mixamorig:LeftLeg", "mixamorig:RightLeg"], 30],
] as const) test(`${asset}'s exported walk visibly folds both knees during the swing`, () => {
  const bytes = readFileSync(`public/assets/3d/characters/${asset}.glb`);
  assert.ok(bytes.length < 10_000_000, "character download budget");
  const length = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + length).toString());
  const walk = gltf.animations.find((a: { name: string }) => a.name === "Walk");
  for (const name of knees) {
    const node = gltf.nodes.findIndex((n: { name: string }) => n.name === name);
    assert.ok(node >= 0);
    const channel = walk.channels.find((c: { target: { node: number; path: string } }) => c.target.node === node && c.target.path === "rotation");
    assert.ok(channel, `${name} needs a knee rotation track`);
    const a = gltf.accessors[walk.samplers[channel.sampler].output];
    assert.equal(a.type, "VEC4");
    assert.equal(a.componentType, 5126);
    const view = gltf.bufferViews[a.bufferView];
    const offset = 28 + length + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const values = Array.from({ length: a.count }, (_, i) => Array.from({ length: 4 }, (_, j) => bytes.readFloatLE(offset + i * (view.byteStride ?? 16) + j * 4)));
    let range = 0;
    for (const q of values) for (const r of values) {
      const dot = Math.abs(q.reduce((sum, value, i) => sum + value * r[i], 0));
      range = Math.max(range, 2 * Math.acos(Math.min(1, dot)));
    }
    assert.ok(range > Math.PI * minimum / 180, `${name} must flex through more than ${minimum} degrees, got ${range * 180 / Math.PI}`);
    assert.ok(range < Math.PI * .6, `${name} must stay within a walking range`);
  }
});
