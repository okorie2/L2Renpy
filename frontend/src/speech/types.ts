import type { AssistanceKind, LanguageConceptId, PronunciationDiagnostics } from "../learning/models";

/**
 * Provider-neutral speech contracts. Game and UI code depend only on these; a
 * concrete adapter (a backend proxy, a local model, a mock) is injected at the
 * composition root. Nothing here names a vendor.
 */

export interface AudioClip {
  data: Blob;
  mimeType: string;
  durationMs?: number;
}

export interface SpeechToTextProvider {
  transcribe(request: { audio: AudioClip; languageCode: string; signal?: AbortSignal }): Promise<{
    transcript: string;
    /** False when no usable speech was found (silence, noise). */
    speechDetected: boolean;
    confidence?: number;
  }>;
}

export type SpeechRate = "normal" | "slow";

export interface SynthesisRequest {
  text: string;
  languageCode: string;
  /** Who is speaking, as a game ID. Choosing an actual voice is the provider's business. */
  speakerId?: string;
  rate?: SpeechRate;
  /**
   * The sentence around a single word, so it is said as it sounds there and in
   * the right language. Only the word itself is spoken.
   */
  context?: { before: string; after: string };
  signal?: AbortSignal;
}

/** One open/closed flag per frame; enough to move a two-shape mouth with the voice. */
export interface MouthTimeline {
  framesPerSecond: number;
  frames: string;
}

/** When one word of the line is heard: its place in the text (end exclusive) and its time in seconds. */
export interface WordTiming {
  start: number;
  end: number;
  from: number;
  to: number;
}

export interface SynthesizedSpeech {
  audio: AudioClip;
  mouthTimeline?: MouthTimeline;
  /** Present when the voice provider says when each word is spoken. */
  words?: WordTiming[];
}

export interface TextToSpeechProvider {
  /** Identity used in cache keys so audio from different providers never mixes. */
  readonly providerId: string;
  synthesize(request: SynthesisRequest): Promise<SynthesizedSpeech>;
}

export interface PronunciationAssessor {
  /**
   * The exercise ID is the request; the content system owns the expected text,
   * phonemes, reference audio, unscored spans and rules behind it.
   */
  assess(request: { exerciseId: string; audio: AudioClip; languageCode: string; signal?: AbortSignal }): Promise<PronunciationDiagnostics>;
}

/**
 * The separate questions one spoken attempt answers. Communication success and
 * pronunciation quality are independent: a quest may advance on `communication`
 * while `pronunciation` only schedules practice.
 */
export interface SpeechAssessment {
  speechDetected: boolean;
  transcript: string;
  communication: {
    /** The meaning the learner conveyed, if one was recognised. */
    intentId?: string;
    /** Whether that meaning satisfies the current game objective. */
    satisfiesObjective: boolean;
    conceptIds: LanguageConceptId[];
    confidence?: number;
  };
  /** Absent when pronunciation was not analysed. Never gates progression. */
  pronunciation?: PronunciationDiagnostics;
  assistance: AssistanceKind[];
}

export type SpeechErrorKind =
  | "unavailable"
  | "permission-denied"
  | "no-microphone"
  | "no-speech"
  | "network"
  | "provider";

/** Whether the current build and device can take spoken input at all. */
export type SpeechCapability =
  | { available: true }
  | { available: false; reason: SpeechErrorKind };
