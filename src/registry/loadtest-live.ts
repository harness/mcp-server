/**
 * Live status and metrics views over a load test run, for clients that poll a
 * run in flight.
 *
 * Inputs are the loadTestManager responses:
 *   - GET /v1/runs/{identity}                          LoadTestRunResponse
 *   - GET /v1/runs/{identity}/metrics/timeseries       TimeseriesChartResponse
 *
 * The run's lastMetrics is the only place
 * the backend exposes per-endpoint stats and per-worker resource usage; the
 * time-series endpoint carries run-wide points only.
 *
 * Backend gaps, reported as-is:
 *   - no p90 anywhere (MetricSnapshot carries p50/p95/p99 only)
 *   - no run-wide max latency on the snapshot DTO; it is derived from the
 *     per-endpoint maxima
 *   - no HTTP-status / error-message breakdown; "top errors" are the endpoints
 *     with the most failures plus the run-level errors[] grouped by code
 */

type Rec = Record<string, unknown>;

/** Key under which the preflight stashes the time-series fetch outcome on the dispatch input. */
export const LIVE_SERIES_INPUT_KEY = "__liveSeries";

export type LiveSeriesFetch = { ok: true; raw: unknown } | { ok: false; error: string };

const TERMINAL_STATUSES = new Set(["Stopped", "Finished", "Failed"]);

const DEFAULT_MAX_POINTS = 60;
const MAX_POINTS_CAP = 500;
const DEFAULT_MAX_ENDPOINTS = 20;
const MAX_ENDPOINTS_CAP = 200;

/** A snapshot older than this on a Running run means metrics have stopped flowing. */
const STALE_SNAPSHOT_SEC = 60;
/** Share of a pod's cpu/memory limit above which the load generator itself may be the bottleneck. */
const WORKER_HOT_PCT = 85;
/** Below this share of target users, once ramp-up is over, load is considered short. */
const USERS_SHORTFALL_RATIO = 0.9;
/** A fall below this share of the earlier peak, within the returned series, is reported as a drop. */
const USERS_DROP_RATIO = 0.5;

/** Matches the cadence at which the UI refreshes a run. */
const POLL_INTERVAL_SEC = 5;

/** Rows the backend adds for whole-run totals; not real endpoints. */
const SYNTHETIC_ENDPOINT_NAMES = new Set(["Aggregated", "All HTTP requests"]);

const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const positive = (v: unknown): number | null => {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

function round(n: number | null, dp = 1): number | null {
  if (n === null) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function parseMs(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== "string" || v === "") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

function clampInt(raw: unknown, fallback: number, max: number, field: string): number {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`'${field}' must be a positive integer (max ${max}); got ${JSON.stringify(raw)}.`);
  }
  return Math.min(n, max);
}

/**
 * Parse the `since` cursor into epoch milliseconds. Accepts the `next_since`
 * a previous response returned (ISO-8601), or an epoch in milliseconds or
 * seconds. Returns undefined when no cursor was given.
 */
export function parseSince(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  let ms = Number.NaN;
  if (typeof raw === "number") {
    ms = raw;
  } else if (typeof raw === "string") {
    const s = raw.trim();
    ms = /^\d+(\.\d+)?$/.test(s) ? Number(s) : Date.parse(s);
  }
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(
      `Invalid 'since' ${JSON.stringify(raw)}. Pass the 'next_since' value from the previous response ` +
        `(ISO-8601, e.g. 2026-10-05T06:55:30.000Z) or an epoch timestamp in milliseconds or seconds.`,
    );
  }
  // 1e11 ms is early 1973; 1e11 s is the year 5138. Anything below is epoch seconds.
  const isEpoch = typeof raw === "number" || /^\d+(\.\d+)?$/.test(String(raw).trim());
  return isEpoch && ms < 1e11 ? ms * 1000 : ms;
}

/** Validate the optional polling inputs before any network call is made. */
export function validateLiveMetricsInput(input: Rec): void {
  parseSince(input.since);
  clampInt(input.max_points, DEFAULT_MAX_POINTS, MAX_POINTS_CAP, "max_points");
  clampInt(input.max_endpoints, DEFAULT_MAX_ENDPOINTS, MAX_ENDPOINTS_CAP, "max_endpoints");
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const DASH = "—";

function fmtNum(n: number | null, dp = 0): string {
  if (n === null) return DASH;
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtMs(n: number | null): string {
  if (n === null) return DASH;
  return n >= 1000 ? `${fmtNum(n / 1000, 2)} s` : `${fmtNum(n, n < 10 ? 1 : 0)} ms`;
}

function fmtPct(n: number | null): string {
  return n === null ? DASH : `${fmtNum(n, 2)}%`;
}

function fmtDuration(sec: number | null): string {
  if (sec === null) return DASH;
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(r).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(r).padStart(2, "0")}s`;
  return `${r}s`;
}

function fmtBytes(n: number | null): string {
  if (n === null) return DASH;
  if (n >= 1024 ** 3) return `${fmtNum(n / 1024 ** 3, 2)} GiB`;
  return `${fmtNum(n / 1024 ** 2, 0)} MiB`;
}

function cell(v: unknown): string {
  return String(v).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(cell).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

const PHASE_LABEL: Record<string, string> = {
  pending: "pending (provisioning workers)",
  starting: "starting (no metrics yet)",
  ramping_up: "ramping up",
  steady: "steady state",
  stopping: "stopping",
  finished: "finished",
  stopped: "stopped",
  failed: "failed",
  unknown: "unknown",
};

// ---------------------------------------------------------------------------
// Shared run context
// ---------------------------------------------------------------------------

export interface Warning {
  code: string;
  message: string;
}

interface Worker {
  name: string;
  state: string;
  reason: string | null;
  cpu_cores: number | null;
  cpu_limit_cores: number | null;
  cpu_pct_of_limit: number | null;
  memory_bytes: number | null;
  memory_limit_bytes: number | null;
  memory_pct_of_limit: number | null;
  users: number | null;
}

interface RunContext {
  now: number;
  run: Rec;
  runId: string | null;
  status: string;
  isTerminal: boolean;
  snapshot: Rec | null;
  snapshotMs: number | null;
  hasMetrics: boolean;
  startedMs: number | null;
  finishedMs: number | null;
  elapsedSec: number | null;
  totalSec: number | null;
  rampUpSec: number | null;
  currentUsers: number | null;
  targetUsers: number | null;
  phase: string;
  workers: Worker[];
  configuredWorkers: number | null;
  activeWorkers: number | null;
  warnings: Warning[];
}

function buildWorkers(snapshot: Rec | null): Worker[] {
  const raw = snapshot?.workerStats;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRec).map((w) => {
    const cpu = num(w.cpuCores);
    const cpuLimit = positive(w.cpuLimitCores);
    const mem = num(w.memoryBytes);
    const memLimit = positive(w.memoryLimitBytes);
    return {
      name: str(w.name) ?? "unknown",
      state: str(w.state) ?? "unknown",
      reason: str(w.reason),
      cpu_cores: round(cpu, 2),
      cpu_limit_cores: cpuLimit,
      cpu_pct_of_limit: cpu !== null && cpuLimit !== null ? round((cpu / cpuLimit) * 100, 1) : null,
      memory_bytes: mem,
      memory_limit_bytes: memLimit,
      memory_pct_of_limit: mem !== null && memLimit !== null ? round((mem / memLimit) * 100, 1) : null,
      users: num(w.users),
    };
  });
}

function buildContext(rawRun: unknown, now: number): RunContext {
  if (!isRec(rawRun)) {
    throw new Error("Unexpected run response from loadTestManager: expected a JSON object.");
  }
  const run = rawRun;
  const status = str(run.status) ?? "Unknown";
  const isTerminal = TERMINAL_STATUSES.has(status);
  const snapshot = isRec(run.lastMetrics) ? run.lastMetrics : null;
  const snapshotMs = parseMs(snapshot?.timestamp);

  const requests = num(snapshot?.totalRequests) ?? 0;
  const users = num(snapshot?.currentUsers) ?? 0;
  const hasMetrics = snapshot !== null && (requests > 0 || users > 0);

  const startedMs = parseMs(run.startedAt);
  const finishedMs = parseMs(run.finishedAt);
  const endMs = isTerminal ? (finishedMs ?? snapshotMs) : now;
  const elapsedSec = startedMs !== null && endMs !== null ? Math.max(0, (endMs - startedMs) / 1000) : null;
  const totalSec = positive(run.durationSeconds);
  const rampUpSec = positive(run.rampUpTimeSec);

  const currentUsers = snapshot ? num(snapshot.currentUsers) : null;
  const targetUsers = positive(run.targetUsers);

  const workers = buildWorkers(snapshot);
  const workerCount = num(run.workerCount);
  const configuredWorkers = workerCount !== null && workerCount > 0 ? workerCount : null;
  const activeWorkers = workers.length > 0 ? workers.filter((w) => w.state === "running").length : null;

  let phase: string;
  switch (status) {
    case "Pending":
      phase = "pending";
      break;
    case "Stopping":
      phase = "stopping";
      break;
    case "Finished":
      phase = "finished";
      break;
    case "Stopped":
      phase = "stopped";
      break;
    case "Failed":
      phase = "failed";
      break;
    case "Running":
      if (!hasMetrics) phase = "starting";
      else if (rampUpSec !== null && elapsedSec !== null) phase = elapsedSec < rampUpSec ? "ramping_up" : "steady";
      else if (targetUsers !== null && currentUsers !== null && currentUsers < targetUsers) phase = "ramping_up";
      else phase = "steady";
      break;
    default:
      phase = "unknown";
  }

  const ctx: RunContext = {
    now,
    run,
    runId: str(run.identity) ?? str(run.run_id) ?? str(run.uniqueId),
    status,
    isTerminal,
    snapshot,
    snapshotMs,
    hasMetrics,
    startedMs,
    finishedMs,
    elapsedSec,
    totalSec,
    rampUpSec,
    currentUsers,
    targetUsers,
    phase,
    workers,
    configuredWorkers,
    activeWorkers,
    warnings: [],
  };
  ctx.warnings.push(...runWarnings(ctx));
  return ctx;
}

function runWarnings(c: RunContext): Warning[] {
  const out: Warning[] = [];
  const live = !c.isTerminal && c.status !== "Pending";

  if (c.phase === "pending") {
    out.push({ code: "run_pending", message: "Run is Pending: workers are being provisioned. No load or metrics yet." });
  }
  if (c.phase === "starting") {
    out.push({
      code: "metrics_not_available",
      message: "Run is Running but no metrics have been pushed yet (startup). Values are null, not zero. Poll again shortly.",
    });
  }
  if (c.status === "Failed") {
    const code = str(c.run.errorCode);
    const msg = str(c.run.errorMessage);
    out.push({ code: "run_failed", message: `Run failed${code ? ` (${code})` : ""}${msg ? `: ${msg}` : "."}` });
  }
  if (c.phase === "ramping_up" && c.hasMetrics) {
    const of = c.targetUsers !== null ? ` (${c.currentUsers ?? "?"} of ${c.targetUsers} users)` : "";
    out.push({
      code: "ramping_up_partial_data",
      message: `Load is still ramping up${of}. Latency and error figures reflect a partial load and are not representative of steady state.`,
    });
  }
  if (
    c.phase === "steady" &&
    c.status === "Running" &&
    c.targetUsers !== null &&
    c.currentUsers !== null &&
    c.currentUsers < c.targetUsers * USERS_SHORTFALL_RATIO
  ) {
    out.push({
      code: "users_below_target",
      message: `Ramp-up should be over but only ${c.currentUsers} of ${c.targetUsers} users are active. A worker may have restarted or failed to start.`,
    });
  }
  if (live && c.snapshotMs !== null && c.hasMetrics) {
    const ageSec = (c.now - c.snapshotMs) / 1000;
    if (ageSec > STALE_SNAPSHOT_SEC) {
      out.push({
        code: "metrics_stale",
        message: `The latest metrics snapshot is ${fmtDuration(ageSec)} old. Workers may be restarting or have stopped reporting.`,
      });
    }
  }

  const notRunning = c.workers.filter((w) => w.state !== "running");
  if (live && notRunning.length > 0) {
    const list = notRunning.map((w) => `${w.name} (${w.state}${w.reason ? `: ${w.reason}` : ""})`).join(", ");
    out.push({
      code: "workers_not_running",
      message: `${notRunning.length} of ${c.workers.length} worker pod(s) not running: ${list}. A restart or scheduling problem would show here.`,
    });
  }
  if (
    live &&
    c.configuredWorkers !== null &&
    c.activeWorkers !== null &&
    c.workers.length > 0 &&
    c.activeWorkers < c.configuredWorkers &&
    notRunning.length === 0
  ) {
    out.push({
      code: "workers_below_configured",
      message: `${c.activeWorkers} worker(s) reporting but ${c.configuredWorkers} configured.`,
    });
  }
  if (live) {
    const hot = c.workers.filter(
      (w) => (w.cpu_pct_of_limit ?? 0) >= WORKER_HOT_PCT || (w.memory_pct_of_limit ?? 0) >= WORKER_HOT_PCT,
    );
    if (hot.length > 0) {
      out.push({
        code: "worker_saturated",
        message: `Worker(s) at or above ${WORKER_HOT_PCT}% of their cpu/memory limit: ${hot.map((w) => w.name).join(", ")}. The load generator may be the bottleneck, which inflates latency; consider more workers.`,
      });
    }
  }

  const thresholds = str(c.run.thresholdVerdict);
  if (thresholds === "fail") {
    out.push({ code: "thresholds_failing", message: "At least one configured threshold has been breached." });
  }
  return out;
}

function pollHint(c: RunContext): { recommended_interval_sec: number | null; stop_polling: boolean; reason: string } {
  if (c.isTerminal) {
    return { recommended_interval_sec: null, stop_polling: true, reason: `Run is ${c.status}; its data will not change further.` };
  }
  return {
    recommended_interval_sec: POLL_INTERVAL_SEC,
    stop_polling: false,
    reason: `Run is ${PHASE_LABEL[c.phase] ?? c.phase}: ${POLL_INTERVAL_SEC}s matches how often the UI refreshes.`,
  };
}

function statusFields(c: RunContext) {
  const progress =
    c.status === "Finished"
      ? 100
      : c.elapsedSec !== null && c.totalSec !== null
        ? Math.min(100, round((c.elapsedSec / c.totalSec) * 100, 1) ?? 0)
        : null;
  return {
    run_id: c.runId,
    run_name: str(c.run.name),
    load_test_id: str(c.run.loadTestIdentity),
    tool_type: str(c.run.toolType),
    status: c.status,
    phase: c.phase,
    is_terminal: c.isTerminal,
    started_at: c.startedMs !== null ? new Date(c.startedMs).toISOString() : null,
    finished_at: c.finishedMs !== null ? new Date(c.finishedMs).toISOString() : null,
    elapsed_sec: round(c.elapsedSec, 0),
    total_sec: c.totalSec,
    remaining_sec:
      !c.isTerminal && c.elapsedSec !== null && c.totalSec !== null ? Math.max(0, Math.round(c.totalSec - c.elapsedSec)) : null,
    progress_pct: progress,
    users: {
      current: c.currentUsers,
      target: c.targetUsers,
      ramp_up_sec: c.rampUpSec,
    },
    workers: {
      configured: c.configuredWorkers,
      reporting: c.workers.length > 0 ? c.workers.length : null,
      active: c.activeWorkers,
    },
    threshold_verdict: str(c.run.thresholdVerdict),
  };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function buildRunStatus(rawRun: unknown, now: number = Date.now()): Rec {
  const c = buildContext(rawRun, now);
  const fields = statusFields(c);
  const poll = pollHint(c);
  const result: Rec = {
    ...fields,
    data_available: c.hasMetrics,
    as_of: new Date(now).toISOString(),
    warnings: c.warnings,
    poll,
  };
  result.markdown = renderStatusMarkdown(fields, c.warnings, poll);
  return result;
}

function headline(f: ReturnType<typeof statusFields>): string {
  const name = f.run_name ?? f.run_id ?? "run";
  return `### Load test run \`${name}\` — ${f.status} (${PHASE_LABEL[f.phase] ?? f.phase})`;
}

function statusRows(f: ReturnType<typeof statusFields>): string[][] {
  const timing =
    f.elapsed_sec === null
      ? DASH
      : `${fmtDuration(f.elapsed_sec)} / ${fmtDuration(f.total_sec)}${f.progress_pct !== null ? ` (${fmtNum(f.progress_pct, 1)}%)` : ""}`;
  const usersTxt =
    f.users.current === null && f.users.target === null
      ? DASH
      : `${f.users.current ?? DASH} / ${f.users.target ?? DASH}`;
  const w = f.workers;
  const workersTxt =
    w.active === null && w.configured === null
      ? DASH
      : `${w.active ?? DASH} active${w.configured !== null ? ` of ${w.configured} configured` : ""}`;
  return [
    ["Status", f.status],
    ["Terminal", f.is_terminal ? "yes — stop polling" : "no"],
    ["Elapsed / total", timing],
    ["Remaining", f.remaining_sec === null ? DASH : fmtDuration(f.remaining_sec)],
    ["Users (current / target)", usersTxt],
    ["Workers", workersTxt],
    ["Thresholds", f.threshold_verdict ?? DASH],
  ];
}

function warningsMd(warnings: Warning[]): string {
  if (warnings.length === 0) return "";
  return `\n**Notes**\n${warnings.map((w) => `- ⚠ ${w.message}`).join("\n")}\n`;
}

function pollMd(poll: ReturnType<typeof pollHint>, nextSince?: string | null): string {
  if (poll.stop_polling) return `\n_${poll.reason}_`;
  const since = nextSince ? ` with \`since=${nextSince}\`` : "";
  return `\n_Poll again in ${poll.recommended_interval_sec}s${since}._`;
}

function renderStatusMarkdown(f: ReturnType<typeof statusFields>, warnings: Warning[], poll: ReturnType<typeof pollHint>): string {
  return [
    headline(f),
    "",
    table(["Field", "Value"], statusRows(f)),
    warningsMd(warnings),
    pollMd(poll),
  ]
    .join("\n")
    .trimEnd();
}

// ---------------------------------------------------------------------------
// Live metrics
// ---------------------------------------------------------------------------

interface Endpoint {
  key: string;
  method: string;
  name: string;
  requests: number;
  rps: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
  max_ms: number | null;
  failures: number;
  failure_pct: number | null;
}

function buildEndpoints(snapshot: Rec | null): { endpoints: Endpoint[]; maxMs: number | null } {
  const stats = snapshot?.requestStats;
  if (!isRec(stats)) return { endpoints: [], maxMs: null };
  const endpoints: Endpoint[] = [];
  let maxMs: number | null = null;
  let aggregateMaxMs: number | null = null;
  for (const v of Object.values(stats)) {
    if (!isRec(v)) continue;
    const method = str(v.method) ?? "";
    const name = str(v.name) ?? "";
    const max = positive(v.maxResponseTime);
    if (SYNTHETIC_ENDPOINT_NAMES.has(name)) {
      if (max !== null) aggregateMaxMs = Math.max(aggregateMaxMs ?? 0, max);
      continue;
    }
    if (max !== null) maxMs = Math.max(maxMs ?? 0, max);
    const requests = num(v.numRequests) ?? 0;
    const failures = num(v.numFailures) ?? 0;
    endpoints.push({
      key: method ? `${method} ${name}` : name,
      method,
      name,
      requests,
      rps: round(num(v.requestsPerSec), 2),
      // Locust leaves per-endpoint p95/p99 at zero ; a zero percentile is "not reported".
      p50_ms: round(positive(v.medianResponseTime), 1),
      p95_ms: round(positive(v.p95ResponseMs), 1),
      p99_ms: round(positive(v.p99ResponseMs), 1),
      max_ms: round(max, 1),
      failures,
      failure_pct: requests > 0 ? round(Math.min(100, (failures / requests) * 100), 2) : null,
    });
  }
  endpoints.sort((a, b) => b.requests - a.requests || a.key.localeCompare(b.key));
  return { endpoints, maxMs: aggregateMaxMs ?? maxMs };
}

interface SeriesPoint {
  timestamp: string;
  rps: number | null;
  users: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
  error_rate_pct: number | null;
  ts: number;
}

function parseSeries(fetched: LiveSeriesFetch | undefined): { points: SeriesPoint[]; error: string | null } {
  if (!fetched) return { points: [], error: null };
  if (!fetched.ok) return { points: [], error: fetched.error };
  const raw = isRec(fetched.raw) ? fetched.raw.dataPoints : undefined;
  if (!Array.isArray(raw)) return { points: [], error: null };
  const points: SeriesPoint[] = [];
  for (const p of raw) {
    if (!isRec(p)) continue;
    const ts = parseMs(p.timestamp);
    if (ts === null) continue;
    points.push({
      timestamp: new Date(ts).toISOString(),
      rps: round(num(p.totalRps), 2),
      users: num(p.currentUsers),
      p50_ms: round(num(p.p50ResponseMs), 1),
      p95_ms: round(num(p.p95ResponseMs), 1),
      p99_ms: round(num(p.p99ResponseMs), 1),
      error_rate_pct: round(num(p.errorRate), 2),
      ts,
    });
  }
  points.sort((a, b) => a.ts - b.ts);
  return { points, error: null };
}

function windowSummary(points: SeriesPoint[]) {
  if (points.length === 0) return null;
  const avg = (sel: (p: SeriesPoint) => number | null): number | null => {
    const vals = points.map(sel).filter((v): v is number => v !== null);
    return vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length, 2) : null;
  };
  const max = (sel: (p: SeriesPoint) => number | null): number | null => {
    const vals = points.map(sel).filter((v): v is number => v !== null);
    return vals.length ? Math.max(...vals) : null;
  };
  return {
    points: points.length,
    from: points[0]?.timestamp ?? null,
    to: points[points.length - 1]?.timestamp ?? null,
    avg_rps: avg((p) => p.rps),
    max_rps: max((p) => p.rps),
    peak_users: max((p) => p.users),
    avg_p95_ms: avg((p) => p.p95_ms),
    max_p95_ms: max((p) => p.p95_ms),
    avg_error_rate_pct: avg((p) => p.error_rate_pct),
  };
}

function seriesWarnings(c: RunContext, all: SeriesPoint[]): Warning[] {
  if (c.isTerminal) return [];
  let peak = 0;
  for (const p of all) {
    const u = p.users;
    if (u === null) continue;
    if (peak > 0 && u < peak * USERS_DROP_RATIO) {
      return [
        {
          code: "users_dropped",
          message: `Active users fell from ${peak} to ${u} at ${p.timestamp}. A worker restart or an early ramp-down is the usual cause; check the worker table.`,
        },
      ];
    }
    peak = Math.max(peak, u);
  }
  return [];
}

function topRunErrors(run: Rec): Array<{ code: string; count: number; message: string | null; source: string | null; phase: string | null }> {
  const errs = run.errors;
  if (!Array.isArray(errs)) return [];
  const groups = new Map<string, { code: string; count: number; message: string | null; source: string | null; phase: string | null }>();
  for (const e of errs) {
    if (!isRec(e)) continue;
    const code = str(e.errorCode) ?? "UNKNOWN";
    const g = groups.get(code);
    if (g) {
      g.count += 1;
      g.message = str(e.errorMessage) ?? g.message;
    } else {
      groups.set(code, { code, count: 1, message: str(e.errorMessage), source: str(e.source), phase: str(e.phase) });
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 5);
}

export function buildLiveMetrics(rawRun: unknown, input: Rec, now: number = Date.now()): Rec {
  const since = parseSince(input.since);
  const maxPoints = clampInt(input.max_points, DEFAULT_MAX_POINTS, MAX_POINTS_CAP, "max_points");
  const maxEndpoints = clampInt(input.max_endpoints, DEFAULT_MAX_ENDPOINTS, MAX_ENDPOINTS_CAP, "max_endpoints");

  const c = buildContext(rawRun, now);
  const snap = c.snapshot;
  const available = c.hasMetrics && snap !== null;

  const totalRequests = available ? num(snap.totalRequests) : null;
  const totalFailures = available ? num(snap.totalFailures) : null;
  const errorRate =
    available && snap
      ? (num(snap.errorRate) ??
        (totalRequests && totalRequests > 0 && totalFailures !== null ? (totalFailures / totalRequests) * 100 : null))
      : null;

  const { endpoints, maxMs } = available ? buildEndpoints(snap) : { endpoints: [], maxMs: null };
  const failing = endpoints
    .filter((e) => e.failures > 0)
    .sort((a, b) => b.failures - a.failures || b.requests - a.requests)
    .slice(0, 5)
    .map((e) => ({ endpoint: e.key, failures: e.failures, failure_pct: e.failure_pct }));

  const activeForSplit = c.activeWorkers !== null && c.activeWorkers > 0 ? c.activeWorkers : null;
  const usersPerWorker =
    c.currentUsers !== null && activeForSplit !== null ? round(c.currentUsers / activeForSplit, 1) : null;

  const series = parseSeries(input[LIVE_SERIES_INPUT_KEY] as LiveSeriesFetch | undefined);
  const fresh = since === undefined ? series.points : series.points.filter((p) => p.ts > since);
  const truncated = fresh.length > maxPoints;
  const returned = truncated ? fresh.slice(fresh.length - maxPoints) : fresh;
  const newest = series.points[series.points.length - 1]?.ts;
  // Without a newer point the cursor stays where the caller left it, so the next poll asks the same question.
  const nextSince = newest !== undefined ? new Date(Math.max(newest, since ?? 0)).toISOString() : since !== undefined ? new Date(since).toISOString() : null;

  const warnings = [...c.warnings, ...seriesWarnings(c, series.points)];
  if (series.error) {
    warnings.push({
      code: "series_unavailable",
      message: `Time-series points could not be fetched (${series.error}). The snapshot below is still current.`,
    });
  }
  if (since !== undefined && fresh.length === 0 && !c.isTerminal && series.error === null) {
    warnings.push({
      code: "no_new_data",
      message: `No metrics points newer than ${new Date(since).toISOString()}. Normal if you poll faster than metrics are pushed; persistent silence means workers stopped reporting.`,
    });
  }

  const notReported = ["latency_ms.p90: the backend does not compute a 90th percentile"];
  if (available && maxMs === null) notReported.push("latency_ms.max: no per-endpoint maximum reported yet");
  notReported.push("errors.top_error_types: HTTP status / error-message breakdown is not exposed; see top_failing_endpoints and run_errors");
  if (available && endpoints.length > 0 && endpoints.every((e) => e.p95_ms === null)) {
    notReported.push("endpoints[].p95_ms/p99_ms: this load tool reports run-wide percentiles only");
  }

  const poll = {
    ...pollHint(c),
    next_since: nextSince,
  };

  const status = statusFields(c);
  const thresholds = Array.isArray(c.run.thresholdResults)
    ? c.run.thresholdResults.filter(isRec).map((t) => ({
        metric: str(t.metric),
        stat: str(t.stat),
        operator: str(t.operator),
        value: num(t.value),
        actual: round(num(t.actual), 2),
        status: str(t.status),
        current_status: str(t.currentStatus),
      }))
    : [];

  const result: Rec = {
    ...status,
    data_available: available,
    snapshot_at: c.snapshotMs !== null ? new Date(c.snapshotMs).toISOString() : null,
    snapshot_age_sec: c.snapshotMs !== null ? Math.max(0, Math.round((now - c.snapshotMs) / 1000)) : null,
    as_of: new Date(now).toISOString(),
    latency_ms: {
      p50: available ? round(positive(snap?.p50ResponseMs), 1) : null,
      p90: null,
      p95: available ? round(positive(snap?.p95ResponseMs), 1) : null,
      p99: available ? round(positive(snap?.p99ResponseMs), 1) : null,
      max: round(maxMs, 1),
      avg: available ? round(positive(snap?.avgResponseMs), 1) : null,
    },
    throughput: {
      current_rps: available ? round(num(snap?.totalRps), 2) : null,
      total_requests: totalRequests,
    },
    errors: {
      total_failures: totalFailures,
      error_rate_pct: round(errorRate, 2),
      top_failing_endpoints: failing,
      run_errors: topRunErrors(c.run),
    },
    saturation: {
      configured_workers: c.configuredWorkers,
      active_workers: c.activeWorkers,
      current_users: c.currentUsers,
      target_users: c.targetUsers,
      users_per_worker: usersPerWorker,
      workers: c.workers,
      hot_workers: c.workers
        .filter((w) => (w.cpu_pct_of_limit ?? 0) >= WORKER_HOT_PCT || (w.memory_pct_of_limit ?? 0) >= WORKER_HOT_PCT)
        .map((w) => w.name),
    },
    endpoints: endpoints.slice(0, maxEndpoints),
    endpoints_total: endpoints.length,
    series: {
      since: since !== undefined ? new Date(since).toISOString() : null,
      next_since: nextSince,
      count: returned.length,
      truncated,
      window: windowSummary(returned),
      points: returned.map(({ ts: _ts, ...p }) => p),
    },
    thresholds,
    not_reported: notReported,
    warnings,
    poll,
  };
  result.markdown = renderLiveMarkdown(c, status, result, warnings, poll, nextSince);
  return result;
}

function renderLiveMarkdown(
  c: RunContext,
  status: ReturnType<typeof statusFields>,
  r: Rec,
  warnings: Warning[],
  poll: ReturnType<typeof pollHint>,
  nextSince: string | null,
): string {
  const lat = r.latency_ms as Record<string, number | null>;
  const thr = r.throughput as { current_rps: number | null; total_requests: number | null };
  const err = r.errors as {
    total_failures: number | null;
    error_rate_pct: number | null;
    top_failing_endpoints: Array<{ endpoint: string; failures: number; failure_pct: number | null }>;
    run_errors: Array<{ code: string; count: number; message: string | null }>;
  };
  const sat = r.saturation as {
    users_per_worker: number | null;
    workers: Worker[];
  };
  const endpoints = r.endpoints as Endpoint[];
  const endpointsTotal = r.endpoints_total as number;
  const series = r.series as { points: Array<Omit<SeriesPoint, "ts">>; truncated: boolean };

  const parts: string[] = [headline(status), ""];
  parts.push(table(["Field", "Value"], statusRows(status)));

  if (!r.data_available) {
    parts.push(warningsMd(warnings));
    parts.push(pollMd(poll, nextSince));
    return parts.join("\n").trimEnd();
  }

  parts.push(
    "",
    "**Latency**",
    "",
    table(
      ["p50", "p90", "p95", "p99", "max", "avg"],
      [[fmtMs(lat.p50 ?? null), "n/a", fmtMs(lat.p95 ?? null), fmtMs(lat.p99 ?? null), fmtMs(lat.max ?? null), fmtMs(lat.avg ?? null)]],
    ),
    "",
    "**Throughput and errors**",
    "",
    table(
      ["Current RPS", "Total requests", "Failures", "Error rate"],
      [[fmtNum(thr.current_rps, 2), fmtNum(thr.total_requests), fmtNum(err.total_failures), fmtPct(err.error_rate_pct)]],
    ),
  );

  if (err.top_failing_endpoints.length > 0 || err.run_errors.length > 0) {
    parts.push("", "**Top errors**", "");
    const rows = [
      ...err.top_failing_endpoints.map((e) => [e.endpoint, fmtNum(e.failures), fmtPct(e.failure_pct)]),
    ];
    if (rows.length > 0) parts.push(table(["Endpoint", "Failures", "Failure %"], rows), "");
    if (err.run_errors.length > 0) {
      parts.push(table(["Run error", "Count", "Message"], err.run_errors.map((e) => [e.code, String(e.count), e.message ?? DASH])));
    }
  }

  parts.push("", "**Saturation**", "");
  parts.push(
    table(
      ["Active workers", "Users", "Users per worker"],
      [
        [
          c.activeWorkers === null ? DASH : `${c.activeWorkers}${c.configuredWorkers !== null ? ` / ${c.configuredWorkers}` : ""}`,
          c.currentUsers === null ? DASH : `${c.currentUsers}${c.targetUsers !== null ? ` / ${c.targetUsers}` : ""}`,
          fmtNum(sat.users_per_worker, 1),
        ],
      ],
    ),
  );
  if (sat.workers.length > 0) {
    parts.push(
      "",
      table(
        ["Worker", "State", "CPU", "Memory", "Users"],
        sat.workers.map((w) => [
          w.name,
          w.reason ? `${w.state} (${w.reason})` : w.state,
          w.cpu_cores === null ? DASH : `${fmtNum(w.cpu_cores, 2)} cores${w.cpu_pct_of_limit !== null ? ` (${fmtNum(w.cpu_pct_of_limit, 0)}% of limit)` : ""}`,
          w.memory_bytes === null ? DASH : `${fmtBytes(w.memory_bytes)}${w.memory_pct_of_limit !== null ? ` (${fmtNum(w.memory_pct_of_limit, 0)}% of limit)` : ""}`,
          w.users === null ? DASH : String(w.users),
        ]),
      ),
    );
  } else {
    parts.push("", "_No per-worker resource data reported for this run (Linux VM and some infrastructures do not provide it)._");
  }

  if (endpoints.length > 0) {
    parts.push(
      "",
      `**Endpoints** (${endpoints.length} of ${endpointsTotal}, by requests)`,
      "",
      table(
        ["Endpoint", "Requests", "RPS", "p50", "p95", "p99", "Failure %"],
        endpoints.map((e) => [
          e.key,
          fmtNum(e.requests),
          fmtNum(e.rps, 2),
          fmtMs(e.p50_ms),
          fmtMs(e.p95_ms),
          fmtMs(e.p99_ms),
          fmtPct(e.failure_pct),
        ]),
      ),
    );
  }

  if (series.points.length > 0) {
    const shown = series.points.slice(-10);
    parts.push(
      "",
      `**Recent points** (${shown.length} of ${series.points.length}${series.truncated ? ", older points dropped" : ""})`,
      "",
      table(
        ["Time", "Users", "RPS", "p50", "p95", "p99", "Error %"],
        shown.map((p) => [p.timestamp, p.users === null ? DASH : String(p.users), fmtNum(p.rps, 2), fmtMs(p.p50_ms), fmtMs(p.p95_ms), fmtMs(p.p99_ms), fmtPct(p.error_rate_pct)]),
      ),
    );
  }

  parts.push(warningsMd(warnings));
  parts.push(pollMd(poll, nextSince));
  return parts.join("\n").trimEnd();
}
