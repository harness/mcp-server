import { describe, it, expect } from "vitest";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";

const category = ccmToolset.resources.find((resource) => resource.resourceType === "cost_category");
const perspective = ccmToolset.resources.find((resource) => resource.resourceType === "cost_perspective");

describe("CCM write confirmation", () => {
  it("requires confirmation for cost category create and update", () => {
    expect(category?.operations.create?.operationPolicy).toEqual({
      risk: "medium_write",
      retryPolicy: "do_not_retry",
    });
    expect(category?.operations.update?.operationPolicy).toEqual({
      risk: "medium_write",
      retryPolicy: "do_not_retry",
    });
    expect(category?.operations.delete?.operationPolicy.risk).toBe("destructive");
    expect(category?.operations.create?.confirmationPreview).toBeTypeOf("function");
    expect(category?.operations.update?.confirmationPreview).toBeTypeOf("function");
  });

  it("requires confirmation for cost perspective create and update", () => {
    expect(perspective?.operations.create?.operationPolicy).toEqual({
      risk: "medium_write",
      retryPolicy: "do_not_retry",
    });
    expect(perspective?.operations.update?.operationPolicy).toEqual({
      risk: "medium_write",
      retryPolicy: "safe",
    });
    expect(perspective?.operations.delete?.operationPolicy.risk).toBe("destructive");
    expect(perspective?.executeActions?.clone?.operationPolicy.risk).toBe("low_write");
    expect(perspective?.operations.create?.confirmationPreview).toBeTypeOf("function");
    expect(perspective?.operations.update?.confirmationPreview).toBeTypeOf("function");
  });

  it("previews publish defaults only on perspective create", () => {
    const createPreview = perspective?.operations.create?.confirmationPreview?.({ name: "All" });
    const updatePreview = perspective?.operations.update?.confirmationPreview?.({ name: "All" });

    expect(createPreview).toContain("View state: COMPLETED");
    expect(updatePreview).toContain("View state: omitted from replacement body");
  });
});
