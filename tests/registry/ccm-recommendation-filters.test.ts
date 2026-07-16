/**
 * Regression coverage for CCM cost recommendation filter resources added in #617.
 * Guards paired cost_category/cost_buckets body construction, filter-panel response
 * normalization, and count extraction through the registry dispatch path.
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
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("CCM cost recommendation filters — paired category/bucket body guards", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
  });

  it("cost_recommendation_stats omits costCategoryDTOs when only cost_category is provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: {} });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "cost_recommendation_stats", "get", {
      cost_category: "Teams",
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(call.body.costCategoryDTOs).toBeUndefined();
  });

  it("cost_recommendation_count omits costCategoryDTOs when only cost_category is provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: 0 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "cost_recommendation_count", "get", {
      cost_category: "Teams",
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(call.body.costCategoryDTOs).toBeUndefined();
  });

  it("cost_recommendation_count forwards min_saving and days_back overrides", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: 12 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "cost_recommendation_count", "get", {
      min_saving: 100,
      days_back: 14,
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(call.body.minSaving).toBe(100);
    expect(call.body.daysBack).toBe(14);
  });
});

describe("CCM cost_recommendation_filter — extractCostCategoryFilterPanel via dispatch", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
  });

  it("normalizes object responses with costBuckets array", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: { costBuckets: ["Engineering", "Platform"] },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "cost_recommendation_filter", "list", {});

    expect(result).toEqual({ values: ["Engineering", "Platform"] });
  });

  it("normalizes object responses with costTargets array", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        costTargets: [{ name: "GCP QA" }, { name: "GCP Prod" }],
      },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "cost_recommendation_filter", "get", {
      cost_category: "Environments",
    });

    expect(result).toEqual({ values: ["GCP QA", "GCP Prod"] });
  });

  it("normalizes object responses with businessMappings array", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        businessMappings: [{ name: "Teams" }, { name: "Projects" }],
      },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "cost_recommendation_filter", "list", {});

    expect(result).toEqual({ values: ["Teams", "Projects"] });
  });

  it("normalizes object responses with costCategories array", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: { costCategories: ["AI Platform", "Security"] },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "cost_recommendation_filter", "list", {});

    expect(result).toEqual({ values: ["AI Platform", "Security"] });
  });

  it("extracts names from mixed string and object array items", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [
        "Direct String",
        { name: "Named Bucket" },
        { costBucket: "Alias Bucket" },
        { ignored: true },
      ],
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "cost_recommendation_filter", "list", {});

    expect(result).toEqual({
      values: ["Direct String", "Named Bucket", "Alias Bucket"],
    });
  });

  it("returns empty values for unrecognized response shapes", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: { unexpected: true } });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "cost_recommendation_filter", "list", {});

    expect(result).toEqual({ values: [] });
  });
});

describe("CCM cost_recommendation_count — countExtract integration", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
  });

  it("surfaces _error when API returns non-numeric data envelope", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: "unexpected" });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "cost_recommendation_count", "get", {});

    expect(result).toEqual({
      count: 0,
      _error: "Unexpected response shape — data is not a number",
    });
  });
});
