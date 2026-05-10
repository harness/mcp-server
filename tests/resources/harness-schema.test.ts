import { describe, it, expect } from "vitest";
import { registerSchema, SCHEMAS, VALID_SCHEMAS } from "../../src/data/schemas/index.js";
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

    it("returns true for schemas registered at runtime", () => {
      registerSchema("dashboard-contract-test", {
        definitions: {
          "dashboard-contract-test": {
            "dashboard-contract-test": {
              type: "object",
              properties: {
                title: { type: "string" },
              },
            },
          },
        },
      });

      expect(isValidSchemaName("dashboard-contract-test")).toBe(true);
      expect(VALID_SCHEMAS).toContain("dashboard-contract-test");
      expect(SCHEMAS["dashboard-contract-test"]).toMatchObject({
        definitions: {
          "dashboard-contract-test": expect.any(Object),
        },
      });
    });

    it("throws when registering a duplicate schema name", () => {
      registerSchema("duplicate-dashboard-contract-test", {
        definitions: {
          "duplicate-dashboard-contract-test": {},
        },
      });

      expect(() =>
        registerSchema("duplicate-dashboard-contract-test", {
          definitions: {
            "duplicate-dashboard-contract-test": {},
          },
        }),
      ).toThrow("Schema 'duplicate-dashboard-contract-test' already registered.");
    });
  });
});
