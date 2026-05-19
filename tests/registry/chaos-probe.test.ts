/**
 * Verifies chaos_probe `create`: request shape, scope params, and body
 * pass-through for probeProperties / runProperties (httpProbe Phase 1).
 *
 * The Harness REST API is POST /chaos/manager/api/rest/v2/probes with
 * organizationIdentifier + projectIdentifier query params and a body
 * shaped as types.ProbeRequest (with probeProperties.<typeKey> as the
 * type-specific block).
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

describe("chaos_probe create", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create: POSTs to /rest/v2/probes with chaos scope params (organizationIdentifier, projectIdentifier)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      probeId: "priyanshu-http-probe-1",
      name: "priyanshu-http-probe-1",
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "priyanshu-http-probe-1",
      name: "priyanshu-http-probe-1",
      type: "httpProbe",
      infrastructure_type: "Kubernetes",
      project_id: "templatescopetest",
      org_id: "templatescopetest",
      probe_properties: {
        httpProbe: {
          url: "https://www.google.com",
          method: { get: { criteria: "==", responseCode: "200" } },
        },
      },
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/probes");
    expect(call.params).toMatchObject({
      organizationIdentifier: "templatescopetest",
      projectIdentifier: "templatescopetest",
    });
  });

  it("create: full httpProbe payload matches the Harness CURL body shape (probeId, name, type, infrastructureType, probeProperties.httpProbe, runProperties, variables, inputs)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      probeId: "priyanshu-http-probe-1",
      name: "priyanshu-http-probe-1",
    });
    const client = makeClient(mockRequest);

    const variables = [
      { name: "var1", type: "String", value: "<+input>", required: false, description: "example variable: set value at runtime" },
      { name: "var2", type: "Number", value: "<+input>", description: "example number: set at runtime" },
      { name: "var3", type: "String", value: "<+input>", required: true, description: "var required + set at runtime" },
      { name: "var4", type: "String", value: "1", required: true, description: "fixed value " },
    ];

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "priyanshu-http-probe-1",
      name: "priyanshu-http-probe-1",
      description: "ops desc",
      tags: ["op:tag"],
      infrastructure_type: "Kubernetes",
      type: "httpProbe",
      project_id: "templatescopetest",
      org_id: "templatescopetest",
      variables,
      probe_properties: {
        httpProbe: {
          auth: { type: "Bearer", credentials: "token" },
          headers: [{ key: "app", value: "key" }],
          method: { get: { criteria: "==", responseCode: "200" } },
          tlsConfig: { caFile: "ca", certFile: "cert", keyFile: "key", insecureSkipVerify: true },
          url: "https://www.google.com",
        },
      },
      run_properties: {
        attempt: 1,
        initialDelay: "5s",
        interval: "2s",
        pollingInterval: "30s",
        stopOnFailure: true,
        timeout: "10s",
        verbosity: "info",
      },
      inputs: [],
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/probes");

    // Top-level envelope (snake_case → camelCase). Per the chaos_experiment.create
    // convention, the body emits BOTH camelCase (Harness API) AND snake_case
    // duplicates for the validator-required fields (probe_id, infrastructure_type,
    // probe_properties). Go's BindJSON silently ignores the unknown snake_case keys.
    expect(call.body.probeId).toBe("priyanshu-http-probe-1");
    expect(call.body.probe_id).toBe("priyanshu-http-probe-1");
    expect(call.body.name).toBe("priyanshu-http-probe-1");
    expect(call.body.description).toBe("ops desc");
    expect(call.body.tags).toEqual(["op:tag"]);
    expect(call.body.type).toBe("httpProbe");
    expect(call.body.infrastructureType).toBe("Kubernetes");
    expect(call.body.infrastructure_type).toBe("Kubernetes");

    // run_properties has no snake_case duplicate — only required fields do.
    expect(call.body.run_properties).toBeUndefined();

    // Pass-through nested probeProperties.httpProbe (with snake_case duplicate).
    const expectedProbeProps = {
      httpProbe: {
        auth: { type: "Bearer", credentials: "token" },
        headers: [{ key: "app", value: "key" }],
        method: { get: { criteria: "==", responseCode: "200" } },
        tlsConfig: { caFile: "ca", certFile: "cert", keyFile: "key", insecureSkipVerify: true },
        url: "https://www.google.com",
      },
    };
    expect(call.body.probeProperties).toEqual(expectedProbeProps);
    expect(call.body.probe_properties).toEqual(expectedProbeProps);

    // Pass-through runProperties
    expect(call.body.runProperties).toEqual({
      attempt: 1,
      initialDelay: "5s",
      interval: "2s",
      pollingInterval: "30s",
      stopOnFailure: true,
      timeout: "10s",
      verbosity: "info",
    });

    // Variables/inputs forwarded as-is
    expect(call.body.variables).toEqual(variables);
    expect(call.body.inputs).toEqual([]);
  });

  it("create: accepts camelCase top-level aliases (probeId, infrastructureType, probeProperties, runProperties, isEnabled)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "p1", name: "p1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe", "create", {
      probeId: "p1",
      name: "p1",
      type: "httpProbe",
      infrastructureType: "Kubernetes",
      isEnabled: false,
      project_id: "proj1",
      org_id: "org1",
      probeProperties: {
        httpProbe: {
          url: "https://example.com",
          method: { get: { criteria: "==", responseCode: "200" } },
        },
      },
      runProperties: { timeout: "10s", interval: "2s", attempt: 1 },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.probeId).toBe("p1");
    expect(call.body.infrastructureType).toBe("Kubernetes");
    expect(call.body.isEnabled).toBe(false);
    expect(call.body.probeProperties).toMatchObject({ httpProbe: { url: "https://example.com" } });
    expect(call.body.runProperties).toMatchObject({ timeout: "10s" });
  });

  it("create: defaults infrastructureType to Kubernetes and type to httpProbe when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "p2", name: "p2" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "p2",
      name: "p2",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: {
        httpProbe: {
          url: "https://example.com",
          method: { get: { criteria: "==", responseCode: "200" } },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.type).toBe("httpProbe");
    expect(call.body.infrastructureType).toBe("Kubernetes");
  });

  it("create: tags accepts comma-separated string and splits into an array", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "p3", name: "p3" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "p3",
      name: "p3",
      type: "httpProbe",
      infrastructure_type: "Kubernetes",
      project_id: "proj1",
      org_id: "org1",
      tags: "team:platform, env:dev,  owner:alice ",
      probe_properties: {
        httpProbe: {
          url: "https://example.com",
          method: { get: { criteria: "==", responseCode: "200" } },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.tags).toEqual(["team:platform", "env:dev", "owner:alice"]);
  });

  it("create: name defaults to probe_id when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "auto-name", name: "auto-name" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "auto-name",
      type: "httpProbe",
      infrastructure_type: "Kubernetes",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: {
        httpProbe: {
          url: "https://example.com",
          method: { get: { criteria: "==", responseCode: "200" } },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.name).toBe("auto-name");
  });

  it("create: also accepts double-serialized JSON via body string (LLM coerceBody fallback)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "from-body", name: "from-body" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe", "create", {
      project_id: "proj1",
      org_id: "org1",
      body: JSON.stringify({
        probe_id: "from-body",
        name: "from-body",
        type: "httpProbe",
        infrastructure_type: "Kubernetes",
        probe_properties: {
          httpProbe: {
            url: "https://example.com",
            method: { get: { criteria: "==", responseCode: "200" } },
          },
        },
      }),
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.probeId).toBe("from-body");
    expect(call.body.type).toBe("httpProbe");
    expect(call.body.probeProperties).toMatchObject({ httpProbe: { url: "https://example.com" } });
  });
});
