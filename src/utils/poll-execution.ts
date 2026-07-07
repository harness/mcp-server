/**
 * Server-side polling for Harness pipeline executions.
 *
 * Used by harness_execute when the caller passes `wait: true` so the LLM
 * doesn't have to repeatedly call `harness_get` to check status. One MCP tool
 * call triggers the pipeline and returns when the execution reaches a terminal
 * status (or the timeout fires).
 *
 * Pure logic — receives the Registry + HarnessClient via DI so future callers
 * (e.g. a standalone `wait` execute action on `execution`) can reuse it.
 */

import type { HarnessClient } from "../client/harness-client.js";
import type { Registry } from "../registry/index.js";
import { asNumber, asRecord, asString } from "./type-guards.js";
import { createLogger } from "./logger.js";

const log = createLogger("poll-execution");

/**
 * Statuses Harness considers terminal for a pipeline execution.
 * Anything else (Running, Queued, Paused, *Waiting, etc.) keeps polling.
 *
 * NOTE: `ApprovalWaiting`, `InterventionWaiting`, and `InputWaiting` are NOT
 * terminal — Harness keeps the execution "alive" pending human action. We poll
 * through them so wait blocks until a real outcome.
 */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "Success",
  "Failed",
  "Aborted",
  "Expired",
  "Errored",
  "AbortedByFreeze",
  "ApprovalRejected",
  "IgnoreFailed",
  "Skipped",
  "Suspended",
]);

/** Statuses that indicate the execution failed and is worth diagnosing. */
export const FAILURE_STATUSES: ReadonlySet<string> = new Set([
  "Failed",
  "Errored",
  "Aborted",
  "Expired",
  "AbortedByFreeze",
  "ApprovalRejected",
  "IgnoreFailed",
]);

export interface PollOptions {
  executionId: string;
  orgId?: string;
  projectId?: string;
  /** Hard cap on total wait time. */
  timeoutMs: number;
  /** First poll happens after this delay (gives the execution a moment to start). */
  initialIntervalMs: number;
  /** Backoff cap. */
  maxIntervalMs: number;
  /** Cancel polling when this signal aborts. */
  signal?: AbortSignal;
  /** Notify caller after each poll (progress, logging, etc). */
  onPoll?: (status: string, elapsedMs: number, pollCount: number) => Promise<void> | void;
}

export interface PollResult {
  execution_id: string;
  status: string;
  is_terminal: boolean;
  timed_out: boolean;
  elapsed_ms: number;
  poll_count: number;
  started_at?: string;
  ended_at?: string;
  pipeline: { name?: string; identifier?: string };
  openInHarness?: string;
}

class AbortError extends Error {
  constructor() {
    super("Polling aborted");
    this.name = "AbortError";
  }
}

/**
 * Sleep for `ms`, rejecting early if the signal aborts.
 * Cleans up listeners and timers in both branches to avoid leaks across long polls.
 */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new AbortError());
    };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Compute next poll interval using exponential backoff.
 * Capped by maxIntervalMs. Multiplier 1.5 — gentle ramp that still slows
 * polling on long-running deploys.
 */
export function nextPollIntervalMs(initialMs: number, maxMs: number, pollCount: number): number {
  const next = initialMs * Math.pow(1.5, pollCount);
  return Math.min(Math.floor(next), maxMs);
}

interface ExecutionSnapshot {
  status?: string;
  startTs?: number;
  endTs?: number;
  pipelineName?: string;
  pipelineIdentifier?: string;
  openInHarness?: string;
}

/**
 * Extract the bits we need from `execution.get` response shape:
 *   { pipelineExecutionSummary: { status, startTs, endTs, name, pipelineIdentifier, ... }, openInHarness, ... }
 */
function snapshotFromExecution(raw: unknown): ExecutionSnapshot {
  const root = asRecord(raw) ?? {};
  const pes = asRecord(root.pipelineExecutionSummary) ?? {};
  return {
    status: asString(pes.status),
    startTs: asNumber(pes.startTs),
    endTs: asNumber(pes.endTs),
    pipelineName: asString(pes.name),
    pipelineIdentifier: asString(pes.pipelineIdentifier),
    openInHarness: asString(root.openInHarness),
  };
}

/**
 * Poll a pipeline execution until it reaches a terminal status or the timeout fires.
 *
 * Errors during individual polls are tolerated for a few attempts (logged at
 * warn level) — Harness sometimes returns 5xx for a few seconds while an
 * execution is spinning up, and that shouldn't fail the whole wait.
 *
 * If the signal aborts, the function rejects with an AbortError so callers
 * can surface a "cancelled by client" message.
 */
export async function pollExecutionToTerminal(
  registry: Registry,
  client: HarnessClient,
  opts: PollOptions,
): Promise<PollResult> {
  const startedAt = Date.now();
  let pollCount = 0;
  let lastSnapshot: ExecutionSnapshot = {};
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;

  // Initial sleep — gives the execution a moment to be persisted by Harness
  // before we ask for its status.
  await abortableSleep(opts.initialIntervalMs, opts.signal);

  while (true) {
    if (opts.signal?.aborted) throw new AbortError();

    const elapsed = Date.now() - startedAt;
    if (elapsed >= opts.timeoutMs) {
      return buildResult(opts.executionId, lastSnapshot, false, true, elapsed, pollCount);
    }

    pollCount++;
    try {
      const raw = await registry.dispatch(client, "execution", "get", {
        execution_id: opts.executionId,
        org_id: opts.orgId,
        project_id: opts.projectId,
        render_full_graph: false,
      }, opts.signal);
      lastSnapshot = snapshotFromExecution(raw);
      consecutiveErrors = 0;

      const status = lastSnapshot.status ?? "Unknown";
      try {
        await opts.onPoll?.(status, Date.now() - startedAt, pollCount);
      } catch (err) {
        log.warn("onPoll callback threw — ignoring", { error: String(err) });
      }

      if (TERMINAL_STATUSES.has(status)) {
        return buildResult(opts.executionId, lastSnapshot, true, false, Date.now() - startedAt, pollCount);
      }
    } catch (err) {
      if (err instanceof AbortError) throw err;
      consecutiveErrors++;
      log.warn("Poll failed, retrying", {
        executionId: opts.executionId,
        pollCount,
        consecutiveErrors,
        error: String(err),
      });
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error(
          `Polling execution ${opts.executionId} failed after ${consecutiveErrors} consecutive attempts: ${String(err)}`,
        );
      }
    }

    // Schedule next poll.  If the next sleep would overshoot the timeout,
    // sleep only the remainder so we return promptly with timed_out=true.
    const interval = nextPollIntervalMs(opts.initialIntervalMs, opts.maxIntervalMs, pollCount);
    const remaining = opts.timeoutMs - (Date.now() - startedAt);
    if (remaining <= 0) {
      return buildResult(opts.executionId, lastSnapshot, false, true, Date.now() - startedAt, pollCount);
    }
    await abortableSleep(Math.min(interval, remaining), opts.signal);
  }
}

function buildResult(
  executionId: string,
  snapshot: ExecutionSnapshot,
  isTerminal: boolean,
  timedOut: boolean,
  elapsedMs: number,
  pollCount: number,
): PollResult {
  return {
    execution_id: executionId,
    status: snapshot.status ?? "Unknown",
    is_terminal: isTerminal,
    timed_out: timedOut,
    elapsed_ms: elapsedMs,
    poll_count: pollCount,
    started_at: snapshot.startTs ? new Date(snapshot.startTs).toISOString() : undefined,
    ended_at: snapshot.endTs ? new Date(snapshot.endTs).toISOString() : undefined,
    pipeline: {
      name: snapshot.pipelineName,
      identifier: snapshot.pipelineIdentifier,
    },
    openInHarness: snapshot.openInHarness,
  };
}

export { AbortError };
