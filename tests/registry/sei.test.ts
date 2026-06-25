/**
 * Registry dispatch tests for the SEI toolset — body builders, path builders,
 * and team/org-tree routing. SEI uses passthrough extractors, so request-shape
 * tests are the primary regression guard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

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
    HARNESS_TOOLSETS: "sei",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("sei_dora_metric get", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("routes mttr metric to the mttr path with camelCase body and MONTH default granularity", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ value: 42 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "sei_dora_metric", "get", {
      metric: "mttr",
      team_ref_id: "team-99",
      date_start: "2026-01-01",
      date_end: "2026-01-31",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gateway/sei/api/v2/insights/efficiency/mttr");
    expect(call.body).toEqual({
      teamRefId: "team-99",
      dateStart: "2026-01-01",
      dateEnd: "2026-01-31",
      granularity: "MONTH",
    });
  });

  it("routes change_failure_rate_drilldown to the drilldown suffix", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "sei_dora_metric", "get", {
      metric: "change_failure_rate_drilldown",
      date_start: "2026-01-01",
      date_end: "2026-01-31",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.path).toBe("/gateway/sei/api/v2/insights/efficiency/changeFailureRate/drilldown");
  });
});

describe("sei_productivity_metric get", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("coerces numeric team_ref_id strings and omits invalid values", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "sei_productivity_metric", "get", {
      team_ref_id: "123",
      date_start: "2026-01-01",
      date_end: "2026-01-31",
    });

    expect(mockRequest.mock.calls[0][0].body.teamRefIds).toEqual([123]);
  });

  it("omits teamRefIds when team_ref_id is empty or non-numeric", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "sei_productivity_metric", "get", {
      team_ref_id: "",
      date_start: "2026-01-01",
      date_end: "2026-01-31",
    });

    expect(mockRequest.mock.calls[0][0].body).not.toHaveProperty("teamRefIds");

    mockRequest.mockClear();

    await registry.dispatch(client, "sei_productivity_metric", "get", {
      team_ref_id: "not-a-number",
      date_start: "2026-01-01",
      date_end: "2026-01-31",
    });

    expect(mockRequest.mock.calls[0][0].body).not.toHaveProperty("teamRefIds");
  });
});

describe("sei_ai_usage get", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("expands all_assistants to cursor and windsurf integration types", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "sei_ai_usage", "get", {
      aspect: "metrics",
      team_ref_id: "55",
      date_start: "2026-01-01",
      date_end: "2026-01-31",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.path).toBe("/gateway/sei/api/v2/insights/coding-assistant/usage/metrics");
    expect(call.body.integrationType).toEqual(["cursor", "windsurf"]);
    expect(call.body.teamRefId).toBe(55);
  });

  it("passes a single integration_type through unchanged", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "sei_ai_usage", "get", {
      aspect: "summary",
      integration_type: "cursor",
      date_start: "2026-01-01",
      date_end: "2026-01-31",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.path).toBe("/gateway/sei/api/v2/insights/coding-assistant/usage/summary");
    expect(call.body.integrationType).toEqual(["cursor"]);
  });
});

describe("sei_team_detail list", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("builds developers aspect path from team_ref_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "sei_team_detail", "list", {
      team_ref_id: "team-42",
      aspect: "developers",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gateway/sei/api/v2/teams/team-42/developers");
  });

  it("throws locally when team_ref_id is missing", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "sei_team_detail", "list", { aspect: "integrations" }),
    ).rejects.toThrow(/team_ref_id is required/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("sei_org_tree_detail get", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("maps business_alignment_profile aspect to businessAlignmentProfile path suffix", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "sei_org_tree_detail", "get", {
      org_tree_id: "tree-7",
      aspect: "business_alignment_profile",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.path).toBe("/gateway/sei/api/v2/org-trees/tree-7/businessAlignmentProfile");
  });

  it("throws locally when org_tree_id is missing", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "sei_org_tree_detail", "get", { aspect: "teams" }),
    ).rejects.toThrow(/org_tree_id is required/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
