/**
 * Registry.describeByOperation — operation-filtered catalogs for harness_describe.
 * Complements tests/tools/describe-operation-filter.test.ts (tool wiring) with
 * direct coverage of ranking, hints, and CRUD vs execute entry shapes.
 */
import { describe, it, expect, beforeEach } from "vitest";
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

type CatalogEntry = {
  type: string;
  name: string;
  toolset: string;
  aliases?: string[];
  actions?: string[];
};

function entries(result: Record<string, unknown>): CatalogEntry[] {
  return result.resource_types as CatalogEntry[];
}

describe("Registry.describeByOperation", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("lists the same resource types as getTypesForOperation for each CRUD op", () => {
    for (const operation of ["list", "get", "create", "update", "delete"] as const) {
      const catalog = registry.describeByOperation({ operation });
      const types = entries(catalog).map((entry) => entry.type).sort();
      expect(types, operation).toEqual(registry.getTypesForOperation(operation).sort());
      expect(catalog.total_resource_types).toBe(types.length);
    }
  });

  it("lists executable types with action names and omits types without execute actions", () => {
    const catalog = registry.describeByOperation({ operation: "execute" });
    const types = entries(catalog).map((entry) => entry.type).sort();
    expect(types).toEqual(registry.getTypesWithExecuteActions().sort());
    for (const entry of entries(catalog)) {
      expect(entry.actions?.length).toBeGreaterThan(0);
      expect(entry.actions).toEqual(Object.keys(registry.getExecuteActions(entry.type) ?? {}));
    }
  });

  it("returns lean CRUD entries without ops or actions fields", () => {
    const catalog = registry.describeByOperation({ operation: "list" });
    for (const entry of entries(catalog)) {
      expect(entry).not.toHaveProperty("ops");
      expect(entry).not.toHaveProperty("actions");
    }
  });

  it("preserves searchResources ranking when operation and search_term intersect", () => {
    const searchTerm = "pipeline";
    const ranked = registry.searchResources(searchTerm).map((result) => result.type);
    const catalog = registry.describeByOperation({ operation: "list", searchTerm });
    const filtered = entries(catalog).map((entry) => entry.type);

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered[0]).toBe(ranked[0]);
    expect(new Set(filtered)).toEqual(new Set(ranked.filter((type) => registry.getTypesForOperation("list").includes(type))));
    const rankIndex = new Map(ranked.map((type, index) => [type, index]));
    for (let index = 1; index < filtered.length; index += 1) {
      const prev = rankIndex.get(filtered[index - 1]) ?? -1;
      const current = rankIndex.get(filtered[index]) ?? -1;
      expect(prev).toBeLessThanOrEqual(current);
    }
  });

  it("returns an empty catalog and discovery hint when search matches nothing", () => {
    const catalog = registry.describeByOperation({
      operation: "list",
      searchTerm: "zzzz-no-resource-type-match-zzzz",
    });
    expect(entries(catalog)).toEqual([]);
    expect(catalog.total_results).toBe(0);
    expect(catalog.hint).toMatch(/No matches found/);
  });

  it("rejects unknown toolsets with available_toolsets", () => {
    const catalog = registry.describeByOperation({ operation: "list", toolset: "not-a-real-toolset" });
    expect(catalog.error).toMatch(/Unknown toolset "not-a-real-toolset"/);
    const expectedToolsets = Object.keys(
      (registry.describe() as { toolsets: Record<string, unknown> }).toolsets,
    ).sort();
    expect([...(catalog.available_toolsets as string[])].sort()).toEqual(expectedToolsets);
    expect(catalog.resource_types).toBeUndefined();
  });

  it("intersects toolset with operation support", () => {
    const catalog = registry.describeByOperation({ operation: "list", toolset: "pipelines" });
    const types = entries(catalog);
    expect(types.length).toBeGreaterThan(0);
    expect(types.every((entry) => entry.toolset === "pipelines")).toBe(true);
    expect(types.map((entry) => entry.type).sort()).toEqual(
      registry
        .getTypesForOperation("list")
        .filter((type) => registry.getResource(type).toolset === "pipelines")
        .sort(),
    );
  });
});
