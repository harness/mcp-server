/**
 * Unit tests for SCS toolset Phase 1-v2 changes:
 * - T2-v2: ensureArray normalization in bodyBuilders
 * - T4-v2: Remediation limitation note in description
 * - T11-v2: ID retention hints in resource descriptions
 * - T12-v2: dependency_type filter on scs_artifact_component
 * - T13-v2: scsCleanExtract strips null/empty fields
 * - T14-v2: artifact_type, status, standards filter enrichment
 */
import { describe, it, expect } from "vitest";
import { scsCleanExtract } from "../../src/registry/extractors.js";
import { scsToolset } from "../../src/registry/toolsets/scs.js";
import type { ResourceDefinition, EndpointSpec } from "../../src/registry/types.js";

/** Helper: find a resource definition by resourceType */
function findResource(type: string): ResourceDefinition {
  const res = scsToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in scsToolset`);
  return res;
}

/** Helper: get an operation's EndpointSpec */
function getOp(type: string, op: "list" | "get"): EndpointSpec {
  const res = findResource(type);
  const spec = res.operations[op];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

// ─── T13-v2: scsCleanExtract ──────────────────────────────────────────────

describe("scsCleanExtract", () => {
  it("strips null fields", () => {
    const result = scsCleanExtract({ id: "abc", name: null, tag: "v1" });
    expect(result).toEqual({ id: "abc", tag: "v1" });
  });

  it("strips undefined fields", () => {
    const result = scsCleanExtract({ id: "abc", name: undefined });
    expect(result).toEqual({ id: "abc" });
  });

  it("strips empty string fields", () => {
    const result = scsCleanExtract({ id: "abc", signing_status: "", tag: "latest" });
    expect(result).toEqual({ id: "abc", tag: "latest" });
  });

  it("strips empty array fields", () => {
    const result = scsCleanExtract({ id: "abc", attestation_sources: [], tags: ["prod"] });
    expect(result).toEqual({ id: "abc", tags: ["prod"] });
  });

  it("recursively strips nested objects", () => {
    const input = {
      id: "abc",
      metadata: {
        created: "2026-01-01",
        deleted: null,
        extra: "",
        nested: { a: 1, b: null },
      },
    };
    expect(scsCleanExtract(input)).toEqual({
      id: "abc",
      metadata: {
        created: "2026-01-01",
        nested: { a: 1 },
      },
    });
  });

  it("recursively strips inside arrays", () => {
    const input = [
      { id: "1", name: null, status: "active" },
      { id: "2", name: "", status: null },
    ];
    expect(scsCleanExtract(input)).toEqual([
      { id: "1", status: "active" },
      { id: "2" },
    ]);
  });

  it("preserves falsy but meaningful values (0, false)", () => {
    const result = scsCleanExtract({ count: 0, enabled: false, name: "test" });
    expect(result).toEqual({ count: 0, enabled: false, name: "test" });
  });

  it("passes through primitives unchanged", () => {
    expect(scsCleanExtract(42)).toBe(42);
    expect(scsCleanExtract("hello")).toBe("hello");
    expect(scsCleanExtract(true)).toBe(true);
  });

  it("handles null input", () => {
    expect(scsCleanExtract(null)).toBeNull();
  });
});

// ─── T2-v2: ensureArray via bodyBuilder ───────────────────────────────────

describe("T2-v2: array parameter normalization", () => {
  it("scs_compliance_result bodyBuilder wraps scalar standards to array", () => {
    const spec = getOp("scs_compliance_result", "list");
    const body = spec.bodyBuilder!({ standards: "CIS" });
    expect(body).toEqual({ standards: ["CIS"] });
  });

  it("scs_compliance_result bodyBuilder passes array standards through", () => {
    const spec = getOp("scs_compliance_result", "list");
    const body = spec.bodyBuilder!({ standards: ["CIS", "OWASP"] });
    expect(body).toEqual({ standards: ["CIS", "OWASP"] });
  });

  it("scs_compliance_result bodyBuilder wraps scalar status to array", () => {
    const spec = getOp("scs_compliance_result", "list");
    const body = spec.bodyBuilder!({ status: "FAILED" });
    expect(body).toEqual({ status: ["FAILED"] });
  });

  it("scs_compliance_result bodyBuilder handles both standards and status", () => {
    const spec = getOp("scs_compliance_result", "list");
    const body = spec.bodyBuilder!({ standards: "CIS", status: ["PASSED", "FAILED"] });
    expect(body).toEqual({ standards: ["CIS"], status: ["PASSED", "FAILED"] });
  });

  it("scs_compliance_result bodyBuilder omits absent filters", () => {
    const spec = getOp("scs_compliance_result", "list");
    const body = spec.bodyBuilder!({});
    expect(body).toEqual({});
  });

  it("scs_artifact_source bodyBuilder wraps scalar artifact_type to array", () => {
    const spec = getOp("scs_artifact_source", "list");
    const body = spec.bodyBuilder!({ artifact_type: "CONTAINER" });
    expect(body).toEqual({ artifact_type: ["CONTAINER"] });
  });

  it("scs_artifact_source bodyBuilder passes array artifact_type through", () => {
    const spec = getOp("scs_artifact_source", "list");
    const body = spec.bodyBuilder!({ artifact_type: ["CONTAINER", "FILE"] });
    expect(body).toEqual({ artifact_type: ["CONTAINER", "FILE"] });
  });

  it("scs_artifact_source bodyBuilder handles search_term + artifact_type together", () => {
    const spec = getOp("scs_artifact_source", "list");
    const body = spec.bodyBuilder!({ search_term: "nginx", artifact_type: "CONTAINER" });
    expect(body).toEqual({ search_term: "nginx", artifact_type: ["CONTAINER"] });
  });
});

// ─── T12-v2: dependency_type filter ───────────────────────────────────────

describe("T12-v2: dependency type filter", () => {
  it("scs_artifact_component bodyBuilder passes dependency_type", () => {
    const spec = getOp("scs_artifact_component", "list");
    const body = spec.bodyBuilder!({ dependency_type: "DIRECT" });
    expect(body).toEqual({ dependency_type: "DIRECT" });
  });

  it("scs_artifact_component bodyBuilder passes search_term + dependency_type", () => {
    const spec = getOp("scs_artifact_component", "list");
    const body = spec.bodyBuilder!({ search_term: "lodash", dependency_type: "TRANSITIVE" });
    expect(body).toEqual({ search_term: "lodash", dependency_type: "TRANSITIVE" });
  });

  it("scs_artifact_component bodyBuilder omits absent filters", () => {
    const spec = getOp("scs_artifact_component", "list");
    const body = spec.bodyBuilder!({});
    expect(body).toEqual({});
  });

  it("scs_artifact_component has dependency_type in listFilterFields", () => {
    const res = findResource("scs_artifact_component");
    const filterNames = res.listFilterFields?.map((f) => f.name) ?? [];
    expect(filterNames).toContain("dependency_type");
    expect(filterNames).toContain("search_term");
  });
});

// ─── T14-v2: filter enrichment ────────────────────────────────────────────

describe("T14-v2: SCS list filter enrichment", () => {
  it("scs_artifact_source has artifact_type in listFilterFields", () => {
    const res = findResource("scs_artifact_source");
    const filterNames = res.listFilterFields?.map((f) => f.name) ?? [];
    expect(filterNames).toContain("artifact_type");
    expect(filterNames).toContain("search_term");
  });

  it("scs_compliance_result has standards and status in listFilterFields", () => {
    const res = findResource("scs_compliance_result");
    const filterNames = res.listFilterFields?.map((f) => f.name) ?? [];
    expect(filterNames).toContain("standards");
    expect(filterNames).toContain("status");
  });
});

// ─── T4-v2: remediation limitation note ───────────────────────────────────

describe("T4-v2: remediation limitation note", () => {
  it("scs_artifact_remediation description mentions code repository limitation", () => {
    const res = findResource("scs_artifact_remediation");
    expect(res.description).toContain("code repository");
    expect(res.description).toContain("not available for container");
  });
});

// ─── T11-v2: ID retention hints ───────────────────────────────────────────

describe("T11-v2: ID retention hints in descriptions", () => {
  it("scs_artifact_source description mentions retaining source_id", () => {
    const res = findResource("scs_artifact_source");
    expect(res.description).toContain("source_id");
    expect(res.description).toMatch(/[Rr]etain/);
  });

  it("artifact_security description mentions retaining artifact_id and source_id", () => {
    const res = findResource("artifact_security");
    expect(res.description).toContain("artifact_id");
    expect(res.description).toContain("source_id");
    expect(res.description).toMatch(/[Rr]etain/);
  });

  it("code_repo_security description mentions retaining repo_id", () => {
    const res = findResource("code_repo_security");
    expect(res.description).toContain("repo_id");
    expect(res.description).toMatch(/[Rr]etain/);
  });

  it("scs_chain_of_custody description mentions orchestration IDs", () => {
    const res = findResource("scs_chain_of_custody");
    expect(res.description).toContain("orchestration");
    expect(res.description).toContain("SBOM");
  });
});

// ─── T13-v2: all SCS resources use scsCleanExtract ────────────────────────

describe("T13-v2: all SCS resources use scsCleanExtract", () => {
  it("no SCS resource uses passthrough extractor", () => {
    for (const res of scsToolset.resources) {
      for (const [opName, spec] of Object.entries(res.operations)) {
        // scsCleanExtract is a named function — verify it's not passthrough
        const extractorName = spec.responseExtractor?.name ?? "anonymous";
        expect(
          extractorName,
          `${res.resourceType}.${opName} should use scsCleanExtract, got "${extractorName}"`,
        ).not.toBe("passthrough");
      }
    }
  });

  it("every SCS operation has a responseExtractor", () => {
    for (const res of scsToolset.resources) {
      for (const [opName, spec] of Object.entries(res.operations)) {
        expect(
          spec.responseExtractor,
          `${res.resourceType}.${opName} missing responseExtractor`,
        ).toBeDefined();
      }
    }
  });
});
