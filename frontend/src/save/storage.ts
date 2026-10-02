/**
 * Where save text is kept on the device. Deliberately tiny, so the browser's
 * storage can later be swapped for native storage without touching the save
 * logic. Any method may throw (storage full, blocked or missing); the save
 * store treats that as "could not save", never as a crash.
 */
export interface SaveStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

/** The browser's local storage, which also backs the Capacitor web view. */
export function createBrowserStorage(): SaveStorage {
  return {
    read: (key) => localStorage.getItem(key),
    write: (key, value) => localStorage.setItem(key, value),
    remove: (key) => localStorage.removeItem(key)
  };
}

export function createMemoryStorage(initial: Record<string, string> = {}): SaveStorage & { entries: Map<string, string> } {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    read: (key) => entries.get(key) ?? null,
    write: (key, value) => { entries.set(key, value); },
    remove: (key) => { entries.delete(key); }
  };
}
