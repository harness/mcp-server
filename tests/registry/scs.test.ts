/**
 * Unit tests for SCS toolset Phase 1-v2 changes:
 * - T2-v2: ensureArray normalization in bodyBuilders
 * - T4-v2: Remediation limitation note in description
 * - T11-v2: ID retention hints in resource descriptions
 * - T12-v2: dependency_type filter on scs_artifact_component
 * - T13-v2: scsCleanExtract strips null/empty fields
 * - T14-v2: artifact_type, status, standards filter enrichment
 */
import { describe, it, expect, vi } from "vitest";
import { scsCleanExtract, scsListExtract } from "../../src/registry/extractors.js";
import { compactItems } from "../../src/utils/compact.js";
import { scsToolset, normalizePurl } from "../../src/registry/toolsets/scs.js";
import { HarnessApiError } from "../../src/utils/errors.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ResourceDefinition, EndpointSpec, PreflightContext } from "../../src/registry/types.js";

/** Minimal Config factory for registry-level tests. */
function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

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
      { id: "src1", name: "ECR", artifact_type: { type: "CONTAINER", sub_type: "CONTAINER_IMAGE" }, registry_url: "https://ecr.aws", extra_field: "dropped" },
    ]) as Record<string, unknown>[];
    // Custom extractor appends a _summary object at the end
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("artifact_type");
    expect(result[0]).not.toHaveProperty("extra_field");
    // Verify _summary has correct counts
    const summary = (result[1] as Record<string, unknown>)._summary as Record<string, unknown>;
    expect(summary).toEqual({ total: 1, by_type: { CONTAINER: 1 } });
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

  it("list responseExtractor preserves PR fields and flattens {items} wrapper", () => {
    // Regression: upstream returns { items: [{...rich PR}] }. scsCleanExtract
    // kept the wrapper, and harness-list's compactItems then stripped every
    // non-whitelisted field (purl/pr_number/pr_url/target_version/...) leaving
    // each PR as {}. The replacement extractor must flatten to a bare array
    // and retain PR-specific fields so the agent gets actionable data.
    const spec = getOp("scs_remediation_pr", "list");
    expect(spec.responseExtractor).toBeDefined();
    const raw = {
      items: [
        {
          id: "pr-1",
          purl: "pkg:npm/npm@6.14.18",
          current_version: "6.14.18",
          target_version: "11.12.1",
          pr_url: "/pulls/13",
          pr_number: 13,
          pr_status: "CREATED",
          repo_name: "Employee-Management-System",
          base_branch: "main",
          remediation_branch: "harness-scs/fix-abc",
          created_at: 1776579010782,
          trigger_type: "AUTO",
        },
      ],
    };
    const extracted = spec.responseExtractor!(raw);
    expect(Array.isArray(extracted)).toBe(true);
    const items = extracted as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0].pr_number).toBe(13);
    expect(items[0].purl).toBe("pkg:npm/npm@6.14.18");
    expect(items[0].target_version).toBe("11.12.1");
    expect(items[0].pr_status).toBe("CREATED");
    expect(items[0].trigger_type).toBe("AUTO");
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
      { HARNESS_ACCOUNT_ID: "acc", HARNESS_ORG: "defOrg", HARNESS_PROJECT: "defProj" },
    );
    expect(path).toContain("/v1/orgs/myOrg/projects/myProj/artifacts/art123/component/overview");
  });

  it("pathBuilder falls back to account-scoped path when artifact_id is absent", () => {
    const spec = getOp("scs_component_enrichment", "get");
    const path = spec.pathBuilder!(
      { purl: "pkg:npm/express@4.18.0" },
      { HARNESS_ACCOUNT_ID: "acc", HARNESS_ORG: "defOrg", HARNESS_PROJECT: "defProj" },
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

  it("description clarifies CVE boundary with scs_component_vulnerability", () => {
    const res = findResource("scs_component_enrichment");
    expect(res.description).toContain("scs_component_vulnerability");
    expect(res.description).toContain("CVE");
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

  it("has relatedResources referencing scs_component_vulnerability as sibling", () => {
    const res = findResource("scs_component_enrichment");
    const vulnRef = res.relatedResources!.find(
      (rel) => rel.resourceType === "scs_component_vulnerability",
    );
    expect(vulnRef).toBeDefined();
    expect(vulnRef!.relationship).toBe("sibling");
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
    // bomViolationListExtract appends a _reminder metadata object
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("version");
    expect(result[0]).toHaveProperty("purl");
    expect(result[0]).toHaveProperty("violationType");
    expect(result[0]).toHaveProperty("violationDetails");
    expect(result[0]).toHaveProperty("isExempted");
    expect(result[0]).not.toHaveProperty("internalField");
    expect(result[0]).not.toHaveProperty("imageName");
    // Verify the appended metadata
    const last = result[result.length - 1];
    expect(last).toHaveProperty("_total");
    expect(last).toHaveProperty("_violation_types_found");
    expect(last).toHaveProperty("_reminder");
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

  // SSCA-6347 — the violation → policy_set → policy chain is the AC test case.
  // Without a direct pointer to policy_set, the agent cannot discover the set that fired
  // the violation and falls back to (wrongly) asking "no SSCA policy sets configured".
  it("relatedResources links to governance policy_set as sibling (SSCA-6347 chain: violation → policy_set → policy)", () => {
    const res = findResource("scs_bom_violation");
    const sibling = res.relatedResources!.find((r) => r.resourceType === "policy_set");
    expect(sibling).toBeDefined();
    expect(sibling!.relationship).toBe("sibling");
    // The sibling description must point the agent at the correct type='sbom' filter so it
    // doesn't regress to the broken type='ssca_enforcement' / type='sbom_enforcement' query.
    expect(sibling!.description).toContain("type='sbom'");
    expect(sibling!.description).toMatch(/NOT 'sbom_enforcement' or 'ssca_enforcement'/);
  });

  it("governance cross-toolset chain is complete: scs_bom_violation \u2194 policy_set \u2194 policy", () => {
    // End-to-end structural assertion for the AC chain. A broken link at any hop sends the
    // agent back into the SSCA-6347 failure mode (empty list, "none configured" reply).
    const violation = findResource("scs_bom_violation");
    const violationPolicySetRef = violation.relatedResources!.find((r) => r.resourceType === "policy_set");
    const violationPolicyRef = violation.relatedResources!.find((r) => r.resourceType === "policy");
    expect(violationPolicySetRef).toBeDefined();
    expect(violationPolicyRef).toBeDefined();

    // policy_set → scs_bom_violation (back-edge) is asserted in governance.test.ts; here we
    // just confirm the agent can walk both legs from the violation without leaving scs.ts.
    expect(violationPolicySetRef!.description.length).toBeGreaterThan(0);
    expect(violationPolicyRef!.description.length).toBeGreaterThan(0);
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

// ─── scs_component_vulnerability resource ───────────────────────────────────

describe("scs_component_vulnerability resource", () => {
  it("exists in scsToolset", () => {
    expect(() => findResource("scs_component_vulnerability")).not.toThrow();
  });

  it("has a list operation", () => {
    const spec = getOp("scs_component_vulnerability", "list");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/vulnerabilities");
  });

  it("list has defaultQueryParams with limit=10", () => {
    const spec = getOp("scs_component_vulnerability", "list");
    expect(spec.defaultQueryParams).toBeDefined();
    expect(spec.defaultQueryParams!.limit).toBe("10");
  });

  it("has purl queryParam", () => {
    const spec = getOp("scs_component_vulnerability", "list");
    expect(spec.queryParams).toHaveProperty("purl");
  });

  it("has pathBuilder for dual-mode (account/artifact scoped)", () => {
    const spec = getOp("scs_component_vulnerability", "list");
    expect(spec.pathBuilder).toBeDefined();
  });

  it("pathBuilder returns account-scoped path without artifact_id", () => {
    const spec = getOp("scs_component_vulnerability", "list");
    const path = spec.pathBuilder!({ purl: "pkg:npm/express@4.18.0" }, {});
    expect(path).toBe("/ssca-manager/v1/components/vulnerabilities");
  });

  it("pathBuilder returns artifact-scoped path with artifact_id", () => {
    const spec = getOp("scs_component_vulnerability", "list");
    const path = spec.pathBuilder!(
      { artifact_id: "art123", purl: "pkg:npm/express@4.18.0" },
      { HARNESS_ORG: "myorg", HARNESS_PROJECT: "myproj" },
    );
    expect(path).toContain("/orgs/myorg/projects/myproj/artifacts/art123/component/vulnerabilities");
  });

  it("has searchAliases for CVE queries", () => {
    const res = findResource("scs_component_vulnerability");
    expect(res.searchAliases).toBeDefined();
    const aliases = res.searchAliases!.map((a) => a.toLowerCase());
    expect(aliases).toContain("cve");
    expect(aliases).toContain("vulnerability");
    expect(aliases).toContain("cvss");
  });

  it("has diagnosticHint", () => {
    const res = findResource("scs_component_vulnerability");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint!.length).toBeGreaterThan(20);
  });

  it("responseExtractor is defined", () => {
    const spec = getOp("scs_component_vulnerability", "list");
    expect(spec.responseExtractor).toBeDefined();
  });
});

// ─── scs_component_search resource ──────────────────────────────────────────

describe("scs_component_search resource", () => {
  it("exists in scsToolset", () => {
    expect(() => findResource("scs_component_search")).not.toThrow();
  });

  it("has a list operation (GET)", () => {
    const spec = getOp("scs_component_search", "list");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/components/search");
  });

  it("list has defaultQueryParams with limit=20", () => {
    const spec = getOp("scs_component_search", "list");
    expect(spec.defaultQueryParams).toBeDefined();
    expect(spec.defaultQueryParams!.limit).toBe("20");
  });

  it("has elkFallback enabled", () => {
    const spec = getOp("scs_component_search", "list");
    expect(spec.elkFallback).toBe(true);
  });

  it("has search_term in queryParams", () => {
    const spec = getOp("scs_component_search", "list");
    expect(spec.queryParams).toHaveProperty("search_term");
  });

  it("has searchAliases for cross-artifact queries", () => {
    const res = findResource("scs_component_search");
    expect(res.searchAliases).toBeDefined();
    const aliases = res.searchAliases!.map((a) => a.toLowerCase());
    expect(aliases).toContain("cross-artifact search");
    expect(aliases).toContain("find dependency");
  });

  it("description mentions search_term is required", () => {
    const res = findResource("scs_component_search");
    expect(res.description).toContain("search_term");
  });

  it("has diagnosticHint", () => {
    const res = findResource("scs_component_search");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint!.length).toBeGreaterThan(20);
  });

  it("responseExtractor is scsListExtract with correct fields", () => {
    const spec = getOp("scs_component_search", "list");
    expect(spec.responseExtractor).toBeDefined();
    // Verify it functions as a list extractor
    const result = spec.responseExtractor!([
      { name: "express", version: "4.18.0", purl: "pkg:npm/express@4.18.0", artifactId: "a1", extra: "removed" },
    ]);
    expect(Array.isArray(result)).toBe(true);
    const item = (result as Record<string, unknown>[])[0];
    expect(item).toHaveProperty("name");
    expect(item).toHaveProperty("purl");
    expect(item).not.toHaveProperty("extra");
  });
});

// ─── Custom extractor tests ─────────────────────────────────────────────────

describe("custom SCS extractors", () => {
  describe("artifactSecurityListExtract", () => {
    it("injects _next_step when policy violations exist", () => {
      const spec = getOp("artifact_security", "list");
      const result = spec.responseExtractor!([
        {
          id: "art1",
          policy_enforcement: { id: "enf1", allow_list_violation_count: 3, deny_list_violation_count: 2 },
        },
      ]);
      const items = result as Record<string, unknown>[];
      expect(items[0]._next_step).toBeDefined();
      expect(items[0]._next_step).toContain("scs_bom_violation");
      expect(items[0]._next_step).toContain("enf1");
    });

    it("does not inject _next_step when no violations", () => {
      const spec = getOp("artifact_security", "list");
      const result = spec.responseExtractor!([
        {
          id: "art1",
          policy_enforcement: { id: "enf1", allow_list_violation_count: 0, deny_list_violation_count: 0 },
        },
      ]);
      const items = result as Record<string, unknown>[];
      expect(items[0]._next_step).toBeUndefined();
    });
  });

  describe("artifactSourceListExtract", () => {
    it("appends _summary with type breakdown", () => {
      const spec = getOp("scs_artifact_source", "list");
      const result = spec.responseExtractor!([
        { id: "1", name: "src1", artifact_type: { type: "CONTAINER" } },
        { id: "2", name: "src2", artifact_type: { type: "FILE" } },
        { id: "3", name: "src3", artifact_type: { type: "CONTAINER" } },
      ]);
      const items = result as unknown[];
      const summary = items[items.length - 1] as Record<string, unknown>;
      expect(summary._summary).toBeDefined();
      const s = summary._summary as { total: number; by_type: Record<string, number> };
      expect(s.total).toBe(3);
      expect(s.by_type.CONTAINER).toBe(2);
      expect(s.by_type.FILE).toBe(1);
    });

    it("returns cleaned array as-is when empty", () => {
      const spec = getOp("scs_artifact_source", "list");
      const result = spec.responseExtractor!([]);
      expect(result).toEqual([]);
    });
  });

  describe("componentDependenciesExtract", () => {
    it("returns EMPTY message for empty array", () => {
      const spec = getOp("scs_component_dependencies", "get");
      const result = spec.responseExtractor!([]) as Record<string, unknown>;
      expect(result._result).toBe("EMPTY");
      expect(result._message).toContain("Zero");
    });

    it("returns cleaned items for non-empty array", () => {
      const spec = getOp("scs_component_dependencies", "get");
      const result = spec.responseExtractor!([
        { name: "lodash", version: "4.17.21", purl: "pkg:npm/lodash@4.17.21" },
      ]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("componentVulnerabilityExtract", () => {
    it("returns EMPTY message for empty array", () => {
      const spec = getOp("scs_component_vulnerability", "list");
      const result = spec.responseExtractor!([]) as Record<string, unknown>;
      expect(result._result).toBe("EMPTY");
      expect(result._message).toContain("No CVEs");
    });

    it("appends _total_cves and _reminder for non-empty results", () => {
      const spec = getOp("scs_component_vulnerability", "list");
      const result = spec.responseExtractor!([
        { cve_id: "CVE-2023-0001", severity: "CRITICAL" },
        { cve_id: "CVE-2023-0002", severity: "HIGH" },
      ]) as unknown[];
      const last = result[result.length - 1] as Record<string, unknown>;
      expect(last._total_cves).toBe(2);
      expect(last._reminder).toContain("ONLY");
    });

    it("passes through non-array values unchanged", () => {
      const spec = getOp("scs_component_vulnerability", "list");
      const result = spec.responseExtractor!({ error: "something" });
      expect(result).toEqual({ error: "something" });
    });
  });

  describe("componentRemediationExtract", () => {
    it("adds _reminder when remediation is not available", () => {
      const spec = getOp("scs_component_remediation", "get");
      const result = spec.responseExtractor!({
        remediation_warnings: [{ message: "remediation guidance is not available for this component" }],
      }) as Record<string, unknown>;
      expect(result._reminder).toContain("not available");
    });

    it("adds version _reminder when recommended_version present", () => {
      const spec = getOp("scs_component_remediation", "get");
      const result = spec.responseExtractor!({
        current_version: "1.0.0",
        recommended_version: "2.0.0",
      }) as Record<string, unknown>;
      expect(result._reminder).toContain("ONLY");
    });

    it("does not add _reminder when no warnings and no versions", () => {
      const spec = getOp("scs_component_remediation", "get");
      const result = spec.responseExtractor!({
        some_field: "value",
      }) as Record<string, unknown>;
      expect(result._reminder).toBeUndefined();
    });
  });

  describe("projectSecurityOverviewExtract", () => {
    it("adds _reminder to response object", () => {
      const spec = getOp("scs_project_security_overview", "get");
      const result = spec.responseExtractor!({
        artifact_count: 10,
        vulnerability_summary: { critical: 5 },
      }) as Record<string, unknown>;
      expect(result._reminder).toBeDefined();
      expect(result._reminder).toContain("ONLY");
    });
  });

  describe("bomViolationListExtract", () => {
    it("appends _total and _reminder with violation types", () => {
      const spec = getOp("scs_bom_violation", "list");
      const result = spec.responseExtractor!([
        { name: "pkg1", violation_type: "Deny List Violation" },
        { name: "pkg2", violation_type: "Allow List Violation" },
      ]) as unknown[];
      const last = result[result.length - 1] as Record<string, unknown>;
      expect(last._total).toBe(2);
      expect(last._violation_types_found).toContain("Deny List Violation");
      expect(last._violation_types_found).toContain("Allow List Violation");
      expect(last._reminder).toContain("ONLY");
    });

    it("returns empty array as-is", () => {
      const spec = getOp("scs_bom_violation", "list");
      const result = spec.responseExtractor!([]);
      expect(result).toEqual([]);
    });
  });

  describe("codeRepoListExtract", () => {
    it("appends _total and _note for non-empty results", () => {
      const spec = getOp("code_repo_security", "list");
      const result = spec.responseExtractor!([
        { id: "r1", name: "repo1" },
        { id: "r2", name: "repo2" },
      ]) as unknown[];
      const last = result[result.length - 1] as Record<string, unknown>;
      expect(last._total).toBe(2);
      expect(last._note).toContain("exactly 2");
    });
  });

  describe("artifactComponentListExtract", () => {
    it("appends _next_step when risk components present", () => {
      const spec = getOp("scs_artifact_component", "list");
      const result = spec.responseExtractor!([
        { purl: "pkg:npm/old@1.0", name: "old", is_outdated: true },
        { purl: "pkg:npm/ok@2.0", name: "ok" },
      ]) as unknown[];
      const last = result[result.length - 1] as Record<string, unknown>;
      expect(last._next_step).toBeDefined();
      expect(last._next_step).toContain("scs_component_enrichment");
    });

    it("does not append _next_step when no risk", () => {
      const spec = getOp("scs_artifact_component", "list");
      const result = spec.responseExtractor!([
        { purl: "pkg:npm/ok@2.0", name: "ok" },
      ]) as unknown[];
      // No summary item appended
      expect(result).toHaveLength(1);
    });
  });
});

// ─── PR review: PURL normalization & remediation-PR preflight ─────────────

describe("normalizePurl", () => {
  it("strips version after @", () => {
    expect(normalizePurl("pkg:npm/foo@1.2.3")).toBe("pkg:npm/foo");
  });

  it("is case-insensitive", () => {
    expect(normalizePurl("pkg:NPM/Foo@1.2.3")).toBe("pkg:npm/foo");
  });

  it("strips qualifiers (?...)", () => {
    expect(normalizePurl("pkg:npm/foo@1.2.3?classifier=sources")).toBe("pkg:npm/foo");
  });

  it("strips subpath (#...)", () => {
    expect(normalizePurl("pkg:npm/foo@1.2.3#path/to/file")).toBe("pkg:npm/foo");
  });

  it("handles spec-compliant scoped npm purls (%40 encoded)", () => {
    // %40 is encoded @; the last-slash heuristic finds the version @ correctly.
    expect(normalizePurl("pkg:npm/%40angular/core@1.0.0")).toBe("pkg:npm/%40angular/core");
    expect(normalizePurl("pkg:npm/%40angular/core@2.0.0")).toBe("pkg:npm/%40angular/core");
  });

  it("does not mis-split on @ that appears before the last /", () => {
    // Contrived but defensive: an @ inside a namespace path would otherwise
    // truncate the name. Our heuristic only splits on @ after the last /.
    expect(normalizePurl("pkg:generic/ns@with-at/name@1.0")).toBe("pkg:generic/ns@with-at/name");
  });

  it("returns lowercased input when no version present", () => {
    expect(normalizePurl("pkg:npm/Foo")).toBe("pkg:npm/foo");
  });

  it("handles docker digest versions (single @)", () => {
    expect(normalizePurl("pkg:docker/alpine@sha256:deadbeef")).toBe("pkg:docker/alpine");
  });

  it("returns empty string for empty input", () => {
    expect(normalizePurl("")).toBe("");
  });
});

describe("scs_remediation_pr create preflight", () => {
  /** Build a minimal PreflightContext with a stubbed registry.dispatch.
   *  `dispatchImpl` signature mirrors Registry.dispatch at runtime; typed
   *  loosely here because PreflightContext.registry is intentionally `unknown`.
   */
  type DispatchImpl = (
    client: unknown,
    resourceType: string,
    operation: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<unknown>;
  function buildCtx(input: Record<string, unknown>, dispatchImpl: DispatchImpl): PreflightContext {
    return {
      client: {} as unknown,
      input,
      registry: { dispatch: dispatchImpl },
    };
  }

  function getPreflight(): (ctx: PreflightContext) => Promise<void> {
    const spec = getOp("scs_remediation_pr", "create" as "list");
    if (!spec.preflight) throw new Error("preflight hook missing on scs_remediation_pr create");
    return spec.preflight;
  }

  it("returns silently when purl or artifact_id are absent (defers to downstream validation)", async () => {
    const preflight = getPreflight();
    let called = false;
    const dispatch = async () => { called = true; return []; };

    await expect(preflight(buildCtx({}, dispatch))).resolves.toBeUndefined();
    await expect(preflight(buildCtx({ artifact_id: "a1" }, dispatch))).resolves.toBeUndefined();
    await expect(preflight(buildCtx({ purl: "pkg:npm/foo@1" }, dispatch))).resolves.toBeUndefined();
    expect(called).toBe(false);
  });

  it("allows create when no existing PRs exist", async () => {
    const preflight = getPreflight();
    const dispatch = async () => [];
    await expect(
      preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.0.0", target_version: "1.1.0" } }, dispatch)),
    ).resolves.toBeUndefined();
  });

  it("allows create when existing PRs are for different purls", async () => {
    const preflight = getPreflight();
    const dispatch = async () => [
      { id: "pr-9", purl: "pkg:npm/other@2.0.0", pr_number: 9, pr_status: "CREATED" },
    ];
    await expect(
      preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.0.0" } }, dispatch)),
    ).resolves.toBeUndefined();
  });

  describe("active-status filtering", () => {
    // Closed / merged / dismissed PRs are historical and must NOT block a new
    // remediation attempt for the same component (e.g. a later CVE, or an
    // upgrade to a different target version).
    const TERMINAL_STATUSES = ["CLOSED", "MERGED", "DISMISSED", "REJECTED", "FAILED", "ERROR"];
    for (const status of TERMINAL_STATUSES) {
      it(`allows create when existing same-purl PR has terminal status "${status}"`, async () => {
        const preflight = getPreflight();
        const dispatch = async () => [
          { id: "pr-old", purl: "pkg:npm/foo@1.0.0", pr_number: 1, pr_url: "/pulls/1", pr_status: status },
        ];
        await expect(
          preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.1.0" } }, dispatch)),
        ).resolves.toBeUndefined();
      });
    }

    const ACTIVE_STATUSES = ["OPEN", "CREATED", "PENDING", "IN_PROGRESS", "IN-PROGRESS", "DRAFT", "QUEUED"];
    for (const status of ACTIVE_STATUSES) {
      it(`blocks create when existing same-purl PR is active (status="${status}")`, async () => {
        const preflight = getPreflight();
        const dispatch = async () => [
          { id: "pr-open", purl: "pkg:npm/foo@1.0.0", pr_number: 2, pr_url: "/pulls/2", pr_status: status },
        ];
        await expect(
          preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.1.0" } }, dispatch)),
        ).rejects.toThrow(/Duplicate remediation PR blocked/i);
      });
    }

    it("defaults to blocking when status is missing (assume active — err on the safe side)", async () => {
      const preflight = getPreflight();
      const dispatch = async () => [
        { id: "pr-no-status", purl: "pkg:npm/foo@1.0.0", pr_number: 3 },
      ];
      await expect(
        preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.1.0" } }, dispatch)),
      ).rejects.toThrow(/Duplicate remediation PR blocked/i);
    });

    it("reads status from either pr_status or legacy status field", async () => {
      const preflight = getPreflight();
      // Closed PR expressed under the legacy `status` field — also must not block.
      const dispatch = async () => [
        { id: "pr-legacy", purl: "pkg:npm/foo@1.0.0", pr_number: 4, status: "CLOSED" },
      ];
      await expect(
        preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.1.0" } }, dispatch)),
      ).resolves.toBeUndefined();
    });
  });

  describe("scope + signal propagation", () => {
    it("propagates org_id and project_id from the outer input into the inner list dispatch", async () => {
      const preflight = getPreflight();
      const seen: Record<string, unknown>[] = [];
      const dispatch: DispatchImpl = async (_c, _rt, _op, input) => {
        seen.push(input);
        return [];
      };
      await preflight(buildCtx(
        {
          artifact_id: "art-1",
          org_id: "specificOrg",
          project_id: "specificProj",
          body: { purl: "pkg:npm/foo@1.0.0" },
        },
        dispatch,
      ));
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({
        artifact_id: "art-1",
        org_id: "specificOrg",
        project_id: "specificProj",
      });
    });

    it("omits org_id/project_id from inner dispatch when outer input has none (lets registry fall back to config)", async () => {
      const preflight = getPreflight();
      const seen: Record<string, unknown>[] = [];
      const dispatch: DispatchImpl = async (_c, _rt, _op, input) => { seen.push(input); return []; };
      await preflight(buildCtx(
        { artifact_id: "art-1", body: { purl: "pkg:npm/foo@1.0.0" } },
        dispatch,
      ));
      expect(seen[0]).not.toHaveProperty("org_id");
      expect(seen[0]).not.toHaveProperty("project_id");
    });

    it("forwards the AbortSignal to every paginated inner dispatch", async () => {
      const preflight = getPreflight();
      const controller = new AbortController();
      const seenSignals: (AbortSignal | undefined)[] = [];
      const fullPage = () => Array.from({ length: 100 }, (_, i) => ({
        id: `pr-${i}`, purl: `pkg:npm/other${i}@1.0.0`, pr_number: i, pr_status: "CREATED",
      }));
      const dispatch: DispatchImpl = async (_c, _rt, _op, _input, signal) => {
        seenSignals.push(signal);
        return fullPage();
      };
      const ctx: PreflightContext = {
        client: {} as unknown,
        input: { artifact_id: "a1", body: { purl: "pkg:npm/foo@1.0.0" } },
        registry: { dispatch },
        signal: controller.signal,
      };
      await preflight(ctx);
      expect(seenSignals).toHaveLength(5); // all 5 pages
      for (const sig of seenSignals) expect(sig).toBe(controller.signal);
    });
  });

  describe("purl resolution from input or body", () => {
    it("reads purl from top-level input when body is absent", async () => {
      const preflight = getPreflight();
      const dispatch: DispatchImpl = async () => [
        { id: "pr-1", purl: "pkg:npm/foo@1.0.0", pr_number: 1, pr_status: "OPEN" },
      ];
      await expect(
        preflight(buildCtx({ artifact_id: "a1", purl: "pkg:npm/foo@1.1.0" }, dispatch)),
      ).rejects.toThrow(/Duplicate remediation PR blocked/i);
    });

    it("prefers body.purl over input.purl when both are present", async () => {
      const preflight = getPreflight();
      const dispatch: DispatchImpl = async () => [
        // Duplicate of body.purl but NOT input.purl — if body is preferred, this blocks.
        { id: "pr-1", purl: "pkg:npm/bar@1.0.0", pr_number: 1, pr_status: "OPEN" },
      ];
      await expect(
        preflight(buildCtx(
          { artifact_id: "a1", purl: "pkg:npm/foo@1.1.0", body: { purl: "pkg:npm/bar@1.1.0" } },
          dispatch,
        )),
      ).rejects.toThrow(/Duplicate remediation PR blocked/i);
    });
  });

  describe("pagination", () => {
    it("paginates the list call until a partial page is returned", async () => {
      const preflight = getPreflight();
      const calls: Array<{ page: number; size: number }> = [];
      const pageOne = Array.from({ length: 100 }, (_, i) => ({
        id: `pr-${i}`,
        purl: `pkg:npm/other${i}@1.0.0`,
        pr_number: i,
        pr_status: "CREATED",
      }));
      const pageTwo = [
        { id: "pr-100", purl: "pkg:npm/other100@1.0.0", pr_number: 100, pr_status: "CREATED" },
      ];
      const dispatch = async (_c: unknown, _rt: unknown, _op: unknown, input: Record<string, unknown>) => {
        calls.push({ page: input.page as number, size: input.size as number });
        if (input.page === 0) return pageOne;
        if (input.page === 1) return pageTwo;
        return [];
      };

      await expect(
        preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.0.0" } }, dispatch)),
      ).resolves.toBeUndefined();

      expect(calls).toEqual([
        { page: 0, size: 100 },
        { page: 1, size: 100 },
      ]);
    });

    it("catches a duplicate that lives on page 2 (would be missed by a single-page check)", async () => {
      const preflight = getPreflight();
      const pageOne = Array.from({ length: 100 }, (_, i) => ({
        id: `pr-${i}`,
        purl: `pkg:npm/other${i}@1.0.0`,
        pr_number: i,
        pr_status: "CREATED",
      }));
      const pageTwo = [
        { id: "pr-dup", purl: "pkg:npm/foo@1.0.0", pr_number: 999, pr_url: "/pulls/999", pr_status: "OPEN" },
      ];
      const dispatch = async (_c: unknown, _rt: unknown, _op: unknown, input: Record<string, unknown>) => {
        if (input.page === 0) return pageOne;
        if (input.page === 1) return pageTwo;
        return [];
      };

      await expect(
        preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.1.0" } }, dispatch)),
      ).rejects.toThrow(/#999/);
    });

    it("caps iteration at PREFLIGHT_MAX_PAGES (5) to bound worst-case latency", async () => {
      const preflight = getPreflight();
      const calls: number[] = [];
      const fullPage = () => Array.from({ length: 100 }, (_, i) => ({
        id: `pr-${i}`, purl: `pkg:npm/other${i}@1.0.0`, pr_number: i, pr_status: "CREATED",
      }));
      const dispatch = async (_c: unknown, _rt: unknown, _op: unknown, input: Record<string, unknown>) => {
        calls.push(input.page as number);
        return fullPage(); // always full — would loop forever without a cap
      };

      await expect(
        preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.0.0" } }, dispatch)),
      ).resolves.toBeUndefined();
      expect(calls).toEqual([0, 1, 2, 3, 4]);
    });
  });

  it("blocks create when an existing PR matches the same purl (ignoring version)", async () => {
    const preflight = getPreflight();
    const dispatch = async () => [
      { id: "pr-1", purl: "pkg:npm/foo@1.0.0", pr_number: 13, pr_url: "/pulls/13", pr_status: "CREATED" },
    ];
    await expect(
      preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.1.0" } }, dispatch)),
    ).rejects.toThrow(/Duplicate remediation PR blocked/i);
  });

  it("conflict message populates ref from pr_url/pr_number/pr_status (the list-extractor fields)", async () => {
    // Regression: preflight used to read pull_request_url/pull_request_number/status,
    // which the list extractor strips — producing an empty ref. Ensure the
    // whitelisted names are what we actually surface.
    const preflight = getPreflight();
    const dispatch = async () => [
      { id: "pr-1", purl: "pkg:npm/foo@1.0.0", pr_number: 42, pr_url: "/pulls/42", pr_status: "OPEN" },
    ];
    await expect(
      preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.1.0" } }, dispatch)),
    ).rejects.toThrow(/url=\/pulls\/42.*#42.*status=OPEN/);
  });

  it("blocks create when existing PR has no purl but matching package_name suffix", async () => {
    const preflight = getPreflight();
    const dispatch = async () => [
      { id: "pr-2", package_name: "foo", pr_number: 7, pr_status: "CREATED" },
    ];
    await expect(
      preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.0.0" } }, dispatch)),
    ).rejects.toThrow(/Duplicate remediation PR blocked/i);
  });

  it("tolerates all list response shapes (array / items / data / content / results / pull_requests)", async () => {
    const preflight = getPreflight();
    const hit = { id: "pr-1", purl: "pkg:npm/foo@1.0.0", pr_number: 1, pr_status: "CREATED" };
    const shapes: unknown[] = [
      [hit],
      { items: [hit] },
      { data: [hit] },
      { content: [hit] },
      { results: [hit] },
      { pull_requests: [hit] },
    ];
    for (const shape of shapes) {
      const dispatch = async () => shape;
      await expect(
        preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@2.0.0" } }, dispatch)),
      ).rejects.toThrow(/Duplicate remediation PR blocked/i);
    }
  });

  describe("list-failure policy", () => {
    it("fails CLOSED on 4xx from the list call", async () => {
      const preflight = getPreflight();
      const dispatch = async () => {
        throw new HarnessApiError("bad request", 400);
      };
      await expect(
        preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.0.0" } }, dispatch)),
      ).rejects.toThrow(/preflight check failed \(HTTP 400\)/i);
    });

    it("fails CLOSED on 404 from the list call (scope/artifact not found)", async () => {
      const preflight = getPreflight();
      const dispatch = async () => {
        throw new HarnessApiError("not found", 404);
      };
      await expect(
        preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.0.0" } }, dispatch)),
      ).rejects.toThrow(/HTTP 404/);
    });

    it("fails OPEN on 5xx from the list call (transient upstream)", async () => {
      const preflight = getPreflight();
      const dispatch = async () => {
        throw new HarnessApiError("bad gateway", 502);
      };
      await expect(
        preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.0.0" } }, dispatch)),
      ).resolves.toBeUndefined();
    });

    it("fails OPEN on network / non-HarnessApiError errors", async () => {
      const preflight = getPreflight();
      const dispatch = async () => {
        throw new Error("ECONNRESET");
      };
      await expect(
        preflight(buildCtx({ artifact_id: "a1", body: { purl: "pkg:npm/foo@1.0.0" } }, dispatch)),
      ).resolves.toBeUndefined();
    });
  });
});

// ─── Registry short-circuit: preflight throws → outbound request never made ──

describe("Registry dispatch — preflight short-circuits outbound request", () => {
  it("skips client.request when scs_remediation_pr create preflight throws", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "scs" }));
    // The preflight's internal registry.dispatch(...) call (for the duplicate
    // list check) is the SAME registry instance — so the first client.request
    // we observe is for the list call, and if it returns a conflict we expect
    // the SECOND request (the create POST) to never happen.
    const requestFn = vi.fn().mockImplementation(async (opts: { method: string; path: string }) => {
      // List call: /remediation/pull-requests — return a same-purl active PR.
      if (opts.method === "GET" && opts.path.includes("/remediation/pull-requests")) {
        return {
          items: [
            { id: "pr-1", purl: "pkg:npm/foo@1.0.0", pr_number: 13, pr_url: "/pulls/13", pr_status: "OPEN" },
          ],
        };
      }
      // Anything else (the create POST) is an unexpected call and should fail the test.
      throw new Error(`Unexpected outbound request: ${opts.method} ${opts.path}`);
    });
    const client = makeClient(requestFn);

    await expect(
      registry.dispatch(client, "scs_remediation_pr", "create" as "list", {
        artifact_id: "art-1",
        org_id: "myOrg",
        project_id: "myProj",
        body: { purl: "pkg:npm/foo@1.1.0", target_version: "1.1.0" },
      }),
    ).rejects.toThrow(/Duplicate remediation PR blocked/i);

    // Exactly one outbound request — the LIST — and zero create-POSTs.
    const postCalls = requestFn.mock.calls.filter((c) => {
      const o = c[0] as { method: string };
      return o.method === "POST";
    });
    expect(postCalls).toHaveLength(0);

    const listCalls = requestFn.mock.calls.filter((c) => {
      const o = c[0] as { method: string; path: string };
      return o.method === "GET" && o.path.includes("/remediation/pull-requests");
    });
    expect(listCalls.length).toBeGreaterThanOrEqual(1);
    // Scope propagation: the preflight list MUST use the outer call's org/project,
    // not the registry's config defaults ("default" / "test-project"). Otherwise
    // duplicate detection runs against the wrong project.
    const firstListPath = (listCalls[0]![0] as { path: string }).path;
    expect(firstListPath).toContain("/orgs/myOrg/");
    expect(firstListPath).toContain("/projects/myProj/");
    expect(firstListPath).toContain("/artifacts/art-1/");
  });
});

// ─── P3-12: scs_auto_pr_config path + scope ─────────────────────────────────

describe("scs_auto_pr_config path and scope", () => {
  it("get uses /v1/ssca-config/auto-pr-config", () => {
    const spec = getOp("scs_auto_pr_config", "get");
    expect(spec.method).toBe("GET");
    expect(spec.path).toContain("/v1/ssca-config/auto-pr-config");
    // Path has no {org}/{project} placeholders — scope is conveyed via query params.
    expect(spec.path).not.toMatch(/\{org\}/);
    expect(spec.path).not.toMatch(/\{project\}/);
  });

  it("update uses /v1/ssca-config/auto-pr-config", () => {
    const spec = getOp("scs_auto_pr_config", "update" as "list");
    expect(spec.method).toBe("PUT");
    expect(spec.path).toContain("/v1/ssca-config/auto-pr-config");
  });

  it("is project-scoped with scopeParams mapping to org_id / project_id query params", () => {
    const res = findResource("scs_auto_pr_config");
    expect(res.scope).toBe("project");
    expect(res.scopeParams).toEqual({ org: "org_id", project: "project_id" });
  });

  it("registry dispatch sends org_id/project_id as query params (not path params)", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "scs" }));
    const requestFn = vi.fn().mockResolvedValue({ enabled: true });
    const client = makeClient(requestFn);

    await registry.dispatch(client, "scs_auto_pr_config", "get", {
      org_id: "myOrg",
      project_id: "myProj",
    });

    expect(requestFn).toHaveBeenCalledOnce();
    const call = requestFn.mock.calls[0][0] as { method: string; path: string; params?: Record<string, unknown> };
    expect(call.method).toBe("GET");
    expect(call.path).toContain("/v1/ssca-config/auto-pr-config");
    // Scope travels as query params under the configured names.
    expect(call.params).toMatchObject({ org_id: "myOrg", project_id: "myProj" });
  });
});
