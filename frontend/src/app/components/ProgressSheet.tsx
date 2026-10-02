import type { ConceptSummary, LearningSummary } from "../../learning/summary";

type Props = {
  summary: LearningSummary;
};

const SUPPORT_TEXT = {
  full: "Translations and example answers are shown as you go.",
  guided: "Translations and example answers are one tap away.",
  independent: "Help stays out of the way until you ask for it."
};
const BASIS_TEXT = {
  default: "This is the starting level.",
  "self-reported": "Set from what you told Sophie; it will follow how you get on.",
  observed: "Set from how your recent conversations went."
};

/** How the learner showed it, in plain words. Typing and speaking are never merged. */
function how(entry: ConceptSummary): string {
  const parts = [];
  if (entry.producedBySpeaking) parts.push(`said it ${entry.producedBySpeaking}×`);
  if (entry.producedByWriting) parts.push(`wrote it ${entry.producedByWriting}×`);
  if (entry.understood) parts.push(`understood it ${entry.understood}×`);
  if (entry.misses) parts.push(`${entry.misses} ${entry.misses === 1 ? "miss" : "misses"}`);
  return parts.join(" · ");
}

function Group({ title, note, entries, className }: { title: string; note?: string; entries: ConceptSummary[]; className?: string }) {
  if (!entries.length) return null;
  return (
    <section className="quest-section">
      <h3>{title}</h3>
      {note && <p className="progress-note">{note}</p>}
      <ul className="progress-list">
        {entries.map((entry) => (
          <li key={entry.concept.id} className={className}>
            {entry.concept.description}
            {how(entry) && <small>{how(entry)}</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What the game can say about the learner's language so far. It describes what
 * was met, understood and produced; it never shows a score or a percentage, and
 * XP plays no part.
 */
export function ProgressSummary({ summary }: Props) {
  const practice = summary.concepts.filter((entry) => entry.needsPractice);
  const settled = summary.concepts.filter((entry) => !entry.needsPractice);
  const empty = summary.concepts.every((entry) => entry.standing === "not-met");
  return (
    <>
      {empty && <p className="progress-note">Nothing yet. Go and talk to someone!</p>}
      <Group
        title="On your own"
        entries={settled.filter((entry) => entry.standing === "independent")}
        className="independent"
      />
      <Group title="With some help" entries={settled.filter((entry) => entry.standing === "with-support")} />
      <Group title="Needs more practice" entries={practice} className="practice" />
      <Group
        title="Met so far"
        note="You've come across these but haven't had to use them yet."
        entries={settled.filter((entry) => entry.standing === "met")}
      />
      <section className="quest-section">
        <h3>Support</h3>
        <p className="progress-note">{SUPPORT_TEXT[summary.support.level]} {BASIS_TEXT[summary.support.basis]}</p>
      </section>
    </>
  );
}
