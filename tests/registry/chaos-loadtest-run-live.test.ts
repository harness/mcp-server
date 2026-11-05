/**
 * chaos_loadtest_run status / live_metrics: request shape through the real
 * Registry, plus the pure builders for the in-progress edge cases (startup,
 * ramp-up, worker restart, stale metrics, cursor deltas).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { buildRunStatus, buildLiveMetrics, parseSince } from "../../src/registry/loadtest-live.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  };
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return { request: requestFn, account: "test-account" } as unknown as HarnessClient;
}

const NOW = Date.parse("2026-10-05T07:00:00.000Z");
const iso = (offsetSec: number) => new Date(NOW + offsetSec * 1000).toISOString();

interface RunOverrides {
  [k: string]: unknown;
}

function runningRun(overrides: RunOverrides = {}): Record<string, unknown> {
  return {
    identity: "run-1",
    name: "checkout-load #3",
    loadTestIdentity: "lt-1",
    toolType: "K6",
    status: "Running",
    targetUsers: 100,
    rampUpTimeSec: 60,
    durationSeconds: 300,
    workerCount: 2,
    startedAt: iso(-120),
    thresholdVerdict: "not_evaluated",
    lastMetrics: {
      timestamp: iso(-5),
      totalRps: 812.456,
      totalRequests: 48000,
      totalFailures: 240,
      errorRate: 0.5,
      avgResponseMs: 88.2,
      p50ResponseMs: 70.1,
      p95ResponseMs: 210.4,
      p99ResponseMs: 480.9,
      currentUsers: 100,
      requestStats: {
        "GET /login": {
          method: "GET", name: "/login", numRequests: 30000, numFailures: 30,
          medianResponseTime: 60, p95ResponseMs: 150, p99ResponseMs: 300, maxResponseTime: 900, requestsPerSec: 500,
        },
        "POST /cart": {
          method: "POST", name: "/cart", numRequests: 18000, numFailures: 210,
          medianResponseTime: 95, p95ResponseMs: 320, p99ResponseMs: 700, maxResponseTime: 2400, requestsPerSec: 312.456,
        },
        "HTTP All HTTP requests": {
          method: "HTTP", name: "All HTTP requests", numRequests: 48000, numFailures: 240, maxResponseTime: 2400,
        },
      },
      workerStats: [
        { name: "w-0", state: "running", cpuCores: 0.9, cpuLimitCores: 1, memoryBytes: 300 * 1024 ** 2, memoryLimitBytes: 1024 ** 3, users: 50 },
        { name: "w-1", state: "running", cpuCores: 0.4, cpuLimitCores: 1, memoryBytes: 200 * 1024 ** 2, memoryLimitBytes: 1024 ** 3, users: 50 },
      ],
    },
    ...overrides,
  };
}

function series(points: Array<[number, number, number]>): unknown {
  return {
    testRunId: "u1",
    dataPoints: points.map(([offset, users, rps]) => ({
      timestamp: iso(offset),
      totalRps: rps,
      currentUsers: users,
      p50ResponseMs: 70,
      p95ResponseMs: 200,
      p99ResponseMs: 450,
      errorRate: 0.4,
    })),
  };
}

describe("parseSince", () => {
  it("accepts ISO, epoch ms and epoch seconds", () => {
    expect(parseSince(iso(0))).toBe(NOW);
    expect(parseSince(NOW)).toBe(NOW);
    expect(parseSince(String(NOW))).toBe(NOW);
    expect(parseSince(NOW / 1000)).toBe(NOW);
  });
  it("returns undefined when absent", () => {
    expect(parseSince(undefined)).toBeUndefined();
    expect(parseSince("")).toBeUndefined();
  });
  it("rejects garbage with an actionable message", () => {
    expect(() => parseSince("yesterday")).toThrow(/Invalid 'since'.*next_since/);
  });
});

describe("buildRunStatus", () => {
  it("reports a steady Running run", () => {
    const s = buildRunStatus(runningRun(), NOW) as any;
    expect(s.status).toBe("Running");
    expect(s.phase).toBe("steady");
    expect(s.is_terminal).toBe(false);
    expect(s.elapsed_sec).toBe(120);
    expect(s.total_sec).toBe(300);
    expect(s.remaining_sec).toBe(180);
    expect(s.progress_pct).toBe(40);
    expect(s.users).toEqual({ current: 100, target: 100, ramp_up_sec: 60 });
    expect(s.workers).toEqual({ configured: 2, reporting: 2, active: 2 });
    expect(s.poll).toMatchObject({ recommended_interval_sec: 5, stop_polling: false });
    expect(s.markdown).toContain("Running");
    expect(s.markdown).toContain("2 active of 2 configured");
    expect(s.markdown).toContain("Poll again in 5s");
  });

  it("flags terminal runs and stops polling", () => {
    for (const status of ["Finished", "Stopped", "Failed"]) {
      const s = buildRunStatus(runningRun({ status, finishedAt: iso(-10) }), NOW) as any;
      expect(s.is_terminal).toBe(true);
      expect(s.poll).toMatchObject({ recommended_interval_sec: null, stop_polling: true });
      expect(s.remaining_sec).toBeNull();
      expect(s.elapsed_sec).toBe(110);
    }
    expect((buildRunStatus(runningRun({ status: "Finished", finishedAt: iso(-10) }), NOW) as any).progress_pct).toBe(100);
  });

  it("handles a Pending run with nothing populated", () => {
    const s = buildRunStatus({ identity: "run-1", status: "Pending", targetUsers: 50, durationSeconds: 60 }, NOW) as any;
    expect(s.phase).toBe("pending");
    expect(s.elapsed_sec).toBeNull();
    expect(s.remaining_sec).toBeNull();
    expect(s.users).toEqual({ current: null, target: 50, ramp_up_sec: null });
    expect(s.workers.active).toBeNull();
    expect(s.warnings.map((w: any) => w.code)).toContain("run_pending");
    expect(s.poll.recommended_interval_sec).toBe(5);
  });

  it("treats Running with no snapshot as starting, with null (not zero) users", () => {
    const s = buildRunStatus(runningRun({ lastMetrics: undefined, startedAt: iso(-3) }), NOW) as any;
    expect(s.phase).toBe("starting");
    expect(s.data_available).toBe(false);
    expect(s.users.current).toBeNull();
    expect(s.warnings.map((w: any) => w.code)).toContain("metrics_not_available");
  });

  it("reports ramp-up from elapsed vs rampUpTimeSec", () => {
    const s = buildRunStatus(
      runningRun({ startedAt: iso(-30), lastMetrics: { ...(runningRun().lastMetrics as object), currentUsers: 40 } }),
      NOW,
    ) as any;
    expect(s.phase).toBe("ramping_up");
    expect(s.warnings.map((w: any) => w.code)).toContain("ramping_up_partial_data");
    expect(s.poll.recommended_interval_sec).toBe(5);
  });

  it("reports Failed with the backend error", () => {
    const s = buildRunStatus(runningRun({ status: "Failed", finishedAt: iso(-10), errorCode: "IMAGE_PULL", errorMessage: "pull denied" }), NOW) as any;
    expect(s.warnings.find((w: any) => w.code === "run_failed").message).toContain("IMAGE_PULL");
  });

  it("rejects a non-object response", () => {
    expect(() => buildRunStatus("nope", NOW)).toThrow(/Unexpected run response/);
  });
});

describe("buildLiveMetrics snapshot", () => {
  it("projects latency, throughput, errors and endpoints", () => {
    const m = buildLiveMetrics(runningRun(), {}, NOW) as any;
    expect(m.data_available).toBe(true);
    expect(m.latency_ms).toEqual({ p50: 70.1, p90: null, p95: 210.4, p99: 480.9, max: 2400, avg: 88.2 });
    expect(m.throughput).toEqual({ current_rps: 812.46, total_requests: 48000 });
    expect(m.errors.total_failures).toBe(240);
    expect(m.errors.error_rate_pct).toBe(0.5);
    expect(m.errors.top_failing_endpoints[0]).toEqual({ endpoint: "POST /cart", failures: 210, failure_pct: 1.17 });
    expect(m.endpoints.map((e: any) => e.key)).toEqual(["GET /login", "POST /cart"]);
    expect(m.endpoints[1]).toMatchObject({ method: "POST", name: "/cart", requests: 18000, rps: 312.46, p50_ms: 95, p95_ms: 320, p99_ms: 700, failures: 210 });
    expect(m.endpoints_total).toBe(2);
    expect(m.not_reported.join(" ")).toMatch(/p90/);
    expect(m.snapshot_age_sec).toBe(5);
  });

  it("reports saturation signals from worker stats", () => {
    const m = buildLiveMetrics(runningRun(), {}, NOW) as any;
    expect(m.saturation).toMatchObject({
      configured_workers: 2, active_workers: 2, current_users: 100, target_users: 100, users_per_worker: 50,
      hot_workers: ["w-0"],
    });
    expect(m.saturation.workers[0]).toMatchObject({ cpu_pct_of_limit: 90, memory_pct_of_limit: 29.3, users: 50 });
    expect(m.warnings.map((w: any) => w.code)).toContain("worker_saturated");
  });

  it("returns nulls, not zeros, before any metrics exist", () => {
    const m = buildLiveMetrics(runningRun({ lastMetrics: undefined, startedAt: iso(-2) }), {}, NOW) as any;
    expect(m.data_available).toBe(false);
    expect(m.latency_ms).toEqual({ p50: null, p90: null, p95: null, p99: null, max: null, avg: null });
    expect(m.throughput).toEqual({ current_rps: null, total_requests: null });
    expect(m.errors.error_rate_pct).toBeNull();
    expect(m.endpoints).toEqual([]);
    expect(m.markdown).toContain("no metrics yet");
    expect(m.markdown).not.toContain("**Latency**");
  });

  it("treats a snapshot with zero requests and zero users as not yet available", () => {
    const m = buildLiveMetrics(runningRun({ lastMetrics: { timestamp: iso(-1), totalRequests: 0, currentUsers: 0, p95ResponseMs: 0 } }), {}, NOW) as any;
    expect(m.data_available).toBe(false);
    expect(m.phase).toBe("starting");
  });

  it("marks partial data during ramp-up", () => {
    const m = buildLiveMetrics(
      runningRun({ startedAt: iso(-20), lastMetrics: { ...(runningRun().lastMetrics as object), currentUsers: 25 } }),
      {},
      NOW,
    ) as any;
    expect(m.phase).toBe("ramping_up");
    expect(m.data_available).toBe(true);
    expect(m.warnings.map((w: any) => w.code)).toContain("ramping_up_partial_data");
    expect(m.markdown).toContain("ramping up");
  });

  it("surfaces worker restarts: pod not running, users below target, stale snapshot", () => {
    const base = runningRun().lastMetrics as Record<string, unknown>;
    const m = buildLiveMetrics(
      runningRun({
        lastMetrics: {
          ...base,
          timestamp: iso(-95),
          currentUsers: 50,
          workerStats: [
            (base.workerStats as unknown[])[0],
            { name: "w-1", state: "pending", reason: "ContainerCreating" },
          ],
        },
      }),
      {},
      NOW,
    ) as any;
    const codes = m.warnings.map((w: any) => w.code);
    expect(codes).toEqual(expect.arrayContaining(["workers_not_running", "users_below_target", "metrics_stale"]));
    expect(m.saturation.active_workers).toBe(1);
    expect(m.saturation.users_per_worker).toBe(50);
    expect(m.markdown).toContain("pending (ContainerCreating)");
  });

  it("reports unknown workers as null when the backend gives no per-pod data", () => {
    const base = runningRun().lastMetrics as Record<string, unknown>;
    const m = buildLiveMetrics(runningRun({ lastMetrics: { ...base, workerStats: undefined } }), {}, NOW) as any;
    expect(m.saturation.active_workers).toBeNull();
    expect(m.saturation.users_per_worker).toBeNull();
    expect(m.markdown).toContain("No per-worker resource data");
  });

  it("reports per-endpoint percentiles as null when the tool gives run-wide ones only (Locust)", () => {
    const base = runningRun().lastMetrics as Record<string, unknown>;
    const m = buildLiveMetrics(
      runningRun({
        lastMetrics: {
          ...base,
          requestStats: { "GET /a": { method: "GET", name: "/a", numRequests: 10, numFailures: 0, medianResponseTime: 12, p95ResponseMs: 0, p99ResponseMs: 0, requestsPerSec: 1 } },
        },
      }),
      {},
      NOW,
    ) as any;
    expect(m.endpoints[0]).toMatchObject({ p50_ms: 12, p95_ms: null, p99_ms: null, failure_pct: 0 });
    expect(m.not_reported.join(" ")).toMatch(/run-wide percentiles only/);
  });

  it("groups run-level errors by code", () => {
    const m = buildLiveMetrics(
      runningRun({
        errors: [
          { errorCode: "WORKER_OOM", errorMessage: "first" },
          { errorCode: "WORKER_OOM", errorMessage: "second" },
          { errorCode: "OTHER", errorMessage: "x" },
        ],
      }),
      {},
      NOW,
    ) as any;
    expect(m.errors.run_errors[0]).toMatchObject({ code: "WORKER_OOM", count: 2, message: "second" });
  });

  it("escapes table separators in endpoint names", () => {
    const base = runningRun().lastMetrics as Record<string, unknown>;
    const m = buildLiveMetrics(
      runningRun({ lastMetrics: { ...base, requestStats: { x: { method: "GET", name: "/a|b", numRequests: 1, numFailures: 0 } } } }),
      {},
      NOW,
    ) as any;
    expect(m.markdown).toContain("GET /a\\|b");
  });

  it("caps endpoints and reports the total", () => {
    const stats: Record<string, unknown> = {};
    for (let i = 0; i < 5; i++) stats[`e${i}`] = { method: "GET", name: `/e${i}`, numRequests: 10 - i, numFailures: 0 };
    const base = runningRun().lastMetrics as Record<string, unknown>;
    const m = buildLiveMetrics(runningRun({ lastMetrics: { ...base, requestStats: stats } }), { max_endpoints: 2 }, NOW) as any;
    expect(m.endpoints).toHaveLength(2);
    expect(m.endpoints_total).toBe(5);
  });

  it("rejects a bad max_points", () => {
    expect(() => buildLiveMetrics(runningRun(), { max_points: 0 }, NOW)).toThrow(/max_points/);
  });
});

describe("buildLiveMetrics series and cursor", () => {
  const all = series([[-60, 20, 200], [-45, 40, 400], [-30, 60, 600], [-15, 80, 700], [-5, 100, 800]]);
  const withSeries = (input: Record<string, unknown> = {}) => ({ ...input, __liveSeries: { ok: true, raw: all } });

  it("returns recent points and a cursor with no since", () => {
    const m = buildLiveMetrics(runningRun(), withSeries(), NOW) as any;
    expect(m.series.count).toBe(5);
    expect(m.series.since).toBeNull();
    expect(m.series.next_since).toBe(iso(-5));
    expect(m.poll.next_since).toBe(iso(-5));
    expect(m.series.window).toMatchObject({ points: 5, peak_users: 100, max_rps: 800 });
    expect(m.series.points[0]).not.toHaveProperty("ts");
    expect(m.markdown).toContain("Recent points");
    expect(m.markdown).toContain(`since=${iso(-5)}`);
  });

  it("returns only points strictly newer than since", () => {
    const m = buildLiveMetrics(runningRun(), withSeries({ since: iso(-30) }), NOW) as any;
    expect(m.series.points.map((p: any) => p.timestamp)).toEqual([iso(-15), iso(-5)]);
    expect(m.series.window.points).toBe(2);
    expect(m.series.next_since).toBe(iso(-5));
  });

  it("keeps the cursor and says so when nothing is new", () => {
    const m = buildLiveMetrics(runningRun(), withSeries({ since: iso(-5) }), NOW) as any;
    expect(m.series.points).toEqual([]);
    expect(m.series.window).toBeNull();
    expect(m.series.next_since).toBe(iso(-5));
    expect(m.warnings.map((w: any) => w.code)).toContain("no_new_data");
    // Snapshot totals are still current.
    expect(m.throughput.total_requests).toBe(48000);
  });

  it("truncates to the most recent max_points", () => {
    const m = buildLiveMetrics(runningRun(), withSeries({ max_points: 2 }), NOW) as any;
    expect(m.series.truncated).toBe(true);
    expect(m.series.points.map((p: any) => p.timestamp)).toEqual([iso(-15), iso(-5)]);
  });

  it("degrades with a warning when the series fetch failed", () => {
    const m = buildLiveMetrics(runningRun(), { __liveSeries: { ok: false, error: "HTTP 404" } }, NOW) as any;
    expect(m.data_available).toBe(true);
    expect(m.series.points).toEqual([]);
    expect(m.warnings.find((w: any) => w.code === "series_unavailable").message).toContain("HTTP 404");
    expect(m.warnings.map((w: any) => w.code)).not.toContain("no_new_data");
  });

  it("detects a user drop in the series on a live run only", () => {
    const dropped = { __liveSeries: { ok: true, raw: series([[-60, 100, 800], [-30, 30, 200], [-5, 100, 800]]) } };
    const live = buildLiveMetrics(runningRun(), dropped, NOW) as any;
    expect(live.warnings.map((w: any) => w.code)).toContain("users_dropped");
    const done = buildLiveMetrics(runningRun({ status: "Finished", finishedAt: iso(-1) }), dropped, NOW) as any;
    expect(done.warnings.map((w: any) => w.code)).not.toContain("users_dropped");
    expect(done.poll.stop_polling).toBe(true);
  });

  it("tolerates a missing or null dataPoints array", () => {
    const m = buildLiveMetrics(runningRun(), { __liveSeries: { ok: true, raw: { dataPoints: null } } }, NOW) as any;
    expect(m.series.points).toEqual([]);
    expect(m.series.next_since).toBeNull();
  });
});

describe("chaos_loadtest_run status / live_metrics via Registry", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("status: single GET of the run, no timeseries call", async () => {
    const mockRequest = vi.fn().mockResolvedValue(runningRun());
    const out = (await registry.dispatchExecute(makeClient(mockRequest), "chaos_loadtest_run", "status", {
      org_id: "o", project_id: "p", run_id: "run-1", load_test_identity: "lt-1",
    })) as any;

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const call = mockRequest.mock.calls[0]![0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/loadTest/manager/api/v1/runs/run-1");
    expect(call.params.organizationIdentifier).toBe("o");
    expect(call.params.projectIdentifier).toBe("p");
    expect(call.params.loadTestIdentity).toBe("lt-1");
    expect(out.status).toBe("Running");
    expect(typeof out.markdown).toBe("string");
  });

  it("live_metrics: fetches the run and the timeseries with the same scope, and filters by since", async () => {
    const mockRequest = vi.fn().mockImplementation(async (opts: { path: string }) =>
      opts.path.endsWith("/metrics/timeseries") ? series([[-30, 60, 600], [-5, 100, 800]]) : runningRun(),
    );
    const out = (await registry.dispatchExecute(makeClient(mockRequest), "chaos_loadtest_run", "live_metrics", {
      org_id: "o", project_id: "p", run_id: "run-1", since: iso(-30),
    })) as any;

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const paths = mockRequest.mock.calls.map((c) => c[0].path);
    expect(paths).toContain("/loadTest/manager/api/v1/runs/run-1/metrics/timeseries");
    expect(paths).toContain("/loadTest/manager/api/v1/runs/run-1");
    for (const [opts] of mockRequest.mock.calls) {
      expect(opts.method).toBe("GET");
      expect(opts.params.organizationIdentifier).toBe("o");
      expect(opts.params.projectIdentifier).toBe("p");
      expect(opts.params.orgIdentifier).toBeUndefined();
    }
    // from/to are not sent: time filtering happens client-side.
    const tsCall = mockRequest.mock.calls.find((c) => c[0].path.endsWith("/timeseries"))![0];
    expect(tsCall.params.from).toBeUndefined();
    expect(out.series.points.map((p: any) => p.timestamp)).toEqual([iso(-5)]);
    expect(out.latency_ms.p95).toBe(210.4);
    expect(out).not.toHaveProperty("__liveSeries");
  });

  it("live_metrics: a failing timeseries call does not fail the poll", async () => {
    const mockRequest = vi.fn().mockImplementation(async (opts: { path: string }) => {
      if (opts.path.endsWith("/metrics/timeseries")) throw new Error("HTTP 500");
      return runningRun();
    });
    const out = (await registry.dispatchExecute(makeClient(mockRequest), "chaos_loadtest_run", "live_metrics", {
      org_id: "o", project_id: "p", run_id: "run-1",
    })) as any;
    expect(out.data_available).toBe(true);
    expect(out.warnings.map((w: any) => w.code)).toContain("series_unavailable");
  });

  it("live_metrics: a failing run call still fails the poll", async () => {
    const mockRequest = vi.fn().mockImplementation(async (opts: { path: string }) => {
      if (opts.path.endsWith("/metrics/timeseries")) return series([]);
      throw new Error("HTTP 404 run not found");
    });
    await expect(
      registry.dispatchExecute(makeClient(mockRequest), "chaos_loadtest_run", "live_metrics", { org_id: "o", project_id: "p", run_id: "run-1" }),
    ).rejects.toThrow(/404/);
  });

  it("live_metrics: bad since / missing run_id fail before any request", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);
    await expect(
      registry.dispatchExecute(client, "chaos_loadtest_run", "live_metrics", { org_id: "o", project_id: "p", run_id: "run-1", since: "soon" }),
    ).rejects.toThrow(/Invalid 'since'/);
    await expect(
      registry.dispatchExecute(client, "chaos_loadtest_run", "live_metrics", { org_id: "o", project_id: "p" }),
    ).rejects.toThrow(/run_id/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("both actions are read-risk, so they stay available in read-only mode", async () => {
    const ro = new Registry(makeConfig({ HARNESS_READ_ONLY: true }));
    const mockRequest = vi.fn().mockResolvedValue(runningRun());
    await expect(
      ro.dispatchExecute(makeClient(mockRequest), "chaos_loadtest_run", "status", { org_id: "o", project_id: "p", run_id: "run-1" }),
    ).resolves.toBeTruthy();
  });
});
