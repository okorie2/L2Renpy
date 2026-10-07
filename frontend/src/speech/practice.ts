import type { CharacterExpression } from "../characters/types";
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
  /** Share of the word's sounds that matched, 0 to 1, when it was graded. */
  score?: number | null;
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
  /**
   * The part being practised: the weak word, or for a short word, the word with
   * its neighbour, so there is enough sound to hear it by. `focus` is where the
   * weak word sits in `text`, and `focusIndex` which word of `text` it is.
   */
  word?: { text: string; focusWord: string; focus: { start: number; end: number }; focusIndex: number; phoneticGuide?: string | null; context?: WordContext };
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

/**
 * A word with this many letters or fewer ("je", "mes", "pour") is practised
 * with the word after it, or before it at the end of a line: on its own it is
 * one or two sounds, too little for the evaluator to hear reliably.
 */
export const SHORT_WORD_LETTERS = 4;
/** A chunk shorter than this is given one more word, as in "je ne sais". */
const CHUNK_MIN_LETTERS = 6;

export interface PracticeChunk {
  text: string;
  focus: { start: number; end: number };
  focusIndex: number;
  context?: WordContext;
}

const letters = (text: string) => text.replace(/[^\p{L}\p{N}]/gu, "").length;

/**
 * What to practise when word number `index` (or the first match of `word`) of
 * `line` needs it: the word itself, or with its neighbour when it is short, and
 * the rest of the sentence around it, so it is said as it sounds there.
 */
export function practiceChunk(line: string, word: string, index?: number): PracticeChunk {
  const words = splitWords(line);
  let at = index !== undefined && words[index]?.word === word ? index : words.findIndex((item) => item.word === word);
  if (at < 0) return { text: word, focus: { start: 0, end: word.length }, focusIndex: 0 };
  let from = at;
  let to = at;
  const grow = () => {
    if (to + 1 < words.length) to++;
    else if (from > 0) from--;
  };
  if (letters(words[at].word) <= SHORT_WORD_LETTERS) {
    grow();
    if (letters(words.slice(from, to + 1).map((item) => item.word).join("")) < CHUNK_MIN_LETTERS) grow();
  }
  const start = words[from].start;
  const end = words[to].end;
  return {
    text: line.slice(start, end),
    focus: { start: words[at].start - start, end: words[at].end - start },
    focusIndex: at - from,
    context: { before: line.slice(0, start).trim(), after: line.slice(end).trim() }
  };
}

/**
 * How the weak word went in an attempt at its chunk: its own score when the
 * evaluator gave one, otherwise the attempt's overall similarity.
 */
export function focusScore(state: PracticeState, result: PracticeResult): number | null {
  const word = state.word;
  const entry = word ? result.words.find((item) => item.index === word.focusIndex && item.word.toLowerCase() === word.focusWord.toLowerCase()) ?? result.words[word.focusIndex] : undefined;
  if (entry?.scored && typeof entry.score === "number") return entry.score;
  if (entry?.scored && entry.score === undefined) return entry.needsPractice ? Math.min(result.similarity ?? 0, WORD_PASS - 0.01) : Math.max(result.similarity ?? 0, WORD_PASS);
  return result.similarity;
}

export function startPractice(): PracticeState {
  return { lineIndex: 0, mode: "phrase", finalPhrase: false, wordAttempts: 0, outcomes: [], done: false };
}

/** What to say now: the line, or the word being practised, and whether to show the guide. */
export function practiceTarget(state: PracticeState, lines: string[]): { text: string; mode: "phrase" | "word"; guide?: string; context?: WordContext; focus?: { start: number; end: number } } | undefined {
  if (state.done) return undefined;
  if (state.mode === "word" && state.word) {
    const showGuide = state.wordAttempts + 1 >= GUIDE_ON_WORD_ATTEMPT && Boolean(state.word.phoneticGuide);
    return {
      text: state.word.text,
      mode: "word",
      // Only worth marking when the word has company.
      ...(state.word.text !== state.word.focusWord ? { focus: state.word.focus } : {}),
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
    // The chunk is judged by the weak word in it, and Sophie's feedback follows that word too.
    const score = focusScore(state, result);
    heard.lastSimilarity = score;
    if (passes(score, WORD_PASS)) {
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
  const chunk = line ? practiceChunk(line, weakest.word, weakest.index) : practiceChunk(weakest.word, weakest.word, 0);
  return {
    ...state,
    ...heard,
    mode: "word",
    word: {
      text: chunk.text,
      focusWord: weakest.word,
      focus: chunk.focus,
      focusIndex: chunk.focusIndex,
      phoneticGuide: weakest.phoneticGuide,
      ...(chunk.context ? { context: chunk.context } : {})
    },
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
  excellent: ["Perfect!", "Beautiful!", "That was spot on!", "Excellent!", "That sounded really natural!", "Wonderful!", "Brilliant!", "You sound like a local!"],
  // Clear enough to move on.
  clear: ["Great!", "Very good!", "Nicely done!", "Well said!", "That was clear!", "Good job!", "Nice work!", "You got it!", "Lovely!", "That's it!"],
  // Not quite, but close.
  close: ["So close!", "Almost there!", "Nearly!", "Really close!", "Very nearly!"],
  // Some of it came across.
  goodTry: ["That was a good try.", "Good effort!", "Not bad at all.", "You're getting there.", "Nice try!"],
  // Hard going: reassure.
  tricky: ["That one's tricky.", "No worries, it's a hard one.", "Don't worry, we'll get it together."],
  practisePart: ["Let's practise this part.", "Let's work on this bit.", "Try just this part.", "Let's focus on this one."],
  sayAgain: ["Say this again.", "Once more.", "Try it again.", "One more time."],
  wholeAgain: ["Now the whole sentence again.", "Now let's put it all together.", "Now try the full sentence.", "Let's try the whole thing again."],
  movingOn: ["Let's keep going.", "We'll come back to it later.", "Let's move on."],
  listenFirst: ["Listen, then say it after me.", "Listen first, then repeat after me."]
} as const;

export type PhraseKind = keyof typeof PRACTICE_PHRASES;

/**
 * Feedback on an answer that was understood. It moves the conversation on, so it
 * is never discouraging: an unscored answer counts as clear, and a hard one as a good try.
 */
export function answerFeedbackKind(similarity: number | null | undefined): PhraseKind {
  if (similarity === null || similarity === undefined) return "clear";
  const kind = feedbackKind(similarity, PHRASE_PASS);
  return kind === "tricky" ? "goodTry" : kind;
}

/** Every phrase Sophie may say, for the voice pack. */
export const ALL_PRACTICE_PHRASES: string[] = Object.values(PRACTICE_PHRASES).flat();

/** Sophie's gesture for each kind of thing she says during practice. */
const PHRASE_EXPRESSION: Record<PhraseKind, CharacterExpression> = {
  excellent: "excellent",
  clear: "well-done",
  close: "close",
  goodTry: "good-try",
  tricky: "good-try",
  practisePart: "beckoning",
  sayAgain: "beckoning",
  wholeAgain: "beckoning",
  movingOn: "presenting",
  listenFirst: "presenting"
};
const PHRASE_KINDS = new Map<string, PhraseKind>(
  (Object.entries(PRACTICE_PHRASES) as Array<[PhraseKind, readonly string[]]>).flatMap(([kind, phrases]) => phrases.map((text) => [text, kind] as [string, PhraseKind]))
);

/**
 * How Sophie looks at each moment of practice: a gesture that fits what she is
 * saying, the French line said as French, and her hand to her ear while it is
 * the learner's turn.
 */
export function practiceExpression(saying: { text: string; languageCode: string } | undefined, targetLanguageCode: string): CharacterExpression {
  if (!saying) return "listening";
  if (saying.languageCode === targetLanguageCode) return "speaking-french";
  const kind = PHRASE_KINDS.get(saying.text);
  return kind ? PHRASE_EXPRESSION[kind] : "talking";
}

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

/** Lower case, without accents or punctuation, split into words. */
const wordsOf = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ")
  .split(/\s+/).filter(Boolean);

/**
 * A typed line counts when it has most of the line's words, accents and punctuation
 * aside (a phone keyboard makes those hard). Words that aren't graded, like the
 * learner's name, don't count either way.
 */
export function typedLineMatches(typed: string, line: string, excluded: string[]): boolean {
  const skip = new Set(excluded.flatMap(wordsOf));
  const wanted = wordsOf(line).filter((word) => !skip.has(word));
  if (!wanted.length) return true;
  const given = new Set(wordsOf(typed));
  return wanted.filter((word) => given.has(word)).length / wanted.length >= 0.8;
}
