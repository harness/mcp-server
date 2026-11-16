import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { registerGetTool } from "../../src/tools/harness-get.js";
import { registerExecuteTool } from "../../src/tools/harness-execute.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";

function makeConfig(): Config {
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
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer() {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: "accept" }),
    },
    registerTool: vi.fn((name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      return tool.handler(args, {
        signal: new AbortController().signal,
        sendNotification: vi.fn(),
        _meta: {},
      });
    },
  } as any;
}

const scope = { org_id: "default", project_id: "chaos-proj" };

describe("chaos operation paths", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it.each([
    ["chaos_experiment", "list", false, { ...scope }, "GET", "/chaos/manager/api/v3/experiments"],
    ["chaos_k8s_infrastructure", "get_manifest", true, { ...scope, infra_id: "infra-1" }, "GET", "/chaos/manager/api/rest/kubernetes/infra/manifest/infra-1"],
    ["chaos_k8s_infrastructure", "helm_command", true, { ...scope, infra_id: "infra-1" }, "GET", "/chaos/manager/api/rest/kubernetes/infra/helm-command/infra-1"],
    ["chaos_infrastructure", "get", false, { ...scope, infra_id: "machine-1" }, "GET", "/chaos/manager/api/rest/machine/infra/machine-1"],
    ["chaos_infrastructure", "delete", false, { ...scope, infra_id: "machine-1" }, "DELETE", "/chaos/manager/api/rest/machine/infra/machine-1"],
    ["chaos_k8s_infrastructure", "delete", false, { ...scope, environment_id: "env-1", infra_id: "infra-1" }, "DELETE", "/chaos/manager/api/rest/v2/infrastructure/env-1/infra-1"],
    ["chaos_application_map", "delete", false, { ...scope, map_id: "map-1", environment_id: "env-1", infra_id: "infra-1" }, "DELETE", "/chaos/manager/api/rest/v2/applicationmaps/map-1"],
    ["chaos_risk", "list", false, { ...scope }, "GET", "/chaos/manager/api/v3/risks"],
    ["chaos_risk", "get", false, { ...scope, risk_id: "risk-1" }, "GET", "/chaos/manager/api/v3/risks/risk-1"],
  ])("%s %s -> %s %s", async (resourceType, action, execute, input, method, path) => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    if (execute) {
      await registry.dispatchExecute(client, resourceType, action, input);
    } else {
      await registry.dispatch(client, resourceType, action, input);
    }
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe(method);
    expect(call.path).toBe(path);
  });

  it("create posts the v3 experiment body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: { identity: "exp" } });
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_experiment", "create", {
      ...scope,
      body: {
        name: "Exp",
        identity: "exp",
        manifest: "{}",
        infra_type: "KubernetesV2",
        infra_id: "env/infra",
      },
    });
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/v3/experiments");
    expect(call.body).toMatchObject({ name: "Exp", identity: "exp", infraType: "KubernetesV2", infraId: "env/infra" });
  });

  it("experiment template create requires manifest and hub_identity", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_experiment_template", "create", { ...scope, body: {} }),
    ).rejects.toThrow(/manifest/);

    const mockRequest = vi.fn().mockResolvedValue({});
    await registry.dispatch(makeClient(mockRequest), "chaos_experiment_template", "create", {
      ...scope,
      hub_identity: "hub",
      body: { manifest: "{}" },
    });
    expect(mockRequest.mock.calls[0][0].body).toEqual({ manifest: "{}" });
    expect(mockRequest.mock.calls[0][0].params.hubIdentity).toBe("hub");
  });

  it("fault, probe, and action template creates use their write paths", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    const cases = [
      ["chaos_fault_template", "/chaos/manager/api/rest/faulttemplates", { type: "pod-delete", infra_type: "Kubernetes", spec: { chaos: { faultName: "pod-delete", params: [] } } }],
      ["chaos_probe_template", "/chaos/manager/api/rest/templates/probes", { type: "httpProbe", infrastructure_type: "Kubernetes", probe_properties: { httpProbe: { url: "https://example.com/health", method: { get: { criteria: "==", responseCode: "200" } } } } }],
      ["chaos_action_template", "/chaos/manager/api/rest/templates/actions", { type: "delay", infrastructure_type: "Kubernetes", action_properties: { delayAction: { duration: "1s" } } }],
    ] as const;
    for (const [resourceType, path, extra] of cases) {
      mockRequest.mockClear();
      await registry.dispatch(client, resourceType, "create", {
        ...scope,
        hub_identity: "hub",
        body: { name: "n", identity: "id", hub_identity: "hub", ...extra },
      });
      expect(mockRequest.mock.calls[0][0].method).toBe("POST");
      expect(mockRequest.mock.calls[0][0].path).toBe(path);
      expect(mockRequest.mock.calls[0][0].params.hubIdentity).toBe("hub");
      expect(mockRequest.mock.calls[0][0].body).not.toHaveProperty("hub_identity");
    }
  });

  it("action update uses PUT /rest/actions/{identity}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_action", "update", {
      ...scope,
      action_id: "delay-1",
      body: { name: "Delay", type: "delay", infrastructure_type: "Kubernetes" },
    });
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/chaos/manager/api/rest/actions/delay-1");
    expect(call.body).toEqual({ name: "Delay", type: "delay", infrastructureType: "Kubernetes" });
  });

  it("k8s yaml and update use the v2 infrastructure paths", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatchExecute(client, "chaos_k8s_infrastructure", "get_yaml", {
      ...scope,
      body: { identity: "infra-1", environment_id: "env", infra_namespace: "hce", service_account: "litmus" },
    });
    expect(mockRequest.mock.calls[0][0].path).toBe("/chaos/manager/api/rest/v2/infrastructure/yaml");
    expect(mockRequest.mock.calls[0][0].body).toEqual({
      identity: "infra-1",
      environmentID: "env",
      infraNamespace: "hce",
      serviceAccount: "litmus",
    });

    await registry.dispatch(client, "chaos_k8s_infrastructure", "update", {
      ...scope,
      body: { identity: "infra-1", name: "Infra", environment_id: "env", infra_namespace: "hce", service_account: "litmus" },
    });
    expect(mockRequest.mock.calls[1][0].method).toBe("PUT");
    expect(mockRequest.mock.calls[1][0].path).toBe("/chaos/manager/api/rest/v2/infrastructure");
    expect(mockRequest.mock.calls[1][0].body).toEqual({
      identity: "infra-1",
      name: "Infra",
      environmentID: "env",
      infraNamespace: "hce",
      serviceAccount: "litmus",
    });
  });

  it("guard rule rejects a time window that only has time_zone", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_guard_rule", "create", {
        ...scope,
        body: {
          rule_id: "r1",
          name: "Rule",
          user_group_ids: ["ug-1"],
          condition_ids: ["c1"],
          time_windows: [{ time_zone: "UTC", recurrence: { type: "Daily" } }],
        },
      }),
    ).rejects.toThrow(/startTime/);
  });

  it("guard rule rewrites time_zone and start_time", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_guard_rule", "create", {
      ...scope,
      body: {
        rule_id: "r1",
        name: "Rule",
        user_group_ids: ["ug-1"],
        condition_ids: ["c1"],
        time_windows: [{ time_zone: "UTC", start_time: 1_700_000_000_000, recurrence: { type: "Daily" } }],
      },
    });
    expect(mockRequest.mock.calls[0][0].body.timeWindows).toEqual([
      { timeZone: "UTC", startTime: 1_700_000_000_000, recurrence: { type: "Daily" } },
    ]);
  });

  it("guard rule sends timeZone and startTime", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_guard_rule", "create", {
      ...scope,
      body: {
        rule_id: "r1",
        name: "Rule",
        user_group_ids: ["ug-1"],
        condition_ids: ["c1"],
        time_windows: [{ timeZone: "UTC", startTime: 1_700_000_000_000, recurrence: { type: "Daily" } }],
      },
    });
    expect(mockRequest.mock.calls[0][0].body.timeWindows).toEqual([
      { timeZone: "UTC", startTime: 1_700_000_000_000, recurrence: { type: "Daily" } },
    ]);
  });

  it("guard condition create rejects a missing fault_spec", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_guard_condition", "create", {
        ...scope,
        body: { condition_id: "c1", name: "C", infra_type: "Kubernetes" },
      }),
    ).rejects.toThrow(/fault_spec/);
  });

  it("onboarding create uses the v2 session and stats uses v3", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_onboarding", "create", { ...scope, body: { environment_id: "env" } }),
    ).rejects.toThrow(/infrastructureRef/);
    await expect(
      registry.dispatch(client, "chaos_onboarding", "create", {
        ...scope,
        body: { infrastructureRef: "infra", mode: "Automatic" },
      }),
    ).rejects.toThrow(/environmentRef/);

    const mockRequest = vi.fn().mockResolvedValue({ onboardingID: "ob-1" });
    await registry.dispatch(makeClient(mockRequest), "chaos_onboarding", "create", {
      ...scope,
      body: { environment_id: "env", infra_id: "infra", mode: "Automatic" },
    });
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/onboarding");
    expect(call.body).toMatchObject({ environmentRef: "env", infrastructureRef: "infra", mode: "Automatic" });

    mockRequest.mockClear();
    await registry.dispatchExecute(makeClient(mockRequest), "chaos_onboarding", "stats", scope);
    expect(mockRequest.mock.calls[0][0].method).toBe("GET");
    expect(mockRequest.mock.calls[0][0].path).toBe("/chaos/manager/api/v3/onboarding-stats");
  });

  it("maps resource_id to onboarding and pipeline-onboarding paths", async () => {
    const config = makeConfig();
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    const server = makeMcpServer();
    registerGetTool(server, registry, client);
    registerExecuteTool(server, registry, client, config);

    await server.call("harness_get", {
      resource_type: "chaos_onboarding",
      resource_id: "ob-1",
      ...scope,
    });
    expect(mockRequest.mock.calls[0][0].path).toBe("/chaos/manager/api/rest/v2/onboarding/ob-1");

    await server.call("harness_execute", {
      resource_type: "chaos_onboarding",
      resource_id: "ob-1",
      action: "confirm_discovery",
      ...scope,
    });
    expect(mockRequest.mock.calls[1][0].path).toBe("/chaos/manager/api/rest/v2/onboarding-confirm-discovery/ob-1");
    expect(mockRequest.mock.calls[1][0].body).toBeUndefined();

    await server.call("harness_get", {
      resource_type: "chaos_pipeline_onboarding",
      resource_id: "pipe-1",
      ...scope,
    });
    expect(mockRequest.mock.calls[2][0].path).toBe("/chaos/manager/api/rest/pipeline-onboarding/pipe-1/status");

    await server.call("harness_execute", {
      resource_type: "chaos_pipeline_onboarding",
      resource_id: "pipe-1",
      action: "can_onboard",
      ...scope,
    });
    expect(mockRequest.mock.calls[3][0].path).toBe("/chaos/manager/api/rest/pipeline-onboarding/pipe-1/can-onboard-chaos");
  });

  it("guard lists read conditions and rules, not data", async () => {
    const conditionRequest = vi.fn().mockResolvedValue({
      data: [{ conditionId: "from-data" }],
      conditions: [{ conditionId: "c1", name: "C" }],
      pagination: { totalItems: 1 },
    });
    const conditions = (await registry.dispatch(makeClient(conditionRequest), "chaos_guard_condition", "list", scope)) as {
      items: Array<{ conditionId: string }>;
      total: number;
    };
    expect(conditions.items).toEqual([{ conditionId: "c1", name: "C" }]);
    expect(conditions.total).toBe(1);

    const ruleRequest = vi.fn().mockResolvedValue({
      rules: [{ ruleId: "r1", name: "R" }],
      pagination: { totalItems: 2 },
    });
    const rules = (await registry.dispatch(makeClient(ruleRequest), "chaos_guard_rule", "list", scope)) as {
      items: Array<{ ruleId: string }>;
      total: number;
    };
    expect(rules.items).toEqual([{ ruleId: "r1", name: "R" }]);
    expect(rules.total).toBe(2);
  });

  it("guard condition rewrites infra_ids and requires k8s_spec for Kubernetes", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_guard_condition", "create", {
        ...scope,
        body: {
          condition_id: "c1",
          name: "C",
          infra_type: "Kubernetes",
          fault_spec: { operator: "EQUAL_TO", faults: [{ faultType: "FAULT_NAME", name: "pod-delete" }] },
        },
      }),
    ).rejects.toThrow(/k8s_spec is required/);

    const mockRequest = vi.fn().mockResolvedValue({});
    await registry.dispatch(makeClient(mockRequest), "chaos_guard_condition", "create", {
      ...scope,
      body: {
        condition_id: "c1",
        name: "C",
        infra_type: "Kubernetes",
        fault_spec: { operator: "EQUAL_TO", faults: [{ faultType: "FAULT_NAME", name: "pod-delete" }] },
        k8s_spec: { infra_spec: { operator: "EQUAL_TO", infra_ids: ["env/infra"] } },
      },
    });
    expect(mockRequest.mock.calls[0][0].body.k8sSpec).toEqual({
      infraSpec: { operator: "EQUAL_TO", infraIds: ["env/infra"] },
    });
  });

  it("machine infra treats the string false as load testing off", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_infrastructure", "update", {
      ...scope,
      infra_id: "infra-1",
      body: { name: "Infra", load_enabled: "false" },
    });
    expect(mockRequest.mock.calls[0][0].body.loadEnabled).toBe(false);
    expect(mockRequest.mock.calls[0][0].body).not.toHaveProperty("infra_id");

    mockRequest.mockClear();
    await registry.dispatch(client, "chaos_infrastructure", "create", {
      ...scope,
      body: { name: "Infra", environment_id: "env", load_enabled: "false" },
    });
    expect(mockRequest.mock.calls[0][0].body.loadEnabled).toBe(false);
    expect(mockRequest.mock.calls[0][0].body).not.toHaveProperty("environment_id");
  });

  it("probe template rejects a flat probe_properties map and sends httpProbe", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_probe_template", "create", {
        ...scope,
        hub_identity: "hub",
        body: {
          name: "n",
          identity: "id",
          type: "httpProbe",
          infrastructure_type: "Kubernetes",
          probe_properties: { probeTimeout: "5s" },
        },
      }),
    ).rejects.toThrow(/httpProbe/);

    const mockRequest = vi.fn().mockResolvedValue({});
    const httpProbe = { url: "https://example.com/health", method: { get: { criteria: "==", responseCode: "200" } } };
    await registry.dispatch(makeClient(mockRequest), "chaos_probe_template", "create", {
      ...scope,
      hub_identity: "hub",
      body: {
        name: "n",
        identity: "id",
        type: "httpProbe",
        infrastructure_type: "Kubernetes",
        probe_properties: { httpProbe },
      },
    });
    expect(mockRequest.mock.calls[0][0].body.probeProperties).toEqual({ httpProbe });
  });

  it("fault template rejects a ChaosGuard-shaped spec", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_fault_template", "create", {
        ...scope,
        hub_identity: "hub",
        body: {
          name: "n",
          identity: "id",
          type: "pod-delete",
          infra_type: "Kubernetes",
          spec: { faults: [] },
        },
      }),
    ).rejects.toThrow(/faultName/);
  });
});
