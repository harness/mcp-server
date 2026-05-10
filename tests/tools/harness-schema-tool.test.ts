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

  it("handler returns extension schema content when resource_type matches additionalSchemas key", async () => {
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
    expect(parsed.fields).toBeDefined();
  });

  it("handler still returns built-in schema content when no additionalSchemas", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server);

    const result = await server.call("harness_schema", { resource_type: "pipeline" });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed.resource_type).toBe("pipeline");
  });
});
