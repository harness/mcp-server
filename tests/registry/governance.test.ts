/**
 * Unit tests for governance toolset — P3-10 SCS/SBOM enforcement enhancements.
 *
 * Verifies:
 *   - policy + policy_set have SCS-specific searchAliases
 *   - policy + policy_set descriptions mention SCS/SBOM enforcement
 *   - policy + policy_set have relatedResources cross-referencing SCS compliance
 *   - Structural integrity of governance CRUD operations
 */
import { describe, it, expect } from "vitest";
import { governanceToolset } from "../../src/registry/toolsets/governance.js";
import type { ResourceDefinition, EndpointSpec } from "../../src/registry/types.js";

/** Helper: find a resource definition by resourceType */
function findResource(type: string): ResourceDefinition {
  const res = governanceToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in governanceToolset`);
  return res;
}

/** Helper: get an operation's EndpointSpec */
function getOp(type: string, op: string): EndpointSpec {
  const res = findResource(type);
  const spec = (res.operations as Record<string, EndpointSpec>)[op];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

// ─── P3-10: policy resource — SCS/SBOM enforcement enhancements ─────────────

describe("P3-10: policy resource SCS enhancements", () => {
  it("exists in governanceToolset", () => {
    expect(() => findResource("policy")).not.toThrow();
  });

  it("description mentions SCS/SBOM enforcement", () => {
    const res = findResource("policy");
    expect(res.description).toContain("SCS");
    expect(res.description).toContain("SBOM");
    expect(res.description).toContain("deny-list");
    expect(res.description).toContain("allow-list");
  });

  it("description mentions Rego and enforcement evaluation", () => {
    const res = findResource("policy");
    expect(res.description).toContain("Rego");
    expect(res.description).toContain("enforcement");
  });

  // SSCA-6347 — policies use type='sbom_enforcement' (asymmetric with policy_set's 'sbom').
  it("description documents the sbom_enforcement type filter for SBOM/SSCA policies", () => {
    const res = findResource("policy");
    expect(res.description).toContain("type='sbom_enforcement'");
  });

  it("list operation exposes the 'type' query param (required for SBOM-enforcement filtering)", () => {
    const spec = getOp("policy", "list");
    // Without this param wired, the agent cannot round-trip type='sbom_enforcement' to /pm/api/v1/policies.
    expect(spec.queryParams).toBeDefined();
    expect(spec.queryParams!.type).toBe("type");
  });

  it("list filter includes 'type' with sbom_enforcement guidance", () => {
    const res = findResource("policy");
    const typeFilter = res.listFilterFields!.find((f) => f.name === "type");
    expect(typeFilter).toBeDefined();
    expect(typeFilter!.description).toContain("sbom_enforcement");
  });

  it("has searchAliases including SCS-specific terms", () => {
    const res = findResource("policy");
    expect(res.searchAliases).toBeDefined();
    const aliases = res.searchAliases!.map((a) => a.toLowerCase());
    expect(aliases).toContain("opa policy");
    expect(aliases).toContain("deny list");
    expect(aliases).toContain("allow list");
    expect(aliases).toContain("sbom policy");
    expect(aliases).toContain("supply chain policy");
  });

  it("has relatedResources cross-referencing SCS compliance", () => {
    const res = findResource("policy");
    expect(res.relatedResources).toBeDefined();
    const scsComplianceRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "scs_compliance_result",
    );
    expect(scsComplianceRef).toBeDefined();
    expect(scsComplianceRef!.relationship).toBe("sibling");
    expect(scsComplianceRef!.description.length).toBeGreaterThan(0);
  });

  it("has relatedResources referencing policy_set as parent", () => {
    const res = findResource("policy");
    const policySetRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "policy_set",
    );
    expect(policySetRef).toBeDefined();
    expect(policySetRef!.relationship).toBe("parent");
  });

  it("has relatedResources referencing policy_evaluation as child", () => {
    const res = findResource("policy");
    const evalRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "policy_evaluation",
    );
    expect(evalRef).toBeDefined();
    expect(evalRef!.relationship).toBe("child");
  });

  it("has full CRUD operations", () => {
    expect(() => getOp("policy", "list")).not.toThrow();
    expect(() => getOp("policy", "get")).not.toThrow();
    expect(() => getOp("policy", "create")).not.toThrow();
    expect(() => getOp("policy", "update")).not.toThrow();
    expect(() => getOp("policy", "delete")).not.toThrow();
  });

  it("list operation uses correct OPA service path", () => {
    const spec = getOp("policy", "list");
    expect(spec.method).toBe("GET");
    expect(spec.path).toBe("/pm/api/v1/policies");
  });

  it("create operation uses POST", () => {
    const spec = getOp("policy", "create");
    expect(spec.method).toBe("POST");
    expect(spec.path).toBe("/pm/api/v1/policies");
  });

  it("update operation uses PATCH", () => {
    const spec = getOp("policy", "update");
    expect(spec.method).toBe("PATCH");
    expect(spec.path).toContain("/policies/");
  });

  it("delete operation uses DELETE", () => {
    const spec = getOp("policy", "delete");
    expect(spec.method).toBe("DELETE");
    expect(spec.path).toContain("/policies/");
  });
});

// ─── P3-10: policy_set resource — SCS/SBOM enforcement enhancements ─────────

describe("P3-10: policy_set resource SCS enhancements", () => {
  it("exists in governanceToolset", () => {
    expect(() => findResource("policy_set")).not.toThrow();
  });

  // SSCA-6347 regression — this test previously asserted the buggy value 'ssca_enforcement'
  // which baked the routing bug into the contract. Now we assert the corrected guidance:
  // policy sets for SBOM enforcement are filterable by type='sbom', and the description must
  // actively warn against the wrong values the agent used to pass.
  it("description mentions SCS/SBOM enforcement with the correct type='sbom' and warns against 'ssca_enforcement'/'sbom_enforcement'", () => {
    const res = findResource("policy_set");
    expect(res.description).toContain("SCS");
    expect(res.description).toContain("SBOM");
    expect(res.description).toContain("type='sbom'");
    // Explicit warning against the two wrong values AIDA kept using.
    expect(res.description).toContain("ssca_enforcement");
    expect(res.description).toContain("sbom_enforcement");
    expect(res.description).toMatch(/Do NOT pass type='sbom_enforcement' or type='ssca_enforcement'/);
  });

  it("description documents the policy-vs-policy_set type asymmetry", () => {
    const res = findResource("policy_set");
    // The asymmetry is the thing that bit us: sets use 'sbom', policies use 'sbom_enforcement'.
    // If someone flattens these back to a single value, the SSCA-6347 bug returns.
    expect(res.description).toMatch(/IMPORTANT TYPE ASYMMETRY/i);
  });

  it("description explains policy set enforcement purpose", () => {
    const res = findResource("policy_set");
    expect(res.description).toContain("enforcement action");
    expect(res.description).toContain("deny-list");
    expect(res.description).toContain("allow-list");
  });

  it("has searchAliases including SCS enforcement terms", () => {
    const res = findResource("policy_set");
    expect(res.searchAliases).toBeDefined();
    const aliases = res.searchAliases!.map((a) => a.toLowerCase());
    expect(aliases).toContain("policy set");
    expect(aliases).toContain("sbom enforcement");
    expect(aliases).toContain("supply chain enforcement");
    expect(aliases).toContain("enforcement rules");
  });

  it("has relatedResources cross-referencing SCS compliance", () => {
    const res = findResource("policy_set");
    expect(res.relatedResources).toBeDefined();
    const scsComplianceRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "scs_compliance_result",
    );
    expect(scsComplianceRef).toBeDefined();
    expect(scsComplianceRef!.relationship).toBe("sibling");
  });

  it("has relatedResources referencing policy as child", () => {
    const res = findResource("policy_set");
    const policyRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "policy",
    );
    expect(policyRef).toBeDefined();
    expect(policyRef!.relationship).toBe("child");
  });

  it("has relatedResources referencing policy_evaluation as child", () => {
    const res = findResource("policy_set");
    const evalRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "policy_evaluation",
    );
    expect(evalRef).toBeDefined();
    expect(evalRef!.relationship).toBe("child");
  });

  it("has full CRUD operations", () => {
    expect(() => getOp("policy_set", "list")).not.toThrow();
    expect(() => getOp("policy_set", "get")).not.toThrow();
    expect(() => getOp("policy_set", "create")).not.toThrow();
    expect(() => getOp("policy_set", "update")).not.toThrow();
    expect(() => getOp("policy_set", "delete")).not.toThrow();
  });

  it("list operation supports type and action filters", () => {
    const res = findResource("policy_set");
    const filterNames = res.listFilterFields!.map((f) => f.name);
    expect(filterNames).toContain("type");
    expect(filterNames).toContain("action");
  });

  it("list filter 'type' documents the correct SBOM value and the two wrong ones", () => {
    const res = findResource("policy_set");
    const typeFilter = res.listFilterFields!.find((f) => f.name === "type");
    expect(typeFilter).toBeDefined();
    // Filter description must surface the correct value so LLM auto-completion points it at 'sbom'.
    expect(typeFilter!.description).toContain("'sbom'");
    expect(typeFilter!.description).toContain("NOT 'sbom_enforcement' or 'ssca_enforcement'");
  });

  it("list filter 'action' names the SBOM enforcement action", () => {
    const res = findResource("policy_set");
    const actionFilter = res.listFilterFields!.find((f) => f.name === "action");
    expect(actionFilter).toBeDefined();
    // The SBOM enforcement step binds with action='onstep' — same value demo-plan.md uses.
    expect(actionFilter!.description).toContain("onstep");
  });

  it("relatedResources includes scs_bom_violation sibling so the violation → policy_set → policy chain is discoverable", () => {
    const res = findResource("policy_set");
    const bomRef = res.relatedResources!.find((rel) => rel.resourceType === "scs_bom_violation");
    expect(bomRef).toBeDefined();
    expect(bomRef!.relationship).toBe("sibling");
    expect(bomRef!.description.length).toBeGreaterThan(0);
  });

  it("list operation uses correct OPA service path", () => {
    const spec = getOp("policy_set", "list");
    expect(spec.method).toBe("GET");
    expect(spec.path).toBe("/pm/api/v1/policysets");
  });
});

// ─── P3-10: policy_evaluation resource — structural integrity ───────────────

describe("P3-10: policy_evaluation resource structural integrity", () => {
  it("exists in governanceToolset", () => {
    expect(() => findResource("policy_evaluation")).not.toThrow();
  });

  it("has list and get operations (read-only)", () => {
    expect(() => getOp("policy_evaluation", "list")).not.toThrow();
    expect(() => getOp("policy_evaluation", "get")).not.toThrow();
  });

  it("list operation uses correct evaluations path", () => {
    const spec = getOp("policy_evaluation", "list");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/evaluations");
  });
});
