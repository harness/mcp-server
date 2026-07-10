/**
 * Unit tests for scorecard and scorecard_check create/update operations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { idpToolset } from "../../src/registry/toolsets/idp.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

const SAMPLE_SCORECARD_BODY = {
  scorecard: {
    name: "Production Readiness",
    identifier: "production_readiness",
    description: "Checks required before production deployment",
    filter: { kind: "component" },
    weightageStrategy: "EQUAL_WEIGHTS",
    published: false,
  },
  checks: [{ identifier: "has_owner", weightage: 10, custom: false }],
};

const SAMPLE_CHECK_BODY = {
  checkDetails: {
    identifier: "has_readme",
    name: "Has README",
    description: "Component must have a README file",
    custom: true,
    ruleStrategy: "ALL_OF",
    rules: [
      {
        identifier: "readme_exists",
        dataSourceIdentifier: "catalog",
        dataPointIdentifier: "readme",
        operator: "EXISTS",
        value: "",
      },
    ],
    defaultBehaviour: "FAIL",
    failMessage: "README is missing",
  },
};

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_MCP_MODE: "single-user",
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
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_MCP_ALLOWED_HOSTS: undefined,
    HARNESS_MCP_AUTH_TOKEN: undefined,
    HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_PIPELINE_VERSION: undefined,
    HARNESS_AUDIT_FILE: undefined,
    HARNESS_AUDIT_WEBHOOK_URL: undefined,
    HARNESS_AUDIT_WEBHOOK_TOKEN: undefined,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(type: string): ResourceDefinition {
  const res = idpToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in idpToolset`);
  return res;
}

function getOp(type: string, op: string): EndpointSpec {
  const res = findResource(type);
  const spec = res.operations[op as keyof typeof res.operations];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

describe("scorecard mutate operations", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("exposes create and update but not delete", () => {
    const def = findResource("scorecard");
    expect(def.operations.create).toBeDefined();
    expect(def.operations.update).toBeDefined();
    expect(def.operations.delete).toBeUndefined();
  });

  it("create: POST /v1/scorecards with scorecard body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "production_readiness" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scorecard", "create", { body: SAMPLE_SCORECARD_BODY });

    const call = mockRequest.mock.calls[0][0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/v1/scorecards");
    expect(call.body).toEqual(SAMPLE_SCORECARD_BODY);
    expect(call.body.orgIdentifier).toBeUndefined();
    expect(call.body.projectIdentifier).toBeUndefined();
  });

  it("create: fails when scorecard is missing", async () => {
    const client = makeClient();

    await expect(registry.dispatch(client, "scorecard", "create", { body: {} })).rejects.toThrow(
      /scorecard is required/,
    );
  });

  it("update: PUT /v1/scorecards/{scorecardIdentifier}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scorecard", "update", {
      scorecard_id: "production_readiness",
      body: SAMPLE_SCORECARD_BODY,
    });

    const call = mockRequest.mock.calls[0][0] as { method: string; path: string; body: Record<string, unknown> };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/v1/scorecards/production_readiness");
    expect(call.body).toEqual(SAMPLE_SCORECARD_BODY);
  });

  it("update: rejects missing checks to avoid accidental full-replacement clears", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "scorecard", "update", {
        scorecard_id: "production_readiness",
        body: { scorecard: SAMPLE_SCORECARD_BODY.scorecard },
      }),
    ).rejects.toThrow(/checks is required for scorecard updates/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("bodyBuilder helpers match registry specs", () => {
    const createSpec = getOp("scorecard", "create");
    const updateSpec = getOp("scorecard", "update");

    expect(createSpec.skipScopeBodyInjection).toBe(true);
    expect(updateSpec.skipScopeBodyInjection).toBe(true);
    expect(createSpec.bodySchema?.fields.map((f) => f.name)).toEqual(["scorecard", "checks"]);
    expect(updateSpec.bodySchema?.fields.find((f) => f.name === "checks")?.required).toBe(true);
    expect(createSpec.operationPolicy).toEqual({ risk: "low_write", retryPolicy: "do_not_retry" });
    expect(updateSpec.operationPolicy).toEqual({ risk: "low_write", retryPolicy: "safe" });
  });
});

describe("scorecard_check mutate operations", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("exposes create and update but not delete", () => {
    const def = findResource("scorecard_check");
    expect(def.operations.create).toBeDefined();
    expect(def.operations.update).toBeDefined();
    expect(def.operations.delete).toBeUndefined();
  });

  it("create: POST /v1/checks with checkDetails body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "has_readme" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scorecard_check", "create", { body: SAMPLE_CHECK_BODY });

    const call = mockRequest.mock.calls[0][0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/v1/checks");
    expect(call.body).toEqual(SAMPLE_CHECK_BODY);
  });

  it("create: fails when checkDetails is missing", async () => {
    const client = makeClient();

    await expect(registry.dispatch(client, "scorecard_check", "create", { body: {} })).rejects.toThrow(
      /checkDetails is required/,
    );
  });

  it("update: PUT /v1/checks/{checkIdentifier}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scorecard_check", "update", {
      check_id: "has_readme",
      body: SAMPLE_CHECK_BODY,
    });

    const call = mockRequest.mock.calls[0][0] as { method: string; path: string; body: Record<string, unknown> };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/v1/checks/has_readme");
    expect(call.body).toEqual(SAMPLE_CHECK_BODY);
  });

  it("update: rejects rule-based checks without rules", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "scorecard_check", "update", {
        check_id: "has_readme",
        body: {
          checkDetails: {
            identifier: "has_readme",
            name: "Has README",
            description: "Component must have a README file",
            ruleStrategy: "ALL_OF",
          },
        },
      }),
    ).rejects.toThrow(/checkDetails\.rules is required/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("update: rejects advanced checks without expression", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "scorecard_check", "update", {
        check_id: "has_readme",
        body: {
          checkDetails: {
            identifier: "has_readme",
            name: "Has README",
            description: "Component must have a README file",
            ruleStrategy: "ADVANCED",
          },
        },
      }),
    ).rejects.toThrow(/checkDetails\.expression is required/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("bodyBuilder helpers match registry specs", () => {
    const createSpec = getOp("scorecard_check", "create");
    const updateSpec = getOp("scorecard_check", "update");

    expect(createSpec.skipScopeBodyInjection).toBe(true);
    expect(updateSpec.skipScopeBodyInjection).toBe(true);
    expect(createSpec.bodySchema?.fields.map((f) => f.name)).toEqual(["checkDetails"]);
    expect(createSpec.operationPolicy).toEqual({ risk: "low_write", retryPolicy: "do_not_retry" });
    expect(updateSpec.operationPolicy).toEqual({ risk: "low_write", retryPolicy: "safe" });
  });
});
