/**
 * HAR v3 Conan drill-down — one conan_revision resource whose path depth follows
 * the ids given; encoding, account-only scope and parent-id validation.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

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

const BASE = "/har/api/v3/versions/ver-1/conan/recipe-revisions";
const IDS = {
  version_id: "ver-1",
  recipe_revision_id: "rrev-1",
  conan_package_id: "pkg-1",
  package_revision_id: "prev-1",
};

describe("HAR v3 conan_revision", () => {
  const registry = new Registry(makeConfig());
  const { version_id, recipe_revision_id, conan_package_id, package_revision_id } = IDS;

  it.each([
    ["list", { version_id }, BASE],
    ["list", { version_id, recipe_revision_id }, `${BASE}/rrev-1/packages`],
    ["list", { version_id, recipe_revision_id, conan_package_id }, `${BASE}/rrev-1/packages/pkg-1/package-revisions`],
    ["get", { version_id, recipe_revision_id }, `${BASE}/rrev-1/details`],
    ["get", { version_id, recipe_revision_id, conan_package_id }, `${BASE}/rrev-1/packages/pkg-1/details`],
    ["get", IDS, `${BASE}/rrev-1/packages/pkg-1/package-revisions/prev-1/details`],
  ] as const)("%s with %o builds %s with account-only scope", async (op, input, path) => {
    const client = mockClient(op === "list" ? { items: [], page: 0, size: 20, hasMore: false } : { data: { id: "x" } });
    await registry.dispatch(client, "conan_revision", op, { ...input });

    const call = lastCall(client);
    expect(call.method).toBe("GET");
    expect(call.path).toBe(path);
    expect(call.params.account_identifier).toBe("acct123");
    expect(call.params.org_identifier).toBeUndefined();
    expect(call.params.project_identifier).toBeUndefined();
  });

  it("detail responses are unwrapped from { data }", async () => {
    const client = mockClient({ data: { id: "rrev-1", recipeRevision: "abc", packageCount: 3 } });
    const result = (await registry.dispatch(client, "conan_revision", "get", { version_id, recipe_revision_id })) as Record<string, unknown>;
    expect(result.packageCount).toBe(3);
    expect(result.data).toBeUndefined();
  });

  it("list keeps Conan settings on items and forwards pagination", async () => {
    const settings = { os: "Linux", arch: "x86_64", compiler: "gcc" };
    const client = mockClient({ items: [{ id: "p", settings }], page: 1, size: 5, hasMore: true });
    const result = (await registry.dispatch(client, "conan_revision", "list", {
      version_id, recipe_revision_id, page: 1, size: 5,
    })) as { items: Array<Record<string, unknown>>; hasMore: boolean };
    const call = lastCall(client);
    expect(call.params.page).toBe(1);
    expect(call.params.size).toBe(5);
    expect(result.hasMore).toBe(true);
    expect(result.items[0]!.settings).toEqual(settings);
    expect(registry.getResource("conan_revision").operations.list!.skipCompact).toBe(true);
  });

  it("encodes nested path segments", async () => {
    const client = mockClient({ data: {} });
    await registry.dispatch(client, "conan_revision", "get", { version_id, recipe_revision_id, conan_package_id: "a/b" });
    expect(lastCall(client).path).toBe(`${BASE}/rrev-1/packages/a%2Fb/details`);
  });

  it.each([
    ["list", { recipe_revision_id }, /version_id/],
    ["list", IDS, /package_revision_id is not a list level/],
    ["list", { version_id, conan_package_id }, /requires recipe_revision_id/],
    ["get", { version_id }, /Missing required param\(s\) for conan_revision.get: recipe_revision_id/],
    ["get", { version_id, recipe_revision_id, package_revision_id }, /requires conan_package_id/],
  ] as const)("%s with %o fails before any API call", async (op, input, error) => {
    const client = mockClient({ items: [] });
    await expect(registry.dispatch(client, "conan_revision", op, { ...input })).rejects.toThrow(error);
    expect(client.request).not.toHaveBeenCalled();
  });

  it("accepts numeric ids such as revision 0", async () => {
    const client = mockClient({ data: {} });
    await registry.dispatch(client, "conan_revision", "get", { version_id, recipe_revision_id: 0 });
    expect(lastCall(client).path).toBe(`${BASE}/0/details`);
  });

  it.each([
    [{ version_id: {}, recipe_revision_id }, /version_id must be a string or number, got object/],
    [{ version_id, recipe_revision_id: ["rrev-1"] }, /recipe_revision_id must be a string or number, got array/],
    [{ version_id: "   ", recipe_revision_id }, /requires version_id/],
    [{ version_id, recipe_revision_id: "  " }, /requires recipe_revision_id/],
  ] as const)("rejects %o instead of building a bad path", async (input, error) => {
    const client = mockClient({ data: {} });
    await expect(registry.dispatch(client, "conan_revision", "get", { ...input })).rejects.toThrow(error);
    expect(client.request).not.toHaveBeenCalled();
  });

  it("advertises every get level, including package_revision_id, through paramsSchema", () => {
    const get = registry.getResource("conan_revision").operations.get!;
    expect(get.paramsSchema?.fields.map((f) => f.name)).toEqual(["version_id", "recipe_revision_id", "conan_package_id", "package_revision_id"]);
    expect(get.paramsSchema?.fields.find((f) => f.name === "version_id")?.required).toBe(true);
    expect(get.description).toMatch(/conan_package_id/);
    expect(get.description).toMatch(/package_revision_id/);
  });

  it("replaces the per-level Conan types and stays behind the registries-v3 opt-in", () => {
    const types = new Registry(makeConfig()).getAllResourceTypes();
    expect(types).toContain("conan_revision");
    for (const old of ["conan_recipe_revision_v3", "conan_package_v3", "conan_package_revision_v3"]) {
      expect(types).not.toContain(old);
    }
    expect(new Registry(makeConfig({ HARNESS_TOOLSETS: undefined })).getAllResourceTypes()).not.toContain("conan_revision");
  });
});

describe("harness_get conan_revision", () => {
  async function callGet(args: Record<string, unknown>) {
    const request = vi.fn().mockResolvedValue({ data: { id: "x" } });
    const client = { request, account: "acct123" } as unknown as HarnessClient;
    let handler: ((a: unknown, extra: unknown) => Promise<{ isError?: boolean }>) | undefined;
    const server = {
      server: { getClientCapabilities: () => ({}) },
      registerTool: (_name: string, _schema: unknown, h: typeof handler) => { handler = h; },
    };
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server as never, new Registry(makeConfig()), client);
    const result = await handler!(args, { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} });
    return { result, request };
  }

  it("maps resource_id to recipe_revision_id with version_id in params", async () => {
    const { result, request } = await callGet({ resource_type: "conan_revision", resource_id: "rrev-1", params: { version_id: "ver-1" } });
    expect(result.isError).toBeUndefined();
    expect(request.mock.calls[0][0].path).toBe(`${BASE}/rrev-1/details`);
  });

  it.each([
    [{ version_id: "ver-1", recipe_revision_id: "rrev-1" }, "pkg-1"],
    [{ version_id: "ver-1", recipe_revision_id: "rrev-1", conan_package_id: "pkg-1" }, "prev-1"],
  ])("fails instead of returning the parent when resource_id is not consumed (%o, resource_id %s)", async (params, resourceId) => {
    const { result, request } = await callGet({ resource_type: "conan_revision", resource_id: resourceId, params });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toMatch(/conflicts with recipe_revision_id/);
    expect(request).not.toHaveBeenCalled();
  });

  it("allows resource_id that matches params.recipe_revision_id", async () => {
    const { result, request } = await callGet({
      resource_type: "conan_revision",
      resource_id: "rrev-1",
      params: { version_id: "ver-1", recipe_revision_id: "rrev-1" },
    });
    expect(result.isError).toBeUndefined();
    expect(request.mock.calls[0][0].path).toBe(`${BASE}/rrev-1/details`);
  });

  it("reaches deeper levels with the later ids passed only as params", async () => {
    const { result, request } = await callGet({
      resource_type: "conan_revision",
      params: { version_id: "ver-1", recipe_revision_id: "rrev-1", conan_package_id: "pkg-1", package_revision_id: "prev-1" },
    });
    expect(result.isError).toBeUndefined();
    expect(request.mock.calls[0][0].path).toBe(`${BASE}/rrev-1/packages/pkg-1/package-revisions/prev-1/details`);
  });
});
