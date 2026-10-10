import { useState } from "react";
import type { GameSave } from "../../core/models";
import { STORY, goalConcepts, partStates, type StoryPart } from "../../content/story";
import type { LanguagePack } from "../../languages/types";
import { READINESS_LABELS, goalReadiness } from "../../learning/readiness";

/**
 * The story so far, to go back to: each goal and its parts. Any part reached can be
 * played again from its start; how it goes counts, added to what came before.
 */
export function SceneMenu({ save, pack, unlockAll = false, onReplay, onClose }: {
  save: GameSave;
  /** Builder mode: any part can be opened, reached or not. */
  unlockAll?: boolean;
  pack: Pick<LanguagePack, "dialogues" | "intents">;
  onReplay: (part: StoryPart) => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState<StoryPart | undefined>(undefined);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet scene-menu" role="dialog" aria-modal="true" aria-label="Scenes" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <h2>Scenes</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="sheet-body">
          {STORY.map((goal) => {
            const states = partStates(save, goal);
            const readiness = goalReadiness(save, goalConcepts(pack, goal));
            return (
              <section key={goal.id} className="scene-goal">
                <div className="scene-goal-head">
                  <h3>{goal.title}</h3>
                  <span className={`readiness readiness-${readiness}`}>{READINESS_LABELS[readiness]}</span>
                </div>
                <ol className="scene-parts">
                  {goal.parts.map((part, index) => {
                    const state = states[index];
                    const open = state === "done" || state === "current" || (unlockAll && state === "locked");
                    return (
                      <li key={part.id} className={`scene-part ${state}`}>
                        <span className="scene-part-number">Part {index + 1}</span>
                        <span className="scene-part-title">{part.title}</span>
                        {open ? (
                          <button className="secondary-pill" onClick={() => setConfirming(part)}>
                            {state === "done" ? "Replay" : state === "current" ? "Restart" : "Open"}
                          </button>
                        ) : (
                          <span className="scene-part-status">{state === "coming-soon" ? "Coming soon" : "🔒 Not reached yet"}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
        {confirming && (
          <div className="scene-confirm" role="alertdialog" aria-label={`Play ${confirming.title} again`}>
            <p><strong>Play “{confirming.title}” from the start?</strong></p>
            <p className="scene-confirm-note">How you do this time is added to your progress. Nothing you've done before is lost.</p>
            <div className="button-row">
              <button className="secondary-pill" onClick={() => setConfirming(undefined)}>Not now</button>
              <button className="primary-pill" onClick={() => { const part = confirming; setConfirming(undefined); onReplay(part); }}>Play</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
