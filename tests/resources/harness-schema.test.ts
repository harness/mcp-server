import { describe, it, expect } from "vitest";
import { isValidSchemaName } from "../../src/resources/harness-schema.js";

describe("harness-schema resource", () => {
  describe("isValidSchemaName", () => {
    it("returns true for v0 schema names", () => {
      expect(isValidSchemaName("pipeline")).toBe(true);
      expect(isValidSchemaName("template")).toBe(true);
      expect(isValidSchemaName("trigger")).toBe(true);
    });

    it("returns true for v1 schema names", () => {
      expect(isValidSchemaName("pipeline_v1")).toBe(true);
      expect(isValidSchemaName("template_v1")).toBe(true);
      expect(isValidSchemaName("trigger_v1")).toBe(true);
      expect(isValidSchemaName("inputSet_v1")).toBe(true);
      expect(isValidSchemaName("overlayInputSet_v1")).toBe(true);
      expect(isValidSchemaName("service_v1")).toBe(true);
      expect(isValidSchemaName("infra_v1")).toBe(true);
    });

    it("returns true for local schema names", () => {
      expect(isValidSchemaName("agent-pipeline")).toBe(true);
    });

    it("returns false for invalid schema names", () => {
      expect(isValidSchemaName("invalid")).toBe(false);
      expect(isValidSchemaName("")).toBe(false);
      expect(isValidSchemaName("Pipeline")).toBe(false);
      expect(isValidSchemaName("connector")).toBe(false);
    });
  });
});
