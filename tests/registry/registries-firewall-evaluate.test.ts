/**
 * Tests for the registries-firewall pre-pull checks (artifact_scan evaluate_packages / bulk_evaluate),
 * the firewall exception list counts, and the scan-list status filter values.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { registriesFirewallToolset } from "../../src/registry/toolsets/registries-firewall.js";
import { firewallExceptionListExtract, harV3ScanEvaluationExtract } from "../../src/registry/extractors.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

const REGISTRY_ID = "8a490c9d-33a6-441d-8c9c-929d12cbfbba";

function makeConfig(): Config {
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
  } as Config;
}

function mockClient(response: unknown): HarnessClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as HarnessClient;
}

function firstCall(client: HarnessClient) {
  return (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
}

function artifacts(n: number) {
  return Array.from({ length: n }, (_, i) => ({ packageName: `pkg-${i}`, version: "1.0.0" }));
}

describe("artifact_scan evaluate_packages", () => {
  const registry = new Registry(makeConfig());

  it("POSTs registryId + artifacts to /scans/bulk-evaluate-sync and projects data to items", async () => {
    const scan = { packageName: "lodash", version: "4.17.20", scanStatus: "BLOCKED" };
    const client = mockClient({ data: [scan] });

    const result = await registry.dispatchExecute(client, "artifact_scan", "evaluate_packages", {
      body: { registryId: REGISTRY_ID, artifacts: [{ packageName: "lodash", version: "4.17.20" }] },
    });

    const call = firstCall(client);
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/har/api/v3/scans/bulk-evaluate-sync");
    expect(call.body).toEqual({
      registryId: REGISTRY_ID,
      artifacts: [{ packageName: "lodash", version: "4.17.20" }],
    });
    expect(call.params.account_identifier).toBe("acct123");
    expect(result).toEqual({ items: [scan], total: 1 });
  });

  it("accepts registry_id as a top-level param and drops unknown artifact keys", async () => {
    const client = mockClient({ data: [] });

    await registry.dispatchExecute(client, "artifact_scan", "evaluate_packages", {
      registry_id: REGISTRY_ID,
      body: { artifacts: [{ packageName: "lodash", version: "4.17.21", extra: "x" }] },
    });

    expect(firstCall(client).body).toEqual({
      registryId: REGISTRY_ID,
      artifacts: [{ packageName: "lodash", version: "4.17.21" }],
    });
  });

  it.each([
    [true, true],
    [false, false],
  ])("forwards skipCache=%s", async (skipCache, expected) => {
    const client = mockClient({ data: [] });

    await registry.dispatchExecute(client, "artifact_scan", "evaluate_packages", {
      body: { registryId: REGISTRY_ID, artifacts: artifacts(1), skipCache },
    });

    expect(firstCall(client).body.skipCache).toBe(expected);
  });

  it("omits skipCache when not provided", async () => {
    const client = mockClient({ data: [] });

    await registry.dispatchExecute(client, "artifact_scan", "evaluate_packages", {
      body: { registryId: REGISTRY_ID, artifacts: artifacts(1) },
    });

    expect(firstCall(client).body).not.toHaveProperty("skipCache");
  });

  it("accepts exactly 50 artifacts", async () => {
    const client = mockClient({ data: [] });

    await registry.dispatchExecute(client, "artifact_scan", "evaluate_packages", {
      body: { registryId: REGISTRY_ID, artifacts: artifacts(50) },
    });

    expect(firstCall(client).body.artifacts).toHaveLength(50);
  });

  it.each([
    ["no registryId", { artifacts: artifacts(1) }, /needs registryId/],
    ["an empty registryId", { registryId: "", artifacts: artifacts(1) }, /needs registryId/],
    ["no artifacts", { registryId: REGISTRY_ID }, /needs 1-50 artifacts/],
    ["zero artifacts", { registryId: REGISTRY_ID, artifacts: [] }, /needs 1-50 artifacts/],
    ["51 artifacts", { registryId: REGISTRY_ID, artifacts: artifacts(51) }, /needs 1-50 artifacts/],
    ["a non-array artifacts", { registryId: REGISTRY_ID, artifacts: "lodash" }, /needs 1-50 artifacts/],
    ["an entry without version", { registryId: REGISTRY_ID, artifacts: [{ packageName: "lodash" }] },
      /artifacts\[0\] needs both packageName and version/],
    ["an entry with an empty packageName", { registryId: REGISTRY_ID, artifacts: [{ packageName: "", version: "1" }] },
      /artifacts\[0\] needs both packageName and version/],
    ["a null entry", { registryId: REGISTRY_ID, artifacts: [...artifacts(1), null] },
      /artifacts\[1\] needs both packageName and version/],
  ])("rejects %s without calling the API", async (_label, body, message) => {
    const client = mockClient({ data: [] });

    await expect(
      registry.dispatchExecute(client, "artifact_scan", "evaluate_packages", { body }),
    ).rejects.toThrow(message);
    expect(client.request).not.toHaveBeenCalled();
  });

  it("is declared read-only and retry-safe", () => {
    const scan = registriesFirewallToolset.resources.find((r) => r.resourceType === "artifact_scan");
    expect(scan?.executeActions?.evaluate_packages?.operationPolicy).toEqual({ risk: "read", retryPolicy: "safe" });
  });
});

describe("artifact_scan bulk_evaluate", () => {
  const registry = new Registry(makeConfig());

  it("POSTs to /scans/bulk-evaluate and unwraps the evaluationId", async () => {
    const client = mockClient({ data: { evaluationId: "eval-1" } });

    const result = await registry.dispatchExecute(client, "artifact_scan", "bulk_evaluate", {
      body: { registryId: REGISTRY_ID, artifacts: artifacts(51), skipCache: true },
    });

    const call = firstCall(client);
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/har/api/v3/scans/bulk-evaluate");
    expect(call.body.artifacts).toHaveLength(51);
    // The async endpoint has no skipCache field.
    expect(call.body).not.toHaveProperty("skipCache");
    expect(result).toEqual({ evaluationId: "eval-1" });
  });

  it.each([
    ["zero artifacts", 0],
    ["10001 artifacts", 10001],
  ])("rejects %s without calling the API", async (_label, n) => {
    const client = mockClient({ data: { evaluationId: "eval-1" } });

    await expect(
      registry.dispatchExecute(client, "artifact_scan", "bulk_evaluate", {
        body: { registryId: REGISTRY_ID, artifacts: artifacts(n) },
      }),
    ).rejects.toThrow(/bulk_evaluate needs 1-10000 artifacts/);
    expect(client.request).not.toHaveBeenCalled();
  });

  it("is declared a non-retryable write", () => {
    const scan = registriesFirewallToolset.resources.find((r) => r.resourceType === "artifact_scan");
    expect(scan?.executeActions?.bulk_evaluate?.operationPolicy).toEqual({
      risk: "low_write",
      retryPolicy: "do_not_retry",
    });
  });
});

describe("harV3ScanEvaluationExtract", () => {
  it.each([
    ["empty data", { data: [] }],
    ["missing data", {}],
    ["null data", { data: null }],
  ])("returns an empty list for %s", (_label, raw) => {
    expect(harV3ScanEvaluationExtract(raw)).toEqual({ items: [], total: 0 });
  });

  it("passes non-object responses through", () => {
    expect(harV3ScanEvaluationExtract("oops")).toBe("oops");
  });
});

describe("firewallExceptionListExtract", () => {
  const raw = {
    items: [{ exceptionId: "e1", status: "APPROVED" }],
    page: 0,
    size: 20,
    hasMore: false,
    meta: { totalCount: 12, pendingCount: 5, approvedCount: 4, rejectedCount: 2, expiredCount: 1 },
  };
  const counts = { pending: 5, approved: 4, rejected: 2, expired: 1 };

  it("reports the all-status total and per-status counts without a status filter", () => {
    expect(firewallExceptionListExtract(raw, {})).toEqual({
      items: raw.items, total: 12, page: 0, size: 20, hasMore: false, counts,
    });
  });

  it.each([
    ["APPROVED", 4],
    ["pending", 5],
    ["REJECTED", 2],
    ["EXPIRED", 1],
  ])("reports total as the %s count when filtered by status", (status, expected) => {
    const result = firewallExceptionListExtract(raw, { status }) as Record<string, unknown>;
    expect(result.total).toBe(expected);
    expect(result.counts).toEqual(counts);
  });

  it("keeps totalCount for an unknown status value", () => {
    const result = firewallExceptionListExtract(raw, { status: "BOGUS" }) as Record<string, unknown>;
    expect(result.total).toBe(12);
  });

  it("keeps totalCount when the matching per-status count is missing", () => {
    const partial = { ...raw, meta: { totalCount: 12, pendingCount: 5 } };
    const result = firewallExceptionListExtract(partial, { status: "APPROVED" }) as Record<string, unknown>;
    expect(result.total).toBe(12);
    expect(result.counts).toEqual({ pending: 5 });
  });

  it("falls back to items.length and omits counts when meta is missing", () => {
    const { meta: _meta, ...noMeta } = raw;
    expect(firewallExceptionListExtract(noMeta, { status: "APPROVED" })).toEqual({
      items: raw.items, total: 1, page: 0, size: 20, hasMore: false,
    });
  });

  it("is wired into firewall_exception.list", async () => {
    const registry = new Registry(makeConfig());
    const client = mockClient(raw);

    const result = (await registry.dispatch(client, "firewall_exception", "list", {
      status: "APPROVED",
    })) as Record<string, unknown>;

    expect(firstCall(client).params.status).toBe("APPROVED");
    expect(result.total).toBe(4);
    expect(result.counts).toEqual(counts);
  });
});

describe("artifact_scan scan_status filter", () => {
  it("only offers the values the list API accepts", () => {
    const scan = registriesFirewallToolset.resources.find((r) => r.resourceType === "artifact_scan");
    const field = scan?.listFilterFields?.find((f) => f.name === "scan_status");
    expect(field?.enum).toEqual(["BLOCKED", "WARN"]);
  });
});

describe("bulk_scan_evaluation get", () => {
  it("can be polled at account scope, matching an account-scoped bulk_evaluate", async () => {
    const registry = new Registry(makeConfig());
    const status = { evaluationId: "eval-1", status: "SUCCESS", scans: [], error: null };
    const client = mockClient({ data: status });

    const result = await registry.dispatch(client, "bulk_scan_evaluation", "get", {
      resource_scope: "account",
      evaluation_id: "eval-1",
    });

    const call = firstCall(client);
    expect(call.path).toBe("/har/api/v3/scans/bulk-evaluate/eval-1");
    expect(call.params.account_identifier).toBe("acct123");
    expect(call.params.org_identifier).toBeUndefined();
    expect(call.params.project_identifier).toBeUndefined();
    expect(result).toEqual(status);
  });
});
