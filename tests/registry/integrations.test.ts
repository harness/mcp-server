import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import {
  compactDefinition,
  compactIntegration,
  compactJob,
  integrationScopeBase,
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
  it("project scope by default, with default paging", async () => {
    const { registry, client, call } = setup();
    await registry.dispatch(client, "integration", "list", {});
    expect(call().method).toBe("GET");
    expect(call().path).toBe(`${PROJECT}/integrations`);
    expect(call().params).toMatchObject({ page: "0", limit: "30" });
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
