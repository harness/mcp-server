import { describe, it, expect, vi } from "vitest";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import type { RequestOptions } from "../../src/client/types.js";
import type { SchemaEntry } from "../../src/data/schemas/types.js";
import { registerSchemaTool } from "../../src/tools/harness-schema.js";

function entry(schema: Record<string, any>): SchemaEntry {
  return { schema, description: "test", group: "test" };
}

function makeSchemaClient(response: unknown) {
  return {
    request: vi.fn(async (_options: RequestOptions) => response),
  };
}

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
    expect(() =>
      registerSchemaTool(server, { DashboardContract: entry({ type: "object", properties: { id: { type: "string" } } }) })
    ).not.toThrow();
  });

  it("registers without additionalSchemas (backwards compat)", () => {
    const server = makeMcpServer();
    expect(() => registerSchemaTool(server)).not.toThrow();
  });

  it("throws when additionalSchemas key collides with a built-in schema name", () => {
    const server = makeMcpServer();
    expect(() =>
      registerSchemaTool(server, { pipeline: entry({ type: "object" }) }),
    ).toThrow("conflicts with a built-in schema name");
  });

  it("handler returns fields from a Harness-layout extension schema (definitions[type][type])", async () => {
    const server = makeMcpServer();
    const dashboardSchema = entry({
      definitions: {
        DashboardContract: {
          DashboardContract: {
            type: "object",
            properties: { title: { type: "string" }, widgets: { type: "array" } },
            required: ["title"],
          },
        },
      },
    });
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
    registerSchemaTool(server, {
      MyExtension: entry({
        type: "object",
        properties: { name: { type: "string" }, count: { type: "number" } },
        required: ["name"],
      }),
    });

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

  it("keeps root-level summaries for built-in v1 schemas", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server);

    const result = await server.call("harness_schema", { resource_type: "service_v1" });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed.fields).toEqual([
      { name: "version", type: "number", required: true },
      { name: "kind", type: "string", required: true },
      { name: "spec", type: "object", required: true, ref: "ServiceSpec" },
      { name: "desc", type: "unknown", required: false },
    ]);
  });

  it("fetches missing entity schemas from the authenticated yaml-schema endpoint", async () => {
    const server = makeMcpServer();
    const client = makeSchemaClient({
      data: {
        schema: {
          type: "object",
          properties: {
            identifier: { type: "string" },
            spec: { type: "object" },
          },
          required: ["identifier"],
        },
      },
    });
    registerSchemaTool(server, client);

    const result = await server.call("harness_schema", { resource_type: "connector" });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(client.request).toHaveBeenCalledWith({
      method: "GET",
      path: "/ng/api/yaml-schema",
      params: { entityType: "CONNECTOR" },
    });
    expect(parsed.resource_type).toBe("connector");
    expect(parsed.fields).toEqual([
      { name: "identifier", type: "string", required: true },
      { name: "spec", type: "object", required: false },
    ]);
  });

  it("caches live entity schemas after the first fetch", async () => {
    const server = makeMcpServer();
    const client = makeSchemaClient({
      data: {
        schema: {
          type: "object",
          properties: { name: { type: "string" } },
        },
      },
    });
    registerSchemaTool(server, client);

    await server.call("harness_schema", { resource_type: "environment" });
    await server.call("harness_schema", { resource_type: "environment" });

    expect(client.request).toHaveBeenCalledTimes(1);
  });
});
