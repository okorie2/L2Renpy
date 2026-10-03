import type { SynthesisRequest, SynthesizedSpeech, TextToSpeechProvider } from "./types";
import type { VoicePack } from "./voicePack";

/**
 * A line recorded once and shipped with the game, with its lip-sync track. The
 * line is matched by who says it, in which language, and its exact words; when
 * it is on screen this clip plays instead of a generated voice.
 */
export interface RecordedLine {
  speakerId: string;
  languageCode: string;
  text: string;
  /** Path under `public/assets/`. */
  path: string;
  /** One "0"/"1" per frame for the mouth. */
  mouth: string;
}

const MOUTH_FPS = 20;

/**
 * Sophie's welcome, recorded for the Ren'Py prototype with her ElevenLabs voice
 * (tag `renpy-final`, `game/audio/chapter1/scene1/sophie/`). The mouth tracks
 * are the `.lipsync` files that came with them.
 */
export const RECORDED_LINES: RecordedLine[] = [
  { speakerId: "sophie", languageCode: "en", text: "Hi! I'm Sophie.", path: "voices/sophie/en/hi-im-sophie.mp3", mouth: "111000011100111001111" },
  { speakerId: "sophie", languageCode: "en", text: "It's really nice to meet you.", path: "voices/sophie/en/nice-to-meet-you.mp3", mouth: "00000001110011100111100111" },
  { speakerId: "sophie", languageCode: "en", text: "What's your name?", path: "voices/sophie/en/whats-your-name.wav", mouth: "00000011001110011100000000000000000000000" },
  { speakerId: "sophie", languageCode: "en", text: "First, how much French do you already know?", path: "voices/sophie/en/french-level-question.mp3", mouth: "0001111000000111001111110001110011100111" },
  { speakerId: "sophie", languageCode: "en", text: "And why do you want to learn French?", path: "voices/sophie/en/why-learn-french.mp3", mouth: "0000111100110011100000111001110011" },
  { speakerId: "sophie", languageCode: "en", text: "Great.", path: "voices/sophie/en/great.mp3", mouth: "001111000000000000" },
  {
    speakerId: "sophie", languageCode: "en",
    text: "With the details you've given me, this is how you could introduce yourself in French.",
    path: "voices/sophie/en/how-i-would-introduce-myself.mp3",
    mouth: "00000111000011100111001110000001110000011100111000011100111001111100111"
  },
  { speakerId: "sophie", languageCode: "en", text: "I know, it's a mouthful!", path: "voices/sophie/en/mouthful.mp3", mouth: "0111001110000011001110000001100" },
  { speakerId: "sophie", languageCode: "en", text: "So we'll take it bit by bit.", path: "voices/sophie/en/bit-by-bit.mp3", mouth: "00111100110011111001110000000" }
];

export function findRecording(lines: RecordedLine[], request: Pick<SynthesisRequest, "text" | "languageCode" | "speakerId">): RecordedLine | undefined {
  return lines.find((line) => line.speakerId === request.speakerId && line.languageCode === request.languageCode && line.text === request.text);
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Recorded lines first, generated voices for everything else. A recording is
 * played at its own pace: "Slower" asks the generated voice instead. Without a
 * generated voice behind it, recordings still play.
 */
export function withRecordings(
  fallback: TextToSpeechProvider | undefined,
  lines: RecordedLine[],
  urlFor: (path: string) => string,
  fetchImpl: Fetch = (input, init) => fetch(input, init),
  pack?: VoicePack
): TextToSpeechProvider {
  /** Audio from the app's own files, labelled: iOS will not play a clip whose type it cannot tell. */
  const shipped = async (url: string, signal: AbortSignal | undefined) => {
    const response = await fetchImpl(url, { signal });
    if (!response.ok) return undefined;
    const mimeType = url.endsWith(".wav") ? "audio/wav" : "audio/mpeg";
    return { data: new Blob([await response.arrayBuffer()], { type: mimeType }), mimeType };
  };
  return {
    providerId: fallback ? `${fallback.providerId}+recordings` : "recordings",
    async synthesize(request: SynthesisRequest): Promise<SynthesizedSpeech> {
      const recorded = (request.rate ?? "normal") === "normal" ? findRecording(lines, request) : undefined;
      if (recorded) {
        const audio = await shipped(urlFor(recorded.path), request.signal);
        if (audio) {
          return {
            audio,
            mouthTimeline: /^[01]+$/.test(recorded.mouth) ? { frames: recorded.mouth, framesPerSecond: MOUTH_FPS } : undefined,
            words: await pack?.recordingWords(recorded.path)
          };
        }
      }
      // Lines generated once and shipped in the voice pack.
      const packed = await pack?.find(request);
      if (packed) {
        const audio = await shipped(pack!.url(packed), request.signal);
        if (audio) {
          return {
            audio,
            mouthTimeline: packed.mouth && /^[01]+$/.test(packed.mouth) ? { frames: packed.mouth, framesPerSecond: MOUTH_FPS } : undefined,
            words: packed.words?.length ? packed.words.map(([start, end, from, to]) => ({ start, end, from: from / 1000, to: to / 1000 })) : undefined
          };
        }
      }
      if (!fallback) throw new Error("No voice for this line");
      return fallback.synthesize(request);
    }
  };
}
