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

describe("chaos_probe create — cmdProbe", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create: inline cmdProbe (no source) round-trips command + comparator + top-level env", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "inline-cmd", name: "inline-cmd" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "inline-cmd",
      name: "inline-cmd",
      type: "cmdProbe",
      infrastructure_type: "Kubernetes",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: {
        cmdProbe: {
          command: "kubectl get pods -n boutique --no-headers | wc -l",
          comparator: { type: "int", criteria: ">=", value: "3" },
          env: [{ name: "KUBECONFIG", value: "/root/.kube/config" }],
        },
      },
      run_properties: { timeout: "5s", interval: "2s", attempt: 3 },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/probes");
    expect(call.body.type).toBe("cmdProbe");
    expect(call.body.probeProperties).toEqual({
      cmdProbe: {
        command: "kubectl get pods -n boutique --no-headers | wc -l",
        comparator: { type: "int", criteria: ">=", value: "3" },
        env: [{ name: "KUBECONFIG", value: "/root/.kube/config" }],
      },
    });
    // No `source` key in the body when inline mode.
    expect((call.body.probeProperties as Record<string, Record<string, unknown>>).cmdProbe.source).toBeUndefined();
    expect(call.body.runProperties).toMatchObject({ timeout: "5s", interval: "2s", attempt: 3 });
  });

  it("create: source-mode cmdProbe round-trips full Pod-spec source object verbatim", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "sourced-cmd", name: "sourced-cmd" });
    const client = makeClient(mockRequest);

    const sourceSpec = {
      image: "postgres:16-alpine",
      command: ["sh", "-c"],
      args: ["psql -h db -U postgres -tA -c 'SELECT count(*) FROM orders'"],
      env: [
        {
          name: "PGPASSWORD",
          valueFrom: {
            secretKeyRef: { name: "db-creds", key: "password" },
          },
        },
      ],
      inheritInputs: true,
      hostNetwork: false,
      privileged: false,
      imagePullPolicy: "IfNotPresent",
      imagePullSecrets: [{ name: "regcred" }],
      nodeSelector: { "kubernetes.io/os": "linux" },
      tolerations: [{ key: "chaos", operator: "Equal", value: "true", effect: "NoSchedule" }],
      volumes: [{ name: "scripts", configMap: { name: "probe-scripts" } }],
      volumeMount: [{ name: "scripts", mountPath: "/scripts", readOnly: true }],
      labels: { app: "chaos-probe" },
      annotations: { "sidecar.istio.io/inject": "false" },
    };

    const sourceJsonString = JSON.stringify(sourceSpec);

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "sourced-cmd",
      name: "sourced-cmd",
      type: "cmdProbe",
      infrastructure_type: "Kubernetes",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: {
        cmdProbe: {
          command: "exec",
          comparator: { type: "int", criteria: ">=", value: "1" },
          source: sourceJsonString,
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.type).toBe("cmdProbe");
    // Wire format: source must travel as a JSON-encoded STRING (not an object).
    // Pass-through preserves the string verbatim.
    expect((call.body.probeProperties as Record<string, Record<string, unknown>>).cmdProbe.source).toBe(sourceJsonString);
    expect(typeof (call.body.probeProperties as Record<string, Record<string, unknown>>).cmdProbe.source).toBe("string");
  });

  it("create: cmdProbe accepts comparator.type=string with criteria=equal", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "redis-ping", name: "redis-ping" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "redis-ping",
      name: "redis-ping",
      type: "cmdProbe",
      infrastructure_type: "Kubernetes",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: {
        cmdProbe: {
          command: "redis-cli -h redis ping",
          comparator: { type: "string", criteria: "equal", value: "PONG" },
          source: '{"image":"redis:7-alpine"}',
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    const cmdProbe = (call.body.probeProperties as Record<string, Record<string, unknown>>).cmdProbe;
    expect(cmdProbe.command).toBe("redis-cli -h redis ping");
    expect(cmdProbe.comparator).toEqual({ type: "string", criteria: "equal", value: "PONG" });
    expect(cmdProbe.source).toBe('{"image":"redis:7-alpine"}');
  });
});

describe("chaos_probe create — promProbe", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create: inline-query promProbe round-trips endpoint + query + comparator + auth + tlsConfig", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "checkout-err-rate", name: "checkout-err-rate" });
    const client = makeClient(mockRequest);

    const promProbe = {
      endpoint: "http://prometheus-server.monitoring.svc:9090",
      query:
        'sum(rate(http_requests_total{status=~"5.."}[1m])) / sum(rate(http_requests_total[1m]))',
      comparator: { type: "float", criteria: "<", value: "0.05" },
      auth: { type: "Bearer", credentials: "<+secrets.getValue('promToken')>" },
      tlsConfig: { caFile: "ca.pem", certFile: "cert.pem", keyFile: "key.pem", insecureSkipVerify: false },
    };

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "checkout-err-rate",
      name: "checkout-err-rate",
      type: "promProbe",
      infrastructure_type: "Kubernetes",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: { promProbe },
      run_properties: {
        timeout: "10s",
        interval: "5s",
        attempt: 1,
        pollingInterval: "15s",
        initialDelay: "30s",
        stopOnFailure: false,
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/probes");
    expect(call.body.type).toBe("promProbe");
    expect(call.body.probeProperties).toEqual({ promProbe });
    // queryPath must NOT be synthesised when only query was supplied.
    expect(
      (call.body.probeProperties as Record<string, Record<string, unknown>>).promProbe.queryPath,
    ).toBeUndefined();
    expect(call.body.runProperties).toMatchObject({ timeout: "10s", pollingInterval: "15s" });
  });

  it("create: queryPath variant round-trips queryPath verbatim (no query key)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "prom-via-file", name: "prom-via-file" });
    const client = makeClient(mockRequest);

    const promProbe = {
      endpoint: "http://prometheus-server.monitoring.svc:9090",
      queryPath: "/etc/probes/checkout-err-rate.promql",
      comparator: { type: "float", criteria: ">=", value: "1" },
    };

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "prom-via-file",
      name: "prom-via-file",
      type: "promProbe",
      infrastructure_type: "Kubernetes",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: { promProbe },
    });

    const call = mockRequest.mock.calls[0][0];
    const out = (call.body.probeProperties as Record<string, Record<string, unknown>>).promProbe;
    expect(out.queryPath).toBe("/etc/probes/checkout-err-rate.promql");
    expect(out.query).toBeUndefined();
    expect(out.endpoint).toBe("http://prometheus-server.monitoring.svc:9090");
    expect(out.comparator).toEqual({ type: "float", criteria: ">=", value: "1" });
  });

  it("create: minimal promProbe (endpoint + query + comparator) does NOT synthesise optional keys", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "prom-min", name: "prom-min" });
    const client = makeClient(mockRequest);

    const promProbe = {
      endpoint: "http://prometheus-server.monitoring.svc:9090",
      query: "up{job=\"checkout\"}",
      comparator: { type: "float", criteria: "==", value: "1" },
    };

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "prom-min",
      name: "prom-min",
      type: "promProbe",
      infrastructure_type: "Kubernetes",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: { promProbe },
    });

    const call = mockRequest.mock.calls[0][0];
    const out = (call.body.probeProperties as Record<string, Record<string, unknown>>).promProbe;
    expect(out).toEqual(promProbe);
    expect(out.auth).toBeUndefined();
    expect(out.tlsConfig).toBeUndefined();
    expect(out.queryPath).toBeUndefined();
  });
});

describe("chaos_probe create — k8sProbe", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create: minimal k8sProbe round-trips required fields (version + resource + operation)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "k8s-min", name: "k8s-min" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "k8s-min",
      name: "k8s-min",
      type: "k8sProbe",
      infrastructure_type: "Kubernetes",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: {
        k8sProbe: {
          version: "v1",
          resource: "pods",
          operation: "present",
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/probes");
    expect(call.body.type).toBe("k8sProbe");
    expect(call.body.probeProperties).toEqual({
      k8sProbe: { version: "v1", resource: "pods", operation: "present" },
    });
    const out = (call.body.probeProperties as Record<string, Record<string, unknown>>).k8sProbe;
    // Optional selector fields must NOT be present unless the user supplied them.
    expect(out.group).toBeUndefined();
    expect(out.namespace).toBeUndefined();
    expect(out.fieldSelector).toBeUndefined();
    expect(out.labelSelector).toBeUndefined();
    expect(out.resourceNames).toBeUndefined();
  });

  it("create: full k8sProbe round-trips all 8 fields (3 required + 5 selectors) verbatim", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "k8s-full", name: "k8s-full" });
    const client = makeClient(mockRequest);

    const k8sSpec = {
      group: "apps",
      version: "v1",
      resource: "deployments",
      operation: "absent",
      namespace: "boutique",
      resourceNames: "checkout,payment",
      fieldSelector: "metadata.name=checkout",
      labelSelector: "app=checkout",
    };

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "k8s-full",
      name: "k8s-full",
      type: "k8sProbe",
      infrastructure_type: "Kubernetes",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: {
        k8sProbe: k8sSpec,
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.type).toBe("k8sProbe");
    // Pass-through must preserve every field byte-for-byte.
    expect((call.body.probeProperties as Record<string, Record<string, unknown>>).k8sProbe).toEqual(k8sSpec);
  });
});

describe("chaos_probe create — dynatraceProbe", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create: minimal dynatraceProbe round-trips required fields (endpoint + timeFrame + metrics + comparator)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "dt-min", name: "dt-min" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "dt-min",
      name: "dt-min",
      type: "dynatraceProbe",
      infrastructure_type: "Kubernetes",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: {
        dynatraceProbe: {
          endpoint: "https://abc.live.dynatrace.com",
          timeFrame: "now-1m",
          metrics: {
            metricsSelector: "builtin:host.cpu.usage",
            entitySelector: "type(HOST)",
          },
          comparator: { type: "float", criteria: "<", value: "80" },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/probes");
    expect(call.body.type).toBe("dynatraceProbe");
    const out = (call.body.probeProperties as Record<string, Record<string, unknown>>).dynatraceProbe;
    expect(out.endpoint).toBe("https://abc.live.dynatrace.com");
    expect(out.timeFrame).toBe("now-1m");
    expect(out.metrics).toEqual({
      metricsSelector: "builtin:host.cpu.usage",
      entitySelector: "type(HOST)",
    });
    expect(out.comparator).toEqual({ type: "float", criteria: "<", value: "80" });
    expect(out.apiTokenSecretName).toBeUndefined();
  });

  it("create: full dynatraceProbe round-trips all 5 top-level fields verbatim", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ probeId: "dt-full", name: "dt-full" });
    const client = makeClient(mockRequest);

    const dynatraceSpec = {
      endpoint: "https://abc.dynatrace-managed.com/e/env-id",
      timeFrame: "now-5m",
      apiTokenSecretName: "dynatrace-creds",
      metrics: {
        metricsSelector: "builtin:service.response.time:avg",
        entitySelector: "type(SERVICE),tag(\"env:prod\")",
      },
      comparator: { type: "float", criteria: "<=", value: "500" },
    };

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "dt-full",
      name: "dt-full",
      type: "dynatraceProbe",
      infrastructure_type: "Linux",
      project_id: "proj1",
      org_id: "org1",
      probe_properties: {
        dynatraceProbe: dynatraceSpec,
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.type).toBe("dynatraceProbe");
    expect(call.body.infrastructureType).toBe("Linux");
    expect((call.body.probeProperties as Record<string, Record<string, unknown>>).dynatraceProbe).toEqual(dynatraceSpec);
  });
});

describe("chaos_probe create — apmProbe (Prometheus)", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create: APM Prometheus payload matches the Harness CURL body shape (apmProbe.type=Prometheus, prometheusProbeInputs with connectorID + tlsConfig secret refs + query, runProperties)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      probeId: "new-apm-probedvdv",
      name: "new-apm-probedvdv",
    });
    const client = makeClient(mockRequest);

    const apmProbe = {
      comparator: { type: "float", criteria: "==", value: "90" },
      type: "Prometheus",
      prometheusProbeInputs: {
        query: "query",
        tlsConfig: {
          caCrt: { identifier: 'secrets.getValue("harnessoauthaccesstoken_github_1778796232970")' },
          clientCrt: { identifier: 'secrets.getValue("ir-demo-external-cluster")' },
          key: { identifier: 'secrets.getValue("priyanshu_atlassian_api_token")' },
          insecureSkipVerify: true,
        },
        connectorID: "gcpmgrpromconnector",
      },
    };

    await registry.dispatch(client, "chaos_probe", "create", {
      probe_id: "new-apm-probedvdv",
      name: "new-apm-probedvdv",
      description: "",
      tags: [],
      type: "apmProbe",
      infrastructure_type: "Kubernetes",
      project_id: "ChaosDev1",
      org_id: "default",
      variables: [],
      probe_properties: { apmProbe },
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

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/v2/probes");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "ChaosDev1",
    });

    expect(call.body.probeId).toBe("new-apm-probedvdv");
    expect(call.body.name).toBe("new-apm-probedvdv");
    expect(call.body.type).toBe("apmProbe");
    expect(call.body.infrastructureType).toBe("Kubernetes");
    expect(call.body.infrastructure_type).toBe("Kubernetes");

    expect(call.body.probeProperties).toEqual({ apmProbe });
    expect(call.body.probe_properties).toEqual({ apmProbe });

    expect(call.body.runProperties).toEqual({
      attempt: 1,
      initialDelay: "5s",
      interval: "2s",
      pollingInterval: "30s",
      stopOnFailure: true,
      timeout: "10s",
      verbosity: "info",
    });

    expect(call.body.variables).toEqual([]);
    expect(call.body.inputs).toEqual([]);
  });
});
