/**
 * HAR v3 toolset — verifies that v3 read tools issue requests with the
 * v3 route prefix and the snake_case scope query params
 * (`account_identifier`, `org_identifier`, `project_identifier`),
 * distinct from the v1 toolset's path-based space refs.
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

  it("harV3ListExtract exposes items/page/size/hasMore/meta from bare v3 body", async () => {
    const client = mockClient({
      items: [{ id: "v-1" }, { id: "v-2" }],
      page: 1,
      size: 20,
      hasMore: true,
      meta: { activeCount: 2, deletedCount: 0 },
    });

    const result = (await registry.dispatch(client, "version_v3", "list", {})) as {
      items: unknown[];
      page: number;
      size: number;
      hasMore: boolean;
      meta: unknown;
    };
    expect(result.items).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.size).toBe(20);
    expect(result.hasMore).toBe(true);
    expect(result.meta).toEqual({ activeCount: 2, deletedCount: 0 });
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

  it("package_metadata_v3.get substitutes package_id into {id} path param", async () => {
    const client = mockClient({ metadata: { env: "prod" } });

    await registry.dispatch(client, "package_metadata_v3", "get", {
      package_id: "pkg-uuid-42",
    });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toBe("/har/api/v3/packages/pkg-uuid-42/metadata");
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

  it("artifact_scan_v3.get builds /scans/{id}/details from scan_id", async () => {
    const client = mockClient({ id: "scan-9", violations: [] });

    await registry.dispatch(client, "artifact_scan_v3", "get", {
      scan_id: "scan-9",
      policy_set_ref: "default-policies",
    });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toBe("/har/api/v3/scans/scan-9/details");
    expect(call.params.policy_set_ref).toBe("default-policies");
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
