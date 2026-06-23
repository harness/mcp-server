import { describe, expect, it } from "vitest";
import type { Config } from "../../src/config.js";
import { hasRequiredDiscoveryScope } from "../../src/resources/scope-check.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.account.token.secret",
    HARNESS_ACCOUNT_ID: "account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  } as Config;
}

describe("hasRequiredDiscoveryScope", () => {
  it("always allows account scope", () => {
    expect(hasRequiredDiscoveryScope("account", makeConfig({ HARNESS_ORG: undefined, HARNESS_PROJECT: undefined }))).toBe(true);
  });

  it("requires non-empty HARNESS_ORG for org scope", () => {
    expect(hasRequiredDiscoveryScope("org", makeConfig({ HARNESS_ORG: "my-org" }))).toBe(true);
    expect(hasRequiredDiscoveryScope("org", makeConfig({ HARNESS_ORG: undefined }))).toBe(false);
    expect(hasRequiredDiscoveryScope("org", makeConfig({ HARNESS_ORG: "" }))).toBe(false);
    expect(hasRequiredDiscoveryScope("org", makeConfig({ HARNESS_ORG: "   " }))).toBe(false);
  });

  it("requires non-empty HARNESS_PROJECT for project scope", () => {
    expect(hasRequiredDiscoveryScope("project", makeConfig({ HARNESS_ORG: "org", HARNESS_PROJECT: "proj" }))).toBe(true);
    expect(hasRequiredDiscoveryScope("project", makeConfig({ HARNESS_ORG: "org", HARNESS_PROJECT: undefined }))).toBe(false);
    expect(hasRequiredDiscoveryScope("project", makeConfig({ HARNESS_ORG: "org", HARNESS_PROJECT: "" }))).toBe(false);
    expect(hasRequiredDiscoveryScope("project", makeConfig({ HARNESS_ORG: undefined, HARNESS_PROJECT: "proj" }))).toBe(false);
  });
});
