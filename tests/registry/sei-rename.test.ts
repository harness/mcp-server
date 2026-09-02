/**
 * SEI → developer_insights rename (P4a).
 *
 * The rename is non-breaking: the toolset is now `developer_insights` (alias
 * `sei`) and every `sei_*` resourceType resolves to its `developer_insights_*`
 * canonical name via the alias layer. Old names stay out of enumeration.
 */
import { describe, it, expect } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import { seiToolset } from "../../src/registry/toolsets/sei.js";

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
    LOG_LEVEL: "error",
    ...overrides,
  } as Config;
}

const RENAMES: Array<[string, string]> = [
  ["sei_metric", "developer_insights_metric"],
  ["sei_productivity_metric", "developer_insights_productivity_metric"],
  ["sei_dora_metric", "developer_insights_dora_metric"],
  ["sei_team", "developer_insights_team"],
  ["sei_team_detail", "developer_insights_team_detail"],
  ["sei_org_tree", "developer_insights_org_tree"],
  ["sei_org_tree_detail", "developer_insights_org_tree_detail"],
  ["sei_business_alignment", "developer_insights_business_alignment"],
  ["sei_ai_usage", "developer_insights_ai_usage"],
  ["sei_ai_adoption", "developer_insights_ai_adoption"],
  ["sei_ai_impact", "developer_insights_ai_impact"],
  ["sei_ai_raw_metric", "developer_insights_ai_raw_metric"],
];

describe("SEI → developer_insights rename", () => {
  const registry = new Registry(makeConfig());

  it("renames the toolset to developer_insights with a sei alias", () => {
    expect(seiToolset.name).toBe("developer_insights");
    expect(seiToolset.aliases).toContain("sei");
  });

  it("resolves the legacy sei_dora_metric type to the canonical name", () => {
    expect(registry.getResource("sei_dora_metric").resourceType).toBe("developer_insights_dora_metric");
  });

  it("resolves every legacy sei_* type to its developer_insights_* canonical name", () => {
    for (const [oldName, canonical] of RENAMES) {
      expect(registry.getResource(oldName).resourceType).toBe(canonical);
      expect(registry.getResource(oldName)).toBe(registry.getResource(canonical));
    }
  });

  it("carries the sei search alias on every renamed resource", () => {
    for (const [, canonical] of RENAMES) {
      expect(registry.getResource(canonical).searchAliases).toContain("sei");
    }
  });

  it("enumerates only canonical names, never the sei aliases", () => {
    const types = registry.getAllResourceTypes();
    for (const [oldName, canonical] of RENAMES) {
      expect(types).toContain(canonical);
      expect(types).not.toContain(oldName);
    }
  });
});
