import type { MouthTimeline } from "./types";

/** Open/close rate used when a clip has no timeline of its own. */
const FALLBACK_FLAPS_PER_SECOND = 3;

/**
 * Whether the mouth is open at a moment of playback. With a timeline the mouth
 * follows the voice; without one it flaps steadily while audio plays.
 */
export function mouthOpenAt(timeline: MouthTimeline | undefined, seconds: number): boolean {
  if (seconds < 0) return false;
  if (!timeline || !timeline.frames) return Math.floor(seconds * FALLBACK_FLAPS_PER_SECOND * 2) % 2 === 0;
  return timeline.frames[Math.floor(seconds * timeline.framesPerSecond)] === "1";
}
