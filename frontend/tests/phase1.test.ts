import assert from "node:assert/strict";
import test from "node:test";
import { chapterOneLocations, chapterOneNpcs, chapterOneQuests, createStartingPlayer } from "../src/content/chapter1";
import { createInitialSave, applyGameEvent } from "../src/core/quests";
import { travelThroughPortal } from "../src/core/world";
import { french } from "../src/languages/fr";
import type { Location } from "../src/core/models";
import { advanceToward, isWalkable, moveWithCollision, toWorldPoint, type CircleBlocker, type Point } from "../src/world/geometry";
import { findPath } from "../src/world/navigation";

const byId = (id: string) => {
  const location = chapterOneLocations.find((item) => item.id === id);
  assert.ok(location);
  return location;
};

test("four NPCs resolve through one location/dialogue contract", () => {
  assert.equal(chapterOneNpcs.length, 4);
  for (const npc of chapterOneNpcs) {
    assert.ok(chapterOneLocations.some((location) => location.id === npc.locationId));
    assert.ok(npc.dialogues.length > 0);
    for (const rule of npc.dialogues) assert.ok(french.dialogues[rule.dialogueId], rule.dialogueId);
    assert.ok(npc.interaction.radius > 0);
    assert.equal(npc.state, "available");
  }
  for (const location of chapterOneLocations) {
    for (const portal of location.portals) {
      assert.ok(byId(portal.destination.locationId).spawnPoints[portal.destination.spawnId]);
    }
  }
});

test("apartment, café, and bakery can be entered and exited", () => {
  const save = createInitialSave(createStartingPlayer("fr"), chapterOneQuests);
  const street = travelThroughPortal(save, chapterOneLocations, "leaveApartment");
  assert.equal(street.player.locationId, "neighborhood");
  for (const [enter, room, leave] of [
    ["enterCafe", "cafe", "leaveCafe"],
    ["enterBakery", "bakery", "leaveBakery"],
    ["enterApartment", "apartment", "leaveApartment"]
  ]) {
    const inside = travelThroughPortal(street, chapterOneLocations, enter);
    assert.equal(inside.player.locationId, room);
    assert.equal(travelThroughPortal(inside, chapterOneLocations, leave).player.locationId, "neighborhood");
  }
});

test("walls block movement and routes go around plaza planters", () => {
  const street = byId("neighborhood");
  // In front of the apartment door: the building front cannot be walked into.
  const blocked = moveWithCollision(street, { x: 219, y: 390 }, { x: 0, y: -60 }, 16);
  assert.equal(blocked.y, 390);

  // From one end of the left bench to the other: the route goes around it.
  const from = { x: 715, y: 533 };
  const target = { x: 915, y: 540 };
  const path = findPath(street, from, target, 16);
  assert.ok(path.length > 0);
  let previous = from;
  for (const waypoint of path) {
    const distance = Math.hypot(waypoint.x - previous.x, waypoint.y - previous.y);
    for (let i = 1; i <= Math.ceil(distance / 5); i++) {
      const t = i / Math.ceil(distance / 5);
      assert.ok(isWalkable(street, { x: previous.x + (waypoint.x - previous.x) * t, y: previous.y + (waypoint.y - previous.y) * t }, 16));
    }
    previous = waypoint;
  }
  assert.ok(Math.hypot(previous.x - target.x, previous.y - target.y) < 24);
});

test("NPC circles block overlap while remaining reachable for dialogue", () => {
  const street = byId("neighborhood");
  const sophie = chapterOneNpcs.find((npc) => npc.id === "sophie");
  assert.ok(sophie);
  const npcPoint = toWorldPoint(street, sophie.position);
  const blockers = [{ ...npcPoint, radius: 17 }];
  const from = { x: npcPoint.x - 90, y: npcPoint.y };
  const path = findPath(street, from, npcPoint, 16, blockers);
  assert.ok(path.length > 0);
  const destination = path.at(-1)!;
  assert.ok(Math.hypot(destination.x - npcPoint.x, destination.y - npcPoint.y) >= 33);
  assert.ok(Math.hypot(destination.x - npcPoint.x, destination.y - npcPoint.y) <= sophie.interaction.radius);
  assert.equal(moveWithCollision(street, { x: npcPoint.x - 34, y: npcPoint.y }, { x: 3, y: 0 }, 16, blockers).x, npcPoint.x - 34);
});

test("every authored spawn and doorway approach is reachable", () => {
  for (const location of chapterOneLocations) {
    const blockers = chapterOneNpcs
      .filter((npc) => npc.locationId === location.id)
      .map((npc) => ({ ...toWorldPoint(location, npc.position), radius: 17 }));
    for (const [name, position] of Object.entries(location.spawnPoints)) {
      const spawn = toWorldPoint(location, position);
      assert.ok(isWalkable(location, spawn, 16, blockers), `${location.id}.${name} is inside something solid`);
      for (const portal of location.portals) {
        const target = toWorldPoint(location, portal.position);
        const arrived = walk(location, spawn, target, 3, blockers).position;
        assert.ok(Math.hypot(arrived.x - target.x, arrived.y - target.y) <= portal.interactionRadius, `${location.id}.${name} cannot reach ${portal.id}`);
      }
    }
  }
});

test("Sophie's quest still completes once", () => {
  let save = createInitialSave(createStartingPlayer("fr"), chapterOneQuests);
  save = travelThroughPortal(save, chapterOneLocations, "leaveApartment", chapterOneQuests);
  const events = [
    { type: "DIALOGUE_LINE_COMPLETED" as const, dialogueId: "meetSophie", nodeId: "askName" },
    { type: "DIALOGUE_LINE_COMPLETED" as const, dialogueId: "meetSophie", nodeId: "practice" },
    { type: "DIALOGUE_COMPLETED" as const, dialogueId: "meetSophie", npcId: "sophie" }
  ];
  for (const event of events) save = applyGameEvent(save, chapterOneQuests, event);
  assert.equal(save.questProgress.meetSophie.status, "completed");
  assert.equal(save.player.xp, 20);
  for (const event of events) save = applyGameEvent(save, chapterOneQuests, event);
  assert.equal(save.player.xp, 20);
});

/** Follow a route the way the scene does: step, steer, and replan once if nothing gets closer. */
function walk(location: Location, from: Point, tap: Point, stepLength: number, blockers: CircleBlocker[]) {
  let path = findPath(location, from, tap, 16, blockers);
  const destination = path.at(-1);
  let position = from;
  let replanned = false;
  for (let guard = 0; path.length && guard < 20000; guard++) {
    const target = path[0];
    if (Math.hypot(target.x - position.x, target.y - position.y) <= 3) { path.shift(); continue; }
    const next = advanceToward(location, position, target, stepLength, 16, blockers);
    if (next) { position = next; continue; }
    path = replanned ? [] : findPath(location, position, path.at(-1)!, 16, blockers, { smooth: false });
    replanned = true;
  }
  return { position, destination };
}

test("a walk never jams: every tap ends where its route does, at any frame rate", () => {
  for (const location of chapterOneLocations) {
    const blockers = chapterOneNpcs
      .filter((npc) => npc.locationId === location.id)
      .map((npc) => ({ ...toWorldPoint(location, npc.position), radius: 17 }));
    for (const spawnPosition of Object.values(location.spawnPoints)) {
    const spawn = toWorldPoint(location, spawnPosition);
    for (const stepLength of [1.5, 3.1, 9.25]) {
      for (let x = 7; x < location.size.width; x += 41) {
        for (let y = 7; y < location.size.height; y += 41) {
          const out = walk(location, spawn, { x, y }, stepLength, blockers);
          assert.ok(isWalkable(location, out.position, 16, blockers));
          if (out.destination) {
            assert.ok(Math.hypot(out.position.x - out.destination.x, out.position.y - out.destination.y) <= 3.5,
              `${location.id}: jammed walking to (${x},${y}) at step ${stepLength}`);
          }
          // Wherever the player ends up, they can always walk back. A tap within
          // a few units of where they stand counts as already being there.
          const back = walk(location, out.position, spawn, stepLength, blockers);
          assert.ok(Math.hypot(back.position.x - spawn.x, back.position.y - spawn.y) <= 8,
            `${location.id}: stuck at (${out.position.x.toFixed(1)},${out.position.y.toFixed(1)}) after tapping (${x},${y}) at step ${stepLength}`);
        }
      }
    }
    }
  }
});

test("a player who somehow ends up inside an obstacle can still walk out", () => {
  const street = byId("neighborhood");
  const insideFountain = { x: 982, y: 488 };
  assert.equal(isWalkable(street, insideFountain, 16), false);
  const out = walk(street, insideFountain, { x: 700, y: 480 }, 3, []);
  assert.ok(isWalkable(street, out.position, 16));
  assert.ok(Math.hypot(out.position.x - 700, out.position.y - 480) <= 3.5);
});

test("tapping someone behind a counter walks up to the counter, not around it", () => {
  for (const id of ["cafe", "bakery"]) {
    const room = byId(id);
    const npc = chapterOneNpcs.find((item) => item.locationId === id)!;
    const npcPoint = toWorldPoint(room, npc.position);
    const blockers = [{ ...npcPoint, radius: 17 }];
    const spawn = toWorldPoint(room, room.spawnPoints.entry);
    const counter = room.obstacles[0];
    const { position } = walk(room, spawn, npcPoint, 3, blockers);
    assert.ok(position.y > (counter.y + counter.height) * room.size.height, `${id}: the player stays on the customer side`);
    assert.ok(Math.hypot(position.x - npcPoint.x, position.y - npcPoint.y) <= npc.interaction.radius, `${id}: close enough to talk`);
  }
});
