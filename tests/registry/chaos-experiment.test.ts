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
    expect(call.path).toBe("/chaos/manager/api/rest/v2/experiment");
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
    expect(call.path).toBe("/chaos/manager/api/rest/v2/experiments/exp-pod-delete");
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
    expect(call.path).toBe("/chaos/manager/api/rest/v2/probes/probe-http-check/enable");
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

  it("list: extracts infras array and totalNoOfInfrastructures from response", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      infras: [
        { infraID: "k8s-1", name: "prod-cluster" },
      ],
      pagination: { page: 0, limit: 15 },
      totalNoOfInfrastructures: 1,
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_k8s_infrastructure", "list", {
      project_id: "PM_Signoff",
      org_id: "default",
    })) as { items: unknown[]; total: number };

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/infrastructures");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "PM_Signoff",
    });
    expect(call.body).toBeDefined();
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("list: sends status and infra_type in body filter, not as query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      infras: [{ infraID: "k8s-2", name: "dev-cluster" }],
      totalNoOfInfrastructures: 1,
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_k8s_infrastructure", "list", {
      project_id: "ChaosDev1",
      org_id: "default",
      environment_id: "demoash",
      status: "ACTIVE",
      infra_type: "KubernetesV2",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.environmentIdentifier).toBe("demoash");
    expect(call.params.status).toBeUndefined();
    expect(call.params.infraType).toBeUndefined();
    expect(call.body.filter).toMatchObject({
      status: "ACTIVE",
      infraTypeFilter: "KubernetesV2",
    });
  });

  it("list: sends empty body (no filter) when no status or infra_type provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      infras: [],
      totalNoOfInfrastructures: 0,
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_k8s_infrastructure", "list", {
      project_id: "ChaosDev1",
      org_id: "default",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.filter).toBeUndefined();
    expect(call.params?.status).toBeUndefined();
  });

  it("list: maps size to limit and search_term to search query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      infras: [{ infraID: "k8s-3", name: "staging-cluster" }],
      totalNoOfInfrastructures: 1,
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_k8s_infrastructure", "list", {
      project_id: "ChaosDev1",
      org_id: "default",
      size: 10,
      search_term: "staging",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.limit).toBe(10);
    expect(call.params.search).toBe("staging");
  });

  it("check_health: uses correct path with infraId before /health", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ connected: true });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_k8s_infrastructure", "check_health", {
      infra_id: "infra-abc",
      project_id: "ChaosDev1",
      org_id: "default",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/rest/kubernetes/infra/infra-abc/health");
  });
});

describe("chaos_hub list", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: builds correct path with chaos scope params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      items: [
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
    expect(call.path).toBe("/chaos/manager/api/rest/hubs");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "PM_Signoff",
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});

describe("chaos_experiment_template create_from_template", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create_from_template: builds body from params (top-level input fields)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experimentID: "new-exp", identity: "demo-exp-01" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment_template", "create_from_template", {
      template_id: "demotemplate01",
      hub_identity: "amit-hub0e4",
      name: "demo-exp-01",
      identity: "demo-exp-01",
      environment_id: "demoash",
      infra_id: "gcpootbprobe",
      import_type: "LOCAL",
      project_id: "ChaosDev1",
      org_id: "default",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/experimenttemplates/demotemplate01/launch");
    expect(call.params.hubIdentity).toBe("amit-hub0e4");
    expect(call.body.name).toBe("demo-exp-01");
    expect(call.body.identity).toBe("demo-exp-01");
    expect(call.body.infraRef).toBe("demoash/gcpootbprobe");
    expect(call.body.importType).toBe("LOCAL");
    expect(call.body.hub_identity).toBeUndefined();
  });

  it("create_from_template: builds body from nested input.body (LLM uses body arg)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experimentID: "new-exp" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment_template", "create_from_template", {
      template_id: "demotemplate01",
      hub_identity: "amit-hub0e4",
      project_id: "ChaosDev1",
      org_id: "default",
      body: {
        name: "demo-exp-02",
        identity: "demo-exp-02",
        environment_id: "demoash",
        infra_id: "gcpootbprobe",
        import_type: "LOCAL",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.name).toBe("demo-exp-02");
    expect(call.body.identity).toBe("demo-exp-02");
    expect(call.body.infraRef).toBe("demoash/gcpootbprobe");
    expect(call.body.importType).toBe("LOCAL");
    expect(call.params.hubIdentity).toBe("amit-hub0e4");
  });

  it("create_from_template: hub_identity goes to query params, not body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experimentID: "new-exp" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment_template", "create_from_template", {
      template_id: "tmpl1",
      hub_identity: "my-hub",
      name: "exp1",
      identity: "exp1",
      infra_ref: "env1/infra1",
      import_type: "REFERENCE",
      project_id: "proj1",
      org_id: "default",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.hubIdentity).toBe("my-hub");
    expect(call.body.hubIdentity).toBeUndefined();
    expect(call.body.hub_identity).toBeUndefined();
  });
});

describe("chaos_probe_template list pagination and defaults", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: maps size param to limit query param for pagination", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [{ identity: "t1", name: "Template 1" }],
      pagination: { totalItems: 14 },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe_template", "list", {
      project_id: "PM_Signoff",
      org_id: "default",
      size: 3,
      page: 1,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.limit).toBe(3);
    expect(call.params.page).toBe(1);
  });

  it("list: includes includeAllScope=false by default", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [],
      pagination: { totalItems: 0 },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe_template", "list", {
      project_id: "PM_Signoff",
      org_id: "default",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.includeAllScope).toBe("false");
  });

  it("list: allows overriding includeAllScope to false", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [],
      pagination: { totalItems: 0 },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe_template", "list", {
      project_id: "PM_Signoff",
      org_id: "default",
      include_all_scope: false,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.includeAllScope).toBe(false);
  });
});
