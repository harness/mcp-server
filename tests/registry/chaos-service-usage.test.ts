/**
 * Verifies chaos_service_usage: list + 4 read-only execute actions.
 *
 * These endpoints are account-scoped and take the account ID inline in the
 * URL path (not as a query param). Time-window query params (start_time,
 * end_time) are mandatory and map to startTime/endTime on the wire.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { chaosServiceUsageExtract } from "../../src/registry/extractors.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "DSzI0EehTMqGVdfsfG3a5g",
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

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "DSzI0EehTMqGVdfsfG3a5g",
  } as unknown as HarnessClient;
}

const START = 1760985000412;
const END = 1779215399412;

describe("chaos_service_usage list", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: injects account ID into the path from config, not as query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      serviceData: [{ serviceID: "svc-1", service: "payments", type: "Kubernetes" }],
      serviceTypes: ["Kubernetes", "Linux"],
      total: 1,
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_service_usage", "list", {
      start_time: START,
      end_time: END,
      page: 0,
      limit: 10,
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/rest/service/DSzI0EehTMqGVdfsfG3a5g");
  });

  it("list: maps start_time/end_time/service/service_type to wire param names", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      serviceData: [],
      serviceTypes: [],
      total: 0,
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_service_usage", "list", {
      start_time: START,
      end_time: END,
      service: "payments",
      service_type: "Kubernetes",
      sort_field: "experiments",
      sort_ascending: true,
      page: 0,
      limit: 10,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params).toMatchObject({
      startTime: START,
      endTime: END,
      service: "payments",
      serviceType: "Kubernetes",
      sortField: "experiments",
      sortAscending: true,
      page: 0,
      limit: 10,
    });
  });

  it("list: does not inject orgIdentifier or projectIdentifier (account-scoped)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      serviceData: [],
      serviceTypes: [],
      total: 0,
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_service_usage", "list", {
      start_time: START,
      end_time: END,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.organizationIdentifier).toBeUndefined();
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("list: extracts serviceData, total, and serviceTypes into normalised shape", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      serviceData: [
        { serviceID: "svc-1", service: "payments" },
        { serviceID: "svc-2", service: "checkout" },
      ],
      serviceTypes: ["Kubernetes", "Linux", "Others"],
      total: 2,
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_service_usage", "list", {
      start_time: START,
      end_time: END,
    })) as { items: unknown[]; total: number; serviceTypes: string[] };

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.serviceTypes).toEqual(["Kubernetes", "Linux", "Others"]);
    expect((result.items[0] as Record<string, unknown>).service).toBe("payments");
  });

  it("list: throws if required start_time/end_time filters are missing", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "chaos_service_usage", "list", {}),
    ).rejects.toThrow(/start_time.*end_time|end_time.*start_time/);
  });
});

describe("chaos_service_usage execute actions", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("get_stats: builds /service/stats/<account> path and forwards group_by/start_time/end_time/cumulative", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      accountID: "DSzI0EehTMqGVdfsfG3a5g",
      periodicStats: [],
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_service_usage", "get_stats", {
      start_time: START,
      end_time: END,
      group_by: "day",
      cumulative: false,
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/rest/service/stats/DSzI0EehTMqGVdfsfG3a5g");
    expect(call.params).toMatchObject({
      startTime: START,
      endTime: END,
      groupBy: "day",
      cumulative: false,
    });
    expect(call.params.organizationIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("get_overall_stats: builds /service/overall/stats/<account> path with only start_time/end_time", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      accountID: "DSzI0EehTMqGVdfsfG3a5g",
      totalUsage: 12.5,
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_service_usage", "get_overall_stats", {
      start_time: START,
      end_time: END,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/rest/service/overall/stats/DSzI0EehTMqGVdfsfG3a5g");
    expect(call.params.startTime).toBe(START);
    expect(call.params.endTime).toBe(END);
    expect(call.params.groupBy).toBeUndefined();
  });

  it("get_csv_report: builds /service/report/<account> path and returns rows passthrough", async () => {
    const rows = [["service", "experiments"], ["payments", "5"]];
    const mockRequest = vi.fn().mockResolvedValue(rows);
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "chaos_service_usage", "get_csv_report", {
      start_time: START,
      end_time: END,
      cumulative: true,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/rest/service/report/DSzI0EehTMqGVdfsfG3a5g");
    expect(call.params.cumulative).toBe(true);
    expect(result).toEqual(rows);
  });

  it("get_experimentation_csv_report: builds /service/experimentation/report/<account> path", async () => {
    const rows = [["month", "activeServices"], ["2026-04", "12"]];
    const mockRequest = vi.fn().mockResolvedValue(rows);
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "chaos_service_usage", "get_experimentation_csv_report", {
      start_time: START,
      end_time: END,
      cumulative: false,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/rest/service/experimentation/report/DSzI0EehTMqGVdfsfG3a5g");
    expect(call.params.cumulative).toBe(false);
    expect(result).toEqual(rows);
  });
});

describe("chaosServiceUsageExtract", () => {
  it("normalises { serviceData, serviceTypes, total } to { items, total, serviceTypes }", () => {
    const out = chaosServiceUsageExtract({
      serviceData: [{ serviceID: "a" }, { serviceID: "b" }],
      serviceTypes: ["Kubernetes"],
      total: 2,
    });

    expect(out).toEqual({
      items: [{ serviceID: "a" }, { serviceID: "b" }],
      total: 2,
      serviceTypes: ["Kubernetes"],
    });
  });

  it("falls back to length when total is missing and defaults serviceTypes to []", () => {
    const out = chaosServiceUsageExtract({
      serviceData: [{ serviceID: "a" }],
    });

    expect(out).toEqual({
      items: [{ serviceID: "a" }],
      total: 1,
      serviceTypes: [],
    });
  });

  it("returns empty defaults for a completely empty response", () => {
    const out = chaosServiceUsageExtract({});
    expect(out).toEqual({ items: [], total: 0, serviceTypes: [] });
  });
});
