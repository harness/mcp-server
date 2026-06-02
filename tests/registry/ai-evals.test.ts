/**
 * Unit tests for AI Evals toolset:
 * - Pagination mapping (size → limit)
 * - Resource presence and removed internal ops
 * - New online_eval resource
 * - Filter queryParams correctness
 * - diagnosticHint presence on key entities
 */
import { describe, it, expect } from "vitest";
import { aiEvalsToolset } from "../../src/registry/toolsets/ai-evals.js";
import { aiEvalsListExtract, aiEvalsArrayExtract } from "../../src/registry/extractors.js";
import type { ResourceDefinition } from "../../src/registry/types.js";

/** Helper: find a resource definition by resourceType */
function findResource(type: string): ResourceDefinition {
  const res = aiEvalsToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in aiEvalsToolset`);
  return res;
}

// ─── Pagination mapping ─────────────────────────────────────────────────────

describe("AI Evals pagination mapping", () => {
  it("dataset list sends size as limit query param", () => {
    const res = findResource("eval_dataset");
    const listOp = res.operations.list!;
    expect(listOp.queryParams).toHaveProperty("size", "limit");
    expect(listOp.queryParams).toHaveProperty("page", "page");
  });

  it("eval_run list sends size as limit query param", () => {
    const res = findResource("eval_run");
    const listOp = res.operations.list!;
    expect(listOp.queryParams).toHaveProperty("size", "limit");
  });
});

// ─── Internal ops removed ───────────────────────────────────────────────────

describe("AI Evals internal ops removed", () => {
  it("eval_run has no create operation", () => {
    const res = findResource("eval_run");
    expect(res.operations.create).toBeUndefined();
  });

  it("eval_run has no update operation", () => {
    const res = findResource("eval_run");
    expect(res.operations.update).toBeUndefined();
  });

  it("eval_run has no post_scores execute action", () => {
    const res = findResource("eval_run");
    expect(res.executeActions?.post_scores).toBeUndefined();
  });

  it("eval_run_item has no append_items execute action", () => {
    const res = findResource("eval_run_item");
    expect(res.executeActions).toBeUndefined();
  });

  it("eval_run retains list, get, compare, rescore", () => {
    const res = findResource("eval_run");
    expect(res.operations.list).toBeDefined();
    expect(res.operations.get).toBeDefined();
    expect(res.executeActions?.compare).toBeDefined();
    expect(res.executeActions?.rescore).toBeDefined();
  });
});

// ─── online_eval resource ───────────────────────────────────────────────────

describe("AI Evals online_eval resource", () => {
  it("exists in the toolset", () => {
    expect(() => findResource("online_eval")).not.toThrow();
  });

  it("has evaluate execute action with POST method", () => {
    const res = findResource("online_eval");
    const action = res.executeActions?.evaluate;
    expect(action).toBeDefined();
    expect(action!.method).toBe("POST");
  });

  it("evaluate path includes trace_id", () => {
    const res = findResource("online_eval");
    const action = res.executeActions!.evaluate;
    const path = action.pathBuilder!(
      { trace_id: "abc123", org_id: "myorg", project_id: "myproj" },
      { HARNESS_ORG: "", HARNESS_PROJECT: "" },
    );
    expect(path).toContain("/traces/abc123/evaluate");
  });

  it("has diagnosticHint", () => {
    const res = findResource("online_eval");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint).toContain("trace");
  });
});

// ─── Filter queryParams ─────────────────────────────────────────────────────

describe("AI Evals filter queryParams", () => {
  it("dataset list has target_id filter", () => {
    const res = findResource("eval_dataset");
    expect(res.operations.list!.queryParams).toHaveProperty("target_id", "target_id");
  });

  it("metric list has search and target_id filters", () => {
    const res = findResource("eval_metric");
    const qp = res.operations.list!.queryParams!;
    expect(qp).toHaveProperty("search", "search");
    expect(qp).toHaveProperty("target_id", "target_id");
  });

  it("metric set list has target_id filter", () => {
    const res = findResource("eval_metric_set");
    expect(res.operations.list!.queryParams).toHaveProperty("target_id", "target_id");
  });
});

// ─── diagnosticHint presence ────────────────────────────────────────────────

describe("AI Evals diagnosticHint on key entities", () => {
  const entitiesWithHints = [
    "eval_dataset",
    "evaluation",
    "eval_target",
    "eval_metric",
    "eval_metric_set",
    "eval_suite",
    "online_eval",
  ];

  for (const type of entitiesWithHints) {
    it(`${type} has a diagnosticHint`, () => {
      const res = findResource(type);
      expect(res.diagnosticHint).toBeDefined();
      expect(res.diagnosticHint!.length).toBeGreaterThan(20);
    });
  }
});

// ─── Extractors ─────────────────────────────────────────────────────────────

describe("AI Evals extractors", () => {
  it("aiEvalsListExtract handles standard paginated response", () => {
    const result = aiEvalsListExtract({ data: [{ id: "1" }, { id: "2" }], total_elements: 5 });
    expect(result).toEqual({ items: [{ id: "1" }, { id: "2" }], total: 5 });
  });

  it("aiEvalsListExtract handles empty response", () => {
    const result = aiEvalsListExtract({});
    expect(result).toEqual({ items: [], total: 0 });
  });

  it("aiEvalsArrayExtract handles bare array", () => {
    const result = aiEvalsArrayExtract([{ id: "a" }, { id: "b" }]);
    expect(result).toEqual({ items: [{ id: "a" }, { id: "b" }], total: 2 });
  });

  it("aiEvalsArrayExtract handles non-array", () => {
    const result = aiEvalsArrayExtract("unexpected");
    expect(result).toEqual({ items: [], total: 0 });
  });
});
