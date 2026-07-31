/**
 * Regression tests for CCM cost anomaly v2 APIs (#533).
 * Guards request body shaping, drill-down path routing, and response extraction
 * for cost_anomaly, cost_anomaly_drilldown, and cost_anomaly_summary.
 */
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
    request: requestFn ?? vi.fn().mockResolvedValue({ data: [] }),
    account: "test-account",
  } as unknown as HarnessClient;
}

function anomalyFilters(call: Record<string, unknown>): Record<string, unknown> {
  const body = call.body as { anomalyFilterPropertiesDTO: Record<string, unknown> };
  return body.anomalyFilterPropertiesDTO;
}

describe("cost_anomaly list — v2 API body shaping", () => {
  let registry: Registry;
  let mockRequest: ReturnType<typeof vi.fn>;
  let client: HarnessClient;

  const FIXED_NOW = new Date("2026-05-21T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    mockRequest = vi.fn().mockResolvedValue({ data: [{ id: "anom-1" }] });
    client = makeClient(mockRequest);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts to /ccm/api/anomaly/v2/list with v2 defaults", async () => {
    await registry.dispatch(client, "cost_anomaly", "list", {});

    const call = mockRequest.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ccm/api/anomaly/v2/list");

    const filters = anomalyFilters(call);
    expect(filters).toMatchObject({
      filterType: "Anomaly",
      limit: 10,
      offset: 0,
      anomalyView: "RESOURCE",
      groupBy: [],
      searchText: [""],
      orderBy: [{ field: "ANOMALOUS_SPEND", order: "DESCENDING" }],
    });
    expect(filters.timeFilters).toEqual([
      { operator: "AFTER", timestamp: Date.UTC(2026, 3, 21) },
      { operator: "BEFORE", timestamp: Date.UTC(2026, 4, 21, 23, 59, 59, 999) },
    ]);
  });

  it("maps perspective_id to query param and passes rich filters in body", async () => {
    await registry.dispatch(client, "cost_anomaly", "list", {
      perspective_id: "prod-perspective",
      status: "ACTIVE",
      anomaly_view: "PERSPECTIVE",
      search_text: "ec2",
      time_filter: "LAST_7",
      order_by_field: "TIME",
      order_by_direction: "ASCENDING",
      min_amount: 0,
      min_anomalous_spend: 50,
      limit: 25,
      offset: 5,
    });

    const call = mockRequest.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.params).toEqual({ perspectiveId: "prod-perspective" });

    const filters = anomalyFilters(call);
    expect(filters).toMatchObject({
      limit: 25,
      offset: 5,
      anomalyView: "PERSPECTIVE",
      searchText: ["ec2"],
      status: ["ACTIVE"],
      minActualAmount: 0,
      minAnomalousSpend: 50,
      orderBy: [{ field: "TIME", order: "ASCENDING" }],
    });
    expect(filters.timeFilters).toEqual([
      { operator: "AFTER", timestamp: Date.UTC(2026, 4, 15) },
      { operator: "BEFORE", timestamp: Date.UTC(2026, 4, 21, 23, 59, 59, 999) },
    ]);
  });

  it("prefers explicit start_time/end_time over time_filter", async () => {
    const start = Date.UTC(2025, 9, 1);
    const end = Date.UTC(2025, 11, 31, 23, 59, 59, 999);

    await registry.dispatch(client, "cost_anomaly", "list", {
      start_time: start,
      end_time: end,
      time_filter: "LAST_30_DAYS",
    });

    const filters = anomalyFilters(mockRequest.mock.calls[0]![0] as Record<string, unknown>);
    expect(filters.timeFilters).toEqual([
      { operator: "AFTER", timestamp: start },
      { operator: "BEFORE", timestamp: end },
    ]);
  });

  it("returns items/total via anomalyListExtract", async () => {
    const result = await registry.dispatch(client, "cost_anomaly", "list", {});

    expect(result).toEqual({
      items: [{ id: "anom-1" }],
      total: 1,
    });
  });
});

describe("cost_anomaly report_feedback execute action", () => {
  it("sends feedback via query params with empty body", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { success: true } });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "cost_anomaly", "report_feedback", {
      anomaly_id: "anom-42",
      feedback: "FALSE_ANOMALY",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "PUT",
      path: "/ccm/api/anomaly/feedback",
      params: {
        anomalyId: "anom-42",
        feedback: "FALSE_ANOMALY",
      },
      body: {},
    }));
  });
});

describe("cost_anomaly_drilldown routing", () => {
  let registry: Registry;
  let mockRequest: ReturnType<typeof vi.fn>;
  let client: HarnessClient;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { id: "anom-1" } });
    client = makeClient(mockRequest);
  });

  it("get without time bounds uses drill-down details endpoint", async () => {
    await registry.dispatch(client, "cost_anomaly_drilldown", "get", {
      anomaly_id: "anom-1",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      path: "/ccm/api/anomaly/v2/drill-down",
      params: { anomalyId: "anom-1" },
    }));
  });

  it("get with start_time and end_time routes to cost time-series endpoint", async () => {
    await registry.dispatch(client, "cost_anomaly_drilldown", "get", {
      anomaly_id: "anom-1",
      start_time: 1_700_000_000_000,
      end_time: 1_700_086_400_000,
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      path: "/ccm/api/anomaly/v2/drill-down/cost/time-series",
      params: {
        anomalyId: "anom-1",
        startTime: 1_700_000_000_000,
        endTime: 1_700_086_400_000,
      },
    }));
  });

  it("list drill-down sub-items uses drill-down list endpoint", async () => {
    mockRequest.mockResolvedValue({ data: [{ resource: "i-abc" }] });

    const result = await registry.dispatch(client, "cost_anomaly_drilldown", "list", {
      anomaly_id: "anom-1",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      path: "/ccm/api/anomaly/v2/drill-down/list",
      params: { anomalyId: "anom-1" },
    }));
    expect(result).toEqual({
      items: [{ resource: "i-abc" }],
      total: 1,
    });
  });
});

describe("cost_anomaly_summary get", () => {
  it("posts to summary endpoint with optional min thresholds", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { count: 3, costImpact: 500 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "cost_anomaly_summary", "get", {
      min_amount: 100,
      min_anomalous_spend: 25,
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/ccm/api/anomaly/v2/summary",
      body: {
        anomalyFilterPropertiesDTO: {
          filterType: "Anomaly",
          minActualAmount: 100,
          minAnomalousSpend: 25,
        },
      },
    }));
  });
});
