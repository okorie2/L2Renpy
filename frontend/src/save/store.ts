import type { GameSave, Location, Player, Quest } from "../core/models";
import { syncQuestProgress } from "../core/quests";
import { startDialogue } from "../dialogue/engine";
import type { Dialogue } from "../dialogue/models";
import { decodeSave, encodeSave, SAVE_MIGRATIONS, type SaveMigration } from "./codec";
import type { SaveStorage } from "./storage";

export const SAVE_KEY = "second-language.save";

/** What the game ships now; a loaded save is brought in line with it. */
export interface SaveContent {
  quests: Quest[];
  locations: Location[];
  startingPlayer: Player;
  /** Every dialogue the game ships, so a stored message thread can be checked against it. */
  dialogues?: Record<string, Dialogue>;
}

export type LoadedSave =
  | { status: "loaded"; save: GameSave; savedAt?: string }
  /** Nothing stored: a first launch. */
  | { status: "none" }
  /** The stored save could not be read. A copy was kept and a new game may be written. */
  | { status: "unreadable" }
  /** The stored save belongs to a later version. It is left alone and nothing is written over it. */
  | { status: "newer" };

export type WriteResult = "saved" | "failed" | "protected";

export interface SaveStore {
  load(): LoadedSave;
  write(save: GameSave): WriteResult;
  /** Erase everything this game stored about the player's progress on this device. */
  clear(): void;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Make a readable save playable against today's content. Never removes progress. */
export function reconcileSave(save: GameSave, content: SaveContent): GameSave {
  const knownLocation = content.locations.some((location) => location.id === save.player.locationId);
  const player: Player = knownLocation
    ? { ...save.player, position: { x: clamp(save.player.position.x), y: clamp(save.player.position.y) } }
    // The place the player was standing no longer exists, so they wake up at the start.
    : { ...save.player, locationId: content.startingPlayer.locationId, position: { ...content.startingPlayer.position } };
  const visitedLocationIds = save.visitedLocationIds.includes(player.locationId) ? save.visitedLocationIds : [...save.visitedLocationIds, player.locationId];

  // A thread that points at a line the dialogue no longer has starts again; one whose dialogue is gone is kept as it is.
  let messages = save.messages;
  for (const [id, state] of Object.entries(save.messages)) {
    const dialogue = content.dialogues?.[state.session.dialogueId];
    if (dialogue && !dialogue.nodes[state.session.nodeId]) {
      messages = { ...messages, [id]: { ...state, unread: true, session: startDialogue(dialogue, state.session.npcId) } };
    }
  }
  const unchanged = player.locationId === save.player.locationId
    && player.position.x === save.player.position.x && player.position.y === save.player.position.y
    && visitedLocationIds === save.visitedLocationIds && messages === save.messages;
  return syncQuestProgress(unchanged ? save : { ...save, player, visitedLocationIds, messages }, content.quests);
}

export function createSaveStore(
  storage: SaveStorage,
  content: SaveContent,
  options: { key?: string; now?: () => string; migrations?: Record<number, SaveMigration> } = {}
): SaveStore {
  const key = options.key ?? SAVE_KEY;
  const setAsideKey = `${key}.unreadable`;
  const now = options.now ?? (() => new Date().toISOString());
  // Set when the stored save is one this version must not overwrite.
  let protectedSave = false;

  return {
    load() {
      let text: string | null;
      try {
        text = storage.read(key);
      } catch {
        return { status: "none" };
      }
      if (text === null) return { status: "none" };

      const decoded = decodeSave(text, options.migrations ?? SAVE_MIGRATIONS);
      if (decoded.status === "ok") {
        return { status: "loaded", save: reconcileSave(decoded.save, content), ...(decoded.savedAt ? { savedAt: decoded.savedAt } : {}) };
      }
      if (decoded.status === "newer") {
        protectedSave = true;
        return { status: "newer" };
      }
      try {
        storage.write(setAsideKey, text);
      } catch {
        // Without a copy the original must stay where it is.
        protectedSave = true;
      }
      return { status: "unreadable" };
    },

    write(save) {
      if (protectedSave) return "protected";
      try {
        storage.write(key, encodeSave(save, now()));
        return "saved";
      } catch {
        return "failed";
      }
    },

    clear() {
      protectedSave = false;
      for (const stored of [key, setAsideKey]) {
        try { storage.remove(stored); } catch { /* nothing to erase if storage is unavailable */ }
      }
    }
  };
}
