import { describe, it, expect, beforeEach } from "vitest";
import {
  VALID_SCHEMAS,
  buildSchemaUrl,
  isValidSchemaName,
  clearSchemaCache,
} from "../../src/resources/harness-schema.js";

describe("harness-schema resource", () => {
  beforeEach(() => {
    clearSchemaCache();
  });

  describe("VALID_SCHEMAS", () => {
    it("contains pipeline, template, and trigger", () => {
      expect(VALID_SCHEMAS).toEqual(["pipeline", "template", "trigger"]);
    });
  });

  describe("buildSchemaUrl", () => {
    it("builds correct URL for pipeline", () => {
      expect(buildSchemaUrl("pipeline")).toBe(
        "https://raw.githubusercontent.com/harness/harness-schema/main/v0/pipeline.json",
      );
    });

    it("builds correct URL for template", () => {
      expect(buildSchemaUrl("template")).toBe(
        "https://raw.githubusercontent.com/harness/harness-schema/main/v0/template.json",
      );
    });

    it("builds correct URL for trigger", () => {
      expect(buildSchemaUrl("trigger")).toBe(
        "https://raw.githubusercontent.com/harness/harness-schema/main/v0/trigger.json",
      );
    });
  });

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
