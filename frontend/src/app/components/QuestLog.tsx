import type { Item } from "../../core/models";
import type { QuestLogEntry } from "../../core/quests";

type Props = {
  entries: QuestLogEntry[];
  items: Item[];
};

function Section({ title, entries, items }: { title: string; entries: QuestLogEntry[]; items: Item[] }) {
  if (!entries.length) return null;
  return (
    <section className="quest-section">
      <h3>{title}</h3>
      {entries.map(({ quest, status, objectives }) => {
        // Upcoming steps stay hidden so the log guides without spoiling the chapter.
        const shown = objectives.filter((item) => item.state !== "upcoming");
        const required = objectives.filter((item) => !item.objective.optional);
        const done = required.filter((item) => item.state === "completed").length;
        return (
          <article key={quest.id} className={`quest-entry ${status}`}>
            <header>
              <strong lang="fr">{quest.title}</strong>
              {status !== "available" && <span className="quest-count">{done} / {required.length}</span>}
            </header>
            <p className="quest-summary-text">{quest.summary}</p>
            {status === "available" && quest.start && <p className="quest-start">To begin: {quest.start.description}</p>}
            {status !== "available" && (
              <ul>
                {shown.map(({ objective, state, count, target }) => (
                  <li key={objective.id} className={state}>
                    <span className="objective-mark" aria-hidden="true">{state === "completed" ? "✓" : "•"}</span>
                    <span>
                      {objective.description}
                      {target > 1 && ` (${Math.min(count, target)}/${target})`}
                      {objective.optional && <em> optional</em>}
                    </span>
                    <span className="visually-hidden">{state === "completed" ? " done" : " in progress"}</span>
                  </li>
                ))}
              </ul>
            )}
            {status === "completed" && (
              <p className="quest-rewards">
                {quest.rewards.map((reward) => (
                  reward.type === "XP" ? `+${reward.amount} XP` : items.find((item) => item.id === reward.itemId)?.name ?? reward.itemId
                )).join(" · ")}
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}

/** The quest log, read-only and built entirely from core selectors. */
export function QuestList({ entries, items }: Props) {
  const withStatus = (status: QuestLogEntry["status"]) => entries.filter((entry) => entry.status === status);
  return (
    <>
      <Section title="Current" entries={withStatus("active")} items={items} />
      <Section title="Available" entries={withStatus("available")} items={items} />
      <Section title="Completed" entries={withStatus("completed")} items={items} />
      {!entries.length && <p className="quest-summary-text">No quests yet.</p>}
    </>
  );
}
