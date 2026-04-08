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
import { scsCleanExtract, scsListExtract } from "../../src/registry/extractors.js";
import { compactItems } from "../../src/utils/compact.js";
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

  it("strips empty object fields after recursive cleaning", () => {
    const input = {
      id: "abc",
      metadata: { deleted: null, extra: "", tags: [] },
      nested: { inner: { a: null, b: undefined } },
    };
    expect(scsCleanExtract(input)).toEqual({ id: "abc" });
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
  it("scs_artifact_component bodyBuilder passes dependency_type as dependency_type_filter array", () => {
    const spec = getOp("scs_artifact_component", "list");
    const body = spec.bodyBuilder!({ dependency_type: "DIRECT" });
    expect(body).toEqual({ dependency_type_filter: ["DIRECT"] });
  });

  it("scs_artifact_component bodyBuilder passes search_term + dependency_type_filter", () => {
    const spec = getOp("scs_artifact_component", "list");
    const body = spec.bodyBuilder!({ search_term: "lodash", dependency_type: "TRANSITIVE" });
    expect(body).toEqual({ search_term: "lodash", dependency_type_filter: ["TRANSITIVE"] });
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

  it("scs_artifact_remediation maps target_version query param to targetVersion (API camelCase)", () => {
    const spec = getOp("scs_artifact_remediation", "get");
    expect(spec.queryParams).toEqual({
      purl: "purl",
      target_version: "targetVersion",
    });
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

  it("scs_artifact_component description mentions retaining purl", () => {
    const res = findResource("scs_artifact_component");
    expect(res.description).toContain("purl");
    expect(res.description).toMatch(/[Rr]etain/);
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

// ─── P2-2: scsListExtract field selection ──────────────────────────────────

describe("P2-2: scsListExtract field selection", () => {
  it("selects only specified fields from array items", () => {
    const extract = scsListExtract(["id", "name"]);
    const result = extract([
      { id: "1", name: "test", extra: "noise", deep: { nested: true } },
      { id: "2", name: "other", foo: "bar" },
    ]);
    expect(result).toEqual([
      { id: "1", name: "test" },
      { id: "2", name: "other" },
    ]);
  });

  it("strips null/empty fields before selecting", () => {
    const extract = scsListExtract(["id", "name", "count"]);
    const result = extract([
      { id: "1", name: null, count: 0, extra: "" },
    ]);
    // null name stripped, empty extra stripped, count=0 preserved
    expect(result).toEqual([{ id: "1", count: 0 }]);
  });

  it("passes through non-array responses unchanged", () => {
    const extract = scsListExtract(["id"]);
    const obj = { id: "1", name: "test" };
    // Non-array cleaned but not field-selected
    expect(extract(obj)).toEqual({ id: "1", name: "test" });
  });

  it("handles empty arrays", () => {
    const extract = scsListExtract(["id"]);
    expect(extract([])).toEqual([]);
  });

  it("skips fields that don't exist in the item", () => {
    const extract = scsListExtract(["id", "nonexistent", "also_missing"]);
    expect(extract([{ id: "1", other: "value" }])).toEqual([{ id: "1" }]);
  });

  it("preserves nested objects in selected fields", () => {
    const extract = scsListExtract(["id", "orchestration"]);
    const result = extract([
      { id: "1", orchestration: { id: "orch1", status: "done" }, extra: "noise" },
    ]);
    expect(result).toEqual([
      { id: "1", orchestration: { id: "orch1", status: "done" } },
    ]);
  });

  it("scs_artifact_source list uses scsListExtract", () => {
    const spec = getOp("scs_artifact_source", "list");
    // scsListExtract returns a closure — verify it's not scsCleanExtract directly
    expect(spec.responseExtractor).toBeDefined();
    // Verify field selection works by testing with a mock response
    const result = spec.responseExtractor!([
      { id: "src1", name: "ECR", artifact_type: "CONTAINER", registry_url: "https://ecr.aws", extra_field: "dropped" },
    ]) as Record<string, unknown>[];
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("artifact_type");
    expect(result[0]).not.toHaveProperty("extra_field");
  });

  it("artifact_security list preserves orchestration for ID capture", () => {
    const spec = getOp("artifact_security", "list");
    const result = spec.responseExtractor!([
      { id: "art1", name: "nginx", tag: "latest", orchestration: { id: "orch1" }, internal_metadata: "dropped" },
    ]) as Record<string, unknown>[];
    expect(result[0]).toHaveProperty("orchestration");
    expect(result[0]).not.toHaveProperty("internal_metadata");
  });

  it("scs_artifact_component list preserves purl for remediation", () => {
    const spec = getOp("scs_artifact_component", "list");
    const result = spec.responseExtractor!([
      { purl: "pkg:npm/express@4.18.0", package_name: "express", dependency_type: "DIRECT", internal: "dropped" },
    ]) as Record<string, unknown>[];
    expect(result[0]).toHaveProperty("purl");
    expect(result[0]).toHaveProperty("package_name");
    expect(result[0]).toHaveProperty("dependency_type");
    expect(result[0]).not.toHaveProperty("internal");
  });

  it("code_repo_security list uses scsListExtract", () => {
    const spec = getOp("code_repo_security", "list");
    const result = spec.responseExtractor!([
      { id: "repo1", name: "my-repo", branch: "main", internal: "dropped" },
    ]) as Record<string, unknown>[];
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).not.toHaveProperty("internal");
  });
});

// ─── P2-3A: Pagination default cap ─────────────────────────────────────────

describe("P2-3A: SCS list pagination defaults", () => {
  const listResources = [
    "scs_artifact_source",
    "artifact_security",
    "scs_artifact_component",
    "scs_compliance_result",
    "code_repo_security",
  ];

  for (const rt of listResources) {
    it(`${rt} list has defaultQueryParams with limit=10`, () => {
      const spec = getOp(rt, "list");
      expect(spec.defaultQueryParams).toBeDefined();
      expect(spec.defaultQueryParams!.limit).toBe("10");
    });
  }
});

// ─── P2-6: diagnosticHint on SCS resources ─────────────────────────────────

describe("P2-6: SCS resource diagnosticHints", () => {
  const resourcesWithHints = [
    "scs_artifact_source",
    "artifact_security",
    "scs_artifact_component",
    "scs_artifact_remediation",
    "scs_chain_of_custody",
    "scs_compliance_result",
    "code_repo_security",
    "scs_sbom",
    "scs_component_dependencies",
    "scs_component_remediation",
    "scs_remediation_pr",
    "scs_auto_pr_config",
    "scs_bom_violation",
  ];

  for (const rt of resourcesWithHints) {
    it(`${rt} has a diagnosticHint`, () => {
      const res = findResource(rt);
      expect(res.diagnosticHint).toBeDefined();
      expect(res.diagnosticHint!.length).toBeGreaterThan(20);
    });

    it(`${rt} diagnosticHint mentions recovery action`, () => {
      const res = findResource(rt);
      expect(res.diagnosticHint).toMatch(/harness_(list|get)/);
    });
  }
});

// ─── P2-12: Two-step artifact listing guidance ─────────────────────────────

describe("P2-12: Two-step artifact listing guidance", () => {
  it("scs_artifact_source description mentions two-step flow", () => {
    const res = findResource("scs_artifact_source");
    expect(res.description).toMatch(/[Tt]wo-step/);
  });

  it("artifact_security description mentions source_id requirement", () => {
    const res = findResource("artifact_security");
    expect(res.description).toContain("source_id is required");
    expect(res.description).toContain("scs_artifact_source");
  });
});

// ─── P3-8: Component Dependencies (dependency tree) ───────────────────────

describe("P3-8: scs_component_dependencies resource", () => {
  it("exists in scsToolset", () => {
    expect(() => findResource("scs_component_dependencies")).not.toThrow();
  });

  it("has a get operation pointing to the dependencies endpoint", () => {
    const spec = getOp("scs_component_dependencies", "get");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/component/dependencies");
  });

  it("maps purl as query param", () => {
    const spec = getOp("scs_component_dependencies", "get");
    expect(spec.queryParams).toEqual({
      purl: "purl",
    });
  });

  it("uses scsListExtract for field selection", () => {
    const spec = getOp("scs_component_dependencies", "get");
    expect(spec.responseExtractor).toBeDefined();
  });

  it("description distinguishes from scs_artifact_component (flat list)", () => {
    const res = findResource("scs_component_dependencies");
    expect(res.description).toContain("dependency tree");
    expect(res.description).toContain("scs_artifact_component");
  });

  it("description mentions transitive dependencies", () => {
    const res = findResource("scs_component_dependencies");
    expect(res.description).toContain("transitive");
  });

  it("has purl as required listFilterField", () => {
    const res = findResource("scs_component_dependencies");
    const purlField = res.listFilterFields?.find((f) => f.name === "purl");
    expect(purlField).toBeDefined();
    expect(purlField!.required).toBe(true);
  });

  it("has diagnosticHint mentioning scs_artifact_component for purl values", () => {
    const res = findResource("scs_component_dependencies");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint!).toContain("scs_artifact_component");
  });

  it("has searchAliases including dependency tree and dependency graph", () => {
    const res = findResource("scs_component_dependencies");
    expect(res.searchAliases).toContain("dependency tree");
    expect(res.searchAliases).toContain("dependency graph");
  });

  it("relatedResources links to scs_artifact_component as parent", () => {
    const res = findResource("scs_component_dependencies");
    const parent = res.relatedResources?.find((r) => r.resourceType === "scs_artifact_component");
    expect(parent).toBeDefined();
    expect(parent!.relationship).toBe("parent");
  });

  it("scs_artifact_component links to scs_component_dependencies as child", () => {
    const res = findResource("scs_artifact_component");
    const child = res.relatedResources?.find((r) => r.resourceType === "scs_component_dependencies");
    expect(child).toBeDefined();
    expect(child!.relationship).toBe("child");
  });
});

// ─── P3-6: Component Remediation (upgrade suggestions + impact analysis) ───

describe("P3-6: scs_component_remediation resource", () => {
  it("exists in scsToolset", () => {
    expect(() => findResource("scs_component_remediation")).not.toThrow();
  });

  it("has a get operation pointing to the remediation endpoint", () => {
    const spec = getOp("scs_component_remediation", "get");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/component/remediation");
  });

  it("maps purl and target_version as query params", () => {
    const spec = getOp("scs_component_remediation", "get");
    expect(spec.queryParams).toEqual({
      purl: "purl",
      target_version: "targetVersion",
    });
  });

  it("uses scsCleanExtract", () => {
    const spec = getOp("scs_component_remediation", "get");
    expect(spec.responseExtractor).toBeDefined();
    expect(spec.responseExtractor!.name).not.toBe("passthrough");
  });

  it("description mentions dependency impact analysis (P3-9)", () => {
    const res = findResource("scs_component_remediation");
    expect(res.description).toContain("dependency impact");
    expect(res.description).toContain("dependency_changes");
  });

  it("description mentions scs_remediation_pr for follow-up", () => {
    const res = findResource("scs_component_remediation");
    expect(res.description).toContain("scs_remediation_pr");
  });

  it("has purl as required listFilterField", () => {
    const res = findResource("scs_component_remediation");
    const purlField = res.listFilterFields?.find((f) => f.name === "purl");
    expect(purlField).toBeDefined();
    expect(purlField!.required).toBe(true);
  });

  it("has diagnosticHint", () => {
    const res = findResource("scs_component_remediation");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint!).toContain("code repo");
  });
});

// ─── P3-6: Remediation Pull Requests ───────────────────────────────────────

describe("P3-6: scs_remediation_pr resource", () => {
  it("exists in scsToolset", () => {
    expect(() => findResource("scs_remediation_pr")).not.toThrow();
  });

  it("has a list operation", () => {
    const spec = getOp("scs_remediation_pr", "list");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/remediation/pull-requests");
  });

  it("list has defaultQueryParams with limit=10", () => {
    const spec = getOp("scs_remediation_pr", "list");
    expect(spec.defaultQueryParams).toBeDefined();
    expect(spec.defaultQueryParams!.limit).toBe("10");
  });

  it("has a create operation (write)", () => {
    const spec = getOp("scs_remediation_pr", "create" as "list");
    expect(spec.method).toBe("POST");
    expect(spec.path).toContain("/create-pull-request");
  });

  it("create bodyBuilder passes purl and target_version", () => {
    const spec = getOp("scs_remediation_pr", "create" as "list");
    const body = spec.bodyBuilder!({ purl: "pkg:npm/express@4.18.0", target_version: "4.19.0" });
    expect(body).toEqual({ purl: "pkg:npm/express@4.18.0", target_version: "4.19.0" });
  });

  it("create bodyBuilder omits absent fields", () => {
    const spec = getOp("scs_remediation_pr", "create" as "list");
    const body = spec.bodyBuilder!({});
    expect(body).toEqual({});
  });

  it("create has bodySchema with purl and target_version fields", () => {
    const spec = getOp("scs_remediation_pr", "create" as "list");
    expect(spec.bodySchema).toBeDefined();
    expect(spec.bodySchema!.description).toBeTruthy();
    const fieldNames = spec.bodySchema!.fields.map((f) => f.name);
    expect(fieldNames).toContain("purl");
    expect(fieldNames).toContain("target_version");
  });

  it("description warns about write operation", () => {
    const res = findResource("scs_remediation_pr");
    expect(res.description).toContain("WRITE OPERATION");
    expect(res.description).not.toMatch(/\bclose\b/i);
  });

  it("has diagnosticHint", () => {
    const res = findResource("scs_remediation_pr");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint!.length).toBeGreaterThan(20);
  });
});

// ─── P3-12: Auto PR Configuration ──────────────────────────────────────────

describe("P3-12: scs_auto_pr_config resource", () => {
  it("exists in scsToolset", () => {
    expect(() => findResource("scs_auto_pr_config")).not.toThrow();
  });

  it("has a get operation", () => {
    const spec = getOp("scs_auto_pr_config", "get");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/auto-pr-config");
  });

  it("has an update operation (write)", () => {
    const spec = getOp("scs_auto_pr_config", "update" as "list");
    expect(spec.method).toBe("PUT");
    expect(spec.path).toContain("/auto-pr-config");
  });

  it("update has bodySchema", () => {
    const spec = getOp("scs_auto_pr_config", "update" as "list");
    expect(spec.bodySchema).toBeDefined();
    expect(spec.bodySchema!.description).toBeTruthy();
  });

  it("update bodyBuilder passes body through", () => {
    const spec = getOp("scs_auto_pr_config", "update" as "list");
    const config = { enabled: true, severity_threshold: "HIGH" };
    const body = spec.bodyBuilder!({ body: config });
    expect(body).toEqual(config);
  });

  it("has empty identifierFields (project-level config)", () => {
    const res = findResource("scs_auto_pr_config");
    expect(res.identifierFields).toEqual([]);
  });

  it("description warns about write operation", () => {
    const res = findResource("scs_auto_pr_config");
    expect(res.description).toContain("WRITE OPERATION");
  });

  it("has diagnosticHint", () => {
    const res = findResource("scs_auto_pr_config");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint!).toContain("harness_get");
  });
});

// ─── P3-7: Code repo → repo dependency guidance ────────────────────────────

describe("P3-7: code_repo_security repo-level dependency guidance", () => {
  it("description mentions repo_id IS an artifact_id", () => {
    const res = findResource("code_repo_security");
    expect(res.description).toContain("repo_id IS an artifact_id");
  });

  it("description shows scs_artifact_component query pattern", () => {
    const res = findResource("code_repo_security");
    expect(res.description).toContain("scs_artifact_component");
    expect(res.description).toContain("dependency_type='DIRECT'");
  });

  it("description references scs_component_remediation for repo deps", () => {
    const res = findResource("code_repo_security");
    expect(res.description).toContain("scs_component_remediation");
  });
});

// ── T9-v2: Compact mode analysis ──────────────────────────────────────────
describe("T9-v2: compactItems effectiveness for SCS", () => {
  it("scsCleanExtract returns raw arrays (not {items:[]}), bypassing compactItems", () => {
    // SCS API responses are arrays. scsCleanExtract preserves this structure.
    // harness-list.ts applies compactItems only when isRecord(result) && result.items.
    // Arrays fail isRecord, so compact mode is structurally bypassed for SCS.
    // This is INTENTIONAL — compactItems drops critical SCS domain fields.
    const scsResponse = [
      { id: "abc", name: "test", scorecard: { avg_score: "7.5" }, orchestration: { id: "orch1" } },
    ];
    const cleaned = scsCleanExtract(scsResponse);
    expect(Array.isArray(cleaned)).toBe(true);
    // isRecord check (same logic as harness-list.ts)
    const wouldApplyCompact = typeof cleaned === "object" && cleaned !== null && !Array.isArray(cleaned);
    expect(wouldApplyCompact).toBe(false);
  });

  it("compactItems drops critical SCS fields — too aggressive for SCS domain", () => {
    const scsArtifact = {
      id: "6799da3b", name: "gcr.io/test", tags: ["v1"],
      digest: "sha256:abc", url: "https://gcr.io",
      components_count: 67, updated: "1741726410383",
      scorecard: { avg_score: "7.5" },
      policy_enforcement: { allow_list_violation_count: "5" },
      orchestration: { id: "E5-Dyu80" },
    };

    const [compacted] = compactItems([scsArtifact]) as Record<string, unknown>[];

    // Only name and tags survive the generic whitelist
    expect(compacted.name).toBeDefined();
    expect(compacted.tags).toBeDefined();

    // All these critical SCS fields are dropped
    expect(compacted.id).toBeUndefined();
    expect(compacted.digest).toBeUndefined();
    expect(compacted.url).toBeUndefined();
    expect(compacted.components_count).toBeUndefined();
    expect(compacted.scorecard).toBeUndefined();
    expect(compacted.policy_enforcement).toBeUndefined();
    expect(compacted.orchestration).toBeUndefined();
  });
});

// ─── P3-10: scs_compliance_result governance cross-references ───────────────

describe("P3-10: scs_compliance_result governance cross-references", () => {
  it("has relatedResources pointing to governance policy", () => {
    const res = findResource("scs_compliance_result");
    const policyRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "policy",
    );
    expect(policyRef).toBeDefined();
    expect(policyRef!.relationship).toBe("sibling");
    expect(policyRef!.description).toContain("governance");
  });

  it("has relatedResources pointing to governance policy_set", () => {
    const res = findResource("scs_compliance_result");
    const policySetRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "policy_set",
    );
    expect(policySetRef).toBeDefined();
    expect(policySetRef!.relationship).toBe("sibling");
    expect(policySetRef!.description).toContain("governance");
  });

  it("retains parent reference to artifact_security", () => {
    const res = findResource("scs_compliance_result");
    const parentRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "artifact_security",
    );
    expect(parentRef).toBeDefined();
    expect(parentRef!.relationship).toBe("parent");
  });

  it("searchAliases cover CIS/OWASP but NOT enforcement (P3-1 disambiguation)", () => {
    const res = findResource("scs_compliance_result");
    const aliases = res.searchAliases!.map((a) => a.toLowerCase());
    expect(aliases).toContain("compliance");
    expect(aliases).toContain("cis");
    expect(aliases).toContain("owasp");
    // Enforcement aliases moved to scs_bom_violation (P3-1)
    expect(aliases).not.toContain("enforcement");
    expect(aliases).not.toContain("sbom enforcement");
    expect(aliases).not.toContain("bom enforcement");
  });
});

// ─── P3-8: scs_component_dependencies structural tests ─────────────────────

describe("P3-8: scs_component_dependencies resource", () => {
  it("exists in scsToolset", () => {
    expect(() => findResource("scs_component_dependencies")).not.toThrow();
  });

  it("has a get operation with correct path", () => {
    const spec = getOp("scs_component_dependencies", "get");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/component/dependencies");
  });

  it("get operation requires purl as query param", () => {
    const spec = getOp("scs_component_dependencies", "get");
    expect(spec.queryParams).toBeDefined();
    expect(spec.queryParams!.purl).toBe("purl");
  });

  it("description distinguishes from scs_artifact_component (flat list)", () => {
    const res = findResource("scs_component_dependencies");
    expect(res.description).toContain("DEPENDS ON");
    expect(res.description).toContain("DIFFERENT from scs_artifact_component");
  });

  it("description mentions transitive dependencies", () => {
    const res = findResource("scs_component_dependencies");
    expect(res.description).toContain("transitive");
  });

  it("diagnosticHint explains how to get purl values", () => {
    const res = findResource("scs_component_dependencies");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint!).toContain("scs_artifact_component");
    expect(res.diagnosticHint!).toContain("purl");
  });

  it("searchAliases include dependency tree terms", () => {
    const res = findResource("scs_component_dependencies");
    const aliases = res.searchAliases!.map((a) => a.toLowerCase());
    expect(aliases).toContain("dependency tree");
    expect(aliases).toContain("transitive dependencies");
    expect(aliases).toContain("dependency graph");
    expect(aliases).toContain("depends on");
  });

  it("has relatedResources referencing scs_artifact_component as parent", () => {
    const res = findResource("scs_component_dependencies");
    const parentRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "scs_artifact_component",
    );
    expect(parentRef).toBeDefined();
    expect(parentRef!.relationship).toBe("parent");
  });

  it("has relatedResources referencing scs_component_remediation as sibling", () => {
    const res = findResource("scs_component_dependencies");
    const siblingRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "scs_component_remediation",
    );
    expect(siblingRef).toBeDefined();
    expect(siblingRef!.relationship).toBe("sibling");
  });

  it("purl is a required listFilterField", () => {
    const res = findResource("scs_component_dependencies");
    const purlField = res.listFilterFields!.find((f) => f.name === "purl");
    expect(purlField).toBeDefined();
    expect(purlField!.required).toBe(true);
  });
});

// ─── P3-11: scs_component_enrichment structural tests ────────────────────────

describe("P3-11: scs_component_enrichment resource", () => {
  it("exists in scsToolset", () => {
    expect(() => findResource("scs_component_enrichment")).not.toThrow();
  });

  it("has a get operation with correct fallback path", () => {
    const spec = getOp("scs_component_enrichment", "get");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/v1/components/details");
  });

  it("has a pathBuilder that returns project-scoped path when artifact_id is provided", () => {
    const spec = getOp("scs_component_enrichment", "get");
    expect(spec.pathBuilder).toBeDefined();
    const path = spec.pathBuilder!(
      { artifact_id: "art123", org_id: "myOrg", project_id: "myProj", purl: "pkg:npm/express@4.18.0" },
      { HARNESS_ACCOUNT_ID: "acc", HARNESS_DEFAULT_ORG_ID: "defOrg", HARNESS_DEFAULT_PROJECT_ID: "defProj" },
    );
    expect(path).toContain("/v1/orgs/myOrg/projects/myProj/artifacts/art123/component/overview");
  });

  it("pathBuilder falls back to account-scoped path when artifact_id is absent", () => {
    const spec = getOp("scs_component_enrichment", "get");
    const path = spec.pathBuilder!(
      { purl: "pkg:npm/express@4.18.0" },
      { HARNESS_ACCOUNT_ID: "acc", HARNESS_DEFAULT_ORG_ID: "defOrg", HARNESS_DEFAULT_PROJECT_ID: "defProj" },
    );
    expect(path).toContain("/v1/components/details");
    expect(path).not.toContain("/orgs/");
  });

  it("pathBuilder uses default org/project from config when not in input", () => {
    const spec = getOp("scs_component_enrichment", "get");
    const path = spec.pathBuilder!(
      { artifact_id: "art123", purl: "pkg:npm/express@4.18.0" },
      { HARNESS_ACCOUNT_ID: "acc", HARNESS_ORG: "defOrg", HARNESS_PROJECT: "defProj" },
    );
    expect(path).toContain("/v1/orgs/defOrg/projects/defProj/artifacts/art123/component/overview");
  });

  it("get operation requires purl as query param", () => {
    const spec = getOp("scs_component_enrichment", "get");
    expect(spec.queryParams).toBeDefined();
    expect(spec.queryParams!.purl).toBe("purl");
  });

  it("is project-scoped with scopeOptional for account fallback", () => {
    const res = findResource("scs_component_enrichment");
    expect(res.scope).toBe("project");
    expect(res.scopeOptional).toBe(true);
  });

  it("description mentions EOL, outdated, unmaintained", () => {
    const res = findResource("scs_component_enrichment");
    expect(res.description).toContain("end-of-life");
    expect(res.description).toContain("outdated");
    expect(res.description).toContain("unmaintained");
  });

  it("description clarifies CVE boundary with STO", () => {
    const res = findResource("scs_component_enrichment");
    expect(res.description).toContain("security_issue");
    expect(res.description).toContain("STO");
  });

  it("diagnosticHint explains PURL format", () => {
    const res = findResource("scs_component_enrichment");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint!).toContain("pkg:");
  });

  it("searchAliases include OSS risk terms", () => {
    const res = findResource("scs_component_enrichment");
    const aliases = res.searchAliases!.map((a) => a.toLowerCase());
    expect(aliases).toContain("oss risk");
    expect(aliases).toContain("end of life");
    expect(aliases).toContain("eol");
    expect(aliases).toContain("outdated");
    expect(aliases).toContain("unmaintained");
    expect(aliases).toContain("latest version");
  });

  it("has relatedResources referencing scs_artifact_component as parent", () => {
    const res = findResource("scs_component_enrichment");
    const parentRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "scs_artifact_component",
    );
    expect(parentRef).toBeDefined();
    expect(parentRef!.relationship).toBe("parent");
  });

  it("has relatedResources referencing scs_component_remediation as sibling", () => {
    const res = findResource("scs_component_enrichment");
    const siblingRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "scs_component_remediation",
    );
    expect(siblingRef).toBeDefined();
    expect(siblingRef!.relationship).toBe("sibling");
  });

  it("has relatedResources referencing security_issue (STO) as sibling", () => {
    const res = findResource("scs_component_enrichment");
    const stoRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "security_issue",
    );
    expect(stoRef).toBeDefined();
    expect(stoRef!.relationship).toBe("sibling");
  });

  it("purl is a required listFilterField", () => {
    const res = findResource("scs_component_enrichment");
    const purlField = res.listFilterFields!.find((f) => f.name === "purl");
    expect(purlField).toBeDefined();
    expect(purlField!.required).toBe(true);
  });

  it("artifact_id is an optional listFilterField", () => {
    const res = findResource("scs_component_enrichment");
    const artifactField = res.listFilterFields!.find((f) => f.name === "artifact_id");
    expect(artifactField).toBeDefined();
    expect(artifactField!.required).toBeFalsy();
  });

  it("has artifact_id in identifierFields", () => {
    const res = findResource("scs_component_enrichment");
    expect(res.identifierFields).toContain("artifact_id");
  });

  it("description mentions both modes and artifact_id", () => {
    const res = findResource("scs_component_enrichment");
    expect(res.description).toContain("artifact_id");
    expect(res.description).toContain("Account-scoped");
    expect(res.description).toContain("Project-scoped");
  });

  it("scs_artifact_component has relatedResources referencing scs_component_enrichment", () => {
    const res = findResource("scs_artifact_component");
    const enrichmentRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "scs_component_enrichment",
    );
    expect(enrichmentRef).toBeDefined();
    expect(enrichmentRef!.relationship).toBe("sibling");
  });
});


// ─── P3-1: BOM Enforcement Violations ───────────────────────────────────────

describe("P3-1: scs_bom_violation resource", () => {
  it("exists in scsToolset", () => {
    expect(() => findResource("scs_bom_violation")).not.toThrow();
  });

  it("has a list operation pointing to policy-violations endpoint", () => {
    const spec = getOp("scs_bom_violation", "list");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/enforcement/");
    expect(spec.path).toContain("/policy-violations");
  });

  it("list maps enforcement_id to path param", () => {
    const spec = getOp("scs_bom_violation", "list");
    expect(spec.pathParams).toEqual({
      org_id: "org",
      project_id: "project",
      enforcement_id: "enforcement",
    });
  });

  it("list maps search_term to searchText query param", () => {
    const spec = getOp("scs_bom_violation", "list");
    expect(spec.queryParams!.search_term).toBe("searchText");
  });

  it("list has pagination query params", () => {
    const spec = getOp("scs_bom_violation", "list");
    expect(spec.queryParams!.page).toBe("page");
    expect(spec.queryParams!.size).toBe("limit");
    expect(spec.queryParams!.sort).toBe("sort");
    expect(spec.queryParams!.order).toBe("order");
  });

  it("list has defaultQueryParams with limit=10", () => {
    const spec = getOp("scs_bom_violation", "list");
    expect(spec.defaultQueryParams).toBeDefined();
    expect(spec.defaultQueryParams!.limit).toBe("10");
  });

  it("list uses scsListExtract for field selection", () => {
    const spec = getOp("scs_bom_violation", "list");
    expect(spec.responseExtractor).toBeDefined();
    // Verify field selection works
    const result = spec.responseExtractor!([
      {
        name: "log4j", version: "2.14.0", purl: "pkg:maven/log4j@2.14.0",
        license: "Apache-2.0", violationType: "DENY_LIST", violationDetails: "Component blocked",
        isExempted: false, exemptionId: null,
        supplier: "Apache", supplierType: "ORG", packageManager: "maven",
        internalField: "dropped", imageName: "dropped",
      },
    ]) as Record<string, unknown>[];
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("version");
    expect(result[0]).toHaveProperty("purl");
    expect(result[0]).toHaveProperty("violationType");
    expect(result[0]).toHaveProperty("violationDetails");
    expect(result[0]).toHaveProperty("isExempted");
    expect(result[0]).not.toHaveProperty("internalField");
    expect(result[0]).not.toHaveProperty("imageName");
  });

  it("list extractor preserves exempted violations (isExempted=true)", () => {
    const spec = getOp("scs_bom_violation", "list");
    const result = spec.responseExtractor!([
      { name: "dep1", violationType: "ALLOW_LIST", isExempted: true, exemptionId: "ex-123" },
    ]) as Record<string, unknown>[];
    expect(result[0]).toHaveProperty("isExempted", true);
    expect(result[0]).toHaveProperty("exemptionId", "ex-123");
  });

  it("has a get operation pointing to enforcement summary endpoint", () => {
    const spec = getOp("scs_bom_violation", "get");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/enforcement/");
    expect(spec.path).toContain("/summary");
  });

  it("get maps enforcement_id to path param", () => {
    const spec = getOp("scs_bom_violation", "get");
    expect(spec.pathParams).toEqual({
      org_id: "org",
      project_id: "project",
      enforcement_id: "enforcement",
    });
  });

  it("get uses scsCleanExtract", () => {
    const spec = getOp("scs_bom_violation", "get");
    expect(spec.responseExtractor).toBeDefined();
    expect(spec.responseExtractor!.name).not.toBe("passthrough");
  });

  it("enforcement_id is a required listFilterField", () => {
    const res = findResource("scs_bom_violation");
    const field = res.listFilterFields!.find((f) => f.name === "enforcement_id");
    expect(field).toBeDefined();
    expect(field!.required).toBe(true);
  });

  it("has enforcement_id as identifierField", () => {
    const res = findResource("scs_bom_violation");
    expect(res.identifierFields).toContain("enforcement_id");
  });

  it("description mentions two-step flow", () => {
    const res = findResource("scs_bom_violation");
    expect(res.description).toMatch(/[Tt]wo-step/);
    expect(res.description).toContain("artifact_security");
    expect(res.description).toContain("enforcement_id");
  });

  it("description mentions both deny-list and allow-list violations", () => {
    const res = findResource("scs_bom_violation");
    expect(res.description).toContain("deny-list");
    expect(res.description).toContain("allow-list");
  });

  it("description mentions exempted violations", () => {
    const res = findResource("scs_bom_violation");
    expect(res.description).toContain("exempted");
    expect(res.description).toContain("isExempted");
  });

  it("has diagnosticHint mentioning artifact_security for enforcement_id", () => {
    const res = findResource("scs_bom_violation");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint!).toContain("artifact_security");
    expect(res.diagnosticHint!).toContain("enforcementId");
  });

  it("has searchAliases covering violation-related terms", () => {
    const res = findResource("scs_bom_violation");
    const aliases = res.searchAliases!.map((a) => a.toLowerCase());
    expect(aliases).toContain("bom violation");
    expect(aliases).toContain("policy violation");
    expect(aliases).toContain("deny list violation");
    expect(aliases).toContain("allow list violation");
  });

  it("relatedResources links to artifact_security as parent", () => {
    const res = findResource("scs_bom_violation");
    const parent = res.relatedResources!.find((r) => r.resourceType === "artifact_security");
    expect(parent).toBeDefined();
    expect(parent!.relationship).toBe("parent");
  });

  it("relatedResources links to scs_compliance_result as sibling", () => {
    const res = findResource("scs_bom_violation");
    const sibling = res.relatedResources!.find((r) => r.resourceType === "scs_compliance_result");
    expect(sibling).toBeDefined();
    expect(sibling!.relationship).toBe("sibling");
  });

  it("relatedResources links to governance policy as sibling", () => {
    const res = findResource("scs_bom_violation");
    const sibling = res.relatedResources!.find((r) => r.resourceType === "policy");
    expect(sibling).toBeDefined();
    expect(sibling!.relationship).toBe("sibling");
  });

  it("artifact_security relatedResources includes scs_bom_violation", () => {
    const res = findResource("artifact_security");
    const child = res.relatedResources!.find((r) => r.resourceType === "scs_bom_violation");
    expect(child).toBeDefined();
    expect(child!.relationship).toBe("child");
    expect(child!.description).toContain("enforcement_id");
  });

  it("uses singular org/project path (consistent with enforcement API)", () => {
    const listSpec = getOp("scs_bom_violation", "list");
    const getSpec = getOp("scs_bom_violation", "get");
    // Enforcement endpoints use /v1/org/{org}/project/{project}/ (singular, no 's')
    expect(listSpec.path).toContain("/v1/org/");
    expect(listSpec.path).toContain("/project/");
    expect(listSpec.path).not.toContain("/orgs/");
    expect(listSpec.path).not.toContain("/projects/");
    expect(getSpec.path).toContain("/v1/org/");
    expect(getSpec.path).toContain("/project/");
  });
});

// ─── P3-5: Project Security Overview ─────────────────────────────────────────

describe("P3-5: scs_project_security_overview resource", () => {
  it("exists in scsToolset", () => {
    expect(() => findResource("scs_project_security_overview")).not.toThrow();
  });

  it("has a get operation pointing to security-overview endpoint", () => {
    const spec = getOp("scs_project_security_overview", "get");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/security-overview");
  });

  it("get uses plural orgs/projects path (consistent with ssca-manager v1 pattern)", () => {
    const spec = getOp("scs_project_security_overview", "get");
    expect(spec.path).toContain("/v1/orgs/");
    expect(spec.path).toContain("/projects/");
  });

  it("get maps org_id and project_id as path params", () => {
    const spec = getOp("scs_project_security_overview", "get");
    expect(spec.pathParams).toEqual({
      org_id: "org",
      project_id: "project",
    });
  });

  it("get uses scsCleanExtract", () => {
    const spec = getOp("scs_project_security_overview", "get");
    expect(spec.responseExtractor).toBeDefined();
    expect(spec.responseExtractor!.name).not.toBe("passthrough");
  });

  it("get extractor strips null fields from response", () => {
    const spec = getOp("scs_project_security_overview", "get");
    const result = spec.responseExtractor!({
      artifact_count: { total: 10, images: 7, repositories: 3 },
      vulnerability_summary: { total: 50, critical: 5, high: 10, medium: 20, low: 15, artifacts_with_vulnerabilities: 6 },
      compliance_summary: null,
      enforcement_summary: { deny_list_violations: 3, allow_list_violations: 1, artifacts_with_violations: 2 },
      sbom_coverage: { artifacts_with_sbom: 8, artifacts_without_sbom: 2, total_components: 500 },
      deployment_summary: { artifacts_in_prod: 4, artifacts_in_non_prod: 3 },
    }) as Record<string, unknown>;
    expect(result).toHaveProperty("artifact_count");
    expect(result).toHaveProperty("vulnerability_summary");
    expect(result).not.toHaveProperty("compliance_summary");
    expect(result).toHaveProperty("enforcement_summary");
    expect(result).toHaveProperty("sbom_coverage");
    expect(result).toHaveProperty("deployment_summary");
  });

  it("get extractor preserves zero counts (falsy but meaningful)", () => {
    const spec = getOp("scs_project_security_overview", "get");
    const result = spec.responseExtractor!({
      artifact_count: { total: 0, images: 0, repositories: 0 },
      vulnerability_summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, artifacts_with_vulnerabilities: 0 },
      compliance_summary: { checks_passed: 0, checks_failed: 0, critical_failures: 0, high_failures: 0, medium_failures: 0, low_failures: 0, artifacts_with_failures: 0 },
      enforcement_summary: { deny_list_violations: 0, allow_list_violations: 0, artifacts_with_violations: 0 },
      sbom_coverage: { artifacts_with_sbom: 0, artifacts_without_sbom: 0, total_components: 0 },
      deployment_summary: { artifacts_in_prod: 0, artifacts_in_non_prod: 0 },
    }) as Record<string, unknown>;
    // All sections should be preserved even with zero values
    expect(result).toHaveProperty("artifact_count");
    expect(result).toHaveProperty("vulnerability_summary");
    expect(result).toHaveProperty("compliance_summary");
    expect(result).toHaveProperty("enforcement_summary");
    expect(result).toHaveProperty("sbom_coverage");
    expect(result).toHaveProperty("deployment_summary");
    // Verify zero counts are preserved
    const vulns = result.vulnerability_summary as Record<string, number>;
    expect(vulns.total).toBe(0);
    expect(vulns.critical).toBe(0);
  });

  it("has empty identifierFields (project-level resource)", () => {
    const res = findResource("scs_project_security_overview");
    expect(res.identifierFields).toEqual([]);
  });

  it("is project-scoped", () => {
    const res = findResource("scs_project_security_overview");
    expect(res.scope).toBe("project");
  });

  it("has no list operation (get-only resource)", () => {
    const res = findResource("scs_project_security_overview");
    expect(res.operations.list).toBeUndefined();
  });

  it("description mentions all six response sections", () => {
    const res = findResource("scs_project_security_overview");
    expect(res.description).toContain("artifact_count");
    expect(res.description).toContain("vulnerability_summary");
    expect(res.description).toContain("compliance_summary");
    expect(res.description).toContain("enforcement_summary");
    expect(res.description).toContain("sbom_coverage");
    expect(res.description).toContain("deployment_summary");
  });

  it("description mentions common user queries for LLM routing", () => {
    const res = findResource("scs_project_security_overview");
    expect(res.description).toContain("security overview");
    expect(res.description).toContain("security posture");
    expect(res.description).toContain("vulnerabilities");
    expect(res.description).toContain("SBOM coverage");
  });

  it("description mentions READ-ONLY and drill-down guidance", () => {
    const res = findResource("scs_project_security_overview");
    expect(res.description).toContain("READ-ONLY");
    expect(res.description).toContain("artifact_security");
    expect(res.description).toContain("scs_compliance_result");
    expect(res.description).toContain("scs_bom_violation");
  });

  it("has diagnosticHint with recovery guidance", () => {
    const res = findResource("scs_project_security_overview");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint!.length).toBeGreaterThan(20);
    expect(res.diagnosticHint!).toMatch(/harness_(list|get)/);
  });

  it("diagnosticHint mentions SBOM generation as prerequisite", () => {
    const res = findResource("scs_project_security_overview");
    expect(res.diagnosticHint!).toContain("SBOM");
    expect(res.diagnosticHint!).toContain("pipeline");
  });

  it("has searchAliases covering security overview queries", () => {
    const res = findResource("scs_project_security_overview");
    const aliases = res.searchAliases!.map((a) => a.toLowerCase());
    expect(aliases).toContain("security overview");
    expect(aliases).toContain("project security");
    expect(aliases).toContain("security posture");
    expect(aliases).toContain("vulnerability summary");
    expect(aliases).toContain("compliance summary");
    expect(aliases).toContain("sbom coverage");
  });

  it("relatedResources links to scs_artifact_source as child", () => {
    const res = findResource("scs_project_security_overview");
    const child = res.relatedResources!.find((r) => r.resourceType === "scs_artifact_source");
    expect(child).toBeDefined();
    expect(child!.relationship).toBe("child");
  });

  it("relatedResources links to artifact_security as child", () => {
    const res = findResource("scs_project_security_overview");
    const child = res.relatedResources!.find((r) => r.resourceType === "artifact_security");
    expect(child).toBeDefined();
    expect(child!.relationship).toBe("child");
  });

  it("relatedResources links to scs_compliance_result as child", () => {
    const res = findResource("scs_project_security_overview");
    const child = res.relatedResources!.find((r) => r.resourceType === "scs_compliance_result");
    expect(child).toBeDefined();
    expect(child!.relationship).toBe("child");
  });

  it("relatedResources links to scs_bom_violation as child", () => {
    const res = findResource("scs_project_security_overview");
    const child = res.relatedResources!.find((r) => r.resourceType === "scs_bom_violation");
    expect(child).toBeDefined();
    expect(child!.relationship).toBe("child");
  });

  it("relatedResources links to scs_oss_risk_summary as sibling", () => {
    const res = findResource("scs_project_security_overview");
    const sibling = res.relatedResources!.find((r) => r.resourceType === "scs_oss_risk_summary");
    expect(sibling).toBeDefined();
    expect(sibling!.relationship).toBe("sibling");
  });
});
