/**
 * P0 — alias layer contract.
 *
 * The module→capability rename is non-breaking: old toolset names (in
 * HARNESS_TOOLSETS) and old resourceType values (the public `type` param) must
 * keep resolving to the renamed canonical entities. This suite exercises the
 * mechanism generically via `additionalToolsets` so it does not depend on any
 * specific rename shipping first, and asserts the load-time collision guards.
 */
import { describe, it, expect } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { ResourceDefinition, ToolsetDefinition } from "../../src/registry/types.js";

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

function res(overrides: Partial<ResourceDefinition> & Pick<ResourceDefinition, "resourceType" | "toolset">): ResourceDefinition {
  return {
    displayName: overrides.resourceType,
    description: "test resource",
    scope: "account",
    identifierFields: [`${overrides.resourceType}_id`],
    operations: {
      list: { method: "GET", path: "/x", operationPolicy: { risk: "read", retryPolicy: "safe" } },
    },
    ...overrides,
  };
}

/** A synthetic renamed toolset: canonical `newcap` (was `oldcode`) with one renamed resource. */
function renamedToolset(): ToolsetDefinition {
  return {
    name: "newcap",
    aliases: ["oldcode"],
    displayName: "New Capability",
    description: "renamed toolset",
    resources: [
      res({
        resourceType: "newcap_widget",
        aliases: ["oldcode_widget"],
        toolset: "newcap",
        executeActions: {
          poke: {
            method: "POST",
            path: "/x/poke",
            operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
            actionDescription: "poke it",
          },
        },
      }),
    ],
  };
}

function registryWith(toolsets: ToolsetDefinition[], overrides: Partial<Config> = {}): Registry {
  return new Registry(makeConfig(overrides), { additionalToolsets: toolsets });
}

describe("P0 alias layer — resourceType aliases", () => {
  it("resolves an old resourceType to the same definition as the canonical name", () => {
    const registry = registryWith([renamedToolset()], { HARNESS_TOOLSETS: "newcap" });
    const viaOld = registry.getResource("oldcode_widget");
    const viaNew = registry.getResource("newcap_widget");
    expect(viaOld).toBe(viaNew);
    expect(viaOld.resourceType).toBe("newcap_widget");
  });

  it("resolves operations and execute actions through the alias", () => {
    const registry = registryWith([renamedToolset()], { HARNESS_TOOLSETS: "newcap" });
    expect(registry.supportsOperation("oldcode_widget", "list")).toBe(true);
    expect(registry.supportsOperation("newcap_widget", "list")).toBe(true);
    const actions = registry.getExecuteActions("oldcode_widget");
    expect(actions && Object.keys(actions)).toEqual(["poke"]);
  });

  it("does not enumerate aliases in getAllResourceTypes", () => {
    const registry = registryWith([renamedToolset()], { HARNESS_TOOLSETS: "newcap" });
    const types = registry.getAllResourceTypes();
    expect(types).toContain("newcap_widget");
    expect(types).not.toContain("oldcode_widget");
  });

  it("still throws for genuinely unknown resource types", () => {
    const registry = registryWith([renamedToolset()], { HARNESS_TOOLSETS: "newcap" });
    expect(() => registry.getResource("does_not_exist")).toThrow(/Unknown resource_type/);
  });
});

describe("P0 alias layer — toolset aliases via HARNESS_TOOLSETS", () => {
  it("enables the renamed toolset when the old name is used (explicit list)", () => {
    const registry = registryWith([renamedToolset()], { HARNESS_TOOLSETS: "oldcode" });
    const names = registry.getAllToolsets().map((t) => t.name);
    expect(names).toEqual(["newcap"]);
    // resources of the renamed toolset are loaded and addressable by old + new type
    expect(registry.getResource("oldcode_widget").resourceType).toBe("newcap_widget");
  });

  it("supports the old name behind the additive (+) modifier", () => {
    const registry = registryWith([renamedToolset()], { HARNESS_TOOLSETS: "+oldcode" });
    const names = registry.getAllToolsets().map((t) => t.name);
    expect(names).toContain("newcap");
    // additive keeps the defaults too
    expect(names.length).toBeGreaterThan(1);
  });

  it("preserves the pre-existing static agent-pipelines → agents alias", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "agent-pipelines" }));
    const names = registry.getAllToolsets().map((t) => t.name);
    expect(names).toEqual(["agents"]);
  });
});

describe("P0 alias layer — merge (two old names → one toolset)", () => {
  it("lets multiple aliases target the same canonical toolset", () => {
    // Uses synthetic old names (not the real sto/scs toolsets, which still
    // exist today and would legitimately trip the shadow guard until P2).
    const merged: ToolsetDefinition = {
      name: "merged_cap",
      aliases: ["legacy_one", "legacy_two"],
      displayName: "Merged Capability",
      description: "merged toolset",
      resources: [res({ resourceType: "merged_cap_issue", toolset: "merged_cap" })],
    };
    const fromOne = registryWith([merged], { HARNESS_TOOLSETS: "legacy_one" });
    const fromTwo = registryWith([merged], { HARNESS_TOOLSETS: "legacy_two" });
    expect(fromOne.getAllToolsets().map((t) => t.name)).toEqual(["merged_cap"]);
    expect(fromTwo.getAllToolsets().map((t) => t.name)).toEqual(["merged_cap"]);
  });
});

describe("P0 alias layer — load-time collision guards", () => {
  it("throws when a resource alias shadows a canonical resourceType", () => {
    const bad: ToolsetDefinition = {
      name: "t",
      displayName: "T",
      description: "d",
      resources: [
        res({ resourceType: "canonical_a", toolset: "t" }),
        res({ resourceType: "canonical_b", aliases: ["canonical_a"], toolset: "t" }),
      ],
    };
    expect(() => registryWith([bad])).toThrow(/shadows a canonical resourceType/);
  });

  it("throws when two resources claim the same alias", () => {
    const bad: ToolsetDefinition = {
      name: "t",
      displayName: "T",
      description: "d",
      resources: [
        res({ resourceType: "canonical_a", aliases: ["legacy"], toolset: "t" }),
        res({ resourceType: "canonical_b", aliases: ["legacy"], toolset: "t" }),
      ],
    };
    expect(() => registryWith([bad])).toThrow(/claimed by both/);
  });

  it("throws when a toolset alias shadows a canonical toolset name", () => {
    const bad: ToolsetDefinition = {
      name: "t2",
      aliases: ["pipelines"],
      displayName: "T2",
      description: "d",
      resources: [res({ resourceType: "t2_thing", toolset: "t2" })],
    };
    expect(() => registryWith([bad])).toThrow(/shadows a canonical toolset name/);
  });

  it("throws when two toolsets claim the same alias", () => {
    const a: ToolsetDefinition = {
      name: "cap_a",
      aliases: ["dup"],
      displayName: "A",
      description: "d",
      resources: [res({ resourceType: "cap_a_thing", toolset: "cap_a" })],
    };
    const b: ToolsetDefinition = {
      name: "cap_b",
      aliases: ["dup"],
      displayName: "B",
      description: "d",
      resources: [res({ resourceType: "cap_b_thing", toolset: "cap_b" })],
    };
    expect(() => registryWith([a, b])).toThrow(/claimed by both/);
  });
});
