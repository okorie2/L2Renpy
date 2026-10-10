/** Cue-driven facial motion. This deliberately does not claim audio/phoneme alignment. */
export function facialPose(time: number, speaking: number, offset = 0) {
  const strength = Math.max(0, Math.min(1, speaking));
  const cycle = ((time + offset) % 4.7 + 4.7) % 4.7;
  const blink = cycle < 0.19 ? Math.sin(cycle / 0.19 * Math.PI) : 0;
  const syllable = Math.max(0, Math.sin(time * 17.3) * 0.6 + Math.sin(time * 10.7 + 0.8) * 0.4);
  return {
    blink,
    mouth: strength * (0.12 + syllable * 0.88),
    nod: Math.sin(time * 3.1) * 0.025 * strength,
    glance: Math.sin(time * 0.67 + offset) * 0.018,
  };
}
