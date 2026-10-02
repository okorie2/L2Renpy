import { containsPhrase, normalizeUtterance, phrasePositions, placeWords } from "./assessment";
import type { VocabularyItem } from "./models";

/**
 * The vocabulary items that appear in a piece of text, in any of their surface
 * forms. Used for the lines the learner meets and for what they actually say,
 * so nothing has to be tagged by hand.
 */
export function vocabularyInText(text: string, vocabulary: VocabularyItem[]): string[] {
  const words = normalizeUtterance(text);
  return vocabulary
    .filter((item) => item.surfaceForms.some((form) => containsPhrase(words, normalizeUtterance(form))))
    .map((item) => item.id);
}

export interface TextSpan {
  start: number;
  /** Exclusive. */
  end: number;
}

/**
 * Where the given vocabulary items appear in a piece of text, as non-overlapping
 * stretches of the original string in reading order. For showing a learner which
 * of their own words were recognised.
 */
export function vocabularySpans(text: string, vocabulary: VocabularyItem[], vocabularyIds: string[]): TextSpan[] {
  const placed = placeWords(text);
  const words = placed.map((item) => item.word);
  const spans: TextSpan[] = [];
  for (const item of vocabulary) {
    if (!vocabularyIds.includes(item.id)) continue;
    for (const form of item.surfaceForms) {
      const phrase = normalizeUtterance(form);
      for (const position of phrasePositions(words, phrase)) {
        spans.push({ start: placed[position].start, end: placed[position + phrase.length - 1].end });
      }
    }
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: TextSpan[] = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}
