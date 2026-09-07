/**
 * HAR v3 toolset — verifies that v3 read tools issue requests with the
 * v3 route prefix and the snake_case scope query params
 * (`account_identifier`, `org_identifier`, `project_identifier`),
 * distinct from the v1 toolset's path-based space refs.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { registriesV3Toolset } from "../../src/registry/toolsets/registries-v3.js";
import { compactItems } from "../../src/utils/compact.js";
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

describe("HAR v3 toolset", () => {
  const registry = new Registry(makeConfig());

  it("package_v3.list hits /har/api/v3/packages with snake_case scope params", async () => {
    const client = mockClient({
      items: [{ id: "pkg-1", name: "example" }],
      page: 0,
      size: 20,
      hasMore: false,
    });

    await registry.dispatch(client, "package_v3", "list", {
      search_term: "example",
    });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/har/api/v3/packages");
    expect(call.params.account_identifier).toBe("acct123");
    expect(call.params.org_identifier).toBe("PROD");
    expect(call.params.project_identifier).toBe("Harness_Commons");
    expect(call.params.search_term).toBe("example");
    // v1's camelCase scope params must NOT leak into v3 requests.
    expect(call.params.accountIdentifier).toBeUndefined();
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("harV3ListExtract projects activeCount/deletedCount and does NOT forward raw meta", async () => {
    const client = mockClient({
      items: [{ id: "v-1" }, { id: "v-2" }],
      page: 1,
      size: 20,
      hasMore: true,
      meta: { activeCount: 2, deletedCount: 0, futureBackendKey: "leak-me-if-you-dare" },
    });

    const result = (await registry.dispatch(client, "version_v3", "list", {})) as Record<string, unknown>;
    expect(result.items).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.size).toBe(20);
    expect(result.hasMore).toBe(true);
    expect(result.activeCount).toBe(2);
    expect(result.deletedCount).toBe(0);
    // Raw `meta` envelope must not cross the tool boundary.
    expect(result.meta).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("futureBackendKey");
  });

  it("artifact_scan_v3.list normalizes v1-style {data,itemCount} envelope into v3 items shape", async () => {
    // Real QA response for /har/api/v3/scans still uses the v1 envelope.
    const client = mockClient({
      data: [{ scanId: "s-1" }, { scanId: "s-2" }],
      itemCount: 2,
      pageIndex: 0,
      pageSize: 20,
      pageCount: 1,
    });

    const result = (await registry.dispatch(client, "artifact_scan_v3", "list", {})) as {
      items: unknown[];
      total: number;
      page: number;
      size: number;
      hasMore: boolean;
    };
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(0);
    expect(result.size).toBe(20);
    expect(result.hasMore).toBe(false);
  });

  it("harV3ListExtract surfaces total from meta.totalCount for native v3 responses", async () => {
    const client = mockClient({
      items: [{ id: "p-1" }],
      page: 0,
      size: 20,
      hasMore: false,
      meta: { totalCount: 42 },
    });
    const result = (await registry.dispatch(client, "package_v3", "list", {})) as { total: number };
    expect(result.total).toBe(42);
  });

  it("firewall_exception_version_v3.list is account-scoped: no org/project params leak", async () => {
    // Spec's ListFirewallExceptionVersionsV3 takes only AccountIdentifierV3.
    const client = mockClient({ items: [], page: 0, size: 20, hasMore: false });

    await registry.dispatch(client, "firewall_exception_version_v3", "list", {
      registry_id: "0183d3a8-91d8-4c49-8025-057b0e16fca8",
      package_name: "lodash",
    });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toBe("/har/api/v3/scans/versions");
    expect(call.params.account_identifier).toBe("acct123");
    expect(call.params.org_identifier).toBeUndefined();
    expect(call.params.project_identifier).toBeUndefined();
    expect(call.params.registry_id).toBe("0183d3a8-91d8-4c49-8025-057b0e16fca8");
    expect(call.params.package_name).toBe("lodash");
  });

  it("file_v3.list hits /har/api/v3/files and forwards registry/package/version scoping filters", async () => {
    const client = mockClient({ items: [], page: 0, size: 20, hasMore: false });
    await registry.dispatch(client, "file_v3", "list", {
      registry_id: "reg-1",
      package_id: "pkg-1",
      version_id: "v-1",
    });
    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toBe("/har/api/v3/files");
    expect(call.params.registry_id).toBe("reg-1");
    expect(call.params.package_id).toBe("pkg-1");
    expect(call.params.version_id).toBe("v-1");
  });

  it("metadata_value_v3.list forwards the required `key` param", async () => {
    const client = mockClient({ items: ["prod", "staging"], page: 0, size: 20, hasMore: false });
    await registry.dispatch(client, "metadata_value_v3", "list", { key: "env" });
    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toBe("/har/api/v3/metadata/values");
    expect(call.params.key).toBe("env");
  });

  it("package_metadata_v3.get substitutes package_id into {id} path param and is account-scoped", async () => {
    // Spec's GetPackageMetadataV3 takes only AccountIdentifierV3.
    const client = mockClient({ data: [{ id: "m-1", key: "env", type: "STRING", value: "prod" }] });

    const result = (await registry.dispatch(client, "package_metadata_v3", "get", {
      package_id: "pkg-uuid-42",
    })) as Record<string, unknown>;

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toBe("/har/api/v3/packages/pkg-uuid-42/metadata");
    expect(call.params.account_identifier).toBe("acct123");
    expect(call.params.org_identifier).toBeUndefined();
    expect(call.params.project_identifier).toBeUndefined();
    // `{ data: [...] }` envelope must be unwrapped to `{ items: [...] }`.
    expect(result.items).toEqual([{ id: "m-1", key: "env", type: "STRING", value: "prod" }]);
    expect(result.data).toBeUndefined();
  });

  it("firewall_exception_v3.list forwards status + package filters", async () => {
    const client = mockClient({ items: [], page: 0, size: 20, hasMore: false });

    await registry.dispatch(client, "firewall_exception_v3", "list", {
      status: "PENDING",
      package_name: "requests",
      version: "2.31.0",
    });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toBe("/har/api/v3/scans/exceptions");
    expect(call.params.status).toBe("PENDING");
    expect(call.params.package_name).toBe("requests");
    expect(call.params.version).toBe("2.31.0");
  });

  it("artifact_scan_v3.get builds /scans/{id}/details and unwraps `{ data: {...} }`", async () => {
    const client = mockClient({ data: { packageName: "lodash", scanStatus: "BLOCKED", violations: [] } });

    const result = (await registry.dispatch(client, "artifact_scan_v3", "get", {
      scan_id: "scan-9",
      policy_set_ref: "default-policies",
    })) as Record<string, unknown>;

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toBe("/har/api/v3/scans/scan-9/details");
    expect(call.params.policy_set_ref).toBe("default-policies");
    // `{ data: {...} }` envelope must be unwrapped to the inner object.
    expect(result.packageName).toBe("lodash");
    expect(result.scanStatus).toBe("BLOCKED");
    expect(result.data).toBeUndefined();
  });

  it("bulk_scan_evaluation_v3.get substitutes evaluation_id into path", async () => {
    const client = mockClient({ status: "COMPLETED" });

    await registry.dispatch(client, "bulk_scan_evaluation_v3", "get", {
      evaluation_id: "eval-abc",
    });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toBe("/har/api/v3/scans/bulk-evaluate/eval-abc");
  });
});

// ─── compactItem projection ───────────────────────────────────────────────────
// The default `compactItems()` whitelist would strip `packageType`,
// `latestVersion`, `registryName`, `versionList` — fields agents actually need.
// Verify our per-resource projectors keep them and rename `id` → `<x>_id`.

describe("registries-v3 compactItem projection", () => {
  const getResource = (rt: string) => {
    const r = registriesV3Toolset.resources.find((res) => res.resourceType === rt);
    if (!r) throw new Error(`resource ${rt} not found`);
    return r;
  };

  it("package_v3.compactItem keeps packageType/latestVersion/registryName and adds package_id", () => {
    const resource = getResource("package_v3");
    expect(resource.compactItem).toBeDefined();
    const items = compactItems(
      [
        {
          id: "pkg-uuid-1",
          name: "lodash",
          packageType: "NPM",
          latestVersion: "4.17.21",
          registryName: "harness-npm",
          registryId: "reg-1",
          extra: "should-be-dropped",
          debug: { should: "not-leak" },
        },
      ],
      resource.compactItem,
    ) as Record<string, unknown>[];
    expect(items[0].package_id).toBe("pkg-uuid-1");
    expect(items[0].id).toBe("pkg-uuid-1");
    expect(items[0].name).toBe("lodash");
    expect(items[0].packageType).toBe("NPM");
    expect(items[0].latestVersion).toBe("4.17.21");
    expect(items[0].registryName).toBe("harness-npm");
    expect(items[0].extra).toBeUndefined();
    expect(items[0].debug).toBeUndefined();
  });

  it("version_v3.compactItem keeps packageType/packageName/pullCommand and adds version_id", () => {
    const resource = getResource("version_v3");
    const items = compactItems(
      [
        {
          id: "ver-uuid-1",
          name: "4.17.21",
          packageId: "pkg-uuid-1",
          packageName: "lodash",
          packageType: "NPM",
          registryName: "harness-npm",
          registryType: "VIRTUAL",
          pullCommand: "npm install lodash@4.17.21",
          extra: "gone",
        },
      ],
      resource.compactItem,
    ) as Record<string, unknown>[];
    expect(items[0].version_id).toBe("ver-uuid-1");
    expect(items[0].pullCommand).toBe("npm install lodash@4.17.21");
    expect(items[0].packageType).toBe("NPM");
    expect(items[0].registryType).toBe("VIRTUAL");
    expect(items[0].extra).toBeUndefined();
  });

  it("firewall_exception_v3.compactItem keeps versionList/versionScanMap/status", () => {
    const resource = getResource("firewall_exception_v3");
    const items = compactItems(
      [
        {
          exceptionId: "exc-1",
          status: "PENDING",
          packageName: "requests",
          registryName: "harness-py",
          versionList: ["2.30.0", "2.31.0"],
          versionScanMap: { "2.31.0": "scan-9" },
          businessJustification: "urgent hotfix",
          extra: "gone",
        },
      ],
      resource.compactItem,
    ) as Record<string, unknown>[];
    expect(items[0].versionList).toEqual(["2.30.0", "2.31.0"]);
    expect(items[0].versionScanMap).toEqual({ "2.31.0": "scan-9" });
    expect(items[0].status).toBe("PENDING");
    expect(items[0].businessJustification).toBe("urgent hotfix");
    expect(items[0].extra).toBeUndefined();
  });
});

// ─── Registry opt-in behaviour ────────────────────────────────────────────────
// The registries-v3 toolset ships opt-in (like ansible) — its resource types
// must not appear in a default Registry.

describe("registries-v3 opt-in with Registry", () => {
  const V3_TYPES = [
    "package_v3",
    "version_v3",
    "file_v3",
    "registry_metadata_v3",
    "package_metadata_v3",
    "version_metadata_v3",
    "file_metadata_v3",
    "metadata_key_v3",
    "metadata_value_v3",
    "artifact_scan_v3",
    "bulk_scan_evaluation_v3",
    "firewall_exception_v3",
    "firewall_exception_version_v3",
  ];

  it("toolset is marked optIn: true", () => {
    expect(registriesV3Toolset.optIn).toBe(true);
  });

  it("is NOT present when HARNESS_TOOLSETS is unset (all defaults)", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    const types = registry.getAllResourceTypes();
    for (const t of V3_TYPES) {
      expect(types).not.toContain(t);
    }
  });

  it("IS present when explicitly enabled with HARNESS_TOOLSETS=registries-v3", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries-v3" }));
    const types = registry.getAllResourceTypes();
    for (const t of V3_TYPES) {
      expect(types).toContain(t);
    }
  });

  it("IS present when added to defaults with HARNESS_TOOLSETS=+registries-v3", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "+registries-v3" }));
    expect(registry.getAllResourceTypes()).toContain("package_v3");
  });
});
