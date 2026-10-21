/**
 * CCM write operationPolicy risk levels (#1124): cost perspectives and cost
 * categories are medium_write so MCP elicitation matches governance impact.
 */
import { describe, it, expect } from "vitest";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";

const costPerspective = ccmToolset.resources.find((r) => r.resourceType === "cost_perspective");
const costCategory = ccmToolset.resources.find((r) => r.resourceType === "cost_category");

describe("CCM cost_perspective write risk (#1124)", () => {
  it("classifies create/update as medium_write with expected retry policies", () => {
    expect(costPerspective).toBeDefined();
    expect(costPerspective!.operations.create!.operationPolicy).toEqual({
      risk: "medium_write",
      retryPolicy: "do_not_retry",
    });
    expect(costPerspective!.operations.update!.operationPolicy).toEqual({
      risk: "medium_write",
      retryPolicy: "safe",
    });
  });

  it("keeps read and delete at read/destructive", () => {
    expect(costPerspective!.operations.list!.operationPolicy?.risk).toBe("read");
    expect(costPerspective!.operations.get!.operationPolicy?.risk).toBe("read");
    expect(costPerspective!.operations.delete!.operationPolicy?.risk).toBe("destructive");
  });
});

describe("CCM cost_category write risk (#1124)", () => {
  it("classifies create/update as medium_write with do_not_retry", () => {
    expect(costCategory).toBeDefined();
    expect(costCategory!.operations.create!.operationPolicy).toEqual({
      risk: "medium_write",
      retryPolicy: "do_not_retry",
    });
    expect(costCategory!.operations.update!.operationPolicy).toEqual({
      risk: "medium_write",
      retryPolicy: "do_not_retry",
    });
  });

  it("keeps read/list/delete at read/destructive", () => {
    expect(costCategory!.operations.list!.operationPolicy?.risk).toBe("read");
    expect(costCategory!.operations.get!.operationPolicy?.risk).toBe("read");
    expect(costCategory!.operations.delete!.operationPolicy?.risk).toBe("destructive");
  });
});
