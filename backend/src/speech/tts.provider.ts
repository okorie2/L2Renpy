export const TTS_PROVIDER = Symbol("TTS_PROVIDER");

export interface SynthesisInput {
  text: string;
  languageCode: string;
  /** A voice name this provider understands; chosen by the server, never by the client. */
  voice: string;
  rate: "normal" | "slow";
}

export interface SynthesisOutput {
  audio: Buffer;
  mimeType: string;
}

/**
 * The only thing the rest of the backend knows about a speech vendor. An adapter
 * holds its own credentials and model choice; nothing vendor-specific leaks past it.
 */
export interface TtsProvider {
  /** Identity used in cache keys, so audio from different providers or models never mixes. */
  readonly id: string;
  readonly model: string;
  /**
   * Called once at startup: load models, check credentials, list voices. A provider
   * that cannot serve must reject, which keeps the service not-ready.
   */
  warmUp(): Promise<void>;
  /** Whether this provider can speak with the given voice. */
  hasVoice(voice: string): boolean;
  synthesize(input: SynthesisInput): Promise<SynthesisOutput>;
}
