import { useState, useSyncExternalStore } from "react";
import { clearLog, formatLog, logEntries, onLog } from "../../diagnostics/log";

const time = (at: Date) => at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * What has gone wrong since the game started, newest first: a voice that could
 * not be made, an answer that could not be heard. Each line names the request,
 * so it can be found in the backend's log (backend/logs/backend.log).
 */
export function ProblemLog() {
  const entries = useSyncExternalStore(onLog, () => logEntries().length, () => 0);
  const list = logEntries().slice().reverse();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatLog());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="quest-section problem-log">
      <h3>Problems{entries ? ` (${entries})` : ""}</h3>
      {list.length === 0 ? (
        <p className="progress-note">Nothing has gone wrong since the game started.</p>
      ) : (
        <>
          <ol className="problem-list">
            {list.slice(0, 50).map((entry, index) => (
              <li key={index} className={entry.level}>
                <span className="problem-meta">{time(entry.at)} · {entry.area}</span>
                <span>{entry.message}</span>
                {entry.detail && <small>{entry.detail}</small>}
              </li>
            ))}
          </ol>
          <div className="saved-game-actions">
            <button onClick={() => void copy()}>{copied ? "Copied" : "Copy all"}</button>
            <button onClick={clearLog}>Clear</button>
          </div>
        </>
      )}
    </section>
  );
}
