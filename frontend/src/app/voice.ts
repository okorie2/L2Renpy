import { useCallback, useEffect, useRef, useState } from "react";
import { logWarning } from "../diagnostics/log";
import { mouthOpenAt } from "../speech/mouth";
import type { MouthTimeline, SpeechRate, SynthesizedSpeech, WordTiming } from "../speech/types";
import type { VoiceLibrary } from "../speech/voiceLibrary";

export interface AudioSettings {
  /** Speak lines aloud. */
  voice: boolean;
  volume: number;
  /** Show the written line while it is spoken. Off means listen first, reveal on request. */
  subtitles: boolean;
}

const SETTINGS_KEY = "second-language.audio";
const DEFAULT_SETTINGS: AudioSettings = { voice: true, volume: 1, subtitles: true };

function loadSettings(): AudioSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<AudioSettings>;
    return {
      voice: typeof stored.voice === "boolean" ? stored.voice : DEFAULT_SETTINGS.voice,
      volume: typeof stored.volume === "number" ? Math.min(1, Math.max(0, stored.volume)) : DEFAULT_SETTINGS.volume,
      subtitles: typeof stored.subtitles === "boolean" ? stored.subtitles : DEFAULT_SETTINGS.subtitles
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Per-device listening preferences. They are not game progress, so they live outside the save. */
export function useAudioSettings(): [AudioSettings, (change: Partial<AudioSettings>) => void] {
  const [settings, setSettings] = useState(loadSettings);
  const update = useCallback((change: Partial<AudioSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...change };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
      return next;
    });
  }, []);
  return [settings, update];
}

// One element for every line: browsers allow later plays on an element first started by a tap.
let sharedAudio: HTMLAudioElement | undefined;
const audioElement = () => (sharedAudio ??= new Audio());
const urls = new WeakMap<Blob, string>();
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

/** Call from a tap handler before lines need to play, so later playback is permitted. */
export function unlockVoice(): void {
  const audio = audioElement();
  if (!audio.paused) return;
  audio.src = SILENCE;
  audio.play().catch(() => undefined);
}

/** Silence whatever line is playing, for example when the learner starts to speak. */
export function stopVoice(): void {
  sharedAudio?.pause();
}

/** Release the object URL of a line that has left the library. */
export function releaseSpeech(speech: SynthesizedSpeech): void {
  const url = urls.get(speech.audio.data);
  if (url) URL.revokeObjectURL(url);
  urls.delete(speech.audio.data);
}

function urlFor(speech: SynthesizedSpeech): string {
  let url = urls.get(speech.audio.data);
  if (!url) {
    url = URL.createObjectURL(speech.audio.data);
    urls.set(speech.audio.data, url);
  }
  return url;
}

/**
 * Say one piece of text once, on request: a word in the phrasebook, a message.
 * Call it from the tap itself. Quietly does nothing when voices are off or away.
 */
export function playText(library: VoiceLibrary | undefined, settings: AudioSettings, request: { text: string; languageCode: string; speakerId?: string; rate?: SpeechRate }): void {
  if (!library || !settings.voice) return;
  const audio = audioElement();
  audio.pause();
  void library.get({ ...request, rate: request.rate ?? "normal" }).then((speech) => {
    if (!speech) return;
    audio.volume = settings.volume;
    audio.src = urlFor(speech);
    audio.currentTime = 0;
    audio.play().catch(() => undefined);
  });
}

export interface SpokenLine {
  /** Changes whenever a different line is on screen. */
  key: string;
  text: string;
  languageCode: string;
  speakerId?: string;
  /** Speak as soon as the line appears. Otherwise only on request. */
  autoplay: boolean;
}

export type VoiceStatus = "off" | "loading" | "playing" | "paused" | "finished" | "unavailable";

/** The word being heard at `time`, as an index into `words`; after the last word, the last one. */
export function wordAt(words: WordTiming[] | undefined, time: number): number | undefined {
  if (!words?.length || time < words[0].from) return undefined;
  let current: number | undefined;
  for (let index = 0; index < words.length; index++) {
    if (words[index].from <= time) current = index;
    else break;
  }
  return current;
}

export interface LineVoice {
  status: VoiceStatus;
  /** When each word is spoken, for tracing the text as it is heard. */
  words?: WordTiming[];
  /** The word being spoken now, while the line plays. */
  activeWord?: number;
  /** A voice can be requested for this line right now. */
  canPlay: boolean;
  mouthOpen: boolean;
  play: (rate: SpeechRate) => void;
  /** Hold the line where it is; a line still loading waits, ready, instead of starting. */
  pause: () => void;
  /** Carry on from where it was paused. */
  resume: () => void;
  /** Whether the learner actually listened to most of the line. */
  wasHeard: () => boolean;
}

const HEARD_SHARE = 0.6;
const MOUTH_INTERVAL_MS = 50;

/**
 * Voice for the line on screen. Text never waits for audio: the line is shown at
 * once and the voice joins when it is ready, or not at all if the backend is away.
 */
export function useLineVoice(library: VoiceLibrary | undefined, settings: AudioSettings, line: SpokenLine | undefined): LineVoice {
  const enabled = Boolean(library) && settings.voice;
  const [status, setStatus] = useState<VoiceStatus>("off");
  const [mouthOpen, setMouthOpen] = useState(false);
  const [words, setWords] = useState<WordTiming[] | undefined>(undefined);
  const [activeWord, setActiveWord] = useState<number | undefined>(undefined);
  const heard = useRef(false);
  const request = useRef(0);
  const held = useRef(false);
  const statusRef = useRef<VoiceStatus>("off");
  statusRef.current = status;
  const timeline = useRef<MouthTimeline | undefined>(undefined);
  const lineRef = useRef(line);
  lineRef.current = line;

  const play = useCallback((rate: SpeechRate) => {
    const current = lineRef.current;
    if (!library || !current) return;
    const ticket = ++request.current;
    const audio = audioElement();
    audio.pause();
    // Asking to hear a line again is also asking to carry on.
    held.current = false;
    setStatus("loading");
    void library.get({ text: current.text, languageCode: current.languageCode, speakerId: current.speakerId, rate }).then((speech) => {
      if (ticket !== request.current) return;
      if (!speech) {
        setStatus("unavailable");
        return;
      }
      timeline.current = speech.mouthTimeline;
      setWords(speech.words);
      audio.src = urlFor(speech);
      audio.currentTime = 0;
      if (held.current) {
        setStatus("paused");
        return;
      }
      audio.play().then(
        () => { if (ticket === request.current) setStatus("playing"); },
        // Playback refused (no tap yet, or the device is muted by policy): stay silent.
        (error: unknown) => {
          logWarning("voice", "The device would not play a line", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
          if (ticket === request.current) setStatus("unavailable");
        }
      );
    });
  }, [library]);

  const pause = useCallback(() => {
    held.current = true;
    if (statusRef.current === "playing") {
      audioElement().pause();
      setStatus("paused");
    }
  }, []);

  const resume = useCallback(() => {
    if (!held.current) return;
    held.current = false;
    if (statusRef.current !== "paused") return;
    const ticket = request.current;
    audioElement().play().then(
      () => { if (ticket === request.current) setStatus("playing"); },
      () => { if (ticket === request.current) setStatus("unavailable"); }
    );
  }, []);

  // Follow the line on screen: speak it, or fall silent when it goes.
  useEffect(() => {
    heard.current = false;
    held.current = false;
    setMouthOpen(false);
    setWords(undefined);
    setActiveWord(undefined);
    setStatus("off");
    if (enabled && line?.autoplay) play("normal");
    return () => {
      request.current++;
      audioElement().pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line?.key, enabled, play]);

  useEffect(() => {
    audioElement().volume = settings.volume;
  }, [settings.volume]);

  // While a clip plays, move the mouth with it and notice when it has been heard.
  useEffect(() => {
    if (status !== "playing") {
      setMouthOpen(false);
      if (status !== "finished" && status !== "paused") setActiveWord(undefined);
      return;
    }
    const audio = audioElement();
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const tick = () => {
      if (audio.duration > 0 && audio.currentTime / audio.duration >= HEARD_SHARE) heard.current = true;
      if (!still) setMouthOpen(mouthOpenAt(timeline.current, audio.currentTime));
      setActiveWord(wordAt(words, audio.currentTime));
    };
    const finish = () => {
      heard.current = true;
      setStatus("finished");
    };
    const timer = window.setInterval(tick, MOUTH_INTERVAL_MS);
    audio.addEventListener("ended", finish);
    return () => {
      window.clearInterval(timer);
      audio.removeEventListener("ended", finish);
    };
  }, [status, words]);

  return {
    status,
    words,
    activeWord: status === "playing" || status === "paused" ? activeWord : undefined,
    canPlay: enabled && Boolean(line) && (library?.available ?? false),
    mouthOpen,
    play,
    pause,
    resume,
    wasHeard: () => heard.current
  };
}

/** One thing a character says in a sequence: a prompt in the learner's language, or a line to learn. */
export interface SpokenItem {
  text: string;
  languageCode: string;
  speakerId?: string;
  rate?: SpeechRate;
  /** For a single word: the sentence around it, so it is said as it sounds there. */
  context?: { before: string; after: string };
}

export interface SpeakerState {
  /** Which item of the sequence is playing. */
  item: SpokenItem;
  words?: WordTiming[];
  activeWord?: number;
  mouthOpen: boolean;
}

/**
 * Say several things in a row in one voice, such as "That was a good try. Let's
 * practise this part." followed by the word. Each item is fetched, played to the
 * end, and traced word by word when timings exist. A new sequence replaces the
 * one playing. Resolves when the sequence ends or is replaced.
 */
export function useSpeaker(library: VoiceLibrary | undefined, settings: AudioSettings) {
  const [state, setState] = useState<SpeakerState | null>(null);
  const ticket = useRef(0);
  const held = useRef(false);

  const stop = useCallback(() => {
    ticket.current++;
    held.current = false;
    audioElement().pause();
    setState(null);
  }, []);

  /** Hold the sequence: the clip stops where it is and nothing more is said until `resume`. */
  const pause = useCallback(() => {
    held.current = true;
    audioElement().pause();
    setState((current) => (current ? { ...current, mouthOpen: false } : current));
  }, []);
  const resume = useCallback(() => {
    if (!held.current) return;
    held.current = false;
    const audio = audioElement();
    // Carry on with the clip that was cut off, if one was.
    if (audio.paused && audio.currentTime > 0 && !audio.ended) audio.play().catch(() => undefined);
  }, []);
  useEffect(() => stop, [stop]);

  const speak = useCallback(async (items: SpokenItem[]): Promise<void> => {
    const current = ++ticket.current;
    held.current = false;
    const audio = audioElement();
    audio.pause();
    if (!library || !settings.voice) {
      setState(null);
      return;
    }
    audio.volume = settings.volume;
    const whilePaused = async () => {
      while (held.current && current === ticket.current) await new Promise((resolve) => window.setTimeout(resolve, 100));
    };
    for (const item of items) {
      await whilePaused();
      if (current !== ticket.current) return;
      const speech = await library.get({ text: item.text, languageCode: item.languageCode, speakerId: item.speakerId, rate: item.rate ?? "normal", ...(item.context ? { context: item.context } : {}) });
      await whilePaused();
      if (current !== ticket.current) return;
      if (!speech) continue;
      setState({ item, words: speech.words, mouthOpen: false });
      audio.src = urlFor(speech);
      audio.currentTime = 0;
      await new Promise<void>((resolve) => {
        const timer = window.setInterval(() => {
          if (current !== ticket.current) return finish();
          if (held.current) return;
          setState({ item, words: speech.words, activeWord: wordAt(speech.words, audio.currentTime), mouthOpen: mouthOpenAt(speech.mouthTimeline, audio.currentTime) });
        }, MOUTH_INTERVAL_MS);
        const finish = () => {
          window.clearInterval(timer);
          audio.removeEventListener("ended", finish);
          audio.removeEventListener("pause", interrupted);
          audio.removeEventListener("error", finish);
          resolve();
        };
        audio.addEventListener("ended", finish);
        // Paused on purpose, the clip is only waiting; paused by anything else, it is over.
        const interrupted = () => { if (!held.current) finish(); };
        audio.addEventListener("pause", interrupted);
        audio.addEventListener("error", finish);
        audio.play().catch(finish);
      });
      // A short breath between one thing said and the next.
      if (current === ticket.current) await new Promise((resolve) => window.setTimeout(resolve, 250));
      await whilePaused();
    }
    if (current === ticket.current) setState(null);
  }, [library, settings.voice, settings.volume]);

  return { speaking: state, speak, stop, pause, resume };
}
