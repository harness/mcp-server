/**
 * harness_describe(operation=...) — catalog filter by CRUD/execute support.
 */
import { describe, expect, it } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";

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
    HARNESS_TOOLSETS: "pipelines",
    ...overrides,
  };
}

type CatalogEntry = { type: string; actions?: string[] };

describe("Registry.describeByOperation", () => {
  it("returns only resource types that support list within the enabled toolsets", () => {
    const registry = new Registry(makeConfig());
    const result = registry.describeByOperation({ operation: "list" });
    const types = (result.resource_types as CatalogEntry[]).map((entry) => entry.type);

    expect(result.operation).toBe("list");
    expect(types).toContain("pipeline");
    expect(types).not.toContain("pipeline_summary");
  });

  it("includes execute action names when operation is execute", () => {
    const registry = new Registry(makeConfig());
    const result = registry.describeByOperation({ operation: "execute" });
    const pipeline = (result.resource_types as CatalogEntry[]).find((entry) => entry.type === "pipeline");

    expect(pipeline?.actions).toContain("run");
  });

  it("intersects operation filter with search_term ranking", () => {
    const registry = new Registry(makeConfig());
    const result = registry.describeByOperation({
      operation: "list",
      searchTerm: "pipeline",
    });
    const types = (result.resource_types as CatalogEntry[]).map((entry) => entry.type);

    expect(result.search_term).toBe("pipeline");
    expect(result.total_results).toBe(types.length);
    expect(types).toContain("pipeline");
    expect(types).not.toContain("pipeline_summary");
  });

  it("returns an error payload for unknown toolset", () => {
    const registry = new Registry(makeConfig());
    const result = registry.describeByOperation({ operation: "list", toolset: "nonexistent" });

    expect(result.error).toMatch(/Unknown toolset/);
    expect(result.available_toolsets).toBeInstanceOf(Array);
  });
});
