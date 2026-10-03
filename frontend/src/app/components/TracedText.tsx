import type { ReactNode } from "react";
import type { WordTiming } from "../../speech/types";

/**
 * Text that follows the voice: the word being said is highlighted, one word at
 * a time. Without timings (or before the voice starts) it is plain text.
 */
export function traceText(text: string, words: WordTiming[] | undefined, activeWord: number | undefined): ReactNode {
  if (!words?.length || activeWord === undefined) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  words.forEach((word, index) => {
    if (word.start < cursor || word.end > text.length) return;
    parts.push(text.slice(cursor, word.start));
    parts.push(<span key={word.start} className={`traced${index === activeWord ? " current" : ""}`}>{text.slice(word.start, word.end)}</span>);
    cursor = word.end;
  });
  parts.push(text.slice(cursor));
  return parts;
}
