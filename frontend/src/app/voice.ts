import { useCallback, useEffect, useRef, useState } from "react";
import { mouthOpenAt } from "../speech/mouth";
import type { MouthTimeline, SpeechRate, SynthesizedSpeech } from "../speech/types";
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

export type VoiceStatus = "off" | "loading" | "playing" | "finished" | "unavailable";

export interface LineVoice {
  status: VoiceStatus;
  /** A voice can be requested for this line right now. */
  canPlay: boolean;
  mouthOpen: boolean;
  play: (rate: SpeechRate) => void;
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
  const heard = useRef(false);
  const request = useRef(0);
  const timeline = useRef<MouthTimeline | undefined>(undefined);
  const lineRef = useRef(line);
  lineRef.current = line;

  const play = useCallback((rate: SpeechRate) => {
    const current = lineRef.current;
    if (!library || !current) return;
    const ticket = ++request.current;
    const audio = audioElement();
    audio.pause();
    setStatus("loading");
    void library.get({ text: current.text, languageCode: current.languageCode, speakerId: current.speakerId, rate }).then((speech) => {
      if (ticket !== request.current) return;
      if (!speech) {
        setStatus("unavailable");
        return;
      }
      timeline.current = speech.mouthTimeline;
      audio.src = urlFor(speech);
      audio.currentTime = 0;
      audio.play().then(
        () => { if (ticket === request.current) setStatus("playing"); },
        // Playback refused (no tap yet, or the device is muted by policy): stay silent.
        () => { if (ticket === request.current) setStatus("unavailable"); }
      );
    });
  }, [library]);

  // Follow the line on screen: speak it, or fall silent when it goes.
  useEffect(() => {
    heard.current = false;
    setMouthOpen(false);
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
      return;
    }
    const audio = audioElement();
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const tick = () => {
      if (audio.duration > 0 && audio.currentTime / audio.duration >= HEARD_SHARE) heard.current = true;
      if (!still) setMouthOpen(mouthOpenAt(timeline.current, audio.currentTime));
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
  }, [status]);

  return {
    status,
    canPlay: enabled && Boolean(line) && (library?.available ?? false),
    mouthOpen,
    play,
    wasHeard: () => heard.current
  };
}
