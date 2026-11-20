import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import {
  compactDefinition,
  compactIntegration,
  compactJob,
  integrationScopeBase,
  mergeIntegrationUpdate,
  mergeJobUpdate,
  JOB_READ_ONLY_FIELDS,
  integrationsToolset,
} from "../../src/registry/toolsets/integrations.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { PathBuilderConfig } from "../../src/registry/types.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test-account.tok.secret",
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
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    HARNESS_TOOLSETS: "integrations",
    ...overrides,
  } as Config;
}

type Call = { method: string; path: string; params?: Record<string, unknown>; body?: unknown; headerBasedScoping?: boolean };

function setup(body: unknown = [], headers: Record<string, string> = {}, configOverrides: Partial<Config> = {}) {
  const request = vi.fn(async (options: { onResponseHeaders?: (h: Record<string, string>) => void }) => {
    options.onResponseHeaders?.(headers);
    return body;
  });
  const client = { request, account: "test-account" } as unknown as HarnessClient;
  const registry = new Registry(makeConfig(configOverrides));
  const call = () => request.mock.calls[0]![0] as unknown as Call;
  return { registry, client, request, call };
}

const cfg = { HARNESS_ACCOUNT_ID: "test-account", HARNESS_ORG: "default", HARNESS_PROJECT: "test-project" } as PathBuilderConfig;
const PROJECT = "/connector-control-plane/v1/orgs/default/projects/test-project";

describe("integrationScopeBase", () => {
  it("defaults to project scope from config", () => {
    expect(integrationScopeBase({}, cfg)).toBe(PROJECT);
  });
  it("explicit org/project input wins over config", () => {
    expect(integrationScopeBase({ org_id: "o", project_id: "p" }, cfg)).toBe("/connector-control-plane/v1/orgs/o/projects/p");
  });
  it("resource_scope org drops the project", () => {
    expect(integrationScopeBase({ resource_scope: "org" }, cfg)).toBe("/connector-control-plane/v1/orgs/default");
  });
  it("resource_scope account ignores org/project", () => {
    expect(integrationScopeBase({ resource_scope: "account", org_id: "o", project_id: "p" }, cfg)).toBe("/connector-control-plane/v1");
  });
  it("project scope without a project throws and points at resource_scope", () => {
    expect(() => integrationScopeBase({}, { ...cfg, HARNESS_PROJECT: undefined })).toThrow(/project_id.*resource_scope/);
  });
  it("org scope without an org throws", () => {
    expect(() => integrationScopeBase({ resource_scope: "org" }, { ...cfg, HARNESS_ORG: undefined })).toThrow(/org_id/);
  });
  it("encodes path segments", () => {
    expect(integrationScopeBase({ org_id: "a/b", project_id: "p" }, cfg)).toBe("/connector-control-plane/v1/orgs/a%2Fb/projects/p");
  });
});

describe("integrations toolset registration", () => {
  it("is opt-in", () => {
    expect(integrationsToolset.optIn).toBe(true);
    const defaults = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(defaults.getAllResourceTypes()).not.toContain("integration");
  });
  it("loads with HARNESS_TOOLSETS=integrations", () => {
    const { registry } = setup();
    expect(registry.getResource("integration").toolset).toBe("integrations");
    expect(registry.getResource("integration_job").toolset).toBe("integrations");
  });
});

describe("integration list", () => {
  it("project scope by default, leaving paging defaults to the backend", async () => {
    const { registry, client, call } = setup();
    await registry.dispatch(client, "integration", "list", {});
    expect(call().method).toBe("GET");
    expect(call().path).toBe(`${PROJECT}/integrations`);
    expect(call().params?.limit).toBeUndefined();
  });

  it("org and account scopes", async () => {
    const org = setup();
    await org.registry.dispatch(org.client, "integration", "list", { resource_scope: "org" });
    expect(org.call().path).toBe("/connector-control-plane/v1/orgs/default/integrations");

    const acct = setup();
    await acct.registry.dispatch(acct.client, "integration", "list", { resource_scope: "account" });
    expect(acct.call().path).toBe("/connector-control-plane/v1/integrations");
  });

  it("maps filters and paging onto query params", async () => {
    const { registry, client, call } = setup();
    await registry.dispatch(client, "integration", "list", {
      page: 2, size: 50, search_term: "git", connector: "github,gitlab", auth: "pat", sort: "name,asc",
    });
    expect(call().params).toMatchObject({
      page: 2, limit: 50, search_term: "git", connector: "github,gitlab", auth: "pat", sort: "name,asc",
    });
  });

  it("page 0 is sent", async () => {
    const { registry, client, call } = setup();
    await registry.dispatch(client, "integration", "list", { page: 0 });
    expect(String(call().params?.page)).toBe("0");
  });

  it("sends the account as a header, not as query params", async () => {
    const { registry, client, call } = setup();
    await registry.dispatch(client, "integration", "list", {});
    expect(call().headerBasedScoping).toBe(true);
    expect(call().params).not.toHaveProperty("accountIdentifier");
  });

  it("reports total from X-Total-Elements", async () => {
    const { registry, client } = setup(
      [{ identifier: "a" }, { identifier: "b" }],
      { "x-total-elements": "57", "x-page-number": "0", "x-page-size": "2" },
    );
    const result = (await registry.dispatch(client, "integration", "list", {})) as Record<string, unknown>;
    expect((result.items as unknown[]).length).toBe(2);
    expect(result.total).toBe(57);
    expect(result.has_more).toBe(true);
  });
});

describe("integration get", () => {
  it("GETs the integration by id", async () => {
    const body = { identifier: "gh", name: "GitHub" };
    const { registry, client, call } = setup(body);
    const result = await registry.dispatch(client, "integration", "get", { integration_id: "gh" });
    expect(call().method).toBe("GET");
    expect(call().path).toBe(`${PROJECT}/integrations/gh`);
    expect(result).toEqual(body);
  });

  it("uses the requested scope", async () => {
    const { registry, client, call } = setup({});
    await registry.dispatch(client, "integration", "get", { integration_id: "gh", resource_scope: "account" });
    expect(call().path).toBe("/connector-control-plane/v1/integrations/gh");
  });

  it("throws without integration_id", async () => {
    const { registry, client, request } = setup({});
    await expect(registry.dispatch(client, "integration", "get", {})).rejects.toThrow(/integration_id/);
    expect(request).not.toHaveBeenCalled();
  });
});

describe("integration_job list/get", () => {
  it("lists jobs of an integration, returning the bare array as items", async () => {
    const { registry, client, call } = setup([{ identifier: "nightly" }]);
    const result = (await registry.dispatch(client, "integration_job", "list", { integration_id: "gh" })) as Record<string, unknown>;
    expect(call().path).toBe(`${PROJECT}/integrations/gh/jobs`);
    expect(result.items).toEqual([{ identifier: "nightly" }]);
    expect(result.total).toBe(1);
  });

  it("lists jobs at account scope", async () => {
    const { registry, client, call } = setup([]);
    await registry.dispatch(client, "integration_job", "list", { integration_id: "gh", resource_scope: "account" });
    expect(call().path).toBe("/connector-control-plane/v1/integrations/gh/jobs");
  });

  it("list without integration_id throws naming integration_id", async () => {
    const { registry, client, request } = setup([]);
    await expect(registry.dispatch(client, "integration_job", "list", {})).rejects.toThrow(/integration_id/);
    expect(request).not.toHaveBeenCalled();
  });

  it("gets one job", async () => {
    const { registry, client, call } = setup({ identifier: "nightly" });
    await registry.dispatch(client, "integration_job", "get", { integration_id: "gh", job_id: "nightly" });
    expect(call().method).toBe("GET");
    expect(call().path).toBe(`${PROJECT}/integrations/gh/jobs/nightly`);
  });

  it("get without job_id throws naming job_id", async () => {
    const { registry, client, request } = setup({});
    await expect(registry.dispatch(client, "integration_job", "get", { integration_id: "gh" })).rejects.toThrow(/job_id/);
    expect(request).not.toHaveBeenCalled();
  });

  it("job_id is the last identifier field so resource_id fills it", () => {
    const { registry } = setup();
    expect(registry.getResource("integration_job").identifierFields).toEqual(["integration_id", "job_id"]);
  });
});

describe("list compaction", () => {
  it("compactIntegration keeps identity and uses, drops config blobs", () => {
    const out = compactIntegration({
      identifier: "gh", name: "GitHub", tags: { a: "b" },
      connector: { uses: "github", with: { url: "x" } },
      auth: { uses: "pat", with: { token: "<secret ref>" } },
      runner: { type: "harness_cloud", selectors: [] },
      health: { state: "healthy", detail: "long" },
      version: 3, updated: 1700000000,
    });
    expect(out).toEqual({
      identifier: "gh", name: "GitHub", connector: "github", auth: "pat",
      runner: "harness_cloud", health: "healthy", version: 3, updated: 1700000000,
    });
  });

  it("compactJob keeps state, drops action config, checkpoints, webhook, backfill", () => {
    const out = compactJob({
      identifier: "nightly", name: "N", enabled: false, default: true,
      action: { uses: "githubIngest", with: { orgs: ["h"] } },
      trigger: { uses: "schedule", with: { frequency: "24h" } },
      streams: ["pull_requests"], health: { state: "healthy" }, lastRun: { state: "succeeded", id: "r" },
      nextRunAt: "2026-11-18T00:00:00Z", checkpoints: { a: 1 }, backfillFrom: {}, webhook: { path: "p" },
    });
    expect(out).toEqual({
      identifier: "nightly", name: "N", enabled: false, default: true, action: "githubIngest",
      trigger: { uses: "schedule", with: { frequency: "24h" } }, streams: ["pull_requests"],
      health: "healthy", lastRun: "succeeded", nextRunAt: "2026-11-18T00:00:00Z",
    });
  });
});

describe("integration_definition", () => {
  it("lists the global catalog with no scope in the path", async () => {
    const { registry, client, call } = setup([{ id: "github", category: "connector" }]);
    const result = (await registry.dispatch(client, "integration_definition", "list", {})) as Record<string, unknown>;
    expect(call().method).toBe("GET");
    expect(call().path).toBe("/connector-control-plane/v1/definitions");
    expect(call().headerBasedScoping).toBe(true);
    expect(result.items).toEqual([{ id: "github", category: "connector" }]);
  });

  it("ignores org/project and resource_scope", async () => {
    const { registry, client, call } = setup([]);
    await registry.dispatch(client, "integration_definition", "list", { org_id: "o", project_id: "p" });
    expect(call().path).toBe("/connector-control-plane/v1/definitions");
  });

  it("forwards a category it does not know (the backend owns the list)", async () => {
    const { registry, client, call } = setup([]);
    await registry.dispatch(client, "integration_definition", "list", { category: "sink" });
    expect(call().params).toMatchObject({ category: "sink" });
  });

  it("filters by category", async () => {
    const { registry, client, call } = setup([]);
    await registry.dispatch(client, "integration_definition", "list", { category: "auth" });
    expect(call().params).toMatchObject({ category: "auth" });
  });

  it("does not send detail (full templates come from get)", async () => {
    const { registry, client, call } = setup([]);
    await registry.dispatch(client, "integration_definition", "list", { detail: true });
    expect(call().params).not.toHaveProperty("detail");
  });

  it("gets one definition by id", async () => {
    const body = { id: "githubIngest", category: "action", template: { inputs: [] }, streams: [{ name: "pull_requests", schema: {} }] };
    const { registry, client, call } = setup(body);
    const result = await registry.dispatch(client, "integration_definition", "get", { definition_id: "githubIngest" });
    expect(call().path).toBe("/connector-control-plane/v1/definitions/githubIngest");
    expect(result).toEqual(body);
  });

  it("get without definition_id throws", async () => {
    const { registry, client, request } = setup({});
    await expect(registry.dispatch(client, "integration_definition", "get", {})).rejects.toThrow(/definition_id/);
    expect(request).not.toHaveBeenCalled();
  });

  it("compactDefinition drops icon and author", () => {
    expect(
      compactDefinition({
        id: "github", name: "GitHub", description: "d", author: "harness", category: "connector", version: "1.0.0",
        iconName: "github", vendor: "github", method: null, auth: ["pat", "app"], actions: ["githubIngest"],
      }),
    ).toEqual({
      id: "github", name: "GitHub", description: "d", category: "connector", version: "1.0.0",
      vendor: "github", auth: ["pat", "app"], actions: ["githubIngest"],
    });
  });
});

describe("integration create/delete", () => {
  const body = {
    identifier: "gh",
    name: "GitHub",
    connector: { uses: "github", with: { url: "https://api.github.com" } },
    auth: { uses: "pat", with: { token: "account.ghToken" } },
    runner: { type: "harness_cloud" },
  };

  it("create POSTs the body unchanged at project scope", async () => {
    const { registry, client, call } = setup({ ...body, version: 1 });
    const result = await registry.dispatch(client, "integration", "create", { body });
    expect(call().method).toBe("POST");
    expect(call().path).toBe(`${PROJECT}/integrations`);
    expect(call().body).toEqual(body);
    expect(result).toEqual({ ...body, version: 1 });
  });

  it("create does not inject scope fields into the body", async () => {
    const { registry, client, call } = setup({});
    await registry.dispatch(client, "integration", "create", { body, org_id: "o", project_id: "p" });
    expect(call().path).toBe("/connector-control-plane/v1/orgs/o/projects/p/integrations");
    expect(call().body).not.toHaveProperty("orgIdentifier");
    expect(call().body).not.toHaveProperty("projectIdentifier");
    expect(call().body).not.toHaveProperty("accountIdentifier");
  });

  it("create at account scope", async () => {
    const { registry, client, call } = setup({});
    await registry.dispatch(client, "integration", "create", { body, resource_scope: "account" });
    expect(call().path).toBe("/connector-control-plane/v1/integrations");
  });

  it("create without a body throws before any request", async () => {
    const { registry, client, request } = setup({});
    await expect(registry.dispatch(client, "integration", "create", {})).rejects.toThrow(/body/);
    expect(request).not.toHaveBeenCalled();
  });

  it("create missing required fields names them before any request", async () => {
    const { registry, client, request } = setup({});
    await expect(
      registry.dispatch(client, "integration", "create", { body: { identifier: "gh", name: "GitHub" } }),
    ).rejects.toThrow(/connector, auth, runner/);
    expect(request).not.toHaveBeenCalled();
  });

  it("create is low_write and never retried", () => {
    const { registry } = setup();
    expect(registry.getResource("integration").operations.create?.operationPolicy).toEqual({
      risk: "low_write", retryPolicy: "do_not_retry",
    });
  });

  it("delete sends DELETE to the integration path at the requested scope", async () => {
    const { registry, client, call } = setup(undefined);
    await registry.dispatch(client, "integration", "delete", { integration_id: "gh", resource_scope: "account" });
    expect(call().method).toBe("DELETE");
    expect(call().path).toBe("/connector-control-plane/v1/integrations/gh");
    expect(call().body).toBeUndefined();
  });

  it("delete is destructive and never retried", () => {
    const { registry } = setup();
    expect(registry.getResource("integration").operations.delete?.operationPolicy).toEqual({
      risk: "destructive", retryPolicy: "do_not_retry",
    });
  });

  it("delete without integration_id throws before any request", async () => {
    const { registry, client, request } = setup(undefined);
    await expect(registry.dispatch(client, "integration", "delete", {})).rejects.toThrow(/integration_id/);
    expect(request).not.toHaveBeenCalled();
  });
});

describe("integration update", () => {
  const current = {
    id: "gh", uniqueId: "u1", parentUniqueId: "p1", accountId: "test-account",
    identifier: "gh", name: "Old", description: "desc", tags: { team: "a" },
    connector: { uses: "github", with: { url: "https://api.github.com" } },
    auth: { uses: "pat", with: { token: "account.ghToken" } },
    runner: { type: "harness_cloud", selectors: [] },
    created: 1, updated: 2, createdBy: "x", updatedBy: "y", version: 4, health: "healthy",
  };
  const writable = {
    identifier: "gh", name: "Old", description: "desc", tags: { team: "a" },
    connector: { uses: "github", with: { url: "https://api.github.com" } },
    auth: { uses: "pat", with: { token: "account.ghToken" } },
    runner: { type: "harness_cloud", selectors: [] },
    version: 4,
  };

  function setupUpdate(getBody: unknown = current) {
    const request = vi.fn(async (options: { method: string }) => (options.method === "GET" ? getBody : { ok: true }));
    const client = { request, account: "test-account" } as unknown as HarnessClient;
    const registry = new Registry(makeConfig());
    const calls = () => request.mock.calls.map((c) => c[0] as unknown as Call);
    return { registry, client, request, calls };
  }

  it("GETs then PUTs the merged record with the read version", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration", "update", { integration_id: "gh", body: { name: "New" } });
    const [get, put] = calls();
    expect(get!.method).toBe("GET");
    expect(get!.path).toBe(`${PROJECT}/integrations/gh`);
    expect(put!.method).toBe("PUT");
    expect(put!.path).toBe(`${PROJECT}/integrations/gh`);
    expect(put!.body).toEqual({ ...writable, name: "New" });
  });

  it("drops server-owned fields from the PUT body", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration", "update", { integration_id: "gh", body: { name: "New" } });
    const put = calls()[1]!.body as Record<string, unknown>;
    for (const k of ["id", "uniqueId", "parentUniqueId", "accountId", "created", "updated", "createdBy", "updatedBy", "health"]) {
      expect(put).not.toHaveProperty(k);
    }
  });

  it("explicit version is not overwritten", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration", "update", { integration_id: "gh", body: { name: "New", version: 2 } });
    expect((calls()[1]!.body as Record<string, unknown>).version).toBe(2);
  });

  it("top-level objects replace, not deep-merge", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration", "update", {
      integration_id: "gh", body: { connector: { uses: "github", with: { url: "https://ghe.example.com" } } },
    });
    expect((calls()[1]!.body as Record<string, unknown>).connector).toEqual({ uses: "github", with: { url: "https://ghe.example.com" } });
  });

  it("null clears a field", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration", "update", { integration_id: "gh", body: { description: null } });
    expect(calls()[1]!.body).not.toHaveProperty("description");
  });

  it("accepts a full read-back body (server-owned fields ignored)", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration", "update", { integration_id: "gh", body: { ...current, name: "New" } });
    expect(calls()[1]!.body).toEqual({ ...writable, name: "New" });
  });

  it("a field the backend adds later survives a partial update", async () => {
    const { registry, client, calls } = setupUpdate({ ...current, labels: ["a"] });
    await registry.dispatch(client, "integration", "update", { integration_id: "gh", body: { name: "New" } });
    expect(calls()[1]!.body).toEqual({ ...writable, labels: ["a"], name: "New" });
  });

  it("forwards fields it does not know to the backend, which validates them", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration", "update", { integration_id: "gh", body: { newField: 1 } });
    expect(calls()[1]!.body).toMatchObject({ newField: 1 });
  });

  it("empty or missing body throws before any request", async () => {
    const { registry, client, request } = setupUpdate();
    await expect(registry.dispatch(client, "integration", "update", { integration_id: "gh", body: {} })).rejects.toThrow(/at least one field/);
    await expect(registry.dispatch(client, "integration", "update", { integration_id: "gh" })).rejects.toThrow(/at least one field/);
    expect(request).not.toHaveBeenCalled();
  });

  it("GET and PUT use the same scope", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration", "update", { integration_id: "gh", resource_scope: "account", body: { name: "New" } });
    expect(calls().map((c) => c.path)).toEqual([
      "/connector-control-plane/v1/integrations/gh",
      "/connector-control-plane/v1/integrations/gh",
    ]);
  });

  it("update does not inject scope fields into the body", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration", "update", { integration_id: "gh", org_id: "o", project_id: "p", body: { name: "New" } });
    const put = calls()[1]!.body as Record<string, unknown>;
    expect(put).not.toHaveProperty("orgIdentifier");
    expect(put).not.toHaveProperty("projectIdentifier");
  });

  it("update is medium_write and never retried", () => {
    const { registry } = setupUpdate();
    expect(registry.getResource("integration").operations.update?.operationPolicy).toEqual({
      risk: "medium_write", retryPolicy: "do_not_retry",
    });
  });

  it("mergeIntegrationUpdate keeps falsy-but-set values", () => {
    expect(mergeIntegrationUpdate({ ...writable }, { description: "", tags: {} })).toMatchObject({ description: "", tags: {} });
  });
});

describe("integration_job create/delete", () => {
  const body = {
    identifier: "nightly",
    action: { uses: "githubIngest", with: { org_names: ["harness"] } },
    trigger: { uses: "schedule", with: { frequency: "24h" } },
    streams: ["pull_requests"],
    enabled: false,
  };

  it("create POSTs the body unchanged under the integration", async () => {
    const { registry, client, call } = setup({ ...body, id: "job_1" });
    await registry.dispatch(client, "integration_job", "create", { integration_id: "gh", body });
    expect(call().method).toBe("POST");
    expect(call().path).toBe(`${PROJECT}/integrations/gh/jobs`);
    expect(call().body).toEqual(body);
  });

  it("enabled false and empty streams reach the API", async () => {
    const { registry, client, call } = setup({});
    await registry.dispatch(client, "integration_job", "create", {
      integration_id: "gh", body: { ...body, enabled: false, streams: [], reconcile: false },
    });
    expect(call().body).toMatchObject({ enabled: false, streams: [], reconcile: false });
  });

  it("create does not inject scope fields into the strict body", async () => {
    const { registry, client, call } = setup({});
    await registry.dispatch(client, "integration_job", "create", { integration_id: "gh", org_id: "o", project_id: "p", body });
    expect(call().path).toBe("/connector-control-plane/v1/orgs/o/projects/p/integrations/gh/jobs");
    expect(Object.keys(call().body as object).sort()).toEqual(Object.keys(body).sort());
  });

  it("create at account scope", async () => {
    const { registry, client, call } = setup({});
    await registry.dispatch(client, "integration_job", "create", { integration_id: "gh", resource_scope: "account", body });
    expect(call().path).toBe("/connector-control-plane/v1/integrations/gh/jobs");
  });

  it("create forwards fields it does not know; the strict backend validates them", async () => {
    const { registry, client, call } = setup({});
    await registry.dispatch(client, "integration_job", "create", { integration_id: "gh", body: { ...body, futureField: true } });
    expect(call().body).toEqual({ ...body, futureField: true });
  });

  it("create missing action/trigger names them before any request", async () => {
    const { registry, client, request } = setup({});
    await expect(
      registry.dispatch(client, "integration_job", "create", { integration_id: "gh", body: { identifier: "nightly" } }),
    ).rejects.toThrow(/action, trigger/);
    expect(request).not.toHaveBeenCalled();
  });

  it("create without integration_id throws before any request", async () => {
    const { registry, client, request } = setup({});
    await expect(registry.dispatch(client, "integration_job", "create", { body })).rejects.toThrow(/integration_id/);
    expect(request).not.toHaveBeenCalled();
  });

  it("create returns the response (including a minted webhook token) unchanged", async () => {
    const created = { identifier: "hook", webhook: { path: "gh-events", token: "once" } };
    const { registry, client } = setup(created);
    const result = await registry.dispatch(client, "integration_job", "create", {
      integration_id: "gh", body: { identifier: "hook", action: body.action, trigger: { uses: "webhook", with: { path: "gh-events" } } },
    });
    expect(result).toEqual(created);
  });

  it("create is medium_write and never retried", () => {
    const { registry } = setup();
    expect(registry.getResource("integration_job").operations.create?.operationPolicy).toEqual({
      risk: "medium_write", retryPolicy: "do_not_retry",
    });
  });

  it("delete sends DELETE to the job path", async () => {
    const { registry, client, call } = setup(undefined);
    await registry.dispatch(client, "integration_job", "delete", { integration_id: "gh", job_id: "nightly", resource_scope: "account" });
    expect(call().method).toBe("DELETE");
    expect(call().path).toBe("/connector-control-plane/v1/integrations/gh/jobs/nightly");
  });

  it("delete without job_id throws before any request", async () => {
    const { registry, client, request } = setup(undefined);
    await expect(registry.dispatch(client, "integration_job", "delete", { integration_id: "gh" })).rejects.toThrow(/job_id/);
    expect(request).not.toHaveBeenCalled();
  });

  it("delete is destructive and never retried", () => {
    const { registry } = setup();
    expect(registry.getResource("integration_job").operations.delete?.operationPolicy).toEqual({
      risk: "destructive", retryPolicy: "do_not_retry",
    });
  });
});

describe("integration_job update", () => {
  // A JobView as the backend returns it (ApiSupport.JobView), including the computed resources.empty.
  const current = {
    id: "acc/u1/nightly", identifier: "nightly", name: "Nightly", default: true, enabled: false,
    action: { uses: "githubIngest", with: { org: "harness" } },
    streams: ["pull_requests"],
    trigger: { uses: "schedule", with: { frequency: "1d" } },
    webhook: null, nextRunAt: "2026-11-20T00:00:00Z", lastRun: { state: "succeeded" },
    createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-02T00:00:00Z", integration: "gh",
    checkpoints: { pull_requests: { runId: "r1", at: "2026-11-02T00:00:00Z" } },
    backfillFrom: { pull_requests: "r0" }, sink: "topic-1", health: { state: "healthy" },
    rateLimitedUntil: null, actionVersion: "1.3.2",
    resources: { cpu: "500m", memory: "1Gi", ephemeralStorage: null, empty: false },
  };
  const JOB = `${PROJECT}/integrations/gh/jobs/nightly`;

  function setupUpdate(getBody: unknown = current, putBody: unknown = { identifier: "nightly" }) {
    const request = vi.fn(async (options: { method: string }) => (options.method === "GET" ? getBody : putBody));
    const client = { request, account: "test-account" } as unknown as HarnessClient;
    const registry = new Registry(makeConfig());
    const calls = () => request.mock.calls.map((c) => c[0] as unknown as Call);
    return { registry, client, request, calls };
  }
  const putBody = (calls: () => Call[]) => calls()[1]!.body as Record<string, unknown>;

  it("GETs the job then PUTs the merged writable fields only", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration_job", "update", { integration_id: "gh", job_id: "nightly", body: { name: "Renamed" } });
    const [get, put] = calls();
    expect(get!.method).toBe("GET");
    expect(get!.path).toBe(JOB);
    expect(put!.method).toBe("PUT");
    expect(put!.path).toBe(JOB);
    expect(put!.body).toEqual({
      identifier: "nightly", name: "Renamed", enabled: false,
      action: { uses: "githubIngest", with: { org: "harness" } },
      streams: ["pull_requests"],
      trigger: { uses: "schedule", with: { frequency: "1d" } },
      resources: { cpu: "500m", memory: "1Gi", ephemeralStorage: null },
    });
  });

  it("strips every read-only JobView field and resources.empty (the strict PUT rejects them)", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration_job", "update", { integration_id: "gh", job_id: "nightly", body: { name: "x" } });
    const body = putBody(calls);
    for (const k of JOB_READ_ONLY_FIELDS) expect(body).not.toHaveProperty(k);
    expect(body.resources).not.toHaveProperty("empty");
  });

  it("keeps enabled:false from the read, so an update does not re-enable a paused job", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration_job", "update", { integration_id: "gh", job_id: "nightly", body: { streams: [] } });
    expect(putBody(calls).enabled).toBe(false);
    expect(putBody(calls).streams).toEqual([]);
  });

  it("enabled:false in the patch is sent (falsy value kept)", async () => {
    const { registry, client, calls } = setupUpdate({ ...current, enabled: true });
    await registry.dispatch(client, "integration_job", "update", { integration_id: "gh", job_id: "nightly", body: { enabled: false } });
    expect(putBody(calls).enabled).toBe(false);
  });

  it("top-level objects replace whole; null clears a field", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration_job", "update", {
      integration_id: "gh", job_id: "nightly",
      body: { trigger: { uses: "schedule", with: { frequency: "6h" } }, resources: null },
    });
    expect(putBody(calls).trigger).toEqual({ uses: "schedule", with: { frequency: "6h" } });
    expect(putBody(calls)).not.toHaveProperty("resources");
  });

  it("a field the backend adds to JobView later is carried over", async () => {
    const { registry, client, calls } = setupUpdate({ ...current, labels: { team: "a" } });
    await registry.dispatch(client, "integration_job", "update", { integration_id: "gh", job_id: "nightly", body: { name: "x" } });
    expect(putBody(calls).labels).toEqual({ team: "a" });
  });

  it("hints that syncModes and reconcile were reset when neither is passed", async () => {
    const { registry, client } = setupUpdate();
    const result = await registry.dispatch(client, "integration_job", "update", { integration_id: "gh", job_id: "nightly", body: { name: "x" } }) as Record<string, unknown>;
    expect(result.identifier).toBe("nightly");
    expect(String(result._hint)).toMatch(/^syncModes and reconcile: not passed, so reset/);
  });

  it("hint names only the field not passed", async () => {
    const { registry, client } = setupUpdate();
    const result = await registry.dispatch(client, "integration_job", "update", {
      integration_id: "gh", job_id: "nightly", body: { syncModes: { pull_requests: "incremental" } },
    }) as Record<string, unknown>;
    expect(String(result._hint)).toMatch(/^reconcile: /);
  });

  it("no hint when both are passed, and they are sent", async () => {
    const { registry, client, calls } = setupUpdate();
    const result = await registry.dispatch(client, "integration_job", "update", {
      integration_id: "gh", job_id: "nightly", body: { syncModes: { pull_requests: "full_refresh" }, reconcile: false },
    }) as Record<string, unknown>;
    expect(result).not.toHaveProperty("_hint");
    expect(putBody(calls).syncModes).toEqual({ pull_requests: "full_refresh" });
    expect(putBody(calls).reconcile).toBe(false);
  });

  it("forwards fields it does not know; the strict backend validates them", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration_job", "update", { integration_id: "gh", job_id: "nightly", body: { foo: 1 } });
    expect(putBody(calls).foo).toBe(1);
  });

  it("does not inject scope keys into the strict body", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration_job", "update", { integration_id: "gh", job_id: "nightly", body: { name: "x" } });
    const body = putBody(calls);
    for (const k of ["orgIdentifier", "projectIdentifier", "accountIdentifier", "org", "project"]) expect(body).not.toHaveProperty(k);
  });

  it("GET and PUT use the same scope (account)", async () => {
    const { registry, client, calls } = setupUpdate();
    await registry.dispatch(client, "integration_job", "update", {
      integration_id: "gh", job_id: "nightly", resource_scope: "account", body: { name: "x" },
    });
    const [get, put] = calls();
    expect(get!.path).toBe("/connector-control-plane/v1/integrations/gh/jobs/nightly");
    expect(put!.path).toBe(get!.path);
  });

  it("empty or missing body throws before any request", async () => {
    for (const body of [undefined, {}, "x"]) {
      const { registry, client, request } = setupUpdate();
      await expect(
        registry.dispatch(client, "integration_job", "update", { integration_id: "gh", job_id: "nightly", body }),
      ).rejects.toThrow(/at least one field/);
      expect(request).not.toHaveBeenCalled();
    }
  });

  it("missing job_id throws before any request", async () => {
    const { registry, client, request } = setupUpdate();
    await expect(
      registry.dispatch(client, "integration_job", "update", { integration_id: "gh", body: { name: "x" } }),
    ).rejects.toThrow(/job_id/);
    expect(request).not.toHaveBeenCalled();
  });

  it("is medium_write", () => {
    const def = integrationsToolset.resources.find((r) => r.resourceType === "integration_job")!;
    expect(def.operations.update!.operationPolicy).toEqual({ risk: "medium_write", retryPolicy: "do_not_retry" });
  });

  it("mergeJobUpdate leaves resources alone when the read has none", () => {
    const { resources: _r, ...withoutResources } = current;
    expect(mergeJobUpdate(withoutResources, { name: "x" })).not.toHaveProperty("resources");
  });
});

describe("integration list_options", () => {
  const source = {
    action: "githubListRepos", with: { orgs: ["harness"] },
    items: "repositories", value: "full_name", label: "full_name", fields: ["default_branch"],
  };
  const answer = { options: [{ value: "harness/a", label: "harness/a", fields: { default_branch: "main" } }], truncated: false, cached: true, age: "PT42S" };

  it("POSTs to the scope's options route with the integration named in the body", async () => {
    const { registry, client, call } = setup(answer);
    const result = await registry.dispatchExecute(client, "integration", "list_options", { integration_id: "gh", body: { source } });
    expect(call().method).toBe("POST");
    expect(call().path).toBe(`${PROJECT}/options`);
    expect(call().body).toEqual({ source: { ...source, integration: "gh" } });
    expect(result).toEqual(answer);
  });

  it("account and org scope use their own options route", async () => {
    let s = setup(answer);
    await s.registry.dispatchExecute(s.client, "integration", "list_options", { integration_id: "gh", resource_scope: "account", body: { source } });
    expect(s.call().path).toBe("/connector-control-plane/v1/options");
    s = setup(answer);
    await s.registry.dispatchExecute(s.client, "integration", "list_options", { integration_id: "gh", resource_scope: "org", body: { source } });
    expect(s.call().path).toBe("/connector-control-plane/v1/orgs/default/options");
  });

  it("passes refresh and fields it does not know through; the strict backend validates them", async () => {
    const { registry, client, call } = setup(answer);
    await registry.dispatchExecute(client, "integration", "list_options", {
      integration_id: "gh", body: { source: { ...source, search: "a" }, refresh: false },
    });
    expect(call().body).toEqual({ source: { ...source, search: "a", integration: "gh" }, refresh: false });
  });

  it("does not inject scope keys into the strict body", async () => {
    const { registry, client, call } = setup(answer);
    await registry.dispatchExecute(client, "integration", "list_options", { integration_id: "gh", body: { source } });
    const body = call().body as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["source"]);
    expect(call().headerBasedScoping).toBe(true);
  });

  it("source.integration matching integration_id is accepted; a different one throws before any request", async () => {
    let s = setup(answer);
    await s.registry.dispatchExecute(s.client, "integration", "list_options", { integration_id: "gh", body: { source: { ...source, integration: "gh" } } });
    expect(s.request).toHaveBeenCalledTimes(1);
    s = setup(answer);
    await expect(
      s.registry.dispatchExecute(s.client, "integration", "list_options", { integration_id: "gh", body: { source: { ...source, integration: "account.other" } } }),
    ).rejects.toThrow(/does not match integration_id/);
    expect(s.request).not.toHaveBeenCalled();
  });

  it("missing integration_id or source throws before any request", async () => {
    for (const input of [{ body: { source } }, { integration_id: "gh" }, { integration_id: "gh", body: { refresh: true } }]) {
      const { registry, client, request } = setup(answer);
      await expect(registry.dispatchExecute(client, "integration", "list_options", input)).rejects.toThrow(/integration_id|source/);
      expect(request).not.toHaveBeenCalled();
    }
  });

  it("is a read with safe retries", () => {
    const def = integrationsToolset.resources.find((r) => r.resourceType === "integration")!;
    expect(def.executeActions!.list_options!.operationPolicy).toEqual({ risk: "read", retryPolicy: "safe" });
  });
});
