/**
 * Direct Registry.describeByOperation coverage (harness_describe operation filter).
 * Complements tests/tools/describe-operation-filter.test.ts by exercising ranking,
 * toolset errors, and empty-search hints without MCP tool wiring.
 */
import { describe, it, expect } from "vitest";
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

describe("Registry.describeByOperation", () => {
  const registry = new Registry(makeConfig());

  it("returns an unknown-toolset error with available names", () => {
    const result = registry.describeByOperation({ operation: "list", toolset: "not-real" }) as {
      error?: string;
      available_toolsets?: string[];
    };
    expect(result.error).toMatch(/Unknown toolset "not-real"/);
    expect(result.available_toolsets?.length).toBeGreaterThan(0);
    expect(result.available_toolsets).toContain("pipelines");
  });

  it("omits per-type operation lists for CRUD filters", () => {
    const result = registry.describeByOperation({ operation: "list" }) as {
      resource_types: Array<{ type: string; ops?: string[]; actions?: string[] }>;
    };
    expect(result.resource_types.length).toBeGreaterThan(0);
    expect(result.resource_types.every((entry) => entry.ops === undefined && entry.actions === undefined)).toBe(
      true,
    );
    expect(result.resource_types.map((entry) => entry.type).sort()).toEqual(
      registry.getTypesForOperation("list").sort(),
    );
  });

  it("includes action names only for execute filters", () => {
    const result = registry.describeByOperation({ operation: "execute" }) as {
      resource_types: Array<{ type: string; actions?: string[]; ops?: string[] }>;
    };
    const pipeline = result.resource_types.find((entry) => entry.type === "pipeline");
    expect(pipeline?.actions).toEqual(Object.keys(registry.getExecuteActions("pipeline") ?? {}));
    expect(pipeline?.ops).toBeUndefined();
    expect(result.resource_types.map((entry) => entry.type).sort()).toEqual(
      registry.getTypesWithExecuteActions().sort(),
    );
  });

  it("preserves search ranking when intersecting with an operation", () => {
    const term = "pipeline";
    const ranked = registry.searchResources(term).map((row) => row.type);
    expect(ranked.length).toBeGreaterThan(0);

    const filtered = registry.describeByOperation({ operation: "list", searchTerm: term }) as {
      search_term: string;
      total_results: number;
      resource_types: Array<{ type: string }>;
    };
    const types = filtered.resource_types.map((entry) => entry.type);
    expect(filtered.search_term).toBe(term);
    expect(filtered.total_results).toBe(types.length);
    expect(types.every((type) => registry.getTypesForOperation("list").includes(type))).toBe(true);

    const listableRank = ranked.filter((type) => registry.getTypesForOperation("list").includes(type));
    expect(types).toEqual(listableRank);
  });

  it("surfaces an empty-search hint when no types match", () => {
    const result = registry.describeByOperation({
      operation: "list",
      searchTerm: "zzzz-no-such-resource-zzzz",
    }) as { resource_types: unknown[]; hint?: string };
    expect(result.resource_types).toEqual([]);
    expect(result.hint).toMatch(/No matches found/);
  });
});
