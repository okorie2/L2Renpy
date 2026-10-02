import Phaser from "phaser";

// Keep the bridge stable when Vite refreshes React while an existing Phaser scene is running.
const hot = (import.meta as ImportMeta & { hot?: { data: Record<string, unknown> } }).hot;
export const gameEvents = (hot?.data.gameEvents as Phaser.Events.EventEmitter | undefined)
  ?? new Phaser.Events.EventEmitter();
if (hot) hot.data.gameEvents = gameEvents;
