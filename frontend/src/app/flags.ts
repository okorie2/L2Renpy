/**
 * Switches for presentation choices that may be turned back on.
 */

/**
 * The "next" arrow on dialogue lines. Off (the default): every line with nothing
 * to answer moves on by itself once it has been heard, or read when there is no
 * sound. On: the arrow is shown, and only dialogues marked `autoAdvance` move on
 * by themselves.
 */
export const SHOW_NEXT_BUTTON = false;

/**
 * Builder mode, for working on the game: switch it off before release.
 * On: the forward arrow on every card skips ahead even past cards never reached,
 * without answering and without recording anything as learning; and every part
 * in the Scenes menu can be opened, reached or not. Off: the learner's game.
 * Also on whenever the app is built with VITE_BUILDER_MODE=true.
 */
const BUILDER_MODE_ON = true; // ← the switch: true while building, false for the learner's game
export const BUILDER_MODE = BUILDER_MODE_ON || import.meta.env?.VITE_BUILDER_MODE === "true";
