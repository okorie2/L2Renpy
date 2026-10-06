import type { CanvasRect, CharacterVisualDefinition } from "./types";

/**
 * Sophie's approved art, imported from L2Renpy (see docs/L2RENPY-IMPORTS.md).
 * All sprites share a 2:3 canvas, so poses can swap without repositioning.
 * Each expression has one master portrait plus a small open-mouth patch built by
 * tools/build_mouth_overlays.py, so speaking changes the mouth and nothing else.
 * `happy` borrows `pleased` and `confused` borrows `question`.
 */
/**
 * How tall an adult stands in the world, in world units. One value for everyone,
 * sized against the doors of the painted street. `tools/draw_layout_guides.py`
 * draws its "a person is this tall" figure to the same height.
 */
export const WORLD_FIGURE_HEIGHT = 116;

/**
 * Art for one scene lives together in `public/assets/scenes/<scene>/`, under the
 * names it was briefed with (see docs/SCENE-2-WALK-TO-CAFE.md). Files not delivered
 * yet are simply absent: the nearest existing portrait or painting stands in.
 */
export const sceneArt = (scene: string, file: string) => `scenes/${scene}/${file}`;
const walkArt = (name: string) => sceneArt("walk-to-cafe", `${name}.webp`);

/** One of Sophie's gesture poses: a master portrait and its own mouth patch. */
const gesture = (name: string, mouthRect: CanvasRect) => ({
  closed: `characters/sophie/conversation/${name}/closed.webp`,
  mouthOpen: `characters/sophie/conversation/${name}/mouth-open.png`,
  mouthRect
});

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
        mouthOpen: "characters/sophie/conversation/neutral/mouth-open.png",
        blink: { path: "characters/sophie/conversation/neutral/blink.png", rect: { x: 400, y: 260, width: 224, height: 90 } }
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
      },
      // Gestures for particular moments, built by tools/build_pose_portraits.py. Each has its
      // own mouth position, as the head moves a little with the gesture. Turned away, she
      // is shown as drawn, without a moving mouth.
      talking: { ...gesture("talking", { x: 429, y: 352, width: 160, height: 104 }), blink: { path: "characters/sophie/conversation/neutral/blink.png", rect: { x: 400, y: 260, width: 224, height: 90 } } },
      presenting: gesture("presenting", { x: 429, y: 351, width: 160, height: 104 }),
      playful: gesture("playful", { x: 431, y: 354, width: 160, height: 104 }),
      pinching: gesture("pinching", { x: 429, y: 352, width: 160, height: 104 }),
      "speaking-french": gesture("speaking-french", { x: 428, y: 351, width: 160, height: 104 }),
      listening: gesture("listening", { x: 433, y: 353, width: 160, height: 104 }),
      excellent: gesture("excellent", { x: 428, y: 352, width: 160, height: 104 }),
      "well-done": gesture("well-done", { x: 429, y: 353, width: 160, height: 104 }),
      close: gesture("close", { x: 429, y: 355, width: 160, height: 104 }),
      "good-try": gesture("good-try", { x: 429, y: 352, width: 160, height: 104 }),
      beckoning: gesture("beckoning", { x: 428, y: 370, width: 160, height: 104 }),
      pleased: gesture("pleased", { x: 431, y: 352, width: 160, height: 104 }),
      inviting: { closed: "characters/sophie/conversation/inviting/closed.webp" },
      goodbye: { closed: "characters/sophie/conversation/goodbye/closed.webp" }
    },
    // The walking moments borrow the closest portrait until their full-body art arrives.
    fallbacks: {
      happy: "pleased", confused: "question",
      "walk-away": "inviting", "walk-side": "talking", greeting: "goodbye", glance: "playful", proud: "excellent"
    },
    // Full-body, for the walk to the café. Same face, outfit and scale as the portraits.
    wide: {
      "walk-away": walkArt("sophie_walk_away"),
      "walk-side": walkArt("sophie_walk_side"),
      question: walkArt("sophie_ask"),
      listening: walkArt("sophie_listen"),
      pleased: walkArt("sophie_pleased"),
      encouraging: walkArt("sophie_encourage"),
      explaining: walkArt("sophie_explain"),
      greeting: walkArt("sophie_greet_side"),
      glance: walkArt("sophie_glance"),
      proud: walkArt("sophie_proud"),
      playful: walkArt("sophie_playful")
    }
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

/**
 * Someone met in passing during a scene, never in the world. Shown full-body when
 * their art is on disk; until then a neighbour's close-up stands in.
 */
function passing(id: string, standIn: string, art: string): CharacterVisualDefinition {
  const base = standing(standIn);
  return {
    ...base,
    id,
    conversation: { ...base.conversation!, wide: { neutral: art, question: art, encouraging: art } }
  };
}

export const characterVisuals: Record<string, CharacterVisualDefinition> = {
  [sophie.id]: sophie,
  [player.id]: player,
  barista: standing("barista"),
  baker: standing("baker"),
  neighbor: standing("neighbor"),
  passerby: passing("passerby", "neighbor", walkArt("npc_passerby")),
  shopkeeper: passing("shopkeeper", "baker", walkArt("npc_shopkeeper"))
};
