import type { ConversationIntent } from "./models";

/**
 * Communication assessment: did the learner convey this intent? It judges meaning,
 * not wording and not pronunciation. This rule-based version looks for key phrases;
 * a speech or AI assessor can replace it behind the same result shape.
 */
export interface CommunicationResult {
  communicated: boolean;
  /** 0 to 1. Rule matches are certain or absent; other assessors may be less sure. */
  confidence: number;
}

/** Lowercase, strip accents and punctuation, and split into words. Apostrophes stay inside words. */
export function normalizeUtterance(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export interface PlacedWord {
  /** The word as `normalizeUtterance` would give it. */
  word: string;
  /** Where it sits in the original text; `end` is exclusive. */
  start: number;
  end: number;
}

/** The same words as `normalizeUtterance`, each with its place in the original text. */
export function placeWords(text: string): PlacedWord[] {
  const placed: PlacedWord[] = [];
  let current: PlacedWord | undefined;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    // A combining accent written as its own character belongs to the letter before it.
    const letters = /[\u0300-\u036f]/.test(character) ? "" : normalizeUtterance(character).join("");
    const inWord = letters !== "" || (current !== undefined && /[\u0300-\u036f]/.test(character));
    if (!inWord) {
      current = undefined;
      continue;
    }
    if (!current) placed.push(current = { word: "", start: index, end: index });
    current.word += letters;
    current.end = index + 1;
  }
  return placed;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Learners mistype; a single slip in a longer word still communicates. */
function wordMatches(said: string, expected: string): boolean {
  return expected.length >= 5 ? editDistanceAtMostOne(said, expected) : said === expected;
}

/** Every position in `words` where `phrase` begins. */
export function phrasePositions(words: string[], phrase: string[]): number[] {
  const positions: number[] = [];
  if (phrase.length === 0) return positions;
  for (let start = 0; start + phrase.length <= words.length; start++) {
    if (phrase.every((expected, offset) => wordMatches(words[start + offset], expected))) positions.push(start);
  }
  return positions;
}

export function containsPhrase(words: string[], phrase: string[]): boolean {
  return phrasePositions(words, phrase).length > 0;
}

export function assessUtterance(text: string, intent: ConversationIntent): CommunicationResult {
  const words = normalizeUtterance(text);
  const communicated = intent.match.some((group) => (
    group.length > 0 && group.every((phrase) => containsPhrase(words, normalizeUtterance(phrase)))
  ));
  return { communicated, confidence: communicated ? 1 : 0 };
}
