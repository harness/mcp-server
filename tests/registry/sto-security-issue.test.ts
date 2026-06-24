/**
 * Regression tests for STO security_issue list hint injection and
 * pipeline_security_issue partition flattening.
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

function getResource(type: string): ResourceDefinition {
  const r = stoToolset.resources.find((x) => x.resourceType === type);
  if (!r) throw new Error(`${type} resource not registered`);
  return r;
}

function getListSpec(type: string): EndpointSpec {
  const spec = getResource(type).operations.list;
  if (!spec) throw new Error(`${type}.list spec missing`);
  return spec;
}

describe("security_issue list — _action_hint injection", () => {
  it("injects exemption workflow hint into list response", async () => {
    const spec = getListSpec("security_issue");
    const raw = { items: [{ issue_id: "CVE-2024-1" }], total: 1 };
    const result = spec.responseExtractor!(raw, {}) as Record<string, unknown>;

    expect(result.items).toEqual([{ issue_id: "CVE-2024-1" }]);
    expect(result.total).toBe(1);
    expect(result._action_hint).toContain("security_exemption");
    expect(result._action_hint).toContain("APPROVE");
    expect(result._action_hint).toContain("REJECT");
  });

  it("handles null/undefined API response without throwing", () => {
    const spec = getListSpec("security_issue");
    const result = spec.responseExtractor!(null, {}) as Record<string, unknown>;
    expect(result._action_hint).toContain("security_exemption");
    expect(result.items).toBeUndefined();
  });
});

describe("security_issue list — scope keyword preflight", () => {
  it("strips literal 'org'/'project' scope keywords from org_id and project_id", async () => {
    const spec = getListSpec("security_issue");
    const input: Record<string, unknown> = {
      org_id: "org",
      project_id: "project",
      page: 0,
    };
    await spec.preflight!({
      client: { account: "test-account" },
      input,
      registry: { dispatch: async () => undefined, getResource: () => getResource("security_issue") },
    });
    expect(input.org_id).toBeUndefined();
    expect(input.project_id).toBeUndefined();
    expect(input.page).toBe(0);
  });
});

describe("pipeline_security_step list — step projection", () => {
  it("maps steps to items with reachability and exploitability flags", () => {
    const spec = getListSpec("pipeline_security_step");
    const raw = {
      steps: [
        { targetId: "t1", targetName: "my-repo", targetVariant: "main", stepName: "Build.Trivy" },
      ],
      reachabilityFlag: true,
      exploitabilityFlag: false,
    };
    const result = spec.responseExtractor!(raw, {}) as Record<string, unknown>;

    expect(result.items).toEqual(raw.steps);
    expect(result.total).toBe(1);
    expect(result.reachability_flag).toBe(true);
    expect(result.exploitability_flag).toBe(false);
  });

  it("defaults flags to false and items to [] when steps are absent", () => {
    const spec = getListSpec("pipeline_security_step");
    const result = spec.responseExtractor!({}, {}) as Record<string, unknown>;
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.reachability_flag).toBe(false);
    expect(result.exploitability_flag).toBe(false);
  });

  it("dispatches through registry with execution_id filter", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ steps: [], reachabilityFlag: false, exploitabilityFlag: false });
    const client = makeClient(mockRequest);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));

    await registry.dispatch(client, "pipeline_security_step", "list", {
      execution_id: "exec-steps-1",
      org_id: "my-org",
      project_id: "my-project",
    });

    const call = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, string> };
    expect(call.path).toBe("/sto/api/v2/frontend/pipeline-security/steps");
    expect(call.params.executionId).toBe("exec-steps-1");
    expect(call.params.orgId).toBe("my-org");
    expect(call.params.projectId).toBe("my-project");
  });
});

describe("pipeline_security_issue list — partition flattening", () => {
  const MOCK_API_RESPONSE = {
    existing: {
      issues: [{ issue_id: "e1", severity: "High" }],
      pagination: { totalItems: 10 },
    },
    new: {
      issues: [{ issue_id: "n1", severity: "Critical" }],
      pagination: { totalItems: 3 },
    },
    counts: { existing: 10, new: 3 },
    matchingSteps: [{ step: "Build.Trivy" }],
  };

  it("flattens existing+new partitions with _partition tags and side-channels", () => {
    const spec = getListSpec("pipeline_security_issue");
    const result = spec.responseExtractor!(MOCK_API_RESPONSE, {}) as Record<string, unknown>;

    expect(result.items).toEqual([
      { issue_id: "e1", severity: "High", _partition: "existing" },
      { issue_id: "n1", severity: "Critical", _partition: "new" },
    ]);
    expect(result.total).toBe(13);
    expect(result.existing_total).toBe(10);
    expect(result.new_total).toBe(3);
    expect(result.counts).toEqual({ existing: 10, new: 3 });
    expect(result.matching_steps).toEqual([{ step: "Build.Trivy" }]);
    expect(result._target_id_lookup_hint).toContain("pipeline_security_step");
    expect(result._pipeline_id_lookup_hint).toContain("pipelineIdentifier");
  });

  it("falls back to items[] key and row count when pagination metadata is absent", () => {
    const spec = getListSpec("pipeline_security_issue");
    const raw = {
      existing: { items: [{ issue_id: "legacy-e" }] },
      new: { items: [{ issue_id: "legacy-n" }, { issue_id: "legacy-n2" }] },
    };
    const result = spec.responseExtractor!(raw, {}) as Record<string, unknown>;

    expect(result.total).toBe(3);
    expect(result.existing_total).toBe(1);
    expect(result.new_total).toBe(2);
  });

  it("dispatches through registry with execution_id filter", async () => {
    const mockRequest = vi.fn().mockResolvedValue(MOCK_API_RESPONSE);
    const client = makeClient(mockRequest);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));

    await registry.dispatch(client, "pipeline_security_issue", "list", {
      execution_id: "exec-abc",
      org_id: "my-org",
      project_id: "my-project",
    });

    const call = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, string> };
    expect(call.path).toBe("/sto/api/v2/frontend/pipeline-security/issues");
    expect(call.params.executionId).toBe("exec-abc");
    expect(call.params.orgId).toBe("my-org");
    expect(call.params.projectId).toBe("my-project");
  });
});
