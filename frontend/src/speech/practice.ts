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

export type LineOutcome = "clear" | "practised" | "skipped";

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
  word?: { text: string; phoneticGuide?: string | null };
  /** Word attempts already made. */
  wordAttempts: number;
  outcomes: LineOutcome[];
  /** How the last attempt went, with the words it marked. */
  feedback?: PracticeFeedback;
  lastWords?: PracticeWord[];
  done: boolean;
}

export function startPractice(): PracticeState {
  return { lineIndex: 0, mode: "phrase", finalPhrase: false, wordAttempts: 0, outcomes: [], done: false };
}

/** What to say now: the line, or the word being practised, and whether to show the guide. */
export function practiceTarget(state: PracticeState, lines: string[]): { text: string; mode: "phrase" | "word"; guide?: string } | undefined {
  if (state.done) return undefined;
  if (state.mode === "word" && state.word) {
    const showGuide = state.wordAttempts + 1 >= GUIDE_ON_WORD_ATTEMPT && Boolean(state.word.phoneticGuide);
    return { text: state.word.text, mode: "word", ...(showGuide ? { guide: state.word.phoneticGuide ?? undefined } : {}) };
  }
  const text = lines[state.lineIndex];
  return text === undefined ? undefined : { text, mode: "phrase" };
}

function nextLine(state: PracticeState, lineCount: number, outcome: LineOutcome, feedback: PracticeFeedback | undefined, words?: PracticeWord[]): PracticeState {
  const lineIndex = state.lineIndex + 1;
  return {
    lineIndex,
    mode: "phrase",
    finalPhrase: false,
    wordAttempts: 0,
    outcomes: [...state.outcomes, outcome],
    feedback,
    lastWords: words,
    done: lineIndex >= lineCount
  };
}

const passes = (value: number | null, threshold: number) => value !== null && value >= threshold;

/** Move the loop on after one attempt. */
export function recordAttempt(state: PracticeState, result: PracticeResult, lineCount: number): PracticeState {
  if (state.done) return state;
  if (state.mode === "word" && state.word) {
    const wordAttempts = state.wordAttempts + 1;
    const word = state.word.text;
    if (passes(result.similarity, WORD_PASS)) {
      return { ...state, mode: "phrase", finalPhrase: true, wordAttempts, feedback: { kind: "word-clear", word }, lastWords: result.words };
    }
    if (wordAttempts >= MAX_WORD_ATTEMPTS) {
      return { ...state, mode: "phrase", finalPhrase: true, wordAttempts, feedback: { kind: "word-done", word }, lastWords: result.words };
    }
    return { ...state, wordAttempts, feedback: { kind: "word-again", word }, lastWords: result.words };
  }

  if (passes(result.similarity, PHRASE_PASS)) return nextLine(state, lineCount, state.finalPhrase ? "practised" : "clear", { kind: "clear" }, result.words);
  if (state.finalPhrase) return nextLine(state, lineCount, "practised", { kind: "moving-on" }, result.words);
  const weakest = result.weakestWord;
  if (!weakest?.word) return nextLine(state, lineCount, "practised", { kind: "moving-on" }, result.words);
  return {
    ...state,
    mode: "word",
    word: { text: weakest.word, phoneticGuide: weakest.phoneticGuide },
    wordAttempts: 0,
    feedback: { kind: "practise-word", word: weakest.word },
    lastWords: result.words
  };
}

/** The learner chose to move on: this line ends here, as practised as it is. */
export function skipLine(state: PracticeState, lineCount: number): PracticeState {
  if (state.done) return state;
  return nextLine(state, lineCount, "skipped", undefined);
}

export const FEEDBACK_TEXT: Record<PracticeFeedback["kind"], (word: string) => string> = {
  clear: () => "Très bien ! That was clear.",
  "practise-word": (word) => `Let's practise one word: “${word}”.`,
  "word-clear": (word) => `Bien ! “${word}” sounded right. Now the whole sentence again.`,
  "word-again": (word) => `Nearly. Listen to “${word}” once more and try again.`,
  "word-done": () => "Good effort. Now the whole sentence again.",
  "moving-on": () => "Good effort. We'll come back to this one later."
};

export function feedbackText(feedback: PracticeFeedback): string {
  return FEEDBACK_TEXT[feedback.kind]("word" in feedback ? feedback.word : "");
}
