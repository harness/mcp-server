import { describe, expect, it } from "vitest";
import type { Config } from "../../src/config.js";
import { Registry } from "../../src/registry/index.js";

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
  } as Config;
}

describe("Registry.describeByOperation", () => {
  const registry = new Registry(makeConfig());

  it("returns an error payload for unknown toolsets without throwing", () => {
    const result = registry.describeByOperation({ operation: "list", toolset: "not-a-toolset" });
    expect(result.error).toMatch(/Unknown toolset/);
    expect(result.available_toolsets).toEqual(expect.arrayContaining(["pipelines"]));
  });

  it("omits execute-only types from list operation catalogs", () => {
    const listed = registry.describeByOperation({ operation: "list" });
    const types = (listed.resource_types as Array<{ type: string }>).map((entry) => entry.type);
    expect([...types].sort()).toEqual(registry.getTypesForOperation("list"));
    expect(types).not.toContain("runtime_input_template");
  });

  it("preserves search ranking order for operation-filtered catalogs", () => {
    const filtered = registry.describeByOperation({
      operation: "list",
      searchTerm: "service account",
    });
    const types = (filtered.resource_types as Array<{ type: string }>).map((entry) => entry.type);
    expect(filtered.search_term).toBe("service account");
    expect(types.length).toBeGreaterThan(0);
    expect(types[0]).toBe("service_account");
  });
});
