export const MOUTH_FPS = 20;
/** A frame counts as "mouth open" above this share of the clip's loudest frame. */
const OPEN_THRESHOLD = 0.18;

/** Locate the PCM data of a 16-bit WAV, walking chunks because `fmt ` is not always first. */
function readWav(audio: Buffer): { samples: Int16Array; sampleRate: number; channels: number } | undefined {
  if (audio.length < 12 || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") return undefined;
  let sampleRate = 0;
  let channels = 0;
  let bits = 0;
  for (let offset = 12; offset + 8 <= audio.length;) {
    const id = audio.toString("ascii", offset, offset + 4);
    const size = audio.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === "fmt ") {
      channels = audio.readUInt16LE(start + 2);
      sampleRate = audio.readUInt32LE(start + 4);
      bits = audio.readUInt16LE(start + 14);
    } else if (id === "data") {
      if (bits !== 16 || !sampleRate || !channels) return undefined;
      const end = Math.min(audio.length, start + size);
      const samples = new Int16Array(Math.floor((end - start) / 2));
      for (let i = 0; i < samples.length; i++) samples[i] = audio.readInt16LE(start + i * 2);
      return { samples, sampleRate, channels };
    }
    offset = start + size + (size % 2);
  }
  return undefined;
}

/**
 * A cheap lip-sync track: one "0" (closed) or "1" (open) per frame, from how loud
 * each frame is. Enough for a stylised 2D character with two mouth shapes.
 * Returns undefined for audio this cannot read, and the client then uses a steady flap.
 */
export function mouthTimeline(audio: Buffer, mimeType: string): string | undefined {
  if (mimeType !== "audio/wav") return undefined;
  const wav = readWav(audio);
  if (!wav) return undefined;

  const perFrame = Math.floor(wav.sampleRate / MOUTH_FPS) * wav.channels;
  if (perFrame === 0) return undefined;
  const loudness: number[] = [];
  for (let start = 0; start < wav.samples.length; start += perFrame) {
    let sum = 0;
    const end = Math.min(wav.samples.length, start + perFrame);
    for (let i = start; i < end; i++) sum += wav.samples[i] * wav.samples[i];
    loudness.push(Math.sqrt(sum / (end - start)));
  }
  const peak = Math.max(...loudness, 1);
  return loudness.map((value) => (value / peak > OPEN_THRESHOLD ? "1" : "0")).join("");
}
