import { describe, expect, it } from "vitest";
import { Registry } from "../../src/registry/index.js";

function makeConfig() {
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
    HARNESS_TOOLSETS: "pipelines,services",
  };
}

describe("Registry.describeByOperation", () => {
  const registry = new Registry(makeConfig());

  it("returns an error payload for an unknown toolset filter", () => {
    const result = registry.describeByOperation({
      operation: "list",
      toolset: "not-a-real-toolset",
    }) as { error: string; available_toolsets: string[] };

    expect(result.error).toContain('Unknown toolset "not-a-real-toolset"');
    expect(result.available_toolsets).toContain("pipelines");
    expect(result.available_toolsets).toContain("services");
  });

  it("lists only resource types that support the requested CRUD operation", () => {
    const listed = registry.describeByOperation({ operation: "list" }) as {
      operation: string;
      total_resource_types: number;
      resource_types: Array<{ type: string; toolset: string }>;
    };

    expect(listed.operation).toBe("list");
    expect(listed.total_resource_types).toBe(listed.resource_types.length);
    expect(listed.resource_types.length).toBeGreaterThan(0);

    for (const entry of listed.resource_types) {
      const def = registry.getResource(entry.type);
      expect(def.operations.list, `${entry.type} missing list op`).toBeDefined();
      expect(["pipelines", "services"]).toContain(entry.toolset);
    }

    const createOnly = registry.describeByOperation({ operation: "create", toolset: "services" }) as {
      resource_types: Array<{ type: string }>;
    };
    for (const entry of createOnly.resource_types) {
      expect(registry.getResource(entry.type).operations.create).toBeDefined();
    }
  });

  it("includes execute action names and omits types without execute support", () => {
    const executed = registry.describeByOperation({ operation: "execute", toolset: "pipelines" }) as {
      operation: string;
      resource_types: Array<{ type: string; actions?: string[] }>;
    };

    expect(executed.operation).toBe("execute");
    expect(executed.resource_types.length).toBeGreaterThan(0);

    for (const entry of executed.resource_types) {
      const def = registry.getResource(entry.type);
      const actionNames = Object.keys(def.executeActions ?? {});
      expect(actionNames.length).toBeGreaterThan(0);
      expect(entry.actions?.sort()).toEqual(actionNames.sort());
    }

    const pipeline = executed.resource_types.find((entry) => entry.type === "pipeline");
    expect(pipeline?.actions).toContain("run");
  });

  it("intersects search_term results and preserves search ranking", () => {
    const searchOnly = registry.searchResources("pipeline");
    const filtered = registry.describeByOperation({
      operation: "list",
      searchTerm: "pipeline",
    }) as {
      search_term: string;
      total_results: number;
      resource_types: Array<{ type: string }>;
    };

    expect(filtered.search_term).toBe("pipeline");
    expect(filtered.total_results).toBe(filtered.resource_types.length);
    expect(filtered.resource_types.length).toBeGreaterThan(0);
    expect(filtered.resource_types.length).toBeLessThanOrEqual(searchOnly.length);

    const searchOrder = searchOnly.map((row) => row.type);
    const filteredTypes = filtered.resource_types.map((row) => row.type);
    const ranksInSearch = filteredTypes.map((type) => searchOrder.indexOf(type));
    expect(ranksInSearch.every((index) => index >= 0)).toBe(true);
    expect([...ranksInSearch].sort((a, b) => a - b)).toEqual(ranksInSearch);
  });

  it("returns an empty-search hint when search_term matches nothing", () => {
    const result = registry.describeByOperation({
      operation: "get",
      searchTerm: "zzzz-no-such-resource-type-zzzz",
    }) as {
      total_resource_types: number;
      resource_types: unknown[];
      hint: string;
    };

    expect(result.total_resource_types).toBe(0);
    expect(result.resource_types).toEqual([]);
    expect(result.hint).toContain("No matches found");
  });
});
