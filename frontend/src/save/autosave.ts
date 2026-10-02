import type { GameSave } from "../core/models";

export const MOVEMENT_SAVE_DELAY_MS = 1500;

export interface Autosave {
  /** Tell the autosave what the game state is now. */
  update(save: GameSave): void;
  /** Write anything still waiting, for example when the app goes to the background. */
  flush(): void;
  /** Forget pending work without writing it, for example before erasing the save. */
  reset(): void;
}

interface Timers {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
}

const defaultTimers: Timers = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
};

/** True when the only difference is where the player is standing. */
function onlyMoved(before: GameSave, after: GameSave): boolean {
  const saveKeys = Object.keys(after) as Array<keyof GameSave>;
  const playerKeys = Object.keys(after.player) as Array<keyof GameSave["player"]>;
  return saveKeys.every((key) => key === "player" || before[key] === after[key])
    && playerKeys.every((key) => key === "position" || before.player[key] === after.player[key]);
}

/**
 * Decides when the save is written. Progress (a quest step, an answer, a new
 * place) is written at once; walking around is written at most once per delay,
 * so movement never turns into a stream of storage writes.
 */
export function createAutosave(
  write: (save: GameSave) => void,
  options: { delayMs?: number; timers?: Timers } = {}
): Autosave {
  const delayMs = options.delayMs ?? MOVEMENT_SAVE_DELAY_MS;
  const timers = options.timers ?? defaultTimers;
  let latest: GameSave | undefined;
  let dirty = false;
  let timer: unknown;

  const stopTimer = () => {
    if (timer !== undefined) timers.clear(timer);
    timer = undefined;
  };
  const flush = () => {
    stopTimer();
    if (!dirty || !latest) return;
    dirty = false;
    write(latest);
  };

  return {
    update(save) {
      if (save === latest) return;
      const moved = latest !== undefined && onlyMoved(latest, save);
      latest = save;
      dirty = true;
      if (!moved) flush();
      else if (timer === undefined) timer = timers.set(flush, delayMs);
    },
    flush,
    reset() {
      stopTimer();
      dirty = false;
      latest = undefined;
    }
  };
}
