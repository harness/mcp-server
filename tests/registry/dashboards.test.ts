/**
 * Registry dispatch tests for dashboard_data — query param wiring for
 * reporting_timeframe after it moved to get-only paramsSchema (PR #406).
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
    HARNESS_TOOLSETS: "dashboards",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("dashboard_data get", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("maps reporting_timeframe to the filters query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "dashboard_data", "get", {
      dashboard_id: "dash-123",
      reporting_timeframe: 7,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/dashboard/download/dashboards/dash-123/csv");
    expect(call.params.filters).toBe(7);
  });

  it("omits filters when reporting_timeframe is not provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "dashboard_data", "get", {
      dashboard_id: "dash-123",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params).not.toHaveProperty("filters");
  });
});
