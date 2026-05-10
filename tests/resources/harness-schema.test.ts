import { describe, it, expect, vi } from "vitest";
import { isValidSchemaName, registerHarnessSchemaResource } from "../../src/resources/harness-schema.js";
import type { SchemaEntry } from "../../src/data/schemas/index.js";

describe("registerHarnessSchemaResource collision guard", () => {
  it("throws when additionalSchemas key collides with a built-in schema name", () => {
    const server = { registerResource: vi.fn() } as any;
    const e: SchemaEntry = { schema: { type: "object" }, description: "test", group: "test" };
    expect(() =>
      registerHarnessSchemaResource(server, { pipeline: e }),
    ).toThrow("conflicts with a built-in schema name");
  });
});

describe("isValidSchemaName with extension schemas", () => {
  it("returns false for an extension schema name when no extensions passed", () => {
    expect(isValidSchemaName("DashboardContract")).toBe(false);
  });

  it("returns true for an extension schema name when passed in merged set", () => {
    const mergedNames = ["pipeline", "DashboardContract"];
    expect(isValidSchemaName("DashboardContract", mergedNames)).toBe(true);
  });

  it("returns false for unknown name even with merged set", () => {
    const mergedNames = ["pipeline", "DashboardContract"];
    expect(isValidSchemaName("unknown", mergedNames)).toBe(false);
  });
});

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
