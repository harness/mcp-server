/**
 * Verifies chaos_service list filters and the list_experiment_runs /
 * list_load_tests execute actions against the v3 chaos-services REST surface
 * (/chaos/manager/api/v3/chaos-services), per hce-saas
 * graphql/server/handlers/chaosservices/v3/*.go.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
    account: "test-account",
  } as unknown as HarnessClient;
}

// ── list ──────────────────────────────────────────────────────────────
describe("chaos_service list", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("maps probe_ids and onboarding_id to probeIds / onboardingId query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_service", "list", {
      org_id: "o",
      project_id: "p",
      probe_ids: "probe-1,probe-2",
      onboarding_id: "batch-1",
    });
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/chaos-services");
    expect(call.params.probeIds).toBe("probe-1,probe-2");
    expect(call.params.onboardingId).toBe("batch-1");
  });

  it("still maps the existing filters (environment_ids, infrastructure_ids, tags, include_all_scope)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_service", "list", {
      org_id: "o",
      project_id: "p",
      environment_ids: "env-1",
      infrastructure_ids: "infra-1",
      tags: "a,b",
      include_all_scope: true,
      search: "svc",
      sort_field: "name",
      sort_ascending: true,
      limit: 25,
      page: 2,
    });
    const params = mockRequest.mock.calls[0][0].params;
    expect(params.environmentIds).toBe("env-1");
    expect(params.infrastructureIds).toBe("infra-1");
    expect(params.tags).toBe("a,b");
    expect(params.includeAllScope).toBe(true);
    expect(params.search).toBe("svc");
    expect(params.sortField).toBe("name");
    expect(params.sortAscending).toBe(true);
    expect(params.limit).toBe(25);
    expect(params.page).toBe(2);
  });
});

// ── list_experiment_runs execute action ─────────────────────────────────
describe("chaos_service execute: list_experiment_runs", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("GETs /v3/chaos-services/{identity}/experiment-runs with the identity path-substituted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], correlationID: "c-1", pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);
    await registry.dispatchExecute(client, "chaos_service", "list_experiment_runs", {
      identity: "svc-1",
      org_id: "o",
      project_id: "p",
    });
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/chaos-services/svc-1/experiment-runs");
  });

  it("maps page/limit/search/sort/include_all_scope/infra_ids/statuses/step_types query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);
    await registry.dispatchExecute(client, "chaos_service", "list_experiment_runs", {
      identity: "svc-1",
      org_id: "o",
      project_id: "p",
      page: 1,
      limit: 10,
      search: "run",
      sort_field: "lastUpdated",
      sort_ascending: false,
      include_all_scope: true,
      infra_ids: "infra-1,infra-2",
      statuses: "Completed,Running",
      step_types: "PodDelete",
    });
    const params = mockRequest.mock.calls[0][0].params;
    expect(params.page).toBe(1);
    expect(params.limit).toBe(10);
    expect(params.search).toBe("run");
    expect(params.sortField).toBe("lastUpdated");
    expect(params.sortAscending).toBe(false);
    expect(params.includeAllScope).toBe(true);
    expect(params.infraIds).toBe("infra-1,infra-2");
    expect(params.statuses).toBe("Completed,Running");
    expect(params.stepTypes).toBe("PodDelete");
  });

  it("passes the raw { data, pagination } envelope through unchanged", async () => {
    const backendResponse = {
      data: [{ experimentRunID: "run-1", experimentName: "exp-1", phase: "Completed" }],
      correlationID: "c-1",
      pagination: { totalItems: 1 },
    };
    const mockRequest = vi.fn().mockResolvedValue(backendResponse);
    const client = makeClient(mockRequest);
    const result = await registry.dispatchExecute(client, "chaos_service", "list_experiment_runs", {
      identity: "svc-1",
      org_id: "o",
      project_id: "p",
    });
    expect(result).toEqual(backendResponse);
  });
});

// ── list_load_tests execute action ──────────────────────────────────────
describe("chaos_service execute: list_load_tests", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("GETs /v3/chaos-services/{identity}/load-tests with the identity path-substituted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], correlationID: "c-1", pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);
    await registry.dispatchExecute(client, "chaos_service", "list_load_tests", {
      identity: "svc-1",
      org_id: "o",
      project_id: "p",
    });
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/chaos-services/svc-1/load-tests");
  });

  it("maps tool_type/environment_ids/infra_ids/tags query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);
    await registry.dispatchExecute(client, "chaos_service", "list_load_tests", {
      identity: "svc-1",
      org_id: "o",
      project_id: "p",
      tool_type: "K6",
      environment_ids: "env-1",
      infra_ids: "infra-1",
      tags: "a,b",
      include_all_scope: true,
    });
    const params = mockRequest.mock.calls[0][0].params;
    expect(params.toolType).toBe("K6");
    expect(params.environmentIds).toBe("env-1");
    expect(params.infraIds).toBe("infra-1");
    expect(params.tags).toBe("a,b");
    expect(params.includeAllScope).toBe(true);
  });

  it("passes the raw { data, pagination } envelope through unchanged", async () => {
    const backendResponse = {
      data: [{ identity: "lt-1", name: "load-test-1", toolType: "Locust" }],
      correlationID: "c-1",
      pagination: { totalItems: 1 },
    };
    const mockRequest = vi.fn().mockResolvedValue(backendResponse);
    const client = makeClient(mockRequest);
    const result = await registry.dispatchExecute(client, "chaos_service", "list_load_tests", {
      identity: "svc-1",
      org_id: "o",
      project_id: "p",
    });
    expect(result).toEqual(backendResponse);
  });
});
