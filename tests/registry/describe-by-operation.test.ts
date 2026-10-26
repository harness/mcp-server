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
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
  };
}

describe("Registry.describeByOperation", () => {
  const registry = new Registry(makeConfig());

  it("returns lean list entries for a CRUD operation without ops/actions fields", () => {
    const result = registry.describeByOperation({ operation: "list" });
    const types = result.resource_types as Array<Record<string, unknown>>;
    expect(result.operation).toBe("list");
    expect(types.map((entry) => entry.type).sort()).toEqual(registry.getTypesForOperation("list"));
    expect(types.every((entry) => entry.ops === undefined && entry.actions === undefined)).toBe(true);
  });

  it("includes execute action names and omits types without execute actions", () => {
    const result = registry.describeByOperation({ operation: "execute" });
    const types = result.resource_types as Array<{ type: string; actions?: string[] }>;
    expect(types.map((entry) => entry.type).sort()).toEqual(registry.getTypesWithExecuteActions());
    const pipeline = types.find((entry) => entry.type === "pipeline");
    expect(pipeline?.actions).toEqual(Object.keys(registry.getExecuteActions("pipeline") ?? {}));
    expect(types.every((entry) => entry.actions && entry.actions.length > 0)).toBe(true);
  });

  it("preserves search ranking when intersecting with an operation filter", () => {
    const term = "pipeline";
    const ranked = registry.searchResources(term).map((entry) => entry.type);
    const filtered = registry.describeByOperation({ operation: "list", searchTerm: term });
    const types = (filtered.resource_types as Array<{ type: string }>).map((entry) => entry.type);
    const rankedListTypes = ranked.filter((type) => registry.getTypesForOperation("list").includes(type));
    expect(types).toEqual(rankedListTypes);
  });

  it("returns unknown toolset guidance without throwing", () => {
    const result = registry.describeByOperation({ operation: "list", toolset: "not-a-toolset" });
    expect(result.error).toMatch(/Unknown toolset/);
    expect(result.available_toolsets).toEqual(expect.arrayContaining(["pipelines"]));
  });

  it("sets empty-search hint when operation filter eliminates all matches", () => {
    const result = registry.describeByOperation({ operation: "list", searchTerm: "zzzz-no-such-resource" });
    expect(result.resource_types).toEqual([]);
    expect(result.hint).toMatch(/No matches found/);
  });
});
