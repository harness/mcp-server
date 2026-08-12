/**
 * Verifies chaos_loadtest list/get/create/update/delete and the run/stop actions:
 * request shape and response extraction.
 *
 * Since the loadTestManager variables migration, all tunables and custom env
 * vars live under toolConfig.<tool>.tunables / toolConfig.<tool>.variables. The
 * MCP surface stays ergonomic (snake_case scalars) but the wire body is now a
 * nested toolConfig map — never top-level `inputs[]` or `scriptContent`. K6 is
 * Kubernetes-only; JMeter is passthrough via `tool_config`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import YAML from "yaml";
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

const SCRIPT = `from locust import HttpUser, task, between


class GoogleUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def homepage(self):
        self.client.get("/")
`;

const K6_SCRIPT = `/**
 * main.js
 */
export default function main() {
  console.log("hi");
}
`;

// ── Locust create ────────────────────────────────────────────────────
describe("chaos_loadtest create (Locust)", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("Linux VM inline: nests script + tunables under toolConfig.locust, no top-level scriptContent/inputs", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "locust3" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "templatescopetest",
      project_id: "templatescopetest",
      name: "locust-3",
      identity: "locust3",
      environment_id: "env91x",
      infra_id: "infra-1",
      target_url: "http://www.example.com",
      script: SCRIPT,
      target_type: "machine-chaos-linux",
      users: 50,
      duration_sec: 300,
      ramp_up_sec: 30,
      spawn_rate: 5,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests");
    // Scope stays in query params as organizationIdentifier (not orgIdentifier).
    expect(call.params.organizationIdentifier).toBe("templatescopetest");
    expect(call.params.orgIdentifier).toBeUndefined();

    const body = call.body;
    expect(body).toMatchObject({
      identity: "locust3",
      name: "locust-3",
      environmentIdentifier: "env91x",
      infraIdentifier: "infra-1",
      targetType: "machine-chaos-linux",
      toolType: "Locust",
    });
    // Legacy top-level fields must be gone.
    expect(body.scriptContent).toBeUndefined();
    expect(body.scriptSource).toBeUndefined();
    expect(body.inputs).toBeUndefined();

    // toolConfig.locust: script.content is base64, tunables mirrors the request.
    const tc = body.toolConfig as Record<string, unknown>;
    expect(Object.keys(tc)).toEqual(["locust"]);
    const locust = tc.locust as Record<string, unknown>;
    expect(locust.mode).toBe("script");
    expect(locust.script).toEqual({
      content: Buffer.from(SCRIPT, "utf8").toString("base64"),
    });
    expect(locust.tunables).toEqual({
      targetUrl: "http://www.example.com",
      targetUsers: 50,
      spawnRate: 5,
      durationSeconds: 300,
      rampUpTimeSec: 30,
    });

    // YAML manifest is base64; decoded shape carries plain-text script content.
    const manifest = YAML.parse(Buffer.from(body.yaml as string, "base64").toString("utf8"));
    expect(manifest.spec).toMatchObject({
      identity: "locust3",
      toolType: "Locust",
      infraType: "linux",
      targetType: "machine-chaos-linux",
      envId: "env91x",
      infraId: "infra-1",
    });
    expect(manifest.spec.scriptContent).toBeUndefined();
    expect(manifest.spec.inputs).toBeUndefined();
    expect(manifest.spec.toolConfig.locust.script.content).toBe(SCRIPT);
    expect(manifest.spec.toolConfig.locust.tunables.targetUsers).toBe(50);

    // skipScopeBodyInjection: no scope in body.
    expect(body.orgIdentifier).toBeUndefined();
    expect(body.organizationIdentifier).toBeUndefined();
    expect(body.projectIdentifier).toBeUndefined();
  });

  it("Kubernetes image (private registry): nests script.{image,entrypoint,loadArgs,imagePullSecret} under toolConfig.locust", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "img-lt", environment_id: "e", infra_id: "i",
      target_url: "http://www.example.com",
      target_type: "kubernetes",
      script_source: "image",
      script_image: "my-registry/locust:latest",
      script_entrypoint: "/script/xyz",
      load_args: "tags=smoke",
      image_pull_secret: "Some secret name",
      worker_count: 1,
    });
    const body = mockRequest.mock.calls[0][0].body;
    expect(body.scriptContent).toBeUndefined();
    expect(body.inputs).toBeUndefined();
    const locust = (body.toolConfig as Record<string, unknown>).locust as Record<string, unknown>;
    expect(locust.mode).toBe("image");
    expect(locust.script).toEqual({
      image: "my-registry/locust:latest",
      entrypoint: "/script/xyz",
      loadArgs: "tags=smoke",
      imagePullSecret: "Some secret name",
    });
    expect(locust.tunables).toEqual({
      targetUrl: "http://www.example.com",
      workerCount: 1,
    });

    // YAML manifest carries the same script scalars (plain text on the YAML side).
    const yamlB64 = body.yaml as string;
    const manifest = YAML.parse(Buffer.from(yamlB64, "base64").toString("utf8"));
    expect(manifest.spec.toolConfig.locust.script).toEqual({
      image: "my-registry/locust:latest",
      entrypoint: "/script/xyz",
      loadArgs: "tags=smoke",
      imagePullSecret: "Some secret name",
    });
  });

  it("Kubernetes image (public registry): omits imagePullSecret and loadArgs when not supplied", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "img-lt-public", environment_id: "e", infra_id: "i",
      target_type: "kubernetes",
      script_source: "image",
      script_image: "my-registry/locust:latest",
    });
    const body = mockRequest.mock.calls[0][0].body;
    const locust = (body.toolConfig as Record<string, unknown>).locust as Record<string, unknown>;
    expect(locust.mode).toBe("image");
    expect(locust.script).toEqual({ image: "my-registry/locust:latest" });
    const script = locust.script as Record<string, unknown>;
    expect(script.imagePullSecret).toBeUndefined();
    expect(script.loadArgs).toBeUndefined();
  });

  it("Kubernetes image: rejects load_args whose keys start with '-'", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p",
        name: "img-lt-bad", environment_id: "e", infra_id: "i",
        target_type: "kubernetes",
        script_source: "image",
        script_image: "my-registry/locust:latest",
        load_args: "--headless",
      }),
    ).rejects.toThrow(/must not start with '-'/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("passes optional service_references / cleanup_policy / max_duration_sec / resources through", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
      service_references: ["svc-1", "svc-2"],
      cleanup_policy: "retain",
      max_duration_sec: 900,
      resources: {
        requests: { cpu: "100m", memory: "256Mi" },
        limits: { cpu: "500m", memory: "512Mi" },
      },
    });
    const body = mockRequest.mock.calls[0][0].body;
    expect(body.serviceReferences).toEqual(["svc-1", "svc-2"]);
    expect(body.cleanupPolicy).toBe("retain");
    expect(body.maxDurationSec).toBe(900);
    expect(body.resources).toMatchObject({
      requests: { cpu: "100m", memory: "256Mi" },
    });
  });

  it("stores variables under toolConfig.<tool>.variables", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
      variables: [{ name: "API_KEY", type: "String", value: "abc" }],
    });
    const locust = (mockRequest.mock.calls[0][0].body.toolConfig as Record<string, unknown>)
      .locust as Record<string, unknown>;
    expect(locust.variables).toEqual([{ name: "API_KEY", type: "String", value: "abc" }]);
  });

  it("derives identity from name when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "My Load Test",
      environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
    });
    expect(mockRequest.mock.calls[0][0].body.identity).toBe("MyLoadTest");
  });

  it("rejects deprecated tool_type='Gatling' / 'Custom'", async () => {
    const client = makeClient(vi.fn());
    for (const t of ["Gatling", "Custom"]) {
      await expect(
        registry.dispatch(client, "chaos_loadtest", "create", {
          org_id: "o", project_id: "p",
          name: "lt", tool_type: t, environment_id: "e", infra_id: "i",
          target_url: "https://example.com", script: SCRIPT,
        }),
      ).rejects.toThrow(/Locust.*K6.*JMeter/);
    }
  });
});

// ── K6 create ─────────────────────────────────────────────────────────
describe("chaos_loadtest create (K6)", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("script mode: nests script.content + tunables under toolConfig.k6, envVars carry literal + secret refs", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      tool_type: "K6",
      name: "k6-1", environment_id: "e", infra_id: "i",
      target_url: "http://www.google.com",
      script: K6_SCRIPT,
      target_type: "kubernetes",
      worker_count: 3,
      rps_limit: 98,
      iterations: 42,
      env_vars: [
        { key: "var1", value: "static" },
        { key: "SECRET_VAR", secret_id: "vcenter", secret_scope: "project" },
      ],
    });

    const body = mockRequest.mock.calls[0][0].body;
    expect(body.toolType).toBe("K6");
    expect(body.scriptContent).toBeUndefined();
    expect(body.inputs).toBeUndefined();

    const k6 = (body.toolConfig as Record<string, unknown>).k6 as Record<string, unknown>;
    expect(k6.mode).toBe("script");
    expect(k6.script).toEqual({
      content: Buffer.from(K6_SCRIPT, "utf8").toString("base64"),
    });
    expect(k6.tunables).toMatchObject({
      targetUrl: "http://www.google.com",
      workerCount: 3,
      hostUrl: "http://www.google.com",
      iterations: 42,
      rpsLimit: 98,
    });
    expect(k6.envVars).toEqual([
      { key: "var1", value: "static" },
      { key: "SECRET_VAR", value: 'secrets.getValue("vcenter")', secret: true },
    ]);
    // Legacy flat keys must NOT appear on the toolConfig.k6 block.
    expect(k6.scriptContent).toBeUndefined();
    expect(k6.customImage).toBeUndefined();
    expect(k6.hostUrl).toBeUndefined();
    expect(k6.options).toBeUndefined();

    // Decoded YAML mirrors the wire toolConfig but with plain-text script content.
    const manifest = YAML.parse(Buffer.from(body.yaml as string, "base64").toString("utf8"));
    expect(manifest.spec.toolConfig.k6.mode).toBe("script");
    expect(manifest.spec.toolConfig.k6.script.content).toBe(K6_SCRIPT);
    expect(manifest.spec.toolConfig.k6.tunables.workerCount).toBe(3);
    expect(manifest.spec.toolConfig.k6.tunables.rpsLimit).toBe(98);
  });

  it("image mode: nests script.image + entrypoint under toolConfig.k6.script", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      tool_type: "K6",
      name: "k6-2", environment_id: "e", infra_id: "i",
      target_url: "http://www.example.com",
      target_type: "kubernetes",
      script_source: "image",
      script_image: "my-image",
      script_entrypoint: "/entrypoint.sh",
    });
    const k6 = (mockRequest.mock.calls[0][0].body.toolConfig as Record<string, unknown>)
      .k6 as Record<string, unknown>;
    expect(k6.mode).toBe("image");
    expect(k6.script).toEqual({ image: "my-image", entrypoint: "/entrypoint.sh" });
    expect(k6.scriptContent).toBeUndefined();
    expect(k6.customImage).toBeUndefined();
  });

  it("rejects target_type='machine-chaos-linux'", async () => {
    const client = makeClient(vi.fn());
    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p", tool_type: "K6",
        name: "k6-lt", environment_id: "e", infra_id: "i",
        target_url: "https://example.com", script: K6_SCRIPT,
        target_type: "machine-chaos-linux",
      }),
    ).rejects.toThrow(/K6.*kubernetes/);
  });

  it("rejects K6 script missing 'export default'", async () => {
    const client = makeClient(vi.fn());
    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p", tool_type: "K6",
        name: "k6-lt", environment_id: "e", infra_id: "i",
        target_url: "https://example.com",
        script: "function main() { /* no default export */ }",
        target_type: "kubernetes",
      }),
    ).rejects.toThrow(/export default function/);
  });
});

// ── JMeter create ─────────────────────────────────────────────────────
describe("chaos_loadtest create (JMeter)", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("passes tool_config through verbatim under toolConfig.jmeter", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    const jmeter = {
      mode: "script",
      script: { content: "PD94bWwgdmVyc2lvbj0iMS4wIj8+" },
      tunables: { targetUsers: 10, durationSeconds: 60 },
    };
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      tool_type: "JMeter",
      name: "jm-1", environment_id: "e", infra_id: "i",
      target_type: "kubernetes",
      tool_config: { jmeter },
    });
    const tc = mockRequest.mock.calls[0][0].body.toolConfig as Record<string, unknown>;
    expect(tc.jmeter).toEqual(jmeter);
  });

  it("rejects JMeter when tool_config is missing", async () => {
    const client = makeClient(vi.fn());
    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p",
        tool_type: "JMeter", name: "jm-1",
        environment_id: "e", infra_id: "i",
        target_type: "kubernetes",
      }),
    ).rejects.toThrow(/tool_config/);
  });

  it("rejects JMeter when target_type is not kubernetes", async () => {
    const client = makeClient(vi.fn());
    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p",
        tool_type: "JMeter", name: "jm-1",
        environment_id: "e", infra_id: "i",
        target_type: "machine-chaos-linux",
        tool_config: { jmeter: {} },
      }),
    ).rejects.toThrow(/JMeter.*kubernetes/);
  });
});

// ── list ──────────────────────────────────────────────────────────────
describe("chaos_loadtest list", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("maps the new query params (tool_type, tags, sort_field, sort_ascending)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "list", {
      org_id: "o", project_id: "p",
      tool_type: "K6",
      tags: ["a", "b"],
      sort_field: "lastUpdated",
      sort_ascending: false,
      environment_id: "env-1",
      search: "foo",
      limit: 25,
      page: 2,
    });
    const params = mockRequest.mock.calls[0][0].params;
    expect(params.toolType).toBe("K6");
    expect(params.tags).toEqual(["a", "b"]);
    expect(params.sortField).toBe("lastUpdated");
    expect(params.sortAscending).toBe(false);
    expect(params.environmentIdentifier).toBe("env-1");
    expect(params.search).toBe("foo");
    expect(params.limit).toBe(25);
    expect(params.page).toBe(2);
  });

  it("projects list items via chaosLoadTestExtract (toolConfig-nested tunables → scalar mirrors)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      items: [
        {
          uniqueId: "u-1",
          identity: "k61",
          name: "k6-1",
          environmentIdentifier: "env-1",
          infraIdentifier: "infra-1",
          infraType: "kubernetes",
          targetType: "kubernetes",
          toolType: "K6",
          scriptSource: "inline",
          maxDurationSec: 900,
          cleanupPolicy: "delete",
          serviceReferences: ["svc-1"],
          targetUsers: "100",
          durationSeconds: "600",
          toolConfig: {
            k6: {
              mode: "script",
              script: { content: "BASE64==" },
              tunables: {
                targetUrl: "https://api.example.com",
                targetUsers: 100,
                durationSeconds: 600,
                rampUpTimeSec: 60,
                hostUrl: "https://api.example.com",
                rpsLimit: 50,
              },
              variables: [{ name: "X" }],
              envVars: [{ key: "K", value: "V" }],
            },
          },
          createdByUserDetails: { name: "someone" }, // must not surface
        },
      ],
      pagination: { totalItems: 3 },
    });
    const client = makeClient(mockRequest);
    const result = (await registry.dispatch(client, "chaos_loadtest", "list", {
      org_id: "o", project_id: "p",
    })) as { items: Array<Record<string, unknown>>; total: number };

    expect(result.total).toBe(3);
    const item = result.items[0];
    expect(item.loadtestId).toBe("k61");
    expect(item.uniqueId).toBe("u-1");
    expect(item.infraType).toBe("kubernetes");
    expect(item.maxDurationSec).toBe(900);
    expect(item.serviceReferences).toEqual(["svc-1"]);
    // Convenience scalars pulled from toolConfig.k6.tunables.
    expect(item.target_url).toBe("https://api.example.com");
    expect(item.users).toBe(100);
    expect(item.duration_sec).toBe(600);
    expect(item.ramp_up_sec).toBe(60);
    expect(item.host_url).toBe("https://api.example.com");
    expect(item.rps_limit).toBe(50);
    // Full toolConfig is passed through.
    expect((item.toolConfig as Record<string, unknown>).k6).toBeDefined();
    // Variables/envVars surfaced from toolBlock.
    expect((item.variables as unknown[]).length).toBe(1);
    expect((item.envVars as unknown[]).length).toBe(1);
    // Denormalised display strings surface separately from scalar mirrors.
    expect(item.targetUsersDisplay).toBe("100");
    expect(item.durationSecondsDisplay).toBe("600");
    // Legacy fields are gone.
    expect(item.inputs).toBeUndefined();
    expect(item.createdByUserDetails).toBeUndefined();
  });
});

// ── get / delete ──────────────────────────────────────────────────────
describe("chaos_loadtest get / delete", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("get: extractor projects toolConfig.locust.tunables → scalars and mirrors identity", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      identity: "locust1",
      name: "locust-1",
      environmentIdentifier: "e",
      infraIdentifier: "i",
      targetType: "kubernetes",
      toolType: "Locust",
      toolConfig: {
        locust: {
          mode: "script",
          script: { content: "BASE64==" },
          tunables: {
            targetUrl: "http://www.example.com",
            targetUsers: 100,
            durationSeconds: 600,
            rampUpTimeSec: 120,
            spawnRate: 5,
            workerCount: 1,
          },
        },
      },
      yaml: "BASE64_YAML_BLOB",
    });
    const client = makeClient(mockRequest);
    const result = (await registry.dispatch(client, "chaos_loadtest", "get", {
      loadtest_id: "locust1",
      org_id: "templatescopetest",
      project_id: "templatescopetest",
    })) as Record<string, unknown>;

    expect(mockRequest.mock.calls[0][0].path).toBe(
      "/loadTest/manager/api/v1/load-tests/locust1",
    );
    expect(result.loadtestId).toBe("locust1");
    expect(result.target_url).toBe("http://www.example.com");
    expect(result.users).toBe(100);
    expect(result.duration_sec).toBe(600);
    expect(result.ramp_up_sec).toBe(120);
    expect(result.worker_count).toBe(1);
    expect(result.spawn_rate).toBe(5);
    expect(result.yaml).toBe("BASE64_YAML_BLOB");
    expect(result.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/module/chaos/orgs/templatescopetest/projects/templatescopetest/load-tests/locust1",
    );
  });

  it("delete: DELETE /v1/load-tests/{identity}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ success: true, message: "deleted" });
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "delete", {
      loadtest_id: "locust1",
      org_id: "o", project_id: "p",
    });
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests/locust1");
  });
});

// ── update ────────────────────────────────────────────────────────────
describe("chaos_loadtest update", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("PUT with only the fields the caller supplied (partial update)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "update", {
      loadtest_id: "locust1",
      org_id: "o", project_id: "p",
      name: "renamed",
      cleanup_policy: "retain",
    });
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests/locust1");
    expect(call.body).toEqual({ name: "renamed", cleanupPolicy: "retain" });
  });

  it("passes tool_config through as a full replacement", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    const tool_config = { locust: { mode: "script", script: { content: "AAA=" }, tunables: { targetUsers: 5 } } };
    await registry.dispatch(client, "chaos_loadtest", "update", {
      loadtest_id: "lt-1",
      org_id: "o", project_id: "p",
      tool_config,
    });
    expect(mockRequest.mock.calls[0][0].body.toolConfig).toEqual(tool_config);
  });
});

// ── run / stop actions ────────────────────────────────────────────────
describe("chaos_loadtest execute actions", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("run: auto-fills required `identity` with a UUID and hits /v1/load-tests/{id}/runs", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatchExecute(client, "chaos_loadtest", "run", {
      loadtest_id: "lt-1",
      org_id: "o", project_id: "p",
    });
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests/lt-1/runs");
    expect(typeof call.body.identity).toBe("string");
    expect(call.body.identity.length).toBeGreaterThan(0);
    expect(call.body.values).toBeUndefined();
    expect(call.body.runtimeValues).toBeUndefined();
  });

  it("run: honours caller-supplied run_identity / run_name / values / runtime_values", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatchExecute(client, "chaos_loadtest", "run", {
      loadtest_id: "lt-1",
      org_id: "o", project_id: "p",
      run_identity: "my-run-1",
      run_name: "Nightly Load",
      values: [{ name: "TARGET_USERS", value: "500" }],
      runtime_values: { "toolConfig.locust.tunables.targetUsers": 500 },
    });
    const body = mockRequest.mock.calls[0][0].body;
    expect(body.identity).toBe("my-run-1");
    expect(body.name).toBe("Nightly Load");
    expect(body.values).toEqual([{ name: "TARGET_USERS", value: "500" }]);
    expect(body.runtimeValues).toEqual({
      "toolConfig.locust.tunables.targetUsers": 500,
    });
  });

  it("stop: POSTs to /v1/runs/{run_id}/stop with empty body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatchExecute(client, "chaos_loadtest", "stop", {
      run_id: "run-42",
      org_id: "o", project_id: "p",
    });
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/loadTest/manager/api/v1/runs/run-42/stop");
    // Body carries no run-specific fields; scope injection is registry behaviour we don't assert here.
    expect(call.body.identity).toBeUndefined();
    expect(call.body.values).toBeUndefined();
    expect(call.body.runtimeValues).toBeUndefined();
  });
});
