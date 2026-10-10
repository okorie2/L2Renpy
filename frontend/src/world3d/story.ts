import type { StreetPresence, WalkInterlude } from "../dialogue/models";

export interface StoryShot {
  key: string;
  scene: string;
  zoom?: number;
  mode: "title" | "arrival" | "conversation" | "walk";
  paused?: boolean;
  speakingId?: string;
  focus?: string;
  framing?: "portrait";
  wave?: boolean;
  people?: StreetPresence[];
  walk?: WalkInterlude;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** All story shots refer to the same street, in metres, rather than separate images. */
export function routePosition(scene: string, zoom = 1): number {
  if (scene === "park") return (zoom - 1) * 5;
  if (scene === "park-exit") return 2 + (zoom - 1) * 3;
  if (scene === "cafe-exterior") return 10 + (zoom - 1) * 2;
  return 4 + (zoom - 1) * 5;
}

export function walkFrame(walk: WalkInterlude, elapsedMs: number) {
  const segments = walk.segments;
  if (!segments.length) return { z: 0, progress: 1, people: [] as StreetPresence[] };
  const progress = clamp(elapsedMs / Math.max(1, walk.durationMs));
  // Ease the route clock at departure and arrival without changing the story duration.
  const eased = progress * progress * (3 - 2 * progress);
  const at = eased * segments.length;
  const index = Math.min(segments.length - 1, Math.floor(at));
  const segment = segments[index];
  const along = progress === 1 ? 1 : at - index;
  const start = index === 0
    ? routePosition(segment.scene, segment.zoom[0])
    : routePosition(segments[index - 1].scene, segments[index - 1].zoom[1]);
  const end = routePosition(segment.scene, segment.zoom[1]);
  return { z: lerp(start, end, along), progress, segmentProgress: along, people: segment.people ?? [] };
}

/** Passage is a real position along the street; people leaving continue beyond the camera. */
export function personPosition(person: StreetPresence, progress: number, cameraZ: number) {
  const spots = person.id === "shopkeeper"
    ? { far: { x: 3.1, z: 11 }, near: { x: 3.1, z: 11 }, passed: { x: 4.5, z: cameraZ - 5 } }
    : { far: { x: 0.9, z: cameraZ + 12 }, near: { x: 0.9, z: cameraZ + 3 }, passed: { x: 3, z: cameraZ - 5 } };
  const from = spots[person.at ?? "near"];
  const to = spots[person.to ?? person.at ?? "near"];
  const amount = clamp((progress - (person.start ?? 0)) / Math.max(0.01, 1 - (person.start ?? 0)));
  return { x: lerp(from.x, to.x, amount), z: lerp(from.z, to.z, amount), moving: Boolean(person.to && person.to !== person.at && amount < 1) };
}
