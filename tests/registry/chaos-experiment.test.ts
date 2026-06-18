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

  it("list: per-item openInHarness uses the experiment UUID (not name) and the chaos-studio route", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [
        { experimentID: "91351b37-56da-426c-aee9-668ccf329023", name: "test-conditions" },
      ],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_experiment", "list", {
      project_id: "templatescopetest",
      org_id: "templatescopetest",
    })) as { items: Array<Record<string, unknown>> };

    expect(result.items[0].openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/module/chaos/orgs/templatescopetest/projects/templatescopetest/experiments/91351b37-56da-426c-aee9-668ccf329023/chaos-studio",
    );
  });

  it("chaos_experiment_run get: openInHarness points to the experiment runs page", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experimentID: "exp-1", name: "pod-delete" });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_experiment_run", "get", {
      experiment_id: "exp-1",
      project_id: "templatescopetest",
      org_id: "templatescopetest",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/module/chaos/orgs/templatescopetest/projects/templatescopetest/experiments/exp-1/runs",
    );
  });

  it("chaos_input_set list: per-item openInHarness uses the parent experiment id (not the item name)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [{ identity: "is-1", name: "Set A" }],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_input_set", "list", {
      experiment_id: "exp-1",
      project_id: "templatescopetest",
      org_id: "templatescopetest",
    })) as { items: Array<Record<string, unknown>> };

    expect(result.items[0].openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/module/chaos/orgs/templatescopetest/projects/templatescopetest/experiments/exp-1/inputsets",
    );
  });

  it("chaos_experiment_variable list: items carry no openInHarness (no deep link)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      experiment: [{ name: "DURATION", value: "60" }],
      tasks: null,
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_experiment_variable", "list", {
      experiment_id: "exp-1",
      project_id: "templatescopetest",
      org_id: "templatescopetest",
    })) as { items: Array<Record<string, unknown>> };

    for (const item of result.items) {
      expect(item.openInHarness).toBeUndefined();
    }
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

describe("chaos_experiment create", () => {
  // Locks the bodySchema <-> bodyBuilder contract:
  //   - bodySchema marks `id` optional, so omitting it must NOT trip required-field validation
  //   - bodyBuilder must auto-generate a v4 UUID when `id` is missing
  //   - caller-supplied `id` must round-trip untouched
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create: auto-generates a v4 UUID for id when caller omits it", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experimentID: "new-exp" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_experiment", "create", {
      org_id: "default",
      project_id: "test-project",
      name: "demo-exp-01",
      manifest: "apiVersion: litmuschaos.io/v1alpha1\nkind: ChaosEngine",
      infra_id: "demo/infra-1",
      infra_type: "Kubernetes",
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/experiment");
    expect(call.body.id).toMatch(UUID_V4);
    expect(call.body.name).toBe("demo-exp-01");
    expect(call.body.infraId).toBe("demo/infra-1");
    expect(call.body.infra_id).toBe("demo/infra-1");
    expect(call.body.infraType).toBe("Kubernetes");
  });

  it("create: echoes caller-supplied id without overwriting it", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experimentID: "new-exp" });
    const client = makeClient(mockRequest);
    const callerId = "11111111-2222-4333-8444-555555555555";

    await registry.dispatch(client, "chaos_experiment", "create", {
      org_id: "default",
      project_id: "test-project",
      id: callerId,
      name: "demo-exp-02",
      manifest: "apiVersion: litmuschaos.io/v1alpha1\nkind: ChaosEngine",
      infra_id: "demo/infra-2",
      infra_type: "Kubernetes",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.id).toBe(callerId);
  });

  it("create: documented contract — composite infra_id '{environmentIdentifier}/{infraID}' passes through verbatim", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experimentID: "exp-composite" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_experiment", "create", {
      org_id: "default",
      project_id: "test-project",
      name: "demo-exp-composite",
      manifest: "apiVersion: litmuschaos.io/v1alpha1\nkind: ChaosEngine",
      infra_id: "demo/qaauto1",
      infra_type: "Kubernetes",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.infraId).toBe("demo/qaauto1");
    expect(call.body.infra_id).toBe("demo/qaauto1");
  });
});

describe("chaos_action create", () => {
  let registry: Registry;
  beforeEach(() => { registry = new Registry(makeConfig()); });

  it("create: builds the delay-action body matching the verified curl", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "deplay-action-01", name: "deplay-action-01", type: "delay" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_action", "create", {
      org_id: "templatescopetest",
      project_id: "templatescopetest",
      identity: "deplay-action-01",
      name: "deplay-action-01",
      description: "optional desc",
      tags: ["op:tag1", "op:tag2"],
      infrastructure_type: "Kubernetes",
      type: "delay",
      variables: [{ name: "variable_1", type: "String", value: "10", description: "variable1 desc" }],
      action_properties: { delayAction: { duration: "5s" } },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/actions");
    expect(call.body).toMatchObject({
      identity: "deplay-action-01",
      name: "deplay-action-01",
      description: "optional desc",
      tags: ["op:tag1", "op:tag2"],
      infrastructureType: "Kubernetes",
      type: "delay",
      variables: [{ name: "variable_1", type: "String", value: "10", description: "variable1 desc" }],
      actionProperties: { delayAction: { duration: "5s" } },
      inputs: [],
    });
  });

  it("create: identity defaults to name when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_action", "create", {
      org_id: "default", project_id: "p",
      name: "my-delay", type: "delay", infrastructure_type: "Linux",
      action_properties: { delayAction: { duration: "5s" } },
    });
    expect(mockRequest.mock.calls[0][0].body.identity).toBe("my-delay");
  });

  it("create: duration shorthand builds delayAction when action_properties omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_action", "create", {
      org_id: "default", project_id: "p",
      name: "d", type: "delay", infrastructure_type: "Kubernetes", duration: "30s",
    });
    expect(mockRequest.mock.calls[0][0].body.actionProperties).toEqual({ delayAction: { duration: "30s" } });
  });

  it("create: accepts Windows and Linux infra for a delay action", async () => {
    for (const infra of ["Windows", "Linux"]) {
      const mockRequest = vi.fn().mockResolvedValue({});
      const client = makeClient(mockRequest);
      await registry.dispatch(client, "chaos_action", "create", {
        org_id: "default", project_id: "p",
        name: "d", type: "delay", infrastructure_type: infra,
        action_properties: { delayAction: { duration: "5s" } },
      });
      expect(mockRequest.mock.calls[0][0].body.infrastructureType).toBe(infra);
    }
  });

  it("create: builds the customScript-action body matching the verified curl", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "custom-script-action-8s3", name: "new-custom-script-action-8s3", type: "customScript" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_action", "create", {
      org_id: "templatescopetest", project_id: "templatescopetest",
      identity: "custom-script-action-8s3",
      name: "new-custom-script-action-8s3",
      description: "optional desc",
      tags: ["op:tag1", "op:tag2"],
      infrastructure_type: "Kubernetes",
      type: "customScript",
      variables: [{ name: "randomVar1", type: "String", value: "10", required: true }],
      action_properties: { customScriptAction: { command: "/bin/sh", args: ["-c", "while true; do echo hello; sleep 10;done"], env: [{ name: "HELLO", value: "WORLD" }] } },
      run_properties: { maxRetries: 1, initialDelay: "5s", interval: "2s", timeout: "10s", iterations: 1 },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/actions");
    expect(call.body).toMatchObject({
      identity: "custom-script-action-8s3",
      name: "new-custom-script-action-8s3",
      description: "optional desc",
      tags: ["op:tag1", "op:tag2"],
      infrastructureType: "Kubernetes",
      type: "customScript",
      variables: [{ name: "randomVar1", type: "String", value: "10", required: true }],
      actionProperties: { customScriptAction: { command: "/bin/sh", args: ["-c", "while true; do echo hello; sleep 10;done"], env: [{ name: "HELLO", value: "WORLD" }] } },
      runProperties: { maxRetries: 1, initialDelay: "5s", interval: "2s", timeout: "10s", iterations: 1 },
      inputs: [],
    });
  });

  it("create: builds the container-action body (Kubernetes; command array + args string)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "container-action-zia", name: "new-container-action-zia", type: "container" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_action", "create", {
      org_id: "templatescopetest", project_id: "templatescopetest",
      identity: "container-action-zia",
      name: "new-container-action-zia",
      infrastructure_type: "Kubernetes",
      type: "container",
      action_properties: { containerAction: {
        image: "bitnami/kubectl:latest",
        command: ["/bin/sh", "-c"],
        args: 'echo "Hello World"',
        env: [{ name: "Hello_Variable1", value: "World_Ans2" }],
        namespace: "some",
        imagePullPolicy: "IfNotPresent",
      } },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/actions");
    expect(call.body).toMatchObject({
      identity: "container-action-zia",
      name: "new-container-action-zia",
      infrastructureType: "Kubernetes",
      type: "container",
      actionProperties: { containerAction: {
        image: "bitnami/kubectl:latest",
        command: ["/bin/sh", "-c"],
        args: 'echo "Hello World"',
        env: [{ name: "Hello_Variable1", value: "World_Ans2" }],
        namespace: "some",
        imagePullPolicy: "IfNotPresent",
      } },
      inputs: [],
    });
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

describe("chaos_enabled_infrastructure list", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: targets the chaos-enabled endpoint and extracts infras/total", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      infras: [{ infraID: "k8s-1", name: "prod-cluster", status: "ACTIVE", isChaosEnabled: true }],
      pagination: { page: 0, limit: 15 },
      totalNoOfInfrastructures: 1,
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_enabled_infrastructure", "list", {
      project_id: "PM_Signoff",
      org_id: "default",
    })) as { items: unknown[]; total: number };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/infrastructures/chaos-enabled");
    expect(call.params).toMatchObject({ organizationIdentifier: "default", projectIdentifier: "PM_Signoff" });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("list: uppercases infra_type, sends infra_scope/is_ai_enabled in body, env as query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ infras: [], totalNoOfInfrastructures: 0 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_enabled_infrastructure", "list", {
      project_id: "ChaosDev1",
      org_id: "default",
      environment_id: "demoash",
      infra_type: "KubernetesV2",
      infra_scope: "CLUSTER",
      is_ai_enabled: false,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.environmentIdentifier).toBe("demoash");
    expect(call.params.infraType).toBeUndefined();
    expect(call.body.filter).toMatchObject({
      infraTypeFilter: "KUBERNETESV2",
      infraScope: "CLUSTER",
      isAIEnabled: false,
    });
  });

  it("list: sends empty body when no filters provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ infras: [], totalNoOfInfrastructures: 0 });
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_enabled_infrastructure", "list", {
      project_id: "ChaosDev1",
      org_id: "default",
    });
    expect(mockRequest.mock.calls[0][0].body.filter).toBeUndefined();
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

describe("chaos_experiment isIdentity routing", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("run: defaults isIdentity=true so a slug experiment_id works", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experimentRunId: "run-1" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment", "run", {
      experiment_id: "exp-without-runtime",
      project_id: "templatescopetest",
      org_id: "templatescopetest",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/experiments/exp-without-runtime/run");
    expect(call.params.isIdentity).toBe("true");
  });

  it("run: is_identity=false override forces UUID lookup", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experimentRunId: "run-1" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment", "run", {
      experiment_id: "ef9199b6-0248-4c0b-9d63-9176bf2b7123",
      is_identity: false,
      project_id: "templatescopetest",
      org_id: "templatescopetest",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.isIdentity).toBe(false);
  });

  it("variables list: defaults isIdentity=true so a slug experiment_id works", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experiment: [], tasks: {} });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_experiment_variable", "list", {
      experiment_id: "exp-without-runtime",
      project_id: "templatescopetest",
      org_id: "templatescopetest",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/experiments/exp-without-runtime/variables");
    expect(call.params.isIdentity).toBe("true");
  });

  it("variables list: null experiment/tasks returns empty items (no schema error)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ experiment: null, tasks: null });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "chaos_experiment_variable", "list", {
      experiment_id: "ef9199b6-0248-4c0b-9d63-9176bf2b7123",
      is_identity: false,
      project_id: "templatescopetest",
      org_id: "templatescopetest",
    }) as { items: unknown[]; total: number };

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("input_set list: defaults isIdentity=false so UUID is the default lookup", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_input_set", "list", {
      experiment_id: "ef9199b6-0248-4c0b-9d63-9176bf2b7123",
      project_id: "templatescopetest",
      org_id: "templatescopetest",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/experiments/ef9199b6-0248-4c0b-9d63-9176bf2b7123/inputsets");
    expect(call.params.isIdentity).toBe("false");
  });

  it("input_set list: is_identity=true override passes slug to backend", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_input_set", "list", {
      experiment_id: "exp-without-runtime",
      is_identity: true,
      project_id: "templatescopetest",
      org_id: "templatescopetest",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.isIdentity).toBe(true);
    expect(call.path).toBe("/chaos/manager/api/rest/v2/experiments/exp-without-runtime/inputsets");
  });

  it("input_set list: is_identity=false with UUID passes false to backend", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_input_set", "list", {
      experiment_id: "ef9199b6-0248-4c0b-9d63-9176bf2b7123",
      is_identity: false,
      project_id: "templatescopetest",
      org_id: "templatescopetest",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.isIdentity).toBe(false);
  });
});

describe("chaos_experiment.run bodyBuilder — runtime_inputs handling", () => {
  let registry: Registry;
  beforeEach(() => { registry = new Registry(makeConfig()); });

  it("run: merges runtime_inputs with experiment_variables instead of overwriting (A1)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment", "run", {
      experiment_id: "exp1",
      project_id: "proj1",
      org_id: "org1",
      runtime_inputs: { experiment: [{ name: "REGION", value: "us-east-1" }] },
      experiment_variables: [{ name: "DURATION", value: "60s" }],
    });

    const call = mockRequest.mock.calls[0][0];
    const expArr = (call.body.runtimeInputs as { experiment: Array<{ name: string; value: unknown }> }).experiment;
    expect(expArr).toEqual(
      expect.arrayContaining([
        { name: "REGION", value: "us-east-1" },
        { name: "DURATION", value: "60s" },
      ]),
    );
    expect(expArr).toHaveLength(2);
  });

  it("run: top-level experiment_variables wins on name conflict with runtime_inputs (A1)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment", "run", {
      experiment_id: "exp1",
      project_id: "proj1",
      org_id: "org1",
      runtime_inputs: { experiment: [{ name: "REGION", value: "us-east-1" }] },
      experiment_variables: [{ name: "REGION", value: "eu-west-1" }],
    });

    const call = mockRequest.mock.calls[0][0];
    const expArr = (call.body.runtimeInputs as { experiment: Array<{ name: string; value: unknown }> }).experiment;
    expect(expArr).toEqual([{ name: "REGION", value: "eu-west-1" }]);
  });

  it("run: unwraps input.body via coerceBody so body={runtime_inputs:...} flows through (A2)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment", "run", {
      experiment_id: "exp1",
      project_id: "proj1",
      org_id: "org1",
      body: { runtime_inputs: { experiment: [{ name: "REGION", value: "us-east-1" }] } },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.runtimeInputs).toEqual({
      experiment: [{ name: "REGION", value: "us-east-1" }],
    });
  });

  it("run: throws via coerceBody when body is malformed JSON (A2)", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "chaos_experiment", "run", {
        experiment_id: "exp1",
        project_id: "proj1",
        org_id: "org1",
        body: "{",
      }),
    ).rejects.toThrow(/Invalid JSON in 'body'/);

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("run: hoists is_identity from body so URL gets ?isIdentity=false (Call 2/3 regression)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment", "run", {
      experiment_id: "ef9199b6-0248-4c0b-9d63-9176bf2b7123",
      project_id: "proj1",
      org_id: "org1",
      body: { is_identity: false, inputset_identity: "testinputset" },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.isIdentity).toBe(false);
    expect(call.body.inputsetIdentity).toBe("testinputset");
  });

  it("run: top-level is_identity wins over body.is_identity on conflict", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment", "run", {
      experiment_id: "ef9199b6-0248-4c0b-9d63-9176bf2b7123",
      project_id: "proj1",
      org_id: "org1",
      is_identity: false,
      body: { is_identity: true },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.isIdentity).toBe(false);
  });
});

describe("chaos_application_map.get required field validation (preflight)", () => {
  let registry: Registry;
  beforeEach(() => { registry = new Registry(makeConfig()); });

  it("get: throws locally when 'environment_id' is missing", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);
    await expect(
      registry.dispatch(client, "chaos_application_map", "get", {
        project_id: "proj1",
        org_id: "org1",
        map_id: "some-map-id",
        infra_id: "some-infra",
      }),
    ).rejects.toThrow(/Missing required field.*environment_id/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("get: throws locally when 'infra_id' is missing", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);
    await expect(
      registry.dispatch(client, "chaos_application_map", "get", {
        project_id: "proj1",
        org_id: "org1",
        map_id: "some-map-id",
        environment_id: "demo",
      }),
    ).rejects.toThrow(/Missing required field.*infra_id/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("get: throws locally when both 'environment_id' and 'infra_id' are missing", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);
    await expect(
      registry.dispatch(client, "chaos_application_map", "get", {
        project_id: "proj1",
        org_id: "org1",
        map_id: "some-map-id",
      }),
    ).rejects.toThrow(/environment_id.*infra_id|infra_id.*environment_id/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("get: proceeds and sends both query params when required fields are present", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "map1", services: [] });
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_application_map", "get", {
      project_id: "proj1",
      org_id: "org1",
      map_id: "some-map-id",
      environment_id: "demo",
      infra_id: "qaauto1",
    });
    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/applicationmaps/some-map-id");
    expect(call.params).toMatchObject({ environmentIdentifier: "demo", infraId: "qaauto1" });
  });
});
