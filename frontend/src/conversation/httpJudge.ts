import { backendError, describeError, logWarning, newRequestId } from "../diagnostics/log";
import { readJudgement, type UtteranceJudgement } from "../dialogue/judgement";
import type { TurnContext } from "./context";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface TurnJudge {
  /**
   * A second opinion on one learner turn, or undefined when there is none to be
   * had. Never throws: the game carries on with its own rules either way.
   */
  judge(context: TurnContext): Promise<UtteranceJudgement | undefined>;
}

/**
 * The second opinion, asked of the application backend. Which model answers, and
 * with what credentials, is the backend's business. After a failure the backend
 * is left alone for a while, so a learner is never kept waiting on something
 * that is down.
 */
export function createHttpTurnJudge(
  baseUrl: string,
  fetchImpl: Fetch = (input, init) => fetch(input, init),
  options: { timeoutMs?: number; backoffMs?: number; now?: () => number } = {}
): TurnJudge {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/conversation/turn`;
  const timeoutMs = options.timeoutMs ?? 6000;
  const backoffMs = options.backoffMs ?? 30_000;
  const now = options.now ?? Date.now;
  let unavailableUntil = 0;

  return {
    async judge(context) {
      if (now() < unavailableUntil) return undefined;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const requestId = newRequestId();
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
          body: JSON.stringify(context),
          signal: controller.signal
        });
        if (!response.ok) {
          logWarning("conversation", "No second opinion on that answer", (await backendError("/conversation/turn", response, requestId)).detail);
          // A rejected request says nothing about the service; anything else means "not now".
          if (response.status !== 400) unavailableUntil = now() + backoffMs;
          return undefined;
        }
        return readJudgement(await response.json(), context.intents.map((intent) => intent.id));
      } catch (error) {
        logWarning("conversation", "No second opinion on that answer", describeError(error));
        unavailableUntil = now() + backoffMs;
        return undefined;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
