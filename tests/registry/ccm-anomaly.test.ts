/**
 * Tests for CCM cost anomaly v2 list and drilldown resources (PR #533).
 * Guards bodyBuilder mapping, pathBuilder routing, skipCompact, and v2 endpoints.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

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

function findResource(type: string): ResourceDefinition {
  const res = ccmToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in ccmToolset`);
  return res;
}

function getListSpec(type: string): EndpointSpec {
  const spec = findResource(type).operations.list;
  if (!spec) throw new Error(`${type}.list spec missing`);
  return spec;
}

function getGetSpec(type: string): EndpointSpec {
  const spec = findResource(type).operations.get;
  if (!spec) throw new Error(`${type}.get spec missing`);
  return spec;
}

describe("cost_anomaly v2 list bodyBuilder", () => {
  const buildBody = getListSpec("cost_anomaly").bodyBuilder!;

  it("maps defaults to v2 anomalyFilterPropertiesDTO shape", () => {
    const body = buildBody({});
    const filters = (body as { anomalyFilterPropertiesDTO: Record<string, unknown> })
      .anomalyFilterPropertiesDTO;

    expect(filters.filterType).toBe("Anomaly");
    expect(filters.limit).toBe(10);
    expect(filters.offset).toBe(0);
    expect(filters.anomalyView).toBe("RESOURCE");
    expect(filters.groupBy).toEqual([]);
    expect(filters.searchText).toEqual([""]);
    expect(filters.orderBy).toEqual([{ field: "ANOMALOUS_SPEND", order: "DESCENDING" }]);
    expect(filters.timeFilters).toBeDefined();
    expect(Array.isArray(filters.timeFilters)).toBe(true);
    expect((filters.timeFilters as unknown[]).length).toBeGreaterThan(0);
  });

  it("maps explicit filters including zero-valued min_amount", () => {
    const body = buildBody({
      perspective_id: "persp-1",
      status: "ACTIVE",
      anomaly_view: "PERSPECTIVE",
      search_text: "ec2",
      start_time: 1_700_000_000_000,
      end_time: 1_700_086_400_000,
      order_by_field: "TIME",
      order_by_direction: "ASCENDING",
      min_amount: 0,
      min_anomalous_spend: 100,
      limit: 25,
      offset: 5,
    });
    const filters = (body as { anomalyFilterPropertiesDTO: Record<string, unknown> })
      .anomalyFilterPropertiesDTO;

    expect(filters.anomalyView).toBe("PERSPECTIVE");
    expect(filters.searchText).toEqual(["ec2"]);
    expect(filters.status).toEqual(["ACTIVE"]);
    expect(filters.minActualAmount).toBe(0);
    expect(filters.minAnomalousSpend).toBe(100);
    expect(filters.limit).toBe(25);
    expect(filters.offset).toBe(5);
    expect(filters.orderBy).toEqual([{ field: "TIME", order: "ASCENDING" }]);
    expect(filters.timeFilters).toEqual([
      { operator: "AFTER", timestamp: 1_700_000_000_000 },
      { operator: "BEFORE", timestamp: 1_700_086_400_000 },
    ]);
  });

  it("wraps scalar status and search_text into arrays", () => {
    const body = buildBody({ status: ["IGNORED", "RESOLVED"], search_text: ["rds", "s3"] });
    const filters = (body as { anomalyFilterPropertiesDTO: Record<string, unknown> })
      .anomalyFilterPropertiesDTO;

    expect(filters.status).toEqual(["IGNORED", "RESOLVED"]);
    expect(filters.searchText).toEqual(["rds", "s3"]);
  });
});

describe("cost_anomaly v2 list endpoint contract", () => {
  it("uses v2 list path with skipCompact and anomalyListExtract", () => {
    const spec = getListSpec("cost_anomaly");
    expect(spec.method).toBe("POST");
    expect(spec.path).toBe("/ccm/api/anomaly/v2/list");
    expect(spec.skipCompact).toBe(true);
    expect(spec.operationPolicy?.risk).toBe("read");
    expect(spec.queryParams).toHaveProperty("perspective_id", "perspectiveId");
    expect(spec.responseExtractor?.name).toBe("anomalyListExtract");
  });
});

describe("cost_anomaly_drilldown routing", () => {
  it("get pathBuilder routes to details vs time-series endpoints", () => {
    const pathBuilder = getGetSpec("cost_anomaly_drilldown").pathBuilder!;

    expect(pathBuilder({ anomaly_id: "anom-1" }, {})).toBe("/ccm/api/anomaly/v2/drill-down");
    expect(
      pathBuilder({ anomaly_id: "anom-1", start_time: 100, end_time: 200 }, {}),
    ).toBe("/ccm/api/anomaly/v2/drill-down/cost/time-series");
  });

  it("list uses drill-down list path with skipCompact", () => {
    const spec = getListSpec("cost_anomaly_drilldown");
    expect(spec.method).toBe("GET");
    expect(spec.path).toBe("/ccm/api/anomaly/v2/drill-down/list");
    expect(spec.skipCompact).toBe(true);
    expect(spec.queryParams).toHaveProperty("anomaly_id", "anomalyId");
    expect(spec.responseExtractor?.name).toBe("anomalyListExtract");
  });
});

describe("cost_anomaly registry dispatch", () => {
  const FIXED_NOW = new Date("2026-05-21T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts v2 list body and sets __skipCompact on array-shaped response", async () => {
    const rawResponse = {
      data: [{ anomalyId: "a1", anomalousSpend: 250, resourceName: "i-abc" }],
    };
    const requestSpy = vi.fn().mockResolvedValue(rawResponse);
    const client = makeClient(requestSpy);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));

    const result = (await registry.dispatch(client, "cost_anomaly", "list", {
      perspective_id: "persp-1",
      status: "ACTIVE",
      time_filter: "LAST_7",
      min_anomalous_spend: 50,
    })) as Record<string, unknown> & { items: unknown[]; __skipCompact?: boolean };

    expect(requestSpy).toHaveBeenCalledTimes(1);
    const call = requestSpy.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
      body: { anomalyFilterPropertiesDTO: Record<string, unknown> };
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ccm/api/anomaly/v2/list");
    expect(call.params.perspectiveId).toBe("persp-1");

    const filters = call.body.anomalyFilterPropertiesDTO;
    expect(filters.status).toEqual(["ACTIVE"]);
    expect(filters.minAnomalousSpend).toBe(50);
    expect(filters.timeFilters).toBeDefined();

    expect(result.items).toEqual(rawResponse.data);
    expect(result.total).toBe(1);
    expect(result.__skipCompact).toBe(true);
  });

  it("drilldown get dispatches to details endpoint without time range", async () => {
    const requestSpy = vi.fn().mockResolvedValue({ data: { anomalyId: "a1" } });
    const client = makeClient(requestSpy);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));

    await registry.dispatch(client, "cost_anomaly_drilldown", "get", {
      anomaly_id: "a1",
    });

    const call = requestSpy.mock.calls[0]![0] as { method: string; path: string; params: Record<string, unknown> };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ccm/api/anomaly/v2/drill-down");
    expect(call.params.anomalyId).toBe("a1");
  });

  it("drilldown list returns sub-items with skipCompact marker", async () => {
    const rawResponse = {
      data: [{ resourceName: "s3-bucket", spend: 120 }],
    };
    const requestSpy = vi.fn().mockResolvedValue(rawResponse);
    const client = makeClient(requestSpy);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));

    const result = (await registry.dispatch(client, "cost_anomaly_drilldown", "list", {
      anomaly_id: "a1",
    })) as Record<string, unknown> & { items: unknown[]; __skipCompact?: boolean };

    const call = requestSpy.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(call.path).toBe("/ccm/api/anomaly/v2/drill-down/list");
    expect(call.params.anomalyId).toBe("a1");
    expect(result.items).toEqual(rawResponse.data);
    expect(result.__skipCompact).toBe(true);
  });
});
