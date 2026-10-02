import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameSave } from "../core/models";
import { createAutosave } from "../save/autosave";
import type { SaveStore } from "../save/store";

/** Something the player should know about their saved progress. */
export type SaveNotice = "unreadable" | "newer" | "failed";

export interface SavedGame {
  /** The save this run of the game starts from. */
  initialSave: GameSave;
  /** Changes whenever the game starts again from a different save. */
  epoch: number;
  notice: SaveNotice | null;
  dismissNotice: () => void;
  /** Report the current game state; the autosave decides when it is written. */
  persist: (save: GameSave) => void;
  /** Erase stored progress and begin a new game. */
  startOver: () => void;
}

/**
 * Opens the stored game at launch and keeps it written as the player goes.
 * The game itself only ever holds a `GameSave` in memory; this is the one
 * place that knows it also lives on the device.
 */
export function useSavedGame(store: SaveStore, newGame: () => GameSave): SavedGame {
  const [game, setGame] = useState(() => {
    const loaded = store.load();
    return {
      epoch: 0,
      initialSave: loaded.status === "loaded" ? loaded.save : newGame(),
      loadIssue: loaded.status === "unreadable" || loaded.status === "newer" ? loaded.status : null
    };
  });
  const [writeFailed, setWriteFailed] = useState(false);
  const [dismissed, setDismissed] = useState<SaveNotice | null>(null);

  const autosave = useMemo(() => createAutosave((save) => {
    // A protected save is already explained by the notice shown at launch.
    setWriteFailed(store.write(save) === "failed");
  }), [store]);

  useEffect(() => {
    // Mobile browsers may never run code again once the app is hidden, so write now.
    const onHidden = () => { if (document.visibilityState === "hidden") autosave.flush(); };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", autosave.flush);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", autosave.flush);
    };
  }, [autosave]);

  const startOver = useCallback(() => {
    autosave.reset();
    store.clear();
    setDismissed(null);
    setGame((current) => ({ epoch: current.epoch + 1, initialSave: newGame(), loadIssue: null }));
  }, [autosave, store, newGame]);

  const notice: SaveNotice | null = game.loadIssue ?? (writeFailed ? "failed" : null);
  return {
    initialSave: game.initialSave,
    epoch: game.epoch,
    notice: notice === dismissed ? null : notice,
    dismissNotice: () => setDismissed(notice),
    persist: autosave.update,
    startOver
  };
}
