import { describe, it, expect, vi } from "vitest";
import { registerSchema, SCHEMAS, VALID_SCHEMAS } from "../../src/data/schemas/index.js";
import { isValidSchemaName } from "../../src/resources/harness-schema.js";
import { registerSchemaTool } from "../../src/tools/harness-schema.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";

function parseToolResult(result: ToolResult): unknown {
  const content = result.content[0];
  if (content?.type !== "text") {
    throw new Error("Expected text tool result");
  }

  return JSON.parse(content.text);
}

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

    it("advertises runtime schemas when the schema tool is registered after them", async () => {
      registerSchema("tool-dashboard-contract-test", {
        definitions: {
          "tool-dashboard-contract-test": {
            "tool-dashboard-contract-test": {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      });

      const registerTool = vi.fn();
      registerSchemaTool({ registerTool } as unknown as Parameters<typeof registerSchemaTool>[0]);

      const schemaConfig = registerTool.mock.calls[0]?.[1] as {
        inputSchema: {
          resource_type: {
            parse(value: string): string;
          };
        };
      };
      expect(schemaConfig.inputSchema.resource_type.parse("tool-dashboard-contract-test")).toBe(
        "tool-dashboard-contract-test",
      );

      const handler = registerTool.mock.calls[0]?.[2] as (args: Record<string, unknown>) => Promise<ToolResult>;
      const result = await handler({ resource_type: "tool-dashboard-contract-test" });
      expect(parseToolResult(result)).toMatchObject({
        resource_type: "tool-dashboard-contract-test",
        fields: [
          {
            name: "name",
            type: "string",
            required: false,
          },
        ],
      });
    });
  });
});
