/**
 * Regression tests for IDP toolset — scope routing, workflow auth injection,
 * scorecard stats projection, and tech-doc search body validation.
 */
import { describe, it, expect, vi } from "vitest";
import { idpToolset } from "../../src/registry/toolsets/idp.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test-account.tokenId.secret",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default-org",
    HARNESS_PROJECT: "default-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "idp",
    ...overrides,
  };
}

function makeClient(requestFn: (...args: unknown[]) => unknown = vi.fn().mockResolvedValue({})): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(type: string): ResourceDefinition {
  const res = idpToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in idpToolset`);
  return res;
}

function getOp(type: string, op: "list" | "get"): EndpointSpec {
  const spec = findResource(type).operations[op];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

function getExecuteSpec(type: string, action: string): EndpointSpec {
  const spec = findResource(type).executeActions?.[action];
  if (!spec) throw new Error(`Execute action "${action}" not found on "${type}"`);
  return spec;
}

const WORKFLOW_YAML_WITH_AUTH = `spec:
  parameters:
    authToken:
      type: string
    secretKey:
      type: string
  steps:
    - input:
        apikey: "\${{ parameters.authToken }}"
        apiKeySecret: "\${{ parameters.secretKey }}"
`;

// ─── idp_entity list — scope routing ─────────────────────────────────────────

describe("idp_entity list — scope routing", () => {
  it("sets scopes=account when scope_level is account", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "idp_entity", "list", {
      scope_level: "account",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ scopes: "account" }),
      }),
    );
  });

  it("builds project scope from org_id and project_id", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "idp_entity", "list", {
      scope_level: "project",
      org_id: "my-org",
      project_id: "my-proj",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ scopes: "account.my-org.my-proj" }),
      }),
    );
  });

  it("defaults to config org/project scope when scope_level omitted", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "idp_entity", "list", {});

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ scopes: "account.default-org.default-project" }),
      }),
    );
  });
});

// ─── idp_entity get — required fields ─────────────────────────────────────────

describe("idp_entity get — path and validation", () => {
  it("encodes scope/kind/entity_id in the get path", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "svc-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "idp_entity", "get", {
      kind: "component",
      entity_id: "my-service",
      org_id: "my-org",
      project_id: "my-proj",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1/entities/account.my-org.my-proj/component/my-service",
      }),
    );
  });

  it("throws when kind is missing", async () => {
    const spec = getOp("idp_entity", "get");
    expect(() =>
      spec.pathBuilder!({ entity_id: "x" }, { HARNESS_ACCOUNT_ID: "acct" }),
    ).toThrow(/Missing required field "kind"/);
  });
});

// ─── scorecard_check list — sort param merge ─────────────────────────────────

describe("scorecard_check list — sort merge", () => {
  it("combines sort_type and sort_order into a single sort query param", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scorecard_check", "list", {
      sort_type: "name",
      sort_order: "DESC",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ sort: "name,DESC" }),
      }),
    );
  });
});

// ─── scorecard_stats — response projection ───────────────────────────────────

describe("scorecard_stats get — response projection", () => {
  it("converts timestamp to RFC3339 time and preserves stats array", async () => {
    const registry = new Registry(makeConfig());
    const ts = 1_700_000_000_000;
    const mockRequest = vi.fn().mockResolvedValue({
      name: "Security",
      stats: [{ entity: "svc-a", score: 80 }],
      timestamp: ts,
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "scorecard_stats", "get", {
      scorecard_id: "security-scorecard",
    }) as Record<string, unknown>;

    expect(result).toMatchObject({
      name: "Security",
      stats: [{ entity: "svc-a", score: 80 }],
      time: new Date(ts).toISOString(),
      openInHarness: expect.stringContaining("/idp/scorecards/security-scorecard"),
    });
    expect(result).not.toHaveProperty("timestamp");
  });

  it("returns empty time string when timestamp is null", async () => {
    const spec = getOp("scorecard_stats", "get");
    const result = spec.responseExtractor!({ name: "Reliability", stats: [], timestamp: null });
    expect(result).toEqual({ name: "Reliability", stats: [], time: "" });
  });
});

// ─── idp_score list — response shape ─────────────────────────────────────────

describe("idp_score list — response shape", () => {
  it("projects overall_score, items, and total from scorecard_scores", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      overall_score: 72,
      scorecard_scores: [
        { scorecard: "security", score: 80 },
        { scorecard: "reliability", score: 64 },
      ],
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "idp_score", "list", {
      entity_identifier: "default/Component/my-service",
    });

    expect(result).toEqual({
      overall_score: 72,
      items: [
        { scorecard: "security", score: 80 },
        { scorecard: "reliability", score: 64 },
      ],
      total: 2,
    });
  });
});

// ─── idp_tech_doc list — query validation ────────────────────────────────────

describe("idp_tech_doc list — query validation", () => {
  it("accepts query filter and posts to semantic-search endpoint", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ documents: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "idp_tech_doc", "list", {
      query: "how to troubleshoot a failing workflow?",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/tech-docs/semantic-search",
        body: { query: "how to troubleshoot a failing workflow?" },
      }),
    );
  });

  it("falls back to search_term when query is omitted", async () => {
    const spec = getOp("idp_tech_doc", "list");
    expect(spec.bodyBuilder!({ search_term: "install delegate" })).toEqual({
      query: "install delegate",
    });
  });

  it("throws when neither query nor search_term is provided", async () => {
    const spec = getOp("idp_tech_doc", "list");
    expect(() => spec.bodyBuilder!({})).toThrow(/Missing required field 'query'/);
  });
});

// ─── idp_workflow execute — auth param injection ─────────────────────────────

describe("idp_workflow execute — auth param injection", () => {
  it("auto-fills apikey and apiKeySecret parameter values from workflow YAML", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "idp_workflow", "execute", {
      workflow_id: "onboard-service",
      body: {
        workflow_details: {
          identifier: "onboard-service",
          yaml: WORKFLOW_YAML_WITH_AUTH,
        },
        values: { otherParam: "hello" },
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v2/workflows/execute",
        body: {
          identifier: "onboard-service",
          values: {
            otherParam: "hello",
            authToken: "user.token",
            secretKey: "pat.test-account.tokenId.secret",
          },
        },
      }),
    );
  });

  it("prefers body.api_key_secret over HARNESS_API_KEY for apiKeySecret refs", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "idp_workflow", "execute", {
      body: {
        workflow_details: {
          identifier: "wf-1",
          yaml: WORKFLOW_YAML_WITH_AUTH,
        },
        api_key_secret: "user-supplied-key",
      },
    });

    const call = mockRequest.mock.calls[0][0] as { body: { values: Record<string, string> } };
    expect(call.body.values.secretKey).toBe("user-supplied-key");
  });

  it("throws when apiKeySecret is required but no key is available", async () => {
    const registry = new Registry(makeConfig({ HARNESS_API_KEY: "" }));
    const client = makeClient();

    await expect(
      registry.dispatchExecute(client, "idp_workflow", "execute", {
        body: {
          workflow_details: {
            identifier: "wf-1",
            yaml: WORKFLOW_YAML_WITH_AUTH,
          },
        },
      }),
    ).rejects.toThrow(/Missing apiKeySecret/);
  });

  it("throws when workflow_details is missing", async () => {
    const spec = getExecuteSpec("idp_workflow", "execute");
    expect(() => spec.bodyBuilder!({ body: {} })).toThrow(/workflow_details is required/);
  });

  it("throws when workflow_details.yaml is not a string", async () => {
    const spec = getExecuteSpec("idp_workflow", "execute");
    expect(() =>
      spec.bodyBuilder!({
        body: { workflow_details: { identifier: "wf-1", yaml: 123 } },
      }),
    ).toThrow(/workflow_details\.yaml is missing or not a string/);
  });

  it("does not overwrite user-supplied values for auth parameters", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "idp_workflow", "execute", {
      body: {
        workflow_details: {
          identifier: "wf-1",
          yaml: WORKFLOW_YAML_WITH_AUTH,
        },
        values: {
          authToken: "custom-token",
          secretKey: "custom-secret",
        },
      },
    });

    const call = mockRequest.mock.calls[0][0] as { body: { values: Record<string, string> } };
    expect(call.body.values.authToken).toBe("custom-token");
    expect(call.body.values.secretKey).toBe("custom-secret");
  });
});
