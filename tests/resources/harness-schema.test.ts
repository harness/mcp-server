import { describe, it, expect } from "vitest";
import { isValidSchemaName } from "../../src/resources/harness-schema.js";

describe("harness-schema resource", () => {
  describe("isValidSchemaName", () => {
    it("returns true for valid schema names", () => {
      expect(isValidSchemaName("pipeline")).toBe(true);
      expect(isValidSchemaName("template")).toBe(true);
      expect(isValidSchemaName("trigger")).toBe(true);
    });

    it("returns false for invalid schema names", () => {
      expect(isValidSchemaName("invalid")).toBe(false);
      expect(isValidSchemaName("")).toBe(false);
      expect(isValidSchemaName("Pipeline")).toBe(false);
      expect(isValidSchemaName("connector")).toBe(false);
    });
  });
});
