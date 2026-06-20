/**
 * Verifies chaos_loadtest create/list/get: request shape and response extraction.
 *
 * The load test API lives under a separate service path (loadTest/manager/api),
 * scopes via organizationIdentifier (CHAOS_SCOPE), and takes a Locust script in
 * "script mode" — the raw Python script is base64-encoded into scriptContent.
 * The create request mirrors the verified Harness UI curl.
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

const SCRIPT = `from locust import HttpUser, task, between


class GoogleUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def homepage(self):
        self.client.get("/")
`;

describe("chaos_loadtest create", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create (Linux VM): builds the body matching the verified curl, base64 script, organizationIdentifier scope", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "ranndom10223", name: "ranndom-10223" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "templatescopetest",
      project_id: "templatescopetest",
      name: "ranndom-10223",
      identity: "ranndom10223",
      environment_id: "env90x",
      infra_id: "ce7dcb77-b327-4865-92b5-899ee1718e30",
      target_url: "https://www.google.com",
      script: SCRIPT,
      users: 100,
      duration_sec: 600,
      ramp_up_sec: 120,
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests");

    // Scope goes in query params as organizationIdentifier (NOT orgIdentifier).
    expect(call.params.organizationIdentifier).toBe("templatescopetest");
    expect(call.params.projectIdentifier).toBe("templatescopetest");
    expect(call.params.orgIdentifier).toBeUndefined();

    // Body matches the curl: camelCase API keys, base64 scriptContent, inline source.
    expect(call.body).toMatchObject({
      identity: "ranndom10223",
      name: "ranndom-10223",
      environmentIdentifier: "env90x",
      infraIdentifier: "ce7dcb77-b327-4865-92b5-899ee1718e30",
      targetUrl: "https://www.google.com",
      targetType: "machine-chaos-linux",
      toolType: "Locust",
      scriptSource: "inline",
      defaultUsers: 100,
      defaultDurationSec: 600,
      defaultRampUpTimeSec: 120,
    });
    expect(call.body.scriptContent).toBe(Buffer.from(SCRIPT, "utf8").toString("base64"));

    // skipScopeBodyInjection: scope must NOT be injected into the JSON body.
    expect(call.body.orgIdentifier).toBeUndefined();
    expect(call.body.organizationIdentifier).toBeUndefined();
    expect(call.body.projectIdentifier).toBeUndefined();
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

  it("create: applies load-config defaults (100/600/120) when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
    });

    const body = mockRequest.mock.calls[0][0].body;
    expect(body.defaultUsers).toBe(100);
    expect(body.defaultDurationSec).toBe(600);
    expect(body.defaultRampUpTimeSec).toBe(120);
  });

  it("create: zero-valued load config survives (!= null, not truthiness)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
      users: 0, duration_sec: 0, ramp_up_sec: 0,
    });

    const body = mockRequest.mock.calls[0][0].body;
    expect(body.defaultUsers).toBe(0);
    expect(body.defaultDurationSec).toBe(0);
    expect(body.defaultRampUpTimeSec).toBe(0);
  });

  it("create (Kubernetes): worker_count is sent as variables.workerCount", async () => {
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
    expect(body.variables).toEqual({
      workerCount: { type: "fixed", valueType: "int", value: 3 },
    });
  });

  it("create: Linux VM does not emit worker variables", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
      worker_count: 3,
    });

    expect(mockRequest.mock.calls[0][0].body.variables).toBeUndefined();
  });

  it("create: rejects when a required field (target_url) is missing", async () => {
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

  it("create: rejects when the script is missing", async () => {
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

  it("create (Kubernetes inline): mirrors curl 1 — base64 script + workerCount=1", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "kuberneteexample1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "templatescopetest", project_id: "templatescopetest",
      name: "kubernete-example-1", identity: "kuberneteexample1",
      environment_id: "ashloadtest", infra_id: "discoverytestallsettingsset",
      target_url: "https://www.google.com", script: SCRIPT,
      target_type: "kubernetes", worker_count: 1,
    });

    const body = mockRequest.mock.calls[0][0].body;
    expect(body.targetType).toBe("kubernetes");
    expect(body.scriptSource).toBe("inline");
    expect(body.scriptContent).toBe(Buffer.from(SCRIPT, "utf8").toString("base64"));
    expect(body.scriptImage).toBeUndefined();
    expect(body.variables).toEqual({
      workerCount: { type: "fixed", valueType: "int", value: 1 },
    });
  });

  it("create (Kubernetes Custom Image): mirrors curl 2 — image/entrypoint/loadArgs, no scriptContent, workerCount=0", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "kubernetesexample2" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "templatescopetest", project_id: "templatescopetest",
      name: "kubernetes-example-2", identity: "kubernetesexample2",
      environment_id: "ashloadtest", infra_id: "discoverytestallsettingsset",
      target_url: "https://www.google.com",
      target_type: "kubernetes",
      script_source: "image",
      script_image: "my-registry/my-load-test:latest",
      script_entrypoint: "locustfile.py",
      load_args: "tags=smoke,fast;headless=true",
      worker_count: 0,
    });

    const body = mockRequest.mock.calls[0][0].body;
    expect(body).toMatchObject({
      targetType: "kubernetes",
      toolType: "Locust",
      scriptSource: "image",
      scriptImage: "my-registry/my-load-test:latest",
      scriptEntrypoint: "locustfile.py",
      loadArgs: "tags=smoke,fast;headless=true",
    });
    expect(body.scriptContent).toBeUndefined();
    expect(body.variables).toEqual({
      workerCount: { type: "fixed", valueType: "int", value: 0 },
    });
  });

  it("create: image mode is inferred from script_image when script_source omitted", async () => {
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
    expect(body.scriptImage).toBe("my-registry/my-load-test:latest");
    expect(body.scriptContent).toBeUndefined();
  });

  it("create (Kubernetes): worker_count defaults to 0 when omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest", "create", {
      org_id: "o", project_id: "p",
      name: "k8s-lt", environment_id: "e", infra_id: "i",
      target_url: "https://example.com", script: SCRIPT,
      target_type: "kubernetes",
    });

    expect(mockRequest.mock.calls[0][0].body.variables).toEqual({
      workerCount: { type: "fixed", valueType: "int", value: 0 },
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

  it("create: rejects an invalid name (uppercase / spaces)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "chaos_loadtest", "create", {
        org_id: "o", project_id: "p",
        name: "Invalid Name", environment_id: "e", infra_id: "i",
        target_url: "https://example.com", script: SCRIPT,
      }),
    ).rejects.toThrow(/name/);
    expect(mockRequest).not.toHaveBeenCalled();
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
    // Large/opaque fields are dropped from the projected shape.
    expect(item.scriptContent).toBeUndefined();
    expect(item.createdByUserDetails).toBeUndefined();
  });

  it("get: projects a stable shape and attaches a load-tests deep link", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      identity: "testloadone",
      name: "test-load-one",
      environmentIdentifier: "env90x",
      infraIdentifier: "infra-1",
      targetUrl: "https://www.google.com",
      toolType: "Locust",
      scriptContent: "BIG_BASE64_BLOB",
      updatedByUserDetails: { name: "someone" },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_loadtest", "get", {
      loadtest_id: "testloadone",
      org_id: "templatescopetest",
      project_id: "templatescopetest",
    })) as Record<string, unknown>;

    const call = mockRequest.mock.calls[0][0];
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests/testloadone");

    expect(result.identity).toBe("testloadone");
    expect(result.scriptContent).toBeUndefined();
    expect(result.updatedByUserDetails).toBeUndefined();
    expect(result.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/module/chaos/orgs/templatescopetest/projects/templatescopetest/load-tests/testloadone",
    );
  });
});

describe("chaos_loadtest execute actions", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("run: sends scope in query params without injecting NG scope into the empty body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ runId: "run-123" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_loadtest", "run", {
      loadtest_id: "testloadone",
      org_id: "templatescopetest",
      project_id: "templatescopetest",
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests/testloadone/runs");
    expect(call.params.organizationIdentifier).toBe("templatescopetest");
    expect(call.params.projectIdentifier).toBe("templatescopetest");
    expect(call.body).toEqual({});
  });

  it("stop: sends scope in query params without injecting NG scope into the empty body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ runId: "run-123", status: "Stopped" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_loadtest", "stop", {
      run_id: "run-123",
      org_id: "templatescopetest",
      project_id: "templatescopetest",
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/loadTest/manager/api/v1/runs/run-123/stop");
    expect(call.params.organizationIdentifier).toBe("templatescopetest");
    expect(call.params.projectIdentifier).toBe("templatescopetest");
    expect(call.body).toEqual({});
  });
});
