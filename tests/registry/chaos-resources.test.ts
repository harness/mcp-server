import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";

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
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("new chaos resources", () => {
  it("lists ChaosGuard conditions from the documented conditions envelope", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "chaos" }));
    const mockRequest = vi.fn().mockResolvedValue({
      conditions: [{ conditionId: "cond-1", name: "Block prod" }],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "chaos_guard_condition", "list", {
      org_id: "org1",
      project_id: "proj1",
      limit: 20,
      page: 0,
    }) as { items: unknown[]; total: number };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/chaosguard-conditions");
    expect(call.params).toMatchObject({
      organizationIdentifier: "org1",
      projectIdentifier: "proj1",
      limit: 20,
      page: 0,
    });
    expect(result).toEqual({
      items: [{ conditionId: "cond-1", name: "Block prod" }],
      total: 1,
    });
  });

  it("lists ChaosGuard rules from the documented rules envelope", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "chaos" }));
    const mockRequest = vi.fn().mockResolvedValue({
      rules: [{ ruleId: "rule-1", name: "Business hours" }],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "chaos_guard_rule", "list", {
      org_id: "org1",
      project_id: "proj1",
    }) as { items: unknown[]; total: number };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/chaosguard-rules");
    expect(result).toEqual({
      items: [{ ruleId: "rule-1", name: "Business hours" }],
      total: 1,
    });
  });

  it("lists chaos recommendations with POST and the recommendations envelope", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "chaos" }));
    const mockRequest = vi.fn().mockResolvedValue({
      recommendations: [{ recommendationID: "rec-1", recommendationCategory: "FAULT" }],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "chaos_recommendation", "list", {
      org_id: "org1",
      project_id: "proj1",
      limit: 20,
      page: 0,
    }) as { items: unknown[]; total: number };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/rest/recommendations");
    expect(call.params).toMatchObject({
      organizationIdentifier: "org1",
      projectIdentifier: "proj1",
      limit: 20,
      page: 0,
    });
    expect(call.body).toEqual({});
    expect(result).toEqual({
      items: [{ recommendationID: "rec-1", recommendationCategory: "FAULT" }],
      total: 1,
    });
  });

  it("gets a chaos recommendation by recommendationID query parameter", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "chaos" }));
    const mockRequest = vi.fn().mockResolvedValue({ recommendationID: "rec-1" });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "chaos_recommendation", "get", {
      org_id: "org1",
      project_id: "proj1",
      recommendation_id: "rec-1",
    }) as Record<string, unknown>;

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/rest/recommendations");
    expect(call.params.recommendationID).toBe("rec-1");
    expect(result.recommendationID).toBe("rec-1");
  });

  it("uses v3 risk endpoints for list and get", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "chaos" }));
    const mockRequest = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ identity: "risk-1" }], pagination: { totalItems: 1 } })
      .mockResolvedValueOnce({ identity: "risk-1" });
    const client = makeClient(mockRequest);

    const listResult = await registry.dispatch(client, "chaos_risk", "list", {
      org_id: "org1",
      project_id: "proj1",
    }) as { items: unknown[]; total: number };
    const getResult = await registry.dispatch(client, "chaos_risk", "get", {
      org_id: "org1",
      project_id: "proj1",
      risk_id: "risk-1",
    }) as Record<string, unknown>;

    expect(mockRequest.mock.calls[0][0].path).toBe("/chaos/manager/api/v3/risks");
    expect(mockRequest.mock.calls[1][0].path).toBe("/chaos/manager/api/v3/risks/risk-1");
    expect(listResult.items).toEqual([{ identity: "risk-1" }]);
    expect(getResult.identity).toBe("risk-1");
  });
});
