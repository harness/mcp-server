/**
 * Verifies chaos_experiment list and get: request shape and response extraction.
 * Chaos API uses organizationIdentifier (not orgIdentifier) and returns
 * { data, pagination } for list, raw object for get.
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
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("chaos_experiment list/get", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: builds correct path and scope params (organizationIdentifier, projectIdentifier)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [
        {
          experimentID: "exp-1",
          name: "pod-delete",
          description: "Pod delete chaos",
        },
      ],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_experiment", "list", {
      project_id: "PM_Signoff",
      org_id: "default",
      page: 0,
      limit: 20,
    })) as { items: unknown[]; total: number };

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gateway/chaos/manager/api/rest/v2/experiment");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "PM_Signoff",
      page: 0,
      limit: 20,
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect((result.items[0] as Record<string, unknown>).name).toBe("pod-delete");
    expect((result.items[0] as Record<string, unknown>).experimentID).toBe("exp-1");
  });

  it("list: returns items and total from chaos paginated response", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [
        { experimentID: "a", name: "Exp A" },
        { experimentID: "b", name: "Exp B" },
      ],
      pagination: { totalItems: 2 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_experiment", "list", {
      project_id: "proj1",
    })) as { items: unknown[]; total: number };

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect((result.items[0] as Record<string, unknown>).experimentID).toBe("a");
    expect((result.items[1] as Record<string, unknown>).name).toBe("Exp B");
  });

  it("get: builds correct path with experimentId and returns passthrough data", async () => {
    const experimentPayload = {
      experimentID: "exp-pod-delete",
      name: "pod-delete",
      description: "Deletes target pod",
      workflowManifest: "apiVersion: litmuschaos.io/...",
    };
    const mockRequest = vi.fn().mockResolvedValue(experimentPayload);
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_experiment", "get", {
      experiment_id: "exp-pod-delete",
      project_id: "proj1",
      org_id: "default",
    })) as Record<string, unknown>;

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gateway/chaos/manager/api/rest/v2/experiments/exp-pod-delete");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "proj1",
    });
    expect(result.experimentID).toBe("exp-pod-delete");
    expect(result.name).toBe("pod-delete");
    expect(result.workflowManifest).toBeDefined();
  });

  it("get: uses org and project when provided in input", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experimentID: "e1", name: "E1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_experiment", "get", {
      org_id: "default",
      project_id: "test-project",
      experiment_id: "e1",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.organizationIdentifier).toBe("default");
    expect(call.params.projectIdentifier).toBe("test-project");
  });
});

describe("chaos_probe enable execute action", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("enable: uses corrected path with static segment before param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ success: true });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_probe", "enable", {
      probe_id: "probe-http-check",
      project_id: "PM_Signoff",
      org_id: "default",
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gateway/chaos/manager/api/rest/v2/probes/enable/probe-http-check");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "PM_Signoff",
    });
  });
});

describe("chaos_k8s_infrastructure list", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: uses POST to v2/infrastructures with chaos scope params and paginated response", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [
        { infraID: "k8s-1", name: "prod-cluster" },
      ],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_k8s_infrastructure", "list", {
      project_id: "PM_Signoff",
      org_id: "default",
    })) as { items: unknown[]; total: number };

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gateway/chaos/manager/api/rest/v2/infrastructures");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "PM_Signoff",
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});

describe("chaos_hub list", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: builds correct path with chaos scope params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [
        { hubID: "enterprise-hub", name: "Enterprise ChaosHub" },
      ],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_hub", "list", {
      project_id: "PM_Signoff",
      org_id: "default",
    })) as { items: unknown[]; total: number };

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gateway/chaos/manager/api/rest/hubs");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "PM_Signoff",
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
