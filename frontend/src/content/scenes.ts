import { sceneArt } from "../characters/catalog";
import type { Dialogue, StreetPose, StreetPresence, StreetSpot } from "../dialogue/models";

/**
 * The painted places behind a scene's conversation, by the IDs dialogue lines use
 * in `presentation.scene`. A scene's own painting may not be delivered yet, so each
 * names an existing painting to stand in until it is.
 */
export interface SceneBackdrop {
  id: string;
  /** Path under `public/assets/`. */
  image: string;
  /** Shown while `image` is not on disk. */
  standIn: string;
  /** Which part of the stand-in to keep in view (CSS `object-position`). */
  standInPosition?: string;
  /** Drift slowly across the painting, for walking. */
  drift?: boolean;
  /**
   * Where Sophie walks across the screen, as a share of its width, when the default
   * (a little left of centre) would put her off the path in this painting.
   */
  walkX?: number;
}

/** Where Sophie walks across the screen unless a scene says otherwise. */
export const DEFAULT_WALK_X = 0.3;

const walk = (file: string) => sceneArt("walk-to-cafe", file);

export const SCENES: Record<string, SceneBackdrop> = {
  park: {
    id: "park", image: "locations/park.webp", standIn: "locations/park.webp",
    // The path here runs right of centre, with railings and flower beds on the left.
    walkX: 0.56
  },
  "park-exit": {
    id: "park-exit", image: walk("bg_park_exit.webp"), standIn: "locations/park.webp", standInPosition: "70% 50%", drift: true
  },
  "lyon-route": {
    id: "lyon-route", image: walk("bg_lyon_route.webp"), standIn: "locations/neighborhood.webp", standInPosition: "20% 40%", drift: true
  },
  "cafe-exterior": {
    id: "cafe-exterior", image: walk("bg_cafe_exterior.webp"), standIn: "locations/neighborhood.webp", standInPosition: "50% 25%"
  }
};

/**
 * Sophie walking away from the camera, for the walks between beats: six frames on one
 * canvas, each step drawn (none mirrored). Left foot: pushing off (1), lifted behind
 * (2), landed ahead (3). Right foot: the same, frames 4–6. Lined up on her standing
 * street poses, head on the same line, so she stops exactly where she walked. If the
 * frames are missing, her single walking-away pose is moved in step instead.
 */
export const SOPHIE_WALK = {
  frames: Array.from({ length: 6 }, (_, index) => walk(`sophie_walk_back_${index + 1}.webp`)),
  standIn: walk("sophie_walk_away.webp"),
  /** Milliseconds per frame: three frames a step, about 650 ms a step, an unhurried stroll. */
  frameMs: Array.from({ length: 6 }, () => 215),
  /** Where each step starts, as frame indices. */
  stepStarts: [0, 3]
};

/**
 * Sophie standing on the street, on the walk cycle's canvas and scale
 * (tools/build_street_poses.py), so she stops exactly where she walked. `talking` is
 * the same pose with her mouth open, shown while she speaks, when it has been made.
 */
export const STREET_POSES: Record<StreetPose, { image: string; talking?: string }> = {
  glance: { image: walk("sophie_street_glance.webp"), talking: walk("sophie_street_glance_talking.webp") },
  greeting: { image: walk("sophie_street_greeting.webp") },
  // Back to the camera, turned to her right, waving to someone ahead on that side.
  wave: { image: walk("sophie_street_wave.webp"), talking: walk("sophie_street_wave_talking.webp") },
  playful: { image: walk("sophie_street_playful.webp") },
  explaining: { image: walk("sophie_street_explaining.webp") },
  pleased: { image: walk("sophie_street_pleased.webp") }
};

/** A place in the street shot: shares of the screen, before the camera's zoom (which moves it with the street). */
export interface StreetPlace { left: number; bottom: number; height: number }

export interface StreetPerson {
  image: string;
  /** Raising a hand to say hello. */
  wave?: string;
  /** Mouth open, for while they speak, plain and waving. */
  talking?: string;
  waveTalking?: string;
  /**
   * Walking toward the camera, one frame per pose of a full stride (both feet), shown
   * while they move. Until the frames are drawn, their picture bobs in step instead.
   */
  walk?: { frames: string[]; frameMs: number };
  spots: Partial<Record<StreetSpot, StreetPlace>> & { near: StreetPlace };
}

/**
 * On the Lyon street, the ground runs back to a horizon at 46% up the screen (before
 * the zoom), a little right of centre. Someone standing on it is placed by their
 * height: the smaller, the closer to that horizon. Keeps everyone on the pavement.
 */
const HORIZON = { bottom: 0.4628, rise: 0.837 };
const onGround = (height: number, left: number): StreetPlace => ({ left, bottom: HORIZON.bottom - HORIZON.rise * height, height });

/** People met on the street. Further off than Sophie, so smaller. */
export const STREET_PEOPLE: Record<string, StreetPerson> = {
  // Far up the street at first; he comes up the middle toward the camera as Sophie
  // walks on past the shop, says bonjour, then walks on past the camera.
  passerby: {
    image: walk("npc_passerby.webp"),
    wave: walk("npc_passerby_wave.webp"),
    talking: walk("npc_passerby_talking.webp"),
    waveTalking: walk("npc_passerby_wave_talking.webp"),
    walk: { frames: Array.from({ length: 8 }, (_, index) => walk(`npc_passerby_walk_${index + 1}.webp`)), frameMs: 130 },
    spots: {
      far: onGround(0.075, 0.5),
      // Where he meets Sophie, a little ahead of her (the camera is well in by then).
      near: onGround(0.22, 0.55),
      passed: { left: 1.08, bottom: -0.05, height: 0.5 }
    }
  },
  // Outside her shop on the right, by the planters; passed as the walk goes on.
  shopkeeper: {
    image: walk("npc_shopkeeper.webp"),
    wave: walk("npc_shopkeeper_wave.webp"),
    talking: walk("npc_shopkeeper_talking.webp"),
    waveTalking: walk("npc_shopkeeper_wave_talking.webp"),
    spots: {
      near: onGround(0.14, 0.66),
      passed: { left: 1.1, bottom: 0.12, height: 0.4 }
    }
  }
};

/** Where someone is at a spot; a spot they don't have is where they usually stand. */
export function streetPlace(id: string, spot: StreetSpot = "near"): StreetPlace | undefined {
  const person = STREET_PEOPLE[id];
  return person ? person.spots[spot] ?? person.spots.near : undefined;
}

/**
 * Part way between two places, as someone walking between them would be: they grow
 * as they come closer at an even pace (by the inverse of their size), and their
 * feet keep to the line between the two places.
 */
export function placeBetween(from: StreetPlace, to: StreetPlace, amount: number): StreetPlace {
  if (from.height === to.height) {
    return { left: from.left + (to.left - from.left) * amount, bottom: from.bottom + (to.bottom - from.bottom) * amount, height: from.height };
  }
  const height = 1 / (1 / from.height + (1 / to.height - 1 / from.height) * amount);
  const along = (height - from.height) / (to.height - from.height);
  return { left: from.left + (to.left - from.left) * along, bottom: from.bottom + (to.bottom - from.bottom) * along, height };
}

/**
 * Who is in the street shot at a line, and where: what this line says, or else where
 * the last line or walk to say left them. Anyone gone past the camera has left.
 * The person being talked with is always there, close by.
 */
export function streetPeople(dialogue: Dialogue, nodeIds: string[]): StreetPresence[] {
  const current = dialogue.nodes[nodeIds.at(-1) ?? ""];
  let people = current?.presentation?.street?.people;
  for (let index = nodeIds.length - 2; !people && index >= 0; index--) {
    const node = dialogue.nodes[nodeIds[index]];
    const declared = node?.interlude ? node.interlude.segments.at(-1)?.people ?? [] : node?.presentation?.street?.people;
    if (declared) people = declared.map(({ id, at, to }) => ({ id, at: to ?? at })).filter((person) => person.at !== "passed");
  }
  const result = [...(people ?? [])];
  const alongside = current?.presentation?.street?.with;
  if (alongside && !result.some((person) => person.id === alongside)) result.push({ id: alongside, at: "near" });
  return result.filter((person) => STREET_PEOPLE[person.id]);
}

/**
 * Where the camera is at a line of a street-staged dialogue: the place and zoom the
 * most recent walk ended at, so talking continues the same shot.
 */
export function streetCamera(dialogue: Dialogue, nodeIds: string[]): { scene: SceneBackdrop; zoom: number } | undefined {
  for (let index = nodeIds.length - 1; index >= 0; index--) {
    const last = dialogue.nodes[nodeIds[index]]?.interlude?.segments.at(-1);
    if (last && SCENES[last.scene]) return { scene: SCENES[last.scene], zoom: last.zoom[1] };
  }
  return undefined;
}

/** The scene in force at a line: the latest one named, by this line or any before it. */
export function sceneAt(nodeIds: string[], sceneOf: (nodeId: string) => string | undefined): SceneBackdrop | undefined {
  for (let index = nodeIds.length - 1; index >= 0; index--) {
    const id = sceneOf(nodeIds[index]);
    if (id && SCENES[id]) return SCENES[id];
  }
  return undefined;
}
