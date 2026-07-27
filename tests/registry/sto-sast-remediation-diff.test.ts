/**
 * Tests for the `sast_remediation_diff` resource that wraps
 * STO DiffOccurrences (`GET /sto/api/v2/sast-remediation/diff`).
 */
import { describe, it, expect, vi } from "vitest";
import { stoToolset } from "../../src/registry/toolsets/sto.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
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
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function getResource(): ResourceDefinition {
  const r = stoToolset.resources.find((x) => x.resourceType === "sast_remediation_diff");
  if (!r) throw new Error("sast_remediation_diff resource not registered");
  return r;
}

function getListSpec(): EndpointSpec {
  const spec = getResource().operations.list;
  if (!spec) throw new Error("sast_remediation_diff.list spec missing");
  return spec;
}

describe("sast_remediation_diff resource registration", () => {
  it("registers list-only GET against sast-remediation/diff", () => {
    const resource = getResource();
    const list = getListSpec();
    expect(resource.scope).toBe("project");
    expect(resource.scopeParams).toEqual({
      account: "accountId",
      org: "orgId",
      project: "projectId",
    });
    expect(list.method).toBe("GET");
    expect(list.path).toBe("/sto/api/v2/sast-remediation/diff");
    expect(list.queryParams).toMatchObject({
      scan_id: "scanId",
      execution_id: "executionId",
      only_true_positive: "onlyTruePositive",
      limit: "limit",
      severity_codes: "severityCodes",
      exclude_repo_patterns: "excludeRepoPatterns",
    });
    expect(list.operationPolicy).toEqual({ risk: "read", retryPolicy: "safe" });
  });
});

describe("sast_remediation_diff preflight", () => {
  it("rejects missing scan_id", async () => {
    const spec = getListSpec();
    await expect(
      spec.preflight!({
        client: { account: "test-account" },
        input: { execution_id: "exec-1" },
        registry: { dispatch: async () => undefined, getResource },
      }),
    ).rejects.toThrow(/scan_id/);
  });

  it("rejects missing execution_id", async () => {
    const spec = getListSpec();
    await expect(
      spec.preflight!({
        client: { account: "test-account" },
        input: { scan_id: "scan-1" },
        registry: { dispatch: async () => undefined, getResource },
      }),
    ).rejects.toThrow(/execution_id/);
  });

  it("accepts both required ids", async () => {
    const spec = getListSpec();
    await expect(
      spec.preflight!({
        client: { account: "test-account" },
        input: { scan_id: "scan-1", execution_id: "exec-1" },
        registry: { dispatch: async () => undefined, getResource },
      }),
    ).resolves.toBeUndefined();
  });
});

describe("sast_remediation_diff responseExtractor", () => {
  const MOCK_API_RESPONSE = {
    validationScanId: "val-scan-1",
    existing: [{ issueId: "iss-e1", occurrenceInternalId: 1, fingerprint: "fp-e" }],
    new: [{ issueId: "iss-n1", occurrenceInternalId: 2, fingerprint: "fp-n" }],
    existingCount: 1,
    newCount: 1,
    matchedCount: 2,
  };

  it("flattens existing+new with _partition tags and side-channels", () => {
    const spec = getListSpec();
    const result = spec.responseExtractor!(MOCK_API_RESPONSE, {}) as Record<string, unknown>;

    expect(result.items).toEqual([
      { issueId: "iss-e1", occurrenceInternalId: 1, fingerprint: "fp-e", _partition: "existing" },
      { issueId: "iss-n1", occurrenceInternalId: 2, fingerprint: "fp-n", _partition: "new" },
    ]);
    expect(result.total).toBe(2);
    expect(result.existing_total).toBe(1);
    expect(result.new_total).toBe(1);
    expect(result.matched_count).toBe(2);
    expect(result.validation_scan_id).toBe("val-scan-1");
  });

  it("handles null/undefined API response without throwing", () => {
    const spec = getListSpec();
    expect(spec.responseExtractor!(null, {})).toBeNull();
    expect(spec.responseExtractor!(undefined, {})).toBeUndefined();
  });
});

describe("sast_remediation_diff — registry dispatch", () => {
  it("passes required query params through to the Harness client", async () => {
    const request = vi.fn().mockResolvedValue({
      validationScanId: "val-scan-1",
      existing: [],
      new: [],
      existingCount: 0,
      newCount: 0,
      matchedCount: 0,
    });
    const client = makeClient(request);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));

    await registry.dispatch(client, "sast_remediation_diff", "list", {
      scan_id: "orig-scan",
      execution_id: "val-exec",
      only_true_positive: false,
      limit: 50,
      severity_codes: "HIGH,CRITICAL",
    });

    expect(request).toHaveBeenCalledTimes(1);
    const call = request.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
    };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/sto/api/v2/sast-remediation/diff");
    expect(call.params).toMatchObject({
      accountId: "test-account",
      orgId: "default",
      projectId: "test-project",
      scanId: "orig-scan",
      executionId: "val-exec",
      onlyTruePositive: false,
      limit: 50,
      severityCodes: "HIGH,CRITICAL",
    });
  });
});
