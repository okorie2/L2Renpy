export const STT_PROVIDER = Symbol("STT_PROVIDER");

export interface RecognitionInput {
  audio: Buffer;
  mimeType: string;
  languageCode: string;
}

export interface RecognitionOutput {
  transcript: string;
  /** False when the recording held no usable speech (silence, noise). */
  speechDetected: boolean;
  confidence?: number;
}

/**
 * The only thing the rest of the backend knows about a speech-recognition engine.
 * It answers what was said, nothing more: meaning and pronunciation are judged elsewhere.
 */
export interface SttProvider {
  readonly id: string;
  /** Whether recognition can be used right now. Must be quick and must not throw. */
  isReady(): Promise<boolean>;
  transcribe(input: RecognitionInput): Promise<RecognitionOutput>;
}
