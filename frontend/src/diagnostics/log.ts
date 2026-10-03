/**
 * The game's own log: what went wrong, where and why, kept in memory so it can
 * be read on the device (phone → Settings → Problems) as well as in the console.
 *
 * Every request to the backend carries an id (`X-Request-Id`); the backend logs
 * with the same id, so a line here can be found in `backend/logs/backend.log`.
 */
export type LogLevel = "info" | "warning" | "error";

export interface LogEntry {
  at: Date;
  level: LogLevel;
  /** Which part of the game: "voice", "speech", "practice", "conversation"… */
  area: string;
  message: string;
  /** The backend's reason, status and request id, when there was a request. */
  detail?: string;
}

/** The most entries kept. Older ones are dropped. */
export const LOG_LIMIT = 200;

const entries: LogEntry[] = [];
const listeners = new Set<() => void>();

export function log(level: LogLevel, area: string, message: string, detail?: string): void {
  const entry: LogEntry = { at: new Date(), level, area, message, ...(detail ? { detail } : {}) };
  entries.push(entry);
  if (entries.length > LOG_LIMIT) entries.splice(0, entries.length - LOG_LIMIT);
  const line = `[${area}] ${message}${detail ? ` — ${detail}` : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warning") console.warn(line);
  else console.info(line);
  for (const listener of listeners) listener();
}

export const logError = (area: string, message: string, detail?: string) => log("error", area, message, detail);
export const logWarning = (area: string, message: string, detail?: string) => log("warning", area, message, detail);

/** Newest last. */
export function logEntries(): readonly LogEntry[] {
  return entries;
}

export function clearLog(): void {
  entries.length = 0;
  for (const listener of listeners) listener();
}

export function onLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The log as plain text, for copying into a message or an issue. */
export function formatLog(list: readonly LogEntry[] = entries): string {
  return list
    .map((entry) => `${entry.at.toISOString()} ${entry.level.toUpperCase()} [${entry.area}] ${entry.message}${entry.detail ? `\n    ${entry.detail}` : ""}`)
    .join("\n");
}

/** A short id for one request, sent as `X-Request-Id`. */
export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** A failed request to the backend: its status, the backend's reason and the request id. */
export class BackendError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number,
    readonly reason: string | undefined,
    readonly requestId: string,
    /** Seconds the backend asked to wait before trying again, if it said. */
    readonly retryAfter?: number
  ) {
    super(`${endpoint} failed with ${status}${reason ? `: ${reason}` : ""}`);
    this.name = "BackendError";
  }

  get detail(): string {
    return `${this.status}${this.reason ? ` ${this.reason}` : ""} (request ${this.requestId})`;
  }
}

/** Read a failed response: the backend sends `{ detail, requestId }`. */
export async function backendError(endpoint: string, response: Response, requestId: string): Promise<BackendError> {
  let reason: string | undefined;
  let id = response.headers.get("X-Request-Id") ?? requestId;
  try {
    const body = await response.clone().json() as { detail?: unknown; requestId?: unknown };
    if (typeof body.detail === "string") reason = body.detail;
    else if (body.detail !== undefined) reason = JSON.stringify(body.detail);
    if (typeof body.requestId === "string") id = body.requestId;
  } catch {
    try { reason = (await response.text()).slice(0, 300) || undefined; } catch { /* no body */ }
  }
  const retryAfter = Number(response.headers.get("Retry-After"));
  return new BackendError(endpoint, response.status, reason, id, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined);
}

/** A short description of any failure, for the log. */
export function describeError(error: unknown): string {
  if (error instanceof BackendError) return error.detail;
  if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
  if (error instanceof TypeError) return `the backend could not be reached (${error.message})`;
  return error instanceof Error ? error.message : String(error);
}
