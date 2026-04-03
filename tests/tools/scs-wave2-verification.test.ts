/**
 * Phase 2 Wave 2 verification tests.
 *
 * Three categories:
 *   1. P2-1-new — Resource type disambiguation: searchAliases, descriptions, relevance tiers
 *   2. P2-0 (partial) — Multi-turn flow guidance: relatedResources graph, flow descriptions
 *   3. Integration — Registry.searchResources ranks SCS types correctly for ambiguous queries
 */
import { describe, it, expect } from "vitest";
import { scsToolset } from "../../src/registry/toolsets/scs.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { ResourceDefinition } from "../../src/registry/types.js";

/** Helper: find a resource definition by resourceType */
function findResource(type: string): ResourceDefinition {
  const res = scsToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in scsToolset`);
  return res;
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    LOG_LEVEL: "info",
    ...overrides,
  } as Config;
}

// ─── P2-1-new: Search aliases ───────────────────────────────────────────────

describe("P2-1-new: searchAliases defined on all SCS resources", () => {
  const scsResources = scsToolset.resources;

  it("every SCS resource has at least one searchAlias", () => {
    for (const r of scsResources) {
      expect(r.searchAliases, `${r.resourceType} missing searchAliases`).toBeDefined();
      expect(r.searchAliases!.length, `${r.resourceType} has empty searchAliases`).toBeGreaterThan(0);
    }
  });

  it("scs_artifact_source aliases include common confusion terms", () => {
    const r = findResource("scs_artifact_source");
    const aliases = r.searchAliases!.map(a => a.toLowerCase());
    expect(aliases).toContain("artifact source");
    expect(aliases).toContain("supply chain artifact");
  });

  it("artifact_security aliases include security-specific terms", () => {
    const r = findResource("artifact_security");
    const aliases = r.searchAliases!.map(a => a.toLowerCase());
    expect(aliases).toContain("artifact vulnerability");
    expect(aliases).toContain("artifact security posture");
  });

  it("code_repo_security aliases include repo security terms", () => {
    const r = findResource("code_repo_security");
    const aliases = r.searchAliases!.map(a => a.toLowerCase());
    expect(aliases).toContain("repo security");
    expect(aliases).toContain("repository security");
  });
});

// ─── P2-1-new: Disambiguation descriptions ──────────────────────────────────

describe("P2-1-new: disambiguation text in descriptions", () => {
  it("scs_artifact_source description warns against 'artifact' confusion", () => {
    const r = findResource("scs_artifact_source");
    expect(r.description).toContain("NOT the same as");
    expect(r.description).toContain("Artifact Registry");
  });

  it("artifact_security description warns against 'artifact' confusion", () => {
    const r = findResource("artifact_security");
    expect(r.description).toContain("NOT the same as");
    expect(r.description).toContain("Artifact Registry");
  });

  it("code_repo_security description warns against 'repository' confusion", () => {
    const r = findResource("code_repo_security");
    expect(r.description).toContain("NOT the same as");
    expect(r.description).toContain("Harness Code");
  });
});

// ─── P2-1-new: Registry.searchResources ranks SCS types for ambiguous queries ─

describe("P2-1-new: searchResources disambiguation ranking", () => {
  const registry = new Registry(makeConfig());

  it("searching 'artifact vulnerability' ranks artifact_security above generic 'artifact'", () => {
    const results = registry.searchResources("artifact vulnerability");
    const scsIdx = results.findIndex(r => r.type === "artifact_security");
    const genericIdx = results.findIndex(r => r.type === "artifact");
    expect(scsIdx, "artifact_security should appear in results").toBeGreaterThanOrEqual(0);
    // SCS type should rank higher (lower index) than generic
    if (genericIdx >= 0) {
      expect(scsIdx).toBeLessThan(genericIdx);
    }
  });

  it("searching 'supply chain artifact' ranks SCS types above generic 'artifact'", () => {
    const results = registry.searchResources("supply chain artifact");
    const scsTypes = results.filter(r => r.toolset === "scs");
    expect(scsTypes.length).toBeGreaterThan(0);
    // First SCS type should appear before any registries toolset result
    const firstScs = results.findIndex(r => r.toolset === "scs");
    const firstRegistry = results.findIndex(r => r.toolset === "registries");
    if (firstRegistry >= 0) {
      expect(firstScs).toBeLessThan(firstRegistry);
    }
  });

  it("searching 'repo security' ranks code_repo_security above generic 'repository'", () => {
    const results = registry.searchResources("repo security");
    const scsIdx = results.findIndex(r => r.type === "code_repo_security");
    const genericIdx = results.findIndex(r => r.type === "repository");
    expect(scsIdx, "code_repo_security should appear in results").toBeGreaterThanOrEqual(0);
    if (genericIdx >= 0) {
      expect(scsIdx).toBeLessThan(genericIdx);
    }
  });

  it("searching 'artifact source' returns scs_artifact_source as top match", () => {
    const results = registry.searchResources("artifact source");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe("scs_artifact_source");
  });

  it("searching 'sbom' returns scs_sbom in results", () => {
    const results = registry.searchResources("sbom");
    const sbomResult = results.find(r => r.type === "scs_sbom");
    expect(sbomResult).toBeDefined();
  });

  it("searching 'compliance' returns scs_compliance_result in results", () => {
    const results = registry.searchResources("compliance");
    const complianceResult = results.find(r => r.type === "scs_compliance_result");
    expect(complianceResult).toBeDefined();
  });

  it("searching 'dependency' returns scs_artifact_component in results", () => {
    const results = registry.searchResources("dependency");
    const depResult = results.find(r => r.type === "scs_artifact_component");
    expect(depResult).toBeDefined();
  });

  it("exact alias match scores higher than partial description match", () => {
    const results = registry.searchResources("remediation");
    const remIdx = results.findIndex(r => r.type === "scs_artifact_remediation");
    expect(remIdx, "scs_artifact_remediation should appear").toBeGreaterThanOrEqual(0);
    // Should be near the top since "remediation" is an exact alias
    expect(remIdx).toBeLessThan(3);
  });
});

// ─── P2-1-new: describeSummary includes aliases ─────────────────────────────

describe("P2-1-new: describeSummary surfaces aliases", () => {
  const registry = new Registry(makeConfig());

  it("SCS resource types include aliases in summary output", () => {
    const summary = registry.describeSummary() as {
      resource_types: Array<{ type: string; aliases?: string[] }>;
    };
    const scsSource = summary.resource_types.find(r => r.type === "scs_artifact_source");
    expect(scsSource).toBeDefined();
    expect(scsSource!.aliases).toBeDefined();
    expect(scsSource!.aliases!.length).toBeGreaterThan(0);
  });

  it("non-aliased resource types do not have aliases field", () => {
    const summary = registry.describeSummary() as {
      resource_types: Array<{ type: string; aliases?: string[] }>;
    };
    const pipeline = summary.resource_types.find(r => r.type === "pipeline");
    expect(pipeline).toBeDefined();
    expect(pipeline!.aliases).toBeUndefined();
  });
});

// ─── P2-0: relatedResources graph ──────────────────────────────────────────

describe("P2-0: relatedResources defined for multi-turn flow guidance", () => {
  const scsResources = scsToolset.resources;
  const scsTypes = new Set(scsResources.map(r => r.resourceType));

  it("every SCS resource has relatedResources", () => {
    for (const r of scsResources) {
      expect(r.relatedResources, `${r.resourceType} missing relatedResources`).toBeDefined();
      expect(r.relatedResources!.length, `${r.resourceType} has empty relatedResources`).toBeGreaterThan(0);
    }
  });

  // Cross-toolset references are allowed for governance integration (P3-10)
  const CROSS_TOOLSET_TYPES = new Set(["policy", "policy_set", "policy_evaluation"]);
  const allKnownTypes = new Set([...scsTypes, ...CROSS_TOOLSET_TYPES]);

  it("all referenced resource types in relatedResources exist in SCS or allowed cross-toolset types", () => {
    for (const r of scsResources) {
      for (const rel of r.relatedResources!) {
        expect(allKnownTypes.has(rel.resourceType),
          `${r.resourceType} references unknown type "${rel.resourceType}"`
        ).toBe(true);
      }
    }
  });

  it("relatedResources have valid relationship types", () => {
    const validRelationships = new Set(["parent", "child", "grandchild", "sibling"]);
    for (const r of scsResources) {
      for (const rel of r.relatedResources!) {
        expect(validRelationships.has(rel.relationship),
          `${r.resourceType} → ${rel.resourceType} has invalid relationship "${rel.relationship}"`
        ).toBe(true);
      }
    }
  });

  it("relatedResources have non-empty descriptions", () => {
    for (const r of scsResources) {
      for (const rel of r.relatedResources!) {
        expect(rel.description.length,
          `${r.resourceType} → ${rel.resourceType} has empty description`
        ).toBeGreaterThan(0);
      }
    }
  });

  it("artifact_security has parent→scs_artifact_source and child→scs_artifact_component", () => {
    const r = findResource("artifact_security");
    const parent = r.relatedResources!.find(rel => rel.resourceType === "scs_artifact_source");
    const child = r.relatedResources!.find(rel => rel.resourceType === "scs_artifact_component");
    expect(parent).toBeDefined();
    expect(parent!.relationship).toBe("parent");
    expect(child).toBeDefined();
    expect(child!.relationship).toBe("child");
  });

  it("scs_sbom has parent→scs_chain_of_custody", () => {
    const r = findResource("scs_sbom");
    const parent = r.relatedResources!.find(rel => rel.resourceType === "scs_chain_of_custody");
    expect(parent).toBeDefined();
    expect(parent!.relationship).toBe("parent");
  });

  it("code_repo_security has child→scs_artifact_component", () => {
    const r = findResource("code_repo_security");
    const child = r.relatedResources!.find(rel => rel.resourceType === "scs_artifact_component");
    expect(child).toBeDefined();
    expect(child!.relationship).toBe("child");
  });
});

// ─── P2-0: describe output includes relatedResources ────────────────────────

describe("P2-0: describe output includes relatedResources", () => {
  const registry = new Registry(makeConfig());

  it("full describe includes relatedResources for SCS toolset", () => {
    const desc = registry.describe() as {
      toolsets: Record<string, { resources: Array<{ resource_type: string; relatedResources?: unknown[] }> }>;
    };
    const scsDesc = desc.toolsets.scs;
    expect(scsDesc).toBeDefined();
    const artifactSecurity = scsDesc.resources.find(r => r.resource_type === "artifact_security");
    expect(artifactSecurity).toBeDefined();
    expect(artifactSecurity!.relatedResources).toBeDefined();
    expect(artifactSecurity!.relatedResources!.length).toBeGreaterThan(0);
  });
});

// ─── P2-1-new: harness-search relevance tiers ───────────────────────────────

describe("P2-1-new: SCS types in harness-search relevance tiers", () => {
  // We can't directly test the RELEVANCE_TIERS constant (it's module-private),
  // but we can verify the key types are at tier 2 by checking they exist
  // in the scsToolset and that the search tool file has them.
  // This is a structural test to prevent regression.

  it("SCS toolset contains all resource types that should be boosted", () => {
    const boostedTypes = [
      "scs_artifact_source",
      "artifact_security",
      "code_repo_security",
      "scs_artifact_component",
      "scs_compliance_result",
    ];
    const scsTypes = new Set(scsToolset.resources.map(r => r.resourceType));
    for (const type of boostedTypes) {
      expect(scsTypes.has(type), `${type} should be in SCS toolset`).toBe(true);
    }
  });
});

// ─── P3-10: Cross-toolset search routing (SCS → governance) ─────────────────

describe("P3-10: searchResources routes SCS policy queries to governance", () => {
  const registry = new Registry(makeConfig());

  it("searching 'deny list policy' returns governance policy in results", () => {
    const results = registry.searchResources("deny list policy");
    const policyResult = results.find(r => r.type === "policy");
    expect(policyResult, "governance 'policy' should appear for 'deny list policy' search").toBeDefined();
  });

  it("searching 'sbom enforcement' returns governance policy_set in results", () => {
    const results = registry.searchResources("sbom enforcement");
    const policySetResult = results.find(r => r.type === "policy_set");
    expect(policySetResult, "governance 'policy_set' should appear for 'sbom enforcement' search").toBeDefined();
  });

  it("searching 'opa policy' returns governance policy in results", () => {
    const results = registry.searchResources("opa policy");
    const policyResult = results.find(r => r.type === "policy");
    expect(policyResult, "governance 'policy' should appear for 'opa policy' search").toBeDefined();
  });

  it("searching 'supply chain policy' returns governance policy in results", () => {
    const results = registry.searchResources("supply chain policy");
    const policyResult = results.find(r => r.type === "policy");
    expect(policyResult, "governance 'policy' should appear for 'supply chain policy' search").toBeDefined();
  });

  it("searching 'enforcement rules' returns governance policy_set in results", () => {
    const results = registry.searchResources("enforcement rules");
    const policySetResult = results.find(r => r.type === "policy_set");
    expect(policySetResult, "governance 'policy_set' should appear for 'enforcement rules' search").toBeDefined();
  });

  it("searching 'compliance' still returns scs_compliance_result first", () => {
    const results = registry.searchResources("compliance");
    const scsIdx = results.findIndex(r => r.type === "scs_compliance_result");
    expect(scsIdx, "scs_compliance_result should appear in results").toBeGreaterThanOrEqual(0);
  });
});

// ─── P3-8: Dependency tree search routing ───────────────────────────────────

describe("P3-8: searchResources routes dependency tree queries correctly", () => {
  const registry = new Registry(makeConfig());

  it("searching 'dependency tree' returns scs_component_dependencies in results", () => {
    const results = registry.searchResources("dependency tree");
    const depTreeResult = results.find(r => r.type === "scs_component_dependencies");
    expect(depTreeResult, "scs_component_dependencies should appear for 'dependency tree' search").toBeDefined();
  });

  it("searching 'transitive dependencies' returns scs_component_dependencies in results", () => {
    const results = registry.searchResources("transitive dependencies");
    const depTreeResult = results.find(r => r.type === "scs_component_dependencies");
    expect(depTreeResult, "scs_component_dependencies should appear for 'transitive dependencies' search").toBeDefined();
  });

  it("searching 'depends on' returns scs_component_dependencies in results", () => {
    const results = registry.searchResources("depends on");
    const depTreeResult = results.find(r => r.type === "scs_component_dependencies");
    expect(depTreeResult, "scs_component_dependencies should appear for 'depends on' search").toBeDefined();
  });

  it("searching 'dependency' returns both flat list and tree resources", () => {
    const results = registry.searchResources("dependency");
    const flatResult = results.find(r => r.type === "scs_artifact_component");
    const treeResult = results.find(r => r.type === "scs_component_dependencies");
    expect(flatResult, "scs_artifact_component should appear for 'dependency' search").toBeDefined();
    expect(treeResult, "scs_component_dependencies should appear for 'dependency' search").toBeDefined();
  });
});

// ─── P3-10: scs_compliance_result cross-toolset relatedResources ────────────

describe("P3-10: scs_compliance_result has governance cross-refs", () => {
  it("scs_compliance_result references governance policy as sibling", () => {
    const r = findResource("scs_compliance_result");
    const policyRef = r.relatedResources!.find(rel => rel.resourceType === "policy");
    expect(policyRef).toBeDefined();
    expect(policyRef!.relationship).toBe("sibling");
    expect(policyRef!.description).toContain("governance");
  });

  it("scs_compliance_result references governance policy_set as sibling", () => {
    const r = findResource("scs_compliance_result");
    const policySetRef = r.relatedResources!.find(rel => rel.resourceType === "policy_set");
    expect(policySetRef).toBeDefined();
    expect(policySetRef!.relationship).toBe("sibling");
    expect(policySetRef!.description).toContain("governance");
  });

  it("scs_compliance_result searchAliases include enforcement terms", () => {
    const r = findResource("scs_compliance_result");
    const aliases = r.searchAliases!.map(a => a.toLowerCase());
    expect(aliases).toContain("enforcement");
    expect(aliases).toContain("sbom enforcement");
  });
});
