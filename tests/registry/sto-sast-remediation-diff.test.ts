/**
 * Tests for the `sast_remediation_diff` resource that wraps
 * STO DiffOccurrences (`GET /sto/api/v2/sast-remediation/diff-occurrences`).
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
  it("registers list-only GET against sast-remediation/diff-occurrences", () => {
    const resource = getResource();
    const list = getListSpec();
    expect(resource.scope).toBe("project");
    expect(resource.scopeParams).toEqual({
      account: "accountId",
      org: "orgId",
      project: "projectId",
    });
    expect(list.method).toBe("GET");
    expect(list.path).toBe("/sto/api/v2/sast-remediation/diff-occurrences");
    expect(list.queryParams).toMatchObject({
      scan_id: "scanId",
      validation_execution_id: "validationExecutionId",
      execution_id: "validationExecutionId",
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
        input: { validation_execution_id: "exec-1" },
        registry: { dispatch: async () => undefined, getResource },
      }),
    ).rejects.toThrow(/scan_id/);
  });

  it("rejects missing validation_execution_id (and legacy execution_id)", async () => {
    const spec = getListSpec();
    await expect(
      spec.preflight!({
        client: { account: "test-account" },
        input: { scan_id: "scan-1" },
        registry: { dispatch: async () => undefined, getResource },
      }),
    ).rejects.toThrow(/validation_execution_id/);
  });

  it("accepts validation_execution_id", async () => {
    const spec = getListSpec();
    const input: Record<string, unknown> = {
      scan_id: "scan-1",
      validation_execution_id: "exec-1",
    };
    await expect(
      spec.preflight!({
        client: { account: "test-account" },
        input,
        registry: { dispatch: async () => undefined, getResource },
      }),
    ).resolves.toBeUndefined();
    expect(input.validation_execution_id).toBe("exec-1");
  });

  it("accepts legacy execution_id and normalizes to validation_execution_id", async () => {
    const spec = getListSpec();
    const input: Record<string, unknown> = {
      scan_id: "scan-1",
      execution_id: "exec-legacy",
    };
    await expect(
      spec.preflight!({
        client: { account: "test-account" },
        input,
        registry: { dispatch: async () => undefined, getResource },
      }),
    ).resolves.toBeUndefined();
    expect(input.validation_execution_id).toBe("exec-legacy");
    expect(input.execution_id).toBeUndefined();
  });
});

describe("sast_remediation_diff responseExtractor", () => {
  const MOCK_API_RESPONSE = {
    validationScanId: "val-scan-1",
    existingOccurrences: [
      { issueId: "iss-e1", occurrenceInternalId: 1, issueTitle: "t1", severityCode: "HIGH" },
    ],
    newOccurrences: [
      { issueId: "iss-n1", occurrenceInternalId: 2, issueTitle: "t2", severityCode: "LOW" },
    ],
    existingCount: 1,
    newCount: 1,
    matchedCount: 2,
  };

  it("flattens existingOccurrences+newOccurrences with _partition tags", () => {
    const spec = getListSpec();
    const result = spec.responseExtractor!(MOCK_API_RESPONSE, {}) as Record<string, unknown>;

    expect(result.items).toEqual([
      {
        issueId: "iss-e1",
        occurrenceInternalId: 1,
        issueTitle: "t1",
        severityCode: "HIGH",
        _partition: "existing",
      },
      {
        issueId: "iss-n1",
        occurrenceInternalId: 2,
        issueTitle: "t2",
        severityCode: "LOW",
        _partition: "new",
      },
    ]);
    expect(result.total).toBe(2);
    expect(result.existing_total).toBe(1);
    expect(result.new_total).toBe(1);
    expect(result.matched_count).toBe(2);
    expect(result.validation_scan_id).toBe("val-scan-1");
  });

  it("falls back to legacy existing/new keys", () => {
    const spec = getListSpec();
    const result = spec.responseExtractor!(
      {
        validationScanId: "val-scan-1",
        existing: [{ issueId: "iss-e1", occurrenceInternalId: 1 }],
        new: [{ issueId: "iss-n1", occurrenceInternalId: 2 }],
        existingCount: 1,
        newCount: 1,
        matchedCount: 2,
      },
      {},
    ) as Record<string, unknown>;

    expect(result.items).toEqual([
      { issueId: "iss-e1", occurrenceInternalId: 1, _partition: "existing" },
      { issueId: "iss-n1", occurrenceInternalId: 2, _partition: "new" },
    ]);
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
      existingOccurrences: [],
      newOccurrences: [],
      existingCount: 0,
      newCount: 0,
      matchedCount: 0,
    });
    const client = makeClient(request);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));

    await registry.dispatch(client, "sast_remediation_diff", "list", {
      scan_id: "orig-scan",
      validation_execution_id: "val-exec",
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
    expect(call.path).toBe("/sto/api/v2/sast-remediation/diff-occurrences");
    expect(call.params).toMatchObject({
      accountId: "test-account",
      orgId: "default",
      projectId: "test-project",
      scanId: "orig-scan",
      validationExecutionId: "val-exec",
      onlyTruePositive: false,
      limit: 50,
      severityCodes: "HIGH,CRITICAL",
    });
    expect(call.params.executionId).toBeUndefined();
  });

  it("normalizes legacy execution_id filter to validationExecutionId", async () => {
    const request = vi.fn().mockResolvedValue({
      validationScanId: "val-scan-1",
      existingOccurrences: [],
      newOccurrences: [],
      existingCount: 0,
      newCount: 0,
      matchedCount: 0,
    });
    const client = makeClient(request);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));

    await registry.dispatch(client, "sast_remediation_diff", "list", {
      scan_id: "orig-scan",
      execution_id: "val-exec-legacy",
    });

    const call = request.mock.calls[0]![0] as {
      params: Record<string, unknown>;
    };
    expect(call.params.validationExecutionId).toBe("val-exec-legacy");
    expect(call.params.executionId).toBeUndefined();
  });
});
