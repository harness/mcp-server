/**
 * Regression tests for IDP scorecard and scorecard_check create/update (#593).
 * Verifies path construction, body validation, and list sort query wiring.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { idpToolset } from "../../src/registry/toolsets/idp.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

const SAMPLE_SCORECARD_BODY = {
  scorecard: {
    name: "Security Standards",
    identifier: "security-standards",
    description: "Baseline security checks for services",
    published: true,
  },
  checks: [{ identifier: "has-owner", weightage: 100 }],
};

const SAMPLE_CHECK_BODY = {
  checkDetails: {
    identifier: "has-owner",
    name: "Has Owner",
    description: "Entity must declare an owner",
    ruleStrategy: "ALL_OF",
    defaultBehaviour: "FAIL",
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

describe("scorecard mutate operations (#593)", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("exposes create and update but not delete", () => {
    const def = findResource("scorecard");
    expect(def.operations.create).toBeDefined();
    expect(def.operations.update).toBeDefined();
    expect(def.operations.delete).toBeUndefined();
    expect(def.scope).toBe("account");
  });

  it("create: POST /v1/scorecards with scorecard body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "security-standards" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scorecard", "create", {
      body: SAMPLE_SCORECARD_BODY,
    });

    const call = mockRequest.mock.calls[0][0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/v1/scorecards");
    expect(call.body).toEqual(SAMPLE_SCORECARD_BODY);
  });

  it("create: fails when scorecard object is missing", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "scorecard", "create", { body: { checks: [] } }),
    ).rejects.toThrow(/scorecard is required/);
  });

  it("update: PUT /v1/scorecards/{scorecardIdentifier}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "security-standards" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scorecard", "update", {
      scorecard_id: "security-standards",
      body: SAMPLE_SCORECARD_BODY,
    });

    const call = mockRequest.mock.calls[0][0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/v1/scorecards/security-standards");
    expect(call.body).toEqual(SAMPLE_SCORECARD_BODY);
  });

  it("bodySchema and operation policies match registry specs", () => {
    const createSpec = getOp("scorecard", "create");
    const updateSpec = getOp("scorecard", "update");

    expect(createSpec.skipScopeBodyInjection).toBe(true);
    expect(updateSpec.skipScopeBodyInjection).toBe(true);
    expect(createSpec.bodySchema?.fields.map((f) => f.name)).toEqual(["scorecard", "checks"]);
    expect(createSpec.operationPolicy).toEqual({ risk: "low_write", retryPolicy: "do_not_retry" });
    expect(updateSpec.operationPolicy).toEqual({ risk: "low_write", retryPolicy: "safe" });
  });
});

describe("scorecard_check mutate operations (#593)", () => {
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
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "has-owner" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scorecard_check", "create", {
      body: SAMPLE_CHECK_BODY,
    });

    const call = mockRequest.mock.calls[0][0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/v1/checks");
    expect(call.body).toEqual(SAMPLE_CHECK_BODY);
  });

  it("create: fails when checkDetails object is missing", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "scorecard_check", "create", { body: {} }),
    ).rejects.toThrow(/checkDetails is required/);
  });

  it("update: PUT /v1/checks/{checkIdentifier}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "has-owner" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scorecard_check", "update", {
      check_id: "has-owner",
      body: SAMPLE_CHECK_BODY,
    });

    const call = mockRequest.mock.calls[0][0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/v1/checks/has-owner");
    expect(call.body).toEqual(SAMPLE_CHECK_BODY);
  });

  it("list: combines sort_type and sort_order into sort query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [], totalItems: 0 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scorecard_check", "list", {
      sort_type: "name",
      sort_order: "ASC",
    });

    const call = mockRequest.mock.calls[0][0] as { params: Record<string, unknown> };
    expect(call.params.sort).toBe("name,ASC");
  });

  it("get: forwards is_custom as custom query param with default false", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "has-owner" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scorecard_check", "get", {
      check_id: "has-owner",
    });

    const call = mockRequest.mock.calls[0][0] as { params: Record<string, unknown> };
    expect(call.params.custom).toBe("false");
  });
});
