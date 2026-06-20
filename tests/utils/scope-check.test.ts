import { describe, it, expect } from "vitest";
import type { Config } from "../../src/config.js";
import { hasRequiredDiscoveryScope } from "../../src/resources/scope-check.js";

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
    ...overrides,
  } as Config;
}

describe("hasRequiredDiscoveryScope", () => {
  it("account scope is always satisfied", () => {
    expect(hasRequiredDiscoveryScope("account", makeConfig({
      HARNESS_ORG: undefined,
      HARNESS_PROJECT: undefined,
    }))).toBe(true);
  });

  it("org scope requires a non-empty HARNESS_ORG", () => {
    expect(hasRequiredDiscoveryScope("org", makeConfig({ HARNESS_ORG: undefined }))).toBe(false);
    expect(hasRequiredDiscoveryScope("org", makeConfig({ HARNESS_ORG: "   " }))).toBe(false);
    expect(hasRequiredDiscoveryScope("org", makeConfig({ HARNESS_ORG: "platform" }))).toBe(true);
  });

  it("project scope requires org and project", () => {
    expect(hasRequiredDiscoveryScope("project", makeConfig({
      HARNESS_ORG: "platform",
      HARNESS_PROJECT: undefined,
    }))).toBe(false);
    expect(hasRequiredDiscoveryScope("project", makeConfig({
      HARNESS_ORG: "platform",
      HARNESS_PROJECT: "",
    }))).toBe(false);
    expect(hasRequiredDiscoveryScope("project", makeConfig({
      HARNESS_ORG: "platform",
      HARNESS_PROJECT: "my-project",
    }))).toBe(true);
  });
});
