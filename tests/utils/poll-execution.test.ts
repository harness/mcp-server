import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Registry } from "../../src/registry/index.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import {
  pollExecutionToTerminal,
  nextPollIntervalMs,
  TERMINAL_STATUSES,
  FAILURE_STATUSES,
  AbortError,
} from "../../src/utils/poll-execution.js";

/**
 * Build a fake registry whose `dispatch("execution","get",...)` returns the
 * next snapshot from a provided sequence (or throws when an error is queued).
 */
function makeRegistry(
  snapshots: Array<unknown | Error>,
): { registry: Registry; calls: number } {
  let i = 0;
  const counter = { count: 0 };
  const dispatch = vi.fn(async (_client, _type, _op, _input) => {
    counter.count++;
    const next = snapshots[Math.min(i, snapshots.length - 1)];
    i++;
    if (next instanceof Error) throw next;
    return next;
  });
  return {
    registry: { dispatch, orgId: undefined, projectId: undefined } as unknown as Registry,
    get calls(): number { return counter.count; },
  };
}

const fakeClient = {} as unknown as HarnessClient;

function snapshot(status: string, extra: Record<string, unknown> = {}): unknown {
  return {
    pipelineExecutionSummary: {
      status,
      name: "Test Pipeline",
      pipelineIdentifier: "test_pipe",
      startTs: 1_700_000_000_000,
      ...(status === "Success" || status === "Failed" ? { endTs: 1_700_000_030_000 } : {}),
      ...extra,
    },
    openInHarness: "https://app.harness.io/ng/account/acct/...",
  };
}

describe("nextPollIntervalMs", () => {
  it("starts at the initial interval", () => {
    expect(nextPollIntervalMs(1000, 30_000, 0)).toBe(1000);
  });

  it("grows with multiplier 1.5", () => {
    expect(nextPollIntervalMs(1000, 30_000, 1)).toBe(1500);
    expect(nextPollIntervalMs(1000, 30_000, 2)).toBe(2250);
  });

  it("caps at maxIntervalMs", () => {
    expect(nextPollIntervalMs(1000, 5000, 10)).toBe(5000);
  });
});

describe("TERMINAL_STATUSES / FAILURE_STATUSES", () => {
  it("includes the expected terminal statuses", () => {
    for (const s of ["Success", "Failed", "Aborted", "Expired", "Errored", "AbortedByFreeze"]) {
      expect(TERMINAL_STATUSES.has(s)).toBe(true);
    }
  });

  it("does NOT treat waiting/running as terminal", () => {
    for (const s of ["Running", "Queued", "Paused", "ApprovalWaiting", "InterventionWaiting"]) {
      expect(TERMINAL_STATUSES.has(s)).toBe(false);
    }
  });

  it("identifies failure statuses", () => {
    expect(FAILURE_STATUSES.has("Failed")).toBe(true);
    expect(FAILURE_STATUSES.has("Errored")).toBe(true);
    expect(FAILURE_STATUSES.has("Success")).toBe(false);
  });
});

describe("pollExecutionToTerminal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Advance fake timers until all pending promises settle. */
  async function flushAll(maxIterations = 200): Promise<void> {
    for (let i = 0; i < maxIterations; i++) {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(50);
    }
  }

  it("returns terminal on first poll when execution is already Success", async () => {
    const { registry } = makeRegistry([snapshot("Success")]);

    const promise = pollExecutionToTerminal(registry, fakeClient, {
      executionId: "exec-1",
      timeoutMs: 60_000,
      initialIntervalMs: 100,
      maxIntervalMs: 1000,
    });

    await flushAll();
    const result = await promise;

    expect(result.status).toBe("Success");
    expect(result.is_terminal).toBe(true);
    expect(result.timed_out).toBe(false);
    expect(result.poll_count).toBe(1);
    expect(result.pipeline.identifier).toBe("test_pipe");
    expect(result.openInHarness).toContain("app.harness.io");
  });

  it("polls multiple times then returns terminal status", async () => {
    const { registry } = makeRegistry([
      snapshot("Running"),
      snapshot("Running"),
      snapshot("Failed"),
    ]);

    const promise = pollExecutionToTerminal(registry, fakeClient, {
      executionId: "exec-2",
      timeoutMs: 60_000,
      initialIntervalMs: 100,
      maxIntervalMs: 500,
    });

    await flushAll();
    const result = await promise;

    expect(result.status).toBe("Failed");
    expect(result.is_terminal).toBe(true);
    expect(result.poll_count).toBe(3);
    expect(FAILURE_STATUSES.has(result.status)).toBe(true);
  });

  it("reports timed_out=true when execution never reaches terminal", async () => {
    // Always Running
    const { registry } = makeRegistry([snapshot("Running")]);

    const promise = pollExecutionToTerminal(registry, fakeClient, {
      executionId: "exec-3",
      timeoutMs: 500,
      initialIntervalMs: 100,
      maxIntervalMs: 200,
    });

    await flushAll();
    const result = await promise;

    expect(result.timed_out).toBe(true);
    expect(result.is_terminal).toBe(false);
    expect(result.status).toBe("Running");
    expect(result.elapsed_ms).toBeGreaterThanOrEqual(500);
  });

  it("throws AbortError when signal aborts mid-sleep", async () => {
    const { registry } = makeRegistry([snapshot("Running")]);
    const controller = new AbortController();

    const promise = pollExecutionToTerminal(registry, fakeClient, {
      executionId: "exec-4",
      timeoutMs: 60_000,
      initialIntervalMs: 1000,
      maxIntervalMs: 5000,
      signal: controller.signal,
    });

    // Wait long enough for the first sleep to begin, then abort
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(AbortError);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const { registry } = makeRegistry([snapshot("Success")]);
    const controller = new AbortController();
    controller.abort();

    const promise = pollExecutionToTerminal(registry, fakeClient, {
      executionId: "exec-5",
      timeoutMs: 60_000,
      initialIntervalMs: 100,
      maxIntervalMs: 500,
      signal: controller.signal,
    });

    await expect(promise).rejects.toBeInstanceOf(AbortError);
  });

  it("tolerates transient errors and continues polling", async () => {
    const { registry } = makeRegistry([
      new Error("502 Bad Gateway"),
      snapshot("Running"),
      snapshot("Success"),
    ]);

    const promise = pollExecutionToTerminal(registry, fakeClient, {
      executionId: "exec-6",
      timeoutMs: 60_000,
      initialIntervalMs: 100,
      maxIntervalMs: 500,
    });

    await flushAll();
    const result = await promise;

    expect(result.status).toBe("Success");
    expect(result.is_terminal).toBe(true);
    expect(result.poll_count).toBe(3); // failure + 2 successful polls
  });

  it("throws after MAX_CONSECUTIVE_ERRORS persistent failures instead of reporting a timeout", async () => {
    // 10 consecutive errors — should exceed the consecutive-error threshold (5)
    const errors = Array.from({ length: 10 }, () => new Error("503 Service Unavailable"));
    const { registry } = makeRegistry(errors);

    const promise = pollExecutionToTerminal(registry, fakeClient, {
      executionId: "exec-7",
      timeoutMs: 60_000,
      initialIntervalMs: 100,
      maxIntervalMs: 200,
    });
    const rejection = expect(promise).rejects.toThrow("Polling execution exec-7 failed after 5 consecutive attempts");

    await flushAll();
    await rejection;
  });

  it("invokes onPoll callback after each successful poll", async () => {
    const { registry } = makeRegistry([
      snapshot("Running"),
      snapshot("Success"),
    ]);
    const onPoll = vi.fn(async () => {});

    const promise = pollExecutionToTerminal(registry, fakeClient, {
      executionId: "exec-8",
      timeoutMs: 60_000,
      initialIntervalMs: 100,
      maxIntervalMs: 500,
      onPoll,
    });

    await flushAll();
    await promise;

    expect(onPoll).toHaveBeenCalledTimes(2);
    expect(onPoll).toHaveBeenNthCalledWith(1, "Running", expect.any(Number), 1);
    expect(onPoll).toHaveBeenNthCalledWith(2, "Success", expect.any(Number), 2);
  });
});
