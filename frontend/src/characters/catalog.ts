import type { CharacterVisualDefinition } from "./types";

/**
 * Sophie's approved art, imported from L2Renpy (see docs/L2RENPY-IMPORTS.md).
 * All sprites share a 2:3 canvas, so poses can swap without repositioning.
 * Each expression has one master portrait plus a small open-mouth patch built by
 * tools/build_mouth_overlays.py, so speaking changes the mouth and nothing else.
 * `happy` and `confused` have no close-up art yet and borrow the nearest pose.
 */
/**
 * How tall an adult stands in the world, in world units. One value for everyone,
 * sized against the doors of the painted street. `tools/draw_layout_guides.py`
 * draws its "a person is this tall" figure to the same height.
 */
export const WORLD_FIGURE_HEIGHT = 116;

const sophie: CharacterVisualDefinition = {
  id: "sophie",
  world: {
    displayHeight: WORLD_FIGURE_HEIGHT,
    aspectRatio: 2 / 3,
    footAnchorY: 0.985,
    poses: {
      idle: { frames: ["characters/sophie/world/idle.png"], frameDurationMs: 0 },
      walking: {
        frames: [1, 2, 3, 4, 5, 6].map((frame) => `characters/sophie/world/walking-${frame}.png`),
        frameDurationMs: 120
      },
      waving: { frames: ["characters/sophie/world/waving.png"], frameDurationMs: 0 }
    }
  },
  conversation: {
    canvas: { width: 1024, height: 1536 },
    mouthRect: { x: 428, y: 352, width: 160, height: 104 },
    defaultExpression: "neutral",
    expressions: {
      neutral: {
        closed: "characters/sophie/conversation/neutral/closed.png",
        mouthOpen: "characters/sophie/conversation/neutral/mouth-open.png"
      },
      question: {
        closed: "characters/sophie/conversation/question/closed.png",
        mouthOpen: "characters/sophie/conversation/question/mouth-open.png"
      },
      explaining: {
        closed: "characters/sophie/conversation/explaining/closed.png",
        mouthOpen: "characters/sophie/conversation/explaining/mouth-open.png"
      },
      encouraging: {
        closed: "characters/sophie/conversation/encouraging/closed.png",
        mouthOpen: "characters/sophie/conversation/encouraging/mouth-open.png"
      }
    },
    fallbacks: { happy: "encouraging", confused: "question" }
  }
};

const playerFrames = (name: string) => [1, 2, 3, 4, 5, 6].map((frame) => `characters/player/world/${name}-${frame}.png`);

/** The player's own figure. Never shown in close-up, so it has no portraits. */
const player: CharacterVisualDefinition = {
  id: "player",
  world: {
    displayHeight: WORLD_FIGURE_HEIGHT,
    aspectRatio: 2 / 3,
    footAnchorY: 0.983,
    poses: {
      // After walking away the player stays turned away. There is no standing side
      // view, and a frozen stride looks wrong, so after walking sideways they face the camera.
      idle: {
        frames: ["characters/player/world/idle.png"],
        back: ["characters/player/world/walking-back-2.png"],
        frameDurationMs: 0
      },
      walking: { frames: playerFrames("walking"), back: playerFrames("walking-back"), side: playerFrames("walking-side"), frameDurationMs: 120 },
      // No greeting pose yet; the player does not wave.
      waving: { frames: ["characters/player/world/idle.png"], frameDurationMs: 0 }
    }
  }
};

/**
 * Someone who stands in one place: a single front view serves every world pose
 * until they get more art. Their four close-ups share one head position
 * (tools/build_portraits.py); the mouth does not move yet.
 */
function standing(id: string): CharacterVisualDefinition {
  const still = { frames: [`characters/${id}/world/idle.png`], frameDurationMs: 0 };
  const portrait = (expression: string) => ({ closed: `characters/${id}/conversation/${expression}/closed.webp` });
  return {
    id,
    world: { displayHeight: WORLD_FIGURE_HEIGHT, aspectRatio: 2 / 3, footAnchorY: 0.985, poses: { idle: still, walking: still, waving: still } },
    conversation: {
      canvas: { width: 1024, height: 1536 },
      defaultExpression: "neutral",
      expressions: {
        neutral: portrait("neutral"),
        question: portrait("question"),
        explaining: portrait("explaining"),
        encouraging: portrait("encouraging")
      },
      fallbacks: { happy: "encouraging", confused: "question" }
    }
  };
}

export const characterVisuals: Record<string, CharacterVisualDefinition> = {
  [sophie.id]: sophie,
  [player.id]: player,
  barista: standing("barista"),
  baker: standing("baker"),
  neighbor: standing("neighbor")
};
