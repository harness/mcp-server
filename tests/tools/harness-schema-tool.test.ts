import { describe, it, expect, vi } from "vitest";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { registerSchemaTool } from "../../src/tools/harness-schema.js";

function makeMcpServer() {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    registerTool: vi.fn((name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      const extra = { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} };
      return tool.handler(args, extra) as Promise<ToolResult>;
    },
  } as any;
}

function parseResult(result: ToolResult): unknown {
  return JSON.parse(result.content[0]!.text);
}

describe("registerSchemaTool additionalSchemas", () => {
  it("accepts additionalSchemas without throwing", () => {
    const server = makeMcpServer();
    const extra = {
      DashboardContract: { type: "object", properties: { id: { type: "string" } } },
    };
    expect(() => registerSchemaTool(server, extra)).not.toThrow();
  });

  it("registers without additionalSchemas (backwards compat)", () => {
    const server = makeMcpServer();
    expect(() => registerSchemaTool(server)).not.toThrow();
  });

  it("throws when additionalSchemas key collides with a built-in schema name", () => {
    const server = makeMcpServer();
    expect(() =>
      registerSchemaTool(server, { pipeline: { type: "object" } }),
    ).toThrow("conflicts with a built-in schema name");
  });

  it("handler returns fields from a Harness-layout extension schema (definitions[type][type])", async () => {
    const server = makeMcpServer();
    const dashboardSchema = {
      definitions: {
        DashboardContract: {
          DashboardContract: {
            type: "object",
            properties: { title: { type: "string" }, widgets: { type: "array" } },
            required: ["title"],
          },
        },
      },
    };
    registerSchemaTool(server, { DashboardContract: dashboardSchema });

    const result = await server.call("harness_schema", { resource_type: "DashboardContract" });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed.resource_type).toBe("DashboardContract");
    expect(parsed.fields).toEqual([
      { name: "title", type: "string", required: true },
      { name: "widgets", type: "array", required: false },
    ]);
  });

  it("handler returns fields from a plain JSON Schema extension schema (root-level properties)", async () => {
    const server = makeMcpServer();
    const plainSchema = {
      type: "object",
      properties: { name: { type: "string" }, count: { type: "number" } },
      required: ["name"],
    };
    registerSchemaTool(server, { MyExtension: plainSchema });

    const result = await server.call("harness_schema", { resource_type: "MyExtension" });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed.resource_type).toBe("MyExtension");
    expect(parsed.fields).toEqual([
      { name: "name", type: "string", required: true },
      { name: "count", type: "number", required: false },
    ]);
  });

  it("handler still returns built-in schema content when no additionalSchemas", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server);

    const result = await server.call("harness_schema", { resource_type: "pipeline" });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed.resource_type).toBe("pipeline");
    expect(Array.isArray(parsed.fields)).toBe(true);
  });
});
