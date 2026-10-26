import { describe, expect, it } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";

function makeConfig(): Config {
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
    HARNESS_TOOLSETS: undefined,
  } as Config;
}

describe("Registry.describeByOperation", () => {
  const registry = new Registry(makeConfig());

  it("returns an error payload for an unknown toolset", () => {
    const result = registry.describeByOperation({ operation: "list", toolset: "not-real" });
    expect(result.error).toMatch(/Unknown toolset/);
    expect(result.available_toolsets).toEqual(expect.arrayContaining(["pipelines"]));
  });

  it("lists only resource types that support the requested CRUD operation", () => {
    const result = registry.describeByOperation({ operation: "list" });
    const types = (result.resource_types as Array<{ type: string }>).map((entry) => entry.type);
    expect(types.sort()).toEqual(registry.getTypesForOperation("list"));
    expect(types).not.toContain("runtime_input_template");
  });

  it("returns execute-capable types with action names and omits CRUD-only types", () => {
    const result = registry.describeByOperation({ operation: "execute" });
    const entries = result.resource_types as Array<{ type: string; actions?: string[] }>;
    expect(entries.map((entry) => entry.type).sort()).toEqual(registry.getTypesWithExecuteActions());
    const pipeline = entries.find((entry) => entry.type === "pipeline");
    expect(pipeline?.actions).toEqual(Object.keys(registry.getExecuteActions("pipeline") ?? {}));
    expect(entries.every((entry) => entry.actions && entry.actions.length > 0)).toBe(true);
  });

  it("preserves search ranking when intersecting with an operation filter", () => {
    const ranked = registry.searchResources("pipeline").map((entry) => entry.type);
    const result = registry.describeByOperation({ operation: "list", searchTerm: "pipeline" });
    const filtered = (result.resource_types as Array<{ type: string }>).map((entry) => entry.type);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered[0]).toBe(ranked[0]);
    expect(result.total_results).toBe(filtered.length);
  });

  it("surfaces an empty-search hint when the term matches nothing", () => {
    const result = registry.describeByOperation({ operation: "list", searchTerm: "banana" });
    expect(result.resource_types).toEqual([]);
    expect(result.hint).toMatch(/No matches found/);
  });
});
