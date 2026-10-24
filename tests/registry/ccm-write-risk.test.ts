/**
 * Guards CCM write operationPolicy risk levels that drive MCP elicitation.
 * cost_perspective and cost_category (business-mapping) were raised to
 * medium_write so agents must confirm before mutating billing views.
 */
import { describe, it, expect } from "vitest";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";

function op(resourceType: string, operation: "create" | "update") {
  const resource = ccmToolset.resources.find((r) => r.resourceType === resourceType);
  if (!resource) throw new Error(`missing resource ${resourceType}`);
  const spec = resource.operations[operation];
  if (!spec) throw new Error(`missing ${operation} on ${resourceType}`);
  return spec;
}

describe("CCM medium_write governance (#1124)", () => {
  it("cost_perspective create/update require medium_write confirmation", () => {
    expect(op("cost_perspective", "create").operationPolicy?.risk).toBe("medium_write");
    expect(op("cost_perspective", "update").operationPolicy?.risk).toBe("medium_write");
    expect(op("cost_perspective", "update").operationPolicy?.retryPolicy).toBe("safe");
  });

  it("cost_category create/update require medium_write confirmation", () => {
    expect(op("cost_category", "create").operationPolicy?.risk).toBe("medium_write");
    expect(op("cost_category", "update").operationPolicy?.risk).toBe("medium_write");
  });

  it("cost_perspective list/get remain read-only", () => {
    const perspective = ccmToolset.resources.find((r) => r.resourceType === "cost_perspective");
    expect(perspective?.operations.list?.operationPolicy?.risk).toBe("read");
    expect(perspective?.operations.get?.operationPolicy?.risk).toBe("read");
  });
});
