/**
 * HAR v3 Conan drill-down — nested path params, encoding, account-only scope
 * and required parent identifiers.
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

describe("HAR v3 Conan resources", () => {
  const registry = new Registry(makeConfig());

  it.each([
    ["conan_recipe_revision_v3", "list", BASE],
    ["conan_recipe_revision_v3", "get", `${BASE}/rrev-1/details`],
    ["conan_package_v3", "list", `${BASE}/rrev-1/packages`],
    ["conan_package_v3", "get", `${BASE}/rrev-1/packages/pkg-1/details`],
    ["conan_package_revision_v3", "list", `${BASE}/rrev-1/packages/pkg-1/package-revisions`],
    ["conan_package_revision_v3", "get", `${BASE}/rrev-1/packages/pkg-1/package-revisions/prev-1/details`],
  ] as const)("%s.%s builds %s with account-only scope", async (resourceType, op, path) => {
    const client = mockClient(op === "list" ? { items: [], page: 0, size: 20, hasMore: false } : { data: { id: "x" } });
    await registry.dispatch(client, resourceType, op, { ...IDS });

    const call = lastCall(client);
    expect(call.method).toBe("GET");
    expect(call.path).toBe(path);
    expect(call.params.account_identifier).toBe("acct123");
    expect(call.params.org_identifier).toBeUndefined();
    expect(call.params.project_identifier).toBeUndefined();
  });

  it("detail responses are unwrapped from { data }", async () => {
    const client = mockClient({ data: { id: "rrev-1", recipeRevision: "abc", packageCount: 3 } });
    const result = (await registry.dispatch(client, "conan_recipe_revision_v3", "get", IDS)) as Record<string, unknown>;
    expect(result.packageCount).toBe(3);
    expect(result.data).toBeUndefined();
  });

  it("list keeps full items (no generic compaction) and forwards pagination", async () => {
    const client = mockClient({ items: [{ id: "p", settings: { os: "Linux" } }], page: 1, size: 5, hasMore: true });
    const result = (await registry.dispatch(client, "conan_package_v3", "list", { ...IDS, page: 1, size: 5 })) as Record<string, unknown>;
    const call = lastCall(client);
    expect(call.params.page).toBe(1);
    expect(call.params.size).toBe(5);
    expect(result.hasMore).toBe(true);
  });

  it("encodes nested path segments", async () => {
    const client = mockClient({ data: {} });
    await registry.dispatch(client, "conan_package_v3", "get", { ...IDS, conan_package_id: "a/b" });
    expect(lastCall(client).path).toBe(`${BASE}/rrev-1/packages/a%2Fb/details`);
  });

  it("list fails fast when a parent id is missing", async () => {
    const client = mockClient({ items: [] });
    await expect(
      registry.dispatch(client, "conan_package_revision_v3", "list", { version_id: "ver-1", recipe_revision_id: "rrev-1" }),
    ).rejects.toThrow(/conan_package_id/);
    expect(client.request).not.toHaveBeenCalled();
  });

  it("stays behind the registries-v3 opt-in", () => {
    const defaults = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined })).getAllResourceTypes();
    expect(defaults).not.toContain("conan_recipe_revision_v3");
    expect(new Registry(makeConfig()).getAllResourceTypes()).toContain("conan_package_revision_v3");
  });
});
