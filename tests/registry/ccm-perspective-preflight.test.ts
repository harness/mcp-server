/**
 * Regression tests for cost_perspective.create preflight — settings merge and defaults.
 *
 * perspectiveCreatePreflight fetches CE perspective_preferences from /ng/api/settings,
 * maps them to viewPreferences, deep-merges agent overrides, and sets viewState defaults.
 */
import { describe, it, expect, vi } from "vitest";
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
    ...overrides,
  } as Config;
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

const SETTINGS_FIXTURE = [
  { identifier: "show_others", value: "true" },
  { identifier: "show_anomalies", value: "false" },
  { identifier: "include_aws_discounts", value: "true" },
  { identifier: "show_aws_cost_as", value: "AMORTIZED" },
  { identifier: "include_gcp_discounts", value: "true" },
  { identifier: "show_azure_cost_as", value: "ACTUAL" },
];

describe("cost_perspective create — perspectiveCreatePreflight", () => {
  it("merges account settings into viewPreferences with agent overrides winning", async () => {
    const mockRequest = vi
      .fn()
      .mockResolvedValueOnce({ resource: SETTINGS_FIXTURE })
      .mockResolvedValueOnce({ status: "SUCCESS" });
    const client = makeClient(mockRequest);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));

    await registry.dispatch(client, "cost_perspective", "create", {
      body: {
        name: "Engineering Costs",
        viewPreferences: { includeOthers: false, showAnomalies: true },
      },
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const settingsCall = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, string> };
    expect(settingsCall.path).toBe("/ng/api/settings");
    expect(settingsCall.params.category).toBe("CE");
    expect(settingsCall.params.group).toBe("perspective_preferences");

    const createCall = mockRequest.mock.calls[1]![0] as { body: Record<string, unknown> };
    const prefs = createCall.body.viewPreferences as Record<string, unknown>;
    // Agent override wins over settings default.
    expect(prefs.includeOthers).toBe(false);
    expect(prefs.showAnomalies).toBe(true);
    // Settings-derived AWS/GCP/Azure prefs are preserved.
    expect(prefs.awsPreferences).toEqual({ includeDiscounts: true, awsCost: "AMORTIZED" });
    expect(prefs.gcpPreferences).toEqual({ includeDiscounts: true });
    expect(prefs.azureViewPreferences).toEqual({ costType: "ACTUAL" });
  });

  it("sets viewState, viewType, and viewVersion defaults when absent", async () => {
    const mockRequest = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ status: "SUCCESS" });
    const client = makeClient(mockRequest);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));

    await registry.dispatch(client, "cost_perspective", "create", {
      body: { name: "Minimal Perspective" },
    });

    const createCall = mockRequest.mock.calls[1]![0] as { body: Record<string, unknown> };
    expect(createCall.body.viewState).toBe("COMPLETED");
    expect(createCall.body.viewType).toBe("CUSTOMER");
    expect(createCall.body.viewVersion).toBe("v1");
  });

  it("proceeds without defaults when settings API fails (graceful degradation)", async () => {
    const mockRequest = vi
      .fn()
      .mockRejectedValueOnce(new Error("settings unavailable"))
      .mockResolvedValueOnce({ status: "SUCCESS" });
    const client = makeClient(mockRequest);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));

    await expect(
      registry.dispatch(client, "cost_perspective", "create", {
        body: { name: "Degraded Perspective", viewPreferences: { includeOthers: true } },
      }),
    ).resolves.toBeDefined();

    const createCall = mockRequest.mock.calls[1]![0] as { body: Record<string, unknown> };
    expect(createCall.body.viewPreferences).toEqual({ includeOthers: true });
    expect(createCall.body.viewState).toBe("COMPLETED");
  });
});
