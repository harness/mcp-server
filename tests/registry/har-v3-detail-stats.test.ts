/**
 * HAR v3 single-item detail, system info, version deployments and stats
 * resources — paths, scope params (account-only vs project), request bodies,
 * and response unwrapping.
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

function expectAccountOnly(call: { params: Record<string, unknown> }) {
  expect(call.params.account_identifier).toBe("acct123");
  expect(call.params.org_identifier).toBeUndefined();
  expect(call.params.project_identifier).toBeUndefined();
}

describe("HAR v3 detail resources", () => {
  const registry = new Registry(makeConfig());

  it("version_detail_v3.get hits /versions/{id}, is account-scoped, and unwraps data", async () => {
    const client = mockClient({ data: { id: "ver-1", name: "1.0.0", packageType: "NPM", pullCommand: "npm i x@1.0.0" } });
    const result = (await registry.dispatch(client, "version_detail_v3", "get", { version_id: "ver-1" })) as Record<string, unknown>;

    const call = lastCall(client);
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/har/api/v3/versions/ver-1");
    expectAccountOnly(call);
    expect(result.pullCommand).toBe("npm i x@1.0.0");
    expect(result.data).toBeUndefined();
  });

  it("file_detail_v3.get hits /files/{id} and returns downloadUrl, not bytes", async () => {
    const client = mockClient({ data: { id: "f-1", name: "x.tgz", downloadUrl: "https://pkg/x.tgz", contentType: "application/gzip" } });
    const result = (await registry.dispatch(client, "file_detail_v3", "get", { file_id: "f-1" })) as Record<string, unknown>;

    const call = lastCall(client);
    expect(call.path).toBe("/har/api/v3/files/f-1");
    expectAccountOnly(call);
    expect(result.downloadUrl).toBe("https://pkg/x.tgz");
  });

  it("file_detail_v3.get encodes the file id path segment", async () => {
    const client = mockClient({ data: {} });
    await registry.dispatch(client, "file_detail_v3", "get", { file_id: "a/b" });
    expect(lastCall(client).path).toBe("/har/api/v3/files/a%2Fb");
  });

  it("system_info_v3.get needs no identifier and unwraps registryHost/registryUrl", async () => {
    const client = mockClient({ data: { registryHost: "pkg.harness.io", registryUrl: "https://pkg.harness.io" } });
    const result = (await registry.dispatch(client, "system_info_v3", "get", {})) as Record<string, unknown>;

    const call = lastCall(client);
    expect(call.path).toBe("/har/api/v3/system/info");
    expectAccountOnly(call);
    expect(result.registryHost).toBe("pkg.harness.io");
  });

  it("version_deployment_v3.list forwards package_tag/env_type and surfaces prod/non-prod counts", async () => {
    const client = mockClient({
      items: [{ envName: "prod-us", serviceName: "web" }],
      page: 0,
      size: 20,
      hasMore: false,
      meta: { prodEnvCount: 1, nonProdEnvCount: 2, futureKey: "x" },
    });
    const result = (await registry.dispatch(client, "version_deployment_v3", "list", {
      version_id: "ver-1",
      package_tag: "v1.2.3",
      env_type: "PRODUCTION",
    })) as Record<string, unknown>;

    const call = lastCall(client);
    expect(call.path).toBe("/har/api/v3/versions/ver-1/deployments");
    expectAccountOnly(call);
    expect(call.params.package_tag).toBe("v1.2.3");
    expect(call.params.env_type).toBe("PRODUCTION");
    expect(result.items).toHaveLength(1);
    expect(result.prodEnvCount).toBe(1);
    expect(result.nonProdEnvCount).toBe(2);
    expect(result.meta).toBeUndefined();
  });

  it("version_deployment_v3.list requires version_id", async () => {
    const client = mockClient({ items: [] });
    await expect(registry.dispatch(client, "version_deployment_v3", "list", {})).rejects.toThrow(/version_id/);
  });
});

describe("HAR v3 stats resources", () => {
  const registry = new Registry(makeConfig());

  it.each([
    ["registry_stats_v3", "registry_ids", "/har/api/v3/registries/stats", "registryIds"],
    ["package_stats_v3", "package_ids", "/har/api/v3/packages/stats", "packageIds"],
    ["version_stats_v3", "version_ids", "/har/api/v3/versions/stats", "versionIds"],
  ])("%s.list POSTs the comma-separated ids as %s body", async (resourceType, filter, path, bodyKey) => {
    const client = mockClient({ items: [{ id: "a", downloadCount: 3 }, { id: "b", downloadCount: 0 }] });
    const result = (await registry.dispatch(client, resourceType, "list", { [filter]: "a, b ,," })) as Record<string, unknown>;

    const call = lastCall(client);
    expect(call.method).toBe("POST");
    expect(call.path).toBe(path);
    expect(call.body).toEqual({ [bodyKey]: ["a", "b"] });
    expect(call.params.account_identifier).toBe("acct123");
    expect(call.params.org_identifier).toBe("PROD");
    expect(call.params.project_identifier).toBe("Harness_Commons");
    expect(result.items).toHaveLength(2);
  });

  it("accepts an array of ids", async () => {
    const client = mockClient({ items: [] });
    await registry.dispatch(client, "version_stats_v3", "list", { version_ids: ["v1", "v2"] });
    expect(lastCall(client).body).toEqual({ versionIds: ["v1", "v2"] });
  });

  it("rejects more than 100 ids before calling the API", async () => {
    const client = mockClient({ items: [] });
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`).join(",");
    await expect(registry.dispatch(client, "package_stats_v3", "list", { package_ids: ids })).rejects.toThrow(/at most 100/);
    expect(client.request).not.toHaveBeenCalled();
  });

  it("rejects an empty id list", async () => {
    const client = mockClient({ items: [] });
    await expect(registry.dispatch(client, "registry_stats_v3", "list", { registry_ids: " , " })).rejects.toThrow(/at least one/);
    expect(client.request).not.toHaveBeenCalled();
  });

  it("stats lists are allowed in read-only mode", async () => {
    const readOnly = new Registry(makeConfig({ HARNESS_READ_ONLY: true }));
    const client = mockClient({ items: [] });
    await readOnly.dispatch(client, "registry_stats_v3", "list", { registry_ids: "r1", scope: "descendants" });
    expect(lastCall(client).params.scope).toBe("descendants");
  });

  it("new resources stay behind the registries-v3 opt-in", () => {
    const defaults = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined })).getAllResourceTypes();
    for (const t of ["version_detail_v3", "file_detail_v3", "system_info_v3", "version_deployment_v3", "registry_stats_v3", "package_stats_v3", "version_stats_v3"]) {
      expect(defaults).not.toContain(t);
    }
  });
});
