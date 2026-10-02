import type { HistoryLine } from "../../dialogue/engine";

export const SAID_LABEL = { speech: "You said", typed: "You wrote", selected: "You chose" } as const;

/** One of the player's own answers with the words that were recognised marked. */
export function SaidText({ line, languageCode }: { line: HistoryLine; languageCode: string }) {
  const parts = [];
  let cursor = 0;
  for (const span of line.said?.usedWords ?? []) {
    parts.push(line.text.slice(cursor, span.start));
    parts.push(<mark key={span.start} className="used-word">{line.text.slice(span.start, span.end)}</mark>);
    cursor = span.end;
  }
  parts.push(line.text.slice(cursor));
  return <span lang={languageCode}>{parts}</span>;
}

/** In plain words, how an answer went. Says nothing about pronunciation, which is not judged. */
export function saidSummary(line: HistoryLine): string | undefined {
  const result = line.said;
  if (!result) return undefined;
  if (!result.communicated) return "That didn't come across.";
  const how = result.mode === "selected" ? "Understood. You picked it from the suggestions."
    : result.attempt > 1 ? `Understood on try ${result.attempt}.`
    : result.helped ? "Understood first time, with some help."
    : "Understood first time, on your own.";
  return result.usedWords.length ? `${how} The marked words now count as used.` : how;
}
