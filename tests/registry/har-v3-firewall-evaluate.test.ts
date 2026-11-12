/**
 * HAR v3 firewall evaluation actions and pipeline build info — request bodies,
 * limits, read-only mode behaviour and response unwrapping.
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

const artifacts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ packageName: `pkg-${i}`, version: "1.0.0" }));

describe("artifact_scan_v3 evaluate (sync)", () => {
  const registry = new Registry(makeConfig());

  it("POSTs to bulk-evaluate-sync with the normalized body and unwraps data[]", async () => {
    const client = mockClient({ data: [{ packageName: "lodash", version: "4.17.20", scanStatus: "BLOCKED" }] });
    const result = (await registry.dispatchExecute(client, "artifact_scan_v3", "evaluate", {
      body: {
        registryId: "reg-uuid",
        artifacts: [{ packageName: "lodash", version: "4.17.20", extra: "dropped" }],
        skipCache: true,
      },
    })) as Record<string, unknown>;

    const call = lastCall(client);
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/har/api/v3/scans/bulk-evaluate-sync");
    expect(call.body).toEqual({
      registryId: "reg-uuid",
      artifacts: [{ packageName: "lodash", version: "4.17.20" }],
      skipCache: true,
    });
    expect(call.params.account_identifier).toBe("acct123");
    expect(call.params.org_identifier).toBe("PROD");
    expect(call.params.project_identifier).toBe("Harness_Commons");
    expect(result.items).toEqual([{ packageName: "lodash", version: "4.17.20", scanStatus: "BLOCKED" }]);
  });

  it("rejects more than 50 artifacts before calling the API", async () => {
    const client = mockClient({ data: [] });
    await expect(
      registry.dispatchExecute(client, "artifact_scan_v3", "evaluate", {
        body: { registryId: "reg-uuid", artifacts: artifacts(51) },
      }),
    ).rejects.toThrow(/at most 50/);
    expect(client.request).not.toHaveBeenCalled();
  });

  it("rejects artifacts missing packageName or version", async () => {
    const client = mockClient({ data: [] });
    await expect(
      registry.dispatchExecute(client, "artifact_scan_v3", "evaluate", {
        body: { registryId: "reg-uuid", artifacts: [{ packageName: "a", version: "1" }, { packageName: "b" }] },
      }),
    ).rejects.toThrow(/artifacts\[1\]/);
    expect(client.request).not.toHaveBeenCalled();
  });

  it("rejects an empty artifacts list", async () => {
    const client = mockClient({ data: [] });
    await expect(
      registry.dispatchExecute(client, "artifact_scan_v3", "evaluate", { body: { registryId: "reg-uuid", artifacts: [] } }),
    ).rejects.toThrow(/non-empty/);
  });

  it("is allowed in read-only mode", async () => {
    const readOnly = new Registry(makeConfig({ HARNESS_READ_ONLY: true }));
    const client = mockClient({ data: [] });
    await readOnly.dispatchExecute(client, "artifact_scan_v3", "evaluate", {
      body: { registryId: "reg-uuid", artifacts: artifacts(1) },
    });
    expect(client.request).toHaveBeenCalledOnce();
  });
});

describe("artifact_scan_v3 bulk_evaluate (async)", () => {
  const registry = new Registry(makeConfig());

  it("POSTs to bulk-evaluate, drops skipCache, and returns the evaluationId", async () => {
    const client = mockClient({ data: { evaluationId: "eval-1" } });
    const result = (await registry.dispatchExecute(client, "artifact_scan_v3", "bulk_evaluate", {
      body: { registryId: "reg-uuid", artifacts: artifacts(60), skipCache: true },
    })) as Record<string, unknown>;

    const call = lastCall(client);
    expect(call.path).toBe("/har/api/v3/scans/bulk-evaluate");
    expect(call.body.artifacts).toHaveLength(60);
    expect(call.body.skipCache).toBeUndefined();
    expect(result.evaluationId).toBe("eval-1");
  });

  it("rejects more than 10000 artifacts", async () => {
    const client = mockClient({ data: {} });
    await expect(
      registry.dispatchExecute(client, "artifact_scan_v3", "bulk_evaluate", {
        body: { registryId: "reg-uuid", artifacts: artifacts(10001) },
      }),
    ).rejects.toThrow(/at most 10000/);
  });

  it("is blocked in read-only mode", async () => {
    const readOnly = new Registry(makeConfig({ HARNESS_READ_ONLY: true }));
    const client = mockClient({ data: {} });
    await expect(
      readOnly.dispatchExecute(client, "artifact_scan_v3", "bulk_evaluate", {
        body: { registryId: "reg-uuid", artifacts: artifacts(1) },
      }),
    ).rejects.toThrow(/Read-only mode/);
    expect(client.request).not.toHaveBeenCalled();
  });
});

describe("firewall_build_info_v3", () => {
  const registry = new Registry(makeConfig());

  it("list hits build-info/pipeline/details and maps pipelineData + blocked totals", async () => {
    const client = mockClient({
      pipelineData: [{ pipelineId: "build", blockedCount: 2 }],
      page: 0,
      size: 20,
      hasMore: false,
      meta: { totalBlockedPipelines: 1, totalBlockedDependencies: 2 },
    });
    const result = (await registry.dispatch(client, "firewall_build_info_v3", "list", {
      package_name: "lodash",
      scan_id: "scan-9",
    })) as Record<string, unknown>;

    const call = lastCall(client);
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/har/api/v3/build-info/pipeline/details");
    expect(call.params.package_name).toBe("lodash");
    expect(call.params.scan_id).toBe("scan-9");
    expect(call.params.project_identifier).toBe("Harness_Commons");
    expect(result.items).toEqual([{ pipelineId: "build", blockedCount: 2 }]);
    expect(result.total).toBe(1);
    expect(result.totalBlockedPipelines).toBe(1);
    expect(result.totalBlockedDependencies).toBe(2);
    expect(result.meta).toBeUndefined();
  });

  it("is default-enabled with the rest of registries-firewall", () => {
    const defaults = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined })).getAllResourceTypes();
    expect(defaults).toContain("firewall_build_info_v3");
  });
});
