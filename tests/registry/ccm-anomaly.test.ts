/**
 * Regression tests for CCM cost anomaly v2 API wiring (#533):
 * - v2 list body builder (time filters, zero thresholds, ordering)
 * - anomalyListExtract + skipCompact round-trip
 * - drill-down path routing (details vs time-series vs sub-item list)
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
    HARNESS_TOOLSETS: "ccm",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({ data: [] }),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("cost_anomaly list — v2 API body builder", () => {
  let registry: Registry;
  let mockRequest: ReturnType<typeof vi.fn>;
  let client: HarnessClient;

  const FIXED_NOW = new Date("2026-05-21T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({ data: [{ id: "anom-1" }] });
    client = makeClient(mockRequest);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("POSTs to /ccm/api/anomaly/v2/list with v2 defaults", async () => {
    await registry.dispatch(client, "cost_anomaly", "list", {
      perspective_id: "persp-1",
    });

    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
      body: { anomalyFilterPropertiesDTO: Record<string, unknown> };
    };

    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ccm/api/anomaly/v2/list");
    expect(call.params.perspectiveId).toBe("persp-1");

    const filters = call.body.anomalyFilterPropertiesDTO;
    expect(filters.filterType).toBe("Anomaly");
    expect(filters.limit).toBe(10);
    expect(filters.offset).toBe(0);
    expect(filters.anomalyView).toBe("RESOURCE");
    expect(filters.searchText).toEqual([""]);
    expect(filters.orderBy).toEqual([{ field: "ANOMALOUS_SPEND", order: "DESCENDING" }]);
  });

  it("preserves min_amount 0 and min_anomalous_spend 0 using != null checks", async () => {
    await registry.dispatch(client, "cost_anomaly", "list", {
      min_amount: 0,
      min_anomalous_spend: 0,
    });

    const filters = (mockRequest.mock.calls[0]![0] as {
      body: { anomalyFilterPropertiesDTO: Record<string, unknown> };
    }).body.anomalyFilterPropertiesDTO;

    expect(filters.minActualAmount).toBe(0);
    expect(filters.minAnomalousSpend).toBe(0);
  });

  it("uses explicit start_time/end_time instead of predefined time_filter", async () => {
    await registry.dispatch(client, "cost_anomaly", "list", {
      start_time: 1_700_000_000_000,
      end_time: 1_700_086_400_000,
      time_filter: "LAST_7",
    });

    const filters = (mockRequest.mock.calls[0]![0] as {
      body: { anomalyFilterPropertiesDTO: { timeFilters: Array<{ operator: string; timestamp: number }> } };
    }).body.anomalyFilterPropertiesDTO;

    expect(filters.timeFilters).toEqual([
      { operator: "AFTER", timestamp: 1_700_000_000_000 },
      { operator: "BEFORE", timestamp: 1_700_086_400_000 },
    ]);
  });

  it("maps search_text, status, anomaly_view, and custom ordering", async () => {
    await registry.dispatch(client, "cost_anomaly", "list", {
      search_text: "ec2-prod",
      status: "ACTIVE",
      anomaly_view: "PERSPECTIVE",
      order_by_field: "TIME",
      order_by_direction: "ASCENDING",
      limit: 25,
      offset: 5,
    });

    const filters = (mockRequest.mock.calls[0]![0] as {
      body: { anomalyFilterPropertiesDTO: Record<string, unknown> };
    }).body.anomalyFilterPropertiesDTO;

    expect(filters.searchText).toEqual(["ec2-prod"]);
    expect(filters.status).toEqual(["ACTIVE"]);
    expect(filters.anomalyView).toBe("PERSPECTIVE");
    expect(filters.limit).toBe(25);
    expect(filters.offset).toBe(5);
    expect(filters.orderBy).toEqual([{ field: "TIME", order: "ASCENDING" }]);
  });

  it("returns skipCompact marker and projects anomalyListExtract shape", async () => {
    const result = (await registry.dispatch(client, "cost_anomaly", "list", {
      status: "ACTIVE",
    })) as Record<string, unknown> & { items: unknown[]; total: number };

    expect(result.__skipCompact).toBe(true);
    expect(result.items).toEqual([{ id: "anom-1" }]);
    expect(result.total).toBe(1);
  });
});

describe("cost_anomaly_drilldown — path routing", () => {
  let registry: Registry;
  let mockRequest: ReturnType<typeof vi.fn>;
  let client: HarnessClient;

  beforeEach(() => {
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({ data: [] });
    client = makeClient(mockRequest);
  });

  it("get without time range hits drill-down details endpoint", async () => {
    await registry.dispatch(client, "cost_anomaly_drilldown", "get", {
      anomaly_id: "anom-42",
    });

    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
    };

    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ccm/api/anomaly/v2/drill-down");
    expect(call.params.anomalyId).toBe("anom-42");
  });

  it("get with start_time and end_time hits cost time-series endpoint", async () => {
    await registry.dispatch(client, "cost_anomaly_drilldown", "get", {
      anomaly_id: "anom-42",
      start_time: 1_700_000_000_000,
      end_time: 1_700_086_400_000,
    });

    const call = mockRequest.mock.calls[0]![0] as {
      path: string;
      params: Record<string, unknown>;
    };

    expect(call.path).toBe("/ccm/api/anomaly/v2/drill-down/cost/time-series");
    expect(call.params.startTime).toBe(1_700_000_000_000);
    expect(call.params.endTime).toBe(1_700_086_400_000);
  });

  it("list hits drill-down sub-item endpoint with skipCompact projection", async () => {
    mockRequest.mockResolvedValue({ data: [{ resource: "i-abc" }] });

    const result = (await registry.dispatch(client, "cost_anomaly_drilldown", "list", {
      anomaly_id: "anom-42",
    })) as Record<string, unknown> & { items: unknown[]; total: number };

    const call = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };

    expect(call.path).toBe("/ccm/api/anomaly/v2/drill-down/list");
    expect(call.params.anomalyId).toBe("anom-42");
    expect(result.__skipCompact).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ resource: "i-abc" });
    expect(result.total).toBe(1);
  });
});
