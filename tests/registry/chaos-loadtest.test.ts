/**
 * Verifies chaos_loadtest create/list/get: request shape and response extraction.
 *
 * The load test API now uses a canonical TemplateInput[] array for every
 * recognised tunable (run-params, target URL, worker count, image fields) and
 * carries an optional base64-encoded YAML manifest alongside the JSON body.
 * The three describe-block tests below mirror real verified Harness UI curls:
 *   1. Locust + Kubernetes + inline Python script
 *   2. Locust + Kubernetes + Custom Image
 *   3. Locust + Linux VM + inline Python script
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

type LoadtestInput = {
  name: string;
  value: number | string;
  type: "Integer" | "String";
  required?: true;
};

const SCRIPT = `from locust import HttpUser, task, between


class GoogleUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def homepage(self):
        self.client.get("/")
`;

const K6_SCRIPT = `/**
 * main.js - Sample JavaScript file with an entry function
 */

function greet(name) {
  return \`Hello, \${name}!\`;
}

function add(a, b) {
  return a + b;
}

// Entry point
export default function main() {
  console.log(greet("World"));
  console.log("2 + 3 =", add(2, 3));
}

main();
`;

describe("chaos_loadtest create", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create (Linux VM, inline script): mirrors verified curl 3 — inputs[], base64 scriptContent, base64 yaml manifest", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "locust3", name: "locust-3" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "templatescopetest",
      project_id: "templatescopetest",
      name: "locust-3",
      identity: "locust3",
      environment_id: "env91x",
      infra_id: "79608c02-f1ed-46c0-8551-483509d68111",
      target_url: "http://www.example.com",
      script: SCRIPT,
      target_type: "machine-chaos-linux",
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests");

    // Scope goes in query params as organizationIdentifier (NOT orgIdentifier).
    expect(call.params.organizationIdentifier).toBe("templatescopetest");
    expect(call.params.projectIdentifier).toBe("templatescopetest");
    expect(call.params.orgIdentifier).toBeUndefined();

    // Top-level wire shape — NEW canonical form.
    expect(call.body).toMatchObject({
      identity: "locust3",
      name: "locust-3",
      description: "",
      tags: [],
      environmentIdentifier: "env91x",
      infraIdentifier: "79608c02-f1ed-46c0-8551-483509d68111",
      scriptSource: "inline",
      targetType: "machine-chaos-linux",
      toolType: "Locust",
    });
    expect(call.body.scriptContent).toBe(Buffer.from(SCRIPT, "utf8").toString("base64"));

    // Legacy fields are gone.
    expect(call.body.defaultUsers).toBeUndefined();
    expect(call.body.defaultDurationSec).toBeUndefined();
    expect(call.body.defaultRampUpTimeSec).toBeUndefined();
    expect(call.body.variables).toBeUndefined();
    expect(call.body.targetUrl).toBeUndefined(); // moved into inputs[]

    // inputs[] in canonical order (no workerCount on Linux), exact shape per curl 3.
    expect(call.body.inputs).toEqual([
      { name: "targetUsers", value: 100, type: "Integer", required: true },
      { name: "durationSeconds", value: 600, type: "Integer" },
      { name: "rampUpTimeSec", value: 120, type: "Integer" },
      { name: "targetUrl", value: "http://www.example.com", type: "String" },
    ]);

    // yaml field is base64; decode and assert canonical manifest shape.
    const yamlText = Buffer.from(call.body.yaml as string, "base64").toString("utf8");
    const manifest = YAML.parse(yamlText);
    expect(manifest.kind).toBe("LoadTest");
    expect(manifest.apiVersion).toBe("v1alpha1");
    expect(manifest.name).toBe("locust-3");
    expect(manifest.spec).toMatchObject({
      identity: "locust3",
      toolType: "Locust",
      infraType: "linux",
      targetType: "machine-chaos-linux",
      scriptSource: "inline",
      infraId: "79608c02-f1ed-46c0-8551-483509d68111",
      envId: "env91x",
    });
    // YAML scriptContent is PLAIN TEXT (not base64).
    expect(manifest.spec.scriptContent).toBe(SCRIPT);
    expect(manifest.spec.inputs).toEqual(call.body.inputs);

    // skipScopeBodyInjection: scope must NOT be injected into the JSON body.
    expect(call.body.orgIdentifier).toBeUndefined();
    expect(call.body.organizationIdentifier).toBeUndefined();
    expect(call.body.projectIdentifier).toBeUndefined();
  });

  it("create (Kubernetes inline): mirrors verified curl 1 — inputs[workerCount=1], no variables map", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "locust1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "templatescopetest",
      project_id: "templatescopetest",
      name: "locust-1",
      identity: "locust1",
      description: "op desc",
      tags: ["op:1", "op:2"],
      environment_id: "ashloadtest",
      infra_id: "deletelater1",
      target_url: "http://www.example.com",
      script: SCRIPT,
      target_type: "kubernetes",
      worker_count: 1,
    });

    const body = mockRequest.mock.calls[0][0].body;
    expect(body.targetType).toBe("kubernetes");
    expect(body.scriptSource).toBe("inline");
    expect(body.description).toBe("op desc");
    expect(body.tags).toEqual(["op:1", "op:2"]);
    expect(body.variables).toBeUndefined(); // legacy {workerCount: {...}} map is gone

    expect(body.inputs).toEqual([
      { name: "targetUsers", value: 100, type: "Integer", required: true },
      { name: "durationSeconds", value: 600, type: "Integer" },
      { name: "rampUpTimeSec", value: 120, type: "Integer" },
      { name: "workerCount", value: 1, type: "Integer" },
      { name: "targetUrl", value: "http://www.example.com", type: "String" },
    ]);

    const manifest = YAML.parse(Buffer.from(body.yaml as string, "base64").toString("utf8"));
    expect(manifest.description).toBe("op desc");
    expect(manifest.tags).toEqual(["op:1", "op:2"]);
    expect(manifest.spec.infraType).toBe("kubernetes");
    expect(manifest.spec.targetType).toBe("kubernetes");
    expect(manifest.spec.inputs).toEqual(body.inputs);
  });

  it("create (Kubernetes Custom Image): mirrors verified curl 2 — image inputs[] entries, no scriptContent", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "locust2" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "templatescopetest",
      project_id: "templatescopetest",
      name: "locust-2",
      identity: "locust2",
      environment_id: "ashloadtest",
      infra_id: "expertdatest1",
      target_url: "http://www.example.com",
      target_type: "kubernetes",
      script_source: "image",
      script_image: "imageregistry",
      script_entrypoint: "/script/xyz",
      load_args: "tags=smoke",
      worker_count: 1,
    });

    const body = mockRequest.mock.calls[0][0].body;
    expect(body.scriptSource).toBe("image");
    expect(body.scriptContent).toBeUndefined();
    // Legacy top-level image fields gone.
    expect(body.scriptImage).toBeUndefined();
    expect(body.scriptEntrypoint).toBeUndefined();
    expect(body.loadArgs).toBeUndefined();

    expect(body.inputs).toEqual([
      { name: "targetUsers", value: 100, type: "Integer", required: true },
      { name: "durationSeconds", value: 600, type: "Integer" },
      { name: "rampUpTimeSec", value: 120, type: "Integer" },
      { name: "workerCount", value: 1, type: "Integer" },
      { name: "targetUrl", value: "http://www.example.com", type: "String" },
      { name: "scriptImage", value: "imageregistry", type: "String", required: true },
      { name: "scriptEntrypoint", value: "/script/xyz", type: "String", required: true },
      { name: "loadArgs", value: "tags=smoke", type: "String" },
    ]);

    const manifest = YAML.parse(Buffer.from(body.yaml as string, "base64").toString("utf8"));
    expect(manifest.spec.scriptSource).toBe("image");
    // Image mode → no scriptContent in YAML (the script lives in the container image).
    expect(manifest.spec.scriptContent).toBeUndefined();
    expect(manifest.spec.inputs).toEqual(body.inputs);
  });

  it("create: derives identity from name (alphanumeric) when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "testloadone" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "test-load-one",
      environment_id: "env90x",
      infra_id: "infra-1",
      target_url: "https://example.com",
      script: SCRIPT,
    });

    expect(mockRequest.mock.calls[0][0].body.identity).toBe("testloadone");
  });

  it("create: applies load-config defaults (100/600/120) in inputs[] when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
    });

    const body = mockRequest.mock.calls[0][0].body;
    const byName = Object.fromEntries(
      (body.inputs as LoadtestInput[]).map((i) => [i.name, i.value]),
    );
    expect(byName.targetUsers).toBe(100);
    expect(byName.durationSeconds).toBe(600);
    expect(byName.rampUpTimeSec).toBe(120);
  });

  it("create: zero-valued load config survives in inputs[] (!= null, not truthiness)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
      users: 0, duration_sec: 0, ramp_up_sec: 0,
    });

    const body = mockRequest.mock.calls[0][0].body;
    const byName = Object.fromEntries(
      (body.inputs as LoadtestInput[]).map((i) => [i.name, i.value]),
    );
    expect(byName.targetUsers).toBe(0);
    expect(byName.durationSeconds).toBe(0);
    expect(byName.rampUpTimeSec).toBe(0);
  });

  it("create (Kubernetes): worker_count emitted as inputs[name=workerCount]", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "k8s-lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
      target_type: "kubernetes", worker_count: 3,
    });

    const body = mockRequest.mock.calls[0][0].body;
    expect(body.targetType).toBe("kubernetes");
    const workerEntry = (body.inputs as LoadtestInput[]).find((i) => i.name === "workerCount");
    expect(workerEntry).toEqual({ name: "workerCount", value: 3, type: "Integer" });
    // No legacy variables map.
    expect(body.variables).toBeUndefined();
  });

  it("create: Linux VM does NOT emit workerCount in inputs[]", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
      worker_count: 3, // even when explicitly set on Linux, it should NOT show up.
    });

    const body = mockRequest.mock.calls[0][0].body;
    const workerEntry = (body.inputs as LoadtestInput[]).find((i) => i.name === "workerCount");
    expect(workerEntry).toBeUndefined();
  });

  it("create (Kubernetes): worker_count defaults to 0 in inputs[] when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "k8s-lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
      target_type: "kubernetes",
    });

    const body = mockRequest.mock.calls[0][0].body;
    const workerEntry = (body.inputs as LoadtestInput[]).find((i) => i.name === "workerCount");
    expect(workerEntry).toEqual({ name: "workerCount", value: 0, type: "Integer" });
  });

  it("create: rejects when target_url is missing", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p",
        name: "lt", environment_id: "e", infra_id: "i", script: SCRIPT,
      }),
    ).rejects.toThrow(/target_url/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: rejects when the inline script is missing", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p",
        name: "lt", environment_id: "e", infra_id: "i",
        target_url: "https://example.com",
      }),
    ).rejects.toThrow(/script/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: image mode is inferred from script_image when script_source is omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "img-lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com",
      target_type: "kubernetes",
      script_image: "my-registry/my-load-test:latest",
    });

    const body = mockRequest.mock.calls[0][0].body;
    expect(body.scriptSource).toBe("image");
    expect(body.scriptContent).toBeUndefined();
    const imageEntry = (body.inputs as LoadtestInput[]).find((i) => i.name === "scriptImage");
    expect(imageEntry).toEqual({
      name: "scriptImage",
      value: "my-registry/my-load-test:latest",
      type: "String",
      required: true,
    });
  });

  it("create: rejects image mode when script_image is missing", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p",
        name: "lt", environment_id: "e", infra_id: "i",
        target_url: "https://example.com",
        target_type: "kubernetes", script_source: "image",
      }),
    ).rejects.toThrow(/script_image/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: display name is permissive; identity is auto-slugged when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "My Load Test",
      environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
    });

    const body = mockRequest.mock.calls[0][0].body;
    expect(body.name).toBe("My Load Test");
    expect(body.identity).toBe("MyLoadTest");
  });
});

describe("chaos_loadtest list/get", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: extracts { items, total } and projects a stable shape (drops user-details + scriptContent)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      items: [
        {
          identity: "testloadone",
          name: "test-load-one",
          environmentIdentifier: "env90x",
          infraIdentifier: "infra-1",
          targetType: "machine-chaos-linux",
          toolType: "Locust",
          scriptSource: "inline",
          scriptContent: "BIG_BASE64_BLOB",
          createdByUserDetails: { name: "someone", email: "a@b.com" },
          inputs: [
            { name: "targetUsers", value: 100, type: "Integer", required: true },
            { name: "targetUrl", value: "http://www.example.com", type: "String" },
          ],
          variables: [],
        },
      ],
      pagination: { totalItems: 5 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_loadtest", "list", {
      org_id: "templatescopetest",
      project_id: "templatescopetest",
    })) as { items: Array<Record<string, unknown>>; total: number };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests");
    expect(call.params.organizationIdentifier).toBe("templatescopetest");

    expect(result.total).toBe(5);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.loadtestId).toBe("testloadone");
    expect(item.identity).toBe("testloadone");
    expect(item.name).toBe("test-load-one");
    // Large / opaque fields are dropped from the projected shape.
    expect(item.scriptContent).toBeUndefined();
    expect(item.createdByUserDetails).toBeUndefined();
    // Canonical inputs[] passes through; derived target_url + users are surfaced.
    expect(item.inputs).toHaveLength(2);
    expect(item.users).toBe(100);
    expect(item.target_url).toBe("http://www.example.com");
  });

  it("get: extracts canonical inputs[] AND derives convenience scalars from inputs[]", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      identity: "locust1",
      name: "locust-1",
      environmentIdentifier: "ashloadtest",
      infraIdentifier: "deletelater1",
      targetType: "kubernetes",
      toolType: "Locust",
      scriptSource: "inline",
      inputs: [
        { name: "targetUsers", value: 100, type: "Integer", required: true },
        { name: "durationSeconds", value: 600, type: "Integer" },
        { name: "rampUpTimeSec", value: 120, type: "Integer" },
        { name: "workerCount", value: 1, type: "Integer" },
        { name: "targetUrl", value: "http://www.example.com", type: "String" },
      ],
      variables: [],
      yaml: "BASE64_YAML_BLOB",
      scriptContent: "BIG_BASE64_BLOB",
      updatedByUserDetails: { name: "someone" },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_loadtest", "get", {
      loadtest_id: "locust1",
      org_id: "templatescopetest",
      project_id: "templatescopetest",
    })) as Record<string, unknown>;

    const call = mockRequest.mock.calls[0][0];
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests/locust1");

    // Canonical arrays preserved.
    expect(result.inputs).toHaveLength(5);
    expect(result.variables).toEqual([]);
    expect(result.yaml).toBe("BASE64_YAML_BLOB");

    // Derived convenience scalars match the create-side LLM surface.
    expect(result.target_url).toBe("http://www.example.com");
    expect(result.users).toBe(100);
    expect(result.duration_sec).toBe(600);
    expect(result.ramp_up_sec).toBe(120);
    expect(result.worker_count).toBe(1);

    // Legacy top-level projections are not surfaced anymore.
    expect((result as Record<string, unknown>).defaultUsers).toBeUndefined();
    expect((result as Record<string, unknown>).defaultDurationSec).toBeUndefined();
    expect((result as Record<string, unknown>).defaultRampUpTimeSec).toBeUndefined();
    expect((result as Record<string, unknown>).defaultWorkerCount).toBeUndefined();
    expect((result as Record<string, unknown>).targetUrl).toBeUndefined();

    // Large blobs still dropped.
    expect(result.scriptContent).toBeUndefined();
    expect(result.updatedByUserDetails).toBeUndefined();

    // Deep link is attached.
    expect(result.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/module/chaos/orgs/templatescopetest/projects/templatescopetest/load-tests/locust1",
    );
  });
});

describe("chaos_loadtest create — K6", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create (K6 Kubernetes, Upload K6 script): mirrors verified curl — inputs[], toolConfig with base64 script, env-var literal + secret reference, base64 yaml manifest", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "k61", name: "k6-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "templatescopetest",
      project_id: "templatescopetest",
      tool_type: "K6",
      name: "k6-1",
      identity: "k61",
      description: "op desc",
      tags: ["tag:1"],
      environment_id: "ashloadtest",
      infra_id: "deletelater1",
      target_url: "http://www.google.com",
      script: K6_SCRIPT,
      target_type: "kubernetes",
      worker_count: 3,
      rps_limit: 98,
      env_vars: [
        { key: "var1", value: "staticValue_withoutSecret" },
        { key: "secretKeyVar2", secret_id: "vcenter-admin-username", secret_scope: "project" },
      ],
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests");

    const body = call.body;

    // Top-level wire shape matches the verified curl exactly.
    expect(body).toMatchObject({
      identity: "k61",
      name: "k6-1",
      description: "op desc",
      tags: ["tag:1"],
      environmentIdentifier: "ashloadtest",
      infraIdentifier: "deletelater1",
      scriptSource: "inline",
      targetType: "kubernetes",
      toolType: "K6",
    });
    // K6 does NOT send top-level scriptContent.
    expect(body.scriptContent).toBeUndefined();

    // inputs[] in canonical order (mirrors curl exactly).
    expect(body.inputs).toEqual([
      { name: "targetUsers", value: 100, type: "Integer", required: true },
      { name: "durationSeconds", value: 600, type: "Integer" },
      { name: "rampUpTimeSec", value: 120, type: "Integer" },
      { name: "workerCount", value: 3, type: "Integer" },
      { name: "targetUrl", value: "http://www.google.com", type: "String" },
    ]);

    // toolConfig: K6 wire shape.
    expect(body.toolConfig).toMatchObject({
      mode: "script",
      hostUrl: "http://www.google.com",
      options: { rpsLimit: 98 },
      envVars: [
        { key: "var1", value: "staticValue_withoutSecret" },
        {
          key: "secretKeyVar2",
          value: 'secrets.getValue("vcenter-admin-username")',
          secret: true,
        },
      ],
    });
    expect((body.toolConfig as Record<string, unknown>).scriptContent).toBe(
      Buffer.from(K6_SCRIPT, "utf8").toString("base64"),
    );

    // Decoded YAML manifest.
    const manifest = YAML.parse(Buffer.from(body.yaml as string, "base64").toString("utf8"));
    expect(manifest.spec).toMatchObject({
      identity: "k61",
      toolType: "K6",
      infraType: "kubernetes",
      targetType: "kubernetes",
      scriptSource: "inline",
      infraId: "deletelater1",
      envId: "ashloadtest",
    });
    // YAML must NOT have spec.scriptContent for K6.
    expect(manifest.spec.scriptContent).toBeUndefined();
    // YAML toolConfig.scriptContent is PLAIN TEXT (not base64).
    expect(manifest.spec.toolConfig.scriptContent).toBe(K6_SCRIPT);
    expect(manifest.spec.toolConfig.mode).toBe("script");
    expect(manifest.spec.toolConfig.hostUrl).toBe("http://www.google.com");
    expect(manifest.spec.toolConfig.options).toEqual({ rpsLimit: 98 });
    expect(manifest.spec.toolConfig.envVars).toEqual(body.toolConfig.envVars);
    expect(manifest.spec.inputs).toEqual(body.inputs);
  });

  it("create (K6): rejects target_type='machine-chaos-linux'", async () => {
    const client = makeClient(vi.fn());
    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p",
        tool_type: "K6",
        name: "k6-lt", environment_id: "e", infra_id: "i",
        target_url: "https://example.com",
        script: K6_SCRIPT,
        target_type: "machine-chaos-linux",
      }),
    ).rejects.toThrow(/K6.*kubernetes/);
  });

  it("create (K6): rejects script missing 'export default'", async () => {
    const client = makeClient(vi.fn());
    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p",
        tool_type: "K6",
        name: "k6-lt", environment_id: "e", infra_id: "i",
        target_url: "https://example.com",
        script: "function main() { /* no default export */ }",
        target_type: "kubernetes",
      }),
    ).rejects.toThrow(/export default function/);
  });

  it.each([
    { caseLabel: "reserved name", env: [{ key: "PATH", value: "x" }], match: /reserved/ },
    { caseLabel: "invalid key pattern", env: [{ key: "2foo", value: "x" }], match: /must match/ },
    { caseLabel: "duplicate keys", env: [{ key: "A", value: "1" }, { key: "A", value: "2" }], match: /duplicated/ },
    { caseLabel: "both value and secret_id", env: [{ key: "A", value: "x", secret_id: "y" }], match: /exactly one of/ },
    { caseLabel: "neither value nor secret_id", env: [{ key: "A" }], match: /exactly one of/ },
    { caseLabel: "invalid secret_scope", env: [{ key: "A", secret_id: "x", secret_scope: "global" }], match: /account.*org.*project/ },
  ])("create (K6): env_vars validation rejects $caseLabel", async ({ env, match }) => {
    const client = makeClient(vi.fn());
    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p",
        tool_type: "K6",
        name: "k6-lt", environment_id: "e", infra_id: "i",
        target_url: "https://example.com",
        script: K6_SCRIPT,
        target_type: "kubernetes",
        env_vars: env,
      }),
    ).rejects.toThrow(match);
  });

  it.each([
    { scope: "account", id: "gcp-ca-cert", wire: 'secrets.getValue("account.gcp-ca-cert")' },
    { scope: "org", id: "org-level-secret", wire: 'secrets.getValue("org.org-level-secret")' },
    { scope: "project", id: "vcenter-admin-username", wire: 'secrets.getValue("vcenter-admin-username")' },
  ])("create (K6): secret_scope='$scope' produces $wire", async ({ scope, id, wire }) => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      tool_type: "K6",
      name: "k6-lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com",
      script: K6_SCRIPT,
      target_type: "kubernetes",
      env_vars: [{ key: "SECRET", secret_id: id, secret_scope: scope }],
    });
    const envVars = (mockRequest.mock.calls[0][0].body.toolConfig as Record<string, unknown>)
      .envVars;
    expect(envVars).toEqual([{ key: "SECRET", value: wire, secret: true }]);
  });

  it("create (K6): secret_scope defaults to 'project' when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      tool_type: "K6",
      name: "k6-lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com",
      script: K6_SCRIPT,
      target_type: "kubernetes",
      env_vars: [{ key: "SECRET", secret_id: "my-secret" }],
    });
    const envVars = (mockRequest.mock.calls[0][0].body.toolConfig as Record<string, unknown>)
      .envVars;
    expect(envVars).toEqual([
      { key: "SECRET", value: 'secrets.getValue("my-secret")', secret: true },
    ]);
  });

  it("create (K6): host_url defaults to the origin of target_url when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      tool_type: "K6",
      name: "k6-lt", environment_id: "e", infra_id: "i",
      target_url: "https://api.example.com/foo/bar?q=1",
      script: K6_SCRIPT,
      target_type: "kubernetes",
    });
    const toolConfig = mockRequest.mock.calls[0][0].body.toolConfig as Record<string, unknown>;
    expect(toolConfig.hostUrl).toBe("https://api.example.com");
  });

  it("create (K6): omits options/envVars/iterations from toolConfig when empty", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      tool_type: "K6",
      name: "k6-lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com",
      script: K6_SCRIPT,
      target_type: "kubernetes",
    });
    const tc = mockRequest.mock.calls[0][0].body.toolConfig as Record<string, unknown>;
    expect(Object.keys(tc).sort()).toEqual(["hostUrl", "mode", "scriptContent"]);
  });

  it("create (Locust): existing behaviour unchanged — no toolConfig emitted, top-level scriptContent still set", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
      target_type: "kubernetes",
    });
    const body = mockRequest.mock.calls[0][0].body;
    expect(body.toolType).toBe("Locust"); // default when tool_type omitted
    expect(body.toolConfig).toBeUndefined();
    expect(body.scriptContent).toBe(Buffer.from(SCRIPT, "utf8").toString("base64"));
  });

  it("create (K6 Kubernetes, Using Custom Image): mirrors verified curl k6-2 — toolConfig.customImage, inputs[] with image fields, base64 yaml manifest", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "k62", name: "k6-2" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "templatescopetest",
      project_id: "templatescopetest",
      tool_type: "K6",
      name: "k6-2",
      identity: "k62",
      description: "optional desc",
      tags: ["tag:op1"],
      environment_id: "ashloadtest",
      infra_id: "discoverytestallsettingsset",
      target_url: "http://www.example.com",
      target_type: "kubernetes",
      script_source: "image",
      script_image: " my-image", // preserve leading space per the verified curl
      script_entrypoint: "/script.json",
      load_args: "tags=smoke,random;headless=true",
      worker_count: 1,
      rps_limit: 29,
      env_vars: [
        { key: "var1", value: "val1" },
        { key: "secretKeyVar2", secret_id: "gcp-ca-cert", secret_scope: "account" },
      ],
    });

    const body = mockRequest.mock.calls[0][0].body;

    // Top-level wire shape matches the verified curl exactly.
    expect(body).toMatchObject({
      identity: "k62",
      name: "k6-2",
      description: "optional desc",
      tags: ["tag:op1"],
      environmentIdentifier: "ashloadtest",
      infraIdentifier: "discoverytestallsettingsset",
      scriptSource: "image",
      targetType: "kubernetes",
      toolType: "K6",
    });
    // K6 (any mode) does NOT send top-level scriptContent.
    expect(body.scriptContent).toBeUndefined();

    // inputs[] order matches the curl (5 standard + 3 image entries).
    expect(body.inputs).toEqual([
      { name: "targetUsers", value: 100, type: "Integer", required: true },
      { name: "durationSeconds", value: 600, type: "Integer" },
      { name: "rampUpTimeSec", value: 120, type: "Integer" },
      { name: "workerCount", value: 1, type: "Integer" },
      { name: "targetUrl", value: "http://www.example.com", type: "String" },
      { name: "scriptImage", value: " my-image", type: "String", required: true },
      { name: "scriptEntrypoint", value: "/script.json", type: "String", required: true },
      { name: "loadArgs", value: "tags=smoke,random;headless=true", type: "String" },
    ]);

    // toolConfig: K6 image-mode wire shape.
    expect(body.toolConfig).toEqual({
      mode: "image",
      customImage: { image: " my-image", entrypoint: "/script.json" },
      hostUrl: "http://www.example.com",
      options: { rpsLimit: 29 },
      envVars: [
        { key: "var1", value: "val1" },
        {
          key: "secretKeyVar2",
          value: 'secrets.getValue("account.gcp-ca-cert")',
          secret: true,
        },
      ],
    });
    // toolConfig.customImage MUST NOT carry loadArgs (load_args rides only in inputs[]).
    const ci = (body.toolConfig as Record<string, unknown>).customImage as Record<string, unknown>;
    expect(ci.runArgs).toBeUndefined();
    expect(ci.loadArgs).toBeUndefined();

    // Decoded YAML manifest.
    const manifest = YAML.parse(Buffer.from(body.yaml as string, "base64").toString("utf8"));
    expect(manifest.spec).toMatchObject({
      identity: "k62",
      toolType: "K6",
      infraType: "kubernetes",
      targetType: "kubernetes",
      scriptSource: "image",
      infraId: "discoverytestallsettingsset",
      envId: "ashloadtest",
    });
    expect(manifest.spec.scriptContent).toBeUndefined();
    expect(manifest.spec.toolConfig.mode).toBe("image");
    expect(manifest.spec.toolConfig.customImage).toEqual({
      image: " my-image",
      entrypoint: "/script.json",
    });
    expect(manifest.spec.toolConfig.scriptContent).toBeUndefined();
    expect(manifest.spec.inputs).toEqual(body.inputs);
  });

  it("create (K6 image): script_entrypoint is optional — customImage carries only image", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      tool_type: "K6",
      name: "k6-lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com",
      target_type: "kubernetes",
      script_source: "image",
      script_image: "my-registry/k6:latest",
    });
    const tc = mockRequest.mock.calls[0][0].body.toolConfig as Record<string, unknown>;
    expect(tc.mode).toBe("image");
    expect(tc.customImage).toEqual({ image: "my-registry/k6:latest" });
  });

  it("create (K6 image): rejects when script_image is missing", async () => {
    const client = makeClient(vi.fn());
    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p",
        tool_type: "K6",
        name: "k6-lt", environment_id: "e", infra_id: "i",
        target_url: "https://example.com",
        target_type: "kubernetes",
        script_source: "image",
      }),
    ).rejects.toThrow(/script_image/);
  });

  it("create (K6 image): load_args rides only in inputs[], not toolConfig.customImage", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      tool_type: "K6",
      name: "k6-lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com",
      target_type: "kubernetes",
      script_source: "image",
      script_image: "my-image",
      load_args: "tags=smoke",
    });
    const body = mockRequest.mock.calls[0][0].body;
    // inputs[] has loadArgs.
    expect(
      (body.inputs as Array<Record<string, unknown>>).find((i) => i.name === "loadArgs"),
    ).toEqual({ name: "loadArgs", value: "tags=smoke", type: "String" });
    // toolConfig.customImage MUST NOT carry it.
    const ci = (body.toolConfig as Record<string, unknown>).customImage as Record<string, unknown>;
    expect(ci.loadArgs).toBeUndefined();
    expect(ci.runArgs).toBeUndefined();
  });
});
