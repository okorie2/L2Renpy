/**
 * Semantic character visuals. Game and dialogue code describe what a character is
 * doing; only the catalog knows which image files show it.
 */

/** Full-body states used by the Phaser world. */
export type WorldPose = "idle" | "walking" | "waving";

/** Close-up states used by the conversation presentation. */
export type CharacterExpression =
  | "neutral" | "question" | "explaining" | "encouraging" | "happy" | "confused"
  // Sophie's gestures for particular moments.
  | "talking" | "presenting" | "playful" | "pinching" | "speaking-french" | "listening"
  | "excellent" | "well-done" | "close" | "good-try" | "beckoning" | "pleased" | "inviting" | "goodbye"
  // On the move, for scenes framed wide (the walk to the café).
  | "walk-away" | "walk-side" | "greeting" | "glance" | "proud";

/** Camera distance: `close` is the usual portrait, `wide` steps back to show the place. */
export type Framing = "close" | "wide";

/** Mouth state within an expression; `speaking` is shown only while a line is being voiced. */
export type CharacterActivity = "closed" | "speaking";

export const CHARACTER_EXPRESSIONS: CharacterExpression[] = [
  "neutral", "question", "explaining", "encouraging", "happy", "confused",
  "talking", "presenting", "playful", "pinching", "speaking-french", "listening",
  "excellent", "well-done", "close", "good-try", "beckoning", "pleased", "inviting", "goodbye",
  "walk-away", "walk-side", "greeting", "glance", "proud"
];
export const WORLD_POSES: WorldPose[] = ["idle", "walking", "waving"];

/** The way a character in the world is heading. */
export type WorldDirection = "up" | "down" | "left" | "right";

/** Asset paths are relative to the public `assets/` root, never absolute URLs. */
export interface WorldPoseAsset {
  /** The character seen from the front. Used for every direction that has no art of its own. */
  frames: string[];
  /** Milliseconds per frame; ignored for single-frame poses. */
  frameDurationMs: number;
  /** Seen from behind, for walking away from the camera. */
  back?: string[];
  /** Seen from the side, drawn facing right; mirrored for the left. */
  side?: string[];
}

export interface ExpressionAsset {
  /** The master image for the expression. */
  closed: string;
  /**
   * Optional open-mouth patch laid over `closed` while speaking. Because only the
   * mouth is replaced, nothing else in the portrait can shift between the two states.
   */
  mouthOpen?: string;
  /** Where this pose's mouth patch sits, when its head is not where the others' is. */
  mouthRect?: CanvasRect;
  /** A shut-eyes patch, shown for a moment now and then so a still portrait does not stare. */
  blink?: { path: string; rect: CanvasRect };
}

/** A rectangle in the pixels of a portrait canvas. */
export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CharacterVisualDefinition {
  id: string;
  world: {
    /** Height of the sprite canvas in world units, and where the feet sit inside it. */
    displayHeight: number;
    aspectRatio: number;
    footAnchorY: number;
    poses: Record<WorldPose, WorldPoseAsset>;
  };
  /** Close-up portraits. A character who is never shown in close-up, like the player, has none. */
  conversation?: {
    /** Pixel size shared by every portrait of this character. */
    canvas: { width: number; height: number };
    /** Where the mouth patch sits on that canvas; shared because the poses share a head position. */
    mouthRect?: CanvasRect;
    expressions: Partial<Record<CharacterExpression, ExpressionAsset>>;
    /** Expressions without dedicated art borrow the closest approved one. */
    fallbacks: Partial<Record<CharacterExpression, CharacterExpression>>;
    defaultExpression: CharacterExpression;
    /**
     * Full-body art for wide framing, by expression. Optional, and allowed to be
     * missing on disk: until a file is delivered the matching portrait stands in.
     */
    wide?: Partial<Record<CharacterExpression, string>>;
  };
}

export interface ConversationVisualRequest {
  character: string;
  expression?: CharacterExpression;
  activity?: CharacterActivity;
  framing?: Framing;
}

/** Placement of a patch as fractions of the portrait, so it scales with the image. */
export interface PortraitOverlay {
  path: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ConversationVisual {
  character: string;
  /** What was asked for and what the art could actually show. */
  requestedExpression: CharacterExpression;
  expression: CharacterExpression;
  activity: CharacterActivity;
  /** The base portrait. It is the same image for both activities. */
  path: string;
  /** Present only while speaking, and only when the expression has a mouth patch. */
  mouthOverlay?: PortraitOverlay;
  /** Shut eyes for blinking, when the expression has them. */
  blinkOverlay?: PortraitOverlay;
  aspectRatio: number;
  /** `portrait` is cropped at the hip; `full-body` shows the whole figure, for wide framing. */
  art: "portrait" | "full-body";
  /**
   * What to show if `path` cannot be loaded. Full-body art is optional and may not
   * have been delivered yet, so it always carries the nearest portrait as a stand-in.
   */
  standIn?: ConversationVisual;
}

export interface WorldVisual {
  character: string;
  displayHeight: number;
  aspectRatio: number;
  footAnchorY: number;
  poses: Record<WorldPose, WorldPoseAsset>;
}
