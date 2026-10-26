/**
 * docs/coding-standards.md — "No secrets exposed" (metadata only, never values).
 */
import { describe, it, expect } from "vitest";
import { ALL_TOOLSET_NAMES, Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: ALL_TOOLSET_NAMES.map((name) => `+${name}`).join(","),
  };
}

describe("Coding standards — secret value safety", () => {
  const registry = new Registry(makeConfig());

  it("secret resource is read-only (list/get only — no writes or execute)", () => {
    const def = registry.getResource("secret");
    expect([...Object.keys(def.operations)].sort()).toEqual(["get", "list"]);
    expect(def.executeActions ?? {}).toEqual({});
  });

  it("secrets toolset copy states values are never exposed", () => {
    const toolset = registry.getAllToolsets().find((t) => t.name === "secrets");
    expect(toolset, "secrets toolset must be registered").toBeDefined();
    expect(toolset!.description).toMatch(/never exposed/i);
    const secret = registry.getResource("secret");
    expect(secret.description).toMatch(/NEVER returned/i);
  });
});
