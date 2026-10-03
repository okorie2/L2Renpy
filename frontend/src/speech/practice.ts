/**
 * The pronunciation-practice loop, as plain data and pure functions. Ported from
 * the Ren'Py prototype (`game/systems/speech/practice.rpy`):
 *
 *   phrase attempt ── clear enough? ── yes ──▶ next line
 *        │ no
 *        ▼
 *   the word that needs it most, up to three tries (a sound-it-out guide on the third)
 *        ▼
 *   the whole line once more ──▶ next line, however it went
 *
 * Attempts are finite and the learner can always move on. The similarity values
 * steer the loop only; they are engineering numbers, never shown as a score.
 */

export const PHRASE_PASS = 0.85;
export const WORD_PASS = 0.8;
export const MAX_WORD_ATTEMPTS = 3;
/** The sound-it-out guide appears on this word attempt. */
export const GUIDE_ON_WORD_ATTEMPT = 3;

export interface PracticeWord {
  index: number;
  word: string;
  /** False for spans that are not graded, such as the learner's name. */
  scored: boolean;
  needsPractice: boolean;
  phoneticGuide?: string | null;
}

/** What the backend says about one attempt. */
export interface PracticeResult {
  similarity: number | null;
  words: PracticeWord[];
  weakestWord: PracticeWord | null;
}

/** The words around a word in its sentence, so the voice says it as it sounds there. */
export interface WordContext {
  before: string;
  after: string;
}

export type LineOutcome = "clear" | "practised";

export type PracticeFeedback =
  | { kind: "clear" }
  | { kind: "practise-word"; word: string }
  | { kind: "word-clear"; word: string }
  | { kind: "word-again"; word: string }
  | { kind: "word-done"; word: string }
  | { kind: "moving-on" };

export interface PracticeState {
  lineIndex: number;
  mode: "phrase" | "word";
  /** The last go at the whole line, after practising a word. */
  finalPhrase: boolean;
  word?: { text: string; phoneticGuide?: string | null; context?: WordContext };
  /** Word attempts already made. */
  wordAttempts: number;
  outcomes: LineOutcome[];
  /** How the last attempt went: what happened, how close it was, and the words it marked. */
  feedback?: PracticeFeedback;
  lastSimilarity?: number | null;
  lastWords?: PracticeWord[];
  done: boolean;
}

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*(?:-[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*)*/gu;

/** Words as the pronunciation evaluator splits them, with where they are in the text. */
export function splitWords(text: string): Array<{ word: string; start: number; end: number }> {
  return [...text.matchAll(WORD)].map((match) => ({ word: match[0], start: match.index ?? 0, end: (match.index ?? 0) + match[0].length }));
}

/** The sentence around word number `index` (or the first word that matches), for saying it in context. */
export function wordContext(line: string, word: string, index?: number): WordContext | undefined {
  const words = splitWords(line);
  const found = (index !== undefined && words[index]?.word === word ? words[index] : undefined) ?? words.find((item) => item.word === word);
  return found ? { before: line.slice(0, found.start).trim(), after: line.slice(found.end).trim() } : undefined;
}

export function startPractice(): PracticeState {
  return { lineIndex: 0, mode: "phrase", finalPhrase: false, wordAttempts: 0, outcomes: [], done: false };
}

/** What to say now: the line, or the word being practised, and whether to show the guide. */
export function practiceTarget(state: PracticeState, lines: string[]): { text: string; mode: "phrase" | "word"; guide?: string; context?: WordContext } | undefined {
  if (state.done) return undefined;
  if (state.mode === "word" && state.word) {
    const showGuide = state.wordAttempts + 1 >= GUIDE_ON_WORD_ATTEMPT && Boolean(state.word.phoneticGuide);
    return {
      text: state.word.text,
      mode: "word",
      ...(state.word.context ? { context: state.word.context } : {}),
      ...(showGuide ? { guide: state.word.phoneticGuide ?? undefined } : {})
    };
  }
  const text = lines[state.lineIndex];
  return text === undefined ? undefined : { text, mode: "phrase" };
}

function nextLine(state: PracticeState, lineCount: number, outcome: LineOutcome, feedback: PracticeFeedback, result: PracticeResult): PracticeState {
  const lineIndex = state.lineIndex + 1;
  return {
    lineIndex,
    mode: "phrase",
    finalPhrase: false,
    wordAttempts: 0,
    outcomes: [...state.outcomes, outcome],
    feedback,
    lastSimilarity: result.similarity,
    lastWords: result.words,
    done: lineIndex >= lineCount
  };
}

const passes = (value: number | null, threshold: number) => value !== null && value >= threshold;

/** Move the loop on after one attempt. `lines` are the practice lines, for saying a word in its sentence. */
export function recordAttempt(state: PracticeState, result: PracticeResult, lineCount: number, lines: string[] = []): PracticeState {
  if (state.done) return state;
  const heard = { lastSimilarity: result.similarity, lastWords: result.words };
  if (state.mode === "word" && state.word) {
    const wordAttempts = state.wordAttempts + 1;
    const word = state.word.text;
    if (passes(result.similarity, WORD_PASS)) {
      return { ...state, ...heard, mode: "phrase", finalPhrase: true, wordAttempts, feedback: { kind: "word-clear", word } };
    }
    if (wordAttempts >= MAX_WORD_ATTEMPTS) {
      return { ...state, ...heard, mode: "phrase", finalPhrase: true, wordAttempts, feedback: { kind: "word-done", word } };
    }
    return { ...state, ...heard, wordAttempts, feedback: { kind: "word-again", word } };
  }

  if (passes(result.similarity, PHRASE_PASS)) return nextLine(state, lineCount, state.finalPhrase ? "practised" : "clear", { kind: "clear" }, result);
  if (state.finalPhrase) return nextLine(state, lineCount, "practised", { kind: "moving-on" }, result);
  const weakest = result.weakestWord;
  if (!weakest?.word) return nextLine(state, lineCount, "practised", { kind: "moving-on" }, result);
  const line = lines[state.lineIndex];
  return {
    ...state,
    ...heard,
    mode: "word",
    word: { text: weakest.word, phoneticGuide: weakest.phoneticGuide, ...(line ? { context: wordContext(line, weakest.word, weakest.index) } : {}) },
    wordAttempts: 0,
    feedback: { kind: "practise-word", word: weakest.word }
  };
}

/**
 * What Sophie says, in the learner's own language. Each kind has several
 * wordings and she picks one, avoiding what she said recently, so she does not
 * sound like a recording. Feedback depends on how close the attempt was.
 */
export const PRACTICE_PHRASES = {
  // The attempt was excellent (very close to Sophie's own).
  excellent: ["Perfect!", "Beautiful!", "That was spot on!", "Excellent!", "That sounded really natural!"],
  // Clear enough to move on.
  clear: ["Great!", "Very good!", "Nicely done!", "Well said!", "That was clear!"],
  // Not quite, but close.
  close: ["So close!", "Almost there!", "Nearly!", "Really close!"],
  // Some of it came across.
  goodTry: ["That was a good try.", "Good effort!", "Not bad at all.", "You're getting there."],
  // Hard going: reassure.
  tricky: ["That one's tricky.", "No worries, it's a hard one.", "Don't worry, we'll get it together."],
  practisePart: ["Let's practise this part.", "Let's work on this bit.", "Try just this part.", "Let's focus on this one."],
  sayAgain: ["Say this again.", "Once more.", "Try it again.", "One more time."],
  wholeAgain: ["Now the whole sentence again.", "Now let's put it all together.", "Now try the full sentence.", "Let's try the whole thing again."],
  movingOn: ["Let's keep going.", "We'll come back to it later.", "Let's move on."],
  listenFirst: ["Listen, then say it after me.", "Listen first, then repeat after me."]
} as const;

export type PhraseKind = keyof typeof PRACTICE_PHRASES;

/** Every phrase Sophie may say, for the voice pack. */
export const ALL_PRACTICE_PHRASES: string[] = Object.values(PRACTICE_PHRASES).flat();

/** How an attempt went, as a kind of feedback. Close means within a short way of passing. */
export function feedbackKind(similarity: number | null | undefined, pass: number): Extract<PhraseKind, "excellent" | "clear" | "close" | "goodTry" | "tricky"> {
  if (similarity === null || similarity === undefined) return "goodTry";
  if (similarity >= 0.95) return "excellent";
  if (similarity >= pass) return "clear";
  if (similarity >= pass - 0.12) return "close";
  if (similarity >= 0.45) return "goodTry";
  return "tricky";
}

export type PhrasePicker = (kind: PhraseKind) => string;

/**
 * A picker that does not repeat itself: within a kind it never says the same
 * phrase twice running, and prefers ones it has not said lately.
 */
export function createPhrasePicker(random: () => number = Math.random): PhrasePicker {
  const recent: Partial<Record<PhraseKind, string[]>> = {};
  return (kind) => {
    const options = PRACTICE_PHRASES[kind];
    const said = recent[kind] ?? [];
    const fresh = options.filter((phrase) => !said.includes(phrase));
    const pool = fresh.length ? fresh : options.filter((phrase) => phrase !== said.at(-1));
    const phrase = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    // Remember up to half the options, so the rest come round before any repeat.
    recent[kind] = [...said, phrase].slice(-Math.max(1, Math.floor(options.length / 2)));
    return phrase;
  };
}

/** One thing said during practice: a prompt in the learner's language, or French to copy. */
export type PracticeUtterance = { kind: "prompt"; text: string } | { kind: "target"; text: string; context?: WordContext };

const prompt = (text: string): PracticeUtterance => ({ kind: "prompt", text });

/**
 * What Sophie says after an attempt: a word of feedback that fits how close it
 * was, what to do next, and then the French to copy.
 */
export function practiceSpeech(next: PracticeState, lines: string[], pick: PhrasePicker): PracticeUtterance[] {
  const upNext = practiceTarget(next, lines);
  const then: PracticeUtterance[] = upNext ? [{ kind: "target", text: upNext.text, ...(upNext.context ? { context: upNext.context } : {}) }] : [];
  const word = () => feedbackKind(next.lastSimilarity, WORD_PASS);
  const phrase = () => feedbackKind(next.lastSimilarity, PHRASE_PASS);
  switch (next.feedback?.kind) {
    case "clear": return [prompt(pick(phrase())), ...then];
    case "practise-word": return [prompt(pick(phrase())), prompt(pick("practisePart")), ...then];
    case "word-again": return [prompt(pick(word())), prompt(pick("sayAgain")), ...then];
    case "word-clear": return [prompt(pick(word())), prompt(pick("wholeAgain")), ...then];
    case "word-done": return [prompt(pick(word())), prompt(pick("wholeAgain")), ...then];
    case "moving-on": return [prompt(pick(phrase())), prompt(pick("movingOn")), ...then];
    default: return then;
  }
}
