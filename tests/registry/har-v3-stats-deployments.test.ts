/**
 * HAR v3 batch stats and version deployments, modelled as read-only execute
 * actions on their parent resources (registry, package, package_version).
 */
import { describe, it, expect, vi } from "vitest";
import * as z from "zod/v4";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { buildIdListBody } from "../../src/utils/body-normalizer.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { ACCEPTED_CONFIRMATION, toolHandlerContext } from "../helpers/request-context.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "acct123",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "PROD",
    HARNESS_PROJECT: "Harness_Commons",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "+registries-v3",
    ...overrides,
  };
}

function mockClient(response: unknown): HarnessClient {
  return {
    request: vi.fn().mockResolvedValue(response),
  } as unknown as HarnessClient;
}

const lastCall = (client: HarnessClient) =>
  (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];

describe("buildIdListBody", () => {
  const build = buildIdListBody({ singleKey: "package_id", listKey: "package_ids", bodyKey: "packageIds", max: 3 });

  it("merges the single id with a comma-separated list, trimming and de-duplicating", () => {
    expect(build({ package_id: "a", package_ids: " a, b ,, c" })).toEqual({ packageIds: ["a", "b", "c"] });
  });

  it("accepts an array", () => {
    expect(build({ package_ids: ["x", "y"] })).toEqual({ packageIds: ["x", "y"] });
  });

  it("rejects an empty list", () => {
    expect(() => build({ package_ids: " , " })).toThrow(/package_id/);
  });

  it("rejects more than max ids", () => {
    expect(() => build({ package_ids: "a,b,c,d" })).toThrow(/at most 3/);
  });

  it("rejects non-string ids instead of sending \"[object Object]\"", () => {
    expect(() => build({ package_ids: [{ id: "a" }] })).toThrow(/must contain string ids, got object/);
    expect(() => build({ package_ids: ["a", null] })).toThrow(/got null/);
  });

  it("rejects numeric ids, since stats ids are UUID strings", () => {
    expect(() => build({ package_ids: [1, 2] })).toThrow(/must contain string ids, got number/);
    expect(() => build({ package_id: 123 })).toThrow(/got number/);
  });

  it("only mentions resource_id when a single-id key is configured", () => {
    const listOnly = buildIdListBody({ listKey: "registry_uuids", bodyKey: "registryIds", max: 3 });
    expect(() => listOnly({ registry_uuids: "" })).toThrow("Pass registry_uuids (comma-separated, up to 3).");
    expect(() => listOnly({ registry_uuid: "r1" })).toThrow(/Pass registry_uuids/);
  });
});

describe("stats execute actions", () => {
  const registry = new Registry(makeConfig());

  it.each([
    ["package", { package_id: "p1", package_ids: "p2" }, "/har/api/v3/packages/stats", { packageIds: ["p1", "p2"] }],
    ["package_version", { version_ids: ["v1", "v2"] }, "/har/api/v3/versions/stats", { versionIds: ["v1", "v2"] }],
    ["registry", { registry_uuids: "r-uuid-1,r-uuid-2", scope: "descendants" }, "/har/api/v3/registries/stats", { registryIds: ["r-uuid-1", "r-uuid-2"] }],
  ])("%s.stats POSTs the ids with project scope params", async (resourceType, input, path, body) => {
    const client = mockClient({ items: [{ id: "x", downloadCount: 3 }] });
    const result = (await registry.dispatchExecute(client, resourceType, "stats", input)) as { items: unknown[] };

    const call = lastCall(client);
    expect(call.method).toBe("POST");
    expect(call.path).toBe(path);
    expect(call.body).toEqual(body);
    expect(call.params).toMatchObject({
      account_identifier: "acct123",
      org_identifier: "PROD",
      project_identifier: "Harness_Commons",
    });
    expect(result.items).toHaveLength(1);
  });

  it("registry.stats forwards the scope query param", async () => {
    const client = mockClient({ items: [] });
    await registry.dispatchExecute(client, "registry", "stats", { registry_uuids: "r1", scope: "descendants" });
    expect(lastCall(client).params.scope).toBe("descendants");
  });

  it("stats are allowed in read-only mode", async () => {
    const readOnly = new Registry(makeConfig({ HARNESS_READ_ONLY: true }));
    const client = mockClient({ items: [] });
    await readOnly.dispatchExecute(client, "package_version", "stats", { version_ids: "v1" });
    expect(client.request).toHaveBeenCalledOnce();
  });

  it("accepts exactly 100 ids", async () => {
    const client = mockClient({ items: [] });
    const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`).join(",");
    await registry.dispatchExecute(client, "package", "stats", { package_ids: ids });
    expect((lastCall(client).body as { packageIds: string[] }).packageIds).toHaveLength(100);
  });

  it("rejects over-limit ids before calling the API", async () => {
    const client = mockClient({ items: [] });
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`).join(",");
    await expect(registry.dispatchExecute(client, "package", "stats", { package_ids: ids })).rejects.toThrow(/at most 100/);
    expect(client.request).not.toHaveBeenCalled();
  });
});

describe("stats through harness_execute", () => {
  async function setup(overrides: Partial<Config> = {}) {
    const tools = new Map<string, { schema: { inputSchema: z.ZodType }; handler: (...a: unknown[]) => Promise<ToolResult> }>();
    const server = {
      server: { getClientCapabilities: () => ({}) },
      registerTool: vi.fn((name: string, schema: { inputSchema: z.ZodType }, handler: (...a: unknown[]) => Promise<ToolResult>) => {
        tools.set(name, { schema, handler });
      }),
    };
    const config = makeConfig(overrides);
    const client = mockClient({ items: [] });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server as never, new Registry(config), client, config);
    return { tool: tools.get("harness_execute")!, client };
  }

  async function callExecute(args: Record<string, unknown>, overrides: Partial<Config> = {}) {
    const { tool, client } = await setup(overrides);
    const result = await tool.handler(args, toolHandlerContext(new AbortController().signal, ACCEPTED_CONFIRMATION));
    return { result, client };
  }

  it("advertises resource_scope on the registered harness_execute schema", async () => {
    const { tool } = await setup();
    const props = (z.toJSONSchema(tool.schema.inputSchema) as { properties: Record<string, { enum?: string[] }> }).properties;
    expect(props.resource_scope?.enum).toEqual(expect.arrayContaining(["account", "org", "project"]));
    expect(props.resource_id).toBeDefined();
  });

  it.each([
    ["account", undefined, undefined],
    ["org", "PROD", undefined],
  ])("package.stats honours explicit resource_scope=%s", async (scope, org, project) => {
    const { result, client } = await callExecute({ resource_type: "package", action: "stats", resource_id: "p-uuid-1", resource_scope: scope });
    expect(result.isError).toBeUndefined();
    const { params } = lastCall(client);
    expect(params.account_identifier).toBe("acct123");
    expect(params.org_identifier).toBe(org);
    expect(params.project_identifier).toBe(project);
  });

  it("package.stats takes org and project from a Harness URL over the configured defaults", async () => {
    const { client } = await callExecute({
      url: "https://app.harness.io/ng/account/acct123/module/har/orgs/urlOrg/projects/urlProject/registries",
      resource_type: "package",
      action: "stats",
      params: { package_ids: "p-uuid-1" },
    });
    const { params, body } = lastCall(client);
    expect(params.org_identifier).toBe("urlOrg");
    expect(params.project_identifier).toBe("urlProject");
    expect(body).toEqual({ packageIds: ["p-uuid-1"] });
  });

  it("package.stats runs in read-only mode through harness_execute", async () => {
    const { result, client } = await callExecute(
      { resource_type: "package", action: "stats", resource_id: "p-uuid-1" },
      { HARNESS_READ_ONLY: true },
    );
    expect(result.isError).toBeUndefined();
    expect(client.request).toHaveBeenCalledOnce();
  });

  it.each([
    ["package", "/har/api/v3/packages/stats", { packageIds: ["p-uuid-1"] }],
    ["package_version", "/har/api/v3/versions/stats", { versionIds: ["v-uuid-1"] }],
  ])("%s.stats maps resource_id to the single id", async (resourceType, path, body) => {
    const id = Object.values(body)[0]![0];
    const { result, client } = await callExecute({ resource_type: resourceType, action: "stats", resource_id: id });
    expect(result.isError).toBeUndefined();
    expect(lastCall(client).path).toBe(path);
    expect(lastCall(client).body).toEqual(body);
  });

  it("package.stats merges resource_id with params.package_ids", async () => {
    const { client } = await callExecute({
      resource_type: "package",
      action: "stats",
      resource_id: "p-uuid-1",
      params: { package_ids: "p-uuid-2,p-uuid-1" },
    });
    expect(lastCall(client).body).toEqual({ packageIds: ["p-uuid-1", "p-uuid-2"] });
  });
});

describe("package_version.deployments", () => {
  const registry = new Registry(makeConfig());

  it("is account-scoped, forwards filters and surfaces prod/non-prod counts", async () => {
    const client = mockClient({
      items: [{ envName: "prod-us", serviceName: "web" }],
      page: 0,
      size: 20,
      hasMore: false,
      meta: { prodEnvCount: 1, nonProdEnvCount: 2, futureKey: "x" },
    });
    const result = (await registry.dispatchExecute(client, "package_version", "deployments", {
      version_id: "ver-1",
      package_tag: "v1.2.3",
      env_type: "PRODUCTION",
    })) as Record<string, unknown>;

    const call = lastCall(client);
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/har/api/v3/versions/ver-1/deployments");
    expect(call.params.account_identifier).toBe("acct123");
    expect(call.params.org_identifier).toBeUndefined();
    expect(call.params.project_identifier).toBeUndefined();
    expect(call.params.package_tag).toBe("v1.2.3");
    expect(call.params.env_type).toBe("PRODUCTION");
    expect(call.body).toBeUndefined();
    expect(result.items).toHaveLength(1);
    expect(result.prodEnvCount).toBe(1);
    expect(result.nonProdEnvCount).toBe(2);
    expect(result.meta).toBeUndefined();
  });
});

describe("package and package_version scopes", () => {
  const registry = new Registry(makeConfig());

  it.each(["package", "package_version"])("%s list supports resource_scope=account", async (resourceType) => {
    const client = mockClient({ items: [] });
    await registry.dispatch(client, resourceType, "list", { resource_scope: "account" });
    const call = lastCall(client);
    expect(call.params.account_identifier).toBe("acct123");
    expect(call.params.org_identifier).toBeUndefined();
    expect(call.params.project_identifier).toBeUndefined();
  });

  it("adds no new resource types", () => {
    const types = registry.getAllResourceTypes();
    for (const t of ["registry_stats_v3", "package_stats_v3", "version_stats_v3", "version_deployment_v3", "system_info_v3", "file_detail_v3"]) {
      expect(types).not.toContain(t);
    }
  });
});
