import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function extractTimeFilters(call: Record<string, unknown>): { after: number; before: number } {
  const body = call.body as { variables: { filters: Array<{ timeFilter?: { operator: string; value: number } }> } };
  const filters = body.variables.filters.filter((f) => f.timeFilter);
  const after = filters.find((f) => f.timeFilter!.operator === "AFTER")!.timeFilter!.value;
  const before = filters.find((f) => f.timeFilter!.operator === "BEFORE")!.timeFilter!.value;
  return { after, before };
}

describe("CCM time filters — buildTimeFilters via cost_timeseries dispatch", () => {
  let registry: Registry;
  let mockRequest: ReturnType<typeof vi.fn>;
  let client: HarnessClient;

  const MOCK_RESPONSE = {
    data: { perspectiveTimeSeriesStats: { stats: [] } },
  };

  // Pin "now" to 2026-05-21T12:00:00Z for deterministic tests
  const FIXED_NOW = new Date("2026-05-21T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    mockRequest = vi.fn().mockResolvedValue(MOCK_RESPONSE);
    client = makeClient(mockRequest);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function dispatchWithFilter(timeFilter: string) {
    await registry.dispatch(client, "cost_timeseries", "list", {
      perspective_id: "test-perspective",
      time_filter: timeFilter,
      time_resolution: "DAY",
      group_by: "none",
    });
    expect(mockRequest).toHaveBeenCalledOnce();
    return extractTimeFilters(mockRequest.mock.calls[0][0] as Record<string, unknown>);
  }

  it("LAST_7 → 6 days ago to today EOD", async () => {
    const { after, before } = await dispatchWithFilter("LAST_7");
    expect(after).toBe(Date.UTC(2026, 4, 15));
    expect(before).toBe(Date.UTC(2026, 4, 21, 23, 59, 59, 999));
  });

  it("THIS_MONTH → 1st of current month to last day of month EOD", async () => {
    const { after, before } = await dispatchWithFilter("THIS_MONTH");
    expect(after).toBe(Date.UTC(2026, 4, 1));
    expect(before).toBe(Date.UTC(2026, 4, 31, 23, 59, 59, 999));
  });

  it("LAST_30_DAYS → 30 days ago to today EOD", async () => {
    const { after, before } = await dispatchWithFilter("LAST_30_DAYS");
    expect(after).toBe(Date.UTC(2026, 3, 21));
    expect(before).toBe(Date.UTC(2026, 4, 21, 23, 59, 59, 999));
  });

  it("THIS_QUARTER → Q2 start (Apr 1) to today EOD", async () => {
    const { after, before } = await dispatchWithFilter("THIS_QUARTER");
    expect(after).toBe(Date.UTC(2026, 3, 1));
    expect(before).toBe(Date.UTC(2026, 4, 21, 23, 59, 59, 999));
  });

  it("THIS_YEAR → Jan 1 to today EOD", async () => {
    const { after, before } = await dispatchWithFilter("THIS_YEAR");
    expect(after).toBe(Date.UTC(2026, 0, 1));
    expect(before).toBe(Date.UTC(2026, 4, 21, 23, 59, 59, 999));
  });

  it("LAST_MONTH → prev month boundaries (Apr 1 to Apr 30 EOD)", async () => {
    const { after, before } = await dispatchWithFilter("LAST_MONTH");
    expect(after).toBe(Date.UTC(2026, 3, 1));
    expect(before).toBe(Date.UTC(2026, 3, 30, 23, 59, 59, 999));
  });

  it("LAST_QUARTER → Q1 boundaries (Jan 1 to Mar 31 EOD)", async () => {
    const { after, before } = await dispatchWithFilter("LAST_QUARTER");
    expect(after).toBe(Date.UTC(2026, 0, 1));
    expect(before).toBe(Date.UTC(2026, 2, 31, 23, 59, 59, 999));
  });

  it("LAST_YEAR → full previous year (Jan 1 to Dec 31 2025 EOD)", async () => {
    const { after, before } = await dispatchWithFilter("LAST_YEAR");
    expect(after).toBe(Date.UTC(2025, 0, 1));
    expect(before).toBe(Date.UTC(2025, 11, 31, 23, 59, 59, 999));
  });

  it("LAST_3_MONTHS → 3 complete prior months (Feb 1 to Apr 30 EOD)", async () => {
    const { after, before } = await dispatchWithFilter("LAST_3_MONTHS");
    expect(after).toBe(Date.UTC(2026, 1, 1));
    expect(before).toBe(Date.UTC(2026, 3, 30, 23, 59, 59, 999));
  });

  it("LAST_6_MONTHS → 6 complete prior months (Nov 1 2025 to Apr 30 EOD)", async () => {
    const { after, before } = await dispatchWithFilter("LAST_6_MONTHS");
    expect(after).toBe(Date.UTC(2025, 10, 1));
    expect(before).toBe(Date.UTC(2026, 3, 30, 23, 59, 59, 999));
  });

  it("LAST_12_MONTHS → 12 complete prior months (May 1 2025 to Apr 30 EOD)", async () => {
    const { after, before } = await dispatchWithFilter("LAST_12_MONTHS");
    expect(after).toBe(Date.UTC(2025, 4, 1));
    expect(before).toBe(Date.UTC(2026, 3, 30, 23, 59, 59, 999));
  });

  it("unknown filter defaults to LAST_30_DAYS behavior", async () => {
    const { after, before } = await dispatchWithFilter("BOGUS_FILTER");
    expect(after).toBe(Date.UTC(2026, 3, 21));
    expect(before).toBe(Date.UTC(2026, 4, 21, 23, 59, 59, 999));
  });

  it("output has correct timeFilter structure with AFTER and BEFORE operators", async () => {
    await registry.dispatch(client, "cost_timeseries", "list", {
      perspective_id: "test-perspective",
      time_filter: "LAST_3_MONTHS",
      time_resolution: "MONTH",
      group_by: "none",
    });

    const call = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    const body = call.body as { variables: { filters: Array<Record<string, unknown>> } };
    const timeFilters = body.variables.filters.filter(
      (f) => "timeFilter" in f
    ) as Array<{ timeFilter: { field: { fieldId: string; fieldName: string; identifier: string }; operator: string; value: number } }>;

    expect(timeFilters).toHaveLength(2);
    expect(timeFilters[0].timeFilter.field).toEqual({
      fieldId: "startTime",
      fieldName: "startTime",
      identifier: "COMMON",
    });
    expect(timeFilters[0].timeFilter.operator).toBe("AFTER");
    expect(timeFilters[1].timeFilter.operator).toBe("BEFORE");
  });

  it("LAST_3_MONTHS at January correctly rolls back to previous year", async () => {
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    mockRequest = vi.fn().mockResolvedValue(MOCK_RESPONSE);
    client = makeClient(mockRequest);

    const { after, before } = await dispatchWithFilter("LAST_3_MONTHS");
    expect(after).toBe(Date.UTC(2025, 9, 1));
    expect(before).toBe(Date.UTC(2025, 11, 31, 23, 59, 59, 999));
  });
});

describe("CCM custom time window — start_time/end_time override across perspective resources", () => {
  let registry: Registry;
  let mockRequest: ReturnType<typeof vi.fn>;
  let client: HarnessClient;

  // A historical quarter the relative enum can't express: Q4 2025 (Oct 1 – Dec 31).
  const Q4_START = Date.UTC(2025, 9, 1);           // 1759276800000
  const Q4_END = Date.UTC(2025, 11, 31, 23, 59, 59, 999);

  const MOCK_RESPONSE = { data: { perspectiveTimeSeriesStats: { stats: [] } } };
  const FIXED_NOW = new Date("2026-05-21T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    mockRequest = vi.fn().mockResolvedValue(MOCK_RESPONSE);
    client = makeClient(mockRequest);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function dispatchCustom(resourceType: string, extra: Record<string, unknown> = {}) {
    await registry.dispatch(client, resourceType, "list", {
      perspective_id: "test-perspective",
      start_time: Q4_START,
      end_time: Q4_END,
      ...extra,
    });
    expect(mockRequest).toHaveBeenCalledOnce();
    return extractTimeFilters(mockRequest.mock.calls[0][0] as Record<string, unknown>);
  }

  it("cost_timeseries honors start_time/end_time verbatim", async () => {
    const { after, before } = await dispatchCustom("cost_timeseries", { time_resolution: "MONTH", group_by: "none" });
    expect(after).toBe(Q4_START);
    expect(before).toBe(Q4_END);
  });

  it("cost_breakdown honors start_time/end_time verbatim", async () => {
    const { after, before } = await dispatchCustom("cost_breakdown", { group_by: "none" });
    expect(after).toBe(Q4_START);
    expect(before).toBe(Q4_END);
  });

  it("cost_summary honors start_time/end_time verbatim", async () => {
    const { after, before } = await dispatchCustom("cost_summary");
    expect(after).toBe(Q4_START);
    expect(before).toBe(Q4_END);
  });

  it("custom window overrides an also-supplied time_filter", async () => {
    const { after, before } = await dispatchCustom("cost_timeseries", {
      time_filter: "LAST_30_DAYS",
      time_resolution: "MONTH",
      group_by: "none",
    });
    // Explicit epoch range wins over the relative enum.
    expect(after).toBe(Q4_START);
    expect(before).toBe(Q4_END);
  });

  it("accepts numeric-string epoch values (tool args often arrive as strings)", async () => {
    await registry.dispatch(client, "cost_timeseries", "list", {
      perspective_id: "test-perspective",
      start_time: String(Q4_START),
      end_time: String(Q4_END),
      time_resolution: "MONTH",
      group_by: "none",
    });
    const { after, before } = extractTimeFilters(mockRequest.mock.calls[0][0] as Record<string, unknown>);
    expect(after).toBe(Q4_START);
    expect(before).toBe(Q4_END);
  });

  it("falls back to relative time_filter when only one bound is provided", async () => {
    await registry.dispatch(client, "cost_timeseries", "list", {
      perspective_id: "test-perspective",
      start_time: Q4_START, // end_time missing → not a valid custom window
      time_filter: "LAST_MONTH",
      time_resolution: "MONTH",
      group_by: "none",
    });
    const { after, before } = extractTimeFilters(mockRequest.mock.calls[0][0] as Record<string, unknown>);
    // LAST_MONTH relative to FIXED_NOW (May 2026) → April 2026.
    expect(after).toBe(Date.UTC(2026, 3, 1));
    expect(before).toBe(Date.UTC(2026, 3, 30, 23, 59, 59, 999));
  });
});
