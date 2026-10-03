import { PLAYER_SPEAKER_ID } from "../dialogue/models";
import { resolveTemplate, templateSlots, type SlotDefinition } from "../dialogue/template";
import type { LanguagePack } from "../languages/types";
import { ALL_PRACTICE_PHRASES, practiceChunk, splitWords } from "./practice";
import type { RecordedLine } from "./recordings";
import type { SpeechRate, WordTiming } from "./types";

/**
 * The voice pack: every line that sounds the same for every player, generated
 * once and shipped with the game (`public/assets/voices/pack/`), so it is never
 * generated again. Lines with something personal in them, such as the
 * player's name, are left out and made live by the backend.
 */
export interface VoiceLine {
  /** Who says it; absent for the narrator voice (model answers, phrasebook words). */
  speakerId?: string;
  languageCode: string;
  text: string;
  rate: SpeechRate;
  /** For a single word: the sentence around it, as it is asked for in practice. */
  context?: { before: string; after: string };
}

/** One packed line, as `manifest.json` lists it. */
export interface PackedLine extends VoiceLine {
  /** File under `voices/pack/`. */
  file: string;
  mouth?: string;
  /** [start, end, fromMs, toMs] per word. */
  words?: Array<[number, number, number, number]>;
}

/** The words a learner may be asked to practise on their own, as the evaluator splits them. */
export function practiceWords(text: string): string[] {
  return splitWords(text).map((item) => item.word);
}

/**
 * Every way a template can come out, or nothing if it holds anything personal.
 * Choices from a fixed list (the reason for learning, the level) are expanded.
 */
export function expandTemplate(template: string, slots: Record<string, SlotDefinition>): string[] {
  let results: Array<Record<string, string>> = [{}];
  for (const name of templateSlots(template)) {
    const slot = slots[name];
    if (!slot || slot.source === "profile") return [];
    const values = slot.source === "literal" ? [slot.value.target] : Object.values(slot.options).map((option) => option.target);
    results = results.flatMap((done) => values.map((value) => ({ ...done, [name]: value })));
  }
  return [...new Set(results.map((values) => resolveTemplate(template, values).text))];
}

export const lineKey = (line: Pick<VoiceLine, "speakerId" | "languageCode" | "text" | "rate">) =>
  `${line.speakerId ?? ""}|${line.languageCode}|${line.rate}|${line.text}`;

/**
 * The lines to pack: what characters say in every dialogue, the player's model
 * answers, the practice lines and their words with Sophie's prompts, and the
 * phrasebook. Recordings already shipped are left out.
 */
export function voicePackLines(
  pack: LanguagePack,
  options: { interfaceLanguageCode: string; dialogueSpeakers: Record<string, string>; recorded: RecordedLine[] }
): VoiceLine[] {
  const lines = new Map<string, VoiceLine>();
  const add = (line: VoiceLine) => {
    const recorded = options.recorded.some((item) => item.speakerId === line.speakerId && item.languageCode === line.languageCode && item.text === line.text);
    // A word met in several sentences is packed once, in the first.
    if (line.text.trim() && !(recorded && line.rate === "normal") && !lines.has(lineKey(line))) lines.set(lineKey(line), line);
  };
  // Lines in the language being learned can be asked for "Slower"; the learner's own language cannot.
  const both = (line: Omit<VoiceLine, "rate">) => {
    add({ ...line, rate: "normal" });
    if (line.languageCode === pack.code) add({ ...line, rate: "slow" });
  };
  const practiceSpeakers = new Set<string>();

  for (const dialogue of Object.values(pack.dialogues)) {
    for (const node of Object.values(dialogue.nodes)) {
      const languageCode = node.language === "interface" ? options.interfaceLanguageCode : pack.code;
      const npc = node.speakerId === PLAYER_SPEAKER_ID ? undefined : node.speakerId;
      for (const text of expandTemplate(node.targetText, pack.slots)) both({ speakerId: npc, languageCode, text });

      const response = node.response;
      if (response?.kind !== "practice") continue;
      // Practice is spoken by the character the dialogue belongs to.
      const teacher = options.dialogueSpeakers[dialogue.id];
      if (teacher) practiceSpeakers.add(teacher);
      for (const item of response.lines) {
        for (const text of expandTemplate(item.text, pack.slots)) {
          both({ speakerId: teacher, languageCode: pack.code, text });
          // Each word as it would be practised: on its own, or with its neighbour when it is short.
          splitWords(text).forEach(({ word }, index) => {
            const chunk = practiceChunk(text, word, index);
            both({ speakerId: teacher, languageCode: pack.code, text: chunk.text, context: chunk.context });
          });
        }
        // A line with the player's name in it is made live, but its other words can still be packed,
        // said in a version of the sentence with a stand-in name.
        const sample = item.text.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, "Marie");
        const personal = new Set(practiceWords(sample).filter((word) => !practiceWords(item.text.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, " ")).includes(word)));
        splitWords(sample).forEach(({ word }, index) => {
          const chunk = practiceChunk(sample, word, index);
          // A chunk with the stand-in name in it would be said with the player's own name: made live instead.
          if (personal.has(word) || practiceWords(chunk.text).some((part) => personal.has(part))) return;
          both({ speakerId: teacher, languageCode: pack.code, text: chunk.text, context: chunk.context });
        });
      }
    }
  }
  for (const speakerId of practiceSpeakers) {
    for (const text of ALL_PRACTICE_PHRASES) add({ speakerId, languageCode: options.interfaceLanguageCode, text, rate: "normal" });
  }
  for (const item of pack.vocabulary) add({ languageCode: pack.code, text: item.lemma, rate: "normal" });
  return [...lines.values()];
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The shipped pack, loaded once on first use. A missing or broken manifest simply means an empty pack. */
export interface VoicePack {
  /** Wait for the manifest, then find the line. */
  find(request: Pick<VoiceLine, "speakerId" | "languageCode" | "text"> & { rate?: SpeechRate }): Promise<PackedLine | undefined>;
  /** Without waiting: whether the line is known to be packed. False until the manifest has loaded. */
  has(request: Pick<VoiceLine, "speakerId" | "languageCode" | "text"> & { rate?: SpeechRate }): boolean;
  /** The URL of a packed line's audio. */
  url(line: PackedLine): string;
  /** Word timings for a recording shipped with the game, when the pack has them. */
  recordingWords(path: string): Promise<WordTiming[] | undefined>;
}

const toTimings = (words: Array<[number, number, number, number]> | undefined): WordTiming[] | undefined =>
  words?.length ? words.map(([start, end, from, to]) => ({ start, end, from: from / 1000, to: to / 1000 })) : undefined;

export function createVoicePack(urlFor: (path: string) => string, fetchImpl: Fetch = (input, init) => fetch(input, init)): VoicePack {
  let lines: Map<string, PackedLine> | undefined;
  let loading: Promise<Map<string, PackedLine>> | undefined;
  const key = (request: Pick<VoiceLine, "speakerId" | "languageCode" | "text"> & { rate?: SpeechRate }) =>
    lineKey({ ...request, rate: request.rate ?? "normal" });
  const load = () => {
    loading ??= fetchImpl(urlFor("voices/pack/manifest.json"))
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => [])
      .then((entries: unknown) => {
        lines = new Map();
        for (const entry of Array.isArray(entries) ? entries as PackedLine[] : []) {
          if (entry && typeof entry.text === "string" && typeof entry.file === "string") lines.set(lineKey(entry), entry);
        }
        return lines;
      });
    return loading;
  };
  let recordings: Promise<Record<string, Array<[number, number, number, number]>>> | undefined;
  return {
    recordingWords(path) {
      recordings ??= fetchImpl(urlFor("voices/pack/recordings.json"))
        .then((response) => (response.ok ? response.json() : {}))
        .catch(() => ({}));
      return recordings.then((all) => toTimings(Array.isArray(all?.[path]) ? all[path] : undefined));
    },
    async find(request) {
      return (await load()).get(key(request));
    },
    has(request) {
      if (!lines) void load();
      return lines?.has(key(request)) ?? false;
    },
    url: (line) => urlFor(`voices/pack/${line.file}`)
  };
}
