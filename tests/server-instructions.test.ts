import { describe, expect, it } from "vitest";
import { buildServerInstructions } from "../src/server-instructions.js";

describe("server instructions", () => {
  it("tells models to filter harness_describe by operation", () => {
    for (const version of [undefined, "0", "1"] as const) {
      const text = buildServerInstructions({ HARNESS_PIPELINE_VERSION: version });
      expect(text).toContain("harness_describe(operation='list'|'get'|'create'|'update'|'delete'|'execute')");
      expect(text).toContain("harness_describe(resource_type='<type>')");
      expect(text).not.toContain("harness_describe() to list all");
    }
  });

  it("keeps the pipeline default that matches HARNESS_PIPELINE_VERSION", () => {
    expect(buildServerInstructions({ HARNESS_PIPELINE_VERSION: "1" })).toContain("Default to v1.");
    expect(buildServerInstructions({})).toContain("Default to v0");
  });
});
