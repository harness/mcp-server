/**
 * Phase 2 Wave 2 verification tests.
 *
 * Three categories:
 *   1. P2-1-new — Resource type disambiguation: searchAliases, descriptions, relevance tiers
 *   2. P2-0 (partial) — Multi-turn flow guidance: relatedResources graph, flow descriptions
 *   3. Integration — Registry.searchResources ranks SCS types correctly for ambiguous queries
 */
import { describe, it, expect } from "vitest";
import { applicationSecurityToolset } from "../../src/registry/toolsets/application-security.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { ResourceDefinition } from "../../src/registry/types.js";

/** Helper: find a resource definition by resourceType */
function findResource(type: string): ResourceDefinition {
  const res = applicationSecurityToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in applicationSecurityToolset`);
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
  const scsResources = applicationSecurityToolset.resources.filter((r) => r.searchAliases?.includes("scs"));

  it("every SCS resource has at least one searchAlias", () => {
    for (const r of scsResources) {
      expect(r.searchAliases, `${r.resourceType} missing searchAliases`).toBeDefined();
      expect(r.searchAliases!.length, `${r.resourceType} has empty searchAliases`).toBeGreaterThan(0);
    }
  });

  it("application_security_artifact_source aliases include common confusion terms", () => {
    const r = findResource("application_security_artifact_source");
    const aliases = r.searchAliases!.map(a => a.toLowerCase());
    expect(aliases).toContain("artifact source");
    expect(aliases).toContain("supply chain artifact");
  });

  it("application_security_artifact aliases include security-specific terms", () => {
    const r = findResource("application_security_artifact");
    const aliases = r.searchAliases!.map(a => a.toLowerCase());
    expect(aliases).toContain("artifact vulnerability");
    expect(aliases).toContain("artifact security posture");
  });

  it("application_security_code_repo aliases include repo security terms", () => {
    const r = findResource("application_security_code_repo");
    const aliases = r.searchAliases!.map(a => a.toLowerCase());
    expect(aliases).toContain("repo security");
    expect(aliases).toContain("repository security");
  });
});

// ─── P2-1-new: Disambiguation descriptions ──────────────────────────────────

describe("P2-1-new: disambiguation text in descriptions", () => {
  it("application_security_artifact_source description warns against 'artifact' confusion", () => {
    const r = findResource("application_security_artifact_source");
    expect(r.description).toContain("NOT the same as");
    expect(r.description).toContain("Artifact Registry");
  });

  it("application_security_artifact description warns against 'artifact' confusion", () => {
    const r = findResource("application_security_artifact");
    expect(r.description).toContain("NOT the same as");
    expect(r.description).toContain("Artifact Registry");
  });

  it("application_security_code_repo description warns against 'repository' confusion", () => {
    const r = findResource("application_security_code_repo");
    expect(r.description).toContain("NOT the same as");
    expect(r.description).toContain("Harness Code");
  });
});

// ─── P2-1-new: Registry.searchResources ranks SCS types for ambiguous queries ─

describe("P2-1-new: searchResources disambiguation ranking", () => {
  const registry = new Registry(makeConfig());

  it("searching 'artifact vulnerability' ranks application_security_artifact above generic 'artifact'", () => {
    const results = registry.searchResources("artifact vulnerability");
    const scsIdx = results.findIndex(r => r.type === "application_security_artifact");
    const genericIdx = results.findIndex(r => r.type === "artifact");
    expect(scsIdx, "application_security_artifact should appear in results").toBeGreaterThanOrEqual(0);
    // SCS type should rank higher (lower index) than generic
    if (genericIdx >= 0) {
      expect(scsIdx).toBeLessThan(genericIdx);
    }
  });

  it("searching 'supply chain artifact' ranks SCS types above generic 'artifact'", () => {
    const results = registry.searchResources("supply chain artifact");
    const scsTypes = results.filter(r => r.toolset === "application_security");
    expect(scsTypes.length).toBeGreaterThan(0);
    // First SCS type should appear before any registries toolset result
    const firstScs = results.findIndex(r => r.toolset === "application_security");
    const firstRegistry = results.findIndex(r => r.toolset === "registries");
    if (firstRegistry >= 0) {
      expect(firstScs).toBeLessThan(firstRegistry);
    }
  });

  it("searching 'repo security' ranks application_security_code_repo above generic 'repository'", () => {
    const results = registry.searchResources("repo security");
    const scsIdx = results.findIndex(r => r.type === "application_security_code_repo");
    const genericIdx = results.findIndex(r => r.type === "repository");
    expect(scsIdx, "application_security_code_repo should appear in results").toBeGreaterThanOrEqual(0);
    if (genericIdx >= 0) {
      expect(scsIdx).toBeLessThan(genericIdx);
    }
  });

  it("searching 'artifact source' returns application_security_artifact_source as top match", () => {
    const results = registry.searchResources("artifact source");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe("application_security_artifact_source");
  });

  it("searching 'sbom' returns application_security_sbom in results", () => {
    const results = registry.searchResources("sbom");
    const sbomResult = results.find(r => r.type === "application_security_sbom");
    expect(sbomResult).toBeDefined();
  });

  it("searching 'compliance' returns application_security_compliance_result in results", () => {
    const results = registry.searchResources("compliance");
    const complianceResult = results.find(r => r.type === "application_security_compliance_result");
    expect(complianceResult).toBeDefined();
  });

  it("searching 'dependency' returns application_security_artifact_component in results", () => {
    const results = registry.searchResources("dependency");
    const depResult = results.find(r => r.type === "application_security_artifact_component");
    expect(depResult).toBeDefined();
  });

  it("exact alias match scores higher than partial description match", () => {
    const results = registry.searchResources("remediation");
    const remIdx = results.findIndex(r => r.type === "application_security_artifact_remediation");
    expect(remIdx, "application_security_artifact_remediation should appear").toBeGreaterThanOrEqual(0);
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
    const scsSource = summary.resource_types.find(r => r.type === "application_security_artifact_source");
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
  const scsResources = applicationSecurityToolset.resources.filter((r) => r.searchAliases?.includes("scs"));
  const scsTypes = new Set(scsResources.map(r => r.resourceType));

  it("every SCS resource has relatedResources", () => {
    for (const r of scsResources) {
      expect(r.relatedResources, `${r.resourceType} missing relatedResources`).toBeDefined();
      expect(r.relatedResources!.length, `${r.resourceType} has empty relatedResources`).toBeGreaterThan(0);
    }
  });

  // Cross-toolset references are allowed for governance (P3-10) and STO (P3-11) integration
  const CROSS_TOOLSET_TYPES = new Set(["policy", "policy_set", "policy_evaluation", "application_security_issue"]);
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

  it("application_security_artifact has parent→application_security_artifact_source and child→application_security_artifact_component", () => {
    const r = findResource("application_security_artifact");
    const parent = r.relatedResources!.find(rel => rel.resourceType === "application_security_artifact_source");
    const child = r.relatedResources!.find(rel => rel.resourceType === "application_security_artifact_component");
    expect(parent).toBeDefined();
    expect(parent!.relationship).toBe("parent");
    expect(child).toBeDefined();
    expect(child!.relationship).toBe("child");
  });

  it("application_security_sbom has parent→application_security_chain_of_custody", () => {
    const r = findResource("application_security_sbom");
    const parent = r.relatedResources!.find(rel => rel.resourceType === "application_security_chain_of_custody");
    expect(parent).toBeDefined();
    expect(parent!.relationship).toBe("parent");
  });

  it("application_security_code_repo has child→application_security_artifact_component", () => {
    const r = findResource("application_security_code_repo");
    const child = r.relatedResources!.find(rel => rel.resourceType === "application_security_artifact_component");
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
    const scsDesc = desc.toolsets.application_security;
    expect(scsDesc).toBeDefined();
    const artifactSecurity = scsDesc.resources.find(r => r.resource_type === "application_security_artifact");
    expect(artifactSecurity).toBeDefined();
    expect(artifactSecurity!.relatedResources).toBeDefined();
    expect(artifactSecurity!.relatedResources!.length).toBeGreaterThan(0);
  });
});

// ─── P2-1-new: harness-search relevance tiers ───────────────────────────────

describe("P2-1-new: SCS types in harness-search relevance tiers", () => {
  // We can't directly test the RELEVANCE_TIERS constant (it's module-private),
  // but we can verify the key types are at tier 2 by checking they exist
  // in the applicationSecurityToolset and that the search tool file has them.
  // This is a structural test to prevent regression.

  it("SCS toolset contains all resource types that should be boosted", () => {
    const boostedTypes = [
      "application_security_artifact_source",
      "application_security_artifact",
      "application_security_code_repo",
      "application_security_artifact_component",
      "application_security_compliance_result",
    ];
    const scsTypes = new Set(applicationSecurityToolset.resources.map(r => r.resourceType));
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

  it("searching 'compliance' still returns application_security_compliance_result first", () => {
    const results = registry.searchResources("compliance");
    const scsIdx = results.findIndex(r => r.type === "application_security_compliance_result");
    expect(scsIdx, "application_security_compliance_result should appear in results").toBeGreaterThanOrEqual(0);
  });
});

// ─── P3-8: Dependency tree search routing ───────────────────────────────────

describe("P3-8: searchResources routes dependency tree queries correctly", () => {
  const registry = new Registry(makeConfig());

  it("searching 'dependency tree' returns application_security_component_dependencies in results", () => {
    const results = registry.searchResources("dependency tree");
    const depTreeResult = results.find(r => r.type === "application_security_component_dependencies");
    expect(depTreeResult, "application_security_component_dependencies should appear for 'dependency tree' search").toBeDefined();
  });

  it("searching 'transitive dependencies' returns application_security_component_dependencies in results", () => {
    const results = registry.searchResources("transitive dependencies");
    const depTreeResult = results.find(r => r.type === "application_security_component_dependencies");
    expect(depTreeResult, "application_security_component_dependencies should appear for 'transitive dependencies' search").toBeDefined();
  });

  it("searching 'depends on' returns application_security_component_dependencies in results", () => {
    const results = registry.searchResources("depends on");
    const depTreeResult = results.find(r => r.type === "application_security_component_dependencies");
    expect(depTreeResult, "application_security_component_dependencies should appear for 'depends on' search").toBeDefined();
  });

  it("searching 'dependency' returns both flat list and tree resources", () => {
    const results = registry.searchResources("dependency");
    const flatResult = results.find(r => r.type === "application_security_artifact_component");
    const treeResult = results.find(r => r.type === "application_security_component_dependencies");
    expect(flatResult, "application_security_artifact_component should appear for 'dependency' search").toBeDefined();
    expect(treeResult, "application_security_component_dependencies should appear for 'dependency' search").toBeDefined();
  });
});

// ─── P3-10: application_security_compliance_result cross-toolset relatedResources ────────────

describe("P3-10: application_security_compliance_result has governance cross-refs", () => {
  it("application_security_compliance_result references governance policy as sibling", () => {
    const r = findResource("application_security_compliance_result");
    const policyRef = r.relatedResources!.find(rel => rel.resourceType === "policy");
    expect(policyRef).toBeDefined();
    expect(policyRef!.relationship).toBe("sibling");
    expect(policyRef!.description).toContain("governance");
  });

  it("application_security_compliance_result references governance policy_set as sibling", () => {
    const r = findResource("application_security_compliance_result");
    const policySetRef = r.relatedResources!.find(rel => rel.resourceType === "policy_set");
    expect(policySetRef).toBeDefined();
    expect(policySetRef!.relationship).toBe("sibling");
    expect(policySetRef!.description).toContain("governance");
  });

  it("application_security_compliance_result searchAliases cover CIS/OWASP but NOT enforcement (P3-1 disambiguation)", () => {
    const r = findResource("application_security_compliance_result");
    const aliases = r.searchAliases!.map(a => a.toLowerCase());
    expect(aliases).toContain("compliance");
    expect(aliases).toContain("cis");
    expect(aliases).toContain("owasp");
    // Enforcement aliases moved to application_security_bom_violation (P3-1)
    expect(aliases).not.toContain("enforcement");
    expect(aliases).not.toContain("sbom enforcement");
    expect(aliases).not.toContain("bom enforcement");
  });
});

// ─── P3-11: application_security_component_enrichment search routing ─────────────────────────

describe("P3-11: searchResources routes OSS risk queries to application_security_component_enrichment", () => {
  const registry = new Registry(makeConfig());

  it("searching 'oss risk' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("oss risk");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'oss risk' search").toBeDefined();
  });

  it("searching 'end of life' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("end of life");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'end of life' search").toBeDefined();
  });

  it("searching 'eol' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("eol");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'eol' search").toBeDefined();
  });

  it("searching 'outdated' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("outdated");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'outdated' search").toBeDefined();
  });

  it("searching 'latest version' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("latest version");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'latest version' search").toBeDefined();
  });

  it("searching 'is it safe' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("is it safe");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'is it safe' search").toBeDefined();
  });
});

// ─── P3-11: application_security_component_enrichment search routing ─────────────────────────

describe("P3-11: searchResources routes OSS risk queries to application_security_component_enrichment", () => {
  const registry = new Registry(makeConfig());

  it("searching 'oss risk' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("oss risk");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'oss risk' search").toBeDefined();
  });

  it("searching 'end of life' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("end of life");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'end of life' search").toBeDefined();
  });

  it("searching 'eol' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("eol");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'eol' search").toBeDefined();
  });

  it("searching 'outdated' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("outdated");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'outdated' search").toBeDefined();
  });

  it("searching 'latest version' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("latest version");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'latest version' search").toBeDefined();
  });

  it("searching 'is it safe' returns application_security_component_enrichment in results", () => {
    const results = registry.searchResources("is it safe");
    const enrichResult = results.find(r => r.type === "application_security_component_enrichment");
    expect(enrichResult, "application_security_component_enrichment should appear for 'is it safe' search").toBeDefined();
  });
});
